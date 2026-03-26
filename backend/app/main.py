"""
main.py — FastAPI application entry point
prestamos.app — S-08/S-13
"""
import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------
scheduler = AsyncIOScheduler(timezone="America/Argentina/Buenos_Aires")


def _job_mora() -> None:
    """Job nocturno de mora — 00:30 todos los días."""
    from app.services.mora import procesar_mora
    try:
        resultado = procesar_mora()
        logger.info("Job mora OK: %s", resultado)
    except Exception as e:
        logger.error("Job mora FALLÓ: %s", e)


def _job_alertas_manana() -> None:
    """Alertas D-1 de vencimiento — 20:00 todos los días."""
    from app.db.supabase import get_supabase
    from app.services.mora import crear_notificacion_vencimiento_manana
    try:
        n = crear_notificacion_vencimiento_manana(get_supabase())
        logger.info("Alertas D-1 creadas: %d", n)
    except Exception as e:
        logger.error("Job alertas D-1 FALLÓ: %s", e)


def _job_cierre_dia() -> None:
    """Resumen de cierre del día — 23:00 todos los días."""
    import asyncio
    from app.db.supabase import get_supabase
    from app.services.mora import crear_resumen_cierre_dia
    from app.services.notificaciones import resumen_cierre_dia
    try:
        supabase = get_supabase()
        resumen = crear_resumen_cierre_dia(supabase)
        logger.info("Resumen cierre día: %s", resumen)
        # Enviar notificación de cierre
        asyncio.create_task(resumen_cierre_dia(
            total_cobrado=resumen.get("total_cobrado", 0),
            pendientes=resumen.get("pendientes", 0),
            en_mora=resumen.get("en_mora", 0),
            monto_pendiente=resumen.get("monto_pendiente", 0),
        ))
    except Exception as e:
        logger.error("Job cierre día FALLÓ: %s", e)


def _job_notificaciones_pendientes() -> None:
    """Procesa notificaciones pendientes en tabla — cada 5 minutos."""
    import asyncio
    from app.db.supabase import get_supabase
    from app.services.notificaciones import procesar_pendientes
    try:
        asyncio.create_task(procesar_pendientes(get_supabase()))
    except Exception as e:
        logger.error("Job notificaciones FALLÓ: %s", e)


def _job_lista_cobradores() -> None:
    """Envía lista del día a cada cobrador con Telegram — 07:00 todos los días."""
    import asyncio
    from app.db.supabase import get_supabase
    from app.services.notificaciones import notificar_cobrador_lista_dia
    try:
        supabase = get_supabase()
        # Obtener cobradores con telegram_chat_id
        r = (supabase.table("profiles")
             .select("id, nombre, telegram_chat_id, zona")
             .eq("rol", "cobrador")
             .eq("activo", True)
             .not_.is_("telegram_chat_id", "null")
             .execute())
        cobradores = r.data or []
        for cobrador in cobradores:
            # Obtener cobros pendientes del día para este cobrador
            cobros_r = (supabase.table("v_cobros_pendientes")
                        .select("cliente_nombre, total_a_cobrar, zona, numero, semaforo, fecha_vencimiento")
                        .eq("cobrador_id", cobrador["id"])
                        .execute())
            cobros = cobros_r.data or []
            if cobros:
                asyncio.create_task(notificar_cobrador_lista_dia(
                    cobrador_nombre=cobrador["nombre"],
                    cobrador_chat_id=cobrador["telegram_chat_id"],
                    cobros=cobros,
                ))
        logger.info("Lista del día enviada a %d cobradores", len(cobradores))
    except Exception as e:
        logger.error("Job lista_cobradores FALLÓ: %s", e)


def _job_backup_semanal() -> None:
    """Backup semanal de tablas críticas a Supabase Storage — domingo 02:00."""
    from app.services.backup import ejecutar_backup
    try:
        resultado = ejecutar_backup()
        logger.info(
            "Backup semanal OK | archivos=%d | registros=%d | errores=%d",
            len(resultado["archivos"]),
            resultado["total_registros"],
            len(resultado["errores"]),
        )
    except Exception as e:
        logger.error("Job backup FALLÓ: %s", e)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("prestamos.app iniciando — DEBUG=%s", settings.DEBUG)

    # Verificar conexión a Supabase
    try:
        from app.db.supabase import get_supabase
        get_supabase()
        logger.info("Conexión a Supabase OK")
    except Exception as e:
        logger.error("Error conectando a Supabase: %s", e)

    # Scheduler — solo en entornos con procesos persistentes (no Vercel serverless)
    if not os.environ.get("VERCEL"):
        scheduler.add_job(_job_mora,                      CronTrigger(hour=0,  minute=30),         id="mora")
        scheduler.add_job(_job_alertas_manana,            CronTrigger(hour=20, minute=0),          id="alertas_manana")
        scheduler.add_job(_job_cierre_dia,                CronTrigger(hour=23, minute=0),          id="cierre_dia")
        scheduler.add_job(_job_notificaciones_pendientes, CronTrigger(minute="*/5"),               id="notificaciones")
        scheduler.add_job(_job_lista_cobradores,          CronTrigger(hour=7,  minute=0),          id="lista_cobradores")
        scheduler.add_job(_job_backup_semanal,            CronTrigger(day_of_week="sun", hour=2),  id="backup_semanal")
        scheduler.start()
        logger.info("Scheduler iniciado — mora@00:30 | alertas@20:00 | cierre@23:00 | notifs@*/5min | lista_cobradores@07:00 | backup@dom02:00")
    else:
        logger.info("Entorno Vercel — scheduler deshabilitado")

    yield

    if not os.environ.get("VERCEL"):
        scheduler.shutdown(wait=False)
    logger.info("prestamos.app apagando")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="prestamos.app API",
    description="Sistema de gestión de préstamos para prestamista independiente.",
    version="0.8.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Exception handlers globales
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = [f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}" for e in errors]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"data": None, "error": " | ".join(messages)},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no manejado en %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"data": None, "error": "Error interno del servidor"},
    )

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.routers import auth, clientes, cobros, config, documentos, notificaciones, pagos, prestamos, reportes, telegram, usuarios

app.include_router(auth.router,            prefix="/auth",            tags=["auth"])
app.include_router(clientes.router,        prefix="/clientes",        tags=["clientes"])
app.include_router(prestamos.router,       prefix="/prestamos",       tags=["préstamos"])
app.include_router(pagos.router,           prefix="/pagos",           tags=["pagos"])
app.include_router(cobros.router,          prefix="/cobros",          tags=["cobros + mora"])
app.include_router(documentos.router,      prefix="/documentos",      tags=["documentos PDF"])
app.include_router(reportes.router,        prefix="/reportes",        tags=["reportes"])
app.include_router(telegram.router,        prefix="/telegram",        tags=["telegram bot"])
app.include_router(usuarios.router,        prefix="/usuarios",        tags=["usuarios"])
app.include_router(config.router,          prefix="/config",          tags=["configuración"])
app.include_router(notificaciones.router,  prefix="/notificaciones",  tags=["notificaciones"])

# ---------------------------------------------------------------------------
# Endpoints base
# ---------------------------------------------------------------------------
@app.get("/health", tags=["system"])
async def health():
    """Health check — sin autenticación."""
    jobs = [
        {"id": j.id, "next_run": str(j.next_run_time)}
        for j in scheduler.get_jobs()
    ]
    return {"status": "ok", "version": "0.7.0", "scheduler_jobs": jobs}


@app.get("/", tags=["system"])
async def root():
    return {"message": "prestamos.app API", "docs": "/docs" if settings.DEBUG else None}
