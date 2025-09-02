import express from 'express';
import { pool } from '../db.js';
import authenticateToken from '../middleware/auth.js';

// TODO: Integrar endpoint IA de generación de plan usando módulo HOME_TRAINING (promptId, temperature 1.0)
// Ejemplo futuro: POST /plans/ai/generate
//   - Usa datos de perfil + objetivos
//   - Llama a responses.create con config HOME_TRAINING
//   - Devuelve plan estructurado para persistir

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
        // Series por defecto (si la IA no especifica): 4
        const totalSeries = Number(ex.series ?? ex.total_series ?? ex.totalSeries) || 4;
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
                                  THEN NOW() ELSE completed_at END,
        status                 = CASE WHEN (SELECT COUNT(*) FROM app.home_exercise_progress
                                  WHERE home_training_session_id = $1 AND status <> 'completed') = 0
                                  THEN 'completed' ELSE status END
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
        `INSERT INTO app.home_exercise_history
           (user_id, exercise_name, exercise_key, reps, series, duration_seconds, session_id, plan_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, exercise_name, session_id) DO NOTHING`,
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

// Obtener estadísticas del usuario (extendido con ejercicios y tiempo activo)
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

    // Agregar métricas basadas en ejercicios completados (SOLO entrenamiento en casa)
    const exAgg = await pool.query(
      `SELECT COUNT(*)::int AS total_exercises_completed,
              COALESCE(SUM(duration_seconds), 0)::int AS total_exercise_duration_seconds
         FROM app.home_exercise_history
        WHERE user_id = $1`,
      [user_id]
    );
    const ex = exAgg.rows[0] || { total_exercises_completed: 0, total_exercise_duration_seconds: 0 };

    res.json({
      success: true,
      stats: {
        ...stats,
        total_exercises_completed: ex.total_exercises_completed,
        total_exercise_duration_seconds: ex.total_exercise_duration_seconds,
      }
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

    // Obtener progreso de todos los ejercicios + último feedback por ejercicio
    const progressResult = await pool.query(
      `SELECT p.*, fb.sentiment AS feedback_sentiment, fb.comment AS feedback_comment
         FROM app.home_exercise_progress p
         LEFT JOIN LATERAL (
           SELECT sentiment, comment
             FROM app.user_exercise_feedback uf
            WHERE uf.user_id = $2
              AND uf.session_id = $1
              AND uf.exercise_order = p.exercise_order
            ORDER BY created_at DESC
            LIMIT 1
         ) fb ON true
        WHERE p.home_training_session_id = $1
        ORDER BY p.exercise_order`,
      [sessionId, user_id]
    );

    const session = sessionResult.rows[0];
    const exercises = progressResult.rows;

     // Calcular siguiente ejercicio a realizar
    // Debe ser el primer ejercicio NO completado (incluye pending, in_progress, skipped, cancelled)
    const nextExerciseIndex = exercises.findIndex(ex => ex.status !== 'completed');
    const completedExercises = exercises
      .filter(ex => ex.status === 'completed')
      .map(ex => ex.exercise_order);

    // Si hay alguno sin completar, retomamos desde ese índice; si no, usar último índice válido
    let safeCurrentExercise;
   if (nextExerciseIndex >= 0) {
      safeCurrentExercise = nextExerciseIndex;
    } else if (exercises.length > 0) {
      safeCurrentExercise = Math.max(0, exercises.length - 1);
    } else {
      safeCurrentExercise = 0;
    }

    // allCompleted solo es true si absolutamente todos están marcados como 'completed'
    const allCompleted = exercises.length > 0 && exercises.every(ex => ex.status === 'completed');

    res.json({
      success: true,
      session: session,
      exercises: exercises,
      progress: {
        currentExercise: safeCurrentExercise,
        completedExercises: completedExercises,
        percentage: session.progress_percentage || 0,
        allCompleted
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


// Crear feedback de ejercicio
router.post('/sessions/:sessionId/exercise/:exerciseOrder/feedback', authenticateToken, async (req, res) => {
  try {
    const { sessionId, exerciseOrder } = req.params;
    const { sentiment, comment, exercise_name } = req.body || {};
    const user_id = req.user.userId || req.user.id;

    // Validar sentiment solo si está presente
    if (sentiment !== null && sentiment !== undefined && !['dislike','hard','love'].includes(String(sentiment))) {
      return res.status(400).json({ success: false, message: 'sentiment inválido' });
    }

    // Buscar nombre/clave del ejercicio si no llega por body
    let exName = exercise_name;
    let exKey = null;
    if (!exName) {
      const q = await pool.query(
        `SELECT exercise_name, exercise_data
           FROM app.home_exercise_progress
          WHERE home_training_session_id = $1 AND exercise_order = $2
          LIMIT 1`,
        [sessionId, exerciseOrder]
      );
      if (q.rows.length) {
        exName = q.rows[0].exercise_name || q.rows[0].exercise_data?.nombre || 'Ejercicio';
      } else {
        exName = 'Ejercicio';
      }
    }
    exKey = (exName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

    await pool.query(
      `INSERT INTO app.user_exercise_feedback
         (user_id, session_id, exercise_order, exercise_name, exercise_key, sentiment, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user_id, sessionId, exerciseOrder, exName, exKey, sentiment, comment || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ success: false, message: 'Error creando feedback' });
  }
});

export default router;
