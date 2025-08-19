// node backend/scripts/initHomeTrainingTables.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  application_name: "EntrenaConIA:initHomeTrainingTables",
  options: "-c search_path=app,public",
});
pool.on("connect", (c) => c.query("SET search_path TO app, public"));

const ddl = `
BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

-- Función updated_at (una sola para todas)
CREATE OR REPLACE FUNCTION app.tg_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

-- ========== TABLAS ==========
CREATE TABLE IF NOT EXISTS app.home_training_plans (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL,
  plan_data            JSONB   NOT NULL,
  equipment_type       VARCHAR(50) NOT NULL,
  training_type        VARCHAR(50) NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS tg_upd_plans ON app.home_training_plans;
CREATE TRIGGER tg_upd_plans BEFORE UPDATE ON app.home_training_plans
FOR EACH ROW EXECUTE FUNCTION app.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS app.home_training_sessions (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL,
  status                 TEXT    NOT NULL DEFAULT 'in_progress',
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at           TIMESTAMPTZ,
  exercises_completed    INTEGER NOT NULL DEFAULT 0,
  total_exercises        INTEGER NOT NULL DEFAULT 0,
  progress_percentage    NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app.home_exercise_progress (
  id                          SERIAL PRIMARY KEY,
  home_training_session_id    INTEGER NOT NULL REFERENCES app.home_training_sessions(id) ON DELETE CASCADE,
  exercise_order              INTEGER NOT NULL,
  exercise_name               TEXT    NOT NULL,
  total_series                INTEGER NOT NULL DEFAULT 0,
  series_completed            INTEGER NOT NULL DEFAULT 0,
  status                      TEXT    NOT NULL DEFAULT 'pending',
  duration_seconds            INTEGER,
  started_at                  TIMESTAMPTZ DEFAULT now(),
  completed_at                TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app.user_exercise_history (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  exercise_name     TEXT    NOT NULL,
  exercise_key      TEXT,
  reps              INTEGER,
  series            INTEGER,
  duration_seconds  INTEGER,
  session_id        INTEGER,
  plan_id           INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Si aún existiera performed_at en entornos antiguos, elimínalo:
ALTER TABLE app.user_exercise_history DROP COLUMN IF EXISTS performed_at;

-- Feedback por ejercicio (sentimiento + comentario)
CREATE TABLE IF NOT EXISTS app.user_exercise_feedback (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  session_id       INTEGER,
  exercise_order   INTEGER,
  exercise_name    TEXT,
  exercise_key     TEXT,
  sentiment        TEXT NOT NULL CHECK (sentiment IN ('dislike','hard','love')),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.user_home_training_stats (
  id                         SERIAL PRIMARY KEY,
  user_id                    INTEGER NOT NULL UNIQUE,
  total_sessions             INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds     INTEGER NOT NULL DEFAULT 0,
  current_streak_days        INTEGER NOT NULL DEFAULT 0,
  longest_streak_days        INTEGER NOT NULL DEFAULT 0,
  last_training_date         TIMESTAMPTZ,
  favorite_equipment         TEXT,
  favorite_training_type     TEXT,
  total_exercises_completed  INTEGER NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== ÍNDICES ==========
CREATE INDEX IF NOT EXISTS idx_plans_user_created
  ON app.home_training_plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started
  ON app.home_training_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_session_order
  ON app.home_exercise_progress (home_training_session_id, exercise_order);
CREATE INDEX IF NOT EXISTS idx_history_user_created
  ON app.user_exercise_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_key
  ON app.user_exercise_history (exercise_key);

-- ========== VISTAS AUX ==========
CREATE OR REPLACE VIEW app.v_hist_real AS
SELECT
  id, user_id, created_at, exercise_name,
  COALESCE(exercise_key, lower(regexp_replace(exercise_name, '[^a-z0-9]+', '_', 'g'))) AS exercise_key,
  series, duration_seconds, session_id, plan_id
FROM app.user_exercise_history;

CREATE OR REPLACE VIEW app.v_hist_propuesto AS
SELECT
  p.id AS plan_id,
  p.user_id,
  p.created_at,
  (x->>'nombre')::text AS exercise_name,
  lower(regexp_replace((x->>'nombre')::text, '[^a-z0-9]+', '_', 'g')) AS exercise_key
FROM app.home_training_plans p
CROSS JOIN LATERAL jsonb_array_elements(p.plan_data->'plan_entrenamiento'->'ejercicios') x;

CREATE OR REPLACE VIEW app.v_user_profile_normalized AS
SELECT
  id, nombre, apellido, email, edad, sexo, peso, altura,
  COALESCE(nivel_entrenamiento, nivel_actividad) AS nivel,
  COALESCE(anos_entrenando, "años_entrenando")  AS anos_entrenando,
  objetivo_principal,
  alergias, medicamentos, suplementacion,
  COALESCE(alimentos_excluidos, alimentos_evitar) AS alimentos_excluidos,
  limitaciones_fisicas
FROM app.users;

COMMIT;
`;

(async () => {
  const client = await pool.connect();
  try {
    await client.query(ddl);
    console.log("✅ Tablas/índices/vistas de Home Training aseguradas en esquema app.");
  } catch (e) {
    console.error("❌ Error aplicando DDL:", e);
    await client.query("ROLLBACK");
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
