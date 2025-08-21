-- Comprobaciones de estructura en BD (perfil/lesiones)
SET search_path = app, public;

-- 1) ¿Existe la columna limitaciones_fisicas en app.users? Tipo de dato
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name   = 'users'
  AND column_name  IN ('limitaciones_fisicas','lesiones');

-- 2) Muestra un ejemplo de 5 usuarios con ese campo para ver el formato
SELECT id, nombre, limitaciones_fisicas
FROM app.users
ORDER BY id
LIMIT 5;

-- 3) Confirmar vista usada por IA incluye el campo
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'app' AND table_name = 'v_user_profile_normalized';

-- 4) Ver definición actual de la vista (si tienes permisos)
-- Nota: en DBeaver, puedes usar "Generate SQL -> DDL" sobre la vista.
-- Aquí una aproximación con pg_get_viewdef si está permitido
SELECT pg_get_viewdef('app.v_user_profile_normalized'::regclass) AS view_sql;

