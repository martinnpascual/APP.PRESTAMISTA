"""
routers/prestamos.py — Módulo Préstamos + Calculadora
======================================================
Endpoints:
  POST   /prestamos/calcular          — preview sin guardar (cualquier usuario)
  GET    /prestamos                   — listar con filtros y paginación
  POST   /prestamos                   — crear préstamo + cuotas (admin)
  GET    /prestamos/{id}              — detalle + cuotas
  PATCH  /prestamos/{id}/estado       — cambiar estado (admin)
  PATCH  /prestamos/{id}/cobrador     — asignar cobrador (admin)
"""
import logging
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok
from app.schemas.prestamos import (
    AsignarCobradorIn,
    CambiarEstadoIn,
    PaginatedPrestamos,
    PrestamoIn,
    PrestamoCalcularIn,
    PrestamoOut,
    PrestamoPreviewOut,
)
from app.services import prestamos as svc

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# POST /prestamos/calcular — Preview sin guardar
# ---------------------------------------------------------------------------
@router.post(
    "/calcular",
    response_model=ApiResponse[PrestamoPreviewOut],
    summary="Calcular cuotas (preview, sin guardar)",
)
async def calcular_preview(
    body: PrestamoCalcularIn,
    user: AuthUser = Depends(get_current_user),
):
    """
    Calcula el calendario de cuotas sin persistir nada.
    Usar antes de crear el préstamo para mostrar el resumen al prestamista.

    - **flat**: tasa fija sobre capital original. Cuota constante.
    - **sobre_saldo**: interés decreciente sobre saldo. Cuota variable.
    - **tasa**: porcentaje POR PERÍODO (ej: 10 = 10% mensual si periodicidad=mensual).
    """
    resultado = svc.preview_prestamo(
        monto=Decimal(str(body.monto)),
        tasa=Decimal(str(body.tasa)),
        tipo_tasa=body.tipo_tasa,
        periodicidad=body.periodicidad,
        n_cuotas=body.n_cuotas,
        fecha_inicio=body.fecha_inicio or date.today(),
    )
    return ok(PrestamoPreviewOut(**resultado))


# ---------------------------------------------------------------------------
# GET /prestamos — Listar
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=ApiResponse[PaginatedPrestamos],
    summary="Listar préstamos",
)
async def listar_prestamos(
    cliente_id: str | None = Query(None, description="Filtrar por cliente"),
    estado: str | None = Query(None, description="Filtrar por estado"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista préstamos activos.
    - **Admin**: ve todos, con datos del cliente y cobrador.
    - **Cobrador**: solo sus préstamos asignados.
    """
    supabase = get_supabase()
    items, total = svc.listar_prestamos(
        supabase, user,
        cliente_id=cliente_id,
        estado=estado,
        page=page,
        per_page=per_page,
    )
    return ok(PaginatedPrestamos(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if total else 0,
    ))


# ---------------------------------------------------------------------------
# POST /prestamos — Crear préstamo
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=ApiResponse[PrestamoOut],
    status_code=201,
    summary="Crear préstamo + generar cuotas (admin)",
)
async def crear_prestamo(
    body: PrestamoIn,
    user: AuthUser = Depends(require_admin),
):
    """
    Crea un nuevo préstamo y genera el calendario de cuotas automáticamente.
    Estado inicial: `pendiente_aprobacion`. Usar PATCH /estado para aprobar.

    El cálculo es idéntico al endpoint `/calcular` — lo que ves en el preview
    es exactamente lo que se guarda.
    """
    supabase = get_supabase()
    prestamo = svc.crear_prestamo(supabase, user, body.model_dump())
    return ok(PrestamoOut(**_flatten_prestamo(prestamo)))


# ---------------------------------------------------------------------------
# GET /prestamos/{id} — Detalle
# ---------------------------------------------------------------------------
@router.get(
    "/{prestamo_id}",
    response_model=ApiResponse[PrestamoOut],
    summary="Detalle del préstamo con cuotas",
)
async def obtener_prestamo(
    prestamo_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Retorna el préstamo con su calendario de cuotas completo."""
    supabase = get_supabase()
    prestamo = svc.obtener_prestamo(supabase, user, prestamo_id)
    return ok(PrestamoOut(**_flatten_prestamo(prestamo)))


# ---------------------------------------------------------------------------
# PATCH /prestamos/{id}/estado — Cambiar estado
# ---------------------------------------------------------------------------
@router.patch(
    "/{prestamo_id}/estado",
    response_model=ApiResponse[dict],
    summary="Cambiar estado del préstamo (admin)",
)
async def cambiar_estado(
    prestamo_id: str,
    body: CambiarEstadoIn,
    user: AuthUser = Depends(require_admin),
):
    """
    Cambia el estado de un préstamo. Transiciones válidas:

    | Desde                  | Hacia                        |
    |------------------------|------------------------------|
    | pendiente_aprobacion   | activo, cancelado            |
    | activo                 | en_mora, cancelado, cerrado  |
    | en_mora                | activo, cancelado, cerrado   |
    | cancelado / cerrado    | — (estados terminales)       |

    Para **aprobar** un préstamo: `{"estado": "activo"}`.
    """
    supabase = get_supabase()
    prestamo = svc.cambiar_estado(supabase, user, prestamo_id, body.estado)
    return ok({"prestamo_id": prestamo_id, "estado": prestamo["estado"]})


# ---------------------------------------------------------------------------
# PATCH /prestamos/{id}/cobrador — Asignar cobrador
# ---------------------------------------------------------------------------
@router.patch(
    "/{prestamo_id}/cobrador",
    response_model=ApiResponse[dict],
    summary="Asignar o reasignar cobrador (admin)",
)
async def asignar_cobrador(
    prestamo_id: str,
    body: AsignarCobradorIn,
    user: AuthUser = Depends(require_admin),
):
    """
    Asigna un cobrador al préstamo. Pasar `cobrador_id: null` para desasignar.
    Solo disponible para préstamos en estado activo, en_mora o pendiente_aprobacion.
    """
    supabase = get_supabase()
    cobrador_id = str(body.cobrador_id) if body.cobrador_id else None
    prestamo = svc.asignar_cobrador(supabase, user, prestamo_id, cobrador_id)
    return ok({"prestamo_id": prestamo_id, "cobrador_id": prestamo.get("cobrador_id")})


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _flatten_prestamo(prestamo: dict) -> dict:
    """
    Limpia el dict del préstamo retornado por Supabase:
    - Extrae nombre del cliente del join anidado
    - Retorna estructura plana para PrestamoOut
    """
    cliente = prestamo.pop("clientes", None) or {}
    prestamo["cliente_nombre"] = cliente.get("nombre")
    prestamo["cliente_dni"] = cliente.get("dni")
    return prestamo
