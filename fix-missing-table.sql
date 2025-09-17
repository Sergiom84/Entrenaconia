-- Crear tabla faltante methodology_exercise_history_complete
CREATE TABLE IF NOT EXISTS app.methodology_exercise_history_complete (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_plan_id INTEGER REFERENCES app.methodology_plans(id) ON DELETE SET NULL,
    methodology_session_id INTEGER REFERENCES app.methodology_exercise_sessions(id) ON DELETE SET NULL,
    exercise_name VARCHAR(255) NOT NULL,
    exercise_order INTEGER NOT NULL,
    methodology_type VARCHAR(100),
    series_total VARCHAR(50),
    series_completed INTEGER DEFAULT 0,
    repeticiones VARCHAR(100),
    intensidad VARCHAR(100),
    tiempo_dedicado_segundos INTEGER,
    week_number INTEGER,
    day_name VARCHAR(20),
    session_date DATE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(methodology_session_id, exercise_order)
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_meh_user_id ON app.methodology_exercise_history_complete(user_id);
CREATE INDEX IF NOT EXISTS idx_meh_plan_id ON app.methodology_exercise_history_complete(methodology_plan_id);
CREATE INDEX IF NOT EXISTS idx_meh_session_id ON app.methodology_exercise_history_complete(methodology_session_id);
CREATE INDEX IF NOT EXISTS idx_meh_session_date ON app.methodology_exercise_history_complete(session_date);
CREATE INDEX IF NOT EXISTS idx_meh_completed_at ON app.methodology_exercise_history_complete(completed_at);

-- Verificar planes del usuario 18
SELECT
    id,
    methodology_type,
    status,
    created_at,
    confirmed_at,
    CASE
        WHEN plan_data IS NOT NULL THEN 'Tiene data'
        ELSE 'Sin data'
    END as tiene_plan_data
FROM app.methodology_plans
WHERE user_id = 18
ORDER BY created_at DESC;

-- Activar el plan más reciente del usuario 18 si existe
UPDATE app.methodology_plans
SET
    status = 'active',
    confirmed_at = CASE
        WHEN confirmed_at IS NULL THEN NOW()
        ELSE confirmed_at
    END,
    updated_at = NOW()
WHERE id = (
    SELECT id
    FROM app.methodology_plans
    WHERE user_id = 18
    AND plan_data IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
)
RETURNING id, status, methodology_type;