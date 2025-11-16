-- ============================================================================
-- MIGRACIÓN: Sistema Unificado de Entrenamiento
-- Fecha: 2025-11-15
-- Descripción: Normalización completa del sistema de rutinas y entrenamientos
-- ============================================================================

BEGIN;

-- ============================================================================
-- PARTE 1: NORMALIZACIÓN DE METHODOLOGY_PLANS
-- ============================================================================

-- 1.1 Agregar columnas faltantes si no existen
ALTER TABLE app.methodology_plans
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'methodology',
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

COMMENT ON COLUMN app.methodology_plans.origin IS 
  'Origen del plan: methodology (rutinas) o home_training (entrenamiento en casa)';
COMMENT ON COLUMN app.methodology_plans.is_current IS 
  'Indica si es el plan activo visible en Rutinas (máx. 1 por usuario)';

-- 1.2 Crear índice único para enforcar 1 solo plan activo
DROP INDEX IF EXISTS app.uniq_current_methodology_plan;
CREATE UNIQUE INDEX uniq_current_methodology_plan 
ON app.methodology_plans(user_id) 
WHERE is_current IS TRUE AND status = 'active';

COMMENT ON INDEX app.uniq_current_methodology_plan IS 
  'Garantiza que solo haya 1 plan activo de metodología por usuario';

-- 1.3 Limpieza de datos: marcar solo el plan más reciente como current
WITH ranked_plans AS (
  SELECT 
    id, 
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY 
        CASE WHEN status = 'active' THEN 1 ELSE 2 END,
        confirmed_at DESC NULLS LAST, 
        created_at DESC
    ) as rn
  FROM app.methodology_plans
  WHERE status IN ('active', 'draft')
)
UPDATE app.methodology_plans p
SET 
  is_current = (rp.rn = 1),
  status = CASE 
    WHEN rp.rn = 1 AND p.status = 'draft' THEN 'active'
    WHEN rp.rn > 1 AND p.status = 'active' THEN 'completed'
    ELSE p.status
  END,
  completed_at = CASE 
    WHEN rp.rn > 1 AND p.status = 'active' THEN NOW()
    ELSE p.completed_at
  END
FROM ranked_plans rp
WHERE p.id = rp.id;

-- 1.4 Marcar planes antiguos como completados
UPDATE app.methodology_plans
SET 
  is_current = FALSE,
  status = 'completed',
  completed_at = COALESCE(completed_at, NOW())
WHERE status NOT IN ('active', 'draft', 'cancelled')
  AND is_current IS NULL;

-- ============================================================================
-- PARTE 2: NORMALIZACIÓN DE METHODOLOGY_EXERCISE_SESSIONS
-- ============================================================================

-- 2.1 Agregar columnas de métricas si no existen
ALTER TABLE app.methodology_exercise_sessions
  ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(5,2) DEFAULT 0.00;

-- Verificar que las columnas de contadores existen (ya están en el schema)
-- exercises_completed, exercises_total, exercises_skipped, exercises_cancelled

-- 2.2 Actualizar constraint de estados de sesión
ALTER TABLE app.methodology_exercise_sessions
DROP CONSTRAINT IF EXISTS check_session_status;

ALTER TABLE app.methodology_exercise_sessions
ADD CONSTRAINT check_session_status 
CHECK (session_status IN (
  'scheduled',    -- Sesión programada, no iniciada
  'pending',      -- Alias de scheduled (compatibilidad)
  'in_progress',  -- Usuario comenzó pero no terminó
  'completed',    -- TODOS los ejercicios completados
  'partial',      -- Algunos completados, otros saltados/cancelados
  'cancelled',    -- Usuario canceló la sesión completa
  'skipped',      -- Usuario saltó la sesión completa
  'missed'        -- No realizada antes de 23:49h
));

COMMENT ON CONSTRAINT check_session_status ON app.methodology_exercise_sessions IS
  'Estados válidos de sesión: scheduled, in_progress, completed, partial, cancelled, skipped, missed';

-- 2.3 Recalcular completion_rate para sesiones existentes
UPDATE app.methodology_exercise_sessions
SET completion_rate = CASE 
  WHEN total_exercises > 0 THEN 
    ROUND((exercises_completed::NUMERIC / total_exercises::NUMERIC) * 100, 2)
  ELSE 0.00
END
WHERE completion_rate IS NULL OR completion_rate = 0;

-- ============================================================================
-- PARTE 3: TABLA DE FEEDBACK DE SESIONES
-- ============================================================================

-- 3.1 Crear tabla si no existe
CREATE TABLE IF NOT EXISTS app.methodology_session_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  methodology_plan_id INT NOT NULL REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
  methodology_session_id INT REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE,
  exercise_order INT,
  exercise_name TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('skipped', 'cancelled', 'missed')),
  reason_code TEXT CHECK (reason_code IN (
    'dificil', 'no_se_ejecutar', 'lesion', 'equipamiento',
    'cansancio', 'tiempo', 'motivacion', 'auto_missed', 'otros'
  )),
  reason_text TEXT,
  difficulty_rating INT CHECK (difficulty_rating BETWEEN 1 AND 5),
  would_retry BOOLEAN DEFAULT FALSE,
  alternative_suggested TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3.2 Crear índices para feedback
CREATE INDEX IF NOT EXISTS idx_session_feedback_plan
  ON app.methodology_session_feedback(methodology_plan_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_reason 
  ON app.methodology_session_feedback(user_id, reason_code);

CREATE INDEX IF NOT EXISTS idx_feedback_session
  ON app.methodology_session_feedback(methodology_session_id);

COMMENT ON TABLE app.methodology_session_feedback IS
  'Feedback de usuario sobre ejercicios/sesiones saltados/cancelados para mejorar futuras rutinas';

COMMIT;

