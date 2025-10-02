-- ============================================================
-- MIGRACIÓN: Sistema de Exercise ID y mejoras de arquitectura
-- Fecha: 2025-10-02
-- Objetivo: Solucionar problemas de mapeo de ejercicios y sesiones
-- ============================================================

-- 1. Agregar exercise_id a methodology_exercise_progress
ALTER TABLE app.methodology_exercise_progress
ADD COLUMN IF NOT EXISTS exercise_id UUID;

-- 2. Agregar índice para exercise_id
CREATE INDEX IF NOT EXISTS idx_exercise_progress_exercise_id
ON app.methodology_exercise_progress(exercise_id);

-- 3. Agregar session_template_id y session_type a methodology_exercise_sessions
ALTER TABLE app.methodology_exercise_sessions
ADD COLUMN IF NOT EXISTS session_template_id INTEGER,
ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'planned';

-- 4. Agregar comentarios descriptivos
COMMENT ON COLUMN app.methodology_exercise_progress.exercise_id IS
'UUID único del ejercicio, referencia al catálogo de ejercicios';

COMMENT ON COLUMN app.methodology_exercise_sessions.session_type IS
'Tipo de sesión: planned (del schedule), adapted (día faltante), custom (personalizada)';

COMMENT ON COLUMN app.methodology_exercise_sessions.session_template_id IS
'Referencia al template de workout_schedule del que se creó esta sesión';

-- 5. Crear función para generar exercise_id determinístico desde nombre
-- Usa MD5 + UUID para generar IDs consistentes sin necesitar uuid-ossp
CREATE OR REPLACE FUNCTION app.generate_exercise_id(exercise_name TEXT)
RETURNS UUID AS $$
BEGIN
  -- Genera UUID determinístico basado en MD5 del nombre
  -- Mismo nombre → mismo UUID (consistente)
  RETURN (
    SELECT (
      md5('exercise:' || LOWER(TRIM(exercise_name)))::uuid
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Migrar datos existentes: Asignar exercise_id basado en exercise_name
UPDATE app.methodology_exercise_progress
SET exercise_id = app.generate_exercise_id(exercise_name)
WHERE exercise_id IS NULL AND exercise_name IS NOT NULL;

-- 8. Agregar estados adicionales a session_status
-- Crear tipo ENUM si no existe (o validación por CHECK constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'session_status_enum'
  ) THEN
    CREATE TYPE app.session_status_enum AS ENUM (
      'pending',
      'in_progress',
      'completed',
      'partial',
      'cancelled',
      'skipped',
      'paused'
    );
  END IF;
END $$;

-- 9. Vista materializada exercise_history
-- (Omitida por ahora para evitar conflictos con tabla existente)
-- Se puede crear manualmente después si se necesita

-- 10. Crear índices compuestos para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS idx_sessions_plan_week_day
ON app.methodology_exercise_sessions(methodology_plan_id, week_number, day_name);

CREATE INDEX IF NOT EXISTS idx_workout_schedule_plan_week_day
ON app.workout_schedule(methodology_plan_id, week_number, day_name);

-- 11. Verificación de integridad
DO $$
DECLARE
  total_progress INTEGER;
  with_exercise_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_progress FROM app.methodology_exercise_progress;
  SELECT COUNT(*) INTO with_exercise_id FROM app.methodology_exercise_progress WHERE exercise_id IS NOT NULL;

  RAISE NOTICE '✅ Migración completada';
  RAISE NOTICE '📊 Total ejercicios en progreso: %', total_progress;
  RAISE NOTICE '🔑 Ejercicios con exercise_id: %', with_exercise_id;
  RAISE NOTICE '📈 Cobertura: %%%', ROUND((with_exercise_id::NUMERIC / NULLIF(total_progress, 0)) * 100, 2);
END $$;
