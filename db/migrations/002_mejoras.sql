-- =============================================================
-- 002_mejoras.sql — Mejoras S-17
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- ─────────────────────────────────────────────────
-- 1. Foto de cliente
-- ─────────────────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN public.clientes.foto_url IS 'URL pública de la foto del cliente en Supabase Storage';

-- ─────────────────────────────────────────────────
-- 2. Tasa de mora por préstamo (sobreescribe config global)
-- ─────────────────────────────────────────────────
ALTER TABLE public.prestamos
  ADD COLUMN IF NOT EXISTS tasa_mora_diaria NUMERIC(8, 4);

COMMENT ON COLUMN public.prestamos.tasa_mora_diaria IS 'Tasa de mora diaria específica para este préstamo. NULL = usa config_negocio global.';

-- ─────────────────────────────────────────────────
-- 3. Portal del deudor — token firmado
-- ─────────────────────────────────────────────────
ALTER TABLE public.prestamos
  ADD COLUMN IF NOT EXISTS portal_token      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_token_exp  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prestamos_portal_token ON public.prestamos (portal_token)
  WHERE portal_token IS NOT NULL;

COMMENT ON COLUMN public.prestamos.portal_token     IS 'Token único para el portal del deudor (acceso sin login)';
COMMENT ON COLUMN public.prestamos.portal_token_exp IS 'Expiración del token de portal (30 días por defecto)';

-- ─────────────────────────────────────────────────
-- 4. Refinanciación — traza el origen del préstamo
-- ─────────────────────────────────────────────────
ALTER TABLE public.prestamos
  ADD COLUMN IF NOT EXISTS refinanciado_de UUID REFERENCES public.prestamos(id);

COMMENT ON COLUMN public.prestamos.refinanciado_de IS 'ID del préstamo original que fue refinanciado. NULL = préstamo nuevo.';

-- ─────────────────────────────────────────────────
-- 5. Bucket de Storage para fotos de clientes
--    (ejecutar también en Dashboard > Storage > New bucket)
--    Nombre: cliente-fotos | Public: true
-- ─────────────────────────────────────────────────
-- No se puede crear buckets via SQL — hacerlo manualmente en el dashboard
-- o via Supabase Management API.
