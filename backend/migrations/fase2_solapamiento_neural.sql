-- ============================================================
-- FASE 2 - MÓDULO 3: SOLAPAMIENTO NEURAL
-- ============================================================
-- Objetivo:
-- - Detectar solapamientos neurales entre sesiones consecutivas
-- - Ajustar cargas (-2.5% / -5%) cuando se repiten patrones sinergistas
-- - Persistir últimos patrones trabajados en hipertrofia_v2_state
-- ============================================================

-- ============================================================
-- 1. COLUMNAS NUEVAS EN ESTADO DE HIPERTROFIA V2
-- ============================================================

ALTER TABLE app.hipertrofia_v2_state
ADD COLUMN IF NOT EXISTS last_session_patterns JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS neural_overlap_detected VARCHAR(20)
  CHECK (neural_overlap_detected IN ('none', 'partial', 'high'));

COMMENT ON COLUMN app.hipertrofia_v2_state.last_session_patterns IS
  'Listado de patrones de movimiento (JSON array) trabajados en la última sesión completada';

COMMENT ON COLUMN app.hipertrofia_v2_state.neural_overlap_detected IS
  'Último resultado de detección de solapamiento neural (none | partial | high)';

-- ============================================================
-- 2. FUNCIÓN: DETECTAR SOLAPAMIENTO NEURAL
-- ============================================================

CREATE OR REPLACE FUNCTION app.detect_neural_overlap(
  p_user_id INT,
  p_current_session_patterns JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_state RECORD;
  v_last_patterns JSONB := '[]'::jsonb;
  v_current_patterns JSONB := COALESCE(p_current_session_patterns, '[]'::jsonb);
  v_overlap_level VARCHAR(20) := 'none';
  v_adjustment NUMERIC := 0;
  v_hours_since_last NUMERIC := NULL;
  v_last_pattern_arr TEXT[] := ARRAY[]::TEXT[];
  v_current_pattern_arr TEXT[] := ARRAY[]::TEXT[];
  v_last_pattern TEXT;
  v_curr_pattern TEXT;
BEGIN
  SELECT
    last_session_patterns,
    last_session_at,
    neural_overlap_detected
  INTO v_state
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  IF NOT FOUND OR v_state.last_session_patterns IS NULL THEN
    RETURN jsonb_build_object(
      'overlap', 'none',
      'adjustment', 0,
      'message', 'Sin sesiones previas registradas'
    );
  END IF;

  v_last_patterns := COALESCE(v_state.last_session_patterns, '[]'::jsonb);
  v_hours_since_last := EXTRACT(EPOCH FROM (NOW() - v_state.last_session_at)) / 3600;

  IF v_hours_since_last IS NULL THEN
    v_hours_since_last := 999;
  END IF;

  -- Si pasaron más de 72h no se considera solapamiento
  IF v_hours_since_last > 72 THEN
    UPDATE app.hipertrofia_v2_state
    SET neural_overlap_detected = 'none'
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'overlap', 'none',
      'adjustment', 0,
      'hours_since_last', v_hours_since_last,
      'message', 'Más de 72h desde la última sesión: sin solapamiento'
    );
  END IF;

  -- Convertir JSON arrays a arreglos de texto normalizados
  SELECT ARRAY(
    SELECT LOWER(TRIM(value::text))
    FROM jsonb_array_elements_text(v_last_patterns) AS value
    WHERE TRIM(value::text) <> ''
  ) INTO v_last_pattern_arr;

  SELECT ARRAY(
    SELECT LOWER(TRIM(value::text))
    FROM jsonb_array_elements_text(v_current_patterns) AS value
    WHERE TRIM(value::text) <> ''
  ) INTO v_current_pattern_arr;

  IF array_length(v_last_pattern_arr, 1) IS NULL
     OR array_length(v_current_pattern_arr, 1) IS NULL THEN
    UPDATE app.hipertrofia_v2_state
    SET neural_overlap_detected = 'none'
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'overlap', 'none',
      'adjustment', 0,
      'hours_since_last', v_hours_since_last,
      'message', 'No hay patrones suficientes para comparar'
    );
  END IF;

  -- Detección de solapamiento alto: patrones idénticos en ambas sesiones
  FOREACH v_curr_pattern IN ARRAY v_current_pattern_arr LOOP
    IF v_curr_pattern = ANY (v_last_pattern_arr) THEN
      v_overlap_level := 'high';
      EXIT;
    END IF;
  END LOOP;

  -- Detección de solapamiento parcial si no se detectó uno alto
  IF v_overlap_level <> 'high' THEN
    FOREACH v_last_pattern IN ARRAY v_last_pattern_arr LOOP
      FOREACH v_curr_pattern IN ARRAY v_current_pattern_arr LOOP
        IF (v_last_pattern = 'empuje_vertical' AND v_curr_pattern = 'empuje_horizontal')
           OR (v_last_pattern = 'empuje_horizontal' AND v_curr_pattern = 'empuje_vertical')
           OR (v_last_pattern = 'traccion_vertical' AND v_curr_pattern = 'traccion_horizontal')
           OR (v_last_pattern = 'traccion_horizontal' AND v_curr_pattern = 'traccion_vertical')
           OR (v_last_pattern = 'cadena_posterior' AND v_curr_pattern = 'bisagra_cadera')
           OR (v_last_pattern = 'bisagra_cadera' AND v_curr_pattern = 'cadena_posterior') THEN
          v_overlap_level := 'partial';
          EXIT;
        END IF;
      END LOOP;
      EXIT WHEN v_overlap_level = 'partial';
    END LOOP;
  END IF;

  -- Ajustes sugeridos
  IF v_overlap_level = 'high' THEN
    v_adjustment := -0.05;
  ELSIF v_overlap_level = 'partial' THEN
    v_adjustment := -0.025;
  END IF;

  UPDATE app.hipertrofia_v2_state
  SET neural_overlap_detected = v_overlap_level
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'overlap', v_overlap_level,
    'adjustment', v_adjustment,
    'hours_since_last', v_hours_since_last,
    'message', CASE v_overlap_level
      WHEN 'high' THEN 'Solapamiento alto: reducir cargas ~5%'
      WHEN 'partial' THEN 'Solapamiento parcial: reducir cargas ~2.5%'
      ELSE 'Sin solapamiento significativo'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. MODIFICAR advance_cycle_day PARA GUARDAR PATRONES
-- ============================================================

CREATE OR REPLACE FUNCTION app.advance_cycle_day(
  p_user_id INT,
  p_session_day_name VARCHAR,
  p_session_patterns JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_state RECORD;
  v_new_cycle_day INT;
  v_microcycle_completed BOOLEAN := false;
  v_progression_result JSONB;
  v_fatigue_check JSONB;
  v_inactivity_check JSONB;
  v_session_patterns JSONB := COALESCE(p_session_patterns, '[]'::jsonb);
BEGIN
  -- Verificar inactividad >14 días (FASE 2 Módulo 2)
  v_inactivity_check := app.check_and_apply_inactivity_calibration(p_user_id);

  IF (v_inactivity_check->>'calibration_needed')::BOOLEAN THEN
    RAISE NOTICE '[MINDFEED] Calibración por inactividad aplicada: % días',
      v_inactivity_check->>'days_inactive';
  END IF;

  -- Obtener estado actual del usuario
  SELECT * INTO v_state
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No state found for user');
  END IF;

  -- Extraer número del día desde el identificador (D1 -> 1, etc.)
  v_new_cycle_day := SUBSTRING(p_session_day_name FROM 2)::INT;

  -- Si completó D5, reiniciar microciclo y evaluar fatiga (FASE 2 Módulo 1)
  IF v_new_cycle_day = 5 THEN
    v_new_cycle_day := 1;
    v_microcycle_completed := true;

    v_fatigue_check := app.evaluate_fatigue_action(p_user_id);

    IF NOT (v_fatigue_check->>'progression_blocked')::BOOLEAN
       AND NOT v_state.deload_active THEN
      v_progression_result := app.apply_microcycle_progression(
        p_user_id,
        v_state.methodology_plan_id
      );

      RAISE NOTICE '[MINDFEED] Progresión aplicada: %', v_progression_result;
    ELSE
      v_progression_result := jsonb_build_object(
        'progression_applied', false,
        'reason', CASE
          WHEN (v_fatigue_check->>'progression_blocked')::BOOLEAN THEN 'fatigue_flags'
          WHEN v_state.deload_active THEN 'deload_active'
        END
      );

      RAISE NOTICE '[MINDFEED] Progresión bloqueada: %', v_progression_result;
    END IF;

    UPDATE app.hipertrofia_v2_state
    SET
      cycle_day = v_new_cycle_day,
      microcycles_completed = microcycles_completed + 1,
      last_session_at = NOW(),
      last_session_patterns = v_session_patterns
    WHERE user_id = p_user_id;

  ELSE
    -- Avanzar al siguiente día dentro del mismo microciclo
    v_new_cycle_day := v_new_cycle_day + 1;

    UPDATE app.hipertrofia_v2_state
    SET
      cycle_day = v_new_cycle_day,
      last_session_at = NOW(),
      last_session_patterns = v_session_patterns
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
    'inactivity_check', v_inactivity_check,
    'session_patterns_saved', v_session_patterns
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. VERIFICACIONES
-- ============================================================

SELECT
  'Columnas last_session_patterns / neural_overlap_detected' AS objeto,
  '✅ Actualizadas' AS estado
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'hipertrofia_v2_state'
LIMIT 1;

SELECT
  'Función detect_neural_overlap' AS objeto,
  CASE WHEN EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'app'
      AND routine_name = 'detect_neural_overlap'
  ) THEN '✅ Creada' ELSE '❌ Error' END AS estado;

SELECT
  'Función advance_cycle_day (solapamiento)' AS objeto,
  CASE WHEN EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'app'
      AND routine_name = 'advance_cycle_day'
  ) THEN '✅ Actualizada' ELSE '❌ Error' END AS estado;

-- ============================================================
-- FIN DEL MÓDULO 3: SOLAPAMIENTO NEURAL
-- ============================================================
