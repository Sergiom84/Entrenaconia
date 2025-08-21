-- Relajar NOT NULL en app.user_equipment.equipment_id para permitir usar equipment_key
BEGIN;
SET search_path = app, public;

-- Hacer nullable equipment_id si existe y es NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='app' AND table_name='user_equipment' AND column_name='equipment_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE app.user_equipment ALTER COLUMN equipment_id DROP NOT NULL;
  END IF;
END$$;

COMMIT;
