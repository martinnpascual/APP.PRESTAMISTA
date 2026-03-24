# Arquitectura — prestamos.app

## Flujo general

```
Browser (React/Vite)
    │  VITE_SUPABASE_ANON_KEY (JWT)
    ▼
FastAPI Backend
    │  SUPABASE_SERVICE_ROLE_KEY
    ▼
Supabase (PostgreSQL + Auth + Storage + Realtime)
    │
    ├── PDFs → Supabase Storage (URLs firmadas)
    └── Eventos → n8n → Telegram Bot / SMTP
```

## Autenticación

1. Usuario hace login en frontend via Supabase Auth → recibe JWT
2. Frontend adjunta JWT en header `Authorization: Bearer <token>`
3. Backend verifica JWT con `SUPABASE_JWT_SECRET` en `middleware/auth.py`
4. Backend lee el rol del usuario del JWT y aplica permisos

## Motor de Préstamos

- Fórmula configurable por préstamo: `flat | sobre_saldo | personalizada`
- Periodicidad por cliente: `diaria | semanal | quincenal | mensual`
- `services/calculadora.py` genera el calendario completo de cuotas

## Job Nocturno de Mora

- APScheduler ejecuta `services/mora.py` a las 00:30 todos los días
- Detecta cuotas vencidas → aplica recargo → notifica al prestamista via Telegram

## Roles

- `admin`: acceso total
- `cobrador`: solo su lista del día y sus clientes asignados
- `solo_lectura`: dashboard y reportes (futuro)
