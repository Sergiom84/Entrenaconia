-- =============================================
-- 🔄 MIGRACIÓN DE TABLA user_exercise_feedback EXISTENTE
-- =============================================
-- Este script migra la tabla existente para agregar las columnas necesarias
-- y hacerla compatible con el sistema unificado de feedback

-- =============================================
-- 1. BACKUP DE DATOS EXISTENTES
-- =============================================

-- Crear tabla de backup temporal
CREATE TABLE IF NOT EXISTS app.user_exercise_feedback_backup AS
SELECT * FROM app.user_exercise_feedback;

SELECT 'Backup creado con ' || COUNT(*) || ' registros' as backup_status
FROM app.user_exercise_feedback_backup;

-- =============================================
-- 2. AGREGAR COLUMNAS FALTANTES PASO A PASO
-- =============================================

-- Agregar methodology_type (columna requerida)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'methodology_type'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN methodology_type VARCHAR(50);

    -- Actualizar con valores por defecto basados en datos existentes
    UPDATE app.user_exercise_feedback
    SET methodology_type = 'home_training'
    WHERE methodology_type IS NULL;

    -- Hacer la columna NOT NULL
    ALTER TABLE app.user_exercise_feedback
    ALTER COLUMN methodology_type SET NOT NULL;

    RAISE NOTICE 'Columna methodology_type agregada y poblada';
  ELSE
    RAISE NOTICE 'Columna methodology_type ya existe';
  END IF;
END $$;

-- Agregar feedback_type (reemplaza 'sentiment' con valores más específicos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'feedback_type'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN feedback_type VARCHAR(50);

    -- Migrar datos de sentiment a feedback_type
    UPDATE app.user_exercise_feedback
    SET feedback_type = CASE
      WHEN sentiment = 'negative' THEN 'dont_like'
      WHEN sentiment = 'positive' THEN 'love_it'
      WHEN sentiment IS NULL THEN 'neutral'
      ELSE sentiment
    END;

    -- Hacer la columna NOT NULL
    ALTER TABLE app.user_exercise_feedback
    ALTER COLUMN feedback_type SET NOT NULL;

    RAISE NOTICE 'Columna feedback_type agregada y migrada desde sentiment';
  ELSE
    RAISE NOTICE 'Columna feedback_type ya existe';
  END IF;
END $$;

-- Agregar ai_weight
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'ai_weight'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN ai_weight DECIMAL(3,2) DEFAULT 1.0;

    RAISE NOTICE 'Columna ai_weight agregada';
  ELSE
    RAISE NOTICE 'Columna ai_weight ya existe';
  END IF;
END $$;

-- Agregar avoidance_duration_days
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'avoidance_duration_days'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN avoidance_duration_days INTEGER;

    RAISE NOTICE 'Columna avoidance_duration_days agregada';
  ELSE
    RAISE NOTICE 'Columna avoidance_duration_days ya existe';
  END IF;
END $$;

-- Agregar expires_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN expires_at TIMESTAMP;

    RAISE NOTICE 'Columna expires_at agregada';
  ELSE
    RAISE NOTICE 'Columna expires_at ya existe';
  END IF;
END $$;

-- Agregar plan_id (referencia opcional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN plan_id INTEGER;

    RAISE NOTICE 'Columna plan_id agregada';
  ELSE
    RAISE NOTICE 'Columna plan_id ya existe';
  END IF;
END $$;

-- Agregar updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_exercise_feedback'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE app.user_exercise_feedback
    ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

    RAISE NOTICE 'Columna updated_at agregada';
  ELSE
    RAISE NOTICE 'Columna updated_at ya existe';
  END IF;
END $$;

-- =============================================
-- 3. CREAR TABLA user_training_preferences SI NO EXISTE
-- =============================================

CREATE TABLE IF NOT EXISTS app.user_training_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,

    -- Preferencias generales
    preferred_methodologies TEXT[], -- ['calistenia', 'home_training']
    focus_areas TEXT[], -- ['fuerza', 'resistencia', 'flexibilidad']
    physical_limitations TEXT[], -- ['espalda', 'rodillas']
    equipment_preferences TEXT[], -- ['sin_equipo', 'barras', 'bandas']

    -- Configuración de entrenamiento
    preferred_session_duration INTEGER, -- minutos
    progression_style VARCHAR(20) DEFAULT 'gradual', -- 'gradual', 'aggressive', 'conservative'

    -- Sensibilidad al feedback
    feedback_sensitivity DECIMAL(3,2) DEFAULT 0.8, -- Cuánto influye el feedback (0.0-1.0)

    -- Metadatos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Un usuario solo puede tener un registro de preferencias
    UNIQUE(user_id)
);

-- =============================================
-- 4. CREAR ÍNDICES OPTIMIZADOS
-- =============================================

-- Eliminar índices antiguos si existen y crear nuevos
DROP INDEX IF EXISTS idx_user_exercise_feedback_user_id;
DROP INDEX IF EXISTS idx_user_exercise_feedback_methodology;
DROP INDEX IF EXISTS idx_user_exercise_feedback_exercise;
DROP INDEX IF EXISTS idx_user_exercise_feedback_type;
DROP INDEX IF EXISTS idx_user_exercise_feedback_active;

-- Crear índices nuevos
CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_user_id
    ON app.user_exercise_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_methodology
    ON app.user_exercise_feedback(user_id, methodology_type);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_exercise
    ON app.user_exercise_feedback(exercise_name);

CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_type
    ON app.user_exercise_feedback(feedback_type);

-- Índice para registros activos (sin función NOW() para evitar problemas IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_user_exercise_feedback_active
    ON app.user_exercise_feedback(user_id, methodology_type, expires_at);

-- =============================================
-- 5. VERIFICACIÓN FINAL DE ESTRUCTURA
-- =============================================

SELECT
    'MIGRACIÓN COMPLETADA' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN methodology_type IS NOT NULL THEN 1 END) as records_with_methodology,
    COUNT(CASE WHEN feedback_type IS NOT NULL THEN 1 END) as records_with_feedback_type,
    COUNT(DISTINCT methodology_type) as distinct_methodologies
FROM app.user_exercise_feedback;

-- Mostrar estructura final
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'user_exercise_feedback'
ORDER BY ordinal_position;