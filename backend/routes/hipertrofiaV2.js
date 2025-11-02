/**
 * Rutas de HipertrofiaV2 - Sistema de Tracking con RIR
 * Endpoints para evaluación, selección de ejercicios y tracking
 */

import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Función helper: Limpiar drafts del usuario
 */
async function cleanUserDrafts(userId, client = null) {
  const dbClient = client || pool;
  try {
    await dbClient.query(
      `DELETE FROM app.methodology_plans
       WHERE user_id = $1 AND status = 'draft'`,
      [userId]
    );
  } catch (error) {
    console.error('Error limpiando drafts:', error.message);
  }
}

/**
 * POST /api/hipertrofiav2/generate
 * Genera plan de HipertrofiaV2 con ejercicios pre-seleccionados desde el frontend
 */
router.post('/generate', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { planData } = req.body;

    if (!planData) {
      return res.status(400).json({
        success: false,
        error: 'planData es requerido'
      });
    }

    console.log('🏋️ Generando plan HipertrofiaV2 para usuario:', userId);

    await dbClient.query('BEGIN');

    // Limpiar drafts previos
    await cleanUserDrafts(userId, dbClient);

    // Insertar plan en methodology_plans
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `, [userId, 'HipertrofiaV2', JSON.stringify(planData), 'manual', 'draft']);

    const methodologyPlanId = planResult.rows[0].id;

    await dbClient.query('COMMIT');

    console.log(`✅ Plan HipertrofiaV2 guardado con ID: ${methodologyPlanId}`);

    res.json({
      success: true,
      plan: planData,
      methodologyPlanId,
      planId: methodologyPlanId,
      message: 'Plan de HipertrofiaV2 generado exitosamente'
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error generando plan HipertrofiaV2:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar plan de HipertrofiaV2',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

/**
 * POST /api/hipertrofiav2/select-exercises
 * Selecciona ejercicios aleatorios desde Ejercicios_Hipertrofia
 */
router.post('/select-exercises', async (req, res) => {
  try {
    const { categoria, nivel, cantidad = 1 } = req.body;

    console.log(`🎲 Seleccionando ${cantidad} ejercicio(s) de ${categoria} para ${nivel}`);

    // Query con ORDER BY RANDOM() para variedad
    const result = await pool.query(`
      SELECT
        exercise_id,
        nombre,
        nivel,
        categoria,
        patron,
        equipamiento,
        series_reps_objetivo,
        descanso_seg,
        notas,
        "Cómo_hacerlo" as como_hacerlo,
        "Consejos" as consejos,
        "Errores_comunes" as errores_comunes
      FROM app."Ejercicios_Hipertrofia"
      WHERE nivel = $1
        AND categoria = $2
      ORDER BY RANDOM()
      LIMIT $3
    `, [nivel, categoria, cantidad]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontraron ejercicios de ${categoria} para nivel ${nivel}`
      });
    }

    res.json({
      success: true,
      exercises: result.rows.map(ex => ({
        ...ex,
        series: 3, // Principiantes: 3 series
        reps: '8-12',
        rir_target: '2-3'
      }))
    });

  } catch (error) {
    console.error('Error seleccionando ejercicios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al seleccionar ejercicios'
    });
  }
});

/**
 * POST /api/hipertrofiav2/save-set
 * Guarda los datos de una serie (peso, reps, RIR)
 */
router.post('/save-set', async (req, res) => {
  try {
    console.log('🔍 DEBUG Backend - Body recibido:', req.body);

    const {
      userId,
      methodologyPlanId,
      sessionId,
      exerciseId,
      exercise_id, // También intentar con snake_case
      exerciseName,
      exercise_name, // También intentar con snake_case
      setNumber,
      set_number, // También intentar con snake_case
      weight,
      weight_used, // También intentar con snake_case
      reps,
      reps_completed, // También intentar con snake_case
      rir,
      rir_reported // También intentar con snake_case
    } = req.body;

    // Normalizar datos (aceptar ambos formatos)
    const normalizedExerciseId = exerciseId || exercise_id;
    const normalizedExerciseName = exerciseName || exercise_name;
    const normalizedSetNumber = setNumber || set_number;
    const normalizedWeight = weight || weight_used;
    const normalizedReps = reps || reps_completed;
    const normalizedRir = rir !== undefined ? rir : rir_reported;

    console.log('🔍 DEBUG - exerciseId (camelCase):', exerciseId);
    console.log('🔍 DEBUG - exercise_id (snake_case):', exercise_id);
    console.log('🔍 DEBUG - normalizedExerciseId:', normalizedExerciseId);

    console.log(`💾 Guardando serie ${normalizedSetNumber} de ${normalizedExerciseName}`);

    const result = await pool.query(`
      INSERT INTO app.hypertrophy_set_logs (
        user_id,
        methodology_plan_id,
        session_id,
        exercise_id,
        exercise_name,
        set_number,
        weight_used,
        reps_completed,
        rir_reported
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      userId,
      methodologyPlanId,
      sessionId,
      normalizedExerciseId,
      normalizedExerciseName,
      normalizedSetNumber,
      normalizedWeight,
      normalizedReps,
      normalizedRir
    ]);

    res.json({
      success: true,
      setData: result.rows[0]
    });

  } catch (error) {
    console.error('Error guardando serie:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar serie'
    });
  }
});

/**
 * GET /api/hipertrofiav2/progression/:userId/:exerciseId
 * Obtiene la progresión de un ejercicio específico
 */
router.get('/progression/:userId/:exerciseId', async (req, res) => {
  try {
    const { userId, exerciseId } = req.params;

    const result = await pool.query(`
      SELECT * FROM app.hypertrophy_progression
      WHERE user_id = $1 AND exercise_id = $2
    `, [userId, exerciseId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        progression: null,
        message: 'No hay progresión registrada aún'
      });
    }

    res.json({
      success: true,
      progression: result.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo progresión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener progresión'
    });
  }
});

/**
 * POST /api/hipertrofiav2/update-progression
 * Actualiza la progresión de un ejercicio después de una sesión
 */
router.post('/update-progression', async (req, res) => {
  try {
    const { userId, exerciseId, exerciseName } = req.body;

    console.log(`📊 Actualizando progresión de ${exerciseName} para usuario ${userId}`);

    // Llamar a la función SQL que calcula progresión
    await pool.query(`
      SELECT app.update_exercise_progression($1, $2, $3)
    `, [userId, exerciseId, exerciseName]);

    // Obtener progresión actualizada
    const result = await pool.query(`
      SELECT * FROM app.hypertrophy_progression
      WHERE user_id = $1 AND exercise_id = $2
    `, [userId, exerciseId]);

    res.json({
      success: true,
      progression: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando progresión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar progresión'
    });
  }
});

/**
 * GET /api/hipertrofiav2/session-summary/:sessionId
 * Obtiene el resumen de una sesión de entrenamiento
 */
router.get('/session-summary/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(`
      SELECT
        exercise_name,
        COUNT(*) as total_sets,
        SUM(volume_load) as total_volume,
        AVG(rir_reported) as avg_rir,
        MAX(estimated_1rm) as best_pr,
        AVG(CASE WHEN is_effective THEN 1.0 ELSE 0.0 END) * 100 as effective_percentage
      FROM app.hypertrophy_set_logs
      WHERE session_id = $1
      GROUP BY exercise_name
      ORDER BY exercise_name
    `, [sessionId]);

    res.json({
      success: true,
      summary: result.rows
    });

  } catch (error) {
    console.error('Error obteniendo resumen de sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen'
    });
  }
});

/**
 * POST /api/hipertrofiav2/generate-fullbody
 * Genera una rutina Full Body para entrenamientos de fin de semana
 */
router.post('/generate-fullbody', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { nivel = 'Principiante', objetivos = [] } = req.body;

    console.log('💪 Generando rutina Full Body para usuario:', userId, 'Nivel:', nivel);

    await dbClient.query('BEGIN');

    // Limpiar drafts previos
    await cleanUserDrafts(userId, dbClient);

    // Seleccionar ejercicios para Full Body (uno por grupo muscular principal)
    const fullBodyExercises = [];

    // Categorías principales para Full Body y el número de ejercicios por categoría
    const categoriesConfig = [
      { category: 'Pecho', count: 1, priority: 1 },
      { category: 'Espalda', count: 1, priority: 1 },
      { category: 'Piernas (cuádriceps)', count: 1, priority: 1 },
      { category: 'Hombro', count: 1, priority: 2 },
      { category: 'Core', count: 1, priority: 3 },
      { category: nivel === 'Avanzado' ? 'Bíceps' : null, count: 1, priority: 4 },
      { category: nivel === 'Avanzado' ? 'Tríceps' : null, count: 1, priority: 4 }
    ].filter(c => c.category !== null);

    // Obtener ejercicios para cada categoría
    for (const config of categoriesConfig) {
      const exerciseQuery = await dbClient.query(`
        SELECT
          exercise_id as id,
          nombre,
          categoria,
          patron,
          series_reps_objetivo,
          descanso_seg,
          notas
        FROM app."Ejercicios_Hipertrofia"
        WHERE categoria = $1
        AND nivel = $2
        AND (patron LIKE '%Compuesto%' OR patron LIKE '%horizontal%' OR patron LIKE '%vertical%')
        ORDER BY RANDOM()
        LIMIT $3
      `, [config.category, nivel, config.count]);

      if (exerciseQuery.rows.length > 0) {
        fullBodyExercises.push(...exerciseQuery.rows.map(ex => ({
          ...ex,
          // Ajustar series para Full Body (menos volumen por ejercicio)
          series_reps_objetivo: nivel === 'Principiante' ? '2-3x10-12' : '3x8-10',
          descanso_seg: nivel === 'Principiante' ? 60 : 75,
          notas_fullbody: 'Ejercicio adaptado para rutina Full Body de fin de semana'
        })));
      }
    }

    console.log(`📊 Seleccionados ${fullBodyExercises.length} ejercicios para Full Body`);

    // Crear plan de metodología Full Body
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id,
        methodology_type,
        plan_name,
        training_days_per_week,
        total_weeks,
        status,
        created_at,
        updated_at,
        plan_data,
        plan_description
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8)
      RETURNING id, methodology_type, plan_name
    `, [
      userId,
      'full-body',
      `Full Body ${nivel} - Fin de Semana`,
      1, // Un día de entrenamiento
      1, // Una semana (sesión única)
      'active',
      JSON.stringify({
        exercises: fullBodyExercises,
        nivel: nivel,
        type: 'weekend_fullbody',
        generated_for: 'weekend_training',
        notes: 'Rutina Full Body diseñada para entrenamientos de fin de semana cuando no se puede seguir el plan regular'
      }),
      'Rutina Full Body completa para entrenar todo el cuerpo en una sesión. Ideal para días de fin de semana o cuando no puedes seguir tu rutina regular.'
    ]);

    const methodologyPlanId = planResult.rows[0].id;

    // Crear una única sesión de entrenamiento
    const sessionData = {
      dia: 1,
      sesion_numero: 1,
      ejercicios: fullBodyExercises.map((exercise, index) => ({
        orden: index + 1,
        id: exercise.id, // Para compatibilidad con frontend
        exercise_id: exercise.id, // Para tracking RIR
        nombre: exercise.nombre,
        categoria: exercise.categoria,
        series: parseInt(exercise.series_reps_objetivo.split('x')[0].split('-')[0]),
        reps_objetivo: exercise.series_reps_objetivo.split('x')[1] || '10-12',
        descanso_seg: exercise.descanso_seg,
        notas: exercise.notas_fullbody || exercise.notas,
        patron: exercise.patron
      }))
    };

    // Insertar la sesión en methodology_exercise_sessions
    const sessionResult = await dbClient.query(`
      INSERT INTO app.methodology_exercise_sessions (
        methodology_plan_id,
        session_number,
        session_name,
        exercises,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [
      methodologyPlanId,
      1,
      'Full Body - Sesión Completa',
      JSON.stringify(sessionData.ejercicios)
    ]);

    // Crear entrada en workout_schedule para hoy
    await dbClient.query(`
      INSERT INTO app.workout_schedule (
        user_id,
        methodology_plan_id,
        scheduled_date,
        week_number,
        day_in_week,
        session_number,
        completed,
        created_at
      ) VALUES ($1, $2, CURRENT_DATE, 1, 1, 1, false, NOW())
    `, [userId, methodologyPlanId]);

    // Guardar configuración especial para Full Body
    const currentDayOfWeek = new Date().getDay(); // 0 = Domingo, 6 = Sábado

    await dbClient.query(`
      INSERT INTO app.plan_start_config (
        methodology_plan_id,
        start_day_of_week,
        is_consecutive_days,
        intensity_adjusted,
        first_week_pattern,
        regular_pattern,
        day_mappings,
        warnings,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (methodology_plan_id)
      DO UPDATE SET
        warnings = $8,
        first_week_pattern = $5
    `, [
      methodologyPlanId,
      currentDayOfWeek,
      false,
      false,
      'Full Body',
      'Full Body',
      JSON.stringify({ 'Hoy': 'sesion_completa' }),
      JSON.stringify([
        {
          type: 'info',
          icon: '💪',
          title: 'Rutina Full Body',
          message: 'Esta es una rutina especial de cuerpo completo para el fin de semana. Trabajarás todos los grupos musculares en una sesión.'
        },
        {
          type: 'warning',
          icon: '⚠️',
          title: 'Volumen Reducido',
          message: 'El volumen por grupo muscular es menor que en tu rutina regular. Esto es intencional para permitir la recuperación.'
        },
        {
          type: 'important',
          icon: '📅',
          title: 'Sesión Única',
          message: 'Esta rutina está diseñada para una sola sesión. Si necesitas entrenar múltiples días, considera generar un plan regular.'
        }
      ])
    ]);

    await dbClient.query('COMMIT');

    console.log('✅ Rutina Full Body generada exitosamente');

    res.json({
      success: true,
      message: 'Rutina Full Body generada exitosamente',
      methodology_plan_id: methodologyPlanId,
      plan: {
        id: methodologyPlanId,
        name: planResult.rows[0].plan_name,
        type: 'full-body',
        exercises_count: fullBodyExercises.length,
        nivel: nivel,
        exercises: fullBodyExercises
      },
      warnings: [
        'Esta es una rutina especial para el fin de semana',
        'Trabaja todos los grupos musculares en una sesión',
        'El volumen está ajustado para permitir recuperación'
      ]
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error generando Full Body:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar rutina Full Body',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

/**
 * POST /api/hipertrofiav2/generate-single-day
 * Genera un entrenamiento de día único (para fines de semana o días extra)
 * NO genera un plan completo, solo una sesión independiente
 */
router.post('/generate-single-day', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { nivel = 'Principiante', objetivos = [], isWeekendExtra = false } = req.body;

    console.log('🏋️ Generando entrenamiento de día único para usuario:', userId);
    console.log('📊 Nivel:', nivel, '| Fin de semana extra:', isWeekendExtra);

    // Mapear nivel a formato de BD (basico/intermedio/avanzado)
    const nivelMapping = {
      'Principiante': 'basico',
      'Intermedio': 'intermedio',
      'Avanzado': 'avanzado',
      'basico': 'basico',
      'intermedio': 'intermedio',
      'avanzado': 'avanzado'
    };
    const nivelNormalized = nivelMapping[nivel] || 'basico';
    console.log('📝 Nivel normalizado:', nivelNormalized);

    await dbClient.query('BEGIN');

    // Obtener ejercicios según nivel
    const exercisesQuery = `
      SELECT
        exercise_id,
        nombre,
        categoria,
        patron,
        equipamiento,
        nivel,
        series_reps_objetivo,
        descanso_seg,
        notas,
        "Tipo base",
        "Ejecución"
      FROM app."Ejercicios_Hipertrofia"
      WHERE nivel = $1
        AND "Tipo base" IS NOT NULL
      ORDER BY
        CASE
          WHEN "Tipo base" = 'Multiarticular' THEN 1
          ELSE 2
        END,
        RANDOM()
    `;

    const exercisesResult = await dbClient.query(exercisesQuery, [nivel]);

    // Seleccionar ejercicios para Full Body (6-8 ejercicios)
    const fullBodyExercises = [];
    const targetGroups = [
      { categoria: 'Pecho', count: 1 },
      { categoria: 'Espalda', count: 1 },
      { categoria: 'Piernas', count: 2 },
      { categoria: 'Hombros', count: 1 },
      { categoria: 'Core', count: 1 }
    ];

    for (const group of targetGroups) {
      const groupExercises = exercisesResult.rows
        .filter(ex => ex.categoria === group.categoria)
        .slice(0, group.count);

      fullBodyExercises.push(...groupExercises.map((ex, idx) => ({
        ...ex,
        orden: fullBodyExercises.length + idx + 1,
        series: nivel === 'Principiante' ? 3 : nivel === 'Intermedio' ? 3 : 4,
        isWeekendExtra
      })));
    }

    // Crear plan temporal para fin de semana
    const currentDate = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Crear plan temporal en methodology_plans
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id,
        methodology_type,
        nivel,
        plan_name,
        plan_start_date,
        status,
        total_days,
        generation_mode,
        version_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id`,
      [
        userId,
        'hipertrofia',
        nivelNormalized,  // Usar nivel normalizado (basico/intermedio/avanzado)
        'Entrenamiento Extra Fin de Semana',
        currentDate,
        'completed', // Marcado como completado para no interferir con planes activos
        1,
        'manual',
        'weekend-extra'
      ]
    );

    const planId = planResult.rows[0].id;
    console.log(`📋 Plan temporal creado: ID ${planId}`);

    // Crear sesión de metodología para fin de semana
    const sessionResult = await dbClient.query(`
      INSERT INTO app.methodology_exercise_sessions (
        user_id,
        methodology_plan_id,
        methodology_type,
        methodology_level,
        session_name,
        day_name,
        session_date,
        session_type,
        total_exercises,
        exercises_completed,
        exercises_skipped,
        exercises_cancelled,
        exercises_in_progress,
        session_status,
        started_at,
        day_of_month,
        month_name,
        month_number,
        year_number,
        exercises_data,
        session_metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING id`,
      [
        userId,
        planId,                                         // methodology_plan_id (ahora con ID real)
        'hipertrofia',                                  // methodology_type
        nivel,                                          // methodology_level
        'Full Body Extra - Fin de Semana',             // session_name
        dayNames[currentDate.getDay()],                // day_name
        currentDate,                                    // session_date
        'weekend-extra',                                // session_type
        fullBodyExercises.length,                       // total_exercises
        0,                                              // exercises_completed
        0,                                              // exercises_skipped
        0,                                              // exercises_cancelled
        0,                                              // exercises_in_progress
        'pending',                                      // session_status
        currentDate,                                    // started_at
        currentDate.getDate(),                          // day_of_month
        monthNames[currentDate.getMonth()],             // month_name
        currentDate.getMonth() + 1,                     // month_number
        currentDate.getFullYear(),                      // year_number
        JSON.stringify(fullBodyExercises),              // exercises_data
        JSON.stringify({
          nivel,
          generated_at: currentDate,
          type: 'single-day-workout',
          weekend_extra: isWeekendExtra,
          note: 'Entrenamiento extra de fin de semana - no afecta plan semanal'
        })
      ]
    );

    const sessionId = sessionResult.rows[0].id;

    // Crear tracking para cada ejercicio
    for (const exercise of fullBodyExercises) {
      await dbClient.query(`
        INSERT INTO app.exercise_session_tracking (
          methodology_session_id,
          user_id,
          exercise_name,
          exercise_order,
          exercise_data,
          status,
          planned_sets,
          planned_reps,
          planned_rest_seconds,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )`,
        [
          sessionId,
          userId,
          exercise.nombre,
          exercise.orden,
          JSON.stringify(exercise),
          'pending',
          exercise.series,
          exercise.series_reps_objetivo || '8-12',
          exercise.descanso_seg || 90,
          currentDate
        ]
      );
    }

    await dbClient.query('COMMIT');

    console.log('✅ Entrenamiento de día único generado exitosamente');

    res.json({
      success: true,
      message: 'Entrenamiento del día generado exitosamente',
      sessionId,
      workout: {
        id: sessionId,
        type: 'full-body-single',
        nivel,
        exercises_count: fullBodyExercises.length,
        duration_estimate: nivel === 'Principiante' ? '45-50 min' : '50-60 min',
        exercises: fullBodyExercises.map(ex => ({
          exercise_id: ex.exercise_id,
          nombre: ex.nombre,
          categoria: ex.categoria,
          series: ex.series,
          reps: ex.series_reps_objetivo,
          descanso_seg: ex.descanso_seg,
          tipo_base: ex["Tipo base"],
          ejecucion: ex["Ejecución"],
          notas: ex.notas
        }))
      },
      notes: [
        'Este entrenamiento es independiente y no afecta tu plan semanal',
        'Se guardará en tu histórico como entrenamiento extra',
        'Ajusta los pesos según tu capacidad actual'
      ]
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error generando entrenamiento de día único:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar entrenamiento',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

export default router;
