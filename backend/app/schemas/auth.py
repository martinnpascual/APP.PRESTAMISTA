"""
schemas/auth.py — Schemas de autenticación y perfil de usuario
"""
from pydantic import BaseModel


class UserProfileOut(BaseModel):
    """Respuesta del endpoint GET /auth/me"""
    id: str
    email: str
    rol: str           # 'admin' | 'cobrador' | 'solo_lectura'
    zona: str | None
    activo: bool


class ProfileUpdateIn(BaseModel):
    """Actualización de perfil propio (nombre, zona)"""
    nombre: str | None = None
    zona: str | None = None
