"""
routers/auth.py — Endpoints de autenticación y perfil
"""
import logging

from fastapi import APIRouter, Depends

from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.auth import ProfileUpdateIn, UserProfileOut
from app.schemas.base import ApiResponse, ok
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/me",
    response_model=ApiResponse[UserProfileOut],
    summary="Perfil del usuario autenticado",
)
async def me(user: AuthUser = Depends(get_current_user)):
    """
    Retorna el perfil del usuario autenticado.
    Requiere Bearer token válido de Supabase Auth.
    """
    return ok(UserProfileOut(
        id=user.id,
        email=user.email,
        rol=user.rol,
        zona=user.zona,
        activo=user.activo,
    ))


@router.patch(
    "/me",
    response_model=ApiResponse[UserProfileOut],
    summary="Actualizar perfil propio",
)
async def update_me(
    body: ProfileUpdateIn,
    user: AuthUser = Depends(get_current_user),
):
    """Permite al usuario actualizar su nombre y zona."""
    supabase = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return ok(UserProfileOut(
            id=user.id, email=user.email, rol=user.rol,
            zona=user.zona, activo=user.activo,
        ))

    result = (
        supabase.table("profiles")
        .update(updates)
        .eq("id", user.id)
        .single()
        .execute()
    )
    p = result.data
    return ok(UserProfileOut(
        id=p["id"], email=p["email"], rol=p["rol"],
        zona=p.get("zona"), activo=p["activo"],
    ))


@router.get(
    "/usuarios",
    response_model=ApiResponse[list[UserProfileOut]],
    summary="Listar todos los usuarios (admin)",
)
async def listar_usuarios(user: AuthUser = Depends(require_admin)):
    """Lista todos los perfiles. Solo accesible para admin."""
    supabase = get_supabase()
    result = (
        supabase.table("profiles")
        .select("id, email, rol, zona, activo")
        .eq("activo", True)
        .order("rol")
        .execute()
    )
    usuarios = [
        UserProfileOut(
            id=p["id"], email=p["email"], rol=p["rol"],
            zona=p.get("zona"), activo=p["activo"],
        )
        for p in result.data
    ]
    return ok(usuarios)


@router.delete(
    "/usuarios/{usuario_id}",
    response_model=ApiResponse[dict],
    summary="Desactivar usuario (soft delete, admin)",
)
async def desactivar_usuario(
    usuario_id: str,
    user: AuthUser = Depends(require_admin),
):
    """Soft delete: marca activo=false. No elimina el registro."""
    if usuario_id == user.id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés desactivar tu propio usuario",
        )
    supabase = get_supabase()
    supabase.table("profiles").update({"activo": False}).eq("id", usuario_id).execute()
    return ok({"desactivado": True, "usuario_id": usuario_id})
