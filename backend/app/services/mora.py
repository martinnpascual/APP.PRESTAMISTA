"""
services/mora.py — Job Nocturno de Mora
========================================
Se ejecuta a las 00:30 todos los días via APScheduler.
También puede dispararse manualmente desde POST /mora/procesar (admin).

Algoritmo:
  1. Leer config: tasa_mora_diaria y dias_gracia de config_negocio.
  2. Buscar cuotas vencidas (fecha_vencimiento < hoy) con estado pendiente/pago_parcial.
  3. Para cada cuota:
       dias_vencida = (hoy - fecha_vencimiento).days
       dias_mora    = max(0, dias_vencida - dias_gracia)
       Si dias_mora == 0: skip (dentro del período de gracia)
       saldo_cuota  = cuota.monto - cuota.monto_pagado
       recargo      = saldo_cuota × (tasa_mora_diaria / 100) × dias_mora
       Actualizar cuota: estado='mora', dias_mora, recargo_mora
       Si el préstamo no estaba en mora: marcarlo 'en_mora' + crear notificación.
  4. Retornar resumen: cuotas procesadas, préstamos en mora, monto total recargo.

Nota sobre el recargo:
  Se calcula siempre sobre el saldo ORIGINAL (monto - monto_pagado),
  multiplicado por la tasa DIARIA × días acumulados.
  Es interés simple (no compuesto) — estándar en préstamos informales argentinos.
"""
import logging
from datetime import date, datetime
from typing import Any

from supabase import Client

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tipos de resultado
# ---------------------------------------------------------------------------

class ResultadoMora:
    def __init__(self):
        self.cuotas_procesadas:  int   = 0
        self.prestamos_nuevos_mora: int = 0
        self.monto_recargo_total: float = 0.0
        self.errores:            list[str] = []
        self.ejecutado_en:       str = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "cuotas_procesadas":      self.cuotas_procesadas,
            "prestamos_nuevos_mora":  self.prestamos_nuevos_mora,
            "monto_recargo_total":    round(self.monto_recargo_total, 2),
            "errores":                self.errores,
            "ejecutado_en":           self.ejecutado_en,
        }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def procesar_mora() -> dict:
    """
    Ejecuta el job de mora sincrónicamente.
    Llamado por el scheduler nocturno y por POST /mora/procesar.
    """
    supabase = get_supabase()
    resultado = ResultadoMora()

    # 1. Configuración del negocio
    config = _obtener_config(supabase)
    tasa_mora_diaria: float = float(config.get("tasa_mora_diaria", 0.10))
    dias_gracia:      int   = int(config.get("dias_gracia", 3))
    hoy = date.today()

    logger.info(
        "Iniciando job mora | fecha=%s | tasa_diaria=%.4f%% | dias_gracia=%d",
        hoy, tasa_mora_diaria, dias_gracia,
    )

    # 2. Cuotas vencidas: tanto las nuevas (pendiente/pago_parcial) como las que
    #    ya están en mora (para actualizar dias_mora y recargo acumulado diariamente)
    cuotas_r = (
        supabase.table("cuotas")
        .select("*, prestamos!inner(id, estado, cobrador_id, cliente_id, saldo_pendiente)")
        .in_("estado", ["pendiente", "pago_parcial", "mora"])
        .lt("fecha_vencimiento", hoy.isoformat())
        .execute()
    )

    if not cuotas_r.data:
        logger.info("Job mora: sin cuotas vencidas hoy.")
        return resultado.to_dict()

    # Rastrear préstamos que ya cambiaron a en_mora en este run
    prestamos_ya_marcados: set[str] = set()

    for cuota in cuotas_r.data:
        try:
            _procesar_cuota(
                supabase, cuota, hoy,
                tasa_mora_diaria, dias_gracia,
                resultado, prestamos_ya_marcados,
            )
        except Exception as e:
            msg = f"Error en cuota {cuota['id']}: {e}"
            logger.error(msg)
            resultado.errores.append(msg)

    logger.info(
        "Job mora completado | cuotas=%d | prestamos_nuevos=%d | recargo=$%.2f | errores=%d",
        resultado.cuotas_procesadas,
        resultado.prestamos_nuevos_mora,
        resultado.monto_recargo_total,
        len(resultado.errores),
    )
    return resultado.to_dict()


# ---------------------------------------------------------------------------
# Procesar cuota individual
# ---------------------------------------------------------------------------

def _procesar_cuota(
    supabase: Client,
    cuota: dict,
    hoy: date,
    tasa_mora_diaria: float,
    dias_gracia: int,
    resultado: ResultadoMora,
    prestamos_ya_marcados: set[str],
) -> None:
    fecha_venc = date.fromisoformat(cuota["fecha_vencimiento"])
    dias_vencida = (hoy - fecha_venc).days
    dias_mora = max(0, dias_vencida - dias_gracia)

    if dias_mora == 0:
        return  # Dentro del período de gracia — no aplica mora

    # Saldo pendiente de la cuota (sobre el cual se calcula el recargo)
    saldo_cuota = round(float(cuota["monto"]) - float(cuota["monto_pagado"]), 2)
    if saldo_cuota <= 0:
        return  # Cuota saldada (rara vez llega aquí por el filtro de estado)

    # Interés simple: saldo × tasa_diaria% × días
    recargo = round(saldo_cuota * (tasa_mora_diaria / 100) * dias_mora, 2)

    # Actualizar cuota
    supabase.table("cuotas").update({
        "estado":      "mora",
        "dias_mora":   dias_mora,
        "recargo_mora": recargo,
    }).eq("id", cuota["id"]).execute()

    resultado.cuotas_procesadas  += 1
    resultado.monto_recargo_total += recargo

    # Marcar préstamo en_mora si no lo estaba
    prestamo    = cuota.get("prestamos", {})
    prestamo_id = prestamo.get("id") or cuota.get("prestamo_id")

    if not prestamo_id:
        return

    if prestamo.get("estado") != "en_mora" and prestamo_id not in prestamos_ya_marcados:
        supabase.table("prestamos").update({"estado": "en_mora"}).eq("id", prestamo_id).execute()
        prestamos_ya_marcados.add(prestamo_id)
        resultado.prestamos_nuevos_mora += 1

        # Notificación al prestamista
        _crear_notificacion_mora(supabase, prestamo, cuota, dias_mora, recargo)


# ---------------------------------------------------------------------------
# Notificaciones
# ---------------------------------------------------------------------------

def _crear_notificacion_mora(
    supabase: Client,
    prestamo: dict,
    cuota: dict,
    dias_mora: int,
    recargo: float,
) -> None:
    """Inserta una notificación en la tabla para que n8n la procese."""
    try:
        cliente_id  = prestamo.get("cliente_id")
        prestamo_id = prestamo.get("id")

        # Obtener nombre del cliente para el mensaje
        cliente_r = supabase.table("clientes").select("nombre").eq("id", cliente_id).single().execute()
        nombre_cliente = cliente_r.data.get("nombre", "Desconocido") if cliente_r.data else "Desconocido"

        cuerpo = (
            f"⚠️ *MORA DETECTADA*\n"
            f"Cliente: {nombre_cliente}\n"
            f"Cuota #{cuota['numero']} | Venc: {cuota['fecha_vencimiento']}\n"
            f"Días de mora: {dias_mora}\n"
            f"Recargo: ${recargo:,.2f}"
        )

        supabase.table("notificaciones").insert({
            "tipo":         "mora",
            "canal":        "telegram",
            "destinatario": "prestamista",   # n8n usa TELEGRAM_CHAT_ID del .env
            "asunto":       f"Mora: {nombre_cliente}",
            "cuerpo":       cuerpo,
            "enviado":      False,
            "cliente_id":   cliente_id,
            "prestamo_id":  prestamo_id,
        }).execute()

    except Exception as e:
        logger.warning("No se pudo crear notificación de mora: %s", e)


def crear_notificacion_vencimiento_manana(supabase: Client) -> int:
    """
    Crea notificaciones para cuotas que vencen mañana (D-1).
    El prestamista puede prepararse para el cobro.
    Retorna cantidad de notificaciones creadas.
    """
    from datetime import timedelta
    manana = (date.today() + timedelta(days=1)).isoformat()

    cuotas_r = (
        supabase.table("cuotas")
        .select("*, prestamos!inner(cliente_id), clientes!inner(nombre)")
        .eq("fecha_vencimiento", manana)
        .in_("estado", ["pendiente", "pago_parcial"])
        .execute()
    )

    count = 0
    for cuota in cuotas_r.data:
        try:
            cliente_nombre = (cuota.get("clientes") or {}).get("nombre", "?")
            supabase.table("notificaciones").insert({
                "tipo":         "vencimiento_manana",
                "canal":        "telegram",
                "destinatario": "prestamista",
                "asunto":       f"Vence mañana: {cliente_nombre}",
                "cuerpo": (
                    f"📅 *Cuota vence mañana*\n"
                    f"Cliente: {cliente_nombre}\n"
                    f"Cuota #{cuota['numero']} | ${float(cuota['monto']):,.2f}"
                ),
                "enviado": False,
                "cliente_id":  (cuota.get("prestamos") or {}).get("cliente_id"),
            }).execute()
            count += 1
        except Exception as e:
            logger.warning("Error creando notificación D-1 cuota %s: %s", cuota["id"], e)

    return count


def crear_resumen_cierre_dia(supabase: Client) -> dict:
    """
    Calcula el resumen del día (cobros + pendientes) e inserta notificación.
    Llamado por el scheduler al final del día (ej: 23:00).
    """
    hoy = date.today().isoformat()

    pagos_r = (
        supabase.table("pagos")
        .select("monto")
        .gte("fecha_pago", f"{hoy}T00:00:00")
        .lte("fecha_pago", f"{hoy}T23:59:59")
        .execute()
    )
    total_cobrado = sum(float(p["monto"]) for p in pagos_r.data)

    pendientes_r = (
        supabase.table("v_cobros_hoy")
        .select("cuota_id", count="exact")
        .in_("estado", ["pendiente", "pago_parcial", "mora"])
        .execute()
    )
    pendientes = pendientes_r.count or 0

    cuerpo = (
        f"📊 *Cierre del día {hoy}*\n"
        f"Total cobrado: ${total_cobrado:,.2f}\n"
        f"Cuotas pendientes: {pendientes}"
    )

    supabase.table("notificaciones").insert({
        "tipo":         "cierre_dia",
        "canal":        "telegram",
        "destinatario": "prestamista",
        "asunto":       f"Cierre del día {hoy}",
        "cuerpo":       cuerpo,
        "enviado":      False,
    }).execute()

    return {"total_cobrado": total_cobrado, "pendientes": pendientes}


# ---------------------------------------------------------------------------
# Estado de mora actual
# ---------------------------------------------------------------------------

def estado_mora_actual(supabase: Client) -> dict:
    """
    Resumen de la mora actual para el endpoint GET /mora/estado.
    """
    hoy = date.today().isoformat()

    cuotas_r = (
        supabase.table("cuotas")
        .select("id, prestamo_id, numero, fecha_vencimiento, monto, monto_pagado, dias_mora, recargo_mora")
        .eq("estado", "mora")
        .order("fecha_vencimiento")
        .execute()
    )

    prestamos_mora_r = (
        supabase.table("prestamos")
        .select("id, cliente_id, saldo_pendiente, clientes(nombre)")
        .eq("estado", "en_mora")
        .eq("activo", True)
        .execute()
    )

    total_recargo = sum(float(c.get("recargo_mora", 0)) for c in cuotas_r.data)

    return {
        "fecha":             hoy,
        "cuotas_en_mora":    len(cuotas_r.data),
        "prestamos_en_mora": len(prestamos_mora_r.data),
        "total_recargo":     round(total_recargo, 2),
        "detalle_cuotas":    cuotas_r.data,
        "prestamos":         prestamos_mora_r.data,
    }


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _obtener_config(supabase: Client) -> dict:
    try:
        r = supabase.table("config_negocio").select("*").limit(1).single().execute()
        return r.data or {}
    except Exception as e:
        logger.error("No se pudo leer config_negocio: %s. Usando defaults.", e)
        return {"tasa_mora_diaria": 0.10, "dias_gracia": 3}
