-- ========================================
-- 🥗 CREAR TABLAS DE NUTRICIÓN FALTANTES
-- Solución para: relation "app.nutrition_plans" does not exist
-- ========================================

-- Cambiar al esquema app
SET search_path TO app, public;

-- ========================================
-- 1. TABLA: nutrition_plans
-- ========================================
CREATE TABLE IF NOT EXISTS app.nutrition_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_data JSONB NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 7,
    target_calories INTEGER NOT NULL DEFAULT 2000,
    target_protein DECIMAL(6,2) NOT NULL DEFAULT 150.00,
    target_carbs DECIMAL(6,2) NOT NULL DEFAULT 200.00,
    target_fat DECIMAL(6,2) NOT NULL DEFAULT 65.00,
    meals_per_day INTEGER NOT NULL DEFAULT 4,
    methodology_focus VARCHAR(100),
    dietary_style VARCHAR(50) DEFAULT 'none',
    is_active BOOLEAN DEFAULT true,
    generation_mode VARCHAR(20) DEFAULT 'ai_generated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. TABLA: daily_nutrition_log
-- ========================================
CREATE TABLE IF NOT EXISTS app.daily_nutrition_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    log_date DATE NOT NULL,
    daily_log JSONB NOT NULL DEFAULT '{"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "meals": []}',
    calories DECIMAL(7,2) DEFAULT 0.00,
    protein DECIMAL(6,2) DEFAULT 0.00,
    carbs DECIMAL(6,2) DEFAULT 0.00,
    fat DECIMAL(6,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_date_nutrition UNIQUE (user_id, log_date)
);

-- ========================================
-- 3. TABLA: exercise_history
-- ========================================
CREATE TABLE IF NOT EXISTS app.exercise_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_type VARCHAR(50) DEFAULT 'general',
    sets_completed INTEGER DEFAULT 0,
    reps_completed VARCHAR(100),
    weight_used DECIMAL(5,2) DEFAULT 0.00,
    duration_seconds INTEGER DEFAULT 0,
    methodology_used VARCHAR(50),
    session_id INTEGER,
    workout_date DATE DEFAULT CURRENT_DATE,
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    effort_rating INTEGER CHECK (effort_rating >= 1 AND effort_rating <= 5),
    notes TEXT,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 4. ÍNDICES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_active
    ON app.nutrition_plans(user_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_daily_nutrition_log_user_date
    ON app.daily_nutrition_log(user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_history_user_recent
    ON app.exercise_history(user_id, used_at DESC);

-- ========================================
-- 5. VERIFICACIÓN
-- ========================================
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'app'
    AND tablename IN ('nutrition_plans', 'daily_nutrition_log', 'exercise_history')
ORDER BY tablename;