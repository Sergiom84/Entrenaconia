-- ============================================================================
-- SCRIPT DE VERIFICACIÓN - Sistema Unificado de Entrenamiento
-- Fecha: 2025-11-15
-- Descripción: Verifica que todas las migraciones se aplicaron correctamente
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR ESTRUCTURA DE TABLAS
-- ============================================================================

-- 1.1 Verificar columnas en methodology_plans
SELECT 
  'methodology_plans' as tabla,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' 
  AND table_name = 'methodology_plans'
  AND column_name IN ('origin', 'is_current', 'completed_at', 'cancelled_at')
ORDER BY column_name;

-- 1.2 Verificar columnas en methodology_exercise_sessions
SELECT 
  'methodology_exercise_sessions' as tabla,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' 
  AND table_name = 'methodology_exercise_sessions'
  AND column_name IN ('completion_rate', 'exercises_completed', 'exercises_total', 'exercises_skipped', 'exercises_cancelled')
ORDER BY column_name;

-- 1.3 Verificar columnas en methodology_session_feedback
SELECT 
  'methodology_session_feedback' as tabla,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' 
  AND table_name = 'methodology_session_feedback'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. VERIFICAR ÍNDICES
-- ============================================================================

-- 2.1 Verificar índice único de plan actual
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'app'
  AND tablename = 'methodology_plans'
  AND indexname = 'uniq_current_methodology_plan';

-- 2.2 Verificar índices de feedback
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'app'
  AND tablename = 'methodology_session_feedback'
ORDER BY indexname;

-- ============================================================================
-- 3. VERIFICAR CONSTRAINTS
-- ============================================================================

-- 3.1 Verificar constraint de session_status
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'app.methodology_exercise_sessions'::regclass
  AND conname = 'check_session_status';

-- 3.2 Verificar constraints de feedback
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'app.methodology_session_feedback'::regclass
  AND contype = 'c'
ORDER BY conname;

-- ============================================================================
-- 4. VERIFICAR INTEGRIDAD DE DATOS
-- ============================================================================

-- 4.1 Verificar que no hay múltiples planes activos por usuario
SELECT 
  user_id,
  COUNT(*) as planes_activos,
  STRING_AGG(id::TEXT, ', ') as plan_ids
FROM app.methodology_plans
WHERE is_current = TRUE
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 filas

-- 4.2 Verificar que todos los planes activos tienen is_current = TRUE
SELECT 
  id,
  user_id,
  methodology_type,
  status,
  is_current
FROM app.methodology_plans
WHERE status = 'active' AND is_current = FALSE;
-- Resultado esperado: 0 filas (o planes que están en transición)

-- 4.3 Verificar sesiones huérfanas (sin plan asociado)
SELECT COUNT(*) as sesiones_huerfanas
FROM app.methodology_exercise_sessions mes
WHERE NOT EXISTS (
  SELECT 1 FROM app.methodology_plans mp 
  WHERE mp.id = mes.methodology_plan_id
);
-- Resultado esperado: 0

-- 4.4 Verificar completion_rate calculado correctamente
SELECT 
  id,
  total_exercises,
  exercises_completed,
  completion_rate,
  CASE 
    WHEN total_exercises > 0 THEN 
      ROUND((exercises_completed::NUMERIC / total_exercises::NUMERIC) * 100, 2)
    ELSE 0.00
  END as calculated_rate,
  CASE 
    WHEN total_exercises > 0 AND 
         ABS(completion_rate - ROUND((exercises_completed::NUMERIC / total_exercises::NUMERIC) * 100, 2)) > 0.01
    THEN 'INCONSISTENTE'
    ELSE 'OK'
  END as status
FROM app.methodology_exercise_sessions
WHERE total_exercises > 0
  AND completion_rate IS NOT NULL
ORDER BY id DESC
LIMIT 20;

-- ============================================================================
-- 5. ESTADÍSTICAS GENERALES
-- ============================================================================

-- 5.1 Resumen de planes por estado
SELECT 
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_current = TRUE) as current_plans
FROM app.methodology_plans
GROUP BY status
ORDER BY status;

-- 5.2 Resumen de sesiones por estado
SELECT 
  session_status,
  COUNT(*) as total,
  ROUND(AVG(completion_rate), 2) as avg_completion_rate
FROM app.methodology_exercise_sessions
GROUP BY session_status
ORDER BY session_status;

-- 5.3 Resumen de feedback por tipo
SELECT 
  feedback_type,
  reason_code,
  COUNT(*) as total
FROM app.methodology_session_feedback
GROUP BY feedback_type, reason_code
ORDER BY feedback_type, total DESC;

-- ============================================================================
-- 6. VERIFICAR FOREIGN KEYS
-- ============================================================================

SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'app'
  AND tc.table_name IN ('methodology_plans', 'methodology_exercise_sessions', 'methodology_session_feedback')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- FIN DE VERIFICACIÓN
-- ============================================================================

