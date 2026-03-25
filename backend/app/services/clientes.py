"""
services/clientes.py — Lógica de negocio del módulo Clientes
=============================================================
Separa la lógica de los routers para mantener los endpoints delgados.
Todas las funciones reciben el cliente Supabase y el AuthUser ya validados.
"""
import logging
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.middleware.auth import AuthUser

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _filtrar_por_cobrador(query, user: AuthUser):
    """
    Si el usuario es cobrador, restringe la query a los clientes que tienen
    al menos un préstamo activo asignado a él.
    Usa el join !inner para filtrar en la misma query.
    """
    if user.rol != "admin":
        # Filtramos por cobrador_id en la tabla prestamos (join interno)
        query = query.eq("prestamos.cobrador_id", user.id)
    return query


# ---------------------------------------------------------------------------
# Operaciones de lectura
# ---------------------------------------------------------------------------

def listar_clientes(
    supabase: Client,
    user: AuthUser,
    q: str | None = None,
    zona: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """
    Lista clientes con búsqueda y paginación.

    - Admin: ve todos los clientes activos.
    - Cobrador: solo clientes con préstamos asignados a él.

    Búsqueda (q): nombre (fuzzy ilike), DNI exacto, teléfono exacto.
    Retorna (items, total).
    """
    offset = (page - 1) * per_page

    if user.rol == "admin":
        # Admin usa la vista enriquecida con totales de deuda
        query = supabase.table("v_clientes_deuda").select("*", count="exact")

        if q:
            # Búsqueda en nombre (ilike) O dni exacto O teléfono exacto
            query = query.or_(
                f"nombre.ilike.%{q}%,dni.eq.{q},telefono.eq.{q}"
            )
        if zona:
            query = query.eq("zona", zona)

        result = query.order("nombre").range(offset, offset + per_page - 1).execute()
        total = result.count or 0
        return result.data, total

    else:
        # Cobrador: clientes con préstamos activos asignados
        query = (
            supabase.table("clientes")
            .select(
                "id, nombre, dni, telefono, direccion, zona, activo, created_at,"
                " prestamos!inner(cobrador_id)",
                count="exact",
            )
            .eq("activo", True)
            .eq("prestamos.cobrador_id", user.id)
            .eq("prestamos.activo", True)
        )

        if q:
            query = query.or_(f"nombre.ilike.%{q}%,dni.eq.{q},telefono.eq.{q}")
        if zona:
            query = query.eq("zona", zona)

        result = query.order("nombre").range(offset, offset + per_page - 1).execute()
        total = result.count or 0

        # Limpiar el join anidado antes de retornar
        items = [
            {k: v for k, v in c.items() if k != "prestamos"}
            for c in result.data
        ]
        return items, total


def obtener_cliente(supabase: Client, user: AuthUser, cliente_id: str) -> dict:
    """
    Retorna el detalle de un cliente.
    Verifica acceso: cobrador solo puede ver sus propios clientes.
    """
    result = (
        supabase.table("clientes")
        .select("*")
        .eq("id", cliente_id)
        .eq("activo", True)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    cliente = result.data

    # Verificación de acceso para cobrador
    if user.rol == "cobrador":
        tiene_acceso = (
            supabase.table("prestamos")
            .select("id", count="exact")
            .eq("cliente_id", cliente_id)
            .eq("cobrador_id", user.id)
            .eq("activo", True)
            .execute()
        )
        if not tiene_acceso.count:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este cliente")

    return cliente


def obtener_historial(supabase: Client, user: AuthUser, cliente_id: str) -> dict:
    """
    Historial completo: préstamos → cuotas → pagos.
    Incluye resumen de deuda del cliente.
    """
    # Verificar que el cliente existe y el usuario tiene acceso
    cliente = obtener_cliente(supabase, user, cliente_id)

    # Préstamos con cuotas y pagos anidados
    prestamos_result = (
        supabase.table("prestamos")
        .select("*, cuotas(*, pagos(*))")
        .eq("cliente_id", cliente_id)
        .eq("activo", True)
        .order("fecha_inicio", desc=True)
        .execute()
    )

    # Resumen de deuda (solo para admin, la vista usa service_role)
    deuda_result = None
    if user.rol == "admin":
        deuda_q = (
            supabase.table("v_clientes_deuda")
            .select("prestamos_activos, prestamos_en_mora, total_adeudado")
            .eq("id", cliente_id)
            .execute()
        )
        deuda_result = deuda_q.data[0] if deuda_q.data else {}

    return {
        "cliente": cliente,
        "resumen_deuda": deuda_result or {},
        "prestamos": prestamos_result.data,
    }


# ---------------------------------------------------------------------------
# Operaciones de escritura (admin only — validado en el router)
# ---------------------------------------------------------------------------

def crear_cliente(supabase: Client, user: AuthUser, datos: dict) -> dict:
    """Crea un nuevo cliente y registra en system_logs."""
    # Verificar DNI duplicado con mensaje claro
    existente = (
        supabase.table("clientes")
        .select("id, nombre")
        .eq("dni", datos["dni"])
        .execute()
    )
    if existente.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un cliente con DNI {datos['dni']} ({existente.data[0]['nombre']})",
        )

    datos["created_by"] = user.id
    result = supabase.table("clientes").insert(datos).execute()
    cliente = result.data[0]

    _log(supabase, user.id, "INSERT", "clientes", cliente["id"], datos_nuevos=datos)
    return cliente


def actualizar_cliente(
    supabase: Client, user: AuthUser, cliente_id: str, cambios: dict
) -> dict:
    """Actualiza campos editables del cliente. DNI no se puede cambiar."""
    if "dni" in cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El DNI no puede modificarse una vez creado el cliente",
        )

    # Obtener estado anterior para audit log
    anterior = obtener_cliente(supabase, user, cliente_id)

    result = (
        supabase.table("clientes")
        .update(cambios)
        .eq("id", cliente_id)
        .select("*")
        .single()
        .execute()
    )
    cliente = result.data

    _log(supabase, user.id, "UPDATE", "clientes", cliente_id,
         datos_anteriores=anterior, datos_nuevos=cambios)
    return cliente


def eliminar_cliente(supabase: Client, user: AuthUser, cliente_id: str) -> bool:
    """
    Soft delete: marca activo=False.
    Verifica que no tenga préstamos activos antes de desactivar.
    """
    prestamos_activos = (
        supabase.table("prestamos")
        .select("id", count="exact")
        .eq("cliente_id", cliente_id)
        .in_("estado", ["activo", "en_mora"])
        .execute()
    )
    if prestamos_activos.count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El cliente tiene {prestamos_activos.count} préstamo(s) activo(s). Cancelarlos antes de desactivar.",
        )

    supabase.table("clientes").update({"activo": False}).eq("id", cliente_id).execute()
    _log(supabase, user.id, "SOFT_DELETE", "clientes", cliente_id)
    return True


# ---------------------------------------------------------------------------
# Auditoría
# ---------------------------------------------------------------------------

def _log(
    supabase: Client,
    usuario_id: str,
    accion: str,
    tabla: str,
    registro_id: str,
    datos_anteriores: dict | None = None,
    datos_nuevos: dict | None = None,
) -> None:
    """Inserta entrada de auditoría en system_logs (best-effort, no falla la operación)."""
    try:
        supabase.table("system_logs").insert({
            "usuario_id": usuario_id,
            "accion": accion,
            "tabla": tabla,
            "registro_id": registro_id,
            "datos_anteriores": datos_anteriores,
            "datos_nuevos": datos_nuevos,
        }).execute()
    except Exception as e:
        logger.warning("No se pudo registrar en system_logs: %s", e)
