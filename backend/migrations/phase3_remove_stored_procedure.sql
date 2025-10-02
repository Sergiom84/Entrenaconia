-- ============================================================================
-- FASE 3: Eliminar stored procedure obsoleto
-- ============================================================================
-- 
-- Este script elimina el stored procedure create_methodology_exercise_sessions
-- que ha sido reemplazado por la función JavaScript ensureWorkoutSchedule()
--
-- RAZONES PARA ELIMINARLO:
-- 1. Espera un formato de JSON diferente al que genera la IA
-- 2. Crea sesiones duplicadas (ya las crea ensureWorkoutSchedule)
-- 3. Usa nombres de día completos (Lunes) en vez de abreviaturas (Lun)
-- 4. Calcula fechas incorrectamente (usa CURRENT_DATE en vez de plan_start_date)
--
-- NUEVO SISTEMA:
-- - ensureWorkoutSchedule() crea methodology_plan_days + workout_schedule
-- - Las sesiones en methodology_exercise_sessions se crean bajo demanda
--   cuando el usuario inicia un entrenamiento
--
-- ============================================================================

-- 1. Verificar si el stored procedure existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'app'
      AND p.proname = 'create_methodology_exercise_sessions'
  ) THEN
    RAISE NOTICE '✅ Stored procedure encontrado - procediendo a eliminar';
  ELSE
    RAISE NOTICE '⚠️  Stored procedure no encontrado - nada que hacer';
  END IF;
END $$;

-- 2. Eliminar el stored procedure
DROP FUNCTION IF EXISTS app.create_methodology_exercise_sessions(INTEGER, INTEGER, JSONB) CASCADE;

-- 3. Verificar eliminación
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'app'
      AND p.proname = 'create_methodology_exercise_sessions'
  ) THEN
    RAISE NOTICE '✅ Stored procedure eliminado exitosamente';
  ELSE
    RAISE NOTICE '❌ Error: Stored procedure aún existe';
  END IF;
END $$;

-- 4. Eliminar también la función auxiliar get_current_day_spanish si existe
DROP FUNCTION IF EXISTS app.get_current_day_spanish() CASCADE;

-- 5. Comentario de documentación
COMMENT ON SCHEMA app IS 
'Schema principal de la aplicación Entrenaconia.
FASE 3 (2025-10-02): Stored procedure create_methodology_exercise_sessions eliminado.
Las sesiones ahora se crean bajo demanda mediante JavaScript.';

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

