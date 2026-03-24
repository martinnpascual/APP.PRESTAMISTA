"""
routers/documentos.py — Generación y acceso a documentos PDF
=============================================================
Endpoints:
  POST /documentos/contrato/{prestamo_id}       — genera contrato de préstamo
  POST /documentos/recibo/{pago_id}             — genera recibo de pago
  POST /documentos/tabla/{prestamo_id}          — genera tabla de amortización
  GET  /documentos/{documento_id}/url           — renueva URL firmada
  GET  /documentos/prestamo/{prestamo_id}       — lista documentos de un préstamo
"""
import logging

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.db.supabase import get_supabase
from app.middleware.auth import AuthUser, get_current_user, require_admin
from app.schemas.base import ApiResponse, ok, err
from app.schemas.documentos import GenerarDocumentoOut, DocumentoOut
from app.services import pdf_generator as pdf_svc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/contrato/{prestamo_id}",
    response_model=ApiResponse[GenerarDocumentoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Generar contrato de préstamo (PDF)",
)
async def generar_contrato(
    prestamo_id: str,
    user: AuthUser = Depends(require_admin),
):
    """
    Genera el PDF del contrato firmado, lo sube a Supabase Storage
    y retorna una URL firmada con expiración de 1 hora.

    Solo admins pueden generar documentos.
    """
    supabase = get_supabase()
    try:
        resultado = pdf_svc.generar_contrato(supabase, prestamo_id, user.id)
        return ok(resultado)
    except ValueError as e:
        return JSONResponse(
            status_code=404,
            content={"data": None, "error": str(e)},
        )
    except Exception as e:
        logger.error("Error generando contrato prestamo=%s: %s", prestamo_id, e)
        return JSONResponse(
            status_code=500,
            content={"data": None, "error": "Error generando el PDF. Verificar WeasyPrint."},
        )


@router.post(
    "/recibo/{pago_id}",
    response_model=ApiResponse[GenerarDocumentoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Generar recibo de pago (PDF)",
)
async def generar_recibo(
    pago_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Genera el PDF del comprobante de pago.
    Cobrador puede generar recibos de sus préstamos; admin puede generar cualquiera.
    """
    supabase = get_supabase()
    try:
        resultado = pdf_svc.generar_recibo(supabase, pago_id, user.id)
        return ok(resultado)
    except ValueError as e:
        return JSONResponse(
            status_code=404,
            content={"data": None, "error": str(e)},
        )
    except Exception as e:
        logger.error("Error generando recibo pago=%s: %s", pago_id, e)
        return JSONResponse(
            status_code=500,
            content={"data": None, "error": "Error generando el PDF."},
        )


@router.post(
    "/tabla/{prestamo_id}",
    response_model=ApiResponse[GenerarDocumentoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Generar tabla de amortización (PDF)",
)
async def generar_tabla(
    prestamo_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Genera el PDF de la tabla de amortización con el estado actual de cada cuota.
    Disponible para el cobrador asignado y para admins.
    """
    supabase = get_supabase()
    try:
        resultado = pdf_svc.generar_tabla_amortizacion(supabase, prestamo_id, user.id)
        return ok(resultado)
    except ValueError as e:
        return JSONResponse(
            status_code=404,
            content={"data": None, "error": str(e)},
        )
    except Exception as e:
        logger.error("Error generando tabla prestamo=%s: %s", prestamo_id, e)
        return JSONResponse(
            status_code=500,
            content={"data": None, "error": "Error generando el PDF."},
        )


@router.get(
    "/{documento_id}/url",
    response_model=ApiResponse[GenerarDocumentoOut],
    summary="Renovar URL firmada de un documento",
)
async def renovar_url(
    documento_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Genera una nueva URL firmada (1 hora) para un documento existente.
    Las URLs anteriores pueden haber expirado; este endpoint las renueva.
    """
    supabase = get_supabase()
    try:
        resultado = pdf_svc.renovar_url_firmada(supabase, documento_id)
        return ok(resultado)
    except ValueError as e:
        return JSONResponse(
            status_code=404,
            content={"data": None, "error": str(e)},
        )


@router.get(
    "/prestamo/{prestamo_id}",
    response_model=ApiResponse[list[dict]],
    summary="Listar documentos de un préstamo",
)
async def listar_documentos_prestamo(
    prestamo_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Lista todos los PDFs generados para un préstamo, del más reciente al más antiguo.
    No incluye URL firmada — usar `GET /{documento_id}/url` para obtenerla.
    """
    supabase = get_supabase()
    r = (
        supabase.table("documentos")
        .select("id, tipo, storage_path, created_at, profiles!documentos_created_by_fkey(nombre)")
        .eq("prestamo_id", prestamo_id)
        .eq("activo", True)
        .order("created_at", desc=True)
        .execute()
    )
    return ok(r.data or [])
