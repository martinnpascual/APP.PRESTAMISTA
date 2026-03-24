# CLAUDE.md — prestamos.app

> Archivo de contexto persistente para Claude Code.
> Leer al inicio de cada sesión antes de tocar cualquier archivo.

---

## Identidad del proyecto

**Sistema:** prestamos.app
**Tipo:** Gestión de préstamos para prestamista independiente con cobradores
**Estado actual:** S-16 completado — Sistema completo en producción. Ver `session_log.jsonl`.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI (Python 3.11+) |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Base de datos | Supabase (PostgreSQL gestionado) |
| Auth | Supabase Auth (JWT) |
| PDF | WeasyPrint + Jinja2 |
| Notificaciones | n8n (Telegram Bot API + SMTP) |
| Storage | Supabase Storage (URLs firmadas) |
| Deploy | Vercel (frontend) + Railway/Render (backend) |

---

## Estructura del repositorio

```
prestamista/
├── CLAUDE.md                  ← este archivo
├── README.md
├── .gitignore
├── .env.example               ← plantilla de variables (sin valores reales)
├── session_log.jsonl          ← log append-only de sesiones
├── backend/
│   ├── app/
│   │   ├── main.py            ← FastAPI app entry point
│   │   ├── config.py          ← settings desde env vars
│   │   ├── middleware/
│   │   │   └── auth.py        ← verificación JWT Supabase (OBLIGATORIO en endpoints)
│   │   ├── routers/           ← un archivo por módulo
│   │   │   ├── clientes.py
│   │   │   ├── prestamos.py
│   │   │   ├── pagos.py
│   │   │   ├── cobros.py
│   │   │   ├── reportes.py
│   │   │   └── usuarios.py
│   │   ├── schemas/           ← Pydantic models (request/response)
│   │   ├── services/          ← lógica de negocio
│   │   │   ├── calculadora.py ← motor de préstamos (fórmulas)
│   │   │   ├── mora.py        ← job nocturno de mora
│   │   │   ├── pdf_generator.py
│   │   │   └── notificaciones.py
│   │   └── db/
│   │       └── supabase.py    ← cliente Supabase (usa SERVICE_ROLE_KEY)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/        ← componentes reutilizables
│   │   ├── pages/             ← pantallas principales
│   │   ├── stores/            ← Zustand stores
│   │   ├── hooks/             ← hooks personalizados
│   │   ├── services/          ← llamadas a la API
│   │   └── types/             ← TypeScript types/interfaces
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── db/
│   ├── migrations/
│   │   └── 001_init.sql       ← schema completo (S-01)
│   └── seeds/                 ← datos de prueba
├── n8n/
│   └── workflows/             ← JSON exports de workflows n8n
└── docs/
    └── architecture.md
```

---

## Módulos del sistema

1. **Ficha de Clientes** — CRUD + búsqueda + historial
2. **Calculadora + Motor de Préstamos** — fórmula configurable por préstamo (flat / sobre_saldo / personalizada), periodicidad mixta (diaria/semanal/quincenal/mensual)
3. **Gestión de Pagos** — total, parcial, anticipado; historial inmutable
4. **Mora Automática** — job nocturno, recargo configurable, días de gracia
5. **Cobros del Día** — lista por cobrador/zona, semáforo visual, registro con 1 toque
6. **Dashboard y KPIs** — tiempo real via Supabase Realtime
7. **Documentos PDF** — contratos, recibos, tabla amortización, reporte cartera
8. **Reportes del Negocio** — CSV exportable
9. **Usuarios y Cobradores** — roles, zonas, auditoría
10. **Notificaciones** — Telegram + Email solo al prestamista (NO a clientes)

---

## ENUMs — usar exactamente estos strings

```python
ESTADO_PRESTAMO  = ['activo', 'en_mora', 'cancelado', 'cerrado', 'pendiente_aprobacion']
ESTADO_CUOTA     = ['pendiente', 'pagada', 'mora', 'pago_parcial', 'condonada']
PERIODICIDAD     = ['diaria', 'semanal', 'quincenal', 'mensual']
TIPO_TASA        = ['flat', 'sobre_saldo', 'personalizada']
TIPO_DOCUMENTO   = ['contrato', 'recibo', 'tabla_amortizacion', 'reporte_cartera']
ROL_USUARIO      = ['admin', 'cobrador', 'solo_lectura']
CANAL_NOTIF      = ['telegram', 'email']
```

---

## Roles y permisos

| Rol | Acceso |
|-----|--------|
| `admin` | Total: config, todos los clientes/préstamos, reportes, usuarios |
| `cobrador` | Solo su lista del día + sus clientes asignados |
| `solo_lectura` | Dashboard y reportes, sin operaciones (futuro) |

---

## Schema DB — tablas principales

```
profiles · clientes · prestamos · cuotas · pagos
documentos · config_negocio · system_logs · notificaciones
```

Ver detalle completo en `db/migrations/001_init.sql`.
Ver seeds en `db/seeds/001_seed.sql` (solo dev/staging).

---

## Reglas de seguridad — NUNCA romper

1. `SUPABASE_SERVICE_ROLE_KEY` solo en backend — **nunca** en variables `VITE_`
2. Verificar JWT en **todo** endpoint protegido via `middleware/auth.py`
3. Verificar rol del usuario en endpoints de reportes y configuración
4. URLs de PDFs: usar URLs firmadas de Supabase Storage (con expiración)
5. **Soft delete siempre** — marcar `activo=false`, nunca `DELETE` en producción
6. Nunca commitear archivos `.env` reales
7. `session_log.jsonl` es **append-only** — nunca sobreescribir

---

## Convenciones de código

### Backend (Python)
- Snake_case para todo
- Pydantic v2 para schemas
- Dependencias de FastAPI para auth: `Depends(get_current_user)`
- Respuestas siempre con estructura `{"data": ..., "error": null}` o `{"data": null, "error": "msg"}`
- Logging via `logging` estándar de Python

### Frontend (TypeScript)
- PascalCase para componentes, camelCase para funciones/variables
- `services/api.ts` — cliente axios configurado con JWT
- Stores Zustand: un store por dominio (clientesStore, prestamosStore, etc.)
- TailwindCSS — no escribir CSS custom salvo casos extremos
- Mobile-first: diseñar primero para 375px, luego desktop

---

## Variables de entorno

Ver `.env.example` para la lista completa.
Las variables `VITE_` son públicas (frontend). El resto es solo backend.

---

## Plan de sesiones

| # | Fase | Título | Estado |
|---|------|--------|--------|
| S-00 | Fundación | Estructura del repo + CLAUDE.md | ✅ Completado |
| S-01 | Fundación | Migraciones SQL + RLS + seeds | ✅ Completado |
| S-02 | Fundación | Auth + Backend base (FastAPI + JWT) | ✅ Completado |
| S-03 | Core | Módulo Clientes (CRUD + búsqueda) | ✅ Completado |
| S-04 | Core | Módulo Préstamos + Calculadora | ✅ Completado |
| S-05 | Core | Módulo Pagos + Mora Automática | ✅ Completado |
| S-06 | Core | Cobros del Día + Rutas | ✅ Completado |
| S-07 | Docs | Generación de PDFs (WeasyPrint) | ✅ Completado |
| S-08 | Docs | Reportes + Panel KPIs | ✅ Completado |
| S-09 | Frontend | Base + Auth + Layout + Stores | ✅ Completado |
| S-10 | Frontend | Pantallas Clientes + Préstamos | ✅ Completado |
| S-11 | Frontend | Pantalla Cobros del Día (mobile-first) | ✅ Completado |
| S-12 | Frontend | Dashboard + Reportes UI | ✅ Completado (en S-08) |
| S-13 | Automatiz. | Notificaciones Telegram Bot + Email (n8n) | ✅ Completado |
| S-14 | Automatiz. | Job Nocturno + Backup Automático | ✅ Completado |
| S-15 | Automatiz. | Usuarios + Permisos + Cobradores | ✅ Completado |
| S-16 | Deploy | Hardening + RUNBOOK + Producción | ✅ Completado |

---

## Para iniciar una sesión nueva

1. Leer este CLAUDE.md
2. Leer `session_log.jsonl` (últimas entradas)
3. Identificar la sesión pendiente y ejecutarla
4. Al finalizar: agregar entrada a `session_log.jsonl` con lo hecho
