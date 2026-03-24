# RUNBOOK — prestamos.app

> Guía operacional completa para deploys, mantenimiento y resolución de problemas.

---

## 1. Variables de entorno

### Backend (`backend/.env`)

```env
# Supabase
SUPABASE_URL=https://obyfkrprseobehfxusdi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Settings → API → service_role>
SUPABASE_JWT_SECRET=<Dashboard → Settings → API → JWT Secret>

# App
DEBUG=false
CORS_ORIGINS=["https://tu-dominio.vercel.app","https://prestamos.app"]

# Telegram Bot (prestamista)
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_CHAT_ID=<Chat ID del prestamista — usar @userinfobot>

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=prestamista@gmail.com
SMTP_PASS=<App password de Gmail — no la contraseña normal>

# n8n (opcional — si no está configurado usa Telegram directo)
N8N_WEBHOOK_URL=https://tu-n8n.cloud/webhook/prestamos-notificaciones
```

### Frontend (`frontend/.env.local`)

```env
VITE_SUPABASE_URL=https://obyfkrprseobehfxusdi.supabase.co
VITE_SUPABASE_ANON_KEY=<Dashboard → Settings → API → anon key>
VITE_API_URL=https://tu-backend.railway.app
```

---

## 2. Deploy — Backend (Railway)

### Primera vez

1. Crear proyecto en [Railway](https://railway.app)
2. Conectar repositorio GitHub → seleccionar carpeta `backend/`
3. Railway detecta el `Dockerfile` automáticamente
4. En Variables de entorno, cargar todas las de `backend/.env`
5. El deploy se activa automáticamente

### Deploy manual

```bash
# Desde la raíz del repo
cd backend
railway up
```

### Verificar

```bash
curl https://tu-backend.railway.app/health
# → {"status":"ok","version":"0.8.0","scheduler_jobs":[...]}
```

---

## 3. Deploy — Frontend (Vercel)

### Primera vez

1. Importar proyecto en [Vercel](https://vercel.com)
2. Framework Preset: **Vite**
3. Root Directory: `frontend/`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Variables de entorno: cargar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
7. Deploy

### Deploy manual

```bash
cd frontend
vercel --prod
```

---

## 4. Base de datos — Supabase

### Aplicar migraciones

```bash
# Via Supabase CLI (requiere link al proyecto)
supabase db push

# O via MCP (Claude Code)
# Usar la herramienta apply_migration del MCP de Supabase
```

### Backup manual

```bash
# Via endpoint admin (requiere token JWT admin)
curl -X POST https://tu-backend.railway.app/usuarios/admin/backup \
  -H "Authorization: Bearer <JWT_ADMIN>"

# Ver backups disponibles
curl https://tu-backend.railway.app/usuarios/admin/backup \
  -H "Authorization: Bearer <JWT_ADMIN>"
```

### Backup automático
El scheduler ejecuta backup todos los domingos a las 02:00 (timezone Buenos Aires).
Los backups se guardan en el bucket `backups` de Supabase Storage.
Se conservan los últimos 30 archivos por tabla.

---

## 5. Usuarios — Gestión

### Crear usuario admin inicial

```sql
-- En Supabase Dashboard → SQL Editor
-- Primero crear en Auth (via Dashboard → Authentication → Users → Invite)
-- Luego actualizar su rol:
UPDATE profiles SET rol = 'admin' WHERE email = 'admin@prestamos.app';
```

### Credenciales de prueba (seeds)

| Email | Password | Rol |
|-------|----------|-----|
| admin@prestamos.app | Admin1234! | admin |
| carlos@prestamos.app | Carlos1234! | cobrador |
| maria@prestamos.app | Maria1234! | cobrador |

> ⚠️ Cambiar estas contraseñas antes de producción.

---

## 6. Scheduler — Jobs nocturnos

| Job | Horario | Función |
|-----|---------|---------|
| mora | 00:30 diario | Detecta cuotas vencidas, aplica recargo, marca en_mora |
| alertas_manana | 20:00 diario | Notifica cuotas que vencen al día siguiente (D-1) |
| cierre_dia | 23:00 diario | Resumen del día vía Telegram |
| notificaciones | Cada 5 min | Procesa notificaciones pendientes en tabla |
| backup_semanal | Dom 02:00 | Backup de tablas críticas a Storage |

### Disparar mora manualmente

```bash
curl -X POST https://tu-backend.railway.app/cobros/mora/procesar \
  -H "Authorization: Bearer <JWT_ADMIN>"
```

---

## 7. Telegram Bot — Configuración

1. Crear bot con `@BotFather` → `/newbot` → copiar token
2. Escribirle un mensaje al bot (para activar el chat)
3. Obtener chat ID: escribirle a `@userinfobot` o visitar:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Configurar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en `.env`

---

## 8. n8n — Configuración del workflow

1. Importar `n8n/workflows/notificaciones_prestamos.json` en tu instancia de n8n
2. Configurar credential **Telegram Bot** con el bot token
3. Crear variable de entorno `TELEGRAM_CHAT_ID` en n8n
4. Activar el workflow
5. Copiar la URL del webhook y setear `N8N_WEBHOOK_URL` en el backend

---

## 9. Resolución de problemas

### Backend no arranca

```bash
# Ver logs de Railway
railway logs --tail

# Verificar variables de entorno
railway variables
```

### Error "Supabase client not initialized"

- Verificar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en las variables de entorno
- Asegurarse de que no hay espacios extras en los valores

### JWT inválido / 401 en endpoints

- Si `SUPABASE_JWT_SECRET` está vacío, el sistema usa la API de Supabase como fallback (más lento pero funcional)
- Para modo local: obtener el JWT Secret en Dashboard → Settings → API → JWT Settings

### WeasyPrint falla generando PDFs

```bash
# El Dockerfile ya incluye las dependencias. Si hay error en prod:
apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf2.0-0
```

### Notificaciones Telegram no llegan

1. Verificar que `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están configurados
2. Probar directamente: `GET /health` → ver scheduler_jobs
3. Ver logs del job `notificaciones`
4. Verificar tabla `notificaciones` en Supabase: `SELECT * FROM notificaciones ORDER BY created_at DESC LIMIT 10`

### Backup falla

- Verificar que el bucket `backups` existe en Supabase Storage (se crea automáticamente)
- Verificar que `SERVICE_ROLE_KEY` tiene permisos de Storage

---

## 10. Monitoreo

### Health check

```bash
curl https://tu-backend.railway.app/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "version": "0.8.0",
  "scheduler_jobs": [
    {"id": "mora", "next_run": "2026-03-25 00:30:00"},
    {"id": "alertas_manana", "next_run": "2026-03-24 20:00:00"},
    {"id": "cierre_dia", "next_run": "2026-03-24 23:00:00"},
    {"id": "notificaciones", "next_run": "2026-03-24 12:05:00"},
    {"id": "backup_semanal", "next_run": "2026-03-29 02:00:00"}
  ]
}
```

### KPIs en tiempo real

```bash
curl https://tu-backend.railway.app/reportes/kpis \
  -H "Authorization: Bearer <JWT>"
```

### Logs de auditoría

```bash
curl https://tu-backend.railway.app/usuarios/audit-log \
  -H "Authorization: Bearer <JWT_ADMIN>"
```

---

## 11. Checklist pre-producción

- [ ] Cambiar contraseñas de los usuarios seed
- [ ] Configurar `DEBUG=false` en backend
- [ ] Configurar `CORS_ORIGINS` con el dominio real del frontend
- [ ] Configurar Telegram Bot Token y Chat ID
- [ ] Verificar que WeasyPrint genera PDFs correctamente
- [ ] Probar flujo completo: crear cliente → préstamo → cobro → recibo PDF
- [ ] Verificar que el job de mora corre correctamente (POST /cobros/mora/procesar)
- [ ] Configurar n8n o verificar fallback directo de Telegram
- [ ] Hacer backup inicial manual
- [ ] Verificar health check del backend
- [ ] Revocar o cambiar el `SUPABASE_SERVICE_ROLE_KEY` de desarrollo
