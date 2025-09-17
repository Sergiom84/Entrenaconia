-- =============================================
-- 📋 SISTEMA UNIFICADO DE FEEDBACK DE USUARIOS
-- =============================================
-- Creado para almacenar feedback de ejercicios de todos los usuarios
-- Compatible con HomeTrainingRejectionModal y ExerciseFeedbackModal

-- =============================================
-- 1. TABLA PRINCIPAL DE FEEDBACK
-- =============================================

CREATE TABLE IF NOT EXISTS app.user_exercise_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,

    -- Información del ejercicio
    exercise_name VARCHAR(255) NOT NULL,
    exercise_key VARCHAR(255), -- Clave única del ejercicio para referencias
    methodology_type VARCHAR(50) NOT NULL, -- 'calistenia', 'home_training', etc.

    -- Tipo de feedback
    feedback_type VARCHAR(50) NOT NULL, -- 'too_difficult', 'too_easy', 'dont_like', 'change_focus', 'love_it', 'no_equipment'

    -- Detalles del feedback
    comment TEXT, -- Comentarios adicionales del usuario
    ai_weight DECIMAL(3,2) DEFAULT 1.0, -- Peso para influir en recomendaciones IA (0.0-1.0)

    -- Duración del rechazo/preferencia
    avoidance_duration_days INTEGER, -- NULL = permanente, número = días
    expires_at TIMESTAMP, -- Calculado automáticamente

    -- Referencias opcionales
    plan_id INTEGER, -- Referencia al plan que generó este feedback
    session_id INTEGER, -- Referencia a la sesión específica

    -- Metadatos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 2. TABLA DE PREFERENCIAS GENERALES
-- =============================================

CREATE TABLE IF NOT EXISTS app.user_training_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,

    -- Preferencias generales
    preferred_methodologies TEXT[], -- ['calistenia', 'home_training']
    focus_areas TEXT[], -- ['fuerza', 'resistencia', 'flexibilidad']
    physical_limitations TEXT[], -- ['espalda', 'rodillas']
    equipment_preferences TEXT[], -- ['sin_equipo', 'barras', 'bandas']

    -- Configuración de entrenamiento
    preferred_session_duration INTEGER, -- minutos
    progression_style VARCHAR(20) DEFAULT 'gradual', -- 'gradual', 'aggressive', 'conservative'

    -- Sensibilidad al feedback
    feedback_sensitivity DECIMAL(3,2) DEFAULT 0.8, -- Cuánto influye el feedback (0.0-1.0)

    -- Metadatos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Un usuario solo puede tener un registro de preferencias
    UNIQUE(user_id)
);

-- =============================================
-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- =============================================

-- Índices principales para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_user_id
    ON app.user_exercise_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_methodology
    ON app.user_exercise_feedback(user_id, methodology_type);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_exercise
    ON app.user_exercise_feedback(exercise_name);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_type
    ON app.user_exercise_feedback(feedback_type);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_active
    ON app.user_exercise_feedback(user_id, methodology_type)
    WHERE expires_at IS NULL OR expires_at > NOW();

-- =============================================
-- 4. FUNCIÓN: OBTENER CONTEXTO DE IA DEL USUARIO
-- =============================================

CREATE OR REPLACE FUNCTION app.get_user_ai_context(
    p_user_id INTEGER,
    p_methodology_type VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user_id', p_user_id,
        'methodology_type', COALESCE(p_methodology_type, 'all'),
        'feedback_summary', (
            SELECT jsonb_build_object(
                'total_feedback_count', COUNT(*),
                'recent_feedback_count', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
                'feedback_by_type', jsonb_object_agg(feedback_type, type_count),
                'most_common_issues', array_agg(DISTINCT feedback_type ORDER BY type_count DESC) FILTER (WHERE type_count > 1)
            )
            FROM (
                SELECT
                    feedback_type,
                    COUNT(*) as type_count
                FROM app.user_exercise_feedback
                WHERE user_id = p_user_id
                    AND (p_methodology_type IS NULL OR methodology_type = p_methodology_type)
                    AND (expires_at IS NULL OR expires_at > NOW())
                GROUP BY feedback_type
            ) feedback_stats
        ),
        'preferences', (
            SELECT row_to_json(pref.*)
            FROM app.user_training_preferences pref
            WHERE pref.user_id = p_user_id
        ),
        'avoided_exercises', (
            SELECT array_agg(DISTINCT exercise_name)
            FROM app.user_exercise_feedback
            WHERE user_id = p_user_id
                AND (p_methodology_type IS NULL OR methodology_type = p_methodology_type)
                AND feedback_type IN ('too_difficult', 'dont_like', 'no_equipment')
                AND (expires_at IS NULL OR expires_at > NOW())
        ),
        'preferred_exercises', (
            SELECT array_agg(DISTINCT exercise_name)
            FROM app.user_exercise_feedback
            WHERE user_id = p_user_id
                AND (p_methodology_type IS NULL OR methodology_type = p_methodology_type)
                AND feedback_type IN ('love_it', 'perfect_difficulty')
                AND (expires_at IS NULL OR expires_at > NOW())
        ),
        'generated_at', NOW()
    ) INTO result;

    RETURN result;
END;
$$;

-- =============================================
-- 5. FUNCIÓN: OBTENER EJERCICIOS A EVITAR PARA IA
-- =============================================

CREATE OR REPLACE FUNCTION app.get_avoided_exercises_for_ai(
    p_user_id INTEGER,
    p_methodology_type VARCHAR DEFAULT NULL,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
    avoided_list TEXT[];
BEGIN
    SELECT array_agg(DISTINCT exercise_name)
    INTO avoided_list
    FROM app.user_exercise_feedback
    WHERE user_id = p_user_id
        AND (p_methodology_type IS NULL OR methodology_type = p_methodology_type)
        AND feedback_type IN ('too_difficult', 'dont_like', 'no_equipment', 'change_focus')
        AND (
            expires_at IS NULL
            OR expires_at > NOW()
            OR created_at >= NOW() - (p_days_back || ' days')::INTERVAL
        )
        AND ai_weight > 0.3; -- Solo considerar feedback con peso significativo

    RETURN COALESCE(avoided_list, ARRAY[]::TEXT[]);
END;
$$;

-- =============================================
-- 6. FUNCIÓN COMPATIBLE: GUARDAR RECHAZO (HomeTraining)
-- =============================================

CREATE OR REPLACE FUNCTION app.save_home_training_rejection_compatible(
    p_user_id INTEGER,
    p_exercise_name VARCHAR,
    p_reason VARCHAR,
    p_comment TEXT DEFAULT NULL,
    p_duration_days INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO app.user_exercise_feedback (
        user_id,
        exercise_name,
        methodology_type,
        feedback_type,
        comment,
        avoidance_duration_days,
        expires_at,
        created_at
    ) VALUES (
        p_user_id,
        p_exercise_name,
        'home_training',
        p_reason,
        p_comment,
        p_duration_days,
        CASE
            WHEN p_duration_days IS NOT NULL
            THEN NOW() + (p_duration_days || ' days')::INTERVAL
            ELSE NULL
        END,
        NOW()
    );

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- =============================================
-- 7. FUNCIÓN: GUARDAR FEEDBACK GENERAL
-- =============================================

CREATE OR REPLACE FUNCTION app.save_user_feedback(
    p_user_id INTEGER,
    p_exercise_name VARCHAR,
    p_methodology_type VARCHAR,
    p_feedback_type VARCHAR,
    p_comment TEXT DEFAULT NULL,
    p_plan_id INTEGER DEFAULT NULL,
    p_ai_weight DECIMAL DEFAULT 1.0
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO app.user_exercise_feedback (
        user_id,
        exercise_name,
        methodology_type,
        feedback_type,
        comment,
        plan_id,
        ai_weight,
        created_at
    ) VALUES (
        p_user_id,
        p_exercise_name,
        p_methodology_type,
        p_feedback_type,
        p_comment,
        p_plan_id,
        p_ai_weight,
        NOW()
    ) RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- =============================================
-- 8. FUNCIÓN: LIMPIAR FEEDBACK EXPIRADO
-- =============================================

CREATE OR REPLACE FUNCTION app.clean_expired_feedback()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.user_exercise_feedback
    WHERE expires_at IS NOT NULL
        AND expires_at <= NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

-- =============================================
-- 9. TRIGGER: ACTUALIZAR TIMESTAMP
-- =============================================

CREATE OR REPLACE FUNCTION app.update_feedback_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Aplicar trigger a ambas tablas
DROP TRIGGER IF EXISTS trg_user_exercise_feedback_updated_at ON app.user_exercise_feedback;
CREATE TRIGGER trg_user_exercise_feedback_updated_at
    BEFORE UPDATE ON app.user_exercise_feedback
    FOR EACH ROW EXECUTE FUNCTION app.update_feedback_timestamp();

DROP TRIGGER IF EXISTS trg_user_training_preferences_updated_at ON app.user_training_preferences;
CREATE TRIGGER trg_user_training_preferences_updated_at
    BEFORE UPDATE ON app.user_training_preferences
    FOR EACH ROW EXECUTE FUNCTION app.update_feedback_timestamp();

-- =============================================
-- 10. COMENTARIOS EN TABLAS
-- =============================================

COMMENT ON TABLE app.user_exercise_feedback IS 'Almacena todo el feedback de usuarios sobre ejercicios específicos';
COMMENT ON TABLE app.user_training_preferences IS 'Preferencias generales de entrenamiento de cada usuario';

COMMENT ON FUNCTION app.get_user_ai_context IS 'Obtiene contexto completo del usuario para personalización IA';
COMMENT ON FUNCTION app.get_avoided_exercises_for_ai IS 'Lista de ejercicios que la IA debe evitar para un usuario';
COMMENT ON FUNCTION app.save_user_feedback IS 'Guarda feedback general de usuario';
COMMENT ON FUNCTION app.clean_expired_feedback IS 'Limpia feedback temporal que ha expirado';

-- =============================================
-- 11. DATOS DE EJEMPLO (OPCIONAL)
-- =============================================

-- Insertar algunas preferencias de ejemplo para testing
-- NOTA: Descomentar solo para testing, no en producción
/*
INSERT INTO app.user_training_preferences (user_id, preferred_methodologies, focus_areas, progression_style)
SELECT 1, ARRAY['calistenia'], ARRAY['fuerza', 'resistencia'], 'gradual'
WHERE NOT EXISTS (SELECT 1 FROM app.user_training_preferences WHERE user_id = 1);
*/

-- =============================================
-- 🎉 INSTALACIÓN COMPLETADA
-- =============================================

SELECT 'Sistema de feedback unificado instalado correctamente' as status,
       'Tablas creadas: user_exercise_feedback, user_training_preferences' as tables,
       'Funciones creadas: 5 funciones helper para IA' as functions,
       'Compatible con HomeTrainingRejectionModal existente' as compatibility;