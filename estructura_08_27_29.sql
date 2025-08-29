--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.8

-- Started on 2025-08-29 08:27:38

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 26960)
-- Name: app; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA app;


ALTER SCHEMA app OWNER TO postgres;

--
-- TOC entry 402 (class 1255 OID 28286)
-- Name: add_methodology_feedback(integer, integer, character varying, character varying, text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.add_methodology_feedback(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_sentiment character varying DEFAULT NULL::character varying, p_comment text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_session_id INTEGER;
    v_exercise_order INTEGER;
    v_sent TEXT := CASE WHEN p_sentiment IS NULL THEN NULL ELSE lower(p_sentiment) END;
BEGIN
    -- Validación opcional del catálogo de sentiments (NULL permitido)
    IF v_sent IS NOT NULL AND v_sent NOT IN ('love','normal','hard') THEN
        RAISE NOTICE 'Sentiment % inválido. Debe ser love|normal|hard o NULL.', v_sent;
        RETURN FALSE;
    END IF;

    -- Sesión más reciente (del plan y usuario)
    SELECT mes.id
      INTO v_session_id
    FROM app.methodology_exercise_sessions mes
    WHERE mes.user_id = p_user_id
      AND mes.methodology_plan_id = p_methodology_plan_id
    ORDER BY COALESCE(mes.started_at, mes.created_at) DESC
    LIMIT 1;

    IF v_session_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Orden del ejercicio si existe en progreso; si no, 0
    SELECT exercise_order
      INTO v_exercise_order
    FROM app.methodology_exercise_progress
    WHERE methodology_session_id = v_session_id
      AND exercise_name = p_exercise_name
    ORDER BY exercise_order
    LIMIT 1;

    v_exercise_order := COALESCE(v_exercise_order, 0);

    -- Upsert sobre constraint UNIQUE(methodology_session_id, exercise_order)
    INSERT INTO app.methodology_exercise_feedback (
        methodology_session_id,
        user_id,
        exercise_name,
        exercise_order,
        sentiment,
        comment
    ) VALUES (
        v_session_id,
        p_user_id,
        p_exercise_name,
        v_exercise_order,
        v_sent,
        p_comment
    )
    ON CONFLICT ON CONSTRAINT methodology_feedback_unique
    DO UPDATE SET
        sentiment  = EXCLUDED.sentiment,
        comment    = EXCLUDED.comment,
        updated_at = NOW();

    RETURN TRUE;
END;
$$;


ALTER FUNCTION app.add_methodology_feedback(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_sentiment character varying, p_comment text) OWNER TO postgres;

--
-- TOC entry 5895 (class 0 OID 0)
-- Dependencies: 402
-- Name: FUNCTION add_methodology_feedback(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_sentiment character varying, p_comment text); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.add_methodology_feedback(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_sentiment character varying, p_comment text) IS 'Upsert de feedback (sentiment opcional) por sesión+orden de ejercicio en metodologías.';


--
-- TOC entry 377 (class 1255 OID 27540)
-- Name: auto_register_session_activity(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.auto_register_session_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Cuando una sesión se inicia (status cambia a 'in_progress')
    IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
        PERFORM app.register_daily_activity(
            NEW.user_id, 
            NEW.routine_plan_id, 
            'session_start', 
            NEW.id
        );
    END IF;
    
    -- Cuando una sesión se completa
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        PERFORM app.register_daily_activity(
            NEW.user_id, 
            NEW.routine_plan_id, 
            'session_complete', 
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.auto_register_session_activity() OWNER TO postgres;

--
-- TOC entry 374 (class 1255 OID 27533)
-- Name: calculate_current_streak(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.calculate_current_streak(p_user_id integer, p_routine_plan_id integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    streak_count INTEGER := 0;
    current_date_check DATE;
    has_activity BOOLEAN;
BEGIN
    -- Empezar desde hoy y contar hacia atrás
    current_date_check := CURRENT_DATE;
    
    -- Bucle para contar días consecutivos con actividad
    LOOP
        -- Verificar si hay actividad en esta fecha
        SELECT EXISTS(
            SELECT 1 FROM app.user_daily_activity 
            WHERE user_id = p_user_id 
            AND activity_date = current_date_check
            AND (p_routine_plan_id IS NULL OR routine_plan_id = p_routine_plan_id)
            AND activity_type = 'continue_training'
        ) INTO has_activity;
        
        -- Si no hay actividad, terminar el conteo
        IF NOT has_activity THEN
            EXIT;
        END IF;
        
        -- Incrementar contador y retroceder un día
        streak_count := streak_count + 1;
        current_date_check := current_date_check - INTERVAL '1 day';
        
        -- Límite de seguridad para evitar bucles infinitos
        IF streak_count > 365 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN streak_count;
END;
$$;


ALTER FUNCTION app.calculate_current_streak(p_user_id integer, p_routine_plan_id integer) OWNER TO postgres;

--
-- TOC entry 5896 (class 0 OID 0)
-- Dependencies: 374
-- Name: FUNCTION calculate_current_streak(p_user_id integer, p_routine_plan_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.calculate_current_streak(p_user_id integer, p_routine_plan_id integer) IS 'Calcula la racha actual de días consecutivos con actividad';


--
-- TOC entry 375 (class 1255 OID 27703)
-- Name: calculate_daily_macros(integer, date); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.calculate_daily_macros(p_user_id integer, p_date date DEFAULT CURRENT_DATE) RETURNS TABLE(total_calories numeric, total_protein numeric, total_carbs numeric, total_fat numeric, total_fiber numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(SUM(protein), 0) as total_protein,
        COALESCE(SUM(carbs), 0) as total_carbs,
        COALESCE(SUM(fat), 0) as total_fat,
        COALESCE(SUM(fiber), 0) as total_fiber
    FROM app.daily_nutrition_log
    WHERE user_id = p_user_id AND log_date = p_date;
END;
$$;


ALTER FUNCTION app.calculate_daily_macros(p_user_id integer, p_date date) OWNER TO postgres;

--
-- TOC entry 365 (class 1255 OID 27325)
-- Name: can_use_exercise(integer, character varying, character varying); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.can_use_exercise(p_user_id integer, p_exercise_name character varying, p_methodology_type character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    policy_record app.exercise_repetition_policy%ROWTYPE;
    last_usage TIMESTAMP;
    monthly_usage INTEGER;
BEGIN
    -- Obtener política de repetición para la metodología
    SELECT * INTO policy_record
    FROM app.exercise_repetition_policy
    WHERE methodology_type = p_methodology_type;
    
    -- Si no hay política, permitir uso
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar último uso
    SELECT MAX(used_at) INTO last_usage
    FROM app.exercise_history
    WHERE user_id = p_user_id 
        AND exercise_name = p_exercise_name
        AND methodology_type = p_methodology_type;
    
    -- Si nunca se ha usado, permitir
    IF last_usage IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar si han pasado suficientes días
    IF (CURRENT_TIMESTAMP - last_usage) < INTERVAL '1 day' * policy_record.min_days_between_same_exercise THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar uso mensual
    SELECT COUNT(*) INTO monthly_usage
    FROM app.exercise_history
    WHERE user_id = p_user_id 
        AND exercise_name = p_exercise_name
        AND methodology_type = p_methodology_type
        AND used_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days');
    
    IF monthly_usage >= policy_record.max_times_per_month THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION app.can_use_exercise(p_user_id integer, p_exercise_name character varying, p_methodology_type character varying) OWNER TO postgres;

--
-- TOC entry 5897 (class 0 OID 0)
-- Dependencies: 365
-- Name: FUNCTION can_use_exercise(p_user_id integer, p_exercise_name character varying, p_methodology_type character varying); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.can_use_exercise(p_user_id integer, p_exercise_name character varying, p_methodology_type character varying) IS 'Verifica si un ejercicio puede ser usado basado en las políticas de repetición';


--
-- TOC entry 398 (class 1255 OID 28237)
-- Name: consolidate_methodology_exercise_history(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.consolidate_methodology_exercise_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    session_info RECORD;
    feedback_info RECORD;
    v_session_date DATE;
BEGIN
    -- Info de sesión
    SELECT 
        mes.methodology_type, 
        mes.week_number, 
        mes.day_name, 
        mes.started_at,
        mes.methodology_plan_id
    INTO session_info
    FROM app.methodology_exercise_sessions mes
    WHERE mes.id = NEW.methodology_session_id;

    -- Fecha de sesión segura (NOT NULL)
    v_session_date := COALESCE(DATE(session_info.started_at), DATE(NEW.completed_at), CURRENT_DATE);

    -- Feedback (si existe; unique por sesión+orden)
    SELECT f.sentiment, f.comment
    INTO feedback_info
    FROM app.methodology_exercise_feedback f
    WHERE f.methodology_session_id = NEW.methodology_session_id 
      AND f.exercise_order = NEW.exercise_order;

    -- Consolidado (evitar duplicados con UNIQUE)
    INSERT INTO app.methodology_exercise_history_complete (
        user_id,
        methodology_plan_id,
        methodology_session_id,
        exercise_name,
        exercise_order,
        methodology_type,
        series_total,
        series_completed,
        repeticiones,
        intensidad,
        tiempo_dedicado_segundos,
        sentiment,
        user_comment,
        week_number,
        day_name,
        session_date,
        completed_at
    ) VALUES (
        NEW.user_id,
        session_info.methodology_plan_id,
        NEW.methodology_session_id,
        NEW.exercise_name,
        NEW.exercise_order,
        session_info.methodology_type,
        NEW.series_total,
        NEW.series_completed,
        NEW.repeticiones,
        NEW.intensidad,
        NEW.time_spent_seconds,
        feedback_info.sentiment,
        feedback_info.comment,
        session_info.week_number,
        session_info.day_name,
        v_session_date,
        COALESCE(NEW.completed_at, NOW())
    )
    ON CONFLICT ON CONSTRAINT uq_mhistory_unique DO NOTHING;

    RETURN NEW;
END;
$$;


ALTER FUNCTION app.consolidate_methodology_exercise_history() OWNER TO postgres;

--
-- TOC entry 5898 (class 0 OID 0)
-- Dependencies: 398
-- Name: FUNCTION consolidate_methodology_exercise_history(); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.consolidate_methodology_exercise_history() IS 'Inserta en histórico al completar ejercicio, con fecha de sesión segura.';


--
-- TOC entry 399 (class 1255 OID 28233)
-- Name: create_methodology_exercise_sessions(integer, integer, jsonb); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.create_methodology_exercise_sessions(p_user_id integer, p_methodology_plan_id integer, p_plan_data jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    semana_data JSONB;
    sesion_data JSONB;
    semana_num INTEGER;
    ejercicios_count INTEGER;
BEGIN
    -- Idempotencia: eliminar sesiones previas del mismo plan/usuario
    DELETE FROM app.methodology_exercise_sessions 
    WHERE user_id = p_user_id AND methodology_plan_id = p_methodology_plan_id;
    
    -- Semanas
    FOR semana_data IN SELECT jsonb_array_elements(p_plan_data->'semanas')
    LOOP
        semana_num := (semana_data->>'semana')::INTEGER;
        -- Sesiones por semana
        FOR sesion_data IN SELECT jsonb_array_elements(semana_data->'sesiones')
        LOOP
            ejercicios_count := jsonb_array_length(sesion_data->'ejercicios');
            INSERT INTO app.methodology_exercise_sessions (
                user_id,
                methodology_plan_id,
                methodology_type,
                session_name,
                week_number,
                day_name,
                total_exercises,
                exercises_completed,
                session_status
            ) VALUES (
                p_user_id,
                p_methodology_plan_id,
                p_plan_data->>'selected_style',
                CONCAT(p_plan_data->>'selected_style', ' - ', sesion_data->>'dia', ' Semana ', semana_num),
                semana_num,
                sesion_data->>'dia',
                ejercicios_count,
                0,
                'pending'
            );
        END LOOP;
    END LOOP;
END;
$$;


ALTER FUNCTION app.create_methodology_exercise_sessions(p_user_id integer, p_methodology_plan_id integer, p_plan_data jsonb) OWNER TO postgres;

--
-- TOC entry 5899 (class 0 OID 0)
-- Dependencies: 399
-- Name: FUNCTION create_methodology_exercise_sessions(p_user_id integer, p_methodology_plan_id integer, p_plan_data jsonb); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.create_methodology_exercise_sessions(p_user_id integer, p_methodology_plan_id integer, p_plan_data jsonb) IS 'Crea sesiones a partir del plan JSON (semanas/sesiones/ejercicios).';


--
-- TOC entry 368 (class 1255 OID 27441)
-- Name: create_routine_sessions(integer, integer, jsonb); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.create_routine_sessions(p_user_id integer, p_routine_plan_id integer, p_plan_data jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    semana_record JSONB;
    sesion_record JSONB;
    semana_num INTEGER;
    dia_nombre VARCHAR(20);
    session_id INTEGER;
    sessions_created INTEGER := 0;
BEGIN
    -- Iterar sobre las semanas en el plan
    FOR semana_record IN SELECT * FROM jsonb_array_elements(p_plan_data->'semanas')
    LOOP
        semana_num := (semana_record->>'semana')::INTEGER;
        
        -- Iterar sobre las sesiones de la semana
        FOR sesion_record IN SELECT * FROM jsonb_array_elements(semana_record->'sesiones')
        LOOP
            dia_nombre := sesion_record->>'dia';
            
            -- Crear la sesión
            INSERT INTO app.routine_sessions (
                user_id, 
                routine_plan_id, 
                week_number, 
                day_name, 
                exercises_data,
                status
            ) VALUES (
                p_user_id,
                p_routine_plan_id,
                semana_num,
                dia_nombre,
                sesion_record->'ejercicios',
                'pending'
            ) 
            ON CONFLICT (user_id, routine_plan_id, week_number, day_name) 
            DO UPDATE SET 
                exercises_data = EXCLUDED.exercises_data,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id INTO session_id;
            
            -- Crear el progreso de ejercicios para esta sesión
            INSERT INTO app.routine_exercise_progress (
                user_id,
                routine_session_id,
                exercise_order,
                exercise_name,
                series_total,
                status
            )
            SELECT 
                p_user_id,
                session_id,
                (row_number() OVER () - 1)::INTEGER,
                ejercicio->>'nombre',
                (ejercicio->>'series')::INTEGER,
                'pending'
            FROM jsonb_array_elements(sesion_record->'ejercicios') ejercicio
            ON CONFLICT (routine_session_id, exercise_order) DO NOTHING;
            
            sessions_created := sessions_created + 1;
        END LOOP;
    END LOOP;
    
    RETURN sessions_created;
END;
$$;


ALTER FUNCTION app.create_routine_sessions(p_user_id integer, p_routine_plan_id integer, p_plan_data jsonb) OWNER TO postgres;

--
-- TOC entry 5900 (class 0 OID 0)
-- Dependencies: 368
-- Name: FUNCTION create_routine_sessions(p_user_id integer, p_routine_plan_id integer, p_plan_data jsonb); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.create_routine_sessions(p_user_id integer, p_routine_plan_id integer, p_plan_data jsonb) IS 'Crea todas las sesiones y ejercicios para un plan de rutina';


--
-- TOC entry 389 (class 1255 OID 27982)
-- Name: get_combination_usage_stats(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_combination_usage_stats(p_user_id integer) RETURNS TABLE(combination text, total_exercises_used integer, most_used_exercise text, max_usage_count integer, last_training_date timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CONCAT(h.equipment_type, ' + ', h.training_type)::TEXT as combination,
        COUNT(DISTINCT h.exercise_name)::INTEGER as total_exercises_used,
        (SELECT h2.exercise_name FROM app.home_combination_exercise_history h2 
         WHERE h2.user_id = h.user_id AND h2.equipment_type = h.equipment_type 
         AND h2.training_type = h.training_type 
         ORDER BY h2.times_used DESC LIMIT 1)::TEXT as most_used_exercise,
        MAX(h.times_used)::INTEGER as max_usage_count,
        MAX(h.last_used_at) as last_training_date
    FROM app.home_combination_exercise_history h
    WHERE h.user_id = p_user_id
    GROUP BY h.equipment_type, h.training_type, h.user_id
    ORDER BY last_training_date DESC;
END;
$$;


ALTER FUNCTION app.get_combination_usage_stats(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 5901 (class 0 OID 0)
-- Dependencies: 389
-- Name: FUNCTION get_combination_usage_stats(p_user_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_combination_usage_stats(p_user_id integer) IS 'Estadísticas de uso por combinación para un usuario';


--
-- TOC entry 376 (class 1255 OID 27539)
-- Name: get_enhanced_routine_plan_stats(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_enhanced_routine_plan_stats(p_user_id integer, p_routine_plan_id integer) RETURNS TABLE(completed_sessions integer, total_sessions_created integer, completed_exercises integer, total_exercises_attempted integer, total_training_time_minutes integer, total_feedback_given integer, loved_exercises integer, hard_exercises integer, neutral_exercises integer, last_session_date timestamp without time zone, current_streak_days integer, methodology_type character varying, generation_mode character varying, plan_created_at timestamp without time zone, frequency_per_week integer, total_weeks integer, overall_progress_percentage numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ers.completed_sessions::INTEGER,
        ers.total_sessions_created::INTEGER,
        ers.completed_exercises::INTEGER,
        ers.total_exercises_attempted::INTEGER,
        ers.total_training_time_minutes::INTEGER,
        ers.total_feedback_given::INTEGER,
        ers.loved_exercises::INTEGER,
        ers.hard_exercises::INTEGER,
        ers.neutral_exercises::INTEGER,
        ers.last_session_date,
        ers.current_streak_days::INTEGER,
        ers.methodology_type,
        ers.generation_mode,
        ers.plan_created_at,
        ers.frequency_per_week::INTEGER,
        ers.total_weeks::INTEGER,
        ers.overall_progress_percentage
    FROM app.enhanced_routine_stats ers
    WHERE ers.user_id = p_user_id 
    AND ers.routine_plan_id = p_routine_plan_id;
END;
$$;


ALTER FUNCTION app.get_enhanced_routine_plan_stats(p_user_id integer, p_routine_plan_id integer) OWNER TO postgres;

--
-- TOC entry 5902 (class 0 OID 0)
-- Dependencies: 376
-- Name: FUNCTION get_enhanced_routine_plan_stats(p_user_id integer, p_routine_plan_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_enhanced_routine_plan_stats(p_user_id integer, p_routine_plan_id integer) IS 'Obtiene estadísticas completas de un plan de rutina específico';


--
-- TOC entry 387 (class 1255 OID 27980)
-- Name: get_exercises_by_combination(integer, character varying, character varying, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_exercises_by_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer DEFAULT 20) RETURNS TABLE(exercise_name text, exercise_key text, times_used integer, last_used_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    -- Usar la nueva función interna
    RETURN QUERY
    SELECT 
        ef.exercise_name,
        ef.exercise_key,
        ef.times_used,
        ef.last_used_at
    FROM app.get_exercises_for_combination(p_user_id, p_equipment_type, p_training_type, p_limit) ef;
END;
$$;


ALTER FUNCTION app.get_exercises_by_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5903 (class 0 OID 0)
-- Dependencies: 387
-- Name: FUNCTION get_exercises_by_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_exercises_by_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer) IS 'Obtiene ejercicios usados para una combinación específica ordenados por frecuencia';


--
-- TOC entry 392 (class 1255 OID 28008)
-- Name: get_exercises_for_combination(integer, character varying, character varying, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_exercises_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer DEFAULT 50) RETURNS TABLE(exercise_name text, exercise_key text, times_used integer, last_used_at timestamp with time zone, user_rating text, combination_code text)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    combination_record RECORD;
BEGIN
    -- Resolver combinación con alias "c"
    SELECT c.id, c.combination_code
      INTO combination_record
    FROM app.home_training_combinations c
    WHERE c.equipment_type = p_equipment_type 
      AND c.training_type  = p_training_type;

    IF NOT FOUND THEN
        RETURN; -- combinación no definida
    END IF;

    -- Historial acotado a esa combinación (alias "h")
    RETURN QUERY
    SELECT 
        h.exercise_name::TEXT,
        h.exercise_key::TEXT,
        h.times_used::INTEGER,
        h.last_used_at,
        h.user_rating::TEXT,
        h.combination_code::TEXT
    FROM app.home_combination_exercise_history h
    WHERE h.user_id = p_user_id 
      AND h.combination_id = combination_record.id
    ORDER BY h.times_used DESC, h.last_used_at DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION app.get_exercises_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5904 (class 0 OID 0)
-- Dependencies: 392
-- Name: FUNCTION get_exercises_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_exercises_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_limit integer) IS 'Obtiene ejercicios ESPECÍFICOS para una combinación (p. ej., minimo+funcional)';


--
-- TOC entry 372 (class 1255 OID 27480)
-- Name: get_home_context(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_home_context(p_user_id integer) RETURNS TABLE(last_home_plan_id integer, equipment_type character varying, training_type character varying, last_home_plan_created_at timestamp with time zone, last_session_id integer, exercises_completed integer, total_exercises integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH last_plan AS (
    SELECT htp.id, htp.equipment_type, htp.training_type, htp.created_at
    FROM app.home_training_plans htp
    WHERE htp.user_id = p_user_id
    ORDER BY htp.created_at DESC
    LIMIT 1
  ), last_session AS (
    SELECT hts.id, hts.exercises_completed, hts.total_exercises
    FROM app.home_training_sessions hts
    WHERE hts.user_id = p_user_id
    ORDER BY hts.started_at DESC
    LIMIT 1
  )
  SELECT lp.id, lp.equipment_type, lp.training_type, lp.created_at,
         ls.id, COALESCE(ls.exercises_completed,0), COALESCE(ls.total_exercises,0)
  FROM last_plan lp
  LEFT JOIN last_session ls ON TRUE;
END; $$;


ALTER FUNCTION app.get_home_context(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 5905 (class 0 OID 0)
-- Dependencies: 372
-- Name: FUNCTION get_home_context(p_user_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_home_context(p_user_id integer) IS 'Returns last home plan info and last session progress for a user.';


--
-- TOC entry 385 (class 1255 OID 27950)
-- Name: get_home_training_history(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_home_training_history(p_user_id integer, p_limit integer DEFAULT 15) RETURNS TABLE(exercise_name text, exercise_key text, last_used_at timestamp with time zone, times_used integer)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    WITH combined_home AS (
        -- Ejercicios realmente completados (prioridad máxima)
        SELECT 
            h.exercise_name::TEXT,
            h.exercise_key::TEXT,
            h.created_at,
            2 as priority_weight
        FROM app.v_home_hist_real h
        WHERE h.user_id = p_user_id
        
        UNION ALL
        
        -- Ejercicios propuestos en planes (prioridad menor)
        SELECT 
            p.exercise_name::TEXT,
            p.exercise_key::TEXT,
            p.created_at,
            1 as priority_weight
        FROM app.v_home_hist_propuesto p
        WHERE p.user_id = p_user_id
    ),
    aggregated AS (
        SELECT 
            c.exercise_name,
            c.exercise_key,
            MAX(c.created_at) as last_used_at,
            COUNT(*) as times_used,
            MAX(c.priority_weight) as max_priority
        FROM combined_home c
        GROUP BY c.exercise_name, c.exercise_key
    )
    SELECT 
        a.exercise_name,
        a.exercise_key,
        a.last_used_at,
        a.times_used::INTEGER
    FROM aggregated a
    ORDER BY a.max_priority DESC, a.last_used_at DESC, a.times_used DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION app.get_home_training_history(p_user_id integer, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5906 (class 0 OID 0)
-- Dependencies: 385
-- Name: FUNCTION get_home_training_history(p_user_id integer, p_limit integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_home_training_history(p_user_id integer, p_limit integer) IS 'Obtiene historial combinado SOLO de entrenamiento en casa';


--
-- TOC entry 371 (class 1255 OID 27479)
-- Name: get_methodology_context(integer, character varying); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_methodology_context(p_user_id integer, p_methodology_type character varying) RETURNS TABLE(last_plan_id integer, total_weeks integer, frequency_per_week integer, last_plan_created_at timestamp with time zone, recent_exercises integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH last_plan AS (
    SELECT rp.id, rp.total_weeks, rp.frequency_per_week, rp.created_at
    FROM app.routine_plans rp
    WHERE rp.user_id = p_user_id AND rp.methodology_type = p_methodology_type
    ORDER BY rp.created_at DESC
    LIMIT 1
  ), recent AS (
    SELECT COUNT(*)::INT AS cnt
    FROM app.exercise_history eh
    WHERE eh.user_id = p_user_id AND eh.methodology_type = p_methodology_type
      AND eh.used_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
  )
  SELECT lp.id, lp.total_weeks, lp.frequency_per_week, lp.created_at, COALESCE(r.cnt, 0)
  FROM last_plan lp
  CROSS JOIN recent r;
END; $$;


ALTER FUNCTION app.get_methodology_context(p_user_id integer, p_methodology_type character varying) OWNER TO postgres;

--
-- TOC entry 5907 (class 0 OID 0)
-- Dependencies: 371
-- Name: FUNCTION get_methodology_context(p_user_id integer, p_methodology_type character varying); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_methodology_context(p_user_id integer, p_methodology_type character varying) IS 'Returns last routine plan info and recent exercise count for a user in a specific methodology.';


--
-- TOC entry 396 (class 1255 OID 28234)
-- Name: get_methodology_exercise_history(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_methodology_exercise_history(p_user_id integer, p_limit integer DEFAULT 30) RETURNS TABLE(exercise_name character varying, methodology_type character varying, times_used bigint, last_used_at timestamp without time zone, avg_sentiment numeric, last_sentiment character varying)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.exercise_name,
        h.methodology_type,
        COUNT(*)::BIGINT as times_used,
        MAX(h.completed_at) as last_used_at,
        ROUND(AVG(CASE 
            WHEN h.sentiment = 'love'   THEN 3
            WHEN h.sentiment = 'normal' THEN 2  
            WHEN h.sentiment = 'hard'   THEN 1
            ELSE NULL
        END), 2) as avg_sentiment,
        (array_agg(h.sentiment ORDER BY h.completed_at DESC))[1] as last_sentiment
    FROM app.methodology_exercise_history_complete h
    WHERE h.user_id = p_user_id
      AND h.completed_at >= NOW() - INTERVAL '60 days'
    GROUP BY h.exercise_name, h.methodology_type
    ORDER BY MAX(h.completed_at) DESC, COUNT(*) DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION app.get_methodology_exercise_history(p_user_id integer, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5908 (class 0 OID 0)
-- Dependencies: 396
-- Name: FUNCTION get_methodology_exercise_history(p_user_id integer, p_limit integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_methodology_exercise_history(p_user_id integer, p_limit integer) IS 'Agregado de uso por ejercicio/metodología en últimos 60 días.';


--
-- TOC entry 401 (class 1255 OID 28287)
-- Name: get_methodology_stats_quick(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_methodology_stats_quick(p_user_id integer, p_methodology_plan_id integer) RETURNS TABLE(total_sessions integer, completed_sessions integer, total_exercises integer, completed_exercises integer, love_exercises integer, hard_exercises integer, avg_session_duration numeric)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT mes.id AS session_id,
               mes.total_exercises,
               mes.exercises_completed,
               mes.session_status,
               mes.total_duration_seconds
        FROM app.methodology_exercise_sessions mes
        WHERE mes.user_id = p_user_id
          AND mes.methodology_plan_id = p_methodology_plan_id
    ),
    fb AS (
        SELECT f.methodology_session_id AS session_id,
               f.exercise_order,
               f.sentiment
        FROM app.methodology_exercise_feedback f
        JOIN base b ON b.session_id = f.methodology_session_id
    )
    SELECT 
        (SELECT COUNT(*) FROM base)::INTEGER AS total_sessions,
        (SELECT COUNT(*) FROM base WHERE session_status = 'completed')::INTEGER AS completed_sessions,
        COALESCE((SELECT SUM(b.total_exercises) FROM base b), 0)::INTEGER AS total_exercises,
        COALESCE((SELECT SUM(b.exercises_completed) FROM base b), 0)::INTEGER AS completed_exercises,
        -- Contar ejercicios únicos marcados como 'love' por sesión+orden
        COALESCE((
            SELECT COUNT(DISTINCT (session_id, exercise_order)) 
            FROM fb WHERE sentiment = 'love'
        ), 0)::INTEGER AS love_exercises,
        COALESCE((
            SELECT COUNT(DISTINCT (session_id, exercise_order)) 
            FROM fb WHERE sentiment = 'hard'
        ), 0)::INTEGER AS hard_exercises,
        -- Duración media de sesión (min)
        ROUND( (SELECT AVG(NULLIF(b.total_duration_seconds,0)) FROM base b) / 60.0, 2 ) AS avg_session_duration
    ;
END;
$$;


ALTER FUNCTION app.get_methodology_stats_quick(p_user_id integer, p_methodology_plan_id integer) OWNER TO postgres;

--
-- TOC entry 5909 (class 0 OID 0)
-- Dependencies: 401
-- Name: FUNCTION get_methodology_stats_quick(p_user_id integer, p_methodology_plan_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_methodology_stats_quick(p_user_id integer, p_methodology_plan_id integer) IS 'Resumen de sesiones/ejercicios y feedback (sin sobreconteo) + duración media por plan.';


--
-- TOC entry 381 (class 1255 OID 27591)
-- Name: get_or_create_routine_plan(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_or_create_routine_plan(p_methodology_plan_id integer, p_user_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_routine_plan_id INTEGER;
    v_plan_data JSONB;
    v_methodology_type TEXT;
BEGIN
    -- 1. Buscar plan existente
    SELECT rp.id INTO v_routine_plan_id
    FROM app.routine_plans rp
    INNER JOIN app.methodology_plans mp ON mp.user_id = rp.user_id
    WHERE mp.id = p_methodology_plan_id 
    AND mp.user_id = p_user_id 
    AND rp.generation_mode = 'automatic'
    AND rp.created_at >= mp.created_at
    ORDER BY rp.id DESC  -- El más reciente
    LIMIT 1;
    
    -- 2. Si ya existe, devolverlo
    IF v_routine_plan_id IS NOT NULL THEN
        RETURN v_routine_plan_id;
    END IF;
    
    -- 3. Si no existe, crear uno nuevo
    SELECT plan_data INTO v_plan_data
    FROM app.methodology_plans
    WHERE id = p_methodology_plan_id AND user_id = p_user_id;
    
    IF v_plan_data IS NULL THEN
        RAISE EXCEPTION 'Methodology plan % not found for user %', p_methodology_plan_id, p_user_id;
    END IF;
    
    v_methodology_type := COALESCE(v_plan_data->>'selected_style', 'Rutina');
    
    -- 4. Crear nuevo plan
    INSERT INTO app.routine_plans (user_id, methodology_type, plan_data, generation_mode, created_at)
    VALUES (p_user_id, v_methodology_type, v_plan_data, 'automatic', NOW())
    RETURNING id INTO v_routine_plan_id;
    
    RETURN v_routine_plan_id;
END;
$$;


ALTER FUNCTION app.get_or_create_routine_plan(p_methodology_plan_id integer, p_user_id integer) OWNER TO postgres;

--
-- TOC entry 344 (class 1255 OID 27765)
-- Name: get_playlist_track_count(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_playlist_track_count(playlist_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN (
        SELECT jsonb_array_length(tracks)
        FROM app.music_playlists 
        WHERE id = playlist_id
    );
END;
$$;


ALTER FUNCTION app.get_playlist_track_count(playlist_id integer) OWNER TO postgres;

--
-- TOC entry 364 (class 1255 OID 27324)
-- Name: get_recent_exercises(integer, character varying, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_recent_exercises(p_user_id integer, p_methodology_type character varying, p_days_back integer DEFAULT 30) RETURNS TABLE(exercise_name character varying, usage_count bigint, last_used timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        eh.exercise_name,
        COUNT(eh.exercise_name) as usage_count,
        MAX(eh.used_at) as last_used
    FROM app.exercise_history eh
    WHERE eh.user_id = p_user_id 
        AND eh.methodology_type = p_methodology_type
        AND eh.used_at >= (CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days_back)
    GROUP BY eh.exercise_name
    ORDER BY usage_count DESC, last_used DESC;
END;
$$;


ALTER FUNCTION app.get_recent_exercises(p_user_id integer, p_methodology_type character varying, p_days_back integer) OWNER TO postgres;

--
-- TOC entry 5910 (class 0 OID 0)
-- Dependencies: 364
-- Name: FUNCTION get_recent_exercises(p_user_id integer, p_methodology_type character varying, p_days_back integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_recent_exercises(p_user_id integer, p_methodology_type character varying, p_days_back integer) IS 'Obtiene ejercicios recientes de un usuario para una metodología específica';


--
-- TOC entry 386 (class 1255 OID 27951)
-- Name: get_routine_history(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_routine_history(p_user_id integer, p_limit integer DEFAULT 15) RETURNS TABLE(exercise_name text, exercise_key text, last_used_at timestamp with time zone, times_used integer)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    WITH combined_routine AS (
        -- Ejercicios realmente completados (prioridad máxima)
        SELECT 
            r.exercise_name::TEXT,
            r.exercise_key::TEXT,
            r.created_at,
            2 as priority_weight
        FROM app.v_routine_hist_real r
        WHERE r.user_id = p_user_id
        
        UNION ALL
        
        -- Ejercicios propuestos en metodologías (prioridad menor)
        SELECT 
            p.exercise_name::TEXT,
            p.exercise_key::TEXT,
            p.created_at,
            1 as priority_weight
        FROM app.v_routine_hist_propuesto p
        WHERE p.user_id = p_user_id
    ),
    aggregated AS (
        SELECT 
            c.exercise_name,
            c.exercise_key,
            MAX(c.created_at) as last_used_at,
            COUNT(*) as times_used,
            MAX(c.priority_weight) as max_priority
        FROM combined_routine c
        GROUP BY c.exercise_name, c.exercise_key
    )
    SELECT 
        a.exercise_name,
        a.exercise_key,
        a.last_used_at,
        a.times_used::INTEGER
    FROM aggregated a
    ORDER BY a.max_priority DESC, a.last_used_at DESC, a.times_used DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION app.get_routine_history(p_user_id integer, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5911 (class 0 OID 0)
-- Dependencies: 386
-- Name: FUNCTION get_routine_history(p_user_id integer, p_limit integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_routine_history(p_user_id integer, p_limit integer) IS 'Obtiene historial combinado SOLO de rutinas y metodologías';


--
-- TOC entry 339 (class 1255 OID 27440)
-- Name: get_routine_progress(integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_routine_progress(p_user_id integer, p_routine_plan_id integer) RETURNS TABLE(total_sessions integer, completed_sessions integer, in_progress_sessions integer, total_exercises integer, completed_exercises integer, current_week integer, current_day character varying, overall_percentage numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH session_stats AS (
        SELECT 
            COUNT(*) as total_sess,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sess,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_sess
        FROM app.routine_sessions
        WHERE user_id = p_user_id AND routine_plan_id = p_routine_plan_id
    ),
    exercise_stats AS (
        SELECT 
            COUNT(*) as total_ex,
            COUNT(CASE WHEN rep.status = 'completed' THEN 1 END) as completed_ex
        FROM app.routine_sessions rs
        JOIN app.routine_exercise_progress rep ON rs.id = rep.routine_session_id
        WHERE rs.user_id = p_user_id AND rs.routine_plan_id = p_routine_plan_id
    ),
    current_progress AS (
        SELECT 
            rs.week_number,
            rs.day_name
        FROM app.routine_sessions rs
        WHERE rs.user_id = p_user_id 
            AND rs.routine_plan_id = p_routine_plan_id
            AND rs.status IN ('in_progress', 'pending')
        ORDER BY rs.week_number, rs.session_date
        LIMIT 1
    )
    SELECT 
        ss.total_sess::INTEGER,
        ss.completed_sess::INTEGER,
        ss.in_progress_sess::INTEGER,
        COALESCE(es.total_ex, 0)::INTEGER,
        COALESCE(es.completed_ex, 0)::INTEGER,
        COALESCE(cp.week_number, 1)::INTEGER,
        COALESCE(cp.day_name, 'Lun')::VARCHAR,
        CASE 
            WHEN ss.total_sess > 0 THEN 
                ROUND((ss.completed_sess::DECIMAL / ss.total_sess::DECIMAL) * 100, 2)
            ELSE 0.00
        END::DECIMAL
    FROM session_stats ss
    CROSS JOIN exercise_stats es
    CROSS JOIN current_progress cp;
END;
$$;


ALTER FUNCTION app.get_routine_progress(p_user_id integer, p_routine_plan_id integer) OWNER TO postgres;

--
-- TOC entry 5912 (class 0 OID 0)
-- Dependencies: 339
-- Name: FUNCTION get_routine_progress(p_user_id integer, p_routine_plan_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_routine_progress(p_user_id integer, p_routine_plan_id integer) IS 'Calcula el progreso general de una rutina específica';


--
-- TOC entry 395 (class 1255 OID 28010)
-- Name: get_user_combination_stats(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_user_combination_stats(p_user_id integer) RETURNS TABLE(combination_code text, display_name text, total_exercises_used integer, most_used_exercise text, favorite_exercises text[], difficult_exercises text[], last_training_date timestamp with time zone, total_sessions integer)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.combination_code::TEXT,
        c.display_name::TEXT,
        COUNT(DISTINCT h.exercise_name)::INTEGER AS total_exercises_used,
        (
          SELECT h2.exercise_name 
          FROM app.home_combination_exercise_history h2 
          WHERE h2.user_id = p_user_id AND h2.combination_id = c.id 
          ORDER BY h2.times_used DESC, h2.last_used_at DESC
          LIMIT 1
        )::TEXT AS most_used_exercise,
        ARRAY(
          SELECT h3.exercise_name 
          FROM app.home_combination_exercise_history h3 
          WHERE h3.user_id = p_user_id AND h3.combination_id = c.id AND h3.user_rating = 'love'
        ) AS favorite_exercises,
        ARRAY(
          SELECT h4.exercise_name 
          FROM app.home_combination_exercise_history h4 
          WHERE h4.user_id = p_user_id AND h4.combination_id = c.id AND h4.user_rating = 'hard'
        ) AS difficult_exercises,
        MAX(h.last_used_at) AS last_training_date,
        COUNT(DISTINCT h.session_id)::INTEGER AS total_sessions
    FROM app.home_training_combinations c
    LEFT JOIN app.home_combination_exercise_history h 
      ON c.id = h.combination_id AND h.user_id = p_user_id
    WHERE EXISTS (
      SELECT 1 FROM app.home_combination_exercise_history h5 
      WHERE h5.user_id = p_user_id AND h5.combination_id = c.id
    )
    GROUP BY c.id, c.combination_code, c.display_name
    ORDER BY last_training_date DESC NULLS LAST;
END;
$$;


ALTER FUNCTION app.get_user_combination_stats(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 5913 (class 0 OID 0)
-- Dependencies: 395
-- Name: FUNCTION get_user_combination_stats(p_user_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.get_user_combination_stats(p_user_id integer) IS 'Estadísticas por combinación del usuario (sesiones, favoritos, etc.)';


--
-- TOC entry 378 (class 1255 OID 27573)
-- Name: get_user_methodology_recommendations(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_user_methodology_recommendations(p_user_id integer) RETURNS TABLE(user_id integer, nivel_calculado text, anos_experiencia integer, version_recomendada text, semanas_recomendadas integer, razon_recomendacion text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_user_id,
        vump.nivel_calculado,
        vump.anos_entrenamiento_normalizado,
        vump.version_recomendada,
        vump.semanas_recomendadas,
        CASE 
            WHEN vump.nivel_calculado = 'principiante' THEN 
                'Recomendamos versión adaptada con progresión gradual para construir una base sólida'
            WHEN vump.nivel_calculado = 'intermedio' THEN 
                'Versión estricta apropiada con supervisión de la intensidad'
            ELSE 
                'Versión estricta recomendada con foco en optimización del rendimiento'
        END as razon_recomendacion
    FROM app.v_user_methodology_profile vump
    WHERE vump.id = p_user_id;
END;
$$;


ALTER FUNCTION app.get_user_methodology_recommendations(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 391 (class 1255 OID 28099)
-- Name: get_user_personalized_equipment(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_user_personalized_equipment(p_user_id integer) RETURNS TABLE(equipment_name text, equipment_key text, category text, attributes jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT e.equipment_name::TEXT, e.equipment_key::TEXT, e.category::TEXT, e.attributes
  FROM app.user_personalized_equipment e
  WHERE e.user_id = p_user_id AND e.is_active = TRUE
  ORDER BY e.equipment_name;
END;
$$;


ALTER FUNCTION app.get_user_personalized_equipment(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 379 (class 1255 OID 27704)
-- Name: get_weekly_nutrition_stats(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.get_weekly_nutrition_stats(p_user_id integer) RETURNS TABLE(days_logged integer, avg_calories numeric, avg_protein numeric, avg_carbs numeric, avg_fat numeric, consistency_percentage integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as days_logged,
        COALESCE(AVG(calories), 0) as avg_calories,
        COALESCE(AVG(protein), 0) as avg_protein,
        COALESCE(AVG(carbs), 0) as avg_carbs,
        COALESCE(AVG(fat), 0) as avg_fat,
        ROUND(AVG(CASE WHEN calories > 0 THEN 100 ELSE 0 END))::INTEGER as consistency_percentage
    FROM app.daily_nutrition_log
    WHERE user_id = p_user_id 
    AND log_date >= CURRENT_DATE - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION app.get_weekly_nutrition_stats(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 384 (class 1255 OID 27874)
-- Name: increment_exercise_request_count(text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.increment_exercise_request_count(exercise_name_param text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE app.exercise_ai_info 
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE exercise_name = exercise_name_param 
       OR exercise_name_normalized = app.normalize_exercise_name(exercise_name_param);
END;
$$;


ALTER FUNCTION app.increment_exercise_request_count(exercise_name_param text) OWNER TO postgres;

--
-- TOC entry 350 (class 1255 OID 27931)
-- Name: increment_template_usage(character varying, character varying); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.increment_template_usage(p_equipment_type character varying, p_training_type character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE app.home_training_templates 
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE equipment_type = p_equipment_type 
      AND training_type = p_training_type
      AND is_active = true;
END;
$$;


ALTER FUNCTION app.increment_template_usage(p_equipment_type character varying, p_training_type character varying) OWNER TO postgres;

--
-- TOC entry 382 (class 1255 OID 27861)
-- Name: normalize_exercise_name(text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.normalize_exercise_name(input_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN LOWER(
        TRIM(
            REGEXP_REPLACE(
                TRANSLATE(
                    input_name, 
                    'áéíóúàèìòùâêîôûäëïöüçñÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÇÑ', 
                    'aeiouaeiouaeiouaeioucnaeiouaeiouaeiouaeioucn'
                ), 
                '[^a-z0-9\s]', '', 'g'
            )
        )
    );
END;
$$;


ALTER FUNCTION app.normalize_exercise_name(input_name text) OWNER TO postgres;

--
-- TOC entry 388 (class 1255 OID 27981)
-- Name: register_combination_exercise_usage(integer, character varying, character varying, character varying, integer, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.register_combination_exercise_usage(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer DEFAULT NULL::integer, p_plan_id integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    exercise_key_normalized VARCHAR(255);
BEGIN
    -- Normalizar nombre del ejercicio a clave
    exercise_key_normalized := lower(regexp_replace(p_exercise_name, '[^a-z0-9]+', '_', 'g'));
    
    -- Insertar o actualizar contador de uso
    INSERT INTO app.home_combination_exercise_history 
    (user_id, equipment_type, training_type, exercise_name, exercise_key, 
     times_used, last_used_at, session_id, plan_id, updated_at)
    VALUES 
    (p_user_id, p_equipment_type, p_training_type, p_exercise_name, 
     exercise_key_normalized, 1, NOW(), p_session_id, p_plan_id, NOW())
    ON CONFLICT (user_id, equipment_type, training_type, exercise_name)
    DO UPDATE SET
        times_used = app.home_combination_exercise_history.times_used + 1,
        last_used_at = NOW(),
        updated_at = NOW(),
        session_id = COALESCE(p_session_id, app.home_combination_exercise_history.session_id),
        plan_id = COALESCE(p_plan_id, app.home_combination_exercise_history.plan_id);
END;
$$;


ALTER FUNCTION app.register_combination_exercise_usage(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer, p_plan_id integer) OWNER TO postgres;

--
-- TOC entry 5914 (class 0 OID 0)
-- Dependencies: 388
-- Name: FUNCTION register_combination_exercise_usage(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer, p_plan_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.register_combination_exercise_usage(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer, p_plan_id integer) IS 'Registra el uso de un ejercicio en una combinación específica';


--
-- TOC entry 373 (class 1255 OID 27532)
-- Name: register_daily_activity(integer, integer, character varying, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.register_daily_activity(p_user_id integer, p_routine_plan_id integer DEFAULT NULL::integer, p_activity_type character varying DEFAULT 'continue_training'::character varying, p_session_id integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO app.user_daily_activity (
        user_id,
        routine_plan_id,
        activity_type,
        session_id,
        activity_date
    ) VALUES (
        p_user_id,
        p_routine_plan_id,
        p_activity_type,
        p_session_id,
        CURRENT_DATE
    )
    ON CONFLICT (user_id, routine_plan_id, activity_date, activity_type) 
    DO UPDATE SET 
        session_id = COALESCE(EXCLUDED.session_id, app.user_daily_activity.session_id),
        created_at = CURRENT_TIMESTAMP;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION app.register_daily_activity(p_user_id integer, p_routine_plan_id integer, p_activity_type character varying, p_session_id integer) OWNER TO postgres;

--
-- TOC entry 5915 (class 0 OID 0)
-- Dependencies: 373
-- Name: FUNCTION register_daily_activity(p_user_id integer, p_routine_plan_id integer, p_activity_type character varying, p_session_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.register_daily_activity(p_user_id integer, p_routine_plan_id integer, p_activity_type character varying, p_session_id integer) IS 'Registra que el usuario ha tenido actividad en un día específico';


--
-- TOC entry 394 (class 1255 OID 28009)
-- Name: register_exercise_for_combination(integer, character varying, character varying, character varying, integer, integer, character varying); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.register_exercise_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer DEFAULT NULL::integer, p_plan_id integer DEFAULT NULL::integer, p_user_rating character varying DEFAULT NULL::character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    combination_record RECORD;
    exercise_key_normalized VARCHAR(255);
BEGIN
    -- Resolver combinación con alias "c"
    SELECT c.id, c.combination_code
      INTO combination_record
    FROM app.home_training_combinations c
    WHERE c.equipment_type = p_equipment_type 
      AND c.training_type  = p_training_type;

    IF NOT FOUND THEN
        RETURN FALSE; -- combinación no definida
    END IF;

    -- Clave normalizada del ejercicio
    exercise_key_normalized := lower(regexp_replace(p_exercise_name, '[^a-z0-9]+', '_', 'g'));

    -- Upsert aislado por (user_id, combination_id, exercise_key)
    INSERT INTO app.home_combination_exercise_history 
      (user_id, combination_id, combination_code, exercise_name, exercise_key, 
       times_used, last_used_at, session_id, plan_id, user_rating, updated_at)
    VALUES 
      (p_user_id, combination_record.id, combination_record.combination_code, 
       p_exercise_name, exercise_key_normalized, 
       1, NOW(), p_session_id, p_plan_id, p_user_rating, NOW())
    ON CONFLICT (user_id, combination_id, exercise_key)
    DO UPDATE SET
      times_used = app.home_combination_exercise_history.times_used + 1,
      last_used_at = NOW(),
      updated_at   = NOW(),
      session_id = COALESCE(p_session_id, app.home_combination_exercise_history.session_id),
      plan_id    = COALESCE(p_plan_id,    app.home_combination_exercise_history.plan_id),
      user_rating= COALESCE(p_user_rating,app.home_combination_exercise_history.user_rating);

    RETURN TRUE;
END;
$$;


ALTER FUNCTION app.register_exercise_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer, p_plan_id integer, p_user_rating character varying) OWNER TO postgres;

--
-- TOC entry 5916 (class 0 OID 0)
-- Dependencies: 394
-- Name: FUNCTION register_exercise_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer, p_plan_id integer, p_user_rating character varying); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.register_exercise_for_combination(p_user_id integer, p_equipment_type character varying, p_training_type character varying, p_exercise_name character varying, p_session_id integer, p_plan_id integer, p_user_rating character varying) IS 'Registra/actualiza uso de ejercicio en una combinación específica (por exercise_key)';


--
-- TOC entry 366 (class 1255 OID 27326)
-- Name: register_plan_exercises(integer, character varying, jsonb, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.register_plan_exercises(p_user_id integer, p_methodology_type character varying, p_plan_data jsonb, p_plan_id integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    semana_record JSONB;
    sesion_record JSONB;
    ejercicio_record JSONB;
    semana_num INTEGER;
    dia_nombre VARCHAR(20);
BEGIN
    -- Iterar sobre las semanas en el plan
    FOR semana_record IN SELECT * FROM jsonb_array_elements(p_plan_data->'semanas')
    LOOP
        semana_num := (semana_record->>'semana')::INTEGER;
        
        -- Iterar sobre las sesiones de la semana
        FOR sesion_record IN SELECT * FROM jsonb_array_elements(semana_record->'sesiones')
        LOOP
            dia_nombre := sesion_record->>'dia';
            
            -- Iterar sobre los ejercicios de la sesión
            FOR ejercicio_record IN SELECT * FROM jsonb_array_elements(sesion_record->'ejercicios')
            LOOP
                INSERT INTO app.exercise_history (
                    user_id, 
                    exercise_name, 
                    methodology_type, 
                    plan_id, 
                    week_number, 
                    day_name
                ) VALUES (
                    p_user_id,
                    ejercicio_record->>'nombre',
                    p_methodology_type,
                    p_plan_id,
                    semana_num,
                    dia_nombre
                ) ON CONFLICT (user_id, exercise_name, plan_id, week_number, day_name) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;


ALTER FUNCTION app.register_plan_exercises(p_user_id integer, p_methodology_type character varying, p_plan_data jsonb, p_plan_id integer) OWNER TO postgres;

--
-- TOC entry 5917 (class 0 OID 0)
-- Dependencies: 366
-- Name: FUNCTION register_plan_exercises(p_user_id integer, p_methodology_type character varying, p_plan_data jsonb, p_plan_id integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.register_plan_exercises(p_user_id integer, p_methodology_type character varying, p_plan_data jsonb, p_plan_id integer) IS 'Registra todos los ejercicios de un plan generado en el historial';


--
-- TOC entry 403 (class 1255 OID 28343)
-- Name: routine_sessions_recalc_totals(integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.routine_sessions_recalc_totals(p_session_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- total_exercises a partir de exercises_data
  UPDATE app.routine_sessions s
  SET total_exercises = COALESCE(
    CASE
      WHEN jsonb_typeof(s.exercises_data::jsonb) = 'array'
        THEN jsonb_array_length(s.exercises_data::jsonb)
      ELSE 0
    END, 0)
  WHERE s.id = p_session_id;

  -- exercises_completed a partir de routine_exercise_progress
  UPDATE app.routine_sessions s
  SET exercises_completed = COALESCE((
    SELECT COUNT(*)::INT
    FROM app.routine_exercise_progress p
    WHERE p.routine_session_id = p_session_id
      AND p.status = 'completed'
  ), 0)
  WHERE s.id = p_session_id;
END;
$$;


ALTER FUNCTION app.routine_sessions_recalc_totals(p_session_id integer) OWNER TO postgres;

--
-- TOC entry 355 (class 1255 OID 27260)
-- Name: save_body_composition(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.save_body_composition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            IF (OLD.grasa_corporal IS DISTINCT FROM NEW.grasa_corporal) OR 
               (OLD.masa_muscular IS DISTINCT FROM NEW.masa_muscular) OR 
               (OLD.agua_corporal IS DISTINCT FROM NEW.agua_corporal) OR 
               (OLD.metabolismo_basal IS DISTINCT FROM NEW.metabolismo_basal) THEN
                
                INSERT INTO app.body_composition_history (
                    user_id, peso, grasa_corporal, masa_muscular, agua_corporal, 
                    metabolismo_basal, cintura, cuello, calculation_method, notes
                ) VALUES (
                    NEW.id, NEW.peso, NEW.grasa_corporal, NEW.masa_muscular, 
                    NEW.agua_corporal, NEW.metabolismo_basal, NEW.cintura, NEW.cuello,
                    'us_navy', 'Actualización automática desde calculadora'
                );
            END IF;
            
            RETURN NEW;
        END;
        $$;


ALTER FUNCTION app.save_body_composition() OWNER TO postgres;

--
-- TOC entry 345 (class 1255 OID 27766)
-- Name: search_playlists_by_name(integer, text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.search_playlists_by_name(p_user_id integer, search_term text) RETURNS TABLE(id integer, name character varying, track_count integer, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mp.id,
        mp.name,
        jsonb_array_length(mp.tracks)::INTEGER as track_count,
        mp.created_at,
        mp.updated_at
    FROM app.music_playlists mp
    WHERE mp.user_id = p_user_id
      AND LOWER(mp.name) LIKE LOWER('%' || search_term || '%')
    ORDER BY mp.updated_at DESC;
END;
$$;


ALTER FUNCTION app.search_playlists_by_name(p_user_id integer, search_term text) OWNER TO postgres;

--
-- TOC entry 347 (class 1255 OID 26961)
-- Name: set_timestamp(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION app.set_timestamp() OWNER TO postgres;

--
-- TOC entry 362 (class 1255 OID 28029)
-- Name: set_updated_at(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END; $$;


ALTER FUNCTION app.set_updated_at() OWNER TO postgres;

--
-- TOC entry 400 (class 1255 OID 28285)
-- Name: sync_routine_to_methodology_progress(integer, integer, character varying, integer, character varying, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.sync_routine_to_methodology_progress(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_series_completed integer, p_status character varying, p_time_spent_seconds integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_session_id INTEGER;
    v_progress_id INTEGER;
    v_series_total INTEGER;
    v_order INTEGER;
    v_status TEXT := lower(p_status);
BEGIN
    -- Validar estado permitido por methodology_exercise_progress.status
    IF v_status NOT IN ('pending','in_progress','completed','skipped','cancelled') THEN
        RAISE NOTICE 'Estado % inválido para methodology_exercise_progress', v_status;
        RETURN FALSE;
    END IF;

    -- Buscar sesión de metodología activa
    SELECT id INTO v_session_id
    FROM app.methodology_exercise_sessions
    WHERE user_id = p_user_id
      AND methodology_plan_id = p_methodology_plan_id
      AND session_status IN ('pending', 'in_progress')
    ORDER BY COALESCE(started_at, created_at) DESC
    LIMIT 1;

    IF v_session_id IS NULL THEN
        -- No hay sesión activa para sincronizar
        RETURN FALSE;
    END IF;

    -- Buscar progreso existente
    SELECT id, series_total
      INTO v_progress_id, v_series_total
    FROM app.methodology_exercise_progress
    WHERE methodology_session_id = v_session_id
      AND user_id = p_user_id
      AND exercise_name = p_exercise_name
    LIMIT 1;

    IF v_progress_id IS NULL THEN
        -- Asignar el siguiente exercise_order disponible
        SELECT COALESCE(MAX(exercise_order) + 1, 0)
          INTO v_order
        FROM app.methodology_exercise_progress
        WHERE methodology_session_id = v_session_id;

        -- Fijar un series_total mínimo coherente con p_series_completed
        v_series_total := GREATEST(COALESCE(p_series_completed,0), 1);

        INSERT INTO app.methodology_exercise_progress (
            methodology_session_id,
            user_id,
            exercise_name,
            exercise_order,
            series_total,
            repeticiones,
            descanso_seg,
            intensidad,
            series_completed,
            status,
            time_spent_seconds,
            started_at,
            completed_at
        ) VALUES (
            v_session_id,
            p_user_id,
            p_exercise_name,
            v_order,
            v_series_total,
            '8-10',      -- por defecto
            90,          -- por defecto
            'RPE 8',     -- por defecto
            LEAST(GREATEST(COALESCE(p_series_completed,0), 0), v_series_total),
            v_status,
            p_time_spent_seconds,
            CASE WHEN v_status IN ('in_progress','completed') THEN NOW() ELSE NULL END,
            CASE WHEN v_status = 'completed' THEN NOW() ELSE NULL END
        );
    ELSE
        -- Clamp de series_completed al rango [0, series_total]
        UPDATE app.methodology_exercise_progress
        SET series_completed   = LEAST(GREATEST(COALESCE(p_series_completed,0), 0), series_total),
            status             = v_status,
            time_spent_seconds = COALESCE(p_time_spent_seconds, time_spent_seconds),
            started_at         = CASE 
                                   WHEN v_status IN ('in_progress','completed') AND started_at IS NULL 
                                   THEN NOW() 
                                   ELSE started_at 
                                 END,
            completed_at       = CASE 
                                   WHEN v_status = 'completed' AND completed_at IS NULL 
                                   THEN NOW() 
                                   ELSE completed_at 
                                 END,
            updated_at         = NOW()
        WHERE id = v_progress_id;
    END IF;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION app.sync_routine_to_methodology_progress(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_series_completed integer, p_status character varying, p_time_spent_seconds integer) OWNER TO postgres;

--
-- TOC entry 5918 (class 0 OID 0)
-- Dependencies: 400
-- Name: FUNCTION sync_routine_to_methodology_progress(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_series_completed integer, p_status character varying, p_time_spent_seconds integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.sync_routine_to_methodology_progress(p_user_id integer, p_methodology_plan_id integer, p_exercise_name character varying, p_series_completed integer, p_status character varying, p_time_spent_seconds integer) IS 'Sincroniza progreso de rutinas al sistema de metodologías; valida estado y respeta constraints.';


--
-- TOC entry 348 (class 1255 OID 27047)
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION app.tg_set_updated_at() OWNER TO postgres;

--
-- TOC entry 405 (class 1255 OID 28346)
-- Name: trg_progress_update_session_counters(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.trg_progress_update_session_counters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sess_id INT;
  v_delta   INT := 0;
BEGIN
  v_sess_id := COALESCE(NEW.routine_session_id, OLD.routine_session_id);

  -- Si el estado pasó a 'completed' y antes no lo estaba -> +1
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'completed' THEN
      v_delta := 1;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
      v_delta := 1;
    ELSIF OLD.status = 'completed' AND (NEW.status IS DISTINCT FROM 'completed') THEN
      v_delta := -1;
    ELSE
      v_delta := 0;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'completed' THEN
      v_delta := -1;
    END IF;
  END IF;

  IF v_delta <> 0 THEN
    UPDATE app.routine_sessions s
    SET exercises_completed = GREATEST(0, COALESCE(s.exercises_completed,0) + v_delta),
        updated_at = NOW()
    WHERE s.id = v_sess_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION app.trg_progress_update_session_counters() OWNER TO postgres;

--
-- TOC entry 404 (class 1255 OID 28344)
-- Name: trg_routine_sessions_exercises_data_changed(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.trg_routine_sessions_exercises_data_changed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Sólo recalcular si realmente cambió exercises_data
  IF (TG_OP = 'INSERT') OR (NEW.exercises_data IS DISTINCT FROM OLD.exercises_data) THEN
    PERFORM app.routine_sessions_recalc_totals(NEW.id);
    -- Mantener updated_at si existe
    BEGIN
      NEW.updated_at := NOW();
    EXCEPTION WHEN OTHERS THEN
      -- ignorar si no existe la columna
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION app.trg_routine_sessions_exercises_data_changed() OWNER TO postgres;

--
-- TOC entry 393 (class 1255 OID 28011)
-- Name: trigger_update_12_combinations_history(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.trigger_update_12_combinations_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    plan_info RECORD;
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        SELECT 
            hts.user_id,
            htp.equipment_type,
            htp.training_type,
            htp.id AS plan_id,
            hts.id AS session_id
        INTO plan_info
        FROM app.home_training_sessions hts
        JOIN app.home_training_plans    htp ON hts.home_training_plan_id = htp.id
        WHERE hts.id = NEW.home_training_session_id;

        IF FOUND THEN
            PERFORM app.register_exercise_for_combination(
                plan_info.user_id,
                plan_info.equipment_type,
                plan_info.training_type,
                NEW.exercise_name,
                plan_info.session_id,
                plan_info.plan_id,
                NULL  -- rating se captura aparte por feedback
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION app.trigger_update_12_combinations_history() OWNER TO postgres;

--
-- TOC entry 390 (class 1255 OID 27988)
-- Name: trigger_update_combination_history(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.trigger_update_combination_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    plan_info RECORD;
    user_id_val INTEGER;
BEGIN
    -- Solo procesar cuando se completa un ejercicio
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Obtener información del plan asociado a la sesión
        SELECT 
            hts.user_id,
            htp.equipment_type,
            htp.training_type,
            htp.id as plan_id
        INTO plan_info
        FROM app.home_training_sessions hts
        JOIN app.home_training_plans htp ON hts.home_training_plan_id = htp.id
        WHERE hts.id = NEW.home_training_session_id;
        
        -- Si encontramos la información del plan, registrar el uso
        IF FOUND THEN
            PERFORM app.register_combination_exercise_usage(
                plan_info.user_id,
                plan_info.equipment_type,
                plan_info.training_type,
                NEW.exercise_name,
                NEW.home_training_session_id,
                plan_info.plan_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.trigger_update_combination_history() OWNER TO postgres;

--
-- TOC entry 337 (class 1255 OID 27707)
-- Name: update_daily_nutrition_log_updated_at(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_daily_nutrition_log_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_daily_nutrition_log_updated_at() OWNER TO postgres;

--
-- TOC entry 383 (class 1255 OID 27870)
-- Name: update_exercise_name_row(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_exercise_name_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.exercise_name_normalized := app.normalize_exercise_name(NEW.exercise_name);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_exercise_name_row() OWNER TO postgres;

--
-- TOC entry 397 (class 1255 OID 28235)
-- Name: update_methodology_session_progress(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_methodology_session_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE app.methodology_exercise_sessions 
    SET 
        exercises_completed = (
            SELECT COUNT(*) 
            FROM app.methodology_exercise_progress 
            WHERE methodology_session_id = NEW.methodology_session_id 
              AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.methodology_session_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_methodology_session_progress() OWNER TO postgres;

--
-- TOC entry 5919 (class 0 OID 0)
-- Dependencies: 397
-- Name: FUNCTION update_methodology_session_progress(); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.update_methodology_session_progress() IS 'Sincroniza ejercicios completados en la sesión tras marcar un ejercicio como completed.';


--
-- TOC entry 343 (class 1255 OID 27763)
-- Name: update_music_playlists_updated_at(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_music_playlists_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_music_playlists_updated_at() OWNER TO postgres;

--
-- TOC entry 380 (class 1255 OID 27705)
-- Name: update_nutrition_plans_updated_at(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_nutrition_plans_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_nutrition_plans_updated_at() OWNER TO postgres;

--
-- TOC entry 367 (class 1255 OID 27327)
-- Name: update_policy_timestamp(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_policy_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_policy_timestamp() OWNER TO postgres;

--
-- TOC entry 369 (class 1255 OID 27442)
-- Name: update_routine_exercise_progress(integer, integer, integer, character varying, integer); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_routine_exercise_progress(p_routine_session_id integer, p_exercise_order integer, p_series_completed integer, p_status character varying DEFAULT NULL::character varying, p_time_spent integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_status VARCHAR;
BEGIN
    -- Obtener estado actual
    SELECT status INTO current_status 
    FROM app.routine_exercise_progress 
    WHERE routine_session_id = p_routine_session_id 
        AND exercise_order = p_exercise_order;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Actualizar progreso
    UPDATE app.routine_exercise_progress 
    SET 
        series_completed = GREATEST(series_completed, p_series_completed),
        status = COALESCE(p_status, status),
        time_spent_seconds = COALESCE(p_time_spent, time_spent_seconds),
        started_at = CASE 
            WHEN started_at IS NULL AND p_status IN ('in_progress', 'completed') 
            THEN CURRENT_TIMESTAMP 
            ELSE started_at 
        END,
        completed_at = CASE 
            WHEN p_status = 'completed' 
            THEN CURRENT_TIMESTAMP 
            ELSE completed_at 
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE routine_session_id = p_routine_session_id 
        AND exercise_order = p_exercise_order;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION app.update_routine_exercise_progress(p_routine_session_id integer, p_exercise_order integer, p_series_completed integer, p_status character varying, p_time_spent integer) OWNER TO postgres;

--
-- TOC entry 5920 (class 0 OID 0)
-- Dependencies: 369
-- Name: FUNCTION update_routine_exercise_progress(p_routine_session_id integer, p_exercise_order integer, p_series_completed integer, p_status character varying, p_time_spent integer); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.update_routine_exercise_progress(p_routine_session_id integer, p_exercise_order integer, p_series_completed integer, p_status character varying, p_time_spent integer) IS 'Actualiza el progreso de un ejercicio específico';


--
-- TOC entry 370 (class 1255 OID 27443)
-- Name: update_routine_timestamp(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_routine_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_routine_timestamp() OWNER TO postgres;

--
-- TOC entry 349 (class 1255 OID 27832)
-- Name: update_user_profiles_updated_at(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.update_user_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION app.update_user_profiles_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 269 (class 1259 OID 27236)
-- Name: body_composition_history; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.body_composition_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    measurement_date timestamp with time zone DEFAULT now(),
    peso numeric(5,2),
    grasa_corporal numeric(5,2),
    masa_muscular numeric(5,2),
    agua_corporal numeric(5,2),
    metabolismo_basal integer,
    imc numeric(4,2),
    cintura numeric(5,2),
    cuello numeric(5,2),
    cadera numeric(5,2),
    calculation_method character varying(50) DEFAULT 'us_navy'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_body_comp_agua CHECK (((agua_corporal IS NULL) OR ((agua_corporal >= (40)::numeric) AND (agua_corporal <= (80)::numeric)))),
    CONSTRAINT chk_body_comp_grasa CHECK (((grasa_corporal IS NULL) OR ((grasa_corporal >= (1)::numeric) AND (grasa_corporal <= (50)::numeric)))),
    CONSTRAINT chk_body_comp_method CHECK (((calculation_method)::text = ANY ((ARRAY['us_navy'::character varying, 'dexa'::character varying, 'bioimpedance'::character varying, 'manual'::character varying])::text[])))
);


ALTER TABLE app.body_composition_history OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 27235)
-- Name: body_composition_history_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.body_composition_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.body_composition_history_id_seq OWNER TO postgres;

--
-- TOC entry 5921 (class 0 OID 0)
-- Dependencies: 268
-- Name: body_composition_history_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.body_composition_history_id_seq OWNED BY app.body_composition_history.id;


--
-- TOC entry 297 (class 1259 OID 27617)
-- Name: daily_nutrition_log; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.daily_nutrition_log (
    id integer NOT NULL,
    user_id integer NOT NULL,
    log_date date NOT NULL,
    daily_log jsonb NOT NULL,
    calories numeric(8,2) DEFAULT 0,
    protein numeric(6,2) DEFAULT 0,
    carbs numeric(6,2) DEFAULT 0,
    fat numeric(6,2) DEFAULT 0,
    fiber numeric(6,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.daily_nutrition_log OWNER TO postgres;

--
-- TOC entry 5922 (class 0 OID 0)
-- Dependencies: 297
-- Name: TABLE daily_nutrition_log; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.daily_nutrition_log IS 'Registro diario de consumo nutricional de usuarios';


--
-- TOC entry 5923 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN daily_nutrition_log.daily_log; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.daily_nutrition_log.daily_log IS 'JSON con log diario detallado de comidas y macros consumidos';


--
-- TOC entry 296 (class 1259 OID 27616)
-- Name: daily_nutrition_log_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.daily_nutrition_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.daily_nutrition_log_id_seq OWNER TO postgres;

--
-- TOC entry 5924 (class 0 OID 0)
-- Dependencies: 296
-- Name: daily_nutrition_log_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.daily_nutrition_log_id_seq OWNED BY app.daily_nutrition_log.id;


--
-- TOC entry 284 (class 1259 OID 27405)
-- Name: routine_exercise_feedback; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.routine_exercise_feedback (
    id integer NOT NULL,
    user_id integer NOT NULL,
    routine_session_id integer NOT NULL,
    exercise_order integer NOT NULL,
    exercise_name character varying(255) NOT NULL,
    sentiment character varying(50),
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE app.routine_exercise_feedback OWNER TO postgres;

--
-- TOC entry 5925 (class 0 OID 0)
-- Dependencies: 284
-- Name: TABLE routine_exercise_feedback; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.routine_exercise_feedback IS 'Feedback y comentarios de usuarios sobre ejercicios';


--
-- TOC entry 282 (class 1259 OID 27380)
-- Name: routine_exercise_progress; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.routine_exercise_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    routine_session_id integer NOT NULL,
    exercise_order integer NOT NULL,
    exercise_name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    series_completed integer DEFAULT 0,
    series_total integer DEFAULT 0,
    time_spent_seconds integer DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE app.routine_exercise_progress OWNER TO postgres;

--
-- TOC entry 5926 (class 0 OID 0)
-- Dependencies: 282
-- Name: TABLE routine_exercise_progress; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.routine_exercise_progress IS 'Progreso detallado de cada ejercicio en una sesión';


--
-- TOC entry 278 (class 1259 OID 27336)
-- Name: routine_plans; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.routine_plans (
    id integer NOT NULL,
    user_id integer NOT NULL,
    methodology_type character varying(100) NOT NULL,
    plan_data jsonb NOT NULL,
    generation_mode character varying(50) DEFAULT 'manual'::character varying,
    frequency_per_week integer,
    total_weeks integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    archived_at timestamp with time zone
);


ALTER TABLE app.routine_plans OWNER TO postgres;

--
-- TOC entry 5927 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE routine_plans; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.routine_plans IS 'Planes de rutinas generados por IA para usuarios';


--
-- TOC entry 280 (class 1259 OID 27354)
-- Name: routine_sessions; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.routine_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    routine_plan_id integer NOT NULL,
    week_number integer NOT NULL,
    day_name character varying(20) NOT NULL,
    session_date date DEFAULT CURRENT_DATE,
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    total_duration_seconds integer DEFAULT 0,
    exercises_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_exercises integer DEFAULT 0 NOT NULL,
    exercises_completed integer DEFAULT 0 NOT NULL
);


ALTER TABLE app.routine_sessions OWNER TO postgres;

--
-- TOC entry 5928 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE routine_sessions; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.routine_sessions IS 'Sesiones individuales de entrenamiento dentro de una rutina';


--
-- TOC entry 292 (class 1259 OID 27534)
-- Name: enhanced_routine_stats; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.enhanced_routine_stats AS
 SELECT rp.id AS routine_plan_id,
    rp.user_id,
    rp.methodology_type,
    rp.generation_mode,
    rp.frequency_per_week,
    rp.total_weeks,
    rp.created_at AS plan_created_at,
    count(DISTINCT rs.id) AS total_sessions_created,
    count(DISTINCT
        CASE
            WHEN ((rs.status)::text = 'completed'::text) THEN rs.id
            ELSE NULL::integer
        END) AS completed_sessions,
    count(DISTINCT
        CASE
            WHEN ((rs.status)::text = 'in_progress'::text) THEN rs.id
            ELSE NULL::integer
        END) AS in_progress_sessions,
    count(DISTINCT
        CASE
            WHEN ((rs.status)::text = 'pending'::text) THEN rs.id
            ELSE NULL::integer
        END) AS pending_sessions,
    count(DISTINCT rep.id) AS total_exercises_attempted,
    count(DISTINCT
        CASE
            WHEN ((rep.status)::text = 'completed'::text) THEN rep.id
            ELSE NULL::integer
        END) AS completed_exercises,
    count(DISTINCT
        CASE
            WHEN ((rep.status)::text = 'skipped'::text) THEN rep.id
            ELSE NULL::integer
        END) AS skipped_exercises,
    count(DISTINCT
        CASE
            WHEN ((rep.status)::text = 'cancelled'::text) THEN rep.id
            ELSE NULL::integer
        END) AS cancelled_exercises,
    COALESCE(sum(
        CASE
            WHEN (((rs.status)::text = 'completed'::text) AND (rs.total_duration_seconds IS NOT NULL)) THEN round(((rs.total_duration_seconds)::numeric / 60.0))
            ELSE (0)::numeric
        END), (0)::numeric) AS total_training_time_minutes,
    count(DISTINCT ref.id) AS total_feedback_given,
    count(DISTINCT
        CASE
            WHEN ((ref.sentiment)::text = 'love'::text) THEN ref.id
            ELSE NULL::integer
        END) AS loved_exercises,
    count(DISTINCT
        CASE
            WHEN ((ref.sentiment)::text = 'hard'::text) THEN ref.id
            ELSE NULL::integer
        END) AS hard_exercises,
    count(DISTINCT
        CASE
            WHEN ((ref.sentiment)::text = 'neutral'::text) THEN ref.id
            ELSE NULL::integer
        END) AS neutral_exercises,
    min(rs.started_at) AS first_session_date,
    max(rs.completed_at) AS last_session_date,
    app.calculate_current_streak(rp.user_id, rp.id) AS current_streak_days,
        CASE
            WHEN (count(DISTINCT rs.id) > 0) THEN round((((count(DISTINCT
            CASE
                WHEN ((rs.status)::text = 'completed'::text) THEN rs.id
                ELSE NULL::integer
            END))::numeric / (count(DISTINCT rs.id))::numeric) * (100)::numeric), 2)
            ELSE 0.00
        END AS overall_progress_percentage
   FROM (((app.routine_plans rp
     LEFT JOIN app.routine_sessions rs ON ((rp.id = rs.routine_plan_id)))
     LEFT JOIN app.routine_exercise_progress rep ON ((rs.id = rep.routine_session_id)))
     LEFT JOIN app.routine_exercise_feedback ref ON ((rs.id = ref.routine_session_id)))
  WHERE (rp.is_active = true)
  GROUP BY rp.id, rp.user_id, rp.methodology_type, rp.generation_mode, rp.frequency_per_week, rp.total_weeks, rp.created_at
  ORDER BY rp.created_at DESC;


ALTER VIEW app.enhanced_routine_stats OWNER TO postgres;

--
-- TOC entry 5929 (class 0 OID 0)
-- Dependencies: 292
-- Name: VIEW enhanced_routine_stats; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.enhanced_routine_stats IS 'Vista con estadísticas completas de todos los planes de rutina activos';


--
-- TOC entry 257 (class 1259 OID 27121)
-- Name: equipment_catalog; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.equipment_catalog (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50),
    icon character varying(50),
    active boolean DEFAULT true
);


ALTER TABLE app.equipment_catalog OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 27120)
-- Name: equipment_catalog_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.equipment_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.equipment_catalog_id_seq OWNER TO postgres;

--
-- TOC entry 5930 (class 0 OID 0)
-- Dependencies: 256
-- Name: equipment_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.equipment_catalog_id_seq OWNED BY app.equipment_catalog.id;


--
-- TOC entry 261 (class 1259 OID 27163)
-- Name: equipment_items; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.equipment_items (
    key text NOT NULL,
    label text NOT NULL,
    level text NOT NULL,
    CONSTRAINT equipment_items_level_check CHECK ((level = ANY (ARRAY['minimo'::text, 'basico'::text, 'avanzado'::text])))
);


ALTER TABLE app.equipment_items OWNER TO postgres;

--
-- TOC entry 309 (class 1259 OID 27836)
-- Name: exercise_ai_info; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.exercise_ai_info (
    id integer NOT NULL,
    exercise_name character varying(255) NOT NULL,
    ejecucion text NOT NULL,
    consejos text NOT NULL,
    errores_evitar text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    exercise_name_normalized character varying(255) NOT NULL,
    first_requested_by integer,
    request_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT chk_request_count_nonneg CHECK ((request_count >= 0)),
    CONSTRAINT chk_texts_not_empty CHECK (((length(TRIM(BOTH FROM ejecucion)) > 0) AND (length(TRIM(BOTH FROM consejos)) > 0) AND (length(TRIM(BOTH FROM errores_evitar)) > 0)))
);


ALTER TABLE app.exercise_ai_info OWNER TO postgres;

--
-- TOC entry 5931 (class 0 OID 0)
-- Dependencies: 309
-- Name: TABLE exercise_ai_info; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.exercise_ai_info IS 'Info de ejercicios generada por IA para reutilización';


--
-- TOC entry 5932 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.exercise_name; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.exercise_name IS 'Nombre original solicitado';


--
-- TOC entry 5933 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.ejecucion; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.ejecucion IS 'Cómo ejecutar el ejercicio';


--
-- TOC entry 5934 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.consejos; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.consejos IS 'Consejos de efectividad y seguridad';


--
-- TOC entry 5935 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.errores_evitar; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.errores_evitar IS 'Errores comunes a evitar';


--
-- TOC entry 5936 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.exercise_name_normalized; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.exercise_name_normalized IS 'Nombre normalizado (sin acentos, minúsculas)';


--
-- TOC entry 5937 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.first_requested_by; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.first_requested_by IS 'Usuario que lo solicitó por primera vez';


--
-- TOC entry 5938 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN exercise_ai_info.request_count; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.exercise_ai_info.request_count IS 'Veces solicitado';


--
-- TOC entry 308 (class 1259 OID 27835)
-- Name: exercise_ai_info_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.exercise_ai_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.exercise_ai_info_id_seq OWNER TO postgres;

--
-- TOC entry 5939 (class 0 OID 0)
-- Dependencies: 308
-- Name: exercise_ai_info_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.exercise_ai_info_id_seq OWNED BY app.exercise_ai_info.id;


--
-- TOC entry 273 (class 1259 OID 27292)
-- Name: exercise_history; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.exercise_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    exercise_name character varying(255) NOT NULL,
    methodology_type character varying(100) NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    plan_id integer,
    week_number integer,
    day_name character varying(20)
);


ALTER TABLE app.exercise_history OWNER TO postgres;

--
-- TOC entry 5940 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE exercise_history; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.exercise_history IS 'Historial de ejercicios utilizados por cada usuario para evitar repeticiones';


--
-- TOC entry 272 (class 1259 OID 27291)
-- Name: exercise_history_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.exercise_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.exercise_history_id_seq OWNER TO postgres;

--
-- TOC entry 5941 (class 0 OID 0)
-- Dependencies: 272
-- Name: exercise_history_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.exercise_history_id_seq OWNED BY app.exercise_history.id;


--
-- TOC entry 275 (class 1259 OID 27311)
-- Name: exercise_repetition_policy; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.exercise_repetition_policy (
    id integer NOT NULL,
    methodology_type character varying(100) NOT NULL,
    min_days_between_same_exercise integer DEFAULT 14,
    max_times_per_month integer DEFAULT 4,
    variety_percentage numeric(3,2) DEFAULT 0.70,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE app.exercise_repetition_policy OWNER TO postgres;

--
-- TOC entry 5942 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE exercise_repetition_policy; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.exercise_repetition_policy IS 'Políticas de repetición de ejercicios por metodología';


--
-- TOC entry 274 (class 1259 OID 27310)
-- Name: exercise_repetition_policy_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.exercise_repetition_policy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.exercise_repetition_policy_id_seq OWNER TO postgres;

--
-- TOC entry 5943 (class 0 OID 0)
-- Dependencies: 274
-- Name: exercise_repetition_policy_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.exercise_repetition_policy_id_seq OWNED BY app.exercise_repetition_policy.id;


--
-- TOC entry 265 (class 1259 OID 27201)
-- Name: exercises_catalog; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.exercises_catalog (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    key character varying(50) NOT NULL,
    category character varying(50) NOT NULL,
    muscle_groups text[],
    equipment_required character varying(50),
    difficulty_level character varying(20) DEFAULT 'beginner'::character varying,
    description text,
    instructions text,
    video_url character varying(255),
    gif_url character varying(255),
    safety_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    CONSTRAINT chk_exercises_category CHECK (((category)::text = ANY ((ARRAY['strength'::character varying, 'cardio'::character varying, 'flexibility'::character varying, 'mobility'::character varying, 'balance'::character varying, 'functional'::character varying])::text[]))),
    CONSTRAINT chk_exercises_difficulty CHECK (((difficulty_level)::text = ANY ((ARRAY['beginner'::character varying, 'intermediate'::character varying, 'advanced'::character varying])::text[])))
);


ALTER TABLE app.exercises_catalog OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 27200)
-- Name: exercises_catalog_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.exercises_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.exercises_catalog_id_seq OWNER TO postgres;

--
-- TOC entry 5944 (class 0 OID 0)
-- Dependencies: 264
-- Name: exercises_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.exercises_catalog_id_seq OWNED BY app.exercises_catalog.id;


--
-- TOC entry 299 (class 1259 OID 27642)
-- Name: food_database; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.food_database (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100) NOT NULL,
    calories_per_100g numeric(6,2) NOT NULL,
    protein_per_100g numeric(5,2) DEFAULT 0,
    carbs_per_100g numeric(5,2) DEFAULT 0,
    fat_per_100g numeric(5,2) DEFAULT 0,
    fiber_per_100g numeric(5,2) DEFAULT 0,
    sugar_per_100g numeric(5,2) DEFAULT 0,
    sodium_per_100g numeric(6,2) DEFAULT 0,
    potassium_per_100g numeric(6,2) DEFAULT 0,
    calcium_per_100g numeric(6,2) DEFAULT 0,
    iron_per_100g numeric(5,2) DEFAULT 0,
    vitamin_c_per_100g numeric(5,2) DEFAULT 0,
    common_serving_size character varying(100),
    serving_weight_g numeric(6,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.food_database OWNER TO postgres;

--
-- TOC entry 5945 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE food_database; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.food_database IS 'Base de datos de alimentos con información nutricional completa';


--
-- TOC entry 5946 (class 0 OID 0)
-- Dependencies: 299
-- Name: COLUMN food_database.calories_per_100g; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.food_database.calories_per_100g IS 'Calorías por 100 gramos del alimento';


--
-- TOC entry 298 (class 1259 OID 27641)
-- Name: food_database_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.food_database_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.food_database_id_seq OWNER TO postgres;

--
-- TOC entry 5947 (class 0 OID 0)
-- Dependencies: 298
-- Name: food_database_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.food_database_id_seq OWNED BY app.food_database.id;


--
-- TOC entry 323 (class 1259 OID 28038)
-- Name: home_combination_exercise_history; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_combination_exercise_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    combination_id integer NOT NULL,
    combination_code character varying(50) NOT NULL,
    exercise_name character varying(255) NOT NULL,
    exercise_key character varying(255) NOT NULL,
    times_used integer DEFAULT 1,
    last_used_at timestamp with time zone DEFAULT now(),
    session_id integer,
    plan_id integer,
    user_rating character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.home_combination_exercise_history OWNER TO postgres;

--
-- TOC entry 5948 (class 0 OID 0)
-- Dependencies: 323
-- Name: TABLE home_combination_exercise_history; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.home_combination_exercise_history IS 'Historial separado por combinación (aislamiento por combination_id)';


--
-- TOC entry 322 (class 1259 OID 28037)
-- Name: home_combination_exercise_history_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_combination_exercise_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_combination_exercise_history_id_seq OWNER TO postgres;

--
-- TOC entry 5949 (class 0 OID 0)
-- Dependencies: 322
-- Name: home_combination_exercise_history_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_combination_exercise_history_id_seq OWNED BY app.home_combination_exercise_history.id;


--
-- TOC entry 311 (class 1259 OID 27880)
-- Name: home_exercise_history; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_exercise_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    exercise_name character varying(255) NOT NULL,
    exercise_key character varying(255),
    reps text,
    series integer,
    duration_seconds integer,
    plan_id integer,
    session_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.home_exercise_history OWNER TO postgres;

--
-- TOC entry 5950 (class 0 OID 0)
-- Dependencies: 311
-- Name: TABLE home_exercise_history; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.home_exercise_history IS 'Historial específico de ejercicios de entrenamiento en casa - separado de metodologías';


--
-- TOC entry 5951 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN home_exercise_history.plan_id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.home_exercise_history.plan_id IS 'Referencia al plan de home_training_plans';


--
-- TOC entry 5952 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN home_exercise_history.session_id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.home_exercise_history.session_id IS 'Referencia a la sesión de home_training_sessions';


--
-- TOC entry 310 (class 1259 OID 27879)
-- Name: home_exercise_history_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_exercise_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_exercise_history_id_seq OWNER TO postgres;

--
-- TOC entry 5953 (class 0 OID 0)
-- Dependencies: 310
-- Name: home_exercise_history_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_exercise_history_id_seq OWNED BY app.home_exercise_history.id;


--
-- TOC entry 233 (class 1259 OID 26760)
-- Name: home_exercise_progress; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_exercise_progress (
    id integer NOT NULL,
    home_training_session_id integer,
    exercise_name character varying(255) NOT NULL,
    exercise_order integer NOT NULL,
    series_completed integer DEFAULT 0,
    total_series integer DEFAULT 1 NOT NULL,
    duration_seconds integer,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    exercise_data jsonb,
    CONSTRAINT chk_ex_progress_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'skipped'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE app.home_exercise_progress OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 26759)
-- Name: home_exercise_progress_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_exercise_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_exercise_progress_id_seq OWNER TO postgres;

--
-- TOC entry 5954 (class 0 OID 0)
-- Dependencies: 232
-- Name: home_exercise_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_exercise_progress_id_seq OWNED BY app.home_exercise_progress.id;


--
-- TOC entry 321 (class 1259 OID 27992)
-- Name: home_training_combinations; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_training_combinations (
    id integer NOT NULL,
    equipment_type character varying(20) NOT NULL,
    training_type character varying(20) NOT NULL,
    combination_code character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    equipment_list text[],
    focus_areas text[],
    difficulty_level character varying(20) DEFAULT 'intermedio'::character varying,
    estimated_duration_range character varying(20) DEFAULT '20-45 min'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_equipment_type CHECK (((equipment_type)::text = ANY ((ARRAY['minimo'::character varying, 'basico'::character varying, 'avanzado'::character varying, 'personalizado'::character varying])::text[]))),
    CONSTRAINT chk_training_type CHECK (((training_type)::text = ANY ((ARRAY['funcional'::character varying, 'hiit'::character varying, 'fuerza'::character varying])::text[])))
);


ALTER TABLE app.home_training_combinations OWNER TO postgres;

--
-- TOC entry 5955 (class 0 OID 0)
-- Dependencies: 321
-- Name: TABLE home_training_combinations; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.home_training_combinations IS 'Tabla maestra con las 12 combinaciones específicas de entrenamiento en casa';


--
-- TOC entry 320 (class 1259 OID 27991)
-- Name: home_training_combinations_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_training_combinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_training_combinations_id_seq OWNER TO postgres;

--
-- TOC entry 5956 (class 0 OID 0)
-- Dependencies: 320
-- Name: home_training_combinations_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_training_combinations_id_seq OWNED BY app.home_training_combinations.id;


--
-- TOC entry 229 (class 1259 OID 26720)
-- Name: home_training_plans; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_training_plans (
    id integer NOT NULL,
    user_id integer,
    plan_data jsonb NOT NULL,
    equipment_type character varying(20) NOT NULL,
    training_type character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.home_training_plans OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 26719)
-- Name: home_training_plans_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_training_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_training_plans_id_seq OWNER TO postgres;

--
-- TOC entry 5957 (class 0 OID 0)
-- Dependencies: 228
-- Name: home_training_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_training_plans_id_seq OWNED BY app.home_training_plans.id;


--
-- TOC entry 231 (class 1259 OID 26736)
-- Name: home_training_sessions; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_training_sessions (
    id integer NOT NULL,
    user_id integer,
    home_training_plan_id integer,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    total_duration_seconds integer,
    exercises_completed integer DEFAULT 0,
    total_exercises integer DEFAULT 0,
    progress_percentage numeric(5,2) DEFAULT 0.00,
    status character varying(20) DEFAULT 'in_progress'::character varying,
    session_data jsonb
);


ALTER TABLE app.home_training_sessions OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 26735)
-- Name: home_training_sessions_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_training_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_training_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5958 (class 0 OID 0)
-- Dependencies: 230
-- Name: home_training_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_training_sessions_id_seq OWNED BY app.home_training_sessions.id;


--
-- TOC entry 314 (class 1259 OID 27915)
-- Name: home_training_templates; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.home_training_templates (
    id integer NOT NULL,
    equipment_type character varying(50) NOT NULL,
    training_type character varying(50) NOT NULL,
    template_name character varying(200) NOT NULL,
    plan_data jsonb NOT NULL,
    is_active boolean DEFAULT true,
    usage_count integer DEFAULT 0,
    created_by character varying(50) DEFAULT 'system'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE app.home_training_templates OWNER TO postgres;

--
-- TOC entry 5959 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE home_training_templates; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.home_training_templates IS 'Plantillas predefinidas para entrenamiento en casa. Elimina necesidad de IA para combinaciones comunes.';


--
-- TOC entry 5960 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN home_training_templates.equipment_type; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.home_training_templates.equipment_type IS 'Tipo de equipamiento: minimo, basico, avanzado, personalizado';


--
-- TOC entry 5961 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN home_training_templates.training_type; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.home_training_templates.training_type IS 'Tipo de entrenamiento: funcional, hiit, fuerza';


--
-- TOC entry 5962 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN home_training_templates.plan_data; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.home_training_templates.plan_data IS 'JSON con estructura completa del plan de entrenamiento';


--
-- TOC entry 5963 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN home_training_templates.usage_count; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.home_training_templates.usage_count IS 'Contador de veces que se ha usado esta plantilla';


--
-- TOC entry 313 (class 1259 OID 27914)
-- Name: home_training_templates_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.home_training_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.home_training_templates_id_seq OWNER TO postgres;

--
-- TOC entry 5964 (class 0 OID 0)
-- Dependencies: 313
-- Name: home_training_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.home_training_templates_id_seq OWNED BY app.home_training_templates.id;


--
-- TOC entry 263 (class 1259 OID 27181)
-- Name: medical_documents; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.medical_documents (
    id integer NOT NULL,
    user_id integer NOT NULL,
    document_name character varying(255) NOT NULL,
    document_type character varying(50) NOT NULL,
    file_path character varying(500),
    content text,
    analysis_result jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    upload_date timestamp with time zone DEFAULT now(),
    analyzed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_medical_doc_type CHECK (((document_type)::text = ANY ((ARRAY['pdf'::character varying, 'image'::character varying, 'text'::character varying])::text[]))),
    CONSTRAINT chk_medical_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'analyzed'::character varying, 'error'::character varying])::text[])))
);


ALTER TABLE app.medical_documents OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 27180)
-- Name: medical_documents_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.medical_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.medical_documents_id_seq OWNER TO postgres;

--
-- TOC entry 5965 (class 0 OID 0)
-- Dependencies: 262
-- Name: medical_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.medical_documents_id_seq OWNED BY app.medical_documents.id;


--
-- TOC entry 333 (class 1259 OID 28170)
-- Name: methodology_exercise_feedback; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.methodology_exercise_feedback (
    id integer NOT NULL,
    methodology_session_id integer NOT NULL,
    user_id integer NOT NULL,
    exercise_name character varying(200) NOT NULL,
    exercise_order integer NOT NULL,
    sentiment character varying(20) NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_feedback_sentiment_check CHECK (((sentiment)::text = ANY ((ARRAY['love'::character varying, 'normal'::character varying, 'hard'::character varying])::text[])))
);


ALTER TABLE app.methodology_exercise_feedback OWNER TO postgres;

--
-- TOC entry 5966 (class 0 OID 0)
-- Dependencies: 333
-- Name: TABLE methodology_exercise_feedback; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.methodology_exercise_feedback IS 'Feedback del usuario (sentiment opcional) y comentarios por ejercicio en metodologías.';


--
-- TOC entry 332 (class 1259 OID 28169)
-- Name: methodology_exercise_feedback_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.methodology_exercise_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.methodology_exercise_feedback_id_seq OWNER TO postgres;

--
-- TOC entry 5967 (class 0 OID 0)
-- Dependencies: 332
-- Name: methodology_exercise_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.methodology_exercise_feedback_id_seq OWNED BY app.methodology_exercise_feedback.id;


--
-- TOC entry 335 (class 1259 OID 28261)
-- Name: methodology_exercise_history_complete; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.methodology_exercise_history_complete (
    id integer NOT NULL,
    user_id integer NOT NULL,
    methodology_plan_id integer,
    methodology_session_id integer,
    exercise_name character varying(200) NOT NULL,
    exercise_order integer NOT NULL,
    methodology_type character varying(50) NOT NULL,
    series_total integer NOT NULL,
    series_completed integer NOT NULL,
    repeticiones character varying(20) NOT NULL,
    intensidad character varying(50),
    tiempo_dedicado_segundos integer,
    sentiment character varying(20),
    user_comment text,
    week_number integer NOT NULL,
    day_name character varying(20) NOT NULL,
    session_date date NOT NULL,
    completed_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_history_sentiment_check CHECK (((sentiment IS NULL) OR ((sentiment)::text = ANY ((ARRAY['love'::character varying, 'normal'::character varying, 'hard'::character varying])::text[])))),
    CONSTRAINT methodology_history_week_valid CHECK (((week_number >= 1) AND (week_number <= 12)))
);


ALTER TABLE app.methodology_exercise_history_complete OWNER TO postgres;

--
-- TOC entry 5968 (class 0 OID 0)
-- Dependencies: 335
-- Name: TABLE methodology_exercise_history_complete; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.methodology_exercise_history_complete IS 'Historial consolidado (sin duplicados) para IA y estadísticas.';


--
-- TOC entry 334 (class 1259 OID 28260)
-- Name: methodology_exercise_history_complete_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.methodology_exercise_history_complete_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.methodology_exercise_history_complete_id_seq OWNER TO postgres;

--
-- TOC entry 5969 (class 0 OID 0)
-- Dependencies: 334
-- Name: methodology_exercise_history_complete_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.methodology_exercise_history_complete_id_seq OWNED BY app.methodology_exercise_history_complete.id;


--
-- TOC entry 331 (class 1259 OID 28144)
-- Name: methodology_exercise_progress; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.methodology_exercise_progress (
    id integer NOT NULL,
    methodology_session_id integer NOT NULL,
    user_id integer NOT NULL,
    exercise_name character varying(200) NOT NULL,
    exercise_order integer NOT NULL,
    series_total integer NOT NULL,
    repeticiones character varying(20) NOT NULL,
    descanso_seg integer NOT NULL,
    intensidad character varying(50),
    tempo character varying(20),
    notas text,
    ejercicio_ejecucion text,
    ejercicio_consejos text,
    ejercicio_errores_evitar text,
    series_completed integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    time_spent_seconds integer,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_progress_order_valid CHECK ((exercise_order >= 0)),
    CONSTRAINT methodology_progress_series_valid CHECK (((series_completed >= 0) AND (series_completed <= series_total))),
    CONSTRAINT methodology_progress_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'skipped'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE app.methodology_exercise_progress OWNER TO postgres;

--
-- TOC entry 5970 (class 0 OID 0)
-- Dependencies: 331
-- Name: TABLE methodology_exercise_progress; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.methodology_exercise_progress IS 'Progreso detallado por ejercicio en metodologías con info de ejecución IA.';


--
-- TOC entry 330 (class 1259 OID 28143)
-- Name: methodology_exercise_progress_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.methodology_exercise_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.methodology_exercise_progress_id_seq OWNER TO postgres;

--
-- TOC entry 5971 (class 0 OID 0)
-- Dependencies: 330
-- Name: methodology_exercise_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.methodology_exercise_progress_id_seq OWNED BY app.methodology_exercise_progress.id;


--
-- TOC entry 329 (class 1259 OID 28118)
-- Name: methodology_exercise_sessions; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.methodology_exercise_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    methodology_plan_id integer NOT NULL,
    methodology_type character varying(50) NOT NULL,
    session_name character varying(100) NOT NULL,
    week_number integer DEFAULT 1 NOT NULL,
    day_name character varying(20) NOT NULL,
    total_exercises integer DEFAULT 0 NOT NULL,
    exercises_completed integer DEFAULT 0 NOT NULL,
    session_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    total_duration_seconds integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT methodology_sessions_day_valid CHECK (((day_name)::text = ANY ((ARRAY['Lun'::character varying, 'Mar'::character varying, 'Mie'::character varying, 'Jue'::character varying, 'Vie'::character varying, 'Sab'::character varying, 'Dom'::character varying])::text[]))),
    CONSTRAINT methodology_sessions_status_check CHECK (((session_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT methodology_sessions_week_valid CHECK (((week_number >= 1) AND (week_number <= 12)))
);


ALTER TABLE app.methodology_exercise_sessions OWNER TO postgres;

--
-- TOC entry 5972 (class 0 OID 0)
-- Dependencies: 329
-- Name: TABLE methodology_exercise_sessions; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.methodology_exercise_sessions IS 'Sesiones de entrenamiento de metodologías de gimnasio (similar a home_training_sessions), aisladas por metodología.';


--
-- TOC entry 328 (class 1259 OID 28117)
-- Name: methodology_exercise_sessions_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.methodology_exercise_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.methodology_exercise_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5973 (class 0 OID 0)
-- Dependencies: 328
-- Name: methodology_exercise_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.methodology_exercise_sessions_id_seq OWNED BY app.methodology_exercise_sessions.id;


--
-- TOC entry 271 (class 1259 OID 27264)
-- Name: methodology_plans; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.methodology_plans (
    id integer NOT NULL,
    user_id integer NOT NULL,
    methodology_type character varying(50) NOT NULL,
    plan_data jsonb NOT NULL,
    generation_mode character varying(20) DEFAULT 'manual'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version_type character varying(20) DEFAULT 'adapted'::character varying,
    custom_weeks integer DEFAULT 4,
    selection_mode character varying(20) DEFAULT 'automatic'::character varying,
    CONSTRAINT methodology_plans_custom_weeks_check CHECK (((custom_weeks >= 1) AND (custom_weeks <= 7))),
    CONSTRAINT methodology_plans_selection_mode_check CHECK (((selection_mode)::text = ANY ((ARRAY['automatic'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT methodology_plans_version_type_check CHECK (((version_type)::text = ANY ((ARRAY['adapted'::character varying, 'strict'::character varying])::text[])))
);


ALTER TABLE app.methodology_plans OWNER TO postgres;

--
-- TOC entry 5974 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE methodology_plans; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.methodology_plans IS 'Almacena planes de entrenamiento generados por metodologías específicas';


--
-- TOC entry 5975 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN methodology_plans.methodology_type; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.methodology_plans.methodology_type IS 'Tipo de metodología: Heavy Duty, Powerlifting, Hipertrofia, etc.';


--
-- TOC entry 5976 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN methodology_plans.plan_data; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.methodology_plans.plan_data IS 'Datos JSON completos del plan generado por IA';


--
-- TOC entry 5977 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN methodology_plans.generation_mode; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.methodology_plans.generation_mode IS 'Modo de generación: manual (usuario elige) o auto (IA elige)';


--
-- TOC entry 270 (class 1259 OID 27263)
-- Name: methodology_plans_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.methodology_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.methodology_plans_id_seq OWNER TO postgres;

--
-- TOC entry 5978 (class 0 OID 0)
-- Dependencies: 270
-- Name: methodology_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.methodology_plans_id_seq OWNED BY app.methodology_plans.id;


--
-- TOC entry 305 (class 1259 OID 27739)
-- Name: music_playlists; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.music_playlists (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    tracks jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_playlist_name_length CHECK (((length(TRIM(BOTH FROM name)) > 0) AND (length((name)::text) <= 255))),
    CONSTRAINT chk_tracks_is_array CHECK ((jsonb_typeof(tracks) = 'array'::text))
);


ALTER TABLE app.music_playlists OWNER TO postgres;

--
-- TOC entry 5979 (class 0 OID 0)
-- Dependencies: 305
-- Name: TABLE music_playlists; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.music_playlists IS 'Almacena las playlists de música locales de los usuarios del sistema de audio';


--
-- TOC entry 5980 (class 0 OID 0)
-- Dependencies: 305
-- Name: COLUMN music_playlists.id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.music_playlists.id IS 'Identificador único de la playlist';


--
-- TOC entry 5981 (class 0 OID 0)
-- Dependencies: 305
-- Name: COLUMN music_playlists.user_id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.music_playlists.user_id IS 'ID del usuario propietario de la playlist';


--
-- TOC entry 5982 (class 0 OID 0)
-- Dependencies: 305
-- Name: COLUMN music_playlists.name; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.music_playlists.name IS 'Nombre de la playlist (máximo 255 caracteres)';


--
-- TOC entry 5983 (class 0 OID 0)
-- Dependencies: 305
-- Name: COLUMN music_playlists.tracks; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.music_playlists.tracks IS 'Array JSON con la información de las canciones de la playlist';


--
-- TOC entry 5984 (class 0 OID 0)
-- Dependencies: 305
-- Name: COLUMN music_playlists.created_at; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.music_playlists.created_at IS 'Fecha y hora de creación de la playlist';


--
-- TOC entry 5985 (class 0 OID 0)
-- Dependencies: 305
-- Name: COLUMN music_playlists.updated_at; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.music_playlists.updated_at IS 'Fecha y hora de última modificación (se actualiza automáticamente)';


--
-- TOC entry 304 (class 1259 OID 27738)
-- Name: music_playlists_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.music_playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.music_playlists_id_seq OWNER TO postgres;

--
-- TOC entry 5986 (class 0 OID 0)
-- Dependencies: 304
-- Name: music_playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.music_playlists_id_seq OWNED BY app.music_playlists.id;


--
-- TOC entry 303 (class 1259 OID 27685)
-- Name: nutrition_goals; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.nutrition_goals (
    id integer NOT NULL,
    user_id integer NOT NULL,
    target_calories integer NOT NULL,
    target_protein numeric(6,2) NOT NULL,
    target_carbs numeric(6,2) NOT NULL,
    target_fat numeric(6,2) NOT NULL,
    target_fiber numeric(5,2) DEFAULT 25,
    goal_type character varying(50) NOT NULL,
    calculation_method character varying(50) DEFAULT 'bmr_tdee'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.nutrition_goals OWNER TO postgres;

--
-- TOC entry 5987 (class 0 OID 0)
-- Dependencies: 303
-- Name: TABLE nutrition_goals; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.nutrition_goals IS 'Objetivos nutricionales configurados por usuario';


--
-- TOC entry 302 (class 1259 OID 27684)
-- Name: nutrition_goals_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.nutrition_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.nutrition_goals_id_seq OWNER TO postgres;

--
-- TOC entry 5988 (class 0 OID 0)
-- Dependencies: 302
-- Name: nutrition_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.nutrition_goals_id_seq OWNED BY app.nutrition_goals.id;


--
-- TOC entry 295 (class 1259 OID 27593)
-- Name: nutrition_plans; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.nutrition_plans (
    id integer NOT NULL,
    user_id integer NOT NULL,
    plan_data jsonb NOT NULL,
    duration_days integer DEFAULT 7 NOT NULL,
    target_calories integer,
    target_protein numeric(6,2),
    target_carbs numeric(6,2),
    target_fat numeric(6,2),
    meals_per_day integer DEFAULT 4,
    methodology_focus character varying(100),
    dietary_style character varying(50) DEFAULT 'none'::character varying,
    generation_mode character varying(20) DEFAULT 'ai_generated'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.nutrition_plans OWNER TO postgres;

--
-- TOC entry 5989 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE nutrition_plans; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.nutrition_plans IS 'Planes nutricionales generados por IA para usuarios';


--
-- TOC entry 5990 (class 0 OID 0)
-- Dependencies: 295
-- Name: COLUMN nutrition_plans.plan_data; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.nutrition_plans.plan_data IS 'JSON con plan completo generado por IA incluyendo comidas, horarios, recetas, etc.';


--
-- TOC entry 294 (class 1259 OID 27592)
-- Name: nutrition_plans_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.nutrition_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.nutrition_plans_id_seq OWNER TO postgres;

--
-- TOC entry 5991 (class 0 OID 0)
-- Dependencies: 294
-- Name: nutrition_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.nutrition_plans_id_seq OWNED BY app.nutrition_plans.id;


--
-- TOC entry 283 (class 1259 OID 27404)
-- Name: routine_exercise_feedback_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.routine_exercise_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.routine_exercise_feedback_id_seq OWNER TO postgres;

--
-- TOC entry 5992 (class 0 OID 0)
-- Dependencies: 283
-- Name: routine_exercise_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.routine_exercise_feedback_id_seq OWNED BY app.routine_exercise_feedback.id;


--
-- TOC entry 281 (class 1259 OID 27379)
-- Name: routine_exercise_progress_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.routine_exercise_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.routine_exercise_progress_id_seq OWNER TO postgres;

--
-- TOC entry 5993 (class 0 OID 0)
-- Dependencies: 281
-- Name: routine_exercise_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.routine_exercise_progress_id_seq OWNED BY app.routine_exercise_progress.id;


--
-- TOC entry 277 (class 1259 OID 27335)
-- Name: routine_plans_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.routine_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.routine_plans_id_seq OWNER TO postgres;

--
-- TOC entry 5994 (class 0 OID 0)
-- Dependencies: 277
-- Name: routine_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.routine_plans_id_seq OWNED BY app.routine_plans.id;


--
-- TOC entry 279 (class 1259 OID 27353)
-- Name: routine_sessions_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.routine_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.routine_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5995 (class 0 OID 0)
-- Dependencies: 279
-- Name: routine_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.routine_sessions_id_seq OWNED BY app.routine_sessions.id;


--
-- TOC entry 301 (class 1259 OID 27664)
-- Name: supplement_recommendations; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.supplement_recommendations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    supplement_name character varying(200) NOT NULL,
    dosage character varying(100) NOT NULL,
    timing character varying(200) NOT NULL,
    reason text NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    methodology_focus character varying(100),
    purchase_link text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.supplement_recommendations OWNER TO postgres;

--
-- TOC entry 5996 (class 0 OID 0)
-- Dependencies: 301
-- Name: TABLE supplement_recommendations; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.supplement_recommendations IS 'Recomendaciones personalizadas de suplementos';


--
-- TOC entry 300 (class 1259 OID 27663)
-- Name: supplement_recommendations_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.supplement_recommendations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.supplement_recommendations_id_seq OWNER TO postgres;

--
-- TOC entry 5997 (class 0 OID 0)
-- Dependencies: 300
-- Name: supplement_recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.supplement_recommendations_id_seq OWNED BY app.supplement_recommendations.id;


--
-- TOC entry 267 (class 1259 OID 27218)
-- Name: technique_analysis; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.technique_analysis (
    id integer NOT NULL,
    user_id integer NOT NULL,
    exercise_key character varying(50) NOT NULL,
    video_url character varying(500),
    analysis_result jsonb NOT NULL,
    score integer,
    feedback text,
    corrections text[],
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    analyzed_at timestamp with time zone,
    CONSTRAINT chk_technique_score CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
    CONSTRAINT chk_technique_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'analyzed'::character varying, 'reviewed'::character varying])::text[])))
);


ALTER TABLE app.technique_analysis OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 27217)
-- Name: technique_analysis_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.technique_analysis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.technique_analysis_id_seq OWNER TO postgres;

--
-- TOC entry 5998 (class 0 OID 0)
-- Dependencies: 266
-- Name: technique_analysis_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.technique_analysis_id_seq OWNED BY app.technique_analysis.id;


--
-- TOC entry 244 (class 1259 OID 26895)
-- Name: user_alergias; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_alergias (
    user_id integer NOT NULL,
    alergia text NOT NULL
);


ALTER TABLE app.user_alergias OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 26921)
-- Name: user_alimentos_excluidos; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_alimentos_excluidos (
    user_id integer NOT NULL,
    alimento text NOT NULL
);


ALTER TABLE app.user_alimentos_excluidos OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 27147)
-- Name: user_custom_equipment; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_custom_equipment (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(120) NOT NULL,
    category character varying(50),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE app.user_custom_equipment OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 27146)
-- Name: user_custom_equipment_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_custom_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_custom_equipment_id_seq OWNER TO postgres;

--
-- TOC entry 5999 (class 0 OID 0)
-- Dependencies: 259
-- Name: user_custom_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_custom_equipment_id_seq OWNED BY app.user_custom_equipment.id;


--
-- TOC entry 291 (class 1259 OID 27503)
-- Name: user_daily_activity; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_daily_activity (
    id integer NOT NULL,
    user_id integer NOT NULL,
    routine_plan_id integer,
    activity_date date DEFAULT CURRENT_DATE NOT NULL,
    activity_type character varying(50) DEFAULT 'continue_training'::character varying NOT NULL,
    session_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE app.user_daily_activity OWNER TO postgres;

--
-- TOC entry 6000 (class 0 OID 0)
-- Dependencies: 291
-- Name: TABLE user_daily_activity; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.user_daily_activity IS 'Registra la actividad diaria del usuario en metodologías para calcular rachas';


--
-- TOC entry 290 (class 1259 OID 27502)
-- Name: user_daily_activity_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_daily_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_daily_activity_id_seq OWNER TO postgres;

--
-- TOC entry 6001 (class 0 OID 0)
-- Dependencies: 290
-- Name: user_daily_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_daily_activity_id_seq OWNED BY app.user_daily_activity.id;


--
-- TOC entry 258 (class 1259 OID 27130)
-- Name: user_equipment; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_equipment (
    user_id integer NOT NULL,
    equipment_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    equipment_key text
);


ALTER TABLE app.user_equipment OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 27100)
-- Name: user_exercise_feedback; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_exercise_feedback (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_id integer,
    exercise_order integer,
    exercise_name text,
    exercise_key text,
    sentiment text,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_exercise_feedback_sentiment_check CHECK (((sentiment IS NULL) OR (sentiment = ANY (ARRAY['dislike'::text, 'hard'::text, 'love'::text]))))
);


ALTER TABLE app.user_exercise_feedback OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 27099)
-- Name: user_exercise_feedback_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_exercise_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_exercise_feedback_id_seq OWNER TO postgres;

--
-- TOC entry 6002 (class 0 OID 0)
-- Dependencies: 254
-- Name: user_exercise_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_exercise_feedback_id_seq OWNED BY app.user_exercise_feedback.id;


--
-- TOC entry 250 (class 1259 OID 26987)
-- Name: user_exercise_history; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_exercise_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    exercise_name character varying(255) NOT NULL,
    exercise_key character varying(255) NOT NULL,
    reps text,
    series integer,
    duration_seconds integer,
    load_kg numeric(6,2),
    session_id bigint,
    plan_id bigint,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.user_exercise_history OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 26986)
-- Name: user_exercise_history_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_exercise_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_exercise_history_id_seq OWNER TO postgres;

--
-- TOC entry 6003 (class 0 OID 0)
-- Dependencies: 249
-- Name: user_exercise_history_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_exercise_history_id_seq OWNED BY app.user_exercise_history.id;


--
-- TOC entry 217 (class 1259 OID 26580)
-- Name: users; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nombre character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    edad integer,
    sexo character varying(20),
    peso numeric(5,2),
    altura numeric(5,2),
    nivel_actividad character varying(50),
    "años_entrenando" integer,
    grasa_corporal numeric(5,2),
    masa_muscular numeric(5,2),
    agua_corporal numeric(5,2),
    metabolismo_basal integer,
    cintura numeric(5,2),
    cuello numeric(5,2),
    cadera numeric(5,2),
    pecho numeric(5,2),
    brazo numeric(5,2),
    muslo numeric(5,2),
    metodologia character varying(50),
    enfoque character varying(50),
    horario_preferido character varying(50),
    objetivo_principal character varying(50),
    meta_peso numeric(5,2),
    meta_grasa numeric(5,2),
    historial_medico_docs jsonb DEFAULT '[]'::jsonb,
    alergias text[],
    medicamentos text[],
    suplementacion text[],
    alimentos_evitar text[],
    apellido character varying(100) NOT NULL,
    nivel_entrenamiento character varying(50) DEFAULT 'principiante'::character varying,
    anos_entrenando integer DEFAULT 0,
    frecuencia_semanal integer,
    metodologia_preferida character varying(100),
    brazos numeric(5,2),
    muslos numeric(5,2),
    antebrazos numeric(5,2),
    historial_medico text,
    limitaciones_fisicas text[],
    meta_grasa_corporal numeric(4,2),
    enfoque_entrenamiento character varying(50),
    comidas_por_dia integer,
    alimentos_excluidos text[],
    last_login timestamp with time zone,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    lesiones text[],
    CONSTRAINT chk_anos_entrenando_nonneg CHECK ((anos_entrenando >= 0)),
    CONSTRAINT chk_frecuencia_semanal_range CHECK (((frecuencia_semanal >= 0) AND (frecuencia_semanal <= 7))),
    CONSTRAINT users_anos_entrenando_chk CHECK ((anos_entrenando >= 0)),
    CONSTRAINT users_enfoque_check CHECK (((enfoque)::text = ANY ((ARRAY['fuerza'::character varying, 'hipertrofia'::character varying, 'resistencia'::character varying, 'perdida_peso'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT users_horario_preferido_check CHECK (((horario_preferido)::text = ANY ((ARRAY['mañana'::character varying, 'media_mañana'::character varying, 'tarde'::character varying, 'noche'::character varying])::text[]))),
    CONSTRAINT users_metodologia_check CHECK (((metodologia)::text = ANY ((ARRAY['tradicional'::character varying, 'funcional'::character varying, 'crossfit'::character varying, 'calistenia'::character varying, 'powerlifting'::character varying, 'bodybuilding'::character varying])::text[]))),
    CONSTRAINT users_nivel_actividad_check CHECK (((nivel_actividad)::text = ANY ((ARRAY['sedentario'::character varying, 'ligero'::character varying, 'moderado'::character varying, 'activo'::character varying, 'muy_activo'::character varying])::text[]))),
    CONSTRAINT users_objetivo_principal_check CHECK (((objetivo_principal)::text = ANY ((ARRAY['ganar_peso'::character varying, 'rehabilitacion'::character varying, 'perder_peso'::character varying, 'tonificar'::character varying, 'ganar_masa_muscular'::character varying, 'mejorar_resistencia'::character varying, 'mejorar_flexibilidad'::character varying, 'salud_general'::character varying, 'mantenimiento'::character varying])::text[]))),
    CONSTRAINT users_sexo_check CHECK (((sexo)::text = ANY ((ARRAY['masculino'::character varying, 'femenino'::character varying])::text[])))
);


ALTER TABLE app.users OWNER TO postgres;

--
-- TOC entry 6004 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.nivel_entrenamiento; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.users.nivel_entrenamiento IS 'Nivel de entrenamiento del usuario: principiante, intermedio, avanzado';


--
-- TOC entry 276 (class 1259 OID 27329)
-- Name: user_exercise_stats; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.user_exercise_stats AS
 SELECT u.id AS user_id,
    u.nombre AS user_name,
    eh.methodology_type,
    eh.exercise_name,
    count(*) AS total_uses,
    max(eh.used_at) AS last_used,
    min(eh.used_at) AS first_used,
    EXTRACT(days FROM (CURRENT_TIMESTAMP - (max(eh.used_at))::timestamp with time zone)) AS days_since_last_use
   FROM (app.users u
     JOIN app.exercise_history eh ON ((u.id = eh.user_id)))
  GROUP BY u.id, u.nombre, eh.methodology_type, eh.exercise_name
  ORDER BY u.id, eh.methodology_type, (count(*)) DESC;


ALTER VIEW app.user_exercise_stats OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 26776)
-- Name: user_home_training_stats; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_home_training_stats (
    id integer NOT NULL,
    user_id integer,
    total_sessions integer DEFAULT 0,
    total_duration_seconds integer DEFAULT 0,
    current_streak_days integer DEFAULT 0,
    longest_streak_days integer DEFAULT 0,
    last_training_date date,
    favorite_equipment character varying(20),
    favorite_training_type character varying(20),
    total_exercises_completed integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.user_home_training_stats OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 26775)
-- Name: user_home_training_stats_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_home_training_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_home_training_stats_id_seq OWNER TO postgres;

--
-- TOC entry 6005 (class 0 OID 0)
-- Dependencies: 234
-- Name: user_home_training_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_home_training_stats_id_seq OWNED BY app.user_home_training_stats.id;


--
-- TOC entry 248 (class 1259 OID 26947)
-- Name: user_limitaciones; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_limitaciones (
    user_id integer NOT NULL,
    limitacion text NOT NULL
);


ALTER TABLE app.user_limitaciones OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 26908)
-- Name: user_medicamentos; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_medicamentos (
    user_id integer NOT NULL,
    medicamento text NOT NULL
);


ALTER TABLE app.user_medicamentos OWNER TO postgres;

--
-- TOC entry 326 (class 1259 OID 28077)
-- Name: user_personalized_equipment; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_personalized_equipment (
    id integer NOT NULL,
    user_id integer NOT NULL,
    equipment_name character varying(100) NOT NULL,
    equipment_key character varying(120) GENERATED ALWAYS AS (lower(regexp_replace((equipment_name)::text, '[^a-z0-9]+'::text, '_'::text, 'g'::text))) STORED,
    category character varying(50),
    attributes jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.user_personalized_equipment OWNER TO postgres;

--
-- TOC entry 6006 (class 0 OID 0)
-- Dependencies: 326
-- Name: TABLE user_personalized_equipment; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.user_personalized_equipment IS 'Equipamiento personalizado por usuario para usar en la combinación "personalizado".';


--
-- TOC entry 325 (class 1259 OID 28076)
-- Name: user_personalized_equipment_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_personalized_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_personalized_equipment_id_seq OWNER TO postgres;

--
-- TOC entry 6007 (class 0 OID 0)
-- Dependencies: 325
-- Name: user_personalized_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_personalized_equipment_id_seq OWNED BY app.user_personalized_equipment.id;


--
-- TOC entry 307 (class 1259 OID 27812)
-- Name: user_profiles; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    objetivo_principal character varying(100),
    metodologia_preferida character varying(50),
    limitaciones_fisicas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    music_config jsonb DEFAULT '{"repeat": "none", "volume": 0.5, "shuffle": false, "spotify": {"enabled": false, "connected": false}, "youtube": {"enabled": false, "connected": false}, "autoplay": false, "localFiles": {"path": "", "enabled": true}}'::jsonb
);


ALTER TABLE app.user_profiles OWNER TO postgres;

--
-- TOC entry 6008 (class 0 OID 0)
-- Dependencies: 307
-- Name: TABLE user_profiles; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.user_profiles IS 'Perfiles extendidos de usuarios con información detallada para IA';


--
-- TOC entry 6009 (class 0 OID 0)
-- Dependencies: 307
-- Name: COLUMN user_profiles.user_id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.user_profiles.user_id IS 'Referencia al usuario en la tabla users';


--
-- TOC entry 6010 (class 0 OID 0)
-- Dependencies: 307
-- Name: COLUMN user_profiles.objetivo_principal; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.user_profiles.objetivo_principal IS 'Objetivo principal del entrenamiento';


--
-- TOC entry 6011 (class 0 OID 0)
-- Dependencies: 307
-- Name: COLUMN user_profiles.limitaciones_fisicas; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.user_profiles.limitaciones_fisicas IS 'Limitaciones físicas o lesiones';


--
-- TOC entry 6012 (class 0 OID 0)
-- Dependencies: 307
-- Name: COLUMN user_profiles.music_config; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.user_profiles.music_config IS 'Configuración de música del usuario en formato JSON';


--
-- TOC entry 306 (class 1259 OID 27811)
-- Name: user_profiles_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.user_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.user_profiles_id_seq OWNER TO postgres;

--
-- TOC entry 6013 (class 0 OID 0)
-- Dependencies: 306
-- Name: user_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.user_profiles_id_seq OWNED BY app.user_profiles.id;


--
-- TOC entry 285 (class 1259 OID 27448)
-- Name: user_routine_stats; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.user_routine_stats AS
 SELECT u.id AS user_id,
    u.nombre AS user_name,
    count(DISTINCT rp.id) AS total_routines_generated,
    count(DISTINCT
        CASE
            WHEN ((rs.status)::text = 'completed'::text) THEN rs.id
            ELSE NULL::integer
        END) AS completed_sessions,
    count(DISTINCT
        CASE
            WHEN ((rep.status)::text = 'completed'::text) THEN rep.id
            ELSE NULL::integer
        END) AS completed_exercises,
    count(DISTINCT ref.id) AS total_feedback_given,
    count(DISTINCT
        CASE
            WHEN ((ref.sentiment)::text = 'love'::text) THEN ref.id
            ELSE NULL::integer
        END) AS loved_exercises,
    count(DISTINCT
        CASE
            WHEN ((ref.sentiment)::text = 'hard'::text) THEN ref.id
            ELSE NULL::integer
        END) AS hard_exercises,
    avg(
        CASE
            WHEN ((rs.status)::text = 'completed'::text) THEN rs.total_duration_seconds
            ELSE NULL::integer
        END) AS avg_session_duration_seconds,
    max(rs.completed_at) AS last_workout_date
   FROM ((((app.users u
     LEFT JOIN app.routine_plans rp ON ((u.id = rp.user_id)))
     LEFT JOIN app.routine_sessions rs ON ((rp.id = rs.routine_plan_id)))
     LEFT JOIN app.routine_exercise_progress rep ON ((rs.id = rep.routine_session_id)))
     LEFT JOIN app.routine_exercise_feedback ref ON ((rs.id = ref.routine_session_id)))
  GROUP BY u.id, u.nombre
  ORDER BY u.id;


ALTER VIEW app.user_routine_stats OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 26934)
-- Name: user_suplementos; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.user_suplementos (
    user_id integer NOT NULL,
    suplemento text NOT NULL
);


ALTER TABLE app.user_suplementos OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 26579)
-- Name: users_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.users_id_seq OWNER TO postgres;

--
-- TOC entry 6014 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.users_id_seq OWNED BY app.users.id;


--
-- TOC entry 252 (class 1259 OID 27085)
-- Name: v_hist_propuesto; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_hist_propuesto AS
 SELECT p.id AS plan_id,
    p.user_id,
    p.created_at,
    (x.value ->> 'nombre'::text) AS exercise_name,
    lower(regexp_replace((x.value ->> 'nombre'::text), '[^a-z0-9]+'::text, '_'::text, 'g'::text)) AS exercise_key
   FROM (app.home_training_plans p
     CROSS JOIN LATERAL jsonb_array_elements(((p.plan_data -> 'plan_entrenamiento'::text) -> 'ejercicios'::text)) x(value));


ALTER VIEW app.v_hist_propuesto OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 27081)
-- Name: v_hist_real; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_hist_real AS
 SELECT id,
    user_id,
    created_at,
    exercise_name,
    COALESCE(exercise_key, (lower(regexp_replace((exercise_name)::text, '[^a-z0-9]+'::text, '_'::text, 'g'::text)))::character varying) AS exercise_key,
    series,
    duration_seconds,
    session_id,
    plan_id
   FROM app.user_exercise_history;


ALTER VIEW app.v_hist_real OWNER TO postgres;

--
-- TOC entry 324 (class 1259 OID 28071)
-- Name: v_home_combinations_dashboard; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_home_combinations_dashboard AS
 SELECT c.id,
    c.combination_code,
    c.display_name,
    c.equipment_type,
    c.training_type,
    c.difficulty_level,
    c.equipment_list,
    c.focus_areas,
    count(DISTINCT h.user_id) AS total_users_used,
    count(h.id) AS total_exercise_instances,
    count(DISTINCT h.exercise_name) AS unique_exercises_recorded,
    avg(h.times_used) AS avg_times_per_exercise,
    max(h.last_used_at) AS most_recent_use,
    count(
        CASE
            WHEN ((h.user_rating)::text = 'love'::text) THEN 1
            ELSE NULL::integer
        END) AS love_count,
    count(
        CASE
            WHEN ((h.user_rating)::text = 'hard'::text) THEN 1
            ELSE NULL::integer
        END) AS hard_count,
    count(
        CASE
            WHEN ((h.user_rating)::text = 'dislike'::text) THEN 1
            ELSE NULL::integer
        END) AS dislike_count,
    count(DISTINCT h.session_id) AS total_sessions
   FROM (app.home_training_combinations c
     LEFT JOIN app.home_combination_exercise_history h ON ((c.id = h.combination_id)))
  GROUP BY c.id, c.combination_code, c.display_name, c.equipment_type, c.training_type, c.difficulty_level, c.equipment_list, c.focus_areas
  ORDER BY c.equipment_type, c.training_type;


ALTER VIEW app.v_home_combinations_dashboard OWNER TO postgres;

--
-- TOC entry 6015 (class 0 OID 0)
-- Dependencies: 324
-- Name: VIEW v_home_combinations_dashboard; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.v_home_combinations_dashboard IS 'Dashboard analítico de las 12 combinaciones';


--
-- TOC entry 317 (class 1259 OID 27940)
-- Name: v_home_hist_propuesto; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_home_hist_propuesto AS
 SELECT p.id AS plan_id,
    p.user_id,
    p.created_at,
    (x.value ->> 'nombre'::text) AS exercise_name,
    lower(regexp_replace((x.value ->> 'nombre'::text), '[^a-z0-9]+'::text, '_'::text, 'g'::text)) AS exercise_key
   FROM (app.home_training_plans p
     CROSS JOIN LATERAL jsonb_array_elements(((p.plan_data -> 'plan_entrenamiento'::text) -> 'ejercicios'::text)) x(value));


ALTER VIEW app.v_home_hist_propuesto OWNER TO postgres;

--
-- TOC entry 6016 (class 0 OID 0)
-- Dependencies: 317
-- Name: VIEW v_home_hist_propuesto; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.v_home_hist_propuesto IS 'Ejercicios propuestos en planes de entrenamiento en casa';


--
-- TOC entry 316 (class 1259 OID 27936)
-- Name: v_home_hist_real; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_home_hist_real AS
 SELECT id,
    user_id,
    created_at,
    exercise_name,
    COALESCE(exercise_key, (lower(regexp_replace((exercise_name)::text, '[^a-z0-9]+'::text, '_'::text, 'g'::text)))::character varying) AS exercise_key,
    series,
    duration_seconds,
    session_id,
    plan_id
   FROM app.home_exercise_history;


ALTER VIEW app.v_home_hist_real OWNER TO postgres;

--
-- TOC entry 6017 (class 0 OID 0)
-- Dependencies: 316
-- Name: VIEW v_home_hist_real; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.v_home_hist_real IS 'Historial real de ejercicios completados en entrenamiento en casa';


--
-- TOC entry 327 (class 1259 OID 28111)
-- Name: v_latest_exercise_feedback; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_latest_exercise_feedback AS
 SELECT DISTINCT ON (user_id, session_id, exercise_order) user_id,
    session_id,
    exercise_order,
    exercise_name,
    exercise_key,
    sentiment,
    comment,
    created_at
   FROM app.user_exercise_feedback uf
  ORDER BY user_id, session_id, exercise_order, created_at DESC;


ALTER VIEW app.v_latest_exercise_feedback OWNER TO postgres;

--
-- TOC entry 6018 (class 0 OID 0)
-- Dependencies: 327
-- Name: VIEW v_latest_exercise_feedback; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.v_latest_exercise_feedback IS 'Último feedback del usuario por ejercicio de la sesión (comentario y sentiment opcional).';


--
-- TOC entry 318 (class 1259 OID 27945)
-- Name: v_routine_hist_propuesto; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_routine_hist_propuesto AS
 SELECT p.id AS plan_id,
    p.user_id,
    p.created_at,
    (x.value ->> 'nombre'::text) AS exercise_name,
    lower(regexp_replace((x.value ->> 'nombre'::text), '[^a-z0-9]+'::text, '_'::text, 'g'::text)) AS exercise_key
   FROM (app.methodology_plans p
     CROSS JOIN LATERAL jsonb_array_elements(((p.plan_data -> 'plan_entrenamiento'::text) -> 'ejercicios'::text)) x(value));


ALTER VIEW app.v_routine_hist_propuesto OWNER TO postgres;

--
-- TOC entry 6019 (class 0 OID 0)
-- Dependencies: 318
-- Name: VIEW v_routine_hist_propuesto; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.v_routine_hist_propuesto IS 'Ejercicios propuestos en planes de metodologías';


--
-- TOC entry 319 (class 1259 OID 27952)
-- Name: v_routine_hist_real; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_routine_hist_real AS
 SELECT id,
    user_id,
    used_at AS created_at,
    exercise_name,
    (lower(regexp_replace((exercise_name)::text, '[^a-z0-9]+'::text, '_'::text, 'g'::text)))::character varying AS exercise_key,
    methodology_type,
    plan_id,
    week_number,
    day_name
   FROM app.exercise_history;


ALTER VIEW app.v_routine_hist_real OWNER TO postgres;

--
-- TOC entry 315 (class 1259 OID 27932)
-- Name: v_template_stats; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_template_stats AS
 SELECT equipment_type,
    training_type,
    template_name,
    usage_count,
    is_active,
    created_at,
        CASE
            WHEN (usage_count = 0) THEN 'Nunca usado'::text
            WHEN (usage_count < 10) THEN 'Poco usado'::text
            WHEN (usage_count < 50) THEN 'Moderadamente usado'::text
            ELSE 'Muy usado'::text
        END AS usage_level
   FROM app.home_training_templates
  ORDER BY usage_count DESC, equipment_type, training_type;


ALTER VIEW app.v_template_stats OWNER TO postgres;

--
-- TOC entry 293 (class 1259 OID 27559)
-- Name: v_user_methodology_profile; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_user_methodology_profile AS
 SELECT id,
    nombre,
    apellido,
    email,
    edad,
    sexo,
    peso,
    altura,
    nivel_actividad,
    objetivo_principal,
    medicamentos,
    suplementacion,
    grasa_corporal,
    masa_muscular,
    pecho,
    brazos,
    COALESCE(nivel_entrenamiento, nivel_actividad, 'principiante'::character varying) AS nivel_normalizado,
    COALESCE(anos_entrenando, "años_entrenando", 0) AS anos_entrenamiento_normalizado,
        CASE
            WHEN ((COALESCE(anos_entrenando, "años_entrenando", 0) >= 5) OR ((COALESCE(nivel_entrenamiento, nivel_actividad))::text = ANY ((ARRAY['avanzado'::character varying, 'competicion'::character varying])::text[]))) THEN 'avanzado'::text
            WHEN ((COALESCE(anos_entrenando, "años_entrenando", 0) >= 2) OR ((COALESCE(nivel_entrenamiento, nivel_actividad))::text = 'intermedio'::text)) THEN 'intermedio'::text
            ELSE 'principiante'::text
        END AS nivel_calculado,
        CASE
            WHEN ((COALESCE(anos_entrenando, "años_entrenando", 0) >= 5) OR ((COALESCE(nivel_entrenamiento, nivel_actividad))::text = ANY ((ARRAY['avanzado'::character varying, 'competicion'::character varying])::text[]))) THEN 'strict'::text
            WHEN ((COALESCE(anos_entrenando, "años_entrenando", 0) >= 2) AND ((COALESCE(nivel_entrenamiento, nivel_actividad))::text = 'intermedio'::text)) THEN 'strict'::text
            ELSE 'adapted'::text
        END AS version_recomendada,
        CASE
            WHEN ((COALESCE(anos_entrenando, "años_entrenando", 0) >= 5) OR ((COALESCE(nivel_entrenamiento, nivel_actividad))::text = 'avanzado'::text)) THEN 6
            WHEN ((COALESCE(anos_entrenando, "años_entrenando", 0) >= 2) OR ((COALESCE(nivel_entrenamiento, nivel_actividad))::text = 'intermedio'::text)) THEN 5
            ELSE 4
        END AS semanas_recomendadas,
    nivel_entrenamiento AS nivel_declarado,
    anos_entrenando AS anos_declarados_nuevo,
    "años_entrenando" AS anos_declarados_viejo,
    CURRENT_TIMESTAMP AS vista_actualizada
   FROM app.users u
  WHERE (is_active = true);


ALTER VIEW app.v_user_methodology_profile OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 27090)
-- Name: v_user_profile_normalized; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.v_user_profile_normalized AS
 SELECT id,
    nombre,
    apellido,
    email,
    edad,
    sexo,
    peso,
    altura,
    COALESCE(nivel_entrenamiento, nivel_actividad) AS nivel,
    COALESCE(anos_entrenando, "años_entrenando") AS anos_entrenando,
    objetivo_principal,
    alergias,
    medicamentos,
    suplementacion,
    COALESCE(alimentos_excluidos, alimentos_evitar) AS alimentos_excluidos,
    COALESCE(lesiones, limitaciones_fisicas) AS limitaciones_fisicas,
    COALESCE(lesiones, limitaciones_fisicas) AS lesiones
   FROM app.users;


ALTER VIEW app.v_user_profile_normalized OWNER TO postgres;

--
-- TOC entry 312 (class 1259 OID 27910)
-- Name: vw_home_exercise_history; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.vw_home_exercise_history AS
 SELECT id,
    user_id,
    exercise_name,
    exercise_key,
    plan_id,
    session_id,
    created_at AS used_at
   FROM app.home_exercise_history
  ORDER BY created_at DESC;


ALTER VIEW app.vw_home_exercise_history OWNER TO postgres;

--
-- TOC entry 289 (class 1259 OID 27474)
-- Name: vw_home_exercise_progress; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.vw_home_exercise_progress AS
 SELECT hep.id,
    hts.user_id,
    hts.id AS home_session_id,
    hep.exercise_order,
    hep.exercise_name,
    hep.series_completed,
    hep.total_series,
    hep.duration_seconds,
    hep.status,
    hts.started_at,
    hts.completed_at
   FROM (app.home_training_sessions hts
     JOIN app.home_exercise_progress hep ON ((hep.home_training_session_id = hts.id)));


ALTER VIEW app.vw_home_exercise_progress OWNER TO postgres;

--
-- TOC entry 6020 (class 0 OID 0)
-- Dependencies: 289
-- Name: VIEW vw_home_exercise_progress; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.vw_home_exercise_progress IS 'Per-exercise progress for Home sessions. No methodology columns present.';


--
-- TOC entry 287 (class 1259 OID 27466)
-- Name: vw_home_plans_overview; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.vw_home_plans_overview AS
 SELECT id AS home_plan_id,
    user_id,
    equipment_type,
    training_type,
    created_at,
    updated_at
   FROM app.home_training_plans htp;


ALTER VIEW app.vw_home_plans_overview OWNER TO postgres;

--
-- TOC entry 6021 (class 0 OID 0)
-- Dependencies: 287
-- Name: VIEW vw_home_plans_overview; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.vw_home_plans_overview IS 'Home training plans only. No methodology data included.';


--
-- TOC entry 288 (class 1259 OID 27470)
-- Name: vw_methodology_exercise_history; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.vw_methodology_exercise_history AS
 SELECT id,
    user_id,
    exercise_name,
    methodology_type,
    plan_id,
    week_number,
    day_name,
    used_at
   FROM app.exercise_history eh;


ALTER VIEW app.vw_methodology_exercise_history OWNER TO postgres;

--
-- TOC entry 6022 (class 0 OID 0)
-- Dependencies: 288
-- Name: VIEW vw_methodology_exercise_history; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.vw_methodology_exercise_history IS 'Exercise usage history per methodology. Separate from home session progress.';


--
-- TOC entry 286 (class 1259 OID 27462)
-- Name: vw_methodology_plans_overview; Type: VIEW; Schema: app; Owner: postgres
--

CREATE VIEW app.vw_methodology_plans_overview AS
 SELECT id AS plan_id,
    user_id,
    methodology_type,
    generation_mode,
    total_weeks,
    frequency_per_week,
    created_at,
    updated_at
   FROM app.routine_plans rp;


ALTER VIEW app.vw_methodology_plans_overview OWNER TO postgres;

--
-- TOC entry 6023 (class 0 OID 0)
-- Dependencies: 286
-- Name: VIEW vw_methodology_plans_overview; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON VIEW app.vw_methodology_plans_overview IS 'Routine plans for Methodologies (gym/street). No home-training data included.';


--
-- TOC entry 5126 (class 2604 OID 27239)
-- Name: body_composition_history id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.body_composition_history ALTER COLUMN id SET DEFAULT nextval('app.body_composition_history_id_seq'::regclass);


--
-- TOC entry 5180 (class 2604 OID 27620)
-- Name: daily_nutrition_log id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.daily_nutrition_log ALTER COLUMN id SET DEFAULT nextval('app.daily_nutrition_log_id_seq'::regclass);


--
-- TOC entry 5108 (class 2604 OID 27124)
-- Name: equipment_catalog id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.equipment_catalog ALTER COLUMN id SET DEFAULT nextval('app.equipment_catalog_id_seq'::regclass);


--
-- TOC entry 5220 (class 2604 OID 27839)
-- Name: exercise_ai_info id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_ai_info ALTER COLUMN id SET DEFAULT nextval('app.exercise_ai_info_id_seq'::regclass);


--
-- TOC entry 5137 (class 2604 OID 27295)
-- Name: exercise_history id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_history ALTER COLUMN id SET DEFAULT nextval('app.exercise_history_id_seq'::regclass);


--
-- TOC entry 5139 (class 2604 OID 27314)
-- Name: exercise_repetition_policy id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_repetition_policy ALTER COLUMN id SET DEFAULT nextval('app.exercise_repetition_policy_id_seq'::regclass);


--
-- TOC entry 5118 (class 2604 OID 27204)
-- Name: exercises_catalog id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercises_catalog ALTER COLUMN id SET DEFAULT nextval('app.exercises_catalog_id_seq'::regclass);


--
-- TOC entry 5188 (class 2604 OID 27645)
-- Name: food_database id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.food_database ALTER COLUMN id SET DEFAULT nextval('app.food_database_id_seq'::regclass);


--
-- TOC entry 5236 (class 2604 OID 28041)
-- Name: home_combination_exercise_history id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_combination_exercise_history ALTER COLUMN id SET DEFAULT nextval('app.home_combination_exercise_history_id_seq'::regclass);


--
-- TOC entry 5224 (class 2604 OID 27883)
-- Name: home_exercise_history id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_history ALTER COLUMN id SET DEFAULT nextval('app.home_exercise_history_id_seq'::regclass);


--
-- TOC entry 5091 (class 2604 OID 26763)
-- Name: home_exercise_progress id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_progress ALTER COLUMN id SET DEFAULT nextval('app.home_exercise_progress_id_seq'::regclass);


--
-- TOC entry 5232 (class 2604 OID 27995)
-- Name: home_training_combinations id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_combinations ALTER COLUMN id SET DEFAULT nextval('app.home_training_combinations_id_seq'::regclass);


--
-- TOC entry 5082 (class 2604 OID 26723)
-- Name: home_training_plans id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_plans ALTER COLUMN id SET DEFAULT nextval('app.home_training_plans_id_seq'::regclass);


--
-- TOC entry 5085 (class 2604 OID 26739)
-- Name: home_training_sessions id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_sessions ALTER COLUMN id SET DEFAULT nextval('app.home_training_sessions_id_seq'::regclass);


--
-- TOC entry 5226 (class 2604 OID 27918)
-- Name: home_training_templates id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_templates ALTER COLUMN id SET DEFAULT nextval('app.home_training_templates_id_seq'::regclass);


--
-- TOC entry 5113 (class 2604 OID 27184)
-- Name: medical_documents id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.medical_documents ALTER COLUMN id SET DEFAULT nextval('app.medical_documents_id_seq'::regclass);


--
-- TOC entry 5258 (class 2604 OID 28173)
-- Name: methodology_exercise_feedback id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_feedback ALTER COLUMN id SET DEFAULT nextval('app.methodology_exercise_feedback_id_seq'::regclass);


--
-- TOC entry 5261 (class 2604 OID 28264)
-- Name: methodology_exercise_history_complete id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_history_complete ALTER COLUMN id SET DEFAULT nextval('app.methodology_exercise_history_complete_id_seq'::regclass);


--
-- TOC entry 5253 (class 2604 OID 28147)
-- Name: methodology_exercise_progress id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_progress ALTER COLUMN id SET DEFAULT nextval('app.methodology_exercise_progress_id_seq'::regclass);


--
-- TOC entry 5246 (class 2604 OID 28121)
-- Name: methodology_exercise_sessions id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_sessions ALTER COLUMN id SET DEFAULT nextval('app.methodology_exercise_sessions_id_seq'::regclass);


--
-- TOC entry 5130 (class 2604 OID 27267)
-- Name: methodology_plans id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_plans ALTER COLUMN id SET DEFAULT nextval('app.methodology_plans_id_seq'::regclass);


--
-- TOC entry 5212 (class 2604 OID 27742)
-- Name: music_playlists id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.music_playlists ALTER COLUMN id SET DEFAULT nextval('app.music_playlists_id_seq'::regclass);


--
-- TOC entry 5206 (class 2604 OID 27688)
-- Name: nutrition_goals id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.nutrition_goals ALTER COLUMN id SET DEFAULT nextval('app.nutrition_goals_id_seq'::regclass);


--
-- TOC entry 5172 (class 2604 OID 27596)
-- Name: nutrition_plans id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.nutrition_plans ALTER COLUMN id SET DEFAULT nextval('app.nutrition_plans_id_seq'::regclass);


--
-- TOC entry 5165 (class 2604 OID 27408)
-- Name: routine_exercise_feedback id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_feedback ALTER COLUMN id SET DEFAULT nextval('app.routine_exercise_feedback_id_seq'::regclass);


--
-- TOC entry 5158 (class 2604 OID 27383)
-- Name: routine_exercise_progress id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_progress ALTER COLUMN id SET DEFAULT nextval('app.routine_exercise_progress_id_seq'::regclass);


--
-- TOC entry 5145 (class 2604 OID 27339)
-- Name: routine_plans id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_plans ALTER COLUMN id SET DEFAULT nextval('app.routine_plans_id_seq'::regclass);


--
-- TOC entry 5150 (class 2604 OID 27357)
-- Name: routine_sessions id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_sessions ALTER COLUMN id SET DEFAULT nextval('app.routine_sessions_id_seq'::regclass);


--
-- TOC entry 5201 (class 2604 OID 27667)
-- Name: supplement_recommendations id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.supplement_recommendations ALTER COLUMN id SET DEFAULT nextval('app.supplement_recommendations_id_seq'::regclass);


--
-- TOC entry 5123 (class 2604 OID 27221)
-- Name: technique_analysis id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.technique_analysis ALTER COLUMN id SET DEFAULT nextval('app.technique_analysis_id_seq'::regclass);


--
-- TOC entry 5111 (class 2604 OID 27150)
-- Name: user_custom_equipment id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_custom_equipment ALTER COLUMN id SET DEFAULT nextval('app.user_custom_equipment_id_seq'::regclass);


--
-- TOC entry 5168 (class 2604 OID 27506)
-- Name: user_daily_activity id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_daily_activity ALTER COLUMN id SET DEFAULT nextval('app.user_daily_activity_id_seq'::regclass);


--
-- TOC entry 5106 (class 2604 OID 27103)
-- Name: user_exercise_feedback id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_feedback ALTER COLUMN id SET DEFAULT nextval('app.user_exercise_feedback_id_seq'::regclass);


--
-- TOC entry 5104 (class 2604 OID 26990)
-- Name: user_exercise_history id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_history ALTER COLUMN id SET DEFAULT nextval('app.user_exercise_history_id_seq'::regclass);


--
-- TOC entry 5096 (class 2604 OID 26779)
-- Name: user_home_training_stats id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_home_training_stats ALTER COLUMN id SET DEFAULT nextval('app.user_home_training_stats_id_seq'::regclass);


--
-- TOC entry 5241 (class 2604 OID 28080)
-- Name: user_personalized_equipment id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_personalized_equipment ALTER COLUMN id SET DEFAULT nextval('app.user_personalized_equipment_id_seq'::regclass);


--
-- TOC entry 5216 (class 2604 OID 27815)
-- Name: user_profiles id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_profiles ALTER COLUMN id SET DEFAULT nextval('app.user_profiles_id_seq'::regclass);


--
-- TOC entry 5074 (class 2604 OID 26583)
-- Name: users id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users ALTER COLUMN id SET DEFAULT nextval('app.users_id_seq'::regclass);


--
-- TOC entry 5839 (class 0 OID 27236)
-- Dependencies: 269
-- Data for Name: body_composition_history; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.body_composition_history (id, user_id, measurement_date, peso, grasa_corporal, masa_muscular, agua_corporal, metabolismo_basal, imc, cintura, cuello, cadera, calculation_method, notes, created_at) FROM stdin;
1	10	2025-08-26 22:16:46.526612+02	76.00	22.10	59.20	60.00	1752	\N	90.00	34.00	\N	us_navy	Actualización automática desde calculadora	2025-08-26 22:16:46.526612+02
\.


--
-- TOC entry 5859 (class 0 OID 27617)
-- Dependencies: 297
-- Data for Name: daily_nutrition_log; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.daily_nutrition_log (id, user_id, log_date, daily_log, calories, protein, carbs, fat, fiber, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5827 (class 0 OID 27121)
-- Dependencies: 257
-- Data for Name: equipment_catalog; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.equipment_catalog (id, code, name, category, icon, active) FROM stdin;
1	dumbbell	Mancuernas	strength	\N	t
2	kettlebell	Kettlebells	strength	\N	t
3	trx	TRX	accessories	\N	t
4	elastic_bands	Bandas elásticas	accessories	\N	t
5	mat	Esterilla	accessories	\N	t
6	bench	Banco	strength	\N	t
7	pull_up_bar	Barra de dominadas	strength	\N	t
8	jump_rope	Cuerda de saltar	cardio	\N	t
9	toallas	Toallas	\N	\N	t
10	silla_sofa	Silla/Sofá	\N	\N	t
11	esterilla	Esterilla	\N	\N	t
12	bandas_elasticas	Bandas elásticas	\N	\N	t
13	mancuernas	Mancuernas ajustables	\N	\N	t
14	banco_step	Banco/Step	\N	\N	t
16	discos_olimpicos	Barra con discos profesionales	\N	\N	t
\.


--
-- TOC entry 5831 (class 0 OID 27163)
-- Dependencies: 261
-- Data for Name: equipment_items; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.equipment_items (key, label, level) FROM stdin;
toallas	Toallas	minimo
silla_sofa	Silla/Sofá	minimo
esterilla	Esterilla	basico
bandas_elasticas	Bandas elásticas	basico
mancuernas	Mancuernas ajustables	basico
banco_step	Banco/Step	basico
trx	TRX	avanzado
discos_olimpicos	Barra con discos profesionales	avanzado
\.


--
-- TOC entry 5871 (class 0 OID 27836)
-- Dependencies: 309
-- Data for Name: exercise_ai_info; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.exercise_ai_info (id, exercise_name, ejecucion, consejos, errores_evitar, created_at, updated_at, exercise_name_normalized, first_requested_by, request_count) FROM stdin;
3	Burpees con salto y toque de rodillas	Comienza de pie con los pies a la anchura de los hombros. Flexiona las rodillas y coloca las manos en el suelo frente a ti. Salta con los pies hacia atrás para quedar en posición de plancha, realizando una flexión de pecho si deseas. Luego, salta con los pies hacia adelante, acercándolos a las manos. Desde esa posición, realiza un salto explosivo hacia arriba, levantando los brazos por encima de la cabeza. Al aterrizar, toca las rodillas con las manos y vuelve a la posición inicial para comenzar otra repetición.	Mantén el core activado durante todo el ejercicio para proteger la espalda. Realiza los movimientos de forma controlada y fluida. Asegúrate de aterrizar suavemente para reducir el impacto en las articulaciones. Respira de manera constante, exhalando al saltar y al tocar las rodillas. Usa calzado adecuado para mayor estabilidad y protección.	No arquear excesivamente la espalda durante la plancha o el salto. Evitar que las rodillas toquen el suelo en la posición de plancha. No realizar movimientos rápidos sin control, lo que puede aumentar el riesgo de lesiones. No saltar con los pies demasiado separados o demasiado juntos, ya que puede afectar la estabilidad. No olvidar calentar antes de comenzar para prevenir lesiones musculares.	2025-08-28 12:06:02.015248	2025-08-28 12:06:02.015248	urpees con salto y toque de rodillas	10	1
1	Puente de Glúteos en la Pared	Para realizar el Puente de Glúteos en la Pared, colócate de espaldas a una pared y apoya la parte superior de la espalda y los hombros contra ella. Dobla las rodillas formando un ángulo de aproximadamente 90 grados y coloca los pies planos en el suelo, a la anchura de las caderas y lo más cerca posible de la pared. Mantén los brazos a los lados del cuerpo. Contrae los glúteos y los músculos del core, y empuja con los talones para levantar las caderas del suelo, elevando los glúteos hacia el techo. Mantén la posición unos segundos en la parte superior, asegurándote de no sobreextender la espalda, y luego baja lentamente las caderas hasta volver a la posición inicial. Repite el movimiento según el número de repeticiones planificado.	Mantén los pies firmemente apoyados en la pared y distribuye bien el peso en los talones para activar los glúteos. Asegúrate de mantener el abdomen contraído para estabilizar la pelvis y evitar que la espalda se arquee excesivamente. Realiza el movimiento de forma controlada, concentrándote en la contracción de los glúteos en la fase de elevación. Respira de manera constante, inhalando al bajar y exhalando al subir. Si tienes problemas de espalda, evita sobreextender la zona lumbar en la fase superior del ejercicio.	No levantar las caderas demasiado alto, lo que puede generar tensión en la zona lumbar. No usar un rango de movimiento incompleto, como no elevar las caderas lo suficiente. Evitar que las rodillas se abran o se cierren durante el movimiento, manteniéndolas alineadas con los pies. No usar un peso excesivo sin la técnica adecuada. Además, no realizar el ejercicio de forma rápida o con movimientos bruscos, ya que esto reduce su efectividad y aumenta el riesgo de lesión.	2025-08-28 09:54:26.183524	2025-08-28 09:56:03.825347	uente de luteos en la ared	10	3
5	Pike Push-Up (Flexión en V invertida para hombros)	Para realizar Pike Push-Up, comienza en una posición de flexión con las manos apoyadas en el suelo a la altura de los hombros y los pies elevados sobre una superficie elevada, formando una V invertida con el cuerpo. Mantén las piernas rectas y las caderas elevadas. Flexiona los codos y baja la cabeza hacia el suelo, asegurándote de que los codos apunten hacia los lados. Luego, empuja con las manos para extender los brazos y volver a la posición inicial, manteniendo el control en todo momento.	Mantén la espalda recta y las caderas elevadas durante todo el ejercicio para enfocarte en los hombros. No dejes que la cabeza toque el suelo; en su lugar, controla el movimiento y evita movimientos bruscos. Asegúrate de respirar correctamente: inhalar al bajar y exhalar al subir. Comienza con un ángulo cómodo y aumenta la inclinación progresivamente para evitar lesiones.	No arquear demasiado la espalda o dejar que las caderas caigan, ya que puede causar tensión en la zona lumbar. Evitar bajar demasiado la cabeza, lo que puede generar tensión en el cuello. No usar un ritmo demasiado rápido; realiza el movimiento de forma controlada. Además, no colocar las manos demasiado cercanas o demasiado alejadas, ya que esto puede afectar la estabilidad y la efectividad del ejercicio.	2025-08-28 12:12:35.969351	2025-08-28 12:12:35.969351	ike ushp lexion en  invertida para hombros	10	1
7	Estocadas Alternas con Toalla para Resistencia	Para realizar las Estocadas Alternas con Toalla, coloca una toalla enrollada o doblada en la parte superior de tus hombros, sujetándola con ambas manos para mantenerla en posición. Da un paso adelante con una pierna, bajando el cuerpo hasta que ambas rodillas formen ángulos de aproximadamente 90 grados, asegurándote de que la rodilla del pie adelantado no sobrepase los dedos del pie. Mantén el torso erguido y la espalda recta durante todo el movimiento. Empuja con el talón del pie adelantado para volver a la posición inicial y repite con la otra pierna, alternando en cada repetición. Realiza el número de repeticiones y series según tu plan de entrenamiento.	Mantén el core activado para mejorar la estabilidad y evitar lesiones. Asegúrate de que la toalla esté colocada de manera que te ayude a mantener una postura erguida y no te cause incomodidad. Controla la respiración, inhalando al bajar y exhalando al subir. Realiza movimientos controlados, evitando rebotes o movimientos bruscos. Usa un calzado adecuado para mayor estabilidad y comodidad.	No permitir que la rodilla del pie adelantado sobrepase los dedos para evitar lesiones en la articulación. No inclinarse hacia adelante o encorvar la espalda, lo que puede generar tensión en la zona lumbar. Realizar movimientos rápidos o sin control, que disminuyen la efectividad y aumentan el riesgo de lesiones. No mantener una postura estable, lo que puede afectar el equilibrio y la técnica correcta.	2025-08-28 12:27:00.660657	2025-08-28 12:27:00.660657	stocadas lternas con oalla para esistencia	10	1
9	Sentadilla búlgara	Para realizar la sentadilla búlgara, colócate de espaldas a un banco o superficie elevada. Apoya la parte superior de un pie sobre el banco, manteniendo la otra pierna firmemente en el suelo a una distancia cómoda. Con la espalda recta y el core activado, flexiona la rodilla de la pierna que está en el suelo, bajando el cuerpo lentamente hasta que la rodilla de esa pierna forme aproximadamente un ángulo de 90 grados. Asegúrate de que la rodilla no sobrepase los dedos del pie. Luego, empuja con el talón de esa pierna para volver a la posición inicial. Repite el movimiento durante las repeticiones deseadas y cambia de pierna.	Mantén la espalda recta en todo momento y evita que la rodilla de la pierna que trabaja se desplace hacia adelante más allá de los dedos del pie. Usa un peso adicional solo si dominas la técnica y tu fuerza lo permite. Controla la respiración, inhalando al bajar y exhalando al subir. Comienza con un peso corporal para perfeccionar la técnica antes de añadir carga adicional.	No permitir que la rodilla de la pierna que trabaja se desplaze hacia adelante, lo que puede causar lesiones. No inclinarse demasiado hacia adelante o encorvar la espalda. Bajar demasiado rápido, lo que puede generar pérdida de control y lesiones. No usar una superficie elevada inestable o que no soporte el peso, ya que puede causar caídas o lesiones.	2025-08-28 13:57:14.734851	2025-08-28 13:57:14.734851	entadilla bulgara	10	1
\.


--
-- TOC entry 5843 (class 0 OID 27292)
-- Dependencies: 273
-- Data for Name: exercise_history; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.exercise_history (id, user_id, exercise_name, methodology_type, used_at, plan_id, week_number, day_name) FROM stdin;
1	10	Dominadas	Calistenia	2025-08-25 15:47:35.943016	5	1	Lun
2	10	Fondos en paralelas	Calistenia	2025-08-25 15:47:35.943016	5	1	Lun
3	10	Flexiones con elevación de pies	Calistenia	2025-08-25 15:47:35.943016	5	1	Lun
4	10	Plancha lateral	Calistenia	2025-08-25 15:47:35.943016	5	1	Lun
5	10	Sentadilla a una pierna	Calistenia	2025-08-25 15:47:35.943016	5	1	Mar
6	10	Burpees	Calistenia	2025-08-25 15:47:35.943016	5	1	Mar
7	10	Remo invertido	Calistenia	2025-08-25 15:47:35.943016	5	1	Mar
8	10	Crunches	Calistenia	2025-08-25 15:47:35.943016	5	1	Mar
9	10	Muscle Up	Calistenia	2025-08-25 15:47:35.943016	5	1	Jue
10	10	Flexiones en anillas	Calistenia	2025-08-25 15:47:35.943016	5	1	Jue
11	10	Elevaciones de talones	Calistenia	2025-08-25 15:47:35.943016	5	1	Jue
12	10	Mountain climbers	Calistenia	2025-08-25 15:47:35.943016	5	1	Jue
13	10	Pike Push Ups	Calistenia	2025-08-25 15:47:35.943016	5	1	Vie
14	10	Zancadas alternas	Calistenia	2025-08-25 15:47:35.943016	5	1	Vie
15	10	Plancha dinámica	Calistenia	2025-08-25 15:47:35.943016	5	1	Vie
16	10	Leg Raises	Calistenia	2025-08-25 15:47:35.943016	5	1	Vie
17	10	Dominadas con agarre amplio	Calistenia	2025-08-25 15:47:35.943016	5	2	Lun
18	10	Fondos entre bancos	Calistenia	2025-08-25 15:47:35.943016	5	2	Lun
19	10	Flexiones con palmadas	Calistenia	2025-08-25 15:47:35.943016	5	2	Lun
20	10	Plancha con elevación de piernas	Calistenia	2025-08-25 15:47:35.943016	5	2	Lun
21	10	Sentadilla con salto	Calistenia	2025-08-25 15:47:35.943016	5	2	Mar
22	10	Burpees con salto en caja	Calistenia	2025-08-25 15:47:35.943016	5	2	Mar
23	10	Remo en TRX	Calistenia	2025-08-25 15:47:35.943016	5	2	Mar
24	10	Crunches bicicleta	Calistenia	2025-08-25 15:47:35.943016	5	2	Mar
25	10	Muscle Up asistido	Calistenia	2025-08-25 15:47:35.943016	5	2	Jue
26	10	Flexiones en anillas con pies elevados	Calistenia	2025-08-25 15:47:35.943016	5	2	Jue
27	10	Elevaciones de talones en un pie	Calistenia	2025-08-25 15:47:35.943016	5	2	Jue
28	10	Mountain climbers cruzados	Calistenia	2025-08-25 15:47:35.943016	5	2	Jue
29	10	Pike Push Ups con pies elevados	Calistenia	2025-08-25 15:47:35.943016	5	2	Vie
30	10	Zancadas con salto	Calistenia	2025-08-25 15:47:35.943016	5	2	Vie
31	10	Plancha con desplazamientos	Calistenia	2025-08-25 15:47:35.943016	5	2	Vie
32	10	Leg Raises con giro	Calistenia	2025-08-25 15:47:35.943016	5	2	Vie
33	10	Dominadas con agarre supino	Calistenia	2025-08-25 15:47:35.943016	5	3	Lun
34	10	Fondos en paralelas con pies elevados	Calistenia	2025-08-25 15:47:35.943016	5	3	Lun
35	10	Flexiones con un solo brazo (asistido)	Calistenia	2025-08-25 15:47:35.943016	5	3	Lun
36	10	Plancha lateral con elevación de cadera	Calistenia	2025-08-25 15:47:35.943016	5	3	Lun
37	10	Sentadilla con una pierna (pistol)	Calistenia	2025-08-25 15:47:35.943016	5	3	Mar
38	10	Burpees con giro	Calistenia	2025-08-25 15:47:35.943016	5	3	Mar
39	10	Remo en anillas	Calistenia	2025-08-25 15:47:35.943016	5	3	Mar
40	10	Crunches con elevación de piernas	Calistenia	2025-08-25 15:47:35.943016	5	3	Mar
41	10	Muscle Up completo	Calistenia	2025-08-25 15:47:35.943016	5	3	Jue
42	10	Flexiones en anillas con pies elevados y giro	Calistenia	2025-08-25 15:47:35.943016	5	3	Jue
43	10	Elevaciones de talones con una pierna	Calistenia	2025-08-25 15:47:35.943016	5	3	Jue
44	10	Mountain climbers con giro	Calistenia	2025-08-25 15:47:35.943016	5	3	Jue
45	10	Pike Push Ups en anillas	Calistenia	2025-08-25 15:47:35.943016	5	3	Vie
46	10	Zancadas con salto y giro	Calistenia	2025-08-25 15:47:35.943016	5	3	Vie
47	10	Plancha con desplazamientos laterales	Calistenia	2025-08-25 15:47:35.943016	5	3	Vie
48	10	Leg Raises con giro lateral	Calistenia	2025-08-25 15:47:35.943016	5	3	Vie
49	10	Dominadas con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Lun
50	10	Fondos en paralelas con lastre	Calistenia	2025-08-25 15:47:35.943016	5	4	Lun
51	10	Flexiones con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Lun
52	10	Plancha dinámica con desplazamientos	Calistenia	2025-08-25 15:47:35.943016	5	4	Lun
53	10	Sentadilla con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Mar
54	10	Burpees con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Mar
55	10	Remo en anillas con lastre	Calistenia	2025-08-25 15:47:35.943016	5	4	Mar
56	10	Crunches con giro y peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Mar
57	10	Muscle Up con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Jue
58	10	Flexiones en anillas con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Jue
59	10	Elevaciones de talones con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Jue
60	10	Mountain climbers con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Jue
61	10	Pike Push Ups con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Vie
62	10	Zancadas con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Vie
63	10	Plancha con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Vie
64	10	Leg Raises con peso	Calistenia	2025-08-25 15:47:35.943016	5	4	Vie
65	10	Dominadas con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Lun
66	10	Fondos en paralelas con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Lun
67	10	Flexiones con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Lun
68	10	Plancha dinámica con desplazamientos y peso	Calistenia	2025-08-25 15:47:35.943016	5	5	Lun
69	10	Sentadilla con peso pesado	Calistenia	2025-08-25 15:47:35.943016	5	5	Mar
70	10	Burpees con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Mar
71	10	Remo en anillas con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Mar
72	10	Crunches con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Mar
73	10	Muscle Up con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Jue
74	10	Flexiones en anillas con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Jue
75	10	Elevaciones de talones con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Jue
76	10	Mountain climbers con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Jue
77	10	Pike Push Ups con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Vie
78	10	Zancadas con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Vie
79	10	Plancha con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Vie
80	10	Leg Raises con peso máximo	Calistenia	2025-08-25 15:47:35.943016	5	5	Vie
81	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	1	Lun
82	10	Kettlebell Swings	Funcional	2025-08-25 16:59:59.914895	6	1	Lun
83	10	Sentadillas con salto	Funcional	2025-08-25 16:59:59.914895	6	1	Lun
84	10	Plancha lateral	Funcional	2025-08-25 16:59:59.914895	6	1	Lun
85	10	Dominadas	Funcional	2025-08-25 16:59:59.914895	6	1	Mar
86	10	Flexiones con elevación de pies	Funcional	2025-08-25 16:59:59.914895	6	1	Mar
87	10	Zancadas con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	1	Mar
88	10	Russian Twists	Funcional	2025-08-25 16:59:59.914895	6	1	Mar
89	10	Sprints en el lugar	Funcional	2025-08-25 16:59:59.914895	6	1	Jue
90	10	Mountain Climbers	Funcional	2025-08-25 16:59:59.914895	6	1	Jue
91	10	Kettlebell Goblet Squats	Funcional	2025-08-25 16:59:59.914895	6	1	Jue
92	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	1	Jue
93	10	Peso muerto con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	1	Vie
94	10	Press militar	Funcional	2025-08-25 16:59:59.914895	6	1	Vie
95	10	Remo con mancuerna	Funcional	2025-08-25 16:59:59.914895	6	1	Vie
96	10	Plancha	Funcional	2025-08-25 16:59:59.914895	6	1	Vie
97	10	Jumping Jacks	Funcional	2025-08-25 16:59:59.914895	6	2	Lun
98	10	Bici en el aire	Funcional	2025-08-25 16:59:59.914895	6	2	Lun
99	10	Flexiones con rodillas	Funcional	2025-08-25 16:59:59.914895	6	2	Lun
100	10	Puentes de glúteos	Funcional	2025-08-25 16:59:59.914895	6	2	Lun
101	10	Dominadas asistidas	Funcional	2025-08-25 16:59:59.914895	6	2	Mar
102	10	Flexiones en anillas	Funcional	2025-08-25 16:59:59.914895	6	2	Mar
103	10	Sentadillas con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	2	Mar
104	10	Levantamiento de talones	Funcional	2025-08-25 16:59:59.914895	6	2	Mar
105	10	Sprints en el lugar	Funcional	2025-08-25 16:59:59.914895	6	2	Jue
106	10	High Knees	Funcional	2025-08-25 16:59:59.914895	6	2	Jue
107	10	Kettlebell Goblet Squats	Funcional	2025-08-25 16:59:59.914895	6	2	Jue
108	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	2	Jue
109	10	Peso muerto rumano	Funcional	2025-08-25 16:59:59.914895	6	2	Vie
110	10	Press militar	Funcional	2025-08-25 16:59:59.914895	6	2	Vie
111	10	Remo con mancuerna	Funcional	2025-08-25 16:59:59.914895	6	2	Vie
112	10	Plancha	Funcional	2025-08-25 16:59:59.914895	6	2	Vie
113	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	3	Lun
114	10	Kettlebell Swings	Funcional	2025-08-25 16:59:59.914895	6	3	Lun
115	10	Sentadillas con salto	Funcional	2025-08-25 16:59:59.914895	6	3	Lun
116	10	Plancha lateral	Funcional	2025-08-25 16:59:59.914895	6	3	Lun
117	10	Dominadas	Funcional	2025-08-25 16:59:59.914895	6	3	Mar
118	10	Flexiones con elevación de pies	Funcional	2025-08-25 16:59:59.914895	6	3	Mar
119	10	Zancadas con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	3	Mar
120	10	Russian Twists	Funcional	2025-08-25 16:59:59.914895	6	3	Mar
121	10	Sprints en el lugar	Funcional	2025-08-25 16:59:59.914895	6	3	Jue
122	10	Mountain Climbers	Funcional	2025-08-25 16:59:59.914895	6	3	Jue
123	10	Kettlebell Goblet Squats	Funcional	2025-08-25 16:59:59.914895	6	3	Jue
124	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	3	Jue
125	10	Peso muerto con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	3	Vie
126	10	Press militar	Funcional	2025-08-25 16:59:59.914895	6	3	Vie
127	10	Remo con mancuerna	Funcional	2025-08-25 16:59:59.914895	6	3	Vie
128	10	Plancha	Funcional	2025-08-25 16:59:59.914895	6	3	Vie
129	10	Jumping Jacks	Funcional	2025-08-25 16:59:59.914895	6	4	Lun
130	10	Bici en el aire	Funcional	2025-08-25 16:59:59.914895	6	4	Lun
131	10	Flexiones con rodillas	Funcional	2025-08-25 16:59:59.914895	6	4	Lun
132	10	Puentes de glúteos	Funcional	2025-08-25 16:59:59.914895	6	4	Lun
133	10	Dominadas asistidas	Funcional	2025-08-25 16:59:59.914895	6	4	Mar
134	10	Flexiones en anillas	Funcional	2025-08-25 16:59:59.914895	6	4	Mar
135	10	Sentadillas con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	4	Mar
136	10	Levantamiento de talones	Funcional	2025-08-25 16:59:59.914895	6	4	Mar
137	10	Sprints en el lugar	Funcional	2025-08-25 16:59:59.914895	6	4	Jue
138	10	High Knees	Funcional	2025-08-25 16:59:59.914895	6	4	Jue
139	10	Kettlebell Goblet Squats	Funcional	2025-08-25 16:59:59.914895	6	4	Jue
140	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	4	Jue
141	10	Peso muerto rumano	Funcional	2025-08-25 16:59:59.914895	6	4	Vie
142	10	Press militar	Funcional	2025-08-25 16:59:59.914895	6	4	Vie
143	10	Remo con mancuerna	Funcional	2025-08-25 16:59:59.914895	6	4	Vie
144	10	Plancha	Funcional	2025-08-25 16:59:59.914895	6	4	Vie
145	10	Jumping Jacks	Funcional	2025-08-25 16:59:59.914895	6	5	Lun
146	10	Bici en el aire	Funcional	2025-08-25 16:59:59.914895	6	5	Lun
147	10	Flexiones con rodillas	Funcional	2025-08-25 16:59:59.914895	6	5	Lun
148	10	Puentes de glúteos	Funcional	2025-08-25 16:59:59.914895	6	5	Lun
149	10	Dominadas asistidas	Funcional	2025-08-25 16:59:59.914895	6	5	Mar
150	10	Flexiones en anillas	Funcional	2025-08-25 16:59:59.914895	6	5	Mar
151	10	Sentadillas con mancuernas	Funcional	2025-08-25 16:59:59.914895	6	5	Mar
152	10	Levantamiento de talones	Funcional	2025-08-25 16:59:59.914895	6	5	Mar
153	10	Sprints en el lugar	Funcional	2025-08-25 16:59:59.914895	6	5	Jue
154	10	High Knees	Funcional	2025-08-25 16:59:59.914895	6	5	Jue
155	10	Kettlebell Goblet Squats	Funcional	2025-08-25 16:59:59.914895	6	5	Jue
156	10	Burpees	Funcional	2025-08-25 16:59:59.914895	6	5	Jue
157	10	Peso muerto rumano	Funcional	2025-08-25 16:59:59.914895	6	5	Vie
158	10	Press militar	Funcional	2025-08-25 16:59:59.914895	6	5	Vie
159	10	Remo con mancuerna	Funcional	2025-08-25 16:59:59.914895	6	5	Vie
160	10	Plancha	Funcional	2025-08-25 16:59:59.914895	6	5	Vie
161	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	1	Lun
162	10	Press de banca	Powerlifting	2025-08-25 20:51:14.260077	14	1	Lun
163	10	Peso muerto	Powerlifting	2025-08-25 20:51:14.260077	14	1	Lun
164	10	Dominadas	Powerlifting	2025-08-25 20:51:14.260077	14	1	Lun
165	10	Sentadilla frontal	Powerlifting	2025-08-25 20:51:14.260077	14	1	Mar
166	10	Press militar	Powerlifting	2025-08-25 20:51:14.260077	14	1	Mar
167	10	Remo con barra	Powerlifting	2025-08-25 20:51:14.260077	14	1	Mar
168	10	Plancha	Powerlifting	2025-08-25 20:51:14.260077	14	1	Mar
169	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	1	Jue
170	10	Press de banca inclinado	Powerlifting	2025-08-25 20:51:14.260077	14	1	Jue
171	10	Peso muerto sumo	Powerlifting	2025-08-25 20:51:14.260077	14	1	Jue
172	10	Fondos en paralelas	Powerlifting	2025-08-25 20:51:14.260077	14	1	Jue
173	10	Peso muerto rumano	Powerlifting	2025-08-25 20:51:14.260077	14	1	Vie
174	10	Press con mancuernas	Powerlifting	2025-08-25 20:51:14.260077	14	1	Vie
175	10	Remo en polea	Powerlifting	2025-08-25 20:51:14.260077	14	1	Vie
176	10	Elevaciones de talones	Powerlifting	2025-08-25 20:51:14.260077	14	1	Vie
177	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	2	Lun
178	10	Press de banca	Powerlifting	2025-08-25 20:51:14.260077	14	2	Lun
179	10	Peso muerto	Powerlifting	2025-08-25 20:51:14.260077	14	2	Lun
180	10	Dominadas	Powerlifting	2025-08-25 20:51:14.260077	14	2	Lun
181	10	Sentadilla frontal	Powerlifting	2025-08-25 20:51:14.260077	14	2	Mar
182	10	Press militar	Powerlifting	2025-08-25 20:51:14.260077	14	2	Mar
183	10	Remo con barra	Powerlifting	2025-08-25 20:51:14.260077	14	2	Mar
184	10	Plancha	Powerlifting	2025-08-25 20:51:14.260077	14	2	Mar
185	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	2	Jue
186	10	Press de banca inclinado	Powerlifting	2025-08-25 20:51:14.260077	14	2	Jue
187	10	Peso muerto sumo	Powerlifting	2025-08-25 20:51:14.260077	14	2	Jue
188	10	Fondos en paralelas	Powerlifting	2025-08-25 20:51:14.260077	14	2	Jue
189	10	Peso muerto rumano	Powerlifting	2025-08-25 20:51:14.260077	14	2	Vie
190	10	Press con mancuernas	Powerlifting	2025-08-25 20:51:14.260077	14	2	Vie
191	10	Remo en polea	Powerlifting	2025-08-25 20:51:14.260077	14	2	Vie
192	10	Elevaciones de talones	Powerlifting	2025-08-25 20:51:14.260077	14	2	Vie
193	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	3	Lun
194	10	Press de banca	Powerlifting	2025-08-25 20:51:14.260077	14	3	Lun
195	10	Peso muerto	Powerlifting	2025-08-25 20:51:14.260077	14	3	Lun
196	10	Dominadas	Powerlifting	2025-08-25 20:51:14.260077	14	3	Lun
197	10	Sentadilla frontal	Powerlifting	2025-08-25 20:51:14.260077	14	3	Mar
198	10	Press militar	Powerlifting	2025-08-25 20:51:14.260077	14	3	Mar
199	10	Remo con barra	Powerlifting	2025-08-25 20:51:14.260077	14	3	Mar
200	10	Plancha	Powerlifting	2025-08-25 20:51:14.260077	14	3	Mar
201	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	3	Jue
202	10	Press de banca inclinado	Powerlifting	2025-08-25 20:51:14.260077	14	3	Jue
203	10	Peso muerto sumo	Powerlifting	2025-08-25 20:51:14.260077	14	3	Jue
204	10	Fondos en paralelas	Powerlifting	2025-08-25 20:51:14.260077	14	3	Jue
205	10	Peso muerto rumano	Powerlifting	2025-08-25 20:51:14.260077	14	3	Vie
206	10	Press con mancuernas	Powerlifting	2025-08-25 20:51:14.260077	14	3	Vie
207	10	Remo en polea	Powerlifting	2025-08-25 20:51:14.260077	14	3	Vie
208	10	Elevaciones de talones	Powerlifting	2025-08-25 20:51:14.260077	14	3	Vie
209	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	4	Lun
210	10	Press de banca	Powerlifting	2025-08-25 20:51:14.260077	14	4	Lun
211	10	Peso muerto	Powerlifting	2025-08-25 20:51:14.260077	14	4	Lun
212	10	Dominadas	Powerlifting	2025-08-25 20:51:14.260077	14	4	Lun
213	10	Sentadilla frontal	Powerlifting	2025-08-25 20:51:14.260077	14	4	Mar
214	10	Press militar	Powerlifting	2025-08-25 20:51:14.260077	14	4	Mar
215	10	Remo con barra	Powerlifting	2025-08-25 20:51:14.260077	14	4	Mar
216	10	Plancha	Powerlifting	2025-08-25 20:51:14.260077	14	4	Mar
217	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	4	Jue
218	10	Press de banca inclinado	Powerlifting	2025-08-25 20:51:14.260077	14	4	Jue
219	10	Peso muerto sumo	Powerlifting	2025-08-25 20:51:14.260077	14	4	Jue
220	10	Fondos en paralelas	Powerlifting	2025-08-25 20:51:14.260077	14	4	Jue
221	10	Peso muerto rumano	Powerlifting	2025-08-25 20:51:14.260077	14	4	Vie
222	10	Press con mancuernas	Powerlifting	2025-08-25 20:51:14.260077	14	4	Vie
223	10	Remo en polea	Powerlifting	2025-08-25 20:51:14.260077	14	4	Vie
224	10	Elevaciones de talones	Powerlifting	2025-08-25 20:51:14.260077	14	4	Vie
225	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	5	Lun
226	10	Press de banca	Powerlifting	2025-08-25 20:51:14.260077	14	5	Lun
227	10	Peso muerto	Powerlifting	2025-08-25 20:51:14.260077	14	5	Lun
228	10	Dominadas	Powerlifting	2025-08-25 20:51:14.260077	14	5	Lun
229	10	Sentadilla frontal	Powerlifting	2025-08-25 20:51:14.260077	14	5	Mar
230	10	Press militar	Powerlifting	2025-08-25 20:51:14.260077	14	5	Mar
231	10	Remo con barra	Powerlifting	2025-08-25 20:51:14.260077	14	5	Mar
232	10	Plancha	Powerlifting	2025-08-25 20:51:14.260077	14	5	Mar
233	10	Sentadilla	Powerlifting	2025-08-25 20:51:14.260077	14	5	Jue
234	10	Press de banca inclinado	Powerlifting	2025-08-25 20:51:14.260077	14	5	Jue
235	10	Peso muerto sumo	Powerlifting	2025-08-25 20:51:14.260077	14	5	Jue
236	10	Fondos en paralelas	Powerlifting	2025-08-25 20:51:14.260077	14	5	Jue
237	10	Peso muerto rumano	Powerlifting	2025-08-25 20:51:14.260077	14	5	Vie
238	10	Press con mancuernas	Powerlifting	2025-08-25 20:51:14.260077	14	5	Vie
239	10	Remo en polea	Powerlifting	2025-08-25 20:51:14.260077	14	5	Vie
240	10	Elevaciones de talones	Powerlifting	2025-08-25 20:51:14.260077	14	5	Vie
241	10	Sentadilla búlgara	Hipertrofia	2025-08-28 14:00:10.095701	20	1	Lun
\.


--
-- TOC entry 5845 (class 0 OID 27311)
-- Dependencies: 275
-- Data for Name: exercise_repetition_policy; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.exercise_repetition_policy (id, methodology_type, min_days_between_same_exercise, max_times_per_month, variety_percentage, created_at, updated_at) FROM stdin;
1	Heavy Duty	21	2	0.60	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
2	Powerlifting	14	4	0.50	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
3	Hipertrofia	10	6	0.75	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
4	Funcional	7	8	0.80	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
5	Oposiciones	5	10	0.85	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
6	Crossfit	7	8	0.90	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
7	Calistenia	14	4	0.65	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
8	Entrenamiento en casa	10	6	0.70	2025-08-25 15:43:09.561728	2025-08-25 15:43:09.561728
\.


--
-- TOC entry 5835 (class 0 OID 27201)
-- Dependencies: 265
-- Data for Name: exercises_catalog; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.exercises_catalog (id, name, key, category, muscle_groups, equipment_required, difficulty_level, description, instructions, video_url, gif_url, safety_notes, created_at, updated_at, is_active) FROM stdin;
1	Flexiones de Brazos	push_ups	strength	{pecho,triceps,hombros}	peso_corporal	beginner	Ejercicio básico de empuje para tren superior	Mantén el cuerpo recto, baja hasta que el pecho casi toque el suelo	\N	\N	No arquees la espalda, mantén el core activado	2025-08-23 13:51:56.137543+02	2025-08-23 13:51:56.137543+02	t
2	Sentadillas	squats	strength	{cuadriceps,gluteos,isquiotibiales}	peso_corporal	beginner	Ejercicio fundamental para tren inferior	Baja como si te fueras a sentar, mantén las rodillas alineadas	\N	\N	No dejes que las rodillas pasen de los dedos de los pies	2025-08-23 13:51:56.137543+02	2025-08-23 13:51:56.137543+02	t
3	Dominadas	pull_ups	strength	{espalda,biceps}	barra_dominadas	intermediate	Ejercicio de tracción para espalda	Cuelga de la barra y tira hasta que el mentón pase la barra	\N	\N	Controla el descenso, no te dejes caer	2025-08-23 13:51:56.137543+02	2025-08-23 13:51:56.137543+02	t
4	Burpees	burpees	cardio	{cuerpo_completo}	peso_corporal	intermediate	Ejercicio cardiovascular de cuerpo completo	Combina flexión, salto y sentadilla en un movimiento fluido	\N	\N	Mantén un ritmo controlado para evitar lesiones	2025-08-23 13:51:56.137543+02	2025-08-23 13:51:56.137543+02	t
5	Plancha	plank	strength	{core,hombros}	peso_corporal	beginner	Ejercicio isométrico para el core	Mantén el cuerpo recto como una tabla	\N	\N	No hundas las caderas ni las eleves demasiado	2025-08-23 13:51:56.137543+02	2025-08-23 13:51:56.137543+02	t
\.


--
-- TOC entry 5861 (class 0 OID 27642)
-- Dependencies: 299
-- Data for Name: food_database; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.food_database (id, name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, sugar_per_100g, sodium_per_100g, potassium_per_100g, calcium_per_100g, iron_per_100g, vitamin_c_per_100g, common_serving_size, serving_weight_g, is_active, created_at) FROM stdin;
1	Pollo (pechuga sin piel)	proteins	165.00	31.00	0.00	3.60	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1 pechuga mediana	150.00	t	2025-08-26 22:24:59.902337+02
2	Atún enlatado en agua	proteins	116.00	25.50	0.00	1.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1 lata	140.00	t	2025-08-26 22:24:59.902337+02
3	Huevos enteros	proteins	155.00	13.00	1.10	11.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2 huevos medianos	120.00	t	2025-08-26 22:24:59.902337+02
4	Salmón	proteins	208.00	25.40	0.00	12.40	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1 filete	120.00	t	2025-08-26 22:24:59.902337+02
5	Carne magra de res	proteins	250.00	26.00	0.00	15.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1 filete	100.00	t	2025-08-26 22:24:59.902337+02
6	Yogur griego natural	proteins	97.00	10.00	3.60	5.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1 taza	170.00	t	2025-08-26 22:24:59.902337+02
7	Requesón bajo en grasa	proteins	98.00	11.00	3.40	4.30	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1/2 taza	115.00	t	2025-08-26 22:24:59.902337+02
8	Lentejas cocidas	proteins	116.00	9.00	20.00	0.40	7.90	0.00	0.00	0.00	0.00	0.00	0.00	1 taza	200.00	t	2025-08-26 22:24:59.902337+02
9	Arroz integral cocido	carbs	111.00	2.60	23.00	0.90	1.80	0.00	0.00	0.00	0.00	0.00	0.00	1 taza	195.00	t	2025-08-26 22:24:59.902337+02
10	Avena	carbs	389.00	16.90	66.30	6.90	10.60	0.00	0.00	0.00	0.00	0.00	0.00	1/2 taza seca	40.00	t	2025-08-26 22:24:59.902337+02
11	Batata cocida	carbs	86.00	1.60	20.00	0.10	3.00	0.00	0.00	0.00	0.00	0.00	0.00	1 batata mediana	150.00	t	2025-08-26 22:24:59.902337+02
12	Banana	carbs	89.00	1.10	23.00	0.30	2.60	0.00	0.00	0.00	0.00	0.00	0.00	1 banana mediana	120.00	t	2025-08-26 22:24:59.902337+02
13	Quinoa cocida	carbs	120.00	4.40	22.00	1.90	2.80	0.00	0.00	0.00	0.00	0.00	0.00	1 taza	185.00	t	2025-08-26 22:24:59.902337+02
14	Pan integral	carbs	247.00	13.00	41.00	4.20	6.00	0.00	0.00	0.00	0.00	0.00	0.00	2 rebanadas	60.00	t	2025-08-26 22:24:59.902337+02
15	Aguacate	fats	160.00	2.00	8.50	14.70	6.70	0.00	0.00	0.00	0.00	0.00	0.00	1/2 aguacate	100.00	t	2025-08-26 22:24:59.902337+02
16	Nueces	fats	654.00	15.20	13.70	65.20	6.70	0.00	0.00	0.00	0.00	0.00	0.00	1 puñado (28g)	28.00	t	2025-08-26 22:24:59.902337+02
17	Almendras	fats	579.00	21.20	21.60	49.90	12.50	0.00	0.00	0.00	0.00	0.00	0.00	23 almendras	28.00	t	2025-08-26 22:24:59.902337+02
18	Aceite de oliva extra virgen	fats	884.00	0.00	0.00	100.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1 cucharada	15.00	t	2025-08-26 22:24:59.902337+02
19	Mantequilla de maní natural	fats	588.00	25.80	20.00	50.40	8.50	0.00	0.00	0.00	0.00	0.00	0.00	2 cucharadas	32.00	t	2025-08-26 22:24:59.902337+02
20	Brócoli	vegetables	34.00	2.80	6.60	0.40	2.60	0.00	0.00	0.00	0.00	0.00	0.00	1 taza picado	91.00	t	2025-08-26 22:24:59.902337+02
21	Espinacas	vegetables	23.00	2.90	3.60	0.40	2.20	0.00	0.00	0.00	0.00	0.00	0.00	1 taza	30.00	t	2025-08-26 22:24:59.902337+02
22	Tomate	vegetables	18.00	0.90	3.90	0.20	1.20	0.00	0.00	0.00	0.00	0.00	0.00	1 tomate mediano	150.00	t	2025-08-26 22:24:59.902337+02
23	Pimiento rojo	vegetables	31.00	1.00	7.30	0.30	2.50	0.00	0.00	0.00	0.00	0.00	0.00	1 pimiento	120.00	t	2025-08-26 22:24:59.902337+02
24	Zanahoria	vegetables	41.00	0.90	9.60	0.20	2.80	0.00	0.00	0.00	0.00	0.00	0.00	1 zanahoria grande	70.00	t	2025-08-26 22:24:59.902337+02
\.


--
-- TOC entry 5879 (class 0 OID 28038)
-- Dependencies: 323
-- Data for Name: home_combination_exercise_history; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_combination_exercise_history (id, user_id, combination_id, combination_code, exercise_name, exercise_key, times_used, last_used_at, session_id, plan_id, user_rating, created_at, updated_at) FROM stdin;
1	10	1	MIN_FUNC	Burpees con salto y toque de rodillas	_urpees_con_salto_y_toque_de_rodillas	1	2025-08-28 12:10:21.155986+02	67	106	\N	2025-08-28 12:10:21.155986+02	2025-08-28 12:10:21.155986+02
2	10	1	MIN_FUNC	Pike Push-Up (Flexión en V invertida para hombros)	_ike_ush_p_lexi_n_en_invertida_para_hombros_	1	2025-08-28 12:18:05.836985+02	67	106	\N	2025-08-28 12:18:05.836985+02	2025-08-28 12:18:05.836985+02
3	10	1	MIN_FUNC	Elevaciones laterales de pierna en posición de cuadrupedia	_levaciones_laterales_de_pierna_en_posici_n_de_cuadrupedia	1	2025-08-28 12:22:35.724886+02	67	106	\N	2025-08-28 12:22:35.724886+02	2025-08-28 12:22:35.724886+02
4	10	1	MIN_FUNC	Russian Twists con Toalla o Peso Ligero	_ussian_wists_con_oalla_o_eso_igero	1	2025-08-28 12:26:36.577103+02	67	106	\N	2025-08-28 12:26:36.577103+02	2025-08-28 12:26:36.577103+02
5	10	1	MIN_FUNC	Estocadas Alternas con Toalla para Resistencia	_stocadas_lternas_con_oalla_para_esistencia	1	2025-08-28 12:31:27.612293+02	67	106	\N	2025-08-28 12:31:27.612293+02	2025-08-28 12:31:27.612293+02
6	10	11	PER_HIIT	Flexiones con Palmada Alterna	_lexiones_con_almada_lterna	1	2025-08-28 12:59:04.722809+02	68	107	\N	2025-08-28 12:59:04.722809+02	2025-08-28 12:59:04.722809+02
\.


--
-- TOC entry 5873 (class 0 OID 27880)
-- Dependencies: 311
-- Data for Name: home_exercise_history; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_exercise_history (id, user_id, exercise_name, exercise_key, reps, series, duration_seconds, plan_id, session_id, notes, created_at) FROM stdin;
1	10	Burpees Modificados	burpees_modificados	\N	5	134	54	31	\N	2025-08-18 21:23:30.892112+02
2	10	Sentadilla en Silla	sentadilla_en_silla	\N	4	134	55	32	\N	2025-08-18 21:35:46.546473+02
3	10	Flexiones de Brazos Invertidas en Sofa	flexiones_de_brazos_invertidas_en_sofa	\N	4	134	56	33	\N	2025-08-18 22:42:35.364897+02
4	10	Puente de Glúteos	puente_de_gl_teos	\N	4	\N	56	33	\N	2025-08-18 22:46:58.096416+02
5	10	Press de Hombro con Mancuernas	press_de_hombro_con_mancuernas	\N	3	\N	63	40	\N	2025-08-19 08:29:28.199557+02
6	10	Remo con Bandas Elásticas	remo_con_bandas_el_sticas	\N	3	\N	63	40	\N	2025-08-19 08:32:38.773387+02
7	10	Sentadilla con Mancuernas	sentadilla_con_mancuernas	\N	3	\N	63	40	\N	2025-08-19 08:35:21.801899+02
8	10	Plancha Dinámica	plancha_din_mica	\N	3	\N	63	40	\N	2025-08-19 08:37:21.348697+02
9	10	Elevación de Caderas con Banda Elástica	elevaci_n_de_caderas_con_banda_el_stica	\N	3	\N	63	40	\N	2025-08-19 08:40:00.780671+02
10	10	Flexiones de Brazos con Pies Elevados en Silla	flexiones_de_brazos_con_pies_elevados_en_silla	\N	1	\N	66	42	\N	2025-08-19 09:24:03.845434+02
11	10	Sentadilla a la Pared	sentadilla_a_la_pared	\N	1	\N	66	42	\N	2025-08-19 09:24:53.851814+02
12	10	Escaladores (sin salto)	escaladores_sin_salto_	\N	1	\N	66	42	\N	2025-08-19 09:26:54.292684+02
13	10	Burpees sin Salto	burpees_sin_salto	\N	1	\N	66	42	\N	2025-08-19 09:27:45.25313+02
14	10	Saltos en Banco Step	saltos_en_banco_step	\N	4	\N	67	43	\N	2025-08-19 10:08:17.836455+02
15	10	Remo con Bandas Elásticas	remo_con_bandas_el_sticas	\N	4	\N	67	43	\N	2025-08-19 11:05:59.575876+02
16	10	Sentadilla Isla con Bandas Elásticas	sentadilla_isla_con_bandas_el_sticas	\N	4	\N	67	43	\N	2025-08-19 11:11:45.872885+02
17	10	Remo Inclinado con Bandas Elásticas	remo_inclinado_con_bandas_el_sticas	\N	4	\N	69	44	\N	2025-08-19 11:36:31.470115+02
18	10	Elevaciones de Pantorrillas en Escalón	elevaciones_de_pantorrillas_en_escal_n	\N	4	\N	69	44	\N	2025-08-19 11:39:48.537931+02
19	10	Plancha con Toque de Hombro	plancha_con_toque_de_hombro	\N	4	\N	69	44	\N	2025-08-19 11:42:56.586127+02
20	10	Push-Up a Escalera	push_up_a_escalera	\N	4	\N	71	46	\N	2025-08-19 12:03:59.270681+02
21	10	Zancadas Alternas con Mancuernas	zancadas_alternas_con_mancuernas	\N	4	\N	71	46	\N	2025-08-19 12:08:22.248554+02
22	10	Remo Alto con Banda Elástica	remo_alto_con_banda_el_stica	\N	4	\N	71	46	\N	2025-08-19 12:12:48.089023+02
23	10	Mountain Climbers en Banco	mountain_climbers_en_banco	\N	4	\N	71	46	\N	2025-08-19 12:17:10.79925+02
24	10	Flexiones de Brazos con Manos en Banquito	flexiones_de_brazos_con_manos_en_banquito	\N	5	\N	72	47	\N	2025-08-19 13:00:36.972372+02
25	10	Sentadilla con Salto	sentadilla_con_salto	\N	4	\N	73	48	\N	2025-08-19 13:44:55.168353+02
26	10	Flexiones de Brazos con Elevación de Pierna	flexiones_de_brazos_con_elevaci_n_de_pierna	\N	4	\N	74	49	\N	2025-08-19 20:17:17.923383+02
27	10	Sentadilla con Mancuernas	sentadilla_con_mancuernas	8-10	4	\N	\N	26	Completado desde rutina Lun semana 1	2025-08-26 16:43:23.107154+02
28	10	Press de Banca con Mancuernas	press_de_banca_con_mancuernas	8-10	4	\N	\N	26	Completado desde rutina Lun semana 1	2025-08-26 16:53:16.105701+02
29	10	Remo con Mancuernas	remo_con_mancuernas	8-10	4	\N	\N	26	Completado desde rutina Lun semana 1	2025-08-26 17:14:33.283858+02
30	10	Elevaciones de Talones	elevaciones_de_talones	12-15	4	\N	\N	26	Completado desde rutina Lun semana 1	2025-08-26 17:33:05.274025+02
31	10	Sentadilla Frontal	sentadilla_frontal	8-10	4	179	\N	51	Completado desde rutina Lun semana 1	2025-08-26 19:26:24.289567+02
32	10	Sentadilla Frontal	sentadilla_frontal	6-8	5	224	\N	56	Completado desde rutina Lun semana 1	2025-08-26 20:13:29.271413+02
33	10	Press de Banca con Mancuernas	press_de_banca_con_mancuernas	8-10	4	179	\N	56	Completado desde rutina Lun semana 1	2025-08-26 20:21:23.767669+02
34	10	Remo con Mancuernas	remo_con_mancuernas	8-10	4	179	\N	56	Completado desde rutina Lun semana 1	2025-08-26 20:27:39.275518+02
35	10	Elevaciones de Talones	elevaciones_de_talones	10-12	4	179	\N	56	Completado desde rutina Lun semana 1	2025-08-26 21:31:47.363483+02
36	10	Sentadilla Frontal	sentadilla_frontal	6-8	5	224	\N	61	Completado desde rutina Lun semana 1	2025-08-27 12:53:05.111575+02
37	10	Press de Banca con Mancuernas	press_de_banca_con_mancuernas	8-10	4	179	\N	61	Completado desde rutina Lun semana 1	2025-08-27 12:59:49.707617+02
38	10	Remo con Mancuernas	remo_con_mancuernas	8-10	4	179	\N	61	Completado desde rutina Lun semana 1	2025-08-27 13:06:02.336107+02
39	10	Elevaciones de Talones	elevaciones_de_talones	10-12	4	179	\N	61	Completado desde rutina Lun semana 1	2025-08-27 13:13:58.545441+02
40	10	Kettlebell Swings Explosivos	kettlebell_swings_explosivos	\N	4	\N	100	64	\N	2025-08-27 20:08:32.133142+02
41	10	Puente de Glúteos en la Pared	puente_de_gl_teos_en_la_pared	\N	3	\N	104	66	\N	2025-08-28 09:56:22.255224+02
43	10	Elevación Alterna de Piernas en Posición de Sentadilla	elevaci_n_alterna_de_piernas_en_posici_n_de_sentadilla	\N	3	\N	104	66	\N	2025-08-28 10:01:36.787651+02
45	10	Press de Pared con Flexión de Escápulas	press_de_pared_con_flexi_n_de_esc_pulas	\N	3	\N	104	66	\N	2025-08-28 10:05:42.332896+02
47	10	Planchas Alternas con Rotación de Tronco	planchas_alternas_con_rotaci_n_de_tronco	\N	3	\N	104	66	\N	2025-08-28 10:12:45.438427+02
49	10	Marcha en Vuelta de Toalla (Balance Dinámico)	marcha_en_vuelta_de_toalla_balance_din_mico_	\N	3	\N	104	66	\N	2025-08-28 10:19:55.772735+02
51	10	Burpees con salto y toque de rodillas	burpees_con_salto_y_toque_de_rodillas	\N	3	\N	106	67	\N	2025-08-28 12:10:21.155986+02
53	10	Pike Push-Up (Flexión en V invertida para hombros)	pike_push_up_flexi_n_en_v_invertida_para_hombros_	\N	3	\N	106	67	\N	2025-08-28 12:18:05.836985+02
55	10	Elevaciones laterales de pierna en posición de cuadrupedia	elevaciones_laterales_de_pierna_en_posici_n_de_cuadrupedia	\N	3	\N	106	67	\N	2025-08-28 12:22:35.724886+02
57	10	Russian Twists con Toalla o Peso Ligero	russian_twists_con_toalla_o_peso_ligero	\N	3	\N	106	67	\N	2025-08-28 12:26:36.577103+02
59	10	Estocadas Alternas con Toalla para Resistencia	estocadas_alternas_con_toalla_para_resistencia	\N	3	\N	106	67	\N	2025-08-28 12:31:27.612293+02
61	10	Flexiones con Palmada Alterna	flexiones_con_palmada_alterna	\N	4	\N	107	68	\N	2025-08-28 12:59:04.722809+02
\.


--
-- TOC entry 5814 (class 0 OID 26760)
-- Dependencies: 233
-- Data for Name: home_exercise_progress; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_exercise_progress (id, home_training_session_id, exercise_name, exercise_order, series_completed, total_series, duration_seconds, started_at, completed_at, status, exercise_data) FROM stdin;
179	52	Flexiones de Brazos en Pared	1	\N	4	119	2025-08-22 13:22:42.216763+02	2025-08-22 13:33:10.368768+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Colócate frente a una pared a una distancia cómoda. Movimiento: Inclínate hacia la pared manteniendo el cuerpo recto, y empuja para volver a la posición inicial. Asegúrate de que los codos estén cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Flexiones de Brazos en Pared", "patron": "empuje", "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}
15	4	Sentadilla con mancuernas	0	0	4	\N	2025-08-17 16:47:16.672889+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
16	4	Press de pecho en banco con mancuernas	1	0	4	\N	2025-08-17 16:47:26.451753+02	\N	skipped	{"tipo": "reps", "notas": "Controla el movimiento y evita que las mancuernas se toquen en la parte superior.", "nombre": "Press de pecho en banco con mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
11	3	Burpees	0	0	4	\N	2025-08-17 14:50:18.87368+02	\N	skipped	{"tipo": "intervalo", "notas": "Mantén un ritmo constante y asegúrate de aterrizar suavemente.", "nombre": "Burpees", "patron": "cuerpo completo", "series": 4, "descanso_seg": 30, "duracion_seg": 30}
12	3	Sentadillas con salto	1	0	4	\N	2025-08-17 14:51:18.303763+02	\N	skipped	{"tipo": "intervalo", "notas": "Salta lo más alto posible y aterriza en una posición de sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "descanso_seg": 30, "duracion_seg": 30}
13	3	Flexiones	2	0	4	\N	2025-08-17 14:51:20.647745+02	\N	skipped	{"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "series": 4, "descanso_seg": 30, "duracion_seg": 30}
14	3	Mountain Climbers	3	0	4	\N	2025-08-17 14:51:22.107961+02	\N	skipped	{"tipo": "intervalo", "notas": "Acelera el movimiento para aumentar la intensidad.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "descanso_seg": 30, "duracion_seg": 30}
1	1	Sentadilla con Kettlebell	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén el kettlebell cerca del pecho durante la sentadilla.", "nombre": "Sentadilla con Kettlebell", "patron": "sentadilla", "series": 4, "implemento": "kettlebell", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}
2	1	Dominadas con agarre amplio	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Asegúrate de bajar completamente y activar la espalda.", "nombre": "Dominadas con agarre amplio", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 8}
3	1	Press de Hombros con Mancuernas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Controla el movimiento y evita arquear la espalda.", "nombre": "Press de Hombros con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}
129	40	Remo con Bandas Elásticas	1	3	3	89	2025-08-19 08:26:46.782479+02	2025-08-19 08:32:40.04844+02	completed	{"tipo": "reps", "notas": "Posición inicial: Fija la banda elástica a un objeto estable a la altura del pecho. Sujetar los extremos con ambas manos. Movimiento: Tira de la banda hacia tu torso, manteniendo los codos cerca del cuerpo. Regresa con control. Respiración: Inhala al extender y exhala al tirar. Evita: Inclinarte hacia atrás o usar impulso.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 60, "repeticiones": 12}
130	40	Sentadilla con Mancuernas	2	3	3	89	2025-08-19 08:26:46.782479+02	2025-08-19 08:35:23.084119+02	completed	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados del cuerpo, pies a la altura de los hombros. Movimiento: Desciende como si fueras a sentarte, manteniendo el pecho erguido y el peso en los talones. Regresa a la posición inicial. Respiración: Inhala al bajar y exhala al subir. Evita: Que las rodillas sobrepasen los dedos de los pies y mantener la espalda recta.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}
131	40	Plancha Dinámica	3	3	3	59	2025-08-19 08:26:46.782479+02	2025-08-19 08:37:22.541949+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con las manos debajo de los hombros y el cuerpo en línea recta. Movimiento: Alterna levantar cada mano hacia el hombro opuesto, manteniendo el cuerpo estable. Respiración: Mantén la respiración constante y acompaña el movimiento. Evita: Derrapar las caderas o perder la alineación del cuerpo.", "nombre": "Plancha Dinámica", "patron": "isometría", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
132	40	Elevación de Caderas con Banda Elástica	4	3	3	89	2025-08-19 08:26:46.782479+02	2025-08-19 08:40:01.932375+02	completed	{"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda con las rodillas flexionadas y los pies en el suelo, coloca una banda elástica alrededor de los muslos. Movimiento: Eleva las caderas hacia el techo, apretando los glúteos, y vuelve a la posición inicial. Respiración: Inhala al bajar y exhala al subir. Evita: Que los pies se deslicen o que la espalda se arquee excesivamente.", "nombre": "Elevación de Caderas con Banda Elástica", "patron": "bisagra_cadera", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 60, "repeticiones": 15}
166	49	Flexiones de Brazos con Elevación de Pierna	0	4	4	119	2025-08-19 20:10:43.605819+02	2025-08-19 20:17:18.378445+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: En posición de flexión, con las manos bajo los hombros. Movimiento: Al bajar, eleva una pierna hacia atrás. Varía las piernas en cada repetición. Respiración: Inhala al bajar, exhala al subir. Evita: Que la cadera caiga o se levante demasiado, mantén el cuerpo en línea recta.", "nombre": "Flexiones de Brazos con Elevación de Pierna", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
17	4	Remo con mancuernas	2	0	4	\N	2025-08-17 16:47:34.113345+02	\N	skipped	{"tipo": "reps", "notas": "Mantén el codo cerca del cuerpo y aprieta los omóplatos al final del movimiento.", "nombre": "Remo con mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
18	4	Peso muerto con mancuernas	3	0	4	\N	2025-08-17 16:47:37.855329+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la espalda recta y siente el estiramiento en los isquiotibiales.", "nombre": "Peso muerto con mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
31	13	Press de Banca con Mancuernas	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Asegúrate de mantener los pies firmes en el suelo y el control en el movimiento.", "nombre": "Press de Banca con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
19	4	Elevaciones de talones	4	0	4	\N	2025-08-17 16:47:39.798133+02	\N	skipped	{"tipo": "reps", "notas": "Realiza el movimiento de forma controlada y mantén la contracción en la parte superior.", "nombre": "Elevaciones de talones", "patron": "aislado", "series": 4, "implemento": "peso corporal", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 10}
20	5	Flexiones de brazos	0	0	4	\N	2025-08-17 17:07:03.917923+02	\N	skipped	{"tipo": "reps", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
21	5	Sentadilla con peso corporal	1	0	4	\N	2025-08-17 17:07:05.857637+02	\N	skipped	{"tipo": "reps", "notas": "Asegúrate de que las rodillas no sobrepasen los dedos de los pies.", "nombre": "Sentadilla con peso corporal", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 8}
22	5	Fondos en silla	2	0	4	\N	2025-08-17 17:07:09.857775+02	\N	skipped	{"tipo": "reps", "notas": "Baja hasta que los codos estén a 90 grados.", "nombre": "Fondos en silla", "patron": "empuje", "series": 4, "implemento": "silla", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
23	5	Puente de glúteos	3	0	4	\N	2025-08-17 17:07:12.114058+02	\N	skipped	{"tipo": "reps", "notas": "Aprieta los glúteos en la parte superior del movimiento.", "nombre": "Puente de glúteos", "patron": "bisagra de cadera", "series": 4, "implemento": "peso corporal", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 10}
32	13	Sentadilla con Mancuernas	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que tus muslos estén paralelos al suelo.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}
33	13	Remo con Mancuernas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén el torso inclinado y tira de las mancuernas hacia tu abdomen.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
34	13	Peso Muerto con Mancuernas	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén las mancuernas cerca de tus piernas durante el movimiento.", "nombre": "Peso Muerto con Mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}
35	13	Elevación de Talones	4	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Realiza el movimiento de forma controlada, sintiendo el trabajo en los gemelos.", "nombre": "Elevación de Talones", "patron": "aislado", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}
167	49	Elevaciones de Cadera con una Pierna	1	0	4	\N	2025-08-19 20:10:43.605819+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba, una pierna elevada. Movimiento: Eleva las caderas apretando los glúteos y el abdomen. Alterna las piernas en cada serie. Respiración: Exhala al elevar las caderas, inhala al descender. Evita: Que tus hombros se levanten del suelo, manténlos apoyados.", "nombre": "Elevaciones de Cadera con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
128	40	Press de Hombro con Mancuernas	0	3	3	89	2025-08-19 08:26:46.782479+02	2025-08-19 08:29:28.647804+02	completed	{"tipo": "reps", "notas": "Posición inicial: De pie, sostén una mancuerna en cada mano a la altura de los hombros. Pies a la altura de los hombros. Movimiento: Eleva las mancuernas por encima de la cabeza hasta que tus brazos estén completamente extendidos. Asegúrate de que tus muñecas estén rectas y tus codos cerca del cuerpo al bajarlas. Respiración: Inhala al bajar y exhala al subir. Evita: Arqueo en la espalda baja y que los brazos se separen demasiado del cuerpo.", "nombre": "Press de Hombro con Mancuernas", "patron": "empuje", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}
181	52	Mountain Climbers en Suelo	3	0	4	\N	2025-08-22 13:22:42.216763+02	\N	cancelled	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, con manos debajo de los hombros. Movimiento: Lleva una rodilla hacia el pecho y luego alterna rápidamente con la otra pierna, como si estuvieras corriendo en el lugar. Mantén el abdomen contraído. Respiración: Inhala y exhala rápidamente. Evita: Que las caderas se eleven o se bajen excesivamente.", "nombre": "Mountain Climbers en Suelo", "patron": "tracción", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
203	56	Elevaciones Laterales de Cadera con Toalla en Pared	4	0	3	\N	2025-08-23 15:04:15.516777+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén la espalda pegada a la pared y realiza elevaciones controladas para activar los glúteos y oblicuos.", "nombre": "Elevaciones Laterales de Cadera con Toalla en Pared", "patron": "elevaciones de cadera", "series": 3, "implemento": "toalla, pared", "descanso_seg": 45, "repeticiones": 15}
214	58	Salto en cuerda doble con cambios rápidos	4	3	3	134	2025-08-25 13:23:13.916324+02	2025-08-25 14:04:34.543561+02	completed	{"tipo": "reps", "notas": "Mantén la espalda recta y los brazos ligeramente flexionados, tratando de mantener un ritmo constante.", "nombre": "Salto en cuerda doble con cambios rápidos", "patron": "cardio", "series": 3, "implemento": "cuerda de salto", "descanso_seg": 45, "repeticiones": 50}
36	14	Burpees con Mancuernas	0	0	4	\N	2025-08-17 18:18:35.237473+02	\N	skipped	{"tipo": "intervalo", "notas": "Asegúrate de hacer el jump con fuerza y controlar la caída. Mantén las mancuernas firmes principalmente durante el press.", "nombre": "Burpees con Mancuernas", "patron": "cuerpo completo", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}
37	14	Zancadas Alternas con Mancuernas	1	0	4	\N	2025-08-17 18:18:38.844582+02	\N	skipped	{"tipo": "intervalo", "notas": "Da un paso amplio hacia adelante, manteniendo la espalda recta y el núcleo apretado. Alterna las piernas con cada repetición.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "piernas", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}
38	14	Remo Alto con Banda Elástica	2	0	4	\N	2025-08-17 18:18:43.172141+02	\N	skipped	{"tipo": "intervalo", "notas": "Mantén los codos por encima de los hombros y los hombros relajados mientras tiras de la banda hacia ti.", "nombre": "Remo Alto con Banda Elástica", "patron": "espalda", "series": 4, "implemento": "banda elástica", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}
39	14	Plancha Dinámica con Golpes	3	0	4	\N	2025-08-17 18:18:45.827139+02	\N	skipped	{"tipo": "intervalo", "notas": "Mantén la posición de plancha mientras alternas el golpeo de hombros. Activa el abdomen para evitar que las caderas se hundan.", "nombre": "Plancha Dinámica con Golpes", "patron": "core", "series": 4, "implemento": "ninguno", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}
40	14	Puente de Glúteos con Mancuerna	4	0	4	\N	2025-08-17 18:18:48.642077+02	\N	skipped	{"tipo": "intervalo", "notas": "Coloca la mancuerna sobre la pelvis. Aprieta los glúteos al elevar la cadera, formando una línea recta desde los hombros hasta las rodillas.", "nombre": "Puente de Glúteos con Mancuerna", "patron": "glúteos", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}
41	15	Saltos de Tijera con Mancuernas	0	5	5	\N	2025-08-17 19:50:15.806643+02	2025-08-17 19:51:47.932131+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Sostén una mancuerna en cada mano, brazos a los lados. Movimiento: Salta abriendo y cerrando las piernas mientras elevas los brazos por encima de la cabeza. Aterriza suavemente con las rodillas ligeramente flexionadas. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con las rodillas rígidas o golpear el suelo.", "nombre": "Saltos de Tijera con Mancuernas", "patron": "cardio", "series": 5, "implemento": "mancuernas", "descanso_seg": 15, "duracion_seg": 30}
42	15	Flexiones con Bandas Elásticas	1	0	4	\N	2025-08-17 19:52:10.07745+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Coloca la banda elástica alrededor de tu espalda y sostenla con ambas manos. Alinea tu cuerpo en posición de flexión. Movimiento: Baja el torso manteniendo los codos cerca del cuerpo, luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o abrir demasiado los codos.", "nombre": "Flexiones con Bandas Elásticas", "patron": "empuje", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "repeticiones": 10}
43	15	Sentadilla con Peso Corporal y Elevación de Talones	2	0	4	\N	2025-08-17 19:52:16.414769+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Realiza una sentadilla y al levantarte eleva los talones del suelo. Mantén el torso erguido. Respiración: Inhala al descender, exhala al subir. Evita: Permitir que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Peso Corporal y Elevación de Talones", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "repeticiones": 12}
133	41	Flexiones en Silla	0	0	1	\N	2025-08-19 08:58:42.600418+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos sobre el borde de la silla, con los brazos extendidos y el cuerpo en línea recta. Movimiento: Flexiona los codos para bajar el torso hacia la silla, manteniendo el cuerpo recto y los pies apoyados en el suelo. Respiración: Inhala al bajar y exhala al empujar de vuelta. Evita: Dejar caer las caderas o curvar la espalda.", "nombre": "Flexiones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}
44	15	Battle Rope Alternado (simulado)	3	5	5	\N	2025-08-17 19:52:17.90519+02	2025-08-17 19:55:01.53048+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Imagina que sostienes cuerdas de batalla, pies separados a la anchura de los hombros. Movimiento: Alterna arriba y abajo los brazos como si estuvieras moviendo cuerdas. Mantén la parte central del cuerpo firme. Respiración: Controla la respiración y exhala al bajar los brazos. Evita: Girar la cadera o perder el equilibrio.", "nombre": "Battle Rope Alternado (simulado)", "patron": "cardio", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}
46	16	Puente de Glúteos con una Pierna	1	0	4	\N	2025-08-17 20:00:58.964027+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda, pie derecho en el suelo, pierna izquierda extendida hacia arriba. Movimiento: Eleva la cadera contra el suelo utilizando el talón derecho para empujar. Mantén la pierna izquierda extendida sin tocar el suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo de la espalda baja, mantén la alineación.", "nombre": "Puente de Glúteos con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}
47	16	Remo Invertido en Mesa	2	0	4	\N	2025-08-17 20:01:04.784818+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Bajo una mesa resistente, agárrate del borde con las manos y mantén el cuerpo recto. Movimiento: Tira de tu cuerpo hacia arriba hasta que el pecho toque la mesa, manteniendo las piernas estiradas. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o arquear la espalda.", "nombre": "Remo Invertido en Mesa", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}
48	16	Sentadilla Isométrica en Pared	3	0	3	\N	2025-08-17 20:01:07.670993+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Apóyate contra una pared con los pies a la altura de las caderas, baja en una posición de sentadilla. Movimiento: Mantén la posición de sentadilla contra la pared. Respiración: Respira normalmente. Evita: Desplazar las rodillas hacia adelante de los dedos de los pies, mantén la espalda recta.", "nombre": "Sentadilla Isométrica en Pared", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}
49	17	Sentadilla con Mancuerna y Press	0	4	4	\N	2025-08-17 20:29:10.550563+02	2025-08-17 20:32:13.951078+02	completed	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a la altura de los hombros. Pies a la anchura de los hombros. Movimiento: Baja en sentadilla mientras presionas las mancuernas hacia arriba al levantarte. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepongan los dedos de los pies al bajar.", "nombre": "Sentadilla con Mancuerna y Press", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}
50	17	Saltos de Cuerda Alternos	1	0	4	\N	2025-08-17 20:32:23.030995+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: De pie, sosteniendo los extremos de la cuerda. Movimiento: Salta suavemente alternando los pies como si estuvieras corriendo. Mantén el core contraído. Respiración: Respira de forma natural, evitando contener la respiración. Evita: Saltar demasiado alto; mantén los pies cerca del suelo.", "nombre": "Saltos de Cuerda Alternos", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}
51	17	Flexiones de Brazo con Elevación de Mancuernas	2	0	4	\N	2025-08-17 20:32:26.376575+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: En posición de flexión, con una mancuerna en cada mano. Cuerpo en línea recta. Movimiento: Baja el torso mientras mantienes el codo pegado al cuerpo. Al subir, eleva una mancuerna hacia el pecho. Alterna brazos. Respiración: Inhala al bajar, exhala al subir. Evita: Que tus caderas caigan o se eleven.", "nombre": "Flexiones de Brazo con Elevación de Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 8}
52	17	Desplazamientos Laterales con Banda Elástica	3	0	4	\N	2025-08-17 20:32:28.712684+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Coloca una banda elástica alrededor de las piernas, justo por encima de las rodillas. Posición de pie con pies juntos. Movimiento: Da un paso lateral hacia la derecha, luego junta los pies. Repite hacia la izquierda. Mantén el core activo. Respiración: Respira de forma continua. Evita: Inclinarte hacia adelante o que la banda se deslice.", "nombre": "Desplazamientos Laterales con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "duracion_seg": 30}
53	18	Press de Hombros con Mancuernas	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, sostén las mancuernas a la altura de los hombros con palmas hacia adelante. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos. Respiración: Exhala al empujar, inhala al bajar. Evita: Arqueo lumbar excesivo o elevar los hombros hacia las orejas.", "nombre": "Press de Hombros con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}
45	16	Flexiones con Elevación de Pierna	0	4	4	\N	2025-08-17 19:57:14.019258+02	2025-08-17 20:00:47.861693+02	completed	{"tipo": "reps", "notas": "Posición inicial: En posición de flexión con las manos ligeramente más anchas que los hombros. Movimiento: Baja el torso manteniendo una línea recta desde la cabeza hasta los talones. Al subir, levanta una pierna del suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Caderas caídas o elevadas, mantén el cuerpo recto.", "nombre": "Flexiones con Elevación de Pierna", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}
54	18	Remo con Mancuernas	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Inclínate ligeramente hacia adelante con la espalda recta y las mancuernas en manos. Movimiento: Tira de las mancuernas hacia tu abdomen, manteniendo los codos pegados al cuerpo. Respiración: Exhala al subir, inhala al bajar. Evita: Redondear la espalda o mover el torso durante el ejercicio.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 12}
134	41	Saltos de Tijera	1	0	1	\N	2025-08-19 08:58:42.600418+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta abriendo las piernas y levantando los brazos por encima de la cabeza, luego salta y regresa a la posición inicial. Respiración: Respira de forma constante, mantén el ritmo. Evita: Golpear el suelo al aterrizar.", "nombre": "Saltos de Tijera", "patron": "funcional", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
135	41	Desplantes con Rotación	2	0	1	\N	2025-08-19 08:58:42.600418+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros. Movimiento: Da un paso adelante y baja en un desplante, gira el torso hacia la pierna delantera. Regresa a la posición inicial y alterna. Respiración: Inhala al bajar, exhala al regresar. Evita: Que la rodilla delantera sobrepase el pie.", "nombre": "Desplantes con Rotación", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
136	41	Rodillas al Pecho con Toalla	3	0	1	\N	2025-08-19 08:58:42.600418+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: Coloca una toalla en el suelo, siéntate en ella y apoya las manos detrás. Movimiento: Levanta las rodillas hacia el pecho y vuelve a la posición inicial, manteniendo el control. Respiración: Inhala al bajar y exhala al subir. Evita: Invertir la espalda o perder el equilibrio.", "nombre": "Rodillas al Pecho con Toalla", "patron": "funcional", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}
199	56	Flexiones con Toalla en Pared	0	0	4	\N	2025-08-23 15:04:15.516777+02	\N	skipped	{"tipo": "reps", "notas": "Usa la toalla para aumentar la resistencia y mantener la estabilidad, asegurando una correcta alineación del cuerpo.", "nombre": "Flexiones con Toalla en Pared", "patron": "flexiones", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 15}
169	49	Tijeras en el Suelo	3	0	4	\N	2025-08-19 20:10:43.605819+02	\N	cancelled	{"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba con las manos bajo los glúteos. Movimiento: Levanta las piernas rectas alternando hacia arriba y hacia abajo sin tocar el suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo en la espalda baja, mantén el abdomen apretado.", "nombre": "Tijeras en el Suelo", "patron": "abdomen", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
200	56	Saltos en Silla con Elevación de Rodillas Alternas	1	0	4	\N	2025-08-23 15:04:15.516777+02	\N	skipped	{"tipo": "reps", "notas": "Ejecuta saltos explosivos y lleva las rodillas al pecho al subir, cuidando la técnica para evitar impacto excesivo en las articulaciones.", "nombre": "Saltos en Silla con Elevación de Rodillas Alternas", "patron": "saltos", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 20}
58	19	Kettlebell Swing	0	0	5	\N	2025-08-17 20:50:19.078936+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Pies a la altura de los hombros, sostén el kettlebell con ambas manos entre tus piernas. Movimiento: Flexiona ligeramente las rodillas y empuja las caderas hacia atrás, luego, explosivamente, mueve las caderas hacia adelante y levanta el kettlebell hasta la altura del pecho. Respiración: Inhala en la bajada, exhala al levantar. Evita: Hacer el movimiento solo con los brazos, mantén la potencia en las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 5, "implemento": "kettlebells", "descanso_seg": 30, "duracion_seg": 30}
59	19	Box Jump	1	0	4	\N	2025-08-17 20:50:19.617835+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Colócate frente a una caja o plataforma estable. Movimiento: Flexiona las rodillas y salta hacia arriba, aterrizando suavemente sobre la caja, usando las piernas para amortiguar el impacto. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer duramente sobre la caja o aterrizar con las rodillas bloqueadas.", "nombre": "Box Jump", "patron": "explosión", "series": 4, "implemento": "caja", "descanso_seg": 40, "duracion_seg": 20}
60	19	Remo Invertido en TRX	2	0	5	\N	2025-08-17 20:50:20.351187+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Agárrate de las cintas del TRX con los brazos extendidos y el cuerpo recto. Movimiento: Tira de las cintas hacia ti, flexionando los codos y llevando el pecho hacia las manos. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la cadera se hunda o que el cuerpo se curve.", "nombre": "Remo Invertido en TRX", "patron": "tracción", "series": 5, "implemento": "trx", "descanso_seg": 30, "duracion_seg": 30}
61	19	Pike Push-Up	3	0	4	\N	2025-08-17 20:50:21.173227+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Asume una posición de flexión, pero eleva las caderas formando una 'V' invertida. Movimiento: Baja la cabeza hacia el suelo, utilizando los hombros para empujar el cuerpo hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la parte baja de la espalda se hunda.", "nombre": "Pike Push-Up", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 35, "duracion_seg": 25}
62	20	Sentadilla con Mancuerna	0	1	4	\N	2025-08-17 21:07:53.878947+02	\N	in_progress	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos a la altura del pecho. Pies a la anchura de los hombros. Movimiento: Flexiona las caderas y las rodillas como si te fueras a sentar, asegurándote de que las rodillas no sobrepasen los dedos de los pies. Mantén el torso erguido. Respiración: Inhala al bajar, exhala al subir. Evita: Colapsar el pecho hacia adelante o que los talones se levanten.", "nombre": "Sentadilla con Mancuerna", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}
55	18	Zancada Alterna con Mancuernas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: De pie, con las mancuernas a los lados. Movimiento: Da un paso hacia adelante y baja la rodilla trasera hacia el suelo, manteniendo el torso recto. Regresa. Respiración: Inhala al bajar, exhala al levantarte. Evita: Que la rodilla delantera se desplace hacia adelante más allá del pie.", "nombre": "Zancada Alterna con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}
56	18	Plancha Alternando Elevación de Pierna	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha con los codos debajo de los hombros. Movimiento: Eleva una pierna manteniendo la posición del torso estática. Alterna piernas. Respiración: Respira de manera controlada. Evita: Caderas demasiado altas o bajas, mantén una línea recta desde cabeza a talones.", "nombre": "Plancha Alternando Elevación de Pierna", "patron": "isometrico", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}
206	57	Peso Muerto Rumano con Discos	2	0	4	\N	2025-08-24 19:07:08.020974+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la espalda recta y activa el core durante toda la acción. No doble demasiado las rodillas y enfócate en la cadera.", "nombre": "Peso Muerto Rumano con Discos", "patron": "peso_muerto", "series": 4, "implemento": "discos", "descanso_seg": 60, "repeticiones": 8}
138	42	Sentadilla a la Pared	1	\N	1	29	2025-08-19 09:23:28.815813+02	2025-08-19 09:24:55.154587+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Apóyate en la pared con la espalda recta, pies al ancho de los hombros y a un paso de la pared. Movimiento: Desciende como si te fueras a sentar, manteniendo la espalda recta, hasta que tus muslos queden paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Despegar la espalda de la pared.", "nombre": "Sentadilla a la Pared", "patron": "bisagra_cadera", "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}
168	49	Russian Twists con Mancuerna	2	0	4	\N	2025-08-19 20:10:43.605819+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Sentado con las rodillas flexionadas y los pies en el suelo, sostén una mancuerna con ambas manos. Movimiento: Gira el torso hacia un lado, luego hacia el otro, manteniendo el abdomen contraído. Respiración: Exhala durante la torsión, inhala al volver al centro. Evita: Redondear la espalda, mantén una postura recta.", "nombre": "Russian Twists con Mancuerna", "patron": "rotación", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "duracion_seg": 30}
139	42	Escaladores (sin salto)	2	\N	1	29	2025-08-19 09:23:28.815813+02	2025-08-19 09:26:55.520754+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha con las manos en el suelo. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente, manteniendo la posición de plancha. Respiración: Exhala al llevar la rodilla hacia adelante, inhala al volver. Evita: Hacerlo con la cadera elevada o dejar caer las caderas.", "nombre": "Escaladores (sin salto)", "patron": "tracción", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
140	42	Burpees sin Salto	3	\N	1	29	2025-08-19 09:23:28.815813+02	2025-08-19 09:27:46.369139+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies a la altura de los hombros. Movimiento: Agáchate, coloca las manos en el suelo, camina hacia atrás a posición de plancha, regresa a la posición agachada y levántate. Respiración: Inhala al agacharte, exhala al levantarte. Evita: Hacer movimientos bruscos o perder el equilibrio al levantarte.", "nombre": "Burpees sin Salto", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
173	50	Elevaciones de Talones con Discos Olímpicos	3	0	4	\N	2025-08-19 22:18:53.711302+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Con discos en las manos, párate en el borde de una plataforma o escalón. Movimiento: Eleva los talones, quedándote en las puntas de los pies, luego baja los talones por debajo de la plataforma. Respira: Inhala al bajar, exhala al subir. Evita: Dejar que las rodillas se muevan hacia adelante o perder el equilibrio.", "nombre": "Elevaciones de Talones con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 12}
137	42	Flexiones de Brazos con Pies Elevados en Silla	0	\N	1	29	2025-08-19 09:23:28.815813+02	2025-08-19 09:24:05.106919+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Coloca los pies sobre la silla y las manos en el suelo a la altura de los hombros. Movimiento: Baja el cuerpo manteniendo una línea recta desde la cabeza hasta los pies, evitando que la cadera se hunda. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o elevar demasiado la pelvis.", "nombre": "Flexiones de Brazos con Pies Elevados en Silla", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
176	51	Elevaciones de Talones con Discos	2	4	4	119	2025-08-20 09:26:54.414399+02	2025-08-20 10:18:51.805042+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Coloca los discos en el suelo, súbete a ellos y mantén el equilibrio. Movimiento: Eleva los talones, apretando los músculos de las pantorrillas. Baja controladamente. Respiración: Exhala al elevar, inhala al bajar. Evita: Colapsar los tobillos o permitir que las rodillas se desvíen.", "nombre": "Elevaciones de Talones con Discos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 45, "duracion_seg": 30}
170	50	Peso Muerto Rumano con Discos Olímpicos	0	0	4	\N	2025-08-19 22:18:53.711302+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, sostén los discos con ambas manos frente a tus muslos. Movimiento: Flexiona las caderas hacia atrás manteniendo la espalda recta y la cabeza en línea con la columna. Desciende hasta sentir un estiramiento en los isquiotibiales. Respira: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o dejar que las rodillas se muevan hacia adelante.", "nombre": "Peso Muerto Rumano con Discos Olímpicos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}
171	50	Remo con TRX	1	0	4	\N	2025-08-19 22:18:53.711302+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con las manos y recuéstate hacia atrás. Mantén el cuerpo en línea recta. Movimiento: Tira de tus manos hacia ti, llevando los codos hacia atrás y juntando los omóplatos. Respira: Inhala al bajar, exhala al subir. Evita: Dejar que la cadera se hunda o que los hombros suban hacia las orejas.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}
172	50	Push Press con Discos Olímpicos	2	0	4	\N	2025-08-19 22:18:53.711302+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Sostén los discos al nivel de los hombros con los codos hacia adelante. Movimiento: Flexiona ligeramente las rodillas, luego utiliza el impulso de tus piernas para empujar los discos hacia arriba, extendiendo los brazos completamente. Respira: Inhala al bajar, exhala al empujar. Evita: Arqueo excesivo en la espalda al levantar o que los discos se desplacen hacia adelante.", "nombre": "Push Press con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}
63	20	Flexiones de Brazo con Apoyo de Rodillas	1	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Rodillas en el suelo, manos apoyadas al ancho de hombros. Cuerpo en línea recta desde la cabeza hasta las rodillas. Movimiento: Baja el pecho hacia el suelo manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o elevar demasiado las caderas.", "nombre": "Flexiones de Brazo con Apoyo de Rodillas", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}
252	66	Planchas Alternas con Rotación de Tronco	3	3	3	134	2025-08-28 09:52:19.186191+02	2025-08-28 10:12:45.941301+02	completed	{"tipo": "reps", "notas": "Mantén la columna alineada y realiza movimientos controlados para activar estabilizadores del core y hombros.", "nombre": "Planchas Alternas con Rotación de Tronco", "patron": "planchas", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 10}
175	51	Bicicleta Estática	1	4	4	179	2025-08-20 09:26:54.414399+02	2025-08-20 10:13:40.693335+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Siéntate en la bici con la espalda recta y las manos en el manillar. Movimiento: Pedalea a máxima intensidad, manteniendo el ritmo y la postura. Respiración: Inhala y exhala de manera rítmica. Evita: Encoger los hombros o inclinarte demasiado adelante.", "nombre": "Bicicleta Estática", "patron": "cardio", "series": 4, "implemento": "bici", "descanso_seg": 45, "duracion_seg": 45}
177	51	Plancha Lateral con Banda Elástica	3	4	4	119	2025-08-20 09:26:54.414399+02	2025-08-20 10:31:05.087108+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus muñecas y apóyate sobre un lado. Movimiento: Eleva las caderas hasta que el cuerpo forme una línea recta. Mantén la posición y luego baja. Respiración: Mantén la respiración constante. Evita: Caer en la cadera o no mantener la alineación de la espalda.", "nombre": "Plancha Lateral con Banda Elástica", "patron": "estabilización", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}
178	52	Saltos en Silla	0	\N	4	119	2025-08-22 13:22:42.216763+02	2025-08-22 13:27:13.389142+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Coloca una silla estable frente a ti. Movimiento: Salta con ambos pies hacia arriba y aterriza suavemente sobre la silla. Mantén los pies juntos y las rodillas ligeramente flexionadas. Respiración: Exhala al saltar, inhala al aterrizar. Evita: Aterrizar con las piernas rígidas o hacer saltos demasiado altos.", "nombre": "Saltos en Silla", "patron": "bisagra_cadera", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}
207	57	Dominadas con Agarre Paralelo en Barra	3	0	4	\N	2025-08-24 19:07:08.020974+02	\N	skipped	{"tipo": "reps", "notas": "Asegura una buena amplitud en el movimiento, sin colgarse en exceso y controlando la bajada. Si es muy fácil, añade peso.", "nombre": "Dominadas con Agarre Paralelo en Barra", "patron": "dominadas", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}
73	22	Sentadilla Isométrica con Elevación de Talones	1	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: En cuclillas, mantén las rodillas flexionadas a 90 grados. Movimiento: Eleva los talones manteniendo la posición de cuclillas. Mantén la espalda recta. Respiración: Respira de forma controlada durante el ejercicio. Evita: No dejar que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla Isométrica con Elevación de Talones", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}
74	22	Mountain Climbers	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta con las manos directamente debajo de los hombros. Movimiento: Lleva una rodilla hacia el pecho, vuelve a la posición inicial y alterna rápidamente con la otra rodilla. Respiración: Exhala al acercar la rodilla, inhala al volver a la posición de plancha. Evita: No dejes caer las caderas ni arquees la espalda.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}
75	22	Flexiones de Brazo con Rotación	3	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, brazos extendidos, manos a la altura de los hombros. Movimiento: Realiza una flexión normal y al subir, gira el torso hacia un lado levantando un brazo hacia el techo. Alterna lados. Respiración: Inhala al bajar, exhala al subir y girar. Evita: No arquees la espalda ni bajes demasiado las caderas.", "nombre": "Flexiones de Brazo con Rotación", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}
76	23	Sentadilla con Mancuerna y Elevación	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos en el pecho. Pies a la anchura de los hombros. Movimiento: Desciende en sentadilla y al subir, eleva la mancuerna por encima de la cabeza. Respiración: Inhala al bajar, exhala al elevar. Evita: Que tus rodillas sobrepasen la punta de los pies.", "nombre": "Sentadilla con Mancuerna y Elevación", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "repeticiones": 10}
77	23	Remo Invertido con Banda Elástica	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Ancla la banda elástica a un punto bajo y sostén los extremos. Acuéstate boca arriba y tira de la banda hacia tu pecho mientras mantienes el cuerpo en línea recta. Movimiento: Tira de la banda hacia ti manteniendo los codos pegados al cuerpo. Respiración: Inhala al bajar, exhala al tirar. Evita: Arqueo de espalda y movimientos bruscos.", "nombre": "Remo Invertido con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "repeticiones": 12}
78	23	Zancadas Alternas con Mancuernas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados. Pies a la altura de los hombros. Movimiento: Da un paso adelante flexionando ambas rodillas y vuelve a la posición inicial. Alterna las piernas. Respiración: Inhala al descender, exhala al volver. Evita: Que la rodilla que avanza sobrepase la punta del pie.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "repeticiones": 10}
208	57	Press Militar con Barra	4	0	4	\N	2025-08-24 19:07:08.020974+02	\N	skipped	{"tipo": "reps", "notas": "Mantén el core firme y no sobreextiendas la espalda. Eleva la barra de manera controlada y evita movimientos bruscos.", "nombre": "Press Militar con Barra", "patron": "press_vertical", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 6}
143	43	Flexiones de Brazos con Rodillas Apoyadas	2	0	4	\N	2025-08-19 10:05:10.023349+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: En posición de flexión con las rodillas en el suelo, manos a la altura de los hombros. Movimiento: Baja el pecho hacia el suelo flexionando los codos y vuelve a subir. Mantén el cuerpo recto. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera.", "nombre": "Flexiones de Brazos con Rodillas Apoyadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
142	43	Remo con Bandas Elásticas	1	4	4	89	2025-08-19 10:05:10.023349+02	2025-08-19 11:06:01.011732+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Sentado en el suelo con las piernas extendidas, sujeta la banda elástica con ambas manos. Movimiento: Tira de la banda hacia tu abdomen, manteniendo la espalda recta y los codos pegados al cuerpo. Respiración: Inhala al soltar, exhala al tirar. Evita: Arqueamiento de la espalda.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}
144	43	Sentadilla Isla con Bandas Elásticas	3	4	4	89	2025-08-19 10:05:10.023349+02	2025-08-19 11:11:46.306442+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de los muslos, pies a la altura de los hombros. Movimiento: Realiza una sentadilla manteniendo la tensión en la banda, asegurándote de que las rodillas no sobrepasen los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desplacen hacia adentro.", "nombre": "Sentadilla Isla con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}
145	43	Plancha Lateral Dinámica	4	0	4	\N	2025-08-19 10:05:10.023349+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado con los pies apilados y apoyando el antebrazo en el suelo. Movimiento: Levanta las caderas formando una línea recta y realiza giros hacia el frente y de regreso. Respiración: Mantén una respiración controlada. Evita: Que las caderas se caigan.", "nombre": "Plancha Lateral Dinámica", "patron": "estabilización", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
174	51	Tirón de TRX	0	4	4	119	2025-08-20 09:26:54.414399+02	2025-08-20 09:33:27.07303+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Agarra las asas del TRX con los brazos extendidos y el cuerpo recto. Movimiento: Inclínate hacia atrás, manteniendo el cuerpo recto y los pies firmes en el suelo. Tira hacia ti, flexionando los codos y llevando el pecho hacia las asas. Respiración: Exhala al tirar, inhala al volver. Evita: Que el cuerpo se desplace de lado o que la espalda se curve.", "nombre": "Tirón de TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 45, "duracion_seg": 30}
180	52	Sentadillas con Peso Corporal	2	0	4	\N	2025-08-22 13:22:42.216763+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Pies a la altura de hombros y dedos ligeramente hacia afuera. Movimiento: Baja las caderas como si fueras a sentarte en una silla, manteniendo el pecho erguido y las rodillas alineadas con los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desvíen hacia adentro o que el torso se incline hacia adelante.", "nombre": "Sentadillas con Peso Corporal", "patron": "sentadilla", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
204	57	Remo con Barra Pendlay	0	0	4	\N	2025-08-24 19:07:08.020974+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la espalda recta y activa el core para evitar lesiones. El movimiento debe ser controlado y sin rebotes en la parte baja.", "nombre": "Remo con Barra Pendlay", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}
205	57	Press de Banca con Barra	1	0	4	\N	2025-08-24 19:07:08.020974+02	\N	skipped	{"tipo": "reps", "notas": "Asegura una buena estabilidad en los pies y evita que los brazos bajen excesivamente. Controla la bajada y empuja explosivamente.", "nombre": "Press de Banca con Barra", "patron": "press_horizontal", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 6}
141	43	Saltos en Banco Step	0	4	4	89	2025-08-19 10:05:10.023349+02	2025-08-19 10:08:19.230438+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: De pie frente al banco step, con los pies a la altura de los hombros. Movimiento: Salta con ambos pies al banco y aterriza suavemente. Mantén el core contraído. Respiración: Exhala al saltar e inhala al bajar. Evita: Aterrizar con las rodillas bloqueadas.", "nombre": "Saltos en Banco Step", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
209	57	Remo en T con Mancuernas Pesadas	5	0	4	\N	2025-08-24 19:07:08.020974+02	\N	cancelled	{"tipo": "reps", "notas": "Inclina el torso a 45 grados y activa el dorsal durante el movimiento. No uses impulso para levantar las mancuernas.", "nombre": "Remo en T con Mancuernas Pesadas", "patron": "remo", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 8}
10	2	Fondos en paralelas	4	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Baja hasta que los codos estén a 90 grados y empuja hacia arriba.", "nombre": "Fondos en paralelas", "patron": "empuje", "series": 4, "implemento": "paralelas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}
57	18	Elevaciones de Talones con Mancuernas	4	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: De pie, sostén las mancuernas a los lados. Movimiento: Eleva los talones del suelo, manteniendo el equilibrio en la parte frontal de los pies. Respiración: Exhala al subir, inhala al bajar. Evita: Dejar caer el peso hacia atrás o hacia adelante al elevarte.", "nombre": "Elevaciones de Talones con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}
216	59	Flexiones de brazos en suelo (manos en parallets o sobre libros para variar altura)	1	0	8	\N	2025-08-25 14:12:03.185846+02	\N	skipped	{"tipo": "intervalo", "notas": "Mantén el cuerpo recto, evita que las caderas caigan o se levanten demasiado; ajusta la apertura de manos para mayor énfasis en pectorales o tríceps.", "nombre": "Flexiones de brazos en suelo (manos en parallets o sobre libros para variar altura)", "patron": "flexion", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}
217	59	Plancha con toques de hombro	2	0	8	\N	2025-08-25 14:12:03.185846+02	\N	skipped	{"tipo": "intervalo", "notas": "Desde posición de plancha, toca con una mano el hombro contraria alternando, manteniendo el control y evitando rotaciones innecesarias.", "nombre": "Plancha con toques de hombro", "patron": "plancha", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}
215	59	Sentadillas con salto sin peso	0	8	8	359	2025-08-25 14:12:03.185846+02	2025-08-25 14:23:42.47313+02	completed	{"tipo": "intervalo", "notas": "Realiza las sentadillas con explosividad, aterrizando suavemente para proteger las articulaciones y maximizar el trabajo cardiovascular.", "nombre": "Sentadillas con salto sin peso", "patron": "salto", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}
218	59	Escaladores (mountain climbers)	3	0	8	\N	2025-08-25 14:12:03.185846+02	\N	skipped	{"tipo": "intervalo", "notas": "Mantén las caderas bajas y realiza movimientos rápidos, activando abdomen y hombros de manera dinámica.", "nombre": "Escaladores (mountain climbers)", "patron": "cardio", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 40}
219	59	Puente de glúteos con peso en pelvis (opcional con objeto ligero)	4	0	8	\N	2025-08-25 14:12:03.185846+02	\N	cancelled	{"tipo": "intervalo", "notas": "Aprieta los glúteos al elevar la pelvis, evita sobreextender la zona lumbar, y si quieres aumentar intensidad, coloca un peso ligero sobre la pelvis.", "nombre": "Puente de glúteos con peso en pelvis (opcional con objeto ligero)", "patron": "hipthrust", "series": 8, "implemento": "peso corporal o ligero peso", "descanso_seg": 45, "repeticiones": 15}
220	60	Swing de Kettlebell a dos manos	0	0	4	\N	2025-08-25 14:29:28.388107+02	\N	skipped	{"tipo": "tiempo", "notas": "Mantén una postura neutral de la columna y realiza el movimiento con las caderas, no solo con los brazos.", "nombre": "Swing de Kettlebell a dos manos", "patron": "hip hinge", "series": 4, "implemento": "Kettlebell", "descanso_seg": 45, "duracion_seg": 40}
223	60	Plancha con toque de hombro alterno	3	0	4	\N	2025-08-25 14:29:28.388107+02	\N	skipped	{"tipo": "tiempo", "notas": "Mantén el core firme y evita que la cadera se rote excesivamente al tocar el hombro contralateral.", "nombre": "Plancha con toque de hombro alterno", "patron": "estabilidad", "series": 4, "implemento": "sin implemento", "descanso_seg": 45, "duracion_seg": 45}
224	60	Saltos con deslizamiento lateral sobre discos	4	0	4	\N	2025-08-25 14:29:28.388107+02	\N	skipped	{"tipo": "tiempo", "notas": "Utiliza los discos para deslizar lateralmente, manteniendo las rodillas ligeramente flexionadas y el core activo.", "nombre": "Saltos con deslizamiento lateral sobre discos", "patron": "cardio", "series": 4, "implemento": "discos", "descanso_seg": 45, "duracion_seg": 30}
90	26	Press de Pecho en Suelo con Mancuernas	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba con una mancuerna en cada mano, brazos extendidos hacia arriba. Movimiento: Baja las mancuernas hacia los lados, flexionando los codos, y luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda baja.", "nombre": "Press de Pecho en Suelo con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}
147	44	Remo Inclinado con Bandas Elásticas	1	4	4	89	2025-08-19 11:31:08.825119+02	2025-08-19 11:36:31.914814+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Pisa la banda elástica con ambos pies y sujeta los extremos con las manos. Inclina ligeramente el torso hacia adelante. Movimiento: Tira de las bandas hacia tu abdomen, apretando los omóplatos. Respiración: Inhala al estirar, exhala al juntar. Evita: Curvar la espalda o usar impulso.", "nombre": "Remo Inclinado con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}
91	26	Remo Inclinado con Mancuerna	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Inclínate hacia adelante desde las caderas, sosteniendo una mancuerna en cada mano, brazos extendidos. Movimiento: Tira de las mancuernas hacia el abdomen, manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Girar el torso durante el movimiento.", "nombre": "Remo Inclinado con Mancuerna", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}
146	44	Flexiones de Brazos con Manos Elevadas	0	0	4	\N	2025-08-19 11:31:08.825119+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Coloca tus manos sobre el banco step, asegurando que tus pies estén en el suelo. Cuerpo recto. Movimiento: Baja el cuerpo hasta que el pecho toque el banco, manteniendo el core apretado. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o levantar las nalgas.", "nombre": "Flexiones de Brazos con Manos Elevadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
183	53	Zancadas con peso corporal	1	4	4	179	2025-08-22 18:50:51.524176+02	2025-08-22 19:04:28.700649+02	completed	{"tipo": "series_reps", "notas": "Da pasos largos y mantén la rodilla alineada con el tobillo en el descenso. Incorpora una toalla en las manos para mayor estabilidad si necesitas.", "nombre": "Zancadas con peso corporal", "patron": "zancada", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 10}
149	44	Plancha con Toque de Hombro	3	4	4	89	2025-08-19 11:31:08.825119+02	2025-08-19 11:42:57.011377+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Colócate en posición de plancha alta con las manos bajo los hombros. Cuerpo recto. Movimiento: Toca un hombro con la mano opuesta, alternando. Respiración: Mantén una respiración uniforme. Evita: Girar las caderas o bajar la cadera.", "nombre": "Plancha con Toque de Hombro", "patron": "estabilidad", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
182	53	Remo invertido en silla	0	4	4	179	2025-08-22 18:50:51.524176+02	2025-08-22 18:57:33.997226+02	completed	{"tipo": "series_reps", "notas": "Asegúrate de mantener la espalda recta y los codos cerca del torso durante la tracción. Controla el movimiento para maximizar el trabajo muscular.", "nombre": "Remo invertido en silla", "patron": "remo", "series": 4, "implemento": "silla", "descanso_seg": 60, "repeticiones": 8}
185	53	Elevaciones laterales con toalla	3	0	3	\N	2025-08-22 18:50:51.524176+02	\N	skipped	{"tipo": "series_reps", "notas": "Realiza movimientos lentos y controlados, levantando las toallas a la altura de los hombros sin levantar los pies del suelo para mantener la estabilidad.", "nombre": "Elevaciones laterales con toalla", "patron": "elevaciones_laterales", "series": 3, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}
148	44	Elevaciones de Pantorrillas en Escalón	2	4	4	89	2025-08-19 11:31:08.825119+02	2025-08-19 11:39:48.970363+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Colócate en el borde de un escalón con los talones colgando. Movimiento: Eleva los talones lo más alto posible, aprieta los gemelos y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer los talones demasiado rápido.", "nombre": "Elevaciones de Pantorrillas en Escalón", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
184	53	Press de hombros con bandas elásticas	2	0	4	\N	2025-08-22 18:50:51.524176+02	\N	skipped	{"tipo": "series_reps", "notas": "Mantén los codos ligeramente flexionados y realiza el movimiento de manera controlada para activar bien los deltoides y trapecios.", "nombre": "Press de hombros con bandas elásticas", "patron": "press_shoulders", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 60, "repeticiones": 10}
186	53	Puente de glúteos en suelo	4	0	4	\N	2025-08-22 18:50:51.524176+02	\N	cancelled	{"tipo": "series_reps", "notas": "Aprieta los glúteos en la parte superior y mantén la posición unos segundos. Evita sobreextender la zona lumbar.", "nombre": "Puente de glúteos en suelo", "patron": "puente_gluteos", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 15}
210	58	Swing con Kettlebell a una mano	0	4	4	179	2025-08-25 13:23:13.916324+02	2025-08-25 13:28:57.996215+02	completed	{"tipo": "reps", "notas": "Mantén la espalda recta y activa la cadera al final del movimiento para potenciar el impulso del kettlebell.", "nombre": "Swing con Kettlebell a una mano", "patron": "levantamiento", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 10}
211	58	Burpee con salto y barra dominadas	1	4	4	179	2025-08-25 13:23:13.916324+02	2025-08-25 13:36:16.975065+02	completed	{"tipo": "reps", "notas": "Realiza un salto libre al despegue y evita arquear la espalda durante la dominada para protegerla.", "nombre": "Burpee con salto y barra dominadas", "patron": "fullbody", "series": 4, "implemento": "barra y peso corporal", "descanso_seg": 45, "repeticiones": 12}
212	58	Lunges en posición de plancha con peso en manos	2	3	3	134	2025-08-25 13:23:13.916324+02	2025-08-25 13:46:39.95726+02	completed	{"tipo": "reps", "notas": "Mantén el core firme y evita que las caderas se hundan o levanten demasiado, controlando la bajada.", "nombre": "Lunges en posición de plancha con peso en manos", "patron": "zancadas", "series": 3, "implemento": "pesos en manos (kettlebells o mancuernas)", "descanso_seg": 45, "repeticiones": 12}
151	45	Kettlebell Swing	1	0	4	\N	2025-08-19 11:54:39.845362+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, kettlebell entre tus pies. Agáchate y sujeta el kettlebell con ambas manos. Movimiento: Desde una posición de bisagra de cadera, impulsa el kettlebell hacia adelante y hacia arriba, utilizando la potencia de tus caderas. Respiración: Exhala al elevar el kettlebell, inhala al regresar. Evita: Redondear la espalda o usar los brazos para levantar el peso.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 12}
99	28	Puente de Glúteos con Elevación Alterna	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda, pies apoyados en el suelo y rodillas flexionadas. Movimiento: Eleva la cadera hacia el techo apretando los glúteos y, alternando, levanta una pierna manteniéndola extendida. Respiración: Inhala al bajar, exhala al elevar. Evita: Hacer el movimiento rápido o dejar caer las caderas al bajar.", "nombre": "Puente de Glúteos con Elevación Alterna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}
152	45	Remo TRX	2	0	4	\N	2025-08-19 11:54:39.845362+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con los brazos extendidos y el cuerpo recto en diagonal. Movimiento: Tira de tus codos hacia atrás, llevando el pecho hacia las asas, manteniendo el cuerpo en línea recta. Respiración: Exhala al tirar, inhala al regresar. Evita: Dejar caer las caderas o arquear la espalda.", "nombre": "Remo TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}
153	45	Sentadillas a una Pierna con Kettlebell	3	0	3	\N	2025-08-19 11:54:39.845362+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sosten el kettlebell en la mano del lado que vas a trabajar. Párate sobre una pierna. Movimiento: Baja el cuerpo hacia abajo mientras mantienes la otra pierna levantada. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la rodilla se desplace hacia adentro y no perder el equilibrio.", "nombre": "Sentadillas a una Pierna con Kettlebell", "patron": "bisagra_cadera", "series": 3, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 8}
100	28	Tijeras en el Suelo	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda con las manos debajo de los glúteos. Movimiento: Eleva las piernas juntas hacia el techo y luego bájalas alternando un pie hacia el suelo sin tocarlo. Respiración: Inhala al bajar, exhala al subir. Evita: Levantar la cabeza o arquear la espalda baja.", "nombre": "Tijeras en el Suelo", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}
150	45	Dominadas con Peso	0	3	4	\N	2025-08-19 11:54:39.845362+02	\N	in_progress	{"tipo": "reps", "notas": "Posición inicial: Agárrate a la barra con las manos un poco más anchas que los hombros. Mantén el cuerpo recto y los pies cruzados detrás de ti. Movimiento: Tira de tu cuerpo hacia arriba hasta que la barbilla supere la barra, concentrándote en activar la espalda. Respiración: Exhala al subir, inhala al bajar. Evita: Balancearte o usar impulso.", "nombre": "Dominadas con Peso", "patron": "tracción", "series": 4, "implemento": "barra_dominadas", "descanso_seg": 60, "repeticiones": 8}
187	54	Pistol Squat asistido con silla	0	4	4	179	2025-08-23 12:32:56.458283+02	2025-08-23 12:39:20.895533+02	completed	{"tipo": "reps", "notas": "Utiliza la silla para apoyo en la bajada y asegura que la técnica sea controlada para proteger las rodillas.", "nombre": "Pistol Squat asistido con silla", "patron": "sentadilla con una pierna", "series": 4, "implemento": "silla", "descanso_seg": 60, "repeticiones": 8}
188	54	Remo en T con bandas elásticas en posición inclinado	1	0	4	\N	2025-08-23 12:32:56.458283+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la espalda recta y aprieta los omóplatos al final del movimiento para activar bien la espalda.", "nombre": "Remo en T con bandas elásticas en posición inclinado", "patron": "remo", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 60, "repeticiones": 10}
189	54	Press de hombros con mancuernas en banco inclinado	2	0	4	\N	2025-08-23 12:32:56.458283+02	\N	skipped	{"tipo": "reps", "notas": "Asegúrate de no arquear demasiado la espalda y realiza movimientos controlados para evitar lesiones en hombros.", "nombre": "Press de hombros con mancuernas en banco inclinado", "patron": "press de hombro", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 8}
190	54	Elevaciones laterales de hombro con banda elástica	3	0	3	\N	2025-08-23 12:32:56.458283+02	\N	cancelled	{"tipo": "reps", "notas": "Realiza movimientos lentos y controlados, concentrándote en la contracción muscular para maximizar el trabajo.", "nombre": "Elevaciones laterales de hombro con banda elástica", "patron": "elevación lateral", "series": 3, "implemento": "banda elástica", "descanso_seg": 60, "repeticiones": 12}
191	54	Curl de bíceps en concentración con mancuernas	4	0	3	\N	2025-08-23 12:32:56.458283+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén el codo fijado y evita balancear el cuerpo para aislar mejor el bíceps.", "nombre": "Curl de bíceps en concentración con mancuernas", "patron": "curl", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}
192	54	Extensión de tríceps con banda en banco plano	5	0	3	\N	2025-08-23 12:32:56.458283+02	\N	cancelled	{"tipo": "reps", "notas": "Controla la fase excéntrica y evita que la banda tenga demasiado slack para mantener tensión constante.", "nombre": "Extensión de tríceps con banda en banco plano", "patron": "extensión de tríceps", "series": 3, "implemento": "banda elástica", "descanso_seg": 60, "repeticiones": 10}
193	54	Plancha con levantamiento de pierna alterno	6	0	3	\N	2025-08-23 12:32:56.458283+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén el core apretado y evita que las caderas se hundan durante el ejercicio para una mejor estabilidad.", "nombre": "Plancha con levantamiento de pierna alterno", "patron": "plancha dinámica", "series": 3, "implemento": "sin implemento", "descanso_seg": 60, "repeticiones": 12}
221	60	Flexiones con palmadas explosivas	1	0	4	\N	2025-08-25 14:29:28.388107+02	\N	skipped	{"tipo": "tiempo", "notas": "Asegúrate de que tus manos despeguen del suelo de forma controlada y aterrizan suavemente para proteger las muñecas.", "nombre": "Flexiones con palmadas explosivas", "patron": "explosivo", "series": 4, "implemento": "sin implemento", "descanso_seg": 45, "duracion_seg": 30}
194	55	Clean to Press con Kettlebell	0	0	4	\N	2025-08-23 14:39:39.849304+02	\N	cancelled	{"tipo": "reps", "notas": "Utiliza una técnica controlada, asegurándote de elevar la pesa en línea recta y mantener la espalda recta durante el movimiento.", "nombre": "Clean to Press con Kettlebell", "patron": "propio peso dinámico", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 10}
195	55	Remo con Barra en Pendiente	1	0	4	\N	2025-08-23 14:39:39.849304+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén la espalda plana y activa el core para evitar lesiones. Realiza el movimiento con control y concentración en la contracción muscular.", "nombre": "Remo con Barra en Pendiente", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 12}
154	46	Push-Up a Escalera	0	\N	4	119	2025-08-19 11:59:37.019801+02	2025-08-19 12:03:59.707541+02	completed	{"tipo": "time", "notas": "Posición inicial: Manos apoyadas en el banco, cuerpo en línea recta. Movimiento: Realiza una flexión de brazos llevando el pecho hacia el banco y empuja hacia arriba. Variación: Usa una escalera o un objeto estable para variar la altura y aumentar la dificultad. Respiración: Inhala al bajar, exhala al subir. Evita: Que las caderas se hundan o se eleven excesivamente.", "nombre": "Push-Up a Escalera", "patron": "empuje", "implemento": "banco_step", "descanso_seg": 45, "duracion_seg": 30}
196	55	Saltos en Caja con Peso	2	0	4	\N	2025-08-23 14:39:39.849304+02	\N	cancelled	{"tipo": "reps", "notas": "Asegúrate de aterrizar suavemente y mantener el control en cada salto para proteger las articulaciones.", "nombre": "Saltos en Caja con Peso", "patron": "saltos pliométricos", "series": 4, "implemento": "disco o peso en mano", "descanso_seg": 45, "repeticiones": 15}
155	46	Zancadas Alternas con Mancuernas	1	\N	4	119	2025-08-19 11:59:37.019801+02	2025-08-19 12:08:22.713876+02	completed	{"tipo": "time", "notas": "Posición inicial: De pie, sosteniendo una mancuerna en cada mano, pies al ancho de los hombros. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla trasera hacia el suelo, mantén el torso erguido. Alterna piernas. Respiración: Inhala al bajar, exhala al empujar hacia arriba. Evita: Que la rodilla delantera sobrepase los dedos del pie.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "implemento": "mancuernas", "descanso_seg": 45, "duracion_seg": 30}
197	55	Elevaciones de Tronco con Discos	3	0	3	\N	2025-08-23 14:39:39.849304+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén el core contraído y evita empujar el suelo con las manos, enfócate en la contracción abdominal.", "nombre": "Elevaciones de Tronco con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 15}
156	46	Remo Alto con Banda Elástica	2	\N	4	119	2025-08-19 11:59:37.019801+02	2025-08-19 12:12:48.527181+02	completed	{"tipo": "time", "notas": "Posición inicial: Sienta la banda elástica bajo tus pies, sosteniendo los extremos con ambas manos, espalda recta. Movimiento: Tira de la banda hacia tu pecho, manteniendo los codos arriba. Controla el movimiento al soltar. Respiración: Inhala al tirar, exhala al soltar. Evita: Inclinar el torso hacia atrás al tirar.", "nombre": "Remo Alto con Banda Elástica", "patron": "tracción", "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}
108	30	Saltos de Tijera	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta abriendo las piernas y elevando los brazos por encima de la cabeza, regresa a la posición inicial. Respiración: Exhala al saltar, inhala al regresar. Evita: Aterrizar con los pies rígidos o inclinarte hacia adelante.", "nombre": "Saltos de Tijera", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
113	31	Mountain Climbers	3	0	5	\N	2025-08-19 07:28:38.455348+02	\N	skipped	{"tipo": "intervalo", "notas": "Posición inicial: En posición de plancha alta. Movimiento: Lleva una rodilla hacia el pecho mientras mantienes el torso firme y alterna. Respiración: Exhala al acercar la rodilla, inhala al regresar. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}
198	55	Sprint en Sitio con Arrastre de Pesas	4	0	4	\N	2025-08-23 14:39:39.849304+02	\N	skipped	{"tipo": "tiempo", "notas": "Levanta las rodillas con énfasis en la velocidad y arrastra las pesas con movimientos controlados para activar la cadena posterior.", "nombre": "Sprint en Sitio con Arrastre de Pesas", "patron": "cardio intenso", "series": 4, "implemento": "pesas", "descanso_seg": 45, "repeticiones": "20 segundos de trabajo / 20 segundos de descanso"}
157	46	Mountain Climbers en Banco	3	\N	4	119	2025-08-19 11:59:37.019801+02	2025-08-19 12:17:11.246264+02	completed	{"tipo": "time", "notas": "Posición inicial: Manos sobre el banco, cuerpo en línea recta desde los pies hasta la cabeza. Movimiento: Alterna llevando las rodillas hacia tu pecho a velocidad controlada. Respiración: Exhala al llevar la rodilla hacia adelante, inhala al regresar. Evita: Que las caderas se elevan o caen.", "nombre": "Mountain Climbers en Banco", "patron": "cardio", "implemento": "banco_step", "descanso_seg": 45, "duracion_seg": 30}
213	58	Remo con TRX en movimiento dinámico	3	4	4	179	2025-08-25 13:23:13.916324+02	2025-08-25 13:59:41.729648+02	completed	{"tipo": "reps", "notas": "Concéntrate en apretar los omóplatos y mantener la espalda alineada para una tracción eficiente.", "nombre": "Remo con TRX en movimiento dinámico", "patron": "remo", "series": 4, "implemento": "TRX", "descanso_seg": 45, "repeticiones": 10}
222	60	Remo con barra en posición inclinada	2	0	4	\N	2025-08-25 14:29:28.388107+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la espalda recta y activa el core en todo momento para evitar lesiones.", "nombre": "Remo con barra en posición inclinada", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}
245	65	Fondos en Silla	1	0	4	\N	2025-08-27 20:28:49.124347+02	\N	cancelled	{"tipo": "intervallo", "notas": "Mantén los codos cerca del cuerpo y baja controladamente.", "nombre": "Fondos en Silla", "patron": "fuerza", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 15}
246	65	Sentadillas con peso corporal	2	0	8	\N	2025-08-27 20:28:49.124347+02	\N	cancelled	{"tipo": "intervallo", "notas": "Mantén el torso erguido y la espalda neutral para evitar lesiones.", "nombre": "Sentadillas con peso corporal", "patron": "movimiento", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}
249	66	Puente de Glúteos en la Pared	0	3	3	134	2025-08-28 09:52:19.186191+02	2025-08-28 09:56:22.723247+02	completed	{"tipo": "reps", "notas": "Mantén la pelvis elevada y aprieta los glúteos en la parte superior del movimiento, controlando la bajada.", "nombre": "Puente de Glúteos en la Pared", "patron": "hip thrust", "series": 3, "implemento": "silla (opcional)", "descanso_seg": 45, "repeticiones": 15}
158	47	Flexiones de Brazos con Manos en Banquito	0	5	5	224	2025-08-19 12:53:42.233176+02	2025-08-19 13:00:37.315243+02	completed	{"tipo": "intervalo", "notas": "Posición inicial: Coloca tus manos en el banco con los brazos extendidos y el cuerpo en línea recta. Movimiento: Baja el pecho hacia el banco, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar hacia arriba. Evita: Dejar caer las caderas o elevar demasiado el trasero.", "nombre": "Flexiones de Brazos con Manos en Banquito", "patron": "empuje", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}
117	32	Plancha Lateral con Rodilla Apoyada	3	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado con una rodilla apoyada en el suelo, el codo directamente debajo del hombro. Movimiento: Levanta las caderas manteniendo el cuerpo en línea recta desde la cabeza hasta la rodilla apoyada. Mantén la posición. Respiración: Respira normalmente, evita contener el aliento. Evita: No dejar caer las caderas ni torcer el torso.", "nombre": "Plancha Lateral con Rodilla Apoyada", "patron": "estabilidad", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}
4	1	Remo con TRX	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén el cuerpo recto y tira hacia tu pecho.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "TRX", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}
5	1	Peso Muerto con Discos Olímpicos	4	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén la espalda recta y baja controladamente.", "nombre": "Peso Muerto con Discos Olímpicos", "patron": "bisagra de cadera", "series": 4, "implemento": "discos olímpicos", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}
6	2	Sentadilla con barra	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Asegúrate de mantener la espalda recta y bajar hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con barra", "patron": "sentadilla", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
7	2	Peso muerto con barra	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Mantén el core apretado y la barra cerca del cuerpo durante el movimiento.", "nombre": "Peso muerto con barra", "patron": "bisagra de cadera", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
8	2	Press de banca con barra	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Baja la barra controladamente y empuja hacia arriba con fuerza.", "nombre": "Press de banca con barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
9	2	Dominadas	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Agarra la barra con las palmas hacia adelante y sube hasta que la barbilla supere la barra.", "nombre": "Dominadas", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}
118	33	Flexiones de Brazos Invertidas en Sofa	0	4	4	134	2025-08-19 07:28:38.455348+02	2025-08-18 22:42:35.364897+02	completed	{"tipo": "reps", "notas": "Posición inicial: Coloca tus manos en el borde del sofá con los pies en el suelo, cuerpo recto. Movimiento: Flexiona los codos bajando el pecho hacia el sofá y empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Flexiones de Brazos Invertidas en Sofa", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}
119	33	Puente de Glúteos	1	4	4	\N	2025-08-19 07:28:38.455348+02	2025-08-18 22:46:58.096416+02	completed	{"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, rodillas flexionadas y pies apoyados en el suelo. Movimiento: Eleva las caderas apretando los glúteos hasta que tu cuerpo forme una línea recta desde los hombros hasta las rodillas. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueo excesivo en la zona lumbar.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}
120	33	Remo Invertido con Toalla	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: Ata una toalla en una puerta o un lugar seguro, sujeta los extremos. Movimiento: Inclínate hacia atrás y jala con tus brazos hacia tu pecho. Respiración: Inhala al bajar, exhala al subir. Evita: Encoger los hombros o usar el impulso.", "nombre": "Remo Invertido con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 10}
159	47	Saltos de Tijera (Jumping Jacks)	1	0	5	\N	2025-08-19 12:53:42.233176+02	\N	skipped	{"tipo": "intervalo", "notas": "Posición inicial: De pie con los pies juntos y brazos a los lados. Movimiento: Salta abriendo las piernas y levantando los brazos sobre la cabeza, luego regresa. Respiración: Inhala al abrir, exhala al cerrar. Evita: Caer con ruido y perder el control al saltar.", "nombre": "Saltos de Tijera (Jumping Jacks)", "patron": "cardio", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}
160	47	Puente de Glúteos	2	0	5	\N	2025-08-19 12:53:42.233176+02	\N	skipped	{"tipo": "intervalo", "notas": "Posición inicial: Acostado boca arriba con rodillas flexionadas y pies en el suelo. Movimiento: Eleva las caderas hacia el techo apretando los glúteos y bajando lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda baja y que los pies se deslicen.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}
161	47	Remo Invertido con Banda Elástica en Banco	3	0	5	\N	2025-08-19 12:53:42.233176+02	\N	cancelled	{"tipo": "intervalo", "notas": "Posición inicial: Coloca una banda elástica en el banco, sosteniéndola con ambas manos a la altura del pecho. Movimiento: Tira de la banda hacia el pecho, manteniendo el cuerpo recto. Respiración: Inhala al extender, exhala al jalar. Evita: Dejar caer los hombros o girar la cadera.", "nombre": "Remo Invertido con Banda Elástica en Banco", "patron": "tracción", "series": 5, "implemento": "bandas_elasticas", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}
64	20	Puente de Glúteos con Mancuerna	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba con las rodillas dobladas y los pies apoyados en el suelo. Sostén una mancuerna en la cadera. Movimiento: Eleva las caderas hacia el techo apretando los glúteos al llegar arriba, mantén una línea recta desde las rodillas hasta los hombros. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueamiento de la espalda baja.", "nombre": "Puente de Glúteos con Mancuerna", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}
65	20	Remo con Mancuerna en Posición de Cuadrupedia	3	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: A cuatro patas con una mancuerna en una mano. Movimiento: Tira de la mancuerna hacia tu cadera mientras mantienes la espalda recta. Cambia de lado después de completar las repeticiones. Respiración: Inhala al bajar, exhala al subir. Evita: Girar el torso o dejar caer el pecho.", "nombre": "Remo con Mancuerna en Posición de Cuadrupedia", "patron": "tracción", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}
66	20	Plancha con Elevación de Brazo Alterno	4	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: En posición de plancha con manos debajo de los hombros. Movimiento: Levanta una mano hacia adelante, manteniendo la estabilidad del cuerpo, alterna brazos. Respiración: Respira normalmente. Evita: Mover las caderas hacia arriba o hacia abajo.", "nombre": "Plancha con Elevación de Brazo Alterno", "patron": "estabilidad", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}
67	21	Peso Muerto Rumano con Barra	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostén la barra con un agarre ligeramente más ancho que los hombros. Mantén la espalda recta y las piernas ligeramente flexionadas. Movimiento: Baja la barra siguiendo la línea de tus piernas, manteniendo la cadera atrás. Respira: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o caer en la flexión de las rodillas.", "nombre": "Peso Muerto Rumano con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 8}
68	21	Press de Banca con Mancuernas	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Acostado en el banco, sujeta una mancuerna en cada mano a la altura del pecho. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén extendidos. Respira: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda y dejar caer las mancuernas hacia los hombros.", "nombre": "Press de Banca con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "repeticiones": 10}
69	21	Dominadas con Lastre	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Agárrate a la barra con un agarre pronado, asegurando el peso adicional en un cinturón. Movimiento: Sube hasta que la barbilla sobrepase la barra. Respira: Inhala al bajar, exhala al subir. Evita: Balancear las piernas y dejar caer los hombros.", "nombre": "Dominadas con Lastre", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 6}
70	21	Prensa de Piernas	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sentado en la máquina, coloca los pies en la plataforma a la altura de los hombros. Movimiento: Baja la plataforma flexionando las rodillas, manteniendo la espalda contra el respaldo. Respira: Inhala al bajar, exhala al subir. Evita: Levantar los talones o dejar que las rodillas se desvíen hacia adentro.", "nombre": "Prensa de Piernas", "patron": "bisagra_cadera", "series": 4, "implemento": "maquina", "descanso_seg": 90, "repeticiones": 12}
71	21	Elevación de Talones con Barra	4	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Coloca una barra sobre tu espalda, pies a la altura de los hombros. Movimiento: Eleva los talones con control y baja lentamente. Respira: Inhala al bajar, exhala al subir. Evita: Dejar caer el peso o no realizar el movimiento de manera controlada.", "nombre": "Elevación de Talones con Barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 15}
107	30	Flexiones de Brazo en Pared	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una pared, coloca tus manos en la pared a la altura de los hombros. Movimiento: Flexiona los codos para acercar el pecho a la pared, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar. Evita: Dejar caer la cabeza o arquear la espalda.", "nombre": "Flexiones de Brazo en Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}
72	22	Burpees	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies a la altura de los hombros. Movimiento: Flexiona las rodillas para caer en una posición de cuclillas, coloca las manos en el suelo, salta hacia atrás hasta una posición de plancha, realiza una flexión de brazos y salta de regreso a la cuclilla, finalizando con un salto vertical. Respiración: Exhala al saltar y al hacer la flexión. Evita: No arquees la espalda en la posición de plancha.", "nombre": "Burpees", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 20, "duracion_seg": 40}
79	23	Plancha Estática con Rotación	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "segundos", "notas": "Posición inicial: Colócate en posición de plancha con los codos alineados con los hombros. Movimiento: Rota suavemente el torso hacia un lado mientras levantas el brazo contrario. Alterna lados. Respiración: Mantén la respiración controlada. Evita: Que las caderas se hundan o eleven demasiado.", "nombre": "Plancha Estática con Rotación", "patron": "estabilización", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}
80	24	Swing con Mancuerna	0	0	5	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "timed", "notas": "Posición inicial: Pies a la altura de los hombros, con la mancuerna entre las piernas. Movimiento: Flexiona ligeramente las rodillas, inclina la cadera hacia atrás y coloca la mancuerna detrás de ti. Luego, con un movimiento explosivo, lleva la mancuerna hacia adelante y arriba, utilizando la cadera y no la espalda. Respiración: Inhala al bajar, exhala al subir. Evita: Utilizar la espalda para el movimiento y que las rodillas sobrepasen los dedos de los pies.", "nombre": "Swing con Mancuerna", "patron": "bisagra_cadera", "series": 5, "implemento": "mancuernas", "descanso_seg": 20, "duracion_seg": 40}
81	24	Flexiones de Brazo con Apoyo de Rodillas	1	0	5	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "timed", "notas": "Posición inicial: Apóyate en las manos y rodillas, con las manos a la altura de los hombros. Movimiento: Baja el pecho hacia el suelo manteniendo los codos cerca del cuerpo y luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o archivar la espalda.", "nombre": "Flexiones de Brazo con Apoyo de Rodillas", "patron": "empuje", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}
82	24	Remo con Banda Elástica	2	0	5	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "timed", "notas": "Posición inicial: Pisa la banda elástica con ambos pies y toma los extremos con las manos. Movimiento: Tira de la banda hacia ti, manteniendo los codos altos y cerca del cuerpo. Respiración: Inhala al tensar la banda, exhala al soltar. Evita: Encoger los hombros o arquear la espalda.", "nombre": "Remo con Banda Elástica", "patron": "tracción", "series": 5, "implemento": "bandas_elasticas", "descanso_seg": 20, "duracion_seg": 40}
83	24	Salto de Tijera	3	0	5	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "timed", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta y abre las piernas al mismo tiempo que levantas los brazos por encima de la cabeza, luego regresa a la posición inicial. Respiración: Mantén una respiración constante. Evita: Aterrizar ruidosamente; busca suavidad en el aterrizaje.", "nombre": "Salto de Tijera", "patron": "funcional", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}
84	25	Sentadilla Frontal con Barra	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Coloca la barra en la parte frontal de tus hombros, pies a la anchura de los hombros. Movimiento: Flexiona las rodillas y caderas, manteniendo el torso erguido, hasta que los muslos estén paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que la barra se desplace hacia adelante o que las rodillas sobrepasen la línea de los pies.", "nombre": "Sentadilla Frontal con Barra", "patron": "sentadilla", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 8}
85	25	Peso Muerto Rumano con Barra	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: De pie, con la barra en las manos frente a los muslos. Mantén los pies a la anchura de los hombros. Movimiento: Consta de una bisagra de cadera, desciende la barra manteniendo la espalda recta y las piernas semi-flexionadas, hasta sentir un estiramiento en los isquiotibiales. Respiración: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o dejar caer la barra hacia abajo sin control.", "nombre": "Peso Muerto Rumano con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 10}
86	25	Press Militar con Mancuernas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Siéntate en un banco con respaldo, sostén las mancuernas a la altura de los hombros. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos. Respiración: Inhala al bajar, exhala al subir. Evita: No arquear la espalda y asegura que las muñecas estén alineadas.", "nombre": "Press Militar con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "repeticiones": 8}
87	25	Dominadas con Peso	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Cuélgate de la barra con las palmas hacia adelante, manos a la anchura de los hombros. Movimiento: Tira de tu cuerpo hacia arriba hasta que tu barbilla esté por encima de la barra. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte y no descender completamente al final del movimiento.", "nombre": "Dominadas con Peso", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 6}
89	26	Sentadilla con Mancuerna	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos en el pecho. Pies a la anchura de los hombros. Movimiento: Desciende flexionando las rodillas, manteniendo el torso erguido, hasta que los muslos estén paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Mancuerna", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}
88	25	Fondos con Peso en Paralelas	4	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostente en las paralelas, brazos extendidos. Movimiento: Baja el cuerpo flexionando los codos y lleva los hombros hacia adelante, sube de nuevo. Respiración: Inhala al bajar, exhala al subir. Evita: Que los hombros se eleven hacia las orejas y no olvides mantener el core contraído.", "nombre": "Fondos con Peso en Paralelas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 8}
92	26	Puente de Glúteos	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, pies apoyados en el suelo a la altura de las rodillas, brazos a los lados. Movimiento: Levanta las caderas apretando los glúteos hasta formar una línea recta de las rodillas a los hombros. Respiración: Inhala al bajar, exhala al subir. Evita: No empujar con la espalda baja.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}
93	27	Thruster con Barra	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostén la barra a la altura de los hombros, con los pies a la anchura de los hombros. Movimiento: Realiza una sentadilla profunda y, al levantarte, empuja la barra hacia arriba, extendiendo completamente los brazos. Respiración: Inhala al bajar, exhala al subir. Evita: Caer hacia adelante o que la barra se desplace de su posición inicial.", "nombre": "Thruster con Barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 10}
94	27	Zancadas Alternas con Mancuernas	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados, pies juntos. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla de atrás hacia el suelo, vuelve a la posición inicial y cambia de pierna. Respiración: Inhala al bajar, exhala al volver a la posición inicial. Evita: Que la rodilla de la pierna adelante sobrepase el tobillo.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}
95	27	Kettlebell Swing	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: De pie, con los pies a la anchura de los hombros, sosteniendo una kettlebell con ambas manos. Movimiento: Flexiona las caderas y baja la kettlebell entre las piernas, luego, con un movimiento explosivo, eleva la kettlebell hasta la altura de los ojos. Respiración: Inhala al bajar, exhala al elevar. Evita: Usar los brazos para levantar la kettlebell, el movimiento debe venir de las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebell", "descanso_seg": 60, "repeticiones": 15}
96	27	Plancha con Rotación	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: En posición de plancha, con las manos bajo los hombros. Movimiento: Gira el tronco hacia un lado, levantando el brazo del lado opuesto hacia el techo y regresa a la posición de plancha. Respiración: Inhala en la posición inicial, exhala al elevar el brazo. Evita: Dejar caer la cadera o mantener los pies demasiado juntos.", "nombre": "Plancha con Rotación", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}
97	28	Sentadilla con Salto	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros y brazos extendidos al frente. Movimiento: Baja a una sentadilla profunda y al subir, impulsa tu cuerpo hacia arriba en un salto. Aterriza suavemente volviendo a la posición inicial. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con las rodillas inestables o encorvar la espalda al aterrizar.", "nombre": "Sentadilla con Salto", "patron": "sentadilla", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 10}
98	28	Flexiones de Brazo con Patada	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: En posición de plancha, manos bajo los hombros, cuerpo en línea recta. Movimiento: Realiza una flexión de brazos y al subir, lleva una rodilla hacia el pecho. Alterna las piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o elevar demasiado el trasero.", "nombre": "Flexiones de Brazo con Patada", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 8}
101	28	Escalador	4	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con el cuerpo en línea recta. Movimiento: Lleva una rodilla hacia el pecho y alterna rápidamente las piernas como si estuvieras corriendo. Respiración: Mantén una respiración constante y fluida. Evita: Mover las caderas hacia arriba o hacia abajo.", "nombre": "Escalador", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
102	29	Sentadilla con Elevación de Talones	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros. Movimiento: Realiza una sentadilla normal, manteniendo el pecho erguido. Al subir, eleva los talones del suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepasen la línea de los dedos de los pies.", "nombre": "Sentadilla con Elevación de Talones", "patron": "sentadilla", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}
103	29	Flexiones de Brazo en Silla	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Coloca las manos en el borde de la silla a la altura del pecho, pies en el suelo. Movimiento: Flexiona los codos, llevando el pecho hacia la silla, manteniendo el cuerpo en línea recta. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o subirlas demasiado.", "nombre": "Flexiones de Brazo en Silla", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}
104	29	Zancadas Alternas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Pies juntos. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla de la otra pierna casi hasta el suelo. Mantén el torso erguido. Respiración: Inhala al dar el paso, exhala al volver. Evita: Que la rodilla delantera sobrepase los dedos del pie.", "nombre": "Zancadas Alternas", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}
105	29	Plancha con Toalla	3	0	3	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: Coloca tus antebrazos sobre la toalla en el suelo y extiende las piernas hacia atrás. Movimiento: Mantén el cuerpo en línea recta desde los talones hasta la cabeza. Respiración: Respira de manera controlada. Evita: Que las caderas se hundan o se eleven demasiado.", "nombre": "Plancha con Toalla", "patron": "isometría", "series": 3, "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}
106	30	Puente de Glúteos con Elevación de Pierna	0	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: Acostado sobre tu espalda, con las rodillas flexionadas y los pies apoyados en el suelo. Eleva una pierna manteniéndola recta. Movimiento: Levanta la cadera hacia el techo mientras elevas la pierna, asegurándote de contraer los glúteos. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueos en la espalda baja o que el pie apoyado se deslice.", "nombre": "Puente de Glúteos con Elevación de Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
109	30	Subida a Silla/Sofá	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, con los pies a la altura de los hombros. Movimiento: Sube un pie a la silla y empuja con esa pierna para elevar todo tu cuerpo, luego baja y repite con la otra pierna. Respiración: Exhala al subir, inhala al bajar. Evita: Saltar con los pies o usar solo la parte baja de la espalda.", "nombre": "Subida a Silla/Sofá", "patron": "tracción", "series": 4, "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}
114	32	Sentadilla en Silla	0	4	4	134	2025-08-19 07:28:38.455348+02	2025-08-18 21:35:46.546473+02	completed	{"tipo": "reps", "notas": "Posición inicial: Coloca una silla detrás de ti, pies a la altura de los hombros. Movimiento: Baja controladamente hacia la silla, manteniendo el pecho erguido y las rodillas alineadas con los pies. Al llegar al borde de la silla, regresa a la posición inicial. Respiración: Inhala al bajar, exhala al levantar. Evita: No dejar que las rodillas se desvíen hacia adentro.", "nombre": "Sentadilla en Silla", "patron": "sentadilla", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}
112	31	Sentadilla con Bandas Elásticas	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	skipped	{"tipo": "intervalo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus muslos, justo encima de las rodillas. Movimiento: Baja en una sentadilla, empujando las rodillas hacia afuera para resistir la banda. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se cierren hacia adentro.", "nombre": "Sentadilla con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_trabajo_seg": 30}
110	31	Burpees Modificados	0	5	5	134	2025-08-19 07:28:38.455348+02	2025-08-18 21:23:30.890138+02	completed	{"tipo": "intervalo", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros. Movimiento: Baja a una posición de cuclillas, coloca las manos en el suelo y salta hacia atrás a una posición de plancha, luego regresa a la cuclilla y salta hacia arriba. Respiración: Inhala al bajar y exhala al saltar. Evita: Hiperventilar o perder la postura en la plancha.", "nombre": "Burpees Modificados", "patron": "funcional", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}
111	31	Flexiones de Brazos con Rodillas Apoyadas	1	0	4	\N	2025-08-19 07:28:38.455348+02	\N	skipped	{"tipo": "intervalo", "notas": "Posición inicial: En posición de flexión, con rodillas en el suelo. Movimiento: Baja el pecho hacia el suelo flexionando los codos, manteniendo la alineación del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas y archivar la espalda.", "nombre": "Flexiones de Brazos con Rodillas Apoyadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}
116	32	Elevaciones de Talón en Silla	2	0	4	\N	2025-08-19 07:28:38.455348+02	\N	pending	{"tipo": "reps", "notas": "Posición inicial: Apóyate en la parte posterior de una silla con las manos, pies a la altura de los hombros. Movimiento: Eleva los talones del suelo manteniendo la posición. Aprieta los gemelos en la parte superior y regresa a la posición inicial. Respiración: Exhala al elevar, inhala al bajar. Evita: No dejar caer la cadera hacia atrás.", "nombre": "Elevaciones de Talón en Silla", "patron": "bisagra_cadera", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}
115	32	Flexiones de Brazos en Pared	1	3	4	\N	2025-08-19 07:28:38.455348+02	\N	in_progress	{"tipo": "reps", "notas": "Posición inicial: De pie frente a una pared, coloca las manos al ancho de los hombros sobre la pared. Movimiento: Flexiona los codos llevando el pecho hacia la pared y empuja de regreso a la posición inicial. Respiración: Inhala al bajar, exhala al subir. Evita: No arquear la espalda ni permitir que las caderas se desplacen hacia adelante.", "nombre": "Flexiones de Brazos en Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 60, "repeticiones": 12}
121	33	Sentadilla a Silla	3	0	4	\N	2025-08-19 07:28:38.455348+02	\N	skipped	{"tipo": "reps", "notas": "Posición inicial: De pie frente a una silla, pies al ancho de los hombros. Movimiento: Baja las caderas hacia atrás como si fueras a sentarte, detente justo antes de tocar la silla, luego sube. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepasen los dedos de los pies.", "nombre": "Sentadilla a Silla", "patron": "sentadilla", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 12}
201	56	Remo en Puente usando Silla y Toalla	2	0	4	\N	2025-08-23 15:04:15.516777+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén una línea recta desde los hombros hasta los talones, jalando la toalla hacia ti mientras aprietas la espalda.", "nombre": "Remo en Puente usando Silla y Toalla", "patron": "remo", "series": 4, "implemento": "toalla y silla", "descanso_seg": 45, "repeticiones": 12}
202	56	Plancha Dinámica con Desplazamiento lateral	3	0	3	\N	2025-08-23 15:04:15.516777+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén el core firme y evita que las caderas se hundan. Desplaza las manos o los pies lateralmente para mayor movimiento.", "nombre": "Plancha Dinámica con Desplazamiento lateral", "patron": "plancha", "series": 3, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 12}
162	48	Sentadilla con Salto	0	4	4	119	2025-08-19 13:40:31.625414+02	2025-08-19 13:44:55.602278+02	completed	{"tipo": "tiempo", "notas": "Posición inicial: Pies al ancho de los hombros. Movimiento: Realiza una sentadilla y al subir, salta explosivamente. Aterriza suavemente. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con los pies juntos o permitir que las rodillas sobrepasen los dedos de los pies.", "nombre": "Sentadilla con Salto", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
163	48	Puente de Glúteos con Elevación	1	0	4	\N	2025-08-19 13:40:31.625414+02	\N	skipped	{"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba, rodillas flexionadas y pies en el suelo. Movimiento: Eleva las caderas hacia el techo apretando glúteos y abdominales. Respiración: Inhala al bajar, exhala al elevar. Evita: Dejar caer los glúteos al suelo sin activar los músculos.", "nombre": "Puente de Glúteos con Elevación", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
164	48	Remo en Posición de Planchas con Banda Elástica	2	0	4	\N	2025-08-19 13:40:31.625414+02	\N	cancelled	{"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos en el suelo, con la banda elástica bajo tus pies. Movimiento: Tira de la banda hacia tu torso mientras mantienes el cuerpo recto. Respiración: Inhala al tirar, exhala al regresar. Evita: Girar las caderas o relajar el abdomen.", "nombre": "Remo en Posición de Planchas con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}
165	48	Burpees Modificados	3	0	4	\N	2025-08-19 13:40:31.625414+02	\N	cancelled	{"tipo": "tiempo", "notas": "Posición inicial: De pie. Movimiento: Baja a cuclillas, pon las manos en el suelo, salta hacia atrás a la posición de plancha, regresa a cuclillas y salta al final. Respiración: Inhala al bajar, exhala al saltar. Evita: No dejar caer las caderas en la posición de plancha.", "nombre": "Burpees Modificados", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}
240	64	TRX Atomic Push-ups	1	1	3	\N	2025-08-27 20:01:11.180368+02	\N	in_progress	{"tipo": "reps", "notas": "Mantén el core activo mientras alternas entre plancha y flexión apoyado en TRX, controlando la respiración.", "nombre": "TRX Atomic Push-ups", "patron": "plancha en movimiento", "series": 3, "implemento": "TRX", "descanso_seg": 60, "repeticiones": 10}
250	66	Elevación Alterna de Piernas en Posición de Sentadilla	1	3	3	134	2025-08-28 09:52:19.186191+02	2025-08-28 10:01:37.311005+02	completed	{"tipo": "reps", "notas": "Mantén una postura estable y realiza movimientos controlados para activar el core y los abductores.", "nombre": "Elevación Alterna de Piernas en Posición de Sentadilla", "patron": "pierna", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 12}
225	61	Elevaciones de rodillas en silla con impulso	0	0	4	\N	2025-08-25 18:02:57.238792+02	\N	skipped	{"tipo": "reps", "notas": "Sube las rodillas con fuerza, utilizando las manos en la silla para impulso, mantén la espalda recta y evita movimientos bruscos.", "nombre": "Elevaciones de rodillas en silla con impulso", "patron": "cardio dinámico", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 20}
226	61	Plancha con toque de hombros alterno	1	0	3	\N	2025-08-25 18:02:57.238792+02	\N	skipped	{"tipo": "reps", "notas": "Mantén la cadera estable durante el movimiento y evita que las caderas se muevan de lado a lado para una mayor estabilidad y activación del core.", "nombre": "Plancha con toque de hombros alterno", "patron": "estabilidad", "series": 3, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 16}
227	61	Saltos laterales sobre línea imaginaria (sin cuerda)	2	0	4	\N	2025-08-25 18:02:57.238792+02	\N	skipped	{"tipo": "reps", "notas": "Realiza saltos en un lado a otro de manera rápida pero controlada, asegurando un aterrizaje suave para cuidar las articulaciones.", "nombre": "Saltos laterales sobre línea imaginaria (sin cuerda)", "patron": "cardio", "series": 4, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 30}
228	61	Flexiones de brazos con manos en suelo elevado en una silla	3	0	3	\N	2025-08-25 18:02:57.238792+02	\N	cancelled	{"tipo": "reps", "notas": "Mantén el cuerpo en línea recta desde la cabeza hasta los talones y evita que las caderas se hundan o suban demasiado en cada repetición.", "nombre": "Flexiones de brazos con manos en suelo elevado en una silla", "patron": "fuerza", "series": 3, "implemento": "silla", "descanso_seg": 45, "repeticiones": 12}
257	67	Russian Twists con Toalla o Peso Ligero	3	3	3	134	2025-08-28 12:05:55.213941+02	2025-08-28 12:26:37.008814+02	completed	{"tipo": "reps", "notas": "Gira el torso desde las caderas y mantén la espalda recta, asegurando una correcta rotación de la columna.", "nombre": "Russian Twists con Toalla o Peso Ligero", "patron": "rotacion", "series": 3, "implemento": "toalla o peso ligero", "descanso_seg": 45, "repeticiones": 20}
231	62	Flexiones con Cuerda de Soga	2	0	4	\N	2025-08-25 18:40:40.784347+02	\N	skipped	{"tipo": "flexion", "notas": "Mantén el cuerpo alineado, evita que la pelvis se hunda. Usa la cuerda para un impulso adicional si buscas mayor intensidad.", "nombre": "Flexiones con Cuerda de Soga", "patron": "flexión", "series": 4, "implemento": "cuerda", "descanso_seg": 45, "repeticiones": 20}
232	62	Remo con Barra en Explosión	3	0	4	\N	2025-08-25 18:40:40.784347+02	\N	skipped	{"tipo": "fuerza", "notas": "Realiza un remo explosivo, elevando la barra hasta el torso rápidamente y bajando controladamente. Mantén la espalda recta.", "nombre": "Remo con Barra en Explosión", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}
229	62	Saltos de Pliometría con Discos	0	5	5	224	2025-08-25 18:40:40.784347+02	2025-08-25 18:47:37.084715+02	completed	{"tipo": "saltar", "notas": "Aterriza suavemente con las rodillas ligeramente flexionadas para proteger las articulaciones, impulsa con toda la fuerza de las piernas.", "nombre": "Saltos de Pliometría con Discos", "patron": "power", "series": 5, "implemento": "discos", "descanso_seg": 45, "repeticiones": 30}
233	62	Mountain Climbers con Discos	4	0	3	\N	2025-08-25 18:40:40.784347+02	\N	cancelled	{"tipo": "cardio", "notas": "Mantén el core firme y realiza movimientos rápidos, evitando que las caderas caigan o suban demasiado.", "nombre": "Mountain Climbers con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 40}
234	63	Saltos de Pliometría con Discos	0	0	5	\N	2025-08-27 20:00:29.58193+02	\N	pending	{"tipo": "saltar", "notas": "Aterriza suavemente con las rodillas ligeramente flexionadas para proteger las articulaciones, impulsa con toda la fuerza de las piernas.", "nombre": "Saltos de Pliometría con Discos", "patron": "power", "series": 5, "implemento": "discos", "descanso_seg": 45, "repeticiones": 30}
230	62	Swing de Kettlebell a Doble Mano	1	4	4	179	2025-08-25 18:40:40.784347+02	2025-08-25 18:53:18.712809+02	completed	{"tipo": "movimiento", "notas": "Mantén la espalda recta y activa el core durante todo el movimiento, evita la sobreextensión lumbar.", "nombre": "Swing de Kettlebell a Doble Mano", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}
235	63	Swing de Kettlebell a Doble Mano	1	0	4	\N	2025-08-27 20:00:29.58193+02	\N	pending	{"tipo": "movimiento", "notas": "Mantén la espalda recta y activa el core durante todo el movimiento, evita la sobreextensión lumbar.", "nombre": "Swing de Kettlebell a Doble Mano", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}
236	63	Flexiones con Cuerda de Soga	2	0	4	\N	2025-08-27 20:00:29.58193+02	\N	pending	{"tipo": "flexion", "notas": "Mantén el cuerpo alineado, evita que la pelvis se hunda. Usa la cuerda para un impulso adicional si buscas mayor intensidad.", "nombre": "Flexiones con Cuerda de Soga", "patron": "flexión", "series": 4, "implemento": "cuerda", "descanso_seg": 45, "repeticiones": 20}
237	63	Remo con Barra en Explosión	3	0	4	\N	2025-08-27 20:00:29.58193+02	\N	pending	{"tipo": "fuerza", "notas": "Realiza un remo explosivo, elevando la barra hasta el torso rápidamente y bajando controladamente. Mantén la espalda recta.", "nombre": "Remo con Barra en Explosión", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}
238	63	Mountain Climbers con Discos	4	0	3	\N	2025-08-27 20:00:29.58193+02	\N	pending	{"tipo": "cardio", "notas": "Mantén el core firme y realiza movimientos rápidos, evitando que las caderas caigan o suban demasiado.", "nombre": "Mountain Climbers con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 40}
241	64	Saltos laterales sobre Caja con Peso	2	0	3	\N	2025-08-27 20:01:11.180368+02	\N	pending	{"tipo": "tiempo", "notas": "Asegúrate de aterrizar con las rodillas ligeramente flexionadas y mantener una postura estable en cada salto.", "nombre": "Saltos laterales sobre Caja con Peso", "patron": "plyometric", "series": 3, "implemento": "disco peso", "descanso_seg": 60, "duracion_seg": 30}
242	64	Lanzamiento de Kettlebell con Giro	3	0	3	\N	2025-08-27 20:01:11.180368+02	\N	pending	{"tipo": "reps", "notas": "Gira el torso al lanzar la kettlebell, controlando el movimiento y evitando rotaciones bruscas de la columna.", "nombre": "Lanzamiento de Kettlebell con Giro", "patron": "rotacional", "series": 3, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 12}
243	64	Progresión de Sentadillas en Pared con Desplazamiento	4	0	3	\N	2025-08-27 20:01:11.180368+02	\N	pending	{"tipo": "reps", "notas": "Realiza sentadillas apoyado en la pared y desplaza lateralmente, manteniendo la espalda pegada y el core firme.", "nombre": "Progresión de Sentadillas en Pared con Desplazamiento", "patron": "sentadilla en pared", "series": 3, "implemento": "silla", "descanso_seg": 60, "repeticiones": 12}
258	67	Estocadas Alternas con Toalla para Resistencia	4	3	3	134	2025-08-28 12:05:55.213941+02	2025-08-28 12:31:28.055555+02	completed	{"tipo": "reps", "notas": "Realiza pasos largos y controla el movimiento, usando la toalla para añadir resistencia o equilibrio en la parte superior si es necesario.", "nombre": "Estocadas Alternas con Toalla para Resistencia", "patron": "estocada", "series": 3, "implemento": "toalla", "descanso_seg": 60, "repeticiones": 12}
239	64	Kettlebell Swings Explosivos	0	4	4	179	2025-08-27 20:01:11.180368+02	2025-08-27 20:08:33.065719+02	completed	{"tipo": "reps", "notas": "Impulsa con las caderas, mantén la espalda recta y controla el movimiento al bajar y subir la kettlebell.", "nombre": "Kettlebell Swings Explosivos", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}
251	66	Press de Pared con Flexión de Escápulas	2	3	3	134	2025-08-28 09:52:19.186191+02	2025-08-28 10:05:42.500912+02	completed	{"tipo": "reps", "notas": "Realiza la contracción escapular asegurando la correcta alineación del hombro y evitando sobrecarga en la zona cervical.", "nombre": "Press de Pared con Flexión de Escápulas", "patron": "press", "series": 3, "implemento": "pared", "descanso_seg": 45, "repeticiones": 12}
255	67	Pike Push-Up (Flexión en V invertida para hombros)	1	3	3	134	2025-08-28 12:05:55.213941+02	2025-08-28 12:18:06.255868+02	completed	{"tipo": "reps", "notas": "Enfócate en mantener las caderas elevadas y los brazos alineados para activar la parte superior de tu espalda y hombros.", "nombre": "Pike Push-Up (Flexión en V invertida para hombros)", "patron": "flexión", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 12}
260	68	Mountain Climbers con Giro Torácico	1	0	4	\N	2025-08-28 12:53:39.841595+02	\N	skipped	{"tipo": "reps", "notas": "Mantén el core fuerte y lleva la rodilla hacia el codo opuesto en cada repetición para activar oblicuos y mejorar la estabilidad.", "nombre": "Mountain Climbers con Giro Torácico", "patron": "cardio dinámico", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}
261	68	Saltos Pliométricos en Caja Alterna	2	0	3	\N	2025-08-28 12:53:39.841595+02	\N	skipped	{"tipo": "reps", "notas": "Salta con ambos pies y alterna ligeramente la dirección, asegurando una aterrizaje suave para proteger articulaciones.", "nombre": "Saltos Pliométricos en Caja Alterna", "patron": "saltos", "series": 3, "implemento": "caja improvisada o altura segura", "descanso_seg": 45, "repeticiones": 15}
262	68	Remo con Toalla en Puerta	3	0	4	\N	2025-08-28 12:53:39.841595+02	\N	cancelled	{"tipo": "reps", "notas": "Usa una toalla resistente para realizar un remo isométrico, asegurándote de mantener la espalda recta y contractar el dorsal.", "nombre": "Remo con Toalla en Puerta", "patron": "fuerza", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 12}
263	68	Burpees con Salto Vertical	4	0	4	\N	2025-08-28 12:53:39.841595+02	\N	skipped	{"tipo": "reps", "notas": "Realiza un burpee explosivo, asegurándote de mantener la técnica y evitar movimientos bruscos que puedan lesionarte.", "nombre": "Burpees con Salto Vertical", "patron": "cardio intenso", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}
253	66	Marcha en Vuelta de Toalla (Balance Dinámico)	4	3	3	134	2025-08-28 09:52:19.186191+02	2025-08-28 10:19:56.273235+02	completed	{"tipo": "reps", "notas": "Usa la toalla para mejorar el equilibrio y coordinación en movimientos de marcha controlada, activando estabilizadores de pie y tobillo.", "nombre": "Marcha en Vuelta de Toalla (Balance Dinámico)", "patron": "equilibrio", "series": 3, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 20}
244	65	Jumping Jacks	0	0	8	\N	2025-08-27 20:28:49.124347+02	\N	cancelled	{"tipo": "intervallo", "notas": "Mantén el ritmo y evita perder la postura. Usa los brazos para mejorar el ritmo aeróbico.", "nombre": "Jumping Jacks", "patron": "cardio", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 45}
247	65	Mountain Climbers	3	0	6	\N	2025-08-27 20:28:49.124347+02	\N	cancelled	{"tipo": "intervallo", "notas": "Activa bien el abdomen y mantén la cadera estable durante el movimiento.", "nombre": "Mountain Climbers", "patron": "core", "series": 6, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}
248	65	Plancha con Toque de Hombro	4	0	4	\N	2025-08-27 20:28:49.124347+02	\N	skipped	{"tipo": "intervallo", "notas": "Mantén el cuerpo en línea recta y evita que las caderas se hundan.", "nombre": "Plancha con Toque de Hombro", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 12}
254	67	Burpees con salto y toque de rodillas	0	3	3	134	2025-08-28 12:05:55.213941+02	2025-08-28 12:10:22.091855+02	completed	{"tipo": "reps", "notas": "Mantén una espalda recta en la bajada y realiza el salto explosivo, tocando las rodillas en el aire para incrementar intensidad.", "nombre": "Burpees con salto y toque de rodillas", "patron": "salto", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}
256	67	Elevaciones laterales de pierna en posición de cuadrupedia	2	3	3	134	2025-08-28 12:05:55.213941+02	2025-08-28 12:22:36.155798+02	completed	{"tipo": "reps", "notas": "Mantén el core firme y realiza movimientos controlados para activar glúteos y piernas sin perder estabilidad.", "nombre": "Elevaciones laterales de pierna en posición de cuadrupedia", "patron": "elevacion", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}
259	68	Flexiones con Palmada Alterna	0	4	4	179	2025-08-28 12:53:39.841595+02	2025-08-28 12:59:05.15098+02	completed	{"tipo": "reps", "notas": "Realiza una flexión explosiva y, en el ascenso, da una palmada en cada mano para activar potencia y coordinación.", "nombre": "Flexiones con Palmada Alterna", "patron": "flexiones", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}
\.


--
-- TOC entry 5877 (class 0 OID 27992)
-- Dependencies: 321
-- Data for Name: home_training_combinations; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_training_combinations (id, equipment_type, training_type, combination_code, display_name, description, equipment_list, focus_areas, difficulty_level, estimated_duration_range, created_at) FROM stdin;
1	minimo	funcional	MIN_FUNC	Equipamiento Mínimo + Funcional	Movimientos funcionales usando solo peso corporal y elementos básicos del hogar	{"Peso corporal",Toallas,Silla/Sofá,Pared}	{Movilidad,Equilibrio,"Fuerza funcional",Coordinación}	principiante	20-45 min	2025-08-28 11:10:27.587413+02
2	minimo	hiit	MIN_HIIT	Equipamiento Mínimo + HIIT	Entrenamiento de alta intensidad usando solo tu cuerpo y elementos del hogar	{"Peso corporal",Toallas,Silla/Sofá,Pared}	{"Cardio intenso","Quema grasa",Resistencia,Explosividad}	intermedio	20-45 min	2025-08-28 11:10:27.587413+02
3	minimo	fuerza	MIN_FUER	Equipamiento Mínimo + Fuerza	Desarrollo de fuerza mediante progresiones de peso corporal	{"Peso corporal",Toallas,Silla/Sofá,Pared}	{"Fuerza relativa",Progresiones,"Resistencia muscular"}	intermedio	20-45 min	2025-08-28 11:10:27.587413+02
4	basico	funcional	BAS_FUNC	Equipamiento Básico + Funcional	Entrenamiento funcional con herramientas básicas de fitness	{"Mancuernas ajustables","Bandas elásticas",Esterilla,Banco/Step}	{"Fuerza funcional",Estabilidad,"Patrones de movimiento"}	intermedio	20-45 min	2025-08-28 11:10:27.597948+02
5	basico	hiit	BAS_HIIT	Equipamiento Básico + HIIT	HIIT intenso combinando cardio y fuerza con equipamiento básico	{"Mancuernas ajustables","Bandas elásticas",Esterilla,Banco/Step}	{Cardio-fuerza,Metabolismo,Resistencia,Potencia}	intermedio	20-45 min	2025-08-28 11:10:27.597948+02
6	basico	fuerza	BAS_FUER	Equipamiento Básico + Fuerza	Desarrollo de fuerza usando mancuernas y resistencia variable	{"Mancuernas ajustables","Bandas elásticas",Esterilla,Banco/Step}	{Hipertrofia,Fuerza,"Progresión de carga"}	intermedio	20-45 min	2025-08-28 11:10:27.597948+02
7	avanzado	funcional	AVZ_FUNC	Equipamiento Avanzado + Funcional	Entrenamiento funcional avanzado con equipamiento profesional	{"Barra dominadas",Kettlebells,TRX,"Discos olímpicos"}	{"Fuerza funcional avanzada",Poder,Atletismo,"Coordinación compleja"}	avanzado	20-45 min	2025-08-28 11:10:27.6004+02
8	avanzado	hiit	AVZ_HIIT	Equipamiento Avanzado + HIIT	HIIT de nivel competitivo con herramientas profesionales	{"Barra dominadas",Kettlebells,TRX,"Discos olímpicos"}	{"Condición atlética","Potencia máxima","Resistencia anaeróbica"}	avanzado	20-45 min	2025-08-28 11:10:27.6004+02
9	avanzado	fuerza	AVZ_FUER	Equipamiento Avanzado + Fuerza	Desarrollo de fuerza máxima con equipamiento profesional	{"Barra dominadas",Kettlebells,TRX,"Discos olímpicos"}	{"Fuerza máxima","Masa muscular",Potencia,"Resistencia de fuerza"}	avanzado	20-45 min	2025-08-28 11:10:27.6004+02
10	personalizado	funcional	PER_FUNC	Mi Equipamiento + Funcional	Entrenamiento funcional adaptado a tu equipamiento específico	{"Equipamiento personalizado del usuario"}	{Adaptabilidad,Funcionalidad,"Optimización de recursos"}	variable	20-45 min	2025-08-28 11:10:27.602557+02
11	personalizado	hiit	PER_HIIT	Mi Equipamiento + HIIT	HIIT personalizado usando tu equipamiento disponible	{"Equipamiento personalizado del usuario"}	{"Intensidad adaptada",Versatilidad,Eficiencia}	variable	20-45 min	2025-08-28 11:10:27.602557+02
12	personalizado	fuerza	PER_FUER	Mi Equipamiento + Fuerza	Desarrollo de fuerza optimizado para tu equipamiento	{"Equipamiento personalizado del usuario"}	{"Fuerza personalizada","Progresión adaptada"}	variable	20-45 min	2025-08-28 11:10:27.602557+02
\.


--
-- TOC entry 5810 (class 0 OID 26720)
-- Dependencies: 229
-- Data for Name: home_training_plans; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_training_plans (id, user_id, plan_data, equipment_type, training_type, created_at, updated_at) FROM stdin;
1	\N	{"plan_entrenamiento": {"fecha": "2023-10-05", "titulo": "HIIT en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel intermedio", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y asegúrate de realizar un salto explosivo.", "nombre": "Burpees", "patron": "explosivo", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Aterriza suavemente para proteger tus rodillas.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Usa la banda para añadir resistencia y trabaja el pecho y los tríceps.", "nombre": "Flexiones con banda elástica", "patron": "empuje", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén la espalda recta y lleva las mancuernas hacia el abdomen.", "nombre": "Remo con mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Alterna la elevación de piernas manteniendo el core activado.", "nombre": "Plancha con elevación de pierna", "patron": "estabilización", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es mejorar tu forma física. Con un año de experiencia y un nivel de actividad moderado, he diseñado un plan HIIT usando tu equipamiento básico. Este plan te ayudará a aumentar tu resistencia y mejorar tu condición física general. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 04:37:20.475824+02	2025-08-17 04:37:20.475824+02
2	\N	{"plan_entrenamiento": {"fecha": "2023-10-11", "titulo": "Fuerza en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel intermedio", "ejercicios": [{"tipo": "reps", "notas": "Mantén el pecho erguido y baja hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con mancuernas", "patron": "sentadilla", "series": 5, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Asegúrate de que los codos no bajen más allá del nivel del banco.", "nombre": "Press de banca con mancuernas", "patron": "empuje horizontal", "series": 5, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y lleva las mancuernas hacia la cadera.", "nombre": "Remo con mancuernas", "patron": "tracción horizontal", "series": 5, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Siente el estiramiento en los isquiotibiales y mantén la espalda recta.", "nombre": "Peso muerto rumano con mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Realiza el movimiento de forma controlada y siente el trabajo en los gemelos.", "nombre": "Elevación de talones con mancuernas", "patron": "pantorrillas", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}], "tipo_nombre": "Fuerza", "equipamiento": "basico", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 60}, "mensaje_personalizado": "¡Hola! Con 30 años y un año de experiencia, tu objetivo es mejorar tu forma física. He diseñado un plan de fuerza usando tu equipamiento básico, centrado en ejercicios multiarticulares que potenciarán tu fuerza general. ¡Sigue adelante y verás grandes resultados!"}	basico	fuerza	2025-08-17 04:39:11.452221+02	2025-08-17 04:39:11.452221+02
3	\N	{"plan_entrenamiento": {"fecha": "2023-10-11", "titulo": "HIIT en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel intermedio", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza los burpees de manera explosiva, manteniendo una buena forma.", "nombre": "Burpees", "patron": "cardio", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Asegúrate de aterrizar suavemente y mantener el control.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén el core firme y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones con mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Concentra el movimiento en los músculos de la espalda.", "nombre": "Remo con bandas elásticas", "patron": "tracción", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén el cuerpo en línea recta y eleva la cadera de forma controlada.", "nombre": "Plancha lateral con elevación de cadera", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es mejorar tu forma física. Con tu nivel de actividad moderado y un año de experiencia, he diseñado un plan HIIT usando tu equipamiento básico. Este plan te ayudará a mejorar tu resistencia y fuerza general. ¡Mantén el ritmo y disfruta del proceso!"}	basico	hiit	2025-08-17 04:39:55.987367+02	2025-08-17 04:39:55.987367+02
4	\N	{"plan_entrenamiento": {"fecha": "2023-10-05", "titulo": "HIIT en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel intermedio", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza cada repetición con explosividad para maximizar el esfuerzo.", "nombre": "Burpees", "patron": "full body", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "intervalo", "notas": "Asegúrate de aterrizar suavemente para proteger tus rodillas.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén el core apretado y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "intervalo", "notas": "Evita el balanceo de caderas mientras tocas tus hombros alternadamente.", "nombre": "Planchas con toques de hombro", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y constante para maximizar el trabajo cardiovascular.", "nombre": "Escaladores", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es mejorar tu forma física. Con un año de experiencia y un nivel de actividad moderado, he diseñado un plan HIIT usando equipamiento mínimo para desafiarte y ayudarte a alcanzar tus metas. ¡Vamos a por ello!"}	minimo	hiit	2025-08-17 04:41:29.362001+02	2025-08-17 04:41:29.362001+02
5	\N	{"plan_entrenamiento": {"fecha": "2023-10-05", "titulo": "HIIT en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel moderado", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza los burpees de forma explosiva, manteniendo una buena técnica.", "nombre": "Burpees", "patron": "cardio", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Asegúrate de aterrizar suavemente y con control.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Usa la banda para añadir resistencia a las flexiones.", "nombre": "Flexiones con banda elástica", "patron": "empuje", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén la espalda recta y el core activado durante el ejercicio.", "nombre": "Remo con mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Alterna la elevación de piernas mientras mantienes la plancha.", "nombre": "Plancha con elevación de pierna", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es mejorar tu forma física. Con tu nivel de experiencia y el equipamiento básico disponible, he diseñado un plan HIIT que te ayudará a aumentar tu resistencia y fuerza. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 04:48:25.058124+02	2025-08-17 04:48:25.058124+02
32	10	{"plan_source": {"type": "test", "label": "PRUEBA_SERVIDOR", "detail": "Respuesta fija para depuración"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "PLAN DE PRUEBA DEFINITIVO", "subtitulo": "Test para forzar la actualización del servidor", "ejercicios": [{"tipo": "debug", "notas": "Este ejercicio confirma que el código se ha actualizado.", "nombre": "Verificar que este plan aparece", "series": 1, "descanso_seg": 0, "repeticiones": 1}, {"tipo": "debug", "notas": "El siguiente paso es volver a poner el código de OpenAI.", "nombre": "Reiniciar el servidor fue la clave", "series": 1, "descanso_seg": 0, "repeticiones": 1}], "tipo_nombre": "Test", "equipamiento": "ninguno", "perfil_usuario": "Usuario de prueba", "fecha_formateada": "17/8", "tipoEntrenamiento": "debug", "equipamiento_nombre": "Debugging", "duracion_estimada_min": 1}, "mensaje_personalizado": "ATENCIÓN: Si ves este mensaje, el servidor AHORA SÍ está ejecutando el código nuevo. El problema de la repetitividad está resuelto. Podemos volver a activar la IA."}	basico	hiit	2025-08-17 18:12:34.03362+02	2025-08-17 18:12:34.03362+02
6	\N	{"plan_entrenamiento": {"fecha": "2023-10-05", "titulo": "HIIT en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel intermedio", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza los burpees a máxima intensidad.", "nombre": "Burpees", "patron": "explosivo", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Asegúrate de aterrizar suavemente para proteger tus rodillas.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén el core apretado y controla el movimiento.", "nombre": "Flexiones con banda elástica", "patron": "empuje", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Concéntrate en apretar los omóplatos al final del movimiento.", "nombre": "Remo con mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén el cuerpo en línea recta y eleva la cadera lo más alto posible.", "nombre": "Plancha lateral con elevación de cadera", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es mejorar tu forma física. Con un año de experiencia y un nivel de actividad moderado, he diseñado un plan HIIT usando tu equipamiento básico. Este plan te ayudará a aumentar tu resistencia y mejorar tu condición física general. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 12:25:54.346134+02	2025-08-17 12:25:54.346134+02
7	\N	{"plan_entrenamiento": {"fecha": "2023-10-11", "titulo": "HIIT en Casa - Mejora de la Forma Física", "subtitulo": "Personalizado para nivel intermedio", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y asegúrate de realizar el salto con energía.", "nombre": "Burpees", "patron": "explosivo", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Usa el impulso de la cadera para mover la mancuerna.", "nombre": "Swing con mancuerna", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén el core apretado y eleva la pierna de forma controlada.", "nombre": "Plancha con elevación de pierna", "patron": "estabilización", "series": 4, "implemento": "esterilla", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Asegúrate de aterrizar suavemente y con control.", "nombre": "Saltos al banco/step", "patron": "explosivo", "series": 4, "implemento": "banco/step", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}, {"tipo": "intervalo", "notas": "Mantén los codos cerca del cuerpo y aprieta los omóplatos al final del movimiento.", "nombre": "Remo con banda elástica", "patron": "tracción", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 30, "duracion_seg": 45, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es mejorar tu forma física. Con un año de experiencia y un nivel de actividad moderado, he diseñado un plan HIIT usando tu equipamiento básico que te ayudará a alcanzar tus metas mientras mantienes la intensidad y el desafío. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 13:07:24.193555+02	2025-08-17 13:07:24.193555+02
8	\N	{"plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Aterriza suavemente y mantén el control.", "nombre": "Jump Squats", "patron": "sentadilla", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta el pecho.", "nombre": "Flexiones de brazos", "patron": "empuje", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Realiza el movimiento de forma explosiva.", "nombre": "Burpees", "patron": "combinado", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y controla la respiración.", "nombre": "Mountain Climbers", "patron": "tracción", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan.", "nombre": "Plancha con toque de hombro", "patron": "estabilización", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 181.00 cm, Nivel: moderado, IMC: 23.2", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con 20 años de experiencia y tu objetivo de ganar peso, he diseñado un plan de HIIT que maximiza tu tiempo y esfuerzo. Este entrenamiento te ayudará a aumentar tu masa muscular de manera efectiva. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 13:28:45.972694+02	2025-08-17 13:28:45.972694+02
9	\N	{"plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Entrenamiento Funcional en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén el pecho erguido y baja hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}, {"tipo": "reps", "notas": "Asegúrate de mantener el cuerpo en línea recta durante el movimiento.", "nombre": "Flexiones de Brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}, {"tipo": "reps", "notas": "Tira de las mancuernas hacia tu abdomen, manteniendo la espalda recta.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}, {"tipo": "reps", "notas": "Da un paso hacia adelante y baja la rodilla trasera hacia el suelo.", "nombre": "Zancadas Alternas", "patron": "bisagra de cadera", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}, {"tipo": "duracion", "notas": "Mantén el cuerpo en línea recta y contrae el core.", "nombre": "Plancha Lateral", "patron": "estabilización", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "duracion_seg": 30, "repeticiones": null}], "tipo_nombre": "Funcional", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 40}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un plan funcional que te ayudará a aumentar tu masa muscular utilizando equipamiento básico. ¡Vamos a construir fuerza y volumen!"}	basico	funcional	2025-08-17 13:30:21.788066+02	2025-08-17 13:30:21.788066+02
10	\N	{"plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fuerza en Casa - Enfoque Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con Barra", "patron": "sentadilla", "series": 5, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Asegúrate de mantener la barra cerca del cuerpo durante el movimiento.", "nombre": "Peso Muerto con Barra", "patron": "bisagra de cadera", "series": 5, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Controla la bajada y empuja con fuerza hacia arriba.", "nombre": "Press de Banca con Barra", "patron": "empuje", "series": 5, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Utiliza peso adicional si es necesario para aumentar la dificultad.", "nombre": "Dominadas", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén el core activado y los pies firmes en el suelo.", "nombre": "Press Militar con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 60}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es ganar peso y, con tu experiencia de 20 años, he diseñado un plan de fuerza con equipamiento avanzado que te ayudará a maximizar tu masa muscular. ¡Vamos a por ello!"}	avanzado	fuerza	2025-08-17 13:44:18.348831+02	2025-08-17 13:44:18.348831+02
11	\N	{"plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de aterrizar suavemente.", "nombre": "Burpees", "patron": "cuerpo completo", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Salta lo más alto posible y aterriza en posición de sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento para aumentar la intensidad.", "nombre": "Mountain Climbers", "patron": "cuerpo completo", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén la cadera estable mientras tocas el hombro opuesto.", "nombre": "Plancha con toque de hombro", "patron": "estabilización", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia de 20 años y tu objetivo de ganar peso, he diseñado un plan HIIT que te ayudará a aumentar tu masa muscular de manera efectiva. ¡Vamos a darle con todo!"}	basico	hiit	2025-08-17 14:13:32.877278+02	2025-08-17 14:13:32.877278+02
12	\N	{"plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo rápido y asegúrate de aterrizar suavemente.", "nombre": "Burpees", "patron": "cuerpo completo", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Salta lo más alto posible al final de cada sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener el cuerpo recto durante todo el movimiento.", "nombre": "Flexiones", "patron": "empuje", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y contrae el abdomen.", "nombre": "Mountain Climbers", "patron": "cuerpo completo", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Realiza el movimiento de forma controlada para trabajar los gemelos.", "nombre": "Elevaciones de talones", "patron": "empuje", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia de 20 años y tu objetivo de ganar peso, he diseñado un plan HIIT que maximiza el uso de tu peso corporal y equipamiento mínimo. Este entrenamiento te ayudará a aumentar tu masa muscular de manera efectiva. ¡Vamos a por ello!"}	minimo	hiit	2025-08-17 14:17:28.787685+02	2025-08-17 14:17:28.787685+02
13	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Entrenamiento Funcional en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén el kettlebell cerca del pecho durante la sentadilla.", "nombre": "Sentadilla con Kettlebell", "patron": "sentadilla", "series": 4, "implemento": "kettlebell", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}, {"tipo": "reps", "notas": "Asegúrate de bajar completamente y activar la espalda.", "nombre": "Dominadas con agarre amplio", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Controla el movimiento y evita arquear la espalda.", "nombre": "Press de Hombros con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el cuerpo recto y tira hacia tu pecho.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "TRX", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la espalda recta y baja controladamente.", "nombre": "Peso Muerto con Discos Olímpicos", "patron": "bisagra de cadera", "series": 4, "implemento": "discos olímpicos", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}], "tipo_nombre": "Funcional", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 45}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un plan de entrenamiento funcional que maximiza el uso de tu equipamiento avanzado. Este enfoque te ayudará a desarrollar masa muscular de manera efectiva. ¡Vamos a por ello!"}	avanzado	funcional	2025-08-17 14:24:25.154841+02	2025-08-17 14:24:25.154841+02
14	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fuerza en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Asegúrate de mantener la espalda recta y bajar hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con barra", "patron": "sentadilla", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén el core apretado y la barra cerca del cuerpo durante el movimiento.", "nombre": "Peso muerto con barra", "patron": "bisagra de cadera", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Baja la barra controladamente y empuja hacia arriba con fuerza.", "nombre": "Press de banca con barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Agarra la barra con las palmas hacia adelante y sube hasta que la barbilla supere la barra.", "nombre": "Dominadas", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Baja hasta que los codos estén a 90 grados y empuja hacia arriba.", "nombre": "Fondos en paralelas", "patron": "empuje", "series": 4, "implemento": "paralelas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 60}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es ganar peso y, con tu experiencia de 20 años, he diseñado un plan de fuerza que aprovechará tu equipamiento avanzado para maximizar tus ganancias musculares. ¡Vamos a por ello!"}	avanzado	fuerza	2025-08-17 14:38:03.452122+02	2025-08-17 14:38:03.452122+02
102	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT con recursos mínimos", "subtitulo": "Entrenamiento eficiente en casa", "ejercicios": [{"tipo": "tiempo", "notas": "Realiza los saltos con control y mantén una postura erguida para maximizar el cardio y evitar lesiones.", "nombre": "Saltos en Tijera (Jumping Jacks)", "patron": "cardio", "series": 4, "tiempo_seg": 40, "descanso_seg": 45}, {"tipo": "reps", "notas": "Coloca las manos en el borde de la silla, mantén los codos cerca del torso y baja controladamente.", "nombre": "Fondos en Silla", "series": 3, "implemento": "silla", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén la cadera estable durante el toque, activa el core para evitar rotaciones excesivas.", "nombre": "Plancha con Toque de Hombro", "patron": "core", "series": 3, "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Aterrice suavemente para proteger las rodillas y explota el salto para aumentar intensidad.", "nombre": "Sentadillas con Salto", "patron": "sentadilla", "series": 4, "descanso_seg": 45, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Mantén la espalda recta y lleva las rodillas lo más cerca posible del pecho en cada movimiento.", "nombre": "Mountain Climbers", "patron": "cardio", "series": 4, "tiempo_seg": 30, "descanso_seg": 45}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "27/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "Prepárate para un entrenamiento HIIT dinámico y desafiante usando solo tu peso corporal y elementos cotidianos. Este plan potenciará tu resistencia y fuerza, manteniendo la variedad para mantenerte motivado en cada sesión."}	minimo	hiit	2025-08-27 20:26:09.992798+02	2025-08-27 20:26:09.992798+02
15	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y asegúrate de aterrizar suavemente.", "nombre": "Burpees", "patron": "cuerpo completo", "series": 4, "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Salta lo más alto posible y aterriza en una posición de sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "series": 4, "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento para aumentar la intensidad.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu objetivo de ganar peso y tu experiencia de 20 años entrenando, he diseñado un plan HIIT que te ayudará a aumentar tu masa muscular de manera efectiva. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 14:49:35.490428+02	2025-08-17 14:49:35.490428+02
16	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fuerza en Casa - Enfoque Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Controla el movimiento y evita que las mancuernas se toquen en la parte superior.", "nombre": "Press de pecho en banco con mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén el codo cerca del cuerpo y aprieta los omóplatos al final del movimiento.", "nombre": "Remo con mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y siente el estiramiento en los isquiotibiales.", "nombre": "Peso muerto con mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Realiza el movimiento de forma controlada y mantén la contracción en la parte superior.", "nombre": "Elevaciones de talones", "patron": "aislado", "series": 4, "implemento": "peso corporal", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 10}], "tipo_nombre": "Fuerza", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 45}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un plan de fuerza que te ayudará a aumentar tu masa muscular utilizando equipamiento básico. ¡Vamos a por ello!"}	basico	fuerza	2025-08-17 16:41:55.478166+02	2025-08-17 16:41:55.478166+02
17	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fuerza en Casa - Enfoque en Masa Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Asegúrate de que las rodillas no sobrepasen los dedos de los pies.", "nombre": "Sentadilla con peso corporal", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Baja hasta que los codos estén a 90 grados.", "nombre": "Fondos en silla", "patron": "empuje", "series": 4, "implemento": "silla", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Aprieta los glúteos en la parte superior del movimiento.", "nombre": "Puente de glúteos", "patron": "bisagra de cadera", "series": 4, "implemento": "peso corporal", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 10}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 40}, "mensaje_personalizado": "¡Hola! Con tu objetivo de ganar peso y tu amplia experiencia en entrenamiento, he diseñado un plan de fuerza que utiliza equipamiento mínimo. Este enfoque te ayudará a desarrollar masa muscular de manera efectiva. ¡Vamos a por ello!"}	minimo	fuerza	2025-08-17 16:57:13.634195+02	2025-08-17 16:57:13.634195+02
18	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de hacer una buena extensión al saltar.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la espalda recta.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener el cuerpo en línea recta.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y el abdomen contraído.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan de lado a lado.", "nombre": "Plancha con toque de hombro", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un plan de HIIT que te ayudará a aumentar tu masa muscular y mejorar tu resistencia. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 17:08:19.220351+02	2025-08-17 17:08:19.220351+02
33	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "intervalo", "notas": "Asegúrate de hacer el jump con fuerza y controlar la caída. Mantén las mancuernas firmes principalmente durante el press.", "nombre": "Burpees con Mancuernas", "patron": "cuerpo completo", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Da un paso amplio hacia adelante, manteniendo la espalda recta y el núcleo apretado. Alterna las piernas con cada repetición.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "piernas", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Mantén los codos por encima de los hombros y los hombros relajados mientras tiras de la banda hacia ti.", "nombre": "Remo Alto con Banda Elástica", "patron": "espalda", "series": 4, "implemento": "banda elástica", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Mantén la posición de plancha mientras alternas el golpeo de hombros. Activa el abdomen para evitar que las caderas se hundan.", "nombre": "Plancha Dinámica con Golpes", "patron": "core", "series": 4, "implemento": "ninguno", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Coloca la mancuerna sobre la pelvis. Aprieta los glúteos al elevar la cadera, formando una línea recta desde los hombros hasta las rodillas.", "nombre": "Puente de Glúteos con Mancuerna", "patron": "glúteos", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy es un gran día para potenciar tu masa muscular con un HIIT desafiante. Este entrenamiento con equipamiento básico te llevará al límite y será clave para tu objetivo de ganar peso. ¡A darlo todo!"}	basico	hiit	2025-08-17 18:17:48.381137+02	2025-08-17 18:17:48.381137+02
19	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento en casa con equipamiento básico", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo rápido y controla la caída.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la postura.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Baja el pecho hasta casi tocar el suelo.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el abdomen contraído y el ritmo constante.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Siente la contracción en los gemelos.", "nombre": "Elevaciones de talones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu objetivo de ganar peso y tu experiencia de 20 años, he diseñado un plan HIIT que te ayudará a aumentar tu masa muscular de manera efectiva. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 17:17:54.150902+02	2025-08-17 17:17:54.150902+02
20	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fuerza en Casa - Enfoque en Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "reps", "notas": "Asegúrate de mantener los pies firmes en el suelo y el control en el movimiento.", "nombre": "Press de Banca con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que tus muslos estén paralelos al suelo.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén el torso inclinado y tira de las mancuernas hacia tu abdomen.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén las mancuernas cerca de tus piernas durante el movimiento.", "nombre": "Peso Muerto con Mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Realiza el movimiento de forma controlada, sintiendo el trabajo en los gemelos.", "nombre": "Elevación de Talones", "patron": "aislado", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}], "tipo_nombre": "Fuerza", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 45}, "mensaje_personalizado": "¡Hola! Con tu objetivo de ganar peso y tu amplia experiencia en entrenamiento, he diseñado un plan de fuerza que te ayudará a aumentar tu masa muscular utilizando equipamiento básico. ¡Vamos a construir esos músculos!"}	basico	fuerza	2025-08-17 17:19:15.475385+02	2025-08-17 17:19:15.475385+02
21	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento en casa con equipamiento básico", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y asegúrate de realizar la extensión completa al saltar.", "nombre": "Burpees", "patron": "cuerpo completo", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la espalda recta.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo en línea recta y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento y mantén el abdomen contraído.", "nombre": "Mountain Climbers", "patron": "cuerpo completo", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Realiza el movimiento de forma controlada y siente el trabajo en las pantorrillas.", "nombre": "Elevaciones de talones", "patron": "empuje", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu objetivo de ganar peso y tu experiencia de 20 años entrenando, he diseñado un plan HIIT que te ayudará a aumentar tu masa muscular de manera efectiva. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 17:38:45.722114+02	2025-08-17 17:38:45.722114+02
22	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento en Casa - Equipamiento Básico", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de realizar una buena técnica.", "nombre": "Burpees", "patron": "cuerpo completo", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y usa los brazos para impulsarte.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento y mantén el abdomen contraído.", "nombre": "Mountain Climbers", "patron": "cuerpo completo", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan mientras tocas los hombros.", "nombre": "Plancha con toque de hombro", "patron": "estabilización", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un plan HIIT que maximiza tu tiempo y esfuerzo. Este entrenamiento te ayudará a aumentar tu masa muscular mientras mantienes un enfoque en la intensidad. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 17:40:09.550608+02	2025-08-17 17:40:09.550608+02
23	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Aumenta tu Masa Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Asegúrate de saltar lo más alto posible.", "nombre": "Burpees", "patron": "todo el cuerpo", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén una buena postura al aterrizar.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo en línea recta.", "nombre": "Flexiones", "patron": "empuje", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el ritmo para maximizar el esfuerzo.", "nombre": "Mountain Climbers", "patron": "todo el cuerpo", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Siente la contracción en los gemelos.", "nombre": "Elevación de talones", "patron": "empuje", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un plan de HIIT que te ayudará a aumentar tu masa muscular y mejorar tu resistencia. ¡Vamos a darle con todo!"}	basico	hiit	2025-08-17 17:44:06.93993+02	2025-08-17 17:44:06.93993+02
24	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "tiempo", "notas": "Asegúrate de aterrizar suave y controla el movimiento.", "nombre": "Saltos de caja con silla", "patron": "pliométrico", "implemento": "silla", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Súbete hacia arriba con fuerza desde la posición de sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Asegúrate de mantener la espalda recta mientras tiras de la banda.", "nombre": "Remo con banda elástica", "patron": "tracción", "implemento": "banda elástica", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Mantén el cuerpo en línea recta y contrae el abdomen.", "nombre": "Plancha con toalla", "patron": "estabilización", "implemento": "toalla", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Vemos que tu objetivo es ganar peso y tu experiencia en el entrenamiento es amplia. He diseñado un plan de HIIT con equipamiento básico que te ayudará a incrementar tu masa muscular de manera efectiva. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 17:48:38.342923+02	2025-08-17 17:48:38.342923+02
25	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "tiempo", "notas": "Mantén un ritmo constante y asegúrate de hacer una buena técnica.", "nombre": "Burpees", "patron": "circuito completo", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "tiempo", "notas": "Asegúrate de mantener el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "tiempo", "notas": "Impúlsate con fuerza al saltar y aterriza suavemente.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}, {"tipo": "tiempo", "notas": "Mantén el abdomen contraído y ejecuta el movimiento rápidamente.", "nombre": "Mountain Climbers", "patron": "circuito completo", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30, "repeticiones": null}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es ganar peso y, como tienes un nivel avanzado, he creado un plan de HIIT con equipamiento básico que te ayudará a desarrollar masa muscular y aumentar tu fuerza. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 17:51:08.125892+02	2025-08-17 17:51:08.125892+02
26	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Entrenamiento de alta intensidad", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo rápido y asegúrate de estirarte al final.", "nombre": "Burpees", "patron": "movimiento total", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Salta lo más alto posible y aterriza suavemente.", "nombre": "Sentadillas Jump", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el core activo durante todo el movimiento.", "nombre": "Flexiones", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento y mantén una buena postura.", "nombre": "Mountain Climbers", "patron": "movimiento total", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un intenso plan de HIIT que aprovechará tu equipamiento básico para maximizar tu fuerza y masa muscular. ¡Vamos a por esas metas!"}	basico	hiit	2025-08-17 17:55:21.966363+02	2025-08-17 17:55:21.966363+02
46	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini-2024-07-18"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento de Fuerza en Casa", "subtitulo": "Rutina con Equipamiento Mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos en el pecho. Pies a la anchura de los hombros. Movimiento: Desciende flexionando las rodillas, manteniendo el torso erguido, hasta que los muslos estén paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Mancuerna", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba con una mancuerna en cada mano, brazos extendidos hacia arriba. Movimiento: Baja las mancuernas hacia los lados, flexionando los codos, y luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda baja.", "nombre": "Press de Pecho en Suelo con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Inclínate hacia adelante desde las caderas, sosteniendo una mancuerna en cada mano, brazos extendidos. Movimiento: Tira de las mancuernas hacia el abdomen, manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Girar el torso durante el movimiento.", "nombre": "Remo Inclinado con Mancuerna", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, pies apoyados en el suelo a la altura de las rodillas, brazos a los lados. Movimiento: Levanta las caderas apretando los glúteos hasta formar una línea recta de las rodillas a los hombros. Respiración: Inhala al bajar, exhala al subir. Evita: No empujar con la espalda baja.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola campeón! Listo para ganar músculo desde casa sin necesidad de mucho equipamiento. He diseñado un plan de fuerza que te desafiará y te hará sentir increíble. ¡A por ello!"}	minimo	fuerza	2025-08-18 17:18:57.209488+02	2025-08-18 17:18:57.209488+02
27	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Entrenamiento de alta intensidad para ganar peso", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza el movimiento de forma explosiva y controla la caída.", "nombre": "Burpees", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Usa una silla estable y asegúrate de aterrizar suavemente.", "nombre": "Saltos en Silla", "patron": "salto", "series": 4, "implemento": "silla", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de Brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y asegúrate de activar el core.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tus 20 años de experiencia y tu objetivo de ganar peso, he diseñado un plan HIIT que aprovechará tu equipamiento básico para maximizar la intensidad y ayudarte a aumentar masa muscular de manera efectiva. ¡A por ello!"}	basico	hiit	2025-08-17 17:56:38.551312+02	2025-08-17 17:56:38.551312+02
28	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento de alta intensidad en casa", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza el movimiento completo, asegurándote de saltar al final.", "nombre": "Burpees", "patron": "cuerpo entero", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén el control en cada repetición.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento, llevando las rodillas al pecho.", "nombre": "Mountain Climbers", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu experiencia y objetivo de ganar peso, he diseñado un emocionante plan de HIIT que maximiza tus ganancias musculares y mejora tu resistencia. ¡Vamos a entrenar fuerte!"}	basico	hiit	2025-08-17 18:00:48.383568+02	2025-08-17 18:00:48.383568+02
29	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa - Ganancia Muscular", "subtitulo": "Personalizado para nivel avanzado", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y busca la explosividad en cada salto.", "nombre": "Saltos de tijera", "patron": "cardio", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Salta explosivamente desde la posición de sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el core apretado mientras alternas los brazos.", "nombre": "Planchas alternando brazos", "patron": "estabilización", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento y mantén el ritmo alto.", "nombre": "Mountain Climbers", "patron": "cardio", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Con tu objetivo de ganar peso y tu amplia experiencia en entrenamiento, he diseñado un plan HIIT que te ayudará a aumentar tu masa muscular de manera efectiva. ¡Prepárate para darlo todo!"}	basico	hiit	2025-08-17 18:03:34.299861+02	2025-08-17 18:03:34.299861+02
30	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento en Casa con Equipamiento Básico", "ejercicios": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y aterriza suavemente.", "nombre": "Saltos de Tijera", "patron": "cardio", "implemento": "peso corporal", "tiempo_trabajo_seg": 30, "tiempo_descanso_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener una buena forma durante el ejercicio.", "nombre": "Flexiones de Brazo", "patron": "empuje", "implemento": "peso corporal", "tiempo_trabajo_seg": 30, "tiempo_descanso_seg": 30}, {"tipo": "intervalo", "notas": "Utiliza los brazos para impulsarte hacia arriba.", "nombre": "Sentadillas con Salto", "patron": "sentadilla", "implemento": "peso corporal", "tiempo_trabajo_seg": 30, "tiempo_descanso_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el abdomen contraído durante el ejercicio.", "nombre": "Mountain Climbers", "patron": "cardio", "implemento": "peso corporal", "tiempo_trabajo_seg": 30, "tiempo_descanso_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo en línea recta desde la cabeza hasta los pies.", "nombre": "Plancha", "patron": "estabilización", "implemento": "peso corporal", "tiempo_trabajo_seg": 30, "tiempo_descanso_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Veo que tu objetivo es ganar peso y, dado tu nivel de experiencia, he preparado un plan de HIIT que te ayudará a aumentar tu masa muscular a través de ejercicios intensos. ¡Aprovecha al máximo cada sesión!"}	basico	hiit	2025-08-17 18:07:33.789212+02	2025-08-17 18:07:33.789212+02
31	10	{"plan_source": {"type": "test", "label": "PRUEBA_SERVIDOR", "detail": "Respuesta fija para depuración"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "PLAN DE PRUEBA DEFINITIVO", "subtitulo": "Test para forzar la actualización del servidor", "ejercicios": [{"tipo": "debug", "notas": "Este ejercicio confirma que el código se ha actualizado.", "nombre": "Verificar que este plan aparece", "series": 1, "descanso_seg": 0, "repeticiones": 1}, {"tipo": "debug", "notas": "El siguiente paso es volver a poner el código de OpenAI.", "nombre": "Reiniciar el servidor fue la clave", "series": 1, "descanso_seg": 0, "repeticiones": 1}], "tipo_nombre": "Test", "equipamiento": "ninguno", "perfil_usuario": "Usuario de prueba", "fecha_formateada": "17/8", "tipoEntrenamiento": "debug", "equipamiento_nombre": "Debugging", "duracion_estimada_min": 1}, "mensaje_personalizado": "ATENCIÓN: Si ves este mensaje, el servidor AHORA SÍ está ejecutando el código nuevo. El problema de la repetitividad está resuelto. Podemos volver a activar la IA."}	basico	hiit	2025-08-17 18:11:12.166307+02	2025-08-17 18:11:12.166307+02
34	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganar Peso", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Sostén una mancuerna en cada mano, brazos a los lados. Movimiento: Salta abriendo y cerrando las piernas mientras elevas los brazos por encima de la cabeza. Aterriza suavemente con las rodillas ligeramente flexionadas. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con las rodillas rígidas o golpear el suelo.", "nombre": "Saltos de Tijera con Mancuernas", "patron": "cardio", "series": 5, "implemento": "mancuernas", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Coloca la banda elástica alrededor de tu espalda y sostenla con ambas manos. Alinea tu cuerpo en posición de flexión. Movimiento: Baja el torso manteniendo los codos cerca del cuerpo, luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o abrir demasiado los codos.", "nombre": "Flexiones con Bandas Elásticas", "patron": "empuje", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Realiza una sentadilla y al levantarte eleva los talones del suelo. Mantén el torso erguido. Respiración: Inhala al descender, exhala al subir. Evita: Permitir que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Peso Corporal y Elevación de Talones", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: Imagina que sostienes cuerdas de batalla, pies separados a la anchura de los hombros. Movimiento: Alterna arriba y abajo los brazos como si estuvieras moviendo cuerdas. Mantén la parte central del cuerpo firme. Respiración: Controla la respiración y exhala al bajar los brazos. Evita: Girar la cadera o perder el equilibrio.", "nombre": "Battle Rope Alternado (simulado)", "patron": "cardio", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy es el día perfecto para elevar tus niveles de energía y trabajar en tu objetivo de ganar peso con un HIIT desafiante. Vamos a usar tu equipamiento básico para maximizar cada repetición. ¡A por ello!"}	basico	hiit	2025-08-17 19:49:25.76706+02	2025-08-17 19:49:25.76706+02
35	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fuerza con Equipamiento Mínimo", "subtitulo": "Entrenamiento centrado en hipertrofia", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: En posición de flexión con las manos ligeramente más anchas que los hombros. Movimiento: Baja el torso manteniendo una línea recta desde la cabeza hasta los talones. Al subir, levanta una pierna del suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Caderas caídas o elevadas, mantén el cuerpo recto.", "nombre": "Flexiones con Elevación de Pierna", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda, pie derecho en el suelo, pierna izquierda extendida hacia arriba. Movimiento: Eleva la cadera contra el suelo utilizando el talón derecho para empujar. Mantén la pierna izquierda extendida sin tocar el suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo de la espalda baja, mantén la alineación.", "nombre": "Puente de Glúteos con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Bajo una mesa resistente, agárrate del borde con las manos y mantén el cuerpo recto. Movimiento: Tira de tu cuerpo hacia arriba hasta que el pecho toque la mesa, manteniendo las piernas estiradas. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o arquear la espalda.", "nombre": "Remo Invertido en Mesa", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: Apóyate contra una pared con los pies a la altura de las caderas, baja en una posición de sentadilla. Movimiento: Mantén la posición de sentadilla contra la pared. Respiración: Respira normalmente. Evita: Desplazar las rodillas hacia adelante de los dedos de los pies, mantén la espalda recta.", "nombre": "Sentadilla Isométrica en Pared", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a enfocarnos en ganar masa muscular con un entrenamiento de fuerza que puedes realizar con equipamiento mínimo. ¡Prepárate para desafiarte y crecer!"}	minimo	fuerza	2025-08-17 19:55:58.780372+02	2025-08-17 19:55:58.780372+02
36	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Ganar Masa Muscular", "subtitulo": "Rutina Intensa con Equipamiento Básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: De pie, sostén una mancuerna en cada mano. Movimiento: Baja en cuclillas, coloca las mancuernas en el suelo, salta hacia atrás a una posición de plancha, realiza una flexión de brazos, salta hacia adelante y finaliza con un salto vertical. Respiración: Exhala al saltar y al realizar la flexión. Evita: Arqueo en la espalda baja durante la plancha.", "nombre": "Burpee con Mancuernas", "patron": "funcional", "implemento": "mancuernas", "descanso_seg": 15, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: Con una mancuerna en cada mano, inclínate hacia adelante con la espalda recta. Movimiento: Tira de una mancuerna hacia tu cadera mientras mantienes la otra extendida hacia abajo, alternando los lados. Respiración: Inhala al bajar el peso, exhala al subir. Evita: Rotar el torso excesivamente en el movimiento.", "nombre": "Remo con Mancuernas Alterno", "patron": "tracción", "implemento": "mancuernas", "descanso_seg": 15, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus piernas, justo arriba de las rodillas. Movimiento: Da un paso lateral, baja en una sentadilla y regresa al centro, alternando lados. Respiración: Inhala al bajar, exhala al volver al centro. Evita: Que las rodillas se desvíen hacia adentro.", "nombre": "Sentadilla Lateral con Banda Elástica", "patron": "bisagra_cadera", "implemento": "bandas_elasticas", "descanso_seg": 15, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con las manos alineadas bajo los hombros. Movimiento: Rota el torso hacia un lado, levantando un brazo hacia el techo, vuelve a la posición inicial y repite al otro lado. Respiración: Inhala al rotar, exhala al volver a la plancha. Evita: Dejar caer las caderas.", "nombre": "Plancha con Rotación", "patron": "funcional", "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, pies a la altura de los hombros. Movimiento: Corre en el lugar, elevando las rodillas hacia el pecho lo más alto posible. Respiración: Exhala al elevar las rodillas, inhala al bajar. Evita: Inclinarte hacia atrás o hacia adelante en exceso.", "nombre": "Sprints en el Lugar con Elevación de Rodillas", "patron": "funcional", "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 45}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a elevar tu energía y construir músculo con un entrenamiento HIIT que incorpora tu equipamiento básico. Prepárate para sudar y sentir la quema. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 20:05:46.200928+02	2025-08-17 20:05:46.200928+02
37	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT para Hipertrofia Muscular", "subtitulo": "Entrenamiento con Equipamiento Básico", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a la altura de los hombros. Pies a la anchura de los hombros. Movimiento: Baja en sentadilla mientras presionas las mancuernas hacia arriba al levantarte. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepongan los dedos de los pies al bajar.", "nombre": "Sentadilla con Mancuerna y Press", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, sosteniendo los extremos de la cuerda. Movimiento: Salta suavemente alternando los pies como si estuvieras corriendo. Mantén el core contraído. Respiración: Respira de forma natural, evitando contener la respiración. Evita: Saltar demasiado alto; mantén los pies cerca del suelo.", "nombre": "Saltos de Cuerda Alternos", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: En posición de flexión, con una mancuerna en cada mano. Cuerpo en línea recta. Movimiento: Baja el torso mientras mantienes el codo pegado al cuerpo. Al subir, eleva una mancuerna hacia el pecho. Alterna brazos. Respiración: Inhala al bajar, exhala al subir. Evita: Que tus caderas caigan o se eleven.", "nombre": "Flexiones de Brazo con Elevación de Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 8}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca una banda elástica alrededor de las piernas, justo por encima de las rodillas. Posición de pie con pies juntos. Movimiento: Da un paso lateral hacia la derecha, luego junta los pies. Repite hacia la izquierda. Mantén el core activo. Respiración: Respira de forma continua. Evita: Inclinarte hacia adelante o que la banda se deslice.", "nombre": "Desplazamientos Laterales con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te traigo un HIIT explosivo diseñado para ayudarte a ganar masa muscular. Con tu equipamiento básico, ¡haremos de este entrenamiento una experiencia intensa y efectiva! ¡Disfruta cada repetición!"}	basico	hiit	2025-08-17 20:28:00.591728+02	2025-08-17 20:28:00.591728+02
38	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2023-10-04", "titulo": "HIIT para Hipertrofia", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, sostén las mancuernas a la altura de los hombros con palmas hacia adelante. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos. Respiración: Exhala al empujar, inhala al bajar. Evita: Arqueo lumbar excesivo o elevar los hombros hacia las orejas.", "nombre": "Press de Hombros con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Inclínate ligeramente hacia adelante con la espalda recta y las mancuernas en manos. Movimiento: Tira de las mancuernas hacia tu abdomen, manteniendo los codos pegados al cuerpo. Respiración: Exhala al subir, inhala al bajar. Evita: Redondear la espalda o mover el torso durante el ejercicio.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: De pie, con las mancuernas a los lados. Movimiento: Da un paso hacia adelante y baja la rodilla trasera hacia el suelo, manteniendo el torso recto. Regresa. Respiración: Inhala al bajar, exhala al levantarte. Evita: Que la rodilla delantera se desplace hacia adelante más allá del pie.", "nombre": "Zancada Alterna con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha con los codos debajo de los hombros. Movimiento: Eleva una pierna manteniendo la posición del torso estática. Alterna piernas. Respiración: Respira de manera controlada. Evita: Caderas demasiado altas o bajas, mantén una línea recta desde cabeza a talones.", "nombre": "Plancha Alternando Elevación de Pierna", "patron": "isometrico", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: De pie, sostén las mancuernas a los lados. Movimiento: Eleva los talones del suelo, manteniendo el equilibrio en la parte frontal de los pies. Respiración: Exhala al subir, inhala al bajar. Evita: Dejar caer el peso hacia atrás o hacia adelante al elevarte.", "nombre": "Elevaciones de Talones con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy es un gran día para ganar músculo con este HIIT adaptado a tu equipamiento básico. Prepárate para activar cada fibra muscular y disfrutar del proceso. ¡Vamos a por ello!"}	basico	hiit	2025-08-17 20:45:49.874705+02	2025-08-17 20:45:49.874705+02
39	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Avanzado para Hipertrofia", "subtitulo": "Entrenamiento de alta intensidad con equipamiento avanzado", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la altura de los hombros, sostén el kettlebell con ambas manos entre tus piernas. Movimiento: Flexiona ligeramente las rodillas y empuja las caderas hacia atrás, luego, explosivamente, mueve las caderas hacia adelante y levanta el kettlebell hasta la altura del pecho. Respiración: Inhala en la bajada, exhala al levantar. Evita: Hacer el movimiento solo con los brazos, mantén la potencia en las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 5, "implemento": "kettlebells", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate frente a una caja o plataforma estable. Movimiento: Flexiona las rodillas y salta hacia arriba, aterrizando suavemente sobre la caja, usando las piernas para amortiguar el impacto. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer duramente sobre la caja o aterrizar con las rodillas bloqueadas.", "nombre": "Box Jump", "patron": "explosión", "series": 4, "implemento": "caja", "descanso_seg": 40, "duracion_seg": 20}, {"tipo": "tiempo", "notas": "Posición inicial: Agárrate de las cintas del TRX con los brazos extendidos y el cuerpo recto. Movimiento: Tira de las cintas hacia ti, flexionando los codos y llevando el pecho hacia las manos. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la cadera se hunda o que el cuerpo se curve.", "nombre": "Remo Invertido en TRX", "patron": "tracción", "series": 5, "implemento": "trx", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Asume una posición de flexión, pero eleva las caderas formando una 'V' invertida. Movimiento: Baja la cabeza hacia el suelo, utilizando los hombros para empujar el cuerpo hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la parte baja de la espalda se hunda.", "nombre": "Pike Push-Up", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 35, "duracion_seg": 25}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a encender esos músculos con una intensa rutina de HIIT, aprovechando tu equipamiento avanzado. Este entrenamiento no solo te ayudará a ganar peso, sino que también estimulará tu fuerza y resistencia. ¡Prepárate para darlo todo!"}	avanzado	hiit	2025-08-17 20:50:11.503778+02	2025-08-17 20:50:11.503778+02
40	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina Funcional para Ganar Peso", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos a la altura del pecho. Pies a la anchura de los hombros. Movimiento: Flexiona las caderas y las rodillas como si te fueras a sentar, asegurándote de que las rodillas no sobrepasen los dedos de los pies. Mantén el torso erguido. Respiración: Inhala al bajar, exhala al subir. Evita: Colapsar el pecho hacia adelante o que los talones se levanten.", "nombre": "Sentadilla con Mancuerna", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Rodillas en el suelo, manos apoyadas al ancho de hombros. Cuerpo en línea recta desde la cabeza hasta las rodillas. Movimiento: Baja el pecho hacia el suelo manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o elevar demasiado las caderas.", "nombre": "Flexiones de Brazo con Apoyo de Rodillas", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba con las rodillas dobladas y los pies apoyados en el suelo. Sostén una mancuerna en la cadera. Movimiento: Eleva las caderas hacia el techo apretando los glúteos al llegar arriba, mantén una línea recta desde las rodillas hasta los hombros. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueamiento de la espalda baja.", "nombre": "Puente de Glúteos con Mancuerna", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: A cuatro patas con una mancuerna en una mano. Movimiento: Tira de la mancuerna hacia tu cadera mientras mantienes la espalda recta. Cambia de lado después de completar las repeticiones. Respiración: Inhala al bajar, exhala al subir. Evita: Girar el torso o dejar caer el pecho.", "nombre": "Remo con Mancuerna en Posición de Cuadrupedia", "patron": "tracción", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha con manos debajo de los hombros. Movimiento: Levanta una mano hacia adelante, manteniendo la estabilidad del cuerpo, alterna brazos. Respiración: Respira normalmente. Evita: Mover las caderas hacia arriba o hacia abajo.", "nombre": "Plancha con Elevación de Brazo Alterno", "patron": "estabilidad", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Funcional", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy he preparado una increíble rutina funcional que te ayudará a ganar peso y a desarrollar tu fuerza. Utilizaremos tu equipamiento básico para maximizar los resultados. ¡Vamos a entrenar!"}	basico	funcional	2025-08-17 21:00:23.085256+02	2025-08-17 21:00:23.085256+02
41	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina de Fuerza Avanzada", "subtitulo": "Entrenamiento para Ganar Masa Muscular", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Sostén la barra con un agarre ligeramente más ancho que los hombros. Mantén la espalda recta y las piernas ligeramente flexionadas. Movimiento: Baja la barra siguiendo la línea de tus piernas, manteniendo la cadera atrás. Respira: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o caer en la flexión de las rodillas.", "nombre": "Peso Muerto Rumano con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Acostado en el banco, sujeta una mancuerna en cada mano a la altura del pecho. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén extendidos. Respira: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda y dejar caer las mancuernas hacia los hombros.", "nombre": "Press de Banca con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Agárrate a la barra con un agarre pronado, asegurando el peso adicional en un cinturón. Movimiento: Sube hasta que la barbilla sobrepase la barra. Respira: Inhala al bajar, exhala al subir. Evita: Balancear las piernas y dejar caer los hombros.", "nombre": "Dominadas con Lastre", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 6}, {"tipo": "reps", "notas": "Posición inicial: Sentado en la máquina, coloca los pies en la plataforma a la altura de los hombros. Movimiento: Baja la plataforma flexionando las rodillas, manteniendo la espalda contra el respaldo. Respira: Inhala al bajar, exhala al subir. Evita: Levantar los talones o dejar que las rodillas se desvíen hacia adentro.", "nombre": "Prensa de Piernas", "patron": "bisagra_cadera", "series": 4, "implemento": "maquina", "descanso_seg": 90, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Coloca una barra sobre tu espalda, pies a la altura de los hombros. Movimiento: Eleva los talones con control y baja lentamente. Respira: Inhala al bajar, exhala al subir. Evita: Dejar caer el peso o no realizar el movimiento de manera controlada.", "nombre": "Elevación de Talones con Barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 15}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "17/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 50}, "mensaje_personalizado": "¡Hola! Hoy es el día perfecto para ganar fuerza y masa muscular. He diseñado un entrenamiento intenso con tu equipamiento avanzado que te ayudará a alcanzar tus metas. ¡Vamos a darle con todo!"}	avanzado	fuerza	2025-08-17 23:54:29.166343+02	2025-08-17 23:54:29.166343+02
42	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT de Fuerza y Resistencia", "subtitulo": "Entrenamiento con mínimas herramientas", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies a la altura de los hombros. Movimiento: Flexiona las rodillas para caer en una posición de cuclillas, coloca las manos en el suelo, salta hacia atrás hasta una posición de plancha, realiza una flexión de brazos y salta de regreso a la cuclilla, finalizando con un salto vertical. Respiración: Exhala al saltar y al hacer la flexión. Evita: No arquees la espalda en la posición de plancha.", "nombre": "Burpees", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 20, "duracion_seg": 40}, {"tipo": "tiempo", "notas": "Posición inicial: En cuclillas, mantén las rodillas flexionadas a 90 grados. Movimiento: Eleva los talones manteniendo la posición de cuclillas. Mantén la espalda recta. Respiración: Respira de forma controlada durante el ejercicio. Evita: No dejar que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla Isométrica con Elevación de Talones", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta con las manos directamente debajo de los hombros. Movimiento: Lleva una rodilla hacia el pecho, vuelve a la posición inicial y alterna rápidamente con la otra rodilla. Respiración: Exhala al acercar la rodilla, inhala al volver a la posición de plancha. Evita: No dejes caer las caderas ni arquees la espalda.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, brazos extendidos, manos a la altura de los hombros. Movimiento: Realiza una flexión normal y al subir, gira el torso hacia un lado levantando un brazo hacia el techo. Alterna lados. Respiración: Inhala al bajar, exhala al subir y girar. Evita: No arquees la espalda ni bajes demasiado las caderas.", "nombre": "Flexiones de Brazo con Rotación", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te traigo un HIIT potente que combinará intensidad y el uso de tu equipo básico para ayudarte a ganar músculo. ¡Prepárate para darlo todo!"}	minimo	hiit	2025-08-18 00:22:27.320557+02	2025-08-18 00:22:27.320557+02
43	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos en el pecho. Pies a la anchura de los hombros. Movimiento: Desciende en sentadilla y al subir, eleva la mancuerna por encima de la cabeza. Respiración: Inhala al bajar, exhala al elevar. Evita: Que tus rodillas sobrepasen la punta de los pies.", "nombre": "Sentadilla con Mancuerna y Elevación", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Ancla la banda elástica a un punto bajo y sostén los extremos. Acuéstate boca arriba y tira de la banda hacia tu pecho mientras mantienes el cuerpo en línea recta. Movimiento: Tira de la banda hacia ti manteniendo los codos pegados al cuerpo. Respiración: Inhala al bajar, exhala al tirar. Evita: Arqueo de espalda y movimientos bruscos.", "nombre": "Remo Invertido con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados. Pies a la altura de los hombros. Movimiento: Da un paso adelante flexionando ambas rodillas y vuelve a la posición inicial. Alterna las piernas. Respiración: Inhala al descender, exhala al volver. Evita: Que la rodilla que avanza sobrepase la punta del pie.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "repeticiones": 10}, {"tipo": "segundos", "notas": "Posición inicial: Colócate en posición de plancha con los codos alineados con los hombros. Movimiento: Rota suavemente el torso hacia un lado mientras levantas el brazo contrario. Alterna lados. Respiración: Mantén la respiración controlada. Evita: Que las caderas se hundan o eleven demasiado.", "nombre": "Plancha Estática con Rotación", "patron": "estabilización", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a llevar tu entrenamiento HIIT al siguiente nivel para ganar músculo, utilizando tu equipo básico. ¡Prepárate para sudar y construir esa masa muscular!"}	basico	hiit	2025-08-18 16:29:39.807176+02	2025-08-18 16:29:39.807176+02
44	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "timed", "notas": "Posición inicial: Pies a la altura de los hombros, con la mancuerna entre las piernas. Movimiento: Flexiona ligeramente las rodillas, inclina la cadera hacia atrás y coloca la mancuerna detrás de ti. Luego, con un movimiento explosivo, lleva la mancuerna hacia adelante y arriba, utilizando la cadera y no la espalda. Respiración: Inhala al bajar, exhala al subir. Evita: Utilizar la espalda para el movimiento y que las rodillas sobrepasen los dedos de los pies.", "nombre": "Swing con Mancuerna", "patron": "bisagra_cadera", "series": 5, "implemento": "mancuernas", "descanso_seg": 20, "duracion_seg": 40}, {"tipo": "timed", "notas": "Posición inicial: Apóyate en las manos y rodillas, con las manos a la altura de los hombros. Movimiento: Baja el pecho hacia el suelo manteniendo los codos cerca del cuerpo y luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o archivar la espalda.", "nombre": "Flexiones de Brazo con Apoyo de Rodillas", "patron": "empuje", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "timed", "notas": "Posición inicial: Pisa la banda elástica con ambos pies y toma los extremos con las manos. Movimiento: Tira de la banda hacia ti, manteniendo los codos altos y cerca del cuerpo. Respiración: Inhala al tensar la banda, exhala al soltar. Evita: Encoger los hombros o arquear la espalda.", "nombre": "Remo con Banda Elástica", "patron": "tracción", "series": 5, "implemento": "bandas_elasticas", "descanso_seg": 20, "duracion_seg": 40}, {"tipo": "timed", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta y abre las piernas al mismo tiempo que levantas los brazos por encima de la cabeza, luego regresa a la posición inicial. Respiración: Mantén una respiración constante. Evita: Aterrizar ruidosamente; busca suavidad en el aterrizaje.", "nombre": "Salto de Tijera", "patron": "funcional", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a trabajar en un HIIT que optimizará tu ganancia muscular y elevará tu resistencia. Con tu equipamiento básico, ¡prepárate para una sesión intensa!"}	basico	hiit	2025-08-18 16:38:38.864913+02	2025-08-18 16:38:38.864913+02
45	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Rutina de Fuerza para Hipertrofia", "subtitulo": "Entrenamiento con equipamiento avanzado", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca la barra en la parte frontal de tus hombros, pies a la anchura de los hombros. Movimiento: Flexiona las rodillas y caderas, manteniendo el torso erguido, hasta que los muslos estén paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que la barra se desplace hacia adelante o que las rodillas sobrepasen la línea de los pies.", "nombre": "Sentadilla Frontal con Barra", "patron": "sentadilla", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: De pie, con la barra en las manos frente a los muslos. Mantén los pies a la anchura de los hombros. Movimiento: Consta de una bisagra de cadera, desciende la barra manteniendo la espalda recta y las piernas semi-flexionadas, hasta sentir un estiramiento en los isquiotibiales. Respiración: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o dejar caer la barra hacia abajo sin control.", "nombre": "Peso Muerto Rumano con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Siéntate en un banco con respaldo, sostén las mancuernas a la altura de los hombros. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos. Respiración: Inhala al bajar, exhala al subir. Evita: No arquear la espalda y asegura que las muñecas estén alineadas.", "nombre": "Press Militar con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Cuélgate de la barra con las palmas hacia adelante, manos a la anchura de los hombros. Movimiento: Tira de tu cuerpo hacia arriba hasta que tu barbilla esté por encima de la barra. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte y no descender completamente al final del movimiento.", "nombre": "Dominadas con Peso", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 6}, {"tipo": "reps", "notas": "Posición inicial: Sostente en las paralelas, brazos extendidos. Movimiento: Baja el cuerpo flexionando los codos y lleva los hombros hacia adelante, sube de nuevo. Respiración: Inhala al bajar, exhala al subir. Evita: Que los hombros se eleven hacia las orejas y no olvides mantener el core contraído.", "nombre": "Fondos con Peso en Paralelas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 8}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 45}, "mensaje_personalizado": "¡Hola! Hoy tenemos una poderosa sesión de fuerza enfocada en ganar masa muscular, utilizando tu equipamiento avanzado. ¡Prepárate para desafiar tus límites y construir ese músculo que buscas!"}	avanzado	fuerza	2025-08-18 16:57:46.911134+02	2025-08-18 16:57:46.911134+02
47	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini-2024-07-18"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento Funcional Avanzado", "subtitulo": "Desafío para fuerza y resistencia", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Sostén la barra a la altura de los hombros, con los pies a la anchura de los hombros. Movimiento: Realiza una sentadilla profunda y, al levantarte, empuja la barra hacia arriba, extendiendo completamente los brazos. Respiración: Inhala al bajar, exhala al subir. Evita: Caer hacia adelante o que la barra se desplace de su posición inicial.", "nombre": "Thruster con Barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados, pies juntos. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla de atrás hacia el suelo, vuelve a la posición inicial y cambia de pierna. Respiración: Inhala al bajar, exhala al volver a la posición inicial. Evita: Que la rodilla de la pierna adelante sobrepase el tobillo.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: De pie, con los pies a la anchura de los hombros, sosteniendo una kettlebell con ambas manos. Movimiento: Flexiona las caderas y baja la kettlebell entre las piernas, luego, con un movimiento explosivo, eleva la kettlebell hasta la altura de los ojos. Respiración: Inhala al bajar, exhala al elevar. Evita: Usar los brazos para levantar la kettlebell, el movimiento debe venir de las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebell", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha, con las manos bajo los hombros. Movimiento: Gira el tronco hacia un lado, levantando el brazo del lado opuesto hacia el techo y regresa a la posición de plancha. Respiración: Inhala en la posición inicial, exhala al elevar el brazo. Evita: Dejar caer la cadera o mantener los pies demasiado juntos.", "nombre": "Plancha con Rotación", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Funcional", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hey campeón! Hoy trabajaremos en un desafío funcional que potenciará tu fuerza y resistencia, aprovechando al máximo tu equipamiento avanzado. ¡A mantener esa energía alta!"}	avanzado	funcional	2025-08-18 17:25:29.246905+02	2025-08-18 17:25:29.246905+02
48	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini-2024-07-18"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento Funcional para Ganar Peso", "subtitulo": "Rutina con Equipamiento Mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca tus manos en el borde del sofá, brazos extendidos y pies en el suelo. Movimiento: Baja el pecho hacia el sofá flexionando los codos, manteniendo el cuerpo en línea recta. Respiración: Inhala al bajar, exhala al empujar. Evita: Arqueo en la espalda o que las caderas se hundan.", "nombre": "Flexiones de Brazo en Sofá", "patron": "empuje", "series": 4, "implemento": "sofá", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "duracion_seg", "notas": "Posición inicial: Apóyate en la pared, pies a la altura de los hombros y desciende como si te fueras a sentar. Movimiento: Mantén la posición de sentadilla. Respiración: Respira de manera controlada y mantén el core activado. Evita: Caer hacia adelante o perder el contacto con la pared.", "nombre": "Sentadilla isométrica en Pared", "patron": "sentadilla", "series": 4, "implemento": "pared", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: De pie, con los pies separados a la altura de los hombros. Movimiento: Eleva un talón hacia el glúteo mientras mantienes el equilibrio en la otra pierna. Alterna. Respiración: Inhala al bajar, exhala al elevar. Evita: Balancearte o doblar la rodilla del pie que está en el suelo.", "nombre": "Elevación de Talones Alternos", "patron": "equilibrio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "duracion_seg", "notas": "Posición inicial: Acostado en el suelo, manos bajo los glúteos y piernas extendidas. Movimiento: Eleva ambas piernas y alterna la apertura y cierre como tijeras. Respiración: Inhala al bajar, exhala al elevar. Evita: Arquear la espalda baja.", "nombre": "Tijeras en el Suelo", "patron": "core", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Vamos a poner esos músculos a trabajar, campeón! Hoy tenemos una sesión funcional que te ayudará a ganar masa muscular utilizando solo tu cuerpo y un par de accesorios creativos. ¡A darle con todo!"}	minimo	funcional	2025-08-18 17:30:22.175704+02	2025-08-18 17:30:22.175704+02
49	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini-2024-07-18"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento de Fuerza en Casa", "subtitulo": "Uso de peso corporal y mobiliario", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca las manos en el borde de la silla, pies en el suelo a un paso atrás. Movimiento: Flexiona los codos y baja el pecho hacia la silla, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al subir. Evita: Que los codos se abran demasiado o que la cadera caiga.", "nombre": "Flexiones en Silla", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Coloca la parte delantera de los pies en un escalón o borde de la silla. Movimiento: Subir y bajar los talones, manteniendo la posición en los dedos de los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte hacia adelante o hacia atrás.", "nombre": "Elevación de Talones en Escalón", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Pies al ancho de los hombros, toallas en las manos para resistencia. Movimiento: Baja en sentadilla manteniendo la espalda recta y brazos extendidos hacia delante. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas pasen la punta de los pies.", "nombre": "Sentadilla con Toallas", "patron": "sentadilla", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: Espalda contra la pared, pies a unos 60 cm de distancia. Movimiento: Baja en una posición de sentadilla y mantén la posición. Respiración: Respira de forma controlada y profunda. Evita: Deslizarte hacia abajo demasiado o mantener las rodillas demasiado adelante.", "nombre": "Isometría en Pared", "patron": "sentadilla", "series": 3, "implemento": "pared", "descanso_seg": 60, "duracion_seg": 30}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola campeón! Hoy vamos a maximizar tu fuerza utilizando solo tu peso corporal y algo de ingenio. Prepárate para desafiar tus límites y ganar músculo. ¡Vamos a ello!"}	minimo	fuerza	2025-08-18 18:12:58.28994+02	2025-08-18 18:12:58.28994+02
50	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini-2024-07-18"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento Funcional para Ganar Peso", "subtitulo": "Rutina con equipamiento mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros y brazos extendidos al frente. Movimiento: Baja a una sentadilla profunda y al subir, impulsa tu cuerpo hacia arriba en un salto. Aterriza suavemente volviendo a la posición inicial. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con las rodillas inestables o encorvar la espalda al aterrizar.", "nombre": "Sentadilla con Salto", "patron": "sentadilla", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha, manos bajo los hombros, cuerpo en línea recta. Movimiento: Realiza una flexión de brazos y al subir, lleva una rodilla hacia el pecho. Alterna las piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o elevar demasiado el trasero.", "nombre": "Flexiones de Brazo con Patada", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda, pies apoyados en el suelo y rodillas flexionadas. Movimiento: Eleva la cadera hacia el techo apretando los glúteos y, alternando, levanta una pierna manteniéndola extendida. Respiración: Inhala al bajar, exhala al elevar. Evita: Hacer el movimiento rápido o dejar caer las caderas al bajar.", "nombre": "Puente de Glúteos con Elevación Alterna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda con las manos debajo de los glúteos. Movimiento: Eleva las piernas juntas hacia el techo y luego bájalas alternando un pie hacia el suelo sin tocarlo. Respiración: Inhala al bajar, exhala al subir. Evita: Levantar la cabeza o arquear la espalda baja.", "nombre": "Tijeras en el Suelo", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con el cuerpo en línea recta. Movimiento: Lleva una rodilla hacia el pecho y alterna rápidamente las piernas como si estuvieras corriendo. Respiración: Mantén una respiración constante y fluida. Evita: Mover las caderas hacia arriba o hacia abajo.", "nombre": "Escalador", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Prepárate para un entrenamiento funcional que potenciará tus músculos y te ayudará a ganar peso de forma efectiva. ¡Vamos a impulsarte hacia tu objetivo!"}	minimo	funcional	2025-08-18 18:13:51.888517+02	2025-08-18 18:13:51.888517+02
51	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Rutina Funcional para Ganancia de Peso", "subtitulo": "Entrenamiento con equipamiento mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros. Movimiento: Realiza una sentadilla normal, manteniendo el pecho erguido. Al subir, eleva los talones del suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepasen la línea de los dedos de los pies.", "nombre": "Sentadilla con Elevación de Talones", "patron": "sentadilla", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Coloca las manos en el borde de la silla a la altura del pecho, pies en el suelo. Movimiento: Flexiona los codos, llevando el pecho hacia la silla, manteniendo el cuerpo en línea recta. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o subirlas demasiado.", "nombre": "Flexiones de Brazo en Silla", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Pies juntos. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla de la otra pierna casi hasta el suelo. Mantén el torso erguido. Respiración: Inhala al dar el paso, exhala al volver. Evita: Que la rodilla delantera sobrepase los dedos del pie.", "nombre": "Zancadas Alternas", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca tus antebrazos sobre la toalla en el suelo y extiende las piernas hacia atrás. Movimiento: Mantén el cuerpo en línea recta desde los talones hasta la cabeza. Respiración: Respira de manera controlada. Evita: Que las caderas se hundan o se eleven demasiado.", "nombre": "Plancha con Toalla", "patron": "isometría", "series": 3, "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: moderado, IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a trabajar en un entrenamiento funcional que te ayudará a ganar peso de forma efectiva, utilizando solo tu peso corporal y el equipamiento mínimo. ¡Prepárate para desafiarte!"}	minimo	funcional	2025-08-18 18:55:59.573267+02	2025-08-18 18:55:59.573267+02
52	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "HIIT Potente para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento mínimo", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Acostado sobre tu espalda, con las rodillas flexionadas y los pies apoyados en el suelo. Eleva una pierna manteniéndola recta. Movimiento: Levanta la cadera hacia el techo mientras elevas la pierna, asegurándote de contraer los glúteos. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueos en la espalda baja o que el pie apoyado se deslice.", "nombre": "Puente de Glúteos con Elevación de Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una pared, coloca tus manos en la pared a la altura de los hombros. Movimiento: Flexiona los codos para acercar el pecho a la pared, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar. Evita: Dejar caer la cabeza o arquear la espalda.", "nombre": "Flexiones de Brazo en Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta abriendo las piernas y elevando los brazos por encima de la cabeza, regresa a la posición inicial. Respiración: Exhala al saltar, inhala al regresar. Evita: Aterrizar con los pies rígidos o inclinarte hacia adelante.", "nombre": "Saltos de Tijera", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, con los pies a la altura de los hombros. Movimiento: Sube un pie a la silla y empuja con esa pierna para elevar todo tu cuerpo, luego baja y repite con la otra pierna. Respiración: Exhala al subir, inhala al bajar. Evita: Saltar con los pies o usar solo la parte baja de la espalda.", "nombre": "Subida a Silla/Sofá", "patron": "tracción", "series": 4, "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a encender tu energía con un HIIT creativo que estimulará tu crecimiento muscular, utilizando solo tu peso corporal y lo que tienes a mano. ¡Listo para el desafío?"}	minimo	hiit	2025-08-18 20:29:02.161474+02	2025-08-18 20:29:02.161474+02
53	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Rutina de Fuerza en Casa", "subtitulo": "Entrenamiento con equipamiento mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Colócate en posición de flexión, pero gira el torso hacia un lado levantando un brazo hacia el techo, formando una 'T'. Movimiento: Baja en flexión y regresa a centro, luego repite al otro lado. Respiración: Inhala al bajar, exhala al subir. Evita: No dejes que tus caderas se hundan o se eleven demasiado.", "nombre": "Flexiones de Brazo en Posición de T", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: Siéntate en el borde de una silla, con los pies en el suelo. Movimiento: Desciende como si fueras a sentarte, pero mantente suspendido a unos centímetros de la silla. Respiración: Inhala al bajar, exhala al mantener la posición. Evita: No arquees la espalda ni dejes que tus rodillas sobrepasen la línea de los pies.", "nombre": "Sentadilla Isométrica en Silla", "patron": "bisagra_cadera", "series": 3, "implemento": "silla_sofa", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Toma una toalla con ambas manos, coloca un pie hacia atrás y tira de la toalla hacia tu pecho mientras mantienes la otra pierna estirada. Movimiento: Inclínate ligeramente hacia adelante mientras jalas la toalla. Respiración: Inhala al soltar, exhala al jalar. Evita: No arquees la espalda y asegúrate de mantener el core activado.", "nombre": "Remo con Toalla", "patron": "tracción", "series": 3, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Apóyate contra la pared con los pies en posición de cadera. Movimiento: Eleva los talones, manteniendo el equilibrio. Respiración: Inhala al bajar, exhala al elevar. Evita: No transfieras todo el peso a las puntas de los pies.", "nombre": "Elevación de Talones en Pared", "patron": "bisagra_cadera", "series": 3, "implemento": "pared", "descanso_seg": 60, "repeticiones": 15}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te propongo un entrenamiento de fuerza adaptado a tu objetivo de ganar peso, utilizando solo tu peso corporal y un par de toallas. ¡A darlo todo!"}	minimo	fuerza	2025-08-18 21:01:48.004328+02	2025-08-18 21:01:48.004328+02
54	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2023-10-06", "titulo": "HIIT para Ganar Peso", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "intervalo", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros. Movimiento: Baja a una posición de cuclillas, coloca las manos en el suelo y salta hacia atrás a una posición de plancha, luego regresa a la cuclilla y salta hacia arriba. Respiración: Inhala al bajar y exhala al saltar. Evita: Hiperventilar o perder la postura en la plancha.", "nombre": "Burpees Modificados", "patron": "funcional", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}, {"tipo": "intervalo", "notas": "Posición inicial: En posición de flexión, con rodillas en el suelo. Movimiento: Baja el pecho hacia el suelo flexionando los codos, manteniendo la alineación del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas y archivar la espalda.", "nombre": "Flexiones de Brazos con Rodillas Apoyadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}, {"tipo": "intervalo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus muslos, justo encima de las rodillas. Movimiento: Baja en una sentadilla, empujando las rodillas hacia afuera para resistir la banda. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se cierren hacia adentro.", "nombre": "Sentadilla con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_trabajo_seg": 30}, {"tipo": "intervalo", "notas": "Posición inicial: En posición de plancha alta. Movimiento: Lleva una rodilla hacia el pecho mientras mantienes el torso firme y alterna. Respiración: Exhala al acercar la rodilla, inhala al regresar. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy tenemos una intensa sesión de HIIT diseñada para potenciar tu masa muscular con el equipamiento básico. Prepárate para un entrenamiento que no solo desafiará tu resistencia, sino que también estimulará tus músculos. ¡Vamos a darlo todo!"}	basico	hiit	2025-08-18 21:19:10.779936+02	2025-08-18 21:19:10.779936+02
55	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento de Fuerza en Casa", "subtitulo": "Rutina con Equipamiento Mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca una silla detrás de ti, pies a la altura de los hombros. Movimiento: Baja controladamente hacia la silla, manteniendo el pecho erguido y las rodillas alineadas con los pies. Al llegar al borde de la silla, regresa a la posición inicial. Respiración: Inhala al bajar, exhala al levantar. Evita: No dejar que las rodillas se desvíen hacia adentro.", "nombre": "Sentadilla en Silla", "patron": "sentadilla", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: De pie frente a una pared, coloca las manos al ancho de los hombros sobre la pared. Movimiento: Flexiona los codos llevando el pecho hacia la pared y empuja de regreso a la posición inicial. Respiración: Inhala al bajar, exhala al subir. Evita: No arquear la espalda ni permitir que las caderas se desplacen hacia adelante.", "nombre": "Flexiones de Brazos en Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Apóyate en la parte posterior de una silla con las manos, pies a la altura de los hombros. Movimiento: Eleva los talones del suelo manteniendo la posición. Aprieta los gemelos en la parte superior y regresa a la posición inicial. Respiración: Exhala al elevar, inhala al bajar. Evita: No dejar caer la cadera hacia atrás.", "nombre": "Elevaciones de Talón en Silla", "patron": "bisagra_cadera", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado con una rodilla apoyada en el suelo, el codo directamente debajo del hombro. Movimiento: Levanta las caderas manteniendo el cuerpo en línea recta desde la cabeza hasta la rodilla apoyada. Mantén la posición. Respiración: Respira normalmente, evita contener el aliento. Evita: No dejar caer las caderas ni torcer el torso.", "nombre": "Plancha Lateral con Rodilla Apoyada", "patron": "estabilidad", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! He diseñado un plan de entrenamiento de fuerza utilizando equipo mínimo que te ayudará a ganar masa muscular. Cada ejercicio está pensado para maximizar tus resultados. ¡A por ello!"}	minimo	fuerza	2025-08-18 21:30:57.893754+02	2025-08-18 21:30:57.893754+02
56	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento de Fuerza con Peso Corporal", "subtitulo": "Utilizando equipamiento mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca tus manos en el borde del sofá con los pies en el suelo, cuerpo recto. Movimiento: Flexiona los codos bajando el pecho hacia el sofá y empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Flexiones de Brazos Invertidas en Sofa", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, rodillas flexionadas y pies apoyados en el suelo. Movimiento: Eleva las caderas apretando los glúteos hasta que tu cuerpo forme una línea recta desde los hombros hasta las rodillas. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueo excesivo en la zona lumbar.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Ata una toalla en una puerta o un lugar seguro, sujeta los extremos. Movimiento: Inclínate hacia atrás y jala con tus brazos hacia tu pecho. Respiración: Inhala al bajar, exhala al subir. Evita: Encoger los hombros o usar el impulso.", "nombre": "Remo Invertido con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: De pie frente a una silla, pies al ancho de los hombros. Movimiento: Baja las caderas hacia atrás como si fueras a sentarte, detente justo antes de tocar la silla, luego sube. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepasen los dedos de los pies.", "nombre": "Sentadilla a Silla", "patron": "sentadilla", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 12}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Vamos a trabajar en fuerza con tu peso corporal y el equipamiento básico disponible. Este entrenamiento te ayudará a ganar masa muscular de manera efectiva. ¡Prepárate para dar lo mejor de ti!"}	minimo	fuerza	2025-08-18 22:37:50.272774+02	2025-08-18 22:37:50.272774+02
57	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento Funcional para Ganar Peso", "subtitulo": "Sesión con equipamiento mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca las manos en el borde del sofá con los brazos extendidos. Mantén el cuerpo en línea recta desde los pies hasta la cabeza. Movimiento: Flexiona los codos para bajar el pecho hacia el sofá, luego empuja hacia arriba. Respiración: Inhala al bajar y exhala al subir. Evita que las caderas se hundan o se eleven demasiado.", "nombre": "Flexiones de Brazos en Sofá", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Toma una toalla con ambas manos, coloca los pies en el centro y agáchate ligeramente con la espalda recta. Movimiento: Tira de la toalla hacia ti, llevando los codos hacia atrás mientras aprietas los omóplatos. Respiración: Exhala al tirar y inhala al regresar. Evita encorvar la espalda durante el movimiento.", "nombre": "Remo con Toallas", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, baja en una sentadilla. Movimiento: Mientras bajas, eleva los talones hacia arriba. Al subir, vuelve a bajar los talones. Respiración: Inhala al bajar, exhala al subir. Evita que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Elevación de Talones", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha alta, con las manos debajo de los hombros y el cuerpo en línea recta. Movimiento: Lleva una rodilla hacia el pecho y vuelve a la posición inicial, alternando las piernas. Respiración: Inhala al llevar la rodilla hacia el pecho y exhala al regresar. Evita que las caderas se hundan o se eleven.", "nombre": "Plancha Alta con Alternancia de Rodillas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te traigo un plan funcional adaptado a tus recursos para que ganes peso de manera efectiva y divertida. ¡Vamos a potenciar esos músculos!"}	minimo	funcional	2025-08-18 22:51:43.739746+02	2025-08-18 22:51:43.739746+02
58	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento Funcional para Aumento de Masa Muscular", "subtitulo": "Rutina con equipamiento mínimo", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca la espalda contra la pared, baja en una posición de sentadilla hasta que tus muslos estén paralelos al suelo. Mantén los pies a la altura de los hombros. Movimiento: Mantén la posición isométrica. Respira de forma controlada, evitando la retención del aire. Evita: Que la espalda se aleje de la pared o que las rodillas pasen la línea de los pies.", "nombre": "Sentadilla Isométrica en Pared", "patron": "bisagra_cadera", "series": 3, "implemento": "pared", "descanso_seg": 60, "repeticiones": "30 seg"}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla en el suelo. Adopta la posición de plancha sobre las manos, con los pies sobre la toalla. Movimiento: Flexiona los codos para bajar el pecho hacia la toalla y empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o elevar demasiado las caderas.", "nombre": "Flexiones de Brazo con Toalla", "patron": "empuje", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Siéntate en el borde de la silla con los pies planos en el suelo. Movimiento: Eleva los talones y mantén la posición por un segundo antes de bajar. Respiración: Exhala al elevar, inhala al descender. Evita: Dejar caer la parte baja de la espalda.", "nombre": "Elevación de Talones en Silla", "patron": "bisagra_cadera", "series": 3, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Acuéstate boca arriba con las rodillas flexionadas y los pies apoyados en el suelo. Movimiento: Eleva las caderas hacia el techo, levantando una pierna al mismo tiempo. Mantén la posición arriba unos segundos. Respiración: Inhala al bajar, exhala al subir. Evita: Que la espalda baje demasiado y que las rodillas se desplacen hacia afuera.", "nombre": "Puente de Glúteos con Elevación de Pierna", "patron": "bisagra_cadera", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla en el suelo al lado de ti. Movimiento: Da un paso lateral y baja en un desplante, alternando las piernas. Mantén la espalda recta y el núcleo activado. Respiración: Inhala al bajar, exhala al levantarte. Evita: Que las rodillas se desvíen hacia dentro.", "nombre": "Desplante Lateral con Toalla", "patron": "bisagra_cadera", "series": 3, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a realizar un entrenamiento funcional centrado en ganar peso usando solo tu peso corporal y equipamiento mínimo. ¡Prepárate para desafiar a tu cuerpo y construir músculo!"}	minimo	funcional	2025-08-18 22:52:28.730854+02	2025-08-18 22:52:28.730854+02
59	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Entrenamiento Funcional en Casa", "subtitulo": "Rutina con Peso Corporal y Objetos Cotidianos", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca las manos en los bordes de la silla, brazos extendidos. Pies en el suelo. Movimiento: Baja el pecho hacia la silla manteniendo los codos cerca del cuerpo. Respira: Inhala al bajar, exhala al subir. Evita: No arquees la espalda ni dejes que los hombros se eleven.", "nombre": "Flexiones de Brazos en Silla", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla bajo los pies, pies a la altura de los hombros. Movimiento: Realiza una sentadilla empujando las caderas hacia atrás. Mantén el torso erguido y la toalla como guía. Respira: Inhala al bajar, exhala al subir. Evita: No permitas que las rodillas sobrepasan la línea de los pies.", "nombre": "Sentadilla con Toalla", "patron": "sentadilla", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Siéntate en el borde de la silla, sujeta los bordes con las manos. Movimiento: Elevando las piernas juntas hacia adelante, mantén la espalda recta. Respira: Exhala al elevar, inhala al bajar. Evita: No arquees la espalda y mantén el control al bajar.", "nombre": "Elevación de Piernas en Silla", "patron": "bisagra_cadera", "series": 3, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "segundos", "notas": "Posición inicial: Acuéstate de lado apoyando un antebrazo en el suelo. Mantén la otra mano en la cintura. Movimiento: Eleva las caderas formando una línea recta. Respira: Mantén la respiración durante la posición. Evita: No dejes caer las caderas hacia el suelo.", "nombre": "Plancha Lateral con Toalla", "patron": "estabilización", "series": 3, "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: De pie, sostén una toalla con ambas manos. Movimiento: Da un paso hacia adelante con una pierna, flexionando ambas rodillas. Regresa a la posición inicial y alterna la pierna. Respira: Inhala al bajar, exhala al regresar. Evita: No sobrepases la línea de los pies con la rodilla delantera.", "nombre": "Desplante Alterno con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a optimizar tu entrenamiento funcional con el equipamiento mínimo disponible. Este plan está diseñado para ganar peso y potenciar tu fuerza. ¡Prepárate para dar lo mejor de ti!"}	minimo	funcional	2025-08-18 22:53:59.829834+02	2025-08-18 22:53:59.829834+02
60	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-18", "titulo": "Rutina Funcional para Aumento de Masa Muscular", "subtitulo": "Entrenamiento en casa con equipamiento mínimo", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Colócate de pie frente a la pared a un paso de distancia. Apoya las manos en la pared a la altura de los hombros. Movimiento: Flexiona los codos y lleva el pecho hacia la pared, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar. Evita que la pelvis se hunda o que los hombros se encorven.", "nombre": "Flexiones de Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Apóyate en la pared con los dedos de los pies y los talones elevados. Movimiento: Eleva los talones, subiendo y bajando controladamente. Respiración: Inhala al bajar, exhala al subir. Evita que el cuerpo se balancee, mantén el control.", "nombre": "Elevación de Talones en Pared", "patron": "bisagra_cadera", "series": 4, "implemento": "pared", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla entre tus manos y estira los brazos hacia adelante. Pies al ancho de los hombros. Movimiento: Flexiona caderas y rodillas hacia atrás, como si te fueras a sentar. Respiración: Inhala al bajar, exhala al subir. Evita que las rodillas sobrepasen la línea de los dedos de los pies.", "nombre": "Sentadilla con Toalla", "patron": "sentadilla", "series": 4, "implemento": "toallas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, con una pierna flexionada y la otra extendida. Movimiento: Eleva la pelvis hacia el techo apretando los glúteos. Respiración: Inhala al bajar, exhala al elevar. Evita que los hombros se eleven del suelo.", "nombre": "Puente de Glúteos con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Párate firme, sosteniendo una toalla con ambas manos. Movimiento: Tira hacia arriba con una mano mientras empujas hacia abajo con la otra, manteniendo la tensión. Respiración: Exhala al esfuerzo. Evita que tu torso se mueva, mantén el cuerpo estable.", "nombre": "Curl de Bíceps Isométrico con Toalla", "patron": "empuje", "series": 4, "implemento": "toallas", "descanso_seg": 45, "repeticiones": 12}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "18/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy hemos diseñado un plan funcional para ayudarte a ganar peso y musculatura. Con tus recursos mínimos, esta rutina te hará sentir fuerte y activo. ¡A por ello!"}	minimo	funcional	2025-08-18 22:56:18.055263+02	2025-08-18 22:56:18.055263+02
61	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT para Ganancia de Masa Muscular", "subtitulo": "Entrenamiento con Equipamiento Mínimo", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Baja en una sentadilla y salta explosivamente hacia arriba. Aterriza suave y regresa a la posición de sentadilla. Respiración: Inhala al bajar, exhala al saltar. Evita: Rodillas hacia adentro al aterrizar.", "nombre": "Saltos de Sentadilla", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En pie, sostén una toalla con ambos brazos extendidos hacia adelante. Movimiento: Da un paso hacia adelante, baja la rodilla trasera hacia el suelo y regresa. Alterna piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Que la rodilla delantera sobrepase el tobillo.", "nombre": "Desplantes Alternos Con Toalla", "patron": "bisagra_cadera", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, cuerpo recto. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente. Respiración: Exhala al llevar la rodilla hacia adelante. Evita: Caderas que suben o bajan, mantén el cuerpo recto.", "nombre": "Escaladores de Montaña", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, sostente de ella. Movimiento: Eleva los talones para quedar de puntillas y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte, mantén el control del movimiento.", "nombre": "Elevaciones de Talones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy es un gran día para ganar masa muscular a través de un HIIT desafiante. Vamos a aprovechar tu equipamiento básico para maximizar ese potencial. ¡Dale con todo!"}	minimo	hiit	2025-08-19 08:07:39.169154+02	2025-08-19 08:07:39.169154+02
62	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Entrenamiento de Fuerza en Casa", "subtitulo": "Potenciando músculo con equipamiento básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Apóyate contra la pared con la espalda recta y los pies un poco separados. Movimiento: Desciende como si fueras a sentarte en una silla imaginaria, manteniendo los muslos paralelos al suelo. Respiración: Mantén la respiración controlada. Evita: No dejar que las rodillas se desplacen hacia adelante de los pies.", "nombre": "Sentadilla Isométrica contra la Pared", "patron": "sentadilla", "implemento": "pared", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Coloca las manos en la pared a la altura de los hombros y separadas al ancho de los hombros. Movimiento: Flexiona los codos bajando el pecho hacia la pared y empuja hacia atrás. Respiración: Inhala al bajar, exhala al subir. Evita: No curvar la espalda ni dejar que los hombros se tensen.", "nombre": "Flexiones de Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla en el suelo y pisa sobre ella con los dedos de los pies. Movimiento: Eleva los talones del suelo, manteniendo el equilibrio y contrayendo los gemelos. Respiración: Exhala al subir, inhala al bajar. Evita: No dejes que los pies se deslicen de la toalla.", "nombre": "Elevación de Talones con Toalla", "patron": "bisagra_cadera", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Toma una toalla con ambas manos y da un paso atrás manteniéndola tensa. Movimiento: Tira de la toalla hacia tu pecho, manteniendo los codos cerca del cuerpo. Respiración: Exhala al tirar, inhala al soltar. Evita: No redondear la espalda ni dejar caer los hombros.", "nombre": "Remo Inclinado con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}], "tipo_nombre": "Fuerza", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a enfocarnos en ganar masa muscular con un entrenamiento de fuerza utilizando solo tu peso corporal y equipamiento mínimo. ¡Prepárate para sentir el crecimiento!"}	minimo	fuerza	2025-08-19 08:23:30.865047+02	2025-08-19 08:23:30.865047+02
63	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Entrenamiento Funcional para Hipertrofia", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: De pie, sostén una mancuerna en cada mano a la altura de los hombros. Pies a la altura de los hombros. Movimiento: Eleva las mancuernas por encima de la cabeza hasta que tus brazos estén completamente extendidos. Asegúrate de que tus muñecas estén rectas y tus codos cerca del cuerpo al bajarlas. Respiración: Inhala al bajar y exhala al subir. Evita: Arqueo en la espalda baja y que los brazos se separen demasiado del cuerpo.", "nombre": "Press de Hombro con Mancuernas", "patron": "empuje", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Fija la banda elástica a un objeto estable a la altura del pecho. Sujetar los extremos con ambas manos. Movimiento: Tira de la banda hacia tu torso, manteniendo los codos cerca del cuerpo. Regresa con control. Respiración: Inhala al extender y exhala al tirar. Evita: Inclinarte hacia atrás o usar impulso.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados del cuerpo, pies a la altura de los hombros. Movimiento: Desciende como si fueras a sentarte, manteniendo el pecho erguido y el peso en los talones. Regresa a la posición inicial. Respiración: Inhala al bajar y exhala al subir. Evita: Que las rodillas sobrepasen los dedos de los pies y mantener la espalda recta.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con las manos debajo de los hombros y el cuerpo en línea recta. Movimiento: Alterna levantar cada mano hacia el hombro opuesto, manteniendo el cuerpo estable. Respiración: Mantén la respiración constante y acompaña el movimiento. Evita: Derrapar las caderas o perder la alineación del cuerpo.", "nombre": "Plancha Dinámica", "patron": "isometría", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda con las rodillas flexionadas y los pies en el suelo, coloca una banda elástica alrededor de los muslos. Movimiento: Eleva las caderas hacia el techo, apretando los glúteos, y vuelve a la posición inicial. Respiración: Inhala al bajar y exhala al subir. Evita: Que los pies se deslicen o que la espalda se arquee excesivamente.", "nombre": "Elevación de Caderas con Banda Elástica", "patron": "bisagra_cadera", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 60, "repeticiones": 15}], "tipo_nombre": "Funcional", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te traigo un entrenamiento funcional diseñado para ayudarte a ganar peso de forma efectiva. Con tu equipamiento básico, vamos a trabajar la fuerza y la resistencia. ¡A darlo todo!"}	basico	funcional	2025-08-19 08:26:33.611105+02	2025-08-19 08:26:33.611105+02
64	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2023-10-02", "titulo": "HIIT para Ganar Peso", "subtitulo": "Entrenamiento con Equipamiento Mínimo", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos sobre el borde de la silla, con los brazos extendidos y el cuerpo en línea recta. Movimiento: Flexiona los codos para bajar el torso hacia la silla, manteniendo el cuerpo recto y los pies apoyados en el suelo. Respiración: Inhala al bajar y exhala al empujar de vuelta. Evita: Dejar caer las caderas o curvar la espalda.", "nombre": "Flexiones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta abriendo las piernas y levantando los brazos por encima de la cabeza, luego salta y regresa a la posición inicial. Respiración: Respira de forma constante, mantén el ritmo. Evita: Golpear el suelo al aterrizar.", "nombre": "Saltos de Tijera", "patron": "funcional", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros. Movimiento: Da un paso adelante y baja en un desplante, gira el torso hacia la pierna delantera. Regresa a la posición inicial y alterna. Respiración: Inhala al bajar, exhala al regresar. Evita: Que la rodilla delantera sobrepase el pie.", "nombre": "Desplantes con Rotación", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca una toalla en el suelo, siéntate en ella y apoya las manos detrás. Movimiento: Levanta las rodillas hacia el pecho y vuelve a la posición inicial, manteniendo el control. Respiración: Inhala al bajar y exhala al subir. Evita: Invertir la espalda o perder el equilibrio.", "nombre": "Rodillas al Pecho con Toalla", "patron": "funcional", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "¡Hola! Hoy tenemos un HIIT emocionante diseñado para ganar masa muscular utilizando solo tu peso corporal y algunos elementos básicos en casa. ¡Prepárate para intensificar tu entrenamiento!"}	minimo	hiit	2025-08-19 08:56:04.292564+02	2025-08-19 08:56:04.292564+02
65	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2023-10-09", "titulo": "HIIT para Ganancia de Masa Muscular", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos en el banco y los pies en el suelo, asegurando que tu cuerpo forme una línea recta. Movimiento: Baja el pecho hacia el banco, manteniendo codos cerca del torso. Respiración: Inhala al bajar, exhala al subir. Evita: Que la cadera se hunda o que los codos se abran demasiado.", "nombre": "Flexiones de Brazos en Banco", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de espaldas bajo el banco, agarra el borde con las manos. Movimiento: Tira de tu cuerpo hacia el banco, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o girar las caderas.", "nombre": "Remo Invertido con Banco", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: Pies al ancho de los hombros. Movimiento: Realiza una sentadilla y al subir, salta explosivamente. Aterriza suavemente y regresa a la posición inicial. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer de forma brusca o dejar que las rodillas se desvíen hacia adentro.", "nombre": "Sentadilla con Salto", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, manos alineadas con los hombros. Movimiento: Lleva las rodillas alternadamente hacia el pecho de forma rápida. Respiración: Respira de manera constante. Evita: Mantener la cadera demasiado alta o baja.", "nombre": "Mountain Climbers", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy tenemos un HIIT emocionante y desafiante diseñado específicamente para ti. Utilizaremos tu equipo básico para maximizar el trabajo muscular y aumentar tu volumen. ¡Listo para sudar!"}	basico	hiit	2025-08-19 09:06:22.749462+02	2025-08-19 09:06:22.749462+02
66	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento mínimo", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca los pies sobre la silla y las manos en el suelo a la altura de los hombros. Movimiento: Baja el cuerpo manteniendo una línea recta desde la cabeza hasta los pies, evitando que la cadera se hunda. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o elevar demasiado la pelvis.", "nombre": "Flexiones de Brazos con Pies Elevados en Silla", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Apóyate en la pared con la espalda recta, pies al ancho de los hombros y a un paso de la pared. Movimiento: Desciende como si te fueras a sentar, manteniendo la espalda recta, hasta que tus muslos queden paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Despegar la espalda de la pared.", "nombre": "Sentadilla a la Pared", "patron": "bisagra_cadera", "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha con las manos en el suelo. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente, manteniendo la posición de plancha. Respiración: Exhala al llevar la rodilla hacia adelante, inhala al volver. Evita: Hacerlo con la cadera elevada o dejar caer las caderas.", "nombre": "Escaladores (sin salto)", "patron": "tracción", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies a la altura de los hombros. Movimiento: Agáchate, coloca las manos en el suelo, camina hacia atrás a posición de plancha, regresa a la posición agachada y levántate. Respiración: Inhala al agacharte, exhala al levantarte. Evita: Hacer movimientos bruscos o perder el equilibrio al levantarte.", "nombre": "Burpees sin Salto", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Para ayudarte a ganar peso y fortalecer tus músculos, he diseñado un intenso entrenamiento HIIT con equipamiento mínimo. Prepárate para sudar y disfrutar de cada repetición. ¡Vamos a por ello!"}	minimo	hiit	2025-08-19 09:23:10.823437+02	2025-08-19 09:23:10.823437+02
67	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT Intensivo para Ganar Peso", "subtitulo": "Entrenamiento con Equipamiento Básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: De pie frente al banco step, con los pies a la altura de los hombros. Movimiento: Salta con ambos pies al banco y aterriza suavemente. Mantén el core contraído. Respiración: Exhala al saltar e inhala al bajar. Evita: Aterrizar con las rodillas bloqueadas.", "nombre": "Saltos en Banco Step", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Sentado en el suelo con las piernas extendidas, sujeta la banda elástica con ambas manos. Movimiento: Tira de la banda hacia tu abdomen, manteniendo la espalda recta y los codos pegados al cuerpo. Respiración: Inhala al soltar, exhala al tirar. Evita: Arqueamiento de la espalda.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de flexión con las rodillas en el suelo, manos a la altura de los hombros. Movimiento: Baja el pecho hacia el suelo flexionando los codos y vuelve a subir. Mantén el cuerpo recto. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera.", "nombre": "Flexiones de Brazos con Rodillas Apoyadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de los muslos, pies a la altura de los hombros. Movimiento: Realiza una sentadilla manteniendo la tensión en la banda, asegurándote de que las rodillas no sobrepasen los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desplacen hacia adentro.", "nombre": "Sentadilla Isla con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado con los pies apilados y apoyando el antebrazo en el suelo. Movimiento: Levanta las caderas formando una línea recta y realiza giros hacia el frente y de regreso. Respiración: Mantén una respiración controlada. Evita: Que las caderas se caigan.", "nombre": "Plancha Lateral Dinámica", "patron": "estabilización", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 28}, "mensaje_personalizado": "¡Hola! Para ayudarte a ganar peso y mantener un entrenamiento efectivo, he diseñado una rutina HIIT con equipamiento básico que maximizará tus resultados. ¡Vamos a darlo todo!"}	basico	hiit	2025-08-19 10:04:52.551217+02	2025-08-19 10:04:52.551217+02
68	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Entrenamiento HIIT para Ganar Peso", "subtitulo": "Rutina con equipamiento básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Colócate en una plancha alta, manos al ancho de los hombros. Movimiento: Baja el cuerpo manteniendo la espalda recta hasta que el pecho casi toque el suelo, luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Que la cadera se hunda o que la cabeza esté demasiado baja.", "nombre": "Flexiones de Brazos Clásicas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, frente a un espacio libre. Movimiento: Desplázate lateralmente, pisando cada espacio de una línea imaginaria o simplemente moviéndote de lado rápidamente. Respiración: Mantén una respiración constante. Evita: Perder equilibrio o movimientos descoordinados.", "nombre": "Escalera de Agilidad con Pasos Lateral", "patron": "funcional", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Pies al ancho de los hombros, baja como en una sentadilla. Movimiento: Al subir, despega del suelo en un salto y aterriza suavemente. Respiración: Inhala al bajar, exhala al saltar. Evita: Aterrizar con las rodillas bloqueadas o perder la postura.", "nombre": "Sentadillas con Salto", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate bajo el banco, agárrate del borde con las manos. Movimiento: Tira de tu pecho hacia el banco, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al subir. Evita: Girar las caderas o usar impulso.", "nombre": "Remo Invertido en Banco", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy es el día perfecto para un entrenamiento HIIT que desafiará tu resistencia y ayudará a ganar masa muscular. ¡Prepárate para sudar y disfrutar cada repetición con tu equipamiento básico!"}	basico	hiit	2025-08-19 11:13:54.96314+02	2025-08-19 11:13:54.96314+02
69	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2023-10-19", "titulo": "HIIT para Aumento de Masa Muscular", "subtitulo": "Entrenamiento con Equipamiento Básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca tus manos sobre el banco step, asegurando que tus pies estén en el suelo. Cuerpo recto. Movimiento: Baja el cuerpo hasta que el pecho toque el banco, manteniendo el core apretado. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o levantar las nalgas.", "nombre": "Flexiones de Brazos con Manos Elevadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Pisa la banda elástica con ambos pies y sujeta los extremos con las manos. Inclina ligeramente el torso hacia adelante. Movimiento: Tira de las bandas hacia tu abdomen, apretando los omóplatos. Respiración: Inhala al estirar, exhala al juntar. Evita: Curvar la espalda o usar impulso.", "nombre": "Remo Inclinado con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate en el borde de un escalón con los talones colgando. Movimiento: Eleva los talones lo más alto posible, aprieta los gemelos y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer los talones demasiado rápido.", "nombre": "Elevaciones de Pantorrillas en Escalón", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate en posición de plancha alta con las manos bajo los hombros. Cuerpo recto. Movimiento: Toca un hombro con la mano opuesta, alternando. Respiración: Mantén una respiración uniforme. Evita: Girar las caderas o bajar la cadera.", "nombre": "Plancha con Toque de Hombro", "patron": "estabilidad", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy es un gran día para ganar músculo con un HIIT desafiante. Vamos a trabajar duro con tu equipo básico. ¡A por ello!"}	basico	hiit	2025-08-19 11:30:52.378488+02	2025-08-19 11:30:52.378488+02
70	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Fuerza Avanzada para Hipertrofia", "subtitulo": "Entrenamiento con equipamiento avanzado", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Agárrate a la barra con las manos un poco más anchas que los hombros. Mantén el cuerpo recto y los pies cruzados detrás de ti. Movimiento: Tira de tu cuerpo hacia arriba hasta que la barbilla supere la barra, concentrándote en activar la espalda. Respiración: Exhala al subir, inhala al bajar. Evita: Balancearte o usar impulso.", "nombre": "Dominadas con Peso", "patron": "tracción", "series": 4, "implemento": "barra_dominadas", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, kettlebell entre tus pies. Agáchate y sujeta el kettlebell con ambas manos. Movimiento: Desde una posición de bisagra de cadera, impulsa el kettlebell hacia adelante y hacia arriba, utilizando la potencia de tus caderas. Respiración: Exhala al elevar el kettlebell, inhala al regresar. Evita: Redondear la espalda o usar los brazos para levantar el peso.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con los brazos extendidos y el cuerpo recto en diagonal. Movimiento: Tira de tus codos hacia atrás, llevando el pecho hacia las asas, manteniendo el cuerpo en línea recta. Respiración: Exhala al tirar, inhala al regresar. Evita: Dejar caer las caderas o arquear la espalda.", "nombre": "Remo TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Sosten el kettlebell en la mano del lado que vas a trabajar. Párate sobre una pierna. Movimiento: Baja el cuerpo hacia abajo mientras mantienes la otra pierna levantada. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la rodilla se desplace hacia adentro y no perder el equilibrio.", "nombre": "Sentadillas a una Pierna con Kettlebell", "patron": "bisagra_cadera", "series": 3, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 8}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 45}, "mensaje_personalizado": "¡Hola! Hoy vamos a trabajar juntos en tu objetivo de ganar músculo con un entrenamiento de fuerza utilizando equipo avanzado. Prepárate para desafiar tus límites y estimular tus músculos. ¡Vamos a hacerlo!"}	avanzado	fuerza	2025-08-19 11:54:31.327513+02	2025-08-19 11:54:31.327513+02
71	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT para Ganar Peso", "subtitulo": "Entrenamiento con Equipamiento Básico", "ejercicios": [{"tipo": "time", "notas": "Posición inicial: Manos apoyadas en el banco, cuerpo en línea recta. Movimiento: Realiza una flexión de brazos llevando el pecho hacia el banco y empuja hacia arriba. Variación: Usa una escalera o un objeto estable para variar la altura y aumentar la dificultad. Respiración: Inhala al bajar, exhala al subir. Evita: Que las caderas se hundan o se eleven excesivamente.", "nombre": "Push-Up a Escalera", "patron": "empuje", "implemento": "banco_step", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "time", "notas": "Posición inicial: De pie, sosteniendo una mancuerna en cada mano, pies al ancho de los hombros. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla trasera hacia el suelo, mantén el torso erguido. Alterna piernas. Respiración: Inhala al bajar, exhala al empujar hacia arriba. Evita: Que la rodilla delantera sobrepase los dedos del pie.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "implemento": "mancuernas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "time", "notas": "Posición inicial: Sienta la banda elástica bajo tus pies, sosteniendo los extremos con ambas manos, espalda recta. Movimiento: Tira de la banda hacia tu pecho, manteniendo los codos arriba. Controla el movimiento al soltar. Respiración: Inhala al tirar, exhala al soltar. Evita: Inclinar el torso hacia atrás al tirar.", "nombre": "Remo Alto con Banda Elástica", "patron": "tracción", "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "time", "notas": "Posición inicial: Manos sobre el banco, cuerpo en línea recta desde los pies hasta la cabeza. Movimiento: Alterna llevando las rodillas hacia tu pecho a velocidad controlada. Respiración: Exhala al llevar la rodilla hacia adelante, inhala al regresar. Evita: Que las caderas se elevan o caen.", "nombre": "Mountain Climbers en Banco", "patron": "cardio", "implemento": "banco_step", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy preparé un HIIT emocionante y desafiante que utilizará tu equipamiento básico para ayudarte a ganar peso de forma efectiva. ¡Listo para sudar y fortalecer tus músculos!"}	basico	hiit	2025-08-19 11:59:30.319923+02	2025-08-19 11:59:30.319923+02
72	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "intervalo", "notas": "Posición inicial: Coloca tus manos en el banco con los brazos extendidos y el cuerpo en línea recta. Movimiento: Baja el pecho hacia el banco, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar hacia arriba. Evita: Dejar caer las caderas o elevar demasiado el trasero.", "nombre": "Flexiones de Brazos con Manos en Banquito", "patron": "empuje", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}, {"tipo": "intervalo", "notas": "Posición inicial: De pie con los pies juntos y brazos a los lados. Movimiento: Salta abriendo las piernas y levantando los brazos sobre la cabeza, luego regresa. Respiración: Inhala al abrir, exhala al cerrar. Evita: Caer con ruido y perder el control al saltar.", "nombre": "Saltos de Tijera (Jumping Jacks)", "patron": "cardio", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}, {"tipo": "intervalo", "notas": "Posición inicial: Acostado boca arriba con rodillas flexionadas y pies en el suelo. Movimiento: Eleva las caderas hacia el techo apretando los glúteos y bajando lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda baja y que los pies se deslicen.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}, {"tipo": "intervalo", "notas": "Posición inicial: Coloca una banda elástica en el banco, sosteniéndola con ambas manos a la altura del pecho. Movimiento: Tira de la banda hacia el pecho, manteniendo el cuerpo recto. Respiración: Inhala al extender, exhala al jalar. Evita: Dejar caer los hombros o girar la cadera.", "nombre": "Remo Invertido con Banda Elástica en Banco", "patron": "tracción", "series": 5, "implemento": "bandas_elasticas", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Para tu objetivo de ganar peso, he preparado un HIIT explosivo que maximizará tu musculatura y elevará tu metabolismo. ¡Listo para sudar y crecer!"}	basico	hiit	2025-08-19 12:53:37.485117+02	2025-08-19 12:53:37.485117+02
73	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento con equipamiento básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Pies al ancho de los hombros. Movimiento: Realiza una sentadilla y al subir, salta explosivamente. Aterriza suavemente. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con los pies juntos o permitir que las rodillas sobrepasen los dedos de los pies.", "nombre": "Sentadilla con Salto", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba, rodillas flexionadas y pies en el suelo. Movimiento: Eleva las caderas hacia el techo apretando glúteos y abdominales. Respiración: Inhala al bajar, exhala al elevar. Evita: Dejar caer los glúteos al suelo sin activar los músculos.", "nombre": "Puente de Glúteos con Elevación", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos en el suelo, con la banda elástica bajo tus pies. Movimiento: Tira de la banda hacia tu torso mientras mantienes el cuerpo recto. Respiración: Inhala al tirar, exhala al regresar. Evita: Girar las caderas o relajar el abdomen.", "nombre": "Remo en Posición de Planchas con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie. Movimiento: Baja a cuclillas, pon las manos en el suelo, salta hacia atrás a la posición de plancha, regresa a cuclillas y salta al final. Respiración: Inhala al bajar, exhala al saltar. Evita: No dejar caer las caderas en la posición de plancha.", "nombre": "Burpees Modificados", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Para ayudarte a ganar músculo, he preparado un emocionante y desafiante entrenamiento HIIT que maximizará tu esfuerzo con el equipamiento básico. ¡Prepárate para sudar y construir fuerza!"}	basico	hiit	2025-08-19 13:40:24.03838+02	2025-08-19 13:40:24.03838+02
74	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2023-10-01", "titulo": "HIIT para Ganar Peso", "subtitulo": "Entrenamiento con Equipamiento Básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: En posición de flexión, con las manos bajo los hombros. Movimiento: Al bajar, eleva una pierna hacia atrás. Varía las piernas en cada repetición. Respiración: Inhala al bajar, exhala al subir. Evita: Que la cadera caiga o se levante demasiado, mantén el cuerpo en línea recta.", "nombre": "Flexiones de Brazos con Elevación de Pierna", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba, una pierna elevada. Movimiento: Eleva las caderas apretando los glúteos y el abdomen. Alterna las piernas en cada serie. Respiración: Exhala al elevar las caderas, inhala al descender. Evita: Que tus hombros se levanten del suelo, manténlos apoyados.", "nombre": "Elevaciones de Cadera con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Sentado con las rodillas flexionadas y los pies en el suelo, sostén una mancuerna con ambas manos. Movimiento: Gira el torso hacia un lado, luego hacia el otro, manteniendo el abdomen contraído. Respiración: Exhala durante la torsión, inhala al volver al centro. Evita: Redondear la espalda, mantén una postura recta.", "nombre": "Russian Twists con Mancuerna", "patron": "rotación", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba con las manos bajo los glúteos. Movimiento: Levanta las piernas rectas alternando hacia arriba y hacia abajo sin tocar el suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo en la espalda baja, mantén el abdomen apretado.", "nombre": "Tijeras en el Suelo", "patron": "abdomen", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te traigo un HIIT diseñado para ganar peso y fortalecer tus músculos utilizando tu equipamiento básico. ¡Listo para dar lo mejor de ti!"}	basico	hiit	2025-08-19 20:10:24.570812+02	2025-08-19 20:10:24.570812+02
75	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "HIIT para Ganar Masa Muscular", "subtitulo": "Entrenamiento con Equipamiento Básico", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de las piernas, justo por encima de las rodillas. Alinea tus pies a la altura de los hombros. Movimiento: Desciende en una sentadilla y mantén la posición. Mantén el pecho erguido y la espalda recta. Respiración: Controla la respiración, inhala en la bajada y mantén la isometría. Evita: Que las rodillas se desplacen hacia adentro.", "nombre": "Sentadilla Isométrica con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Sienta en el suelo con las piernas extendidas, coloca la banda elástica alrededor de los pies y toma los extremos. Movimiento: Tira de la banda hacia tu torso mientras mantienes la espalda recta. Asegúrate de apretar los omóplatos al final del movimiento. Respiración: Exhala al tirar, inhala al regresar. Evita: Redondear la espalda.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate en la esterilla con las rodillas flexionadas y los pies apoyados en el suelo, coloca la banda elástica justo por encima de las rodillas. Movimiento: Levanta las caderas hacia el techo apretando los glúteos en la parte superior del movimiento. Respiración: Inhala al bajar y exhala al elevar. Evita: Que la espalda se arquee hacia el suelo.", "nombre": "Elevación de Cadera con Bandas Elásticas", "patron": "bisagra_cadera", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado, apoyando el antebrazo en el suelo y las piernas estiradas. Movimiento: Eleva la pelvis hacia el techo, manteniendo la alineación de la cabeza a los pies. Alterna los lados. Respiración: Inhala al bajar y exhala al elevar. Evita: Que la cadera descienda o que el torso se arquee.", "nombre": "Plancha Lateral Alternando con Elevación de Cadera", "patron": "estabilidad", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te presento un HIIT diseñado para ganar músculo, utilizando tu equipamiento básico. ¡Prepárate para sudar y fortalecer cada fibra muscular!"}	basico	hiit	2025-08-19 20:22:13.488686+02	2025-08-19 20:22:13.488686+02
76	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Rutina de Fuerza con Equipamiento Avanzado", "subtitulo": "Entrenamiento con barra y kettlebells", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, barra sobre el centro de los pies. Flexiona las caderas y rodillas para agarrar la barra con un agarre por encima. Movimiento: Manteniendo la espalda recta, empuja con los talones para levantar la barra, extendiendo las caderas y las rodillas. Respiración: Inhala al bajar, exhala al levantar. Evita: Redondear la espalda o levantar los talones del suelo.", "nombre": "Peso Muerto con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con ambas manos, brazos extendidos y cuerpo alineado. Movimiento: Tira de las asas hacia tu pecho, manteniendo el cuerpo recto y apretando los omóplatos. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Dominadas con TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros, sostén la kettlebell con ambas manos frente a ti. Movimiento: Flexiona las caderas y baja la kettlebell entre tus piernas, luego impulsa tus caderas hacia adelante, llevando la kettlebell a la altura del pecho. Respiración: Inhala al bajar, exhala al elevar. Evita: Usar solo los brazos, el movimiento debe ser impulsado por las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros y los discos en los hombros. Movimiento: Empuja los discos hacia arriba hasta extender completamente los brazos, manteniendo el tronco recto. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueo de la espalda o desplazar la cabeza hacia adelante.", "nombre": "Press Militar con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 45}, "mensaje_personalizado": "¡Hola! Hoy vamos a enfocarnos en ganar músculo con una rutina de fuerza que aprovechará al máximo tu equipamiento avanzado. ¡Prepárate para desafiarte!"}	avanzado	fuerza	2025-08-19 21:01:53.017438+02	2025-08-19 21:01:53.017438+02
77	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Entrenamiento de Fuerza para Ganancia Muscular", "subtitulo": "Rutina con equipamiento personalizado", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Coloca el disco sobre tus trapecios, pies a la anchura de los hombros. Movimiento: Baja flexionando caderas y rodillas, manteniendo el pecho erguido y la espalda recta. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepongan los dedos de los pies y mantener el torso recto.", "nombre": "Sentadilla con Disco Olímpico", "patron": "sentadilla", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Sujeta el TRX con ambas manos, inclínate hacia atrás en un ángulo de 45 grados. Movimiento: Tira del TRX hacia tu pecho, manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar y exhala al tirar. Evita: Jugar con la postura y que el cuerpo se desplace hacia adelante durante el movimiento.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, coloca una toalla enrollada bajo tu espalda baja. Movimiento: Eleva las caderas hacia el techo apretando los glúteos. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo lumbar excesivo y mantener las rodillas alineadas con los pies.", "nombre": "Puente de Glúteos con Toalla", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: De pie, sostén el disco a la altura del pecho con ambas manos. Movimiento: Empuja el disco hacia arriba extendiendo los brazos sin bloquear los codos. Respiración: Inhala al bajar, exhala al subir. Evita: Que la espalda se arquee y que los codos se salgan hacia los lados.", "nombre": "Press de Hombros con Disco Olímpico", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Sujeta el TRX con las palmas hacia arriba, inclínate ligeramente hacia atrás. Movimiento: Tira del TRX hacia tus hombros, flexionando los codos. Respiración: Inhala al bajar y exhala al subir. Evita: Balancear el cuerpo y mantener los codos pegados a los lados.", "nombre": "Curl de Bíceps con TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}], "tipo_nombre": "Fuerza", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "fuerza", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy hemos preparado un entrenamiento de fuerza que maximizará tu ganancia muscular utilizando tu equipamiento personalizado. ¡Aprovecha al máximo cada serie!"}	personalizado	fuerza	2025-08-19 22:00:53.837761+02	2025-08-19 22:00:53.837761+02
78	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Rutina Funcional para Ganancia de Peso", "subtitulo": "Entrenamiento utilizando discos olímpicos y bici", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, discos frente a ti y las manos en la barra. Movimiento: Flexiona las caderas y las rodillas mientras mantienes la espalda recta, agachándote para tomar la barra. Levanta contrayendo glúteos y músculos de la espalda. Respiración: Inhala al bajar, exhala al levantar. Evita: Curvar la espalda y elevar los talones.", "nombre": "Peso Muerto con Discos Olímpicos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, discos a la altura de los hombros. Movimiento: Empuja los discos por encima de la cabeza hasta que tus brazos estén extendidos. Controla la bajada hasta la posición inicial. Respiración: Inhala al bajar, exhala al empujar. Evita: Incluir el cuerpo en el levantamiento, mantén la estabilidad.", "nombre": "Press de Hombros con Discos Olímpicos", "patron": "empuje", "series": 3, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Inclínate hacia adelante con la espalda recta, sosteniendo los discos. Movimiento: Tira de los discos hacia tu abdomen manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar los discos, exhala al levantar. Evita: Curvar la espalda y utilizar impulso.", "nombre": "Remo Inclinado con Discos Olímpicos", "patron": "tracción", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "minutos", "notas": "Mantén una postura erguida, pedalea a un ritmo moderado durante 1 minuto, seguido de 30 segundos a alta intensidad. Respira profundamente durante el ejercicio, manteniendo un ritmo controlado. Evita: Desviarte hacia adelante o hacia atrás.", "nombre": "Bici Estática (Intervalos)", "patron": "cardio", "series": 3, "duracion": 5, "implemento": "bici", "descanso_seg": 45}], "tipo_nombre": "Funcional", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "funcional", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy he preparado un entrenamiento funcional que combinará fuerza y resistencia, utilizando tus discos olímpicos y la bici. Vamos a ganar ese peso y mejorar tu rendimiento. ¡A darlo todo!"}	personalizado	funcional	2025-08-19 22:02:41.370919+02	2025-08-19 22:02:41.370919+02
79	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-19", "titulo": "Entrenamiento de Fuerza en Casa", "subtitulo": "Con equipamiento personalizado", "ejercicios": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, sostén los discos con ambas manos frente a tus muslos. Movimiento: Flexiona las caderas hacia atrás manteniendo la espalda recta y la cabeza en línea con la columna. Desciende hasta sentir un estiramiento en los isquiotibiales. Respira: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o dejar que las rodillas se muevan hacia adelante.", "nombre": "Peso Muerto Rumano con Discos Olímpicos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con las manos y recuéstate hacia atrás. Mantén el cuerpo en línea recta. Movimiento: Tira de tus manos hacia ti, llevando los codos hacia atrás y juntando los omóplatos. Respira: Inhala al bajar, exhala al subir. Evita: Dejar que la cadera se hunda o que los hombros suban hacia las orejas.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Sostén los discos al nivel de los hombros con los codos hacia adelante. Movimiento: Flexiona ligeramente las rodillas, luego utiliza el impulso de tus piernas para empujar los discos hacia arriba, extendiendo los brazos completamente. Respira: Inhala al bajar, exhala al empujar. Evita: Arqueo excesivo en la espalda al levantar o que los discos se desplacen hacia adelante.", "nombre": "Push Press con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Con discos en las manos, párate en el borde de una plataforma o escalón. Movimiento: Eleva los talones, quedándote en las puntas de los pies, luego baja los talones por debajo de la plataforma. Respira: Inhala al bajar, exhala al subir. Evita: Dejar que las rodillas se muevan hacia adelante o perder el equilibrio.", "nombre": "Elevaciones de Talones con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 12}], "tipo_nombre": "Fuerza", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "19/8", "tipoEntrenamiento": "fuerza", "duracion_estimada_min": 40}, "mensaje_personalizado": "¡Hola! Hoy vamos a trabajar en tu objetivo de ganar peso con un entrenamiento de fuerza que aprovecha al máximo tu equipamiento. Prepárate para desafiar tus límites y construir músculo. ¡Vamos a por ello!"}	personalizado	fuerza	2025-08-19 22:18:31.901716+02	2025-08-19 22:18:31.901716+02
80	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-20", "titulo": "HIIT para Ganancia Muscular", "subtitulo": "Entrenamiento en casa con equipamiento personalizado", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Agarra las asas del TRX con los brazos extendidos y el cuerpo recto. Movimiento: Inclínate hacia atrás, manteniendo el cuerpo recto y los pies firmes en el suelo. Tira hacia ti, flexionando los codos y llevando el pecho hacia las asas. Respiración: Exhala al tirar, inhala al volver. Evita: Que el cuerpo se desplace de lado o que la espalda se curve.", "nombre": "Tirón de TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Siéntate en la bici con la espalda recta y las manos en el manillar. Movimiento: Pedalea a máxima intensidad, manteniendo el ritmo y la postura. Respiración: Inhala y exhala de manera rítmica. Evita: Encoger los hombros o inclinarte demasiado adelante.", "nombre": "Bicicleta Estática", "patron": "cardio", "series": 4, "implemento": "bici", "descanso_seg": 45, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca los discos en el suelo, súbete a ellos y mantén el equilibrio. Movimiento: Eleva los talones, apretando los músculos de las pantorrillas. Baja controladamente. Respiración: Exhala al elevar, inhala al bajar. Evita: Colapsar los tobillos o permitir que las rodillas se desvíen.", "nombre": "Elevaciones de Talones con Discos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus muñecas y apóyate sobre un lado. Movimiento: Eleva las caderas hasta que el cuerpo forme una línea recta. Mantén la posición y luego baja. Respiración: Mantén la respiración constante. Evita: Caer en la cadera o no mantener la alineación de la espalda.", "nombre": "Plancha Lateral con Banda Elástica", "patron": "estabilización", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "20/8", "tipoEntrenamiento": "hiit", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy te traigo un HIIT adaptado para ganar músculo utilizando tu equipamiento personalizado. Prepárate para poner a prueba tus límites y fortalecer tu cuerpo. ¡Vamos a trabajar!"}	personalizado	hiit	2025-08-20 09:11:15.640315+02	2025-08-20 09:11:15.640315+02
81	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4o-mini"}, "plan_entrenamiento": {"fecha": "2025-08-22", "titulo": "HIIT para Ganar Peso", "subtitulo": "Entrenamiento con equipamiento mínimo", "ejercicios": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca una silla estable frente a ti. Movimiento: Salta con ambos pies hacia arriba y aterriza suavemente sobre la silla. Mantén los pies juntos y las rodillas ligeramente flexionadas. Respiración: Exhala al saltar, inhala al aterrizar. Evita: Aterrizar con las piernas rígidas o hacer saltos demasiado altos.", "nombre": "Saltos en Silla", "patron": "bisagra_cadera", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate frente a una pared a una distancia cómoda. Movimiento: Inclínate hacia la pared manteniendo el cuerpo recto, y empuja para volver a la posición inicial. Asegúrate de que los codos estén cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Flexiones de Brazos en Pared", "patron": "empuje", "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Pies a la altura de hombros y dedos ligeramente hacia afuera. Movimiento: Baja las caderas como si fueras a sentarte en una silla, manteniendo el pecho erguido y las rodillas alineadas con los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desvíen hacia adentro o que el torso se incline hacia adelante.", "nombre": "Sentadillas con Peso Corporal", "patron": "sentadilla", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, con manos debajo de los hombros. Movimiento: Lleva una rodilla hacia el pecho y luego alterna rápidamente con la otra pierna, como si estuvieras corriendo en el lugar. Mantén el abdomen contraído. Respiración: Inhala y exhala rápidamente. Evita: Que las caderas se eleven o se bajen excesivamente.", "nombre": "Mountain Climbers en Suelo", "patron": "tracción", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "22/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "¡Hola! Hoy vamos a trabajar con un HIIT que maximizará tus ganancias de peso con mínimo equipamiento. Prepárate para un entrenamiento desafiante y efectivo. ¡A darlo todo!"}	minimo	hiit	2025-08-22 13:22:22.687938+02	2025-08-22 13:22:22.687938+02
82	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2024-08-17", "titulo": "Rutina funcional creativa", "subtitulo": "Entrenamiento en casa con equipamiento personalizado", "ejercicios": [{"tipo": "reps", "notas": "Mantén una postura erguida, contrae el core y realiza saltos suaves para evitar impacto excesivo en las articulaciones.", "nombre": "Saltos con Taza de Agua sobre la Cabeza", "patron": "saltos", "series": 3, "implemento": "personalizado", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén el abdomen apretado y realiza movimientos rápidos, manteniendo la alineación de la espalda y las caderas.", "nombre": "Escaladores de Montaña con Toalla", "patron": "escaladores", "series": 3, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén los glúteos elevados y contraídos durante toda la ejecución, evitando que la cadera caiga o suba demasiado rápido.", "nombre": "Puente con un Libro en la Cadera", "patron": "puente", "series": 3, "implemento": "libro", "descanso_seg": 50, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza el movimiento controladamente, asegurando una resistencia constante y sin balancear el cuerpo.", "nombre": "Lanzamiento Lateral de Banda Elástica a la Altura del Hombro", "patron": "excepto", "series": 3, "implemento": "banda elástica", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Al realizar la sentadilla, extiende un brazo hacia adelante y el otro hacia atrás, alternando en cada repetición para trabajar equilibrio y coordinación.", "nombre": "Sentadillas con Peso Corporal y Péndulo de Brazo", "patron": "sentadilla", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el torso estable y usa la toalla para simular el movimiento de remos, activando dorsal y bíceps sin forzar la espalda baja.", "nombre": "Remo en Puente con Toalla en Pared", "patron": "remo", "series": 3, "implemento": "toalla", "descanso_seg": 50, "repeticiones": 15}], "tipo_nombre": "Funcional", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "22/8", "tipoEntrenamiento": "funcional", "duracion_estimada_min": 40}, "mensaje_personalizado": "¡Excelente elección de entrenamiento funcional con equipamiento personalizado! Este plan te ayudará a mejorar tu fuerza, equilibrio y resistencia de forma segura y efectiva. Vamos a desafiar tus límites con movimientos creativos y variados."}	personalizado	funcional	2025-08-22 18:46:58.311615+02	2025-08-22 18:46:58.311615+02
83	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Avanzado para Potenciar Funciones Múltiples", "subtitulo": "Sesión de alta intensidad con equipamiento avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén una buena técnica en flexión y evita que la espalda se hunda. Aprovecha el salto para activar toda la cadena posterior.", "nombre": "Burpees con Salto y Flexión de Espalda en Barra", "patron": "alta intensidad", "series": 4, "implemento": "barra y peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Realiza el swing con control, aprovechando la fuerza explosiva de las caderas. Mantén la espalda recta en todo momento.", "nombre": "Swing con Kettlebell en Traza Rápida", "patron": "potencia y cardio", "series": 4, "implemento": "Kettlebell", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Procura que el movimiento sea explosivo pero controlado, activando el dorsal y los brazos. No balancees el torso.", "nombre": "Remo en Barra Explosivo", "patron": "potencia", "series": 4, "implemento": "barra y discos", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén un ritmo rápido, sin comprometer la técnica. Usa los brazos para impulsarte y elevar las rodillas con fuerza.", "nombre": "Saltos en Cama Elástica con Elevación de Rodillas", "patron": "cardio intenso", "series": 4, "implemento": "cama elástica", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "reps", "notas": "Controla la bajada y evita que la rodilla pase la punta del pie. Usa la mancuerna para mantener el equilibrio y la carga.", "nombre": "Sentadilla Pistol Asistida con Mancuerna en Mano", "patron": "fuerza y equilibrio", "series": 3, "implemento": "mancuerna", "descanso_seg": 45, "repeticiones": 8}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "22/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "Perfecto, Juan. Con tu equipamiento avanzado y tu experiencia, vamos a crear un entrenamiento HIIT desafiante y variado que potenciará tu resistencia y fuerza. ¡A darlo todo hoy!"}	avanzado	hiit	2025-08-22 18:48:06.657639+02	2025-08-22 18:48:06.657639+02
84	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina de fuerza para ganancia muscular", "subtitulo": "Entrenamiento en casa con equipamiento básico", "ejercicios": [{"tipo": "series_reps", "notas": "Asegúrate de mantener la espalda recta y los codos cerca del torso durante la tracción. Controla el movimiento para maximizar el trabajo muscular.", "nombre": "Remo invertido en silla", "patron": "remo", "series": 4, "implemento": "silla", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "series_reps", "notas": "Da pasos largos y mantén la rodilla alineada con el tobillo en el descenso. Incorpora una toalla en las manos para mayor estabilidad si necesitas.", "nombre": "Zancadas con peso corporal", "patron": "zancada", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "series_reps", "notas": "Mantén los codos ligeramente flexionados y realiza el movimiento de manera controlada para activar bien los deltoides y trapecios.", "nombre": "Press de hombros con bandas elásticas", "patron": "press_shoulders", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "series_reps", "notas": "Realiza movimientos lentos y controlados, levantando las toallas a la altura de los hombros sin levantar los pies del suelo para mantener la estabilidad.", "nombre": "Elevaciones laterales con toalla", "patron": "elevaciones_laterales", "series": 3, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "series_reps", "notas": "Aprieta los glúteos en la parte superior y mantén la posición unos segundos. Evita sobreextender la zona lumbar.", "nombre": "Puente de glúteos en suelo", "patron": "puente_gluteos", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 15}], "tipo_nombre": "Fuerza", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "22/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 45}, "mensaje_personalizado": "Enfoquémonos en fortalecer tu musculatura con una rutina variada y segura, aprovechando tu equipamiento básico. Cada ejercicio será una oportunidad para desafiarte y progresar en tu objetivo de ganar peso. ¡Vamos allá!"}	basico	fuerza	2025-08-22 18:50:22.802686+02	2025-08-22 18:50:22.802686+02
85	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina de Fuerza Funcional con Equipo Básico", "subtitulo": "Entrenamiento centrado en fuerza y equilibrio", "ejercicios": [{"tipo": "reposo", "notas": "Mantén las caderas elevados al subir y controla la bajada, sin que las rodillas se abran excesivamente, para trabajar glúteos y femorales.", "nombre": "Puente de Glúteos con Silla", "series": 4, "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Asegúrate de mantener el tronco inclinado hacia adelante, sin redondear la espalda, y retrae las escápulas al tirar de la banda.", "nombre": "Remo con Bandas Elásticas en T - Posición Agachada", "series": 4, "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Sostén la toalla con ambas manos y realiza elevaciones controladas, concentrándote en la contracción del deltoides lateral.", "nombre": "Elevaciones Laterales de Hombros con Toalla", "series": 3, "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la espalda recta y los pies a la anchura de las caderas. Empuja con los talones para subir.", "nombre": "Sentadillas con Peso Corporal y Silla", "series": 4, "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Realiza el movimiento de manera controlada, sin balancear, concentrándote en la contracción del bíceps.", "nombre": "Curl de Bíceps con Mancuernas Ajustables", "series": 3, "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén los codos fijos y extiende los brazos completamente para activar los tríceps eficientemente.", "nombre": "Extensiones de Tríceps en Silla", "series": 3, "descanso_seg": 45, "repeticiones": 10}], "tipo_nombre": "Fuerza", "equipamiento": "basico", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "23/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Básico", "duracion_estimada_min": 50}, "mensaje_personalizado": "Perfecto para potenciar tu fuerza con un enfoque innovador y efectivo usando tu equipamiento básico. Cada ejercicio ha sido seleccionado para desafiarte y promover un crecimiento muscular equilibrado."}	basico	fuerza	2025-08-23 12:23:13.743451+02	2025-08-23 12:23:13.743451+02
86	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2024-08-17", "titulo": "HIIT para Incremento de Masa Muscular", "subtitulo": "Entrenamiento con equipamiento personalizado", "ejercicios": [{"tipo": "intervalos", "notas": "Mantén la espalda plana y los abdomen contraído durante todo el ejercicio, desplazándote lentamente para controlar la carga.", "nombre": "Bear Crawl con Carga", "patron": "crawling", "series": 5, "implemento": "peso adicional opcional", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "intervalos", "notas": "Asegúrate de que la pierna que trabaja esté alineada con la cadera y mantén el core firme para estabilidad.", "nombre": "Flexión de Tijera con Peso (en una pierna)", "patron": "flexión", "series": 4, "implemento": "mancuernas ligeras", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervalos", "notas": "Utiliza un ritmo explosivo en el salto sin perder la técnica de alineación y cuidado en la aterrizaje.", "nombre": "Sentadillas con Salto a Propio Peso", "patron": "salto", "series": 5, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "intervalos", "notas": "Mantén la espalda recta y activa el core durante la remada para evitar lesiones y maximizar el trabajo muscular.", "nombre": "Remo Renegado con Manoplas o Mancuernas", "patron": "remo", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "intervalos", "notas": "Desde la posición de plancha, desliza las manos sobre la superficie (toalla) con control para trabajar hombros y core.", "nombre": "Planchas Dinámicas con Toalla", "patron": "plancha", "series": 3, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 20}], "tipo_nombre": "HIIT", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "23/8", "tipoEntrenamiento": "hiit", "duracion_estimada_min": 30}, "mensaje_personalizado": "Para potenciar tu ganancia de peso utilizando tu equipamiento personalizado y un enfoque HIIT, he diseñado una rutina que desafiará tu resistencia y fuerza de manera innovadora y segura. ¡Motívate a dar lo mejor en cada serie!"}	personalizado	hiit	2025-08-23 12:24:16.531257+02	2025-08-23 12:24:16.531257+02
87	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina avanzada de fuerza con equipamiento personalizado", "subtitulo": "Ejercicios creativos y efectivos para potenciar tu fuerza", "ejercicios": [{"tipo": "reps", "notas": "Utiliza la silla para apoyo en la bajada y asegura que la técnica sea controlada para proteger las rodillas.", "nombre": "Pistol Squat asistido con silla", "patron": "sentadilla con una pierna", "series": 4, "implemento": "silla", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén la espalda recta y aprieta los omóplatos al final del movimiento para activar bien la espalda.", "nombre": "Remo en T con bandas elásticas en posición inclinado", "patron": "remo", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Asegúrate de no arquear demasiado la espalda y realiza movimientos controlados para evitar lesiones en hombros.", "nombre": "Press de hombros con mancuernas en banco inclinado", "patron": "press de hombro", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Realiza movimientos lentos y controlados, concentrándote en la contracción muscular para maximizar el trabajo.", "nombre": "Elevaciones laterales de hombro con banda elástica", "patron": "elevación lateral", "series": 3, "implemento": "banda elástica", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el codo fijado y evita balancear el cuerpo para aislar mejor el bíceps.", "nombre": "Curl de bíceps en concentración con mancuernas", "patron": "curl", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Controla la fase excéntrica y evita que la banda tenga demasiado slack para mantener tensión constante.", "nombre": "Extensión de tríceps con banda en banco plano", "patron": "extensión de tríceps", "series": 3, "implemento": "banda elástica", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén el core apretado y evita que las caderas se hundan durante el ejercicio para una mejor estabilidad.", "nombre": "Plancha con levantamiento de pierna alterno", "patron": "plancha dinámica", "series": 3, "implemento": "sin implemento", "descanso_seg": 60, "repeticiones": 12}], "tipo_nombre": "Fuerza", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "23/8", "tipoEntrenamiento": "fuerza", "duracion_estimada_min": 45}, "mensaje_personalizado": "Con tu experiencia y nivel intermedio, te propongo una rutina de fuerza innovadora y variada que aprovechará tu equipamiento personalizado, ayudándote a seguir progresando sin repetir ejercicios de tu reciente historial."}	personalizado	fuerza	2025-08-23 12:32:35.77673+02	2025-08-23 12:32:35.77673+02
103	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT con peso corporal y elementos simples", "subtitulo": "Sesión en casa con equipamiento mínimo", "ejercicios": [{"tipo": "intervallo", "notas": "Mantén el ritmo y evita perder la postura. Usa los brazos para mejorar el ritmo aeróbico.", "nombre": "Jumping Jacks", "patron": "cardio", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 45}, {"tipo": "intervallo", "notas": "Mantén los codos cerca del cuerpo y baja controladamente.", "nombre": "Fondos en Silla", "patron": "fuerza", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "intervallo", "notas": "Mantén el torso erguido y la espalda neutral para evitar lesiones.", "nombre": "Sentadillas con peso corporal", "patron": "movimiento", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervallo", "notas": "Activa bien el abdomen y mantén la cadera estable durante el movimiento.", "nombre": "Mountain Climbers", "patron": "core", "series": 6, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "intervallo", "notas": "Mantén el cuerpo en línea recta y evita que las caderas se hundan.", "nombre": "Plancha con Toque de Hombro", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 12}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "27/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "Preparado para un entrenamiento HIIT dinámico y variado que potenciará tu resistencia y fuerza, usando solo lo más básico. ¡Es momento de desafiarte y avanzar con intensidad y precisión!"}	minimo	hiit	2025-08-27 20:28:06.053376+02	2025-08-27 20:28:06.053376+02
88	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT avanzado para máxima eficiencia", "subtitulo": "Rutina dinámica con equipamiento avanzado", "ejercicios": [{"tipo": "reps", "notas": "Utiliza una técnica controlada, asegurándote de elevar la pesa en línea recta y mantener la espalda recta durante el movimiento.", "nombre": "Clean to Press con Kettlebell", "patron": "propio peso dinámico", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la espalda plana y activa el core para evitar lesiones. Realiza el movimiento con control y concentración en la contracción muscular.", "nombre": "Remo con Barra en Pendiente", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Asegúrate de aterrizar suavemente y mantener el control en cada salto para proteger las articulaciones.", "nombre": "Saltos en Caja con Peso", "patron": "saltos pliométricos", "series": 4, "implemento": "disco o peso en mano", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén el core contraído y evita empujar el suelo con las manos, enfócate en la contracción abdominal.", "nombre": "Elevaciones de Tronco con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "tiempo", "notas": "Levanta las rodillas con énfasis en la velocidad y arrastra las pesas con movimientos controlados para activar la cadena posterior.", "nombre": "Sprint en Sitio con Arrastre de Pesas", "patron": "cardio intenso", "series": 4, "implemento": "pesas", "descanso_seg": 45, "repeticiones": "20 segundos de trabajo / 20 segundos de descanso"}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: intermedio, IMC: 22.7", "fecha_formateada": "23/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "Enfocado en tu nivel intermedio y con tu equipo avanzado, esta rutina de HIIT te ayudará a potenciar tu resistencia y fuerza, llevándote a un nuevo nivel en cada sesión. ¡Prepárate para desafiarte a ti mismo y obtener resultados sorprendentes!"}	avanzado	hiit	2025-08-23 14:39:37.364297+02	2025-08-23 14:39:37.364297+02
89	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Creativo para Impulso de Peso", "subtitulo": "Ejercicios en casa con recursos personales", "ejercicios": [{"tipo": "reps", "notas": "Usa la toalla para aumentar la resistencia y mantener la estabilidad, asegurando una correcta alineación del cuerpo.", "nombre": "Flexiones con Toalla en Pared", "patron": "flexiones", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Ejecuta saltos explosivos y lleva las rodillas al pecho al subir, cuidando la técnica para evitar impacto excesivo en las articulaciones.", "nombre": "Saltos en Silla con Elevación de Rodillas Alternas", "patron": "saltos", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén una línea recta desde los hombros hasta los talones, jalando la toalla hacia ti mientras aprietas la espalda.", "nombre": "Remo en Puente usando Silla y Toalla", "patron": "remo", "series": 4, "implemento": "toalla y silla", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el core firme y evita que las caderas se hundan. Desplaza las manos o los pies lateralmente para mayor movimiento.", "nombre": "Plancha Dinámica con Desplazamiento lateral", "patron": "plancha", "series": 3, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la espalda pegada a la pared y realiza elevaciones controladas para activar los glúteos y oblicuos.", "nombre": "Elevaciones Laterales de Cadera con Toalla en Pared", "patron": "elevaciones de cadera", "series": 3, "implemento": "toalla, pared", "descanso_seg": 45, "repeticiones": 15}], "estructura": "30s trabajo / 15s descanso en cada ejercicio, repitiendo el circuito 3 veces para un entrenamiento dinámico y desafiante.", "tipo_nombre": "HIIT", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "23/8", "tipoEntrenamiento": "hiit", "duracion_estimada_min": 30}, "mensaje_personalizado": "Preparado para una sesión de HIIT innovadora y efectiva, enfocada en maximizar tu rendimiento con tu equipamiento personalizado. Aprovecha al máximo cada movimiento y conquista tus objetivos."}	personalizado	hiit	2025-08-23 15:03:37.967605+02	2025-08-23 15:03:37.967605+02
90	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Fortalecimiento con Equipamiento Avanzado", "subtitulo": "Entrenamiento exclusivo en casa para fuerza máxima", "ejercicios": [{"tipo": "reps", "notas": "Mantén la espalda recta y activa el core para evitar lesiones. El movimiento debe ser controlado y sin rebotes en la parte baja.", "nombre": "Remo con Barra Pendlay", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Asegura una buena estabilidad en los pies y evita que los brazos bajen excesivamente. Controla la bajada y empuja explosivamente.", "nombre": "Press de Banca con Barra", "patron": "press_horizontal", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y activa el core durante toda la acción. No doble demasiado las rodillas y enfócate en la cadera.", "nombre": "Peso Muerto Rumano con Discos", "patron": "peso_muerto", "series": 4, "implemento": "discos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Asegura una buena amplitud en el movimiento, sin colgarse en exceso y controlando la bajada. Si es muy fácil, añade peso.", "nombre": "Dominadas con Agarre Paralelo en Barra", "patron": "dominadas", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén el core firme y no sobreextiendas la espalda. Eleva la barra de manera controlada y evita movimientos bruscos.", "nombre": "Press Militar con Barra", "patron": "press_vertical", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 6}, {"tipo": "reps", "notas": "Inclina el torso a 45 grados y activa el dorsal durante el movimiento. No uses impulso para levantar las mancuernas.", "nombre": "Remo en T con Mancuernas Pesadas", "patron": "remo", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 8}], "tipo_nombre": "Fuerza", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "24/8", "tipoEntrenamiento": "fuerza", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 50}, "mensaje_personalizado": "Para potenciar tu fuerza y aprovechar al máximo tu equipamiento avanzado, he diseñado una rutina que desafía tus límites con movimientos novedosos y efectivos. ¡Confía en tu técnica y progresión constante!"}	avanzado	fuerza	2025-08-24 19:06:51.280578+02	2025-08-24 19:06:51.280578+02
91	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Creativo con Equipamiento Personalizado", "subtitulo": "Entrenamiento de alta intensidad en casa", "ejercicios": [{"tipo": "reps", "notas": "Realiza un burpee completo, al levantarte, lleva las rodillas al pecho y desliza las toallas por el suelo con las manos para activar el core.", "nombre": "Burpees con Elevación de Rodillas y Uso de Toallas", "patron": "burpee", "series": 4, "implemento": "toallas", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "En la fase de empuje, alterna la elevación de una mano deslizando la toalla en el suelo; mantiene el cuerpo en línea recta y activa el core para estabilidad.", "nombre": "Flexiones con Palmas Alternas y Toallas Deslizantes", "patron": "flexiones", "series": 4, "implemento": "toallas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Haz una sentadilla profunda, explota en un salto y usa la silla para realizar fondos parciales en caso de fatiga, conservando control en la bajada.", "nombre": "Sentadillas con Salto y Uso de Silla para Fondo Parcial", "patron": "sentadilla con salto", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la espalda recta y realiza el remo controlado, desafiando tu equilibrio en la pierna de soporte para activar estabilizadores.", "nombre": "Remo en Upright utilizando Bandas Elásticas y Balance sobre Piernas", "patron": "remo", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Realiza movimiento rápido, deslizando los pies en las toallas para intensificar el trabajo de core y cardio, manteniendo la espalda neutra.", "nombre": "Mountain Climbers con Toallas Deslizantes en Piso Suave", "patron": "mountain climbers", "series": 4, "implemento": "toallas", "descanso_seg": 45, "repeticiones": 30}], "tipo_nombre": "HIIT", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "duracion_estimada_min": 30}, "mensaje_personalizado": "Excelente decisión de desafiarte a ti mismo con un entrenamiento HIIT usando tu equipamiento personalizado. Vamos a maximizar la eficiencia y sorprenderte con movimientos innovadores que potenciarán tu resistencia y fuerza. ¡Manos a la obra!"}	personalizado	hiit	2025-08-25 13:17:32.308198+02	2025-08-25 13:17:32.308198+02
92	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina Funcional Avanzada", "subtitulo": "Desafía tu cuerpo con movimientos integrales", "ejercicios": [{"tipo": "reps", "notas": "Mantén la espalda recta y activa la cadera al final del movimiento para potenciar el impulso del kettlebell.", "nombre": "Swing con Kettlebell a una mano", "patron": "levantamiento", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Realiza un salto libre al despegue y evita arquear la espalda durante la dominada para protegerla.", "nombre": "Burpee con salto y barra dominadas", "patron": "fullbody", "series": 4, "implemento": "barra y peso corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el core firme y evita que las caderas se hundan o levanten demasiado, controlando la bajada.", "nombre": "Lunges en posición de plancha con peso en manos", "patron": "zancadas", "series": 3, "implemento": "pesos en manos (kettlebells o mancuernas)", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Concéntrate en apretar los omóplatos y mantener la espalda alineada para una tracción eficiente.", "nombre": "Remo con TRX en movimiento dinámico", "patron": "remo", "series": 4, "implemento": "TRX", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la espalda recta y los brazos ligeramente flexionados, tratando de mantener un ritmo constante.", "nombre": "Salto en cuerda doble con cambios rápidos", "patron": "cardio", "series": 3, "implemento": "cuerda de salto", "descanso_seg": 45, "repeticiones": 50}], "tipo_nombre": "Funcional", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 40}, "mensaje_personalizado": "Increíble compromiso con tu entrenamiento avanzado. Hoy te propongo una sesión funcional innovadora que desafiará tu coordinación, fuerza y resistencia, aprovechando todo tu equipamiento. ¡Adelante, de manera segura y concentrada!"}	avanzado	funcional	2025-08-25 13:20:05.324963+02	2025-08-25 13:20:05.324963+02
93	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT en Casa con Equipamiento Mínimo", "subtitulo": "Ejercicios dinámicos para maxilar tu resistencia y fuerza", "ejercicios": [{"tipo": "intervalo", "notas": "Realiza las sentadillas con explosividad, aterrizando suavemente para proteger las articulaciones y maximizar el trabajo cardiovascular.", "nombre": "Sentadillas con salto sin peso", "patron": "salto", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto, evita que las caderas caigan o se levanten demasiado; ajusta la apertura de manos para mayor énfasis en pectorales o tríceps.", "nombre": "Flexiones de brazos en suelo (manos en parallets o sobre libros para variar altura)", "patron": "flexion", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervalo", "notas": "Desde posición de plancha, toca con una mano el hombro contraria alternando, manteniendo el control y evitando rotaciones innecesarias.", "nombre": "Plancha con toques de hombro", "patron": "plancha", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervalo", "notas": "Mantén las caderas bajas y realiza movimientos rápidos, activando abdomen y hombros de manera dinámica.", "nombre": "Escaladores (mountain climbers)", "patron": "cardio", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 40}, {"tipo": "intervalo", "notas": "Aprieta los glúteos al elevar la pelvis, evita sobreextender la zona lumbar, y si quieres aumentar intensidad, coloca un peso ligero sobre la pelvis.", "nombre": "Puente de glúteos con peso en pelvis (opcional con objeto ligero)", "patron": "hipthrust", "series": 8, "implemento": "peso corporal o ligero peso", "descanso_seg": 45, "repeticiones": 15}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "Revisa esta sesión de HIIT en casa, diseñada para mantener la intensidad sin necesidad de mucho equipamiento. Es perfecta para desafiarte y variar, manteniendo la motivación al máximo. ¡A darlo todo!"}	minimo	hiit	2025-08-25 14:11:53.044204+02	2025-08-25 14:11:53.044204+02
94	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Creativo para Ganar Peso", "subtitulo": "Sesión avanzada con equipamiento personalizado", "ejercicios": [{"tipo": "reps", "notas": "Impulsa explosivamente al elevar las manos para aplaudir, asegurando buena alineación de las muñecas y control en el impacto.", "nombre": "Flexiones con palmada explosiva", "patron": "potencia", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la columna larga y evita tirar de cuello, concentrándote en activar el core con control.", "nombre": "V-Ups con torsión rítmica", "patron": "core", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Aterriza con los pies alineados y ligeramente flexionados, controlando el impacto para proteger las articulaciones.", "nombre": "Saltos en caja improvisada (silla resistente o escalón)", "patron": "potencia", "series": 4, "implemento": "silla o escalón", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la cadera estable y evita rotar excesivamente el torso, activando el core durante todo el ejercicio.", "nombre": "Plancha con toque alterno de hombros", "patron": "establecimiento", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Realiza el movimiento de manera rápida pero controlada, asegurando una buena alineación en hombros y cadera.", "nombre": "Mountain Climbers con alcance profundo", "patron": "cardio", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}], "tipo_nombre": "HIIT", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "duracion_estimada_min": 30}, "mensaje_personalizado": "Increíble que te aventures con un entrenamiento HIIT adaptado a tu experiencia. Preparar una sesión innovadora y efectiva será un desafío motivador para seguir ganando masa muscular en casa. ¡Vamos a ello!"}	personalizado	hiit	2025-08-25 14:25:14.059126+02	2025-08-25 14:25:14.059126+02
95	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT avanzado con equipamiento", "subtitulo": "Rutina de alta intensidad para usuarios experimentados", "ejercicios": [{"tipo": "intervalo", "notas": "Alterna las manos en cada serie, mantén la espalda recta y usa la fuerza de cadera para impulsar el kettlebell.", "nombre": "Swing con Kettlebell a una mano", "patron": "dinámico", "series": 5, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervalo", "notas": "Mantén los hombros bajos y controla la bajada para aprovechar al máximo el ejercicio. Usa una cadencia controlada.", "nombre": "Pull-up con barra", "patron": "levantamiento", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "intervalo", "notas": "Coge un balón medicinal y lanza con fuerza a la pared, atrapándolo suavemente en retorno, coordinando respiración y movimiento.", "nombre": "Lanzamiento de balón medicinal contra la pared", "patron": "potencia", "series": 4, "implemento": "balón medicinal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja controladamente hasta que los hombros estén al nivel de los codos.", "nombre": "Fondos en paralelas", "patron": "tríceps y pectoral", "series": 4, "implemento": "barras paralelas", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "intervalo", "notas": "Mantén la espalda recta, activa el core y retrae los omóplatos al tirar de la barra.", "nombre": "Remo con barra en movimiento dinámico", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 12}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "Listo para desafiar tus límites con un entrenamiento HIIT innovador y dinámico. Aprovechando tu equipamiento avanzado, te propongo una rutina que combina fuerza, velocidad y resistencia para potenciar tu progreso."}	avanzado	hiit	2025-08-25 14:26:12.96867+02	2025-08-25 14:26:12.96867+02
96	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2024-08-17", "titulo": "HIIT avanzado para resistencia y fuerza", "subtitulo": "Sesión en casa con equipamiento avanzado", "ejercicios": [{"tipo": "tiempo", "notas": "Mantén una postura neutral de la columna y realiza el movimiento con las caderas, no solo con los brazos.", "nombre": "Swing de Kettlebell a dos manos", "patron": "hip hinge", "series": 4, "implemento": "Kettlebell", "descanso_seg": 45, "duracion_seg": 40}, {"tipo": "tiempo", "notas": "Asegúrate de que tus manos despeguen del suelo de forma controlada y aterrizan suavemente para proteger las muñecas.", "nombre": "Flexiones con palmadas explosivas", "patron": "explosivo", "series": 4, "implemento": "sin implemento", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "reps", "notas": "Mantén la espalda recta y activa el core en todo momento para evitar lesiones.", "nombre": "Remo con barra en posición inclinada", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Mantén el core firme y evita que la cadera se rote excesivamente al tocar el hombro contralateral.", "nombre": "Plancha con toque de hombro alterno", "patron": "estabilidad", "series": 4, "implemento": "sin implemento", "descanso_seg": 45, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Utiliza los discos para deslizar lateralmente, manteniendo las rodillas ligeramente flexionadas y el core activo.", "nombre": "Saltos con deslizamiento lateral sobre discos", "patron": "cardio", "series": 4, "implemento": "discos", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "Preparado para un desafío cardiovascular estimulante? Hoy te propongo un HIIT innovador y dinámico con tu equipamiento avanzado, para potenciar tu resistencia y fuerza en cada movimiento. ¡Vamos con toda la energía!"}	avanzado	hiit	2025-08-25 14:29:15.468475+02	2025-08-25 14:29:15.468475+02
97	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Avanzado con Equipamiento Completo", "subtitulo": "Sesión de alta intensidad para usuarios con equipo avanzado", "ejercicios": [{"tipo": "reps", "notas": "Mantén la espalda recta y usa la fuerza de las caderas para impulsar el swing, evita usar solo los brazos.", "nombre": "Swing con Kettlebell a Dos Manos Rápido", "patron": "swing", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Impúlsate con fuerza hacia arriba y intenta tocar la barra con el pecho o área superior, controla la bajada.", "nombre": "Dominadas Explosivas con Velocidad", "patron": "dominadas", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén la pierna de apoyo firme y el core comprometido para mantener el equilibrio, realiza movimientos controlados.", "nombre": "Sentadillas Pistol sin Asistencia (Alternativa con peso si es necesario)", "patron": "pistol squat", "series": 3, "implemento": "discos (opcional)", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén el cuerpo alineado y el core firme, controla la fase de subida y bajada para trabajar la fuerza y estabilidad.", "nombre": "Remo en Suspensión con TRX en Movimiento Dinámico", "patron": "remo", "series": 4, "implemento": "TRX", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza un burpee controlado, añadiendo un salto explosivo al terminar para maximizar el esfuerzo cardiovascular.", "nombre": "Burpees con Barra y Saltos Explosivos", "patron": "burpee", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 12}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "Listo para revolucionar tu entrenamiento con un enfoque HIIT avanzado y sorprendente. Incorporando movimientos creativos y desafiantes, potenciarás tu resistencia y fuerza de manera eficaz. ¡Dale con todo!"}	avanzado	hiit	2025-08-25 17:22:56.262604+02	2025-08-25 17:22:56.262604+02
98	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Creativo con Equipo Mínimo", "subtitulo": "Ejercicios innovadores y efectivos para avanzar en tu objetivo", "ejercicios": [{"tipo": "reps", "notas": "Sube las rodillas con fuerza, utilizando las manos en la silla para impulso, mantén la espalda recta y evita movimientos bruscos.", "nombre": "Elevaciones de rodillas en silla con impulso", "patron": "cardio dinámico", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén la cadera estable durante el movimiento y evita que las caderas se muevan de lado a lado para una mayor estabilidad y activación del core.", "nombre": "Plancha con toque de hombros alterno", "patron": "estabilidad", "series": 3, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 16}, {"tipo": "reps", "notas": "Realiza saltos en un lado a otro de manera rápida pero controlada, asegurando un aterrizaje suave para cuidar las articulaciones.", "nombre": "Saltos laterales sobre línea imaginaria (sin cuerda)", "patron": "cardio", "series": 4, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "reps", "notas": "Mantén el cuerpo en línea recta desde la cabeza hasta los talones y evita que las caderas se hundan o suban demasiado en cada repetición.", "nombre": "Flexiones de brazos con manos en suelo elevado en una silla", "patron": "fuerza", "series": 3, "implemento": "silla", "descanso_seg": 45, "repeticiones": 12}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "Vamos a maximizar tu entrenamiento de HIIT con el equipamiento mínimo que tienes, enfocándonos en movimientos innovadores y efectivos para mantener tu progreso en ganancia de peso. ¡Prepárate para desafiarte a ti mismo y sorprenderte con los resultados!"}	minimo	hiit	2025-08-25 17:58:17.457091+02	2025-08-25 17:58:17.457091+02
99	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT avanzado de cuerpo completo", "subtitulo": "Entrenamiento dinámico con equipo avanzado", "ejercicios": [{"tipo": "saltar", "notas": "Aterriza suavemente con las rodillas ligeramente flexionadas para proteger las articulaciones, impulsa con toda la fuerza de las piernas.", "nombre": "Saltos de Pliometría con Discos", "patron": "power", "series": 5, "implemento": "discos", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "movimiento", "notas": "Mantén la espalda recta y activa el core durante todo el movimiento, evita la sobreextensión lumbar.", "nombre": "Swing de Kettlebell a Doble Mano", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "flexion", "notas": "Mantén el cuerpo alineado, evita que la pelvis se hunda. Usa la cuerda para un impulso adicional si buscas mayor intensidad.", "nombre": "Flexiones con Cuerda de Soga", "patron": "flexión", "series": 4, "implemento": "cuerda", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "fuerza", "notas": "Realiza un remo explosivo, elevando la barra hasta el torso rápidamente y bajando controladamente. Mantén la espalda recta.", "nombre": "Remo con Barra en Explosión", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "cardio", "notas": "Mantén el core firme y realiza movimientos rápidos, evitando que las caderas caigan o suban demasiado.", "nombre": "Mountain Climbers con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 40}], "tipo_nombre": "HIIT", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "25/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 30}, "mensaje_personalizado": "Perfecto, con tu experiencia y el equipo avanzado, vamos a desafiar tus límites con un entrenamiento HIIT innovador y desafiante. Prepárate para activar todas tus fibras musculares y potenciar tu resistencia."}	avanzado	hiit	2025-08-25 18:40:33.772943+02	2025-08-25 18:40:33.772943+02
100	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina Funcional de Alta Intensidad con Equipo Avanzado", "subtitulo": "Desafía tu rendimiento y mejora tu movilidad", "ejercicios": [{"tipo": "reps", "notas": "Impulsa con las caderas, mantén la espalda recta y controla el movimiento al bajar y subir la kettlebell.", "nombre": "Kettlebell Swings Explosivos", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén el core activo mientras alternas entre plancha y flexión apoyado en TRX, controlando la respiración.", "nombre": "TRX Atomic Push-ups", "patron": "plancha en movimiento", "series": 3, "implemento": "TRX", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Asegúrate de aterrizar con las rodillas ligeramente flexionadas y mantener una postura estable en cada salto.", "nombre": "Saltos laterales sobre Caja con Peso", "patron": "plyometric", "series": 3, "implemento": "disco peso", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Gira el torso al lanzar la kettlebell, controlando el movimiento y evitando rotaciones bruscas de la columna.", "nombre": "Lanzamiento de Kettlebell con Giro", "patron": "rotacional", "series": 3, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza sentadillas apoyado en la pared y desplaza lateralmente, manteniendo la espalda pegada y el core firme.", "nombre": "Progresión de Sentadillas en Pared con Desplazamiento", "patron": "sentadilla en pared", "series": 3, "implemento": "silla", "descanso_seg": 60, "repeticiones": 12}], "tipo_nombre": "Funcional", "equipamiento": "avanzado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "27/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Avanzado", "duracion_estimada_min": 40}, "mensaje_personalizado": "Excelente decisión potenciar tu entrenamiento funcional con el equipo avanzado. Hoy te propongo una rutina innovadora que desafiará tu equilibrio, fuerza y coordinación, llevándote a nuevos niveles. ¡Manos a la obra con creatividad y precisión!"}	avanzado	funcional	2025-08-27 20:01:04.828997+02	2025-08-27 20:01:04.828997+02
101	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Creativo de Bajo Equipamiento", "subtitulo": "Maximiza tu esfuerzo con movimientos innovadores", "ejercicios": [{"tipo": "reps", "notas": "Asegúrate de mantener la espalda recta al saltar y usar la toalla como peso para trabajar también la estabilidad.", "nombre": "Burpees con Toalla", "patron": "fullbody", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén el tronco alineado y evita que las caderas se hundan. Controla la elevación y la bajada.", "nombre": "Plancha con Elevación Alterna de Piernas", "patron": "core", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Realiza una sentadilla profunda tocando la silla, impulsándote con los talones para saltar y repetir enérgicamente.", "nombre": "Sentadillas en Silla con Salto", "patron": "sentadilla", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Al subir, gira el torso para tocar con la mano la cadera contraria, trabajando también el core.", "nombre": "Flexiones con Giro", "patron": "superior", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Utiliza la toalla en el suelo para mantener el equilibrio y realizar saltos laterales rápidos.", "nombre": "Saltos laterales sobre toalla", "patron": "cardio", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 30}], "tipo_nombre": "HIIT", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: avanzado, IMC: 22.7", "fecha_formateada": "27/8", "tipoEntrenamiento": "hiit", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 20}, "mensaje_personalizado": "Vamos a poner tu cuerpo en movimiento con un entrenamiento HIIT dinámico y creativo, usando solo lo esencial. Este enfoque te ayudará a mantener la intensidad y mejorar tu condición en poco tiempo."}	minimo	hiit	2025-08-27 20:15:44.091804+02	2025-08-27 20:15:44.091804+02
104	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina Funcional con Mínimo Equipamiento", "subtitulo": "Ejercicios innovadores para fortalecer y movilizar", "ejercicios": [{"tipo": "reps", "notas": "Mantén la pelvis elevada y aprieta los glúteos en la parte superior del movimiento, controlando la bajada.", "nombre": "Puente de Glúteos en la Pared", "patron": "hip thrust", "series": 3, "implemento": "silla (opcional)", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén una postura estable y realiza movimientos controlados para activar el core y los abductores.", "nombre": "Elevación Alterna de Piernas en Posición de Sentadilla", "patron": "pierna", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza la contracción escapular asegurando la correcta alineación del hombro y evitando sobrecarga en la zona cervical.", "nombre": "Press de Pared con Flexión de Escápulas", "patron": "press", "series": 3, "implemento": "pared", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la columna alineada y realiza movimientos controlados para activar estabilizadores del core y hombros.", "nombre": "Planchas Alternas con Rotación de Tronco", "patron": "planchas", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Usa la toalla para mejorar el equilibrio y coordinación en movimientos de marcha controlada, activando estabilizadores de pie y tobillo.", "nombre": "Marcha en Vuelta de Toalla (Balance Dinámico)", "patron": "equilibrio", "series": 3, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 20}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "28/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "Para potenciar tu funcionalidad y resistencia con recursos mínimos, he diseñado una rutina que desafía tus músculos y mejora tu equilibrio. Aprovecha cada movimiento y mantén la concentración para maximizar los resultados."}	minimo	funcional	2025-08-28 09:51:38.13754+02	2025-08-28 09:51:38.13754+02
105	10	{"plan_source": {"type": "template", "label": "Plantilla Predefinida", "detail": "Funcional Mínimo - Patrones Básicos"}, "plan_entrenamiento": {"titulo": "Rutina Funcional - Equipamiento Mínimo", "subtitulo": "Patrones de movimiento básicos con peso corporal", "ejercicios": [{"tipo": "reps", "notas": "Patrón fundamental de sentadilla. Mantén el pecho elevado y desciende hasta que muslos estén paralelos.", "nombre": "Sentadilla con Peso Corporal", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Patrón de empuje horizontal. Mantén línea recta desde cabeza hasta pies.", "nombre": "Flexiones de Pecho", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Patrón unilateral. Paso amplio, rodilla trasera casi toca el suelo.", "nombre": "Zancada Alterna", "patron": "zancada", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Core estabilidad. Línea recta desde cabeza hasta pies.", "nombre": "Plancha Isométrica", "patron": "core", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, IMC: 22.7", "fecha_formateada": "28/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 25}, "mensaje_personalizado": "Rutina funcional diseñada con movimientos fundamentales que puedes hacer en cualquier lugar. Enfócate en la calidad del movimiento."}	minimo	funcional	2025-08-28 10:31:34.995528+02	2025-08-28 10:31:34.995528+02
106	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "Rutina Funcional con Equipamiento Mínimo", "subtitulo": "Ejercicios variados que desafían tu cuerpo completo", "ejercicios": [{"tipo": "reps", "notas": "Mantén una espalda recta en la bajada y realiza el salto explosivo, tocando las rodillas en el aire para incrementar intensidad.", "nombre": "Burpees con salto y toque de rodillas", "patron": "salto", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Enfócate en mantener las caderas elevadas y los brazos alineados para activar la parte superior de tu espalda y hombros.", "nombre": "Pike Push-Up (Flexión en V invertida para hombros)", "patron": "flexión", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el core firme y realiza movimientos controlados para activar glúteos y piernas sin perder estabilidad.", "nombre": "Elevaciones laterales de pierna en posición de cuadrupedia", "patron": "elevacion", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Gira el torso desde las caderas y mantén la espalda recta, asegurando una correcta rotación de la columna.", "nombre": "Russian Twists con Toalla o Peso Ligero", "patron": "rotacion", "series": 3, "implemento": "toalla o peso ligero", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Realiza pasos largos y controla el movimiento, usando la toalla para añadir resistencia o equilibrio en la parte superior si es necesario.", "nombre": "Estocadas Alternas con Toalla para Resistencia", "patron": "estocada", "series": 3, "implemento": "toalla", "descanso_seg": 60, "repeticiones": 12}], "tipo_nombre": "Funcional", "equipamiento": "minimo", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "28/8", "tipoEntrenamiento": "funcional", "equipamiento_nombre": "Equipamiento Mínimo", "duracion_estimada_min": 30}, "mensaje_personalizado": "Muy bien, has decidido aprovechar al máximo tu entrenamiento funcional con poco equipo. Esta rutina te ayudará a mejorar tu fuerza, equilibrio y movilidad, perfecta para un entrenamiento en casa dinámico y efectivo."}	minimo	funcional	2025-08-28 12:04:51.580162+02	2025-08-28 12:04:51.580162+02
107	10	{"plan_source": {"type": "openai", "label": "OpenAI", "detail": "gpt-4.1-nano"}, "plan_entrenamiento": {"fecha": "2025-08-17", "titulo": "HIIT Creativo con Equipamiento Personalizado", "subtitulo": "Ejercicios variados y efectivos", "ejercicios": [{"tipo": "reps", "notas": "Realiza una flexión explosiva y, en el ascenso, da una palmada en cada mano para activar potencia y coordinación.", "nombre": "Flexiones con Palmada Alterna", "patron": "flexiones", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén el core fuerte y lleva la rodilla hacia el codo opuesto en cada repetición para activar oblicuos y mejorar la estabilidad.", "nombre": "Mountain Climbers con Giro Torácico", "patron": "cardio dinámico", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "reps", "notas": "Salta con ambos pies y alterna ligeramente la dirección, asegurando una aterrizaje suave para proteger articulaciones.", "nombre": "Saltos Pliométricos en Caja Alterna", "patron": "saltos", "series": 3, "implemento": "caja improvisada o altura segura", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Usa una toalla resistente para realizar un remo isométrico, asegurándote de mantener la espalda recta y contractar el dorsal.", "nombre": "Remo con Toalla en Puerta", "patron": "fuerza", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza un burpee explosivo, asegurándote de mantener la técnica y evitar movimientos bruscos que puedan lesionarte.", "nombre": "Burpees con Salto Vertical", "patron": "cardio intenso", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}], "tipo_nombre": "HIIT", "equipamiento": "personalizado", "perfil_usuario": "Sergio — Edad: 41, Peso: 76.00 kg, Altura: 183.00 cm, Nivel: , IMC: 22.7", "fecha_formateada": "28/8", "tipoEntrenamiento": "hiit", "duracion_estimada_min": 30}, "mensaje_personalizado": "Con tu experiencia y tu equipamiento personalizado, te propongo una rutina HIIT innovadora que desafíe tu resistencia y fuerza, evitando repeticiones para mantener la variedad. ¡Disfruta del entrenamiento y sigue impulsándote hacia tus objetivos de ganar peso con intensidad y seguridad!"}	personalizado	hiit	2025-08-28 12:52:37.453305+02	2025-08-28 12:52:37.453305+02
\.


--
-- TOC entry 5812 (class 0 OID 26736)
-- Dependencies: 231
-- Data for Name: home_training_sessions; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_training_sessions (id, user_id, home_training_plan_id, started_at, completed_at, total_duration_seconds, exercises_completed, total_exercises, progress_percentage, status, session_data) FROM stdin;
1	10	13	2025-08-17 14:24:49.078439+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén el kettlebell cerca del pecho durante la sentadilla.", "nombre": "Sentadilla con Kettlebell", "patron": "sentadilla", "series": 4, "implemento": "kettlebell", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}, {"tipo": "reps", "notas": "Asegúrate de bajar completamente y activar la espalda.", "nombre": "Dominadas con agarre amplio", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Controla el movimiento y evita arquear la espalda.", "nombre": "Press de Hombros con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el cuerpo recto y tira hacia tu pecho.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "TRX", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la espalda recta y baja controladamente.", "nombre": "Peso Muerto con Discos Olímpicos", "patron": "bisagra de cadera", "series": 4, "implemento": "discos olímpicos", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 10}]}
2	10	14	2025-08-17 14:38:12.49851+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Asegúrate de mantener la espalda recta y bajar hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con barra", "patron": "sentadilla", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén el core apretado y la barra cerca del cuerpo durante el movimiento.", "nombre": "Peso muerto con barra", "patron": "bisagra de cadera", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Baja la barra controladamente y empuja hacia arriba con fuerza.", "nombre": "Press de banca con barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Agarra la barra con las palmas hacia adelante y sube hasta que la barbilla supere la barra.", "nombre": "Dominadas", "patron": "tracción", "series": 4, "implemento": "barra de dominadas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Baja hasta que los codos estén a 90 grados y empuja hacia arriba.", "nombre": "Fondos en paralelas", "patron": "empuje", "series": 4, "implemento": "paralelas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}]}
3	10	15	2025-08-17 14:49:45.843358+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo constante y asegúrate de aterrizar suavemente.", "nombre": "Burpees", "patron": "cuerpo completo", "series": 4, "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Salta lo más alto posible y aterriza en una posición de sentadilla.", "nombre": "Sentadillas con salto", "patron": "sentadilla", "series": 4, "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones", "patron": "empuje", "series": 4, "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Acelera el movimiento para aumentar la intensidad.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "descanso_seg": 30, "duracion_seg": 30}]}
4	10	16	2025-08-17 16:42:19.138876+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que los muslos estén paralelos al suelo.", "nombre": "Sentadilla con mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Controla el movimiento y evita que las mancuernas se toquen en la parte superior.", "nombre": "Press de pecho en banco con mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén el codo cerca del cuerpo y aprieta los omóplatos al final del movimiento.", "nombre": "Remo con mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y siente el estiramiento en los isquiotibiales.", "nombre": "Peso muerto con mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Realiza el movimiento de forma controlada y mantén la contracción en la parte superior.", "nombre": "Elevaciones de talones", "patron": "aislado", "series": 4, "implemento": "peso corporal", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 10}]}
5	10	17	2025-08-17 16:57:28.944488+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.", "nombre": "Flexiones de brazos", "patron": "empuje", "series": 4, "implemento": "peso corporal", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Asegúrate de que las rodillas no sobrepasen los dedos de los pies.", "nombre": "Sentadilla con peso corporal", "patron": "sentadilla", "series": 4, "implemento": "peso corporal", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Baja hasta que los codos estén a 90 grados.", "nombre": "Fondos en silla", "patron": "empuje", "series": 4, "implemento": "silla", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Aprieta los glúteos en la parte superior del movimiento.", "nombre": "Puente de glúteos", "patron": "bisagra de cadera", "series": 4, "implemento": "peso corporal", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 10}]}
6	10	18	2025-08-17 17:08:25.410119+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de hacer una buena extensión al saltar.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la espalda recta.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener el cuerpo en línea recta.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y el abdomen contraído.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan de lado a lado.", "nombre": "Plancha con toque de hombro", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
7	10	18	2025-08-17 17:08:27.90007+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de hacer una buena extensión al saltar.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la espalda recta.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener el cuerpo en línea recta.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y el abdomen contraído.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan de lado a lado.", "nombre": "Plancha con toque de hombro", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
8	10	18	2025-08-17 17:08:30.140146+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de hacer una buena extensión al saltar.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la espalda recta.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener el cuerpo en línea recta.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y el abdomen contraído.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan de lado a lado.", "nombre": "Plancha con toque de hombro", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
9	10	18	2025-08-17 17:08:37.188685+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo alto y asegúrate de hacer una buena extensión al saltar.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la espalda recta.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Asegúrate de mantener el cuerpo en línea recta.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén un ritmo rápido y el abdomen contraído.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Evita que las caderas se muevan de lado a lado.", "nombre": "Plancha con toque de hombro", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
10	10	19	2025-08-17 17:18:50.929857+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo rápido y controla la caída.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la postura.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Baja el pecho hasta casi tocar el suelo.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el abdomen contraído y el ritmo constante.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Siente la contracción en los gemelos.", "nombre": "Elevaciones de talones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
11	10	19	2025-08-17 17:18:52.542051+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo rápido y controla la caída.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la postura.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Baja el pecho hasta casi tocar el suelo.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el abdomen contraído y el ritmo constante.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Siente la contracción en los gemelos.", "nombre": "Elevaciones de talones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
12	10	19	2025-08-17 17:18:54.727981+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Mantén un ritmo rápido y controla la caída.", "nombre": "Burpees", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Aterriza suavemente y mantén la postura.", "nombre": "Sentadillas con salto", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Baja el pecho hasta casi tocar el suelo.", "nombre": "Flexiones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Mantén el abdomen contraído y el ritmo constante.", "nombre": "Mountain Climbers", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "intervalo", "notas": "Siente la contracción en los gemelos.", "nombre": "Elevaciones de talones", "implemento": "peso corporal", "descanso_seg": 30, "duracion_seg": 30}]}
13	10	20	2025-08-17 17:19:17.884463+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Asegúrate de mantener los pies firmes en el suelo y el control en el movimiento.", "nombre": "Press de Banca con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y baja hasta que tus muslos estén paralelos al suelo.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén el torso inclinado y tira de las mancuernas hacia tu abdomen.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 120, "duracion_seg": null, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén las mancuernas cerca de tus piernas durante el movimiento.", "nombre": "Peso Muerto con Mancuernas", "patron": "bisagra de cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "duracion_seg": null, "repeticiones": 8}, {"tipo": "reps", "notas": "Realiza el movimiento de forma controlada, sintiendo el trabajo en los gemelos.", "nombre": "Elevación de Talones", "patron": "aislado", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "duracion_seg": null, "repeticiones": 12}]}
14	10	33	2025-08-17 18:18:22.536299+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Asegúrate de hacer el jump con fuerza y controlar la caída. Mantén las mancuernas firmes principalmente durante el press.", "nombre": "Burpees con Mancuernas", "patron": "cuerpo completo", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Da un paso amplio hacia adelante, manteniendo la espalda recta y el núcleo apretado. Alterna las piernas con cada repetición.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "piernas", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Mantén los codos por encima de los hombros y los hombros relajados mientras tiras de la banda hacia ti.", "nombre": "Remo Alto con Banda Elástica", "patron": "espalda", "series": 4, "implemento": "banda elástica", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Mantén la posición de plancha mientras alternas el golpeo de hombros. Activa el abdomen para evitar que las caderas se hundan.", "nombre": "Plancha Dinámica con Golpes", "patron": "core", "series": 4, "implemento": "ninguno", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}, {"tipo": "intervalo", "notas": "Coloca la mancuerna sobre la pelvis. Aprieta los glúteos al elevar la cadera, formando una línea recta desde los hombros hasta las rodillas.", "nombre": "Puente de Glúteos con Mancuerna", "patron": "glúteos", "series": 4, "implemento": "mancuernas", "duracion_trabajo_seg": 30, "duracion_descanso_seg": 15}]}
15	10	34	2025-08-17 19:49:36.613551+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Sostén una mancuerna en cada mano, brazos a los lados. Movimiento: Salta abriendo y cerrando las piernas mientras elevas los brazos por encima de la cabeza. Aterriza suavemente con las rodillas ligeramente flexionadas. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con las rodillas rígidas o golpear el suelo.", "nombre": "Saltos de Tijera con Mancuernas", "patron": "cardio", "series": 5, "implemento": "mancuernas", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Coloca la banda elástica alrededor de tu espalda y sostenla con ambas manos. Alinea tu cuerpo en posición de flexión. Movimiento: Baja el torso manteniendo los codos cerca del cuerpo, luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o abrir demasiado los codos.", "nombre": "Flexiones con Bandas Elásticas", "patron": "empuje", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Realiza una sentadilla y al levantarte eleva los talones del suelo. Mantén el torso erguido. Respiración: Inhala al descender, exhala al subir. Evita: Permitir que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Peso Corporal y Elevación de Talones", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: Imagina que sostienes cuerdas de batalla, pies separados a la anchura de los hombros. Movimiento: Alterna arriba y abajo los brazos como si estuvieras moviendo cuerdas. Mantén la parte central del cuerpo firme. Respiración: Controla la respiración y exhala al bajar los brazos. Evita: Girar la cadera o perder el equilibrio.", "nombre": "Battle Rope Alternado (simulado)", "patron": "cardio", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}]}
16	10	35	2025-08-17 19:56:19.79708+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: En posición de flexión con las manos ligeramente más anchas que los hombros. Movimiento: Baja el torso manteniendo una línea recta desde la cabeza hasta los talones. Al subir, levanta una pierna del suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Caderas caídas o elevadas, mantén el cuerpo recto.", "nombre": "Flexiones con Elevación de Pierna", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda, pie derecho en el suelo, pierna izquierda extendida hacia arriba. Movimiento: Eleva la cadera contra el suelo utilizando el talón derecho para empujar. Mantén la pierna izquierda extendida sin tocar el suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo de la espalda baja, mantén la alineación.", "nombre": "Puente de Glúteos con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Bajo una mesa resistente, agárrate del borde con las manos y mantén el cuerpo recto. Movimiento: Tira de tu cuerpo hacia arriba hasta que el pecho toque la mesa, manteniendo las piernas estiradas. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o arquear la espalda.", "nombre": "Remo Invertido en Mesa", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: Apóyate contra una pared con los pies a la altura de las caderas, baja en una posición de sentadilla. Movimiento: Mantén la posición de sentadilla contra la pared. Respiración: Respira normalmente. Evita: Desplazar las rodillas hacia adelante de los dedos de los pies, mantén la espalda recta.", "nombre": "Sentadilla Isométrica en Pared", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}]}
17	10	37	2025-08-17 20:28:14.275847+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a la altura de los hombros. Pies a la anchura de los hombros. Movimiento: Baja en sentadilla mientras presionas las mancuernas hacia arriba al levantarte. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepongan los dedos de los pies al bajar.", "nombre": "Sentadilla con Mancuerna y Press", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, sosteniendo los extremos de la cuerda. Movimiento: Salta suavemente alternando los pies como si estuvieras corriendo. Mantén el core contraído. Respiración: Respira de forma natural, evitando contener la respiración. Evita: Saltar demasiado alto; mantén los pies cerca del suelo.", "nombre": "Saltos de Cuerda Alternos", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: En posición de flexión, con una mancuerna en cada mano. Cuerpo en línea recta. Movimiento: Baja el torso mientras mantienes el codo pegado al cuerpo. Al subir, eleva una mancuerna hacia el pecho. Alterna brazos. Respiración: Inhala al bajar, exhala al subir. Evita: Que tus caderas caigan o se eleven.", "nombre": "Flexiones de Brazo con Elevación de Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 8}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca una banda elástica alrededor de las piernas, justo por encima de las rodillas. Posición de pie con pies juntos. Movimiento: Da un paso lateral hacia la derecha, luego junta los pies. Repite hacia la izquierda. Mantén el core activo. Respiración: Respira de forma continua. Evita: Inclinarte hacia adelante o que la banda se deslice.", "nombre": "Desplazamientos Laterales con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "duracion_seg": 30}]}
18	10	38	2025-08-17 20:46:39.119847+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, sostén las mancuernas a la altura de los hombros con palmas hacia adelante. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos. Respiración: Exhala al empujar, inhala al bajar. Evita: Arqueo lumbar excesivo o elevar los hombros hacia las orejas.", "nombre": "Press de Hombros con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Inclínate ligeramente hacia adelante con la espalda recta y las mancuernas en manos. Movimiento: Tira de las mancuernas hacia tu abdomen, manteniendo los codos pegados al cuerpo. Respiración: Exhala al subir, inhala al bajar. Evita: Redondear la espalda o mover el torso durante el ejercicio.", "nombre": "Remo con Mancuernas", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: De pie, con las mancuernas a los lados. Movimiento: Da un paso hacia adelante y baja la rodilla trasera hacia el suelo, manteniendo el torso recto. Regresa. Respiración: Inhala al bajar, exhala al levantarte. Evita: Que la rodilla delantera se desplace hacia adelante más allá del pie.", "nombre": "Zancada Alterna con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha con los codos debajo de los hombros. Movimiento: Eleva una pierna manteniendo la posición del torso estática. Alterna piernas. Respiración: Respira de manera controlada. Evita: Caderas demasiado altas o bajas, mantén una línea recta desde cabeza a talones.", "nombre": "Plancha Alternando Elevación de Pierna", "patron": "isometrico", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: De pie, sostén las mancuernas a los lados. Movimiento: Eleva los talones del suelo, manteniendo el equilibrio en la parte frontal de los pies. Respiración: Exhala al subir, inhala al bajar. Evita: Dejar caer el peso hacia atrás o hacia adelante al elevarte.", "nombre": "Elevaciones de Talones con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}]}
19	10	39	2025-08-17 20:50:15.780562+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la altura de los hombros, sostén el kettlebell con ambas manos entre tus piernas. Movimiento: Flexiona ligeramente las rodillas y empuja las caderas hacia atrás, luego, explosivamente, mueve las caderas hacia adelante y levanta el kettlebell hasta la altura del pecho. Respiración: Inhala en la bajada, exhala al levantar. Evita: Hacer el movimiento solo con los brazos, mantén la potencia en las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 5, "implemento": "kettlebells", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate frente a una caja o plataforma estable. Movimiento: Flexiona las rodillas y salta hacia arriba, aterrizando suavemente sobre la caja, usando las piernas para amortiguar el impacto. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer duramente sobre la caja o aterrizar con las rodillas bloqueadas.", "nombre": "Box Jump", "patron": "explosión", "series": 4, "implemento": "caja", "descanso_seg": 40, "duracion_seg": 20}, {"tipo": "tiempo", "notas": "Posición inicial: Agárrate de las cintas del TRX con los brazos extendidos y el cuerpo recto. Movimiento: Tira de las cintas hacia ti, flexionando los codos y llevando el pecho hacia las manos. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la cadera se hunda o que el cuerpo se curve.", "nombre": "Remo Invertido en TRX", "patron": "tracción", "series": 5, "implemento": "trx", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Asume una posición de flexión, pero eleva las caderas formando una 'V' invertida. Movimiento: Baja la cabeza hacia el suelo, utilizando los hombros para empujar el cuerpo hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la parte baja de la espalda se hunda.", "nombre": "Pike Push-Up", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 35, "duracion_seg": 25}]}
20	10	40	2025-08-17 21:00:32.823882+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos a la altura del pecho. Pies a la anchura de los hombros. Movimiento: Flexiona las caderas y las rodillas como si te fueras a sentar, asegurándote de que las rodillas no sobrepasen los dedos de los pies. Mantén el torso erguido. Respiración: Inhala al bajar, exhala al subir. Evita: Colapsar el pecho hacia adelante o que los talones se levanten.", "nombre": "Sentadilla con Mancuerna", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Rodillas en el suelo, manos apoyadas al ancho de hombros. Cuerpo en línea recta desde la cabeza hasta las rodillas. Movimiento: Baja el pecho hacia el suelo manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o elevar demasiado las caderas.", "nombre": "Flexiones de Brazo con Apoyo de Rodillas", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba con las rodillas dobladas y los pies apoyados en el suelo. Sostén una mancuerna en la cadera. Movimiento: Eleva las caderas hacia el techo apretando los glúteos al llegar arriba, mantén una línea recta desde las rodillas hasta los hombros. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueamiento de la espalda baja.", "nombre": "Puente de Glúteos con Mancuerna", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: A cuatro patas con una mancuerna en una mano. Movimiento: Tira de la mancuerna hacia tu cadera mientras mantienes la espalda recta. Cambia de lado después de completar las repeticiones. Respiración: Inhala al bajar, exhala al subir. Evita: Girar el torso o dejar caer el pecho.", "nombre": "Remo con Mancuerna en Posición de Cuadrupedia", "patron": "tracción", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha con manos debajo de los hombros. Movimiento: Levanta una mano hacia adelante, manteniendo la estabilidad del cuerpo, alterna brazos. Respiración: Respira normalmente. Evita: Mover las caderas hacia arriba o hacia abajo.", "nombre": "Plancha con Elevación de Brazo Alterno", "patron": "estabilidad", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}]}
21	10	41	2025-08-17 23:54:57.532277+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Sostén la barra con un agarre ligeramente más ancho que los hombros. Mantén la espalda recta y las piernas ligeramente flexionadas. Movimiento: Baja la barra siguiendo la línea de tus piernas, manteniendo la cadera atrás. Respira: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o caer en la flexión de las rodillas.", "nombre": "Peso Muerto Rumano con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Acostado en el banco, sujeta una mancuerna en cada mano a la altura del pecho. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén extendidos. Respira: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda y dejar caer las mancuernas hacia los hombros.", "nombre": "Press de Banca con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Agárrate a la barra con un agarre pronado, asegurando el peso adicional en un cinturón. Movimiento: Sube hasta que la barbilla sobrepase la barra. Respira: Inhala al bajar, exhala al subir. Evita: Balancear las piernas y dejar caer los hombros.", "nombre": "Dominadas con Lastre", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 6}, {"tipo": "reps", "notas": "Posición inicial: Sentado en la máquina, coloca los pies en la plataforma a la altura de los hombros. Movimiento: Baja la plataforma flexionando las rodillas, manteniendo la espalda contra el respaldo. Respira: Inhala al bajar, exhala al subir. Evita: Levantar los talones o dejar que las rodillas se desvíen hacia adentro.", "nombre": "Prensa de Piernas", "patron": "bisagra_cadera", "series": 4, "implemento": "maquina", "descanso_seg": 90, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Coloca una barra sobre tu espalda, pies a la altura de los hombros. Movimiento: Eleva los talones con control y baja lentamente. Respira: Inhala al bajar, exhala al subir. Evita: Dejar caer el peso o no realizar el movimiento de manera controlada.", "nombre": "Elevación de Talones con Barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 15}]}
22	10	42	2025-08-18 00:22:37.875568+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies a la altura de los hombros. Movimiento: Flexiona las rodillas para caer en una posición de cuclillas, coloca las manos en el suelo, salta hacia atrás hasta una posición de plancha, realiza una flexión de brazos y salta de regreso a la cuclilla, finalizando con un salto vertical. Respiración: Exhala al saltar y al hacer la flexión. Evita: No arquees la espalda en la posición de plancha.", "nombre": "Burpees", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 20, "duracion_seg": 40}, {"tipo": "tiempo", "notas": "Posición inicial: En cuclillas, mantén las rodillas flexionadas a 90 grados. Movimiento: Eleva los talones manteniendo la posición de cuclillas. Mantén la espalda recta. Respiración: Respira de forma controlada durante el ejercicio. Evita: No dejar que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla Isométrica con Elevación de Talones", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta con las manos directamente debajo de los hombros. Movimiento: Lleva una rodilla hacia el pecho, vuelve a la posición inicial y alterna rápidamente con la otra rodilla. Respiración: Exhala al acercar la rodilla, inhala al volver a la posición de plancha. Evita: No dejes caer las caderas ni arquees la espalda.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, brazos extendidos, manos a la altura de los hombros. Movimiento: Realiza una flexión normal y al subir, gira el torso hacia un lado levantando un brazo hacia el techo. Alterna lados. Respiración: Inhala al bajar, exhala al subir y girar. Evita: No arquees la espalda ni bajes demasiado las caderas.", "nombre": "Flexiones de Brazo con Rotación", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}]}
23	10	43	2025-08-18 16:34:44.523622+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos en el pecho. Pies a la anchura de los hombros. Movimiento: Desciende en sentadilla y al subir, eleva la mancuerna por encima de la cabeza. Respiración: Inhala al bajar, exhala al elevar. Evita: Que tus rodillas sobrepasen la punta de los pies.", "nombre": "Sentadilla con Mancuerna y Elevación", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Ancla la banda elástica a un punto bajo y sostén los extremos. Acuéstate boca arriba y tira de la banda hacia tu pecho mientras mantienes el cuerpo en línea recta. Movimiento: Tira de la banda hacia ti manteniendo los codos pegados al cuerpo. Respiración: Inhala al bajar, exhala al tirar. Evita: Arqueo de espalda y movimientos bruscos.", "nombre": "Remo Invertido con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 30, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados. Pies a la altura de los hombros. Movimiento: Da un paso adelante flexionando ambas rodillas y vuelve a la posición inicial. Alterna las piernas. Respiración: Inhala al descender, exhala al volver. Evita: Que la rodilla que avanza sobrepase la punta del pie.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 30, "repeticiones": 10}, {"tipo": "segundos", "notas": "Posición inicial: Colócate en posición de plancha con los codos alineados con los hombros. Movimiento: Rota suavemente el torso hacia un lado mientras levantas el brazo contrario. Alterna lados. Respiración: Mantén la respiración controlada. Evita: Que las caderas se hundan o eleven demasiado.", "nombre": "Plancha Estática con Rotación", "patron": "estabilización", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}]}
24	10	44	2025-08-18 16:52:41.308584+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "timed", "notas": "Posición inicial: Pies a la altura de los hombros, con la mancuerna entre las piernas. Movimiento: Flexiona ligeramente las rodillas, inclina la cadera hacia atrás y coloca la mancuerna detrás de ti. Luego, con un movimiento explosivo, lleva la mancuerna hacia adelante y arriba, utilizando la cadera y no la espalda. Respiración: Inhala al bajar, exhala al subir. Evita: Utilizar la espalda para el movimiento y que las rodillas sobrepasen los dedos de los pies.", "nombre": "Swing con Mancuerna", "patron": "bisagra_cadera", "series": 5, "implemento": "mancuernas", "descanso_seg": 20, "duracion_seg": 40}, {"tipo": "timed", "notas": "Posición inicial: Apóyate en las manos y rodillas, con las manos a la altura de los hombros. Movimiento: Baja el pecho hacia el suelo manteniendo los codos cerca del cuerpo y luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o archivar la espalda.", "nombre": "Flexiones de Brazo con Apoyo de Rodillas", "patron": "empuje", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}, {"tipo": "timed", "notas": "Posición inicial: Pisa la banda elástica con ambos pies y toma los extremos con las manos. Movimiento: Tira de la banda hacia ti, manteniendo los codos altos y cerca del cuerpo. Respiración: Inhala al tensar la banda, exhala al soltar. Evita: Encoger los hombros o arquear la espalda.", "nombre": "Remo con Banda Elástica", "patron": "tracción", "series": 5, "implemento": "bandas_elasticas", "descanso_seg": 20, "duracion_seg": 40}, {"tipo": "timed", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta y abre las piernas al mismo tiempo que levantas los brazos por encima de la cabeza, luego regresa a la posición inicial. Respiración: Mantén una respiración constante. Evita: Aterrizar ruidosamente; busca suavidad en el aterrizaje.", "nombre": "Salto de Tijera", "patron": "funcional", "series": 5, "implemento": "peso_corporal", "descanso_seg": 15, "duracion_seg": 30}]}
25	10	45	2025-08-18 16:57:58.472249+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Coloca la barra en la parte frontal de tus hombros, pies a la anchura de los hombros. Movimiento: Flexiona las rodillas y caderas, manteniendo el torso erguido, hasta que los muslos estén paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que la barra se desplace hacia adelante o que las rodillas sobrepasen la línea de los pies.", "nombre": "Sentadilla Frontal con Barra", "patron": "sentadilla", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: De pie, con la barra en las manos frente a los muslos. Mantén los pies a la anchura de los hombros. Movimiento: Consta de una bisagra de cadera, desciende la barra manteniendo la espalda recta y las piernas semi-flexionadas, hasta sentir un estiramiento en los isquiotibiales. Respiración: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o dejar caer la barra hacia abajo sin control.", "nombre": "Peso Muerto Rumano con Barra", "patron": "bisagra_cadera", "series": 4, "implemento": "barra", "descanso_seg": 90, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Siéntate en un banco con respaldo, sostén las mancuernas a la altura de los hombros. Movimiento: Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos. Respiración: Inhala al bajar, exhala al subir. Evita: No arquear la espalda y asegura que las muñecas estén alineadas.", "nombre": "Press Militar con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Cuélgate de la barra con las palmas hacia adelante, manos a la anchura de los hombros. Movimiento: Tira de tu cuerpo hacia arriba hasta que tu barbilla esté por encima de la barra. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte y no descender completamente al final del movimiento.", "nombre": "Dominadas con Peso", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 6}, {"tipo": "reps", "notas": "Posición inicial: Sostente en las paralelas, brazos extendidos. Movimiento: Baja el cuerpo flexionando los codos y lleva los hombros hacia adelante, sube de nuevo. Respiración: Inhala al bajar, exhala al subir. Evita: Que los hombros se eleven hacia las orejas y no olvides mantener el core contraído.", "nombre": "Fondos con Peso en Paralelas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 8}]}
26	10	46	2025-08-18 17:19:49.767517+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna con ambas manos en el pecho. Pies a la anchura de los hombros. Movimiento: Desciende flexionando las rodillas, manteniendo el torso erguido, hasta que los muslos estén paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desplacen hacia adelante de los dedos de los pies.", "nombre": "Sentadilla con Mancuerna", "patron": "sentadilla", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba con una mancuerna en cada mano, brazos extendidos hacia arriba. Movimiento: Baja las mancuernas hacia los lados, flexionando los codos, y luego empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda baja.", "nombre": "Press de Pecho en Suelo con Mancuernas", "patron": "empuje", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Inclínate hacia adelante desde las caderas, sosteniendo una mancuerna en cada mano, brazos extendidos. Movimiento: Tira de las mancuernas hacia el abdomen, manteniendo los codos cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Girar el torso durante el movimiento.", "nombre": "Remo Inclinado con Mancuerna", "patron": "tracción", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, pies apoyados en el suelo a la altura de las rodillas, brazos a los lados. Movimiento: Levanta las caderas apretando los glúteos hasta formar una línea recta de las rodillas a los hombros. Respiración: Inhala al bajar, exhala al subir. Evita: No empujar con la espalda baja.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}]}
27	10	47	2025-08-18 17:26:09.909769+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Sostén la barra a la altura de los hombros, con los pies a la anchura de los hombros. Movimiento: Realiza una sentadilla profunda y, al levantarte, empuja la barra hacia arriba, extendiendo completamente los brazos. Respiración: Inhala al bajar, exhala al subir. Evita: Caer hacia adelante o que la barra se desplace de su posición inicial.", "nombre": "Thruster con Barra", "patron": "empuje", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados, pies juntos. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla de atrás hacia el suelo, vuelve a la posición inicial y cambia de pierna. Respiración: Inhala al bajar, exhala al volver a la posición inicial. Evita: Que la rodilla de la pierna adelante sobrepase el tobillo.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: De pie, con los pies a la anchura de los hombros, sosteniendo una kettlebell con ambas manos. Movimiento: Flexiona las caderas y baja la kettlebell entre las piernas, luego, con un movimiento explosivo, eleva la kettlebell hasta la altura de los ojos. Respiración: Inhala al bajar, exhala al elevar. Evita: Usar los brazos para levantar la kettlebell, el movimiento debe venir de las caderas.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebell", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha, con las manos bajo los hombros. Movimiento: Gira el tronco hacia un lado, levantando el brazo del lado opuesto hacia el techo y regresa a la posición de plancha. Respiración: Inhala en la posición inicial, exhala al elevar el brazo. Evita: Dejar caer la cadera o mantener los pies demasiado juntos.", "nombre": "Plancha con Rotación", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 10}]}
28	10	50	2025-08-18 18:14:27.152295+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros y brazos extendidos al frente. Movimiento: Baja a una sentadilla profunda y al subir, impulsa tu cuerpo hacia arriba en un salto. Aterriza suavemente volviendo a la posición inicial. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con las rodillas inestables o encorvar la espalda al aterrizar.", "nombre": "Sentadilla con Salto", "patron": "sentadilla", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: En posición de plancha, manos bajo los hombros, cuerpo en línea recta. Movimiento: Realiza una flexión de brazos y al subir, lleva una rodilla hacia el pecho. Alterna las piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o elevar demasiado el trasero.", "nombre": "Flexiones de Brazo con Patada", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda, pies apoyados en el suelo y rodillas flexionadas. Movimiento: Eleva la cadera hacia el techo apretando los glúteos y, alternando, levanta una pierna manteniéndola extendida. Respiración: Inhala al bajar, exhala al elevar. Evita: Hacer el movimiento rápido o dejar caer las caderas al bajar.", "nombre": "Puente de Glúteos con Elevación Alterna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda con las manos debajo de los glúteos. Movimiento: Eleva las piernas juntas hacia el techo y luego bájalas alternando un pie hacia el suelo sin tocarlo. Respiración: Inhala al bajar, exhala al subir. Evita: Levantar la cabeza o arquear la espalda baja.", "nombre": "Tijeras en el Suelo", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con el cuerpo en línea recta. Movimiento: Lleva una rodilla hacia el pecho y alterna rápidamente las piernas como si estuvieras corriendo. Respiración: Mantén una respiración constante y fluida. Evita: Mover las caderas hacia arriba o hacia abajo.", "nombre": "Escalador", "patron": "tracción", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
29	10	51	2025-08-18 18:56:25.193972+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros. Movimiento: Realiza una sentadilla normal, manteniendo el pecho erguido. Al subir, eleva los talones del suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepasen la línea de los dedos de los pies.", "nombre": "Sentadilla con Elevación de Talones", "patron": "sentadilla", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Coloca las manos en el borde de la silla a la altura del pecho, pies en el suelo. Movimiento: Flexiona los codos, llevando el pecho hacia la silla, manteniendo el cuerpo en línea recta. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o subirlas demasiado.", "nombre": "Flexiones de Brazo en Silla", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Pies juntos. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla de la otra pierna casi hasta el suelo. Mantén el torso erguido. Respiración: Inhala al dar el paso, exhala al volver. Evita: Que la rodilla delantera sobrepase los dedos del pie.", "nombre": "Zancadas Alternas", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca tus antebrazos sobre la toalla en el suelo y extiende las piernas hacia atrás. Movimiento: Mantén el cuerpo en línea recta desde los talones hasta la cabeza. Respiración: Respira de manera controlada. Evita: Que las caderas se hundan o se eleven demasiado.", "nombre": "Plancha con Toalla", "patron": "isometría", "series": 3, "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}]}
30	10	52	2025-08-18 20:29:34.878126+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Acostado sobre tu espalda, con las rodillas flexionadas y los pies apoyados en el suelo. Eleva una pierna manteniéndola recta. Movimiento: Levanta la cadera hacia el techo mientras elevas la pierna, asegurándote de contraer los glúteos. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueos en la espalda baja o que el pie apoyado se deslice.", "nombre": "Puente de Glúteos con Elevación de Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una pared, coloca tus manos en la pared a la altura de los hombros. Movimiento: Flexiona los codos para acercar el pecho a la pared, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar. Evita: Dejar caer la cabeza o arquear la espalda.", "nombre": "Flexiones de Brazo en Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta abriendo las piernas y elevando los brazos por encima de la cabeza, regresa a la posición inicial. Respiración: Exhala al saltar, inhala al regresar. Evita: Aterrizar con los pies rígidos o inclinarte hacia adelante.", "nombre": "Saltos de Tijera", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, con los pies a la altura de los hombros. Movimiento: Sube un pie a la silla y empuja con esa pierna para elevar todo tu cuerpo, luego baja y repite con la otra pierna. Respiración: Exhala al subir, inhala al bajar. Evita: Saltar con los pies o usar solo la parte baja de la espalda.", "nombre": "Subida a Silla/Sofá", "patron": "tracción", "series": 4, "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}]}
31	10	54	2025-08-18 21:19:36.402386+02	\N	268	1	4	25.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros. Movimiento: Baja a una posición de cuclillas, coloca las manos en el suelo y salta hacia atrás a una posición de plancha, luego regresa a la cuclilla y salta hacia arriba. Respiración: Inhala al bajar y exhala al saltar. Evita: Hiperventilar o perder la postura en la plancha.", "nombre": "Burpees Modificados", "patron": "funcional", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}, {"tipo": "intervalo", "notas": "Posición inicial: En posición de flexión, con rodillas en el suelo. Movimiento: Baja el pecho hacia el suelo flexionando los codos, manteniendo la alineación del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas y archivar la espalda.", "nombre": "Flexiones de Brazos con Rodillas Apoyadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}, {"tipo": "intervalo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus muslos, justo encima de las rodillas. Movimiento: Baja en una sentadilla, empujando las rodillas hacia afuera para resistir la banda. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se cierren hacia adentro.", "nombre": "Sentadilla con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_trabajo_seg": 30}, {"tipo": "intervalo", "notas": "Posición inicial: En posición de plancha alta. Movimiento: Lleva una rodilla hacia el pecho mientras mantienes el torso firme y alterna. Respiración: Exhala al acercar la rodilla, inhala al regresar. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Mountain Climbers", "patron": "tracción", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_trabajo_seg": 30}]}
32	10	55	2025-08-18 21:31:18.396552+02	\N	268	1	4	25.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Coloca una silla detrás de ti, pies a la altura de los hombros. Movimiento: Baja controladamente hacia la silla, manteniendo el pecho erguido y las rodillas alineadas con los pies. Al llegar al borde de la silla, regresa a la posición inicial. Respiración: Inhala al bajar, exhala al levantar. Evita: No dejar que las rodillas se desvíen hacia adentro.", "nombre": "Sentadilla en Silla", "patron": "sentadilla", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: De pie frente a una pared, coloca las manos al ancho de los hombros sobre la pared. Movimiento: Flexiona los codos llevando el pecho hacia la pared y empuja de regreso a la posición inicial. Respiración: Inhala al bajar, exhala al subir. Evita: No arquear la espalda ni permitir que las caderas se desplacen hacia adelante.", "nombre": "Flexiones de Brazos en Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Apóyate en la parte posterior de una silla con las manos, pies a la altura de los hombros. Movimiento: Eleva los talones del suelo manteniendo la posición. Aprieta los gemelos en la parte superior y regresa a la posición inicial. Respiración: Exhala al elevar, inhala al bajar. Evita: No dejar caer la cadera hacia atrás.", "nombre": "Elevaciones de Talón en Silla", "patron": "bisagra_cadera", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado con una rodilla apoyada en el suelo, el codo directamente debajo del hombro. Movimiento: Levanta las caderas manteniendo el cuerpo en línea recta desde la cabeza hasta la rodilla apoyada. Mantén la posición. Respiración: Respira normalmente, evita contener el aliento. Evita: No dejar caer las caderas ni torcer el torso.", "nombre": "Plancha Lateral con Rodilla Apoyada", "patron": "estabilidad", "series": 3, "implemento": "peso_corporal", "descanso_seg": 60, "duracion_seg": 30}]}
33	10	56	2025-08-18 22:38:07.463838+02	\N	268	2	4	50.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Coloca tus manos en el borde del sofá con los pies en el suelo, cuerpo recto. Movimiento: Flexiona los codos bajando el pecho hacia el sofá y empuja hacia arriba. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Flexiones de Brazos Invertidas en Sofa", "patron": "empuje", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Acostado boca arriba, rodillas flexionadas y pies apoyados en el suelo. Movimiento: Eleva las caderas apretando los glúteos hasta que tu cuerpo forme una línea recta desde los hombros hasta las rodillas. Respiración: Inhala al bajar, exhala al elevar. Evita: Arqueo excesivo en la zona lumbar.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Ata una toalla en una puerta o un lugar seguro, sujeta los extremos. Movimiento: Inclínate hacia atrás y jala con tus brazos hacia tu pecho. Respiración: Inhala al bajar, exhala al subir. Evita: Encoger los hombros o usar el impulso.", "nombre": "Remo Invertido con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: De pie frente a una silla, pies al ancho de los hombros. Movimiento: Baja las caderas hacia atrás como si fueras a sentarte, detente justo antes de tocar la silla, luego sube. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas sobrepasen los dedos de los pies.", "nombre": "Sentadilla a Silla", "patron": "sentadilla", "series": 4, "implemento": "silla_sofa", "descanso_seg": 60, "repeticiones": 12}]}
34	10	61	2025-08-19 08:07:50.361006+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Baja en una sentadilla y salta explosivamente hacia arriba. Aterriza suave y regresa a la posición de sentadilla. Respiración: Inhala al bajar, exhala al saltar. Evita: Rodillas hacia adentro al aterrizar.", "nombre": "Saltos de Sentadilla", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En pie, sostén una toalla con ambos brazos extendidos hacia adelante. Movimiento: Da un paso hacia adelante, baja la rodilla trasera hacia el suelo y regresa. Alterna piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Que la rodilla delantera sobrepase el tobillo.", "nombre": "Desplantes Alternos Con Toalla", "patron": "bisagra_cadera", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, cuerpo recto. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente. Respiración: Exhala al llevar la rodilla hacia adelante. Evita: Caderas que suben o bajan, mantén el cuerpo recto.", "nombre": "Escaladores de Montaña", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, sostente de ella. Movimiento: Eleva los talones para quedar de puntillas y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte, mantén el control del movimiento.", "nombre": "Elevaciones de Talones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}]}
35	10	61	2025-08-19 08:07:53.31171+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Baja en una sentadilla y salta explosivamente hacia arriba. Aterriza suave y regresa a la posición de sentadilla. Respiración: Inhala al bajar, exhala al saltar. Evita: Rodillas hacia adentro al aterrizar.", "nombre": "Saltos de Sentadilla", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En pie, sostén una toalla con ambos brazos extendidos hacia adelante. Movimiento: Da un paso hacia adelante, baja la rodilla trasera hacia el suelo y regresa. Alterna piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Que la rodilla delantera sobrepase el tobillo.", "nombre": "Desplantes Alternos Con Toalla", "patron": "bisagra_cadera", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, cuerpo recto. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente. Respiración: Exhala al llevar la rodilla hacia adelante. Evita: Caderas que suben o bajan, mantén el cuerpo recto.", "nombre": "Escaladores de Montaña", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, sostente de ella. Movimiento: Eleva los talones para quedar de puntillas y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte, mantén el control del movimiento.", "nombre": "Elevaciones de Talones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}]}
36	10	61	2025-08-19 08:07:55.796827+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Baja en una sentadilla y salta explosivamente hacia arriba. Aterriza suave y regresa a la posición de sentadilla. Respiración: Inhala al bajar, exhala al saltar. Evita: Rodillas hacia adentro al aterrizar.", "nombre": "Saltos de Sentadilla", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En pie, sostén una toalla con ambos brazos extendidos hacia adelante. Movimiento: Da un paso hacia adelante, baja la rodilla trasera hacia el suelo y regresa. Alterna piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Que la rodilla delantera sobrepase el tobillo.", "nombre": "Desplantes Alternos Con Toalla", "patron": "bisagra_cadera", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, cuerpo recto. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente. Respiración: Exhala al llevar la rodilla hacia adelante. Evita: Caderas que suben o bajan, mantén el cuerpo recto.", "nombre": "Escaladores de Montaña", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, sostente de ella. Movimiento: Eleva los talones para quedar de puntillas y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte, mantén el control del movimiento.", "nombre": "Elevaciones de Talones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}]}
37	10	61	2025-08-19 08:16:23.560318+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Pies a la anchura de los hombros. Movimiento: Baja en una sentadilla y salta explosivamente hacia arriba. Aterriza suave y regresa a la posición de sentadilla. Respiración: Inhala al bajar, exhala al saltar. Evita: Rodillas hacia adentro al aterrizar.", "nombre": "Saltos de Sentadilla", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En pie, sostén una toalla con ambos brazos extendidos hacia adelante. Movimiento: Da un paso hacia adelante, baja la rodilla trasera hacia el suelo y regresa. Alterna piernas. Respiración: Inhala al bajar, exhala al subir. Evita: Que la rodilla delantera sobrepase el tobillo.", "nombre": "Desplantes Alternos Con Toalla", "patron": "bisagra_cadera", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, cuerpo recto. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente. Respiración: Exhala al llevar la rodilla hacia adelante. Evita: Caderas que suben o bajan, mantén el cuerpo recto.", "nombre": "Escaladores de Montaña", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie frente a una silla, sostente de ella. Movimiento: Eleva los talones para quedar de puntillas y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Balancearte, mantén el control del movimiento.", "nombre": "Elevaciones de Talones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}]}
38	10	62	2025-08-19 08:24:44.65635+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Apóyate contra la pared con la espalda recta y los pies un poco separados. Movimiento: Desciende como si fueras a sentarte en una silla imaginaria, manteniendo los muslos paralelos al suelo. Respiración: Mantén la respiración controlada. Evita: No dejar que las rodillas se desplacen hacia adelante de los pies.", "nombre": "Sentadilla Isométrica contra la Pared", "patron": "sentadilla", "implemento": "pared", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Coloca las manos en la pared a la altura de los hombros y separadas al ancho de los hombros. Movimiento: Flexiona los codos bajando el pecho hacia la pared y empuja hacia atrás. Respiración: Inhala al bajar, exhala al subir. Evita: No curvar la espalda ni dejar que los hombros se tensen.", "nombre": "Flexiones de Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla en el suelo y pisa sobre ella con los dedos de los pies. Movimiento: Eleva los talones del suelo, manteniendo el equilibrio y contrayendo los gemelos. Respiración: Exhala al subir, inhala al bajar. Evita: No dejes que los pies se deslicen de la toalla.", "nombre": "Elevación de Talones con Toalla", "patron": "bisagra_cadera", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Toma una toalla con ambas manos y da un paso atrás manteniéndola tensa. Movimiento: Tira de la toalla hacia tu pecho, manteniendo los codos cerca del cuerpo. Respiración: Exhala al tirar, inhala al soltar. Evita: No redondear la espalda ni dejar caer los hombros.", "nombre": "Remo Inclinado con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}]}
39	10	62	2025-08-19 08:24:46.525369+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Apóyate contra la pared con la espalda recta y los pies un poco separados. Movimiento: Desciende como si fueras a sentarte en una silla imaginaria, manteniendo los muslos paralelos al suelo. Respiración: Mantén la respiración controlada. Evita: No dejar que las rodillas se desplacen hacia adelante de los pies.", "nombre": "Sentadilla Isométrica contra la Pared", "patron": "sentadilla", "implemento": "pared", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Coloca las manos en la pared a la altura de los hombros y separadas al ancho de los hombros. Movimiento: Flexiona los codos bajando el pecho hacia la pared y empuja hacia atrás. Respiración: Inhala al bajar, exhala al subir. Evita: No curvar la espalda ni dejar que los hombros se tensen.", "nombre": "Flexiones de Pared", "patron": "empuje", "series": 4, "implemento": "pared", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Coloca una toalla en el suelo y pisa sobre ella con los dedos de los pies. Movimiento: Eleva los talones del suelo, manteniendo el equilibrio y contrayendo los gemelos. Respiración: Exhala al subir, inhala al bajar. Evita: No dejes que los pies se deslicen de la toalla.", "nombre": "Elevación de Talones con Toalla", "patron": "bisagra_cadera", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 15}, {"tipo": "reps", "notas": "Posición inicial: Toma una toalla con ambas manos y da un paso atrás manteniéndola tensa. Movimiento: Tira de la toalla hacia tu pecho, manteniendo los codos cerca del cuerpo. Respiración: Exhala al tirar, inhala al soltar. Evita: No redondear la espalda ni dejar caer los hombros.", "nombre": "Remo Inclinado con Toalla", "patron": "tracción", "series": 4, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}]}
40	10	63	2025-08-19 08:26:46.782479+02	2025-08-19 08:40:01.932375+02	830	5	5	100.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: De pie, sostén una mancuerna en cada mano a la altura de los hombros. Pies a la altura de los hombros. Movimiento: Eleva las mancuernas por encima de la cabeza hasta que tus brazos estén completamente extendidos. Asegúrate de que tus muñecas estén rectas y tus codos cerca del cuerpo al bajarlas. Respiración: Inhala al bajar y exhala al subir. Evita: Arqueo en la espalda baja y que los brazos se separen demasiado del cuerpo.", "nombre": "Press de Hombro con Mancuernas", "patron": "empuje", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Fija la banda elástica a un objeto estable a la altura del pecho. Sujetar los extremos con ambas manos. Movimiento: Tira de la banda hacia tu torso, manteniendo los codos cerca del cuerpo. Regresa con control. Respiración: Inhala al extender y exhala al tirar. Evita: Inclinarte hacia atrás o usar impulso.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Sostén una mancuerna en cada mano a los lados del cuerpo, pies a la altura de los hombros. Movimiento: Desciende como si fueras a sentarte, manteniendo el pecho erguido y el peso en los talones. Regresa a la posición inicial. Respiración: Inhala al bajar y exhala al subir. Evita: Que las rodillas sobrepasen los dedos de los pies y mantener la espalda recta.", "nombre": "Sentadilla con Mancuernas", "patron": "sentadilla", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha, con las manos debajo de los hombros y el cuerpo en línea recta. Movimiento: Alterna levantar cada mano hacia el hombro opuesto, manteniendo el cuerpo estable. Respiración: Mantén la respiración constante y acompaña el movimiento. Evita: Derrapar las caderas o perder la alineación del cuerpo.", "nombre": "Plancha Dinámica", "patron": "isometría", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "reps", "notas": "Posición inicial: Acostado sobre la espalda con las rodillas flexionadas y los pies en el suelo, coloca una banda elástica alrededor de los muslos. Movimiento: Eleva las caderas hacia el techo, apretando los glúteos, y vuelve a la posición inicial. Respiración: Inhala al bajar y exhala al subir. Evita: Que los pies se deslicen o que la espalda se arquee excesivamente.", "nombre": "Elevación de Caderas con Banda Elástica", "patron": "bisagra_cadera", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 60, "repeticiones": 15}]}
41	10	64	2025-08-19 08:58:42.600418+02	\N	\N	0	4	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos sobre el borde de la silla, con los brazos extendidos y el cuerpo en línea recta. Movimiento: Flexiona los codos para bajar el torso hacia la silla, manteniendo el cuerpo recto y los pies apoyados en el suelo. Respiración: Inhala al bajar y exhala al empujar de vuelta. Evita: Dejar caer las caderas o curvar la espalda.", "nombre": "Flexiones en Silla", "patron": "empuje", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies juntos. Movimiento: Salta abriendo las piernas y levantando los brazos por encima de la cabeza, luego salta y regresa a la posición inicial. Respiración: Respira de forma constante, mantén el ritmo. Evita: Golpear el suelo al aterrizar.", "nombre": "Saltos de Tijera", "patron": "funcional", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies al ancho de los hombros. Movimiento: Da un paso adelante y baja en un desplante, gira el torso hacia la pierna delantera. Regresa a la posición inicial y alterna. Respiración: Inhala al bajar, exhala al regresar. Evita: Que la rodilla delantera sobrepase el pie.", "nombre": "Desplantes con Rotación", "patron": "bisagra_cadera", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca una toalla en el suelo, siéntate en ella y apoya las manos detrás. Movimiento: Levanta las rodillas hacia el pecho y vuelve a la posición inicial, manteniendo el control. Respiración: Inhala al bajar y exhala al subir. Evita: Invertir la espalda o perder el equilibrio.", "nombre": "Rodillas al Pecho con Toalla", "patron": "funcional", "implemento": "toallas", "descanso_seg": 45, "duracion_seg": 30}]}
42	10	66	2025-08-19 09:23:28.815813+02	2025-08-19 09:27:46.369139+02	232	4	4	100.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca los pies sobre la silla y las manos en el suelo a la altura de los hombros. Movimiento: Baja el cuerpo manteniendo una línea recta desde la cabeza hasta los pies, evitando que la cadera se hunda. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o elevar demasiado la pelvis.", "nombre": "Flexiones de Brazos con Pies Elevados en Silla", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Apóyate en la pared con la espalda recta, pies al ancho de los hombros y a un paso de la pared. Movimiento: Desciende como si te fueras a sentar, manteniendo la espalda recta, hasta que tus muslos queden paralelos al suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Despegar la espalda de la pared.", "nombre": "Sentadilla a la Pared", "patron": "bisagra_cadera", "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha con las manos en el suelo. Movimiento: Lleva las rodillas hacia el pecho alternando rápidamente, manteniendo la posición de plancha. Respiración: Exhala al llevar la rodilla hacia adelante, inhala al volver. Evita: Hacerlo con la cadera elevada o dejar caer las caderas.", "nombre": "Escaladores (sin salto)", "patron": "tracción", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie, con los pies a la altura de los hombros. Movimiento: Agáchate, coloca las manos en el suelo, camina hacia atrás a posición de plancha, regresa a la posición agachada y levántate. Respiración: Inhala al agacharte, exhala al levantarte. Evita: Hacer movimientos bruscos o perder el equilibrio al levantarte.", "nombre": "Burpees sin Salto", "patron": "empuje", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
43	10	67	2025-08-19 10:05:10.023349+02	\N	534	3	5	60.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: De pie frente al banco step, con los pies a la altura de los hombros. Movimiento: Salta con ambos pies al banco y aterriza suavemente. Mantén el core contraído. Respiración: Exhala al saltar e inhala al bajar. Evita: Aterrizar con las rodillas bloqueadas.", "nombre": "Saltos en Banco Step", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Sentado en el suelo con las piernas extendidas, sujeta la banda elástica con ambas manos. Movimiento: Tira de la banda hacia tu abdomen, manteniendo la espalda recta y los codos pegados al cuerpo. Respiración: Inhala al soltar, exhala al tirar. Evita: Arqueamiento de la espalda.", "nombre": "Remo con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de flexión con las rodillas en el suelo, manos a la altura de los hombros. Movimiento: Baja el pecho hacia el suelo flexionando los codos y vuelve a subir. Mantén el cuerpo recto. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera.", "nombre": "Flexiones de Brazos con Rodillas Apoyadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de los muslos, pies a la altura de los hombros. Movimiento: Realiza una sentadilla manteniendo la tensión en la banda, asegurándote de que las rodillas no sobrepasen los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desplacen hacia adentro.", "nombre": "Sentadilla Isla con Bandas Elásticas", "patron": "sentadilla", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acuéstate de lado con los pies apilados y apoyando el antebrazo en el suelo. Movimiento: Levanta las caderas formando una línea recta y realiza giros hacia el frente y de regreso. Respiración: Mantén una respiración controlada. Evita: Que las caderas se caigan.", "nombre": "Plancha Lateral Dinámica", "patron": "estabilización", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
46	10	71	2025-08-19 11:59:37.019801+02	2025-08-19 12:17:11.246264+02	476	4	4	100.00	in_progress	{"exercises": [{"tipo": "time", "notas": "Posición inicial: Manos apoyadas en el banco, cuerpo en línea recta. Movimiento: Realiza una flexión de brazos llevando el pecho hacia el banco y empuja hacia arriba. Variación: Usa una escalera o un objeto estable para variar la altura y aumentar la dificultad. Respiración: Inhala al bajar, exhala al subir. Evita: Que las caderas se hundan o se eleven excesivamente.", "nombre": "Push-Up a Escalera", "patron": "empuje", "implemento": "banco_step", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "time", "notas": "Posición inicial: De pie, sosteniendo una mancuerna en cada mano, pies al ancho de los hombros. Movimiento: Da un paso hacia adelante con una pierna, bajando la rodilla trasera hacia el suelo, mantén el torso erguido. Alterna piernas. Respiración: Inhala al bajar, exhala al empujar hacia arriba. Evita: Que la rodilla delantera sobrepase los dedos del pie.", "nombre": "Zancadas Alternas con Mancuernas", "patron": "bisagra_cadera", "implemento": "mancuernas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "time", "notas": "Posición inicial: Sienta la banda elástica bajo tus pies, sosteniendo los extremos con ambas manos, espalda recta. Movimiento: Tira de la banda hacia tu pecho, manteniendo los codos arriba. Controla el movimiento al soltar. Respiración: Inhala al tirar, exhala al soltar. Evita: Inclinar el torso hacia atrás al tirar.", "nombre": "Remo Alto con Banda Elástica", "patron": "tracción", "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "time", "notas": "Posición inicial: Manos sobre el banco, cuerpo en línea recta desde los pies hasta la cabeza. Movimiento: Alterna llevando las rodillas hacia tu pecho a velocidad controlada. Respiración: Exhala al llevar la rodilla hacia adelante, inhala al regresar. Evita: Que las caderas se elevan o caen.", "nombre": "Mountain Climbers en Banco", "patron": "cardio", "implemento": "banco_step", "descanso_seg": 45, "duracion_seg": 30}]}
44	10	69	2025-08-19 11:31:08.825119+02	\N	534	3	4	75.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca tus manos sobre el banco step, asegurando que tus pies estén en el suelo. Cuerpo recto. Movimiento: Baja el cuerpo hasta que el pecho toque el banco, manteniendo el core apretado. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer las caderas o levantar las nalgas.", "nombre": "Flexiones de Brazos con Manos Elevadas", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Pisa la banda elástica con ambos pies y sujeta los extremos con las manos. Inclina ligeramente el torso hacia adelante. Movimiento: Tira de las bandas hacia tu abdomen, apretando los omóplatos. Respiración: Inhala al estirar, exhala al juntar. Evita: Curvar la espalda o usar impulso.", "nombre": "Remo Inclinado con Bandas Elásticas", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate en el borde de un escalón con los talones colgando. Movimiento: Eleva los talones lo más alto posible, aprieta los gemelos y baja lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer los talones demasiado rápido.", "nombre": "Elevaciones de Pantorrillas en Escalón", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate en posición de plancha alta con las manos bajo los hombros. Cuerpo recto. Movimiento: Toca un hombro con la mano opuesta, alternando. Respiración: Mantén una respiración uniforme. Evita: Girar las caderas o bajar la cadera.", "nombre": "Plancha con Toque de Hombro", "patron": "estabilidad", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
45	10	70	2025-08-19 11:54:39.845362+02	\N	0	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Agárrate a la barra con las manos un poco más anchas que los hombros. Mantén el cuerpo recto y los pies cruzados detrás de ti. Movimiento: Tira de tu cuerpo hacia arriba hasta que la barbilla supere la barra, concentrándote en activar la espalda. Respiración: Exhala al subir, inhala al bajar. Evita: Balancearte o usar impulso.", "nombre": "Dominadas con Peso", "patron": "tracción", "series": 4, "implemento": "barra_dominadas", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, kettlebell entre tus pies. Agáchate y sujeta el kettlebell con ambas manos. Movimiento: Desde una posición de bisagra de cadera, impulsa el kettlebell hacia adelante y hacia arriba, utilizando la potencia de tus caderas. Respiración: Exhala al elevar el kettlebell, inhala al regresar. Evita: Redondear la espalda o usar los brazos para levantar el peso.", "nombre": "Kettlebell Swing", "patron": "bisagra_cadera", "series": 4, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con los brazos extendidos y el cuerpo recto en diagonal. Movimiento: Tira de tus codos hacia atrás, llevando el pecho hacia las asas, manteniendo el cuerpo en línea recta. Respiración: Exhala al tirar, inhala al regresar. Evita: Dejar caer las caderas o arquear la espalda.", "nombre": "Remo TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Sosten el kettlebell en la mano del lado que vas a trabajar. Párate sobre una pierna. Movimiento: Baja el cuerpo hacia abajo mientras mantienes la otra pierna levantada. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar que la rodilla se desplace hacia adentro y no perder el equilibrio.", "nombre": "Sentadillas a una Pierna con Kettlebell", "patron": "bisagra_cadera", "series": 3, "implemento": "kettlebells", "descanso_seg": 60, "repeticiones": 8}]}
47	10	72	2025-08-19 12:53:42.233176+02	\N	224	1	4	25.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Posición inicial: Coloca tus manos en el banco con los brazos extendidos y el cuerpo en línea recta. Movimiento: Baja el pecho hacia el banco, manteniendo el cuerpo recto. Respiración: Inhala al bajar, exhala al empujar hacia arriba. Evita: Dejar caer las caderas o elevar demasiado el trasero.", "nombre": "Flexiones de Brazos con Manos en Banquito", "patron": "empuje", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}, {"tipo": "intervalo", "notas": "Posición inicial: De pie con los pies juntos y brazos a los lados. Movimiento: Salta abriendo las piernas y levantando los brazos sobre la cabeza, luego regresa. Respiración: Inhala al abrir, exhala al cerrar. Evita: Caer con ruido y perder el control al saltar.", "nombre": "Saltos de Tijera (Jumping Jacks)", "patron": "cardio", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}, {"tipo": "intervalo", "notas": "Posición inicial: Acostado boca arriba con rodillas flexionadas y pies en el suelo. Movimiento: Eleva las caderas hacia el techo apretando los glúteos y bajando lentamente. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo excesivo de la espalda baja y que los pies se deslicen.", "nombre": "Puente de Glúteos", "patron": "bisagra_cadera", "series": 5, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}, {"tipo": "intervalo", "notas": "Posición inicial: Coloca una banda elástica en el banco, sosteniéndola con ambas manos a la altura del pecho. Movimiento: Tira de la banda hacia el pecho, manteniendo el cuerpo recto. Respiración: Inhala al extender, exhala al jalar. Evita: Dejar caer los hombros o girar la cadera.", "nombre": "Remo Invertido con Banda Elástica en Banco", "patron": "tracción", "series": 5, "implemento": "bandas_elasticas", "descanso_seg": 45, "repeticiones": "30s trabajo, 15s descanso"}]}
49	10	74	2025-08-19 20:10:43.605819+02	\N	119	1	4	25.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: En posición de flexión, con las manos bajo los hombros. Movimiento: Al bajar, eleva una pierna hacia atrás. Varía las piernas en cada repetición. Respiración: Inhala al bajar, exhala al subir. Evita: Que la cadera caiga o se levante demasiado, mantén el cuerpo en línea recta.", "nombre": "Flexiones de Brazos con Elevación de Pierna", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba, una pierna elevada. Movimiento: Eleva las caderas apretando los glúteos y el abdomen. Alterna las piernas en cada serie. Respiración: Exhala al elevar las caderas, inhala al descender. Evita: Que tus hombros se levanten del suelo, manténlos apoyados.", "nombre": "Elevaciones de Cadera con una Pierna", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Sentado con las rodillas flexionadas y los pies en el suelo, sostén una mancuerna con ambas manos. Movimiento: Gira el torso hacia un lado, luego hacia el otro, manteniendo el abdomen contraído. Respiración: Exhala durante la torsión, inhala al volver al centro. Evita: Redondear la espalda, mantén una postura recta.", "nombre": "Russian Twists con Mancuerna", "patron": "rotación", "series": 4, "implemento": "mancuernas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba con las manos bajo los glúteos. Movimiento: Levanta las piernas rectas alternando hacia arriba y hacia abajo sin tocar el suelo. Respiración: Inhala al bajar, exhala al subir. Evita: Arqueo en la espalda baja, mantén el abdomen apretado.", "nombre": "Tijeras en el Suelo", "patron": "abdomen", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
48	10	73	2025-08-19 13:40:31.625414+02	\N	119	1	4	25.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Pies al ancho de los hombros. Movimiento: Realiza una sentadilla y al subir, salta explosivamente. Aterriza suavemente. Respiración: Inhala al bajar, exhala al saltar. Evita: Caer con los pies juntos o permitir que las rodillas sobrepasen los dedos de los pies.", "nombre": "Sentadilla con Salto", "patron": "bisagra_cadera", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Acostado boca arriba, rodillas flexionadas y pies en el suelo. Movimiento: Eleva las caderas hacia el techo apretando glúteos y abdominales. Respiración: Inhala al bajar, exhala al elevar. Evita: Dejar caer los glúteos al suelo sin activar los músculos.", "nombre": "Puente de Glúteos con Elevación", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca las manos en el suelo, con la banda elástica bajo tus pies. Movimiento: Tira de la banda hacia tu torso mientras mantienes el cuerpo recto. Respiración: Inhala al tirar, exhala al regresar. Evita: Girar las caderas o relajar el abdomen.", "nombre": "Remo en Posición de Planchas con Banda Elástica", "patron": "tracción", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: De pie. Movimiento: Baja a cuclillas, pon las manos en el suelo, salta hacia atrás a la posición de plancha, regresa a cuclillas y salta al final. Respiración: Inhala al bajar, exhala al saltar. Evita: No dejar caer las caderas en la posición de plancha.", "nombre": "Burpees Modificados", "patron": "empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
50	10	79	2025-08-19 22:18:53.711302+02	\N	0	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Posición inicial: Pies a la altura de los hombros, sostén los discos con ambas manos frente a tus muslos. Movimiento: Flexiona las caderas hacia atrás manteniendo la espalda recta y la cabeza en línea con la columna. Desciende hasta sentir un estiramiento en los isquiotibiales. Respira: Inhala al bajar, exhala al subir. Evita: Redondear la espalda o dejar que las rodillas se muevan hacia adelante.", "nombre": "Peso Muerto Rumano con Discos Olímpicos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Sujeta las asas del TRX con las manos y recuéstate hacia atrás. Mantén el cuerpo en línea recta. Movimiento: Tira de tus manos hacia ti, llevando los codos hacia atrás y juntando los omóplatos. Respira: Inhala al bajar, exhala al subir. Evita: Dejar que la cadera se hunda o que los hombros suban hacia las orejas.", "nombre": "Remo con TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Posición inicial: Sostén los discos al nivel de los hombros con los codos hacia adelante. Movimiento: Flexiona ligeramente las rodillas, luego utiliza el impulso de tus piernas para empujar los discos hacia arriba, extendiendo los brazos completamente. Respira: Inhala al bajar, exhala al empujar. Evita: Arqueo excesivo en la espalda al levantar o que los discos se desplacen hacia adelante.", "nombre": "Push Press con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Posición inicial: Con discos en las manos, párate en el borde de una plataforma o escalón. Movimiento: Eleva los talones, quedándote en las puntas de los pies, luego baja los talones por debajo de la plataforma. Respira: Inhala al bajar, exhala al subir. Evita: Dejar que las rodillas se muevan hacia adelante o perder el equilibrio.", "nombre": "Elevaciones de Talones con Discos Olímpicos", "patron": "empuje", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 60, "repeticiones": 12}]}
54	10	87	2025-08-23 12:32:56.458283+02	\N	179	1	7	14.30	in_progress	{"exercises": [{"tipo": "reps", "notas": "Utiliza la silla para apoyo en la bajada y asegura que la técnica sea controlada para proteger las rodillas.", "nombre": "Pistol Squat asistido con silla", "patron": "sentadilla con una pierna", "series": 4, "implemento": "silla", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén la espalda recta y aprieta los omóplatos al final del movimiento para activar bien la espalda.", "nombre": "Remo en T con bandas elásticas en posición inclinado", "patron": "remo", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Asegúrate de no arquear demasiado la espalda y realiza movimientos controlados para evitar lesiones en hombros.", "nombre": "Press de hombros con mancuernas en banco inclinado", "patron": "press de hombro", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Realiza movimientos lentos y controlados, concentrándote en la contracción muscular para maximizar el trabajo.", "nombre": "Elevaciones laterales de hombro con banda elástica", "patron": "elevación lateral", "series": 3, "implemento": "banda elástica", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el codo fijado y evita balancear el cuerpo para aislar mejor el bíceps.", "nombre": "Curl de bíceps en concentración con mancuernas", "patron": "curl", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Controla la fase excéntrica y evita que la banda tenga demasiado slack para mantener tensión constante.", "nombre": "Extensión de tríceps con banda en banco plano", "patron": "extensión de tríceps", "series": 3, "implemento": "banda elástica", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén el core apretado y evita que las caderas se hundan durante el ejercicio para una mejor estabilidad.", "nombre": "Plancha con levantamiento de pierna alterno", "patron": "plancha dinámica", "series": 3, "implemento": "sin implemento", "descanso_seg": 60, "repeticiones": 12}]}
52	10	81	2025-08-22 13:22:42.216763+02	\N	238	2	4	50.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Coloca una silla estable frente a ti. Movimiento: Salta con ambos pies hacia arriba y aterriza suavemente sobre la silla. Mantén los pies juntos y las rodillas ligeramente flexionadas. Respiración: Exhala al saltar, inhala al aterrizar. Evita: Aterrizar con las piernas rígidas o hacer saltos demasiado altos.", "nombre": "Saltos en Silla", "patron": "bisagra_cadera", "implemento": "silla_sofa", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Colócate frente a una pared a una distancia cómoda. Movimiento: Inclínate hacia la pared manteniendo el cuerpo recto, y empuja para volver a la posición inicial. Asegúrate de que los codos estén cerca del cuerpo. Respiración: Inhala al bajar, exhala al subir. Evita: Dejar caer la cadera o arquear la espalda.", "nombre": "Flexiones de Brazos en Pared", "patron": "empuje", "implemento": "pared", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Pies a la altura de hombros y dedos ligeramente hacia afuera. Movimiento: Baja las caderas como si fueras a sentarte en una silla, manteniendo el pecho erguido y las rodillas alineadas con los pies. Respiración: Inhala al bajar, exhala al subir. Evita: Que las rodillas se desvíen hacia adentro o que el torso se incline hacia adelante.", "nombre": "Sentadillas con Peso Corporal", "patron": "sentadilla", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: En posición de plancha alta, con manos debajo de los hombros. Movimiento: Lleva una rodilla hacia el pecho y luego alterna rápidamente con la otra pierna, como si estuvieras corriendo en el lugar. Mantén el abdomen contraído. Respiración: Inhala y exhala rápidamente. Evita: Que las caderas se eleven o se bajen excesivamente.", "nombre": "Mountain Climbers en Suelo", "patron": "tracción", "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}]}
51	10	80	2025-08-20 09:26:54.414399+02	2025-08-20 10:31:05.087108+02	536	4	4	100.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Posición inicial: Agarra las asas del TRX con los brazos extendidos y el cuerpo recto. Movimiento: Inclínate hacia atrás, manteniendo el cuerpo recto y los pies firmes en el suelo. Tira hacia ti, flexionando los codos y llevando el pecho hacia las asas. Respiración: Exhala al tirar, inhala al volver. Evita: Que el cuerpo se desplace de lado o que la espalda se curve.", "nombre": "Tirón de TRX", "patron": "tracción", "series": 4, "implemento": "trx", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Siéntate en la bici con la espalda recta y las manos en el manillar. Movimiento: Pedalea a máxima intensidad, manteniendo el ritmo y la postura. Respiración: Inhala y exhala de manera rítmica. Evita: Encoger los hombros o inclinarte demasiado adelante.", "nombre": "Bicicleta Estática", "patron": "cardio", "series": 4, "implemento": "bici", "descanso_seg": 45, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca los discos en el suelo, súbete a ellos y mantén el equilibrio. Movimiento: Eleva los talones, apretando los músculos de las pantorrillas. Baja controladamente. Respiración: Exhala al elevar, inhala al bajar. Evita: Colapsar los tobillos o permitir que las rodillas se desvíen.", "nombre": "Elevaciones de Talones con Discos", "patron": "bisagra_cadera", "series": 4, "implemento": "discos_olimpicos", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "tiempo", "notas": "Posición inicial: Coloca la banda elástica alrededor de tus muñecas y apóyate sobre un lado. Movimiento: Eleva las caderas hasta que el cuerpo forme una línea recta. Mantén la posición y luego baja. Respiración: Mantén la respiración constante. Evita: Caer en la cadera o no mantener la alineación de la espalda.", "nombre": "Plancha Lateral con Banda Elástica", "patron": "estabilización", "series": 4, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 30}]}
53	10	84	2025-08-22 18:50:51.524176+02	\N	358	2	5	40.00	in_progress	{"exercises": [{"tipo": "series_reps", "notas": "Asegúrate de mantener la espalda recta y los codos cerca del torso durante la tracción. Controla el movimiento para maximizar el trabajo muscular.", "nombre": "Remo invertido en silla", "patron": "remo", "series": 4, "implemento": "silla", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "series_reps", "notas": "Da pasos largos y mantén la rodilla alineada con el tobillo en el descenso. Incorpora una toalla en las manos para mayor estabilidad si necesitas.", "nombre": "Zancadas con peso corporal", "patron": "zancada", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "series_reps", "notas": "Mantén los codos ligeramente flexionados y realiza el movimiento de manera controlada para activar bien los deltoides y trapecios.", "nombre": "Press de hombros con bandas elásticas", "patron": "press_shoulders", "series": 4, "implemento": "bandas elásticas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "series_reps", "notas": "Realiza movimientos lentos y controlados, levantando las toallas a la altura de los hombros sin levantar los pies del suelo para mantener la estabilidad.", "nombre": "Elevaciones laterales con toalla", "patron": "elevaciones_laterales", "series": 3, "implemento": "toallas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "series_reps", "notas": "Aprieta los glúteos en la parte superior y mantén la posición unos segundos. Evita sobreextender la zona lumbar.", "nombre": "Puente de glúteos en suelo", "patron": "puente_gluteos", "series": 4, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 15}]}
55	10	88	2025-08-23 14:39:39.849304+02	\N	0	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Utiliza una técnica controlada, asegurándote de elevar la pesa en línea recta y mantener la espalda recta durante el movimiento.", "nombre": "Clean to Press con Kettlebell", "patron": "propio peso dinámico", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la espalda plana y activa el core para evitar lesiones. Realiza el movimiento con control y concentración en la contracción muscular.", "nombre": "Remo con Barra en Pendiente", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Asegúrate de aterrizar suavemente y mantener el control en cada salto para proteger las articulaciones.", "nombre": "Saltos en Caja con Peso", "patron": "saltos pliométricos", "series": 4, "implemento": "disco o peso en mano", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén el core contraído y evita empujar el suelo con las manos, enfócate en la contracción abdominal.", "nombre": "Elevaciones de Tronco con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "tiempo", "notas": "Levanta las rodillas con énfasis en la velocidad y arrastra las pesas con movimientos controlados para activar la cadena posterior.", "nombre": "Sprint en Sitio con Arrastre de Pesas", "patron": "cardio intenso", "series": 4, "implemento": "pesas", "descanso_seg": 45, "repeticiones": "20 segundos de trabajo / 20 segundos de descanso"}]}
56	10	89	2025-08-23 15:04:15.516777+02	\N	0	0	5	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Usa la toalla para aumentar la resistencia y mantener la estabilidad, asegurando una correcta alineación del cuerpo.", "nombre": "Flexiones con Toalla en Pared", "patron": "flexiones", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Ejecuta saltos explosivos y lleva las rodillas al pecho al subir, cuidando la técnica para evitar impacto excesivo en las articulaciones.", "nombre": "Saltos en Silla con Elevación de Rodillas Alternas", "patron": "saltos", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén una línea recta desde los hombros hasta los talones, jalando la toalla hacia ti mientras aprietas la espalda.", "nombre": "Remo en Puente usando Silla y Toalla", "patron": "remo", "series": 4, "implemento": "toalla y silla", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el core firme y evita que las caderas se hundan. Desplaza las manos o los pies lateralmente para mayor movimiento.", "nombre": "Plancha Dinámica con Desplazamiento lateral", "patron": "plancha", "series": 3, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la espalda pegada a la pared y realiza elevaciones controladas para activar los glúteos y oblicuos.", "nombre": "Elevaciones Laterales de Cadera con Toalla en Pared", "patron": "elevaciones de cadera", "series": 3, "implemento": "toalla, pared", "descanso_seg": 45, "repeticiones": 15}]}
57	10	90	2025-08-24 19:07:08.020974+02	\N	0	0	6	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén la espalda recta y activa el core para evitar lesiones. El movimiento debe ser controlado y sin rebotes en la parte baja.", "nombre": "Remo con Barra Pendlay", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Asegura una buena estabilidad en los pies y evita que los brazos bajen excesivamente. Controla la bajada y empuja explosivamente.", "nombre": "Press de Banca con Barra", "patron": "press_horizontal", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 6}, {"tipo": "reps", "notas": "Mantén la espalda recta y activa el core durante toda la acción. No doble demasiado las rodillas y enfócate en la cadera.", "nombre": "Peso Muerto Rumano con Discos", "patron": "peso_muerto", "series": 4, "implemento": "discos", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Asegura una buena amplitud en el movimiento, sin colgarse en exceso y controlando la bajada. Si es muy fácil, añade peso.", "nombre": "Dominadas con Agarre Paralelo en Barra", "patron": "dominadas", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 8}, {"tipo": "reps", "notas": "Mantén el core firme y no sobreextiendas la espalda. Eleva la barra de manera controlada y evita movimientos bruscos.", "nombre": "Press Militar con Barra", "patron": "press_vertical", "series": 4, "implemento": "barra", "descanso_seg": 60, "repeticiones": 6}, {"tipo": "reps", "notas": "Inclina el torso a 45 grados y activa el dorsal durante el movimiento. No uses impulso para levantar las mancuernas.", "nombre": "Remo en T con Mancuernas Pesadas", "patron": "remo", "series": 4, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 8}]}
58	10	92	2025-08-25 13:23:13.916324+02	2025-08-25 14:04:34.543561+02	805	5	5	100.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén la espalda recta y activa la cadera al final del movimiento para potenciar el impulso del kettlebell.", "nombre": "Swing con Kettlebell a una mano", "patron": "levantamiento", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Realiza un salto libre al despegue y evita arquear la espalda durante la dominada para protegerla.", "nombre": "Burpee con salto y barra dominadas", "patron": "fullbody", "series": 4, "implemento": "barra y peso corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el core firme y evita que las caderas se hundan o levanten demasiado, controlando la bajada.", "nombre": "Lunges en posición de plancha con peso en manos", "patron": "zancadas", "series": 3, "implemento": "pesos en manos (kettlebells o mancuernas)", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Concéntrate en apretar los omóplatos y mantener la espalda alineada para una tracción eficiente.", "nombre": "Remo con TRX en movimiento dinámico", "patron": "remo", "series": 4, "implemento": "TRX", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Mantén la espalda recta y los brazos ligeramente flexionados, tratando de mantener un ritmo constante.", "nombre": "Salto en cuerda doble con cambios rápidos", "patron": "cardio", "series": 3, "implemento": "cuerda de salto", "descanso_seg": 45, "repeticiones": 50}]}
59	10	93	2025-08-25 14:12:03.185846+02	\N	359	1	5	20.00	in_progress	{"exercises": [{"tipo": "intervalo", "notas": "Realiza las sentadillas con explosividad, aterrizando suavemente para proteger las articulaciones y maximizar el trabajo cardiovascular.", "nombre": "Sentadillas con salto sin peso", "patron": "salto", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "intervalo", "notas": "Mantén el cuerpo recto, evita que las caderas caigan o se levanten demasiado; ajusta la apertura de manos para mayor énfasis en pectorales o tríceps.", "nombre": "Flexiones de brazos en suelo (manos en parallets o sobre libros para variar altura)", "patron": "flexion", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervalo", "notas": "Desde posición de plancha, toca con una mano el hombro contraria alternando, manteniendo el control y evitando rotaciones innecesarias.", "nombre": "Plancha con toques de hombro", "patron": "plancha", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervalo", "notas": "Mantén las caderas bajas y realiza movimientos rápidos, activando abdomen y hombros de manera dinámica.", "nombre": "Escaladores (mountain climbers)", "patron": "cardio", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 40}, {"tipo": "intervalo", "notas": "Aprieta los glúteos al elevar la pelvis, evita sobreextender la zona lumbar, y si quieres aumentar intensidad, coloca un peso ligero sobre la pelvis.", "nombre": "Puente de glúteos con peso en pelvis (opcional con objeto ligero)", "patron": "hipthrust", "series": 8, "implemento": "peso corporal o ligero peso", "descanso_seg": 45, "repeticiones": 15}]}
60	10	96	2025-08-25 14:29:28.388107+02	\N	0	0	5	0.00	in_progress	{"exercises": [{"tipo": "tiempo", "notas": "Mantén una postura neutral de la columna y realiza el movimiento con las caderas, no solo con los brazos.", "nombre": "Swing de Kettlebell a dos manos", "patron": "hip hinge", "series": 4, "implemento": "Kettlebell", "descanso_seg": 45, "duracion_seg": 40}, {"tipo": "tiempo", "notas": "Asegúrate de que tus manos despeguen del suelo de forma controlada y aterrizan suavemente para proteger las muñecas.", "nombre": "Flexiones con palmadas explosivas", "patron": "explosivo", "series": 4, "implemento": "sin implemento", "descanso_seg": 45, "duracion_seg": 30}, {"tipo": "reps", "notas": "Mantén la espalda recta y activa el core en todo momento para evitar lesiones.", "nombre": "Remo con barra en posición inclinada", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Mantén el core firme y evita que la cadera se rote excesivamente al tocar el hombro contralateral.", "nombre": "Plancha con toque de hombro alterno", "patron": "estabilidad", "series": 4, "implemento": "sin implemento", "descanso_seg": 45, "duracion_seg": 45}, {"tipo": "tiempo", "notas": "Utiliza los discos para deslizar lateralmente, manteniendo las rodillas ligeramente flexionadas y el core activo.", "nombre": "Saltos con deslizamiento lateral sobre discos", "patron": "cardio", "series": 4, "implemento": "discos", "descanso_seg": 45, "duracion_seg": 30}]}
61	10	98	2025-08-25 18:02:57.238792+02	\N	0	0	4	0.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Sube las rodillas con fuerza, utilizando las manos en la silla para impulso, mantén la espalda recta y evita movimientos bruscos.", "nombre": "Elevaciones de rodillas en silla con impulso", "patron": "cardio dinámico", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén la cadera estable durante el movimiento y evita que las caderas se muevan de lado a lado para una mayor estabilidad y activación del core.", "nombre": "Plancha con toque de hombros alterno", "patron": "estabilidad", "series": 3, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 16}, {"tipo": "reps", "notas": "Realiza saltos en un lado a otro de manera rápida pero controlada, asegurando un aterrizaje suave para cuidar las articulaciones.", "nombre": "Saltos laterales sobre línea imaginaria (sin cuerda)", "patron": "cardio", "series": 4, "implemento": "ninguno", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "reps", "notas": "Mantén el cuerpo en línea recta desde la cabeza hasta los talones y evita que las caderas se hundan o suban demasiado en cada repetición.", "nombre": "Flexiones de brazos con manos en suelo elevado en una silla", "patron": "fuerza", "series": 3, "implemento": "silla", "descanso_seg": 45, "repeticiones": 12}]}
62	10	99	2025-08-25 18:40:40.784347+02	\N	403	2	5	40.00	in_progress	{"exercises": [{"tipo": "saltar", "notas": "Aterriza suavemente con las rodillas ligeramente flexionadas para proteger las articulaciones, impulsa con toda la fuerza de las piernas.", "nombre": "Saltos de Pliometría con Discos", "patron": "power", "series": 5, "implemento": "discos", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "movimiento", "notas": "Mantén la espalda recta y activa el core durante todo el movimiento, evita la sobreextensión lumbar.", "nombre": "Swing de Kettlebell a Doble Mano", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "flexion", "notas": "Mantén el cuerpo alineado, evita que la pelvis se hunda. Usa la cuerda para un impulso adicional si buscas mayor intensidad.", "nombre": "Flexiones con Cuerda de Soga", "patron": "flexión", "series": 4, "implemento": "cuerda", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "fuerza", "notas": "Realiza un remo explosivo, elevando la barra hasta el torso rápidamente y bajando controladamente. Mantén la espalda recta.", "nombre": "Remo con Barra en Explosión", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "cardio", "notas": "Mantén el core firme y realiza movimientos rápidos, evitando que las caderas caigan o suban demasiado.", "nombre": "Mountain Climbers con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 40}]}
63	10	99	2025-08-27 20:00:29.58193+02	\N	\N	0	5	0.00	in_progress	{"exercises": [{"tipo": "saltar", "notas": "Aterriza suavemente con las rodillas ligeramente flexionadas para proteger las articulaciones, impulsa con toda la fuerza de las piernas.", "nombre": "Saltos de Pliometría con Discos", "patron": "power", "series": 5, "implemento": "discos", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "movimiento", "notas": "Mantén la espalda recta y activa el core durante todo el movimiento, evita la sobreextensión lumbar.", "nombre": "Swing de Kettlebell a Doble Mano", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "flexion", "notas": "Mantén el cuerpo alineado, evita que la pelvis se hunda. Usa la cuerda para un impulso adicional si buscas mayor intensidad.", "nombre": "Flexiones con Cuerda de Soga", "patron": "flexión", "series": 4, "implemento": "cuerda", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "fuerza", "notas": "Realiza un remo explosivo, elevando la barra hasta el torso rápidamente y bajando controladamente. Mantén la espalda recta.", "nombre": "Remo con Barra en Explosión", "patron": "remo", "series": 4, "implemento": "barra", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "cardio", "notas": "Mantén el core firme y realiza movimientos rápidos, evitando que las caderas caigan o suban demasiado.", "nombre": "Mountain Climbers con Discos", "patron": "core", "series": 3, "implemento": "discos", "descanso_seg": 45, "repeticiones": 40}]}
64	10	100	2025-08-27 20:01:11.180368+02	\N	179	1	5	20.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Impulsa con las caderas, mantén la espalda recta y controla el movimiento al bajar y subir la kettlebell.", "nombre": "Kettlebell Swings Explosivos", "patron": "hip hinge", "series": 4, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén el core activo mientras alternas entre plancha y flexión apoyado en TRX, controlando la respiración.", "nombre": "TRX Atomic Push-ups", "patron": "plancha en movimiento", "series": 3, "implemento": "TRX", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Asegúrate de aterrizar con las rodillas ligeramente flexionadas y mantener una postura estable en cada salto.", "nombre": "Saltos laterales sobre Caja con Peso", "patron": "plyometric", "series": 3, "implemento": "disco peso", "descanso_seg": 60, "duracion_seg": 30}, {"tipo": "reps", "notas": "Gira el torso al lanzar la kettlebell, controlando el movimiento y evitando rotaciones bruscas de la columna.", "nombre": "Lanzamiento de Kettlebell con Giro", "patron": "rotacional", "series": 3, "implemento": "kettlebell", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza sentadillas apoyado en la pared y desplaza lateralmente, manteniendo la espalda pegada y el core firme.", "nombre": "Progresión de Sentadillas en Pared con Desplazamiento", "patron": "sentadilla en pared", "series": 3, "implemento": "silla", "descanso_seg": 60, "repeticiones": 12}]}
65	10	103	2025-08-27 20:28:49.124347+02	\N	0	0	5	0.00	in_progress	{"exercises": [{"tipo": "intervallo", "notas": "Mantén el ritmo y evita perder la postura. Usa los brazos para mejorar el ritmo aeróbico.", "nombre": "Jumping Jacks", "patron": "cardio", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 45}, {"tipo": "intervallo", "notas": "Mantén los codos cerca del cuerpo y baja controladamente.", "nombre": "Fondos en Silla", "patron": "fuerza", "series": 4, "implemento": "silla", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "intervallo", "notas": "Mantén el torso erguido y la espalda neutral para evitar lesiones.", "nombre": "Sentadillas con peso corporal", "patron": "movimiento", "series": 8, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "intervallo", "notas": "Activa bien el abdomen y mantén la cadera estable durante el movimiento.", "nombre": "Mountain Climbers", "patron": "core", "series": 6, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "intervallo", "notas": "Mantén el cuerpo en línea recta y evita que las caderas se hundan.", "nombre": "Plancha con Toque de Hombro", "patron": "core", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 12}]}
66	10	104	2025-08-28 09:52:19.186191+02	2025-08-28 10:19:56.273235+02	670	5	5	100.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén la pelvis elevada y aprieta los glúteos en la parte superior del movimiento, controlando la bajada.", "nombre": "Puente de Glúteos en la Pared", "patron": "hip thrust", "series": 3, "implemento": "silla (opcional)", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Mantén una postura estable y realiza movimientos controlados para activar el core y los abductores.", "nombre": "Elevación Alterna de Piernas en Posición de Sentadilla", "patron": "pierna", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza la contracción escapular asegurando la correcta alineación del hombro y evitando sobrecarga en la zona cervical.", "nombre": "Press de Pared con Flexión de Escápulas", "patron": "press", "series": 3, "implemento": "pared", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén la columna alineada y realiza movimientos controlados para activar estabilizadores del core y hombros.", "nombre": "Planchas Alternas con Rotación de Tronco", "patron": "planchas", "series": 3, "implemento": "sin implemento", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Usa la toalla para mejorar el equilibrio y coordinación en movimientos de marcha controlada, activando estabilizadores de pie y tobillo.", "nombre": "Marcha en Vuelta de Toalla (Balance Dinámico)", "patron": "equilibrio", "series": 3, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 20}]}
67	10	106	2025-08-28 12:05:55.213941+02	2025-08-28 12:31:28.055555+02	670	5	5	100.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Mantén una espalda recta en la bajada y realiza el salto explosivo, tocando las rodillas en el aire para incrementar intensidad.", "nombre": "Burpees con salto y toque de rodillas", "patron": "salto", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Enfócate en mantener las caderas elevadas y los brazos alineados para activar la parte superior de tu espalda y hombros.", "nombre": "Pike Push-Up (Flexión en V invertida para hombros)", "patron": "flexión", "series": 3, "implemento": "peso corporal", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Mantén el core firme y realiza movimientos controlados para activar glúteos y piernas sin perder estabilidad.", "nombre": "Elevaciones laterales de pierna en posición de cuadrupedia", "patron": "elevacion", "series": 3, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Gira el torso desde las caderas y mantén la espalda recta, asegurando una correcta rotación de la columna.", "nombre": "Russian Twists con Toalla o Peso Ligero", "patron": "rotacion", "series": 3, "implemento": "toalla o peso ligero", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Realiza pasos largos y controla el movimiento, usando la toalla para añadir resistencia o equilibrio en la parte superior si es necesario.", "nombre": "Estocadas Alternas con Toalla para Resistencia", "patron": "estocada", "series": 3, "implemento": "toalla", "descanso_seg": 60, "repeticiones": 12}]}
68	10	107	2025-08-28 12:53:39.841595+02	\N	179	1	5	20.00	in_progress	{"exercises": [{"tipo": "reps", "notas": "Realiza una flexión explosiva y, en el ascenso, da una palmada en cada mano para activar potencia y coordinación.", "nombre": "Flexiones con Palmada Alterna", "patron": "flexiones", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 20}, {"tipo": "reps", "notas": "Mantén el core fuerte y lleva la rodilla hacia el codo opuesto en cada repetición para activar oblicuos y mejorar la estabilidad.", "nombre": "Mountain Climbers con Giro Torácico", "patron": "cardio dinámico", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 30}, {"tipo": "reps", "notas": "Salta con ambos pies y alterna ligeramente la dirección, asegurando una aterrizaje suave para proteger articulaciones.", "nombre": "Saltos Pliométricos en Caja Alterna", "patron": "saltos", "series": 3, "implemento": "caja improvisada o altura segura", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Usa una toalla resistente para realizar un remo isométrico, asegurándote de mantener la espalda recta y contractar el dorsal.", "nombre": "Remo con Toalla en Puerta", "patron": "fuerza", "series": 4, "implemento": "toalla", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "reps", "notas": "Realiza un burpee explosivo, asegurándote de mantener la técnica y evitar movimientos bruscos que puedan lesionarte.", "nombre": "Burpees con Salto Vertical", "patron": "cardio intenso", "series": 4, "implemento": "peso corporal", "descanso_seg": 45, "repeticiones": 15}]}
\.


--
-- TOC entry 5875 (class 0 OID 27915)
-- Dependencies: 314
-- Data for Name: home_training_templates; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.home_training_templates (id, equipment_type, training_type, template_name, plan_data, is_active, usage_count, created_by, created_at, updated_at) FROM stdin;
2	minimo	hiit	HIIT Mínimo - Cardio Intenso	{"plan_entrenamiento": {"titulo": "HIIT - Equipamiento Mínimo", "subtitulo": "Alta intensidad con peso corporal", "ejercicios": [{"tipo": "tiempo", "notas": "Mantén caderas estables, alternancia rápida de piernas.", "nombre": "Mountain Climbers", "patron": "cardio", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "duracion_seg": 30}, {"tipo": "reps", "notas": "Movimiento explosivo completo. Flexión, salto hacia atrás, salto vertical.", "nombre": "Burpees", "patron": "full_body", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "repeticiones": 8}, {"tipo": "tiempo", "notas": "Aterrizaje suave, rebote inmediato.", "nombre": "Saltos en Sentadilla", "patron": "pliometrico", "series": 4, "implemento": "peso_corporal", "descanso_seg": 40, "duracion_seg": 20}, {"tipo": "reps", "notas": "Desde plancha, saltar pies hacia manos y volver.", "nombre": "Plancha con Salto de Pies", "patron": "core_dinamico", "series": 4, "implemento": "peso_corporal", "descanso_seg": 30, "repeticiones": 10}], "duracion_estimada_min": 20}, "mensaje_personalizado": "HIIT intenso que elevará tu frecuencia cardíaca. Trabaja al máximo durante los intervalos activos."}	t	0	system	2025-08-28 10:25:53.480399	2025-08-28 10:25:53.480399
3	minimo	fuerza	Fuerza Mínima - Progresiones	{"plan_entrenamiento": {"titulo": "Fuerza - Equipamiento Mínimo", "subtitulo": "Progresiones de peso corporal para fuerza", "ejercicios": [{"tipo": "reps", "notas": "Usa pared o silla para asistencia. Progresión hacia pistol completa.", "nombre": "Sentadilla Pistol Asistida", "patron": "fuerza_piernas", "series": 4, "implemento": "silla_sofa", "descanso_seg": 90, "repeticiones": 6}, {"tipo": "reps", "notas": "Manos forman diamante, mayor activación de tríceps.", "nombre": "Flexiones Diamante", "patron": "fuerza_empuje", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 8}, {"tipo": "reps", "notas": "Pies elevados aumenta dificultad. Control en la bajada.", "nombre": "Fondos en Silla", "patron": "fuerza_triceps", "series": 4, "implemento": "silla_sofa", "descanso_seg": 90, "repeticiones": 10}, {"tipo": "reps", "notas": "Transferencia de peso lateral en plancha.", "nombre": "Plancha Archer", "patron": "fuerza_core", "series": 4, "implemento": "peso_corporal", "descanso_seg": 90, "repeticiones": 5}], "duracion_estimada_min": 35}, "mensaje_personalizado": "Progresiones avanzadas de peso corporal para desarrollar fuerza real. Enfócate en la forma perfecta."}	t	0	system	2025-08-28 10:25:53.482552	2025-08-28 10:25:53.482552
4	basico	funcional	Funcional Básico - Herramientas	{"plan_entrenamiento": {"titulo": "Rutina Funcional - Equipamiento Básico", "subtitulo": "Patrones de movimiento con mancuernas y bandas", "ejercicios": [{"tipo": "reps", "notas": "Patrón de bisagra de cadera fundamental. Mantén espalda recta.", "nombre": "Peso Muerto con Mancuernas", "patron": "bisagra_cadera", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 12}, {"tipo": "reps", "notas": "Desde el suelo o banco. Rango completo de movimiento.", "nombre": "Press de Pecho con Mancuernas", "patron": "empuje", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "reps", "notas": "Retracción escapular, codos cerca del cuerpo.", "nombre": "Remo con Banda Elástica", "patron": "traccion", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Paso controlado, rodilla trasera baja hasta casi tocar suelo.", "nombre": "Zancada con Mancuernas", "patron": "zancada", "series": 3, "implemento": "mancuernas", "descanso_seg": 60, "repeticiones": 10}, {"tipo": "tiempo", "notas": "Banda alrededor de muñecas añade resistencia lateral.", "nombre": "Plancha con Resistencia", "patron": "core", "series": 3, "implemento": "bandas_elasticas", "descanso_seg": 45, "duracion_seg": 40}], "duracion_estimada_min": 30}, "mensaje_personalizado": "Rutina funcional completa usando herramientas básicas. Perfecto equilibrio entre fuerza y movilidad."}	t	0	system	2025-08-28 10:25:53.485309	2025-08-28 10:25:53.485309
1	minimo	funcional	Funcional Mínimo - Patrones Básicos	{"plan_entrenamiento": {"titulo": "Rutina Funcional - Equipamiento Mínimo", "subtitulo": "Patrones de movimiento básicos con peso corporal", "ejercicios": [{"tipo": "reps", "notas": "Patrón fundamental de sentadilla. Mantén el pecho elevado y desciende hasta que muslos estén paralelos.", "nombre": "Sentadilla con Peso Corporal", "patron": "sentadilla", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 15}, {"tipo": "reps", "notas": "Patrón de empuje horizontal. Mantén línea recta desde cabeza hasta pies.", "nombre": "Flexiones de Pecho", "patron": "empuje", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 10}, {"tipo": "reps", "notas": "Patrón unilateral. Paso amplio, rodilla trasera casi toca el suelo.", "nombre": "Zancada Alterna", "patron": "zancada", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "repeticiones": 12}, {"tipo": "tiempo", "notas": "Core estabilidad. Línea recta desde cabeza hasta pies.", "nombre": "Plancha Isométrica", "patron": "core", "series": 3, "implemento": "peso_corporal", "descanso_seg": 45, "duracion_seg": 30}], "duracion_estimada_min": 25}, "mensaje_personalizado": "Rutina funcional diseñada con movimientos fundamentales que puedes hacer en cualquier lugar. Enfócate en la calidad del movimiento."}	t	1	system	2025-08-28 10:25:53.470885	2025-08-28 10:31:34.771134
\.


--
-- TOC entry 5833 (class 0 OID 27181)
-- Dependencies: 263
-- Data for Name: medical_documents; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.medical_documents (id, user_id, document_name, document_type, file_path, content, analysis_result, status, upload_date, analyzed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5887 (class 0 OID 28170)
-- Dependencies: 333
-- Data for Name: methodology_exercise_feedback; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.methodology_exercise_feedback (id, methodology_session_id, user_id, exercise_name, exercise_order, sentiment, comment, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5889 (class 0 OID 28261)
-- Dependencies: 335
-- Data for Name: methodology_exercise_history_complete; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.methodology_exercise_history_complete (id, user_id, methodology_plan_id, methodology_session_id, exercise_name, exercise_order, methodology_type, series_total, series_completed, repeticiones, intensidad, tiempo_dedicado_segundos, sentiment, user_comment, week_number, day_name, session_date, completed_at, created_at) FROM stdin;
\.


--
-- TOC entry 5885 (class 0 OID 28144)
-- Dependencies: 331
-- Data for Name: methodology_exercise_progress; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.methodology_exercise_progress (id, methodology_session_id, user_id, exercise_name, exercise_order, series_total, repeticiones, descanso_seg, intensidad, tempo, notas, ejercicio_ejecucion, ejercicio_consejos, ejercicio_errores_evitar, series_completed, status, time_spent_seconds, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5883 (class 0 OID 28118)
-- Dependencies: 329
-- Data for Name: methodology_exercise_sessions; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.methodology_exercise_sessions (id, user_id, methodology_plan_id, methodology_type, session_name, week_number, day_name, total_exercises, exercises_completed, session_status, started_at, completed_at, total_duration_seconds, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5841 (class 0 OID 27264)
-- Dependencies: 271
-- Data for Name: methodology_plans; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.methodology_plans (id, user_id, methodology_type, plan_data, generation_mode, created_at, updated_at, version_type, custom_weeks, selection_mode) FROM stdin;
1	10	Hipertrofia	{"semanas": [{"semana": 1, "sesiones": [{"dia": "Lun", "ejercicios": [{"notas": "Mantener el torso erguido", "tempo": "3-1-1", "nombre": "Sentadilla con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Inhala al bajar y exhala al subir, mantén el peso en los talones y activa los glúteos al subir.", "ejecucion": "Coloca la barra en la parte superior de la espalda, separa los pies a la altura de los hombros. Baja lentamente flexionando las rodillas, manteniendo la espalda recta, y vuelve a la posición inicial.", "errores_evitar": "No dejes que las rodillas sobrepasen los dedos de los pies, evita la curvatura de la espalda, y asegúrate de que los pies estén bien apoyados."}}, {"notas": "Controlar el movimiento en la bajada", "tempo": "2-1-1", "nombre": "Press de banca", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén siempre el control en el descenso, evita que los codos se abran demasiado.", "ejecucion": "Acuéstate en el banco con los pies apoyados en el suelo. Toma la barra con las manos un poco más anchas que los hombros, baja la barra hasta el pecho y empuja hacia arriba.", "errores_evitar": "No arquees la espalda, evita que la barra rebote en el pecho y asegúrate de que los pies estén planos en el suelo."}}, {"notas": "Mantener la espalda recta durante todo el movimiento", "tempo": "2-1-1", "nombre": "Remo con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el core activado y evita que los hombros se eleven demasiado.", "ejecucion": "Con la barra en el suelo, inclínate hacia adelante manteniendo la espalda recta, toma la barra con un agarre prono y jala hacia tu abdomen.", "errores_evitar": "No arquees la espalda, asegúrate de que el movimiento sea controlado y no uses impulso."}}, {"notas": "Concentrarse en la forma adecuada", "tempo": "3-1-1", "nombre": "Peso muerto", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Inhala antes de levantar y exhala al llegar a la posición de pie. Activa los glúteos en la parte superior.", "ejecucion": "Coloca los pies a la altura de los hombros y la barra sobre los pies. Agáchate y toma la barra con un agarre prono o mixto, mantén la espalda recta y levanta la barra manteniéndola cerca del cuerpo.", "errores_evitar": "No arquees la espalda, evita levantar la barra con las piernas rectas y asegúrate de que la barra se mantenga cerca de las espinillas."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mar", "ejercicios": [{"notas": "Mantener la espalda recta", "tempo": "2-1-1", "nombre": "Press militar con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "No arquees la espalda, activa el core y mantén la barra en línea recta.", "ejecucion": "De pie, con los pies a la altura de los hombros, toma la barra a la altura de los hombros y empuja hacia arriba hasta estirar los brazos.", "errores_evitar": "Evita que la barra se desplace hacia adelante o hacia atrás y asegúrate de que los pies estén firmes en el suelo."}}, {"notas": "Usar agarre amplio", "tempo": "2-1-1", "nombre": "Dominadas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el control al descender y activa los dorsales al subir.", "ejecucion": "Cuélgate de la barra con un agarre amplio y jala tu cuerpo hacia arriba hasta que la barbilla sobrepase la barra.", "errores_evitar": "No balancees el cuerpo, evita que los hombros se eleven demasiado y asegúrate de no usar impulso."}}, {"notas": "Controlar el movimiento", "tempo": "2-1-1", "nombre": "Curl de bíceps con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "No muevas la parte superior del cuerpo, mantén los codos fijos y respira adecuadamente.", "ejecucion": "De pie, sujeta la barra con los brazos extendidos y los codos pegados al torso. Flexiona los codos y lleva la barra hacia los hombros.", "errores_evitar": "Evita balancear el cuerpo, no levantes los codos y asegúrate de controlar la bajada."}}, {"notas": "Inclinarse hacia adelante para mayor activación del pecho", "tempo": "2-1-1", "nombre": "Fondos en paralelas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén la cabeza en línea con el torso y activa el pecho al empujar.", "ejecucion": "Con las manos en las paralelas, baja el cuerpo flexionando los codos y empuja hacia arriba hasta extenderlos.", "errores_evitar": "No arquees la espalda, evita que los codos se abran demasiado y asegúrate de controlar la bajada."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mie", "ejercicios": [{"notas": "Mantener el torso erguido", "tempo": "3-1-1", "nombre": "Sentadilla frontal", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activa los glúteos y mantén los pies bien apoyados.", "ejecucion": "Coloca la barra en la parte frontal de los hombros, con los codos hacia adelante. Baja flexionando las rodillas y vuelve a subir.", "errores_evitar": "No dejes que las rodillas sobrepasen los dedos de los pies y evita la curvatura de la espalda."}}, {"notas": "Controlar el movimiento en la bajada", "tempo": "2-1-1", "nombre": "Press inclinado con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén siempre el control en el descenso y evita que los codos se abran demasiado.", "ejecucion": "Acuéstate en el banco inclinado y con las mancuernas a la altura del pecho, empuja hacia arriba hasta extender los brazos.", "errores_evitar": "No arquees la espalda, evita que las mancuernas se desplacen hacia los lados y asegúrate de que los pies estén planos en el banco."}}, {"notas": "Usar agarre amplio", "tempo": "2-1-1", "nombre": "Jalón al pecho", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activar los dorsales y controlar el movimiento al descender.", "ejecucion": "Sentado en la máquina de jalón, agarra la barra con un agarre amplio y tira hacia el pecho manteniendo la espalda recta.", "errores_evitar": "No arquees la espalda, evita balancear el cuerpo y asegúrate de que la barra baje hasta la altura del pecho."}}, {"notas": "Mantener el control en cada repetición", "tempo": "2-1-1", "nombre": "Elevaciones de talones de pie", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Activa los gemelos en cada repetición y controla el movimiento.", "ejecucion": "De pie, con los pies a la altura de los hombros, eleva los talones manteniendo el equilibrio y baja lentamente.", "errores_evitar": "Evita balancearte, no dejes que los talones bajen demasiado rápido y asegúrate de que el movimiento sea controlado."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Jue", "ejercicios": [{"notas": "Concentrarse en la forma adecuada", "tempo": "3-1-1", "nombre": "Peso muerto rumano", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el core activado y tira de los glúteos al volver a la posición inicial.", "ejecucion": "Coloca la barra sobre los muslos, inclínate hacia adelante manteniendo la espalda recta y baja la barra por delante de las piernas.", "errores_evitar": "No arquees la espalda, evita que la barra se aleje demasiado de las piernas y asegúrate de que el movimiento sea controlado."}}, {"notas": "Mantener la espalda recta", "tempo": "2-1-1", "nombre": "Press de banca declinado", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Controla el movimiento en la bajada y mantén los pies firmes en el banco.", "ejecucion": "Acuéstate en el banco declinado y toma la barra con las manos a la altura de los hombros, baja la barra hasta el pecho y empuja hacia arriba.", "errores_evitar": "No arquees la espalda, evita que la barra rebote en el pecho y asegúrate de que los pies estén bien apoyados."}}, {"notas": "Controlar el movimiento", "tempo": "2-1-1", "nombre": "Remo con mancuerna", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Evita balancear el cuerpo y asegúrate de que el movimiento sea controlado.", "ejecucion": "Con una mancuerna en cada mano, inclínate hacia adelante y lleva las mancuernas hacia tu abdomen manteniendo la espalda recta.", "errores_evitar": "No arquees la espalda, evita que los codos se abran demasiado y asegúrate de que el movimiento sea controlado."}}, {"notas": "Mantener el control en cada repetición", "tempo": "2-1-1", "nombre": "Elevaciones laterales", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los codos ligeramente doblados y controla el movimiento al bajar.", "ejecucion": "De pie, con una mancuerna en cada mano, levanta los brazos lateralmente hasta que estén a la altura de los hombros.", "errores_evitar": "Evita balancear el cuerpo, no dejes que los brazos caigan bruscamente y asegúrate de que el movimiento sea controlado."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Vie", "ejercicios": [{"notas": "Mantener el torso erguido", "tempo": "3-1-1", "nombre": "Sentadilla sumo", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activa los glúteos y mantén los pies bien apoyados.", "ejecucion": "Coloca los pies más anchos que los hombros y baja flexionando las rodillas manteniendo la espalda recta.", "errores_evitar": "No dejes que las rodillas sobrepasen los dedos de los pies y evita la curvatura de la espalda."}}, {"notas": "Controlar el movimiento en la bajada", "tempo": "2-1-1", "nombre": "Press de hombros con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén la espalda recta y activa el core.", "ejecucion": "De pie, con una mancuerna en cada mano, empuja hacia arriba hasta extender los brazos.", "errores_evitar": "Evita que la espalda se curve y asegúrate de que el movimiento sea controlado."}}, {"notas": "Controlar el movimiento", "tempo": "2-1-1", "nombre": "Curl de tríceps en polea", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Controla el movimiento y activa los tríceps al final.", "ejecucion": "De pie frente a la polea, toma el mango y estira los brazos hacia abajo manteniendo los codos fijos.", "errores_evitar": "No arquees la espalda, evita que los codos se muevan y asegúrate de que el movimiento sea controlado."}}, {"notas": "Mantener el cuerpo recto", "tempo": "", "nombre": "Planchas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "30 segundos", "informacion_detallada": {"consejos": "Activa el core y respira adecuadamente.", "ejecucion": "Coloca los antebrazos en el suelo y eleva el cuerpo, manteniendo una línea recta desde la cabeza hasta los pies.", "errores_evitar": "No dejes que las caderas se hundan o se eleven demasiado, mantén la posición recta."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}]}], "rationale": "Dado que el objetivo principal es ganar peso y el usuario tiene un nivel avanzado de entrenamiento, se ha elegido la metodología de Hipertrofia para maximizar la ganancia muscular en esta semana de entrenamiento intensivo.", "progresion": {"metodo": "carga", "detalle": "Incrementar el peso en un 5-10% cada sesión según la capacidad del usuario, manteniendo la intensidad alta."}, "validacion": {"semanas_ok": true, "descansos_validos": true, "rango_duracion_ok": true}, "perfil_echo": {"edad": 41, "peso": 76, "sexo": "M", "pecho": "", "brazos": "", "estatura": 183, "assumptions": {}, "medicamentos": "", "masa_muscular": "", "grasa_corporal": "", "nivel_actividad": "alto", "suplementación": "", "años_entrenando": 20, "objetivo_principal": "ganar_peso", "nivel_actual_entreno": "avanzado"}, "safety_notes": "", "selected_style": "Hipertrofia", "consideraciones": "El usuario debe asegurar que tiene el equipamiento adecuado y adaptar el peso a su capacidad.", "frecuencia_por_semana": 5, "duracion_total_semanas": 1}	automatic	2025-08-28 16:17:35.482516+02	2025-08-28 16:17:35.482516+02	adapted	4	automatic
2	10	Hipertrofia	{"semanas": [{"semana": 1, "sesiones": [{"dia": "Lun", "ejercicios": [{"notas": "Mantener la espalda recta y bajar hasta que los muslos estén paralelos al suelo.", "tempo": "3-1-1", "nombre": "Sentadilla con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Aprieta el core para estabilizar la espalda, mantén el pecho hacia arriba y el peso en los talones para un mejor equilibrio.", "ejecucion": "Coloca la barra en la parte superior de la espalda, separa los pies a la altura de los hombros, baja flexionando las rodillas y caderas hasta que los muslos estén paralelos al suelo, luego regresa a la posición inicial.", "errores_evitar": "Evita que las rodillas sobrepasen la línea de los dedos de los pies y no arquees la espalda al bajar."}}, {"notas": "Asegúrate de mantener los pies apoyados en el suelo y la espalda plana contra el banco.", "tempo": "3-1-1", "nombre": "Press de banca", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Inhala al bajar y exhala al empujar, mantén los codos en un ángulo de 45 grados con respecto al torso.", "ejecucion": "Acostado en el banco, agarra la barra con las manos un poco más anchas que los hombros, baja la barra hasta el pecho y empuja hacia arriba hasta extender completamente los brazos.", "errores_evitar": "No arquees la espalda ni levantes los pies del suelo durante el movimiento."}}, {"notas": "Mantén la barra cerca de las piernas durante el levantamiento.", "tempo": "3-1-1", "nombre": "Peso muerto", "series": 4, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Activa los glúteos y los isquiotibiales al levantarte, y asegúrate de no redondear la espalda.", "ejecucion": "Coloca la barra sobre el suelo, separa los pies a la altura de los hombros, agáchate con la espalda recta y agarra la barra. Levanta manteniendo la barra cerca del cuerpo hasta quedar de pie.", "errores_evitar": "No levantes los hombros antes que las caderas y evita que la barra se aleje de las piernas."}}, {"notas": "Usar un agarre amplio para trabajar más los dorsales.", "tempo": "2-1-1", "nombre": "Dominadas", "series": 3, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el core activado y evita balancearte al subir.", "ejecucion": "Cuelga de la barra con un agarre amplio, tira de tu cuerpo hacia arriba hasta que la barbilla sobrepase la barra y baja controladamente.", "errores_evitar": "No arquees la espalda ni uses impulso para subir."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mar", "ejercicios": [{"notas": "Ajustar la posición de los pies para variar el enfoque muscular.", "tempo": "3-1-1", "nombre": "Prensa de piernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén la espalda apoyada y asegúrate de que las rodillas no sobrepasen los dedos de los pies.", "ejecucion": "Sentado en la prensa, coloca los pies en la plataforma y baja el peso flexionando las rodillas, luego empuja hacia arriba.", "errores_evitar": "No bloquees las rodillas al final del movimiento ni arquees la espalda."}}, {"notas": "Mantener la espalda recta durante el movimiento.", "tempo": "3-1-1", "nombre": "Remo con barra", "series": 4, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Exhala al tirar de la barra y asegúrate de apretar los omóplatos al final del movimiento.", "ejecucion": "Con las rodillas ligeramente flexionadas, inclina el torso hacia adelante y tira de la barra hacia el abdomen, manteniendo los codos cerca del cuerpo.", "errores_evitar": "No redondees la espalda y evita que los codos se abran demasiado."}}, {"notas": "Asegúrate de que los pies estén firmes en el suelo.", "tempo": "3-1-1", "nombre": "Press militar", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el core apretado y evita arquear la espalda al levantar la barra.", "ejecucion": "De pie, sostiene la barra a la altura de los hombros y empuja hacia arriba hasta que los brazos estén completamente extendidos, luego baja controladamente.", "errores_evitar": "No uses impulso de las piernas y evita que la barra se desplace hacia adelante o atrás."}}, {"notas": "Usar una plataforma para mayor rango de movimiento.", "tempo": "2-1-1", "nombre": "Elevaciones de talones", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los pies alineados y controla el movimiento tanto al subir como al bajar.", "ejecucion": "De pie sobre una plataforma, eleva los talones lo más alto posible y baja por debajo de la línea de la plataforma.", "errores_evitar": "No permitas que los talones bajen demasiado rápido y evita que te inclines hacia adelante."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 60, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mie", "ejercicios": [{"notas": "Mantener la barra en la parte frontal de los hombros.", "tempo": "3-1-1", "nombre": "Sentadilla frontal", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el torso erguido y el core apretado para estabilidad.", "ejecucion": "Coloca la barra sobre la parte frontal de los hombros, separa los pies a la altura de los hombros y baja flexionando las rodillas, luego vuelve a levantarte.", "errores_evitar": "No dejes que el torso se incline hacia adelante y evita que las rodillas se desplacen hacia adentro."}}, {"notas": "Inclinarse ligeramente hacia adelante para enfatizar los pectorales.", "tempo": "3-1-1", "nombre": "Fondos en paralelas", "series": 4, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el cuerpo recto y controla el movimiento para evitar lesiones.", "ejecucion": "Sujétate de las barras, baja el cuerpo flexionando los codos y luego empuja hacia arriba.", "errores_evitar": "No permitas que los codos se abran demasiado y evita balancearte."}}, {"notas": "Usar un agarre amplio para un mejor enfoque en la espalda.", "tempo": "3-1-1", "nombre": "Jalón al pecho", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Asegúrate de mantener los hombros hacia abajo y el pecho hacia adelante.", "ejecucion": "Sentado en la máquina, agarra la barra con un agarre amplio, tira de la barra hacia el pecho y controla el movimiento al volver.", "errores_evitar": "No arquees la espalda ni uses impulso al tirar."}}, {"notas": "Mantener los codos fijos durante todo el movimiento.", "tempo": "2-1-1", "nombre": "Curl de bíceps con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "No balancees el cuerpo y mantén los codos pegados al torso.", "ejecucion": "De pie, sostiene la barra con un agarre supino, flexiona los codos para llevar la barra hacia los hombros y baja controladamente.", "errores_evitar": "Evita levantar los codos al subir y no uses impulso."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Jue", "ejercicios": [{"notas": "Mantener la espalda recta durante el movimiento.", "tempo": "3-1-1", "nombre": "Zancadas con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10 por pierna", "informacion_detallada": {"consejos": "Asegúrate de que la rodilla delantera no sobrepase los dedos del pie.", "ejecucion": "Con la barra en la espalda, da un paso hacia adelante y baja la rodilla de la pierna trasera hacia el suelo, luego empuja hacia arriba.", "errores_evitar": "No arquees la espalda y evita que la rodilla trasera se desplace hacia un lado."}}, {"notas": "Ajustar el banco a un ángulo de aproximadamente 30-45 grados.", "tempo": "3-1-1", "nombre": "Press inclinado con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el core firme y evita que la espalda baja se arquee.", "ejecucion": "Sentado en el banco inclinado, sostiene las mancuernas a la altura de los hombros y empuja hacia arriba hasta que los brazos estén extendidos, luego baja controladamente.", "errores_evitar": "No permitas que las mancuernas se desplacen hacia afuera y evita lesiones en los hombros."}}, {"notas": "Ajustar el asiento para que los pies queden bien sujetos.", "tempo": "3-1-1", "nombre": "Remo en máquina", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Asegúrate de apretar los omóplatos al finalizar el movimiento.", "ejecucion": "Sentado en la máquina, agarra las manijas y tira hacia tu torso manteniendo la espalda recta.", "errores_evitar": "No arquees la espalda y evita que los codos se abran demasiado."}}, {"notas": "Mantener los codos cerca del cuerpo durante la ejecución.", "tempo": "2-1-1", "nombre": "Tríceps en polea", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén el cuerpo recto y activa el core para estabilidad.", "ejecucion": "De pie frente a la polea, agarra la barra con ambas manos y baja controladamente hasta que los brazos estén extendidos, luego regresa a la posición inicial.", "errores_evitar": "No arquees la espalda ni levantes los codos al realizar el movimiento."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 60, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Vie", "ejercicios": [{"notas": "Usar mancuernas para mayor resistencia.", "tempo": "3-1-1", "nombre": "Sentadilla búlgara", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10 por pierna", "informacion_detallada": {"consejos": "Mantén el torso recto y asegúrate de que la rodilla delantera no sobrepase los dedos del pie.", "ejecucion": "Coloca una pierna en un banco detrás de ti, baja el cuerpo flexionando la rodilla delantera y vuelve a subir.", "errores_evitar": "No arquees la espalda ni permitas que la rodilla trasera toque el suelo."}}, {"notas": "Controlar el movimiento tanto al subir como al bajar.", "tempo": "2-1-1", "nombre": "Elevaciones de hombros con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los brazos rectos y evita balancearte.", "ejecucion": "De pie, sostiene una mancuerna en cada mano a los lados y eleva los hombros hacia las orejas, luego baja lentamente.", "errores_evitar": "No permitas que los brazos se muevan y evita que el torso se incline hacia adelante."}}, {"notas": "Ajustar el peso a un nivel desafiante pero manejable.", "tempo": "3-1-1", "nombre": "Curl de piernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén el abdomen contraído y controla el movimiento para evitar lesiones.", "ejecucion": "Acostado en la máquina, flexiona las piernas hacia los glúteos y baja controladamente.", "errores_evitar": "No permitas que las piernas bajen demasiado rápido y evita que la espalda se levante del banco."}}, {"notas": "Mantener el cuerpo en línea recta.", "tempo": "static", "nombre": "Planchas laterales", "series": 3, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "30 segundos por lado", "informacion_detallada": {"consejos": "Activa el core y mantén los pies apilados para estabilidad.", "ejecucion": "Acostado de lado, apoya el codo y eleva el cuerpo manteniendo una línea recta desde la cabeza hasta los pies.", "errores_evitar": "No dejes que las caderas se hundan ni arquees la espalda."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}]}], "rationale": "El usuario tiene como objetivo principal ganar peso y es avanzado en entrenamiento, lo que permite un enfoque en hipertrofia con alta intensidad y volumen adecuado para maximizar la ganancia muscular.", "progresion": {"metodo": "carga", "detalle": "Aumentar el peso en cada ejercicio de 2 a 5 kg cada semana, manteniendo las repeticiones en el rango de hipertrofia."}, "validacion": {"semanas_ok": true, "descansos_validos": true, "rango_duracion_ok": true}, "perfil_echo": {"edad": 41, "peso": 76, "sexo": "M", "pecho": "", "brazos": "", "estatura": 183, "assumptions": {}, "medicamentos": "ninguno", "masa_muscular": "", "grasa_corporal": "", "nivel_actividad": "alto", "suplementación": "", "años_entrenando": 20, "objetivo_principal": "ganar_peso", "nivel_actual_entreno": "avanzado"}, "safety_notes": "", "selected_style": "Hipertrofia", "consideraciones": "", "frecuencia_por_semana": 5, "duracion_total_semanas": 1}	automatic	2025-08-28 16:28:58.925718+02	2025-08-28 16:28:58.925718+02	adapted	4	automatic
3	10	Hipertrofia	{"semanas": [{"semana": 1, "sesiones": [{"dia": "Lun", "ejercicios": [{"notas": "Enfocarse en la profundidad y la técnica.", "tempo": "3-1-1", "nombre": "Sentadilla con barra", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantener el pecho arriba y la espalda recta. Inhalar al bajar y exhalar al subir.", "ejecucion": "Colocar la barra sobre los trapecios, mantener los pies al ancho de los hombros. Bajar en cuclillas hasta que los muslos estén paralelos al suelo y luego volver a la posición inicial.", "errores_evitar": "No dejar que las rodillas se desplacen hacia adentro. Evitar levantar los talones del suelo."}}, {"notas": "Asegurarse que los pies estén firmes en el suelo.", "tempo": "2-0-1", "nombre": "Press de banca", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantener los codos a un ángulo de 45 grados respecto al torso. Inhalar al bajar y exhalar al subir.", "ejecucion": "Acostado en la banca, tomar la barra con un agarre un poco más ancho que los hombros. Bajar la barra hasta el pecho y luego presionar hacia arriba.", "errores_evitar": "No dejar que la barra rebote en el pecho. Evitar que los hombros se levanten del banco."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mar", "ejercicios": [{"notas": "Asegurarse de mantener la espalda recta.", "tempo": "2-1-1", "nombre": "Peso muerto", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activar el core antes de levantar y mantener la barra pegada al cuerpo.", "ejecucion": "Colocar la barra frente a las espinillas, con los pies al ancho de los hombros. Agacharse y tomar la barra, levantándola manteniendo los brazos rectos hasta que esté completamente erguido.", "errores_evitar": "No arquear la espalda al levantar. Evitar levantar los talones del suelo."}}, {"notas": "Usar un agarre amplio para mayor activación de espalda.", "tempo": "2-1-1", "nombre": "Dominadas", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activar la espalda antes de iniciar el movimiento y controlar el descenso.", "ejecucion": "Colgarse de una barra con las palmas mirando hacia adelante. Jalarse hacia arriba hasta que la barbilla sobrepase la barra.", "errores_evitar": "No balancearse. Evitar usar impulso para jalarse."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 65, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mie", "ejercicios": [{"notas": "Colocar los pies a la altura de los hombros.", "tempo": "3-1-1", "nombre": "Prensa de piernas", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantener la espalda apoyada y los pies firmemente en la plataforma.", "ejecucion": "Sentarse en la prensa, colocar los pies en la plataforma. Bajar la plataforma hacia el pecho y luego extender las piernas.", "errores_evitar": "No levantar los talones. Evitar que las rodillas se desplacen hacia los lados."}}, {"notas": "Mantener los codos fijos a los lados del cuerpo.", "tempo": "2-1-1", "nombre": "Curl de bíceps con barra", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "No mover el tronco, solo los brazos. Inhalar al bajar y exhalar al subir.", "ejecucion": "De pie, tomar la barra con un agarre supino y bajar los brazos. Flexionar los codos para llevar la barra hacia los hombros.", "errores_evitar": "No usar impulso. Evitar que los codos se desplacen hacia adelante."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 70, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Jue", "ejercicios": [{"notas": "Usar un agarre en pronación.", "tempo": "2-1-1", "nombre": "Extensiones de tríceps en polea", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantener los codos fijos y cerca del cuerpo.", "ejecucion": "Colocarse frente a la polea, tomar la barra con ambas manos. Extender los brazos hacia abajo.", "errores_evitar": "No dejar que los codos se muevan. Evitar usar impulso."}}, {"notas": "Mantener una ligera flexión en los codos.", "tempo": "2-1-1", "nombre": "Elevaciones laterales con mancuerna", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Controlar el movimiento y evitar balancearse.", "ejecucion": "De pie, tomar una mancuerna en cada mano. Levantar los brazos hacia los lados hasta que estén paralelos al suelo.", "errores_evitar": "No elevar los hombros. Evitar que los codos se extiendan totalmente."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Vie", "ejercicios": [{"notas": "Conservar la espalda recta durante todo el movimiento.", "tempo": "2-1-1", "nombre": "Remo con barra", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Inhalar al bajar y exhalar al subir. Mantener el core activo.", "ejecucion": "Inclinarse hacia adelante con las rodillas ligeramente flexionadas. Tirar de la barra hacia el abdomen.", "errores_evitar": "No redondear la espalda. Evitar usar impulso."}}, {"notas": "Ajustar el peso según sea necesario.", "tempo": "2-1-1", "nombre": "Fondos en paralelas", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantener el cuerpo recto y los codos cerca del cuerpo.", "ejecucion": "Colocarse entre las paralelas y bajar el cuerpo hasta que los codos estén en un ángulo de 90 grados.", "errores_evitar": "No dejar que los hombros se eleven. Evitar balancearse."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 70, "objetivo_de_la_sesion": "hipertrofia"}]}], "rationale": "El usuario tiene un objetivo de ganar peso y un nivel avanzado en entrenamiento, lo que hace que la metodología de Hipertrofia sea la más adecuada para aumentar la masa muscular de manera efectiva.", "progresion": {"metodo": "carga", "detalle": "Aumentar el peso en un 5-10% cada sesión según la capacidad del usuario."}, "validacion": {"semanas_ok": true, "descansos_validos": true, "rango_duracion_ok": true}, "perfil_echo": {"edad": 41, "peso": 76, "sexo": "M", "pecho": "", "brazos": "", "estatura": 183, "assumptions": {}, "medicamentos": "", "masa_muscular": "", "grasa_corporal": "", "nivel_actividad": "alto", "suplementación": "", "años_entrenando": 20, "objetivo_principal": "ganar_peso", "nivel_actual_entreno": "avanzado"}, "safety_notes": "", "selected_style": "Hipertrofia", "consideraciones": "El plan está diseñado para un usuario avanzado y se recomienda ajustar pesos según la capacidad individual y el estado de fatiga.", "frecuencia_por_semana": 5, "duracion_total_semanas": 1}	automatic	2025-08-29 08:23:35.007276+02	2025-08-29 08:23:35.007276+02	adapted	4	automatic
\.


--
-- TOC entry 5867 (class 0 OID 27739)
-- Dependencies: 305
-- Data for Name: music_playlists; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.music_playlists (id, user_id, name, tracks, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5865 (class 0 OID 27685)
-- Dependencies: 303
-- Data for Name: nutrition_goals; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.nutrition_goals (id, user_id, target_calories, target_protein, target_carbs, target_fat, target_fiber, goal_type, calculation_method, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5857 (class 0 OID 27593)
-- Dependencies: 295
-- Data for Name: nutrition_plans; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.nutrition_plans (id, user_id, plan_data, duration_days, target_calories, target_protein, target_carbs, target_fat, meals_per_day, methodology_focus, dietary_style, generation_mode, is_active, created_at, updated_at) FROM stdin;
1	10	{"daily_plans": [{"day": 1, "meals": [{"name": "Tostadas de aguacate con huevo", "time": "08:00", "meal_type": "desayuno", "nutrition": {"fat": 35, "carbs": 60, "fiber": 10, "protein": 25, "calories": 650}, "ingredients": [{"fat": 2, "food": "Pan integral", "carbs": 30, "amount": "2 rebanadas", "protein": 8, "calories": 160}, {"fat": 11, "food": "Aguacate", "carbs": 6, "amount": "1/2 unidad", "protein": 2, "calories": 120}, {"fat": 10, "food": "Huevo", "carbs": 0, "amount": "2 unidades", "protein": 12, "calories": 140}, {"fat": 4.5, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharadita", "protein": 0, "calories": 40}, {"fat": 0, "food": "Tomate", "carbs": 5, "amount": "1/2 unidad", "protein": 1, "calories": 20}], "preparation": {"steps": ["Tostar el pan y aplastar el aguacate en un tazón.", "Cocinar los huevos a tu gusto y servir sobre el pan con aguacate y rodajas de tomate."], "difficulty": "fácil", "time_minutes": 10}, "alternatives": ["Yogur griego con miel y frutas", "Batido de proteínas con plátano y espinaca"], "timing_notes": "Ideal para comenzar el día antes del entrenamiento."}, {"name": "Ensalada de garbanzos y atún", "time": "13:00", "meal_type": "almuerzo", "nutrition": {"fat": 25, "carbs": 80, "fiber": 15, "protein": 45, "calories": 750}, "ingredients": [{"fat": 4, "food": "Garbanzos cocidos", "carbs": 45, "amount": "1 taza", "protein": 15, "calories": 270}, {"fat": 1, "food": "Atún en agua", "carbs": 0, "amount": "1 lata", "protein": 25, "calories": 120}, {"fat": 0, "food": "Espinacas", "carbs": 2, "amount": "2 tazas", "protein": 2, "calories": 14}, {"fat": 14, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharada", "protein": 0, "calories": 120}, {"fat": 0, "food": "Limón", "carbs": 6, "amount": "1 unidad", "protein": 0, "calories": 20}], "preparation": {"steps": ["Mezclar todos los ingredientes en un tazón grande.", "Aliñar con limón y aceite de oliva."], "difficulty": "fácil", "time_minutes": 15}, "alternatives": ["Pollo asado con verduras", "Quinoa con verduras y garbanzos"], "timing_notes": "Comida ideal para recuperar energía después del entrenamiento."}, {"name": "Salmón al horno con espárragos", "time": "20:00", "meal_type": "cena", "nutrition": {"fat": 37, "carbs": 30, "fiber": 5, "protein": 45, "calories": 850}, "ingredients": [{"fat": 15, "food": "Salmón", "carbs": 0, "amount": "150g", "protein": 40, "calories": 280}, {"fat": 0, "food": "Espárragos", "carbs": 5, "amount": "1 taza", "protein": 3, "calories": 27}, {"fat": 14, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharada", "protein": 0, "calories": 120}, {"fat": 0, "food": "Patata", "carbs": 30, "amount": "150g", "protein": 2, "calories": 130}], "preparation": {"steps": ["Precalentar el horno a 200°C.", "Colocar el salmón y los espárragos en una bandeja, rociar con aceite de oliva y hornear durante 20 minutos."], "difficulty": "medio", "time_minutes": 25}, "alternatives": ["Pollo al horno con verduras", "Tofu salteado con verduras"], "timing_notes": "Ideal para una cena nutritiva y reparadora."}], "day_name": "Lunes", "training_day": true, "total_nutrition": {"fat": 62, "carbs": 225, "protein": 197, "calories": 2250}}, {"day": 2, "meals": [{"name": "Smoothie de espinaca y plátano", "time": "08:00", "meal_type": "desayuno", "nutrition": {"fat": 15, "carbs": 85, "fiber": 8, "protein": 25, "calories": 600}, "ingredients": [{"fat": 0, "food": "Espinaca", "carbs": 1, "amount": "1 taza", "protein": 1, "calories": 7}, {"fat": 0, "food": "Plátano", "carbs": 27, "amount": "1 unidad", "protein": 1, "calories": 100}, {"fat": 10, "food": "Yogur griego", "carbs": 10, "amount": "200g", "protein": 20, "calories": 200}, {"fat": 2.5, "food": "Leche de almendras", "carbs": 1, "amount": "1 taza", "protein": 1, "calories": 30}, {"fat": 4, "food": "Semillas de chía", "carbs": 5, "amount": "1 cucharada", "protein": 3, "calories": 60}], "preparation": {"steps": ["Mezclar todos los ingredientes en una licuadora hasta obtener una mezcla homogénea."], "difficulty": "fácil", "time_minutes": 5}, "alternatives": ["Avena cocida con frutas", "Tostadas de pan integral con mantequilla de almendra"], "timing_notes": "Perfecto para un pre-entrenamiento energético."}, {"name": "Pasta integral con verduras asadas", "time": "13:00", "meal_type": "almuerzo", "nutrition": {"fat": 20, "carbs": 100, "fiber": 12, "protein": 30, "calories": 750}, "ingredients": [{"fat": 2, "food": "Pasta integral", "carbs": 70, "amount": "100g", "protein": 12, "calories": 350}, {"fat": 0, "food": "Calabacín", "carbs": 4, "amount": "1 taza", "protein": 1, "calories": 20}, {"fat": 0, "food": "Pimiento rojo", "carbs": 5, "amount": "1/2 unidad", "protein": 1, "calories": 25}, {"fat": 0, "food": "Berenjena", "carbs": 4, "amount": "1/2 unidad", "protein": 0, "calories": 15}, {"fat": 14, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharada", "protein": 0, "calories": 120}], "preparation": {"steps": ["Cocinar la pasta según las instrucciones del paquete.", "Asar las verduras en el horno con aceite de oliva y mezclar con la pasta."], "difficulty": "medio", "time_minutes": 20}, "alternatives": ["Ensalada de quinoa con frijoles", "Wrap de pollo con verduras"], "timing_notes": "Buen aporte de carbohidratos para la recuperación."}, {"name": "Pescado a la plancha con brócoli", "time": "20:00", "meal_type": "cena", "nutrition": {"fat": 27, "carbs": 40, "fiber": 6, "protein": 42, "calories": 900}, "ingredients": [{"fat": 10, "food": "Pescado blanco", "carbs": 0, "amount": "200g", "protein": 40, "calories": 240}, {"fat": 1, "food": "Brócoli", "carbs": 11, "amount": "1 taza", "protein": 5, "calories": 55}, {"fat": 14, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharada", "protein": 0, "calories": 120}, {"fat": 1, "food": "Arroz integral", "carbs": 32, "amount": "150g", "protein": 3, "calories": 150}], "preparation": {"steps": ["Cocinar el pescado a la plancha y servir con brócoli al vapor y arroz integral."], "difficulty": "fácil", "time_minutes": 15}, "alternatives": ["Pollo al limón con espinacas", "Tofu a la plancha con verduras"], "timing_notes": "Ideal para una cena rica en proteínas."}], "day_name": "Martes", "training_day": true, "total_nutrition": {"fat": 62, "carbs": 225, "protein": 197, "calories": 2250}}, {"day": 3, "meals": [{"name": "Porridge de avena con frutos secos", "time": "08:00", "meal_type": "desayuno", "nutrition": {"fat": 20, "carbs": 90, "fiber": 10, "protein": 20, "calories": 600}, "ingredients": [{"fat": 7, "food": "Avena", "carbs": 60, "amount": "100g", "protein": 12, "calories": 370}, {"fat": 3, "food": "Leche de almendras", "carbs": 1, "amount": "1 taza", "protein": 1, "calories": 30}, {"fat": 15, "food": "Frutos secos", "carbs": 10, "amount": "30g", "protein": 6, "calories": 180}], "preparation": {"steps": ["Cocinar la avena en leche de almendras hasta que espese y agregar los frutos secos."], "difficulty": "fácil", "time_minutes": 10}, "alternatives": ["Tostadas de pan integral con aguacate y tomate", "Yogur con granola y frutas"], "timing_notes": "Un desayuno energético y lleno de fibra."}, {"name": "Bowl de quinoa con pollo", "time": "13:00", "meal_type": "almuerzo", "nutrition": {"fat": 25, "carbs": 80, "fiber": 12, "protein": 40, "calories": 750}, "ingredients": [{"fat": 2, "food": "Quinoa", "carbs": 21, "amount": "100g", "protein": 4, "calories": 120}, {"fat": 7, "food": "Pollo a la plancha", "carbs": 0, "amount": "150g", "protein": 50, "calories": 300}, {"fat": 0, "food": "Verduras mixtas", "carbs": 8, "amount": "1 taza", "protein": 2, "calories": 40}, {"fat": 14, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharada", "protein": 0, "calories": 120}], "preparation": {"steps": ["Cocinar la quinoa y mezclar con el pollo y las verduras.", "Aliñar con aceite de oliva."], "difficulty": "medio", "time_minutes": 20}, "alternatives": ["Ensalada de atún con garbanzos", "Wrap de pollo con verduras"], "timing_notes": "Comida completa y equilibrada."}, {"name": "Tortilla de espinacas y champiñones", "time": "20:00", "meal_type": "cena", "nutrition": {"fat": 37, "carbs": 55, "fiber": 5, "protein": 37, "calories": 900}, "ingredients": [{"fat": 15, "food": "Huevo", "carbs": 0, "amount": "3 unidades", "protein": 18, "calories": 210}, {"fat": 0, "food": "Espinacas", "carbs": 1, "amount": "1 taza", "protein": 1, "calories": 7}, {"fat": 0, "food": "Champiñones", "carbs": 2, "amount": "1 taza", "protein": 2, "calories": 15}, {"fat": 14, "food": "Aceite de oliva", "carbs": 0, "amount": "1 cucharada", "protein": 0, "calories": 120}, {"fat": 6, "food": "Queso feta", "carbs": 1, "amount": "30g", "protein": 5, "calories": 80}], "preparation": {"steps": ["Batir los huevos y agregar espinacas y champiñones salteados.", "Cocinar en una sartén hasta que cuaje."], "difficulty": "medio", "time_minutes": 20}, "alternatives": ["Pescado al horno con espárragos", "Pollo salteado con verduras"], "timing_notes": "Ideal para una cena ligera y nutritiva."}], "day_name": "Miércoles", "training_day": false, "total_nutrition": {"fat": 62, "carbs": 225, "protein": 197, "calories": 2250}}], "plan_summary": {"dietary_style": "mediterranean", "duration_days": 3, "meals_per_day": 3, "target_macros": {"fat": 62, "carbs": 225, "protein": 197}, "target_calories": 2250, "methodology_focus": "general"}, "shopping_list": {"fats": ["Aceite de oliva", "Frutos secos", "Aguacate"], "carbs": ["Pan integral", "Pasta integral", "Quinoa", "Avena", "Garbanzos"], "others": ["Leche de almendras", "Limón", "Semillas de chía"], "proteins": ["Atún", "Salmón", "Pollo", "Huevo", "Yogur griego"], "vegetables": ["Espinacas", "Brócoli", "Calabacín", "Pimiento rojo", "Champiñones"]}, "meal_prep_tips": ["Prepara los ingredientes con antelación, como lavar y cortar verduras.", "Cocina porciones grandes de proteínas y guárdalas para la semana.", "Utiliza recipientes herméticos para almacenar comidas y mantener la frescura."], "important_notes": ["Consulta a un médico o nutricionista si tienes alguna condición médica.", "Prioriza la variedad en tu dieta para asegurar una ingesta adecuada de nutrientes."], "progress_monitoring": {"weekly_weigh_ins": "Pesarte cada semana en el mismo día y hora.", "body_measurements": "Tomar medidas de cintura y caderas cada dos semanas.", "adjustment_criteria": "Ajustar el plan si no se ven resultados en 4 semanas.", "performance_markers": "Registrar el rendimiento en el entrenamiento, como repeticiones y pesos."}, "training_integration": {"hydration_strategy": "Asegúrate de beber al menos 2 litros de agua al día.", "pre_workout_timing": "1-2 horas antes del entrenamiento.", "post_workout_timing": "Dentro de 30 minutos después del entrenamiento.", "rest_day_adjustments": "Mantener una ingesta similar, ajustando ligeramente los carbohidratos."}, "supplement_recommendations": [{"name": "Proteína de suero", "dosage": "30g", "reason": "Ayuda a la recuperación muscular y asegura una ingesta adecuada de proteínas.", "timing": "Post-entrenamiento", "priority": "high"}, {"name": "Omega-3", "dosage": "1000mg", "reason": "Promueve la salud cardiovascular y reduce la inflamación.", "timing": "Con la comida", "priority": "medium"}]}	3	2250	197.00	225.00	62.00	3	general	mediterranean	ai_generated	t	2025-08-26 22:28:28.638002+02	2025-08-26 22:28:28.638002+02
\.


--
-- TOC entry 5853 (class 0 OID 27405)
-- Dependencies: 284
-- Data for Name: routine_exercise_feedback; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.routine_exercise_feedback (id, user_id, routine_session_id, exercise_order, exercise_name, sentiment, comment, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5851 (class 0 OID 27380)
-- Dependencies: 282
-- Data for Name: routine_exercise_progress; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.routine_exercise_progress (id, user_id, routine_session_id, exercise_order, exercise_name, status, series_completed, series_total, time_spent_seconds, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5847 (class 0 OID 27336)
-- Dependencies: 278
-- Data for Name: routine_plans; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.routine_plans (id, user_id, methodology_type, plan_data, generation_mode, frequency_per_week, total_weeks, created_at, updated_at, is_active, archived_at) FROM stdin;
20	10	Hipertrofia	{"semanas": [{"semana": 1, "sesiones": [{"dia": "Lun", "ejercicios": [{"notas": "Enfocar en la técnica y el control", "tempo": "2-1-1", "nombre": "Sentadilla búlgara", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el torso erguido y el peso en el talón de la pierna delantera. Respira profundamente antes de bajar y exhala al subir.", "ejecucion": "Coloca una pierna detrás de ti en un banco o plataforma. Mantén la otra pierna firme en el suelo. Baja el cuerpo hasta que la rodilla casi toque el suelo y luego regresa a la posición inicial.", "errores_evitar": "No inclines el torso hacia adelante. Evita que la rodilla de la pierna delantera sobrepase los dedos del pie."}}, {"notas": "Enfocar en la activación del pectoral inferior", "tempo": "2-0-1", "nombre": "Press de banca declinado", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén los pies firmes en el banco y evita levantar el torso durante el ejercicio. Inhala al bajar y exhala al subir.", "ejecucion": "Acuéstate en un banco declinado y sujeta la barra con un agarre ligeramente más ancho que los hombros. Baja la barra hacia el pecho y empuja hacia arriba hasta la extensión completa de los brazos.", "errores_evitar": "No dejes caer la barra rápidamente. Evita que los codos se abran demasiado al bajar."}}, {"notas": "Priorizar la contracción en la parte superior", "tempo": "2-1-1", "nombre": "Remo con mancuerna a una mano", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el tronco estable y evita rotar el torso al levantar la mancuerna. Controla el movimiento tanto al subir como al bajar.", "ejecucion": "Apoya una rodilla y una mano en un banco. Con la otra mano, sujeta la mancuerna y tira hacia tu cadera, manteniendo el codo cerca del cuerpo.", "errores_evitar": "No arquees la espalda durante el ejercicio. Evita usar un peso que te comprometa la técnica."}}, {"notas": "Controlar el movimiento para maximizar la activación del gemelo", "tempo": "2-0-1", "nombre": "Elevaciones de talones sentado", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén el movimiento controlado y evita usar impulso. Exhala al levantar y inhala al bajar.", "ejecucion": "Siéntate en la máquina de elevación de talones con las piernas en posición de 90 grados. Levanta los talones lo más alto posible y luego baja lentamente.", "errores_evitar": "No arquees la espalda. Evita que las rodillas se muevan durante el ejercicio."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mar", "ejercicios": [{"notas": "Centrarse en la activación de los isquiotibiales", "tempo": "2-1-1", "nombre": "Peso muerto con piernas rígidas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén la espalda recta durante todo el movimiento. Inhala al bajar y exhala al subir.", "ejecucion": "Con los pies a la altura de los hombros, baja la barra manteniendo las piernas casi rectas, flexionando solo ligeramente las rodillas. Regresa a la posición inicial apretando los glúteos.", "errores_evitar": "No arquees la espalda. Evita bajar la barra demasiado rápido."}}, {"notas": "Asegurarse de la correcta alineación de los brazos", "tempo": "2-1-1", "nombre": "Press militar con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén los pies firmes en el suelo y controla el movimiento. Inhala al bajar y exhala al subir.", "ejecucion": "Siéntate en un banco con respaldo, sujeta las mancuernas a la altura de los hombros y presiona hacia arriba hasta extender completamente los brazos.", "errores_evitar": "No arquees la espalda. Evita que los codos se abran demasiado hacia los lados."}}, {"notas": "Enfocar en la parte superior de la espalda", "tempo": "2-1-1", "nombre": "Dominadas con agarre amplio", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el cuerpo recto y evita balancearte. Inhala al bajar y exhala al subir.", "ejecucion": "Sujeta la barra con un agarre más ancho que los hombros. Tira de tu cuerpo hacia arriba hasta que la barbilla supere la barra.", "errores_evitar": "No arquees la espalda. Evita que los hombros suban hacia las orejas."}}, {"notas": "Enfocar en el pectoral y tríceps", "tempo": "2-1-1", "nombre": "Fondos en paralelas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el cuerpo recto y los codos cerca del torso. Inhala al bajar y exhala al subir.", "ejecucion": "Con las manos en las paralelas, baja el cuerpo flexionando los codos y regresa a la posición inicial manteniendo el control.", "errores_evitar": "No dejes caer el cuerpo rápidamente. Evita que los hombros se encogen."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 60, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mie", "ejercicios": [{"notas": "Ganar fuerza en la parte frontal de las piernas", "tempo": "2-1-1", "nombre": "Sentadilla frontal con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el torso erguido y el peso en los talones. Inhala al bajar y exhala al subir.", "ejecucion": "Coloca la barra en la parte frontal de los hombros, con los codos hacia arriba. Baja el cuerpo en una sentadilla y regresa a la posición inicial.", "errores_evitar": "No dejes caer la barra. Evita que las rodillas se desplacen hacia adentro."}}, {"notas": "Enfocar en el tríceps", "tempo": "2-0-1", "nombre": "Press de banca con agarre cerrado", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén los codos cerca del torso y controla el movimiento. Inhala al bajar y exhala al subir.", "ejecucion": "Acuéstate en un banco y coloca las manos en la barra a la altura de los hombros. Baja la barra hacia el pecho y empuja hacia arriba.", "errores_evitar": "No arquees la espalda. Evita que la barra se desplace hacia los lados."}}, {"notas": "Enfocar en la parte media de la espalda", "tempo": "2-1-1", "nombre": "Remo con barra T", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el torso estable y evita balancearte. Inhala al bajar y exhala al subir.", "ejecucion": "Coloca la barra en el suelo y sujeta con ambas manos. Tira de la barra hacia tu pecho mientras mantienes la espalda recta.", "errores_evitar": "No arquees la espalda. Evita que los codos se abran demasiado."}}, {"notas": "Enfocar en los deltoides laterales", "tempo": "2-1-1", "nombre": "Elevaciones laterales con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Evita usar impulso y mantén los codos ligeramente doblados. Inhala al bajar y exhala al subir.", "ejecucion": "Con una mancuerna en cada mano, inclina ligeramente el torso hacia adelante y levanta las mancuernas hacia los lados hasta la altura de los hombros.", "errores_evitar": "No arquees la espalda. Evita que las mancuernas se desplacen hacia adelante o atrás."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Jue", "ejercicios": [{"notas": "Enfocar en la activación de toda la cadena posterior", "tempo": "2-1-1", "nombre": "Peso muerto convencional", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el peso en los talones y controla el movimiento. Inhala al bajar y exhala al levantar.", "ejecucion": "Coloca los pies a la altura de los hombros, sujeta la barra y levántala manteniendo la espalda recta y las caderas hacia adelante.", "errores_evitar": "No arquees la espalda. Evita que las caderas suban antes que el torso."}}, {"notas": "Aislar el bíceps para maximizar la activación", "tempo": "2-1-1", "nombre": "Curl de bíceps con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los codos pegados al torso y evita balancearte. Inhala al bajar y exhala al subir.", "ejecucion": "De pie, sujeta la barra con las palmas hacia arriba. Flexiona los codos y lleva la barra hacia los hombros.", "errores_evitar": "No arquees la espalda. Evita usar impulso para levantar la barra."}}, {"notas": "Enfocar en la contracción del tríceps", "tempo": "2-1-1", "nombre": "Extensiones de tríceps en polea alta", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los codos fijos y controla el movimiento. Inhala al bajar y exhala al empujar.", "ejecucion": "Sujeta la barra de la polea alta con las manos y empuja hacia abajo hasta extender completamente los brazos.", "errores_evitar": "No arquees la espalda. Evita que los codos se muevan durante el ejercicio."}}, {"notas": "Mantener la estabilización del core", "tempo": "3-1-1", "nombre": "Planchas laterales", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "30 seg", "informacion_detallada": {"consejos": "Activa el abdomen y los glúteos. Respira profundamente y controla la posición.", "ejecucion": "Apóyate sobre un codo y el lateral del pie, manteniendo el cuerpo recto. Mantén la posición el tiempo indicado.", "errores_evitar": "No dejes caer la cadera. Evita que el cuerpo se arquee."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 60, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Vie", "ejercicios": [{"notas": "Enfocar en la fuerza de las piernas", "tempo": "2-1-1", "nombre": "Zancadas con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el torso erguido y evita que la rodilla delantera sobrepase los dedos del pie. Inhala al bajar y exhala al subir.", "ejecucion": "Coloca la barra en la parte posterior de los hombros y da un paso hacia adelante, bajando la rodilla trasera hacia el suelo.", "errores_evitar": "No arquees la espalda. Evita que las rodillas se desplacen hacia adentro."}}, {"notas": "Aislar el pecho con un rango de movimiento controlado", "tempo": "2-1-1", "nombre": "Press de pecho con mancuernas en el suelo", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén los codos ligeramente doblados y controla el movimiento. Inhala al bajar y exhala al subir.", "ejecucion": "Acuéstate en el suelo con una mancuerna en cada mano. Presiona las mancuernas hacia arriba hasta que los brazos estén extendidos.", "errores_evitar": "No dejes caer las mancuernas rápidamente. Evita que los codos se abran demasiado."}}, {"notas": "Aislar la espalda media", "tempo": "2-1-1", "nombre": "Remo en máquina", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén la espalda recta y controla la velocidad. Inhala al extender y exhala al tirar.", "ejecucion": "Siéntate en la máquina de remo y sujeta las manijas. Tira hacia ti, llevando los codos hacia atrás.", "errores_evitar": "No arquees la espalda. Evita que los codos se muevan hacia afuera."}}, {"notas": "Controlar la activación del músculo sóleo", "tempo": "2-0-1", "nombre": "Elevaciones de talones en máquina", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén el movimiento controlado y evita el impulso. Inhala al bajar y exhala al subir.", "ejecucion": "Siéntate en la máquina con los pies en la plataforma. Eleva los talones lo más alto posible y baja lentamente.", "errores_evitar": "No arquees la espalda. Evita que las rodillas se muevan durante el ejercicio."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}]}], "rationale": "Se elige Hipertrofia debido al objetivo principal de ganar peso y al nivel avanzado del usuario. La metodología permite un alto volumen y variedad de ejercicios para maximizar la ganancia muscular en una única semana de entrenamiento intensivo.", "progresion": {"metodo": "carga", "detalle": "Aumentar el peso utilizado en cada ejercicio en un 5-10% respecto a la semana anterior, si es posible, manteniendo la misma cantidad de repeticiones."}, "validacion": {"semanas_ok": true, "descansos_validos": true, "rango_duracion_ok": true}, "perfil_echo": {"edad": 41, "peso": 76, "sexo": "M", "pecho": "", "brazos": "", "estatura": 183, "assumptions": {}, "medicamentos": "", "masa_muscular": "", "grasa_corporal": "", "nivel_actividad": "alto", "suplementación": "", "años_entrenando": 20, "objetivo_principal": "ganar_peso", "nivel_actual_entreno": "avanzado"}, "safety_notes": "", "selected_style": "Hipertrofia", "consideraciones": "", "frecuencia_por_semana": 5, "duracion_total_semanas": 1}	automatic	\N	\N	2025-08-28 13:53:21.28186	2025-08-28 16:25:20.511599	t	2025-08-28 16:25:20.511599+02
21	10	Hipertrofia	{"semanas": [{"semana": 1, "sesiones": [{"dia": "Lun", "ejercicios": [{"notas": "Mantener la espalda recta y bajar hasta que los muslos estén paralelos al suelo.", "tempo": "3-1-1", "nombre": "Sentadilla con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Aprieta el core para estabilizar la espalda, mantén el pecho hacia arriba y el peso en los talones para un mejor equilibrio.", "ejecucion": "Coloca la barra en la parte superior de la espalda, separa los pies a la altura de los hombros, baja flexionando las rodillas y caderas hasta que los muslos estén paralelos al suelo, luego regresa a la posición inicial.", "errores_evitar": "Evita que las rodillas sobrepasen la línea de los dedos de los pies y no arquees la espalda al bajar."}}, {"notas": "Asegúrate de mantener los pies apoyados en el suelo y la espalda plana contra el banco.", "tempo": "3-1-1", "nombre": "Press de banca", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Inhala al bajar y exhala al empujar, mantén los codos en un ángulo de 45 grados con respecto al torso.", "ejecucion": "Acostado en el banco, agarra la barra con las manos un poco más anchas que los hombros, baja la barra hasta el pecho y empuja hacia arriba hasta extender completamente los brazos.", "errores_evitar": "No arquees la espalda ni levantes los pies del suelo durante el movimiento."}}, {"notas": "Mantén la barra cerca de las piernas durante el levantamiento.", "tempo": "3-1-1", "nombre": "Peso muerto", "series": 4, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Activa los glúteos y los isquiotibiales al levantarte, y asegúrate de no redondear la espalda.", "ejecucion": "Coloca la barra sobre el suelo, separa los pies a la altura de los hombros, agáchate con la espalda recta y agarra la barra. Levanta manteniendo la barra cerca del cuerpo hasta quedar de pie.", "errores_evitar": "No levantes los hombros antes que las caderas y evita que la barra se aleje de las piernas."}}, {"notas": "Usar un agarre amplio para trabajar más los dorsales.", "tempo": "2-1-1", "nombre": "Dominadas", "series": 3, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el core activado y evita balancearte al subir.", "ejecucion": "Cuelga de la barra con un agarre amplio, tira de tu cuerpo hacia arriba hasta que la barbilla sobrepase la barra y baja controladamente.", "errores_evitar": "No arquees la espalda ni uses impulso para subir."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mar", "ejercicios": [{"notas": "Ajustar la posición de los pies para variar el enfoque muscular.", "tempo": "3-1-1", "nombre": "Prensa de piernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén la espalda apoyada y asegúrate de que las rodillas no sobrepasen los dedos de los pies.", "ejecucion": "Sentado en la prensa, coloca los pies en la plataforma y baja el peso flexionando las rodillas, luego empuja hacia arriba.", "errores_evitar": "No bloquees las rodillas al final del movimiento ni arquees la espalda."}}, {"notas": "Mantener la espalda recta durante el movimiento.", "tempo": "3-1-1", "nombre": "Remo con barra", "series": 4, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Exhala al tirar de la barra y asegúrate de apretar los omóplatos al final del movimiento.", "ejecucion": "Con las rodillas ligeramente flexionadas, inclina el torso hacia adelante y tira de la barra hacia el abdomen, manteniendo los codos cerca del cuerpo.", "errores_evitar": "No redondees la espalda y evita que los codos se abran demasiado."}}, {"notas": "Asegúrate de que los pies estén firmes en el suelo.", "tempo": "3-1-1", "nombre": "Press militar", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el core apretado y evita arquear la espalda al levantar la barra.", "ejecucion": "De pie, sostiene la barra a la altura de los hombros y empuja hacia arriba hasta que los brazos estén completamente extendidos, luego baja controladamente.", "errores_evitar": "No uses impulso de las piernas y evita que la barra se desplace hacia adelante o atrás."}}, {"notas": "Usar una plataforma para mayor rango de movimiento.", "tempo": "2-1-1", "nombre": "Elevaciones de talones", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los pies alineados y controla el movimiento tanto al subir como al bajar.", "ejecucion": "De pie sobre una plataforma, eleva los talones lo más alto posible y baja por debajo de la línea de la plataforma.", "errores_evitar": "No permitas que los talones bajen demasiado rápido y evita que te inclines hacia adelante."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 60, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mie", "ejercicios": [{"notas": "Mantener la barra en la parte frontal de los hombros.", "tempo": "3-1-1", "nombre": "Sentadilla frontal", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el torso erguido y el core apretado para estabilidad.", "ejecucion": "Coloca la barra sobre la parte frontal de los hombros, separa los pies a la altura de los hombros y baja flexionando las rodillas, luego vuelve a levantarte.", "errores_evitar": "No dejes que el torso se incline hacia adelante y evita que las rodillas se desplacen hacia adentro."}}, {"notas": "Inclinarse ligeramente hacia adelante para enfatizar los pectorales.", "tempo": "3-1-1", "nombre": "Fondos en paralelas", "series": 4, "intensidad": "RPE 9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Mantén el cuerpo recto y controla el movimiento para evitar lesiones.", "ejecucion": "Sujétate de las barras, baja el cuerpo flexionando los codos y luego empuja hacia arriba.", "errores_evitar": "No permitas que los codos se abran demasiado y evita balancearte."}}, {"notas": "Usar un agarre amplio para un mejor enfoque en la espalda.", "tempo": "3-1-1", "nombre": "Jalón al pecho", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Asegúrate de mantener los hombros hacia abajo y el pecho hacia adelante.", "ejecucion": "Sentado en la máquina, agarra la barra con un agarre amplio, tira de la barra hacia el pecho y controla el movimiento al volver.", "errores_evitar": "No arquees la espalda ni uses impulso al tirar."}}, {"notas": "Mantener los codos fijos durante todo el movimiento.", "tempo": "2-1-1", "nombre": "Curl de bíceps con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "No balancees el cuerpo y mantén los codos pegados al torso.", "ejecucion": "De pie, sostiene la barra con un agarre supino, flexiona los codos para llevar la barra hacia los hombros y baja controladamente.", "errores_evitar": "Evita levantar los codos al subir y no uses impulso."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Jue", "ejercicios": [{"notas": "Mantener la espalda recta durante el movimiento.", "tempo": "3-1-1", "nombre": "Zancadas con barra", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10 por pierna", "informacion_detallada": {"consejos": "Asegúrate de que la rodilla delantera no sobrepase los dedos del pie.", "ejecucion": "Con la barra en la espalda, da un paso hacia adelante y baja la rodilla de la pierna trasera hacia el suelo, luego empuja hacia arriba.", "errores_evitar": "No arquees la espalda y evita que la rodilla trasera se desplace hacia un lado."}}, {"notas": "Ajustar el banco a un ángulo de aproximadamente 30-45 grados.", "tempo": "3-1-1", "nombre": "Press inclinado con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantén el core firme y evita que la espalda baja se arquee.", "ejecucion": "Sentado en el banco inclinado, sostiene las mancuernas a la altura de los hombros y empuja hacia arriba hasta que los brazos estén extendidos, luego baja controladamente.", "errores_evitar": "No permitas que las mancuernas se desplacen hacia afuera y evita lesiones en los hombros."}}, {"notas": "Ajustar el asiento para que los pies queden bien sujetos.", "tempo": "3-1-1", "nombre": "Remo en máquina", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Asegúrate de apretar los omóplatos al finalizar el movimiento.", "ejecucion": "Sentado en la máquina, agarra las manijas y tira hacia tu torso manteniendo la espalda recta.", "errores_evitar": "No arquees la espalda y evita que los codos se abran demasiado."}}, {"notas": "Mantener los codos cerca del cuerpo durante la ejecución.", "tempo": "2-1-1", "nombre": "Tríceps en polea", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén el cuerpo recto y activa el core para estabilidad.", "ejecucion": "De pie frente a la polea, agarra la barra con ambas manos y baja controladamente hasta que los brazos estén extendidos, luego regresa a la posición inicial.", "errores_evitar": "No arquees la espalda ni levantes los codos al realizar el movimiento."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 60, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Vie", "ejercicios": [{"notas": "Usar mancuernas para mayor resistencia.", "tempo": "3-1-1", "nombre": "Sentadilla búlgara", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "8-10 por pierna", "informacion_detallada": {"consejos": "Mantén el torso recto y asegúrate de que la rodilla delantera no sobrepase los dedos del pie.", "ejecucion": "Coloca una pierna en un banco detrás de ti, baja el cuerpo flexionando la rodilla delantera y vuelve a subir.", "errores_evitar": "No arquees la espalda ni permitas que la rodilla trasera toque el suelo."}}, {"notas": "Controlar el movimiento tanto al subir como al bajar.", "tempo": "2-1-1", "nombre": "Elevaciones de hombros con mancuernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén los brazos rectos y evita balancearte.", "ejecucion": "De pie, sostiene una mancuerna en cada mano a los lados y eleva los hombros hacia las orejas, luego baja lentamente.", "errores_evitar": "No permitas que los brazos se muevan y evita que el torso se incline hacia adelante."}}, {"notas": "Ajustar el peso a un nivel desafiante pero manejable.", "tempo": "3-1-1", "nombre": "Curl de piernas", "series": 4, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantén el abdomen contraído y controla el movimiento para evitar lesiones.", "ejecucion": "Acostado en la máquina, flexiona las piernas hacia los glúteos y baja controladamente.", "errores_evitar": "No permitas que las piernas bajen demasiado rápido y evita que la espalda se levante del banco."}}, {"notas": "Mantener el cuerpo en línea recta.", "tempo": "static", "nombre": "Planchas laterales", "series": 3, "intensidad": "RPE 8", "descanso_seg": 60, "repeticiones": "30 segundos por lado", "informacion_detallada": {"consejos": "Activa el core y mantén los pies apilados para estabilidad.", "ejecucion": "Acostado de lado, apoya el codo y eleva el cuerpo manteniendo una línea recta desde la cabeza hasta los pies.", "errores_evitar": "No dejes que las caderas se hundan ni arquees la espalda."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}]}], "rationale": "El usuario tiene como objetivo principal ganar peso y es avanzado en entrenamiento, lo que permite un enfoque en hipertrofia con alta intensidad y volumen adecuado para maximizar la ganancia muscular.", "progresion": {"metodo": "carga", "detalle": "Aumentar el peso en cada ejercicio de 2 a 5 kg cada semana, manteniendo las repeticiones en el rango de hipertrofia."}, "validacion": {"semanas_ok": true, "descansos_validos": true, "rango_duracion_ok": true}, "perfil_echo": {"edad": 41, "peso": 76, "sexo": "M", "pecho": "", "brazos": "", "estatura": 183, "assumptions": {}, "medicamentos": "ninguno", "masa_muscular": "", "grasa_corporal": "", "nivel_actividad": "alto", "suplementación": "", "años_entrenando": 20, "objetivo_principal": "ganar_peso", "nivel_actual_entreno": "avanzado"}, "safety_notes": "", "selected_style": "Hipertrofia", "consideraciones": "", "frecuencia_por_semana": 5, "duracion_total_semanas": 1}	automatic	5	1	2025-08-28 16:28:58.937051	2025-08-28 16:48:33.061049	f	2025-08-28 16:48:33.061049+02
22	10	Hipertrofia	{"semanas": [{"semana": 1, "sesiones": [{"dia": "Lun", "ejercicios": [{"notas": "Enfocarse en la profundidad y la técnica.", "tempo": "3-1-1", "nombre": "Sentadilla con barra", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantener el pecho arriba y la espalda recta. Inhalar al bajar y exhalar al subir.", "ejecucion": "Colocar la barra sobre los trapecios, mantener los pies al ancho de los hombros. Bajar en cuclillas hasta que los muslos estén paralelos al suelo y luego volver a la posición inicial.", "errores_evitar": "No dejar que las rodillas se desplacen hacia adentro. Evitar levantar los talones del suelo."}}, {"notas": "Asegurarse que los pies estén firmes en el suelo.", "tempo": "2-0-1", "nombre": "Press de banca", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantener los codos a un ángulo de 45 grados respecto al torso. Inhalar al bajar y exhalar al subir.", "ejecucion": "Acostado en la banca, tomar la barra con un agarre un poco más ancho que los hombros. Bajar la barra hasta el pecho y luego presionar hacia arriba.", "errores_evitar": "No dejar que la barra rebote en el pecho. Evitar que los hombros se levanten del banco."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mar", "ejercicios": [{"notas": "Asegurarse de mantener la espalda recta.", "tempo": "2-1-1", "nombre": "Peso muerto", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activar el core antes de levantar y mantener la barra pegada al cuerpo.", "ejecucion": "Colocar la barra frente a las espinillas, con los pies al ancho de los hombros. Agacharse y tomar la barra, levantándola manteniendo los brazos rectos hasta que esté completamente erguido.", "errores_evitar": "No arquear la espalda al levantar. Evitar levantar los talones del suelo."}}, {"notas": "Usar un agarre amplio para mayor activación de espalda.", "tempo": "2-1-1", "nombre": "Dominadas", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "6-8", "informacion_detallada": {"consejos": "Activar la espalda antes de iniciar el movimiento y controlar el descenso.", "ejecucion": "Colgarse de una barra con las palmas mirando hacia adelante. Jalarse hacia arriba hasta que la barbilla sobrepase la barra.", "errores_evitar": "No balancearse. Evitar usar impulso para jalarse."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 65, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Mie", "ejercicios": [{"notas": "Colocar los pies a la altura de los hombros.", "tempo": "3-1-1", "nombre": "Prensa de piernas", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantener la espalda apoyada y los pies firmemente en la plataforma.", "ejecucion": "Sentarse en la prensa, colocar los pies en la plataforma. Bajar la plataforma hacia el pecho y luego extender las piernas.", "errores_evitar": "No levantar los talones. Evitar que las rodillas se desplacen hacia los lados."}}, {"notas": "Mantener los codos fijos a los lados del cuerpo.", "tempo": "2-1-1", "nombre": "Curl de bíceps con barra", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "No mover el tronco, solo los brazos. Inhalar al bajar y exhalar al subir.", "ejecucion": "De pie, tomar la barra con un agarre supino y bajar los brazos. Flexionar los codos para llevar la barra hacia los hombros.", "errores_evitar": "No usar impulso. Evitar que los codos se desplacen hacia adelante."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 70, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Jue", "ejercicios": [{"notas": "Usar un agarre en pronación.", "tempo": "2-1-1", "nombre": "Extensiones de tríceps en polea", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Mantener los codos fijos y cerca del cuerpo.", "ejecucion": "Colocarse frente a la polea, tomar la barra con ambas manos. Extender los brazos hacia abajo.", "errores_evitar": "No dejar que los codos se muevan. Evitar usar impulso."}}, {"notas": "Mantener una ligera flexión en los codos.", "tempo": "2-1-1", "nombre": "Elevaciones laterales con mancuerna", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "10-12", "informacion_detallada": {"consejos": "Controlar el movimiento y evitar balancearse.", "ejecucion": "De pie, tomar una mancuerna en cada mano. Levantar los brazos hacia los lados hasta que estén paralelos al suelo.", "errores_evitar": "No elevar los hombros. Evitar que los codos se extiendan totalmente."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 75, "objetivo_de_la_sesion": "hipertrofia"}, {"dia": "Vie", "ejercicios": [{"notas": "Conservar la espalda recta durante todo el movimiento.", "tempo": "2-1-1", "nombre": "Remo con barra", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Inhalar al bajar y exhalar al subir. Mantener el core activo.", "ejecucion": "Inclinarse hacia adelante con las rodillas ligeramente flexionadas. Tirar de la barra hacia el abdomen.", "errores_evitar": "No redondear la espalda. Evitar usar impulso."}}, {"notas": "Ajustar el peso según sea necesario.", "tempo": "2-1-1", "nombre": "Fondos en paralelas", "series": 4, "intensidad": "RPE 8-9", "descanso_seg": 60, "repeticiones": "8-10", "informacion_detallada": {"consejos": "Mantener el cuerpo recto y los codos cerca del cuerpo.", "ejecucion": "Colocarse entre las paralelas y bajar el cuerpo hasta que los codos estén en un ángulo de 90 grados.", "errores_evitar": "No dejar que los hombros se eleven. Evitar balancearse."}}], "intensidad_guia": "RPE 8-9", "duracion_sesion_min": 70, "objetivo_de_la_sesion": "hipertrofia"}]}], "rationale": "El usuario tiene un objetivo de ganar peso y un nivel avanzado en entrenamiento, lo que hace que la metodología de Hipertrofia sea la más adecuada para aumentar la masa muscular de manera efectiva.", "progresion": {"metodo": "carga", "detalle": "Aumentar el peso en un 5-10% cada sesión según la capacidad del usuario."}, "validacion": {"semanas_ok": true, "descansos_validos": true, "rango_duracion_ok": true}, "perfil_echo": {"edad": 41, "peso": 76, "sexo": "M", "pecho": "", "brazos": "", "estatura": 183, "assumptions": {}, "medicamentos": "", "masa_muscular": "", "grasa_corporal": "", "nivel_actividad": "alto", "suplementación": "", "años_entrenando": 20, "objetivo_principal": "ganar_peso", "nivel_actual_entreno": "avanzado"}, "safety_notes": "", "selected_style": "Hipertrofia", "consideraciones": "El plan está diseñado para un usuario avanzado y se recomienda ajustar pesos según la capacidad individual y el estado de fatiga.", "frecuencia_por_semana": 5, "duracion_total_semanas": 1}	automatic	5	1	2025-08-29 08:23:35.053286	2025-08-29 08:23:35.053286	t	\N
\.


--
-- TOC entry 5849 (class 0 OID 27354)
-- Dependencies: 280
-- Data for Name: routine_sessions; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.routine_sessions (id, user_id, routine_plan_id, week_number, day_name, session_date, status, started_at, completed_at, total_duration_seconds, exercises_data, created_at, updated_at, total_exercises, exercises_completed) FROM stdin;
114	10	21	1	Lun	2025-08-28	pending	\N	\N	0	\N	2025-08-28 16:47:08.077208	2025-08-28 16:47:16.808455	0	0
\.


--
-- TOC entry 5863 (class 0 OID 27664)
-- Dependencies: 301
-- Data for Name: supplement_recommendations; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.supplement_recommendations (id, user_id, supplement_name, dosage, timing, reason, priority, methodology_focus, purchase_link, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5837 (class 0 OID 27218)
-- Dependencies: 267
-- Data for Name: technique_analysis; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.technique_analysis (id, user_id, exercise_key, video_url, analysis_result, score, feedback, corrections, status, created_at, analyzed_at) FROM stdin;
\.


--
-- TOC entry 5817 (class 0 OID 26895)
-- Dependencies: 244
-- Data for Name: user_alergias; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_alergias (user_id, alergia) FROM stdin;
\.


--
-- TOC entry 5819 (class 0 OID 26921)
-- Dependencies: 246
-- Data for Name: user_alimentos_excluidos; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_alimentos_excluidos (user_id, alimento) FROM stdin;
\.


--
-- TOC entry 5830 (class 0 OID 27147)
-- Dependencies: 260
-- Data for Name: user_custom_equipment; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_custom_equipment (id, user_id, name, category, created_at) FROM stdin;
2	10	bici	\N	2025-08-19 19:53:41.850526
5	10	banco en paralelas	\N	2025-08-23 12:31:22.307999
\.


--
-- TOC entry 5855 (class 0 OID 27503)
-- Dependencies: 291
-- Data for Name: user_daily_activity; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_daily_activity (id, user_id, routine_plan_id, activity_date, activity_type, session_id, created_at) FROM stdin;
17	10	20	2025-08-28	continue_training	\N	2025-08-28 13:53:31.6504
18	10	20	2025-08-28	session_start	\N	2025-08-28 13:53:31.688817
19	10	21	2025-08-28	continue_training	\N	2025-08-28 16:34:15.426474
\.


--
-- TOC entry 5828 (class 0 OID 27130)
-- Dependencies: 258
-- Data for Name: user_equipment; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_equipment (user_id, equipment_id, created_at, equipment_key) FROM stdin;
10	9	2025-08-19 20:08:36.645787	toallas
10	11	2025-08-19 20:08:37.913695	esterilla
10	16	2025-08-19 20:30:22.906903	discos_olimpicos
10	12	2025-08-19 22:01:49.010236	bandas_elasticas
10	14	2025-08-23 14:59:31.207872	banco_step
10	13	2025-08-23 14:59:34.627435	mancuernas
10	3	2025-08-28 12:52:16.554989	trx
\.


--
-- TOC entry 5825 (class 0 OID 27100)
-- Dependencies: 255
-- Data for Name: user_exercise_feedback; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_exercise_feedback (id, user_id, session_id, exercise_order, exercise_name, exercise_key, sentiment, comment, created_at) FROM stdin;
1	10	48	0	Sentadilla con Salto	sentadilla_con_salto	love	\N	2025-08-19 13:41:10.927507+02
2	10	49	0	Flexiones de Brazos con Elevación de Pierna	flexiones_de_brazos_con_elevaci_n_de_pierna	love	\N	2025-08-19 20:10:49.95706+02
3	10	49	3	Tijeras en el Suelo	tijeras_en_el_suelo	dislike	\N	2025-08-19 20:17:31.785404+02
4	10	50	0	Peso Muerto Rumano con Discos Olímpicos	peso_muerto_rumano_con_discos_ol_mpicos	hard	\N	2025-08-19 22:19:09.689159+02
5	10	50	1	Remo con TRX	remo_con_trx	love	\N	2025-08-19 22:19:19.305846+02
6	10	50	1	Remo con TRX	remo_con_trx	love	\N	2025-08-19 22:19:38.351012+02
7	10	50	3	Elevaciones de Talones con Discos Olímpicos	elevaciones_de_talones_con_discos_ol_mpicos	hard	\N	2025-08-19 22:20:15.856118+02
8	10	51	1	Bicicleta Estática	bicicleta_est_tica	hard	\N	2025-08-20 10:12:59.107384+02
9	10	51	3	Plancha Lateral con Banda Elástica	plancha_lateral_con_banda_el_stica	love	\N	2025-08-20 10:23:31.044883+02
10	10	52	1	Flexiones de Brazos en Pared	flexiones_de_brazos_en_pared	hard	\N	2025-08-22 13:28:41.453335+02
11	10	53	0	Remo invertido en silla	remo_invertido_en_silla	love	\N	2025-08-22 18:51:04.487881+02
12	10	53	1	Zancadas con peso corporal	zancadas_con_peso_corporal	hard	\N	2025-08-22 18:57:54.787783+02
13	10	54	0	Pistol Squat asistido con silla	pistol_squat_asistido_con_silla	dislike	\N	2025-08-23 12:36:48.502752+02
14	10	54	3	Elevaciones laterales de hombro con banda elástica	elevaciones_laterales_de_hombro_con_banda_el_stica	love	\N	2025-08-23 12:39:28.838882+02
15	10	56	0	Flexiones con Toalla en Pared	flexiones_con_toalla_en_pared	hard	\N	2025-08-23 15:04:36.493362+02
16	10	58	1	Burpee con salto y barra dominadas	burpee_con_salto_y_barra_dominadas	dislike	\N	2025-08-25 13:30:53.427382+02
17	10	59	3	Escaladores (mountain climbers)	escaladores_mountain_climbers_	love	\N	2025-08-25 14:23:50.562584+02
18	10	62	1	Swing de Kettlebell a Doble Mano	swing_de_kettlebell_a_doble_mano	dislike	\N	2025-08-25 18:50:17.462462+02
19	10	62	4	Mountain Climbers con Discos	mountain_climbers_con_discos	love	\N	2025-08-25 18:53:31.136344+02
20	10	65	0	Jumping Jacks	jumping_jacks	hard	\N	2025-08-27 20:41:53.760118+02
21	10	66	1	Elevación Alterna de Piernas en Posición de Sentadilla	elevaci_n_alterna_de_piernas_en_posici_n_de_sentadilla	hard	\N	2025-08-28 09:57:48.349861+02
22	10	66	1	Elevación Alterna de Piernas en Posición de Sentadilla	elevaci_n_alterna_de_piernas_en_posici_n_de_sentadilla	hard	\N	2025-08-28 09:57:48.39999+02
23	10	67	0	Burpees con salto y toque de rodillas	burpees_con_salto_y_toque_de_rodillas	dislike	\N	2025-08-28 12:09:34.123244+02
24	10	67	2	Elevaciones laterales de pierna en posición de cuadrupedia	elevaciones_laterales_de_pierna_en_posici_n_de_cuadrupedia	hard	\N	2025-08-28 12:18:50.146734+02
26	10	67	1	Pike Push-Up (Flexión en V invertida para hombros)	pike_push_up_flexi_n_en_v_invertida_para_hombros_	\N	Dificil pero con encanto	2025-08-28 12:41:57.390998+02
27	10	68	0	Flexiones con Palmada Alterna	flexiones_con_palmada_alterna	hard	\N	2025-08-28 12:54:27.200526+02
28	10	68	2	Saltos Pliométricos en Caja Alterna	saltos_pliom_tricos_en_caja_alterna	love	\N	2025-08-28 12:59:47.186672+02
\.


--
-- TOC entry 5823 (class 0 OID 26987)
-- Dependencies: 250
-- Data for Name: user_exercise_history; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_exercise_history (id, user_id, exercise_name, exercise_key, reps, series, duration_seconds, load_kg, session_id, plan_id, notes, created_at) FROM stdin;
3	10	Burpees Modificados	burpees_modificados	\N	5	134	\N	31	54	\N	2025-08-18 21:23:30.892112+02
8	10	Sentadilla en Silla	sentadilla_en_silla	\N	4	134	\N	32	55	\N	2025-08-18 21:35:46.546473+02
12	10	Flexiones de Brazos Invertidas en Sofa	flexiones_de_brazos_invertidas_en_sofa	\N	4	134	\N	33	56	\N	2025-08-18 22:42:35.364897+02
14	10	Puente de Glúteos	puente_de_gl_teos	\N	4	\N	\N	33	56	\N	2025-08-18 22:46:58.096416+02
15	10	Press de Hombro con Mancuernas	press_de_hombro_con_mancuernas	\N	3	\N	\N	40	63	\N	2025-08-19 08:29:28.199557+02
19	10	Remo con Bandas Elásticas	remo_con_bandas_el_sticas	\N	3	\N	\N	40	63	\N	2025-08-19 08:32:38.773387+02
23	10	Sentadilla con Mancuernas	sentadilla_con_mancuernas	\N	3	\N	\N	40	63	\N	2025-08-19 08:35:21.801899+02
27	10	Plancha Dinámica	plancha_din_mica	\N	3	\N	\N	40	63	\N	2025-08-19 08:37:21.348697+02
31	10	Elevación de Caderas con Banda Elástica	elevaci_n_de_caderas_con_banda_el_stica	\N	3	\N	\N	40	63	\N	2025-08-19 08:40:00.780671+02
35	10	Flexiones de Brazos con Pies Elevados en Silla	flexiones_de_brazos_con_pies_elevados_en_silla	\N	1	\N	\N	42	66	\N	2025-08-19 09:24:03.845434+02
39	10	Sentadilla a la Pared	sentadilla_a_la_pared	\N	1	\N	\N	42	66	\N	2025-08-19 09:24:53.851814+02
43	10	Escaladores (sin salto)	escaladores_sin_salto_	\N	1	\N	\N	42	66	\N	2025-08-19 09:26:54.292684+02
47	10	Burpees sin Salto	burpees_sin_salto	\N	1	\N	\N	42	66	\N	2025-08-19 09:27:45.25313+02
51	10	Saltos en Banco Step	saltos_en_banco_step	\N	4	\N	\N	43	67	\N	2025-08-19 10:08:17.836455+02
55	10	Remo con Bandas Elásticas	remo_con_bandas_el_sticas	\N	4	\N	\N	43	67	\N	2025-08-19 11:05:59.575876+02
59	10	Sentadilla Isla con Bandas Elásticas	sentadilla_isla_con_bandas_el_sticas	\N	4	\N	\N	43	67	\N	2025-08-19 11:11:45.872885+02
63	10	Remo Inclinado con Bandas Elásticas	remo_inclinado_con_bandas_el_sticas	\N	4	\N	\N	44	69	\N	2025-08-19 11:36:31.470115+02
67	10	Elevaciones de Pantorrillas en Escalón	elevaciones_de_pantorrillas_en_escal_n	\N	4	\N	\N	44	69	\N	2025-08-19 11:39:48.537931+02
71	10	Plancha con Toque de Hombro	plancha_con_toque_de_hombro	\N	4	\N	\N	44	69	\N	2025-08-19 11:42:56.586127+02
75	10	Push-Up a Escalera	push_up_a_escalera	\N	4	\N	\N	46	71	\N	2025-08-19 12:03:59.270681+02
77	10	Zancadas Alternas con Mancuernas	zancadas_alternas_con_mancuernas	\N	4	\N	\N	46	71	\N	2025-08-19 12:08:22.248554+02
79	10	Remo Alto con Banda Elástica	remo_alto_con_banda_el_stica	\N	4	\N	\N	46	71	\N	2025-08-19 12:12:48.089023+02
81	10	Mountain Climbers en Banco	mountain_climbers_en_banco	\N	4	\N	\N	46	71	\N	2025-08-19 12:17:10.79925+02
83	10	Flexiones de Brazos con Manos en Banquito	flexiones_de_brazos_con_manos_en_banquito	\N	5	\N	\N	47	72	\N	2025-08-19 13:00:36.972372+02
85	10	Sentadilla con Salto	sentadilla_con_salto	\N	4	\N	\N	48	73	\N	2025-08-19 13:44:55.168353+02
87	10	Flexiones de Brazos con Elevación de Pierna	flexiones_de_brazos_con_elevaci_n_de_pierna	\N	4	\N	\N	49	74	\N	2025-08-19 20:17:17.923383+02
123	10	Sentadilla con Mancuernas	sentadilla_con_mancuernas	8-10	4	\N	\N	26	\N	Completado desde rutina Lun semana 1	2025-08-26 16:43:23.107154+02
125	10	Press de Banca con Mancuernas	press_de_banca_con_mancuernas	8-10	4	\N	\N	26	\N	Completado desde rutina Lun semana 1	2025-08-26 16:53:16.105701+02
127	10	Remo con Mancuernas	remo_con_mancuernas	8-10	4	\N	\N	26	\N	Completado desde rutina Lun semana 1	2025-08-26 17:14:33.283858+02
129	10	Elevaciones de Talones	elevaciones_de_talones	12-15	4	\N	\N	26	\N	Completado desde rutina Lun semana 1	2025-08-26 17:33:05.274025+02
131	10	Sentadilla Frontal	sentadilla_frontal	8-10	4	179	\N	51	\N	Completado desde rutina Lun semana 1	2025-08-26 19:26:24.289567+02
133	10	Sentadilla Frontal	sentadilla_frontal	6-8	5	224	\N	56	\N	Completado desde rutina Lun semana 1	2025-08-26 20:13:29.271413+02
135	10	Press de Banca con Mancuernas	press_de_banca_con_mancuernas	8-10	4	179	\N	56	\N	Completado desde rutina Lun semana 1	2025-08-26 20:21:23.767669+02
137	10	Remo con Mancuernas	remo_con_mancuernas	8-10	4	179	\N	56	\N	Completado desde rutina Lun semana 1	2025-08-26 20:27:39.275518+02
139	10	Elevaciones de Talones	elevaciones_de_talones	10-12	4	179	\N	56	\N	Completado desde rutina Lun semana 1	2025-08-26 21:31:47.363483+02
141	10	Sentadilla Frontal	sentadilla_frontal	6-8	5	224	\N	61	\N	Completado desde rutina Lun semana 1	2025-08-27 12:53:05.111575+02
143	10	Press de Banca con Mancuernas	press_de_banca_con_mancuernas	8-10	4	179	\N	61	\N	Completado desde rutina Lun semana 1	2025-08-27 12:59:49.707617+02
145	10	Remo con Mancuernas	remo_con_mancuernas	8-10	4	179	\N	61	\N	Completado desde rutina Lun semana 1	2025-08-27 13:06:02.336107+02
147	10	Elevaciones de Talones	elevaciones_de_talones	10-12	4	179	\N	61	\N	Completado desde rutina Lun semana 1	2025-08-27 13:13:58.545441+02
149	10	Kettlebell Swings Explosivos	kettlebell_swings_explosivos	\N	4	\N	\N	64	100	\N	2025-08-27 20:08:32.133142+02
\.


--
-- TOC entry 5816 (class 0 OID 26776)
-- Dependencies: 235
-- Data for Name: user_home_training_stats; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_home_training_stats (id, user_id, total_sessions, total_duration_seconds, current_streak_days, longest_streak_days, last_training_date, favorite_equipment, favorite_training_type, total_exercises_completed, created_at, updated_at) FROM stdin;
1	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 04:37:07.964125+02	2025-08-17 04:37:07.964125+02
2	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 04:37:07.984916+02	2025-08-17 04:37:07.984916+02
3	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 04:45:30.484236+02	2025-08-17 04:45:30.484236+02
4	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 04:48:15.751609+02	2025-08-17 04:48:15.751609+02
5	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 04:48:15.7718+02	2025-08-17 04:48:15.7718+02
6	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 09:46:56.782352+02	2025-08-17 09:46:56.782352+02
7	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 09:46:56.795381+02	2025-08-17 09:46:56.795381+02
8	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 09:47:02.817971+02	2025-08-17 09:47:02.817971+02
9	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 09:47:02.827051+02	2025-08-17 09:47:02.827051+02
10	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 12:25:39.125102+02	2025-08-17 12:25:39.125102+02
11	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 12:25:39.1334+02	2025-08-17 12:25:39.1334+02
12	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 12:32:38.065052+02	2025-08-17 12:32:38.065052+02
13	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 12:32:38.073617+02	2025-08-17 12:32:38.073617+02
14	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:07:11.53675+02	2025-08-17 13:07:11.53675+02
15	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:07:11.552106+02	2025-08-17 13:07:11.552106+02
16	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:14:35.925976+02	2025-08-17 13:14:35.925976+02
17	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:14:35.935393+02	2025-08-17 13:14:35.935393+02
18	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:28:22.224537+02	2025-08-17 13:28:22.224537+02
19	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:28:22.242996+02	2025-08-17 13:28:22.242996+02
20	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:30:05.256163+02	2025-08-17 13:30:05.256163+02
21	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 13:30:05.263927+02	2025-08-17 13:30:05.263927+02
22	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 14:12:58.840605+02	2025-08-17 14:12:58.840605+02
23	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 14:12:58.841763+02	2025-08-17 14:12:58.841763+02
24	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 14:17:11.316763+02	2025-08-17 14:17:11.316763+02
25	\N	0	0	0	0	\N	\N	\N	0	2025-08-17 14:17:11.324968+02	2025-08-17 14:17:11.324968+02
26	10	18	7562	0	0	2025-08-28	\N	\N	0	2025-08-17 14:24:02.772516+02	2025-08-28 12:31:28.055555+02
\.


--
-- TOC entry 5821 (class 0 OID 26947)
-- Dependencies: 248
-- Data for Name: user_limitaciones; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_limitaciones (user_id, limitacion) FROM stdin;
\.


--
-- TOC entry 5818 (class 0 OID 26908)
-- Dependencies: 245
-- Data for Name: user_medicamentos; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_medicamentos (user_id, medicamento) FROM stdin;
\.


--
-- TOC entry 5881 (class 0 OID 28077)
-- Dependencies: 326
-- Data for Name: user_personalized_equipment; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_personalized_equipment (id, user_id, equipment_name, category, attributes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5869 (class 0 OID 27812)
-- Dependencies: 307
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_profiles (id, user_id, objetivo_principal, metodologia_preferida, limitaciones_fisicas, created_at, updated_at, music_config) FROM stdin;
1	10	\N	\N	\N	2025-08-27 19:46:08.073333	2025-08-27 19:46:08.073333	{"repeat": "none", "volume": 0.5, "shuffle": false, "spotify": {"enabled": false, "connected": false}, "youtube": {"enabled": false, "connected": false}, "autoplay": false, "localFiles": {"path": "", "enabled": true}}
2	8	\N	\N	\N	2025-08-27 19:46:08.073333	2025-08-27 19:46:08.073333	{"repeat": "none", "volume": 0.5, "shuffle": false, "spotify": {"enabled": false, "connected": false}, "youtube": {"enabled": false, "connected": false}, "autoplay": false, "localFiles": {"path": "", "enabled": true}}
3	9	\N	\N	\N	2025-08-27 19:46:08.073333	2025-08-27 19:46:08.073333	{"repeat": "none", "volume": 0.5, "shuffle": false, "spotify": {"enabled": false, "connected": false}, "youtube": {"enabled": false, "connected": false}, "autoplay": false, "localFiles": {"path": "", "enabled": true}}
\.


--
-- TOC entry 5820 (class 0 OID 26934)
-- Dependencies: 247
-- Data for Name: user_suplementos; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.user_suplementos (user_id, suplemento) FROM stdin;
\.


--
-- TOC entry 5808 (class 0 OID 26580)
-- Dependencies: 217
-- Data for Name: users; Type: TABLE DATA; Schema: app; Owner: postgres
--

COPY app.users (id, email, password_hash, nombre, created_at, updated_at, edad, sexo, peso, altura, nivel_actividad, "años_entrenando", grasa_corporal, masa_muscular, agua_corporal, metabolismo_basal, cintura, cuello, cadera, pecho, brazo, muslo, metodologia, enfoque, horario_preferido, objetivo_principal, meta_peso, meta_grasa, historial_medico_docs, alergias, medicamentos, suplementacion, alimentos_evitar, apellido, nivel_entrenamiento, anos_entrenando, frecuencia_semanal, metodologia_preferida, brazos, muslos, antebrazos, historial_medico, limitaciones_fisicas, meta_grasa_corporal, enfoque_entrenamiento, comidas_por_dia, alimentos_excluidos, last_login, is_active, email_verified, lesiones) FROM stdin;
10	sergiohernandezlara07@gmail.com	$2a$10$IiGo7M5Y33BG5oGXo2SGAeboG4FVR/xUwYiXWlzWG57.QRZjG/WqW	Sergio	2025-08-17 12:25:18.847449	2025-08-27 20:18:44.107341	41	masculino	76.00	183.00	moderado	\N	22.10	59.20	60.00	1752	90.00	34.00	\N	98.00	\N	\N	\N	\N	tarde	ganar_peso	78.00	\N	[]	{Polen}	{""}	{}	\N	Hernández Lara	avanzado	20	3	bodybuilding	40.00	55.00	25.00	\N	\N	\N	general	3	{}	\N	t	f	\N
8	null@example.com	hash	Sergio	2025-08-17 11:42:56.731082	2025-08-19 19:39:31.368464	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	\N	\N	\N	Null	principiante	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	f	\N
9	lista@example.com	hash	Ana	2025-08-17 11:42:56.731082	2025-08-19 19:39:31.368464	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	{Polen,Gluten}	{Ibuprofeno}	\N	\N	Listas	principiante	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	f	\N
\.


--
-- TOC entry 6024 (class 0 OID 0)
-- Dependencies: 268
-- Name: body_composition_history_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.body_composition_history_id_seq', 1, true);


--
-- TOC entry 6025 (class 0 OID 0)
-- Dependencies: 296
-- Name: daily_nutrition_log_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.daily_nutrition_log_id_seq', 1, false);


--
-- TOC entry 6026 (class 0 OID 0)
-- Dependencies: 256
-- Name: equipment_catalog_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.equipment_catalog_id_seq', 16, true);


--
-- TOC entry 6027 (class 0 OID 0)
-- Dependencies: 308
-- Name: exercise_ai_info_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.exercise_ai_info_id_seq', 10, true);


--
-- TOC entry 6028 (class 0 OID 0)
-- Dependencies: 272
-- Name: exercise_history_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.exercise_history_id_seq', 242, true);


--
-- TOC entry 6029 (class 0 OID 0)
-- Dependencies: 274
-- Name: exercise_repetition_policy_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.exercise_repetition_policy_id_seq', 8, true);


--
-- TOC entry 6030 (class 0 OID 0)
-- Dependencies: 264
-- Name: exercises_catalog_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.exercises_catalog_id_seq', 5, true);


--
-- TOC entry 6031 (class 0 OID 0)
-- Dependencies: 298
-- Name: food_database_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.food_database_id_seq', 24, true);


--
-- TOC entry 6032 (class 0 OID 0)
-- Dependencies: 322
-- Name: home_combination_exercise_history_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_combination_exercise_history_id_seq', 6, true);


--
-- TOC entry 6033 (class 0 OID 0)
-- Dependencies: 310
-- Name: home_exercise_history_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_exercise_history_id_seq', 62, true);


--
-- TOC entry 6034 (class 0 OID 0)
-- Dependencies: 232
-- Name: home_exercise_progress_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_exercise_progress_id_seq', 263, true);


--
-- TOC entry 6035 (class 0 OID 0)
-- Dependencies: 320
-- Name: home_training_combinations_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_training_combinations_id_seq', 48, true);


--
-- TOC entry 6036 (class 0 OID 0)
-- Dependencies: 228
-- Name: home_training_plans_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_training_plans_id_seq', 107, true);


--
-- TOC entry 6037 (class 0 OID 0)
-- Dependencies: 230
-- Name: home_training_sessions_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_training_sessions_id_seq', 68, true);


--
-- TOC entry 6038 (class 0 OID 0)
-- Dependencies: 313
-- Name: home_training_templates_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.home_training_templates_id_seq', 8, true);


--
-- TOC entry 6039 (class 0 OID 0)
-- Dependencies: 262
-- Name: medical_documents_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.medical_documents_id_seq', 1, false);


--
-- TOC entry 6040 (class 0 OID 0)
-- Dependencies: 332
-- Name: methodology_exercise_feedback_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.methodology_exercise_feedback_id_seq', 1, false);


--
-- TOC entry 6041 (class 0 OID 0)
-- Dependencies: 334
-- Name: methodology_exercise_history_complete_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.methodology_exercise_history_complete_id_seq', 1, false);


--
-- TOC entry 6042 (class 0 OID 0)
-- Dependencies: 330
-- Name: methodology_exercise_progress_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.methodology_exercise_progress_id_seq', 1, false);


--
-- TOC entry 6043 (class 0 OID 0)
-- Dependencies: 328
-- Name: methodology_exercise_sessions_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.methodology_exercise_sessions_id_seq', 1, false);


--
-- TOC entry 6044 (class 0 OID 0)
-- Dependencies: 270
-- Name: methodology_plans_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.methodology_plans_id_seq', 3, true);


--
-- TOC entry 6045 (class 0 OID 0)
-- Dependencies: 304
-- Name: music_playlists_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.music_playlists_id_seq', 1, false);


--
-- TOC entry 6046 (class 0 OID 0)
-- Dependencies: 302
-- Name: nutrition_goals_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.nutrition_goals_id_seq', 1, false);


--
-- TOC entry 6047 (class 0 OID 0)
-- Dependencies: 294
-- Name: nutrition_plans_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.nutrition_plans_id_seq', 1, true);


--
-- TOC entry 6048 (class 0 OID 0)
-- Dependencies: 283
-- Name: routine_exercise_feedback_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.routine_exercise_feedback_id_seq', 10, true);


--
-- TOC entry 6049 (class 0 OID 0)
-- Dependencies: 281
-- Name: routine_exercise_progress_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.routine_exercise_progress_id_seq', 400, true);


--
-- TOC entry 6050 (class 0 OID 0)
-- Dependencies: 277
-- Name: routine_plans_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.routine_plans_id_seq', 22, true);


--
-- TOC entry 6051 (class 0 OID 0)
-- Dependencies: 279
-- Name: routine_sessions_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.routine_sessions_id_seq', 117, true);


--
-- TOC entry 6052 (class 0 OID 0)
-- Dependencies: 300
-- Name: supplement_recommendations_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.supplement_recommendations_id_seq', 1, false);


--
-- TOC entry 6053 (class 0 OID 0)
-- Dependencies: 266
-- Name: technique_analysis_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.technique_analysis_id_seq', 1, false);


--
-- TOC entry 6054 (class 0 OID 0)
-- Dependencies: 259
-- Name: user_custom_equipment_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_custom_equipment_id_seq', 7, true);


--
-- TOC entry 6055 (class 0 OID 0)
-- Dependencies: 290
-- Name: user_daily_activity_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_daily_activity_id_seq', 22, true);


--
-- TOC entry 6056 (class 0 OID 0)
-- Dependencies: 254
-- Name: user_exercise_feedback_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_exercise_feedback_id_seq', 28, true);


--
-- TOC entry 6057 (class 0 OID 0)
-- Dependencies: 249
-- Name: user_exercise_history_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_exercise_history_id_seq', 150, true);


--
-- TOC entry 6058 (class 0 OID 0)
-- Dependencies: 234
-- Name: user_home_training_stats_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_home_training_stats_id_seq', 30, true);


--
-- TOC entry 6059 (class 0 OID 0)
-- Dependencies: 325
-- Name: user_personalized_equipment_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_personalized_equipment_id_seq', 1, false);


--
-- TOC entry 6060 (class 0 OID 0)
-- Dependencies: 306
-- Name: user_profiles_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.user_profiles_id_seq', 3, true);


--
-- TOC entry 6061 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: app; Owner: postgres
--

SELECT pg_catalog.setval('app.users_id_seq', 10, true);


--
-- TOC entry 5395 (class 2606 OID 27249)
-- Name: body_composition_history body_composition_history_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.body_composition_history
    ADD CONSTRAINT body_composition_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5462 (class 2606 OID 27631)
-- Name: daily_nutrition_log daily_nutrition_log_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.daily_nutrition_log
    ADD CONSTRAINT daily_nutrition_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5464 (class 2606 OID 27633)
-- Name: daily_nutrition_log daily_nutrition_log_user_id_log_date_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.daily_nutrition_log
    ADD CONSTRAINT daily_nutrition_log_user_id_log_date_key UNIQUE (user_id, log_date);


--
-- TOC entry 5369 (class 2606 OID 27129)
-- Name: equipment_catalog equipment_catalog_code_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.equipment_catalog
    ADD CONSTRAINT equipment_catalog_code_key UNIQUE (code);


--
-- TOC entry 5371 (class 2606 OID 27127)
-- Name: equipment_catalog equipment_catalog_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.equipment_catalog
    ADD CONSTRAINT equipment_catalog_pkey PRIMARY KEY (id);


--
-- TOC entry 5382 (class 2606 OID 27170)
-- Name: equipment_items equipment_items_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.equipment_items
    ADD CONSTRAINT equipment_items_pkey PRIMARY KEY (key);


--
-- TOC entry 5497 (class 2606 OID 27847)
-- Name: exercise_ai_info exercise_ai_info_exercise_name_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_ai_info
    ADD CONSTRAINT exercise_ai_info_exercise_name_key UNIQUE (exercise_name);


--
-- TOC entry 5499 (class 2606 OID 27845)
-- Name: exercise_ai_info exercise_ai_info_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_ai_info
    ADD CONSTRAINT exercise_ai_info_pkey PRIMARY KEY (id);


--
-- TOC entry 5408 (class 2606 OID 27298)
-- Name: exercise_history exercise_history_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_history
    ADD CONSTRAINT exercise_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5416 (class 2606 OID 27323)
-- Name: exercise_repetition_policy exercise_repetition_policy_methodology_type_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_repetition_policy
    ADD CONSTRAINT exercise_repetition_policy_methodology_type_key UNIQUE (methodology_type);


--
-- TOC entry 5418 (class 2606 OID 27321)
-- Name: exercise_repetition_policy exercise_repetition_policy_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_repetition_policy
    ADD CONSTRAINT exercise_repetition_policy_pkey PRIMARY KEY (id);


--
-- TOC entry 5387 (class 2606 OID 27216)
-- Name: exercises_catalog exercises_catalog_key_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercises_catalog
    ADD CONSTRAINT exercises_catalog_key_key UNIQUE (key);


--
-- TOC entry 5389 (class 2606 OID 27214)
-- Name: exercises_catalog exercises_catalog_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercises_catalog
    ADD CONSTRAINT exercises_catalog_pkey PRIMARY KEY (id);


--
-- TOC entry 5468 (class 2606 OID 27659)
-- Name: food_database food_database_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.food_database
    ADD CONSTRAINT food_database_pkey PRIMARY KEY (id);


--
-- TOC entry 5523 (class 2606 OID 28049)
-- Name: home_combination_exercise_history home_combination_exercise_history_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_combination_exercise_history
    ADD CONSTRAINT home_combination_exercise_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5504 (class 2606 OID 27888)
-- Name: home_exercise_history home_exercise_history_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_history
    ADD CONSTRAINT home_exercise_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5324 (class 2606 OID 26769)
-- Name: home_exercise_progress home_exercise_progress_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_progress
    ADD CONSTRAINT home_exercise_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 5517 (class 2606 OID 28004)
-- Name: home_training_combinations home_training_combinations_combination_code_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_combinations
    ADD CONSTRAINT home_training_combinations_combination_code_key UNIQUE (combination_code);


--
-- TOC entry 5519 (class 2606 OID 28002)
-- Name: home_training_combinations home_training_combinations_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_combinations
    ADD CONSTRAINT home_training_combinations_pkey PRIMARY KEY (id);


--
-- TOC entry 5314 (class 2606 OID 26729)
-- Name: home_training_plans home_training_plans_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_plans
    ADD CONSTRAINT home_training_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 5319 (class 2606 OID 26748)
-- Name: home_training_sessions home_training_sessions_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_sessions
    ADD CONSTRAINT home_training_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5512 (class 2606 OID 27927)
-- Name: home_training_templates home_training_templates_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_templates
    ADD CONSTRAINT home_training_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5514 (class 2606 OID 27929)
-- Name: home_training_templates home_training_templates_unique; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_templates
    ADD CONSTRAINT home_training_templates_unique UNIQUE (equipment_type, training_type);


--
-- TOC entry 5385 (class 2606 OID 27194)
-- Name: medical_documents medical_documents_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.medical_documents
    ADD CONSTRAINT medical_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5553 (class 2606 OID 28180)
-- Name: methodology_exercise_feedback methodology_exercise_feedback_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_feedback
    ADD CONSTRAINT methodology_exercise_feedback_pkey PRIMARY KEY (id);


--
-- TOC entry 5561 (class 2606 OID 28271)
-- Name: methodology_exercise_history_complete methodology_exercise_history_complete_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_history_complete
    ADD CONSTRAINT methodology_exercise_history_complete_pkey PRIMARY KEY (id);


--
-- TOC entry 5548 (class 2606 OID 28158)
-- Name: methodology_exercise_progress methodology_exercise_progress_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_progress
    ADD CONSTRAINT methodology_exercise_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 5543 (class 2606 OID 28132)
-- Name: methodology_exercise_sessions methodology_exercise_sessions_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_sessions
    ADD CONSTRAINT methodology_exercise_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5555 (class 2606 OID 28182)
-- Name: methodology_exercise_feedback methodology_feedback_unique; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_feedback
    ADD CONSTRAINT methodology_feedback_unique UNIQUE (methodology_session_id, exercise_order);


--
-- TOC entry 5406 (class 2606 OID 27274)
-- Name: methodology_plans methodology_plans_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_plans
    ADD CONSTRAINT methodology_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 5486 (class 2606 OID 27751)
-- Name: music_playlists music_playlists_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.music_playlists
    ADD CONSTRAINT music_playlists_pkey PRIMARY KEY (id);


--
-- TOC entry 5480 (class 2606 OID 27695)
-- Name: nutrition_goals nutrition_goals_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.nutrition_goals
    ADD CONSTRAINT nutrition_goals_pkey PRIMARY KEY (id);


--
-- TOC entry 5460 (class 2606 OID 27607)
-- Name: nutrition_plans nutrition_plans_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.nutrition_plans
    ADD CONSTRAINT nutrition_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 5446 (class 2606 OID 27414)
-- Name: routine_exercise_feedback routine_exercise_feedback_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_feedback
    ADD CONSTRAINT routine_exercise_feedback_pkey PRIMARY KEY (id);


--
-- TOC entry 5448 (class 2606 OID 27416)
-- Name: routine_exercise_feedback routine_exercise_feedback_routine_session_id_exercise_order_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_feedback
    ADD CONSTRAINT routine_exercise_feedback_routine_session_id_exercise_order_key UNIQUE (routine_session_id, exercise_order);


--
-- TOC entry 5439 (class 2606 OID 27391)
-- Name: routine_exercise_progress routine_exercise_progress_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_progress
    ADD CONSTRAINT routine_exercise_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 5441 (class 2606 OID 27393)
-- Name: routine_exercise_progress routine_exercise_progress_routine_session_id_exercise_order_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_progress
    ADD CONSTRAINT routine_exercise_progress_routine_session_id_exercise_order_key UNIQUE (routine_session_id, exercise_order);


--
-- TOC entry 5423 (class 2606 OID 27347)
-- Name: routine_plans routine_plans_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_plans
    ADD CONSTRAINT routine_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 5429 (class 2606 OID 27366)
-- Name: routine_sessions routine_sessions_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_sessions
    ADD CONSTRAINT routine_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5431 (class 2606 OID 27368)
-- Name: routine_sessions routine_sessions_user_id_routine_plan_id_week_number_day_na_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_sessions
    ADD CONSTRAINT routine_sessions_user_id_routine_plan_id_week_number_day_na_key UNIQUE (user_id, routine_plan_id, week_number, day_name);


--
-- TOC entry 5476 (class 2606 OID 27675)
-- Name: supplement_recommendations supplement_recommendations_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.supplement_recommendations
    ADD CONSTRAINT supplement_recommendations_pkey PRIMARY KEY (id);


--
-- TOC entry 5393 (class 2606 OID 27229)
-- Name: technique_analysis technique_analysis_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.technique_analysis
    ADD CONSTRAINT technique_analysis_pkey PRIMARY KEY (id);


--
-- TOC entry 5521 (class 2606 OID 28006)
-- Name: home_training_combinations unique_equipment_training; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_combinations
    ADD CONSTRAINT unique_equipment_training UNIQUE (equipment_type, training_type);


--
-- TOC entry 5414 (class 2606 OID 27300)
-- Name: exercise_history unique_exercise_user_plan; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_history
    ADD CONSTRAINT unique_exercise_user_plan UNIQUE (user_id, exercise_name, plan_id, week_number, day_name);


--
-- TOC entry 5532 (class 2606 OID 28051)
-- Name: home_combination_exercise_history unique_user_combination_exercise; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_combination_exercise_history
    ADD CONSTRAINT unique_user_combination_exercise UNIQUE (user_id, combination_id, exercise_key);


--
-- TOC entry 5563 (class 2606 OID 28278)
-- Name: methodology_exercise_history_complete uq_mhistory_unique; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_history_complete
    ADD CONSTRAINT uq_mhistory_unique UNIQUE (user_id, methodology_session_id, exercise_order, completed_at);


--
-- TOC entry 5488 (class 2606 OID 27758)
-- Name: music_playlists uq_music_playlists_user_name; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.music_playlists
    ADD CONSTRAINT uq_music_playlists_user_name UNIQUE (user_id, name);


--
-- TOC entry 5433 (class 2606 OID 28339)
-- Name: routine_sessions uq_routine_session_once; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_sessions
    ADD CONSTRAINT uq_routine_session_once UNIQUE (user_id, routine_plan_id, week_number, day_name);


--
-- TOC entry 5536 (class 2606 OID 28090)
-- Name: user_personalized_equipment uq_user_equipment; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_personalized_equipment
    ADD CONSTRAINT uq_user_equipment UNIQUE (user_id, equipment_key);


--
-- TOC entry 5336 (class 2606 OID 26901)
-- Name: user_alergias user_alergias_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_alergias
    ADD CONSTRAINT user_alergias_pkey PRIMARY KEY (user_id, alergia);


--
-- TOC entry 5342 (class 2606 OID 26927)
-- Name: user_alimentos_excluidos user_alimentos_excluidos_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_alimentos_excluidos
    ADD CONSTRAINT user_alimentos_excluidos_pkey PRIMARY KEY (user_id, alimento);


--
-- TOC entry 5380 (class 2606 OID 27153)
-- Name: user_custom_equipment user_custom_equipment_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_custom_equipment
    ADD CONSTRAINT user_custom_equipment_pkey PRIMARY KEY (id);


--
-- TOC entry 5453 (class 2606 OID 27511)
-- Name: user_daily_activity user_daily_activity_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_daily_activity
    ADD CONSTRAINT user_daily_activity_pkey PRIMARY KEY (id);


--
-- TOC entry 5455 (class 2606 OID 27513)
-- Name: user_daily_activity user_daily_activity_user_id_routine_plan_id_activity_date_a_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_daily_activity
    ADD CONSTRAINT user_daily_activity_user_id_routine_plan_id_activity_date_a_key UNIQUE (user_id, routine_plan_id, activity_date, activity_type);


--
-- TOC entry 5376 (class 2606 OID 27135)
-- Name: user_equipment user_equipment_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_equipment
    ADD CONSTRAINT user_equipment_pkey PRIMARY KEY (user_id, equipment_id);


--
-- TOC entry 5367 (class 2606 OID 27109)
-- Name: user_exercise_feedback user_exercise_feedback_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_feedback
    ADD CONSTRAINT user_exercise_feedback_pkey PRIMARY KEY (id);


--
-- TOC entry 5360 (class 2606 OID 26995)
-- Name: user_exercise_history user_exercise_history_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_history
    ADD CONSTRAINT user_exercise_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5331 (class 2606 OID 26788)
-- Name: user_home_training_stats user_home_training_stats_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_home_training_stats
    ADD CONSTRAINT user_home_training_stats_pkey PRIMARY KEY (id);


--
-- TOC entry 5333 (class 2606 OID 26790)
-- Name: user_home_training_stats user_home_training_stats_user_id_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_home_training_stats
    ADD CONSTRAINT user_home_training_stats_user_id_key UNIQUE (user_id);


--
-- TOC entry 5348 (class 2606 OID 26953)
-- Name: user_limitaciones user_limitaciones_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_limitaciones
    ADD CONSTRAINT user_limitaciones_pkey PRIMARY KEY (user_id, limitacion);


--
-- TOC entry 5339 (class 2606 OID 26914)
-- Name: user_medicamentos user_medicamentos_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_medicamentos
    ADD CONSTRAINT user_medicamentos_pkey PRIMARY KEY (user_id, medicamento);


--
-- TOC entry 5538 (class 2606 OID 28088)
-- Name: user_personalized_equipment user_personalized_equipment_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_personalized_equipment
    ADD CONSTRAINT user_personalized_equipment_pkey PRIMARY KEY (id);


--
-- TOC entry 5493 (class 2606 OID 27821)
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 5495 (class 2606 OID 27823)
-- Name: user_profiles user_profiles_user_id_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_profiles
    ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 5345 (class 2606 OID 26940)
-- Name: user_suplementos user_suplementos_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_suplementos
    ADD CONSTRAINT user_suplementos_pkey PRIMARY KEY (user_id, suplemento);


--
-- TOC entry 5310 (class 2606 OID 26598)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5312 (class 2606 OID 26596)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5396 (class 1259 OID 27259)
-- Name: idx_body_comp_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_body_comp_date ON app.body_composition_history USING btree (measurement_date);


--
-- TOC entry 5397 (class 1259 OID 27258)
-- Name: idx_body_comp_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_body_comp_user_id ON app.body_composition_history USING btree (user_id);


--
-- TOC entry 5524 (class 1259 OID 28065)
-- Name: idx_combination_history_combination_code; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_combination_history_combination_code ON app.home_combination_exercise_history USING btree (combination_code);


--
-- TOC entry 5525 (class 1259 OID 28066)
-- Name: idx_combination_history_exercise_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_combination_history_exercise_key ON app.home_combination_exercise_history USING btree (exercise_key);


--
-- TOC entry 5526 (class 1259 OID 28067)
-- Name: idx_combination_history_last_used; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_combination_history_last_used ON app.home_combination_exercise_history USING btree (last_used_at);


--
-- TOC entry 5527 (class 1259 OID 28069)
-- Name: idx_combination_history_rating; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_combination_history_rating ON app.home_combination_exercise_history USING btree (user_rating) WHERE (user_rating IS NOT NULL);


--
-- TOC entry 5528 (class 1259 OID 28068)
-- Name: idx_combination_history_times_used; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_combination_history_times_used ON app.home_combination_exercise_history USING btree (times_used);


--
-- TOC entry 5529 (class 1259 OID 28063)
-- Name: idx_combination_history_user_combo; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_combination_history_user_combo ON app.home_combination_exercise_history USING btree (user_id, combination_id);


--
-- TOC entry 5465 (class 1259 OID 27640)
-- Name: idx_daily_nutrition_log_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_daily_nutrition_log_date ON app.daily_nutrition_log USING btree (log_date);


--
-- TOC entry 5466 (class 1259 OID 27639)
-- Name: idx_daily_nutrition_log_user_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_daily_nutrition_log_user_date ON app.daily_nutrition_log USING btree (user_id, log_date);


--
-- TOC entry 5500 (class 1259 OID 27873)
-- Name: idx_exercise_ai_info_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercise_ai_info_created ON app.exercise_ai_info USING btree (created_at DESC);


--
-- TOC entry 5501 (class 1259 OID 27848)
-- Name: idx_exercise_ai_info_name; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercise_ai_info_name ON app.exercise_ai_info USING btree (exercise_name);


--
-- TOC entry 5409 (class 1259 OID 27307)
-- Name: idx_exercise_history_methodology; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercise_history_methodology ON app.exercise_history USING btree (methodology_type);


--
-- TOC entry 5410 (class 1259 OID 27308)
-- Name: idx_exercise_history_used_at; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercise_history_used_at ON app.exercise_history USING btree (used_at);


--
-- TOC entry 5411 (class 1259 OID 27306)
-- Name: idx_exercise_history_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercise_history_user_id ON app.exercise_history USING btree (user_id);


--
-- TOC entry 5412 (class 1259 OID 27309)
-- Name: idx_exercise_history_user_methodology; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercise_history_user_methodology ON app.exercise_history USING btree (user_id, methodology_type);


--
-- TOC entry 5390 (class 1259 OID 27256)
-- Name: idx_exercises_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_exercises_key ON app.exercises_catalog USING btree (key);


--
-- TOC entry 5361 (class 1259 OID 27111)
-- Name: idx_feedback_exercise_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_feedback_exercise_key ON app.user_exercise_feedback USING btree (exercise_key);


--
-- TOC entry 5362 (class 1259 OID 27110)
-- Name: idx_feedback_user_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_feedback_user_created ON app.user_exercise_feedback USING btree (user_id, created_at DESC);


--
-- TOC entry 5469 (class 1259 OID 27662)
-- Name: idx_food_database_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_food_database_active ON app.food_database USING btree (is_active);


--
-- TOC entry 5470 (class 1259 OID 27660)
-- Name: idx_food_database_category; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_food_database_category ON app.food_database USING btree (category);


--
-- TOC entry 5471 (class 1259 OID 27661)
-- Name: idx_food_database_name; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_food_database_name ON app.food_database USING btree (name);


--
-- TOC entry 5349 (class 1259 OID 27059)
-- Name: idx_hist_real_user_key_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_hist_real_user_key_created ON app.user_exercise_history USING btree (user_id, exercise_key, created_at DESC);


--
-- TOC entry 5530 (class 1259 OID 28064)
-- Name: idx_hist_user_combo_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_hist_user_combo_key ON app.home_combination_exercise_history USING btree (user_id, combination_id, exercise_key);


--
-- TOC entry 5350 (class 1259 OID 27076)
-- Name: idx_hist_user_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_hist_user_created ON app.user_exercise_history USING btree (user_id, created_at DESC);


--
-- TOC entry 5351 (class 1259 OID 27077)
-- Name: idx_hist_user_key_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_hist_user_key_created ON app.user_exercise_history USING btree (user_id, exercise_key, created_at DESC);


--
-- TOC entry 5352 (class 1259 OID 27114)
-- Name: idx_history_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_history_key ON app.user_exercise_history USING btree (exercise_key);


--
-- TOC entry 5353 (class 1259 OID 27113)
-- Name: idx_history_user_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_history_user_created ON app.user_exercise_history USING btree (user_id, created_at DESC);


--
-- TOC entry 5505 (class 1259 OID 27905)
-- Name: idx_home_exercise_history_created_at; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_exercise_history_created_at ON app.home_exercise_history USING btree (created_at);


--
-- TOC entry 5506 (class 1259 OID 27908)
-- Name: idx_home_exercise_history_plan; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_exercise_history_plan ON app.home_exercise_history USING btree (plan_id);


--
-- TOC entry 5507 (class 1259 OID 27907)
-- Name: idx_home_exercise_history_session; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_exercise_history_session ON app.home_exercise_history USING btree (session_id);


--
-- TOC entry 5508 (class 1259 OID 27906)
-- Name: idx_home_exercise_history_user_exercise; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_exercise_history_user_exercise ON app.home_exercise_history USING btree (user_id, exercise_name);


--
-- TOC entry 5509 (class 1259 OID 27904)
-- Name: idx_home_exercise_history_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_exercise_history_user_id ON app.home_exercise_history USING btree (user_id);


--
-- TOC entry 5325 (class 1259 OID 26799)
-- Name: idx_home_exercise_progress_session_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_exercise_progress_session_id ON app.home_exercise_progress USING btree (home_training_session_id);


--
-- TOC entry 5315 (class 1259 OID 26796)
-- Name: idx_home_training_plans_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_training_plans_user_id ON app.home_training_plans USING btree (user_id);


--
-- TOC entry 5320 (class 1259 OID 26798)
-- Name: idx_home_training_sessions_plan_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_training_sessions_plan_id ON app.home_training_sessions USING btree (home_training_plan_id);


--
-- TOC entry 5321 (class 1259 OID 26797)
-- Name: idx_home_training_sessions_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_training_sessions_user_id ON app.home_training_sessions USING btree (user_id);


--
-- TOC entry 5515 (class 1259 OID 27930)
-- Name: idx_home_training_templates_lookup; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_home_training_templates_lookup ON app.home_training_templates USING btree (equipment_type, training_type) WHERE (is_active = true);


--
-- TOC entry 5383 (class 1259 OID 27255)
-- Name: idx_medical_docs_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_medical_docs_user_id ON app.medical_documents USING btree (user_id);


--
-- TOC entry 5549 (class 1259 OID 28227)
-- Name: idx_methodology_feedback_exercise; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_feedback_exercise ON app.methodology_exercise_feedback USING btree (exercise_name);


--
-- TOC entry 5550 (class 1259 OID 28228)
-- Name: idx_methodology_feedback_sentiment; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_feedback_sentiment ON app.methodology_exercise_feedback USING btree (sentiment);


--
-- TOC entry 5551 (class 1259 OID 28226)
-- Name: idx_methodology_feedback_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_feedback_user ON app.methodology_exercise_feedback USING btree (user_id);


--
-- TOC entry 5556 (class 1259 OID 28281)
-- Name: idx_methodology_history_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_history_date ON app.methodology_exercise_history_complete USING btree (session_date);


--
-- TOC entry 5557 (class 1259 OID 28282)
-- Name: idx_methodology_history_sentiment; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_history_sentiment ON app.methodology_exercise_history_complete USING btree (sentiment);


--
-- TOC entry 5558 (class 1259 OID 28279)
-- Name: idx_methodology_history_user_exercise; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_history_user_exercise ON app.methodology_exercise_history_complete USING btree (user_id, exercise_name);


--
-- TOC entry 5559 (class 1259 OID 28280)
-- Name: idx_methodology_history_user_type; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_history_user_type ON app.methodology_exercise_history_complete USING btree (user_id, methodology_type);


--
-- TOC entry 5398 (class 1259 OID 27283)
-- Name: idx_methodology_plans_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_created ON app.methodology_plans USING btree (created_at DESC);


--
-- TOC entry 5399 (class 1259 OID 27282)
-- Name: idx_methodology_plans_created_at; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_created_at ON app.methodology_plans USING btree (created_at);


--
-- TOC entry 5400 (class 1259 OID 27570)
-- Name: idx_methodology_plans_custom_weeks; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_custom_weeks ON app.methodology_plans USING btree (custom_weeks);


--
-- TOC entry 5401 (class 1259 OID 27281)
-- Name: idx_methodology_plans_methodology_type; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_methodology_type ON app.methodology_plans USING btree (methodology_type);


--
-- TOC entry 5402 (class 1259 OID 27284)
-- Name: idx_methodology_plans_plan_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_plan_gin ON app.methodology_plans USING gin (plan_data);


--
-- TOC entry 5403 (class 1259 OID 27571)
-- Name: idx_methodology_plans_selection_mode; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_selection_mode ON app.methodology_plans USING btree (selection_mode);


--
-- TOC entry 5404 (class 1259 OID 27280)
-- Name: idx_methodology_plans_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_plans_user_id ON app.methodology_plans USING btree (user_id);


--
-- TOC entry 5544 (class 1259 OID 28223)
-- Name: idx_methodology_progress_session; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_progress_session ON app.methodology_exercise_progress USING btree (methodology_session_id);


--
-- TOC entry 5545 (class 1259 OID 28225)
-- Name: idx_methodology_progress_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_progress_status ON app.methodology_exercise_progress USING btree (status);


--
-- TOC entry 5546 (class 1259 OID 28224)
-- Name: idx_methodology_progress_user_exercise; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_progress_user_exercise ON app.methodology_exercise_progress USING btree (user_id, exercise_name);


--
-- TOC entry 5539 (class 1259 OID 28221)
-- Name: idx_methodology_sessions_plan; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_sessions_plan ON app.methodology_exercise_sessions USING btree (methodology_plan_id);


--
-- TOC entry 5540 (class 1259 OID 28220)
-- Name: idx_methodology_sessions_user_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_sessions_user_status ON app.methodology_exercise_sessions USING btree (user_id, session_status);


--
-- TOC entry 5541 (class 1259 OID 28222)
-- Name: idx_methodology_sessions_week_day; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_methodology_sessions_week_day ON app.methodology_exercise_sessions USING btree (week_number, day_name);


--
-- TOC entry 5481 (class 1259 OID 27761)
-- Name: idx_music_playlists_created_at; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_music_playlists_created_at ON app.music_playlists USING btree (created_at DESC);


--
-- TOC entry 5482 (class 1259 OID 27762)
-- Name: idx_music_playlists_tracks_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_music_playlists_tracks_gin ON app.music_playlists USING gin (tracks);


--
-- TOC entry 5483 (class 1259 OID 27759)
-- Name: idx_music_playlists_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_music_playlists_user_id ON app.music_playlists USING btree (user_id);


--
-- TOC entry 5484 (class 1259 OID 27760)
-- Name: idx_music_playlists_user_name; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_music_playlists_user_name ON app.music_playlists USING btree (user_id, name);


--
-- TOC entry 5477 (class 1259 OID 27702)
-- Name: idx_nutrition_goals_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_nutrition_goals_active ON app.nutrition_goals USING btree (user_id, is_active);


--
-- TOC entry 5478 (class 1259 OID 27701)
-- Name: idx_nutrition_goals_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_nutrition_goals_user ON app.nutrition_goals USING btree (user_id);


--
-- TOC entry 5456 (class 1259 OID 27614)
-- Name: idx_nutrition_plans_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_nutrition_plans_active ON app.nutrition_plans USING btree (user_id, is_active);


--
-- TOC entry 5457 (class 1259 OID 27615)
-- Name: idx_nutrition_plans_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_nutrition_plans_created ON app.nutrition_plans USING btree (created_at);


--
-- TOC entry 5458 (class 1259 OID 27613)
-- Name: idx_nutrition_plans_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_nutrition_plans_user_id ON app.nutrition_plans USING btree (user_id);


--
-- TOC entry 5316 (class 1259 OID 27017)
-- Name: idx_plans_user_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_plans_user_created ON app.home_training_plans USING btree (user_id, created_at DESC);


--
-- TOC entry 5317 (class 1259 OID 27030)
-- Name: idx_plans_user_time; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_plans_user_time ON app.home_training_plans USING btree (user_id, created_at DESC);


--
-- TOC entry 5326 (class 1259 OID 27075)
-- Name: idx_progress_session_order; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_progress_session_order ON app.home_exercise_progress USING btree (home_training_session_id, exercise_order);


--
-- TOC entry 5327 (class 1259 OID 27058)
-- Name: idx_progress_session_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_progress_session_status ON app.home_exercise_progress USING btree (home_training_session_id, status);


--
-- TOC entry 5442 (class 1259 OID 27439)
-- Name: idx_routine_exercise_feedback_sentiment; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_exercise_feedback_sentiment ON app.routine_exercise_feedback USING btree (sentiment);


--
-- TOC entry 5443 (class 1259 OID 27437)
-- Name: idx_routine_exercise_feedback_session; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_exercise_feedback_session ON app.routine_exercise_feedback USING btree (routine_session_id);


--
-- TOC entry 5444 (class 1259 OID 27438)
-- Name: idx_routine_exercise_feedback_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_exercise_feedback_user ON app.routine_exercise_feedback USING btree (user_id);


--
-- TOC entry 5435 (class 1259 OID 27434)
-- Name: idx_routine_exercise_progress_session; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_exercise_progress_session ON app.routine_exercise_progress USING btree (routine_session_id);


--
-- TOC entry 5436 (class 1259 OID 27436)
-- Name: idx_routine_exercise_progress_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_exercise_progress_status ON app.routine_exercise_progress USING btree (status);


--
-- TOC entry 5437 (class 1259 OID 27435)
-- Name: idx_routine_exercise_progress_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_exercise_progress_user ON app.routine_exercise_progress USING btree (user_id);


--
-- TOC entry 5419 (class 1259 OID 27429)
-- Name: idx_routine_plans_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_plans_active ON app.routine_plans USING btree (user_id, is_active);


--
-- TOC entry 5420 (class 1259 OID 27428)
-- Name: idx_routine_plans_methodology; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_plans_methodology ON app.routine_plans USING btree (methodology_type);


--
-- TOC entry 5421 (class 1259 OID 27427)
-- Name: idx_routine_plans_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_plans_user_id ON app.routine_plans USING btree (user_id);


--
-- TOC entry 5424 (class 1259 OID 27433)
-- Name: idx_routine_sessions_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_sessions_date ON app.routine_sessions USING btree (session_date);


--
-- TOC entry 5425 (class 1259 OID 27431)
-- Name: idx_routine_sessions_plan_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_sessions_plan_id ON app.routine_sessions USING btree (routine_plan_id);


--
-- TOC entry 5426 (class 1259 OID 27432)
-- Name: idx_routine_sessions_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_sessions_status ON app.routine_sessions USING btree (user_id, status);


--
-- TOC entry 5427 (class 1259 OID 27430)
-- Name: idx_routine_sessions_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_routine_sessions_user_id ON app.routine_sessions USING btree (user_id);


--
-- TOC entry 5322 (class 1259 OID 27074)
-- Name: idx_sessions_user_started; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_sessions_user_started ON app.home_training_sessions USING btree (user_id, started_at DESC);


--
-- TOC entry 5472 (class 1259 OID 27683)
-- Name: idx_supplement_recommendations_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_supplement_recommendations_active ON app.supplement_recommendations USING btree (user_id, is_active);


--
-- TOC entry 5473 (class 1259 OID 27682)
-- Name: idx_supplement_recommendations_priority; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_supplement_recommendations_priority ON app.supplement_recommendations USING btree (priority);


--
-- TOC entry 5474 (class 1259 OID 27681)
-- Name: idx_supplement_recommendations_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_supplement_recommendations_user ON app.supplement_recommendations USING btree (user_id);


--
-- TOC entry 5391 (class 1259 OID 27257)
-- Name: idx_technique_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_technique_user_id ON app.technique_analysis USING btree (user_id);


--
-- TOC entry 5363 (class 1259 OID 28109)
-- Name: idx_uef_created_at; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_uef_created_at ON app.user_exercise_feedback USING btree (created_at);


--
-- TOC entry 5364 (class 1259 OID 28110)
-- Name: idx_uef_exercise_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_uef_exercise_key ON app.user_exercise_feedback USING btree (exercise_key);


--
-- TOC entry 5365 (class 1259 OID 28108)
-- Name: idx_uef_session_order; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_uef_session_order ON app.user_exercise_feedback USING btree (user_id, session_id, exercise_order);


--
-- TOC entry 5354 (class 1259 OID 27036)
-- Name: idx_ueh_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_ueh_key ON app.user_exercise_history USING btree (exercise_key);


--
-- TOC entry 5355 (class 1259 OID 27033)
-- Name: idx_ueh_user_created; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_ueh_user_created ON app.user_exercise_history USING btree (user_id, created_at DESC);


--
-- TOC entry 5533 (class 1259 OID 28097)
-- Name: idx_upe_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_upe_active ON app.user_personalized_equipment USING btree (is_active);


--
-- TOC entry 5534 (class 1259 OID 28096)
-- Name: idx_upe_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_upe_user ON app.user_personalized_equipment USING btree (user_id);


--
-- TOC entry 5334 (class 1259 OID 26907)
-- Name: idx_user_alergias_alergia; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_alergias_alergia ON app.user_alergias USING btree (lower(alergia));


--
-- TOC entry 5340 (class 1259 OID 26933)
-- Name: idx_user_alimentos_excluidos_alimento; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_alimentos_excluidos_alimento ON app.user_alimentos_excluidos USING btree (lower(alimento));


--
-- TOC entry 5377 (class 1259 OID 27161)
-- Name: idx_user_custom_equipment_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_custom_equipment_user ON app.user_custom_equipment USING btree (user_id);


--
-- TOC entry 5449 (class 1259 OID 27530)
-- Name: idx_user_daily_activity_plan; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_daily_activity_plan ON app.user_daily_activity USING btree (routine_plan_id);


--
-- TOC entry 5450 (class 1259 OID 27531)
-- Name: idx_user_daily_activity_type; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_daily_activity_type ON app.user_daily_activity USING btree (activity_type);


--
-- TOC entry 5451 (class 1259 OID 27529)
-- Name: idx_user_daily_activity_user_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_daily_activity_user_date ON app.user_daily_activity USING btree (user_id, activity_date);


--
-- TOC entry 5372 (class 1259 OID 27160)
-- Name: idx_user_equipment_equipment; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_equipment_equipment ON app.user_equipment USING btree (equipment_id);


--
-- TOC entry 5373 (class 1259 OID 27159)
-- Name: idx_user_equipment_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_equipment_user ON app.user_equipment USING btree (user_id);


--
-- TOC entry 5356 (class 1259 OID 27000)
-- Name: idx_user_exercise_history_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_exercise_history_key ON app.user_exercise_history USING btree (exercise_key);


--
-- TOC entry 5357 (class 1259 OID 26998)
-- Name: idx_user_exercise_history_user; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_exercise_history_user ON app.user_exercise_history USING btree (user_id);


--
-- TOC entry 5329 (class 1259 OID 26800)
-- Name: idx_user_home_training_stats_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_home_training_stats_user_id ON app.user_home_training_stats USING btree (user_id);


--
-- TOC entry 5346 (class 1259 OID 26959)
-- Name: idx_user_limitaciones_limitacion; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_limitaciones_limitacion ON app.user_limitaciones USING btree (lower(limitacion));


--
-- TOC entry 5337 (class 1259 OID 26920)
-- Name: idx_user_medicamentos_medicamento; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_medicamentos_medicamento ON app.user_medicamentos USING btree (lower(medicamento));


--
-- TOC entry 5489 (class 1259 OID 27831)
-- Name: idx_user_profiles_metodologia; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_profiles_metodologia ON app.user_profiles USING btree (metodologia_preferida);


--
-- TOC entry 5490 (class 1259 OID 27830)
-- Name: idx_user_profiles_objetivo; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_profiles_objetivo ON app.user_profiles USING btree (objetivo_principal);


--
-- TOC entry 5491 (class 1259 OID 27829)
-- Name: idx_user_profiles_user_id; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_profiles_user_id ON app.user_profiles USING btree (user_id);


--
-- TOC entry 5343 (class 1259 OID 26946)
-- Name: idx_user_suplementos_suplemento; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_user_suplementos_suplemento ON app.user_suplementos USING btree (lower(suplemento));


--
-- TOC entry 5302 (class 1259 OID 26980)
-- Name: idx_users_alergias_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_alergias_gin ON app.users USING gin (alergias);


--
-- TOC entry 5303 (class 1259 OID 26983)
-- Name: idx_users_alimentos_excluidos_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_alimentos_excluidos_gin ON app.users USING gin (alimentos_excluidos);


--
-- TOC entry 5304 (class 1259 OID 26699)
-- Name: idx_users_email; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_email ON app.users USING btree (email);


--
-- TOC entry 5305 (class 1259 OID 26984)
-- Name: idx_users_limitaciones_fisicas_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_limitaciones_fisicas_gin ON app.users USING gin (limitaciones_fisicas);


--
-- TOC entry 5306 (class 1259 OID 26981)
-- Name: idx_users_medicamentos_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_medicamentos_gin ON app.users USING gin (medicamentos);


--
-- TOC entry 5307 (class 1259 OID 27572)
-- Name: idx_users_nivel_anos; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_nivel_anos ON app.users USING btree (nivel_entrenamiento, anos_entrenando);


--
-- TOC entry 5308 (class 1259 OID 26982)
-- Name: idx_users_suplementacion_gin; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_users_suplementacion_gin ON app.users USING gin (suplementacion);


--
-- TOC entry 5328 (class 1259 OID 27079)
-- Name: uidx_progress_session_order; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uidx_progress_session_order ON app.home_exercise_progress USING btree (home_training_session_id, exercise_order);


--
-- TOC entry 5358 (class 1259 OID 27072)
-- Name: uidx_user_hist_unique; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uidx_user_hist_unique ON app.user_exercise_history USING btree (user_id, session_id, exercise_name);


--
-- TOC entry 5510 (class 1259 OID 27909)
-- Name: unique_home_exercise_user_session; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX unique_home_exercise_user_session ON app.home_exercise_history USING btree (user_id, exercise_name, session_id);


--
-- TOC entry 5502 (class 1259 OID 27872)
-- Name: uq_exercise_ai_info_name_normalized; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uq_exercise_ai_info_name_normalized ON app.exercise_ai_info USING btree (exercise_name_normalized);


--
-- TOC entry 5434 (class 1259 OID 28340)
-- Name: uq_routine_session_once_idx; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uq_routine_session_once_idx ON app.routine_sessions USING btree (user_id, routine_plan_id, week_number, day_name);


--
-- TOC entry 5378 (class 1259 OID 27174)
-- Name: uq_user_custom_equipment; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uq_user_custom_equipment ON app.user_custom_equipment USING btree (user_id, name);


--
-- TOC entry 5374 (class 1259 OID 27173)
-- Name: uq_user_equipment_user_key; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uq_user_equipment_user_key ON app.user_equipment USING btree (user_id, equipment_key);


--
-- TOC entry 5615 (class 2620 OID 26962)
-- Name: users set_timestamp_users; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.set_timestamp();


--
-- TOC entry 5638 (class 2620 OID 28062)
-- Name: home_combination_exercise_history trg_hist_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_hist_updated_at BEFORE UPDATE ON app.home_combination_exercise_history FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- TOC entry 5619 (class 2620 OID 26802)
-- Name: home_training_plans trg_home_training_plans_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_home_training_plans_updated_at BEFORE UPDATE ON app.home_training_plans FOR EACH ROW EXECUTE FUNCTION public.update_home_training_plans_updated_at();


--
-- TOC entry 5644 (class 2620 OID 28259)
-- Name: methodology_exercise_feedback trg_mef_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_mef_updated_at BEFORE UPDATE ON app.methodology_exercise_feedback FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- TOC entry 5641 (class 2620 OID 28258)
-- Name: methodology_exercise_progress trg_mep_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_mep_updated_at BEFORE UPDATE ON app.methodology_exercise_progress FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- TOC entry 5640 (class 2620 OID 28257)
-- Name: methodology_exercise_sessions trg_mes_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_mes_updated_at BEFORE UPDATE ON app.methodology_exercise_sessions FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- TOC entry 5635 (class 2620 OID 27764)
-- Name: music_playlists trg_music_playlists_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_music_playlists_updated_at BEFORE UPDATE ON app.music_playlists FOR EACH ROW EXECUTE FUNCTION app.update_music_playlists_updated_at();


--
-- TOC entry 5628 (class 2620 OID 28349)
-- Name: routine_exercise_progress trg_progress_update_session_counters_del; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_progress_update_session_counters_del AFTER DELETE ON app.routine_exercise_progress FOR EACH ROW EXECUTE FUNCTION app.trg_progress_update_session_counters();


--
-- TOC entry 5629 (class 2620 OID 28347)
-- Name: routine_exercise_progress trg_progress_update_session_counters_ins; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_progress_update_session_counters_ins AFTER INSERT ON app.routine_exercise_progress FOR EACH ROW EXECUTE FUNCTION app.trg_progress_update_session_counters();


--
-- TOC entry 5630 (class 2620 OID 28348)
-- Name: routine_exercise_progress trg_progress_update_session_counters_upd; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_progress_update_session_counters_upd AFTER UPDATE OF status ON app.routine_exercise_progress FOR EACH ROW EXECUTE FUNCTION app.trg_progress_update_session_counters();


--
-- TOC entry 5625 (class 2620 OID 28345)
-- Name: routine_sessions trg_routine_sessions_exercises_data_changed; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_routine_sessions_exercises_data_changed AFTER INSERT OR UPDATE OF exercises_data ON app.routine_sessions FOR EACH ROW EXECUTE FUNCTION app.trg_routine_sessions_exercises_data_changed();


--
-- TOC entry 5616 (class 2620 OID 27261)
-- Name: users trg_save_body_composition; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_save_body_composition AFTER UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.save_body_composition();


--
-- TOC entry 5617 (class 2620 OID 26716)
-- Name: users trg_update_timestamp; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_update_timestamp BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 5620 (class 2620 OID 26805)
-- Name: home_training_sessions trg_update_user_home_stats; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_update_user_home_stats AFTER UPDATE ON app.home_training_sessions FOR EACH ROW EXECUTE FUNCTION public.update_user_home_training_stats();


--
-- TOC entry 5639 (class 2620 OID 28098)
-- Name: user_personalized_equipment trg_upe_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_upe_updated_at BEFORE UPDATE ON app.user_personalized_equipment FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- TOC entry 5622 (class 2620 OID 26803)
-- Name: user_home_training_stats trg_user_home_training_stats_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_user_home_training_stats_updated_at BEFORE UPDATE ON app.user_home_training_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 5621 (class 2620 OID 28070)
-- Name: home_exercise_progress trigger_12_combinations_history_on_exercise_complete; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_12_combinations_history_on_exercise_complete AFTER UPDATE ON app.home_exercise_progress FOR EACH ROW EXECUTE FUNCTION app.trigger_update_12_combinations_history();


--
-- TOC entry 5626 (class 2620 OID 27541)
-- Name: routine_sessions trigger_auto_register_session_activity; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_auto_register_session_activity AFTER UPDATE ON app.routine_sessions FOR EACH ROW EXECUTE FUNCTION app.auto_register_session_activity();


--
-- TOC entry 5634 (class 2620 OID 27708)
-- Name: daily_nutrition_log trigger_daily_nutrition_log_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_daily_nutrition_log_updated_at BEFORE UPDATE ON app.daily_nutrition_log FOR EACH ROW EXECUTE FUNCTION app.update_daily_nutrition_log_updated_at();


--
-- TOC entry 5642 (class 2620 OID 28284)
-- Name: methodology_exercise_progress trigger_methodology_history_consolidate; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_methodology_history_consolidate AFTER UPDATE ON app.methodology_exercise_progress FOR EACH ROW WHEN ((((new.status)::text = 'completed'::text) AND ((old.status)::text IS DISTINCT FROM 'completed'::text))) EXECUTE FUNCTION app.consolidate_methodology_exercise_history();


--
-- TOC entry 5643 (class 2620 OID 28283)
-- Name: methodology_exercise_progress trigger_methodology_progress_update; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_methodology_progress_update AFTER UPDATE ON app.methodology_exercise_progress FOR EACH ROW WHEN ((((new.status)::text = 'completed'::text) AND ((old.status)::text IS DISTINCT FROM 'completed'::text))) EXECUTE FUNCTION app.update_methodology_session_progress();


--
-- TOC entry 5633 (class 2620 OID 27706)
-- Name: nutrition_plans trigger_nutrition_plans_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_nutrition_plans_updated_at BEFORE UPDATE ON app.nutrition_plans FOR EACH ROW EXECUTE FUNCTION app.update_nutrition_plans_updated_at();


--
-- TOC entry 5637 (class 2620 OID 27871)
-- Name: exercise_ai_info trigger_update_exercise_name_normalized; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_update_exercise_name_normalized BEFORE INSERT OR UPDATE ON app.exercise_ai_info FOR EACH ROW EXECUTE FUNCTION app.update_exercise_name_row();


--
-- TOC entry 5623 (class 2620 OID 27328)
-- Name: exercise_repetition_policy trigger_update_policy_timestamp; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_update_policy_timestamp BEFORE UPDATE ON app.exercise_repetition_policy FOR EACH ROW EXECUTE FUNCTION app.update_policy_timestamp();


--
-- TOC entry 5632 (class 2620 OID 27447)
-- Name: routine_exercise_feedback trigger_update_routine_exercise_feedback_timestamp; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_update_routine_exercise_feedback_timestamp BEFORE UPDATE ON app.routine_exercise_feedback FOR EACH ROW EXECUTE FUNCTION app.update_routine_timestamp();


--
-- TOC entry 5631 (class 2620 OID 27446)
-- Name: routine_exercise_progress trigger_update_routine_exercise_progress_timestamp; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_update_routine_exercise_progress_timestamp BEFORE UPDATE ON app.routine_exercise_progress FOR EACH ROW EXECUTE FUNCTION app.update_routine_timestamp();


--
-- TOC entry 5624 (class 2620 OID 27444)
-- Name: routine_plans trigger_update_routine_plans_timestamp; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_update_routine_plans_timestamp BEFORE UPDATE ON app.routine_plans FOR EACH ROW EXECUTE FUNCTION app.update_routine_timestamp();


--
-- TOC entry 5627 (class 2620 OID 27445)
-- Name: routine_sessions trigger_update_routine_sessions_timestamp; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_update_routine_sessions_timestamp BEFORE UPDATE ON app.routine_sessions FOR EACH ROW EXECUTE FUNCTION app.update_routine_timestamp();


--
-- TOC entry 5636 (class 2620 OID 27833)
-- Name: user_profiles trigger_user_profiles_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trigger_user_profiles_updated_at BEFORE UPDATE ON app.user_profiles FOR EACH ROW EXECUTE FUNCTION app.update_user_profiles_updated_at();


--
-- TOC entry 5618 (class 2620 OID 26706)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5596 (class 2606 OID 27634)
-- Name: daily_nutrition_log daily_nutrition_log_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.daily_nutrition_log
    ADD CONSTRAINT daily_nutrition_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5601 (class 2606 OID 27863)
-- Name: exercise_ai_info exercise_ai_info_first_requested_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_ai_info
    ADD CONSTRAINT exercise_ai_info_first_requested_by_fkey FOREIGN KEY (first_requested_by) REFERENCES app.users(id);


--
-- TOC entry 5584 (class 2606 OID 27301)
-- Name: exercise_history exercise_history_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.exercise_history
    ADD CONSTRAINT exercise_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5582 (class 2606 OID 27250)
-- Name: body_composition_history fk_body_comp_user_id; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.body_composition_history
    ADD CONSTRAINT fk_body_comp_user_id FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5605 (class 2606 OID 28057)
-- Name: home_combination_exercise_history fk_combination_history_combination; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_combination_exercise_history
    ADD CONSTRAINT fk_combination_history_combination FOREIGN KEY (combination_id) REFERENCES app.home_training_combinations(id) ON DELETE CASCADE;


--
-- TOC entry 5606 (class 2606 OID 28052)
-- Name: home_combination_exercise_history fk_combination_history_user; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_combination_exercise_history
    ADD CONSTRAINT fk_combination_history_user FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5576 (class 2606 OID 27115)
-- Name: user_exercise_feedback fk_feedback_session; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_feedback
    ADD CONSTRAINT fk_feedback_session FOREIGN KEY (session_id) REFERENCES app.home_training_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 5574 (class 2606 OID 27053)
-- Name: user_exercise_history fk_hist_plan; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_history
    ADD CONSTRAINT fk_hist_plan FOREIGN KEY (plan_id) REFERENCES app.home_training_plans(id) ON DELETE SET NULL;


--
-- TOC entry 5575 (class 2606 OID 27048)
-- Name: user_exercise_history fk_hist_session; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_exercise_history
    ADD CONSTRAINT fk_hist_session FOREIGN KEY (session_id) REFERENCES app.home_training_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 5580 (class 2606 OID 27195)
-- Name: medical_documents fk_medical_docs_user_id; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.medical_documents
    ADD CONSTRAINT fk_medical_docs_user_id FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5599 (class 2606 OID 27752)
-- Name: music_playlists fk_music_playlists_user_id; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.music_playlists
    ADD CONSTRAINT fk_music_playlists_user_id FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5581 (class 2606 OID 27230)
-- Name: technique_analysis fk_technique_user_id; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.technique_analysis
    ADD CONSTRAINT fk_technique_user_id FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5602 (class 2606 OID 27894)
-- Name: home_exercise_history home_exercise_history_plan_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_history
    ADD CONSTRAINT home_exercise_history_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES app.home_training_plans(id) ON DELETE CASCADE;


--
-- TOC entry 5603 (class 2606 OID 27899)
-- Name: home_exercise_history home_exercise_history_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_history
    ADD CONSTRAINT home_exercise_history_session_id_fkey FOREIGN KEY (session_id) REFERENCES app.home_training_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5604 (class 2606 OID 27889)
-- Name: home_exercise_history home_exercise_history_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_history
    ADD CONSTRAINT home_exercise_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5567 (class 2606 OID 26770)
-- Name: home_exercise_progress home_exercise_progress_home_training_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_exercise_progress
    ADD CONSTRAINT home_exercise_progress_home_training_session_id_fkey FOREIGN KEY (home_training_session_id) REFERENCES app.home_training_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5564 (class 2606 OID 26730)
-- Name: home_training_plans home_training_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_plans
    ADD CONSTRAINT home_training_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5565 (class 2606 OID 26754)
-- Name: home_training_sessions home_training_sessions_home_training_plan_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_sessions
    ADD CONSTRAINT home_training_sessions_home_training_plan_id_fkey FOREIGN KEY (home_training_plan_id) REFERENCES app.home_training_plans(id) ON DELETE CASCADE;


--
-- TOC entry 5566 (class 2606 OID 26749)
-- Name: home_training_sessions home_training_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.home_training_sessions
    ADD CONSTRAINT home_training_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5612 (class 2606 OID 28183)
-- Name: methodology_exercise_feedback methodology_exercise_feedback_methodology_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_feedback
    ADD CONSTRAINT methodology_exercise_feedback_methodology_session_id_fkey FOREIGN KEY (methodology_session_id) REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5613 (class 2606 OID 28188)
-- Name: methodology_exercise_feedback methodology_exercise_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_feedback
    ADD CONSTRAINT methodology_exercise_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5614 (class 2606 OID 28272)
-- Name: methodology_exercise_history_complete methodology_exercise_history_complete_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_history_complete
    ADD CONSTRAINT methodology_exercise_history_complete_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5610 (class 2606 OID 28159)
-- Name: methodology_exercise_progress methodology_exercise_progress_methodology_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_progress
    ADD CONSTRAINT methodology_exercise_progress_methodology_session_id_fkey FOREIGN KEY (methodology_session_id) REFERENCES app.methodology_exercise_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5611 (class 2606 OID 28164)
-- Name: methodology_exercise_progress methodology_exercise_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_progress
    ADD CONSTRAINT methodology_exercise_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5608 (class 2606 OID 28138)
-- Name: methodology_exercise_sessions methodology_exercise_sessions_methodology_plan_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_sessions
    ADD CONSTRAINT methodology_exercise_sessions_methodology_plan_id_fkey FOREIGN KEY (methodology_plan_id) REFERENCES app.methodology_plans(id) ON DELETE CASCADE;


--
-- TOC entry 5609 (class 2606 OID 28133)
-- Name: methodology_exercise_sessions methodology_exercise_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_exercise_sessions
    ADD CONSTRAINT methodology_exercise_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5583 (class 2606 OID 27275)
-- Name: methodology_plans methodology_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.methodology_plans
    ADD CONSTRAINT methodology_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5598 (class 2606 OID 27696)
-- Name: nutrition_goals nutrition_goals_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.nutrition_goals
    ADD CONSTRAINT nutrition_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5595 (class 2606 OID 27608)
-- Name: nutrition_plans nutrition_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.nutrition_plans
    ADD CONSTRAINT nutrition_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5590 (class 2606 OID 27422)
-- Name: routine_exercise_feedback routine_exercise_feedback_routine_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_feedback
    ADD CONSTRAINT routine_exercise_feedback_routine_session_id_fkey FOREIGN KEY (routine_session_id) REFERENCES app.routine_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5591 (class 2606 OID 27417)
-- Name: routine_exercise_feedback routine_exercise_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_feedback
    ADD CONSTRAINT routine_exercise_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5588 (class 2606 OID 27399)
-- Name: routine_exercise_progress routine_exercise_progress_routine_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_progress
    ADD CONSTRAINT routine_exercise_progress_routine_session_id_fkey FOREIGN KEY (routine_session_id) REFERENCES app.routine_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5589 (class 2606 OID 27394)
-- Name: routine_exercise_progress routine_exercise_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_exercise_progress
    ADD CONSTRAINT routine_exercise_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5585 (class 2606 OID 27348)
-- Name: routine_plans routine_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_plans
    ADD CONSTRAINT routine_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5586 (class 2606 OID 27374)
-- Name: routine_sessions routine_sessions_routine_plan_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_sessions
    ADD CONSTRAINT routine_sessions_routine_plan_id_fkey FOREIGN KEY (routine_plan_id) REFERENCES app.routine_plans(id) ON DELETE CASCADE;


--
-- TOC entry 5587 (class 2606 OID 27369)
-- Name: routine_sessions routine_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.routine_sessions
    ADD CONSTRAINT routine_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5597 (class 2606 OID 27676)
-- Name: supplement_recommendations supplement_recommendations_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.supplement_recommendations
    ADD CONSTRAINT supplement_recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5569 (class 2606 OID 26902)
-- Name: user_alergias user_alergias_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_alergias
    ADD CONSTRAINT user_alergias_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5571 (class 2606 OID 26928)
-- Name: user_alimentos_excluidos user_alimentos_excluidos_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_alimentos_excluidos
    ADD CONSTRAINT user_alimentos_excluidos_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5579 (class 2606 OID 27154)
-- Name: user_custom_equipment user_custom_equipment_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_custom_equipment
    ADD CONSTRAINT user_custom_equipment_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5592 (class 2606 OID 27519)
-- Name: user_daily_activity user_daily_activity_routine_plan_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_daily_activity
    ADD CONSTRAINT user_daily_activity_routine_plan_id_fkey FOREIGN KEY (routine_plan_id) REFERENCES app.routine_plans(id) ON DELETE CASCADE;


--
-- TOC entry 5593 (class 2606 OID 27524)
-- Name: user_daily_activity user_daily_activity_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_daily_activity
    ADD CONSTRAINT user_daily_activity_session_id_fkey FOREIGN KEY (session_id) REFERENCES app.routine_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 5594 (class 2606 OID 27514)
-- Name: user_daily_activity user_daily_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_daily_activity
    ADD CONSTRAINT user_daily_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5577 (class 2606 OID 27141)
-- Name: user_equipment user_equipment_equipment_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_equipment
    ADD CONSTRAINT user_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES app.equipment_catalog(id) ON DELETE CASCADE;


--
-- TOC entry 5578 (class 2606 OID 27136)
-- Name: user_equipment user_equipment_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_equipment
    ADD CONSTRAINT user_equipment_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5568 (class 2606 OID 26791)
-- Name: user_home_training_stats user_home_training_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_home_training_stats
    ADD CONSTRAINT user_home_training_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5573 (class 2606 OID 26954)
-- Name: user_limitaciones user_limitaciones_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_limitaciones
    ADD CONSTRAINT user_limitaciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5570 (class 2606 OID 26915)
-- Name: user_medicamentos user_medicamentos_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_medicamentos
    ADD CONSTRAINT user_medicamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5607 (class 2606 OID 28091)
-- Name: user_personalized_equipment user_personalized_equipment_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_personalized_equipment
    ADD CONSTRAINT user_personalized_equipment_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5600 (class 2606 OID 27824)
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 5572 (class 2606 OID 26941)
-- Name: user_suplementos user_suplementos_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.user_suplementos
    ADD CONSTRAINT user_suplementos_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- TOC entry 2423 (class 826 OID 26963)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: app; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO postgres;


-- Completed on 2025-08-29 08:27:39

--
-- PostgreSQL database dump complete
--

