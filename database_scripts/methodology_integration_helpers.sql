-- ===============================================================
-- HELPERS INTEGRACIÓN RUTINAS ↔ METODOLOGÍAS (VERSIÓN ROBUSTA)
-- Fecha: 2025-08-28
-- ===============================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ---------------------------------------------------------------
-- 1) Sincronizar progreso de RUTINAS → METODOLOGÍAS
--    - Toma la sesión de metodología más reciente activa (pending|in_progress)
--    - Crea/actualiza el progreso del ejercicio
--    - Respeta constraints: status válido, series dentro de rango
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.sync_routine_to_methodology_progress(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_exercise_name VARCHAR(200),
    p_series_completed INTEGER,
    p_status VARCHAR(20),
    p_time_spent_seconds INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_session_id INTEGER;
    v_progress_id INTEGER;
    v_series_total INTEGER;
    v_order INTEGER;
    v_status TEXT := lower(p_status);
BEGIN
    -- Validar estado permitido por methodology_exercise_progress.status
    IF v_status NOT IN ('pending','in_progress','completed','skipped','cancelled') THEN
        RAISE NOTICE 'Estado % inválido para methodology_exercise_progress', v_status;
        RETURN FALSE;
    END IF;

    -- Buscar sesión de metodología activa
    SELECT id INTO v_session_id
    FROM app.methodology_exercise_sessions
    WHERE user_id = p_user_id
      AND methodology_plan_id = p_methodology_plan_id
      AND session_status IN ('pending', 'in_progress')
    ORDER BY COALESCE(started_at, created_at) DESC
    LIMIT 1;

    IF v_session_id IS NULL THEN
        -- No hay sesión activa para sincronizar
        RETURN FALSE;
    END IF;

    -- Buscar progreso existente
    SELECT id, series_total
      INTO v_progress_id, v_series_total
    FROM app.methodology_exercise_progress
    WHERE methodology_session_id = v_session_id
      AND user_id = p_user_id
      AND exercise_name = p_exercise_name
    LIMIT 1;

    IF v_progress_id IS NULL THEN
        -- Asignar el siguiente exercise_order disponible
        SELECT COALESCE(MAX(exercise_order) + 1, 0)
          INTO v_order
        FROM app.methodology_exercise_progress
        WHERE methodology_session_id = v_session_id;

        -- Fijar un series_total mínimo coherente con p_series_completed
        v_series_total := GREATEST(COALESCE(p_series_completed,0), 1);

        INSERT INTO app.methodology_exercise_progress (
            methodology_session_id,
            user_id,
            exercise_name,
            exercise_order,
            series_total,
            repeticiones,
            descanso_seg,
            intensidad,
            series_completed,
            status,
            time_spent_seconds,
            started_at,
            completed_at
        ) VALUES (
            v_session_id,
            p_user_id,
            p_exercise_name,
            v_order,
            v_series_total,
            '8-10',      -- por defecto
            90,          -- por defecto
            'RPE 8',     -- por defecto
            LEAST(GREATEST(COALESCE(p_series_completed,0), 0), v_series_total),
            v_status,
            p_time_spent_seconds,
            CASE WHEN v_status IN ('in_progress','completed') THEN NOW() ELSE NULL END,
            CASE WHEN v_status = 'completed' THEN NOW() ELSE NULL END
        );
    ELSE
        -- Clamp de series_completed al rango [0, series_total]
        UPDATE app.methodology_exercise_progress
        SET series_completed   = LEAST(GREATEST(COALESCE(p_series_completed,0), 0), series_total),
            status             = v_status,
            time_spent_seconds = COALESCE(p_time_spent_seconds, time_spent_seconds),
            started_at         = CASE 
                                   WHEN v_status IN ('in_progress','completed') AND started_at IS NULL 
                                   THEN NOW() 
                                   ELSE started_at 
                                 END,
            completed_at       = CASE 
                                   WHEN v_status = 'completed' AND completed_at IS NULL 
                                   THEN NOW() 
                                   ELSE completed_at 
                                 END,
            updated_at         = NOW()
        WHERE id = v_progress_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------
-- 2) Añadir FEEDBACK en METODOLOGÍAS (Upsert por sesión+orden)
--    - Usa la sesión más reciente del plan
--    - Normaliza sentiment a minúsculas; permite NULL
--    - Respeta constraint UNIQUE (methodology_session_id, exercise_order)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.add_methodology_feedback(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_exercise_name VARCHAR(200),
    p_sentiment VARCHAR(20) DEFAULT NULL,
    p_comment TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_session_id INTEGER;
    v_exercise_order INTEGER;
    v_sent TEXT := CASE WHEN p_sentiment IS NULL THEN NULL ELSE lower(p_sentiment) END;
BEGIN
    -- Validación opcional del catálogo de sentiments (NULL permitido)
    IF v_sent IS NOT NULL AND v_sent NOT IN ('love','normal','hard') THEN
        RAISE NOTICE 'Sentiment % inválido. Debe ser love|normal|hard o NULL.', v_sent;
        RETURN FALSE;
    END IF;

    -- Sesión más reciente (del plan y usuario)
    SELECT mes.id
      INTO v_session_id
    FROM app.methodology_exercise_sessions mes
    WHERE mes.user_id = p_user_id
      AND mes.methodology_plan_id = p_methodology_plan_id
    ORDER BY COALESCE(mes.started_at, mes.created_at) DESC
    LIMIT 1;

    IF v_session_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Orden del ejercicio si existe en progreso; si no, 0
    SELECT exercise_order
      INTO v_exercise_order
    FROM app.methodology_exercise_progress
    WHERE methodology_session_id = v_session_id
      AND exercise_name = p_exercise_name
    ORDER BY exercise_order
    LIMIT 1;

    v_exercise_order := COALESCE(v_exercise_order, 0);

    -- Upsert sobre constraint UNIQUE(methodology_session_id, exercise_order)
    INSERT INTO app.methodology_exercise_feedback (
        methodology_session_id,
        user_id,
        exercise_name,
        exercise_order,
        sentiment,
        comment
    ) VALUES (
        v_session_id,
        p_user_id,
        p_exercise_name,
        v_exercise_order,
        v_sent,
        p_comment
    )
    ON CONFLICT ON CONSTRAINT methodology_feedback_unique
    DO UPDATE SET
        sentiment  = EXCLUDED.sentiment,
        comment    = EXCLUDED.comment,
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------
-- 3) Estadísticas rápidas por plan de metodología
--    - Totales y completados de sesiones/ejercicios
--    - Conteo de favoritos/difíciles sin sobreconteo (DISTINCT par sesión+orden)
--    - Duración media de sesión en minutos (redondeada)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.get_methodology_stats_quick(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER
) RETURNS TABLE (
    total_sessions INTEGER,
    completed_sessions INTEGER,
    total_exercises INTEGER,
    completed_exercises INTEGER,
    love_exercises INTEGER,
    hard_exercises INTEGER,
    avg_session_duration NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT mes.id AS session_id,
               mes.total_exercises,
               mes.exercises_completed,
               mes.session_status,
               mes.total_duration_seconds
        FROM app.methodology_exercise_sessions mes
        WHERE mes.user_id = p_user_id
          AND mes.methodology_plan_id = p_methodology_plan_id
    ),
    fb AS (
        SELECT f.methodology_session_id AS session_id,
               f.exercise_order,
               f.sentiment
        FROM app.methodology_exercise_feedback f
        JOIN base b ON b.session_id = f.methodology_session_id
    )
    SELECT 
        (SELECT COUNT(*) FROM base)::INTEGER AS total_sessions,
        (SELECT COUNT(*) FROM base WHERE session_status = 'completed')::INTEGER AS completed_sessions,
        COALESCE((SELECT SUM(b.total_exercises) FROM base b), 0)::INTEGER AS total_exercises,
        COALESCE((SELECT SUM(b.exercises_completed) FROM base b), 0)::INTEGER AS completed_exercises,
        -- Contar ejercicios únicos marcados como 'love' por sesión+orden
        COALESCE((
            SELECT COUNT(DISTINCT (session_id, exercise_order)) 
            FROM fb WHERE sentiment = 'love'
        ), 0)::INTEGER AS love_exercises,
        COALESCE((
            SELECT COUNT(DISTINCT (session_id, exercise_order)) 
            FROM fb WHERE sentiment = 'hard'
        ), 0)::INTEGER AS hard_exercises,
        -- Duración media de sesión (min)
        ROUND( (SELECT AVG(NULLIF(b.total_duration_seconds,0)) FROM base b) / 60.0, 2 ) AS avg_session_duration
    ;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===============================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===============================================================

COMMENT ON FUNCTION app.sync_routine_to_methodology_progress IS
  'Sincroniza progreso de rutinas al sistema de metodologías; valida estado y respeta constraints.';

COMMENT ON FUNCTION app.add_methodology_feedback IS
  'Upsert de feedback (sentiment opcional) por sesión+orden de ejercicio en metodologías.';

COMMENT ON FUNCTION app.get_methodology_stats_quick IS
  'Resumen de sesiones/ejercicios y feedback (sin sobreconteo) + duración media por plan.';