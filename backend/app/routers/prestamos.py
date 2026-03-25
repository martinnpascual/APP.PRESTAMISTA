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
# POST /prestamos/{id}/refinanciar — Refinanciar
# ---------------------------------------------------------------------------
@router.post(
    "/{prestamo_id}/refinanciar",
    response_model=ApiResponse[dict],
    summary="Refinanciar préstamo (admin)",
)
async def refinanciar_prestamo(
    prestamo_id: str,
    body: dict,
    user: AuthUser = Depends(require_admin),
):
    """
    Refinancia un préstamo en mora o activo:
    1. Condona todas las cuotas pendientes/mora.
    2. Crea nuevas cuotas por el saldo actual, con el número y tasa indicados.
    El préstamo queda en estado 'activo'.
    """
    from pydantic import BaseModel
    from app.services.pagos import condonar_cuota

    supabase = get_supabase()

    # Obtener préstamo
    p_r = supabase.table("prestamos").select("*").eq("id", prestamo_id).single().execute()
    if not p_r.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    prestamo = p_r.data

    if prestamo["estado"] not in ("activo", "en_mora"):
        from app.schemas.base import err
        return err("Solo se puede refinanciar un préstamo activo o en mora")

    n_cuotas = int(body.get("n_cuotas", prestamo["n_cuotas"]))
    tasa = float(body.get("tasa") or prestamo["tasa"])
    saldo = float(prestamo["saldo_pendiente"])

    if saldo <= 0:
        from app.schemas.base import err
        return err("El saldo pendiente es 0, no se puede refinanciar")

    # 1. Condonar cuotas pendientes
    cuotas_r = (supabase.table("cuotas")
                .select("id, estado")
                .eq("prestamo_id", prestamo_id)
                .in_("estado", ["pendiente", "pago_parcial", "mora"])
                .execute())
    for c in cuotas_r.data or []:
        supabase.table("cuotas").update({"estado": "condonada"}).eq("id", c["id"]).execute()

    # 2. Crear nuevas cuotas desde hoy
    from datetime import date
    from app.services.calculadora import calcular_cuotas
    from app.schemas.prestamos import Periodicidad
    from decimal import Decimal

    nueva_fecha = date.today()
    nuevas_cuotas = calcular_cuotas(
        monto=Decimal(str(saldo)),
        tasa=Decimal(str(tasa)),
        tipo_tasa=prestamo["tipo_tasa"],
        periodicidad=prestamo["periodicidad"],
        n_cuotas=n_cuotas,
        fecha_inicio=nueva_fecha,
    )

    # Determinar número de cuota siguiente
    max_num_r = (supabase.table("cuotas")
                 .select("numero")
                 .eq("prestamo_id", prestamo_id)
                 .order("numero", desc=True)
                 .limit(1)
                 .execute())
    base_num = (max_num_r.data[0]["numero"] if max_num_r.data else 0)

    rows = [
        {
            "prestamo_id": prestamo_id,
            "numero": base_num + i + 1,
            "fecha_vencimiento": str(c["fecha_vencimiento"]),
            "monto": float(c["monto"]),
            "monto_pagado": 0,
            "recargo_mora": 0,
            "dias_mora": 0,
            "estado": "pendiente",
        }
        for i, c in enumerate(nuevas_cuotas)
    ]
    supabase.table("cuotas").insert(rows).execute()

    # 3. Actualizar préstamo: saldo, n_cuotas, tasa, estado activo
    supabase.table("prestamos").update({
        "estado": "activo",
        "saldo_pendiente": saldo,
        "n_cuotas": base_num + n_cuotas,
        "tasa": tasa,
    }).eq("id", prestamo_id).execute()

    from app.services.clientes import _log
    _log(supabase, user.id, "REFINANCIAR", "prestamos", prestamo_id,
         datos_nuevos={"n_cuotas": n_cuotas, "tasa": tasa, "saldo": saldo})

    # Notificar
    try:
        from app.services.notificaciones import notificar_refinanciacion
        cliente_r = (supabase.table("clientes")
                     .select("nombre")
                     .eq("id", prestamo["cliente_id"])
                     .single().execute())
        cliente_nombre = (cliente_r.data or {}).get("nombre", "—")
        monto_cuota = round(saldo / n_cuotas, 2) if n_cuotas else 0
        import asyncio
        asyncio.create_task(notificar_refinanciacion(
            cliente_nombre=cliente_nombre,
            prestamo_id=prestamo_id,
            nuevo_capital=saldo,
            n_cuotas=n_cuotas,
            monto_cuota=monto_cuota,
            tasa=tasa,
            fecha_inicio=str(nueva_fecha),
        ))
    except Exception:
        pass

    return ok({"prestamo_id": prestamo_id, "nuevas_cuotas": n_cuotas, "saldo": saldo})


# ---------------------------------------------------------------------------
# GET /prestamos/por-vencer — Préstamos por vencer
# ---------------------------------------------------------------------------
@router.get(
    "/por-vencer",
    response_model=ApiResponse[list[dict]],
    summary="Préstamos con cuotas por vencer en los próximos días",
)
async def prestamos_por_vencer(
    dias: int = Query(7, ge=1, le=60, description="Ventana de días hacia adelante"),
    user: AuthUser = Depends(get_current_user),
):
    """Cuotas que vencen en los próximos N días (default: 7)."""
    from datetime import date, timedelta
    supabase = get_supabase()
    hoy = date.today()
    hasta = hoy + timedelta(days=dias)

    q = (supabase.table("cuotas")
         .select("*, prestamos(cliente_id, cobrador_id, periodicidad, clientes(nombre, zona, telefono))")
         .in_("estado", ["pendiente", "pago_parcial"])
         .gte("fecha_vencimiento", str(hoy))
         .lte("fecha_vencimiento", str(hasta))
         .order("fecha_vencimiento"))

    if user.rol == "cobrador":
        # Filtrar por cobrador: necesitamos el join
        res = q.execute()
        data = [r for r in (res.data or []) if (r.get("prestamos") or {}).get("cobrador_id") == user.id]
    else:
        res = q.execute()
        data = res.data or []

    return ok(data)


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
