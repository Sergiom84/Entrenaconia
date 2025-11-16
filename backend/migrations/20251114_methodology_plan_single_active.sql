-- ===============================================
-- Migration: Metodologías - un solo plan activo y feedback de sesiones
-- Fecha: 2025-11-14
-- ===============================================

BEGIN;

-- 1) Columnas adicionales para methodology_plans
ALTER TABLE app.methodology_plans
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'methodology',
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

COMMENT ON COLUMN app.methodology_plans.origin IS 'Fuente del plan (methodology, manual, imported, etc.)';
COMMENT ON COLUMN app.methodology_plans.is_current IS 'Plan visible actualmente en Rutinas (máximo uno por usuario).';

-- 2) Asegurar una sola fila marcada como actual por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uniq_current_methodology_plan
ON app.methodology_plans(user_id)
WHERE is_current IS TRUE;

-- 3) Tabla para feedback de ejercicios cancelados/saltados
CREATE TABLE IF NOT EXISTS app.methodology_session_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  methodology_plan_id INT NOT NULL REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
  methodology_session_id INT REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE,
  exercise_order INT,
  exercise_name TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('skipped','cancelled','unattended')),
  reason_code TEXT CHECK (reason_code IN ('dificil','no_se_ejecutarlo','lesion','otros','auto_timeout')),
  reason_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_methodology_session_feedback_plan
  ON app.methodology_session_feedback(methodology_plan_id);

-- 4) Porcentaje completado por sesión
ALTER TABLE app.methodology_exercise_sessions
  ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN app.methodology_exercise_sessions.completion_rate IS
'Porcentaje de ejercicios completados en la sesión (0-100).';

-- 5) Normalizar datos existentes → dejar solo el plan más reciente como actual
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
  FROM app.methodology_plans
  WHERE status IN ('active','draft')
)
UPDATE app.methodology_plans p
SET is_current = CASE WHEN ranked.rn = 1 THEN TRUE ELSE FALSE END
FROM ranked
WHERE ranked.id = p.id;

UPDATE app.methodology_plans
SET is_current = FALSE
WHERE status NOT IN ('active','draft');

COMMIT;
