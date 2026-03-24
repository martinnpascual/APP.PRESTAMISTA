"""
schemas/documentos.py — Schemas del módulo Documentos (PDFs)
"""
from typing import Literal
from pydantic import BaseModel


class DocumentoOut(BaseModel):
    id: str
    prestamo_id: str | None = None
    pago_id: str | None = None
    tipo: str
    storage_path: str
    url_firmada: str | None = None      # generada on-demand, expira
    url_expira_en: int | None = None    # segundos hasta expiración
    created_at: str
    created_by: str


class GenerarDocumentoOut(BaseModel):
    documento_id: str
    tipo: str
    url_firmada: str
    expira_en_segundos: int = 3600
    filename: str
