-- ============================================================
-- FASE 2 - MÓDULO 1: FLAGS DE FATIGA
-- ============================================================
-- Sistema de detección y gestión de fatiga con 3 niveles:
-- - Leve (fatigue_light): Mantener carga, no progresar
-- - Crítico (fatigue_high): Reducir ~10%, deload parcial/completo
-- - Cognitivo (focus_low): Reducir series analíticas
-- ============================================================

-- ============================================================
-- 1. TABLA DE FLAGS DE FATIGA
-- ============================================================

CREATE TABLE IF NOT EXISTS app.fatigue_flags (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  methodology_plan_id INT REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
  session_id INT REFERENCES app.methodology_exercise_sessions(id) ON DELETE SET NULL,

  -- Timestamp del flag
  flag_date TIMESTAMP DEFAULT NOW(),

  -- Tipo de flag
  flag_type VARCHAR(20) NOT NULL CHECK (flag_type IN ('light', 'critical', 'cognitive')),

  -- ===================================
  -- FUENTES SUBJETIVAS (usuario reporta manualmente)
  -- ===================================
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 10),
  energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
  doms_level INT CHECK (doms_level BETWEEN 0 AND 10),
  joint_pain_level INT CHECK (joint_pain_level BETWEEN 0 AND 10),
  focus_level INT CHECK (focus_level BETWEEN 1 AND 10),
  motivation_level INT CHECK (motivation_level BETWEEN 1 AND 10),

  -- ===================================
  -- FUENTES OBJETIVAS (calculadas automáticamente desde RIR y performance)
  -- ===================================
  performance_drop_pct NUMERIC(5,2), -- % caída rendimiento vs última sesión similar
  underperformed_sets INT DEFAULT 0, -- Número de series con RIR <2 no planificadas
  mean_rir_session NUMERIC(3,1), -- RIR medio de la sesión

  -- ===================================
  -- METADATA
  -- ===================================
  notes TEXT,
  auto_detected BOOLEAN DEFAULT false, -- Si fue detectado automáticamente o reportado por usuario
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para queries rápidos
CREATE INDEX IF NOT EXISTS idx_fatigue_flags_user_date ON app.fatigue_flags(user_id, flag_date DESC);
CREATE INDEX IF NOT EXISTS idx_fatigue_flags_session ON app.fatigue_flags(session_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_flags_type ON app.fatigue_flags(user_id, flag_type, flag_date DESC);

-- ============================================================
-- 2. FUNCIÓN: DETECTAR FLAGS AUTOMÁTICAMENTE DESDE RIR
-- ============================================================

CREATE OR REPLACE FUNCTION app.detect_automatic_fatigue_flags(
  p_user_id INT,
  p_session_id INT
) RETURNS JSONB AS $$
DECLARE
  v_mean_rir NUMERIC;
  v_underperformed_sets INT;
  v_performance_drop NUMERIC;
  v_flag_type VARCHAR(20);
  v_flag_inserted BOOLEAN := false;
BEGIN
  -- Calcular mean_RIR de la sesión actual
  SELECT
    AVG(rir_reported)::NUMERIC(3,1),
    COUNT(*) FILTER (WHERE rir_reported < 2)
  INTO v_mean_rir, v_underperformed_sets
  FROM app.hypertrophy_set_logs
  WHERE session_id = p_session_id;

  -- Si no hay datos de RIR, salir
  IF v_mean_rir IS NULL THEN
    RETURN jsonb_build_object(
      'flag_detected', false,
      'reason', 'no_rir_data'
    );
  END IF;

  -- Calcular caída de rendimiento (comparar con media de últimas 3 sesiones similares)
  -- TODO: implementar comparación con sesiones similares
  v_performance_drop := 0;

  -- ===================================
  -- DECIDIR TIPO DE FLAG
  -- ===================================

  -- CRÍTICO: ≥3 series con RIR <2 O mean_RIR <1.5
  IF v_underperformed_sets >= 3 OR v_mean_rir < 1.5 THEN
    v_flag_type := 'critical';
    v_flag_inserted := true;

  -- LEVE: ≥2 series con RIR <2 O mean_RIR <2.5
  ELSIF v_underperformed_sets >= 2 OR v_mean_rir < 2.5 THEN
    v_flag_type := 'light';
    v_flag_inserted := true;

  -- SIN FLAG: Todo OK
  ELSE
    v_flag_type := NULL;
  END IF;

  -- ===================================
  -- INSERTAR FLAG SI CORRESPONDE
  -- ===================================
  IF v_flag_type IS NOT NULL THEN
    INSERT INTO app.fatigue_flags (
      user_id,
      session_id,
      flag_type,
      mean_rir_session,
      underperformed_sets,
      performance_drop_pct,
      auto_detected
    ) VALUES (
      p_user_id,
      p_session_id,
      v_flag_type,
      v_mean_rir,
      v_underperformed_sets,
      v_performance_drop,
      true
    );

    -- Log para debugging
    RAISE NOTICE '[FATIGUE] Flag detectado automáticamente: tipo=%, mean_RIR=%, underperformed=%',
      v_flag_type, v_mean_rir, v_underperformed_sets;
  END IF;

  RETURN jsonb_build_object(
    'flag_detected', v_flag_inserted,
    'flag_type', v_flag_type,
    'mean_rir', v_mean_rir,
    'underperformed_sets', v_underperformed_sets,
    'performance_drop_pct', v_performance_drop
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. FUNCIÓN: CONTAR FLAGS RECIENTES (VENTANA TEMPORAL)
-- ============================================================

CREATE OR REPLACE FUNCTION app.count_recent_flags(
  p_user_id INT,
  p_days_window INT DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
  v_light_count INT;
  v_critical_count INT;
  v_cognitive_count INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE flag_type = 'light'),
    COUNT(*) FILTER (WHERE flag_type = 'critical'),
    COUNT(*) FILTER (WHERE flag_type = 'cognitive')
  INTO v_light_count, v_critical_count, v_cognitive_count
  FROM app.fatigue_flags
  WHERE user_id = p_user_id
    AND flag_date >= NOW() - (p_days_window || ' days')::INTERVAL;

  RETURN jsonb_build_object(
    'light', v_light_count,
    'critical', v_critical_count,
    'cognitive', v_cognitive_count,
    'window_days', p_days_window,
    'total', v_light_count + v_critical_count + v_cognitive_count
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. FUNCIÓN: EVALUAR ACCIÓN RECOMENDADA SEGÚN FLAGS
-- ============================================================

CREATE OR REPLACE FUNCTION app.evaluate_fatigue_action(
  p_user_id INT
) RETURNS JSONB AS $$
DECLARE
  v_flags JSONB;
  v_action VARCHAR(50);
  v_load_adjustment NUMERIC;
  v_volume_adjustment NUMERIC;
  v_progression_blocked BOOLEAN;
BEGIN
  -- Contar flags recientes (últimos 10 días)
  v_flags := app.count_recent_flags(p_user_id, 10);

  -- ===================================
  -- DECIDIR ACCIÓN SEGÚN REGLAS
  -- ===================================

  -- CASO 1: ≥2 críticos → Deload inmediato (~30% carga, ~50% volumen)
  IF (v_flags->>'critical')::INT >= 2 THEN
    v_action := 'immediate_deload';
    v_load_adjustment := -0.30;
    v_volume_adjustment := -0.50;
    v_progression_blocked := true;

  -- CASO 2: ≥1 crítico O ≥2 leves → Microciclo con recuperación (0% progresión, ~6% reducción)
  ELSIF (v_flags->>'critical')::INT >= 1 OR (v_flags->>'light')::INT >= 2 THEN
    v_action := 'recovery_microcycle';
    v_load_adjustment := -0.06;
    v_volume_adjustment := 0;
    v_progression_blocked := true;

  -- CASO 3: 1 leve → Mantener carga, NO aplicar +2.5%
  ELSIF (v_flags->>'light')::INT >= 1 THEN
    v_action := 'freeze_progression';
    v_load_adjustment := 0;
    v_volume_adjustment := 0;
    v_progression_blocked := true;

  -- CASO 4: Sin flags → Continuar normal
  ELSE
    v_action := 'continue_normal';
    v_load_adjustment := 0;
    v_volume_adjustment := 0;
    v_progression_blocked := false;
  END IF;

  RETURN jsonb_build_object(
    'action', v_action,
    'load_adjustment', v_load_adjustment,
    'volume_adjustment', v_volume_adjustment,
    'progression_blocked', v_progression_blocked,
    'flags', v_flags,
    'message', CASE v_action
      WHEN 'immediate_deload' THEN 'Deload inmediato requerido: reducción -30% carga, -50% volumen'
      WHEN 'recovery_microcycle' THEN 'Microciclo de recuperación: reducción -6% carga, progresión congelada'
      WHEN 'freeze_progression' THEN 'Mantener cargas actuales, no aplicar progresión'
      WHEN 'continue_normal' THEN 'Sin fatiga detectada, continuar normal'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. FUNCIÓN: APLICAR AJUSTES DE FATIGA A CARGAS
-- ============================================================

CREATE OR REPLACE FUNCTION app.apply_fatigue_adjustments(
  p_user_id INT,
  p_methodology_plan_id INT
) RETURNS JSONB AS $$
DECLARE
  v_fatigue_eval JSONB;
  v_load_adjustment NUMERIC;
  v_rows_updated INT;
BEGIN
  -- Evaluar acción recomendada
  v_fatigue_eval := app.evaluate_fatigue_action(p_user_id);
  v_load_adjustment := (v_fatigue_eval->>'load_adjustment')::NUMERIC;

  -- Si hay ajuste de carga, aplicarlo
  IF v_load_adjustment != 0 THEN
    UPDATE app.hypertrophy_progression
    SET target_weight_next_cycle = target_weight_next_cycle * (1 + v_load_adjustment)
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    RAISE NOTICE '[FATIGUE] Ajuste aplicado: % carga, % ejercicios actualizados',
      v_load_adjustment * 100, v_rows_updated;
  ELSE
    v_rows_updated := 0;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fatigue_evaluation', v_fatigue_eval,
    'adjustments_applied', v_load_adjustment != 0,
    'exercises_updated', v_rows_updated
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. MODIFICAR advance_cycle_day PARA INTEGRAR FATIGA
-- ============================================================

-- Esta función ya existe, la vamos a REEMPLAZAR con una versión mejorada
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
BEGIN
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
    -- 🎯 NUEVO: EVALUAR FATIGA ANTES DE PROGRESAR
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
    'fatigue_check', v_fatigue_check
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. VISTA: RESUMEN DE FATIGA POR USUARIO
-- ============================================================

CREATE OR REPLACE VIEW app.user_fatigue_summary AS
SELECT
  u.id as user_id,
  u.email,

  -- Flags últimos 7 días
  COUNT(*) FILTER (
    WHERE ff.flag_date >= NOW() - INTERVAL '7 days'
  ) as flags_last_7_days,

  COUNT(*) FILTER (
    WHERE ff.flag_type = 'light'
    AND ff.flag_date >= NOW() - INTERVAL '7 days'
  ) as light_flags_7d,

  COUNT(*) FILTER (
    WHERE ff.flag_type = 'critical'
    AND ff.flag_date >= NOW() - INTERVAL '7 days'
  ) as critical_flags_7d,

  -- Último flag
  MAX(ff.flag_date) as last_flag_date,
  (
    SELECT flag_type
    FROM app.fatigue_flags
    WHERE user_id = u.id
    ORDER BY flag_date DESC
    LIMIT 1
  ) as last_flag_type,

  -- RIR medio reciente
  (
    SELECT AVG(hv.rir_reported)::NUMERIC(3,1)
    FROM app.hypertrophy_set_logs hv
    JOIN app.methodology_exercise_sessions mes ON hv.session_id = mes.id
    WHERE mes.user_id = u.id
      AND mes.session_date >= NOW() - INTERVAL '14 days'
  ) as mean_rir_14d

FROM app.users u
LEFT JOIN app.fatigue_flags ff ON u.id = ff.user_id
GROUP BY u.id, u.email;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

-- Verificar que la tabla se creó
SELECT
  'Tabla fatigue_flags' as objeto,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app' AND table_name = 'fatigue_flags'
  ) THEN '✅ Creada' ELSE '❌ Error' END as estado;

-- Verificar funciones
SELECT
  'Función ' || routine_name as objeto,
  '✅ Creada' as estado
FROM information_schema.routines
WHERE routine_schema = 'app'
  AND routine_name IN (
    'detect_automatic_fatigue_flags',
    'count_recent_flags',
    'evaluate_fatigue_action',
    'apply_fatigue_adjustments'
  )
ORDER BY routine_name;

-- ============================================================
-- FIN DE MIGRACIÓN - MÓDULO 1: FLAGS DE FATIGA
-- ============================================================
-- Próximos pasos:
-- 1. Ejecutar este script en Supabase
-- 2. Implementar endpoints en backend
-- 3. Crear FatigueReportModal en frontend
-- ============================================================
