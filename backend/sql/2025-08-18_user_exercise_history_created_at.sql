-- Idempotent migration: ensure created_at exists, is filled, and has DEFAULT now()
-- Schema-qualified with app.

BEGIN;

-- 1) Add column if it doesn't exist
ALTER TABLE app.user_exercise_history
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- 2) Backfill from performed_at if exists and created_at is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name   = 'user_exercise_history'
      AND column_name  = 'performed_at'
  ) THEN
    EXECUTE $$
      UPDATE app.user_exercise_history
      SET created_at = COALESCE(created_at, performed_at)
      WHERE created_at IS NULL
    $$;
  END IF;
END $$;

-- 3) Set DEFAULT now()
ALTER TABLE app.user_exercise_history
  ALTER COLUMN created_at SET DEFAULT now();

-- 4) Create helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_ex_hist_user ON app.user_exercise_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ex_hist_created ON app.user_exercise_history(created_at);
CREATE INDEX IF NOT EXISTS idx_user_ex_hist_key ON app.user_exercise_history(exercise_key);

-- 5) (Optional) Recreate helper views used by backend prompts if desired
-- These are safe redefinitions if you already have them.
CREATE OR REPLACE VIEW app.v_hist_real AS
SELECT user_id,
       exercise_name,
       COALESCE(exercise_key, regexp_replace(lower(exercise_name), '[^a-z0-9]+', '_', 'g')) AS exercise_key,
       created_at
FROM app.user_exercise_history;

CREATE OR REPLACE VIEW app.v_hist_propuesto AS
SELECT p.user_id,
       (x->>'nombre')::text AS exercise_name,
       regexp_replace(lower((x->>'nombre')::text), '[^a-z0-9]+', '_', 'g') AS exercise_key,
       p.created_at
FROM app.home_training_plans p
CROSS JOIN LATERAL jsonb_array_elements(p.plan_data->'plan_entrenamiento'->'ejercicios') x;

COMMIT;

