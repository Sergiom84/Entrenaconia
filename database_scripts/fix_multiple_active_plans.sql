-- ===============================================================
-- FIX PARA MÚLTIPLES PLANES ACTIVOS SIMULTÁNEAMENTE
-- Fecha: 9 de septiembre de 2025
-- Problema: Usuario 19 tiene 21 methodology_plans activos
-- ===============================================================

-- PASO 1: CONSTRAINT para prevenir múltiples plans activos por usuario
-- Solo puede haber UN methodology_plan activo por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_methodology_plan 
    ON app.methodology_plans(user_id) 
    WHERE status = 'active';

-- Solo puede haber UN routine_plan activo por usuario  
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_routine_plan 
    ON app.routine_plans(user_id) 
    WHERE status = 'active' AND is_active = true;

-- PASO 2: FUNCIÓN ATÓMICA para activar plan (con cancelación automática)
CREATE OR REPLACE FUNCTION app.activate_plan_atomic(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_routine_plan_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_active_methodology INTEGER;
    v_current_active_routine INTEGER;
    v_updated_methodology INTEGER := 0;
    v_updated_routine INTEGER := 0;
BEGIN
    -- Verificar si ya hay un plan activo (para debugging)
    SELECT COUNT(*) INTO v_current_active_methodology
    FROM app.methodology_plans 
    WHERE user_id = p_user_id AND status = 'active';
    
    SELECT COUNT(*) INTO v_current_active_routine
    FROM app.routine_plans 
    WHERE user_id = p_user_id AND status = 'active' AND is_active = true;
    
    IF v_current_active_methodology > 0 OR v_current_active_routine > 0 THEN
        RAISE NOTICE 'Usuario % tiene planes activos: methodology=%, routine=%', 
            p_user_id, v_current_active_methodology, v_current_active_routine;
    END IF;

    -- PASO 1: Cancelar TODOS los planes anteriores del usuario (ATÓMICO)
    UPDATE app.methodology_plans 
    SET status = 'cancelled', updated_at = NOW() 
    WHERE user_id = p_user_id AND status = 'active' AND id != p_methodology_plan_id;
    
    UPDATE app.routine_plans 
    SET status = 'cancelled', is_active = false, updated_at = NOW() 
    WHERE user_id = p_user_id AND (status = 'active' OR is_active = true)
      AND id != COALESCE(p_routine_plan_id, -1);

    -- PASO 2: Activar el nuevo plan
    UPDATE app.methodology_plans 
    SET status = 'active', confirmed_at = NOW(), updated_at = NOW()
    WHERE id = p_methodology_plan_id AND user_id = p_user_id;
    
    GET DIAGNOSTICS v_updated_methodology = ROW_COUNT;

    -- PASO 3: Activar routine_plan si se proporciona
    IF p_routine_plan_id IS NOT NULL THEN
        UPDATE app.routine_plans 
        SET status = 'active', is_active = true, confirmed_at = NOW(), updated_at = NOW()
        WHERE id = p_routine_plan_id AND user_id = p_user_id;
        
        GET DIAGNOSTICS v_updated_routine = ROW_COUNT;
    END IF;

    -- Verificar que la activación fue exitosa
    IF v_updated_methodology = 0 THEN
        RAISE EXCEPTION 'No se pudo activar methodology_plan ID % para usuario %', 
            p_methodology_plan_id, p_user_id;
    END IF;

    RAISE NOTICE 'Plan activado exitosamente: methodology=%, routine=%', 
        v_updated_methodology, v_updated_routine;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- PASO 3: FUNCIÓN mejorada confirm_routine_plan (reemplaza la existente)
CREATE OR REPLACE FUNCTION app.confirm_routine_plan(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_routine_plan_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Usar la nueva función atómica
    RETURN app.activate_plan_atomic(p_user_id, p_methodology_plan_id, p_routine_plan_id);
END;
$$ LANGUAGE plpgsql;

-- PASO 4: TRIGGER para mantener consistencia entre status e is_active
CREATE OR REPLACE FUNCTION app.sync_routine_plan_status() 
RETURNS TRIGGER AS $$
BEGIN
    -- Si status cambió, sincronizar is_active
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.is_active := (NEW.status = 'active');
    END IF;
    
    -- Si is_active cambió, sincronizar status
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        NEW.status := CASE WHEN NEW.is_active THEN 'active' ELSE 'cancelled' END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a routine_plans
DROP TRIGGER IF EXISTS trigger_sync_routine_plan_status ON app.routine_plans;
CREATE TRIGGER trigger_sync_routine_plan_status
    BEFORE UPDATE ON app.routine_plans
    FOR EACH ROW 
    EXECUTE FUNCTION app.sync_routine_plan_status();

-- PASO 5: COMENTARIOS de documentación
COMMENT ON FUNCTION app.activate_plan_atomic IS 
    'Activa un plan de forma atómica: cancela todos los planes anteriores del usuario y activa el nuevo plan.';

COMMENT ON INDEX idx_unique_active_methodology_plan IS 
    'Previene múltiples methodology_plans activos por usuario';

COMMENT ON INDEX idx_unique_active_routine_plan IS 
    'Previene múltiples routine_plans activos por usuario';

-- ===============================================================
-- VERIFICACIONES FINALES
-- ===============================================================

-- Mostrar usuarios con múltiples planes activos ANTES del fix
SELECT 
    user_id,
    COUNT(*) as planes_activos_methodology
FROM app.methodology_plans 
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY planes_activos_methodology DESC;

SELECT 
    user_id,
    COUNT(*) as planes_activos_routine
FROM app.routine_plans 
WHERE status = 'active' AND is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY planes_activos_routine DESC;