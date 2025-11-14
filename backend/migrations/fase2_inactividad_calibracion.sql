-- ============================================================
-- FASE 2 - MÓDULO 2: GESTIÓN DE INACTIVIDAD
-- ============================================================
-- Si pasan 14 días sin entrenamiento:
-- - Sistema activa calibración con cargas al 70%
-- - Desactiva cualquier prioridad activa
-- ============================================================

-- ============================================================
-- FUNCIÓN: VERIFICAR Y APLICAR CALIBRACIÓN POR INACTIVIDAD
-- ============================================================

CREATE OR REPLACE FUNCTION app.check_and_apply_inactivity_calibration(
  p_user_id INT
) RETURNS JSONB AS $$
DECLARE
  v_days_inactive NUMERIC;
  v_last_session_at TIMESTAMP;
  v_calibration_applied BOOLEAN := false;
BEGIN
  -- Obtener última sesión del usuario
  SELECT last_session_at
  INTO v_last_session_at
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  -- Si no hay estado, retornar
  IF v_last_session_at IS NULL THEN
    RETURN jsonb_build_object(
      'calibration_needed', false,
      'reason', 'no_previous_sessions'
    );
  END IF;

  -- Calcular días de inactividad
  v_days_inactive := EXTRACT(EPOCH FROM (NOW() - v_last_session_at)) / 86400;

  RAISE NOTICE '[INACTIVITY] Usuario %: % días inactivo', p_user_id, v_days_inactive;

  -- Si >14 días: aplicar calibración
  IF v_days_inactive > 14 THEN
    -- Reducir cargas al 70%
    UPDATE app.hypertrophy_progression
    SET target_weight_next_cycle = current_weight * 0.70
    WHERE user_id = p_user_id;

    -- Desactivar prioridad si existe (FASE 2 Módulo 4)
    UPDATE app.hipertrofia_v2_state
    SET
      priority_muscle = NULL,
      priority_started_at = NULL,
      priority_microcycles_completed = 0,
      priority_top_sets_this_week = 0
    WHERE user_id = p_user_id;

    v_calibration_applied := true;

    RAISE NOTICE '[INACTIVITY] Calibración aplicada: cargas reducidas a 70%%';
  END IF;

  RETURN jsonb_build_object(
    'calibration_needed', v_calibration_applied,
    'days_inactive', v_days_inactive,
    'calibration_pct', 0.70,
    'message', CASE
      WHEN v_calibration_applied THEN
        'Inactividad detectada: cargas calibradas a 70%'
      ELSE
        'Sin inactividad prolongada'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MODIFICAR advance_cycle_day PARA INTEGRAR INACTIVIDAD
-- ============================================================

CREATE OR REPLACE FUNCTION app.advance_cycle_day(
  p_user_id INT,
  p_session_day_name VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_state RECORD;
  v_new_cycle_day INT;
  v_microcycle_completed BOOLEAN := false;
  v_progression_result JSONB;
  v_fatigue_check JSONB;
  v_inactivity_check JSONB;
BEGIN
  -- ===================================
  -- 🎯 NUEVO: VERIFICAR INACTIVIDAD ANTES DE AVANZAR
  -- ===================================
  v_inactivity_check := app.check_and_apply_inactivity_calibration(p_user_id);

  IF (v_inactivity_check->>'calibration_needed')::BOOLEAN THEN
    RAISE NOTICE '[MINDFEED] Calibración por inactividad aplicada: % días',
      v_inactivity_check->>'days_inactive';
  END IF;

  -- Obtener estado actual
  SELECT * INTO v_state
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No state found for user');
  END IF;

  -- Extraer número del día (D1 -> 1, D2 -> 2, etc.)
  v_new_cycle_day := SUBSTRING(p_session_day_name FROM 2)::INT;

  -- Si completó D5, reiniciar a D1 e incrementar microcycles_completed
  IF v_new_cycle_day = 5 THEN
    v_new_cycle_day := 1;
    v_microcycle_completed := true;

    -- ===================================
    -- EVALUAR FATIGA ANTES DE PROGRESAR (FASE 2 Módulo 1)
    -- ===================================
    v_fatigue_check := app.evaluate_fatigue_action(p_user_id);

    -- Si progresión NO está bloqueada y mean_RIR >= 3: aplicar progresión
    IF NOT (v_fatigue_check->>'progression_blocked')::BOOLEAN
       AND NOT v_state.deload_active THEN

      -- Aplicar progresión automática +2.5%
      v_progression_result := app.apply_microcycle_progression(
        p_user_id,
        v_state.methodology_plan_id
      );

      RAISE NOTICE '[MINDFEED] Progresión aplicada: %', v_progression_result;
    ELSE
      -- Progresión bloqueada por fatiga o deload
      v_progression_result := jsonb_build_object(
        'progression_applied', false,
        'reason', CASE
          WHEN (v_fatigue_check->>'progression_blocked')::BOOLEAN THEN 'fatigue_flags'
          WHEN v_state.deload_active THEN 'deload_active'
        END
      );

      RAISE NOTICE '[MINDFEED] Progresión bloqueada: %', v_progression_result;
    END IF;

    -- Incrementar contador de microciclos
    UPDATE app.hipertrofia_v2_state
    SET
      cycle_day = v_new_cycle_day,
      microcycles_completed = microcycles_completed + 1,
      last_session_at = NOW()
    WHERE user_id = p_user_id;

  ELSE
    -- Avanzar al siguiente día (D1->D2, D2->D3, etc.)
    v_new_cycle_day := v_new_cycle_day + 1;

    UPDATE app.hipertrofia_v2_state
    SET
      cycle_day = v_new_cycle_day,
      last_session_at = NOW()
    WHERE user_id = p_user_id;

    v_fatigue_check := NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cycle_day', v_new_cycle_day,
    'microcycles_completed', CASE
      WHEN v_microcycle_completed THEN v_state.microcycles_completed + 1
      ELSE v_state.microcycles_completed
    END,
    'microcycle_completed', v_microcycle_completed,
    'message', CASE
      WHEN v_microcycle_completed THEN '¡Microciclo completado!'
      ELSE 'Avanzaste a D' || v_new_cycle_day
    END,
    'progression', v_progression_result,
    'fatigue_check', v_fatigue_check,
    'inactivity_check', v_inactivity_check
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

SELECT
  'Función check_and_apply_inactivity_calibration' as objeto,
  '✅ Creada' as estado
FROM information_schema.routines
WHERE routine_schema = 'app'
  AND routine_name = 'check_and_apply_inactivity_calibration';

SELECT
  'Función advance_cycle_day (modificada)' as objeto,
  '✅ Actualizada' as estado
FROM information_schema.routines
WHERE routine_schema = 'app'
  AND routine_name = 'advance_cycle_day';

-- ============================================================
-- FIN DE MIGRACIÓN - MÓDULO 2: GESTIÓN DE INACTIVIDAD
-- ============================================================
-- Próximos pasos:
-- 1. Ejecutar este script en Supabase (DESPUÉS del Módulo 1)
-- 2. El sistema ahora detecta automáticamente inactividad >14 días
-- 3. Aplica calibración 70% sin intervención manual
-- ============================================================
