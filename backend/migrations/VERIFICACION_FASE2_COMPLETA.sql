-- ============================================================
-- VERIFICACIÓN COMPLETA FASE 2 - EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================
-- Este script verifica que TODOS los módulos estén correctamente instalados
-- ============================================================

-- ============================================================
-- 1. VERIFICAR TABLAS
-- ============================================================

-- Tabla de flags de fatiga
SELECT
  'app.fatigue_flags' AS tabla,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app' AND table_name = 'fatigue_flags'
  ) THEN '✅ Existe' ELSE '❌ FALTA' END AS estado,
  (SELECT COUNT(*) FROM app.fatigue_flags) AS registros;

-- Tabla de estado hipertrofia_v2
SELECT
  'app.hipertrofia_v2_state' AS tabla,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app' AND table_name = 'hipertrofia_v2_state'
  ) THEN '✅ Existe' ELSE '❌ FALTA' END AS estado,
  (SELECT COUNT(*) FROM app.hipertrofia_v2_state) AS registros;

-- Tabla de configuración de sesiones
SELECT
  'app.hipertrofia_v2_session_config' AS tabla,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app' AND table_name = 'hipertrofia_v2_session_config'
  ) THEN '✅ Existe' ELSE '❌ FALTA' END AS estado,
  (SELECT COUNT(*) FROM app.hipertrofia_v2_session_config) AS registros,
  CASE WHEN (SELECT COUNT(*) FROM app.hipertrofia_v2_session_config) = 5
    THEN '✅ 5 sesiones (correcto)'
    ELSE '⚠️ Debe tener 5 sesiones (D1-D5)'
  END AS validacion;

-- ============================================================
-- 2. VERIFICAR COLUMNAS NUEVAS (FASE 2)
-- ============================================================

-- Columnas de Módulo 1 (Fatiga) - ya verificado con tabla fatigue_flags

-- Columnas de Módulo 3 (Solapamiento Neural)
SELECT
  'last_session_patterns' AS columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'hipertrofia_v2_state'
      AND column_name = 'last_session_patterns'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_solapamiento_neural.sql' END AS estado;

SELECT
  'neural_overlap_detected' AS columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'hipertrofia_v2_state'
      AND column_name = 'neural_overlap_detected'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_solapamiento_neural.sql' END AS estado;

-- Columnas de Módulo 4 (Prioridad Muscular)
SELECT
  'priority_muscle' AS columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'hipertrofia_v2_state'
      AND column_name = 'priority_muscle'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_prioridad_muscular.sql' END AS estado;

SELECT
  'priority_started_at' AS columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'hipertrofia_v2_state'
      AND column_name = 'priority_started_at'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_prioridad_muscular.sql' END AS estado;

-- ============================================================
-- 3. VERIFICAR FUNCIONES SQL
-- ============================================================

-- Funciones de FASE 1
SELECT
  'advance_cycle_day' AS funcion,
  'FASE 1 (modificada FASE 2)' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'advance_cycle_day'
  ) THEN '✅ Existe' ELSE '❌ FALTA' END AS estado;

SELECT
  'apply_microcycle_progression' AS funcion,
  'FASE 1' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'apply_microcycle_progression'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase1_FIXED.sql' END AS estado;

-- Funciones de Módulo 1 (Fatiga)
SELECT
  'detect_automatic_fatigue_flags' AS funcion,
  'Módulo 1 - Fatiga' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'detect_automatic_fatigue_flags'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_fatigue_flags.sql' END AS estado;

SELECT
  'count_recent_flags' AS funcion,
  'Módulo 1 - Fatiga' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'count_recent_flags'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_fatigue_flags.sql' END AS estado;

SELECT
  'evaluate_fatigue_action' AS funcion,
  'Módulo 1 - Fatiga' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'evaluate_fatigue_action'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_fatigue_flags.sql' END AS estado;

SELECT
  'apply_fatigue_adjustments' AS funcion,
  'Módulo 1 - Fatiga' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'apply_fatigue_adjustments'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_fatigue_flags.sql' END AS estado;

-- Funciones de Módulo 2 (Inactividad)
SELECT
  'check_and_apply_inactivity_calibration' AS funcion,
  'Módulo 2 - Inactividad' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'check_and_apply_inactivity_calibration'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_inactividad_calibracion.sql' END AS estado;

-- Funciones de Módulo 3 (Solapamiento Neural)
SELECT
  'detect_neural_overlap' AS funcion,
  'Módulo 3 - Solapamiento' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'detect_neural_overlap'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_solapamiento_neural.sql' END AS estado;

-- Funciones de Módulo 4 (Prioridad Muscular)
SELECT
  'activate_muscle_priority' AS funcion,
  'Módulo 4 - Prioridad' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'activate_muscle_priority'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_prioridad_muscular.sql' END AS estado;

SELECT
  'deactivate_muscle_priority' AS funcion,
  'Módulo 4 - Prioridad' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'deactivate_muscle_priority'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_prioridad_muscular.sql' END AS estado;

SELECT
  'check_priority_timeout' AS funcion,
  'Módulo 4 - Prioridad' AS modulo,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app' AND routine_name = 'check_priority_timeout'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_prioridad_muscular.sql' END AS estado;

-- ============================================================
-- 4. VERIFICAR ÍNDICES ÚNICOS
-- ============================================================

SELECT
  'uidx_session_config_cycle_day' AS indice,
  'Evita duplicados en D1-D5' AS proposito,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'app'
      AND indexname = 'uidx_session_config_cycle_day'
  ) THEN '✅ Existe' ELSE '❌ FALTA - Ejecutar fase2_fix_session_config_unique.sql' END AS estado;

-- ============================================================
-- 5. RESUMEN FINAL
-- ============================================================

SELECT
  '🎯 RESUMEN GENERAL' AS seccion,
  (
    SELECT COUNT(*)
    FROM information_schema.routines
    WHERE routine_schema = 'app'
    AND routine_name IN (
      'advance_cycle_day',
      'detect_automatic_fatigue_flags',
      'count_recent_flags',
      'evaluate_fatigue_action',
      'apply_fatigue_adjustments',
      'check_and_apply_inactivity_calibration',
      'detect_neural_overlap',
      'activate_muscle_priority',
      'deactivate_muscle_priority',
      'check_priority_timeout',
      'apply_microcycle_progression'
    )
  ) AS funciones_instaladas,
  11 AS funciones_esperadas,
  CASE WHEN (
    SELECT COUNT(*)
    FROM information_schema.routines
    WHERE routine_schema = 'app'
    AND routine_name IN (
      'advance_cycle_day',
      'detect_automatic_fatigue_flags',
      'count_recent_flags',
      'evaluate_fatigue_action',
      'apply_fatigue_adjustments',
      'check_and_apply_inactivity_calibration',
      'detect_neural_overlap',
      'activate_muscle_priority',
      'deactivate_muscle_priority',
      'check_priority_timeout',
      'apply_microcycle_progression'
    )
  ) = 11 THEN '✅ FASE 2 COMPLETA' ELSE '❌ FALTAN FUNCIONES' END AS estado;

-- ============================================================
-- 6. VERIFICAR PARÁMETROS DE advance_cycle_day
-- ============================================================

-- Verificar que advance_cycle_day acepta el nuevo parámetro p_session_patterns
SELECT
  routine_name,
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_schema = 'app'
  AND routine_name = 'advance_cycle_day'
ORDER BY ordinal_position;

-- Debe mostrar 3 parámetros:
-- 1. p_user_id (integer)
-- 2. p_session_day_name (character varying)
-- 3. p_session_patterns (jsonb) <- NUEVO en FASE 2 Módulo 3

-- ============================================================
-- FIN DE VERIFICACIÓN
-- ============================================================
-- Si todos los checks muestran ✅, la FASE 2 está correctamente instalada
-- Si hay ❌, ejecuta el script SQL correspondiente mencionado en el estado
-- ============================================================
