-- ===========================================================================
-- TABLA DE EJERCICIOS PARA OPOSICIONES DE GUARDIA CIVIL
-- ===========================================================================
-- Descripción: Tabla para almacenar ejercicios de preparación física para
--              oposiciones de Guardia Civil organizados por niveles progresivos
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- Eliminar tabla si existe (recrear con estructura optimizada para Guardia Civil)
DROP TABLE IF EXISTS app."Ejercicios_Guardia_Civil" CASCADE;

-- Crear tabla de Ejercicios_Guardia_Civil
CREATE TABLE IF NOT EXISTS app."Ejercicios_Guardia_Civil" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  nivel VARCHAR(50) NOT NULL,  -- Novato, Intermedio, Avanzado
  categoria VARCHAR(100) NOT NULL,  -- Circuito, Carrera, Fuerza, Natación
  tipo_prueba VARCHAR(100),  -- Oficial, Preparatoria, Técnica
  baremo_hombres VARCHAR(150),  -- Marcas objetivo hombres (tiempo, repeticiones)
  baremo_mujeres VARCHAR(150),  -- Marcas objetivo mujeres (tiempo, repeticiones)
  series_reps_objetivo VARCHAR(50),
  intensidad VARCHAR(50),  -- Baja, Moderada, Alta, Máxima
  descanso_seg INT,
  equipamiento VARCHAR(200),  -- Obstáculos, Piscina, Barra, etc.
  notas TEXT,  -- Técnica específica, consejos, errores a evitar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_guardia_civil_nivel ON app."Ejercicios_Guardia_Civil"(nivel);
CREATE INDEX IF NOT EXISTS idx_guardia_civil_categoria ON app."Ejercicios_Guardia_Civil"(categoria);
CREATE INDEX IF NOT EXISTS idx_guardia_civil_tipo_prueba ON app."Ejercicios_Guardia_Civil"(tipo_prueba);

-- Comentarios de documentación
COMMENT ON TABLE app."Ejercicios_Guardia_Civil" IS 'Catálogo de ejercicios para preparación de oposiciones de Guardia Civil';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".nivel IS 'Nivel del ejercicio: Novato, Intermedio, Avanzado';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".categoria IS 'Categoría: Circuito, Carrera, Fuerza, Natación';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".tipo_prueba IS 'Tipo: Oficial (en examen), Preparatoria, Técnica';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".baremo_hombres IS 'Marcas mínimas/objetivo para hombres según baremo oficial';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".baremo_mujeres IS 'Marcas mínimas/objetivo para mujeres según baremo oficial';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".descanso_seg IS 'Descanso recomendado entre series en segundos';

-- ===========================================================================
-- VERIFICACIÓN DE CREACIÓN
-- ===========================================================================

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla Ejercicios_Guardia_Civil creada exitosamente' AS status;

-- Contar ejercicios iniciales (debería ser 0)
SELECT COUNT(*) as total_ejercicios FROM app."Ejercicios_Guardia_Civil";
