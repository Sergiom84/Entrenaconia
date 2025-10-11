-- ===========================================================================
-- TABLA DE EJERCICIOS DE POWERLIFTING
-- ===========================================================================
-- Descripción: Tabla para almacenar ejercicios de Powerlifting organizados
--              por niveles progresivos (Novato, Intermedio, Avanzado, Elite)
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- Eliminar tabla si existe (recrear con estructura optimizada para Powerlifting)
DROP TABLE IF EXISTS app."Ejercicios_Powerlifting" CASCADE;

-- Crear tabla de Ejercicios_Powerlifting
CREATE TABLE IF NOT EXISTS app."Ejercicios_Powerlifting" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  nivel VARCHAR(50) NOT NULL,  -- Novato, Intermedio, Avanzado, Elite
  categoria VARCHAR(100) NOT NULL,  -- Sentadilla, Press Banca, Peso Muerto, Asistencia Inferior, Asistencia Superior
  patron VARCHAR(100),  -- Compuesto, Variante, Aislamiento
  equipamiento VARCHAR(200),  -- Barra olímpica, Rack, Bandas, Cadenas, etc.
  series_reps_objetivo VARCHAR(50),  -- 3-5 x 3-6, 4-6 x 1-5, etc.
  intensidad VARCHAR(50),  -- 75-85% 1RM, 85-95% 1RM, RPE 8-9
  descanso_seg INT,  -- 180-420 segundos
  notas TEXT,  -- Indicaciones técnicas específicas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_powerlifting_nivel ON app."Ejercicios_Powerlifting"(nivel);
CREATE INDEX IF NOT EXISTS idx_powerlifting_categoria ON app."Ejercicios_Powerlifting"(categoria);
CREATE INDEX IF NOT EXISTS idx_powerlifting_patron ON app."Ejercicios_Powerlifting"(patron);

-- Comentarios de documentación
COMMENT ON TABLE app."Ejercicios_Powerlifting" IS 'Catálogo de ejercicios de Powerlifting organizados por niveles';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".nivel IS 'Nivel del ejercicio: Novato, Intermedio, Avanzado, Elite';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".categoria IS 'Categoría del movimiento: Sentadilla, Press Banca, Peso Muerto, Asistencia';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".patron IS 'Patrón de movimiento: Compuesto, Variante, Aislamiento';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".intensidad IS 'Rango de intensidad recomendado en % 1RM o RPE';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".descanso_seg IS 'Descanso recomendado entre series en segundos';

-- ===========================================================================
-- VERIFICACIÓN DE CREACIÓN
-- ===========================================================================

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla Ejercicios_Powerlifting creada exitosamente' AS status;

-- Contar ejercicios iniciales (debería ser 0)
SELECT COUNT(*) as total_ejercicios FROM app."Ejercicios_Powerlifting";
