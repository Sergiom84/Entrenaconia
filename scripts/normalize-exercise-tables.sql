-- ===========================================================================
-- NORMALIZACIÓN DE TABLAS DE EJERCICIOS
-- ===========================================================================
-- Descripción: Estandariza estructura de tablas de ejercicios
--              siguiendo patrón de Powerlifting
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- ===========================================================================

-- ===========================================================================
-- 1. AÑADIR exercise_id A HEAVY_DUTY
-- ===========================================================================

-- Paso 1: Añadir columna exercise_id como SERIAL
ALTER TABLE app."Ejercicios_Heavy_duty"
ADD COLUMN IF NOT EXISTS exercise_id SERIAL;

-- Paso 2: Renombrar columna 'id' actual a 'slug' (mantener identificadores textuales)
ALTER TABLE app."Ejercicios_Heavy_duty"
RENAME COLUMN id TO slug;

-- Paso 3: Hacer exercise_id la PRIMARY KEY
-- Primero eliminar PK existente si existe
ALTER TABLE app."Ejercicios_Heavy_duty"
DROP CONSTRAINT IF EXISTS "Ejercicios_Heavy_duty_pkey";

-- Añadir nueva PRIMARY KEY
ALTER TABLE app."Ejercicios_Heavy_duty"
ADD CONSTRAINT "Ejercicios_Heavy_duty_pkey" PRIMARY KEY (exercise_id);

-- Paso 4: Crear índice único en slug (mantener búsquedas por slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_heavy_duty_slug
ON app."Ejercicios_Heavy_duty"(slug);

COMMENT ON COLUMN app."Ejercicios_Heavy_duty".exercise_id IS 'ID numérico único (PRIMARY KEY)';
COMMENT ON COLUMN app."Ejercicios_Heavy_duty".slug IS 'Identificador textual legible (ej: crunch-en-máquina)';

-- ===========================================================================
-- 2. NORMALIZAR NIVELES EN POWERLIFTING
-- ===========================================================================

-- Cambiar "Novato" por "Principiante"
UPDATE app."Ejercicios_Powerlifting"
SET nivel = 'Principiante'
WHERE nivel = 'Novato';

-- ===========================================================================
-- 3. AÑADIR descanso_seg A HEAVY_DUTY
-- ===========================================================================

-- Añadir columna si no existe
ALTER TABLE app."Ejercicios_Heavy_duty"
ADD COLUMN IF NOT EXISTS descanso_seg INT;

COMMENT ON COLUMN app."Ejercicios_Heavy_duty".descanso_seg IS 'Descanso recomendado entre series en segundos (240-420 para Heavy Duty)';

-- Poblar con valores por defecto según nivel
-- Principiante: 4 minutos (240 seg)
-- Intermedio: 5 minutos (300 seg)
-- Avanzado: 6 minutos (360 seg)
UPDATE app."Ejercicios_Heavy_duty"
SET descanso_seg = CASE
  WHEN nivel = 'Principiante' THEN 240
  WHEN nivel = 'Intermedio' THEN 300
  WHEN nivel = 'Avanzado' THEN 360
  ELSE 300
END
WHERE descanso_seg IS NULL;

-- ===========================================================================
-- VERIFICACIÓN FINAL
-- ===========================================================================

-- Verificar niveles Powerlifting
SELECT 'Verificación de niveles Powerlifting:' as info;
SELECT DISTINCT nivel, COUNT(*) as total
FROM app."Ejercicios_Powerlifting"
GROUP BY nivel
ORDER BY nivel;

-- Verificar descanso_seg Heavy_duty
SELECT 'Verificación de descansos Heavy Duty:' as info;
SELECT nivel, AVG(descanso_seg) as descanso_promedio
FROM app."Ejercicios_Heavy_duty"
GROUP BY nivel
ORDER BY nivel;

-- ===========================================================================
-- RESULTADOS ESPERADOS
-- ===========================================================================
-- Heavy_duty:
--   - Nueva columna exercise_id (SERIAL PRIMARY KEY)
--   - Columna 'id' renombrada a 'slug'
--   - Nueva columna descanso_seg poblada (240-360 seg)
--
-- Powerlifting:
--   - Niveles: Principiante (20), Intermedio (22), Avanzado (26), Elite (9)
-- ===========================================================================
