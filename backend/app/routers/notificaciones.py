"""
routers/notificaciones.py — Centro de notificaciones
=====================================================
Endpoints:
  GET  /notificaciones          — listar notificaciones (paginado)
  GET  /notificaciones/conteo   — cantidad de notificaciones pendientes/recientes
  POST /notificaciones/{id}/leer — marcar como leída (enviado=true)
  DELETE /notificaciones/{id}   — eliminar notificación
"""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok, err

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/conteo",
    response_model=ApiResponse[dict],
    summary="Conteo de notificaciones pendientes",
)
async def conteo_notificaciones(
    user: AuthUser = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Devuelve cantidad de notificaciones no enviadas (pendientes)."""
    res = (supabase.table("notificaciones")
           .select("id", count="exact")
           .eq("enviado", False)
           .execute())
    total = res.count or 0
    return ok({"total": total})


@router.get(
    "",
    response_model=ApiResponse[list[dict]],
    summary="Listar notificaciones",
)
async def listar_notificaciones(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    solo_pendientes: bool = Query(False),
    user: AuthUser = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    offset = (page - 1) * per_page
    q = (supabase.table("notificaciones")
         .select("*")
         .order("created_at", desc=True)
         .range(offset, offset + per_page - 1))
    if solo_pendientes:
        q = q.eq("enviado", False)
    res = q.execute()
    return ok(res.data or [])


@router.post(
    "/{notif_id}/leer",
    response_model=ApiResponse[dict],
    summary="Marcar notificación como leída",
)
async def marcar_leida(
    notif_id: str,
    user: AuthUser = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    res = (supabase.table("notificaciones")
           .update({"enviado": True})
           .eq("id", notif_id)
           .execute())
    if not res.data:
        return err("Notificación no encontrada")
    return ok({"ok": True})


@router.post(
    "/leer-todas",
    response_model=ApiResponse[dict],
    summary="Marcar todas las notificaciones como leídas",
)
async def marcar_todas_leidas(
    user: AuthUser = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    supabase.table("notificaciones").update({"enviado": True}).eq("enviado", False).execute()
    return ok({"ok": True})


@router.delete(
    "/{notif_id}",
    response_model=ApiResponse[dict],
    summary="Eliminar notificación (admin)",
)
async def eliminar_notificacion(
    notif_id: str,
    user: AuthUser = Depends(require_admin),
    supabase=Depends(get_supabase),
):
    supabase.table("notificaciones").delete().eq("id", notif_id).execute()
    return ok({"ok": True})
