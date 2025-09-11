-- Corrección del esquema de sesiones para coincidir con sessionUtils.js existente
-- Fecha: 2025-09-09
-- Propósito: Crear tabla user_sessions compatible con el código actual

BEGIN;

-- 1. Crear tabla user_sessions compatible con sessionUtils.js
CREATE TABLE IF NOT EXISTS app.user_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    ip_address INET DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    device_info JSONB DEFAULT NULL,
    jwt_token_hash VARCHAR(255) NOT NULL,
    jwt_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    session_metadata JSONB DEFAULT NULL,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logout_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    logout_type VARCHAR(50) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agregar columna calculada para duración de sesión
ALTER TABLE app.user_sessions 
ADD COLUMN session_duration INTERVAL GENERATED ALWAYS AS (
    CASE WHEN logout_time IS NOT NULL 
    THEN logout_time - login_time 
    ELSE NULL END
) STORED;

-- 3. Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
ON app.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_jwt_hash 
ON app.user_sessions(jwt_token_hash);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
ON app.user_sessions(is_active, last_activity) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires 
ON app.user_sessions(jwt_expires_at) 
WHERE jwt_expires_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_active_token 
ON app.user_sessions(jwt_token_hash) 
WHERE is_active = TRUE;

-- 4. Agregar constraints
ALTER TABLE app.user_sessions 
ADD CONSTRAINT check_logout_type 
CHECK (logout_type IN ('manual', 'timeout', 'concurrent', 'forced', 'expired', 'security'));

-- 5. Crear función de estadísticas de usuario (requerida por sessionUtils.js)
CREATE OR REPLACE FUNCTION app.get_user_session_stats(p_user_id INTEGER)
RETURNS TABLE(
    active_sessions INTEGER,
    total_sessions INTEGER,
    avg_session_duration INTERVAL,
    last_login TIMESTAMP WITH TIME ZONE,
    total_logins_last_30_days INTEGER,
    unique_ips_last_30_days INTEGER,
    longest_session INTERVAL,
    shortest_session INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(CASE WHEN s.is_active = TRUE THEN 1 END)::INTEGER as active_sessions,
        COUNT(*)::INTEGER as total_sessions,
        AVG(CASE WHEN s.session_duration IS NOT NULL THEN s.session_duration END) as avg_session_duration,
        MAX(s.login_time) as last_login,
        COUNT(CASE WHEN s.login_time >= NOW() - INTERVAL '30 days' THEN 1 END)::INTEGER as total_logins_last_30_days,
        COUNT(DISTINCT CASE WHEN s.login_time >= NOW() - INTERVAL '30 days' THEN s.ip_address END)::INTEGER as unique_ips_last_30_days,
        MAX(CASE WHEN s.session_duration IS NOT NULL THEN s.session_duration END) as longest_session,
        MIN(CASE WHEN s.session_duration IS NOT NULL AND s.session_duration > INTERVAL '1 minute' THEN s.session_duration END) as shortest_session
    FROM app.user_sessions s
    WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear función de mantenimiento de sesiones (requerida por sessionUtils.js)
CREATE OR REPLACE FUNCTION app.session_maintenance()
RETURNS TEXT AS $$
DECLARE
    expired_count INTEGER := 0;
    inactive_count INTEGER := 0;
    total_cleaned INTEGER := 0;
BEGIN
    -- 1. Marcar sesiones con JWT expirado como inactivas
    UPDATE app.user_sessions 
    SET is_active = FALSE,
        logout_time = COALESCE(logout_time, NOW()),
        logout_type = COALESCE(logout_type, 'expired'),
        updated_at = NOW()
    WHERE is_active = TRUE 
      AND jwt_expires_at IS NOT NULL 
      AND jwt_expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- 2. Marcar sesiones inactivas por más de 24 horas como expiradas
    UPDATE app.user_sessions 
    SET is_active = FALSE,
        logout_time = COALESCE(logout_time, NOW()),
        logout_type = COALESCE(logout_type, 'timeout'),
        updated_at = NOW()
    WHERE is_active = TRUE 
      AND last_activity < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS inactive_count = ROW_COUNT;
    
    total_cleaned := expired_count + inactive_count;
    
    -- 3. Log del mantenimiento si hubo limpieza
    IF total_cleaned > 0 THEN
        INSERT INTO app.auth_logs (event_type, metadata, created_at)
        VALUES ('session_maintenance', 
                jsonb_build_object(
                    'expired_sessions', expired_count,
                    'inactive_sessions', inactive_count,
                    'total_cleaned', total_cleaned
                ),
                NOW());
    END IF;
    
    RETURN format('Mantenimiento completado: %s sesiones expiradas, %s inactivas, %s total limpiadas', 
                  expired_count, inactive_count, total_cleaned);
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION app.update_updated_at_session()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_sessions_updated_at
    BEFORE UPDATE ON app.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION app.update_updated_at_session();

-- 8. Función para limpieza de sesiones antiguas (más de 90 días)
CREATE OR REPLACE FUNCTION app.cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    DELETE FROM app.user_sessions 
    WHERE login_time < NOW() - INTERVAL '90 days'
      AND is_active = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        INSERT INTO app.auth_logs (event_type, metadata, created_at)
        VALUES ('old_sessions_cleanup', 
                jsonb_build_object('deleted_count', deleted_count),
                NOW());
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Comentarios para documentación
COMMENT ON TABLE app.user_sessions IS 'Tracking completo de sesiones de usuario compatible con sessionUtils.js';
COMMENT ON COLUMN app.user_sessions.session_id IS 'ID único de la sesión';
COMMENT ON COLUMN app.user_sessions.jwt_token_hash IS 'Hash SHA256 del JWT token para tracking';
COMMENT ON COLUMN app.user_sessions.session_duration IS 'Duración calculada automáticamente de la sesión';
COMMENT ON FUNCTION app.get_user_session_stats IS 'Estadísticas detalladas de sesión para un usuario específico';
COMMENT ON FUNCTION app.session_maintenance IS 'Mantenimiento automático de sesiones expiradas e inactivas';
COMMENT ON FUNCTION app.cleanup_old_sessions IS 'Limpieza de sesiones antiguas (>90 días) para optimizar storage';

COMMIT;

-- Ejecutar primera limpieza y mostrar estadísticas
SELECT app.session_maintenance() as maintenance_result;
SELECT app.cleanup_old_sessions() as cleanup_result;

-- Mostrar estructura final de la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'app' 
  AND table_name = 'user_sessions' 
ORDER BY ordinal_position;