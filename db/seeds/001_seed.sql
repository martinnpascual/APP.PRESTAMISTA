-- =============================================================
-- 001_seed.sql — Datos de prueba para desarrollo
-- ⚠️  SOLO ejecutar en entorno local/staging. NUNCA en producción.
-- =============================================================
-- Orden de inserción:
--   1. Usuarios en auth.users (Supabase los crea con sus UUIDs)
--   2. profiles (el trigger handle_new_user los crea automáticamente,
--      pero aquí los sobreescribimos para seed controlado)
--   3. config_negocio
--   4. clientes
--   5. prestamos + cuotas
--   6. pagos (algunos ya pagados)
-- =============================================================

BEGIN;

-- -------------------------
-- 1. UUIDs fijos para seeds
-- -------------------------
-- admin:    a0000000-0000-0000-0000-000000000001
-- cobrador: c0000000-0000-0000-0000-000000000001

-- Nota: en Supabase, los usuarios en auth.users se crean via Dashboard
-- o via Admin API. Este seed asume que los UUIDs ya existen.
-- Para tests locales, insertar directamente en auth.users (solo en local).

-- -------------------------
-- 2. Profiles de prueba
-- -------------------------
INSERT INTO public.profiles (id, nombre, email, rol, zona, activo)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Admin Principal',
    'admin@prestamos.app',
    'admin',
    NULL,
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000001',
    'Carlos Cobrador',
    'carlos@prestamos.app',
    'cobrador',
    'Zona Norte',
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Maria Cobradora',
    'maria@prestamos.app',
    'cobrador',
    'Zona Sur',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  rol    = EXCLUDED.rol,
  zona   = EXCLUDED.zona;


-- -------------------------
-- 3. Config del negocio
-- -------------------------
UPDATE public.config_negocio
SET
  nombre_negocio   = 'Préstamos Don Juan',
  moneda           = 'ARS',
  tasa_mora_diaria = 0.10,
  dias_gracia      = 3;


-- -------------------------
-- 4. Clientes de prueba
-- -------------------------
INSERT INTO public.clientes (id, nombre, dni, telefono, direccion, zona, created_by)
VALUES
  (
    'c1000001-0000-0000-0000-000000000001',
    'Roberto Gomez',
    '20123456',
    '1133445566',
    'Av. San Martin 1234',
    'Zona Norte',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c1000001-0000-0000-0000-000000000002',
    'Silvia Fernandez',
    '27654321',
    '1144556677',
    'Calle 9 de Julio 567',
    'Zona Norte',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c1000001-0000-0000-0000-000000000003',
    'Miguel Torres',
    '30789012',
    '1155667788',
    'Belgrano 890',
    'Zona Sur',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c1000001-0000-0000-0000-000000000004',
    'Ana Perez',
    '23456789',
    '1166778899',
    'Rivadavia 2345',
    'Zona Sur',
    'a0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;


-- -------------------------
-- 5a. Préstamo activo — Roberto Gómez
-- $50.000, tasa flat 10%, 12 cuotas mensuales
-- Cobrador: Carlos (Zona Norte)
-- -------------------------
INSERT INTO public.prestamos (
  id, cliente_id, cobrador_id,
  monto, tasa, tipo_tasa, periodicidad,
  n_cuotas, monto_cuota, monto_total, saldo_pendiente,
  estado, fecha_inicio, fecha_fin_estimada, created_by
)
VALUES (
  'pr000001-0000-0000-0000-000000000001',
  'cl000001-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  50000.00, 10.00, 'flat', 'mensual',
  12, 5416.67, 65000.00, 60416.67,
  'activo',
  CURRENT_DATE - INTERVAL '2 months',
  CURRENT_DATE + INTERVAL '10 months',
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Cuotas para préstamo Roberto (12 cuotas mensuales)
INSERT INTO public.cuotas (id, prestamo_id, numero, fecha_vencimiento, monto, monto_pagado, estado)
SELECT
  uuid_generate_v4(),
  'pr000001-0000-0000-0000-000000000001',
  n,
  (CURRENT_DATE - INTERVAL '2 months' + (n || ' months')::INTERVAL)::DATE,
  5416.67,
  CASE WHEN n <= 2 THEN 5416.67 ELSE 0 END,  -- primeras 2 ya pagadas
  CASE WHEN n <= 2 THEN 'pagada' ELSE 'pendiente' END
FROM generate_series(1, 12) AS n
ON CONFLICT (prestamo_id, numero) DO NOTHING;


-- 5b. Préstamo en mora — Silvia Fernández
-- $30.000, sobre saldo 8%, 8 cuotas semanales
-- -------------------------
INSERT INTO public.prestamos (
  id, cliente_id, cobrador_id,
  monto, tasa, tipo_tasa, periodicidad,
  n_cuotas, monto_cuota, monto_total, saldo_pendiente,
  estado, fecha_inicio, fecha_fin_estimada, created_by
)
VALUES (
  'pr000001-0000-0000-0000-000000000002',
  'cl000001-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001',
  30000.00, 8.00, 'sobre_saldo', 'semanal',
  8, 4050.00, 32400.00, 20250.00,
  'en_mora',
  CURRENT_DATE - INTERVAL '6 weeks',
  CURRENT_DATE + INTERVAL '2 weeks',
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Cuotas para préstamo Silvia (8 semanales, 3 pagadas, resto en mora)
INSERT INTO public.cuotas (id, prestamo_id, numero, fecha_vencimiento, monto, monto_pagado, estado, dias_mora, recargo_mora)
SELECT
  uuid_generate_v4(),
  'pr000001-0000-0000-0000-000000000002',
  n,
  (CURRENT_DATE - INTERVAL '6 weeks' + (n || ' weeks')::INTERVAL)::DATE,
  4050.00,
  CASE WHEN n <= 3 THEN 4050.00 ELSE 0 END,
  CASE
    WHEN n <= 3 THEN 'pagada'
    WHEN (CURRENT_DATE - (CURRENT_DATE - INTERVAL '6 weeks' + (n || ' weeks')::INTERVAL)::DATE) > 3
      THEN 'mora'
    ELSE 'pendiente'
  END,
  CASE
    WHEN (CURRENT_DATE - (CURRENT_DATE - INTERVAL '6 weeks' + (n || ' weeks')::INTERVAL)::DATE) > 3
      THEN GREATEST(0, (CURRENT_DATE - (CURRENT_DATE - INTERVAL '6 weeks' + (n || ' weeks')::INTERVAL)::DATE) - 3)
    ELSE 0
  END,
  0.00  -- recargo_mora se calcula por el job nocturno
FROM generate_series(1, 8) AS n
ON CONFLICT (prestamo_id, numero) DO NOTHING;


-- 5c. Préstamo activo — Miguel Torres
-- $20.000, flat 12%, 10 cuotas semanales, cobrador Maria (Zona Sur)
-- -------------------------
INSERT INTO public.prestamos (
  id, cliente_id, cobrador_id,
  monto, tasa, tipo_tasa, periodicidad,
  n_cuotas, monto_cuota, monto_total, saldo_pendiente,
  estado, fecha_inicio, fecha_fin_estimada, created_by
)
VALUES (
  'pr000001-0000-0000-0000-000000000003',
  'cl000001-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000002',
  20000.00, 12.00, 'flat', 'semanal',
  10, 2240.00, 22400.00, 22400.00,
  'activo',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '10 weeks',
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Cuotas Miguel (10 semanales, ninguna pagada aún)
INSERT INTO public.cuotas (prestamo_id, numero, fecha_vencimiento, monto, estado)
SELECT
  'pr000001-0000-0000-0000-000000000003',
  n,
  (CURRENT_DATE + (n || ' weeks')::INTERVAL)::DATE,
  2240.00,
  'pendiente'
FROM generate_series(1, 10) AS n
ON CONFLICT (prestamo_id, numero) DO NOTHING;


-- -------------------------
-- 6. Pagos registrados (histórico)
-- -------------------------
-- Pago cuota 1 de Roberto (cobrador Carlos)
INSERT INTO public.pagos (
  id, cuota_id, prestamo_id, cliente_id,
  monto, fecha_pago, metodo, registrado_por
)
SELECT
  uuid_generate_v4(),
  cu.id,
  'pr000001-0000-0000-0000-000000000001',
  'cl000001-0000-0000-0000-000000000001',
  5416.67,
  (CURRENT_DATE - INTERVAL '2 months' + '1 month'::INTERVAL)::TIMESTAMPTZ,
  'efectivo',
  'c0000000-0000-0000-0000-000000000001'
FROM public.cuotas cu
WHERE cu.prestamo_id = 'pr000001-0000-0000-0000-000000000001' AND cu.numero = 1
ON CONFLICT DO NOTHING;

-- Pago cuota 2 de Roberto
INSERT INTO public.pagos (
  id, cuota_id, prestamo_id, cliente_id,
  monto, fecha_pago, metodo, registrado_por
)
SELECT
  uuid_generate_v4(),
  cu.id,
  'pr000001-0000-0000-0000-000000000001',
  'cl000001-0000-0000-0000-000000000001',
  5416.67,
  (CURRENT_DATE - INTERVAL '1 month')::TIMESTAMPTZ,
  'efectivo',
  'c0000000-0000-0000-0000-000000000001'
FROM public.cuotas cu
WHERE cu.prestamo_id = 'pr000001-0000-0000-0000-000000000001' AND cu.numero = 2
ON CONFLICT DO NOTHING;

-- Pagos de Silvia (cuotas 1, 2 y 3)
INSERT INTO public.pagos (
  id, cuota_id, prestamo_id, cliente_id,
  monto, fecha_pago, metodo, registrado_por
)
SELECT
  uuid_generate_v4(),
  cu.id,
  'pr000001-0000-0000-0000-000000000002',
  'cl000001-0000-0000-0000-000000000002',
  4050.00,
  (CURRENT_DATE - INTERVAL '6 weeks' + (cu.numero || ' weeks')::INTERVAL)::TIMESTAMPTZ,
  'efectivo',
  'c0000000-0000-0000-0000-000000000001'
FROM public.cuotas cu
WHERE cu.prestamo_id = 'pr000001-0000-0000-0000-000000000002'
  AND cu.numero IN (1, 2, 3)
ON CONFLICT DO NOTHING;


COMMIT;

-- -------------------------
-- Verificación rápida
-- -------------------------
SELECT 'profiles'    AS tabla, COUNT(*) FROM public.profiles
UNION ALL
SELECT 'clientes',             COUNT(*) FROM public.clientes
UNION ALL
SELECT 'prestamos',            COUNT(*) FROM public.prestamos
UNION ALL
SELECT 'cuotas',               COUNT(*) FROM public.cuotas
UNION ALL
SELECT 'pagos',                COUNT(*) FROM public.pagos;
