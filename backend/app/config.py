"""
config.py — Settings desde variables de entorno
Usa pydantic-settings para validación automática.

Cómo obtener los valores:
  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY:
    Supabase Dashboard → Settings → API → Project URL / service_role key
  SUPABASE_JWT_SECRET:
    Supabase Dashboard → Settings → API → JWT Settings → JWT Secret
  VITE_SUPABASE_ANON_KEY (frontend):
    Supabase Dashboard → Settings → API → anon key
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Supabase (backend) ---
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # NUNCA en variables VITE_

    # JWT secret para verificación local (más rápido, sin llamada de red)
    # Obtener en: Dashboard → Settings → API → JWT Settings → "JWT Secret"
    # Si no está configurado, se usa la API de Supabase como fallback.
    SUPABASE_JWT_SECRET: str = ""

    # --- App ---
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # --- n8n ---
    N8N_WEBHOOK_URL: str = ""

    # --- Telegram Bot ---
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""          # Chat ID del prestamista (notificaciones del negocio)
    TELEGRAM_WEBHOOK_SECRET: str = ""   # Token de validación de webhook (elegir string aleatorio)

    # --- Email SMTP ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""

    model_config = {"extra": "ignore", "env_file": None}


settings = Settings()
