"""
schemas/cobros.py — Schemas del módulo Cobros del Día
"""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class CuotaCobroOut(BaseModel):
    """Una cuota en la lista de cobros del día."""
    cuota_id:          str
    prestamo_id:       str
    numero:            int
    fecha_vencimiento: date
    monto:             float
    monto_pagado:      float
    recargo_mora:      float
    dias_mora:         int
    estado:            str
    # Campos extra en v_cobros_pendientes (no disponibles en v_cobros_hoy)
    semaforo:          str | None = None   # 'amarillo' | 'naranja' | 'rojo'
    total_a_cobrar:    float | None = None
    dias_atraso:       int | None = None
    # Datos del cliente
    cliente_id:        str
    cliente_nombre:    str
    telefono:          str | None = None
    direccion:         str | None = None
    zona:              str | None = None
    cobrador_id:       str | None = None
    periodicidad:      str
    prestamo_monto:    float | None = None


class ResumenCobroOut(BaseModel):
    """Resumen del día para un cobrador."""
    fecha:             str
    cobrador_id:       str
    total_cuotas:      int
    cuotas_cobradas:   int
    cuotas_parciales:  int
    cuotas_pendientes: int
    cuotas_en_mora:    int
    monto_cobrado:     float
    monto_pendiente:   float
    porcentaje_cobro:  float   # 0.0 – 100.0


class PagoRapidoIn(BaseModel):
    """Datos para cobro rápido — paga el saldo exacto de la cuota."""
    metodo: Literal["efectivo", "transferencia", "otro"] = "efectivo"
    notas:  str | None = Field(None, max_length=500)


class VisitaIn(BaseModel):
    """Registro de una visita al cliente."""
    resultado: Literal["cobrado", "sin_pago", "ausente", "promesa_pago"]
    notas:     str | None = Field(None, max_length=500)


class VisitaOut(BaseModel):
    """Visita registrada."""
    id:          str
    cuota_id:    str
    cobrador_id: str
    fecha:       str
    hora:        str
    resultado:   str
    notas:       str | None = None
    created_at:  str | None = None
