"""
services/prestamos.py — Lógica de negocio del módulo Préstamos
==============================================================
Orquesta la calculadora + persistencia en Supabase.

Flujo de creación:
  1. Validar cliente y cobrador
  2. Calcular cuotas con la calculadora
  3. Insertar prestamo
  4. Insertar cuotas en bulk
  5. Registrar en system_logs

Nota sobre atomicidad:
  Supabase Python SDK no soporta transacciones. Si falla la inserción
  de cuotas después de insertar el préstamo, queda huérfano.
  Solución futura: Supabase Edge Function con BEGIN/COMMIT.
  Por ahora: si falla, retornar error y limpiar manualmente.
"""
import logging
from decimal import Decimal

from fastapi import HTTPException, status
from supabase import Client

from app.middleware.auth import AuthUser
from app.services.calculadora import calcular_prestamo, cuota_a_dict
from app.services.clientes import _log

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def listar_prestamos(
    supabase: Client,
    user: AuthUser,
    cliente_id: str | None = None,
    estado: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """
    Lista préstamos con filtros opcionales.
    Admin: todos. Cobrador: solo los asignados a él.
    """
    offset = (page - 1) * per_page

    query = (
        supabase.table("prestamos")
        .select(
            "*, clientes(nombre, dni, telefono, zona),"
            " profiles!prestamos_cobrador_id_fkey(nombre, email)",
            count="exact",
        )
        .eq("activo", True)
    )

    if user.rol == "cobrador":
        query = query.eq("cobrador_id", user.id)

    if cliente_id:
        query = query.eq("cliente_id", cliente_id)
    if estado:
        query = query.eq("estado", estado)

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return result.data, result.count or 0


def obtener_prestamo(supabase: Client, user: AuthUser, prestamo_id: str) -> dict:
    """
    Retorna préstamo con cuotas. Verifica acceso de cobrador.
    """
    result = (
        supabase.table("prestamos")
        .select("*, cuotas(*), clientes(nombre, dni, telefono)")
        .eq("id", prestamo_id)
        .eq("activo", True)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Préstamo no encontrado")

    prestamo = result.data

    if user.rol == "cobrador" and prestamo.get("cobrador_id") != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este préstamo")

    # Ordenar cuotas por número
    if prestamo.get("cuotas"):
        prestamo["cuotas"] = sorted(prestamo["cuotas"], key=lambda c: c["numero"])

    return prestamo


# ---------------------------------------------------------------------------
# Preview (sin persistir)
# ---------------------------------------------------------------------------

def preview_prestamo(
    monto: Decimal,
    tasa: Decimal,
    tipo_tasa: str,
    periodicidad: str,
    n_cuotas: int,
    fecha_inicio,
) -> dict:
    """
    Calcula y retorna el calendario sin guardar nada en la DB.
    Usado por el endpoint POST /prestamos/calcular.
    """
    resultado = calcular_prestamo(
        monto=monto,
        tasa=tasa,
        tipo_tasa=tipo_tasa,
        periodicidad=periodicidad,
        n_cuotas=n_cuotas,
        fecha_inicio=fecha_inicio,
    )
    return {
        "monto": float(resultado.monto),
        "tasa": float(resultado.tasa),
        "tipo_tasa": resultado.tipo_tasa,
        "periodicidad": resultado.periodicidad,
        "n_cuotas": resultado.n_cuotas,
        "monto_cuota": float(resultado.monto_cuota),
        "monto_total": float(resultado.monto_total),
        "total_intereses": float(resultado.total_intereses),
        "fecha_inicio": resultado.fecha_inicio.isoformat(),
        "fecha_fin_estimada": resultado.fecha_fin_estimada.isoformat(),
        "cuotas": [cuota_a_dict(c) for c in resultado.cuotas],
    }


# ---------------------------------------------------------------------------
# Creación
# ---------------------------------------------------------------------------

def crear_prestamo(supabase: Client, user: AuthUser, datos: dict) -> dict:
    """
    Crea un préstamo con su calendario de cuotas completo.

    1. Valida que el cliente existe y está activo.
    2. Valida cobrador si se especifica.
    3. Calcula cuotas con la calculadora.
    4. Inserta prestamo.
    5. Inserta cuotas en bulk.
    """
    cliente_id = str(datos["cliente_id"])
    cobrador_id = str(datos["cobrador_id"]) if datos.get("cobrador_id") else None

    # 1. Validar cliente
    cliente_r = (
        supabase.table("clientes")
        .select("id, nombre, activo")
        .eq("id", cliente_id)
        .single()
        .execute()
    )
    if not cliente_r.data or not cliente_r.data.get("activo"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado o inactivo",
        )

    # 2. Validar cobrador
    if cobrador_id:
        cobrador_r = (
            supabase.table("profiles")
            .select("id, rol, activo")
            .eq("id", cobrador_id)
            .single()
            .execute()
        )
        if not cobrador_r.data or not cobrador_r.data.get("activo"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cobrador no encontrado o inactivo",
            )
        if cobrador_r.data["rol"] not in ("admin", "cobrador"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario seleccionado no tiene rol de cobrador",
            )

    # 3. Calcular cuotas
    from datetime import date
    fecha_inicio = datos.get("fecha_inicio") or date.today()
    if isinstance(fecha_inicio, str):
        from datetime import datetime
        fecha_inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d").date()

    resultado = calcular_prestamo(
        monto=Decimal(str(datos["monto"])),
        tasa=Decimal(str(datos["tasa"])),
        tipo_tasa=datos["tipo_tasa"],
        periodicidad=datos["periodicidad"],
        n_cuotas=int(datos["n_cuotas"]),
        fecha_inicio=fecha_inicio,
    )

    # 4. Insertar préstamo
    prestamo_row = {
        "cliente_id": cliente_id,
        "cobrador_id": cobrador_id,
        "monto": float(resultado.monto),
        "tasa": float(resultado.tasa),
        "tipo_tasa": datos["tipo_tasa"],
        "periodicidad": datos["periodicidad"],
        "n_cuotas": resultado.n_cuotas,
        "monto_cuota": float(resultado.monto_cuota),
        "monto_total": float(resultado.monto_total),
        "saldo_pendiente": float(resultado.monto_total),
        "estado": "pendiente_aprobacion",
        "fecha_inicio": resultado.fecha_inicio.isoformat(),
        "fecha_fin_estimada": resultado.fecha_fin_estimada.isoformat(),
        "notas": datos.get("notas"),
        "created_by": user.id,
    }

    prestamo_r = (
        supabase.table("prestamos")
        .insert(prestamo_row)
        .select("*")
        .single()
        .execute()
    )
    prestamo = prestamo_r.data
    prestamo_id = prestamo["id"]

    # 5. Insertar cuotas en bulk
    cuotas_rows = [
        {
            "prestamo_id": prestamo_id,
            "numero": c.numero,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            "monto": float(c.monto),
            "monto_pagado": 0.0,
            "estado": "pendiente",
            "dias_mora": 0,
            "recargo_mora": 0.0,
        }
        for c in resultado.cuotas
    ]

    try:
        supabase.table("cuotas").insert(cuotas_rows).execute()
    except Exception as e:
        # Rollback manual: eliminar el préstamo huérfano
        logger.error("Fallo insertando cuotas para préstamo %s: %s", prestamo_id, e)
        supabase.table("prestamos").update({"activo": False}).eq("id", prestamo_id).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generando el calendario de cuotas. El préstamo fue revertido.",
        )

    _log(supabase, user.id, "INSERT", "prestamos", prestamo_id, datos_nuevos=prestamo_row)
    logger.info(
        "Préstamo creado: %s | cliente=%s | monto=%s | cuotas=%s",
        prestamo_id, cliente_id, resultado.monto, resultado.n_cuotas,
    )

    # Retornar con cuotas incluidas
    prestamo["cuotas"] = [
        {**cuota_a_dict(c), "estado": "pendiente", "monto_pagado": 0.0,
         "dias_mora": 0, "recargo_mora": 0.0}
        for c in resultado.cuotas
    ]
    return prestamo


# ---------------------------------------------------------------------------
# Cambios de estado
# ---------------------------------------------------------------------------

TRANSICIONES_VALIDAS: dict[str, list[str]] = {
    "pendiente_aprobacion": ["activo", "cancelado"],
    "activo":               ["en_mora", "cancelado", "cerrado"],
    "en_mora":              ["activo", "cancelado", "cerrado"],
    "cancelado":            [],    # estado terminal
    "cerrado":              [],    # estado terminal
}


def cambiar_estado(
    supabase: Client,
    user: AuthUser,
    prestamo_id: str,
    nuevo_estado: str,
) -> dict:
    """
    Cambia el estado de un préstamo validando la transición.
    Solo admin puede cambiar estados.
    """
    prestamo = obtener_prestamo(supabase, user, prestamo_id)
    estado_actual = prestamo["estado"]

    if nuevo_estado not in TRANSICIONES_VALIDAS.get(estado_actual, []):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transición inválida: {estado_actual} → {nuevo_estado}. "
                   f"Permitidas: {TRANSICIONES_VALIDAS.get(estado_actual, [])}",
        )

    result = (
        supabase.table("prestamos")
        .update({"estado": nuevo_estado})
        .eq("id", prestamo_id)
        .select("*")
        .single()
        .execute()
    )
    _log(
        supabase, user.id, "UPDATE_ESTADO", "prestamos", prestamo_id,
        datos_anteriores={"estado": estado_actual},
        datos_nuevos={"estado": nuevo_estado},
    )
    return result.data


def asignar_cobrador(
    supabase: Client,
    user: AuthUser,
    prestamo_id: str,
    cobrador_id: str | None,
) -> dict:
    """Asigna o desasigna un cobrador a un préstamo."""
    prestamo = obtener_prestamo(supabase, user, prestamo_id)

    if prestamo["estado"] not in ("activo", "en_mora", "pendiente_aprobacion"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede reasignar cobrador de un préstamo en estado '{prestamo['estado']}'",
        )

    if cobrador_id:
        cobrador_r = (
            supabase.table("profiles")
            .select("id, rol, activo")
            .eq("id", cobrador_id)
            .single()
            .execute()
        )
        if not cobrador_r.data or not cobrador_r.data.get("activo"):
            raise HTTPException(status_code=404, detail="Cobrador no encontrado o inactivo")

    result = (
        supabase.table("prestamos")
        .update({"cobrador_id": cobrador_id})
        .eq("id", prestamo_id)
        .select("*")
        .single()
        .execute()
    )
    _log(
        supabase, user.id, "UPDATE_COBRADOR", "prestamos", prestamo_id,
        datos_anteriores={"cobrador_id": prestamo.get("cobrador_id")},
        datos_nuevos={"cobrador_id": cobrador_id},
    )
    return result.data
