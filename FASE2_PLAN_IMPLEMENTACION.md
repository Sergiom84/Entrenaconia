# 🚀 FASE 2 MINDFEED - PLAN DE IMPLEMENTACIÓN

## 📋 RESUMEN DE FASE 2

La FASE 2 añade **Inteligencia Adaptativa** al sistema MindFeed, implementando:

1. **Flags de Fatiga** (leve/crítico/cognitivo)
2. **Solapamiento Neural** (parcial/alto)
3. **Módulo de Prioridad Muscular** (1 músculo prioritario)
4. **Transición Automática entre Bloques** (Adaptación → Hipertrofia)
5. **Gestión de Inactividad** (calibración tras 14 días)
6. **Gestión de Frecuencias Adaptativas** (2-7 días/semana)

---

## 🎯 MÓDULOS A IMPLEMENTAR

### **MÓDULO 1: FLAGS DE FATIGA**

#### 1.1 Tipos de Flags (según documentación)

**Leve (fatigue_light)**:

- Sueño: 4-5/10
- Energía: 4-5/10
- DOMS: 6-7/10
- Caída rendimiento: ~5% a ~9%
- RIR <2 en ≥2 series
- **Acción**: Mantener carga, NO aplicar +2.5% esa semana

**Crítico (fatigue_high)**:

- Dolor articular: ≥6/10
- Sueño: ≤3/10
- Energía: ≤3/10
- Caída rendimiento: ≥10%
- RIR <1 no planificado
- **Acción**: Reducir carga ~10%, deload parcial o completo

**Cognitivo (focus_low)**:

- Baja concentración o motivación
- **Acción**: IA puede reducir serie analítica o proponer descanso activo

#### 1.2 Base de Datos

```sql
-- Tabla de flags de fatiga
CREATE TABLE IF NOT EXISTS app.fatigue_flags (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  methodology_plan_id INT REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
  session_id INT REFERENCES app.routine_sessions(id) ON DELETE SET NULL,

  flag_date TIMESTAMP DEFAULT NOW(),
  flag_type VARCHAR(20) NOT NULL CHECK (flag_type IN ('light', 'critical', 'cognitive')),

  -- Fuentes subjetivas (usuario reporta)
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 10),
  energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
  doms_level INT CHECK (doms_level BETWEEN 1 AND 10),
  joint_pain_level INT CHECK (joint_pain_level BETWEEN 0 AND 10),
  focus_level INT CHECK (focus_level BETWEEN 1 AND 10),
  motivation_level INT CHECK (motivation_level BETWEEN 1 AND 10),

  -- Fuentes objetivas (calculadas)
  performance_drop_pct NUMERIC(5,2), -- % caída rendimiento vs última sesión
  underperformed_sets INT DEFAULT 0, -- Series con RIR <2 no planificadas
  mean_rir_session NUMERIC(3,1),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fatigue_flags_user ON app.fatigue_flags(user_id, flag_date DESC);
CREATE INDEX idx_fatigue_flags_session ON app.fatigue_flags(session_id);

-- Función: Detectar flags automáticamente desde RIR y performance
CREATE OR REPLACE FUNCTION app.detect_automatic_fatigue_flags(
  p_user_id INT,
  p_session_id INT
) RETURNS JSONB AS $$
DECLARE
  v_mean_rir NUMERIC;
  v_underperformed_sets INT;
  v_performance_drop NUMERIC;
  v_flag_type VARCHAR(20);
BEGIN
  -- Calcular mean_RIR de la sesión actual
  SELECT AVG(rir)::NUMERIC(3,1), COUNT(*)
  INTO v_mean_rir, v_underperformed_sets
  FROM app.hipertrofia_v2_sets
  WHERE session_id = p_session_id AND rir < 2;

  -- Calcular caída de rendimiento (comparar con última sesión similar)
  -- TODO: implementar lógica de comparación
  v_performance_drop := 0;

  -- Decidir tipo de flag
  IF v_underperformed_sets >= 3 OR v_mean_rir < 1.5 THEN
    v_flag_type := 'critical';
  ELSIF v_underperformed_sets >= 2 OR v_mean_rir < 2.5 THEN
    v_flag_type := 'light';
  ELSE
    v_flag_type := NULL;
  END IF;

  -- Si hay flag, insertar
  IF v_flag_type IS NOT NULL THEN
    INSERT INTO app.fatigue_flags (
      user_id, session_id, flag_type,
      mean_rir_session, underperformed_sets, performance_drop_pct
    ) VALUES (
      p_user_id, p_session_id, v_flag_type,
      v_mean_rir, v_underperformed_sets, v_performance_drop
    );
  END IF;

  RETURN jsonb_build_object(
    'flag_detected', v_flag_type IS NOT NULL,
    'flag_type', v_flag_type,
    'mean_rir', v_mean_rir,
    'underperformed_sets', v_underperformed_sets
  );
END;
$$ LANGUAGE plpgsql;

-- Función: Contar flags en ventana de tiempo
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
    'window_days', p_days_window
  );
END;
$$ LANGUAGE plpgsql;
```

#### 1.3 Backend Endpoints

```javascript
// POST /api/hipertrofiav2/submit-fatigue-report
// Usuario reporta subjetivamente su estado
router.post("/submit-fatigue-report", authenticateToken, async (req, res) => {
  const {
    sleep_quality,
    energy_level,
    doms_level,
    joint_pain_level,
    focus_level,
    motivation_level,
    notes,
  } = req.body;

  // Determinar tipo de flag basado en umbrales
  let flag_type = null;

  if (joint_pain_level >= 6 || sleep_quality <= 3 || energy_level <= 3) {
    flag_type = "critical";
  } else if (sleep_quality <= 5 || energy_level <= 5 || doms_level >= 6) {
    flag_type = "light";
  } else if (focus_level <= 4 || motivation_level <= 4) {
    flag_type = "cognitive";
  }

  // Insertar flag
  if (flag_type) {
    await pool.query(
      `
      INSERT INTO app.fatigue_flags (
        user_id, flag_type, sleep_quality, energy_level,
        doms_level, joint_pain_level, focus_level, motivation_level, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, flag_type
    `,
      [
        userId,
        flag_type,
        sleep_quality,
        energy_level,
        doms_level,
        joint_pain_level,
        focus_level,
        motivation_level,
        notes,
      ],
    );
  }

  res.json({ success: true, flag_type });
});

// GET /api/hipertrofiav2/fatigue-status/:userId
// Obtener resumen de flags recientes
router.get("/fatigue-status/:userId", authenticateToken, async (req, res) => {
  const result = await pool.query(
    `
    SELECT app.count_recent_flags($1, 10) as flags
  `,
    [req.params.userId],
  );

  const flags = result.rows[0].flags;

  // Decidir acción recomendada
  let action = "continue_normal";
  if (flags.critical >= 2) {
    action = "immediate_deload";
  } else if (flags.critical >= 1 || flags.light >= 2) {
    action = "freeze_progression";
  }

  res.json({ success: true, flags, action });
});
```

#### 1.4 Frontend: Modal de Reporte de Fatiga

Crear componente **FatigueReportModal.jsx** que aparezca:

- Al finalizar sesión (opcional)
- Como botón en TodayTrainingTab
- Automáticamente si el sistema detecta underperformance

---

### **MÓDULO 2: SOLAPAMIENTO NEURAL**

#### 2.1 Detección de Patrones

Según documentación:

- **Parcial (sinergistas)**: Press militar → Press banca → -2.5% día 2
- **Alto (patrón similar)**: Remo → RDL → -5% o congelar progresión

#### 2.2 Base de Datos

```sql
-- Añadir a hipertrofia_v2_state
ALTER TABLE app.hipertrofia_v2_state
ADD COLUMN IF NOT EXISTS last_session_patterns JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS neural_overlap_detected VARCHAR(20) CHECK (neural_overlap_detected IN ('none', 'partial', 'high'));

-- Función: Detectar solapamiento neural
CREATE OR REPLACE FUNCTION app.detect_neural_overlap(
  p_user_id INT,
  p_current_session_patterns JSONB
) RETURNS JSONB AS $$
DECLARE
  v_last_patterns JSONB;
  v_overlap_level VARCHAR(20);
  v_time_since_last NUMERIC;
BEGIN
  -- Obtener patrones de última sesión
  SELECT
    last_session_patterns,
    EXTRACT(EPOCH FROM (NOW() - last_session_at)) / 3600
  INTO v_last_patterns, v_time_since_last
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  -- Si han pasado >72h, no hay overlap
  IF v_time_since_last > 72 THEN
    RETURN jsonb_build_object('overlap', 'none', 'adjustment', 0);
  END IF;

  -- Detectar overlap (lógica simplificada)
  -- TODO: implementar matriz completa de patrones

  -- Ejemplo: si ambas sesiones tienen "empuje_horizontal"
  IF v_last_patterns ? 'empuje_horizontal' AND p_current_session_patterns ? 'empuje_horizontal' THEN
    v_overlap_level := 'high';
  ELSIF v_last_patterns ? 'empuje_vertical' AND p_current_session_patterns ? 'empuje_horizontal' THEN
    v_overlap_level := 'partial';
  ELSE
    v_overlap_level := 'none';
  END IF;

  RETURN jsonb_build_object(
    'overlap', v_overlap_level,
    'adjustment', CASE
      WHEN v_overlap_level = 'high' THEN -0.05
      WHEN v_overlap_level = 'partial' THEN -0.025
      ELSE 0
    END
  );
END;
$$ LANGUAGE plpgsql;
```

#### 2.3 Backend Endpoint

```javascript
// POST /api/hipertrofiav2/check-neural-overlap
router.post("/check-neural-overlap", authenticateToken, async (req, res) => {
  const { sessionPatterns } = req.body; // ['empuje_horizontal', 'aislamiento_triceps']

  const result = await pool.query(
    `
    SELECT app.detect_neural_overlap($1, $2::jsonb) as overlap
  `,
    [userId, JSON.stringify(sessionPatterns)],
  );

  const overlap = result.rows[0].overlap;

  res.json({ success: true, ...overlap });
});
```

---

### **MÓDULO 3: PRIORIDAD MUSCULAR**

#### 3.1 Especificación (según documentación)

- Máximo 1 microciclo prioritario activo
- Top set + 1 por semana, volumen +20%
- Fatiga bajo control (mean_RIR 1-3 en prioritarios)
- Duración: 2-3 microciclos completados
- Si pasan >6 semanas naturales sin cerrar microciclo: se desactiva prioridad

#### 3.2 Base de Datos

```sql
-- Añadir a hipertrofia_v2_state
ALTER TABLE app.hipertrofia_v2_state
ADD COLUMN IF NOT EXISTS priority_muscle VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS priority_microcycles_completed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_top_sets_this_week INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_last_week_reset TIMESTAMP DEFAULT NOW();

-- Función: Activar prioridad
CREATE OR REPLACE FUNCTION app.activate_muscle_priority(
  p_user_id INT,
  p_muscle_group VARCHAR(50)
) RETURNS JSONB AS $$
BEGIN
  -- Verificar que no hay prioridad activa
  IF EXISTS (
    SELECT 1 FROM app.hipertrofia_v2_state
    WHERE user_id = p_user_id AND priority_muscle IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'Ya hay una prioridad activa');
  END IF;

  -- Activar prioridad
  UPDATE app.hipertrofia_v2_state
  SET
    priority_muscle = p_muscle_group,
    priority_started_at = NOW(),
    priority_microcycles_completed = 0,
    priority_top_sets_this_week = 0
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'priority_muscle', p_muscle_group);
END;
$$ LANGUAGE plpgsql;

-- Función: Desactivar prioridad
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
    priority_top_sets_this_week = 0
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'reason', p_reason);
END;
$$ LANGUAGE plpgsql;

-- Función: Verificar si prioridad debe desactivarse
CREATE OR REPLACE FUNCTION app.check_priority_timeout(
  p_user_id INT
) RETURNS JSONB AS $$
DECLARE
  v_priority_age_weeks NUMERIC;
  v_microcycles_completed INT;
BEGIN
  SELECT
    EXTRACT(EPOCH FROM (NOW() - priority_started_at)) / 604800, -- 1 semana = 604800 seg
    priority_microcycles_completed
  INTO v_priority_age_weeks, v_microcycles_completed
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id AND priority_muscle IS NOT NULL;

  -- Si >6 semanas naturales sin cerrar microciclo: desactivar
  IF v_priority_age_weeks > 6 AND v_microcycles_completed < 1 THEN
    PERFORM app.deactivate_muscle_priority(p_user_id, 'timeout');
    RETURN jsonb_build_object('deactivated', true, 'reason', 'timeout');
  END IF;

  -- Si completó 2-3 microciclos: desactivar
  IF v_microcycles_completed >= 2 THEN
    PERFORM app.deactivate_muscle_priority(p_user_id, 'completed');
    RETURN jsonb_build_object('deactivated', true, 'reason', 'completed');
  END IF;

  RETURN jsonb_build_object('deactivated', false);
END;
$$ LANGUAGE plpgsql;
```

#### 3.3 Backend Endpoints

```javascript
// POST /api/hipertrofiav2/activate-priority
router.post("/activate-priority", authenticateToken, async (req, res) => {
  const { muscleGroup } = req.body; // 'Pecho', 'Espalda', etc.

  const result = await pool.query(
    `
    SELECT app.activate_muscle_priority($1, $2) as result
  `,
    [userId, muscleGroup],
  );

  res.json(result.rows[0].result);
});

// POST /api/hipertrofiav2/deactivate-priority
router.post("/deactivate-priority", authenticateToken, async (req, res) => {
  const result = await pool.query(
    `
    SELECT app.deactivate_muscle_priority($1) as result
  `,
    [userId],
  );

  res.json(result.rows[0].result);
});

// GET /api/hipertrofiav2/priority-status/:userId
router.get("/priority-status/:userId", authenticateToken, async (req, res) => {
  const result = await pool.query(
    `
    SELECT
      priority_muscle,
      priority_started_at,
      priority_microcycles_completed,
      priority_top_sets_this_week
    FROM app.hipertrofia_v2_state
    WHERE user_id = $1
  `,
    [req.params.userId],
  );

  const priority = result.rows[0];

  // Verificar timeout
  const timeoutCheck = await pool.query(
    `
    SELECT app.check_priority_timeout($1) as check
  `,
    [req.params.userId],
  );

  res.json({
    success: true,
    priority: priority.priority_muscle ? priority : null,
    timeout_check: timeoutCheck.rows[0].check,
  });
});
```

---

### **MÓDULO 4: TRANSICIÓN AUTOMÁTICA ENTRE BLOQUES**

#### 4.1 Criterios (según documentación)

La IA pasa de Adaptación → Hipertrofia al cumplir:

1. **Adherencia**: >= 80% → Consistencia semanal del usuario
2. **Técnica (flags técnicos)**: ≤1/semana → Dominio motor adecuado
3. **Progreso (carga media)**: >=8% → Hipertrofia consolidada

Si se cumplen: finaliza bloque, guarda cargas como baseline del siguiente
Si no: repite bloque con ~10% cargas iniciales y progresión cap +2%/sem

#### 4.2 Base de Datos

```sql
-- Añadir a methodology_plans
ALTER TABLE app.methodology_plans
ADD COLUMN IF NOT EXISTS current_block VARCHAR(50) DEFAULT 'adaptacion',
ADD COLUMN IF NOT EXISTS block_started_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS block_adherence_pct NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS technical_flags_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS load_increase_pct NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS block_transition_ready BOOLEAN DEFAULT false;

-- Función: Evaluar si debe transicionar
CREATE OR REPLACE FUNCTION app.evaluate_block_transition(
  p_user_id INT,
  p_methodology_plan_id INT
) RETURNS JSONB AS $$
DECLARE
  v_adherence NUMERIC;
  v_technical_flags INT;
  v_load_increase NUMERIC;
  v_current_block VARCHAR(50);
  v_can_transition BOOLEAN;
BEGIN
  -- Obtener datos actuales
  SELECT
    block_adherence_pct,
    technical_flags_count,
    load_increase_pct,
    current_block
  INTO v_adherence, v_technical_flags, v_load_increase, v_current_block
  FROM app.methodology_plans
  WHERE id = p_methodology_plan_id AND user_id = p_user_id;

  -- Evaluar criterios
  v_can_transition := (
    v_adherence >= 80 AND
    v_technical_flags <= 1 AND
    v_load_increase >= 8
  );

  RETURN jsonb_build_object(
    'current_block', v_current_block,
    'can_transition', v_can_transition,
    'criteria', jsonb_build_object(
      'adherence', v_adherence,
      'technical_flags', v_technical_flags,
      'load_increase', v_load_increase
    ),
    'next_block', CASE
      WHEN v_current_block = 'adaptacion' THEN 'hipertrofia'
      ELSE 'adaptacion'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Función: Aplicar transición
CREATE OR REPLACE FUNCTION app.apply_block_transition(
  p_user_id INT,
  p_methodology_plan_id INT
) RETURNS JSONB AS $$
DECLARE
  v_next_block VARCHAR(50);
BEGIN
  -- Determinar siguiente bloque
  SELECT
    CASE WHEN current_block = 'adaptacion' THEN 'hipertrofia' ELSE 'adaptacion' END
  INTO v_next_block
  FROM app.methodology_plans
  WHERE id = p_methodology_plan_id;

  -- Guardar cargas actuales como baseline del siguiente
  -- TODO: implementar lógica de guardado de baseline

  -- Actualizar bloque
  UPDATE app.methodology_plans
  SET
    current_block = v_next_block,
    block_started_at = NOW(),
    block_adherence_pct = 0,
    technical_flags_count = 0,
    load_increase_pct = 0,
    block_transition_ready = false
  WHERE id = p_methodology_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_block', v_next_block,
    'message', 'Transición completada'
  );
END;
$$ LANGUAGE plpgsql;
```

---

### **MÓDULO 5: GESTIÓN DE INACTIVIDAD**

#### 5.1 Especificación (según documentación)

Si pasan 14 días sin entrenamiento:

- Sistema activa semana 0 de calibración con cargas al 70%
- Desactiva cualquier prioridad activa

#### 5.2 Implementación en advance_cycle

Modificar función `advance_cycle_day` existente:

```sql
-- Modificar advance_cycle_day para detectar inactividad
CREATE OR REPLACE FUNCTION app.advance_cycle_day(
  p_user_id INT,
  p_session_day_name VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_days_inactive NUMERIC;
  v_calibration_needed BOOLEAN;
BEGIN
  -- Calcular días de inactividad
  SELECT EXTRACT(EPOCH FROM (NOW() - last_session_at)) / 86400
  INTO v_days_inactive
  FROM app.hipertrofia_v2_state
  WHERE user_id = p_user_id;

  -- Si >14 días: activar calibración
  IF v_days_inactive > 14 THEN
    -- Reducir cargas al 70%
    UPDATE app.hypertrophy_progression
    SET target_weight_next_cycle = current_weight * 0.70
    WHERE user_id = p_user_id;

    -- Desactivar prioridad
    PERFORM app.deactivate_muscle_priority(p_user_id, 'inactivity');

    v_calibration_needed := true;
  ELSE
    v_calibration_needed := false;
  END IF;

  -- ... resto de lógica existente ...

  RETURN jsonb_build_object(
    -- ... campos existentes ...
    'calibration_applied', v_calibration_needed,
    'days_inactive', v_days_inactive
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 📅 CRONOGRAMA DE IMPLEMENTACIÓN

### **SPRINT 1: Flags de Fatiga (3-4 días)**

- [ ] Crear tabla `fatigue_flags` y funciones SQL
- [ ] Implementar endpoints backend
- [ ] Crear `FatigueReportModal.jsx` (frontend)
- [ ] Integrar en `SessionSummaryModal` y `TodayTrainingTab`
- [ ] Testing básico

### **SPRINT 2: Solapamiento Neural (2-3 días)**

- [ ] Añadir columnas a `hipertrofia_v2_state`
- [ ] Implementar función `detect_neural_overlap`
- [ ] Crear endpoint `/check-neural-overlap`
- [ ] Integrar en generación de sesiones
- [ ] Testing con casos reales

### **SPRINT 3: Prioridad Muscular (3-4 días)**

- [ ] Añadir columnas de prioridad a `hipertrofia_v2_state`
- [ ] Implementar funciones de activación/desactivación
- [ ] Crear endpoints backend
- [ ] Crear UI de selección de prioridad (frontend)
- [ ] Integrar con motor de ciclo
- [ ] Testing completo

### **SPRINT 4: Transición de Bloques (2-3 días)**

- [ ] Añadir columnas a `methodology_plans`
- [ ] Implementar función `evaluate_block_transition`
- [ ] Crear endpoint `/evaluate-transition`
- [ ] Crear notificación UI de transición
- [ ] Testing de criterios

### **SPRINT 5: Gestión de Inactividad (1-2 días)**

- [ ] Modificar `advance_cycle_day` para detectar inactividad
- [ ] Implementar lógica de calibración al 70%
- [ ] Testing con usuario inactivo

### **SPRINT 6: Integración y Testing Final (2-3 días)**

- [ ] Integrar todos los módulos
- [ ] Testing end-to-end completo
- [ ] Ajustes y correcciones
- [ ] Documentación actualizada

**DURACIÓN ESTIMADA TOTAL: 15-20 días**

---

## 🔍 PRIORIZACIÓN RECOMENDADA

Si quieres implementar gradualmente, el orden sugerido es:

1. **PRIORIDAD ALTA**: Flags de Fatiga (impacta directamente en seguridad del usuario)
2. **PRIORIDAD MEDIA**: Solapamiento Neural (mejora recuperación)
3. **PRIORIDAD MEDIA**: Prioridad Muscular (feature atractiva para usuarios)
4. **PRIORIDAD BAJA**: Transición de Bloques (puede esperar hasta tener más datos)
5. **PRIORIDAD BAJA**: Gestión de Inactividad (edge case)

---

## 📝 NOTAS IMPORTANTES

### Compatibilidad con FASE 1

- Todos los módulos de FASE 2 son **aditivos** (no rompen FASE 1)
- Si un usuario no reporta fatiga, el sistema funciona como en FASE 1
- La prioridad muscular es **opcional** (activada por usuario)

### Testing

- Cada módulo debe testearse de forma aislada antes de integrar
- Usar usuarios de prueba con diferentes perfiles
- Simular casos extremos (inactividad, flags críticos, etc.)

### Logging

- Mantener prefijo `[MINDFEED]` en todos los logs
- Añadir prefijos específicos: `[FATIGUE]`, `[OVERLAP]`, `[PRIORITY]`, etc.

---

## ✅ CHECKLIST PRE-IMPLEMENTACIÓN

Antes de comenzar FASE 2, verificar:

- [ ] FASE 1 completamente funcional y testeada
- [ ] Base de datos estable y sin errores
- [ ] Backup de BD antes de migraciones
- [ ] Documentación de FASE 1 completa
- [ ] Equipo alineado en prioridades

---

**Fecha de Creación**: 2025-11-12
**Versión**: MindFeed v1.0 - FASE 2 Plan
**Estado**: 📋 PLANIFICADO - Pendiente de aprobación para iniciar implementación
