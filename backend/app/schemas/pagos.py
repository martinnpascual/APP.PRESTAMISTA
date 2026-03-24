"""
schemas/pagos.py — Schemas del módulo Pagos
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, field_validator


class PagoIn(BaseModel):
    """Payload para registrar un pago."""
    cuota_id:    UUID
    prestamo_id: UUID
    monto:       Decimal
    metodo:      str = "efectivo"   # efectivo | transferencia | otro
    notas:       str | None = None

    @field_validator("monto")
    @classmethod
    def monto_positivo(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El monto debe ser mayor a 0")
        return v

    @field_validator("metodo")
    @classmethod
    def metodo_valido(cls, v: str) -> str:
        permitidos = {"efectivo", "transferencia", "otro"}
        if v not in permitidos:
            raise ValueError(f"metodo debe ser uno de: {', '.join(permitidos)}")
        return v


class PagoOut(BaseModel):
    """Respuesta con los datos de un pago registrado."""
    id:             str
    cuota_id:       str
    prestamo_id:    str
    cliente_id:     str
    monto:          float
    fecha_pago:     str
    metodo:         str
    registrado_por: str
    notas:          str | None = None
    created_at:     str | None = None

    model_config = {"from_attributes": True}


class PaginatedPagos(BaseModel):
    items:    list[dict]
    total:    int
    page:     int
    per_page: int
    pages:    int
