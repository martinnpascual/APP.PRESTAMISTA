"""
routers/telegram.py — Bot de Telegram (webhook + admin utils)
=============================================================
Endpoints:
  POST /telegram/webhook           — recibe updates de Telegram (sin auth, valida secret)
  POST /telegram/set-webhook       — registra URL del webhook con Telegram (admin)
  GET  /telegram/webhook-info      — info del webhook actual (admin)
  POST /telegram/test              — envía mensaje de prueba al prestamista (admin)
"""
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.supabase import get_supabase
from app.middleware.auth import require_admin
from app.schemas.base import ApiResponse, ok
from app.services import telegram_bot as bot

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Webhook — recibe updates de Telegram (no requiere JWT, valida secret header)
# ---------------------------------------------------------------------------

@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,   # no exponer en /docs (seguridad por oscuridad)
)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
):
    """
    Endpoint que Telegram llama con cada mensaje.
    Valida el secret token y delega en handle_update.
    Siempre responde 200 para que Telegram no reintente.
    """
    # Validar secret token si está configurado
    if settings.TELEGRAM_WEBHOOK_SECRET:
        if x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
            logger.warning("Telegram webhook: secret inválido — request rechazado")
            # Retornar 200 de todos modos (evitar que Telegram deshabilite el webhook)
            return {"ok": True}

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    supabase = get_supabase()
    try:
        await bot.handle_update(supabase, update)
    except Exception as exc:
        logger.error("Error procesando update de Telegram: %s", exc)
        # Siempre 200 para no quedar en backoff de Telegram

    return {"ok": True}


# ---------------------------------------------------------------------------
# Endpoints de administración
# ---------------------------------------------------------------------------

@router.post(
    "/set-webhook",
    response_model=ApiResponse[dict],
    summary="Registrar webhook URL con Telegram (admin)",
)
async def set_webhook(
    webhook_url: str,
    _: None = Depends(require_admin),
):
    """
    Registra la URL del webhook en la API de Telegram.
    Llamar una sola vez al hacer deploy o si la URL cambia.

    Ejemplo: webhook_url = "https://api.prestamos.app/telegram/webhook"
    """
    result = await bot.register_webhook(webhook_url)
    if not result.get("ok"):
        return JSONResponse(
            status_code=500,
            content={"data": None, "error": result.get("description", str(result))},
        )
    return ok(result)


@router.get(
    "/webhook-info",
    response_model=ApiResponse[dict],
    summary="Estado del webhook de Telegram (admin)",
)
async def webhook_info(_: None = Depends(require_admin)):
    """Retorna información sobre el webhook actualmente configurado en Telegram."""
    result = await bot.get_webhook_info()
    return ok(result)


@router.post(
    "/test",
    response_model=ApiResponse[dict],
    summary="Enviar mensaje de prueba al prestamista (admin)",
)
async def test_mensaje(_: None = Depends(require_admin)):
    """Envía un mensaje de prueba al TELEGRAM_CHAT_ID del prestamista."""
    if not settings.TELEGRAM_CHAT_ID:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "TELEGRAM_CHAT_ID no configurado"},
        )
    ok_flag = await bot.send_message(
        settings.TELEGRAM_CHAT_ID,
        "🤖 <b>Test de conexión exitoso</b>\n\nprestamos.app → Telegram ✅"
    )
    if not ok_flag:
        return JSONResponse(
            status_code=502,
            content={"data": None, "error": "No se pudo enviar el mensaje. Verificar TELEGRAM_BOT_TOKEN."},
        )
    return ok({"enviado": True, "chat_id": settings.TELEGRAM_CHAT_ID})
