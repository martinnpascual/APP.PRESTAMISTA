"""
services/pdf_generator.py — Generación de PDFs con WeasyPrint + Jinja2
=======================================================================
Documentos soportados:
  - contrato          → contrato de préstamo firmado por ambas partes
  - recibo            → comprobante de pago individual
  - tabla_amortizacion → tabla completa de cuotas con estado actual

Flujo:
  1. Obtener datos de Supabase (préstamo, cliente, cuotas, config)
  2. Renderizar template Jinja2 → HTML string
  3. WeasyPrint: HTML → bytes PDF
  4. Subir a Supabase Storage bucket 'documentos'
  5. Registrar en tabla documentos
  6. Devolver URL firmada (expira en 1 hora)
"""
import logging
from datetime import date, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from supabase import Client

try:
    from weasyprint import HTML as WeasyHTML
    WEASYPRINT_AVAILABLE = True
except OSError:
    WeasyHTML = None
    WEASYPRINT_AVAILABLE = False

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
STORAGE_BUCKET = "documentos"
URL_EXPIRA_SEGUNDOS = 3600  # 1 hora


# ---------------------------------------------------------------------------
# Jinja2 environment
# ---------------------------------------------------------------------------

def _jinja_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
    )
    env.filters["moneda"] = lambda v: f"$ {float(v):,.2f}"
    return env


def _render_html(template_name: str, ctx: dict) -> str:
    return _jinja_env().get_template(template_name).render(**ctx)


def _html_to_pdf(html: str) -> bytes:
    if not WEASYPRINT_AVAILABLE:
        raise RuntimeError("WeasyPrint no disponible en este entorno. Los PDFs funcionan en producción (Docker/Linux).")
    return WeasyHTML(string=html, base_url=str(TEMPLATES_DIR)).write_pdf()


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------

def _ensure_bucket(supabase: Client) -> None:
    """Crea el bucket 'documentos' si no existe (idempotente)."""
    try:
        supabase.storage.create_bucket(
            STORAGE_BUCKET,
            options={"public": False, "file_size_limit": 10 * 1024 * 1024},
        )
        logger.info("Bucket '%s' creado.", STORAGE_BUCKET)
    except Exception:
        pass  # Ya existe — continuar


def _subir_pdf(supabase: Client, pdf_bytes: bytes, storage_path: str) -> str:
    """Sube PDF al bucket y retorna el path almacenado."""
    _ensure_bucket(supabase)
    supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    return storage_path


def _url_firmada(supabase: Client, storage_path: str) -> str:
    """Genera URL firmada con expiración de 1 hora."""
    r = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
        path=storage_path,
        expires_in=URL_EXPIRA_SEGUNDOS,
    )
    # Supabase SDK puede retornar diferentes keys según la versión
    url = r.get("signedURL") or r.get("signedUrl") or r.get("signed_url") or ""
    if not url:
        logger.warning("No se pudo obtener URL firmada para '%s'. Respuesta: %s", storage_path, r)
    return url


def _registrar_documento(
    supabase: Client,
    tipo: str,
    storage_path: str,
    created_by: str,
    prestamo_id: str | None = None,
    pago_id: str | None = None,
) -> str:
    """Inserta registro en tabla documentos y retorna su id."""
    row: dict = {
        "tipo": tipo,
        "storage_path": storage_path,
        "created_by": created_by,
        "activo": True,
    }
    if prestamo_id:
        row["prestamo_id"] = prestamo_id
    if pago_id:
        row["pago_id"] = pago_id

    r = supabase.table("documentos").insert(row).execute()
    return r.data[0]["id"] if r.data else ""


# ---------------------------------------------------------------------------
# Helpers de datos
# ---------------------------------------------------------------------------

def _obtener_config(supabase: Client) -> dict:
    try:
        r = supabase.table("config_negocio").select("*").limit(1).single().execute()
        return r.data or {}
    except Exception:
        return {"nombre_negocio": "prestamos.app", "moneda": "ARS",
                "tasa_mora_diaria": 0.10, "dias_gracia": 3}


def _fmt_fecha(iso: str | None) -> str:
    """Convierte ISO date string a DD/MM/YYYY."""
    if not iso:
        return "—"
    try:
        d = date.fromisoformat(iso[:10])
        return d.strftime("%d/%m/%Y")
    except Exception:
        return iso[:10]


def _fmt_ts(iso: str | None) -> str:
    """Convierte ISO datetime string a DD/MM/YYYY HH:MM."""
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return iso[:16]


# ---------------------------------------------------------------------------
# CONTRATO
# ---------------------------------------------------------------------------

def generar_contrato(
    supabase: Client,
    prestamo_id: str,
    created_by: str,
) -> dict:
    """Genera el PDF del contrato de préstamo."""
    prestamo_r = (
        supabase.table("prestamos")
        .select("*, clientes(*), cuotas(*)")
        .eq("id", prestamo_id)
        .single()
        .execute()
    )
    if not prestamo_r.data:
        raise ValueError(f"Préstamo {prestamo_id} no encontrado")

    prestamo = prestamo_r.data
    cliente = prestamo.pop("clientes", {}) or {}
    cuotas_raw = sorted(prestamo.pop("cuotas", []) or [], key=lambda c: c["numero"])
    config = _obtener_config(supabase)

    # Calcular capital/interés por cuota
    monto_original = float(prestamo["monto"])
    n = len(cuotas_raw)
    capital_por_cuota = round(monto_original / n, 2) if n else 0

    cuotas_ctx = []
    saldo = monto_original
    for c in cuotas_raw:
        monto_cuota = float(c["monto"])
        capital = min(capital_por_cuota, saldo)
        interes = round(monto_cuota - capital, 2)
        saldo = round(saldo - capital, 2)
        cuotas_ctx.append({
            **c,
            "fecha_vencimiento": _fmt_fecha(c["fecha_vencimiento"]),
            "capital": capital,
            "interes": interes,
            "saldo_tras_pago": max(0, saldo),
        })

    total_a_devolver = sum(float(c["monto"]) for c in cuotas_raw)
    cuota_promedio = round(total_a_devolver / n, 2) if n else 0

    ctx = {
        "negocio": {
            **config,
            "tasa_mora_diaria": config.get("tasa_mora_diaria", 0.10),
            "dias_gracia": config.get("dias_gracia", 3),
        },
        "prestamo": {
            **prestamo,
            "fecha_inicio": _fmt_fecha(prestamo.get("fecha_inicio")),
        },
        "cliente": cliente,
        "cuotas": cuotas_ctx,
        "total_a_devolver": total_a_devolver,
        "cuota_promedio": cuota_promedio,
        "fecha_generacion": date.today().strftime("%d/%m/%Y"),
    }

    html = _render_html("contrato.html", ctx)
    pdf_bytes = _html_to_pdf(html)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"contrato_{prestamo_id[:8]}_{ts}.pdf"
    storage_path = f"contratos/{filename}"
    _subir_pdf(supabase, pdf_bytes, storage_path)

    doc_id = _registrar_documento(
        supabase, "contrato", storage_path, created_by,
        prestamo_id=prestamo_id,
    )
    url = _url_firmada(supabase, storage_path)
    logger.info("Contrato generado: prestamo=%s doc=%s", prestamo_id, doc_id)
    return {
        "documento_id": doc_id,
        "tipo": "contrato",
        "url_firmada": url,
        "expira_en_segundos": URL_EXPIRA_SEGUNDOS,
        "filename": filename,
    }


# ---------------------------------------------------------------------------
# RECIBO
# ---------------------------------------------------------------------------

def generar_recibo(
    supabase: Client,
    pago_id: str,
    created_by: str,
) -> dict:
    """Genera el PDF del recibo de pago."""
    pago_r = (
        supabase.table("pagos")
        .select(
            "*, "
            "cuotas(numero, fecha_vencimiento, monto, monto_pagado, recargo_mora, dias_mora), "
            "prestamos(id, n_cuotas, clientes(nombre, dni, telefono)), "
            "profiles!pagos_registrado_por_fkey(nombre, email)"
        )
        .eq("id", pago_id)
        .single()
        .execute()
    )
    if not pago_r.data:
        raise ValueError(f"Pago {pago_id} no encontrado")

    pago = pago_r.data
    cuota = pago.pop("cuotas", {}) or {}
    prestamo_info = pago.pop("prestamos", {}) or {}
    cliente = prestamo_info.pop("clientes", {}) or {}
    registrado_por = pago.pop("profiles", {}) or {}
    config = _obtener_config(supabase)

    monto_pagado_anterior = max(
        0, float(cuota.get("monto_pagado", 0)) - float(pago["monto"])
    )
    saldo_restante = max(
        0, float(cuota.get("monto", 0)) - float(cuota.get("monto_pagado", 0))
    )

    ctx = {
        "negocio": config,
        "pago": {**pago, "monto": float(pago["monto"])},
        "cuota": {
            **cuota,
            "fecha_vencimiento": _fmt_fecha(cuota.get("fecha_vencimiento")),
            "monto_pagado_anterior": monto_pagado_anterior,
            "total_cuotas": prestamo_info.get("n_cuotas", "?"),
        },
        "cliente": cliente,
        "prestamo_id": prestamo_info.get("id", pago.get("prestamo_id", "")),
        "registrado_por": registrado_por,
        "saldo_restante": saldo_restante,
        "fecha_pago_fmt": _fmt_ts(pago.get("fecha_pago")),
        "fecha_generacion": date.today().strftime("%d/%m/%Y"),
    }

    html = _render_html("recibo.html", ctx)
    pdf_bytes = _html_to_pdf(html)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"recibo_{pago_id[:8]}_{ts}.pdf"
    storage_path = f"recibos/{filename}"
    _subir_pdf(supabase, pdf_bytes, storage_path)

    doc_id = _registrar_documento(
        supabase, "recibo", storage_path, created_by,
        prestamo_id=pago.get("prestamo_id"),
        pago_id=pago_id,
    )
    url = _url_firmada(supabase, storage_path)
    logger.info("Recibo generado: pago=%s doc=%s", pago_id, doc_id)
    return {
        "documento_id": doc_id,
        "tipo": "recibo",
        "url_firmada": url,
        "expira_en_segundos": URL_EXPIRA_SEGUNDOS,
        "filename": filename,
    }


# ---------------------------------------------------------------------------
# TABLA AMORTIZACIÓN
# ---------------------------------------------------------------------------

def generar_tabla_amortizacion(
    supabase: Client,
    prestamo_id: str,
    created_by: str,
) -> dict:
    """Genera la tabla de amortización con estado actual de cada cuota."""
    prestamo_r = (
        supabase.table("prestamos")
        .select("*, clientes(nombre, dni, telefono, zona), cuotas(*)")
        .eq("id", prestamo_id)
        .single()
        .execute()
    )
    if not prestamo_r.data:
        raise ValueError(f"Préstamo {prestamo_id} no encontrado")

    prestamo = prestamo_r.data
    cliente = prestamo.pop("clientes", {}) or {}
    cuotas_raw = sorted(prestamo.pop("cuotas", []) or [], key=lambda c: c["numero"])
    config = _obtener_config(supabase)

    total_a_devolver = sum(float(c["monto"]) for c in cuotas_raw)
    total_pagado = sum(float(c["monto_pagado"]) for c in cuotas_raw)
    total_recargo = sum(float(c.get("recargo_mora") or 0) for c in cuotas_raw)
    saldo_pendiente = float(prestamo.get("saldo_pendiente", 0))
    cuotas_pagadas = sum(1 for c in cuotas_raw if c["estado"] in ("pagada", "condonada"))

    cuotas_ctx = [
        {
            **c,
            "fecha_vencimiento": _fmt_fecha(c["fecha_vencimiento"]),
            "monto": float(c["monto"]),
            "monto_pagado": float(c["monto_pagado"]),
            "recargo_mora": float(c.get("recargo_mora") or 0),
            "dias_mora": c.get("dias_mora") or 0,
        }
        for c in cuotas_raw
    ]

    ctx = {
        "negocio": config,
        "prestamo": {
            **prestamo,
            "fecha_inicio": _fmt_fecha(prestamo.get("fecha_inicio")),
            "monto": float(prestamo["monto"]),
            "saldo_pendiente": saldo_pendiente,
        },
        "cliente": cliente,
        "cuotas": cuotas_ctx,
        "totales": {
            "capital_total": float(prestamo["monto"]),
            "total_a_devolver": total_a_devolver,
            "total_pagado": total_pagado,
            "total_recargo": total_recargo,
            "saldo_pendiente": saldo_pendiente,
            "cuotas_pagadas": cuotas_pagadas,
        },
        "fecha_generacion": date.today().strftime("%d/%m/%Y"),
    }

    html = _render_html("tabla_amortizacion.html", ctx)
    pdf_bytes = _html_to_pdf(html)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"tabla_{prestamo_id[:8]}_{ts}.pdf"
    storage_path = f"tablas/{filename}"
    _subir_pdf(supabase, pdf_bytes, storage_path)

    doc_id = _registrar_documento(
        supabase, "tabla_amortizacion", storage_path, created_by,
        prestamo_id=prestamo_id,
    )
    url = _url_firmada(supabase, storage_path)
    logger.info("Tabla amortización generada: prestamo=%s doc=%s", prestamo_id, doc_id)
    return {
        "documento_id": doc_id,
        "tipo": "tabla_amortizacion",
        "url_firmada": url,
        "expira_en_segundos": URL_EXPIRA_SEGUNDOS,
        "filename": filename,
    }


# ---------------------------------------------------------------------------
# URL firmada on-demand para documento existente
# ---------------------------------------------------------------------------

def renovar_url_firmada(supabase: Client, documento_id: str) -> dict:
    """Genera una nueva URL firmada para un documento ya almacenado."""
    r = (
        supabase.table("documentos")
        .select("id, tipo, storage_path")
        .eq("id", documento_id)
        .eq("activo", True)
        .single()
        .execute()
    )
    if not r.data:
        raise ValueError(f"Documento {documento_id} no encontrado")

    doc = r.data
    url = _url_firmada(supabase, doc["storage_path"])
    return {
        "documento_id": doc["id"],
        "tipo": doc["tipo"],
        "url_firmada": url,
        "expira_en_segundos": URL_EXPIRA_SEGUNDOS,
        "filename": doc["storage_path"].split("/")[-1],
    }
