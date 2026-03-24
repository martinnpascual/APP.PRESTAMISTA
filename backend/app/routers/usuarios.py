"""
routers/usuarios.py — Gestión de Usuarios y Cobradores
========================================================
Todos los endpoints requieren rol admin.

Endpoints:
  GET    /usuarios                — listar usuarios
  POST   /usuarios                — crear/invitar usuario
  GET    /usuarios/{id}           — detalle de usuario
  PATCH  /usuarios/{id}           — actualizar rol/zona/nombre
  POST   /usuarios/{id}/activar   — reactivar usuario desactivado
  DELETE /usuarios/{id}           — soft delete (activo=false)
  GET    /usuarios/audit-log      — log de auditoría del sistema
  POST   /admin/backup            — ejecutar backup manual
  GET    /admin/backup            — listar backups disponibles
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, require_admin
from app.schemas.base import ApiResponse, ok
from app.services import usuarios as svc
from app.services import backup as backup_svc

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas locales
# ---------------------------------------------------------------------------

class InvitarUsuarioIn(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=100)
    rol: str = Field(..., pattern="^(admin|cobrador|solo_lectura)$")
    zona: str | None = Field(None, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)


class ActualizarUsuarioIn(BaseModel):
    nombre: str | None = Field(None, min_length=2, max_length=100)
    rol: str | None = Field(None, pattern="^(admin|cobrador|solo_lectura)$")
    zona: str | None = None


# ---------------------------------------------------------------------------
# Endpoints de usuarios
# ---------------------------------------------------------------------------

@router.get("", response_model=ApiResponse[list], summary="Listar usuarios")
async def listar(user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    return ok(svc.listar_usuarios(supabase))


@router.post("", response_model=ApiResponse[dict], summary="Crear usuario")
async def crear(body: InvitarUsuarioIn, user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    nuevo = svc.invitar_usuario(
        supabase,
        email=body.email,
        nombre=body.nombre,
        rol=body.rol,
        zona=body.zona,
        password=body.password,
    )
    return ok(nuevo)


@router.get("/audit-log", response_model=ApiResponse[list], summary="Log de auditoría")
async def audit_log(limit: int = 100, user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    return ok(svc.audit_log(supabase, limit=min(limit, 500)))


@router.get("/{user_id}", response_model=ApiResponse[dict], summary="Detalle de usuario")
async def detalle(user_id: str, user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    return ok(svc.obtener_usuario(supabase, user_id))


@router.patch("/{user_id}", response_model=ApiResponse[dict], summary="Actualizar usuario")
async def actualizar(
    user_id: str,
    body: ActualizarUsuarioIn,
    user: AuthUser = Depends(require_admin),
):
    supabase = get_supabase()
    updated = svc.actualizar_usuario(supabase, user_id, body.model_dump(), admin_id=user.id)
    return ok(updated)


@router.post("/{user_id}/activar", response_model=ApiResponse[dict], summary="Reactivar usuario")
async def activar(user_id: str, user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    return ok(svc.activar_usuario(supabase, user_id))


@router.delete("/{user_id}", response_model=ApiResponse[dict], summary="Desactivar usuario")
async def desactivar(user_id: str, user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    return ok(svc.desactivar_usuario(supabase, user_id, admin_id=user.id))


# ---------------------------------------------------------------------------
# Admin — Backup
# ---------------------------------------------------------------------------

@router.post("/admin/backup", response_model=ApiResponse[dict], summary="Ejecutar backup manual")
async def backup_manual(user: AuthUser = Depends(require_admin)):
    """Dispara un backup inmediato de todas las tablas críticas a Supabase Storage."""
    supabase = get_supabase()
    resultado = backup_svc.ejecutar_backup()
    return ok(resultado)


@router.get("/admin/backup", response_model=ApiResponse[list], summary="Listar backups disponibles")
async def listar_backups(user: AuthUser = Depends(require_admin)):
    supabase = get_supabase()
    return ok(backup_svc.listar_backups(supabase))
