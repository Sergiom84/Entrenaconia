-- ===============================================================
-- AGREGAR ESTADO DE CONFIRMACIÓN A LAS RUTINAS
-- Fecha: 1 de septiembre de 2025
-- Objetivo: Permitir que las rutinas se generen como "draft" 
--           y solo se activen cuando el usuario confirma
-- ===============================================================

-- Agregar columna status a methodology_plans
ALTER TABLE app.methodology_plans 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';

-- Agregar constraint para el status
ALTER TABLE app.methodology_plans 
ADD CONSTRAINT IF NOT EXISTS methodology_plans_status_check 
CHECK (status IN ('draft', 'active', 'completed', 'cancelled'));

-- Agregar columna confirmed_at para tracking
ALTER TABLE app.methodology_plans 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP NULL;

-- Agregar las mismas columnas a routine_plans
ALTER TABLE app.routine_plans 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';

ALTER TABLE app.routine_plans 
ADD CONSTRAINT IF NOT EXISTS routine_plans_status_check 
CHECK (status IN ('draft', 'active', 'completed', 'cancelled'));

ALTER TABLE app.routine_plans 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP NULL;

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_methodology_plans_status 
    ON app.methodology_plans(user_id, status);

CREATE INDEX IF NOT EXISTS idx_routine_plans_status 
    ON app.routine_plans(user_id, status);

-- Actualizar planes existentes como 'active' (retrocompatibilidad)
UPDATE app.methodology_plans 
SET status = 'active', confirmed_at = created_at 
WHERE status = 'draft' AND created_at < NOW() - INTERVAL '1 hour';

UPDATE app.routine_plans 
SET status = 'active', confirmed_at = created_at 
WHERE status = 'draft' AND created_at < NOW() - INTERVAL '1 hour';

-- Función para confirmar un plan
CREATE OR REPLACE FUNCTION app.confirm_routine_plan(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_routine_plan_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Confirmar methodology_plan
    UPDATE app.methodology_plans 
    SET status = 'active', 
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_methodology_plan_id 
      AND user_id = p_user_id 
      AND status = 'draft';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Si se proporcionó routine_plan_id, confirmarlo también
    IF p_routine_plan_id IS NOT NULL THEN
        UPDATE app.routine_plans 
        SET status = 'active', 
            confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_routine_plan_id 
          AND user_id = p_user_id 
          AND status = 'draft';
    END IF;
    
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Comentarios de documentación
COMMENT ON COLUMN app.methodology_plans.status IS 'Estado del plan: draft (generado pero no confirmado), active (confirmado por el usuario), completed (finalizado), cancelled (cancelado)';
COMMENT ON COLUMN app.methodology_plans.confirmed_at IS 'Fecha y hora cuando el usuario confirmó el plan presionando "Comenzar entrenamiento"';

COMMENT ON COLUMN app.routine_plans.status IS 'Estado del plan de rutina: draft (generado pero no confirmado), active (confirmado por el usuario), completed (finalizado), cancelled (cancelado)';
COMMENT ON COLUMN app.routine_plans.confirmed_at IS 'Fecha y hora cuando el usuario confirmó el plan presionando "Comenzar entrenamiento"';

COMMENT ON FUNCTION app.confirm_routine_plan IS 'Confirma un plan de rutina cambiando su estado de draft a active cuando el usuario presiona "Comenzar entrenamiento"';

-- ===============================================================
-- VERIFICACIONES FINALES
-- ===============================================================

-- Mostrar estadísticas después del cambio
SELECT 
    'methodology_plans' as tabla,
    status,
    COUNT(*) as cantidad
FROM app.methodology_plans 
GROUP BY status
UNION ALL
SELECT 
    'routine_plans' as tabla,
    status,
    COUNT(*) as cantidad
FROM app.routine_plans 
GROUP BY status
ORDER BY tabla, status;