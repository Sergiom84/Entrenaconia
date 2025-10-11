-- ===========================================================================
-- TABLA DE EJERCICIOS PARA OPOSICIONES DE BOMBEROS
-- ===========================================================================
-- Descripción: Tabla para almacenar ejercicios de preparación física para
--              oposiciones de Bombero organizados por niveles progresivos
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- Eliminar tabla si existe (recrear con estructura optimizada para Bomberos)
DROP TABLE IF EXISTS app."Ejercicios_Bomberos" CASCADE;

-- Crear tabla de Ejercicios_Bomberos
CREATE TABLE IF NOT EXISTS app."Ejercicios_Bomberos" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  nivel VARCHAR(50) NOT NULL,  -- Novato, Intermedio, Avanzado
  categoria VARCHAR(100) NOT NULL,  -- Natación, Carrera, Fuerza, Agilidad, Resistencia
  tipo_prueba VARCHAR(100),  -- Oficial, Preparatoria, Técnica
  baremo_hombres VARCHAR(150),  -- Marcas objetivo hombres
  baremo_mujeres VARCHAR(150),  -- Marcas objetivo mujeres
  series_reps_objetivo VARCHAR(50),
  intensidad VARCHAR(50),  -- Baja, Moderada, Alta, Máxima
  descanso_seg INT,
  equipamiento VARCHAR(200),  -- Piscina, Cuerda, Barra, Balón medicinal, etc.
  notas TEXT,  -- Técnica específica, consejos, errores a evitar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_bomberos_nivel ON app."Ejercicios_Bomberos"(nivel);
CREATE INDEX IF NOT EXISTS idx_bomberos_categoria ON app."Ejercicios_Bomberos"(categoria);
CREATE INDEX IF NOT EXISTS idx_bomberos_tipo_prueba ON app."Ejercicios_Bomberos"(tipo_prueba);

-- Comentarios de documentación
COMMENT ON TABLE app."Ejercicios_Bomberos" IS 'Catálogo de ejercicios para preparación de oposiciones de Bombero';
COMMENT ON COLUMN app."Ejercicios_Bomberos".nivel IS 'Nivel del ejercicio: Novato, Intermedio, Avanzado';
COMMENT ON COLUMN app."Ejercicios_Bomberos".categoria IS 'Categoría: Natación, Carrera, Fuerza, Agilidad, Resistencia';
COMMENT ON COLUMN app."Ejercicios_Bomberos".tipo_prueba IS 'Tipo: Oficial (en examen), Preparatoria, Técnica';
COMMENT ON COLUMN app."Ejercicios_Bomberos".baremo_hombres IS 'Marcas mínimas/objetivo para hombres según baremo oficial';
COMMENT ON COLUMN app."Ejercicios_Bomberos".baremo_mujeres IS 'Marcas mínimas/objetivo para mujeres según baremo oficial';
COMMENT ON COLUMN app."Ejercicios_Bomberos".descanso_seg IS 'Descanso recomendado entre series en segundos';

-- ===========================================================================
-- VERIFICACIÓN DE CREACIÓN
-- ===========================================================================

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla Ejercicios_Bomberos creada exitosamente' AS status;

-- Contar ejercicios iniciales (debería ser 0)
SELECT COUNT(*) as total_ejercicios FROM app."Ejercicios_Bomberos";
