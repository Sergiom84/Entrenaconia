-- ===============================================================
-- SISTEMA MANUAL DE METODOLOGÍAS DE GIMNASIO
-- Separado completamente del sistema automático
-- Fecha: 1 de septiembre de 2025
-- ===============================================================

-- 1. TABLA PRINCIPAL: manual_methodology_exercise_sessions
-- Similar a methodology_exercise_sessions pero para metodologías manuales
CREATE TABLE IF NOT EXISTS app.manual_methodology_exercise_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_plan_id INTEGER NOT NULL REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
    methodology_type VARCHAR(50) NOT NULL,
    session_name VARCHAR(100) NOT NULL, -- Ej: "Heavy Duty Manual - Día 1 Semana 1"
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
    CONSTRAINT manual_methodology_sessions_status_check 
        CHECK (session_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT manual_methodology_sessions_week_valid 
        CHECK (week_number >= 1 AND week_number <= 12),
    CONSTRAINT manual_methodology_sessions_day_valid 
        CHECK (day_name IN ('Lun','Mar','Mie','Jue','Vie','Sab','Dom',
                            'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'))
);

-- 2. TABLA DE PROGRESO: manual_methodology_exercise_progress
-- Seguimiento detallado por ejercicio dentro de cada sesión manual
CREATE TABLE IF NOT EXISTS app.manual_methodology_exercise_progress (
    id SERIAL PRIMARY KEY,
    manual_methodology_session_id INTEGER NOT NULL REFERENCES app.manual_methodology_exercise_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL, -- Posición del ejercicio en la sesión (0, 1, 2, ...)
    
    -- Información del ejercicio (generado por IA manual)
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
    CONSTRAINT manual_methodology_progress_status_check 
        CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
    CONSTRAINT manual_methodology_progress_series_valid 
        CHECK (series_completed >= 0 AND series_completed <= series_total),
    CONSTRAINT manual_methodology_progress_order_valid 
        CHECK (exercise_order >= 0)
);

-- 3. TABLA DE FEEDBACK: manual_methodology_exercise_feedback
-- Valoración y comentarios del usuario sobre cada ejercicio manual
CREATE TABLE IF NOT EXISTS app.manual_methodology_exercise_feedback (
    id SERIAL PRIMARY KEY,
    manual_methodology_session_id INTEGER NOT NULL REFERENCES app.manual_methodology_exercise_sessions(id) ON DELETE CASCADE,
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
    CONSTRAINT manual_methodology_feedback_sentiment_check 
        CHECK (sentiment IN ('love', 'normal', 'hard')),
    CONSTRAINT manual_methodology_feedback_unique 
        UNIQUE (manual_methodology_session_id, exercise_order)
);

-- 4. TABLA HISTÓRICA: manual_methodology_exercise_history_complete
-- Historial completo consolidado para análisis y evitar repeticiones en IA manual
CREATE TABLE IF NOT EXISTS app.manual_methodology_exercise_history_complete (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_plan_id INTEGER NULL, -- Puede ser NULL para datos históricos migrados
    manual_methodology_session_id INTEGER NULL, -- Puede ser NULL para datos históricos migrados
    
    -- Información del ejercicio
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL,
    methodology_type VARCHAR(50) NOT NULL,
    generation_mode VARCHAR(20) NOT NULL DEFAULT 'manual', -- Siempre 'manual' para esta tabla
    
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
    CONSTRAINT manual_methodology_history_sentiment_check 
        CHECK (sentiment IS NULL OR sentiment IN ('love', 'normal', 'hard')),
    CONSTRAINT manual_methodology_history_week_valid 
        CHECK (week_number >= 1 AND week_number <= 12),
    CONSTRAINT manual_methodology_history_mode_check 
        CHECK (generation_mode = 'manual')
);

-- ===============================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===============================================================

-- Índices para manual_methodology_exercise_sessions
CREATE INDEX IF NOT EXISTS idx_manual_methodology_sessions_user_status 
    ON app.manual_methodology_exercise_sessions(user_id, session_status);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_sessions_plan 
    ON app.manual_methodology_exercise_sessions(methodology_plan_id);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_sessions_week_day 
    ON app.manual_methodology_exercise_sessions(user_id, week_number, day_name);

-- Índices para manual_methodology_exercise_progress
CREATE INDEX IF NOT EXISTS idx_manual_methodology_progress_session 
    ON app.manual_methodology_exercise_progress(manual_methodology_session_id);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_progress_user 
    ON app.manual_methodology_exercise_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_progress_exercise 
    ON app.manual_methodology_exercise_progress(exercise_name, user_id);

-- Índices para manual_methodology_exercise_feedback
CREATE INDEX IF NOT EXISTS idx_manual_methodology_feedback_user 
    ON app.manual_methodology_exercise_feedback(user_id, sentiment);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_feedback_exercise 
    ON app.manual_methodology_exercise_feedback(exercise_name, user_id);

-- Índices para manual_methodology_exercise_history_complete
CREATE INDEX IF NOT EXISTS idx_manual_methodology_history_user_exercise 
    ON app.manual_methodology_exercise_history_complete(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_history_methodology 
    ON app.manual_methodology_exercise_history_complete(user_id, methodology_type);
CREATE INDEX IF NOT EXISTS idx_manual_methodology_history_date 
    ON app.manual_methodology_exercise_history_complete(user_id, session_date);

-- ===============================================================
-- FUNCIONES DE APOYO
-- ===============================================================

-- Función para obtener ejercicios recientes del sistema manual (evitar repeticiones)
CREATE OR REPLACE FUNCTION app.get_recent_manual_exercises(
    p_user_id INTEGER,
    p_methodology_type VARCHAR(50),
    p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
    exercise_name VARCHAR(200),
    usage_count BIGINT,
    last_used DATE,
    avg_sentiment DECIMAL(3,2),
    avg_series DECIMAL(5,2),
    total_completions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.exercise_name,
        COUNT(*)::BIGINT as usage_count,
        MAX(h.session_date) as last_used,
        AVG(CASE 
            WHEN h.sentiment = 'love' THEN 1.0 
            WHEN h.sentiment = 'normal' THEN 0.5 
            WHEN h.sentiment = 'hard' THEN 0.0 
            ELSE 0.5 
        END) as avg_sentiment,
        AVG(h.series_completed::DECIMAL) as avg_series,
        SUM(CASE WHEN h.series_completed > 0 THEN 1 ELSE 0 END)::BIGINT as total_completions
    FROM app.manual_methodology_exercise_history_complete h
    WHERE h.user_id = p_user_id
        AND h.methodology_type = p_methodology_type
        AND h.session_date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
    GROUP BY h.exercise_name
    ORDER BY last_used DESC, usage_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar ejercicios de un plan manual en el historial
CREATE OR REPLACE FUNCTION app.register_manual_plan_exercises(
    p_user_id INTEGER,
    p_methodology_type VARCHAR(50),
    p_plan_data JSONB,
    p_methodology_plan_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    semana JSONB;
    sesion JSONB;
    ejercicio JSONB;
    week_num INTEGER;
BEGIN
    -- Iterar sobre semanas del plan
    FOR semana IN SELECT * FROM jsonb_array_elements(p_plan_data->'semanas')
    LOOP
        week_num := (semana->>'semana')::INTEGER;
        
        -- Iterar sobre sesiones de la semana
        FOR sesion IN SELECT * FROM jsonb_array_elements(semana->'sesiones')
        LOOP
            -- Iterar sobre ejercicios de la sesión
            FOR ejercicio IN SELECT * FROM jsonb_array_elements(sesion->'ejercicios')
            LOOP
                -- Insertar cada ejercicio en el historial manual (como referencia)
                INSERT INTO app.manual_methodology_exercise_history_complete (
                    user_id, methodology_plan_id, exercise_name, exercise_order,
                    methodology_type, generation_mode, series_total, series_completed,
                    repeticiones, intensidad, week_number, day_name,
                    session_date, completed_at
                ) VALUES (
                    p_user_id, p_methodology_plan_id, ejercicio->>'nombre', 0,
                    p_methodology_type, 'manual', 
                    COALESCE((ejercicio->>'series')::INTEGER, 3), 0,
                    ejercicio->>'repeticiones', ejercicio->>'intensidad',
                    week_num, sesion->>'dia', CURRENT_DATE, CURRENT_TIMESTAMP
                );
            END LOOP;
        END LOOP;
    END LOOP;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================
-- TRIGGERS PARA MANTENIMIENTO AUTOMÁTICO
-- ===============================================================

-- Trigger para actualizar contadores en manual_methodology_exercise_sessions
CREATE OR REPLACE FUNCTION app.update_manual_methodology_session_counters()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar contadores de la sesión
    UPDATE app.manual_methodology_exercise_sessions 
    SET 
        exercises_completed = (
            SELECT COUNT(*) 
            FROM app.manual_methodology_exercise_progress 
            WHERE manual_methodology_session_id = COALESCE(NEW.manual_methodology_session_id, OLD.manual_methodology_session_id)
            AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.manual_methodology_session_id, OLD.manual_methodology_session_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a la tabla de progreso manual
CREATE TRIGGER trigger_update_manual_methodology_session_counters
    AFTER INSERT OR UPDATE OR DELETE ON app.manual_methodology_exercise_progress
    FOR EACH ROW EXECUTE FUNCTION app.update_manual_methodology_session_counters();

-- Trigger para consolidar datos en historial manual al completar ejercicio
CREATE OR REPLACE FUNCTION app.consolidate_manual_methodology_exercise_history()
RETURNS TRIGGER AS $$
DECLARE
    session_info RECORD;
BEGIN
    -- Solo procesar si el ejercicio se marca como completado
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Obtener información de la sesión
        SELECT mes.methodology_plan_id, mes.methodology_type, mes.week_number, 
               mes.day_name, mes.completed_at::DATE as session_date
        INTO session_info
        FROM app.manual_methodology_exercise_sessions mes
        WHERE mes.id = NEW.manual_methodology_session_id;
        
        -- Obtener feedback si existe
        INSERT INTO app.manual_methodology_exercise_history_complete (
            user_id, methodology_plan_id, manual_methodology_session_id,
            exercise_name, exercise_order, methodology_type, generation_mode,
            series_total, series_completed, repeticiones, intensidad,
            tiempo_dedicado_segundos, sentiment, user_comment,
            week_number, day_name, session_date, completed_at
        )
        SELECT 
            NEW.user_id, session_info.methodology_plan_id, NEW.manual_methodology_session_id,
            NEW.exercise_name, NEW.exercise_order, session_info.methodology_type, 'manual',
            NEW.series_total, NEW.series_completed, NEW.repeticiones, NEW.intensidad,
            NEW.time_spent_seconds, mef.sentiment, mef.comment,
            session_info.week_number, session_info.day_name, 
            COALESCE(session_info.session_date, CURRENT_DATE), 
            COALESCE(NEW.completed_at, CURRENT_TIMESTAMP)
        FROM (SELECT NEW.manual_methodology_session_id, NEW.exercise_order) tmp
        LEFT JOIN app.manual_methodology_exercise_feedback mef 
            ON mef.manual_methodology_session_id = tmp.manual_methodology_session_id 
            AND mef.exercise_order = tmp.exercise_order;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a la tabla de progreso manual
CREATE TRIGGER trigger_consolidate_manual_methodology_exercise_history
    AFTER UPDATE ON app.manual_methodology_exercise_progress
    FOR EACH ROW EXECUTE FUNCTION app.consolidate_manual_methodology_exercise_history();

-- ===============================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===============================================================

COMMENT ON TABLE app.manual_methodology_exercise_sessions IS 
'Sesiones de entrenamiento para metodologías generadas manualmente. Completamente separado del sistema automático.';

COMMENT ON TABLE app.manual_methodology_exercise_progress IS 
'Progreso detallado por ejercicio en sesiones manuales. Incluye series completadas, tiempo dedicado y estado.';

COMMENT ON TABLE app.manual_methodology_exercise_feedback IS 
'Feedback del usuario sobre ejercicios en metodologías manuales. Permite sentiment y comentarios.';

COMMENT ON TABLE app.manual_methodology_exercise_history_complete IS 
'Historial completo consolidado de ejercicios de metodologías manuales. Usado para análisis y evitar repeticiones en IA.';

COMMENT ON FUNCTION app.get_recent_manual_exercises IS 
'Obtiene ejercicios recientes del usuario para evitar repeticiones en generaciones manuales de IA.';

COMMENT ON FUNCTION app.register_manual_plan_exercises IS 
'Registra todos los ejercicios de un plan manual en el historial para referencia futura de la IA.';