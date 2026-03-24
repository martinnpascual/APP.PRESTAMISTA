# prestamos.app

Sistema de gestión de préstamos para prestamista independiente con cobradores.

## Stack

- **Backend:** FastAPI (Python 3.11+)
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **DB:** Supabase (PostgreSQL)
- **PDF:** WeasyPrint + Jinja2
- **Notificaciones:** n8n + Telegram Bot + SMTP

## Setup rápido

```bash
# 1. Variables de entorno
cp .env.example .env
# Completar .env con los valores reales

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 3. Frontend
cd frontend
npm install
npm run dev
```

## Estado del desarrollo

Ver `CLAUDE.md` para el plan completo de sesiones.
Ver `session_log.jsonl` para el historial de lo implementado.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo en backend (nunca en variables `VITE_`)
- Nunca commitear `.env` reales
- Soft delete siempre (`activo=false`), nunca `DELETE` en producción
