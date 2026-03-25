"""
services/pagos.py — Lógica de negocio del módulo Pagos
=======================================================
Reglas clave:
  - Historial INMUTABLE: nunca UPDATE ni DELETE en tabla pagos.
  - El trigger `actualizar_saldo_prestamo` descuenta del saldo al insertar.
  - Después de cada pago se recalcula el estado de la cuota y del préstamo.
  - Si todas las cuotas quedan 'pagada' → préstamo pasa a 'cerrado'.

Saldo real de una cuota:
  monto_restante = cuota.monto - cuota.monto_pagado + cuota.recargo_mora

Tipos de pago:
  - Total     : monto == monto_restante
  - Parcial   : 0 < monto < monto_restante
  - Con mora  : monto incluye el recargo_mora (idéntico a total)
"""
import logging
from datetime import datetime

from fastapi import HTTPException, status
from supabase import Client

from app.middleware.auth import AuthUser
from app.services.clientes import _log

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def listar_pagos(
    supabase: Client,
    user: AuthUser,
    prestamo_id: str,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], int]:
    """
    Historial de pagos de un préstamo, ordenado del más reciente al más antiguo.
    Cobrador solo puede ver pagos de sus préstamos.
    """
    _verificar_acceso_prestamo(supabase, user, prestamo_id)

    offset = (page - 1) * per_page
    result = (
        supabase.table("pagos")
        .select(
            "*, cuotas(numero, fecha_vencimiento),"
            " profiles!pagos_registrado_por_fkey(nombre, email)",
            count="exact",
        )
        .eq("prestamo_id", prestamo_id)
        .order("fecha_pago", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return result.data, result.count or 0


def obtener_cuotas_prestamo(
    supabase: Client, user: AuthUser, prestamo_id: str
) -> list[dict]:
    """Retorna todas las cuotas de un préstamo, ordenadas por número."""
    _verificar_acceso_prestamo(supabase, user, prestamo_id)
    result = (
        supabase.table("cuotas")
        .select("*")
        .eq("prestamo_id", prestamo_id)
        .order("numero")
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Registrar pago
# ---------------------------------------------------------------------------

def registrar_pago(supabase: Client, user: AuthUser, datos: dict) -> dict:
    """
    Registra un pago sobre una cuota específica.

    Pasos:
      1. Obtener cuota y validar que está pendiente/parcial/mora.
      2. Validar monto (no puede superar el saldo de la cuota).
      3. Insertar en tabla pagos (trigger descuenta saldo del préstamo).
      4. Actualizar estado de la cuota.
      5. Si todas las cuotas del préstamo están pagadas → cerrar préstamo.
      6. Registrar en system_logs.
    """
    cuota_id   = str(datos["cuota_id"])
    prestamo_id = str(datos["prestamo_id"])
    monto      = float(datos["monto"])
    metodo     = datos.get("metodo", "efectivo")
    notas      = datos.get("notas")

    # 1. Obtener cuota
    cuota_r = (
        supabase.table("cuotas")
        .select("*")
        .eq("id", cuota_id)
        .eq("prestamo_id", prestamo_id)
        .single()
        .execute()
    )
    if not cuota_r.data:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")

    cuota = cuota_r.data

    if cuota["estado"] in ("pagada", "condonada"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La cuota ya está en estado '{cuota['estado']}'",
        )

    # 2. Validar monto
    saldo_cuota = round(
        float(cuota["monto"]) - float(cuota["monto_pagado"]) + float(cuota["recargo_mora"]),
        2,
    )
    if monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    if round(monto, 2) > round(saldo_cuota, 2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El monto (${monto:.2f}) supera el saldo de la cuota (${saldo_cuota:.2f})",
        )

    # 3. Obtener cliente_id desde el préstamo
    prestamo_r = (
        supabase.table("prestamos")
        .select("cliente_id, cobrador_id, estado")
        .eq("id", prestamo_id)
        .single()
        .execute()
    )
    if not prestamo_r.data:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    prestamo = prestamo_r.data

    # Verificar acceso de cobrador
    if user.rol == "cobrador" and prestamo.get("cobrador_id") != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este préstamo")

    if prestamo["estado"] in ("cancelado", "cerrado"):
        raise HTTPException(
            status_code=409,
            detail=f"No se puede registrar un pago en un préstamo '{prestamo['estado']}'",
        )

    # 4. Insertar pago (el trigger actualizar_saldo_prestamo descuenta saldo)
    pago_row = {
        "cuota_id":       cuota_id,
        "prestamo_id":    prestamo_id,
        "cliente_id":     prestamo["cliente_id"],
        "monto":          monto,
        "fecha_pago":     datetime.utcnow().isoformat(),
        "metodo":         metodo,
        "registrado_por": user.id,
        "notas":          notas,
    }
    pago_r = supabase.table("pagos").insert(pago_row).execute()
    pago = pago_r.data[0]

    # 5. Actualizar estado de la cuota
    nuevo_monto_pagado = round(float(cuota["monto_pagado"]) + monto, 2)
    monto_total_cuota  = round(float(cuota["monto"]) + float(cuota["recargo_mora"]), 2)

    if round(nuevo_monto_pagado, 2) >= monto_total_cuota:
        nuevo_estado_cuota = "pagada"
    else:
        nuevo_estado_cuota = "pago_parcial"

    supabase.table("cuotas").update({
        "monto_pagado": nuevo_monto_pagado,
        "estado":       nuevo_estado_cuota,
    }).eq("id", cuota_id).execute()

    # 6. Verificar si el préstamo puede cerrarse
    _evaluar_cierre_prestamo(supabase, prestamo_id)

    _log(supabase, user.id, "INSERT", "pagos", pago["id"], datos_nuevos=pago_row)
    logger.info(
        "Pago registrado: cuota=%s monto=$%.2f cobrador=%s",
        cuota_id, monto, user.id,
    )
    return pago


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _verificar_acceso_prestamo(supabase: Client, user: AuthUser, prestamo_id: str) -> None:
    """Lanza 403 si el cobrador no tiene acceso al préstamo."""
    if user.rol == "admin":
        return
    r = (
        supabase.table("prestamos")
        .select("cobrador_id")
        .eq("id", prestamo_id)
        .single()
        .execute()
    )
    if not r.data or r.data.get("cobrador_id") != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este préstamo")


def _evaluar_cierre_prestamo(supabase: Client, prestamo_id: str) -> None:
    """
    Si todas las cuotas del préstamo están 'pagada' o 'condonada',
    marca el préstamo como 'cerrado'.
    """
    cuotas_r = (
        supabase.table("cuotas")
        .select("estado")
        .eq("prestamo_id", prestamo_id)
        .execute()
    )
    estados = {c["estado"] for c in cuotas_r.data}
    if estados and estados.issubset({"pagada", "condonada"}):
        supabase.table("prestamos").update({
            "estado":          "cerrado",
            "saldo_pendiente": 0,
        }).eq("id", prestamo_id).execute()
        logger.info("Préstamo %s cerrado (todas las cuotas pagadas)", prestamo_id)
