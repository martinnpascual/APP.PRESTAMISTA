-- =============================================================
-- 002_cobros.sql — Cobros del Día + Rutas
-- S-06: Vista v_cobros_pendientes + Tabla visitas
-- =============================================================


-- -------------------------
-- 1. Vista: cobros pendientes
--    Extiende v_cobros_hoy para incluir cuotas vencidas de días anteriores.
--    Agrega: semáforo visual, total_a_cobrar, dias_atraso.
-- -------------------------
CREATE OR REPLACE VIEW public.v_cobros_pendientes AS
SELECT
  cu.id                                                        AS cuota_id,
  cu.prestamo_id,
  cu.numero,
  cu.fecha_vencimiento,
  cu.monto,
  cu.monto_pagado,
  COALESCE(cu.recargo_mora, 0)                                 AS recargo_mora,
  COALESCE(cu.dias_mora, 0)                                    AS dias_mora,
  cu.estado,

  -- Semáforo visual para la UI mobile
  CASE
    WHEN cu.estado = 'mora'                              THEN 'rojo'
    WHEN cu.fecha_vencimiento < CURRENT_DATE             THEN 'naranja'
    WHEN cu.estado = 'pago_parcial'                      THEN 'naranja'
    ELSE                                                      'amarillo'
  END                                                          AS semaforo,

  -- Total exacto que se debe cobrar hoy (saldo + recargo)
  ROUND(
    cu.monto - cu.monto_pagado + COALESCE(cu.recargo_mora, 0),
    2
  )                                                            AS total_a_cobrar,

  -- Días de atraso desde el vencimiento (0 si vence hoy)
  GREATEST(0, (CURRENT_DATE - cu.fecha_vencimiento)::int)      AS dias_atraso,

  c.id                                                         AS cliente_id,
  c.nombre                                                     AS cliente_nombre,
  c.telefono,
  c.direccion,
  c.zona,
  pr.cobrador_id,
  pr.periodicidad,
  pr.monto                                                     AS prestamo_monto

FROM public.cuotas cu
JOIN public.prestamos pr ON pr.id  = cu.prestamo_id
JOIN public.clientes   c  ON c.id  = pr.cliente_id

WHERE cu.estado              IN ('pendiente', 'pago_parcial', 'mora')
  AND cu.fecha_vencimiento   <= CURRENT_DATE   -- hoy y días anteriores sin cobrar
  AND pr.activo               = true
  AND c.activo                = true

ORDER BY
  CASE WHEN cu.estado = 'mora' THEN 0
       WHEN cu.fecha_vencimiento < CURRENT_DATE THEN 1
       ELSE 2
  END,
  cu.fecha_vencimiento,
  c.zona,
  c.nombre;

COMMENT ON VIEW public.v_cobros_pendientes
  IS 'Cuotas pendientes de cobro: hoy + vencidas anteriores. Incluye semáforo y total_a_cobrar.';


-- -------------------------
-- 2. Tabla: visitas
--    Registro de visitas a clientes por parte del cobrador.
--    Inmutable: no UPDATE, no DELETE.
-- -------------------------
CREATE TABLE IF NOT EXISTS public.visitas (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuota_id    UUID        NOT NULL REFERENCES public.cuotas(id) ON DELETE RESTRICT,
  cobrador_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  fecha       DATE        NOT NULL DEFAULT CURRENT_DATE,
  hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resultado   TEXT        NOT NULL,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT visitas_resultado_check
    CHECK (resultado IN ('cobrado', 'sin_pago', 'ausente', 'promesa_pago'))
);

COMMENT ON TABLE public.visitas
  IS 'Registro inmutable de visitas del cobrador. Resultado: cobrado/sin_pago/ausente/promesa_pago.';

CREATE INDEX IF NOT EXISTS idx_visitas_cuota     ON public.visitas (cuota_id);
CREATE INDEX IF NOT EXISTS idx_visitas_cobrador  ON public.visitas (cobrador_id);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha     ON public.visitas (fecha);
CREATE INDEX IF NOT EXISTS idx_visitas_resultado ON public.visitas (resultado);


-- -------------------------
-- 3. RLS: visitas
-- -------------------------
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Admin y solo_lectura ven todo
CREATE POLICY visitas_select ON public.visitas
  FOR SELECT USING (
    is_admin()
    OR get_user_rol() = 'solo_lectura'
    OR cobrador_id = auth.uid()
  );

-- El cobrador solo puede insertar sus propias visitas
CREATE POLICY visitas_insert ON public.visitas
  FOR INSERT WITH CHECK (
    cobrador_id = auth.uid()
    OR is_admin()
  );

-- Inmutable: bloquear UPDATE y DELETE
CREATE POLICY visitas_update ON public.visitas
  FOR UPDATE USING (false);

CREATE POLICY visitas_delete ON public.visitas
  FOR DELETE USING (false);
