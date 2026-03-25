"""
services/telegram_bot.py — Bot de Telegram interactivo
=======================================================
Maneja los comandos que envían los clientes y cobradores al bot.

Flujo de vinculación de clientes:
  1. Cliente envía /vincular <DNI> al bot
  2. El bot busca el cliente por DNI en la tabla clientes
  3. Si lo encuentra, guarda el telegram_chat_id en la fila del cliente
  4. A partir de ese momento el cliente puede consultar /saldo y /cuotas
  5. También recibirá notificaciones push (vencimiento D-1, confirmación de pago)

Flujo de cobradores:
  - El cobrador envía /vincular al bot (sin DNI) → el bot busca en profiles por email
    alternativo: admin le asigna telegram_chat_id desde la pantalla Usuarios
  - Recibe /cobros → lista del día filtrada por su zona/asignación

Comandos disponibles:
  /start          → bienvenida + instrucciones
  /vincular <DNI> → vincula chat al cliente (DNI del préstamo)
  /saldo          → saldo pendiente de préstamos activos
  /cuotas         → próximas 5 cuotas pendientes
  /help           → lista de comandos
"""
import logging

import httpx
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Envío de mensaje a chat específico
# ---------------------------------------------------------------------------

async def send_message(chat_id: str | int, text: str, parse_mode: str = "HTML") -> bool:
    """Envía un mensaje de Telegram a un chat_id específico."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.debug("TELEGRAM_BOT_TOKEN no configurado — mensaje omitido.")
        return False
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
            })
            if r.status_code == 200:
                return True
            logger.warning("Telegram sendMessage error: chat=%s status=%s body=%s",
                           chat_id, r.status_code, r.text[:200])
            return False
    except Exception as exc:
        logger.warning("Telegram sendMessage exception: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Registro del webhook con Telegram
# ---------------------------------------------------------------------------

async def register_webhook(webhook_url: str) -> dict:
    """
    Registra la URL del webhook con la API de Telegram.
    Llamar una vez al configurar el servidor.

    webhook_url: URL pública del backend, ej: https://api.prestamos.app/telegram/webhook
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN no configurado"}
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook"
    payload: dict = {"url": webhook_url}
    if settings.TELEGRAM_WEBHOOK_SECRET:
        payload["secret_token"] = settings.TELEGRAM_WEBHOOK_SECRET
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
            return r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def get_webhook_info() -> dict:
    """Retorna información sobre el webhook actualmente configurado."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN no configurado"}
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getWebhookInfo"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            return r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Helpers DB
# ---------------------------------------------------------------------------

def _fmt_ars(v: float) -> str:
    return f"$ {v:,.2f}"


def _get_cliente_by_chat(supabase: Client, chat_id: str) -> dict | None:
    """Busca un cliente por su telegram_chat_id. Retorna None si no está vinculado."""
    try:
        r = (supabase.table("clientes")
             .select("id, nombre, dni, telefono, zona")
             .eq("telegram_chat_id", chat_id)
             .eq("activo", True)
             .single()
             .execute())
        return r.data
    except Exception:
        return None


def _get_profile_by_chat(supabase: Client, chat_id: str) -> dict | None:
    """Busca un cobrador/admin por su telegram_chat_id."""
    try:
        r = (supabase.table("profiles")
             .select("id, nombre, email, rol, zona")
             .eq("telegram_chat_id", chat_id)
             .eq("activo", True)
             .single()
             .execute())
        return r.data
    except Exception:
        return None


def _get_prestamos_activos(supabase: Client, cliente_id: str) -> list[dict]:
    """Retorna los préstamos activos/en mora del cliente."""
    try:
        r = (supabase.table("prestamos")
             .select("id, monto, saldo_pendiente, estado, n_cuotas, periodicidad")
             .eq("cliente_id", cliente_id)
             .in_("estado", ["activo", "en_mora"])
             .eq("activo", True)
             .order("created_at", desc=True)
             .execute())
        return r.data or []
    except Exception:
        return []


def _get_proximas_cuotas(supabase: Client, cliente_id: str, limite: int = 5) -> list[dict]:
    """Retorna las próximas cuotas pendientes del cliente."""
    try:
        # Obtener prestamo_ids del cliente
        pr = (supabase.table("prestamos")
              .select("id")
              .eq("cliente_id", cliente_id)
              .in_("estado", ["activo", "en_mora"])
              .eq("activo", True)
              .execute())
        ids = [p["id"] for p in (pr.data or [])]
        if not ids:
            return []

        r = (supabase.table("cuotas")
             .select("numero, fecha_vencimiento, monto, monto_pagado, recargo_mora, dias_mora, estado, prestamo_id")
             .in_("prestamo_id", ids)
             .in_("estado", ["pendiente", "pago_parcial", "mora"])
             .order("fecha_vencimiento")
             .limit(limite)
             .execute())
        return r.data or []
    except Exception:
        return []


def _get_cobros_hoy_cobrador(supabase: Client, cobrador_id: str, zona: str | None) -> list[dict]:
    """Retorna los cobros pendientes del día para un cobrador."""
    try:
        query = (supabase.table("v_cobros_pendientes")
                 .select("cliente_nombre, zona, total_a_cobrar, fecha_vencimiento, numero, semaforo")
                 .eq("cobrador_id", cobrador_id)
                 .order("semaforo")
                 .order("cliente_nombre"))
        if zona:
            query = query.eq("zona", zona)
        r = query.execute()
        return r.data or []
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Handlers de comandos
# ---------------------------------------------------------------------------

async def cmd_start(supabase: Client, chat_id: str, nombre_tg: str) -> None:
    """Bienvenida al bot."""
    # Ver si ya está vinculado
    cliente = _get_cliente_by_chat(supabase, chat_id)
    profile = _get_profile_by_chat(supabase, chat_id)

    if cliente:
        msg = (
            f"👋 Hola <b>{cliente['nombre']}</b>!\n\n"
            f"Ya estás vinculado al sistema. Podés usar:\n"
            f"  /saldo — Ver tu saldo pendiente\n"
            f"  /cuotas — Ver tus próximas cuotas\n"
            f"  /help — Ayuda"
        )
    elif profile:
        rol_emoji = "🔑" if profile["rol"] == "admin" else "👷"
        msg = (
            f"{rol_emoji} Hola <b>{profile['nombre']}</b> (<i>{profile['rol']}</i>)!\n\n"
            f"Comandos disponibles:\n"
            f"  /cobros — Cobros pendientes del día\n"
            f"  /help — Ayuda"
        )
    else:
        msg = (
            "👋 Bienvenido a <b>prestamos.app</b>\n\n"
            "Para vincular tu cuenta, enviá:\n"
            "  <code>/vincular TU_DNI</code>\n\n"
            "Ejemplo: <code>/vincular 28456789</code>\n\n"
            "Si sos cobrador, solicitá al administrador que te asigne el acceso."
        )
    await send_message(chat_id, msg)


async def cmd_vincular(supabase: Client, chat_id: str, dni: str) -> None:
    """Vincula el chat_id del cliente a su ficha por DNI."""
    if not dni:
        await send_message(chat_id,
            "❌ Debés indicar tu DNI.\nEjemplo: <code>/vincular 28456789</code>")
        return

    # Verificar que no esté ya vinculado a otro chat
    ya_vinculado = _get_cliente_by_chat(supabase, chat_id)
    if ya_vinculado:
        await send_message(chat_id,
            f"✅ Ya estás vinculado como <b>{ya_vinculado['nombre']}</b>.\n"
            f"Usá /saldo o /cuotas para consultar tu cuenta.")
        return

    # Buscar cliente por DNI
    try:
        r = (supabase.table("clientes")
             .select("id, nombre, activo, telegram_chat_id")
             .eq("dni", dni.strip())
             .execute())
        clientes = r.data or []
    except Exception as exc:
        logger.error("Error buscando cliente por DNI: %s", exc)
        await send_message(chat_id, "❌ Error interno. Intentá de nuevo más tarde.")
        return

    if not clientes:
        await send_message(chat_id,
            "❌ No encontré ningún cliente con ese DNI.\n"
            "Verificá el número o contactá al administrador.")
        return

    cliente = clientes[0]
    if not cliente.get("activo", True):
        await send_message(chat_id, "❌ Tu cuenta no está activa. Contactá al administrador.")
        return

    if cliente.get("telegram_chat_id") and cliente["telegram_chat_id"] != chat_id:
        await send_message(chat_id,
            "⚠️ Ese DNI ya tiene una cuenta de Telegram vinculada.\n"
            "Contactá al administrador si creés que es un error.")
        return

    # Vincular
    try:
        supabase.table("clientes").update(
            {"telegram_chat_id": chat_id}
        ).eq("id", cliente["id"]).execute()
    except Exception as exc:
        logger.error("Error vinculando telegram_chat_id: %s", exc)
        await send_message(chat_id, "❌ Error al vincular. Intentá de nuevo.")
        return

    await send_message(chat_id,
        f"✅ <b>¡Vinculación exitosa!</b>\n\n"
        f"Hola <b>{cliente['nombre']}</b>, tu cuenta de Telegram quedó vinculada.\n\n"
        f"Podés usar:\n"
        f"  /saldo — Tu saldo pendiente\n"
        f"  /cuotas — Tus próximas cuotas\n"
        f"  /help — Todos los comandos")


async def cmd_saldo(supabase: Client, chat_id: str) -> None:
    """Muestra el saldo pendiente de los préstamos activos del cliente."""
    cliente = _get_cliente_by_chat(supabase, chat_id)
    if not cliente:
        await send_message(chat_id,
            "⚠️ No estás vinculado.\nEnviá <code>/vincular TU_DNI</code> para comenzar.")
        return

    prestamos = _get_prestamos_activos(supabase, cliente["id"])
    if not prestamos:
        await send_message(chat_id,
            f"✅ <b>{cliente['nombre']}</b>, no tenés préstamos activos en este momento.")
        return

    lineas = []
    total_saldo = 0.0
    for p in prestamos:
        saldo = float(p["saldo_pendiente"])
        total_saldo += saldo
        estado_emoji = "🔴" if p["estado"] == "en_mora" else "🟢"
        lineas.append(
            f"{estado_emoji} Préstamo {p['id'][:8]}...\n"
            f"   Saldo: <b>{_fmt_ars(saldo)}</b> · {p['n_cuotas']} cuotas {p['periodicidad']}"
        )

    msg = (
        f"💰 <b>Saldo de {cliente['nombre']}</b>\n\n"
        + "\n\n".join(lineas)
        + f"\n\n<b>Total pendiente: {_fmt_ars(total_saldo)}</b>"
    )
    await send_message(chat_id, msg)


async def cmd_cuotas(supabase: Client, chat_id: str) -> None:
    """Muestra las próximas cuotas pendientes del cliente."""
    cliente = _get_cliente_by_chat(supabase, chat_id)
    if not cliente:
        await send_message(chat_id,
            "⚠️ No estás vinculado.\nEnviá <code>/vincular TU_DNI</code> para comenzar.")
        return

    cuotas = _get_proximas_cuotas(supabase, cliente["id"])
    if not cuotas:
        await send_message(chat_id,
            f"✅ <b>{cliente['nombre']}</b>, no tenés cuotas pendientes.")
        return

    lineas = []
    for c in cuotas:
        saldo_cuota = float(c["monto"]) - float(c["monto_pagado"]) + float(c.get("recargo_mora") or 0)
        estado_emoji = "🔴" if c["estado"] == "mora" else "🟡"
        mora_txt = f" <i>(mora {c['dias_mora']}d)</i>" if (c.get("dias_mora") or 0) > 0 else ""
        lineas.append(
            f"{estado_emoji} Cuota #{c['numero']} — {c['fecha_vencimiento']}\n"
            f"   Monto: <b>{_fmt_ars(saldo_cuota)}</b>{mora_txt}"
        )

    msg = (
        f"📋 <b>Próximas cuotas de {cliente['nombre']}</b>\n\n"
        + "\n\n".join(lineas)
    )
    await send_message(chat_id, msg)


async def cmd_cobros(supabase: Client, chat_id: str) -> None:
    """Lista de cobros del día para el cobrador."""
    profile = _get_profile_by_chat(supabase, chat_id)
    if not profile or profile["rol"] not in ("cobrador", "admin"):
        await send_message(chat_id, "⚠️ Este comando es solo para cobradores.")
        return

    cobros = _get_cobros_hoy_cobrador(supabase, profile["id"], profile.get("zona"))
    if not cobros:
        await send_message(chat_id,
            f"🎉 <b>{profile['nombre']}</b>, no tenés cobros pendientes para hoy.")
        return

    total = sum(float(c.get("total_a_cobrar") or 0) for c in cobros)
    lineas = []
    for c in cobros:
        semaforo = {"rojo": "🔴", "naranja": "🟠", "amarillo": "🟡"}.get(c.get("semaforo", ""), "⚪")
        lineas.append(
            f"{semaforo} {c['cliente_nombre']} — <b>{_fmt_ars(float(c.get('total_a_cobrar') or 0))}</b>"
            f"\n   Cuota #{c['numero']} · {c['fecha_vencimiento']}"
            + (f" · {c['zona']}" if c.get("zona") else "")
        )

    msg = (
        f"📋 <b>Cobros de {profile['nombre']}</b> — hoy\n"
        f"Total: <b>{_fmt_ars(total)}</b> ({len(cobros)} cuotas)\n\n"
        + "\n\n".join(lineas)
    )
    await send_message(chat_id, msg)


async def cmd_help(supabase: Client, chat_id: str) -> None:
    """Muestra la lista de comandos según el tipo de usuario."""
    cliente = _get_cliente_by_chat(supabase, chat_id)
    profile = _get_profile_by_chat(supabase, chat_id)

    if cliente:
        msg = (
            "📖 <b>Comandos disponibles</b>\n\n"
            "/saldo — Ver tu saldo pendiente\n"
            "/cuotas — Tus próximas cuotas\n"
            "/start — Volver al inicio\n"
            "/help — Esta ayuda"
        )
    elif profile:
        msg = (
            "📖 <b>Comandos para cobradores</b>\n\n"
            "/cobros — Cobros del día\n"
            "/start — Volver al inicio\n"
            "/help — Esta ayuda"
        )
    else:
        msg = (
            "📖 <b>Primero necesitás vincular tu cuenta</b>\n\n"
            "/vincular <DNI> — Vincular tu cuenta de cliente\n"
            "/start — Volver al inicio"
        )
    await send_message(chat_id, msg)


# ---------------------------------------------------------------------------
# Dispatcher principal — recibe el update de Telegram
# ---------------------------------------------------------------------------

async def handle_update(supabase: Client, update: dict) -> None:
    """
    Procesa un update de Telegram.
    Solo maneja mensajes de texto con comandos.
    """
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    chat_id = str(message.get("chat", {}).get("id", ""))
    text = (message.get("text") or "").strip()
    from_user = message.get("from", {})
    nombre_tg = from_user.get("first_name", "Usuario")

    if not chat_id or not text:
        return

    # Parsear comando y argumentos
    parts = text.split(maxsplit=1)
    raw_cmd = parts[0].lower()
    args = parts[1].strip() if len(parts) > 1 else ""

    # Limpiar @botname del comando
    cmd = raw_cmd.split("@")[0]

    logger.info("Telegram update: chat=%s cmd=%s args=%s", chat_id, cmd, args[:30] if args else "")

    if cmd == "/start":
        await cmd_start(supabase, chat_id, nombre_tg)
    elif cmd == "/vincular":
        await cmd_vincular(supabase, chat_id, args)
    elif cmd == "/saldo":
        await cmd_saldo(supabase, chat_id)
    elif cmd == "/cuotas":
        await cmd_cuotas(supabase, chat_id)
    elif cmd == "/cobros":
        await cmd_cobros(supabase, chat_id)
    elif cmd == "/help":
        await cmd_help(supabase, chat_id)
    else:
        await send_message(chat_id,
            "❓ Comando no reconocido.\nEnviá /help para ver los comandos disponibles.")
