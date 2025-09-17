-- ===============================================
-- SISTEMA UNIFICADO DE FEEDBACK DE USUARIOS
-- PROPÓSITO: Centralizar feedback de ejercicios para que la IA aprenda de las preferencias
-- COMPATIBILIDAD: Extiende el sistema existente sin romper HomeTrainingRejectionModal
-- FECHA: 2025-09-14
-- AUTOR: Claude Code - Entrena con IA
-- ===============================================

-- 1. TABLA UNIFICADA DE FEEDBACK DE EJERCICIOS
-- Esta tabla centraliza TODO el feedback de usuarios sobre ejercicios
CREATE TABLE IF NOT EXISTS app.user_exercise_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,

    -- Información del ejercicio
    exercise_name VARCHAR(255) NOT NULL,
    exercise_key VARCHAR(100) NOT NULL, -- versión normalizada para búsquedas
    methodology_type VARCHAR(50) NOT NULL, -- 'calistenia', 'home_training', 'hipertrofia', etc.

    -- Contexto específico del feedback
    equipment_type VARCHAR(50), -- 'minimo', 'basico', 'avanzado', 'personalizado' (para home_training)
    training_type VARCHAR(50),  -- 'funcional', 'hiit', 'fuerza' (para home_training)
    plan_id INTEGER, -- referencia al plan que generó este ejercicio
    session_id INTEGER, -- referencia a la sesión específica si aplica

    -- Tipo de feedback
    feedback_type VARCHAR(50) NOT NULL, -- 'too_difficult', 'too_easy', 'dont_like', 'love_it', 'change_focus', 'no_equipment'
    feedback_category VARCHAR(50), -- 'difficulty', 'preference', 'equipment', 'injury', 'other'

    -- Detalles del feedback
    sentiment VARCHAR(20), -- 'love', 'normal', 'hard' (compatible con methodology_exercise_feedback)
    comment TEXT, -- comentario libre del usuario
    specific_reason TEXT, -- razón específica estructurada

    -- Configuración de impacto en futuras generaciones
    avoidance_duration_days INTEGER, -- NULL = permanente, número = temporal
    avoidance_expires_at TIMESTAMP, -- calculado automáticamente
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadatos para la IA
    ai_weight DECIMAL(3,2) DEFAULT 1.0, -- peso para la IA (0.0 a 2.0, donde 1.0 = normal)
    ai_context JSONB, -- contexto adicional en JSON para la IA

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. TABLA DE PREFERENCIAS GENERALES DE USUARIO
-- Para almacenar preferencias que no están ligadas a ejercicios específicos
CREATE TABLE IF NOT EXISTS app.user_training_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,

    -- Preferencias de entrenamiento
    preferred_methodologies TEXT[] DEFAULT '{}', -- ['calistenia', 'home_training']
    avoided_methodologies TEXT[] DEFAULT '{}',

    -- Preferencias de dificultad
    prefers_challenging BOOLEAN DEFAULT NULL, -- NULL = sin preferencia
    avoids_beginner_exercises BOOLEAN DEFAULT FALSE,

    -- Preferencias de equipamiento
    available_equipment JSONB DEFAULT '{}', -- equipamiento disponible
    equipment_preferences JSONB DEFAULT '{}', -- preferencias específicas

    -- Limitaciones y restricciones
    physical_limitations TEXT[],
    injury_considerations TEXT[],
    time_constraints JSONB DEFAULT '{}', -- preferencias de duración

    -- Objetivos específicos
    focus_areas TEXT[] DEFAULT '{}', -- ['core', 'upper_body', 'cardio']
    avoided_focus_areas TEXT[] DEFAULT '{}',

    -- Preferencias de progresión
    progression_style VARCHAR(50) DEFAULT 'gradual', -- 'gradual', 'aggressive', 'conservative'
    feedback_sensitivity DECIMAL(3,2) DEFAULT 1.0, -- qué tan rápido adaptar basado en feedback

    -- Control de calidad
    learning_enabled BOOLEAN DEFAULT TRUE, -- si la IA debe aprender de este usuario
    last_preference_update TIMESTAMP DEFAULT NOW(),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_user_preferences UNIQUE(user_id)
);

-- ===============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===============================================

-- Índices para user_exercise_feedback
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_methodology
    ON app.user_exercise_feedback (user_id, methodology_type, is_active);

CREATE INDEX IF NOT EXISTS idx_user_feedback_exercise_key
    ON app.user_exercise_feedback (exercise_key, user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_feedback_type_category
    ON app.user_exercise_feedback (feedback_type, feedback_category, is_active);

CREATE INDEX IF NOT EXISTS idx_user_feedback_avoidance_expires
    ON app.user_exercise_feedback (avoidance_expires_at, is_active)
    WHERE avoidance_expires_at IS NOT NULL;

-- Índices para user_training_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_methodologies
    ON app.user_training_preferences USING GIN (preferred_methodologies);

CREATE INDEX IF NOT EXISTS idx_user_preferences_focus_areas
    ON app.user_training_preferences USING GIN (focus_areas);

-- ===============================================
-- FUNCIONES HELPER
-- ===============================================

-- Función para limpiar feedback expirado
CREATE OR REPLACE FUNCTION app.cleanup_expired_feedback()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE app.user_exercise_feedback
    SET is_active = FALSE, updated_at = NOW()
    WHERE avoidance_expires_at IS NOT NULL
      AND avoidance_expires_at <= NOW()
      AND is_active = TRUE;

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener feedback activo de un usuario
CREATE OR REPLACE FUNCTION app.get_user_exercise_feedback(
    p_user_id INTEGER,
    p_methodology_type VARCHAR(50) DEFAULT NULL,
    p_include_expired BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    exercise_name VARCHAR(255),
    exercise_key VARCHAR(100),
    feedback_type VARCHAR(50),
    feedback_category VARCHAR(50),
    sentiment VARCHAR(20),
    comment TEXT,
    avoidance_expires_at TIMESTAMP,
    days_until_expires INTEGER,
    ai_weight DECIMAL(3,2),
    created_at TIMESTAMP
) AS $$
BEGIN
    -- Limpiar feedback expirado si no se solicita incluirlo
    IF NOT p_include_expired THEN
        PERFORM app.cleanup_expired_feedback();
    END IF;

    RETURN QUERY
    SELECT
        f.exercise_name,
        f.exercise_key,
        f.feedback_type,
        f.feedback_category,
        f.sentiment,
        f.comment,
        f.avoidance_expires_at,
        CASE
            WHEN f.avoidance_expires_at IS NULL THEN NULL
            ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (f.avoidance_expires_at - NOW())) / 86400))::INTEGER
        END as days_until_expires,
        f.ai_weight,
        f.created_at
    FROM app.user_exercise_feedback f
    WHERE f.user_id = p_user_id
      AND (p_methodology_type IS NULL OR f.methodology_type = p_methodology_type)
      AND f.is_active = TRUE
      AND (p_include_expired OR f.avoidance_expires_at IS NULL OR f.avoidance_expires_at > NOW())
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar si un ejercicio debe ser evitado
CREATE OR REPLACE FUNCTION app.should_avoid_exercise(
    p_user_id INTEGER,
    p_exercise_key VARCHAR(100),
    p_methodology_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    avoidance_count INTEGER;
BEGIN
    -- Limpiar feedback expirado
    PERFORM app.cleanup_expired_feedback();

    -- Contar feedback activo que indica evitar este ejercicio
    SELECT COUNT(*)
    INTO avoidance_count
    FROM app.user_exercise_feedback
    WHERE user_id = p_user_id
      AND exercise_key = p_exercise_key
      AND methodology_type = p_methodology_type
      AND feedback_type IN ('too_difficult', 'dont_like', 'no_equipment', 'change_focus')
      AND is_active = TRUE
      AND (avoidance_expires_at IS NULL OR avoidance_expires_at > NOW());

    RETURN avoidance_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FUNCIÓN DE MIGRACIÓN DE DATOS EXISTENTES
-- ===============================================

-- Función para migrar datos de home_exercise_rejections a la nueva tabla
CREATE OR REPLACE FUNCTION app.migrate_home_rejections_to_unified_feedback()
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    rejection_record RECORD;
BEGIN
    -- Migrar rechazos de home training
    FOR rejection_record IN
        SELECT
            user_id,
            exercise_name,
            exercise_key,
            equipment_type,
            training_type,
            rejection_reason,
            rejection_category,
            rejected_at,
            expires_at,
            is_active
        FROM app.home_exercise_rejections
        WHERE is_active = TRUE
    LOOP
        -- Insertar en la tabla unificada si no existe
        INSERT INTO app.user_exercise_feedback (
            user_id,
            exercise_name,
            exercise_key,
            methodology_type,
            equipment_type,
            training_type,
            feedback_type,
            feedback_category,
            comment,
            avoidance_expires_at,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            rejection_record.user_id,
            rejection_record.exercise_name,
            rejection_record.exercise_key,
            'home_training',
            rejection_record.equipment_type,
            rejection_record.training_type,
            CASE rejection_record.rejection_category
                WHEN 'too_hard' THEN 'too_difficult'
                WHEN 'dont_like' THEN 'dont_like'
                WHEN 'injury' THEN 'dont_like'
                WHEN 'equipment' THEN 'no_equipment'
                ELSE 'dont_like'
            END,
            'preference',
            rejection_record.rejection_reason,
            rejection_record.expires_at,
            rejection_record.is_active,
            rejection_record.rejected_at,
            rejection_record.rejected_at
        WHERE NOT EXISTS (
            SELECT 1 FROM app.user_exercise_feedback
            WHERE user_id = rejection_record.user_id
              AND exercise_key = rejection_record.exercise_key
              AND methodology_type = 'home_training'
        );

        migrated_count := migrated_count + 1;
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- TRIGGER PARA ACTUALIZAR TIMESTAMPS
-- ===============================================

-- Trigger para user_exercise_feedback
CREATE OR REPLACE FUNCTION app.update_feedback_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Calcular avoidance_expires_at si se especifica duración
    IF NEW.avoidance_duration_days IS NOT NULL THEN
        NEW.avoidance_expires_at = NEW.created_at + (NEW.avoidance_duration_days || ' days')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_feedback_updated_at
    BEFORE UPDATE ON app.user_exercise_feedback
    FOR EACH ROW EXECUTE FUNCTION app.update_feedback_timestamp();

-- Trigger para user_training_preferences
CREATE OR REPLACE FUNCTION app.update_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_preference_update = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON app.user_training_preferences
    FOR EACH ROW EXECUTE FUNCTION app.update_preferences_timestamp();

-- ===============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===============================================

COMMENT ON TABLE app.user_exercise_feedback IS
'Tabla unificada para todo el feedback de usuarios sobre ejercicios. Permite que la IA aprenda preferencias y evite ejercicios no deseados.';

COMMENT ON COLUMN app.user_exercise_feedback.exercise_key IS
'Versión normalizada del nombre del ejercicio para búsquedas consistentes (sin tildes, minúsculas, espacios como _)';

COMMENT ON COLUMN app.user_exercise_feedback.methodology_type IS
'Tipo de metodología: calistenia, home_training, hipertrofia, etc.';

COMMENT ON COLUMN app.user_exercise_feedback.feedback_type IS
'Tipo específico de feedback: too_difficult, too_easy, dont_like, love_it, change_focus, no_equipment';

COMMENT ON COLUMN app.user_exercise_feedback.ai_weight IS
'Peso para la IA (0.0 a 2.0): 0.0 = ignorar, 1.0 = peso normal, 2.0 = peso alto';

COMMENT ON COLUMN app.user_exercise_feedback.avoidance_duration_days IS
'Días para evitar el ejercicio. NULL = permanente, número = temporal';

COMMENT ON TABLE app.user_training_preferences IS
'Preferencias generales de entrenamiento del usuario que influyen en la generación de planes de IA.';

-- ===============================================
-- DATOS DE EJEMPLO (COMENTADO)
-- ===============================================

/*
-- Ejemplo de inserción de feedback negativo
INSERT INTO app.user_exercise_feedback
(user_id, exercise_name, exercise_key, methodology_type, equipment_type, training_type,
 feedback_type, feedback_category, comment, avoidance_duration_days)
VALUES
(18, 'Burpees con toque en rodillas', 'burpees_con_toque_en_rodillas', 'home_training',
 'personalizado', 'hiit', 'too_difficult', 'difficulty',
 'Muy difíciles para mi nivel actual', 14);

-- Ejemplo de inserción de feedback positivo
INSERT INTO app.user_exercise_feedback
(user_id, exercise_name, exercise_key, methodology_type, feedback_type,
 feedback_category, sentiment, ai_weight)
VALUES
(18, 'Flexiones de brazos', 'flexiones_de_brazos', 'calistenia', 'love_it',
 'preference', 'love', 1.5);

-- Ejemplo de preferencias de usuario
INSERT INTO app.user_training_preferences
(user_id, preferred_methodologies, focus_areas, prefers_challenging)
VALUES
(18, ARRAY['calistenia', 'home_training'], ARRAY['core', 'upper_body'], FALSE);
*/

-- ===============================================
-- INSTRUCCIONES FINALES
-- ===============================================

-- Para migrar datos existentes (ejecutar después del setup):
-- SELECT app.migrate_home_rejections_to_unified_feedback();

-- Para limpiar feedback expirado (ejecutar periódicamente):
-- SELECT app.cleanup_expired_feedback();

-- Para consultar feedback de un usuario:
-- SELECT * FROM app.get_user_exercise_feedback(18, 'calistenia');

-- Para verificar si evitar un ejercicio:
-- SELECT app.should_avoid_exercise(18, 'burpees_con_toque_en_rodillas', 'home_training');