-- ========================================
-- 🥗 CREAR TABLAS DE NUTRICIÓN FALTANTES
-- Solución para: relation "app.nutrition_plans" does not exist
-- ========================================

-- Cambiar al esquema app
SET search_path TO app, public;

-- ========================================
-- 1. TABLA: nutrition_plans
-- ========================================
-- Almacena los planes nutricionales generados por IA
CREATE TABLE IF NOT EXISTS app.nutrition_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,

    -- Datos del plan (JSON completo desde IA)
    plan_data JSONB NOT NULL,

    -- Metadatos del plan extraídos para consultas rápidas
    duration_days INTEGER NOT NULL DEFAULT 7,
    target_calories INTEGER NOT NULL DEFAULT 2000,
    target_protein DECIMAL(6,2) NOT NULL DEFAULT 150.00,
    target_carbs DECIMAL(6,2) NOT NULL DEFAULT 200.00,
    target_fat DECIMAL(6,2) NOT NULL DEFAULT 65.00,
    meals_per_day INTEGER NOT NULL DEFAULT 4,

    -- Información de metodología y estilo
    methodology_focus VARCHAR(100),
    dietary_style VARCHAR(50) DEFAULT 'none', -- none, vegetarian, vegan, keto, etc.

    -- Estado del plan
    is_active BOOLEAN DEFAULT true,
    generation_mode VARCHAR(20) DEFAULT 'ai_generated', -- ai_generated, manual

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign Key (asumiendo que existe tabla users)
    CONSTRAINT fk_nutrition_plans_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- 2. TABLA: daily_nutrition_log
-- ========================================
-- Registro diario de consumo nutricional del usuario
CREATE TABLE IF NOT EXISTS app.daily_nutrition_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    log_date DATE NOT NULL,

    -- Datos del día completo (JSON con comidas detalladas)
    daily_log JSONB NOT NULL DEFAULT '{"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "meals": []}',

    -- Totales del día (extraídos para consultas rápidas)
    calories DECIMAL(7,2) DEFAULT 0.00,
    protein DECIMAL(6,2) DEFAULT 0.00,
    carbs DECIMAL(6,2) DEFAULT 0.00,
    fat DECIMAL(6,2) DEFAULT 0.00,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign Key
    CONSTRAINT fk_daily_nutrition_log_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,

    -- Constraint único por usuario y fecha
    CONSTRAINT unique_user_date_nutrition UNIQUE (user_id, log_date)
);

-- ========================================
-- 3. TABLA: exercise_history
-- ========================================
-- Historial general de ejercicios (requerida por nutrition.js)
CREATE TABLE IF NOT EXISTS app.exercise_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    exercise_name VARCHAR(200) NOT NULL,
    exercise_type VARCHAR(50) DEFAULT 'general', -- general, calistenia, hipertrofia, home

    -- Datos del ejercicio realizado
    sets_completed INTEGER DEFAULT 0,
    reps_completed VARCHAR(100), -- JSON string o texto libre (ej: "12,10,8" o "30 segundos")
    weight_used DECIMAL(5,2) DEFAULT 0.00,
    duration_seconds INTEGER DEFAULT 0,

    -- Contexto del ejercicio
    methodology_used VARCHAR(50),
    session_id INTEGER, -- Puede referenciar methodology_exercise_sessions o otras sesiones
    workout_date DATE DEFAULT CURRENT_DATE,

    -- Feedback del usuario
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    effort_rating INTEGER CHECK (effort_rating >= 1 AND effort_rating <= 5),
    notes TEXT,

    -- Timestamps
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign Key
    CONSTRAINT fk_exercise_history_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- 4. TABLA OPCIONAL: nutrition_recipes
-- ========================================
-- Para almacenar recetas personalizadas (futuro)
CREATE TABLE IF NOT EXISTS app.nutrition_recipes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    recipe_name VARCHAR(200) NOT NULL,
    ingredients JSONB NOT NULL DEFAULT '[]',
    instructions TEXT,

    -- Información nutricional por porción
    serving_size VARCHAR(50) DEFAULT '1 porción',
    calories_per_serving DECIMAL(6,2) DEFAULT 0.00,
    protein_per_serving DECIMAL(5,2) DEFAULT 0.00,
    carbs_per_serving DECIMAL(5,2) DEFAULT 0.00,
    fat_per_serving DECIMAL(5,2) DEFAULT 0.00,

    -- Metadatos
    preparation_time_minutes INTEGER DEFAULT 0,
    cooking_time_minutes INTEGER DEFAULT 0,
    difficulty_level VARCHAR(20) DEFAULT 'easy', -- easy, medium, hard
    recipe_type VARCHAR(50) DEFAULT 'main', -- breakfast, lunch, dinner, snack, main, dessert

    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_favorite BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign Key (nullable para recetas globales)
    CONSTRAINT fk_nutrition_recipes_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- 4. ÍNDICES PARA RENDIMIENTO
-- ========================================

-- Índices para nutrition_plans
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_active
    ON app.nutrition_plans(user_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_created
    ON app.nutrition_plans(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_methodology
    ON app.nutrition_plans(methodology_focus);

-- Índices para daily_nutrition_log
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_log_user_date
    ON app.daily_nutrition_log(user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_nutrition_log_recent
    ON app.daily_nutrition_log(user_id, created_at DESC);

-- Índices para exercise_history
CREATE INDEX IF NOT EXISTS idx_exercise_history_user_recent
    ON app.exercise_history(user_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_history_user_30days
    ON app.exercise_history(user_id, used_at DESC)
    WHERE used_at >= NOW() - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_exercise_history_exercise_name
    ON app.exercise_history(exercise_name);

CREATE INDEX IF NOT EXISTS idx_exercise_history_type
    ON app.exercise_history(exercise_type, user_id);

-- Índices para nutrition_recipes
CREATE INDEX IF NOT EXISTS idx_nutrition_recipes_user_active
    ON app.nutrition_recipes(user_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_nutrition_recipes_type
    ON app.nutrition_recipes(recipe_type, is_active);

CREATE INDEX IF NOT EXISTS idx_nutrition_recipes_favorites
    ON app.nutrition_recipes(user_id, is_favorite)
    WHERE is_favorite = true;

-- ========================================
-- 5. TRIGGERS PARA updated_at
-- ========================================

-- Función para actualizar updated_at (reutilizable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para las tablas de nutrición
DROP TRIGGER IF EXISTS update_nutrition_plans_updated_at ON app.nutrition_plans;
CREATE TRIGGER update_nutrition_plans_updated_at
    BEFORE UPDATE ON app.nutrition_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_nutrition_log_updated_at ON app.daily_nutrition_log;
CREATE TRIGGER update_daily_nutrition_log_updated_at
    BEFORE UPDATE ON app.daily_nutrition_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para exercise_history (aunque no tiene updated_at por diseño)
-- Se omite intencionalmente ya que exercise_history es inmutable

DROP TRIGGER IF EXISTS update_nutrition_recipes_updated_at ON app.nutrition_recipes;
CREATE TRIGGER update_nutrition_recipes_updated_at
    BEFORE UPDATE ON app.nutrition_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. FUNCIONES AUXILIARES
-- ========================================

-- Función para obtener el plan nutricional activo de un usuario
CREATE OR REPLACE FUNCTION get_user_active_nutrition_plan(p_user_id INTEGER)
RETURNS TABLE (
    plan_id INTEGER,
    plan_data JSONB,
    target_calories INTEGER,
    target_protein DECIMAL,
    target_carbs DECIMAL,
    target_fat DECIMAL,
    methodology_focus VARCHAR,
    dietary_style VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        np.id,
        np.plan_data,
        np.target_calories,
        np.target_protein,
        np.target_carbs,
        np.target_fat,
        np.methodology_focus,
        np.dietary_style,
        np.created_at
    FROM app.nutrition_plans np
    WHERE np.user_id = p_user_id
        AND np.is_active = true
    ORDER BY np.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas nutricionales de un período
CREATE OR REPLACE FUNCTION get_nutrition_stats(p_user_id INTEGER, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_days_tracked BIGINT,
    avg_calories NUMERIC,
    avg_protein NUMERIC,
    avg_carbs NUMERIC,
    avg_fat NUMERIC,
    consistency_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_days_tracked,
        ROUND(AVG(dnl.calories), 2) as avg_calories,
        ROUND(AVG(dnl.protein), 2) as avg_protein,
        ROUND(AVG(dnl.carbs), 2) as avg_carbs,
        ROUND(AVG(dnl.fat), 2) as avg_fat,
        ROUND(
            (COUNT(*) * 100.0 / p_days), 2
        ) as consistency_percentage
    FROM app.daily_nutrition_log dnl
    WHERE dnl.user_id = p_user_id
        AND dnl.log_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
        AND dnl.calories > 0; -- Solo contar días con datos
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. COMENTARIOS DE DOCUMENTACIÓN
-- ========================================

COMMENT ON TABLE app.nutrition_plans IS 'Planes nutricionales generados por IA para usuarios';
COMMENT ON TABLE app.daily_nutrition_log IS 'Registro diario de consumo nutricional por usuario';
COMMENT ON TABLE app.exercise_history IS 'Historial general de ejercicios realizados por usuarios';
COMMENT ON TABLE app.nutrition_recipes IS 'Recetas personalizadas de usuarios (opcional/futuro)';

COMMENT ON FUNCTION get_user_active_nutrition_plan IS 'Obtiene el plan nutricional activo más reciente de un usuario';
COMMENT ON FUNCTION get_nutrition_stats IS 'Calcula estadísticas nutricionales de un usuario para un período dado';

-- ========================================
-- 8. DATOS DE EJEMPLO (OPCIONAL)
-- ========================================

-- Insertar plan de ejemplo (comentado por seguridad)
-- INSERT INTO app.nutrition_plans (user_id, plan_data, target_calories, target_protein, target_carbs, target_fat, methodology_focus, dietary_style)
-- VALUES (1, '{"plan_summary": {"duration_days": 7, "methodology_focus": "Entrenamiento general"}}', 2200, 165, 220, 75, 'Entrenamiento general', 'none');

-- ========================================
-- 9. VERIFICACIÓN FINAL
-- ========================================

-- Verificar que las tablas se crearon correctamente
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'app'
    AND tablename IN ('nutrition_plans', 'daily_nutrition_log', 'exercise_history', 'nutrition_recipes')
ORDER BY tablename;

-- Mostrar estructura de las tablas creadas
\d app.nutrition_plans;
\d app.daily_nutrition_log;
\d app.exercise_history;
\d app.nutrition_recipes;

-- ========================================
-- ✅ SCRIPT COMPLETADO
-- ========================================
--
-- INSTRUCCIONES DE USO:
-- 1. Ejecutar este script completo en tu base de datos Supabase
-- 2. Verificar que las tablas se crearon correctamente
-- 3. El sistema de nutrición debería funcionar inmediatamente
--
-- TABLAS CREADAS:
-- ✅ app.nutrition_plans - Planes nutricionales generados por IA
-- ✅ app.daily_nutrition_log - Registro diario de nutrición
-- ✅ app.exercise_history - Historial general de ejercicios (requerida por nutrition.js)
-- ✅ app.nutrition_recipes - Recetas personalizadas (opcional)
--
-- FUNCIONES INCLUIDAS:
-- ✅ get_user_active_nutrition_plan() - Obtener plan activo
-- ✅ get_nutrition_stats() - Estadísticas nutricionales
-- ✅ Triggers automáticos para updated_at
--
-- ÍNDICES OPTIMIZADOS para consultas frecuentes incluidos
-- ========================================