"""
db/supabase.py — Cliente Supabase (backend)
Usa SERVICE_ROLE_KEY — NUNCA exponer al frontend.
"""
from supabase import Client, create_client

from app.config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """Retorna el cliente Supabase singleton."""
    global _client
    if _client is None:
        _client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client
