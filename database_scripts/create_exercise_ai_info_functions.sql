-- Functions related to exercise_ai_info table used by IA Home Training
-- Safe, idempotent definitions to avoid errors in production

-- 1) Ensure table exists (minimal columns used by the app)
CREATE TABLE IF NOT EXISTS app.exercise_ai_info (
  id SERIAL PRIMARY KEY,
  exercise_name TEXT UNIQUE NOT NULL,
  exercise_name_normalized TEXT,
  ejecucion TEXT,
  consejos TEXT,
  errores_evitar TEXT,
  request_count INTEGER NOT NULL DEFAULT 0,
  first_requested_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Normalization helper (no-op if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app' AND p.proname = 'normalize_exercise_name'
  ) THEN
    CREATE OR REPLACE FUNCTION app.normalize_exercise_name(p_name TEXT)
    RETURNS TEXT AS $$
    BEGIN
      RETURN lower(trim(regexp_replace(p_name, '\\s+', ' ', 'g')));
    END; $$ LANGUAGE plpgsql IMMUTABLE;
  END IF;
END $$;

-- 3) Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_upd_exercise_ai_info ON app.exercise_ai_info;
CREATE OR REPLACE FUNCTION app.tg_set_updated_at_exercise_ai() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_upd_exercise_ai_info
BEFORE UPDATE ON app.exercise_ai_info
FOR EACH ROW EXECUTE FUNCTION app.tg_set_updated_at_exercise_ai();

-- 4) Fix/define increment function (used by backend)
CREATE OR REPLACE FUNCTION app.increment_exercise_request_count(exercise_name_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE app.exercise_ai_info
     SET request_count = COALESCE(request_count, 0) + 1,
         updated_at = NOW()
   WHERE exercise_name = exercise_name_param
      OR exercise_name_normalized = app.normalize_exercise_name(exercise_name_param);
END;
$$ LANGUAGE plpgsql;
