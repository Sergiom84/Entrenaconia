-- Add session abandonment tracking columns to home_training_sessions table
-- Fecha: 2025-09-03
-- Propósito: Tracking de abandono de sesiones para proteger la integridad de la base de datos

BEGIN;

-- 1. Agregar columnas para tracking de abandono
ALTER TABLE app.home_training_sessions 
ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS abandon_reason VARCHAR(50) NULL;

-- 2. Crear índice para consultas de sesiones abandonadas
CREATE INDEX IF NOT EXISTS idx_home_training_sessions_abandoned_at 
ON app.home_training_sessions(abandoned_at) 
WHERE abandoned_at IS NOT NULL;

-- 3. Agregar check constraint para abandon_reason (solo si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_abandon_reason' 
        AND table_name = 'home_training_sessions'
        AND table_schema = 'app'
    ) THEN
        ALTER TABLE app.home_training_sessions 
        ADD CONSTRAINT check_abandon_reason 
        CHECK (abandon_reason IN ('beforeunload', 'visibility_hidden', 'logout', 'manual_close', 'timeout'));
    END IF;
END $$;

-- 4. Crear función para limpiar sesiones abandonadas hace más de 24 horas
CREATE OR REPLACE FUNCTION app.cleanup_old_abandoned_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Actualizar sesiones abandonadas hace más de 24 horas a status 'abandoned'
    UPDATE app.home_training_sessions
    SET status = 'abandoned'
    WHERE abandoned_at IS NOT NULL 
      AND abandoned_at < NOW() - INTERVAL '24 hours'
      AND status = 'in_progress';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear función para reportar sesiones problemáticas
CREATE OR REPLACE FUNCTION app.report_problematic_sessions()
RETURNS TABLE(
    session_id INTEGER,
    user_id INTEGER,
    status VARCHAR(20),
    started_at TIMESTAMP,
    abandoned_at TIMESTAMP,
    abandon_reason VARCHAR(50),
    hours_since_start NUMERIC,
    hours_since_abandon NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as session_id,
        s.user_id,
        s.status,
        s.started_at,
        s.abandoned_at,
        s.abandon_reason,
        ROUND(EXTRACT(EPOCH FROM (NOW() - s.started_at)) / 3600, 2) as hours_since_start,
        ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(s.abandoned_at, s.started_at))) / 3600, 2) as hours_since_abandon
    FROM app.home_training_sessions s
    WHERE (
        -- Sesiones en progreso muy antiguas (más de 4 horas)
        (s.status = 'in_progress' AND s.started_at < NOW() - INTERVAL '4 hours')
        OR
        -- Sesiones abandonadas pero no marcadas como tal
        (s.abandoned_at IS NOT NULL AND s.status = 'in_progress' AND s.abandoned_at < NOW() - INTERVAL '1 hour')
    )
    ORDER BY s.started_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Comentarios explicativos
COMMENT ON COLUMN app.home_training_sessions.abandoned_at IS 'Timestamp cuando el usuario abandonó la sesión (beforeunload, visibility change, etc.)';
COMMENT ON COLUMN app.home_training_sessions.abandon_reason IS 'Razón del abandono: beforeunload, visibility_hidden, logout, manual_close, timeout';
COMMENT ON FUNCTION app.cleanup_old_abandoned_sessions() IS 'Limpia sesiones abandonadas hace más de 24 horas, cambiándolas a status=abandoned';
COMMENT ON FUNCTION app.report_problematic_sessions() IS 'Reporta sesiones problemáticas que necesitan revisión';

COMMIT;

-- Ejecutar primera limpieza
SELECT app.cleanup_old_abandoned_sessions() as sessions_cleaned;

-- Mostrar sesiones problemáticas actuales
SELECT * FROM app.report_problematic_sessions();