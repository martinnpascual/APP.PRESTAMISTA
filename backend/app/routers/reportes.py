"""
routers/reportes.py — Reportes + Dashboard KPIs
================================================
Endpoints:
  GET  /reportes/kpis              — métricas tiempo real (v_kpis + extras)
  GET  /reportes/cartera           — préstamos activos/mora (filtrables)
  GET  /reportes/recaudacion       — pagos agrupados por día/semana/mes
  GET  /reportes/mora              — cuotas en mora con detalle
  GET  /reportes/exportar/csv      — descarga CSV (cartera|recaudacion|mora)
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import io

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok
from app.services import reportes as svc

router = APIRouter()


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------

@router.get(
    "/kpis",
    response_model=ApiResponse[dict],
    summary="KPIs del dashboard",
)
async def kpis(user: AuthUser = Depends(get_current_user)):
    """
    Métricas en tiempo real: capital_total_prestado, saldo_total_pendiente,
    clientes_en_mora, monto_en_mora, prestamos_activos + clientes_activos,
    cuotas_hoy_total, cuotas_hoy_monto, cobrado_hoy.
    """
    supabase = get_supabase()
    data = svc.kpis_extendidos(supabase)
    return ok(data)


# ---------------------------------------------------------------------------
# Cartera
# ---------------------------------------------------------------------------

@router.get(
    "/cartera",
    response_model=ApiResponse[list],
    summary="Reporte de cartera",
)
async def cartera(
    estado: str | None = Query(None, description="activo | en_mora"),
    cobrador_id: str | None = Query(None),
    zona: str | None = Query(None),
    user: AuthUser = Depends(get_current_user),
):
    """
    Préstamos activos y en mora con datos del cliente y cobrador.
    Admin: ve todo. Cobrador: solo sus préstamos asignados.
    """
    supabase = get_supabase()
    # Cobrador solo puede ver sus propios préstamos
    if user.rol == "cobrador":
        cobrador_id = user.id
    data = svc.reporte_cartera(supabase, estado=estado, cobrador_id=cobrador_id, zona=zona)
    return ok(data)


# ---------------------------------------------------------------------------
# Recaudación
# ---------------------------------------------------------------------------

@router.get(
    "/recaudacion",
    response_model=ApiResponse[dict],
    summary="Reporte de recaudación",
)
async def recaudacion(
    desde: str | None = Query(None, description="YYYY-MM-DD (default: hoy-30d)"),
    hasta: str | None = Query(None, description="YYYY-MM-DD (default: hoy)"),
    agrupar_por: str = Query("dia", description="dia | semana | mes"),
    user: AuthUser = Depends(get_current_user),
):
    """
    Pagos agrupados por período con totales y desglose por método de pago.
    """
    supabase = get_supabase()
    data = svc.reporte_recaudacion(supabase, desde=desde, hasta=hasta, agrupar_por=agrupar_por)
    return ok(data)


# ---------------------------------------------------------------------------
# Mora detallada
# ---------------------------------------------------------------------------

@router.get(
    "/mora",
    response_model=ApiResponse[dict],
    summary="Reporte de mora detallada",
)
async def mora(user: AuthUser = Depends(get_current_user)):
    """
    Cuotas en mora con días, recargo acumulado y datos del cliente.
    Ordenadas por días de mora descendente.
    """
    supabase = get_supabase()
    data = svc.mora_detallada(supabase)
    return ok(data)


# ---------------------------------------------------------------------------
# Exportar CSV
# ---------------------------------------------------------------------------

@router.get(
    "/exportar/csv",
    summary="Exportar reporte a CSV",
    responses={200: {"content": {"text/csv": {}}, "description": "Archivo CSV"}},
)
async def exportar_csv(
    tipo: str = Query(..., description="cartera | recaudacion | mora"),
    user: AuthUser = Depends(get_current_user),
):
    """
    Genera y descarga un CSV con los datos del reporte solicitado.
    Devuelve Content-Disposition: attachment para descarga automática.
    """
    supabase = get_supabase()
    contenido, filename = svc.exportar_csv(supabase, tipo=tipo)

    return StreamingResponse(
        io.StringIO(contenido),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
