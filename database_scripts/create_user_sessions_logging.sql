-- ==========================================================================
-- USER SESSIONS LOGGING SYSTEM
-- Fecha: 9 de septiembre de 2025
-- Descripción: Sistema completo de logging para login/logout de usuarios
-- ==========================================================================

-- Crear enum para tipos de logout
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'logout_type') THEN
        CREATE TYPE app.logout_type AS ENUM ('manual', 'timeout', 'forced', 'system');
    END IF;
END $$;

-- Crear tabla de sesiones de usuario
CREATE TABLE IF NOT EXISTS app.user_sessions (
    -- Identificadores únicos
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    
    -- Timestamps de sesión
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE NULL,
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Información de la sesión
    session_duration INTERVAL GENERATED ALWAYS AS (
        CASE 
            WHEN logout_time IS NOT NULL THEN logout_time - login_time
            ELSE NULL
        END
    ) STORED,
    
    -- Información de red y dispositivo
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    
    -- Información del dispositivo (estructura JSON)
    device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Información geográfica (opcional)
    country_code CHAR(2) NULL,
    city TEXT NULL,
    
    -- Estado de la sesión
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    logout_type app.logout_type NULL,
    
    -- JWT token tracking
    jwt_token_hash VARCHAR(64) NULL, -- Hash del token para tracking
    jwt_expires_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Metadatos adicionales
    session_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps de auditoría
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_time ON app.user_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON app.user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON app.user_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON app.user_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jwt_hash ON app.user_sessions(jwt_token_hash) WHERE jwt_token_hash IS NOT NULL;

-- Crear índice compuesto para consultas de sesiones activas por usuario
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON app.user_sessions(user_id, is_active) 
WHERE is_active = TRUE;

-- Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION app.update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_sessions_updated_at
    BEFORE UPDATE ON app.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION app.update_user_sessions_updated_at();

-- ==========================================================================
-- FUNCIONES DE UTILIDAD PARA GESTIÓN DE SESIONES
-- ==========================================================================

-- Función para cerrar sesiones inactivas automáticamente
CREATE OR REPLACE FUNCTION app.close_inactive_sessions(
    inactive_threshold INTERVAL DEFAULT '24 hours'
)
RETURNS INTEGER AS $$
DECLARE
    closed_count INTEGER;
BEGIN
    UPDATE app.user_sessions
    SET 
        is_active = FALSE,
        logout_time = CURRENT_TIMESTAMP,
        logout_type = 'timeout',
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        is_active = TRUE
        AND last_activity < (CURRENT_TIMESTAMP - inactive_threshold)
        AND logout_time IS NULL;
    
    GET DIAGNOSTICS closed_count = ROW_COUNT;
    RETURN closed_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de sesiones por usuario
CREATE OR REPLACE FUNCTION app.get_user_session_stats(p_user_id INTEGER)
RETURNS TABLE (
    total_sessions BIGINT,
    active_sessions BIGINT,
    avg_session_duration INTERVAL,
    last_login TIMESTAMP WITH TIME ZONE,
    total_login_time INTERVAL,
    unique_ips BIGINT,
    most_used_device TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_sessions,
        AVG(session_duration) as avg_session_duration,
        MAX(login_time) as last_login,
        SUM(COALESCE(session_duration, CURRENT_TIMESTAMP - login_time)) as total_login_time,
        COUNT(DISTINCT ip_address) as unique_ips,
        (
            SELECT device_info->>'platform'
            FROM app.user_sessions
            WHERE user_id = p_user_id
            GROUP BY device_info->>'platform'
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as most_used_device
    FROM app.user_sessions
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar sesiones antiguas (mantenimiento)
CREATE OR REPLACE FUNCTION app.cleanup_old_sessions(
    retention_period INTERVAL DEFAULT '90 days'
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.user_sessions
    WHERE 
        is_active = FALSE
        AND logout_time IS NOT NULL
        AND logout_time < (CURRENT_TIMESTAMP - retention_period);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- VISTAS ÚTILES PARA REPORTING
-- ==========================================================================

-- Vista para sesiones activas con información del usuario
CREATE OR REPLACE VIEW app.active_user_sessions AS
SELECT 
    us.session_id,
    us.user_id,
    u.nombre,
    u.apellido,
    u.email,
    us.login_time,
    us.last_activity,
    us.ip_address,
    us.device_info,
    us.country_code,
    us.city,
    (CURRENT_TIMESTAMP - us.last_activity) as idle_time,
    (CURRENT_TIMESTAMP - us.login_time) as session_age
FROM app.user_sessions us
JOIN app.users u ON us.user_id = u.id
WHERE us.is_active = TRUE
ORDER BY us.last_activity DESC;

-- Vista para estadísticas diarias de login
CREATE OR REPLACE VIEW app.daily_login_stats AS
SELECT 
    DATE(login_time) as login_date,
    COUNT(*) as total_logins,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips,
    AVG(EXTRACT(EPOCH FROM session_duration)) as avg_session_seconds
FROM app.user_sessions
WHERE login_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(login_time)
ORDER BY login_date DESC;

-- ==========================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ==========================================================================

COMMENT ON TABLE app.user_sessions IS 'Registro completo de sesiones de usuario con información de dispositivo y geolocalización';
COMMENT ON COLUMN app.user_sessions.session_id IS 'Identificador único de la sesión (UUID)';
COMMENT ON COLUMN app.user_sessions.user_id IS 'Referencia al usuario propietario de la sesión';
COMMENT ON COLUMN app.user_sessions.login_time IS 'Timestamp exacto del inicio de sesión';
COMMENT ON COLUMN app.user_sessions.logout_time IS 'Timestamp del cierre de sesión (NULL si está activa)';
COMMENT ON COLUMN app.user_sessions.last_activity IS 'Última actividad registrada en la sesión';
COMMENT ON COLUMN app.user_sessions.session_duration IS 'Duración calculada de la sesión (computed column)';
COMMENT ON COLUMN app.user_sessions.ip_address IS 'Dirección IP del cliente';
COMMENT ON COLUMN app.user_sessions.user_agent IS 'User-Agent del navegador/aplicación';
COMMENT ON COLUMN app.user_sessions.device_info IS 'Información detallada del dispositivo en formato JSON';
COMMENT ON COLUMN app.user_sessions.is_active IS 'Indica si la sesión sigue activa';
COMMENT ON COLUMN app.user_sessions.logout_type IS 'Tipo de cierre: manual, timeout, forced, system';
COMMENT ON COLUMN app.user_sessions.jwt_token_hash IS 'Hash del token JWT para tracking';
COMMENT ON COLUMN app.user_sessions.session_metadata IS 'Metadatos adicionales de la sesión';

-- ==========================================================================
-- TASK DE MANTENIMIENTO AUTOMÁTICO (Opcional)
-- ==========================================================================

-- Crear función para ejecutar mantenimiento automático
CREATE OR REPLACE FUNCTION app.session_maintenance()
RETURNS TEXT AS $$
DECLARE
    inactive_closed INTEGER;
    old_cleaned INTEGER;
    result TEXT;
BEGIN
    -- Cerrar sesiones inactivas (más de 24 horas sin actividad)
    SELECT app.close_inactive_sessions('24 hours') INTO inactive_closed;
    
    -- Limpiar sesiones antiguas (más de 90 días cerradas)
    SELECT app.cleanup_old_sessions('90 days') INTO old_cleaned;
    
    result := format('Mantenimiento completado: %s sesiones cerradas por inactividad, %s sesiones antiguas eliminadas', 
                    inactive_closed, old_cleaned);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- PERMISOS Y SEGURIDAD
-- ==========================================================================

-- Asegurar que solo la aplicación puede acceder a estas tablas
-- (Los permisos específicos dependerán de tu configuración de usuario de BD)

-- ==========================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ==========================================================================

DO $$
BEGIN
    -- Verificar que la tabla se creó correctamente
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'app' AND table_name = 'user_sessions'
    ) THEN
        RAISE NOTICE 'Tabla user_sessions creada exitosamente';
    ELSE
        RAISE EXCEPTION 'Error: No se pudo crear la tabla user_sessions';
    END IF;
    
    -- Verificar índices
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'app' AND tablename = 'user_sessions' 
        AND indexname = 'idx_user_sessions_user_id'
    ) THEN
        RAISE NOTICE 'Índices creados exitosamente';
    END IF;
    
    -- Verificar funciones
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'app' AND routine_name = 'close_inactive_sessions'
    ) THEN
        RAISE NOTICE 'Funciones de utilidad creadas exitosamente';
    END IF;
END $$;

-- ==========================================================================
-- FIN DEL SCRIPT
-- ==========================================================================