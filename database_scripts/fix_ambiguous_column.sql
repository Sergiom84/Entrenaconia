-- Fix ambiguous column reference in get_exercises_for_combination function
CREATE OR REPLACE FUNCTION app.get_exercises_for_combination(
    p_user_id INTEGER,
    p_equipment_type VARCHAR(20),
    p_training_type VARCHAR(20),
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    exercise_name TEXT,
    exercise_key TEXT,
    times_used INTEGER,
    last_used_at TIMESTAMP WITH TIME ZONE,
    user_rating TEXT,
    combination_code TEXT
) AS $$
DECLARE
    combo_id INTEGER;
    combo_code_val VARCHAR(50);  -- Different variable name to avoid ambiguity
BEGIN
    -- Obtener información de la combinación
    SELECT c.id, c.combination_code INTO combo_id, combo_code_val
    FROM app.home_training_combinations c
    WHERE c.equipment_type = p_equipment_type AND c.training_type = p_training_type;
    
    -- Si no existe la combinación, retornar vacío
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Retornar ejercicios para esa combinación específica
    RETURN QUERY
    SELECT 
        h.exercise_name::TEXT,
        h.exercise_key::TEXT,
        h.times_used::INTEGER,
        h.last_used_at,
        h.user_rating::TEXT,
        combo_code_val::TEXT  -- Use the variable instead of column
    FROM app.home_combination_exercise_history h
    WHERE h.user_id = p_user_id 
      AND h.combination_id = combo_id
    ORDER BY h.times_used DESC, h.last_used_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

SELECT 'Fixed ambiguous column reference in get_exercises_for_combination' AS status;