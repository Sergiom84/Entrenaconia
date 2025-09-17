-- ===============================================
-- SETUP COMPLETO DEL SISTEMA UNIFICADO DE FEEDBACK
-- PROPÓSITO: Script de instalación completa para el sistema de feedback
-- EJECUTAR: En orden secuencial en Supabase SQL Editor
-- FECHA: 2025-09-14
-- AUTOR: Claude Code - Entrena con IA
-- ===============================================

-- PASO 1: Verificar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- PASO 2: Ejecutar script principal del sistema unificado
\i create_unified_feedback_system.sql

-- PASO 3: Ejecutar funciones de integración con IA
\i feedback_ai_integration_functions.sql

-- PASO 4: Ejecutar migración de datos existentes
-- (Solo ejecutar si existen datos en home_exercise_rejections)
DO $$
DECLARE
    existing_rejections INTEGER;
    migrated_count INTEGER;
BEGIN
    -- Verificar si hay datos para migrar
    SELECT COUNT(*) INTO existing_rejections
    FROM app.home_exercise_rejections
    WHERE is_active = TRUE;

    IF existing_rejections > 0 THEN
        -- Ejecutar migración
        SELECT app.migrate_home_rejections_to_unified_feedback() INTO migrated_count;

        RAISE NOTICE 'MIGRACIÓN COMPLETADA: % registros migrados de % encontrados',
                     migrated_count, existing_rejections;
    ELSE
        RAISE NOTICE 'No se encontraron datos para migrar en home_exercise_rejections';
    END IF;
END $$;

-- PASO 5: Insertar datos de ejemplo para testing (OPCIONAL)
-- Descomenta las siguientes líneas para insertar datos de prueba

/*
-- Usuario de ejemplo (ajusta el user_id según tu base de datos)
DO $$
DECLARE
    test_user_id INTEGER := 18; -- Cambia por un user_id válido
BEGIN
    -- Feedback negativo de ejemplo
    INSERT INTO app.user_exercise_feedback
    (user_id, exercise_name, exercise_key, methodology_type, equipment_type, training_type,
     feedback_type, feedback_category, comment, avoidance_duration_days)
    VALUES
    (test_user_id, 'Burpees con toque en rodillas', 'burpees_con_toque_en_rodillas', 'home_training',
     'personalizado', 'hiit', 'too_difficult', 'difficulty',
     'Muy difíciles para mi nivel actual', 14),
    (test_user_id, 'Sentadillas con salto', 'sentadillas_con_salto', 'home_training',
     'minimo', 'funcional', 'dont_like', 'preference',
     'No me gustan los ejercicios de alto impacto', NULL);

    -- Feedback positivo de ejemplo
    INSERT INTO app.user_exercise_feedback
    (user_id, exercise_name, exercise_key, methodology_type, feedback_type,
     feedback_category, sentiment, comment, ai_weight)
    VALUES
    (test_user_id, 'Flexiones de brazos', 'flexiones_de_brazos', 'calistenia', 'love_it',
     'preference', 'love', 'Me encantan las flexiones, siempre las incluyo', 1.5),
    (test_user_id, 'Plancha frontal', 'plancha_frontal', 'calistenia', 'love_it',
     'preference', 'love', 'Excelente para el core', 1.3);

    -- Preferencias generales del usuario
    INSERT INTO app.user_training_preferences
    (user_id, preferred_methodologies, focus_areas, prefers_challenging,
     physical_limitations, progression_style)
    VALUES
    (test_user_id,
     ARRAY['calistenia', 'home_training'],
     ARRAY['core', 'upper_body', 'cardio'],
     FALSE,
     ARRAY['rodilla izquierda sensible'],
     'gradual')
    ON CONFLICT (user_id) DO UPDATE SET
        preferred_methodologies = EXCLUDED.preferred_methodologies,
        focus_areas = EXCLUDED.focus_areas,
        updated_at = NOW();

    RAISE NOTICE 'Datos de ejemplo insertados para usuario %', test_user_id;
END $$;
*/

-- PASO 6: Verificar instalación
DO $$
DECLARE
    feedback_table_exists BOOLEAN;
    preferences_table_exists BOOLEAN;
    functions_count INTEGER;
BEGIN
    -- Verificar tablas
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'user_exercise_feedback'
    ) INTO feedback_table_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'user_training_preferences'
    ) INTO preferences_table_exists;

    -- Verificar funciones
    SELECT COUNT(*) INTO functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'app'
      AND routine_name IN (
          'get_avoided_exercises_for_ai',
          'get_user_ai_context',
          'save_user_feedback',
          'save_home_training_rejection_compatible',
          'cleanup_expired_feedback'
      );

    -- Reportar resultados
    IF feedback_table_exists AND preferences_table_exists AND functions_count >= 5 THEN
        RAISE NOTICE '✅ INSTALACIÓN EXITOSA';
        RAISE NOTICE '   - Tabla user_exercise_feedback: %',
                     CASE WHEN feedback_table_exists THEN 'CREADA' ELSE 'FALTA' END;
        RAISE NOTICE '   - Tabla user_training_preferences: %',
                     CASE WHEN preferences_table_exists THEN 'CREADA' ELSE 'FALTA' END;
        RAISE NOTICE '   - Funciones instaladas: %/5', functions_count;
        RAISE NOTICE '';
        RAISE NOTICE '🚀 SISTEMA DE FEEDBACK LISTO PARA USAR';
        RAISE NOTICE '';
        RAISE NOTICE '📋 PRÓXIMOS PASOS:';
        RAISE NOTICE '   1. Actualizar el backend de Node.js para usar las nuevas funciones';
        RAISE NOTICE '   2. Crear ExerciseFeedbackModal siguiendo el patrón de HomeTrainingRejectionModal';
        RAISE NOTICE '   3. Integrar app.get_user_ai_context() en la generación de planes de IA';
        RAISE NOTICE '   4. Probar el sistema con usuarios reales';
    ELSE
        RAISE WARNING '❌ INSTALACIÓN INCOMPLETA';
        RAISE WARNING '   - Tabla user_exercise_feedback: %',
                      CASE WHEN feedback_table_exists THEN 'OK' ELSE 'FALTA' END;
        RAISE WARNING '   - Tabla user_training_preferences: %',
                      CASE WHEN preferences_table_exists THEN 'OK' ELSE 'FALTA' END;
        RAISE WARNING '   - Funciones instaladas: %/5', functions_count;
    END IF;
END $$;

-- PASO 7: Mostrar estadísticas iniciales
SELECT 'ESTADÍSTICAS INICIALES' as status;

SELECT
    'user_exercise_feedback' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT user_id) as usuarios_unicos,
    COUNT(DISTINCT methodology_type) as metodologias_distintas
FROM app.user_exercise_feedback

UNION ALL

SELECT
    'user_training_preferences' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT user_id) as usuarios_unicos,
    0 as metodologias_distintas
FROM app.user_training_preferences

UNION ALL

SELECT
    'home_exercise_rejections' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT user_id) as usuarios_unicos,
    0 as metodologias_distintas
FROM app.home_exercise_rejections
WHERE is_active = TRUE;

-- ===============================================
-- INSTRUCCIONES FINALES
-- ===============================================

/*
🎯 RESUMEN DE INSTALACIÓN COMPLETADA

TABLAS CREADAS:
✅ app.user_exercise_feedback - Feedback unificado de ejercicios
✅ app.user_training_preferences - Preferencias generales de usuario

FUNCIONES PRINCIPALES PARA LA IA:
✅ app.get_user_ai_context(user_id, methodology) - Contexto completo del usuario
✅ app.get_avoided_exercises_for_ai(user_id, methodology) - Ejercicios a evitar
✅ app.save_user_feedback(...) - Guardar nuevo feedback
✅ app.save_home_training_rejection_compatible(...) - Compatibilidad con existente

COMPATIBILIDAD:
✅ Mantiene funcionamiento de HomeTrainingRejectionModal.jsx
✅ Funciones de migración para datos existentes
✅ Sistema optimizado para integración con IA

PRÓXIMOS PASOS DE IMPLEMENTACIÓN:

1. BACKEND (Node.js):
   - Modificar calisteniaSpecialist.js para usar app.get_user_ai_context()
   - Crear endpoint POST /api/feedback/save para ExerciseFeedbackModal
   - Integrar filtros de ejercicios evitados en generación de IA

2. FRONTEND (React):
   - Crear ExerciseFeedbackModal.jsx similar a HomeTrainingRejectionModal.jsx
   - Integrar modal en las páginas de entrenamiento
   - Mostrar feedback guardado al usuario

3. IA INTEGRATION:
   - Usar get_avoided_exercises_for_ai() para filtrar ejercicios
   - Usar get_preferred_exercises_for_ai() para priorizar ejercicios favoritos
   - Incluir contexto de usuario en prompts de IA

4. TESTING:
   - Probar flujo completo con usuarios reales
   - Verificar que el feedback mejora las recomendaciones de IA
   - Monitorear estadísticas con get_feedback_statistics()

¡Sistema listo para implementar! 🚀
*/