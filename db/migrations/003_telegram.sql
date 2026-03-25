-- =============================================================
-- 003_telegram.sql — Soporte para Telegram Bot (clientes + cobradores)
-- Ejecutar en Supabase SQL Editor del proyecto obyfkrprseobehfxusdi
-- =============================================================

-- -------------------------
-- 1. telegram_chat_id en clientes
--    El bot lo setea cuando el cliente envía /vincular <DNI>
-- -------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT UNIQUE;

COMMENT ON COLUMN public.clientes.telegram_chat_id IS
  'Chat ID de Telegram del cliente (seteado vía bot al enviar /vincular <DNI>)';

-- -------------------------
-- 2. telegram_chat_id en profiles (cobradores y admins)
--    El admin lo asigna manualmente en Usuarios, o el cobrador usa /vincular en el bot
-- -------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT UNIQUE;

COMMENT ON COLUMN public.profiles.telegram_chat_id IS
  'Chat ID de Telegram del cobrador/admin — recibe lista del día y alertas';

-- -------------------------
-- 3. Índices para lookup rápido por chat_id
-- -------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_telegram
  ON public.clientes (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram
  ON public.profiles (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- -------------------------
-- 4. RLS: clientes.telegram_chat_id
--    Admins pueden leer/escribir. Cobradores solo en sus clientes.
--    (Las políticas existentes ya cubren esto — no hace falta nueva política
--     porque el campo es parte de la tabla clientes que ya tiene RLS.)
-- -------------------------

-- -------------------------
-- 5. Función helper: buscar cliente por telegram_chat_id
--    Usada internamente por el backend (service role, no RLS)
-- -------------------------
CREATE OR REPLACE FUNCTION public.get_cliente_by_telegram(p_chat_id TEXT)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  dni TEXT,
  telefono TEXT,
  zona TEXT
) AS $$
  SELECT id, nombre, dni, telefono, zona
  FROM public.clientes
  WHERE telegram_chat_id = p_chat_id
    AND activo = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -------------------------
-- 6. Función helper: préstamos activos del cliente
-- -------------------------
CREATE OR REPLACE FUNCTION public.get_prestamos_activos_cliente(p_cliente_id UUID)
RETURNS TABLE (
  id UUID,
  monto NUMERIC,
  saldo_pendiente NUMERIC,
  estado TEXT,
  n_cuotas INTEGER,
  periodicidad TEXT
) AS $$
  SELECT id, monto, saldo_pendiente, estado::TEXT, n_cuotas, periodicidad::TEXT
  FROM public.prestamos
  WHERE cliente_id = p_cliente_id
    AND estado IN ('activo', 'en_mora')
    AND activo = true
  ORDER BY created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
