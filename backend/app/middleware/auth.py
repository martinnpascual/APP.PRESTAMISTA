"""
middleware/auth.py — Verificación JWT de Supabase Auth
======================================================
Dos modos de verificación (auto-selección):

  1. JWT local  — si SUPABASE_JWT_SECRET está configurado.
                  Rápido: no hace llamada de red extra.
                  Cómo obtener el secret:
                    Supabase Dashboard → Settings → API → JWT Settings → "JWT Secret"

  2. API mode   — fallback: llama a supabase.auth.get_user(token).
                  Requiere una llamada HTTP extra por request.
                  Útil mientras no tenés el JWT secret disponible.

En ambos modos, el rol y zona del usuario se leen desde `public.profiles`
usando el service_role client (bypassa RLS — el acceso real lo controla RLS
a nivel de DB para las queries del frontend/Supabase client).
"""
import logging
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)
security = HTTPBearer()


# ---------------------------------------------------------------------------
# Modelo interno del usuario autenticado
# ---------------------------------------------------------------------------
class AuthUser:
    """Representa al usuario autenticado en el contexto de un request."""

    def __init__(self, id: str, email: str, rol: str, zona: str | None, activo: bool):
        self.id = id
        self.email = email
        self.rol = rol
        self.zona = zona
        self.activo = activo

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "rol": self.rol,
            "zona": self.zona,
            "activo": self.activo,
        }


# ---------------------------------------------------------------------------
# Verificación del JWT
# ---------------------------------------------------------------------------
def _verify_jwt_local(token: str) -> dict:
    """
    Verifica el JWT localmente usando SUPABASE_JWT_SECRET (HS256).
    Más rápido que llamar a la API de Supabase.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        logger.warning("JWT inválido (verificación local): %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _verify_jwt_api(token: str) -> dict:
    """
    Verifica el JWT llamando a Supabase Auth API.
    Fallback cuando SUPABASE_JWT_SECRET no está configurado.
    """
    try:
        supabase = get_supabase()
        response = supabase.auth.get_user(token)
        user = response.user
        if not user:
            raise ValueError("Usuario no encontrado")
        return {"sub": user.id, "email": user.email}
    except Exception as e:
        logger.warning("JWT inválido (verificación API): %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _decode_token(token: str) -> dict:
    """Selecciona el método de verificación según configuración."""
    if settings.SUPABASE_JWT_SECRET:
        return _verify_jwt_local(token)
    return _verify_jwt_api(token)


# ---------------------------------------------------------------------------
# Obtener perfil desde la DB
# ---------------------------------------------------------------------------
def _get_profile(user_id: str) -> dict:
    """
    Lee rol, zona y activo desde public.profiles usando el service_role client.
    Lanza 401 si el perfil no existe o está inactivo.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("profiles")
            .select("id, email, rol, zona, activo")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile = result.data
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Perfil de usuario no encontrado",
            )
        if not profile.get("activo", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo",
            )
        return profile
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo perfil del usuario %s: %s", user_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al verificar usuario",
        )


# ---------------------------------------------------------------------------
# Dependencias FastAPI
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> AuthUser:
    """
    Dependencia principal de autenticación.
    Usar en TODOS los endpoints protegidos:

        @router.get("/")
        async def my_endpoint(user: AuthUser = Depends(get_current_user)):
            ...
    """
    token = credentials.credentials
    payload = _decode_token(token)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin identificador de usuario",
        )

    profile = _get_profile(user_id)

    return AuthUser(
        id=user_id,
        email=payload.get("email", profile.get("email", "")),
        rol=profile["rol"],
        zona=profile.get("zona"),
        activo=profile.get("activo", True),
    )


async def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """
    Dependencia que exige rol 'admin'.

        @router.get("/admin-only")
        async def admin_endpoint(user: AuthUser = Depends(require_admin)):
            ...
    """
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol admin",
        )
    return user


async def require_cobrador_or_admin(
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """
    Dependencia que permite acceso a admin y cobrador.
    (Útil para endpoints de cobros del día)
    """
    if user.rol not in ("admin", "cobrador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso no permitido para este rol",
        )
    return user
