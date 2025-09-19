-- ========================================
-- 🏋️ REFACTORIZACIÓN CRÍTICA: CENTRALIZACION SUPABASE
-- Mejoras necesarias para eliminar localStorage y centralizar en BD
-- ========================================

-- 1. Mejorar methodology_plans con campos faltantes para estado de progreso
ALTER TABLE methodology_plans
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_day VARCHAR(20),
ADD COLUMN IF NOT EXISTS current_exercise_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plan_progress JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_session_date DATE;

-- 2. Mejorar methodology_exercise_sessions para seguimiento real-time
ALTER TABLE methodology_exercise_sessions
ADD COLUMN IF NOT EXISTS current_exercise_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS exercises_data JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_current_session BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'methodology';

-- 3. Crear tabla para tracking de ejercicios individuales por sesión (si no existe robusta)
CREATE TABLE IF NOT EXISTS exercise_session_tracking (
    id SERIAL PRIMARY KEY,
    methodology_session_id INTEGER REFERENCES methodology_exercise_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_order INTEGER NOT NULL,
    exercise_data JSONB NOT NULL DEFAULT '{}',

    -- Estado del ejercicio
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, skipped, cancelled

    -- Progreso planificado vs real
    planned_sets INTEGER DEFAULT 0,
    planned_reps VARCHAR(50) DEFAULT '0',
    planned_duration_seconds INTEGER DEFAULT 0,
    planned_rest_seconds INTEGER DEFAULT 60,

    -- Progreso real
    actual_sets INTEGER DEFAULT 0,
    actual_reps VARCHAR(50) DEFAULT '0',
    actual_duration_seconds INTEGER DEFAULT 0,
    actual_rest_seconds INTEGER DEFAULT 0,

    -- Feedback
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    effort_rating INTEGER CHECK (effort_rating >= 1 AND effort_rating <= 5),
    personal_feedback TEXT,
    was_difficult BOOLEAN,

    -- Timestamps
    started_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 4. Crear tabla para user_training_state (reemplazar localStorage)
CREATE TABLE IF NOT EXISTS user_training_state (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    -- Plan activo
    active_methodology_plan_id INTEGER REFERENCES methodology_plans(id) ON DELETE SET NULL,
    active_session_id INTEGER REFERENCES methodology_exercise_sessions(id) ON DELETE SET NULL,

    -- Estado de navegación
    current_view VARCHAR(50) DEFAULT 'methodologies',

    -- Estado de sesión activa
    is_training BOOLEAN DEFAULT false,
    current_exercise_index INTEGER DEFAULT 0,
    session_started_at TIMESTAMP WITHOUT TIME ZONE,
    session_paused_at TIMESTAMP WITHOUT TIME ZONE,

    -- Estados de modales (temporal, pero para consistencia)
    active_modals JSONB DEFAULT '{}',

    -- Metadata general
    training_metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 5. Crear todos los índices después de crear las tablas
-- Índices para methodology_plans
CREATE INDEX IF NOT EXISTS idx_methodology_plans_user_status ON methodology_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_methodology_plans_active ON methodology_plans(user_id) WHERE status = 'active';

-- Índices para methodology_exercise_sessions
CREATE INDEX IF NOT EXISTS idx_methodology_exercise_sessions_current ON methodology_exercise_sessions(user_id, is_current_session) WHERE is_current_session = true;
CREATE INDEX IF NOT EXISTS idx_methodology_exercise_sessions_user_date ON methodology_exercise_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_methodology_exercise_sessions_plan ON methodology_exercise_sessions(methodology_plan_id, session_status);

-- Índices para exercise_session_tracking
CREATE INDEX IF NOT EXISTS idx_exercise_session_tracking_session ON exercise_session_tracking(methodology_session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_session_tracking_user ON exercise_session_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_session_tracking_status ON exercise_session_tracking(status);

-- Índices para user_training_state
CREATE INDEX IF NOT EXISTS idx_user_training_state_user ON user_training_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_training_state_active_plan ON user_training_state(active_methodology_plan_id);
CREATE INDEX IF NOT EXISTS idx_user_training_state_active_session ON user_training_state(active_session_id);

-- 6. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a tablas relevantes
DROP TRIGGER IF EXISTS update_methodology_plans_updated_at ON methodology_plans;
CREATE TRIGGER update_methodology_plans_updated_at
    BEFORE UPDATE ON methodology_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_methodology_exercise_sessions_updated_at ON methodology_exercise_sessions;
CREATE TRIGGER update_methodology_exercise_sessions_updated_at
    BEFORE UPDATE ON methodology_exercise_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exercise_session_tracking_updated_at ON exercise_session_tracking;
CREATE TRIGGER update_exercise_session_tracking_updated_at
    BEFORE UPDATE ON exercise_session_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_training_state_updated_at ON user_training_state;
CREATE TRIGGER update_user_training_state_updated_at
    BEFORE UPDATE ON user_training_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_training_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Cancelar sesiones "in_progress" abandonadas por más de 24 horas
    UPDATE methodology_exercise_sessions
    SET session_status = 'cancelled',
        cancelled_at = NOW(),
        is_current_session = false
    WHERE session_status = 'in_progress'
        AND started_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;

    -- Limpiar estados de usuario para sesiones canceladas
    UPDATE user_training_state
    SET active_session_id = NULL,
        is_training = false,
        session_started_at = NULL,
        session_paused_at = NULL
    WHERE active_session_id IN (
        SELECT id FROM methodology_exercise_sessions
        WHERE session_status = 'cancelled'
    );

    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Función para obtener el plan activo de un usuario
CREATE OR REPLACE FUNCTION get_user_active_plan(p_user_id INTEGER)
RETURNS TABLE (
    plan_id INTEGER,
    plan_data JSONB,
    methodology_type VARCHAR,
    status VARCHAR,
    current_week INTEGER,
    current_day VARCHAR,
    started_at TIMESTAMP WITH TIME ZONE,
    has_active_session BOOLEAN,
    active_session_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mp.id,
        mp.plan_data,
        mp.methodology_type,
        mp.status,
        mp.current_week,
        mp.current_day,
        mp.started_at,
        (uts.active_session_id IS NOT NULL AND uts.is_training = true) as has_active_session,
        uts.active_session_id
    FROM methodology_plans mp
    LEFT JOIN user_training_state uts ON uts.active_methodology_plan_id = mp.id
    WHERE mp.user_id = p_user_id
        AND mp.status = 'active'
    ORDER BY mp.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. Vista para progreso de entrenamientos por usuario
CREATE OR REPLACE VIEW v_user_training_progress AS
SELECT
    u.id as user_id,
    u.username,

    -- Plan activo
    mp.id as active_plan_id,
    mp.methodology_type,
    mp.status as plan_status,
    mp.current_week,
    mp.current_day,

    -- Estadísticas de sesiones
    COUNT(mes.id) as total_sessions,
    COUNT(CASE WHEN mes.session_status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN mes.session_status = 'in_progress' THEN 1 END) as in_progress_sessions,
    COUNT(CASE WHEN mes.session_status = 'cancelled' THEN 1 END) as cancelled_sessions,

    -- Última actividad
    MAX(mes.updated_at) as last_training_date,

    -- Estado actual
    uts.is_training,
    uts.current_view,
    uts.active_session_id,
    uts.session_started_at as current_session_started

FROM users u
LEFT JOIN methodology_plans mp ON mp.user_id = u.id AND mp.status = 'active'
LEFT JOIN methodology_exercise_sessions mes ON mes.user_id = u.id
LEFT JOIN user_training_state uts ON uts.user_id = u.id
GROUP BY u.id, u.username, mp.id, mp.methodology_type, mp.status, mp.current_week,
         mp.current_day, uts.is_training, uts.current_view, uts.active_session_id,
         uts.session_started_at;

-- Comentarios para documentación
COMMENT ON TABLE user_training_state IS 'Reemplaza localStorage - estado de entrenamiento por usuario';
COMMENT ON TABLE exercise_session_tracking IS 'Seguimiento detallado de cada ejercicio en una sesión';
COMMENT ON FUNCTION get_user_active_plan IS 'Obtiene el plan activo de un usuario con estado de sesión';
COMMENT ON FUNCTION cleanup_expired_training_sessions IS 'Limpia sesiones de entrenamiento expiradas/abandonadas';
COMMENT ON VIEW v_user_training_progress IS 'Vista consolidada del progreso de entrenamiento por usuario';