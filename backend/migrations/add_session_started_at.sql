-- ===============================================
-- MIGRACIÓN: Agregar session_started_at para detectar días nuevos
-- Fecha: 2025-09-25
-- Propósito: Diferenciar entre "Comenzar" vs "Reanudar" entrenamiento
-- ===============================================

-- Agregar nueva columna para detectar si usuario ya empezó la sesión alguna vez
ALTER TABLE app.methodology_exercise_sessions
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMP DEFAULT NULL;

-- Comentario explicativo
COMMENT ON COLUMN app.methodology_exercise_sessions.session_started_at IS
'Timestamp de cuando el usuario inició la sesión POR PRIMERA VEZ. NULL = nunca empezó, NOT NULL = ya empezó alguna vez';

-- Para sesiones existentes que ya están en progreso o completadas,
-- establecer session_started_at igual a started_at
UPDATE app.methodology_exercise_sessions
SET session_started_at = started_at
WHERE session_started_at IS NULL
  AND (session_status = 'in_progress' OR session_status = 'completed')
  AND started_at IS NOT NULL;

-- Crear índice para mejorar performance en consultas
CREATE INDEX IF NOT EXISTS idx_methodology_sessions_started_at
ON app.methodology_exercise_sessions(session_started_at);

-- Verificación
SELECT
    'migration_completed' as status,
    COUNT(*) as total_sessions,
    COUNT(session_started_at) as sessions_with_started_at,
    COUNT(*) - COUNT(session_started_at) as sessions_never_started
FROM app.methodology_exercise_sessions;