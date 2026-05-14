"""
routers/clientes.py — Módulo Clientes
======================================
Endpoints:
  GET    /clientes              — listar con búsqueda y paginación
  POST   /clientes              — crear cliente (admin)
  GET    /clientes/{id}         — detalle del cliente
  PATCH  /clientes/{id}         — editar cliente (admin)
  DELETE /clientes/{id}         — soft delete (admin)
  GET    /clientes/{id}/historial — historial completo préstamos + pagos
"""
import logging
import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok
from app.schemas.clientes import (
    ClienteDeudaOut,
    ClienteHistorialOut,
    ClienteIn,
    ClienteOut,
    ClienteUpdateIn,
    PaginatedClientes,
)
from app.services import clientes as svc

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# GET /clientes — Listar con búsqueda y paginación
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=ApiResponse[PaginatedClientes],
    summary="Listar clientes",
)
async def listar_clientes(
    q: str | None = Query(None, description="Buscar por nombre, DNI o teléfono"),
    zona: str | None = Query(None, description="Filtrar por zona"),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(20, ge=1, le=100, description="Items por página"),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista clientes activos con búsqueda opcional.

    - **Admin**: ve todos los clientes, con totales de deuda consolidados.
    - **Cobrador**: solo sus clientes asignados.
    - **q**: busca por nombre (fuzzy), DNI exacto, o teléfono exacto.
    """
    supabase = get_supabase()
    items, total = svc.listar_clientes(supabase, user, q=q, zona=zona, page=page, per_page=per_page)

    return ok(PaginatedClientes(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if total else 0,
    ))


# ---------------------------------------------------------------------------
# POST /clientes — Crear cliente (admin)
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=ApiResponse[ClienteOut],
    status_code=201,
    summary="Crear cliente (admin)",
)
async def crear_cliente(
    body: ClienteIn,
    user: AuthUser = Depends(require_admin),
):
    """Crea un nuevo cliente. Solo accesible para admin."""
    supabase = get_supabase()
    cliente = svc.crear_cliente(supabase, user, body.model_dump())
    return ok(ClienteOut(**cliente))


# ---------------------------------------------------------------------------
# GET /clientes/{id} — Detalle del cliente
# ---------------------------------------------------------------------------
@router.get(
    "/{cliente_id}",
    response_model=ApiResponse[ClienteDeudaOut],
    summary="Detalle del cliente",
)
async def obtener_cliente(
    cliente_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Retorna el detalle de un cliente.
    Para admin incluye totales de deuda consolidados.
    """
    supabase = get_supabase()
    cliente = svc.obtener_cliente(supabase, user, cliente_id)

    # Enriquecer con datos de deuda si es admin
    deuda: dict = {}
    if user.rol == "admin":
        deuda_r = (
            supabase.table("v_clientes_deuda")
            .select("prestamos_activos, prestamos_en_mora, total_adeudado")
            .eq("id", cliente_id)
            .execute()
        )
        deuda = deuda_r.data[0] if deuda_r.data else {}

    return ok(ClienteDeudaOut(
        **cliente,
        prestamos_activos=deuda.get("prestamos_activos", 0),
        prestamos_en_mora=deuda.get("prestamos_en_mora", 0),
        total_adeudado=float(deuda.get("total_adeudado", 0)),
    ))


# ---------------------------------------------------------------------------
# PATCH /clientes/{id} — Editar cliente (admin)
# ---------------------------------------------------------------------------
@router.patch(
    "/{cliente_id}",
    response_model=ApiResponse[ClienteOut],
    summary="Editar cliente (admin)",
)
async def actualizar_cliente(
    cliente_id: str,
    body: ClienteUpdateIn,
    user: AuthUser = Depends(require_admin),
):
    """
    Actualiza campos del cliente. El DNI no puede modificarse.
    Solo accesible para admin.
    """
    supabase = get_supabase()
    cambios = body.model_dump(exclude_none=True)
    if not cambios:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    cliente = svc.actualizar_cliente(supabase, user, cliente_id, cambios)
    return ok(ClienteOut(**cliente))


# ---------------------------------------------------------------------------
# DELETE /clientes/{id} — Soft delete (admin)
# ---------------------------------------------------------------------------
@router.delete(
    "/{cliente_id}",
    response_model=ApiResponse[dict],
    summary="Desactivar cliente (admin)",
)
async def eliminar_cliente(
    cliente_id: str,
    user: AuthUser = Depends(require_admin),
):
    """
    Soft delete: marca activo=False. No elimina el registro.
    Falla si el cliente tiene préstamos activos o en mora.
    """
    supabase = get_supabase()
    svc.eliminar_cliente(supabase, user, cliente_id)
    return ok({"desactivado": True, "cliente_id": cliente_id})


# ---------------------------------------------------------------------------
# POST /clientes/{id}/foto — Subir foto del cliente
# ---------------------------------------------------------------------------
@router.post(
    "/{cliente_id}/foto",
    response_model=ApiResponse[dict],
    summary="Subir foto del cliente (admin)",
)
async def subir_foto(
    cliente_id: str,
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_admin),
):
    """
    Sube una imagen al bucket 'cliente-fotos' de Supabase Storage
    y guarda la URL pública en el registro del cliente.
    Formatos permitidos: JPEG, PNG, WEBP. Tamaño máximo: 5 MB.
    """
    supabase = get_supabase()

    ALLOWED = {"image/jpeg", "image/png", "image/webp"}
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB

    if file.content_type not in ALLOWED:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Formato no permitido. Use JPEG, PNG o WEBP.")

    content = await file.read()
    if len(content) > MAX_SIZE:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Archivo demasiado grande. Máximo 5 MB.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    path = f"{cliente_id}/{uuid.uuid4()}.{ext}"

    supabase.storage.from_("cliente-fotos").upload(
        path,
        content,
        {"content-type": file.content_type},
    )

    public_url = supabase.storage.from_("cliente-fotos").get_public_url(path)

    supabase.table("clientes").update({"foto_url": public_url}).eq("id", cliente_id).execute()

    return ok({"foto_url": public_url})


# ---------------------------------------------------------------------------
# DELETE /clientes/{id}/foto — Eliminar foto del cliente
# ---------------------------------------------------------------------------
@router.delete(
    "/{cliente_id}/foto",
    response_model=ApiResponse[dict],
    summary="Eliminar foto del cliente (admin)",
)
async def eliminar_foto(
    cliente_id: str,
    user: AuthUser = Depends(require_admin),
):
    """Elimina la foto del cliente de Storage y limpia el campo foto_url."""
    supabase = get_supabase()

    cliente_r = supabase.table("clientes").select("foto_url").eq("id", cliente_id).single().execute()
    if not cliente_r.data or not cliente_r.data.get("foto_url"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="El cliente no tiene foto.")

    foto_url: str = cliente_r.data["foto_url"]
    # Extraer path relativo desde la URL pública
    bucket_marker = "cliente-fotos/"
    if bucket_marker in foto_url:
        path = foto_url.split(bucket_marker, 1)[1].split("?")[0]
        try:
            supabase.storage.from_("cliente-fotos").remove([path])
        except Exception as e:
            logger.warning("No se pudo eliminar archivo de Storage: %s", e)

    supabase.table("clientes").update({"foto_url": None}).eq("id", cliente_id).execute()
    return ok({"eliminado": True})


# ---------------------------------------------------------------------------
# GET /clientes/{id}/historial — Historial completo
# ---------------------------------------------------------------------------
@router.get(
    "/{cliente_id}/historial",
    response_model=ApiResponse[ClienteHistorialOut],
    summary="Historial completo de préstamos y pagos",
)
async def historial_cliente(
    cliente_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Retorna el historial completo del cliente:
    - Datos del cliente
    - Resumen de deuda (admin)
    - Todos sus préstamos con cuotas y pagos anidados
    """
    supabase = get_supabase()
    historial = svc.obtener_historial(supabase, user, cliente_id)
    return ok(ClienteHistorialOut(**historial))
