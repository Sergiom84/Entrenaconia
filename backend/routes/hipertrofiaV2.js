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

export default router;
