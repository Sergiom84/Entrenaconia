-- Fix para user_equipment y user_custom_equipment
-- - Añade equipment_key si falta
-- - Backfill desde app.equipment_catalog (equipment_id -> code) si existe
-- - Crea índices únicos necesarios para ON CONFLICT
BEGIN;
SET search_path = app, public;

-- 1) Añadir equipment_key a user_equipment si no existe
ALTER TABLE app.user_equipment
  ADD COLUMN IF NOT EXISTS equipment_key TEXT;

-- 2) Backfill desde equipment_catalog.id -> .code cuando haya equipment_id y equipment_key esté NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='app' AND table_name='user_equipment' AND column_name='equipment_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='app' AND table_name='equipment_catalog' AND column_name='id'
  ) THEN
    UPDATE app.user_equipment ue
    SET equipment_key = ec.code
    FROM app.equipment_catalog ec
    WHERE ue.equipment_key IS NULL AND ue.equipment_id = ec.id;
  END IF;
END$$;

-- 3) Índice único para que ON CONFLICT (user_id, equipment_key) funcione
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_equipment_user_key
ON app.user_equipment(user_id, equipment_key);

-- 4) Índice único para user_custom_equipment (user_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_custom_equipment
ON app.user_custom_equipment(user_id, name);

COMMIT;
