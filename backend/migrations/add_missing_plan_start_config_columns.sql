-- ============================================================================
-- FIX: Agregar columnas faltantes a app.plan_start_config para HipertrofiaV2
-- ============================================================================
-- Problema: El INSERT en hipertrofiaV2.js falla porque faltan columnas
-- Columnas faltantes: distribution_option, include_saturdays, is_consecutive_days, is_extended_weeks
-- ============================================================================

BEGIN;

-- Agregar columna distribution_option (opción de distribución elegida)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS distribution_option TEXT;

-- Agregar columna include_saturdays (boolean para incluir sábados)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS include_saturdays BOOLEAN DEFAULT false;

-- Agregar columna is_consecutive_days (boolean para días consecutivos)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS is_consecutive_days BOOLEAN DEFAULT false;

-- Agregar columna is_extended_weeks (boolean para semanas extendidas)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS is_extended_weeks BOOLEAN DEFAULT false;

-- Agregar columna first_week_pattern (patrón de primera semana)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS first_week_pattern TEXT;

-- Agregar columna regular_pattern (patrón regular)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS regular_pattern TEXT;

-- Agregar columna day_mappings (mapeo de días en JSON)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS day_mappings JSONB;

-- Agregar columna warnings (advertencias en JSON)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS warnings JSONB;

-- Agregar columna intensity_adjusted (boolean para intensidad ajustada)
ALTER TABLE app.plan_start_config
ADD COLUMN IF NOT EXISTS intensity_adjusted BOOLEAN DEFAULT false;

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
-- - distribution_option: Almacena la opción de distribución ('consecutive', 'saturdays', etc.)
-- - include_saturdays: Indica si se incluyen sábados en el plan
-- - is_consecutive_days: Indica si los días son consecutivos
-- - is_extended_weeks: Indica si las semanas están extendidas
-- - first_week_pattern: Patrón específico para la primera semana
-- - regular_pattern: Patrón regular para semanas normales
-- - day_mappings: Mapeo de días en formato JSON
-- - warnings: Advertencias del sistema en formato JSON
-- - intensity_adjusted: Indica si la intensidad fue ajustada
-- ============================================================================