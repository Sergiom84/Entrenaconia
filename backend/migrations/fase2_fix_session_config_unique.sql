-- ============================================================
-- FASE 2 - PARCHE: UNIFICAR CONFIGURACIONES D1-D5
-- ============================================================
-- Objetivo:
-- 1. Eliminar duplicados en app.hipertrofia_v2_session_config
--    (se detectaron 10 filas en vez de 5)
-- 2. Asegurar que solo exista una fila por cycle_day
-- ============================================================

-- 1) ELIMINAR DUPLICADOS (mantener la fila más antigua por cycle_day)
WITH ranked_configs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY cycle_day ORDER BY created_at, id) AS rn
  FROM app.hipertrofia_v2_session_config
)
DELETE FROM app.hipertrofia_v2_session_config c
USING ranked_configs r
WHERE c.id = r.id
  AND r.rn > 1;

-- 2) AÑADIR ÍNDICE ÚNICO PARA EVITAR FUTUROS DUPLICADOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'app'
      AND indexname = 'uidx_session_config_cycle_day'
  ) THEN
    CREATE UNIQUE INDEX uidx_session_config_cycle_day
      ON app.hipertrofia_v2_session_config(cycle_day);
  END IF;
END;
$$;

-- 3) VERIFICACIÓN
SELECT
  cycle_day,
  COUNT(*) AS total_filas
FROM app.hipertrofia_v2_session_config
GROUP BY cycle_day
ORDER BY cycle_day;

SELECT
  'uidx_session_config_cycle_day' AS indice,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'app'
      AND indexname = 'uidx_session_config_cycle_day'
  ) THEN '✅ Creado' ELSE '❌ FALTA' END AS estado;

-- ============================================================
-- FIN DEL PARCHE
-- ============================================================
