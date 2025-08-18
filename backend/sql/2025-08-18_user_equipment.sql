-- Migration: user equipment catalog + mapping
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)
BEGIN;

-- 1) Catalog of equipment items
CREATE TABLE IF NOT EXISTS equipment_items (
  key TEXT PRIMARY KEY,               -- canonical key (snake_case)
  label TEXT NOT NULL,                -- display label
  level TEXT NOT NULL CHECK (level IN ('minimo','basico','avanzado'))
);

-- Seed catalog
INSERT INTO equipment_items (key, label, level) VALUES
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

-- 2) Mapping table between users and equipment items available at home
-- NOTE: Adjust users.id type if your users table uses UUID
CREATE TABLE IF NOT EXISTS user_equipment (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment_key TEXT NOT NULL REFERENCES equipment_items(key) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, equipment_key)
);

CREATE INDEX IF NOT EXISTS idx_user_equipment_user ON user_equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_user_equipment_key ON user_equipment(equipment_key);

COMMIT;

