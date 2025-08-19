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
      `INSERT INTO app.home_training_plans (user_id, plan_data, equipment_type, training_type)
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
      `SELECT * FROM app.home_training_plans
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
      `SELECT * FROM app.home_training_sessions
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { home_training_plan_id } = req.body;
      const user_id = req.user.userId || req.user.id;

      // Verificar que el plan pertenece al usuario
      const planResult = await client.query(
        'SELECT * FROM app.home_training_plans WHERE id = $1 AND user_id = $2',
        [home_training_plan_id, user_id]
      );

      if (planResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Plan de entrenamiento no encontrado' });
      }

      const plan = planResult.rows[0];
      const exercises = plan.plan_data.plan_entrenamiento?.ejercicios || [];

      // Crear nueva sesión
      const sessionResult = await client.query(
        `INSERT INTO app.home_training_sessions
         (user_id, home_training_plan_id, total_exercises, session_data)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [user_id, home_training_plan_id, exercises.length, JSON.stringify({ exercises })]
      );
      const session = sessionResult.rows[0];
      const sessionId = session.id;

      // Crear registros de progreso para cada ejercicio (robusto)
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i] || {};
        const totalSeries = Number(ex.series ?? ex.total_series ?? ex.totalSeries) || (ex.tipo === 'tiempo' ? 1 : 3);
        await client.query(
          `INSERT INTO app.home_exercise_progress
           (home_training_session_id, exercise_order, exercise_name, total_series, series_completed, status, duration_seconds, started_at, exercise_data)
           VALUES ($1, $2, $3, $4, 0, 'pending', NULL, NOW(), $5)`,
          [sessionId, i, ex.nombre, totalSeries, JSON.stringify(ex)]
        );
      }

      await client.query('COMMIT');

      res.json({ success: true, session });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error starting training session:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar la sesión de entrenamiento'
    });
  }
});

// Actualizar progreso de ejercicio (MEJORADO)
router.put('/sessions/:sessionId/exercise/:exerciseOrder', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { sessionId, exerciseOrder } = req.params;
    const { series_completed, duration_seconds, status } = req.body;
    const user_id = req.user.userId || req.user.id;

    // Verificar que la sesión pertenece al usuario
    const sessionResult = await client.query(
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }

    // Actualizar progreso del ejercicio (SQL con casts y esquema app.)
    const updateSql = `
      UPDATE app.home_exercise_progress
      SET
        series_completed  = $1,
        status            = $2::text,
        duration_seconds  = COALESCE($3, duration_seconds),
        completed_at      = CASE WHEN $2::text = 'completed' THEN now() ELSE completed_at END
      WHERE home_training_session_id = $4
        AND exercise_order = $5
      RETURNING *;
    `;
    const updateResult = await client.query(updateSql, [
      series_completed,
      status,
      duration_seconds ?? null,
      sessionId,
      exerciseOrder
    ]);


    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ejercicio no encontrado' });
    }

    // Calcular progreso total de la sesión
    const progressResult = await client.query(
      `SELECT
         COUNT(*)::int as total_exercises,
         COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_exercises,
         SUM(CASE WHEN status = 'completed' THEN COALESCE(duration_seconds, 0) ELSE 0 END)::int as total_duration
       FROM app.home_exercise_progress
       WHERE home_training_session_id = $1`,
      [sessionId]
    );

    const progress = progressResult.rows[0];
    const progressPercentage = progress.total_exercises > 0
      ? Math.round((progress.completed_exercises / progress.total_exercises) * 100)
      : 0;

    // Actualizar la sesión (usando nombres de columna reales y acumulando duración)
    await client.query(`
      UPDATE app.home_training_sessions
      SET
        exercises_completed    = (SELECT COUNT(*) FROM app.home_exercise_progress
                                  WHERE home_training_session_id = $1 AND status = 'completed'),
        progress_percentage    = ROUND(100.0 * (SELECT COUNT(*) FROM app.home_exercise_progress
                                  WHERE home_training_session_id = $1 AND status = 'completed')
                                  / NULLIF(total_exercises,0), 1),
        total_duration_seconds = COALESCE(total_duration_seconds, 0) + COALESCE($2, 0),
        completed_at           = CASE WHEN (SELECT COUNT(*) FROM app.home_exercise_progress
                                  WHERE home_training_session_id = $1 AND status <> 'completed') = 0
                                  THEN NOW() ELSE completed_at END
      WHERE id = $1
    `, [sessionId, duration_seconds ?? 0]);

    // Si el ejercicio se completó, actualizar estadísticas e historial
    if (status === 'completed') {
      if (progressPercentage >= 100) {
        await client.query(
          `UPDATE app.user_home_training_stats
           SET total_sessions = total_sessions + 1,
               total_duration_seconds = total_duration_seconds + COALESCE($1, 0),
               last_training_date = CURRENT_DATE,
               updated_at = NOW()
           WHERE user_id = $2`,
          [progress.total_duration, user_id]
        );
      }

      const exRow = updateResult.rows[0];
      const sessRow = sessionResult.rows[0];
      const planId = sessRow.home_training_plan_id;

      const exName = exRow.exercise_name || (exRow.exercise_data && exRow.exercise_data.nombre) || 'Ejercicio';
      const exKey = (exName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

      await client.query(
        `INSERT INTO app.user_exercise_history
           (user_id, exercise_name, exercise_key, reps, series, duration_seconds, session_id, plan_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [user_id, exName, exKey, null, series_completed, (duration_seconds ?? null), sessionId, planId]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      exercise: updateResult.rows[0],
      session_progress: {
        completed_exercises: progress.completed_exercises,
        total_exercises: progress.total_exercises,
        percentage: progressPercentage,
        total_duration: progress.total_duration
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating exercise progress:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el progreso del ejercicio' });
  } finally {
    client.release();
  }
});

// Obtener estadísticas del usuario
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId || req.user.id;

    const statsResult = await pool.query(
      'SELECT * FROM app.user_home_training_stats WHERE user_id = $1',
      [user_id]
    );

    let stats = statsResult.rows[0];

    if (!stats) {
      // Crear estadísticas iniciales si no existen
      const createResult = await pool.query(
        `INSERT INTO app.user_home_training_stats (user_id)
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
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
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
      `SELECT * FROM app.home_exercise_progress
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
