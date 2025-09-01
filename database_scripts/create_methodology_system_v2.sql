-- ===============================================================
-- SISTEMA COMPLETO DE METODOLOGÍAS DE GIMNASIO (VERSIÓN REFORZADA)
-- Fecha: 28-08-2025
-- Objetivo: Aislar por metodología el histórico (sesiones, progreso,
--           feedback y consolidado) y evitar conflictos/duplicados.
-- ===============================================================

CREATE SCHEMA IF NOT EXISTS app;

-- -----------------------------------------------------------------
-- 0) Helper: trigger genérico para updated_at
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- ===============================================================
-- 1) TABLA PRINCIPAL: methodology_exercise_sessions
-- ===============================================================
CREATE TABLE IF NOT EXISTS app.methodology_exercise_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_plan_id INTEGER NOT NULL REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
    methodology_type VARCHAR(50) NOT NULL,
    session_name VARCHAR(100) NOT NULL, -- Ej: "Hipertrofia - Día 1 Semana 1"
    week_number INTEGER NOT NULL DEFAULT 1,
    day_name VARCHAR(20) NOT NULL, -- Lun, Mar, Mie, Jue, Vie, Sab, Dom
    total_exercises INTEGER NOT NULL DEFAULT 0,
    exercises_completed INTEGER NOT NULL DEFAULT 0,
    session_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    total_duration_seconds INTEGER NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_sessions_status_check 
        CHECK (session_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT methodology_sessions_week_valid 
        CHECK (week_number >= 1 AND week_number <= 12),
    CONSTRAINT methodology_sessions_day_valid 
        CHECK (day_name IN ('Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_user_status 
    ON app.methodology_exercise_sessions(user_id, session_status);
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_plan 
    ON app.methodology_exercise_sessions(methodology_plan_id);
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_week_day 
    ON app.methodology_exercise_sessions(week_number, day_name);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_mes_updated_at ON app.methodology_exercise_sessions;
CREATE TRIGGER trg_mes_updated_at
BEFORE UPDATE ON app.methodology_exercise_sessions
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ===============================================================
-- 2) TABLA DE PROGRESO: methodology_exercise_progress
-- ===============================================================
CREATE TABLE IF NOT EXISTS app.methodology_exercise_progress (
    id SERIAL PRIMARY KEY,
    methodology_session_id INTEGER NOT NULL REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL, -- 0,1,2...
    -- Copiado del plan
    series_total INTEGER NOT NULL,
    repeticiones VARCHAR(20) NOT NULL, -- "8-10", "12", "30 seg", etc.
    descanso_seg INTEGER NOT NULL,
    intensidad VARCHAR(50),  -- "RPE 8", "75% 1RM"
    tempo VARCHAR(20),       -- "2-0-2"
    notas TEXT,
    -- Info IA ampliada
    ejercicio_ejecucion TEXT,
    ejercicio_consejos TEXT,
    ejercicio_errores_evitar TEXT,
    -- Progreso
    series_completed INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, skipped, cancelled
    time_spent_seconds INTEGER NULL,
    -- Tiempos
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_progress_status_check 
        CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
    CONSTRAINT methodology_progress_series_valid 
        CHECK (series_completed >= 0 AND series_completed <= series_total),
    CONSTRAINT methodology_progress_order_valid 
        CHECK (exercise_order >= 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_methodology_progress_session 
    ON app.methodology_exercise_progress(methodology_session_id);
CREATE INDEX IF NOT EXISTS idx_methodology_progress_user_exercise 
    ON app.methodology_exercise_progress(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_methodology_progress_status 
    ON app.methodology_exercise_progress(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_mep_updated_at ON app.methodology_exercise_progress;
CREATE TRIGGER trg_mep_updated_at
BEFORE UPDATE ON app.methodology_exercise_progress
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ===============================================================
-- 3) TABLA DE FEEDBACK: methodology_exercise_feedback
-- ===============================================================
CREATE TABLE IF NOT EXISTS app.methodology_exercise_feedback (
    id SERIAL PRIMARY KEY,
    methodology_session_id INTEGER NOT NULL REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL,
    -- Valoración del usuario (opcional como en Home)
    sentiment VARCHAR(20) NULL, -- 'love', 'normal', 'hard' o NULL
    comment TEXT,               -- Comentario libre (opcional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_feedback_sentiment_check 
        CHECK (sentiment IS NULL OR sentiment IN ('love', 'normal', 'hard')),
    CONSTRAINT methodology_feedback_unique 
        UNIQUE (methodology_session_id, exercise_order)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_methodology_feedback_user 
    ON app.methodology_exercise_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_methodology_feedback_exercise 
    ON app.methodology_exercise_feedback(exercise_name);
CREATE INDEX IF NOT EXISTS idx_methodology_feedback_sentiment 
    ON app.methodology_exercise_feedback(sentiment);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_mef_updated_at ON app.methodology_exercise_feedback;
CREATE TRIGGER trg_mef_updated_at
BEFORE UPDATE ON app.methodology_exercise_feedback
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ===============================================================
-- 4) TABLA HISTÓRICA: methodology_exercise_history_complete
-- ===============================================================
DROP TABLE IF EXISTS app.methodology_exercise_history_complete CASCADE;
CREATE TABLE app.methodology_exercise_history_complete (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_plan_id INTEGER NULL,
    methodology_session_id INTEGER NULL,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL,
    methodology_type VARCHAR(50) NOT NULL,
    series_total INTEGER NOT NULL,
    series_completed INTEGER NOT NULL,
    repeticiones VARCHAR(20) NOT NULL,
    intensidad VARCHAR(50),
    tiempo_dedicado_segundos INTEGER,
    sentiment VARCHAR(20), -- 'love', 'normal', 'hard' o NULL
    user_comment TEXT,
    week_number INTEGER NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    session_date DATE NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_history_sentiment_check 
        CHECK (sentiment IS NULL OR sentiment IN ('love', 'normal', 'hard')),
    CONSTRAINT methodology_history_week_valid 
        CHECK (week_number >= 1 AND week_number <= 12)
);

-- Clave única para evitar duplicados al consolidar
ALTER TABLE app.methodology_exercise_history_complete
  ADD CONSTRAINT uq_mhistory_unique
  UNIQUE (user_id, methodology_session_id, exercise_order, completed_at);

-- Índices de acceso
CREATE INDEX IF NOT EXISTS idx_methodology_history_user_exercise 
    ON app.methodology_exercise_history_complete(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_methodology_history_user_type 
    ON app.methodology_exercise_history_complete(user_id, methodology_type);
CREATE INDEX IF NOT EXISTS idx_methodology_history_date 
    ON app.methodology_exercise_history_complete(session_date);
CREATE INDEX IF NOT EXISTS idx_methodology_history_sentiment 
    ON app.methodology_exercise_history_complete(sentiment);

-- ===============================================================
-- 5) FUNCIONES AUXILIARES
-- ===============================================================

-- 5.1 Crear sesiones desde un plan JSONB
CREATE OR REPLACE FUNCTION app.create_methodology_exercise_sessions(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_plan_data JSONB
) RETURNS VOID AS $$
DECLARE
    semana_data JSONB;
    sesion_data JSONB;
    semana_num INTEGER;
    ejercicios_count INTEGER;
BEGIN
    -- Idempotencia: eliminar sesiones previas del mismo plan/usuario
    DELETE FROM app.methodology_exercise_sessions 
    WHERE user_id = p_user_id AND methodology_plan_id = p_methodology_plan_id;
    
    -- Semanas
    FOR semana_data IN SELECT jsonb_array_elements(p_plan_data->'semanas')
    LOOP
        semana_num := (semana_data->>'semana')::INTEGER;
        -- Sesiones por semana
        FOR sesion_data IN SELECT jsonb_array_elements(semana_data->'sesiones')
        LOOP
            ejercicios_count := jsonb_array_length(sesion_data->'ejercicios');
            INSERT INTO app.methodology_exercise_sessions (
                user_id,
                methodology_plan_id,
                methodology_type,
                session_name,
                week_number,
                day_name,
                total_exercises,
                exercises_completed,
                session_status
            ) VALUES (
                p_user_id,
                p_methodology_plan_id,
                p_plan_data->>'selected_style',
                CONCAT(p_plan_data->>'selected_style', ' - ', sesion_data->>'dia', ' Semana ', semana_num),
                semana_num,
                sesion_data->>'dia',
                ejercicios_count,
                0,
                'pending'
            );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5.2 Historial agregado para IA (últimos 60 días)
CREATE OR REPLACE FUNCTION app.get_methodology_exercise_history(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 30
) RETURNS TABLE (
    exercise_name VARCHAR,
    methodology_type VARCHAR,
    times_used BIGINT,
    last_used_at TIMESTAMP,
    avg_sentiment NUMERIC,
    last_sentiment VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.exercise_name,
        h.methodology_type,
        COUNT(*)::BIGINT as times_used,
        MAX(h.completed_at) as last_used_at,
        ROUND(AVG(CASE 
            WHEN h.sentiment = 'love'   THEN 3
            WHEN h.sentiment = 'normal' THEN 2  
            WHEN h.sentiment = 'hard'   THEN 1
            ELSE NULL
        END), 2) as avg_sentiment,
        (array_agg(h.sentiment ORDER BY h.completed_at DESC))[1] as last_sentiment
    FROM app.methodology_exercise_history_complete h
    WHERE h.user_id = p_user_id
      AND h.completed_at >= NOW() - INTERVAL '60 days'
    GROUP BY h.exercise_name, h.methodology_type
    ORDER BY MAX(h.completed_at) DESC, COUNT(*) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===============================================================
-- 6) TRIGGERS DE CONSISTENCIA
-- ===============================================================

-- 6.1 Actualizar contador de completados en la sesión
CREATE OR REPLACE FUNCTION app.update_methodology_session_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE app.methodology_exercise_sessions 
    SET 
        exercises_completed = (
            SELECT COUNT(*) 
            FROM app.methodology_exercise_progress 
            WHERE methodology_session_id = NEW.methodology_session_id 
              AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.methodology_session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_methodology_progress_update ON app.methodology_exercise_progress;
CREATE TRIGGER trigger_methodology_progress_update
    AFTER UPDATE ON app.methodology_exercise_progress
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
    EXECUTE FUNCTION app.update_methodology_session_progress();

-- 6.2 Consolidar en histórico al completar un ejercicio
CREATE OR REPLACE FUNCTION app.consolidate_methodology_exercise_history()
RETURNS TRIGGER AS $$
DECLARE
    session_info RECORD;
    feedback_info RECORD;
    v_session_date DATE;
BEGIN
    -- Info de sesión
    SELECT 
        mes.methodology_type, 
        mes.week_number, 
        mes.day_name, 
        mes.started_at,
        mes.methodology_plan_id
    INTO session_info
    FROM app.methodology_exercise_sessions mes
    WHERE mes.id = NEW.methodology_session_id;

    -- Fecha de sesión segura (NOT NULL)
    v_session_date := COALESCE(DATE(session_info.started_at), DATE(NEW.completed_at), CURRENT_DATE);

    -- Feedback (si existe; unique por sesión+orden)
    SELECT f.sentiment, f.comment
    INTO feedback_info
    FROM app.methodology_exercise_feedback f
    WHERE f.methodology_session_id = NEW.methodology_session_id 
      AND f.exercise_order = NEW.exercise_order;

    -- Consolidado (evitar duplicados con UNIQUE)
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
    ) VALUES (
        NEW.user_id,
        session_info.methodology_plan_id,
        NEW.methodology_session_id,
        NEW.exercise_name,
        NEW.exercise_order,
        session_info.methodology_type,
        NEW.series_total,
        NEW.series_completed,
        NEW.repeticiones,
        NEW.intensidad,
        NEW.time_spent_seconds,
        feedback_info.sentiment,
        feedback_info.comment,
        session_info.week_number,
        session_info.day_name,
        v_session_date,
        COALESCE(NEW.completed_at, NOW())
    )
    ON CONFLICT ON CONSTRAINT uq_mhistory_unique DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_methodology_history_consolidate ON app.methodology_exercise_progress;
CREATE TRIGGER trigger_methodology_history_consolidate
    AFTER UPDATE ON app.methodology_exercise_progress
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
    EXECUTE FUNCTION app.consolidate_methodology_exercise_history();

-- ===============================================================
-- 7) MIGRACIÓN DE DATOS HISTÓRICOS
-- ===============================================================

-- Migrar desde exercise_history al nuevo sistema
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
    COALESCE(eh.plan_id, 0) as methodology_plan_id,
    NULL as methodology_session_id,
    eh.exercise_name,
    0 as exercise_order,
    eh.methodology_type,
    4 as series_total,
    4 as series_completed,
    '8-10' as repeticiones,
    'RPE 8' as intensidad,
    NULL as tiempo_dedicado_segundos,
    NULL as sentiment,
    NULL as user_comment,
    eh.week_number,
    eh.day_name,
    DATE(eh.used_at) as session_date,
    eh.used_at as completed_at
FROM app.exercise_history eh
WHERE eh.exercise_name IS NOT NULL
AND eh.used_at IS NOT NULL
-- Evitar duplicados en reinserción
ON CONFLICT ON CONSTRAINT uq_mhistory_unique DO NOTHING;

-- ===============================================================
-- 8) COMENTARIOS
-- ===============================================================
COMMENT ON TABLE app.methodology_exercise_sessions IS 'Sesiones de entrenamiento de metodologías de gimnasio (similar a home_training_sessions), aisladas por metodología.';
COMMENT ON TABLE app.methodology_exercise_progress IS 'Progreso detallado por ejercicio en metodologías con info de ejecución IA.';
COMMENT ON TABLE app.methodology_exercise_feedback IS 'Feedback del usuario (sentiment opcional) y comentarios por ejercicio en metodologías.';
COMMENT ON TABLE app.methodology_exercise_history_complete IS 'Historial consolidado (sin duplicados) para IA y estadísticas.';
COMMENT ON FUNCTION app.create_methodology_exercise_sessions IS 'Crea sesiones a partir del plan JSON (semanas/sesiones/ejercicios).';
COMMENT ON FUNCTION app.get_methodology_exercise_history IS 'Agregado de uso por ejercicio/metodología en últimos 60 días.';
COMMENT ON FUNCTION app.update_methodology_session_progress IS 'Sincroniza ejercicios completados en la sesión tras marcar un ejercicio como completed.';
COMMENT ON FUNCTION app.consolidate_methodology_exercise_history IS 'Inserta en histórico al completar ejercicio, con fecha de sesión segura.';

-- ===============================================================
-- FIN - SISTEMA COMPLETO Y ROBUSTO
-- ===============================================================