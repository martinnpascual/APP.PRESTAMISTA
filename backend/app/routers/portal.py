"""
routers/portal.py — Portal público del deudor
===============================================
Acceso sin autenticación via token firmado.
El deudor puede ver su estado de cuenta, cuotas y pagos.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.db.supabase import get_supabase
from app.schemas.base import ApiResponse, ok

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/{token}",
    response_model=ApiResponse[dict],
    summary="Estado de cuenta del deudor (acceso público por token)",
)
async def portal_deudor(token: str):
    """
    Endpoint público — sin autenticación.
    Retorna el estado de cuenta del préstamo asociado al token.
    El token expira en 30 días desde su generación.
    """
    supabase = get_supabase()

    prestamo_r = (
        supabase.table("prestamos")
        .select("*, clientes(nombre, telefono, zona)")
        .eq("portal_token", token)
        .eq("activo", True)
        .single()
        .execute()
    )

    if not prestamo_r.data:
        raise HTTPException(status_code=404, detail="Enlace no válido o expirado")

    prestamo = prestamo_r.data

    # Verificar expiración
    exp_str = prestamo.get("portal_token_exp")
    if exp_str:
        try:
            exp = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(status_code=410, detail="Este enlace ha expirado")
        except ValueError:
            pass

    # Obtener cuotas
    cuotas_r = (
        supabase.table("cuotas")
        .select("numero, fecha_vencimiento, monto, monto_pagado, estado, dias_mora, recargo_mora")
        .eq("prestamo_id", prestamo["id"])
        .order("numero")
        .execute()
    )
    cuotas = cuotas_r.data or []

    # Obtener pagos recientes
    pagos_r = (
        supabase.table("pagos")
        .select("monto, fecha_pago, metodo, notas")
        .eq("prestamo_id", prestamo["id"])
        .order("fecha_pago", desc=True)
        .limit(10)
        .execute()
    )
    pagos = pagos_r.data or []

    cliente = prestamo.pop("clientes", {}) or {}

    return ok({
        "cliente": {
            "nombre": cliente.get("nombre", "—"),
            "zona": cliente.get("zona", "—"),
        },
        "prestamo": {
            "id": prestamo["id"],
            "monto": float(prestamo["monto"]),
            "tasa": float(prestamo["tasa"]),
            "tipo_tasa": prestamo["tipo_tasa"],
            "periodicidad": prestamo["periodicidad"],
            "n_cuotas": prestamo["n_cuotas"],
            "monto_cuota": float(prestamo["monto_cuota"]),
            "monto_total": float(prestamo["monto_total"]),
            "saldo_pendiente": float(prestamo["saldo_pendiente"]),
            "estado": prestamo["estado"],
            "fecha_inicio": prestamo["fecha_inicio"],
            "fecha_fin_estimada": prestamo["fecha_fin_estimada"],
        },
        "cuotas": [
            {
                "numero": c["numero"],
                "fecha_vencimiento": c["fecha_vencimiento"],
                "monto": float(c["monto"]),
                "monto_pagado": float(c["monto_pagado"]),
                "estado": c["estado"],
                "dias_mora": c["dias_mora"],
                "recargo_mora": float(c["recargo_mora"]),
                "pendiente": round(float(c["monto"]) - float(c["monto_pagado"]) + float(c["recargo_mora"]), 2),
            }
            for c in cuotas
        ],
        "pagos_recientes": [
            {
                "monto": float(p["monto"]),
                "fecha": p["fecha_pago"],
                "metodo": p["metodo"],
                "notas": p.get("notas"),
            }
            for p in pagos
        ],
    })
