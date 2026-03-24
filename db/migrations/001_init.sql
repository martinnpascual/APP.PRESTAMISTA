-- =============================================================
-- 001_init.sql — Schema completo de prestamos.app
-- Ejecutar en Supabase SQL Editor (o via MCP apply_migration)
-- Orden: ENUMs → Funciones helpers → Tablas → Índices → Triggers
--        → RLS enable → Políticas RLS
-- =============================================================

-- -------------------------
-- 0. Extensiones
-- -------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- búsqueda fuzzy por nombre/DNI


-- -------------------------
-- 1. ENUMs
-- -------------------------
DO $$ BEGIN
  CREATE TYPE estado_prestamo_enum AS ENUM (
    'activo', 'en_mora', 'cancelado', 'cerrado', 'pendiente_aprobacion'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_cuota_enum AS ENUM (
    'pendiente', 'pagada', 'mora', 'pago_parcial', 'condonada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE periodicidad_enum AS ENUM (
    'diaria', 'semanal', 'quincenal', 'mensual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_tasa_enum AS ENUM (
    'flat', 'sobre_saldo', 'personalizada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_documento_enum AS ENUM (
    'contrato', 'recibo', 'tabla_amortizacion', 'reporte_cartera'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rol_usuario_enum AS ENUM (
    'admin', 'cobrador', 'solo_lectura'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE canal_notif_enum AS ENUM (
    'telegram', 'email'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- -------------------------
-- 2. Función updated_at (trigger helper)
-- -------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -------------------------
-- 3. Funciones de rol (usadas en RLS)
-- -------------------------
-- Retorna el rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS rol_usuario_enum AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna la zona del cobrador autenticado
CREATE OR REPLACE FUNCTION get_user_zona()
RETURNS text AS $$
  SELECT zona FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica si el usuario autenticado es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica si el usuario autenticado es cobrador
CREATE OR REPLACE FUNCTION is_cobrador()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'cobrador'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- -------------------------
-- 4. TABLA: profiles
-- Extiende auth.users de Supabase Auth
-- -------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL,
  rol           rol_usuario_enum NOT NULL DEFAULT 'cobrador',
  zona          TEXT,                   -- zona asignada (para cobradores)
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfil de usuario del sistema (admin o cobrador)';
COMMENT ON COLUMN public.profiles.zona IS 'Zona asignada al cobrador. NULL para admin.';

-- Trigger: crear perfil automáticamente al registrar usuario en auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario_enum, 'cobrador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------
-- 5. TABLA: clientes
-- -------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  dni           TEXT UNIQUE NOT NULL,
  telefono      TEXT NOT NULL,
  direccion     TEXT NOT NULL,
  zona          TEXT NOT NULL,
  notas         TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.clientes IS 'Ficha de cada cliente del prestamista';

-- Índices para búsqueda instantánea
CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm  ON public.clientes USING GIN (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_dni          ON public.clientes (dni);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono     ON public.clientes (telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_zona         ON public.clientes (zona);
CREATE INDEX IF NOT EXISTS idx_clientes_activo       ON public.clientes (activo);

CREATE TRIGGER set_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------
-- 6. TABLA: prestamos
-- -------------------------
CREATE TABLE IF NOT EXISTS public.prestamos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id          UUID NOT NULL REFERENCES public.clientes(id),
  cobrador_id         UUID REFERENCES public.profiles(id),  -- NULL = admin lo gestiona
  monto               NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  tasa                NUMERIC(8, 4) NOT NULL CHECK (tasa >= 0),  -- porcentaje, ej: 10.5
  tipo_tasa           tipo_tasa_enum NOT NULL,
  periodicidad        periodicidad_enum NOT NULL,
  n_cuotas            INTEGER NOT NULL CHECK (n_cuotas > 0),
  monto_cuota         NUMERIC(12, 2) NOT NULL CHECK (monto_cuota > 0),  -- calculado
  monto_total         NUMERIC(12, 2) NOT NULL,  -- total a pagar (capital + intereses)
  saldo_pendiente     NUMERIC(12, 2) NOT NULL,  -- recalculado tras cada pago
  estado              estado_prestamo_enum NOT NULL DEFAULT 'pendiente_aprobacion',
  fecha_inicio        DATE NOT NULL,
  fecha_fin_estimada  DATE NOT NULL,
  notas               TEXT,
  activo              BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID NOT NULL REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.prestamos IS 'Préstamo individual con su configuración de tasa y periodicidad';
COMMENT ON COLUMN public.prestamos.saldo_pendiente IS 'Se recalcula automáticamente tras cada pago registrado';

CREATE INDEX IF NOT EXISTS idx_prestamos_cliente     ON public.prestamos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_cobrador    ON public.prestamos (cobrador_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado      ON public.prestamos (estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_activo      ON public.prestamos (activo);
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha       ON public.prestamos (fecha_inicio);

CREATE TRIGGER set_prestamos_updated_at
  BEFORE UPDATE ON public.prestamos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------
-- 7. TABLA: cuotas
-- -------------------------
CREATE TABLE IF NOT EXISTS public.cuotas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestamo_id       UUID NOT NULL REFERENCES public.prestamos(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL CHECK (numero > 0),
  fecha_vencimiento DATE NOT NULL,
  monto             NUMERIC(12, 2) NOT NULL,   -- cuota original
  monto_pagado      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estado            estado_cuota_enum NOT NULL DEFAULT 'pendiente',
  dias_mora         INTEGER NOT NULL DEFAULT 0,
  recargo_mora      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prestamo_id, numero)
);

COMMENT ON TABLE public.cuotas IS 'Calendario de cuotas generado al crear el préstamo';
COMMENT ON COLUMN public.cuotas.recargo_mora IS 'Calculado por job nocturno: dias_mora × tasa_mora_diaria × saldo';

CREATE INDEX IF NOT EXISTS idx_cuotas_prestamo       ON public.cuotas (prestamo_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_vencimiento    ON public.cuotas (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado         ON public.cuotas (estado);
-- Índice para job nocturno de mora (cuotas vencidas pendientes)
CREATE INDEX IF NOT EXISTS idx_cuotas_mora_job       ON public.cuotas (estado, fecha_vencimiento)
  WHERE estado IN ('pendiente', 'pago_parcial');

CREATE TRIGGER set_cuotas_updated_at
  BEFORE UPDATE ON public.cuotas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------
-- 8. TABLA: pagos
-- Historial inmutable — NO hacer UPDATE ni DELETE
-- -------------------------
CREATE TABLE IF NOT EXISTS public.pagos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuota_id        UUID NOT NULL REFERENCES public.cuotas(id),
  prestamo_id     UUID NOT NULL REFERENCES public.prestamos(id),
  cliente_id      UUID NOT NULL REFERENCES public.clientes(id),
  monto           NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  fecha_pago      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo          TEXT NOT NULL DEFAULT 'efectivo',  -- efectivo, transferencia, etc.
  registrado_por  UUID NOT NULL REFERENCES public.profiles(id),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SIN updated_at: registro inmutable
);

COMMENT ON TABLE public.pagos IS 'Historial inmutable de pagos. Nunca hacer UPDATE ni DELETE.';

CREATE INDEX IF NOT EXISTS idx_pagos_cuota       ON public.pagos (cuota_id);
CREATE INDEX IF NOT EXISTS idx_pagos_prestamo    ON public.pagos (prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente     ON public.pagos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha       ON public.pagos (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_cobrador    ON public.pagos (registrado_por);


-- Trigger: actualizar saldo_pendiente del préstamo tras insertar un pago
CREATE OR REPLACE FUNCTION actualizar_saldo_prestamo()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.prestamos
  SET saldo_pendiente = saldo_pendiente - NEW.monto
  WHERE id = NEW.prestamo_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_pago_insert
  AFTER INSERT ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION actualizar_saldo_prestamo();


-- -------------------------
-- 9. TABLA: documentos
-- -------------------------
CREATE TABLE IF NOT EXISTS public.documentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestamo_id   UUID REFERENCES public.prestamos(id),
  pago_id       UUID REFERENCES public.pagos(id),
  tipo          tipo_documento_enum NOT NULL,
  storage_path  TEXT NOT NULL,    -- path en Supabase Storage
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.documentos IS 'Registro de PDFs generados. URLs firmadas se generan on-demand.';

CREATE INDEX IF NOT EXISTS idx_documentos_prestamo  ON public.documentos (prestamo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_pago      ON public.documentos (pago_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo      ON public.documentos (tipo);


-- -------------------------
-- 10. TABLA: config_negocio
-- Fila única (singleton)
-- -------------------------
CREATE TABLE IF NOT EXISTS public.config_negocio (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_negocio    TEXT NOT NULL DEFAULT 'prestamos.app',
  moneda            TEXT NOT NULL DEFAULT 'ARS',
  tasa_mora_diaria  NUMERIC(8, 4) NOT NULL DEFAULT 0.10,  -- % diario
  dias_gracia       INTEGER NOT NULL DEFAULT 3,
  telegram_chat_id  TEXT,
  updated_by        UUID REFERENCES public.profiles(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.config_negocio IS 'Configuración global del negocio. Solo una fila.';
COMMENT ON COLUMN public.config_negocio.tasa_mora_diaria IS 'Porcentaje diario de recargo por mora. Ej: 0.10 = 0.10% diario';
COMMENT ON COLUMN public.config_negocio.dias_gracia IS 'Días después del vencimiento antes de aplicar mora';

-- Insertar configuración inicial si no existe
INSERT INTO public.config_negocio (nombre_negocio, moneda, tasa_mora_diaria, dias_gracia)
SELECT 'prestamos.app', 'ARS', 0.10, 3
WHERE NOT EXISTS (SELECT 1 FROM public.config_negocio);

CREATE TRIGGER set_config_updated_at
  BEFORE UPDATE ON public.config_negocio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------
-- 11. TABLA: system_logs (auditoría)
-- -------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id               BIGSERIAL PRIMARY KEY,
  usuario_id       UUID REFERENCES public.profiles(id),
  accion           TEXT NOT NULL,   -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc.
  tabla            TEXT,
  registro_id      TEXT,            -- UUID del registro afectado
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  ip               TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.system_logs IS 'Log de auditoría append-only. Nunca UPDATE ni DELETE.';

CREATE INDEX IF NOT EXISTS idx_logs_usuario    ON public.system_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_tabla      ON public.system_logs (tabla);
CREATE INDEX IF NOT EXISTS idx_logs_fecha      ON public.system_logs (created_at DESC);


-- -------------------------
-- 12. TABLA: notificaciones
-- -------------------------
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo          TEXT NOT NULL,         -- 'mora', 'vencimiento_manana', 'cierre_dia', 'reporte_semanal', 'manual'
  canal         canal_notif_enum NOT NULL,
  destinatario  TEXT NOT NULL,         -- chat_id o email del prestamista
  asunto        TEXT,
  cuerpo        TEXT NOT NULL,
  enviado       BOOLEAN NOT NULL DEFAULT false,
  enviado_at    TIMESTAMPTZ,
  error         TEXT,                  -- mensaje de error si falló
  cliente_id    UUID REFERENCES public.clientes(id),
  prestamo_id   UUID REFERENCES public.prestamos(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notificaciones IS 'Cola de notificaciones. Destinatario siempre es el prestamista.';

CREATE INDEX IF NOT EXISTS idx_notif_enviado   ON public.notificaciones (enviado, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_tipo      ON public.notificaciones (tipo);


-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_negocio  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones  ENABLE ROW LEVEL SECURITY;


-- ===========================
-- RLS: profiles
-- ===========================
-- Cada usuario ve su propio perfil; admin ve todos
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR is_admin()
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR is_admin()
  );

-- Solo admin puede insertar/eliminar perfiles directamente
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (is_admin());

-- No se permite DELETE (soft delete via activo=false)
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE USING (false);


-- ===========================
-- RLS: clientes
-- ===========================
-- Admin: todos los clientes
-- Cobrador: clientes con préstamos asignados a él
-- Solo lectura: todos (read-only)

CREATE POLICY clientes_select ON public.clientes
  FOR SELECT USING (
    activo = true AND (
      is_admin()
      OR get_user_rol() = 'solo_lectura'
      OR EXISTS (
        SELECT 1 FROM public.prestamos p
        WHERE p.cliente_id = clientes.id
          AND p.cobrador_id = auth.uid()
          AND p.activo = true
      )
    )
  );

CREATE POLICY clientes_insert ON public.clientes
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY clientes_update ON public.clientes
  FOR UPDATE USING (is_admin());

-- No DELETE — soft delete via activo=false
CREATE POLICY clientes_delete ON public.clientes
  FOR DELETE USING (false);


-- ===========================
-- RLS: prestamos
-- ===========================
CREATE POLICY prestamos_select ON public.prestamos
  FOR SELECT USING (
    activo = true AND (
      is_admin()
      OR get_user_rol() = 'solo_lectura'
      OR cobrador_id = auth.uid()
    )
  );

CREATE POLICY prestamos_insert ON public.prestamos
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY prestamos_update ON public.prestamos
  FOR UPDATE USING (
    is_admin()
    OR cobrador_id = auth.uid()  -- cobrador puede actualizar estado/notas
  );

CREATE POLICY prestamos_delete ON public.prestamos
  FOR DELETE USING (false);


-- ===========================
-- RLS: cuotas
-- ===========================
CREATE POLICY cuotas_select ON public.cuotas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = cuotas.prestamo_id AND (
        is_admin()
        OR get_user_rol() = 'solo_lectura'
        OR p.cobrador_id = auth.uid()
      )
    )
  );

CREATE POLICY cuotas_insert ON public.cuotas
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY cuotas_update ON public.cuotas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = cuotas.prestamo_id AND (
        is_admin()
        OR p.cobrador_id = auth.uid()
      )
    )
  );

CREATE POLICY cuotas_delete ON public.cuotas
  FOR DELETE USING (false);


-- ===========================
-- RLS: pagos
-- ===========================
CREATE POLICY pagos_select ON public.pagos
  FOR SELECT USING (
    is_admin()
    OR get_user_rol() = 'solo_lectura'
    OR registrado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = pagos.prestamo_id AND p.cobrador_id = auth.uid()
    )
  );

-- Cobrador puede insertar pagos de sus clientes
CREATE POLICY pagos_insert ON public.pagos
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      registrado_por = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.prestamos p
        WHERE p.id = prestamo_id AND p.cobrador_id = auth.uid()
      )
    )
  );

-- Pagos son inmutables — no UPDATE ni DELETE
CREATE POLICY pagos_update ON public.pagos
  FOR UPDATE USING (false);

CREATE POLICY pagos_delete ON public.pagos
  FOR DELETE USING (false);


-- ===========================
-- RLS: documentos
-- ===========================
CREATE POLICY documentos_select ON public.documentos
  FOR SELECT USING (
    activo = true AND (
      is_admin()
      OR get_user_rol() = 'solo_lectura'
      OR EXISTS (
        SELECT 1 FROM public.prestamos p
        WHERE p.id = documentos.prestamo_id AND p.cobrador_id = auth.uid()
      )
    )
  );

CREATE POLICY documentos_insert ON public.documentos
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY documentos_update ON public.documentos
  FOR UPDATE USING (is_admin());

CREATE POLICY documentos_delete ON public.documentos
  FOR DELETE USING (false);


-- ===========================
-- RLS: config_negocio
-- ===========================
-- Solo admin puede leer y modificar configuración
CREATE POLICY config_select ON public.config_negocio
  FOR SELECT USING (is_admin());

CREATE POLICY config_update ON public.config_negocio
  FOR UPDATE USING (is_admin());

CREATE POLICY config_insert ON public.config_negocio
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY config_delete ON public.config_negocio
  FOR DELETE USING (false);


-- ===========================
-- RLS: system_logs
-- ===========================
-- Solo admin puede leer logs; el backend (service_role) inserta
CREATE POLICY logs_select ON public.system_logs
  FOR SELECT USING (is_admin());

CREATE POLICY logs_insert ON public.system_logs
  FOR INSERT WITH CHECK (true);  -- backend usa service_role, bypassa RLS

CREATE POLICY logs_update ON public.system_logs
  FOR UPDATE USING (false);

CREATE POLICY logs_delete ON public.system_logs
  FOR DELETE USING (false);


-- ===========================
-- RLS: notificaciones
-- ===========================
-- Solo admin ve notificaciones; backend inserta con service_role
CREATE POLICY notif_select ON public.notificaciones
  FOR SELECT USING (is_admin());

CREATE POLICY notif_insert ON public.notificaciones
  FOR INSERT WITH CHECK (true);  -- backend usa service_role

CREATE POLICY notif_update ON public.notificaciones
  FOR UPDATE USING (true);  -- backend marca enviado=true

CREATE POLICY notif_delete ON public.notificaciones
  FOR DELETE USING (false);


-- =============================================================
-- VISTAS útiles
-- =============================================================

-- Vista: estado consolidado por cliente
CREATE OR REPLACE VIEW public.v_clientes_deuda AS
SELECT
  c.id,
  c.nombre,
  c.dni,
  c.telefono,
  c.zona,
  COUNT(DISTINCT p.id) FILTER (WHERE p.estado = 'activo')     AS prestamos_activos,
  COUNT(DISTINCT p.id) FILTER (WHERE p.estado = 'en_mora')    AS prestamos_en_mora,
  COALESCE(SUM(p.saldo_pendiente) FILTER (WHERE p.activo), 0) AS total_adeudado
FROM public.clientes c
LEFT JOIN public.prestamos p ON p.cliente_id = c.id
WHERE c.activo = true
GROUP BY c.id, c.nombre, c.dni, c.telefono, c.zona;

COMMENT ON VIEW public.v_clientes_deuda IS 'Vista consolidada: deuda total por cliente';


-- Vista: cobros del día
CREATE OR REPLACE VIEW public.v_cobros_hoy AS
SELECT
  cu.id           AS cuota_id,
  cu.prestamo_id,
  cu.numero,
  cu.fecha_vencimiento,
  cu.monto,
  cu.monto_pagado,
  cu.estado,
  cu.recargo_mora,
  c.id            AS cliente_id,
  c.nombre        AS cliente_nombre,
  c.telefono,
  c.direccion,
  c.zona,
  pr.cobrador_id,
  pr.periodicidad
FROM public.cuotas cu
JOIN public.prestamos pr ON pr.id = cu.prestamo_id
JOIN public.clientes c   ON c.id = pr.cliente_id
WHERE cu.fecha_vencimiento = CURRENT_DATE
  AND cu.estado IN ('pendiente', 'pago_parcial', 'mora')
  AND pr.activo = true
  AND c.activo = true
ORDER BY c.zona, c.nombre;

COMMENT ON VIEW public.v_cobros_hoy IS 'Lista del día: cuotas que vencen hoy, ordenadas por zona';


-- Vista: KPIs para dashboard
CREATE OR REPLACE VIEW public.v_kpis AS
SELECT
  -- Capital total prestado (préstamos activos)
  COALESCE(SUM(monto) FILTER (WHERE estado IN ('activo','en_mora')), 0)       AS capital_total_prestado,
  -- Saldo pendiente total
  COALESCE(SUM(saldo_pendiente) FILTER (WHERE estado IN ('activo','en_mora')), 0) AS saldo_total_pendiente,
  -- Clientes en mora
  COUNT(DISTINCT cliente_id) FILTER (WHERE estado = 'en_mora')                AS clientes_en_mora,
  -- Monto en mora
  COALESCE(SUM(saldo_pendiente) FILTER (WHERE estado = 'en_mora'), 0)         AS monto_en_mora,
  -- Préstamos activos
  COUNT(*) FILTER (WHERE estado = 'activo')                                   AS prestamos_activos
FROM public.prestamos
WHERE activo = true;

COMMENT ON VIEW public.v_kpis IS 'KPIs para el dashboard principal';
