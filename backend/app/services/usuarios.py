"""
services/usuarios.py — Gestión de Usuarios y Cobradores
=========================================================
Operaciones sobre la tabla profiles + Supabase Auth Admin API.
Solo accesible por admin.

Flujo de invitación:
  1. Admin crea usuario en Supabase Auth (admin.create_user)
  2. Trigger handle_new_user inserta en profiles automáticamente
  3. PATCH /usuarios/{id} para asignar zona/rol si es necesario
"""
import logging

from fastapi import HTTPException, status
from supabase import Client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Listado
# ---------------------------------------------------------------------------

def listar_usuarios(supabase: Client) -> list[dict]:
    """
    Retorna todos los profiles activos con email del auth user.
    Admin puede ver todos; usado solo por admin (el router lo garantiza).
    """
    r = (
        supabase.table("profiles")
        .select("id, nombre, email, rol, zona, activo, created_at")
        .order("created_at", desc=False)
        .execute()
    )
    return r.data or []


def obtener_usuario(supabase: Client, user_id: str) -> dict:
    r = (
        supabase.table("profiles")
        .select("id, nombre, email, rol, zona, activo, created_at")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return r.data


# ---------------------------------------------------------------------------
# Crear / Invitar
# ---------------------------------------------------------------------------

def invitar_usuario(
    supabase: Client,
    email: str,
    nombre: str,
    rol: str,
    zona: str | None,
    password: str,
) -> dict:
    """
    Crea un usuario en Supabase Auth + perfil en profiles.
    Retorna el profile creado.
    """
    if rol not in ("admin", "cobrador", "solo_lectura"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Rol inválido: {rol}. Valores válidos: admin, cobrador, solo_lectura",
        )

    # Verificar que el email no existe ya
    existing = supabase.table("profiles").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un usuario con el email {email}",
        )

    # Crear en Supabase Auth
    try:
        auth_r = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"nombre": nombre},
        })
        if not auth_r.user:
            raise ValueError("Auth user creation returned no user")
        user_id = auth_r.user.id
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error creando usuario en Supabase Auth: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando usuario: {exc}",
        )

    # Upsert en profiles (el trigger puede haberlo creado ya)
    try:
        supabase.table("profiles").upsert({
            "id": user_id,
            "email": email,
            "nombre": nombre,
            "rol": rol,
            "zona": zona,
            "activo": True,
        }).execute()
    except Exception as exc:
        logger.error("Error insertando profile para %s: %s", user_id, exc)
        # El usuario auth existe — igual retornar con advertencia
        return {
            "id": user_id, "email": email, "nombre": nombre,
            "rol": rol, "zona": zona, "activo": True,
            "advertencia": "Profile no pudo sincronizarse correctamente",
        }

    logger.info("Usuario creado: id=%s email=%s rol=%s", user_id, email, rol)
    return obtener_usuario(supabase, user_id)


# ---------------------------------------------------------------------------
# Actualizar
# ---------------------------------------------------------------------------

def actualizar_usuario(
    supabase: Client,
    user_id: str,
    datos: dict,
    admin_id: str,
) -> dict:
    """
    Actualiza nombre, rol y/o zona de un usuario.
    No permite cambiar el propio rol del admin que hace la petición.
    """
    # Impedir auto-downgrade
    if datos.get("rol") and user_id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No podés cambiar tu propio rol",
        )

    # Verificar que el usuario existe
    obtener_usuario(supabase, user_id)

    campos = {k: v for k, v in datos.items() if v is not None and k in ("nombre", "rol", "zona")}
    if not campos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")

    supabase.table("profiles").update(campos).eq("id", user_id).execute()
    logger.info("Usuario actualizado: id=%s campos=%s por=%s", user_id, list(campos), admin_id)
    return obtener_usuario(supabase, user_id)


# ---------------------------------------------------------------------------
# Activar / Desactivar (soft delete)
# ---------------------------------------------------------------------------

def desactivar_usuario(supabase: Client, user_id: str, admin_id: str) -> dict:
    """Soft delete: marca activo=False. No elimina de Supabase Auth."""
    if user_id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No podés desactivarte a vos mismo",
        )
    obtener_usuario(supabase, user_id)
    supabase.table("profiles").update({"activo": False}).eq("id", user_id).execute()
    logger.info("Usuario desactivado: id=%s por=%s", user_id, admin_id)
    return {"ok": True, "mensaje": "Usuario desactivado"}


def activar_usuario(supabase: Client, user_id: str) -> dict:
    """Reactiva un usuario desactivado."""
    obtener_usuario(supabase, user_id)
    supabase.table("profiles").update({"activo": True}).eq("id", user_id).execute()
    logger.info("Usuario reactivado: id=%s", user_id)
    return {"ok": True, "mensaje": "Usuario reactivado"}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def audit_log(supabase: Client, limit: int = 100) -> list[dict]:
    """Retorna los últimos eventos del log de auditoría."""
    r = (
        supabase.table("system_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return r.data or []
