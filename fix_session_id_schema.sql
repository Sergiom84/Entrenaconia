-- ==========================================================================
-- SOLUCIÓN PARA INCOMPATIBILIDAD DE SCHEMA session_id
-- Fecha: 15 de septiembre de 2025
-- Problema: sessionUtils.js espera session_id UUID auto-generado,
--          pero la tabla tiene session_id VARCHAR NOT NULL sin default
-- ==========================================================================

BEGIN;

-- 1. Primero, hacer que session_id sea nullable temporalmente para los datos existentes
ALTER TABLE app.user_sessions ALTER COLUMN session_id DROP NOT NULL;

-- 2. Actualizar registros existentes que tengan session_id NULL, asignarles UUIDs
UPDATE app.user_sessions
SET session_id = gen_random_uuid()::text
WHERE session_id IS NULL OR session_id = '';

-- 3. Cambiar el tipo de session_id a UUID y establecer default
-- Primero convertir los valores existentes a UUID (si es posible)
-- Si hay valores que no pueden convertirse a UUID, generamos nuevos UUIDs
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Intentar convertir session_id existentes a UUID, si fallan generar nuevos
    FOR rec IN SELECT id, session_id FROM app.user_sessions LOOP
        BEGIN
            -- Intentar validar como UUID
            PERFORM rec.session_id::uuid;
        EXCEPTION
            WHEN OTHERS THEN
                -- Si no es válido, generar nuevo UUID
                UPDATE app.user_sessions
                SET session_id = gen_random_uuid()::text
                WHERE id = rec.id;
        END;
    END LOOP;
END $$;

-- 4. Ahora cambiar el tipo de columna a UUID
ALTER TABLE app.user_sessions
ALTER COLUMN session_id TYPE UUID USING session_id::uuid;

-- 5. Establecer default para nuevos registros
ALTER TABLE app.user_sessions
ALTER COLUMN session_id SET DEFAULT gen_random_uuid();

-- 6. Volver a establecer NOT NULL
ALTER TABLE app.user_sessions
ALTER COLUMN session_id SET NOT NULL;

-- 7. Asegurar que session_id sea UNIQUE (ya que es lo que espera el código)
-- Primero verificar si ya existe un constraint de unique
DO $$
BEGIN
    -- Eliminar constraint de unique si existe (para recrearlo limpio)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_sessions_session_id_unique'
          AND table_name = 'user_sessions'
          AND table_schema = 'app'
    ) THEN
        ALTER TABLE app.user_sessions DROP CONSTRAINT user_sessions_session_id_unique;
    END IF;

    -- Crear constraint unique
    ALTER TABLE app.user_sessions ADD CONSTRAINT user_sessions_session_id_unique UNIQUE (session_id);
END $$;

-- 8. Verificar que la estructura es correcta
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
          AND column_name = 'session_id'
          AND data_type = 'uuid'
          AND is_nullable = 'NO'
          AND column_default LIKE '%gen_random_uuid%'
    ) THEN
        RAISE NOTICE '✅ session_id configurado correctamente como UUID con default gen_random_uuid()';
    ELSE
        RAISE EXCEPTION '❌ Error: session_id no se configuró correctamente';
    END IF;
END $$;

-- 9. Mostrar la estructura final
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'user_sessions'
  AND column_name = 'session_id';

COMMIT;

-- ==========================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ==========================================================================

SELECT '🎉 SOLUCIÓN APLICADA: session_id ahora es UUID con auto-generación' as resultado;
SELECT 'La función logUserLogin() ahora debería funcionar correctamente' as nota;