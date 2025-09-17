-- ==========================================================================
-- AGREGAR COLUMNA SESSION_DURATION A USER_SESSIONS
-- Fecha: 15 de septiembre de 2025
-- Descripción: Agrega la columna session_duration como columna generada que faltaba
-- Error: column "session_duration" does not exist
-- ==========================================================================

DO $$
BEGIN
    -- Verificar si la columna ya existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
          AND column_name = 'session_duration'
    ) THEN
        -- Agregar la columna session_duration como columna generada
        ALTER TABLE app.user_sessions
        ADD COLUMN session_duration INTERVAL GENERATED ALWAYS AS (
            CASE
                WHEN logout_time IS NOT NULL THEN logout_time - login_time
                ELSE NULL
            END
        ) STORED;

        RAISE NOTICE 'Columna session_duration agregada exitosamente como columna generada';
    ELSE
        RAISE NOTICE 'La columna session_duration ya existe';
    END IF;
END $$;

-- Verificar que la columna se creó correctamente
DO $$
DECLARE
    column_exists BOOLEAN;
    column_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
          AND column_name = 'session_duration'
    ) INTO column_exists;

    IF column_exists THEN
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
          AND column_name = 'session_duration'
        INTO column_type;

        RAISE NOTICE 'VERIFICACIÓN EXITOSA: Columna session_duration existe con tipo: %', column_type;
    ELSE
        RAISE EXCEPTION 'ERROR: La columna session_duration no se pudo crear';
    END IF;
END $$;

-- Comentario en la columna para documentación
COMMENT ON COLUMN app.user_sessions.session_duration IS 'Duración calculada de la sesión (logout_time - login_time) - Columna generada automáticamente';

-- ==========================================================================
-- FIN DEL SCRIPT
-- ==========================================================================