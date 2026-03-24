"""
services/reportes.py — Reportes y Estadísticas del Negocio
===========================================================
Módulos:
  - kpis_dashboard   → métricas en tiempo real (v_kpis)
  - reporte_cartera  → préstamos activos/en mora con datos completos
  - recaudacion      → cobros agrupados por período
  - mora_detallada   → cuotas vencidas con días y recargo
  - exportar_csv     → genera CSV en memoria
"""
import csv
import io
import logging
from datetime import date, timedelta

from supabase import Client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------

def kpis_dashboard(supabase: Client) -> dict:
    """Métricas en tiempo real desde la vista v_kpis."""
    r = supabase.table("v_kpis").select("*").limit(1).single().execute()
    raw = r.data or {}
    return {k: float(v) if v is not None else 0.0 for k, v in raw.items()}


def kpis_extendidos(supabase: Client) -> dict:
    """
    KPIs ampliados: todo lo de v_kpis + métricas calculadas.
    """
    base = kpis_dashboard(supabase)

    # Clientes totales activos
    clientes_r = supabase.table("clientes").select("id", count="exact").eq("activo", True).execute()
    base["clientes_activos"] = clientes_r.count or 0

    # Cobros del día (cuotas vencidas hoy)
    hoy = date.today().isoformat()
    cobros_r = (
        supabase.table("cuotas")
        .select("id, estado, monto, monto_pagado", count="exact")
        .eq("fecha_vencimiento", hoy)
        .in_("estado", ["pendiente", "pago_parcial", "mora"])
        .execute()
    )
    cuotas_hoy = cobros_r.data or []
    base["cuotas_hoy_total"] = cobros_r.count or 0
    base["cuotas_hoy_monto"] = round(
        sum(float(c["monto"]) - float(c["monto_pagado"]) for c in cuotas_hoy), 2
    )

    # Pagos registrados hoy
    pagos_r = (
        supabase.table("pagos")
        .select("monto")
        .gte("fecha_pago", f"{hoy}T00:00:00")
        .lte("fecha_pago", f"{hoy}T23:59:59")
        .execute()
    )
    base["cobrado_hoy"] = round(
        sum(float(p["monto"]) for p in (pagos_r.data or [])), 2
    )

    return base


# ---------------------------------------------------------------------------
# Cartera
# ---------------------------------------------------------------------------

def reporte_cartera(
    supabase: Client,
    estado: str | None = None,
    cobrador_id: str | None = None,
    zona: str | None = None,
) -> list[dict]:
    """
    Préstamos activos/en mora con datos del cliente y cobrador.
    Filtrables por estado, cobrador y zona.
    """
    query = (
        supabase.table("prestamos")
        .select(
            "id, monto, tasa, tipo_tasa, periodicidad, n_cuotas, estado,"
            " saldo_pendiente, fecha_inicio, created_at,"
            " clientes(nombre, dni, telefono, zona),"
            " profiles!prestamos_cobrador_id_fkey(nombre)"
        )
        .eq("activo", True)
    )

    if estado:
        query = query.eq("estado", estado)
    else:
        query = query.in_("estado", ["activo", "en_mora"])

    if cobrador_id:
        query = query.eq("cobrador_id", cobrador_id)

    r = query.order("estado").execute()
    items = r.data or []

    # Post-filter por zona del cliente
    if zona:
        items = [i for i in items if (i.get("clientes") or {}).get("zona") == zona]

    # Serializar Decimal → float
    result = []
    for item in items:
        result.append({
            **item,
            "monto": float(item["monto"]),
            "saldo_pendiente": float(item["saldo_pendiente"]),
            "tasa": float(item["tasa"]),
        })
    return result


# ---------------------------------------------------------------------------
# Recaudación
# ---------------------------------------------------------------------------

def reporte_recaudacion(
    supabase: Client,
    desde: str | None = None,
    hasta: str | None = None,
    agrupar_por: str = "dia",  # "dia" | "semana" | "mes"
) -> dict:
    """
    Pagos agrupados por período.
    Retorna: { periodo, total_cobrado, cantidad_pagos, detalle: [...] }
    """
    if not desde:
        desde = (date.today() - timedelta(days=30)).isoformat()
    if not hasta:
        hasta = date.today().isoformat()

    pagos_r = (
        supabase.table("pagos")
        .select(
            "id, monto, fecha_pago, metodo,"
            " clientes(nombre, zona),"
            " cuotas(numero),"
            " profiles!pagos_registrado_por_fkey(nombre)"
        )
        .gte("fecha_pago", f"{desde}T00:00:00")
        .lte("fecha_pago", f"{hasta}T23:59:59")
        .order("fecha_pago", desc=True)
        .execute()
    )

    pagos = pagos_r.data or []

    # Agrupar por período
    grupos: dict[str, dict] = {}
    for p in pagos:
        fecha_str = (p.get("fecha_pago") or "")[:10]
        d = date.fromisoformat(fecha_str) if fecha_str else date.today()

        if agrupar_por == "mes":
            clave = d.strftime("%Y-%m")
        elif agrupar_por == "semana":
            # Inicio de la semana (lunes)
            inicio_semana = d - timedelta(days=d.weekday())
            clave = inicio_semana.isoformat()
        else:
            clave = d.isoformat()

        if clave not in grupos:
            grupos[clave] = {"periodo": clave, "total": 0.0, "cantidad": 0, "metodos": {}}

        monto = float(p["monto"])
        grupos[clave]["total"] = round(grupos[clave]["total"] + monto, 2)
        grupos[clave]["cantidad"] += 1
        metodo = p.get("metodo", "efectivo")
        grupos[clave]["metodos"][metodo] = round(
            grupos[clave]["metodos"].get(metodo, 0.0) + monto, 2
        )

    periodos = sorted(grupos.values(), key=lambda x: x["periodo"], reverse=True)
    total_global = round(sum(g["total"] for g in periodos), 2)

    return {
        "desde": desde,
        "hasta": hasta,
        "agrupar_por": agrupar_por,
        "total_cobrado": total_global,
        "cantidad_pagos": len(pagos),
        "periodos": periodos,
        "detalle": pagos,
    }


# ---------------------------------------------------------------------------
# Mora detallada
# ---------------------------------------------------------------------------

def mora_detallada(supabase: Client) -> dict:
    """
    Cuotas en mora con datos del cliente, días y recargo acumulado.
    Incluye resumen y listado ordenado por días de mora descendente.
    """
    cuotas_r = (
        supabase.table("cuotas")
        .select(
            "id, prestamo_id, numero, fecha_vencimiento,"
            " monto, monto_pagado, recargo_mora, dias_mora,"
            " prestamos!inner(cliente_id, cobrador_id, saldo_pendiente,"
            "  clientes(nombre, dni, telefono, zona),"
            "  profiles!prestamos_cobrador_id_fkey(nombre)"
            " )"
        )
        .eq("estado", "mora")
        .order("dias_mora", desc=True)
        .execute()
    )

    cuotas = cuotas_r.data or []

    total_recargo = round(sum(float(c.get("recargo_mora") or 0) for c in cuotas), 2)
    total_saldo = round(
        sum(float(c["monto"]) - float(c["monto_pagado"]) for c in cuotas), 2
    )

    # Formatear datos
    items = []
    for c in cuotas:
        prestamo_info = c.pop("prestamos", {}) or {}
        cliente = prestamo_info.pop("clientes", {}) or {}
        cobrador = prestamo_info.pop("profiles", {}) or {}
        items.append({
            **c,
            "monto": float(c["monto"]),
            "monto_pagado": float(c["monto_pagado"]),
            "recargo_mora": float(c.get("recargo_mora") or 0),
            "saldo_cuota": round(float(c["monto"]) - float(c["monto_pagado"]), 2),
            "cliente_nombre": cliente.get("nombre", "—"),
            "cliente_dni": cliente.get("dni", "—"),
            "cliente_telefono": cliente.get("telefono"),
            "zona": cliente.get("zona"),
            "cobrador_nombre": cobrador.get("nombre"),
        })

    return {
        "fecha": date.today().isoformat(),
        "cuotas_en_mora": len(cuotas),
        "total_saldo_mora": total_saldo,
        "total_recargo_mora": total_recargo,
        "items": items,
    }


# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------

def exportar_csv(supabase: Client, tipo: str) -> tuple[str, str]:
    """
    Genera CSV en memoria.
    Retorna (contenido_csv, filename).
    tipo: 'cartera' | 'recaudacion' | 'mora'
    """
    output = io.StringIO()
    hoy = date.today().isoformat()

    if tipo == "cartera":
        data = reporte_cartera(supabase)
        cols = ["id", "cliente", "dni", "zona", "monto", "tasa", "tipo_tasa",
                "periodicidad", "n_cuotas", "estado", "saldo_pendiente", "fecha_inicio"]
        writer = csv.DictWriter(output, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        for row in data:
            cliente = row.get("clientes") or {}
            writer.writerow({
                "id":             row["id"][:8].upper(),
                "cliente":        cliente.get("nombre", "—"),
                "dni":            cliente.get("dni", "—"),
                "zona":           cliente.get("zona", "—"),
                "monto":          row["monto"],
                "tasa":           row["tasa"],
                "tipo_tasa":      row["tipo_tasa"],
                "periodicidad":   row["periodicidad"],
                "n_cuotas":       row["n_cuotas"],
                "estado":         row["estado"],
                "saldo_pendiente": row["saldo_pendiente"],
                "fecha_inicio":   row["fecha_inicio"],
            })
        filename = f"cartera_{hoy}.csv"

    elif tipo == "mora":
        data_dict = mora_detallada(supabase)
        cols = ["cuota_id", "cliente", "dni", "zona", "fecha_vencimiento",
                "monto", "monto_pagado", "saldo_cuota", "dias_mora", "recargo_mora",
                "telefono", "cobrador"]
        writer = csv.DictWriter(output, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        for row in data_dict["items"]:
            writer.writerow({
                "cuota_id":        row["id"][:8].upper(),
                "cliente":         row.get("cliente_nombre", "—"),
                "dni":             row.get("cliente_dni", "—"),
                "zona":            row.get("zona", "—"),
                "fecha_vencimiento": row["fecha_vencimiento"],
                "monto":           row["monto"],
                "monto_pagado":    row["monto_pagado"],
                "saldo_cuota":     row["saldo_cuota"],
                "dias_mora":       row.get("dias_mora", 0),
                "recargo_mora":    row["recargo_mora"],
                "telefono":        row.get("cliente_telefono", ""),
                "cobrador":        row.get("cobrador_nombre", ""),
            })
        filename = f"mora_{hoy}.csv"

    else:  # recaudacion
        data_dict = reporte_recaudacion(supabase)
        cols = ["periodo", "total_cobrado", "cantidad_pagos"]
        writer = csv.DictWriter(output, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        for periodo in data_dict["periodos"]:
            writer.writerow({
                "periodo":        periodo["periodo"],
                "total_cobrado":  periodo["total"],
                "cantidad_pagos": periodo["cantidad"],
            })
        filename = f"recaudacion_{hoy}.csv"

    return output.getvalue(), filename
