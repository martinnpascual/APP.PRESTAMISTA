"""
schemas/prestamos.py — Schemas del módulo Préstamos
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------

class PrestamoCalcularIn(BaseModel):
    """Input para preview de calculadora."""
    monto: Decimal
    tasa: Decimal
    tipo_tasa: Literal["flat", "sobre_saldo", "personalizada"]
    periodicidad: Literal["diaria", "semanal", "quincenal", "mensual"]
    n_cuotas: int
    fecha_inicio: date | None = None   # default: hoy

    @field_validator("monto")
    @classmethod
    def monto_positivo(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El monto debe ser mayor a 0")
        return v

    @field_validator("tasa")
    @classmethod
    def tasa_no_negativa(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("La tasa no puede ser negativa")
        return v

    @field_validator("n_cuotas")
    @classmethod
    def cuotas_positivas(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("n_cuotas debe ser mayor a 0")
        return v


class PrestamoIn(PrestamoCalcularIn):
    """Input para crear un préstamo (requiere cliente y fecha)."""
    cliente_id: UUID
    cobrador_id: UUID | None = None
    fecha_inicio: date                  # requerida al crear
    notas: str | None = None


class CambiarEstadoIn(BaseModel):
    estado: Literal[
        "activo", "en_mora", "cancelado", "cerrado", "pendiente_aprobacion"
    ]


class AsignarCobradorIn(BaseModel):
    cobrador_id: UUID | None = None


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------

class CuotaOut(BaseModel):
    """Cuota individual con estado de pago."""
    id: str | None = None
    numero: int
    fecha_vencimiento: str          # ISO date string
    monto: float
    monto_pagado: float = 0.0
    estado: str = "pendiente"
    dias_mora: int = 0
    recargo_mora: float = 0.0
    # Campos de la calculadora (solo en preview)
    capital: float | None = None
    intereses: float | None = None
    saldo_restante: float | None = None


class PrestamoOut(BaseModel):
    """Respuesta de un préstamo con cuotas."""
    id: str
    cliente_id: str
    cliente_nombre: str | None = None
    cliente_dni: str | None = None
    cobrador_id: str | None = None
    monto: float
    tasa: float
    tipo_tasa: str
    periodicidad: str
    n_cuotas: int
    monto_cuota: float
    monto_total: float
    saldo_pendiente: float
    estado: str
    fecha_inicio: str
    fecha_fin_estimada: str
    notas: str | None = None
    activo: bool = True
    created_at: datetime | None = None
    cuotas: list[CuotaOut] = []

    model_config = {"from_attributes": True}


class PrestamoPreviewOut(BaseModel):
    """Respuesta del endpoint /calcular (preview sin id)."""
    monto: float
    tasa: float
    tipo_tasa: str
    periodicidad: str
    n_cuotas: int
    monto_cuota: float
    monto_total: float
    total_intereses: float
    fecha_inicio: str
    fecha_fin_estimada: str
    cuotas: list[CuotaOut] = []


# ---------------------------------------------------------------------------
# Paginación
# ---------------------------------------------------------------------------

class PaginatedPrestamos(BaseModel):
    items: list[dict]
    total: int
    page: int
    per_page: int
    pages: int
