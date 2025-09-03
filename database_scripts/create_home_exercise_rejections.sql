-- ===============================================
-- TABLA: home_exercise_rejections
-- PROPÓSITO: Almacenar ejercicios rechazados por usuarios para evitar repetición
-- FUNCIONALIDAD: 
--   - Rechazos permanentes (expires_at = NULL)
--   - Rechazos temporales (expires_at = fecha futura)
--   - Razones contextuales para mejorar recomendaciones futuras
-- ===============================================

CREATE TABLE IF NOT EXISTS app.home_exercise_rejections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    exercise_key VARCHAR(100) NOT NULL, -- versión normalizada para búsquedas
    equipment_type VARCHAR(50) NOT NULL, -- 'minimo', 'basico', 'avanzado', 'personalizado'
    training_type VARCHAR(50) NOT NULL,  -- 'funcional', 'hiit', 'fuerza'
    rejection_reason TEXT,               -- razón libre del usuario
    rejection_category VARCHAR(50),      -- 'too_hard', 'dont_like', 'injury', 'equipment', 'other'
    rejected_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,                -- NULL = permanente, fecha = temporal
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS
-- ===============================================

-- Índice principal para búsquedas por usuario + combinación activa
CREATE INDEX IF NOT EXISTS idx_home_rejections_user_active_combo 
ON app.home_exercise_rejections (user_id, equipment_type, training_type, is_active)
WHERE is_active = true;

-- Índice para búsquedas por ejercicio específico
CREATE INDEX IF NOT EXISTS idx_home_rejections_exercise_key 
ON app.home_exercise_rejections (exercise_key, user_id, is_active)
WHERE is_active = true;

-- Índice para limpiar rechazos expirados
CREATE INDEX IF NOT EXISTS idx_home_rejections_expires_at 
ON app.home_exercise_rejections (expires_at, is_active)
WHERE expires_at IS NOT NULL AND is_active = true;

-- ===============================================
-- FUNCIÓN PARA LIMPIAR RECHAZOS EXPIRADOS
-- ===============================================

CREATE OR REPLACE FUNCTION app.cleanup_expired_rejections()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE app.home_exercise_rejections 
    SET is_active = FALSE, updated_at = NOW()
    WHERE expires_at IS NOT NULL 
      AND expires_at <= NOW() 
      AND is_active = TRUE;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FUNCIÓN PARA OBTENER EJERCICIOS RECHAZADOS
-- ===============================================

CREATE OR REPLACE FUNCTION app.get_rejected_exercises_for_combination(
    p_user_id INTEGER,
    p_equipment_type VARCHAR(50),
    p_training_type VARCHAR(50)
)
RETURNS TABLE (
    exercise_name VARCHAR(255),
    exercise_key VARCHAR(100),
    rejection_reason TEXT,
    rejection_category VARCHAR(50),
    rejected_at TIMESTAMP,
    expires_at TIMESTAMP,
    days_until_expires INTEGER
) AS $$
BEGIN
    -- Primero limpiamos rechazos expirados
    PERFORM app.cleanup_expired_rejections();
    
    -- Devolvemos rechazos activos para esta combinación
    RETURN QUERY
    SELECT 
        r.exercise_name,
        r.exercise_key,
        r.rejection_reason,
        r.rejection_category,
        r.rejected_at,
        r.expires_at,
        CASE 
            WHEN r.expires_at IS NULL THEN NULL
            ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.expires_at - NOW())) / 86400))::INTEGER
        END as days_until_expires
    FROM app.home_exercise_rejections r
    WHERE r.user_id = p_user_id
      AND r.equipment_type = p_equipment_type
      AND r.training_type = p_training_type
      AND r.is_active = TRUE
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
    ORDER BY r.rejected_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FUNCIÓN PARA VERIFICAR SI UN EJERCICIO ESTÁ RECHAZADO
-- ===============================================

CREATE OR REPLACE FUNCTION app.is_exercise_rejected(
    p_user_id INTEGER,
    p_exercise_key VARCHAR(100),
    p_equipment_type VARCHAR(50),
    p_training_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    rejection_count INTEGER;
BEGIN
    -- Limpiar rechazos expirados primero
    PERFORM app.cleanup_expired_rejections();
    
    -- Contar rechazos activos para este ejercicio
    SELECT COUNT(*)
    INTO rejection_count
    FROM app.home_exercise_rejections
    WHERE user_id = p_user_id
      AND exercise_key = p_exercise_key
      AND equipment_type = p_equipment_type
      AND training_type = p_training_type
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN rejection_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- COMENTARIOS EN LA TABLA
-- ===============================================

COMMENT ON TABLE app.home_exercise_rejections IS 'Almacena ejercicios rechazados por usuarios para evitar repetición en generación de IA';
COMMENT ON COLUMN app.home_exercise_rejections.exercise_key IS 'Versión normalizada del nombre para búsquedas (sin tildes, minúsculas, etc.)';
COMMENT ON COLUMN app.home_exercise_rejections.rejection_category IS 'Categoría del rechazo: too_hard, dont_like, injury, equipment, other';
COMMENT ON COLUMN app.home_exercise_rejections.expires_at IS 'NULL = rechazo permanente, fecha = rechazo temporal hasta esa fecha';
COMMENT ON COLUMN app.home_exercise_rejections.is_active IS 'FALSE para rechazos expirados o desactivados manualmente';

-- ===============================================
-- DATOS DE EJEMPLO (OPCIONAL - comentado por defecto)
-- ===============================================

/*
-- Ejemplo de inserción (descomenta para probar)
INSERT INTO app.home_exercise_rejections 
(user_id, exercise_name, exercise_key, equipment_type, training_type, rejection_reason, rejection_category, expires_at)
VALUES 
(18, 'Burpees con toque en rodillas', 'burpees_con_toque_en_rodillas', 'personalizado', 'hiit', 
 'Muy difíciles para mi nivel actual', 'too_hard', NOW() + INTERVAL '2 weeks');
*/