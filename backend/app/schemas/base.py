"""
schemas/base.py — Modelos de respuesta genéricos
=================================================
Toda respuesta de la API sigue el formato:
  {"data": <payload>, "error": null}        → éxito
  {"data": null, "error": "<mensaje>"}      → error

Uso:
    from app.schemas.base import ok, err, ApiResponse

    @router.get("/", response_model=ApiResponse[list[ClienteOut]])
    async def listar():
        return ok([...])
"""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: str | None = None


def ok(data: T) -> dict:
    """Retorna respuesta exitosa."""
    return {"data": data, "error": None}


def err(message: str) -> dict:
    """Retorna respuesta de error (para casos controlados en el router)."""
    return {"data": None, "error": message}
