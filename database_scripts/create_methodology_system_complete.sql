-- ===============================================================
-- SISTEMA COMPLETO DE METODOLOGÍAS DE GIMNASIO
-- Similar al sistema de Home Training pero para rutinas de gimnasio
-- Fecha: 28 de agosto de 2025
-- ===============================================================

-- 1. TABLA PRINCIPAL: methodology_exercise_sessions
-- Similar a home_training_sessions pero para metodologías
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
    
    -- Índices y restricciones
    CONSTRAINT methodology_sessions_status_check 
        CHECK (session_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT methodology_sessions_week_valid 
        CHECK (week_number >= 1 AND week_number <= 12),
    CONSTRAINT methodology_sessions_day_valid 
        CHECK (day_name IN ('Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'))
);

-- 2. TABLA DE PROGRESO: methodology_exercise_progress
-- Seguimiento detallado por ejercicio dentro de cada sesión
CREATE TABLE IF NOT EXISTS app.methodology_exercise_progress (
    id SERIAL PRIMARY KEY,
    methodology_session_id INTEGER NOT NULL REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL, -- Posición del ejercicio en la sesión (0, 1, 2, ...)
    
    -- Información del ejercicio (copiado del plan JSON)
    series_total INTEGER NOT NULL,
    repeticiones VARCHAR(20) NOT NULL, -- "8-10", "12", "30 seg", etc.
    descanso_seg INTEGER NOT NULL,
    intensidad VARCHAR(50), -- "RPE 8", "75% 1RM", etc.
    tempo VARCHAR(20), -- "2-0-2", "3-1-1", etc.
    notas TEXT,
    
    -- Información detallada del ejercicio (IA generada)
    ejercicio_ejecucion TEXT, -- Cómo realizar el ejercicio
    ejercicio_consejos TEXT, -- Tips para mejor ejecución
    ejercicio_errores_evitar TEXT, -- Errores comunes a evitar
    
    -- Progreso de ejecución
    series_completed INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, skipped, cancelled
    time_spent_seconds INTEGER NULL, -- Tiempo dedicado a este ejercicio
    
    -- Marcas de tiempo
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT methodology_progress_status_check 
        CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
    CONSTRAINT methodology_progress_series_valid 
        CHECK (series_completed >= 0 AND series_completed <= series_total),
    CONSTRAINT methodology_progress_order_valid 
        CHECK (exercise_order >= 0)
);

-- 3. TABLA DE FEEDBACK: methodology_exercise_feedback
-- Valoración y comentarios del usuario sobre cada ejercicio
CREATE TABLE IF NOT EXISTS app.methodology_exercise_feedback (
    id SERIAL PRIMARY KEY,
    methodology_session_id INTEGER NOT NULL REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL,
    
    -- Valoración del usuario
    sentiment VARCHAR(20) NOT NULL, -- 'love', 'normal', 'hard'
    comment TEXT, -- Comentario libre del usuario (opcional)
    
    -- Marcas de tiempo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT methodology_feedback_sentiment_check 
        CHECK (sentiment IN ('love', 'normal', 'hard')),
    CONSTRAINT methodology_feedback_unique 
        UNIQUE (methodology_session_id, exercise_order)
);

-- 4. TABLA HISTÓRICA: methodology_exercise_history_complete
-- Historial completo consolidado para análisis y IA
CREATE TABLE IF NOT EXISTS app.methodology_exercise_history_complete (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_plan_id INTEGER NULL, -- Puede ser NULL para datos históricos migrados
    methodology_session_id INTEGER NULL, -- Puede ser NULL para datos históricos migrados
    
    -- Información del ejercicio
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL,
    methodology_type VARCHAR(50) NOT NULL,
    
    -- Datos de entrenamiento
    series_total INTEGER NOT NULL,
    series_completed INTEGER NOT NULL,
    repeticiones VARCHAR(20) NOT NULL,
    intensidad VARCHAR(50),
    tiempo_dedicado_segundos INTEGER,
    
    -- Feedback del usuario
    sentiment VARCHAR(20), -- 'love', 'normal', 'hard'
    user_comment TEXT,
    
    -- Contexto temporal
    week_number INTEGER NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    session_date DATE NOT NULL,
    
    -- Marcas de tiempo
    completed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT methodology_history_sentiment_check 
        CHECK (sentiment IS NULL OR sentiment IN ('love', 'normal', 'hard')),
    CONSTRAINT methodology_history_week_valid 
        CHECK (week_number >= 1 AND week_number <= 12)
);

-- ===============================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===============================================================

-- Índices para methodology_exercise_sessions
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_user_status 
    ON app.methodology_exercise_sessions(user_id, session_status);
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_plan 
    ON app.methodology_exercise_sessions(methodology_plan_id);
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_week_day 
    ON app.methodology_exercise_sessions(week_number, day_name);

-- Índices para methodology_exercise_progress
CREATE INDEX IF NOT EXISTS idx_methodology_progress_session 
    ON app.methodology_exercise_progress(methodology_session_id);
CREATE INDEX IF NOT EXISTS idx_methodology_progress_user_exercise 
    ON app.methodology_exercise_progress(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_methodology_progress_status 
    ON app.methodology_exercise_progress(status);

-- Índices para methodology_exercise_feedback
CREATE INDEX IF NOT EXISTS idx_methodology_feedback_user 
    ON app.methodology_exercise_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_methodology_feedback_exercise 
    ON app.methodology_exercise_feedback(exercise_name);
CREATE INDEX IF NOT EXISTS idx_methodology_feedback_sentiment 
    ON app.methodology_exercise_feedback(sentiment);

-- Índices para methodology_exercise_history_complete
CREATE INDEX IF NOT EXISTS idx_methodology_history_user_exercise 
    ON app.methodology_exercise_history_complete(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_methodology_history_user_type 
    ON app.methodology_exercise_history_complete(user_id, methodology_type);
CREATE INDEX IF NOT EXISTS idx_methodology_history_date 
    ON app.methodology_exercise_history_complete(session_date);
CREATE INDEX IF NOT EXISTS idx_methodology_history_sentiment 
    ON app.methodology_exercise_history_complete(sentiment);

-- ===============================================================
-- FUNCIONES AUXILIARES
-- ===============================================================

-- Función para crear sesiones de metodología automáticamente
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
    -- Eliminar sesiones existentes para este plan
    DELETE FROM app.methodology_exercise_sessions 
    WHERE user_id = p_user_id AND methodology_plan_id = p_methodology_plan_id;
    
    -- Iterar sobre las semanas del plan
    FOR semana_data IN SELECT jsonb_array_elements(p_plan_data->'semanas')
    LOOP
        semana_num := (semana_data->>'semana')::INTEGER;
        
        -- Iterar sobre las sesiones de cada semana
        FOR sesion_data IN SELECT jsonb_array_elements(semana_data->'sesiones')
        LOOP
            ejercicios_count := jsonb_array_length(sesion_data->'ejercicios');
            
            -- Crear sesión
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

-- Función para obtener historial de ejercicios de metodología para la IA
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
            WHEN h.sentiment = 'love' THEN 3
            WHEN h.sentiment = 'normal' THEN 2  
            WHEN h.sentiment = 'hard' THEN 1
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
$$ LANGUAGE plpgsql;

-- ===============================================================
-- TRIGGERS PARA MANTENER CONSISTENCIA
-- ===============================================================

-- Trigger para actualizar contador de ejercicios completados en sesiones
CREATE OR REPLACE FUNCTION app.update_methodology_session_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar contador en la sesión padre
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

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_methodology_progress_update ON app.methodology_exercise_progress;
CREATE TRIGGER trigger_methodology_progress_update
    AFTER UPDATE ON app.methodology_exercise_progress
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION app.update_methodology_session_progress();

-- Trigger para consolidar en historial cuando se completa ejercicio
CREATE OR REPLACE FUNCTION app.consolidate_methodology_exercise_history()
RETURNS TRIGGER AS $$
DECLARE
    session_info RECORD;
    feedback_info RECORD;
BEGIN
    -- Obtener información de la sesión
    SELECT mes.methodology_type, mes.week_number, mes.day_name, 
           DATE(mes.started_at) as session_date, mes.methodology_plan_id
    INTO session_info
    FROM app.methodology_exercise_sessions mes
    WHERE mes.id = NEW.methodology_session_id;
    
    -- Obtener feedback si existe
    SELECT sentiment, comment
    INTO feedback_info
    FROM app.methodology_exercise_feedback
    WHERE methodology_session_id = NEW.methodology_session_id 
    AND exercise_order = NEW.exercise_order;
    
    -- Insertar en historial completo
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
        session_info.session_date,
        NEW.completed_at
    )
    ON CONFLICT DO NOTHING; -- Evitar duplicados
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_methodology_history_consolidate ON app.methodology_exercise_progress;
CREATE TRIGGER trigger_methodology_history_consolidate
    AFTER UPDATE ON app.methodology_exercise_progress
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION app.consolidate_methodology_exercise_history();

-- ===============================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===============================================================

COMMENT ON TABLE app.methodology_exercise_sessions IS 'Sesiones de entrenamiento de metodologías de gimnasio (similar a home_training_sessions)';
COMMENT ON TABLE app.methodology_exercise_progress IS 'Progreso detallado por ejercicio en metodologías con info de ejecución';
COMMENT ON TABLE app.methodology_exercise_feedback IS 'Feedback del usuario sobre ejercicios de metodologías (Me encanta/Normal/Difícil)';
COMMENT ON TABLE app.methodology_exercise_history_complete IS 'Historial consolidado para análisis de IA y estadísticas';

COMMENT ON FUNCTION app.create_methodology_exercise_sessions IS 'Crea automáticamente las sesiones de entrenamiento desde el plan JSON';
COMMENT ON FUNCTION app.get_methodology_exercise_history IS 'Obtiene historial para evitar repetición en generación de IA';

-- ===============================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- ===============================================================

-- Ejemplo de inserción para testing
/*
INSERT INTO app.methodology_exercise_sessions (
    user_id, methodology_plan_id, methodology_type, session_name, 
    week_number, day_name, total_exercises
) VALUES 
(10, 20, 'Hipertrofia', 'Hipertrofia - Día 1 Semana 1', 1, 'Lun', 4);
*/

-- ===============================================================
-- FINALIZADO - SISTEMA COMPLETO DE METODOLOGÍAS
-- ===============================================================