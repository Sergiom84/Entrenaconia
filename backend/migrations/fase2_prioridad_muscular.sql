-- ============================================================
-- FASE 2 - MÓDULO 4: PRIORIDAD MUSCULAR
-- ============================================================
-- Objetivo:
-- - Permitir activar 1 músculo prioritario por microciclos (2-3)
-- - Aumentar volumen/top set semanal para el músculo priorizado
-- - Desactivar por timeout (>6 semanas sin cerrar microciclo) o al completar 2-3
-- ============================================================

-- ============================================================
-- 1. COLUMNAS EN ESTADO (COMPATIBILIDAD)
-- ============================================================

ALTER TABLE app.hipertrofia_v2_state
ADD COLUMN IF NOT EXISTS priority_muscle VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS priority_microcycles_completed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_top_sets_this_week INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_last_week_reset TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS priority_microcycles_elapsed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_duration_microcycles INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS weekly_topset_used BOOLEAN DEFAULT false;

COMMENT ON COLUMN app.hipertrofia_v2_state.priority_muscle IS 'Grupo muscular con prioridad activa (opcional)';
COMMENT ON COLUMN app.hipertrofia_v2_state.priority_microcycles_completed IS 'Microciclos completados bajo prioridad activa';
COMMENT ON COLUMN app.hipertrofia_v2_state.priority_top_sets_this_week IS 'Número de top sets usados esta semana para la prioridad';

-- ============================================================
-- 2. FUNCIONES DE PRIORIDAD
-- ============================================================

CREATE OR REPLACE FUNCTION app.activate_muscle_priority(
  p_user_id INT,
  p_muscle_group VARCHAR(50)
) RETURNS JSONB AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT priority_muscle IS NOT NULL INTO v_exists
  FROM app.hipertrofia_v2_state WHERE user_id = p_user_id;

  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya hay una prioridad activa');
  END IF;

  UPDATE app.hipertrofia_v2_state
  SET
    priority_muscle = p_muscle_group,
    priority_started_at = NOW(),
    priority_microcycles_completed = 0,
    priority_top_sets_this_week = 0,
    priority_last_week_reset = NOW(),
    weekly_topset_used = false
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'priority_muscle', p_muscle_group);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app.deactivate_muscle_priority(
  p_user_id INT,
  p_reason VARCHAR(50) DEFAULT 'completed'
) RETURNS JSONB AS $$
BEGIN
  UPDATE app.hipertrofia_v2_state
  SET
    priority_muscle = NULL,
    priority_started_at = NULL,
    priority_microcycles_completed = 0,
    priority_top_sets_this_week = 0,
    weekly_topset_used = false
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'reason', p_reason);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app.check_priority_timeout(
  p_user_id INT
) RETURNS JSONB AS $$
DECLARE
  v_priority_age_weeks NUMERIC;
  v_microcycles_completed INT;
  v_has_priority BOOLEAN;
BEGIN
  SELECT
    priority_muscle IS NOT NULL,
    EXTRACT(EPOCH FROM (NOW() - priority_started_at)) / 604800,
    priority_microcycles_completed
  INTO v_has_priority, v_priority_age_weeks, v_microcycles_completed
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  IF NOT v_has_priority THEN
    RETURN jsonb_build_object('deactivated', false, 'reason', 'no_priority');
  END IF;

  IF v_priority_age_weeks > 6 AND v_microcycles_completed < 1 THEN
    PERFORM app.deactivate_muscle_priority(p_user_id, 'timeout');
    RETURN jsonb_build_object('deactivated', true, 'reason', 'timeout');
  END IF;

  IF v_microcycles_completed >= 2 THEN
    PERFORM app.deactivate_muscle_priority(p_user_id, 'completed');
    RETURN jsonb_build_object('deactivated', true, 'reason', 'completed');
  END IF;

  RETURN jsonb_build_object('deactivated', false);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. VERIFICACIONES
-- ============================================================

SELECT 'priority_columns' AS objeto,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='app' AND table_name='hipertrofia_v2_state'
      AND column_name='priority_muscle'
  ) THEN '✅ OK' ELSE '❌ FALTA' END AS estado;

SELECT 'activate_muscle_priority' AS funcion,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema='app' AND routine_name='activate_muscle_priority'
  ) THEN '✅ OK' ELSE '❌ FALTA' END AS estado;

SELECT 'deactivate_muscle_priority' AS funcion,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema='app' AND routine_name='deactivate_muscle_priority'
  ) THEN '✅ OK' ELSE '❌ FALTA' END AS estado;

SELECT 'check_priority_timeout' AS funcion,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema='app' AND routine_name='check_priority_timeout'
  ) THEN '✅ OK' ELSE '❌ FALTA' END AS estado;

-- ============================================================
-- FIN MÓDULO 4: PRIORIDAD MUSCULAR
-- ============================================================
