-- ============================================================
-- HIPERTROFIA V2 - FASE 1: MOTOR MINDFEED (PRINCIPIANTES)
-- ============================================================
-- Fecha: 11 de Enero 2025
-- Sistema MindFeed v1.0 para HipertrofiaV2
-- Ciclo D1-D5, progresión por microciclo, deload automático
-- VERSIÓN CORREGIDA: Fix línea 583 (JSONB extraction)
-- ============================================================

-- ============================================================
-- 1. MOTOR DE CICLO - Estado del usuario en el ciclo D1-D5
-- ============================================================

CREATE TABLE IF NOT EXISTS app.hipertrofia_v2_state (
  user_id INT PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  methodology_plan_id INT REFERENCES app.methodology_plans(id) ON DELETE SET NULL,

  -- Estado del ciclo
  cycle_day INT NOT NULL DEFAULT 1 CHECK (cycle_day BETWEEN 1 AND 5),
  microcycles_completed INT NOT NULL DEFAULT 0,
  current_week_number INT NOT NULL DEFAULT 1,

  -- Tracking temporal
  last_session_at TIMESTAMP,
  last_session_day_name VARCHAR(20),  -- 'D1', 'D2', 'D3', 'D4', 'D5'

  -- Priorización muscular (FASE 2, pero estructura preparada)
  priority_muscle VARCHAR(50),
  priority_microcycles_elapsed INT DEFAULT 0,
  priority_duration_microcycles INT DEFAULT 3,
  weekly_topset_used BOOLEAN DEFAULT false,

  -- Flags de fatiga (FASE 2, pero estructura preparada)
  fatigue_flags_leves INT DEFAULT 0,
  fatigue_flags_criticos INT DEFAULT 0,
  fatigue_window_start DATE,

  -- Control de deload
  deload_active BOOLEAN DEFAULT false,
  deload_reason VARCHAR(50),  -- 'planificado', 'reactivo', 'manual'
  deload_started_at TIMESTAMP,

  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hipertrofia_v2_state_plan
  ON app.hipertrofia_v2_state(methodology_plan_id);

CREATE INDEX IF NOT EXISTS idx_hipertrofia_v2_state_last_session
  ON app.hipertrofia_v2_state(user_id, last_session_at);

COMMENT ON TABLE app.hipertrofia_v2_state IS
  'Estado del motor de ciclo MindFeed: tracking D1-D5, microciclos, deload, prioridad';

COMMENT ON COLUMN app.hipertrofia_v2_state.cycle_day IS
  'Día actual del ciclo (1=D1, 2=D2, 3=D3, 4=D4, 5=D5). Avanza SOLO cuando usuario completa sesión';

COMMENT ON COLUMN app.hipertrofia_v2_state.microcycles_completed IS
  'Número de ciclos D1-D5 completados. Progresión +2.5% se aplica al completar cada microciclo';

-- ============================================================
-- 2. CONFIGURACIÓN DE SESIONES D1-D5
-- ============================================================

CREATE TABLE IF NOT EXISTS app.hipertrofia_v2_session_config (
  id SERIAL PRIMARY KEY,
  cycle_day INT NOT NULL CHECK (cycle_day BETWEEN 1 AND 5),
  session_name VARCHAR(100) NOT NULL,

  -- Configuración de la sesión
  muscle_groups JSONB NOT NULL,  -- ['Pecho', 'Triceps'] para D1
  intensity_percentage INT NOT NULL,  -- 80 para D1-D3, 70-75 para D4-D5
  is_heavy_day BOOLEAN DEFAULT true,  -- true para D1-D3, false para D4-D5
  session_order INT NOT NULL,  -- 1, 2, 3, 4, 5

  -- Distribución de ejercicios
  multiarticular_count INT DEFAULT 2,
  unilateral_count INT DEFAULT 2,
  analitico_count INT DEFAULT 1,

  -- Parámetros por defecto
  default_sets INT DEFAULT 3,
  default_reps_range VARCHAR(10) DEFAULT '8-12',
  default_rir_target VARCHAR(5) DEFAULT '2-3',

  -- Notas para el usuario
  description TEXT,
  coach_tip TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar configuración estándar D1-D5 para Principiantes
INSERT INTO app.hipertrofia_v2_session_config (
  cycle_day, session_name, muscle_groups, intensity_percentage,
  is_heavy_day, session_order, multiarticular_count, unilateral_count,
  analitico_count, description, coach_tip
) VALUES
(
  1,
  'D1: Pecho + Tríceps (Empuje Principal)',
  '["Pecho", "Tríceps"]',
  80,
  true,
  1,
  2,  -- 2 multiarticulares (press banca, press inclinado)
  1,  -- 1 unilateral (press mancuerna)
  1,  -- 1 analítico (extensión tríceps)
  'Día de empuje principal. Enfoque en pecho con tríceps como sinergista.',
  'Prioriza la técnica en los press. El tríceps trabaja indirectamente, no lo sobrecargues.'
),
(
  2,
  'D2: Espalda + Bíceps (Tirón Principal)',
  '["Espalda", "Bíceps"]',
  80,
  true,
  2,
  2,  -- 2 multiarticulares (dominadas, remo)
  1,  -- 1 unilateral (remo mancuerna)
  1,  -- 1 analítico (curl bíceps)
  'Día de tirón principal. Trabaja espalda completa con bíceps como sinergista.',
  'Activa bien los dorsales antes de tirar. El bíceps no debe ser el limitante.'
),
(
  3,
  'D3: Piernas Completas (Tren Inferior)',
  '["Cuádriceps", "Femoral", "Glúteos"]',
  80,
  true,
  3,
  2,  -- 2 multiarticulares (sentadilla, prensa)
  2,  -- 2 unilaterales (zancadas, curl femoral)
  1,  -- 1 analítico (extensión cuádriceps o gemelos)
  'Día de pierna completa. Equilibrio entre cuádriceps, femorales y glúteos.',
  'Es el día más demandante. Descansa bien entre series multiarticulares (2-3 min).'
),
(
  4,
  'D4: Pecho + Tríceps (Frecuencia 2 - Ligero)',
  '["Pecho", "Tríceps"]',
  73,  -- 70-75%
  false,
  4,
  1,  -- 1 multiarticular ligero
  1,  -- 1 unilateral
  1,  -- 1 analítico
  'Segunda frecuencia de empuje. Intensidad reducida para acumular volumen sin fatiga.',
  'Este día NO busques máximos. Trabaja con RIR 3-4, fluidez técnica.'
),
(
  5,
  'D5: Espalda + Bíceps + Hombros + Core (Frecuencia 2 + Accesorios)',
  '["Espalda", "Bíceps", "Hombro", "Core"]',
  73,  -- 70-75%
  false,
  5,
  1,  -- 1 multiarticular de espalda ligero
  2,  -- 2 unilaterales (espalda + hombro)
  2,  -- 2 analíticos (bíceps + core)
  'Segunda frecuencia de tirón + complementarios. Terminas el microciclo con accesorios.',
  'Día de "pulir". Trabaja hombros y core con control. RIR 3-4 en todo.'
)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_session_config_cycle_day
  ON app.hipertrofia_v2_session_config(cycle_day);

COMMENT ON TABLE app.hipertrofia_v2_session_config IS
  'Configuración de las 5 sesiones del ciclo MindFeed (D1-D5) para principiantes';

-- ============================================================
-- 3. MODIFICACIÓN DE TABLA DE EJERCICIOS
-- ============================================================

-- Añadir columnas para clasificación MindFeed
ALTER TABLE app."Ejercicios_Hipertrofia"
ADD COLUMN IF NOT EXISTS tipo_ejercicio VARCHAR(20)
  CHECK (tipo_ejercicio IN ('multiarticular', 'unilateral', 'analitico'));

ALTER TABLE app."Ejercicios_Hipertrofia"
ADD COLUMN IF NOT EXISTS patron_movimiento VARCHAR(50);

ALTER TABLE app."Ejercicios_Hipertrofia"
ADD COLUMN IF NOT EXISTS orden_recomendado INT DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_ejercicios_tipo
  ON app."Ejercicios_Hipertrofia"(tipo_ejercicio);

CREATE INDEX IF NOT EXISTS idx_ejercicios_patron
  ON app."Ejercicios_Hipertrofia"(patron_movimiento);

COMMENT ON COLUMN app."Ejercicios_Hipertrofia".tipo_ejercicio IS
  'Clasificación MindFeed: multiarticular (compuesto), unilateral (asimétrico), analitico (aislamiento)';

COMMENT ON COLUMN app."Ejercicios_Hipertrofia".patron_movimiento IS
  'Patrón de movimiento para detectar solapamiento neural entre sesiones';

COMMENT ON COLUMN app."Ejercicios_Hipertrofia".orden_recomendado IS
  'Orden recomendado en sesión: 1=primero (multiarticular), 2=medio (unilateral), 3=final (analítico)';

-- ============================================================
-- 4. MODIFICACIÓN DE TABLA DE PROGRESIÓN
-- ============================================================

-- Añadir campos específicos para progresión por microciclo
ALTER TABLE app.hypertrophy_progression
ADD COLUMN IF NOT EXISTS target_weight_next_cycle DECIMAL(5,2);

ALTER TABLE app.hypertrophy_progression
ADD COLUMN IF NOT EXISTS last_microcycle_completed INT DEFAULT 0;

ALTER TABLE app.hypertrophy_progression
ADD COLUMN IF NOT EXISTS progression_locked BOOLEAN DEFAULT false;

COMMENT ON COLUMN app.hypertrophy_progression.target_weight_next_cycle IS
  'Peso objetivo para el próximo microciclo (calculado al completar D1-D5)';

COMMENT ON COLUMN app.hypertrophy_progression.last_microcycle_completed IS
  'Último microciclo donde se actualizó la progresión';

COMMENT ON COLUMN app.hypertrophy_progression.progression_locked IS
  'true durante deload o cuando prioridad está activa en músculo NO prioritario';

-- ============================================================
-- 5. FUNCIONES: MOTOR DE CICLO
-- ============================================================

-- Función: Avanzar día del ciclo (SOLO si usuario completa sesión)
CREATE OR REPLACE FUNCTION app.advance_cycle_day(
  p_user_id INT,
  p_session_day_name VARCHAR  -- 'D1', 'D2', etc.
) RETURNS JSONB AS $$
DECLARE
  v_current_cycle_day INT;
  v_new_cycle_day INT;
  v_microcycles_completed INT;
  v_result JSONB;
BEGIN
  -- Obtener estado actual
  SELECT cycle_day, microcycles_completed
  INTO v_current_cycle_day, v_microcycles_completed
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  -- Si no existe estado, crear uno nuevo
  IF NOT FOUND THEN
    INSERT INTO app.hipertrofia_v2_state (user_id, cycle_day, last_session_at, last_session_day_name)
    VALUES (p_user_id, 1, NOW(), p_session_day_name)
    RETURNING cycle_day, microcycles_completed INTO v_current_cycle_day, v_microcycles_completed;
  END IF;

  -- Avanzar al siguiente día
  v_new_cycle_day := v_current_cycle_day + 1;

  -- Si completó D5, reinicia a D1 e incrementa microciclos completados
  IF v_new_cycle_day > 5 THEN
    v_new_cycle_day := 1;
    v_microcycles_completed := v_microcycles_completed + 1;

    -- Actualizar estado
    UPDATE app.hipertrofia_v2_state
    SET
      cycle_day = v_new_cycle_day,
      microcycles_completed = v_microcycles_completed,
      last_session_at = NOW(),
      last_session_day_name = p_session_day_name,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'cycle_day', v_new_cycle_day,
      'microcycles_completed', v_microcycles_completed,
      'microcycle_completed', true,
      'message', '¡Microciclo completado! Progresión aplicada.'
    );
  ELSE
    -- Actualizar solo el día del ciclo
    UPDATE app.hipertrofia_v2_state
    SET
      cycle_day = v_new_cycle_day,
      last_session_at = NOW(),
      last_session_day_name = p_session_day_name,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'cycle_day', v_new_cycle_day,
      'microcycles_completed', v_microcycles_completed,
      'microcycle_completed', false,
      'message', CONCAT('Avanzaste a D', v_new_cycle_day)
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.advance_cycle_day IS
  'Avanza el día del ciclo SOLO cuando usuario completa sesión. Si completa D5 → D1 e incrementa microciclos';

-- ============================================================
-- 6. FUNCIONES: PROGRESIÓN POR MICROCICLO
-- ============================================================

-- Función: Calcular RIR medio del usuario en el último microciclo
CREATE OR REPLACE FUNCTION app.calculate_mean_rir_last_microcycle(
  p_user_id INT,
  p_methodology_plan_id INT
) RETURNS DECIMAL AS $$
DECLARE
  v_mean_rir DECIMAL;
BEGIN
  -- Calcular RIR promedio de las últimas 5 sesiones (1 microciclo completo)
  SELECT AVG(rir_reported)
  INTO v_mean_rir
  FROM app.hypertrophy_set_logs
  WHERE user_id = p_user_id
    AND methodology_plan_id = p_methodology_plan_id
    AND created_at > NOW() - INTERVAL '14 days'  -- Últimas 2 semanas para flexibilidad
  ORDER BY created_at DESC;

  RETURN COALESCE(v_mean_rir, 2.5);  -- Default RIR medio si no hay datos
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.calculate_mean_rir_last_microcycle IS
  'Calcula el RIR promedio del usuario en el último microciclo (últimas 5 sesiones)';

-- Función: Aplicar progresión +2.5% al completar microciclo
CREATE OR REPLACE FUNCTION app.apply_microcycle_progression(
  p_user_id INT,
  p_methodology_plan_id INT
) RETURNS JSONB AS $$
DECLARE
  v_mean_rir DECIMAL;
  v_should_progress BOOLEAN := false;
  v_exercises_updated INT := 0;
  v_result JSONB;
BEGIN
  -- Calcular RIR medio
  v_mean_rir := app.calculate_mean_rir_last_microcycle(p_user_id, p_methodology_plan_id);

  -- Decidir si aplicar progresión (RIR medio >= 3 y no en deload)
  SELECT v_mean_rir >= 3 AND NOT deload_active
  INTO v_should_progress
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  IF v_should_progress THEN
    -- Incrementar +2.5% todos los ejercicios del plan
    UPDATE app.hypertrophy_progression
    SET
      target_weight_next_cycle = ROUND((COALESCE(current_pr, target_weight_80) * 0.80 * 1.025)::NUMERIC, 2),
      last_adjustment = 'increase',
      adjustment_date = NOW(),
      last_microcycle_completed = (
        SELECT microcycles_completed
        FROM app.hipertrofia_v2_state
        WHERE user_id = p_user_id
      ),
      updated_at = NOW()
    WHERE user_id = p_user_id
      AND NOT progression_locked;  -- No tocar ejercicios con progresión bloqueada

    GET DIAGNOSTICS v_exercises_updated = ROW_COUNT;

    v_result := jsonb_build_object(
      'progression_applied', true,
      'mean_rir', v_mean_rir,
      'increment_pct', 2.5,
      'exercises_updated', v_exercises_updated,
      'message', CONCAT('Progresión +2.5% aplicada a ', v_exercises_updated, ' ejercicios')
    );
  ELSE
    v_result := jsonb_build_object(
      'progression_applied', false,
      'mean_rir', v_mean_rir,
      'reason', CASE
        WHEN v_mean_rir < 3 THEN 'RIR promedio bajo (mantener cargas)'
        ELSE 'Deload activo'
      END,
      'message', 'Cargas mantenidas este microciclo'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.apply_microcycle_progression IS
  'Aplica progresión +2.5% a todos los ejercicios si mean_RIR >= 3 al completar microciclo';

-- ============================================================
-- 7. FUNCIONES: DELOAD AUTOMÁTICO
-- ============================================================

-- Función: Verificar si debe activarse deload
CREATE OR REPLACE FUNCTION app.check_deload_trigger(
  p_user_id INT
) RETURNS JSONB AS $$
DECLARE
  v_microcycles_completed INT;
  v_deload_active BOOLEAN;
  v_should_trigger BOOLEAN := false;
  v_reason VARCHAR(50);
  v_result JSONB;
BEGIN
  -- Obtener estado actual
  SELECT microcycles_completed, deload_active
  INTO v_microcycles_completed, v_deload_active
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  -- No activar si ya está en deload
  IF v_deload_active THEN
    RETURN jsonb_build_object(
      'should_trigger', false,
      'reason', 'Deload ya activo',
      'current_deload', true
    );
  END IF;

  -- Trigger 1: 6 microciclos completados (FASE 1 solo este)
  IF v_microcycles_completed >= 6 THEN
    v_should_trigger := true;
    v_reason := 'planificado';
  END IF;

  -- TODO FASE 2: Añadir trigger por flags críticos
  -- IF critical_flags >= 2 in last 10 days THEN v_reason := 'reactivo' END IF;

  v_result := jsonb_build_object(
    'should_trigger', v_should_trigger,
    'reason', v_reason,
    'microcycles_completed', v_microcycles_completed,
    'message', CASE
      WHEN v_should_trigger THEN CONCAT('Deload requerido (', v_reason, ')')
      ELSE 'No se requiere deload aún'
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.check_deload_trigger IS
  'Verifica si debe activarse deload (FASE 1: solo por 6 microciclos completados)';

-- Función: Activar deload (reducir carga -30%, volumen -50%)
CREATE OR REPLACE FUNCTION app.activate_deload(
  p_user_id INT,
  p_methodology_plan_id INT,
  p_reason VARCHAR DEFAULT 'planificado'
) RETURNS JSONB AS $$
DECLARE
  v_exercises_affected INT := 0;
BEGIN
  -- Marcar deload activo en estado
  UPDATE app.hipertrofia_v2_state
  SET
    deload_active = true,
    deload_reason = p_reason,
    deload_started_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Reducir peso objetivo -30% para el próximo ciclo
  UPDATE app.hypertrophy_progression
  SET
    target_weight_next_cycle = ROUND((COALESCE(target_weight_next_cycle, target_weight_80) * 0.7)::NUMERIC, 2),
    last_adjustment = 'deload',
    adjustment_date = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_exercises_affected = ROW_COUNT;

  -- TODO: Reducir series -50% (se hará en la generación de sesión en backend)

  RETURN jsonb_build_object(
    'deload_activated', true,
    'reason', p_reason,
    'load_reduction_pct', 30,
    'volume_reduction_pct', 50,
    'exercises_affected', v_exercises_affected,
    'message', CONCAT('Deload activado (', p_reason, '). Cargas reducidas -30%, volumen -50%')
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.activate_deload IS
  'Activa deload: reduce cargas -30% y marca estado. Volumen -50% se aplica en generación de sesión';

-- Función: Desactivar deload (tras completar semana de descarga)
CREATE OR REPLACE FUNCTION app.deactivate_deload(
  p_user_id INT
) RETURNS JSONB AS $$
BEGIN
  -- Restablecer pesos a valores pre-deload (subir +2% para nuevo ciclo)
  UPDATE app.hypertrophy_progression
  SET
    target_weight_next_cycle = ROUND((target_weight_next_cycle / 0.7 * 1.02)::NUMERIC, 2),
    last_adjustment = 'post_deload_recovery',
    adjustment_date = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Desactivar deload en estado
  UPDATE app.hipertrofia_v2_state
  SET
    deload_active = false,
    deload_reason = NULL,
    deload_started_at = NULL,
    microcycles_completed = 0,  -- Reiniciar contador post-deload
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'deload_deactivated', true,
    'message', 'Deload completado. Reiniciando progresión con +2% de recarga'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.deactivate_deload IS
  'Desactiva deload tras completarlo. Restaura cargas con +2% de recarga y reinicia microciclos';

-- ============================================================
-- 8. TRIGGER: Actualizar updated_at automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION app.update_hipertrofia_v2_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hipertrofia_v2_state_timestamp
  ON app.hipertrofia_v2_state;

CREATE TRIGGER trigger_update_hipertrofia_v2_state_timestamp
  BEFORE UPDATE ON app.hipertrofia_v2_state
  FOR EACH ROW
  EXECUTE FUNCTION app.update_hipertrofia_v2_state_timestamp();

-- ============================================================
-- 9. VISTA: Estado completo del usuario (FIX: JSONB extraction)
-- ============================================================

CREATE OR REPLACE VIEW app.hipertrofia_v2_user_status AS
SELECT
  s.user_id,
  s.methodology_plan_id,
  s.cycle_day,
  s.microcycles_completed,
  s.last_session_at,
  s.last_session_day_name,
  s.deload_active,
  s.deload_reason,

  -- Info del próximo entrenamiento
  CONCAT('D', s.cycle_day) as next_session,
  sc.session_name as next_session_name,
  sc.muscle_groups as next_muscle_groups,
  sc.intensity_percentage as next_intensity_pct,

  -- Progresión
  (SELECT AVG(rir_reported)
   FROM app.hypertrophy_set_logs
   WHERE user_id = s.user_id
     AND created_at > NOW() - INTERVAL '14 days'
  ) as recent_mean_rir,

  -- Deload check (FIX: Extraer campo del JSONB correctamente)
  (app.check_deload_trigger(s.user_id)->>'should_trigger')::boolean as deload_should_trigger,

  s.updated_at
FROM app.hipertrofia_v2_state s
LEFT JOIN app.hipertrofia_v2_session_config sc ON sc.cycle_day = s.cycle_day;

COMMENT ON VIEW app.hipertrofia_v2_user_status IS
  'Vista consolidada del estado MindFeed del usuario: ciclo actual, progresión, deload';

-- ============================================================
-- 10. VERIFICACIÓN FINAL
-- ============================================================

-- Verificar tablas creadas
SELECT
  table_name,
  (SELECT COUNT(*)
   FROM information_schema.columns
   WHERE table_schema = 'app'
     AND table_name = t.table_name
  ) as column_count
FROM information_schema.tables t
WHERE table_schema = 'app'
  AND table_name IN (
    'hipertrofia_v2_state',
    'hipertrofia_v2_session_config'
  )
ORDER BY table_name;

-- Verificar funciones creadas
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'app'
  AND (routine_name LIKE '%cycle%'
   OR routine_name LIKE '%microcycle%'
   OR routine_name LIKE '%deload%')
ORDER BY routine_name;

-- Verificar columnas añadidas a Ejercicios_Hipertrofia
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'Ejercicios_Hipertrofia'
  AND column_name IN ('tipo_ejercicio', 'patron_movimiento', 'orden_recomendado')
ORDER BY column_name;

-- ============================================================
-- FIN DE MIGRACIÓN FASE 1 (VERSIÓN CORREGIDA)
-- ============================================================
-- CORRECCIONES APLICADAS:
-- - Línea 583: Cambio de SELECT campo FROM función()
--   a función()->>'campo' para extraer correctamente del JSONB
-- ============================================================
