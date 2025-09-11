-- ===============================================================
-- SCRIPT DE LIMPIEZA DE DATOS: PLANES ACTIVOS DUPLICADOS
-- Fecha: 9 de septiembre de 2025
-- Problema: Usuario 19 tiene 21 methodology_plans activos
-- ===============================================================

BEGIN;

-- REPORTE PRE-LIMPIEZA
SELECT 
    '=== REPORTE PRE-LIMPIEZA ===' as info,
    NOW() as timestamp;

-- Usuarios con múltiples methodology_plans activos
SELECT 
    'METHODOLOGY PLANS DUPLICADOS' as tipo,
    user_id,
    COUNT(*) as cantidad_activos,
    ARRAY_AGG(id ORDER BY confirmed_at DESC NULLS LAST, created_at DESC) as plan_ids
FROM app.methodology_plans 
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Usuarios con múltiples routine_plans activos  
SELECT 
    'ROUTINE PLANS DUPLICADOS' as tipo,
    user_id,
    COUNT(*) as cantidad_activos,
    ARRAY_AGG(id ORDER BY confirmed_at DESC NULLS LAST, created_at DESC) as plan_ids
FROM app.routine_plans 
WHERE status = 'active' AND is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Estados inconsistentes en routine_plans
SELECT 
    'ESTADOS INCONSISTENTES' as tipo,
    COUNT(*) as cantidad
FROM app.routine_plans 
WHERE (status = 'cancelled' AND is_active = true) 
   OR (status = 'active' AND is_active = false);

-- ===============================================================
-- LIMPIEZA PASO 1: METHODOLOGY_PLANS (conservar más reciente)
-- ===============================================================

-- Para cada usuario con múltiples methodology_plans activos,
-- conservar solo el más reciente y cancelar el resto
WITH users_with_duplicates AS (
    SELECT DISTINCT user_id 
    FROM app.methodology_plans 
    WHERE status = 'active'
    GROUP BY user_id
    HAVING COUNT(*) > 1
),
plans_to_keep AS (
    SELECT DISTINCT ON (user_id) 
        user_id,
        id as plan_to_keep
    FROM app.methodology_plans mp
    JOIN users_with_duplicates uwd ON mp.user_id = uwd.user_id
    WHERE mp.status = 'active'
    ORDER BY user_id, 
             confirmed_at DESC NULLS LAST, 
             created_at DESC
),
cancellation_log AS (
    UPDATE app.methodology_plans 
    SET status = 'cancelled',
        updated_at = NOW()
    FROM plans_to_keep ptk
    WHERE methodology_plans.user_id = ptk.user_id
      AND methodology_plans.status = 'active'  
      AND methodology_plans.id != ptk.plan_to_keep
    RETURNING methodology_plans.user_id, methodology_plans.id
)
SELECT 
    'METHODOLOGY_PLANS CANCELADOS' as action,
    COUNT(*) as cantidad_cancelados
FROM cancellation_log;

-- ===============================================================
-- LIMPIEZA PASO 2: ROUTINE_PLANS (conservar más reciente)
-- ===============================================================

WITH users_with_duplicates AS (
    SELECT DISTINCT user_id 
    FROM app.routine_plans 
    WHERE status = 'active' AND is_active = true
    GROUP BY user_id
    HAVING COUNT(*) > 1
),
plans_to_keep AS (
    SELECT DISTINCT ON (user_id) 
        user_id,
        id as plan_to_keep
    FROM app.routine_plans rp
    JOIN users_with_duplicates uwd ON rp.user_id = uwd.user_id
    WHERE rp.status = 'active' AND rp.is_active = true
    ORDER BY user_id, 
             confirmed_at DESC NULLS LAST, 
             created_at DESC
),
cancellation_log AS (
    UPDATE app.routine_plans 
    SET status = 'cancelled',
        is_active = false,
        updated_at = NOW()
    FROM plans_to_keep ptk
    WHERE routine_plans.user_id = ptk.user_id
      AND routine_plans.status = 'active'
      AND routine_plans.is_active = true
      AND routine_plans.id != ptk.plan_to_keep
    RETURNING routine_plans.user_id, routine_plans.id
)
SELECT 
    'ROUTINE_PLANS CANCELADOS' as action,
    COUNT(*) as cantidad_cancelados
FROM cancellation_log;

-- ===============================================================
-- LIMPIEZA PASO 3: CORREGIR ESTADOS INCONSISTENTES
-- ===============================================================

-- Caso 1: status='cancelled' pero is_active=true -> Cancelar completamente
UPDATE app.routine_plans 
SET is_active = false,
    updated_at = NOW()
WHERE status = 'cancelled' AND is_active = true;

-- Caso 2: status='active' pero is_active=false -> Activar completamente  
UPDATE app.routine_plans 
SET is_active = true,
    updated_at = NOW()
WHERE status = 'active' AND is_active = false;

-- ===============================================================
-- REPORTE POST-LIMPIEZA
-- ===============================================================

SELECT 
    '=== REPORTE POST-LIMPIEZA ===' as info,
    NOW() as timestamp;

-- Verificar que ya no hay duplicados en methodology_plans
SELECT 
    'METHODOLOGY PLANS POST-LIMPIEZA' as tipo,
    user_id,
    COUNT(*) as cantidad_activos
FROM app.methodology_plans 
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Verificar que ya no hay duplicados en routine_plans
SELECT 
    'ROUTINE PLANS POST-LIMPIEZA' as tipo,
    user_id,
    COUNT(*) as cantidad_activos
FROM app.routine_plans 
WHERE status = 'active' AND is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Verificar estados inconsistentes corregidos
SELECT 
    'ESTADOS INCONSISTENTES POST-LIMPIEZA' as tipo,
    COUNT(*) as cantidad
FROM app.routine_plans 
WHERE (status = 'cancelled' AND is_active = true) 
   OR (status = 'active' AND is_active = false);

-- Estadísticas finales
SELECT 
    'ESTADISTICAS FINALES' as tipo,
    (SELECT COUNT(*) FROM app.methodology_plans WHERE status = 'active') as methodology_activos,
    (SELECT COUNT(*) FROM app.routine_plans WHERE status = 'active' AND is_active = true) as routine_activos,
    (SELECT COUNT(DISTINCT user_id) FROM app.methodology_plans WHERE status = 'active') as usuarios_con_methodology_activo,
    (SELECT COUNT(DISTINCT user_id) FROM app.routine_plans WHERE status = 'active' AND is_active = true) as usuarios_con_routine_activo;

-- Solo hacer COMMIT si todo se ve bien
-- COMMIT;
-- Por seguridad, hacer ROLLBACK para revisar primero:
ROLLBACK;

-- ===============================================================
-- INSTRUCCIONES DE USO:
-- 
-- 1. Ejecutar este script PRIMERO con ROLLBACK para ver el reporte
-- 2. Si los resultados se ven correctos, cambiar ROLLBACK por COMMIT
-- 3. Después ejecutar fix_multiple_active_plans.sql para los constraints
-- ===============================================================