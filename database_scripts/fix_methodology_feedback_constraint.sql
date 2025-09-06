-- ============================================================
-- FIX URGENT: Corregir constraint methodology_exercise_feedback
-- ============================================================
-- 
-- PROBLEMA CRÍTICO:
-- El constraint 'feedback_sentiment_final' no permite valor 'like'
-- pero el sistema unificado está enviando ['like', 'dislike', 'hard']
-- 
-- SOLUCIÓN:
-- 1. Eliminar constraint restrictivo actual
-- 2. Crear nuevo constraint que permita valores unificados
-- 3. Migrar datos existentes de 'love' → 'like'
-- 4. Verificar integridad
-- ============================================================

-- 1. ELIMINAR constraint actual que causa problemas
ALTER TABLE app.methodology_exercise_feedback 
DROP CONSTRAINT IF EXISTS methodology_feedback_sentiment_check;

ALTER TABLE app.methodology_exercise_feedback 
DROP CONSTRAINT IF EXISTS feedback_sentiment_final;

-- 2. MIGRAR datos existentes: 'love' → 'like' para consistencia
UPDATE app.methodology_exercise_feedback 
SET sentiment = 'like' 
WHERE sentiment = 'love';

-- 3. CREAR nuevo constraint que permita valores unificados
ALTER TABLE app.methodology_exercise_feedback 
ADD CONSTRAINT methodology_feedback_sentiment_unified 
CHECK (sentiment IN ('like', 'dislike', 'hard'));

-- 4. VERIFICACIÓN: Mostrar datos actualizados
SELECT 'Verificando datos actualizados:' AS status;
SELECT sentiment, COUNT(*) as cantidad 
FROM app.methodology_exercise_feedback 
GROUP BY sentiment 
ORDER BY sentiment;

-- 5. MOSTRAR constraint actual
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE table_name = 'methodology_exercise_feedback' 
  AND table_schema = 'app';

COMMIT;

-- ============================================================
-- CONFIRMACIÓN
-- ============================================================
SELECT '✅ CONSTRAINT METHODOLOGY_EXERCISE_FEEDBACK ACTUALIZADO' AS resultado;
SELECT '📊 Valores permitidos: like, dislike, hard' AS valores_permitidos;
SELECT '🔄 Migración love → like completada' AS migracion_completada;