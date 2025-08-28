-- ===============================================================
-- SCRIPT PARA RESETEAR TODAS LAS TABLAS DE METODOLOGÍAS A CERO
-- Fecha: 2025-08-28
-- ===============================================================

-- ADVERTENCIA: Este script eliminará TODOS los datos de metodologías
-- Ejecutar solo si se quiere empezar desde cero

BEGIN;

-- 1. Eliminar datos de feedback (referencias a sessions)
TRUNCATE TABLE app.methodology_exercise_feedback RESTART IDENTITY CASCADE;

-- 2. Eliminar progreso de ejercicios (referencias a sessions)
TRUNCATE TABLE app.methodology_exercise_progress RESTART IDENTITY CASCADE;

-- 3. Eliminar sesiones de ejercicios (referencias a plans)
TRUNCATE TABLE app.methodology_exercise_sessions RESTART IDENTITY CASCADE;

-- 4. Eliminar historial completo (datos independientes)
TRUNCATE TABLE app.methodology_exercise_history_complete RESTART IDENTITY CASCADE;

-- 5. Eliminar planes de metodología (tabla principal)
TRUNCATE TABLE app.methodology_plans RESTART IDENTITY CASCADE;

-- 6. Resetear secuencias de IDs (opcional - para empezar desde ID 1)
SELECT setval('app.methodology_plans_id_seq', 1, false);
SELECT setval('app.methodology_exercise_sessions_id_seq', 1, false);
SELECT setval('app.methodology_exercise_progress_id_seq', 1, false);
SELECT setval('app.methodology_exercise_feedback_id_seq', 1, false);
SELECT setval('app.methodology_exercise_history_complete_id_seq', 1, false);

-- Verificar que todas las tablas están vacías
SELECT 
    'methodology_plans' as tabla,
    COUNT(*) as registros
FROM app.methodology_plans
UNION ALL
SELECT 
    'methodology_exercise_sessions' as tabla,
    COUNT(*) as registros
FROM app.methodology_exercise_sessions
UNION ALL
SELECT 
    'methodology_exercise_progress' as tabla,
    COUNT(*) as registros
FROM app.methodology_exercise_progress
UNION ALL
SELECT 
    'methodology_exercise_feedback' as tabla,
    COUNT(*) as registros
FROM app.methodology_exercise_feedback
UNION ALL
SELECT 
    'methodology_exercise_history_complete' as tabla,
    COUNT(*) as registros
FROM app.methodology_exercise_history_complete;

COMMIT;

-- Mensaje de confirmación
SELECT 'Todas las tablas de metodologías han sido reseteadas a 0 registros' as resultado;