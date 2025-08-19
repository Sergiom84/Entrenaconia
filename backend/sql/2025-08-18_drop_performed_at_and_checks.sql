-- Checks rápidos de esquema + migración idempotente para eliminar performed_at
-- Schema-qualified a app.

-- 0) Contexto
SET search_path = app, public;

-- 1) Checks rápidos (puedes ejecutar este archivo completo en DBeaver)
-- 1.a) Tablas clave presentes
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'app'
  AND table_name IN (
    'users','home_training_plans','home_training_sessions',
    'home_exercise_progress','user_home_training_stats','user_exercise_history'
  )
ORDER BY table_name;

-- 1.b) Vistas usadas por la IA
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'app'
  AND table_name IN ('v_user_profile_normalized','v_hist_real','v_hist_propuesto')
ORDER BY table_name;

-- 1.c) created_at existe y su DEFAULT
SELECT
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name   = 'user_exercise_history'
  AND column_name IN ('created_at','performed_at')
ORDER BY column_name;

-- 1.d) Conteos básicos
SELECT
  COUNT(*)                                   AS total_rows,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls,
  COUNT(*) FILTER (WHERE created_at IS NOT NULL) AS created_at_filled
FROM app.user_exercise_history;

-- 2) Migración idempotente: asegurar created_at, backfill y eliminar performed_at
BEGIN;

-- 2.a) Asegurar columna y DEFAULT (idempotente)
ALTER TABLE app.user_exercise_history
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE app.user_exercise_history
  ALTER COLUMN created_at SET DEFAULT now();

-- 2.b) Backfill desde performed_at si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name   = 'user_exercise_history'
      AND column_name  = 'performed_at'
  ) THEN
    UPDATE app.user_exercise_history
       SET created_at = COALESCE(created_at, performed_at)
     WHERE created_at IS NULL;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 2.c) Eliminar performed_at si existe (idempotente)
ALTER TABLE app.user_exercise_history
  DROP COLUMN IF EXISTS performed_at;

-- 2.d) Asegurar índices útiles (idempotente)
CREATE INDEX IF NOT EXISTS idx_ueh_user_created
  ON app.user_exercise_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ueh_key
  ON app.user_exercise_history (exercise_key);

-- 2.e) Recrear vistas auxiliares (idempotente)
CREATE OR REPLACE VIEW app.v_hist_real AS
SELECT
  id,
  user_id,
  created_at,
  exercise_name,
  COALESCE(exercise_key, lower(regexp_replace(exercise_name, '[^a-z0-9]+', '_', 'g'))) AS exercise_key,
  series,
  duration_seconds,
  session_id,
  plan_id
FROM app.user_exercise_history;

CREATE OR REPLACE VIEW app.v_hist_propuesto AS
SELECT
  p.id           AS plan_id,
  p.user_id,
  p.created_at,
  (x->>'nombre')::text AS exercise_name,
  lower(regexp_replace((x->>'nombre')::text, '[^a-z0-9]+', '_', 'g')) AS exercise_key
FROM app.home_training_plans p
CROSS JOIN LATERAL jsonb_array_elements(p.plan_data->'plan_entrenamiento'->'ejercicios') x;

COMMIT;

