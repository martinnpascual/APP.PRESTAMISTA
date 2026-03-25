"""
services/notificaciones.py — Notificaciones Telegram + Email
=============================================================
IMPORTANTE:
  - El destinatario SIEMPRE es el prestamista (TELEGRAM_CHAT_ID / SMTP_USER)
  - Los clientes NO reciben notificaciones
  - Disparos: mora detectada, cuota D-1, cierre del día, reporte semanal

Arquitectura dual:
  1. Intenta enviar via n8n webhook (si N8N_WEBHOOK_URL está configurado)
  2. Fallback: directo a Telegram Bot API / SMTP
"""
import logging
import smtplib
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Canales de envío
# ---------------------------------------------------------------------------

async def enviar_via_n8n(tipo: str, datos: dict) -> bool:
    """
    POST al webhook de n8n con tipo + datos.
    n8n se encarga del enrutamiento (Telegram, email, etc.).
    Retorna True si el webhook respondió 2xx.
    """
    if not settings.N8N_WEBHOOK_URL:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                settings.N8N_WEBHOOK_URL,
                json={"tipo": tipo, "datos": datos},
            )
            if r.status_code < 300:
                logger.debug("n8n webhook OK: tipo=%s status=%s", tipo, r.status_code)
                return True
            logger.warning("n8n webhook error: tipo=%s status=%s", tipo, r.status_code)
            return False
    except Exception as exc:
        logger.warning("n8n webhook exception: %s", exc)
        return False


async def enviar_telegram(mensaje: str) -> bool:
    """
    Envía mensaje al chat del prestamista via Telegram Bot API directa.
    Retorna True si fue exitoso.
    """
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        logger.debug("Telegram no configurado — mensaje omitido.")
        return False
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json={
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": mensaje,
                "parse_mode": "HTML",
            })
            if r.status_code == 200:
                logger.debug("Telegram OK: %s chars", len(mensaje))
                return True
            logger.warning("Telegram error: status=%s body=%s", r.status_code, r.text[:200])
            return False
    except Exception as exc:
        logger.warning("Telegram exception: %s", exc)
        return False


async def enviar_email(asunto: str, cuerpo_html: str) -> bool:
    """
    Envía email al prestamista via SMTP (Gmail por defecto).
    Retorna True si fue exitoso.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.debug("Email SMTP no configurado — mensaje omitido.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"] = settings.SMTP_USER
        msg["To"] = settings.SMTP_USER  # el prestamista se envía a sí mismo
        msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(settings.SMTP_USER, settings.SMTP_PASS)
            srv.sendmail(settings.SMTP_USER, [settings.SMTP_USER], msg.as_string())
        logger.debug("Email OK: asunto='%s'", asunto)
        return True
    except Exception as exc:
        logger.warning("Email exception: %s", exc)
        return False


async def _despachar(tipo: str, datos: dict, mensaje_tg: str, asunto_email: str, cuerpo_email: str) -> None:
    """
    Intenta n8n primero; si falla, cae a Telegram directo + email.
    """
    enviado = await enviar_via_n8n(tipo, datos)
    if not enviado:
        await enviar_telegram(mensaje_tg)
        await enviar_email(asunto_email, cuerpo_email)


# ---------------------------------------------------------------------------
# Helpers de formato
# ---------------------------------------------------------------------------

def _fmt_ars(v: float) -> str:
    return f"$ {v:,.2f}"


def _html_row(label: str, value: str) -> str:
    return f"<tr><td style='padding:4px 8px;color:#555'>{label}</td><td style='padding:4px 8px;font-weight:bold'>{value}</td></tr>"


# ---------------------------------------------------------------------------
# Eventos de negocio
# ---------------------------------------------------------------------------

async def notificar_mora(
    cliente_nombre: str,
    monto: float,
    dias: int,
    prestamo_id: str = "",
    zona: str = "",
) -> None:
    """Notifica al prestamista cuando un cliente entra en mora."""
    datos = {
        "cliente": cliente_nombre,
        "monto": monto,
        "dias_mora": dias,
        "prestamo_id": prestamo_id,
        "zona": zona,
        "fecha": date.today().isoformat(),
    }
    mensaje_tg = (
        f"⚠️ <b>MORA DETECTADA</b>\n\n"
        f"👤 {cliente_nombre}\n"
        f"💰 Saldo: {_fmt_ars(monto)}\n"
        f"📅 Días en mora: {dias}\n"
        f"📍 Zona: {zona or '—'}"
    )
    cuerpo = f"""
    <h2 style='color:#c0392b'>⚠️ Mora detectada</h2>
    <table>{_html_row('Cliente', cliente_nombre)}{_html_row('Saldo', _fmt_ars(monto))}
    {_html_row('Días mora', str(dias))}{_html_row('Zona', zona or '—')}</table>
    """
    await _despachar("mora", datos, mensaje_tg, f"MORA — {cliente_nombre}", cuerpo)


async def notificar_pago(
    cliente_nombre: str,
    monto: float,
    metodo: str = "efectivo",
    prestamo_id: str = "",
) -> None:
    """Notifica al prestamista cuando se registra un pago."""
    datos = {
        "cliente": cliente_nombre,
        "monto": monto,
        "metodo": metodo,
        "prestamo_id": prestamo_id,
        "fecha": date.today().isoformat(),
    }
    mensaje_tg = (
        f"✅ <b>PAGO REGISTRADO</b>\n\n"
        f"👤 {cliente_nombre}\n"
        f"💰 Monto: {_fmt_ars(monto)}\n"
        f"💳 Método: {metodo}"
    )
    cuerpo = f"""
    <h2 style='color:#27ae60'>✅ Pago registrado</h2>
    <table>{_html_row('Cliente', cliente_nombre)}{_html_row('Monto', _fmt_ars(monto))}
    {_html_row('Método', metodo)}</table>
    """
    await _despachar("pago", datos, mensaje_tg, f"Pago — {cliente_nombre}", cuerpo)


async def alerta_vencimiento_manana(
    cuotas: list[dict],
) -> None:
    """Alerta D-1: cuotas que vencen mañana."""
    if not cuotas:
        return
    total = sum(float(c.get("monto", 0)) - float(c.get("monto_pagado", 0)) for c in cuotas)
    datos = {
        "tipo": "alerta_vencimiento",
        "cantidad": len(cuotas),
        "total": total,
        "cuotas": cuotas[:10],  # max 10 en el payload
        "fecha": date.today().isoformat(),
    }
    lista = "\n".join(
        f"  • {c.get('cliente_nombre', '—')} — {_fmt_ars(float(c.get('monto', 0)) - float(c.get('monto_pagado', 0)))}"
        for c in cuotas[:8]
    )
    mensaje_tg = (
        f"📋 <b>COBROS PARA MAÑANA</b>\n\n"
        f"Total cuotas: {len(cuotas)}\n"
        f"Monto total: {_fmt_ars(total)}\n\n"
        f"{lista}"
        + (f"\n  ...y {len(cuotas) - 8} más" if len(cuotas) > 8 else "")
    )
    filas = "".join(
        f"<tr><td style='padding:3px 6px'>{c.get('cliente_nombre','—')}</td>"
        f"<td style='padding:3px 6px'>{_fmt_ars(float(c.get('monto',0))-float(c.get('monto_pagado',0)))}</td></tr>"
        for c in cuotas[:15]
    )
    cuerpo = f"""
    <h2>📋 Cobros para mañana</h2>
    <p>Total: <strong>{len(cuotas)} cuotas — {_fmt_ars(total)}</strong></p>
    <table border='1' cellpadding='4' style='border-collapse:collapse'><tr><th>Cliente</th><th>Monto</th></tr>{filas}</table>
    """
    await _despachar(
        "alerta_vencimiento", datos, mensaje_tg,
        f"Cobros mañana: {len(cuotas)} cuotas", cuerpo,
    )


async def resumen_cierre_dia(
    total_cobrado: float,
    pendientes: int,
    en_mora: int = 0,
    monto_pendiente: float = 0.0,
) -> None:
    """Envía resumen del cierre del día al prestamista."""
    datos = {
        "tipo": "cierre_dia",
        "total_cobrado": total_cobrado,
        "pendientes": pendientes,
        "en_mora": en_mora,
        "monto_pendiente": monto_pendiente,
        "fecha": date.today().isoformat(),
    }
    mensaje_tg = (
        f"📊 <b>CIERRE DEL DÍA — {date.today().strftime('%d/%m/%Y')}</b>\n\n"
        f"✅ Cobrado hoy: {_fmt_ars(total_cobrado)}\n"
        f"⏳ Cuotas pendientes: {pendientes}\n"
        f"🔴 En mora: {en_mora}\n"
        f"💸 Monto pendiente: {_fmt_ars(monto_pendiente)}"
    )
    cuerpo = f"""
    <h2>📊 Cierre del día — {date.today().strftime('%d/%m/%Y')}</h2>
    <table>
    {_html_row('Cobrado hoy', _fmt_ars(total_cobrado))}
    {_html_row('Cuotas pendientes', str(pendientes))}
    {_html_row('En mora', str(en_mora))}
    {_html_row('Monto pendiente', _fmt_ars(monto_pendiente))}
    </table>
    """
    await _despachar(
        "cierre_dia", datos, mensaje_tg,
        f"Cierre {date.today().strftime('%d/%m/%Y')} — Cobrado {_fmt_ars(total_cobrado)}", cuerpo,
    )


# ---------------------------------------------------------------------------
# Procesar notificaciones pendientes en tabla
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Notificaciones a clientes (requieren telegram_chat_id en clientes)
# ---------------------------------------------------------------------------

async def notificar_cliente_pago_registrado(
    cliente_nombre: str,
    cliente_chat_id: str,
    monto: float,
    cuota_numero: int,
    saldo_restante: float,
) -> None:
    """
    Envía confirmación de pago al cliente vía Telegram.
    Solo se llama si el cliente tiene telegram_chat_id configurado.
    """
    from app.services.telegram_bot import send_message
    if not cliente_chat_id:
        return
    msg = (
        f"✅ <b>Pago confirmado</b>\n\n"
        f"Hola <b>{cliente_nombre}</b>, registramos tu pago:\n"
        f"💰 Monto: <b>${ monto:,.2f}</b>\n"
        f"📄 Cuota #{cuota_numero}\n"
        f"📊 Saldo restante: <b>${saldo_restante:,.2f}</b>"
        + ("\n\n🎉 ¡Préstamo cancelado! Gracias." if saldo_restante <= 0 else "")
    )
    await send_message(cliente_chat_id, msg)


async def notificar_cliente_vencimiento_manana(
    cliente_nombre: str,
    cliente_chat_id: str,
    cuota_numero: int,
    monto: float,
    fecha_vencimiento: str,
) -> None:
    """
    Alerta D-1 al cliente: su cuota vence mañana.
    Solo se llama si el cliente tiene telegram_chat_id configurado.
    """
    from app.services.telegram_bot import send_message
    if not cliente_chat_id:
        return
    msg = (
        f"📅 <b>Cuota a vencer mañana</b>\n\n"
        f"Hola <b>{cliente_nombre}</b>:\n"
        f"Tu cuota #{cuota_numero} vence el <b>{fecha_vencimiento}</b>\n"
        f"Monto: <b>${monto:,.2f}</b>\n\n"
        f"Ante cualquier consulta, respondé este mensaje o usá /saldo"
    )
    await send_message(cliente_chat_id, msg)


async def notificar_cobrador_lista_dia(
    cobrador_nombre: str,
    cobrador_chat_id: str,
    cobros: list[dict],
) -> None:
    """
    Envía al cobrador su lista del día vía Telegram (7:00 AM).
    cobros: lista de dicts con cliente_nombre, total_a_cobrar, zona, numero, semaforo
    """
    from app.services.telegram_bot import send_message
    if not cobrador_chat_id or not cobros:
        return
    total = sum(float(c.get("total_a_cobrar") or 0) for c in cobros)
    lineas = []
    for c in cobros[:15]:  # máximo 15 para no superar límite de Telegram
        semaforo = {"rojo": "🔴", "naranja": "🟠", "amarillo": "🟡"}.get(c.get("semaforo", ""), "⚪")
        lineas.append(
            f"{semaforo} {c['cliente_nombre']} — ${float(c.get('total_a_cobrar') or 0):,.0f}"
        )
    msg = (
        f"📋 <b>Lista del día — {cobrador_nombre}</b>\n"
        f"Total: <b>${total:,.2f}</b> · {len(cobros)} cobros\n\n"
        + "\n".join(lineas)
        + (f"\n...y {len(cobros) - 15} más" if len(cobros) > 15 else "")
    )
    await send_message(cobrador_chat_id, msg)


async def notificar_refinanciacion(
    cliente_nombre: str,
    prestamo_id: str,
    nuevo_capital: float,
    n_cuotas: int,
    monto_cuota: float,
    tasa: float,
    fecha_inicio: str = "",
) -> None:
    """Notifica al prestamista cuando se refinancia un préstamo."""
    datos = {
        "cliente": cliente_nombre,
        "prestamo_id": prestamo_id,
        "nuevo_capital": nuevo_capital,
        "n_cuotas": n_cuotas,
        "monto_cuota": monto_cuota,
        "tasa": tasa,
        "fecha_inicio": fecha_inicio or date.today().isoformat(),
    }
    mensaje_tg = (
        f"🔄 <b>PRÉSTAMO REFINANCIADO</b>\n\n"
        f"👤 {cliente_nombre}\n"
        f"💰 Nuevo capital: {_fmt_ars(nuevo_capital)}\n"
        f"📅 Nuevas cuotas: {n_cuotas} × {_fmt_ars(monto_cuota)}\n"
        f"📊 Tasa: {tasa}%\n"
        f"🗓️ Inicio: {datos['fecha_inicio']}"
    )
    cuerpo = f"""
    <h2 style='color:#7c3aed'>🔄 Préstamo refinanciado</h2>
    <table>
    {_html_row('Cliente', cliente_nombre)}
    {_html_row('Nuevo capital', _fmt_ars(nuevo_capital))}
    {_html_row('Nuevas cuotas', f'{n_cuotas} × {_fmt_ars(monto_cuota)}')}
    {_html_row('Tasa', f'{tasa}%')}
    {_html_row('Fecha inicio', datos['fecha_inicio'])}
    </table>
    """
    await _despachar("refinanciacion", datos, mensaje_tg, f"Refinanciación — {cliente_nombre}", cuerpo)


async def notificar_cambio_config(
    usuario_nombre: str,
    cambios: dict,
) -> None:
    """Notifica al prestamista cuando se cambia la configuración del negocio."""
    if not cambios:
        return
    datos = {
        "usuario": usuario_nombre,
        "cambios": cambios,
        "fecha": date.today().isoformat(),
    }
    lineas = "\n".join(f"  • {k}: {v}" for k, v in cambios.items())
    mensaje_tg = (
        f"🛠️ <b>CONFIGURACIÓN ACTUALIZADA</b>\n\n"
        f"Usuario: {usuario_nombre}\n\n"
        f"Cambios:\n{lineas}"
    )
    cuerpo = f"""
    <h2 style='color:#d97706'>🛠️ Configuración actualizada</h2>
    <p>Usuario: <strong>{usuario_nombre}</strong></p>
    <table>{''.join(_html_row(k, str(v)) for k, v in cambios.items())}</table>
    """
    await _despachar("cambio_config", datos, mensaje_tg, "Configuración actualizada", cuerpo)


async def procesar_pendientes(supabase: Client) -> int:
    """
    Lee notificaciones no enviadas de la tabla `notificaciones`,
    las envía y marca como enviadas.
    Retorna la cantidad de notificaciones procesadas.
    """
    try:
        r = (
            supabase.table("notificaciones")
            .select("id, canal, mensaje, tipo")
            .eq("enviado", False)
            .order("created_at")
            .limit(50)
            .execute()
        )
    except Exception as exc:
        logger.error("Error leyendo notificaciones pendientes: %s", exc)
        return 0

    notifs = r.data or []
    enviados = 0

    for n in notifs:
        ok_flag = False
        canal = n.get("canal", "telegram")
        mensaje = n.get("cuerpo", "") or n.get("mensaje", "")

        if canal == "telegram":
            ok_flag = await enviar_telegram(mensaje)
        elif canal == "email":
            ok_flag = await enviar_email("Notificación — prestamos.app", mensaje)

        if ok_flag:
            try:
                supabase.table("notificaciones").update({
                    "enviado": True,
                }).eq("id", n["id"]).execute()
                enviados += 1
            except Exception as exc:
                logger.error("Error marcando notificación %s como enviada: %s", n["id"], exc)

    if enviados:
        logger.info("Notificaciones enviadas: %d/%d", enviados, len(notifs))
    return enviados
