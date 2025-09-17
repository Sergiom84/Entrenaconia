-- ==========================================================================
-- SOLUCIÓN PARA ERROR DE COLUMNA FALTANTE session_metadata
-- Fecha: 15 de septiembre de 2025
-- Error: column "session_metadata" of relation "user_sessions" does not exist
-- ==========================================================================

BEGIN;

-- 1. Agregar la columna session_metadata faltante
ALTER TABLE app.user_sessions
ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Comentar la nueva columna para documentación
COMMENT ON COLUMN app.user_sessions.session_metadata IS 'Metadatos adicionales de la sesión en formato JSON';

-- 3. Verificar que la columna se agregó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
          AND column_name = 'session_metadata'
    ) THEN
        RAISE NOTICE '✅ Columna session_metadata agregada exitosamente';
    ELSE
        RAISE EXCEPTION '❌ Error: No se pudo agregar la columna session_metadata';
    END IF;
END $$;

-- 4. Crear índice para consultas eficientes sobre session_metadata
CREATE INDEX IF NOT EXISTS idx_user_sessions_metadata_gin
ON app.user_sessions USING gin(session_metadata);

-- 5. Mostrar la estructura final de la tabla para verificación
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'user_sessions'
  AND column_name = 'session_metadata';

COMMIT;

-- ==========================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ==========================================================================

-- Mostrar mensaje de éxito
SELECT '🎉 MIGRACIÓN COMPLETADA: Columna session_metadata agregada a user_sessions' as resultado;

-- Verificar que sessionUtils.js ahora puede funcionar correctamente
SELECT 'La función logUserLogin() en sessionUtils.js ahora debería funcionar sin errores' as nota;