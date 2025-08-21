-- Migration: user custom equipment + views for full equipment
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)
BEGIN;

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS app;

-- 1) Catalog table (if not already created by previous migration)
CREATE TABLE IF NOT EXISTS app.equipment_items (
  key TEXT PRIMARY KEY,               -- canonical key (snake_case)
  label TEXT NOT NULL,                -- display label (ES)
  level TEXT NOT NULL CHECK (level IN ('minimo','basico','avanzado')),
  icon TEXT                           -- optional icon name
);

-- Seed catalog (will no-op on conflicts)
INSERT INTO app.equipment_items (key, label, level) VALUES
  -- Minimo
  ('peso_corporal','Peso corporal','minimo'),
  ('toallas','Toallas','minimo'),
  ('silla_sofa','Silla/Sofá','minimo'),
  ('pared','Pared','minimo'),
  -- Basico
  ('mancuernas','Mancuernas ajustables','basico'),
  ('bandas_elasticas','Bandas elásticas','basico'),
  ('esterilla','Esterilla','basico'),
  ('banco_step','Banco/Step','basico'),
  -- Avanzado
  ('barra_dominadas','Barra dominadas','avanzado'),
  ('kettlebells','Kettlebells','avanzado'),
  ('trx','TRX','avanzado'),
  ('discos_olimpicos','Discos olímpicos','avanzado')
ON CONFLICT (key) DO NOTHING;

-- 2) Mapping curated equipment selected by user
CREATE TABLE IF NOT EXISTS app.user_equipment (
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  equipment_key TEXT NOT NULL REFERENCES app.equipment_items(key) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, equipment_key)
);

CREATE INDEX IF NOT EXISTS idx_user_equipment_user ON app.user_equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_user_equipment_key ON app.user_equipment(equipment_key);

-- 3) Custom (free text) equipment per user
CREATE TABLE IF NOT EXISTS app.user_custom_equipment (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_custom_equipment UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_equipment_user ON app.user_custom_equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_equipment_name ON app.user_custom_equipment(LOWER(name));

-- 4) Views to simplify queries
-- Unified catalog view (alias with expected API fields)
CREATE OR REPLACE VIEW app.equipment_catalog AS
SELECT key AS code, label AS name, level, icon
FROM app.equipment_items
WHERE TRUE;

-- Full per-user equipment as curated + custom
CREATE OR REPLACE VIEW app.v_user_equipment_full AS
SELECT 
  ue.user_id,
  ei.key            AS equipment_key,
  ei.label          AS equipment_label,
  ei.level          AS level,
  FALSE             AS is_custom,
  NULL::BIGINT      AS custom_id,
  NULL::TEXT        AS custom_name,
  ue.created_at     AS created_at
FROM app.user_equipment ue
JOIN app.equipment_items ei ON ei.key = ue.equipment_key
UNION ALL
SELECT 
  uce.user_id,
  NULL              AS equipment_key,
  NULL              AS equipment_label,
  NULL              AS level,
  TRUE              AS is_custom,
  uce.id            AS custom_id,
  uce.name          AS custom_name,
  uce.created_at    AS created_at
FROM app.user_custom_equipment uce;

COMMIT;

