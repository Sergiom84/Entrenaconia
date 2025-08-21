-- Baseline de equipamiento para compatibilizar con el backend
-- Crea app.equipment_items si no existe y asegura app.user_equipment con equipment_key TEXT
BEGIN;
SET search_path = app, public;

-- Tabla catálogo
CREATE TABLE IF NOT EXISTS app.equipment_items (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('minimo','basico','avanzado'))
);

-- Seed mínimo
INSERT INTO app.equipment_items (key, label, level) VALUES
  ('toallas','Toallas','minimo'),
  ('silla_sofa','Silla/Sofá','minimo'),
  ('esterilla','Esterilla','basico'),
  ('bandas_elasticas','Bandas elásticas','basico'),
  ('mancuernas','Mancuernas ajustables','basico'),
  ('banco_step','Banco/Step','basico'),
  ('trx','TRX','avanzado'),
  ('discos_olimpicos','Barra con discos profesionales','avanzado')
ON CONFLICT (key) DO NOTHING;

-- Tabla relación usuario-equipamiento (si no existe)
CREATE TABLE IF NOT EXISTS app.user_equipment (
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  equipment_key TEXT NOT NULL REFERENCES app.equipment_items(key) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, equipment_key)
);

-- Si la tabla ya existe con una columna equipment_id, la mantenemos; el backend usa equipment_key.

COMMIT;

