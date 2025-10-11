-- ===========================================================================
-- CREAR TABLA DE EJERCICIOS DE CROSSFIT
-- ===========================================================================
-- Descripción: Tabla para almacenar ejercicios de CrossFit organizados por
--              niveles (Scaled, RX, RX+, Elite) y dominios (Gymnastic,
--              Weightlifting, Monostructural)
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-01-10
-- Versión: 1.0.0
-- ===========================================================================

-- Eliminar tabla si existe (solo para desarrollo)
-- DROP TABLE IF EXISTS app."Ejercicios_CrossFit" CASCADE;

-- Crear tabla de ejercicios de CrossFit
CREATE TABLE IF NOT EXISTS app."Ejercicios_CrossFit" (
  -- Identificador único del ejercicio
  exercise_id SERIAL PRIMARY KEY,

  -- Información básica del ejercicio
  nombre VARCHAR(200) NOT NULL,

  -- Nivel de dificultad (normalizado a Principiante, Intermedio, Avanzado, Elite)
  -- Scaled = Principiante, RX = Intermedio, RX+ = Avanzado, Elite = Elite
  nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('Principiante', 'Intermedio', 'Avanzado', 'Elite')),

  -- Dominio de CrossFit
  dominio VARCHAR(100) NOT NULL CHECK (dominio IN ('Gymnastic', 'Weightlifting', 'Monostructural', 'Accesorios')),

  -- Categoría específica dentro del dominio
  categoria VARCHAR(100),

  -- Equipamiento necesario
  equipamiento VARCHAR(200),

  -- Tipo de WOD común para este ejercicio
  tipo_wod VARCHAR(100),

  -- Intensidad recomendada (RPE, % 1RM, Pace, etc.)
  intensidad VARCHAR(50),

  -- Duración estimada del movimiento (en segundos)
  duracion_seg INT,

  -- Descanso típico entre sets (en segundos)
  descanso_seg INT DEFAULT 60,

  -- Escalamiento (cómo modificar para principiantes)
  escalamiento TEXT,

  -- Notas técnicas y consejos
  notas TEXT,

  -- Timestamps de auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE QUERIES
-- ===========================================================================

-- Índice por nivel (búsquedas más comunes)
CREATE INDEX IF NOT EXISTS idx_crossfit_nivel
ON app."Ejercicios_CrossFit"(nivel);

-- Índice por dominio (filtrar por Gymnastic, WL, Mono)
CREATE INDEX IF NOT EXISTS idx_crossfit_dominio
ON app."Ejercicios_CrossFit"(dominio);

-- Índice por categoría (búsquedas específicas)
CREATE INDEX IF NOT EXISTS idx_crossfit_categoria
ON app."Ejercicios_CrossFit"(categoria);

-- Índice compuesto nivel + dominio (queries frecuentes)
CREATE INDEX IF NOT EXISTS idx_crossfit_nivel_dominio
ON app."Ejercicios_CrossFit"(nivel, dominio);

-- Índice por tipo de WOD
CREATE INDEX IF NOT EXISTS idx_crossfit_tipo_wod
ON app."Ejercicios_CrossFit"(tipo_wod);

-- ===========================================================================
-- FUNCIÓN TRIGGER PARA ACTUALIZAR updated_at
-- ===========================================================================

CREATE OR REPLACE FUNCTION app.update_crossfit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_update_crossfit_timestamp ON app."Ejercicios_CrossFit";
CREATE TRIGGER trigger_update_crossfit_timestamp
  BEFORE UPDATE ON app."Ejercicios_CrossFit"
  FOR EACH ROW
  EXECUTE FUNCTION app.update_crossfit_updated_at();

-- ===========================================================================
-- COMENTARIOS EN LA TABLA
-- ===========================================================================

COMMENT ON TABLE app."Ejercicios_CrossFit" IS
'Tabla de ejercicios de CrossFit organizados por niveles (Scaled, RX, RX+, Elite) y dominios (Gymnastic, Weightlifting, Monostructural). Utilizada por el especialista de IA para generar WODs personalizados.';

COMMENT ON COLUMN app."Ejercicios_CrossFit".exercise_id IS
'ID único autoincremental del ejercicio';

COMMENT ON COLUMN app."Ejercicios_CrossFit".nombre IS
'Nombre descriptivo del ejercicio (ej: "Pull-Ups", "Thrusters", "Rowing")';

COMMENT ON COLUMN app."Ejercicios_CrossFit".nivel IS
'Nivel de dificultad: Principiante (Scaled), Intermedio (RX), Avanzado (RX+), Elite';

COMMENT ON COLUMN app."Ejercicios_CrossFit".dominio IS
'Dominio de CrossFit: Gymnastic (movimientos gimnásticos), Weightlifting (levantamientos olímpicos), Monostructural (cardio metabólico), Accesorios';

COMMENT ON COLUMN app."Ejercicios_CrossFit".categoria IS
'Categoría específica (ej: Pull-Ups, Squats, Olympic Lifts, Cardio)';

COMMENT ON COLUMN app."Ejercicios_CrossFit".tipo_wod IS
'Tipo de WOD recomendado: AMRAP, EMOM, For Time, Tabata, Chipper, Strength';

COMMENT ON COLUMN app."Ejercicios_CrossFit".descanso_seg IS
'Descanso típico entre sets en segundos (30-180s según intensidad)';

COMMENT ON COLUMN app."Ejercicios_CrossFit".escalamiento IS
'Cómo escalar el ejercicio para principiantes (bandas, knees, etc.)';

-- ===========================================================================
-- VERIFICACIÓN DE CREACIÓN
-- ===========================================================================

-- Mostrar información de la tabla
SELECT
  'Tabla Ejercicios_CrossFit creada exitosamente' as status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'app' AND table_name = 'Ejercicios_CrossFit') as total_columnas;

-- Listar columnas
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' AND table_name = 'Ejercicios_CrossFit'
ORDER BY ordinal_position;

-- Listar índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'app' AND tablename = 'Ejercicios_CrossFit';

-- ===========================================================================
-- FIN DEL SCRIPT
-- ===========================================================================
