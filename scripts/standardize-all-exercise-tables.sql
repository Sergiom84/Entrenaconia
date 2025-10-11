-- ===========================================================================
-- ESTANDARIZACIÓN COMPLETA DE TABLAS DE EJERCICIOS
-- ===========================================================================
-- Descripción: Normaliza TODAS las columnas de identificación para consistencia
-- ADVERTENCIA: Este es un cambio estructural importante. Hacer backup antes.
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- ===========================================================================

-- ===========================================================================
-- PASO 1: CALISTENIA - Renombrar columnas
-- ===========================================================================

-- Contexto: Actualmente tiene id (int) + exercise_id (text como slug)
-- Objetivo: exercise_id (int PK) + slug (text)

-- 1.1: Añadir columna temporal para nuevo exercise_id
ALTER TABLE app."Ejercicios_Calistenia"
ADD COLUMN IF NOT EXISTS exercise_id_new INTEGER;

-- 1.2: Copiar valores de id actual a exercise_id_new
UPDATE app."Ejercicios_Calistenia"
SET exercise_id_new = id;

-- 1.3: Renombrar exercise_id actual (texto) a slug
ALTER TABLE app."Ejercicios_Calistenia"
RENAME COLUMN exercise_id TO slug;

-- 1.4: Eliminar columna id vieja
ALTER TABLE app."Ejercicios_Calistenia"
DROP COLUMN id;

-- 1.5: Renombrar exercise_id_new a exercise_id
ALTER TABLE app."Ejercicios_Calistenia"
RENAME COLUMN exercise_id_new TO exercise_id;

-- 1.6: Hacer exercise_id la PRIMARY KEY
ALTER TABLE app."Ejercicios_Calistenia"
DROP CONSTRAINT IF EXISTS "Ejercicios_Calistenia_pkey";

ALTER TABLE app."Ejercicios_Calistenia"
ADD CONSTRAINT "Ejercicios_Calistenia_pkey" PRIMARY KEY (exercise_id);

-- 1.7: Crear índice único en slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_calistenia_slug
ON app."Ejercicios_Calistenia"(slug);

COMMENT ON COLUMN app."Ejercicios_Calistenia".exercise_id IS 'ID numérico único (PRIMARY KEY)';
COMMENT ON COLUMN app."Ejercicios_Calistenia".slug IS 'Identificador textual legible (ej: flexión-estándar)';

-- ===========================================================================
-- PASO 2: HIPERTROFIA - Renombrar columnas
-- ===========================================================================

-- Contexto: Actualmente tiene id (int) + exercise_id (varchar como slug)
-- Objetivo: exercise_id (int PK) + slug (text)

-- 2.1: Añadir columna temporal
ALTER TABLE app."Ejercicios_Hipertrofia"
ADD COLUMN IF NOT EXISTS exercise_id_new INTEGER;

-- 2.2: Copiar valores
UPDATE app."Ejercicios_Hipertrofia"
SET exercise_id_new = id;

-- 2.3: Renombrar exercise_id actual a slug
ALTER TABLE app."Ejercicios_Hipertrofia"
RENAME COLUMN exercise_id TO slug;

-- 2.4: Eliminar id vieja
ALTER TABLE app."Ejercicios_Hipertrofia"
DROP COLUMN id;

-- 2.5: Renombrar exercise_id_new
ALTER TABLE app."Ejercicios_Hipertrofia"
RENAME COLUMN exercise_id_new TO exercise_id;

-- 2.6: PRIMARY KEY
ALTER TABLE app."Ejercicios_Hipertrofia"
DROP CONSTRAINT IF EXISTS "Ejercicios_Hipertrofia_pkey";

ALTER TABLE app."Ejercicios_Hipertrofia"
ADD CONSTRAINT "Ejercicios_Hipertrofia_pkey" PRIMARY KEY (exercise_id);

-- 2.7: Índice único en slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_hipertrofia_slug
ON app."Ejercicios_Hipertrofia"(slug);

COMMENT ON COLUMN app."Ejercicios_Hipertrofia".exercise_id IS 'ID numérico único (PRIMARY KEY)';
COMMENT ON COLUMN app."Ejercicios_Hipertrofia".slug IS 'Identificador textual legible';

-- ===========================================================================
-- PASO 3: POWERLIFTING - Añadir slug (opcional pero recomendado)
-- ===========================================================================

-- Añadir columna slug
ALTER TABLE app."Ejercicios_Powerlifting"
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generar slug desde nombre (quitar acentos, minúsculas, guiones)
UPDATE app."Ejercicios_Powerlifting"
SET slug = LOWER(REGEXP_REPLACE(
  TRANSLATE(nombre,
    'ÁÉÍÓÚáéíóúÑñ',
    'AEIOUaeiouNn'
  ),
  '[^a-zA-Z0-9]+', '-', 'g'
))
WHERE slug IS NULL;

-- Índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_powerlifting_slug
ON app."Ejercicios_Powerlifting"(slug);

COMMENT ON COLUMN app."Ejercicios_Powerlifting".slug IS 'Identificador textual generado automáticamente';

-- ===========================================================================
-- PASO 4: HIPERTROFIA - Añadir descanso_seg
-- ===========================================================================

-- Añadir columna
ALTER TABLE app."Ejercicios_Hipertrofia"
ADD COLUMN IF NOT EXISTS descanso_seg INT;

-- Poblar con valores razonables por tipo de patrón
UPDATE app."Ejercicios_Hipertrofia"
SET descanso_seg = CASE
  WHEN patron = 'Aislamiento' THEN 60
  WHEN patron = 'Compuesto' THEN 90
  WHEN patron = 'Unilateral' THEN 75
  ELSE 75
END
WHERE descanso_seg IS NULL;

COMMENT ON COLUMN app."Ejercicios_Hipertrofia".descanso_seg IS 'Descanso recomendado en segundos (60-90 típico)';

-- ===========================================================================
-- VERIFICACIÓN FINAL
-- ===========================================================================

-- Verificar estructura Calistenia
SELECT 'Estructura Calistenia:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' AND table_name = 'Ejercicios_Calistenia'
AND column_name IN ('exercise_id', 'slug')
ORDER BY column_name;

-- Verificar estructura Hipertrofia
SELECT 'Estructura Hipertrofia:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' AND table_name = 'Ejercicios_Hipertrofia'
AND column_name IN ('exercise_id', 'slug', 'descanso_seg')
ORDER BY column_name;

-- Verificar estructura Powerlifting
SELECT 'Estructura Powerlifting:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' AND table_name = 'Ejercicios_Powerlifting'
AND column_name IN ('exercise_id', 'slug')
ORDER BY column_name;

-- Verificar estructura Heavy_duty
SELECT 'Estructura Heavy_duty:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' AND table_name = 'Ejercicios_Heavy_duty'
AND column_name IN ('exercise_id', 'slug', 'descanso_seg')
ORDER BY column_name;

-- Contar ejercicios (no debe haber pérdidas)
SELECT 'Conteos finales:' as info;
SELECT
  'Calistenia' as tabla, COUNT(*) as total
FROM app."Ejercicios_Calistenia"
UNION ALL
SELECT
  'Hipertrofia', COUNT(*)
FROM app."Ejercicios_Hipertrofia"
UNION ALL
SELECT
  'Heavy_duty', COUNT(*)
FROM app."Ejercicios_Heavy_duty"
UNION ALL
SELECT
  'Powerlifting', COUNT(*)
FROM app."Ejercicios_Powerlifting";

-- ===========================================================================
-- RESULTADOS ESPERADOS
-- ===========================================================================
-- TODAS LAS TABLAS:
--   - exercise_id INTEGER PRIMARY KEY
--   - slug TEXT UNIQUE
--
-- Heavy_duty + Powerlifting:
--   - descanso_seg INT (ya existe)
--
-- Hipertrofia:
--   - descanso_seg INT (nuevo, poblado con 60-90)
-- ===========================================================================
