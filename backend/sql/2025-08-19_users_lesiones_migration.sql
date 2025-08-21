-- Migración segura: añadir columna 'lesiones' sin romper código existente
-- Idea: mantener 'limitaciones_fisicas' por compatibilidad y usar 'lesiones' como nuevo nombre.
-- Puedes ejecutar esto en DBeaver. Es idempotente.

BEGIN;
SET search_path = app, public;

-- 1) Añadir columna si no existe (mismo tipo que limitaciones_fisicas: TEXT[])
ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS lesiones TEXT[];

-- 2) Backfill desde limitaciones_fisicas si lesiones está NULL
UPDATE app.users
   SET lesiones = COALESCE(lesiones, limitaciones_fisicas)
 WHERE lesiones IS NULL;

-- 3) Vista usada por la IA: exponer ambas, priorizando 'lesiones'
--    (sin romper el nombre antiguo para el backend actual)
CREATE OR REPLACE VIEW app.v_user_profile_normalized AS
SELECT
  id, nombre, apellido, email, edad, sexo, peso, altura,
  COALESCE(nivel_entrenamiento, nivel_actividad) AS nivel,
  COALESCE(anos_entrenando, "años_entrenando")  AS anos_entrenando,
  objetivo_principal,
  alergias, medicamentos, suplementacion,
  COALESCE(alimentos_excluidos, alimentos_evitar) AS alimentos_excluidos,
  COALESCE(lesiones, limitaciones_fisicas) AS limitaciones_fisicas,
  COALESCE(lesiones, limitaciones_fisicas) AS lesiones
FROM app.users;

COMMIT;

