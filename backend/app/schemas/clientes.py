"""
schemas/clientes.py — Schemas del módulo Clientes
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------

class ClienteIn(BaseModel):
    """Payload para crear un nuevo cliente."""
    nombre: str
    dni: str
    telefono: str
    direccion: str
    zona: str
    notas: str | None = None

    @field_validator("nombre", "dni", "telefono", "direccion", "zona")
    @classmethod
    def no_vacio(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El campo no puede estar vacío")
        return v.strip()

    @field_validator("dni")
    @classmethod
    def dni_solo_numeros(cls, v: str) -> str:
        if not v.strip().isdigit():
            raise ValueError("El DNI debe contener solo números")
        return v.strip()


class ClienteUpdateIn(BaseModel):
    """Payload para editar un cliente (todos los campos son opcionales)."""
    nombre: str | None = None
    telefono: str | None = None
    direccion: str | None = None
    zona: str | None = None
    notas: str | None = None
    # DNI: no se incluye — no se puede modificar una vez creado


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------

class ClienteOut(BaseModel):
    """Datos básicos de un cliente."""
    id: str
    nombre: str
    dni: str
    telefono: str
    direccion: str
    zona: str
    notas: str | None = None
    activo: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ClienteDeudaOut(ClienteOut):
    """Cliente con resumen de deuda consolidado (desde v_clientes_deuda)."""
    prestamos_activos: int = 0
    prestamos_en_mora: int = 0
    total_adeudado: float = 0.0


# ---------------------------------------------------------------------------
# Historial
# ---------------------------------------------------------------------------

class PagoResumen(BaseModel):
    """Pago individual dentro del historial."""
    id: str
    monto: float
    fecha_pago: datetime
    metodo: str
    registrado_por: str
    notas: str | None = None


class CuotaResumen(BaseModel):
    """Cuota con sus pagos."""
    id: str
    numero: int
    fecha_vencimiento: str       # DATE como string
    monto: float
    monto_pagado: float
    estado: str
    dias_mora: int
    recargo_mora: float
    pagos: list[PagoResumen] = []


class PrestamoResumen(BaseModel):
    """Préstamo con cuotas y pagos para el historial."""
    id: str
    monto: float
    tasa: float
    tipo_tasa: str
    periodicidad: str
    n_cuotas: int
    monto_cuota: float
    monto_total: float
    saldo_pendiente: float
    estado: str
    fecha_inicio: str            # DATE como string
    fecha_fin_estimada: str
    cobrador_id: str | None = None
    notas: str | None = None
    cuotas: list[CuotaResumen] = []


class ResumenDeuda(BaseModel):
    """Totales de deuda del cliente."""
    prestamos_activos: int = 0
    prestamos_en_mora: int = 0
    total_adeudado: float = 0.0


class ClienteHistorialOut(BaseModel):
    """Respuesta completa del endpoint /clientes/{id}/historial."""
    cliente: ClienteOut
    resumen_deuda: ResumenDeuda = ResumenDeuda()
    prestamos: list[PrestamoResumen] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Paginación
# ---------------------------------------------------------------------------

class PaginatedClientes(BaseModel):
    """Respuesta paginada de lista de clientes."""
    items: list[dict]     # ClienteOut o ClienteDeudaOut según rol
    total: int
    page: int
    per_page: int
    pages: int
