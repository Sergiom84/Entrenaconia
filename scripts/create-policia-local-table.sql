-- ===========================================================================
-- TABLA DE EJERCICIOS PARA OPOSICIONES DE POLICÍA LOCAL
-- ===========================================================================
-- Descripción: Tabla para almacenar ejercicios de preparación física para
--              oposiciones de Policía Local organizados por niveles progresivos
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- Eliminar tabla si existe (recrear con estructura optimizada para Policía Local)
DROP TABLE IF EXISTS app."Ejercicios_Policia_Local" CASCADE;

-- Crear tabla de Ejercicios_Policia_Local
CREATE TABLE IF NOT EXISTS app."Ejercicios_Policia_Local" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  nivel VARCHAR(50) NOT NULL,  -- Novato, Intermedio, Avanzado
  categoria VARCHAR(100) NOT NULL,  -- Velocidad, Resistencia, Salto, Fuerza, Agilidad
  tipo_prueba VARCHAR(100),  -- Oficial, Preparatoria, Técnica
  baremo_hombres VARCHAR(150),  -- Marcas objetivo hombres
  baremo_mujeres VARCHAR(150),  -- Marcas objetivo mujeres
  series_reps_objetivo VARCHAR(50),
  intensidad VARCHAR(50),  -- Baja, Moderada, Alta, Máxima
  descanso_seg INT,
  equipamiento VARCHAR(200),  -- Pista, Foso salto, Barra, Obstáculos
  notas TEXT,  -- Técnica específica, consejos, errores a evitar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_policia_local_nivel ON app."Ejercicios_Policia_Local"(nivel);
CREATE INDEX IF NOT EXISTS idx_policia_local_categoria ON app."Ejercicios_Policia_Local"(categoria);
CREATE INDEX IF NOT EXISTS idx_policia_local_tipo_prueba ON app."Ejercicios_Policia_Local"(tipo_prueba);

-- Comentarios de documentación
COMMENT ON TABLE app."Ejercicios_Policia_Local" IS 'Catálogo de ejercicios para preparación de oposiciones de Policía Local';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".nivel IS 'Nivel del ejercicio: Novato, Intermedio, Avanzado';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".categoria IS 'Categoría: Velocidad, Resistencia, Salto, Fuerza, Agilidad';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".tipo_prueba IS 'Tipo: Oficial (en examen), Preparatoria, Técnica';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".baremo_hombres IS 'Marcas mínimas/objetivo para hombres según baremo oficial';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".baremo_mujeres IS 'Marcas mínimas/objetivo para mujeres según baremo oficial';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".descanso_seg IS 'Descanso recomendado entre series en segundos';

-- ===========================================================================
-- VERIFICACIÓN DE CREACIÓN
-- ===========================================================================

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla Ejercicios_Policia_Local creada exitosamente' AS status;

-- Contar ejercicios iniciales (debería ser 0)
SELECT COUNT(*) as total_ejercicios FROM app."Ejercicios_Policia_Local";
