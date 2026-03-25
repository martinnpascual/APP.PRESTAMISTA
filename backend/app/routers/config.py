"""
routers/config.py — Configuración del negocio
==============================================
Endpoints:
  GET   /config          — obtener configuración actual (todos los usuarios)
  PATCH /config          — actualizar configuración (solo admin)
"""
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok, err

logger = logging.getLogger(__name__)
router = APIRouter()


class ConfigOut(BaseModel):
    id: str
    nombre_negocio: str
    moneda: str
    tasa_mora_diaria: float
    dias_gracia: int
    telegram_chat_id: str | None = None
    updated_at: str


class ConfigIn(BaseModel):
    nombre_negocio: str | None = Field(None, min_length=1, max_length=100)
    moneda: str | None = Field(None, min_length=1, max_length=10)
    tasa_mora_diaria: float | None = Field(None, ge=0, le=100)
    dias_gracia: int | None = Field(None, ge=0, le=30)
    telegram_chat_id: str | None = None


@router.get(
    "",
    response_model=ApiResponse[ConfigOut],
    summary="Obtener configuración del negocio",
)
async def get_config(
    user: AuthUser = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    res = supabase.table("config_negocio").select("*").limit(1).execute()
    if not res.data:
        return err("No se encontró configuración")
    return ok(res.data[0])


@router.patch(
    "",
    response_model=ApiResponse[ConfigOut],
    summary="Actualizar configuración del negocio (admin)",
)
async def update_config(
    body: ConfigIn,
    user: AuthUser = Depends(require_admin),
    supabase=Depends(get_supabase),
):
    # Obtener el ID de la fila singleton
    res = supabase.table("config_negocio").select("id").limit(1).execute()
    if not res.data:
        return err("No se encontró configuración")

    config_id = res.data[0]["id"]
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return err("Sin cambios")

    updates["updated_by"] = user.id

    upd = supabase.table("config_negocio").update(updates).eq("id", config_id).execute()
    if not upd.data:
        return err("Error al actualizar")

    # Log auditoría
    try:
        supabase.table("system_logs").insert({
            "usuario_id": user.id,
            "accion": "config_actualizada",
            "detalle": {"cambios": updates},
        }).execute()
    except Exception:
        pass

    # Notificar via Telegram/n8n
    try:
        import asyncio
        from app.services.notificaciones import notificar_cambio_config
        cambios_sin_meta = {k: v for k, v in updates.items() if k != "updated_by"}
        if cambios_sin_meta:
            asyncio.create_task(notificar_cambio_config(
                usuario_nombre=user.email or user.id,
                cambios=cambios_sin_meta,
            ))
    except Exception:
        pass

    return ok(upd.data[0])
