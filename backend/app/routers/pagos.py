"""
routers/pagos.py — Módulo Pagos
================================
Endpoints:
  POST   /pagos                          — registrar pago (admin o cobrador)
  GET    /pagos/{prestamo_id}            — historial de pagos de un préstamo
  GET    /pagos/{prestamo_id}/cuotas     — cuotas del préstamo con estado
"""
import logging

from fastapi import APIRouter, Depends, Query

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_cobrador_or_admin
from app.schemas.base import ApiResponse, ok
from app.schemas.pagos import PagoIn, PagoOut, PaginatedPagos
from app.services import pagos as svc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "",
    response_model=ApiResponse[PagoOut],
    status_code=201,
    summary="Registrar pago (admin o cobrador)",
)
async def registrar_pago(
    body: PagoIn,
    user: AuthUser = Depends(require_cobrador_or_admin),
):
    """
    Registra un pago sobre una cuota.

    - **Pago total**: `monto` = saldo restante de la cuota.
    - **Pago parcial**: `monto` < saldo restante → cuota queda en `pago_parcial`.
    - **Con mora**: el saldo incluye `recargo_mora` — el monto debe cubrir ambos.

    El saldo del préstamo se descuenta automáticamente vía trigger en la DB.
    Si todas las cuotas quedan pagadas, el préstamo pasa a `cerrado`.
    """
    supabase = get_supabase()
    pago = svc.registrar_pago(supabase, user, body.model_dump())
    return ok(PagoOut(**pago))


@router.get(
    "/{prestamo_id}",
    response_model=ApiResponse[PaginatedPagos],
    summary="Historial de pagos de un préstamo",
)
async def listar_pagos(
    prestamo_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: AuthUser = Depends(get_current_user),
):
    """
    Historial inmutable de pagos registrados para un préstamo,
    ordenado del más reciente al más antiguo.
    """
    supabase = get_supabase()
    items, total = svc.listar_pagos(supabase, user, prestamo_id, page, per_page)
    return ok(PaginatedPagos(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if total else 0,
    ))


@router.get(
    "/{prestamo_id}/cuotas",
    response_model=ApiResponse[list[dict]],
    summary="Cuotas del préstamo con estado actual",
)
async def cuotas_prestamo(
    prestamo_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista todas las cuotas de un préstamo con estado actualizado.
    Semáforo visual:
      - `pendiente` / `pago_parcial` → amarillo
      - `mora`                       → rojo
      - `pagada` / `condonada`       → verde
    """
    supabase = get_supabase()
    cuotas = svc.obtener_cuotas_prestamo(supabase, user, prestamo_id)
    return ok(cuotas)
