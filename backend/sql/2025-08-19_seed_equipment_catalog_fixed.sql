-- Seed para app.equipment_catalog (sin columna level que no existe)
SET search_path = app, public;

INSERT INTO app.equipment_catalog (code, name, icon)
VALUES
  ('toallas', 'Toallas', NULL),
  ('silla_sofa', 'Silla/Sofá', NULL),
  ('esterilla', 'Esterilla', NULL),
  ('bandas_elasticas', 'Bandas elásticas', NULL),
  ('mancuernas', 'Mancuernas ajustables', NULL),
  ('banco_step', 'Banco/Step', NULL),
  ('trx', 'TRX', NULL),
  ('discos_olimpicos', 'Barra con discos profesionales', NULL)
ON CONFLICT (code) DO NOTHING;
