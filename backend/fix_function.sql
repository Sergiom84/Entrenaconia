-- ===============================================
-- FUNCIÓN CORREGIDA: routine_sessions_recalc_totals
-- ===============================================
-- Corrige los errores de sintaxis SQL en los UPDATE statements
-- Problema original: faltaba SET column = antes de los CASE

CREATE OR REPLACE FUNCTION app.routine_sessions_recalc_totals(p_session_id integer)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Actualizar total_exercises basado en el array de exercises_data
  UPDATE app.routine_sessions 
  SET total_exercises = COALESCE(
    CASE
      WHEN jsonb_typeof(exercises_data::jsonb) = 'array'
        THEN jsonb_array_length(exercises_data::jsonb)
      ELSE 0
    END, 0)
  WHERE id = p_session_id;
  
  -- Actualizar exercises_completed basado en el conteo de routine_exercise_progress completados
  UPDATE app.routine_sessions 
  SET exercises_completed = COALESCE((
    SELECT COUNT(*)::INT
    FROM app.routine_exercise_progress p
    WHERE p.routine_session_id = p_session_id
      AND p.status = 'completed'
  ), 0)
  WHERE id = p_session_id;
END;
$function$;

-- ===============================================
-- COMENTARIOS SOBRE LAS CORRECCIONES REALIZADAS:
-- ===============================================
--
-- 1. PRIMER UPDATE:
--    ANTES: UPDATE app.routine_sessions s CASE WHEN... (sintaxis incorrecta)
--    DESPUÉS: UPDATE app.routine_sessions SET total_exercises = CASE WHEN...
--    - Agregado "SET total_exercises =" 
--    - Removido alias "s" innecesario
--    - Mantenido COALESCE para manejar NULLs
--
-- 2. SEGUNDO UPDATE: 
--    ANTES: UPDATE app.routine_sessions s SELECT COUNT(*)... (sintaxis incorrecta)
--    DESPUÉS: UPDATE app.routine_sessions SET exercises_completed = (SELECT COUNT(*)...)
--    - Agregado "SET exercises_completed ="
--    - Encerrado SELECT en paréntesis para subquery
--    - Mantenido COALESCE para manejar NULLs
--
-- 3. MEJORAS ADICIONALES:
--    - Removidos aliases innecesarios
--    - Mejorada legibilidad con indentación
--    - Agregados comentarios explicativos
--    - Mantenida lógica original intacta