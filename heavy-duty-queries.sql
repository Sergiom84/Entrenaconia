-- ═══════════════════════════════════════════════════════════════
-- 📊 HEAVY DUTY - QUERIES SQL ÚTILES
-- ═══════════════════════════════════════════════════════════════
-- Colección de queries para trabajar con la metodología Heavy Duty
-- Fecha: 2025-10-05
-- ═══════════════════════════════════════════════════════════════

SET search_path TO app, public;

-- ─────────────────────────────────────────────────────────────
-- 1️⃣  CONSULTAS DE EJERCICIOS
-- ─────────────────────────────────────────────────────────────

-- 📋 Ver todos los ejercicios Heavy Duty
SELECT
    exercise_id,
    nombre,
    nivel,
    categoria,
    equipamiento,
    series_reps_objetivo
FROM app."Ejercicios_Heavy_Duty"
ORDER BY categoria, nivel, nombre;

-- 📊 Contar ejercicios por categoría y nivel
SELECT
    categoria,
    nivel,
    COUNT(*) as total_ejercicios
FROM app."Ejercicios_Heavy_Duty"
GROUP BY categoria, nivel
ORDER BY categoria, nivel;

-- 🔍 Buscar ejercicios por nivel (Principiante)
SELECT
    exercise_id,
    nombre,
    categoria,
    equipamiento,
    series_reps_objetivo
FROM app."Ejercicios_Heavy_Duty"
WHERE nivel = 'Principiante'
ORDER BY categoria;

-- 🔍 Buscar ejercicios por categoría (Empuje)
SELECT
    exercise_id,
    nombre,
    nivel,
    equipamiento,
    series_reps_objetivo,
    notas
FROM app."Ejercicios_Heavy_Duty"
WHERE categoria = 'Empuje'
ORDER BY nivel, nombre;

-- 🔍 Buscar ejercicios por equipamiento
SELECT
    exercise_id,
    nombre,
    nivel,
    categoria,
    series_reps_objetivo
FROM app."Ejercicios_Heavy_Duty"
WHERE equipamiento LIKE '%Barra%'
ORDER BY categoria;

-- ─────────────────────────────────────────────────────────────
-- 2️⃣  CONSULTAS DE PLANES
-- ─────────────────────────────────────────────────────────────

-- 📋 Ver todos los planes Heavy Duty
SELECT
    mp.id,
    mp.user_id,
    u.nombre as usuario,
    u.nivel_entrenamiento,
    mp.status,
    mp.current_week,
    mp.current_day,
    mp.created_at,
    mp.plan_data
FROM app.methodology_plans mp
JOIN app.users u ON mp.user_id = u.id
WHERE mp.methodology_type = 'Heavy Duty'
ORDER BY mp.created_at DESC;

-- 🟢 Ver planes activos de Heavy Duty
SELECT
    mp.id as plan_id,
    u.id as user_id,
    u.nombre,
    u.nivel_entrenamiento,
    mp.current_week,
    mp.current_day,
    mp.started_at,
    mp.plan_data
FROM app.methodology_plans mp
JOIN app.users u ON mp.user_id = u.id
WHERE mp.methodology_type = 'Heavy Duty'
  AND mp.status = 'active'
ORDER BY mp.started_at DESC;

-- 🔍 Ver plan específico de un usuario
SELECT
    mp.*,
    u.nombre,
    u.nivel_entrenamiento,
    u.años_entrenando,
    u.limitaciones_fisicas
FROM app.methodology_plans mp
JOIN app.users u ON mp.user_id = u.id
WHERE mp.methodology_type = 'Heavy Duty'
  AND mp.user_id = 1  -- Cambiar por ID del usuario
ORDER BY mp.created_at DESC
LIMIT 1;

-- ─────────────────────────────────────────────────────────────
-- 3️⃣  CONSULTAS DE DÍAS DEL PLAN
-- ─────────────────────────────────────────────────────────────

-- 📅 Ver días de un plan Heavy Duty
SELECT
    mpd.plan_id,
    mpd.day_id,
    mpd.date_local,
    mpd.day_name,
    mpd.week_number,
    mpd.is_rest,
    mpd.planned_exercises_count,
    mpd.metadata
FROM app.methodology_plan_days mpd
WHERE mpd.plan_id = 1  -- Cambiar por ID del plan
ORDER BY mpd.day_id;

-- 📅 Ver días de entrenamiento (no descanso) de un plan
SELECT
    mpd.day_id,
    mpd.date_local,
    mpd.day_name,
    mpd.week_number,
    mpd.metadata->>'focus' as enfoque,
    mpd.metadata->'exercises' as ejercicios
FROM app.methodology_plan_days mpd
WHERE mpd.plan_id = 1  -- Cambiar por ID del plan
  AND mpd.is_rest = false
ORDER BY mpd.day_id;

-- 📅 Ver día específico con ejercicios
SELECT
    mpd.day_id,
    mpd.day_name,
    mpd.date_local,
    mpd.week_number,
    mpd.metadata
FROM app.methodology_plan_days mpd
WHERE mpd.plan_id = 1  -- Cambiar por ID del plan
  AND mpd.day_id = 1   -- Cambiar por ID del día
LIMIT 1;

-- 📊 Contar días por semana de un plan
SELECT
    week_number,
    COUNT(*) as total_dias,
    SUM(CASE WHEN is_rest THEN 1 ELSE 0 END) as dias_descanso,
    SUM(CASE WHEN is_rest THEN 0 ELSE 1 END) as dias_entrenamiento
FROM app.methodology_plan_days
WHERE plan_id = 1  -- Cambiar por ID del plan
GROUP BY week_number
ORDER BY week_number;

-- ─────────────────────────────────────────────────────────────
-- 4️⃣  CONSULTAS DE SESIONES ACTIVAS
-- ─────────────────────────────────────────────────────────────

-- 🏋️ Ver sesión activa de Heavy Duty
SELECT
    mes.id as session_id,
    mes.user_id,
    u.nombre,
    mes.methodology_plan_id,
    mes.session_status,
    mes.started_at,
    mes.total_exercises,
    mes.exercises_completed,
    mes.current_exercise_index,
    mes.exercises_data,
    mes.session_metadata
FROM app.methodology_exercise_sessions mes
JOIN app.users u ON mes.user_id = u.id
WHERE mes.methodology_type = 'Heavy Duty'
  AND mes.is_current_session = true
  AND mes.session_status = 'in_progress'
ORDER BY mes.started_at DESC;

-- 📊 Ver todas las sesiones de Heavy Duty de un usuario
SELECT
    mes.id,
    mes.methodology_plan_id,
    mes.session_date,
    mes.session_status,
    mes.started_at,
    mes.completed_at,
    mes.total_exercises,
    mes.exercises_completed,
    mes.total_duration_seconds,
    mes.difficulty_rating,
    mes.effort_rating
FROM app.methodology_exercise_sessions mes
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
ORDER BY mes.session_date DESC;

-- 📈 Ver progreso de sesiones completadas
SELECT
    mes.session_date,
    mes.week_number,
    mes.day_name,
    mes.total_exercises,
    mes.exercises_completed,
    ROUND((mes.exercises_completed::numeric / NULLIF(mes.total_exercises, 0)) * 100, 2) as porcentaje_completado,
    mes.total_duration_seconds / 60 as duracion_minutos,
    mes.difficulty_rating,
    mes.effort_rating
FROM app.methodology_exercise_sessions mes
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
  AND mes.session_status = 'completed'
ORDER BY mes.session_date DESC;

-- ─────────────────────────────────────────────────────────────
-- 5️⃣  CONSULTAS DE PROGRESO Y ESTADÍSTICAS
-- ─────────────────────────────────────────────────────────────

-- 📈 Progreso total del usuario en Heavy Duty
SELECT
    u.id,
    u.nombre,
    u.nivel_entrenamiento,
    COUNT(DISTINCT mes.id) as sesiones_totales,
    COUNT(DISTINCT CASE WHEN mes.session_status = 'completed' THEN mes.id END) as sesiones_completadas,
    AVG(mes.difficulty_rating) as dificultad_promedio,
    AVG(mes.effort_rating) as esfuerzo_promedio,
    SUM(mes.total_duration_seconds) / 3600 as horas_totales_entrenamiento
FROM app.users u
LEFT JOIN app.methodology_exercise_sessions mes
    ON u.id = mes.user_id
    AND mes.methodology_type = 'Heavy Duty'
WHERE u.id = 1  -- Cambiar por ID del usuario
GROUP BY u.id, u.nombre, u.nivel_entrenamiento;

-- 📊 Ejercicios más realizados en Heavy Duty
SELECT
    exercise_data->>'exercise_id' as exercise_id,
    exercise_data->>'nombre' as nombre_ejercicio,
    COUNT(*) as veces_realizado,
    AVG((exercise_data->>'peso')::numeric) as peso_promedio,
    MAX((exercise_data->>'peso')::numeric) as peso_maximo
FROM app.methodology_exercise_sessions mes,
     jsonb_array_elements(mes.exercises_data) as exercise_data
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
  AND mes.session_status = 'completed'
GROUP BY exercise_data->>'exercise_id', exercise_data->>'nombre'
ORDER BY veces_realizado DESC
LIMIT 10;

-- 📅 Últimas sesiones del usuario
SELECT
    mes.session_date,
    mes.day_name,
    mes.week_number,
    mes.total_exercises,
    mes.exercises_completed,
    mes.total_duration_seconds / 60 as duracion_minutos,
    mes.session_status
FROM app.methodology_exercise_sessions mes
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
ORDER BY mes.session_date DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────
-- 6️⃣  CONSULTAS DE EVALUACIÓN DE USUARIO
-- ─────────────────────────────────────────────────────────────

-- 👤 Ver perfil completo del usuario para evaluación IA
SELECT
    u.id,
    u.nombre,
    u.edad,
    u.sexo,
    u.peso,
    u.altura,
    u.años_entrenando,
    u.nivel_entrenamiento,
    u.objetivo_principal,
    u.historial_medico,
    u.limitaciones_fisicas,
    u.lesiones,
    u.frecuencia_semanal,
    u.metodologia_preferida
FROM app.users u
WHERE u.id = 1;  -- Cambiar por ID del usuario

-- 👥 Ver usuarios candidatos para Heavy Duty (nivel intermedio/avanzado)
SELECT
    u.id,
    u.nombre,
    u.edad,
    u.años_entrenando,
    u.nivel_entrenamiento,
    u.objetivo_principal,
    u.limitaciones_fisicas
FROM app.users u
WHERE u.nivel_entrenamiento IN ('Intermedio', 'Avanzado')
  AND u.años_entrenando >= 1
  AND (u.limitaciones_fisicas IS NULL OR array_length(u.limitaciones_fisicas, 1) = 0)
ORDER BY u.años_entrenando DESC;

-- ─────────────────────────────────────────────────────────────
-- 7️⃣  INSERTS Y UPDATES ÚTILES
-- ─────────────────────────────────────────────────────────────

-- ➕ Crear un nuevo plan Heavy Duty
-- INSERT INTO app.methodology_plans (
--     user_id,
--     methodology_type,
--     status,
--     plan_data,
--     generation_mode,
--     current_week,
--     plan_start_date
-- ) VALUES (
--     1,  -- ID del usuario
--     'Heavy Duty',
--     'draft',
--     '{"weeks": 4, "sessions_per_week": 3, "rest_between_sessions": "48-72h", "sets_per_exercise": 1, "intensity": "failure"}'::jsonb,
--     'ai',
--     1,
--     CURRENT_DATE
-- ) RETURNING id;

-- ➕ Insertar un día de entrenamiento
-- INSERT INTO app.methodology_plan_days (
--     plan_id,
--     day_id,
--     date_local,
--     day_name,
--     week_number,
--     is_rest,
--     planned_exercises_count,
--     metadata
-- ) VALUES (
--     1,  -- ID del plan
--     1,
--     CURRENT_DATE,
--     'Lunes - Empuje',
--     1,
--     false,
--     3,
--     '{"exercises": [{"exercise_id": "hd_press_banca_001", "nombre": "Press de Banca", "series": 1, "reps": "8-12 al fallo", "notas": "Cadencia 4-2-4"}], "focus": "Empuje (Pecho y Hombros)"}'::jsonb
-- );

-- ➕ Crear una sesión de entrenamiento
-- INSERT INTO app.methodology_exercise_sessions (
--     user_id,
--     methodology_plan_id,
--     methodology_type,
--     session_status,
--     started_at,
--     total_exercises,
--     is_current_session,
--     exercises_data
-- ) VALUES (
--     1,  -- ID del usuario
--     1,  -- ID del plan
--     'Heavy Duty',
--     'in_progress',
--     NOW(),
--     3,
--     true,
--     '[]'::jsonb
-- ) RETURNING id;

-- 🔄 Actualizar progreso de sesión
-- UPDATE app.methodology_exercise_sessions
-- SET
--     exercises_data = exercises_data || '[{"exercise_id": "hd_press_banca_001", "nombre": "Press de Banca", "reps": 10, "peso": 80, "completed": true, "rpe": 10}]'::jsonb,
--     exercises_completed = exercises_completed + 1,
--     current_exercise_index = current_exercise_index + 1
-- WHERE id = 1  -- ID de la sesión
--   AND is_current_session = true;

-- ✅ Completar sesión
-- UPDATE app.methodology_exercise_sessions
-- SET
--     session_status = 'completed',
--     completed_at = NOW(),
--     is_current_session = false,
--     total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::integer
-- WHERE id = 1  -- ID de la sesión
--   AND session_status = 'in_progress';

-- ─────────────────────────────────────────────────────────────
-- 8️⃣  CONSULTAS DE ANÁLISIS Y REPORTES
-- ─────────────────────────────────────────────────────────────

-- 📊 Reporte semanal de progreso
SELECT
    mes.week_number as semana,
    COUNT(DISTINCT mes.id) as sesiones_realizadas,
    COUNT(DISTINCT CASE WHEN mes.session_status = 'completed' THEN mes.id END) as sesiones_completadas,
    AVG(mes.exercises_completed::numeric / NULLIF(mes.total_exercises, 0) * 100) as porcentaje_completado_promedio,
    AVG(mes.total_duration_seconds) / 60 as duracion_promedio_minutos,
    AVG(mes.difficulty_rating) as dificultad_promedio,
    AVG(mes.effort_rating) as esfuerzo_promedio
FROM app.methodology_exercise_sessions mes
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
GROUP BY mes.week_number
ORDER BY mes.week_number;

-- 📈 Evolución de peso por ejercicio
SELECT
    exercise_data->>'exercise_id' as exercise_id,
    exercise_data->>'nombre' as ejercicio,
    mes.session_date,
    (exercise_data->>'peso')::numeric as peso,
    (exercise_data->>'reps')::integer as reps
FROM app.methodology_exercise_sessions mes,
     jsonb_array_elements(mes.exercises_data) as exercise_data
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
  AND mes.session_status = 'completed'
  AND exercise_data->>'exercise_id' = 'hd_press_banca_001'  -- Cambiar por ejercicio específico
ORDER BY mes.session_date ASC;

-- 🏆 Récords personales (PR) por ejercicio
SELECT DISTINCT ON (exercise_data->>'exercise_id')
    exercise_data->>'exercise_id' as exercise_id,
    exercise_data->>'nombre' as ejercicio,
    mes.session_date as fecha_pr,
    (exercise_data->>'peso')::numeric as peso_maximo,
    (exercise_data->>'reps')::integer as reps
FROM app.methodology_exercise_sessions mes,
     jsonb_array_elements(mes.exercises_data) as exercise_data
WHERE mes.user_id = 1  -- Cambiar por ID del usuario
  AND mes.methodology_type = 'Heavy Duty'
  AND mes.session_status = 'completed'
  AND exercise_data->>'peso' IS NOT NULL
ORDER BY
    exercise_data->>'exercise_id',
    (exercise_data->>'peso')::numeric DESC,
    mes.session_date DESC;

-- ═══════════════════════════════════════════════════════════════
-- FIN DE QUERIES HEAVY DUTY
-- ═══════════════════════════════════════════════════════════════
