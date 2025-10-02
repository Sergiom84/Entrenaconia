-- ============================================================
-- MIGRACIÓN: Crear tabla methodology_plan_days
-- Fecha: 2025-10-02
-- Objetivo: Mapping de day_id → (week, day_name, scheduled_date)
-- ============================================================

-- Crear tabla methodology_plan_days
CREATE TABLE IF NOT EXISTS app.methodology_plan_days (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL,
  day_id INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  day_name VARCHAR(20) NOT NULL,
  day_abbrev VARCHAR(3) NOT NULL,
  scheduled_date DATE NOT NULL,
  session_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_methodology_plan FOREIGN KEY (plan_id)
    REFERENCES app.methodology_plans(id) ON DELETE CASCADE,
  CONSTRAINT uq_plan_day UNIQUE (plan_id, day_id),
  CONSTRAINT uq_plan_date UNIQUE (plan_id, scheduled_date)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_plan_days_plan_id
ON app.methodology_plan_days(plan_id);

CREATE INDEX IF NOT EXISTS idx_plan_days_day_id
ON app.methodology_plan_days(plan_id, day_id);

CREATE INDEX IF NOT EXISTS idx_plan_days_week_day
ON app.methodology_plan_days(plan_id, week_number, day_name);

-- Comentarios descriptivos
COMMENT ON TABLE app.methodology_plan_days IS
'Mapeo de día consecutivo (day_id) a fecha, semana y día de la semana del plan';

COMMENT ON COLUMN app.methodology_plan_days.day_id IS
'Día consecutivo del plan (1 = primer día, 2 = segundo día, etc.)';

COMMENT ON COLUMN app.methodology_plan_days.week_number IS
'Número de semana del plan (1, 2, 3, etc.)';

COMMENT ON COLUMN app.methodology_plan_days.day_name IS
'Nombre completo del día (Lunes, Martes, Miércoles, etc.)';

COMMENT ON COLUMN app.methodology_plan_days.day_abbrev IS
'Abreviatura del día (Lun, Mar, Mié, etc.)';

COMMENT ON COLUMN app.methodology_plan_days.scheduled_date IS
'Fecha calendario para este día del plan';

COMMENT ON COLUMN app.methodology_plan_days.session_order IS
'Orden global de sesión si este día tiene entrenamiento (NULL si es descanso)';

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Tabla methodology_plan_days creada correctamente';
  RAISE NOTICE '📋 Índices creados para búsquedas optimizadas';
END $$;
