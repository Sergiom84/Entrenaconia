-- ===============================================
-- FUNCIONES DE INTEGRACIÓN IA-FEEDBACK
-- PROPÓSITO: Funciones específicas para que la IA use el feedback de usuarios
-- COMPATIBILIDAD: Compatible con HomeTrainingRejectionModal y ExerciseFeedbackModal
-- FECHA: 2025-09-14
-- AUTOR: Claude Code - Entrena con IA
-- ===============================================

-- 1. FUNCIÓN PARA OBTENER EJERCICIOS EVITADOS POR METODOLOGÍA
-- Esta función es la que usará la IA para filtrar ejercicios
CREATE OR REPLACE FUNCTION app.get_avoided_exercises_for_ai(
    p_user_id INTEGER,
    p_methodology_type VARCHAR(50),
    p_equipment_type VARCHAR(50) DEFAULT NULL,
    p_training_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    exercise_key VARCHAR(100),
    exercise_name VARCHAR(255),
    avoidance_reason VARCHAR(50),
    avoidance_strength DECIMAL(3,2),
    days_remaining INTEGER,
    user_comment TEXT
) AS $$
BEGIN
    -- Limpiar feedback expirado
    PERFORM app.cleanup_expired_feedback();

    RETURN QUERY
    SELECT
        f.exercise_key,
        f.exercise_name,
        f.feedback_type as avoidance_reason,
        CASE
            WHEN f.feedback_type IN ('dont_like', 'no_equipment') THEN 1.0
            WHEN f.feedback_type = 'too_difficult' THEN 0.8
            WHEN f.feedback_type = 'change_focus' THEN 0.6
            ELSE 0.5
        END as avoidance_strength,
        CASE
            WHEN f.avoidance_expires_at IS NULL THEN -1 -- Permanente
            ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (f.avoidance_expires_at - NOW())) / 86400))::INTEGER
        END as days_remaining,
        f.comment as user_comment
    FROM app.user_exercise_feedback f
    WHERE f.user_id = p_user_id
      AND f.methodology_type = p_methodology_type
      AND f.feedback_type IN ('too_difficult', 'dont_like', 'no_equipment', 'change_focus')
      AND f.is_active = TRUE
      AND (f.avoidance_expires_at IS NULL OR f.avoidance_expires_at > NOW())
      AND (p_equipment_type IS NULL OR f.equipment_type = p_equipment_type)
      AND (p_training_type IS NULL OR f.training_type = p_training_type)
    ORDER BY f.ai_weight DESC, f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. FUNCIÓN PARA OBTENER EJERCICIOS PREFERIDOS POR EL USUARIO
-- Para que la IA priorice ejercicios que le gustan al usuario
CREATE OR REPLACE FUNCTION app.get_preferred_exercises_for_ai(
    p_user_id INTEGER,
    p_methodology_type VARCHAR(50),
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    exercise_key VARCHAR(100),
    exercise_name VARCHAR(255),
    preference_strength DECIMAL(3,2),
    user_comment TEXT,
    usage_frequency INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.exercise_key,
        f.exercise_name,
        f.ai_weight as preference_strength,
        f.comment as user_comment,
        COALESCE(h.usage_count, 0) as usage_frequency
    FROM app.user_exercise_feedback f
    LEFT JOIN (
        SELECT exercise_name, COUNT(*) as usage_count
        FROM app.exercise_history
        WHERE user_id = p_user_id
        GROUP BY exercise_name
    ) h ON f.exercise_name = h.exercise_name
    WHERE f.user_id = p_user_id
      AND f.methodology_type = p_methodology_type
      AND f.feedback_type IN ('love_it', 'too_easy') -- Positivos
      AND f.is_active = TRUE
    ORDER BY f.ai_weight DESC, h.usage_count DESC, f.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 3. FUNCIÓN PARA OBTENER CONTEXTO COMPLETO DE USUARIO PARA IA
-- Función principal que la IA usará para obtener todo el contexto de preferencias
CREATE OR REPLACE FUNCTION app.get_user_ai_context(
    p_user_id INTEGER,
    p_methodology_type VARCHAR(50) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'user_id', p_user_id,
        'methodology_type', p_methodology_type,
        'avoided_exercises', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'exercise_key', exercise_key,
                    'exercise_name', exercise_name,
                    'reason', avoidance_reason,
                    'strength', avoidance_strength,
                    'days_remaining', days_remaining,
                    'comment', user_comment
                )
            ), '[]'::json)
            FROM app.get_avoided_exercises_for_ai(p_user_id, COALESCE(p_methodology_type, 'calistenia'))
        ),
        'preferred_exercises', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'exercise_key', exercise_key,
                    'exercise_name', exercise_name,
                    'strength', preference_strength,
                    'comment', user_comment,
                    'frequency', usage_frequency
                )
            ), '[]'::json)
            FROM app.get_preferred_exercises_for_ai(p_user_id, COALESCE(p_methodology_type, 'calistenia'))
        ),
        'general_preferences', (
            SELECT COALESCE(
                json_build_object(
                    'preferred_methodologies', preferred_methodologies,
                    'focus_areas', focus_areas,
                    'avoided_focus_areas', avoided_focus_areas,
                    'prefers_challenging', prefers_challenging,
                    'progression_style', progression_style,
                    'physical_limitations', physical_limitations,
                    'available_equipment', available_equipment
                ),
                '{}'::json
            )
            FROM app.user_training_preferences
            WHERE user_id = p_user_id
        ),
        'feedback_summary', (
            SELECT json_build_object(
                'total_feedback_count', COUNT(*),
                'negative_feedback_count', SUM(CASE WHEN feedback_type IN ('too_difficult', 'dont_like', 'no_equipment') THEN 1 ELSE 0 END),
                'positive_feedback_count', SUM(CASE WHEN feedback_type IN ('love_it', 'too_easy') THEN 1 ELSE 0 END),
                'most_common_issues', (
                    SELECT json_agg(
                        json_build_object('issue', feedback_type, 'count', issue_count)
                        ORDER BY issue_count DESC
                    )
                    FROM (
                        SELECT feedback_type, COUNT(*) as issue_count
                        FROM app.user_exercise_feedback
                        WHERE user_id = p_user_id
                          AND (p_methodology_type IS NULL OR methodology_type = p_methodology_type)
                          AND is_active = TRUE
                        GROUP BY feedback_type
                        LIMIT 5
                    ) issues
                ),
                'last_feedback_date', MAX(created_at)
            )
            FROM app.user_exercise_feedback
            WHERE user_id = p_user_id
              AND (p_methodology_type IS NULL OR methodology_type = p_methodology_type)
              AND is_active = TRUE
        ),
        'generated_at', NOW()
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCIÓN PARA GUARDAR FEEDBACK DESDE JAVASCRIPT (API)
-- Función optimizada para ser llamada desde el backend de Node.js
CREATE OR REPLACE FUNCTION app.save_user_feedback(
    p_user_id INTEGER,
    p_exercise_name VARCHAR(255),
    p_methodology_type VARCHAR(50),
    p_feedback_type VARCHAR(50),
    p_comment TEXT DEFAULT NULL,
    p_equipment_type VARCHAR(50) DEFAULT NULL,
    p_training_type VARCHAR(50) DEFAULT NULL,
    p_avoidance_days INTEGER DEFAULT NULL,
    p_plan_id INTEGER DEFAULT NULL,
    p_session_id INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    feedback_id INTEGER;
    exercise_key VARCHAR(100);
    result JSON;
BEGIN
    -- Generar exercise_key normalizada
    exercise_key := LOWER(
        REGEXP_REPLACE(
            UNACCENT(p_exercise_name),
            '[^a-z0-9]+',
            '_',
            'g'
        )
    );

    -- Insertar o actualizar feedback
    INSERT INTO app.user_exercise_feedback (
        user_id,
        exercise_name,
        exercise_key,
        methodology_type,
        equipment_type,
        training_type,
        feedback_type,
        feedback_category,
        comment,
        avoidance_duration_days,
        plan_id,
        session_id,
        ai_weight
    ) VALUES (
        p_user_id,
        p_exercise_name,
        exercise_key,
        p_methodology_type,
        p_equipment_type,
        p_training_type,
        p_feedback_type,
        CASE
            WHEN p_feedback_type IN ('too_difficult', 'too_easy') THEN 'difficulty'
            WHEN p_feedback_type IN ('love_it', 'dont_like') THEN 'preference'
            WHEN p_feedback_type = 'no_equipment' THEN 'equipment'
            WHEN p_feedback_type = 'change_focus' THEN 'methodology'
            ELSE 'other'
        END,
        p_comment,
        p_avoidance_days,
        p_plan_id,
        p_session_id,
        CASE
            WHEN p_feedback_type IN ('love_it', 'too_easy') THEN 1.2 -- Peso positivo
            WHEN p_feedback_type IN ('dont_like', 'no_equipment') THEN 1.0 -- Peso normal
            WHEN p_feedback_type = 'too_difficult' THEN 0.8 -- Peso reducido
            ELSE 1.0
        END
    )
    ON CONFLICT (user_id, exercise_key, methodology_type)
    DO UPDATE SET
        feedback_type = EXCLUDED.feedback_type,
        comment = EXCLUDED.comment,
        avoidance_duration_days = EXCLUDED.avoidance_duration_days,
        plan_id = EXCLUDED.plan_id,
        session_id = EXCLUDED.session_id,
        updated_at = NOW()
    RETURNING id INTO feedback_id;

    -- Construir respuesta
    SELECT json_build_object(
        'success', true,
        'feedback_id', feedback_id,
        'exercise_key', exercise_key,
        'message', 'Feedback guardado correctamente',
        'impact', CASE
            WHEN p_feedback_type IN ('dont_like', 'too_difficult', 'no_equipment') THEN
                'Este ejercicio será evitado en futuras generaciones'
            WHEN p_feedback_type = 'love_it' THEN
                'Este ejercicio será priorizado en futuras generaciones'
            ELSE
                'Feedback registrado para mejorar futuras recomendaciones'
        END
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCIÓN PARA COMPATIBILIDAD CON HOME_EXERCISE_REJECTIONS
-- Esta función mantiene la compatibilidad con el HomeTrainingRejectionModal existente
CREATE OR REPLACE FUNCTION app.save_home_training_rejection_compatible(
    p_user_id INTEGER,
    p_rejections JSONB -- Array de objetos de rechazo del HomeTrainingRejectionModal
)
RETURNS JSON AS $$
DECLARE
    rejection JSONB;
    saved_count INTEGER := 0;
    feedback_result JSON;
BEGIN
    -- Procesar cada rechazo del array
    FOR rejection IN SELECT * FROM jsonb_array_elements(p_rejections)
    LOOP
        -- Usar la función de guardado unificado
        SELECT app.save_user_feedback(
            p_user_id,
            (rejection->>'exercise_name')::VARCHAR(255),
            'home_training',
            CASE (rejection->>'rejection_category')::VARCHAR(50)
                WHEN 'too_hard' THEN 'too_difficult'
                WHEN 'dont_like' THEN 'dont_like'
                WHEN 'injury' THEN 'dont_like'
                WHEN 'equipment' THEN 'no_equipment'
                ELSE 'dont_like'
            END,
            (rejection->>'rejection_reason')::TEXT,
            (rejection->>'equipment_type')::VARCHAR(50),
            (rejection->>'training_type')::VARCHAR(50),
            (rejection->>'expires_in_days')::INTEGER
        ) INTO feedback_result;

        saved_count := saved_count + 1;
    END LOOP;

    -- También insertar en la tabla original para mantener compatibilidad total
    INSERT INTO app.home_exercise_rejections (
        user_id, exercise_name, exercise_key, equipment_type, training_type,
        rejection_reason, rejection_category, expires_at
    )
    SELECT
        p_user_id,
        (rejection->>'exercise_name')::VARCHAR(255),
        (rejection->>'exercise_key')::VARCHAR(100),
        (rejection->>'equipment_type')::VARCHAR(50),
        (rejection->>'training_type')::VARCHAR(50),
        (rejection->>'rejection_reason')::TEXT,
        (rejection->>'rejection_category')::VARCHAR(50),
        CASE
            WHEN (rejection->>'expires_in_days')::INTEGER IS NULL THEN NULL
            ELSE NOW() + ((rejection->>'expires_in_days')::INTEGER || ' days')::INTERVAL
        END
    FROM jsonb_array_elements(p_rejections) as rejection
    ON CONFLICT DO NOTHING;

    RETURN json_build_object(
        'success', true,
        'rejections_processed', saved_count,
        'message', 'Rechazos guardados en sistema unificado y tabla de compatibilidad'
    );
END;
$$ LANGUAGE plpgsql;

-- 6. FUNCIÓN DE REPORTING PARA ADMIN
-- Para que puedas ver estadísticas del feedback
CREATE OR REPLACE FUNCTION app.get_feedback_statistics(
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_users_with_feedback INTEGER,
    total_feedback_entries INTEGER,
    most_avoided_exercises TEXT[],
    most_loved_exercises TEXT[],
    feedback_by_methodology JSON,
    feedback_trends JSON
) AS $$
DECLARE
    start_date TIMESTAMP := NOW() - (p_days_back || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(DISTINCT user_id)::INTEGER
         FROM app.user_exercise_feedback
         WHERE created_at >= start_date) as total_users_with_feedback,

        (SELECT COUNT(*)::INTEGER
         FROM app.user_exercise_feedback
         WHERE created_at >= start_date) as total_feedback_entries,

        (SELECT ARRAY_AGG(exercise_name ORDER BY avoid_count DESC)
         FROM (
             SELECT exercise_name, COUNT(*) as avoid_count
             FROM app.user_exercise_feedback
             WHERE feedback_type IN ('dont_like', 'too_difficult', 'no_equipment')
               AND created_at >= start_date
             GROUP BY exercise_name
             ORDER BY avoid_count DESC
             LIMIT 10
         ) avoided) as most_avoided_exercises,

        (SELECT ARRAY_AGG(exercise_name ORDER BY love_count DESC)
         FROM (
             SELECT exercise_name, COUNT(*) as love_count
             FROM app.user_exercise_feedback
             WHERE feedback_type IN ('love_it', 'too_easy')
               AND created_at >= start_date
             GROUP BY exercise_name
             ORDER BY love_count DESC
             LIMIT 10
         ) loved) as most_loved_exercises,

        (SELECT json_object_agg(methodology_type, method_stats)
         FROM (
             SELECT
                 methodology_type,
                 json_build_object(
                     'total_feedback', COUNT(*),
                     'negative_feedback', SUM(CASE WHEN feedback_type IN ('dont_like', 'too_difficult', 'no_equipment') THEN 1 ELSE 0 END),
                     'positive_feedback', SUM(CASE WHEN feedback_type IN ('love_it', 'too_easy') THEN 1 ELSE 0 END)
                 ) as method_stats
             FROM app.user_exercise_feedback
             WHERE created_at >= start_date
             GROUP BY methodology_type
         ) methodology_stats) as feedback_by_methodology,

        (SELECT json_build_object(
             'daily_feedback_count', json_agg(
                 json_build_object('date', feedback_date, 'count', daily_count)
                 ORDER BY feedback_date DESC
             )
         )
         FROM (
             SELECT
                 DATE(created_at) as feedback_date,
                 COUNT(*) as daily_count
             FROM app.user_exercise_feedback
             WHERE created_at >= start_date
             GROUP BY DATE(created_at)
             ORDER BY feedback_date DESC
         ) daily_stats) as feedback_trends;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===============================================

COMMENT ON FUNCTION app.get_avoided_exercises_for_ai IS
'Función principal para que la IA obtenga ejercicios que debe evitar para un usuario específico';

COMMENT ON FUNCTION app.get_user_ai_context IS
'Función completa que devuelve todo el contexto de preferencias de un usuario en formato JSON para la IA';

COMMENT ON FUNCTION app.save_user_feedback IS
'Función optimizada para guardar feedback desde el backend de Node.js con normalización automática';

COMMENT ON FUNCTION app.save_home_training_rejection_compatible IS
'Función de compatibilidad que mantiene el funcionamiento del HomeTrainingRejectionModal existente';

-- ===============================================
-- INSTRUCCIONES DE USO
-- ===============================================

/*
-- Ejemplo de uso desde el backend de Node.js:

// 1. Para guardar feedback general (nuevo ExerciseFeedbackModal)
const result = await pool.query(`
    SELECT app.save_user_feedback($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`, [userId, exerciseName, methodologyType, feedbackType, comment, equipmentType, trainingType, avoidanceDays, planId, sessionId]);

// 2. Para mantener compatibilidad con HomeTrainingRejectionModal (existente)
const result = await pool.query(`
    SELECT app.save_home_training_rejection_compatible($1, $2)
`, [userId, JSON.stringify(rejections)]);

// 3. Para que la IA obtenga contexto de usuario
const userContext = await pool.query(`
    SELECT app.get_user_ai_context($1, $2)
`, [userId, methodologyType]);

// 4. Para obtener ejercicios evitados (para filtrar en generación de IA)
const avoidedExercises = await pool.query(`
    SELECT * FROM app.get_avoided_exercises_for_ai($1, $2, $3, $4)
`, [userId, methodologyType, equipmentType, trainingType]);
*/