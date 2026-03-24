"""
services/backup.py — Backup Automático a Supabase Storage
==========================================================
Exporta las tablas críticas del negocio en formato JSON comprimido
y las sube al bucket 'backups' en Supabase Storage.

Tablas exportadas: clientes, prestamos, cuotas, pagos, profiles
Frecuencia: domingo 02:00 via APScheduler (configurable)
Retención: últimos 30 backups (limpieza automática de los más viejos)

Uso manual:
    POST /admin/backup  → dispara backup on-demand (admin only)
"""
import gzip
import json
import logging
from datetime import date, datetime

from supabase import Client

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

BACKUP_BUCKET   = "backups"
MAX_BACKUPS     = 30          # Archivos a conservar por tabla
TABLAS_BACKUP   = ["clientes", "prestamos", "cuotas", "pagos", "profiles", "config_negocio"]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def ejecutar_backup() -> dict:
    """
    Ejecuta el backup completo. Llamado por el scheduler y por el endpoint admin.
    Retorna resumen con archivos generados y errores.
    """
    supabase = get_supabase()
    ts       = datetime.now().strftime("%Y%m%d_%H%M%S")
    hoy      = date.today().isoformat()
    resultado = {
        "timestamp": ts,
        "fecha": hoy,
        "archivos": [],
        "errores": [],
        "total_registros": 0,
    }

    _ensure_bucket(supabase)

    for tabla in TABLAS_BACKUP:
        try:
            rows, path = _exportar_tabla(supabase, tabla, ts)
            resultado["archivos"].append({"tabla": tabla, "path": path, "filas": rows})
            resultado["total_registros"] += rows
            logger.info("Backup OK: tabla=%s filas=%d path=%s", tabla, rows, path)
        except Exception as exc:
            msg = f"Error backup tabla {tabla}: {exc}"
            logger.error(msg)
            resultado["errores"].append(msg)

    # Limpiar backups viejos
    try:
        eliminados = _limpiar_backups_viejos(supabase)
        resultado["backups_eliminados"] = eliminados
    except Exception as exc:
        logger.warning("Error limpiando backups viejos: %s", exc)

    logger.info(
        "Backup completado | archivos=%d | registros=%d | errores=%d",
        len(resultado["archivos"]),
        resultado["total_registros"],
        len(resultado["errores"]),
    )
    return resultado


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_bucket(supabase: Client) -> None:
    """Crea el bucket 'backups' si no existe (privado, max 100 MB)."""
    try:
        supabase.storage.create_bucket(
            BACKUP_BUCKET,
            options={"public": False, "file_size_limit": 100 * 1024 * 1024},
        )
        logger.info("Bucket '%s' creado.", BACKUP_BUCKET)
    except Exception:
        pass  # Ya existe


def _exportar_tabla(supabase: Client, tabla: str, ts: str) -> tuple[int, str]:
    """
    Exporta una tabla completa como JSON gzip y la sube a Storage.
    Retorna (cantidad_filas, storage_path).
    """
    # Leer todos los registros (en páginas de 1000 para tablas grandes)
    all_rows: list[dict] = []
    page_size = 1000
    offset    = 0

    while True:
        r = (
            supabase.table(tabla)
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = r.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    # Serializar a JSON con fechas como string
    payload = json.dumps(all_rows, ensure_ascii=False, default=str).encode("utf-8")
    compressed = gzip.compress(payload)

    storage_path = f"{tabla}/{ts}_{tabla}.json.gz"
    supabase.storage.from_(BACKUP_BUCKET).upload(
        path=storage_path,
        file=compressed,
        file_options={"content-type": "application/gzip", "upsert": "true"},
    )
    return len(all_rows), storage_path


def _limpiar_backups_viejos(supabase: Client) -> int:
    """
    Por cada tabla, conserva solo los MAX_BACKUPS archivos más recientes.
    Retorna cantidad de archivos eliminados.
    """
    eliminados = 0
    for tabla in TABLAS_BACKUP:
        try:
            archivos = supabase.storage.from_(BACKUP_BUCKET).list(tabla)
            if not archivos or len(archivos) <= MAX_BACKUPS:
                continue
            # Ordenar por nombre (que incluye timestamp) — los más viejos primero
            ordenados = sorted(archivos, key=lambda f: f.get("name", ""))
            a_eliminar = ordenados[: len(ordenados) - MAX_BACKUPS]
            paths = [f"{tabla}/{f['name']}" for f in a_eliminar]
            supabase.storage.from_(BACKUP_BUCKET).remove(paths)
            eliminados += len(paths)
            logger.info("Backup cleanup: tabla=%s eliminados=%d", tabla, len(paths))
        except Exception as exc:
            logger.warning("Error limpiando backups de %s: %s", tabla, exc)
    return eliminados


def listar_backups(supabase: Client) -> list[dict]:
    """Lista los backups disponibles por tabla (para el endpoint admin)."""
    resultado = []
    for tabla in TABLAS_BACKUP:
        try:
            archivos = supabase.storage.from_(BACKUP_BUCKET).list(tabla)
            for f in (archivos or []):
                resultado.append({
                    "tabla": tabla,
                    "nombre": f.get("name"),
                    "path": f"{tabla}/{f.get('name')}",
                    "tamanio_bytes": f.get("metadata", {}).get("size"),
                    "creado_at": f.get("created_at"),
                })
        except Exception:
            pass
    resultado.sort(key=lambda x: x.get("creado_at") or "", reverse=True)
    return resultado
