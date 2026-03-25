"""
services/cobros.py — Lógica de Cobros del Día
==============================================
Gestiona la lista diaria del cobrador, cobros rápidos (1-toque),
registro de visitas y resúmenes de efectividad.

Vistas usadas:
  - v_cobros_hoy        → cuotas que vencen estrictamente hoy
  - v_cobros_pendientes → hoy + vencidas anteriores (con semáforo y total_a_cobrar)
"""
import logging
from datetime import date

from fastapi import HTTPException, status
from supabase import Client

from app.middleware.auth import AuthUser

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lista de cobros
# ---------------------------------------------------------------------------

def lista_cobros_hoy(
    supabase: Client,
    user: AuthUser,
    zona: str | None = None,
) -> list[dict]:
    """
    Cuotas que vencen HOY únicamente (vista v_cobros_hoy).
    Cobrador → solo sus cuotas. Admin → todas (zona opcional).
    """
    query = supabase.table("v_cobros_hoy").select("*")

    if user.rol == "cobrador":
        query = query.eq("cobrador_id", user.id)
    elif zona:
        query = query.eq("zona", zona)

    result = query.order("zona").order("cliente_nombre").execute()
    return result.data or []


def lista_cobros_pendientes(
    supabase: Client,
    user: AuthUser,
    zona: str | None = None,
) -> list[dict]:
    """
    Cuotas pendientes: hoy + todas las vencidas sin cobrar (v_cobros_pendientes).
    Incluye semáforo visual (amarillo/naranja/rojo) y total_a_cobrar.
    Cobrador → solo sus cuotas. Admin → todas (zona opcional).
    """
    query = supabase.table("v_cobros_pendientes").select("*")

    if user.rol == "cobrador":
        query = query.eq("cobrador_id", user.id)
    elif zona:
        query = query.eq("zona", zona)

    result = query.order("semaforo").order("fecha_vencimiento").order("cliente_nombre").execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Resumen del cobrador
# ---------------------------------------------------------------------------

def resumen_cobrador(
    supabase: Client,
    user: AuthUser,
    fecha: str | None = None,
) -> dict:
    """
    Resumen del día: cuotas asignadas, cobradas, pendientes y monto cobrado.
    Si fecha es None usa hoy.
    Cobrador → sus cuotas. Admin → todas.
    """
    hoy = fecha or date.today().isoformat()

    # ── Cuotas asignadas al cobrador en esa fecha ──────────────────────────
    cuotas_query = (
        supabase.table("cuotas")
        .select("id, estado, monto, monto_pagado, prestamos!inner(cobrador_id)")
        .eq("fecha_vencimiento", hoy)
    )
    if user.rol == "cobrador":
        # Filtro en relación nested: Supabase acepta la notación `tabla.campo`
        cuotas_query = cuotas_query.eq("prestamos.cobrador_id", user.id)

    cuotas_r = cuotas_query.execute()
    cuotas = cuotas_r.data or []

    # ── Pagos registrados en esa fecha por este cobrador ───────────────────
    pagos_query = (
        supabase.table("pagos")
        .select("monto")
        .gte("fecha_pago", f"{hoy}T00:00:00")
        .lte("fecha_pago", f"{hoy}T23:59:59")
    )
    if user.rol == "cobrador":
        pagos_query = pagos_query.eq("registrado_por", user.id)

    pagos_r = pagos_query.execute()
    pagos = pagos_r.data or []

    # ── Métricas ───────────────────────────────────────────────────────────
    total      = len(cuotas)
    cobradas   = sum(1 for c in cuotas if c["estado"] == "pagada")
    parciales  = sum(1 for c in cuotas if c["estado"] == "pago_parcial")
    en_mora    = sum(1 for c in cuotas if c["estado"] == "mora")
    # pendientes = cuotas estrictamente "pendiente" (excluye mora y parciales)
    pendientes = sum(1 for c in cuotas if c["estado"] == "pendiente")

    monto_cobrado  = round(sum(float(p["monto"]) for p in pagos), 2)
    monto_pendiente = round(
        sum(
            float(c["monto"]) - float(c["monto_pagado"])
            for c in cuotas
            if c["estado"] not in ("pagada", "condonada")
        ),
        2,
    )
    porcentaje = round((cobradas / total * 100) if total > 0 else 0.0, 1)

    return {
        "fecha":             hoy,
        "cobrador_id":       user.id,
        "total_cuotas":      total,
        "cuotas_cobradas":   cobradas,
        "cuotas_parciales":  parciales,
        "cuotas_pendientes": pendientes,
        "cuotas_en_mora":    en_mora,
        "monto_cobrado":     monto_cobrado,
        "monto_pendiente":   monto_pendiente,
        "porcentaje_cobro":  porcentaje,
    }


# ---------------------------------------------------------------------------
# Cobro rápido (1-toque)
# ---------------------------------------------------------------------------

def pago_rapido(
    supabase: Client,
    user: AuthUser,
    cuota_id: str,
    metodo: str = "efectivo",
    notas: str | None = None,
) -> dict:
    """
    Registra el pago del saldo exacto pendiente (monto - monto_pagado + recargo_mora).
    Delega en services/pagos.registrar_pago y registra visita automática.

    Lanza HTTPException 404/403/409 si la cuota no existe, sin acceso o ya pagada.
    """
    from app.services.pagos import registrar_pago

    # ── Obtener cuota ──────────────────────────────────────────────────────
    cuota_r = (
        supabase.table("cuotas")
        .select("id, prestamo_id, monto, monto_pagado, recargo_mora, estado,"
                " prestamos!inner(cobrador_id, estado)")
        .eq("id", cuota_id)
        .single()
        .execute()
    )
    if not cuota_r.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Cuota no encontrada")

    cuota = cuota_r.data
    prestamo_info = cuota.get("prestamos") or {}

    # ── Control de acceso para cobrador ───────────────────────────────────
    if user.rol == "cobrador" and prestamo_info.get("cobrador_id") != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tenés acceso a esta cuota")

    # ── Calcular monto exacto ──────────────────────────────────────────────
    saldo = round(float(cuota["monto"]) - float(cuota.get("monto_pagado", 0)), 2)
    recargo = float(cuota.get("recargo_mora") or 0)
    total_a_cobrar = round(saldo + recargo, 2)

    if total_a_cobrar <= 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="La cuota ya está saldada")

    # ── Registrar pago delegando en el servicio de pagos ──────────────────
    datos_pago = {
        "cuota_id":   cuota_id,
        "prestamo_id": cuota["prestamo_id"],
        "monto":       total_a_cobrar,
        "metodo":      metodo,
        "notas":       notas or "Cobro rápido",
    }
    pago = registrar_pago(supabase, user, datos_pago)

    # ── Visita automática ──────────────────────────────────────────────────
    _insertar_visita(supabase, cuota_id, user.id, "cobrado", notas)

    logger.info(
        "Cobro rápido: cuota=%s | monto=$%.2f | cobrador=%s",
        cuota_id, total_a_cobrar, user.id,
    )
    return pago


# ---------------------------------------------------------------------------
# Registro de visita
# ---------------------------------------------------------------------------

def registrar_visita(
    supabase: Client,
    user: AuthUser,
    cuota_id: str,
    resultado: str,
    notas: str | None = None,
) -> dict:
    """
    Registra una visita al cliente sin necesariamente cobrar.
    resultado: 'cobrado' | 'sin_pago' | 'ausente' | 'promesa_pago'
    """
    # ── Verificar existencia y acceso ──────────────────────────────────────
    cuota_r = (
        supabase.table("cuotas")
        .select("id, prestamos!inner(cobrador_id)")
        .eq("id", cuota_id)
        .single()
        .execute()
    )
    if not cuota_r.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Cuota no encontrada")

    if user.rol == "cobrador":
        cobrador_asignado = (cuota_r.data.get("prestamos") or {}).get("cobrador_id")
        if cobrador_asignado != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="No tenés acceso a esta cuota")

    visita = _insertar_visita(supabase, cuota_id, user.id, resultado, notas)
    logger.info(
        "Visita registrada: cuota=%s | resultado=%s | cobrador=%s",
        cuota_id, resultado, user.id,
    )
    return visita


def historial_visitas(
    supabase: Client,
    user: AuthUser,
    cuota_id: str,
) -> list[dict]:
    """Historial de visitas para una cuota específica."""
    query = (
        supabase.table("visitas")
        .select("*, profiles!visitas_cobrador_id_fkey(nombre, email)")
        .eq("cuota_id", cuota_id)
        .order("hora", desc=True)
    )
    if user.rol == "cobrador":
        query = query.eq("cobrador_id", user.id)

    result = query.execute()
    return result.data or []


def _insertar_visita(
    supabase: Client,
    cuota_id: str,
    cobrador_id: str,
    resultado: str,
    notas: str | None,
) -> dict:
    """Inserta un registro de visita y retorna el row creado."""
    r = supabase.table("visitas").insert({
        "cuota_id":    cuota_id,
        "cobrador_id": cobrador_id,
        "resultado":   resultado,
        "notas":       notas,
    }).execute()
    return r.data[0] if r.data else {}


# ---------------------------------------------------------------------------
# Zonas
# ---------------------------------------------------------------------------

def listar_zonas(supabase: Client) -> list[str]:
    """Retorna lista ordenada de zonas con clientes activos."""
    r = (
        supabase.table("clientes")
        .select("zona")
        .eq("activo", True)
        .not_.is_("zona", "null")
        .execute()
    )
    zonas = sorted({c["zona"] for c in (r.data or []) if c.get("zona")})
    return zonas
