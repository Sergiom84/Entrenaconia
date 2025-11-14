-- ============================================================================
-- FIX: Agregar columnas faltantes a app.plan_start_config
-- ============================================================================
-- Problema: El INSERT en ensureScheduleV3.js falla porque faltan columnas
-- Columnas faltantes: user_id, start_date, original_pattern
-- ============================================================================

BEGIN;

-- Agregar columna user_id (NOT NULL con FK a users)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE;

-- Agregar columna start_date (fecha de inicio del plan)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL;

-- Agregar columna original_pattern (patrón original antes de redistribuir)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS original_pattern TEXT;

-- Crear índice en user_id para mejorar performance
CREATE INDEX IF NOT EXISTS idx_plan_start_config_user_id
ON app.plan_start_config(user_id);

-- Verificar estructura final
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'plan_start_config'
ORDER BY ordinal_position;

COMMIT;

-- ============================================================================
-- Notas:
-- - user_id es NOT NULL y tiene FK constraint a app.users(id)
-- - start_date es NOT NULL, representa la fecha de inicio del plan
-- - original_pattern es nullable, guarda el patrón original (ej: "Lun-Mié-Vie")
-- - Se crea índice en user_id para queries rápidas
-- ============================================================================
