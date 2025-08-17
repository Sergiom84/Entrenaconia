import express from 'express';
import { pool } from '../db.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();

// Crear un nuevo plan de entrenamiento en casa
router.post('/plans', authenticateToken, async (req, res) => {
  try {
    const { plan_data, equipment_type, training_type } = req.body;
    const user_id = req.user.userId || req.user.id;

    const result = await pool.query(
      `INSERT INTO home_training_plans (user_id, plan_data, equipment_type, training_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, JSON.stringify(plan_data), equipment_type, training_type]
    );

    res.json({
      success: true,
      plan: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating home training plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el plan de entrenamiento'
    });
  }
});

// Obtener el plan actual del usuario
router.get('/current-plan', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId || req.user.id;

    // Buscar el plan más reciente del usuario
    const planResult = await pool.query(
      `SELECT * FROM home_training_plans 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [user_id]
    );

    if (planResult.rows.length === 0) {
      return res.json({
        success: true,
        plan: null,
        session: null
      });
    }

    const plan = planResult.rows[0];

    // Buscar la sesión activa para este plan
    const sessionResult = await pool.query(
      `SELECT * FROM home_training_sessions 
       WHERE user_id = $1 AND home_training_plan_id = $2 AND status = 'in_progress'
       ORDER BY started_at DESC 
       LIMIT 1`,
      [user_id, plan.id]
    );

    const session = sessionResult.rows.length > 0 ? sessionResult.rows[0] : null;

    res.json({
      success: true,
      plan: plan,
      session: session
    });
  } catch (error) {
    console.error('Error getting current plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el plan actual'
    });
  }
});

// Iniciar una nueva sesión de entrenamiento
router.post('/sessions/start', authenticateToken, async (req, res) => {
  try {
    const { home_training_plan_id } = req.body;
    const user_id = req.user.userId || req.user.id;

    // Verificar que el plan pertenece al usuario
    const planResult = await pool.query(
      'SELECT * FROM home_training_plans WHERE id = $1 AND user_id = $2',
      [home_training_plan_id, user_id]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plan de entrenamiento no encontrado'
      });
    }

    const plan = planResult.rows[0];
    const exercises = plan.plan_data.plan_entrenamiento?.ejercicios || [];

    // Crear nueva sesión
    const sessionResult = await pool.query(
      `INSERT INTO home_training_sessions 
       (user_id, home_training_plan_id, total_exercises, session_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, home_training_plan_id, exercises.length, JSON.stringify({ exercises })]
    );

    const session = sessionResult.rows[0];

    // Crear registros de progreso para cada ejercicio
    for (let i = 0; i < exercises.length; i++) {
      await pool.query(
        `INSERT INTO home_exercise_progress 
         (home_training_session_id, exercise_name, exercise_order, total_series, exercise_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.id,
          exercises[i].nombre,
          i,
          exercises[i].series,
          JSON.stringify(exercises[i])
        ]
      );
    }

    res.json({
      success: true,
      session: session
    });
  } catch (error) {
    console.error('Error starting training session:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar la sesión de entrenamiento'
    });
  }
});

// Actualizar progreso de ejercicio
router.put('/sessions/:sessionId/exercise/:exerciseOrder', authenticateToken, async (req, res) => {
  try {
    const { sessionId, exerciseOrder } = req.params;
    const { series_completed, duration_seconds, status } = req.body;
    const user_id = req.user.userId || req.user.id;

    // Verificar que la sesión pertenece al usuario
    const sessionResult = await pool.query(
      'SELECT * FROM home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    // Actualizar progreso del ejercicio
    const updateResult = await pool.query(
      `UPDATE home_exercise_progress
       SET series_completed = $1, duration_seconds = $2, status = $3::varchar,
           completed_at = CASE WHEN $3::varchar = 'completed' THEN NOW() ELSE completed_at END,
           started_at = CASE WHEN started_at IS NULL THEN NOW() ELSE started_at END
       WHERE home_training_session_id = $4 AND exercise_order = $5
       RETURNING *`,
      [series_completed, duration_seconds, status, sessionId, exerciseOrder]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado'
      });
    }

    // Calcular progreso total de la sesión
    const progressResult = await pool.query(
      `SELECT
         COUNT(*)::int as total_exercises,
         COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_exercises
       FROM home_exercise_progress
       WHERE home_training_session_id = $1`,
      [sessionId]
    );

    const progress = progressResult.rows[0];
    const progressPercentage = progress.total_exercises > 0
      ? (progress.completed_exercises / progress.total_exercises) * 100
      : 0;

    // Actualizar sesión con el progreso
    await pool.query(
      `UPDATE home_training_sessions
       SET exercises_completed = $1, progress_percentage = $2,
           status = CASE WHEN $2 >= 100 THEN 'completed' ELSE status END,
           completed_at = CASE WHEN $2 >= 100 THEN NOW() ELSE completed_at END
       WHERE id = $3`,
      [progress.completed_exercises, progressPercentage, sessionId]
    );

    // Registrar en historial si el ejercicio quedó completado en esta llamada
    if (status === 'completed') {
      const exRow = updateResult.rows[0];
      const sessRow = sessionResult.rows[0];
      const planId = sessRow.home_training_plan_id;

      // Obtener nombre y datos del ejercicio
      const exName = exRow.exercise_name || (exRow.exercise_data && exRow.exercise_data.nombre) || 'Ejercicio';
      const exKey = (exName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g,' ').trim();

      await pool.query(
        `INSERT INTO user_exercise_history
           (user_id, exercise_name, exercise_key, reps, series, duration_seconds, session_id, plan_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user_id, exName, exKey, null, exRow.total_series, exRow.duration_seconds || null, sessionId, planId]
      );
    }

    res.json({
      success: true,
      exercise: updateResult.rows[0],
      session_progress: {
        completed_exercises: parseInt(progress.completed_exercises),
        total_exercises: parseInt(progress.total_exercises),
        percentage: progressPercentage
      }
    });
  } catch (error) {
    console.error('Error updating exercise progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el progreso del ejercicio'
    });
  }
});

// Obtener estadísticas del usuario
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId || req.user.id;

    const statsResult = await pool.query(
      'SELECT * FROM user_home_training_stats WHERE user_id = $1',
      [user_id]
    );

    let stats = statsResult.rows[0];

    if (!stats) {
      // Crear estadísticas iniciales si no existen
      const createResult = await pool.query(
        `INSERT INTO user_home_training_stats (user_id) 
         VALUES ($1) 
         RETURNING *`,
        [user_id]
      );
      stats = createResult.rows[0];
    }

    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas'
    });
  }
});

// Obtener progreso de sesión actual
router.get('/sessions/:sessionId/progress', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user_id = req.user.userId || req.user.id;

    // Verificar que la sesión pertenece al usuario
    const sessionResult = await pool.query(
      'SELECT * FROM home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    // Obtener progreso de todos los ejercicios
    const progressResult = await pool.query(
      `SELECT * FROM home_exercise_progress 
       WHERE home_training_session_id = $1 
       ORDER BY exercise_order`,
      [sessionId]
    );

    const session = sessionResult.rows[0];
    const exercises = progressResult.rows;

    // Calcular ejercicio actual
    const currentExerciseIndex = exercises.findIndex(ex => ex.status === 'pending' || ex.status === 'in_progress');
    const completedExercises = exercises.filter(ex => ex.status === 'completed').map(ex => ex.exercise_order);

    res.json({
      success: true,
      session: session,
      exercises: exercises,
      progress: {
        currentExercise: currentExerciseIndex >= 0 ? currentExerciseIndex : exercises.length,
        completedExercises: completedExercises,
        percentage: session.progress_percentage || 0
      }
    });
  } catch (error) {
    console.error('Error getting session progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el progreso de la sesión'
    });
  }
});

export default router;
