-- ===============================================================
-- MIGRACIÓN DE DATOS DE METODOLOGÍAS AL NUEVO SISTEMA
-- Migra desde exercise_history a methodology_exercise_history_complete
-- ===============================================================

-- Migrar datos históricos desde exercise_history a la nueva estructura
INSERT INTO app.methodology_exercise_history_complete (
    user_id,
    methodology_plan_id,
    methodology_session_id,
    exercise_name,
    exercise_order,
    methodology_type,
    series_total,
    series_completed,
    repeticiones,
    intensidad,
    tiempo_dedicado_segundos,
    sentiment,
    user_comment,
    week_number,
    day_name,
    session_date,
    completed_at
)
SELECT 
    eh.user_id,
    COALESCE(eh.plan_id, 0) as methodology_plan_id, -- Usar 0 si no hay plan_id
    NULL as methodology_session_id, -- NULL para datos históricos
    eh.exercise_name,
    0 as exercise_order, -- Valor por defecto
    eh.methodology_type,
    4 as series_total, -- Valor por defecto estimado
    4 as series_completed, -- Asumir que completaron todas las series
    '8-10' as repeticiones, -- Valor por defecto
    'RPE 8' as intensidad, -- Valor por defecto
    NULL as tiempo_dedicado_segundos,
    NULL as sentiment, -- Sin feedback histórico
    NULL as user_comment,
    eh.week_number,
    eh.day_name,
    DATE(eh.used_at) as session_date,
    eh.used_at as completed_at
FROM app.exercise_history eh
WHERE eh.exercise_name IS NOT NULL
AND eh.used_at IS NOT NULL
-- Evitar duplicados si se ejecuta varias veces
AND NOT EXISTS (
    SELECT 1 FROM app.methodology_exercise_history_complete mehc
    WHERE mehc.user_id = eh.user_id 
    AND mehc.exercise_name = eh.exercise_name 
    AND mehc.completed_at = eh.used_at
);

-- Verificar la migración
SELECT 
    'Registros migrados:' as info,
    COUNT(*) as total
FROM app.methodology_exercise_history_complete
WHERE methodology_session_id IS NULL; -- Datos migrados

-- Mostrar resumen por usuario
SELECT 
    user_id,
    COUNT(*) as ejercicios_historicos,
    COUNT(DISTINCT exercise_name) as ejercicios_unicos,
    MIN(completed_at) as primer_ejercicio,
    MAX(completed_at) as ultimo_ejercicio
FROM app.methodology_exercise_history_complete
WHERE methodology_session_id IS NULL
GROUP BY user_id
ORDER BY user_id;