"""
routers/cobros.py — Cobros del Día + Mora
==========================================
Endpoints cobros:
  GET  /cobros/hoy                   — cuotas que vencen hoy
  GET  /cobros/pendientes            — hoy + vencidas sin cobrar (con semáforo)
  GET  /cobros/resumen               — resumen del cobrador para la fecha
  GET  /cobros/zonas                 — lista de zonas disponibles
  POST /cobros/{cuota_id}/pagar      — cobro rápido (1 toque, saldo exacto)
  POST /cobros/{cuota_id}/visita     — registrar visita al cliente
  GET  /cobros/{cuota_id}/visitas    — historial de visitas de una cuota

Endpoints mora (disparo manual / admin):
  POST /cobros/mora/procesar         — ejecutar job de mora ahora
  GET  /cobros/mora/estado           — resumen de mora actual
  POST /cobros/mora/resumen-dia      — genera resumen del cierre del día
  POST /cobros/mora/alertas-manana   — genera alertas de vencimiento D-1
"""
import logging

from fastapi import APIRouter, Depends, Query

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok, err
from app.schemas.cobros import (
    CuotaCobroOut,
    PagoRapidoIn,
    ResumenCobroOut,
    VisitaIn,
    VisitaOut,
)
from app.services import cobros as cobros_svc
from app.services import mora as mora_svc

logger = logging.getLogger(__name__)
router = APIRouter()


# ===========================================================================
# COBROS DEL DÍA
# ===========================================================================

@router.get(
    "/hoy",
    response_model=ApiResponse[list[dict]],
    summary="Cuotas que vencen hoy",
)
async def cobros_hoy(
    zona: str | None = Query(None, description="Filtrar por zona (solo admin)"),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista de cuotas cuyo `fecha_vencimiento` es HOY.

    - **Cobrador**: solo sus cuotas asignadas.
    - **Admin**: todas, con filtro opcional por zona.

    Semáforo de estado:
    - `pendiente` → 🟡 amarillo
    - `pago_parcial` → 🟠 naranja
    - `mora` → 🔴 rojo
    """
    supabase = get_supabase()
    data = cobros_svc.lista_cobros_hoy(supabase, user, zona=zona)
    return ok(data)


@router.get(
    "/pendientes",
    response_model=ApiResponse[list[dict]],
    summary="Cuotas pendientes: hoy + vencidas anteriores",
)
async def cobros_pendientes(
    zona: str | None = Query(None, description="Filtrar por zona (solo admin)"),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista extendida: cuotas de HOY y cuotas vencidas de días anteriores
    que aún no fueron cobradas.

    Incluye campos extra respecto a `/hoy`:
    - `semaforo`: `'amarillo'` | `'naranja'` | `'rojo'`
    - `total_a_cobrar`: monto - monto_pagado + recargo_mora
    - `dias_atraso`: días desde el vencimiento (0 si vence hoy)

    Las cuotas en mora aparecen primero, luego por fecha de vencimiento.
    """
    supabase = get_supabase()
    data = cobros_svc.lista_cobros_pendientes(supabase, user, zona=zona)
    return ok(data)


@router.get(
    "/resumen",
    response_model=ApiResponse[ResumenCobroOut],
    summary="Resumen del día para el cobrador",
)
async def resumen_cobros(
    fecha: str | None = Query(
        None,
        description="Fecha ISO (YYYY-MM-DD). Si se omite, usa hoy.",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    ),
    user: AuthUser = Depends(get_current_user),
):
    """
    Métricas del cobrador para una fecha determinada:
    total de cuotas, cobradas, pendientes, monto cobrado y % de efectividad.

    - **Cobrador**: sus propias cuotas y pagos.
    - **Admin**: totales globales (sin filtro por cobrador).
    """
    supabase = get_supabase()
    resumen = cobros_svc.resumen_cobrador(supabase, user, fecha=fecha)
    return ok(resumen)


@router.get(
    "/zonas",
    response_model=ApiResponse[list[str]],
    summary="Zonas disponibles",
)
async def listar_zonas(user: AuthUser = Depends(get_current_user)):
    """Lista ordenada de zonas con clientes activos. Útil para filtros en la UI."""
    supabase = get_supabase()
    zonas = cobros_svc.listar_zonas(supabase)
    return ok(zonas)


# ---------------------------------------------------------------------------
# Cobro rápido y visitas — con {cuota_id} en la URL.
# IMPORTANTE: estos handlers van DESPUÉS de los paths fijos (hoy, pendientes,
# resumen, zonas) para que FastAPI no confunda "mora" con {cuota_id}.
# ---------------------------------------------------------------------------

@router.post(
    "/{cuota_id}/pagar",
    response_model=ApiResponse[dict],
    summary="Cobro rápido — paga el saldo exacto de la cuota",
    status_code=201,
)
async def cobro_rapido(
    cuota_id: str,
    datos: PagoRapidoIn,
    user: AuthUser = Depends(get_current_user),
):
    """
    Registra el pago del monto exacto pendiente (saldo + recargo de mora)
    con un solo toque — ideal para la pantalla mobile del cobrador.

    Internamente llama a `registrar_pago` y registra una visita con
    resultado `cobrado` automáticamente.

    Responde con el pago registrado (igual que `POST /pagos`).
    """
    supabase = get_supabase()
    pago = cobros_svc.pago_rapido(
        supabase, user, cuota_id,
        metodo=datos.metodo,
        notas=datos.notas,
    )
    return ok(pago)


@router.post(
    "/{cuota_id}/visita",
    response_model=ApiResponse[VisitaOut],
    summary="Registrar visita al cliente",
    status_code=201,
)
async def registrar_visita(
    cuota_id: str,
    datos: VisitaIn,
    user: AuthUser = Depends(get_current_user),
):
    """
    Registra una visita al cliente para una cuota específica.

    Resultados posibles:
    - `cobrado`       — se cobró (usa `/pagar` si además querés el pago)
    - `sin_pago`      — visitó pero el cliente no pagó
    - `ausente`       — el cliente no estaba
    - `promesa_pago`  — el cliente prometió pagar (registrar con notas)

    El registro de visita es **inmutable** (no se puede editar ni borrar).
    """
    supabase = get_supabase()
    visita = cobros_svc.registrar_visita(
        supabase, user, cuota_id,
        resultado=datos.resultado,
        notas=datos.notas,
    )
    return ok(visita)


@router.get(
    "/{cuota_id}/visitas",
    response_model=ApiResponse[list[dict]],
    summary="Historial de visitas de una cuota",
)
async def historial_visitas(
    cuota_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista cronológica inversa (más reciente primero) de visitas registradas
    para una cuota.

    - **Cobrador**: solo sus propias visitas.
    - **Admin**: todas las visitas.
    """
    supabase = get_supabase()
    visitas = cobros_svc.historial_visitas(supabase, user, cuota_id)
    return ok(visitas)


# ===========================================================================
# MORA — disparo manual y monitoreo (solo admin)
# Paths con el segmento fijo "mora/" — FastAPI los resuelve antes que {cuota_id}
# ===========================================================================

@router.post(
    "/mora/procesar",
    response_model=ApiResponse[dict],
    summary="Ejecutar job de mora manualmente (admin)",
)
async def procesar_mora_manual(user: AuthUser = Depends(require_admin)):
    """
    Dispara el job de mora de inmediato (idéntico al que corre a las 00:30).
    Útil para testear o recuperar si el scheduler falló.
    """
    resultado = mora_svc.procesar_mora()
    return ok(resultado)


@router.get(
    "/mora/estado",
    response_model=ApiResponse[dict],
    summary="Estado actual de mora (admin)",
)
async def estado_mora(user: AuthUser = Depends(require_admin)):
    """Resumen de cuotas y préstamos en mora en este momento."""
    supabase = get_supabase()
    estado = mora_svc.estado_mora_actual(supabase)
    return ok(estado)


@router.post(
    "/mora/resumen-dia",
    response_model=ApiResponse[dict],
    summary="Generar resumen de cierre del día (admin)",
)
async def resumen_cierre_dia(user: AuthUser = Depends(require_admin)):
    """
    Genera la notificación de cierre del día con total cobrado y pendientes.
    El scheduler lo dispara automáticamente a las 23:00.
    """
    supabase = get_supabase()
    resumen = mora_svc.crear_resumen_cierre_dia(supabase)
    return ok(resumen)


@router.post(
    "/mora/alertas-manana",
    response_model=ApiResponse[dict],
    summary="Crear alertas de vencimiento D-1 (admin)",
)
async def alertas_vencimiento_manana(user: AuthUser = Depends(require_admin)):
    """
    Crea notificaciones para cuotas que vencen mañana.
    El scheduler lo dispara automáticamente a las 20:00.
    """
    supabase = get_supabase()
    cantidad = mora_svc.crear_notificacion_vencimiento_manana(supabase)
    return ok({"notificaciones_creadas": cantidad})
