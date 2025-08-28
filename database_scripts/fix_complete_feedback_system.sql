-- ================================================================================
-- FIX COMPLETE FEEDBACK SYSTEM - PERMITIR COMENTARIOS SIN SENTIMENT
-- ================================================================================
-- Fecha: 28 de agosto de 2025
-- Propósito: Corregir el sistema de feedback para permitir comentarios sin sentiment
-- ================================================================================

-- 1. MODIFICAR TABLA: Permitir sentiment NULL
ALTER TABLE app.user_exercise_feedback ALTER COLUMN sentiment DROP NOT NULL;

-- 2. ELIMINAR constraint restrictivo anterior
ALTER TABLE app.user_exercise_feedback DROP CONSTRAINT IF EXISTS user_exercise_feedback_sentiment_check;

-- 3. AGREGAR nuevo constraint que permite NULL o valores válidos
ALTER TABLE app.user_exercise_feedback 
ADD CONSTRAINT user_exercise_feedback_sentiment_check 
CHECK (sentiment IS NULL OR sentiment IN ('dislike', 'hard', 'love'));

-- 4. INSERTAR el comentario faltante de la sesión 67 (si no existe ya)
INSERT INTO app.user_exercise_feedback 
(user_id, session_id, exercise_order, exercise_name, exercise_key, sentiment, comment)
SELECT 10, 67, 1, 
       'Pike Push-Up (Flexión en V invertida para hombros)', 
       'pike_push_up_flexi_n_en_v_invertida_para_hombros_', 
       NULL, 
       'Dificil pero con encanto'
WHERE NOT EXISTS (
    SELECT 1 FROM app.user_exercise_feedback 
    WHERE user_id = 10 AND session_id = 67 AND exercise_order = 1
);

-- ================================================================================
-- VERIFICACIÓN FINAL
-- ================================================================================

-- Mostrar estructura actualizada de la tabla
SELECT 'Verificando estructura de la tabla...' AS status;
\d app.user_exercise_feedback

-- Verificar todos los feedbacks para la sesión 67
SELECT 'Verificando feedbacks para sesión 67:' AS status;
SELECT exercise_order, exercise_name, sentiment, comment, created_at
FROM app.user_exercise_feedback 
WHERE session_id = 67 
ORDER BY exercise_order;

-- Verificar progreso completo de la sesión 67 con feedback
SELECT 'Verificando progreso completo de sesión 67:' AS status;
SELECT p.exercise_order, p.exercise_name, p.status, p.series_completed, 
       fb.sentiment AS feedback_sentiment, fb.comment AS feedback_comment
FROM app.home_exercise_progress p
LEFT JOIN LATERAL (
  SELECT sentiment, comment
  FROM app.user_exercise_feedback uf
  WHERE uf.user_id = 10
    AND uf.session_id = 67
    AND uf.exercise_order = p.exercise_order
  ORDER BY created_at DESC
  LIMIT 1
) fb ON true
WHERE p.home_training_session_id = 67
ORDER BY p.exercise_order;

SELECT '✅ Sistema de feedback corregido exitosamente' AS status;
SELECT '✅ Ahora se pueden guardar comentarios con o sin sentiment' AS note;