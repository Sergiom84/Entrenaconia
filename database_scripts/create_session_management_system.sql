-- Sistema completo de gestión y logging de sesiones de usuario
-- Fecha: 2025-09-09
-- Propósito: Implementar tracking completo, detección de inactividad y limpieza automática

BEGIN;

-- 1. Crear tabla para tracking de sesiones de usuario
CREATE TABLE IF NOT EXISTS app.user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE, -- Hash del JWT token
    device_info JSONB DEFAULT NULL, -- User agent, IP, dispositivo
    login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logout_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    logout_reason VARCHAR(50) DEFAULT NULL, -- manual, timeout, concurrent, expired
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
ON app.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token 
ON app.user_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
ON app.user_sessions(is_active, last_activity) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires 
ON app.user_sessions(expires_at) 
WHERE expires_at IS NOT NULL;

-- 3. Agregar constraints
ALTER TABLE app.user_sessions 
ADD CONSTRAINT check_logout_reason 
CHECK (logout_reason IN ('manual', 'timeout', 'concurrent', 'expired', 'security', 'admin'));

-- 4. Crear tabla para logging de eventos de autenticación
CREATE TABLE IF NOT EXISTS app.auth_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app.users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES app.user_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- login_attempt, login_success, login_failed, logout, token_refresh, password_change
    ip_address INET DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    metadata JSONB DEFAULT NULL, -- Información adicional del evento
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Índices para auth_logs
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id 
ON app.auth_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_logs_session_id 
ON app.auth_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type 
ON app.auth_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at 
ON app.auth_logs(created_at DESC);

-- 6. Constraint para event_type
ALTER TABLE app.auth_logs 
ADD CONSTRAINT check_event_type 
CHECK (event_type IN ('login_attempt', 'login_success', 'login_failed', 'logout', 'token_refresh', 'password_change', 'session_timeout', 'concurrent_logout'));

-- 7. Función para crear nueva sesión
CREATE OR REPLACE FUNCTION app.create_user_session(
    p_user_id INTEGER,
    p_session_token VARCHAR(255),
    p_device_info JSONB DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_session_id INTEGER;
    v_max_concurrent INTEGER := 3; -- Máximo 3 sesiones concurrentes
BEGIN
    -- Verificar y limpiar sesiones concurrentes si excede el límite
    WITH active_sessions AS (
        SELECT id, row_number() OVER (ORDER BY last_activity DESC) as rn
        FROM app.user_sessions 
        WHERE user_id = p_user_id AND is_active = TRUE
    )
    UPDATE app.user_sessions 
    SET is_active = FALSE, 
        logout_at = NOW(),
        logout_reason = 'concurrent',
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM active_sessions WHERE rn > v_max_concurrent
    );

    -- Crear nueva sesión
    INSERT INTO app.user_sessions (
        user_id, session_token, device_info, expires_at
    ) VALUES (
        p_user_id, p_session_token, p_device_info, p_expires_at
    ) RETURNING id INTO v_session_id;

    -- Log del evento
    INSERT INTO app.auth_logs (user_id, session_id, event_type, metadata)
    VALUES (p_user_id, v_session_id, 'login_success', p_device_info);

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Función para actualizar actividad de sesión
CREATE OR REPLACE FUNCTION app.update_session_activity(
    p_session_token VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE app.user_sessions 
    SET last_activity = NOW(),
        updated_at = NOW()
    WHERE session_token = p_session_token 
      AND is_active = TRUE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 9. Función para logout de sesión
CREATE OR REPLACE FUNCTION app.logout_session(
    p_session_token VARCHAR(255),
    p_logout_reason VARCHAR(50) DEFAULT 'manual'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_id INTEGER;
    v_user_id INTEGER;
BEGIN
    -- Buscar y desactivar la sesión
    UPDATE app.user_sessions 
    SET is_active = FALSE,
        logout_at = NOW(),
        logout_reason = p_logout_reason,
        updated_at = NOW()
    WHERE session_token = p_session_token 
      AND is_active = TRUE
    RETURNING id, user_id INTO v_session_id, v_user_id;
    
    -- Log del logout
    IF FOUND THEN
        INSERT INTO app.auth_logs (user_id, session_id, event_type, metadata)
        VALUES (v_user_id, v_session_id, 'logout', 
                jsonb_build_object('reason', p_logout_reason));
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 10. Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION app.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER := 0;
    v_timeout_minutes INTEGER := 60; -- 60 minutos de inactividad
BEGIN
    -- Marcar sesiones inactivas como expiradas
    WITH expired_sessions AS (
        UPDATE app.user_sessions 
        SET is_active = FALSE,
            logout_at = NOW(),
            logout_reason = 'timeout',
            updated_at = NOW()
        WHERE is_active = TRUE 
          AND (
              -- Por expiración explícita
              (expires_at IS NOT NULL AND expires_at < NOW()) 
              OR
              -- Por inactividad
              (last_activity < NOW() - INTERVAL '1 hour' * v_timeout_minutes / 60)
          )
        RETURNING id, user_id
    )
    SELECT COUNT(*) FROM expired_sessions INTO v_cleaned_count;

    -- Log de limpieza si hubo sesiones expiradas
    IF v_cleaned_count > 0 THEN
        INSERT INTO app.auth_logs (event_type, metadata, created_at)
        VALUES ('session_timeout', 
                jsonb_build_object('cleaned_count', v_cleaned_count, 'timeout_minutes', v_timeout_minutes),
                NOW());
    END IF;

    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Función para obtener estadísticas de sesiones
CREATE OR REPLACE FUNCTION app.get_session_stats(
    p_user_id INTEGER DEFAULT NULL,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
    active_sessions INTEGER,
    total_logins INTEGER,
    failed_logins INTEGER,
    avg_session_duration INTERVAL,
    last_login TIMESTAMP WITH TIME ZONE,
    concurrent_logouts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH session_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE s.is_active = TRUE) as active_count,
            COUNT(*) FILTER (WHERE l.event_type = 'login_success' AND l.created_at > NOW() - INTERVAL '1 hour' * p_hours) as login_count,
            COUNT(*) FILTER (WHERE l.event_type = 'login_failed' AND l.created_at > NOW() - INTERVAL '1 hour' * p_hours) as failed_count,
            AVG(s.logout_at - s.login_at) FILTER (WHERE s.logout_at IS NOT NULL) as avg_duration,
            MAX(s.login_at) as last_login_time,
            COUNT(*) FILTER (WHERE s.logout_reason = 'concurrent') as concurrent_count
        FROM app.user_sessions s
        LEFT JOIN app.auth_logs l ON l.session_id = s.id
        WHERE (p_user_id IS NULL OR s.user_id = p_user_id)
          AND s.created_at > NOW() - INTERVAL '1 hour' * p_hours
    )
    SELECT 
        active_count::INTEGER,
        login_count::INTEGER,
        failed_count::INTEGER,
        avg_duration,
        last_login_time,
        concurrent_count::INTEGER
    FROM session_stats;
END;
$$ LANGUAGE plpgsql;

-- 12. Función para detectar sesiones sospechosas
CREATE OR REPLACE FUNCTION app.detect_suspicious_sessions()
RETURNS TABLE(
    session_id INTEGER,
    user_id INTEGER,
    session_token VARCHAR(255),
    login_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    device_info JSONB,
    suspicious_reasons TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.session_token,
        s.login_at,
        s.last_activity,
        s.device_info,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN s.last_activity < NOW() - INTERVAL '6 hours' AND s.is_active THEN 'inactive_too_long' END,
            CASE WHEN s.login_at < NOW() - INTERVAL '7 days' AND s.is_active THEN 'session_too_old' END,
            CASE WHEN (s.device_info->>'ip')::inet IS DISTINCT FROM (SELECT ip_address FROM app.auth_logs WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) THEN 'ip_change' END,
            CASE WHEN (SELECT COUNT(*) FROM app.user_sessions WHERE user_id = s.user_id AND is_active = TRUE) > 5 THEN 'too_many_concurrent' END
        ], NULL) as reasons
    FROM app.user_sessions s
    WHERE s.is_active = TRUE
    HAVING ARRAY_LENGTH(ARRAY_REMOVE(ARRAY[
        CASE WHEN s.last_activity < NOW() - INTERVAL '6 hours' AND s.is_active THEN 'inactive_too_long' END,
        CASE WHEN s.login_at < NOW() - INTERVAL '7 days' AND s.is_active THEN 'session_too_old' END,
        CASE WHEN (s.device_info->>'ip')::inet IS DISTINCT FROM (SELECT ip_address FROM app.auth_logs WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) THEN 'ip_change' END,
        CASE WHEN (SELECT COUNT(*) FROM app.user_sessions WHERE user_id = s.user_id AND is_active = TRUE) > 5 THEN 'too_many_concurrent' END
    ], NULL), 1) > 0;
END;
$$ LANGUAGE plpgsql;

-- 13. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_sessions_updated_at
    BEFORE UPDATE ON app.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION app.update_updated_at_column();

-- 14. Comentarios para documentación
COMMENT ON TABLE app.user_sessions IS 'Tracking completo de sesiones de usuario con detección de inactividad';
COMMENT ON TABLE app.auth_logs IS 'Log completo de eventos de autenticación y seguridad';
COMMENT ON FUNCTION app.create_user_session IS 'Crea nueva sesión con control de concurrencia máximo 3 sesiones';
COMMENT ON FUNCTION app.update_session_activity IS 'Actualiza timestamp de actividad para sesión activa';
COMMENT ON FUNCTION app.logout_session IS 'Logout seguro con logging del motivo';
COMMENT ON FUNCTION app.cleanup_expired_sessions IS 'Limpieza automática de sesiones por inactividad (60min) y expiración';
COMMENT ON FUNCTION app.get_session_stats IS 'Estadísticas detalladas de sesiones por usuario o globales';
COMMENT ON FUNCTION app.detect_suspicious_sessions IS 'Detección automática de sesiones sospechosas o anómalas';

COMMIT;

-- Ejecutar primera limpieza
SELECT app.cleanup_expired_sessions() as initial_cleanup;

-- Mostrar estadísticas iniciales
SELECT * FROM app.get_session_stats(NULL, 168); -- Últimas 7 días

-- Detectar sesiones sospechosas actuales  
SELECT * FROM app.detect_suspicious_sessions();