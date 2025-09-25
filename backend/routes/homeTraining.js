import express from 'express';
import { pool } from '../db.js';
import authenticateToken from '../middleware/auth.js';
import { getOpenAIClient } from '../lib/openaiClient.js';

// TODO: Integrar endpoint IA de generación de plan usando módulo HOME_TRAINING (promptId, temperature 1.0)
// Ejemplo futuro: POST /plans/ai/generate
//   - Usa datos de perfil + objetivos
//   - Llama a responses.create con config HOME_TRAINING
//   - Devuelve plan estructurado para persistir

const router = express.Router();

// Helpers para normalizar combinaciones (evitar 500 por valores inesperados)
const ALLOWED_EQUIPMENT = new Set(['minimo','basico','avanzado','personalizado','usar_este_equipamiento']);
const ALLOWED_TRAINING  = new Set(['funcional','hiit','fuerza']);

function normalizeEquipmentType(val) {
  const v = String(val || '').toLowerCase().trim();
  if (ALLOWED_EQUIPMENT.has(v)) return v;
  // Mapear alias comunes
  if (v === 'ninguno' || v === 'sin_equipo' || v === 'sin_equipamiento') return 'minimo';
  if (v === 'custom' || v === 'personalizado_equipo') return 'personalizado';
  // Por defecto, usar inventario del usuario
  return 'usar_este_equipamiento';
}

function normalizeTrainingType(val) {
  const v = String(val || '').toLowerCase().trim();
  if (ALLOWED_TRAINING.has(v)) return v;
  // Mapear alias/metodologías a categorías home-training
  if (v.includes('hiit')) return 'hiit';
  if (v.includes('fuerza') || v.includes('calistenia') || v.includes('strength')) return 'fuerza';
  // Fallback genérico
  return 'funcional';
}

function toExerciseKey(name) {
  const s = String(name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  return s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'ejercicio';
}

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

    console.log(`🔍 PUT /sessions/${sessionId}/exercise/${exerciseOrder} - Usuario: ${user_id}`);
    console.log(`📦 Body:`, { series_completed, duration_seconds, status });

    // Verificar que la sesión pertenece al usuario
    const sessionResult = await client.query(
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }

    // Determinar si es una actualización de solo duración
    const isDurationOnlyUpdate = !series_completed && !status && duration_seconds;
    
    let updateSql, updateParams;
    
    if (isDurationOnlyUpdate) {
      // Solo actualizar duración sin cambiar status ni series
      console.log(`⏰ Actualizando solo duración para ejercicio ${exerciseOrder}: ${duration_seconds}s`);
      updateSql = `
        UPDATE app.home_exercise_progress
        SET duration_seconds = $1
        WHERE home_training_session_id = $2
          AND exercise_order = $3
        RETURNING *;
      `;
      updateParams = [duration_seconds, sessionId, exerciseOrder];
    } else {
      // Actualización completa (series, status y duración)
      console.log(`📊 Actualizando progreso completo para ejercicio ${exerciseOrder}: ${series_completed} series, ${status}`);
      updateSql = `
        UPDATE app.home_exercise_progress
        SET
          series_completed  = COALESCE($1, series_completed),
          status            = COALESCE($2::text, status),
          duration_seconds  = COALESCE($3, duration_seconds),
          completed_at      = CASE WHEN COALESCE($2::text, status) = 'completed' THEN now() ELSE completed_at END
        WHERE home_training_session_id = $4
          AND exercise_order = $5
        RETURNING *;
      `;
      updateParams = [
        series_completed !== undefined ? series_completed : null,
        status !== undefined ? status : null,
        duration_seconds !== undefined ? duration_seconds : null,
        sessionId,
        exerciseOrder
      ];
    }
    
    const updateResult = await client.query(updateSql, updateParams);


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

    // Validar sentiment solo si está presente - Estados unificados post-merge
    if (sentiment !== null && sentiment !== undefined && !['like','dislike','hard'].includes(String(sentiment))) {
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

// ===============================================
// ENDPOINTS PARA SISTEMA DE RECHAZOS
// ===============================================

// Guardar ejercicios rechazados - SISTEMA UNIFICADO DE FEEDBACK
router.post('/rejections', authenticateToken, async (req, res) => {
  try {
    const { rejections } = req.body || {};
    const user_id = req.user.userId || req.user.id;

    if (!Array.isArray(rejections) || rejections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de ejercicios rechazados'
      });
    }

    console.log('🔄 USANDO SISTEMA UNIFICADO DE FEEDBACK');
    console.log(`📊 Procesando ${rejections.length} rechazo(s) de ejercicios`);

    // Mapeo de categorías del modal a feedback_type
    const REJECTION_CATEGORY_MAPPING = {
      'too_hard': 'too_difficult',
      'dont_like': 'dont_like',
      'injury': 'physical_limitation',
      'equipment': 'no_equipment',
      'other': 'change_focus'
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertedFeedback = [];

      for (const raw of rejections) {
        // Normalizar datos del modal
        const exercise_name = String(raw?.exercise_name || '').trim().slice(0, 255) || 'Ejercicio';
        const exercise_key = (raw?.exercise_key && String(raw.exercise_key).trim()) || toExerciseKey(exercise_name);
        const training_type = normalizeTrainingType(raw?.training_type);
        const rejection_category = raw?.rejection_category || 'other';
        const rejection_reason = raw?.rejection_reason ? String(raw.rejection_reason).slice(0, 1000) : null;
        const expires_in_days = Number(raw?.expires_in_days) || null;

        // Mapear categoría del modal a feedback_type del sistema unificado
        const feedback_type = REJECTION_CATEGORY_MAPPING[rejection_category] || 'dont_like';

        // Calcular fecha de expiración
        let expiresAt = null;
        if (expires_in_days && expires_in_days > 0) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expires_in_days);
        }

        // Determinar methodology_type basado en training_type
        let methodology_type = 'home_training'; // Por defecto
        if (training_type?.toLowerCase().includes('calistenia')) {
          methodology_type = 'calistenia';
        } else if (training_type?.toLowerCase().includes('hipertrofia')) {
          methodology_type = 'hipertrofia';
        }

        console.log(`📝 Guardando feedback: ${exercise_name} - ${feedback_type} (${methodology_type})`);

        // Verificar si ya existe feedback para este ejercicio
        const existingResult = await client.query(
          `SELECT id FROM app.user_exercise_feedback
           WHERE user_id = $1 AND exercise_name = $2
           AND methodology_type = $3
           AND (expires_at IS NULL OR expires_at > NOW())`,
          [user_id, exercise_name, methodology_type]
        );

        if (existingResult.rows.length > 0) {
          // Actualizar feedback existente
          const updateResult = await client.query(
            `UPDATE app.user_exercise_feedback
             SET feedback_type = $1,
                 comment = $2,
                 avoidance_duration_days = $3,
                 expires_at = $4,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [feedback_type, rejection_reason, expires_in_days, expiresAt, existingResult.rows[0].id]
          );
          insertedFeedback.push(updateResult.rows[0]);
          console.log(`✏️  Feedback actualizado para: ${exercise_name}`);
        } else {
          // Crear nuevo feedback usando el sistema unificado
          const insertResult = await client.query(
            `INSERT INTO app.user_exercise_feedback
             (user_id, exercise_name, exercise_key, methodology_type, feedback_type,
              comment, avoidance_duration_days, expires_at, ai_weight, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1.0, NOW())
             RETURNING *`,
            [user_id, exercise_name, exercise_key, methodology_type, feedback_type,
             rejection_reason, expires_in_days, expiresAt]
          );
          insertedFeedback.push(insertResult.rows[0]);
          console.log(`✅ Nuevo feedback creado para: ${exercise_name}`);
        }
      }

      await client.query('COMMIT');

      console.log(`🎉 Procesamiento completo: ${insertedFeedback.length} registros`);

      res.json({
        success: true,
        message: `${insertedFeedback.length} ejercicio${insertedFeedback.length !== 1 ? 's' : ''} marcado${insertedFeedback.length !== 1 ? 's' : ''} como rechazado${insertedFeedback.length !== 1 ? 's' : ''}`,
        feedback: insertedFeedback,
        system: 'unified_feedback' // Identificador del nuevo sistema
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error dentro de transacción /rejections (unified):', err);
      return res.status(500).json({
        success: false,
        message: 'Error al guardar las preferencias de ejercicios',
        details: err.message,
        system: 'unified_feedback'
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error saving exercise feedback (unified system):', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar las preferencias de ejercicios'
    });
  }
});

// Obtener ejercicios rechazados para una combinación
router.get('/rejections/:equipmentType/:trainingType', authenticateToken, async (req, res) => {
  try {
    const { equipmentType, trainingType } = req.params;
    const user_id = req.user.userId || req.user.id;

    const result = await pool.query(
      `SELECT * FROM app.get_rejected_exercises_for_combination($1, $2, $3)`,
      [user_id, equipmentType, trainingType]
    );

    res.json({
      success: true,
      rejections: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting exercise rejections:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejercicios rechazados'
    });
  }
});

// Eliminar/desactivar un rechazo específico
router.delete('/rejections/:rejectionId', authenticateToken, async (req, res) => {
  try {
    const { rejectionId } = req.params;
    const user_id = req.user.userId || req.user.id;

    const result = await pool.query(
      `UPDATE app.home_exercise_rejections
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING exercise_name`,
      [rejectionId, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rechazo no encontrado'
      });
    }

    res.json({
      success: true,
      message: `"${result.rows[0].exercise_name}" ya no será rechazado`
    });

  } catch (error) {
    console.error('Error removing exercise rejection:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el rechazo'
    });
  }
});

// Obtener historial completo de preferencias del usuario
router.get('/preferences-history', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId || req.user.id;

    // 1. Ejercicios favoritos (completados con feedback 'like')
    const favorites = await pool.query(`
      SELECT DISTINCT
        eh.exercise_name,
        COUNT(*) as times_completed,
        MAX(eh.session_date) as last_completed
      FROM app.home_exercise_history eh
      LEFT JOIN app.user_exercise_feedback uef ON (
        uef.user_id = eh.user_id 
        AND uef.exercise_name = eh.exercise_name 
        AND uef.sentiment = 'like'
      )
      WHERE eh.user_id = $1 
        AND uef.sentiment = 'like'
      GROUP BY eh.exercise_name
      ORDER BY times_completed DESC, last_completed DESC
      LIMIT 20
    `, [user_id]);

    // 2. Ejercicios desafiantes (completados con feedback 'hard')
    const challenging = await pool.query(`
      SELECT DISTINCT
        eh.exercise_name,
        COUNT(*) as times_completed,
        MAX(eh.session_date) as last_completed
      FROM app.home_exercise_history eh
      LEFT JOIN app.user_exercise_feedback uef ON (
        uef.user_id = eh.user_id 
        AND uef.exercise_name = eh.exercise_name 
        AND uef.sentiment = 'hard'
      )
      WHERE eh.user_id = $1 
        AND uef.sentiment = 'hard'
      GROUP BY eh.exercise_name
      ORDER BY times_completed DESC, last_completed DESC
      LIMIT 20
    `, [user_id]);

    // 3. Ejercicios rechazados activos
    const rejected = await pool.query(`
      SELECT 
        id,
        exercise_name,
        rejection_reason,
        rejection_category,
        rejected_at,
        expires_at,
        CASE 
          WHEN expires_at IS NULL THEN NULL
          ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400))
        END as days_until_expires
      FROM app.home_exercise_rejections 
      WHERE user_id = $1 
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY rejected_at DESC
    `, [user_id]);

    // 4. Analytics generales
    const analytics = await pool.query(`
      SELECT 
        COUNT(*) as total_completed,
        COUNT(DISTINCT exercise_name) as unique_exercises,
        AVG(series) as avg_series,
        SUM(duration_seconds) as total_duration_seconds
      FROM app.home_exercise_history 
      WHERE user_id = $1
    `, [user_id]);

    // 5. Patrones de rechazo (para insights)
    const rejectionPatterns = await pool.query(`
      SELECT 
        rejection_category,
        COUNT(*) as count
      FROM app.home_exercise_rejections 
      WHERE user_id = $1 AND is_active = true
      GROUP BY rejection_category
      ORDER BY count DESC
    `, [user_id]);

    // 6. Ejercicios más populares (sin feedback específico)
    const popular = await pool.query(`
      SELECT 
        exercise_name,
        COUNT(*) as times_completed,
        MAX(session_date) as last_completed
      FROM app.home_exercise_history 
      WHERE user_id = $1
      GROUP BY exercise_name
      ORDER BY times_completed DESC
      LIMIT 10
    `, [user_id]);

    const preferences = {
      favorites: favorites.rows,
      challenging: challenging.rows,
      rejected: rejected.rows,
      analytics: {
        ...analytics.rows[0],
        rejection_patterns: rejectionPatterns.rows,
        popular_exercises: popular.rows
      }
    };

    res.json({
      success: true,
      preferences: preferences
    });

  } catch (error) {
    console.error('Error getting preferences history:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de preferencias'
    });
  }
});

// Manejar abandono de sesión (beforeunload, visibility change, etc.)
router.post('/sessions/:sessionId/handle-abandon', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const { currentProgress, reason } = req.body; // reason: 'beforeunload', 'visibility', 'logout'
  const user_id = req.user.userId || req.user.id;

  console.log(`🚪 Usuario ${user_id} abandonando sesión ${sessionId}, motivo: ${reason}`);

  try {
    // 1. Verificar que la sesión pertenece al usuario
    const sessionCheck = await pool.query(
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }

    // 2. Guardar progreso actual si se proporciona
    if (currentProgress) {
      console.log(`💾 Guardando progreso antes de abandono:`, currentProgress);
      
      for (const [exerciseIndex, progress] of Object.entries(currentProgress)) {
        if (progress.series_completed > 0) {
          await pool.query(`
            UPDATE app.home_exercise_progress
            SET 
              series_completed = $1,
              status = $2,
              duration_seconds = COALESCE($3, duration_seconds)
            WHERE home_training_session_id = $4 
              AND exercise_order = $5
          `, [
            progress.series_completed,
            progress.status || 'in_progress',
            progress.duration_seconds,
            sessionId,
            parseInt(exerciseIndex)
          ]);
        }
      }
    }

    // 3. Marcar momento de abandono (no cerrar la sesión, solo marcar)
    await pool.query(`
      UPDATE app.home_training_sessions
      SET 
        abandoned_at = NOW(),
        abandon_reason = $2
      WHERE id = $1
    `, [sessionId, reason]);

    console.log(`✅ Sesión ${sessionId} marcada como abandonada (${reason})`);
    
    res.json({ success: true, message: 'Progreso guardado antes de abandono' });
    
  } catch (error) {
    console.error('❌ Error manejando abandono:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cerrar sesiones activas (para el problema principal)
router.put('/close-active-sessions', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId || req.user.id;

    const result = await pool.query(
      `UPDATE app.home_training_sessions
       SET status = 'cancelled', 
           completed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1 AND status = 'in_progress'
       RETURNING id`,
      [user_id]
    );

    res.json({
      success: true,
      message: `${result.rows.length} sesión${result.rows.length !== 1 ? 'es' : ''} cerrada${result.rows.length !== 1 ? 's' : ''}`,
      closedSessions: result.rows.length
    });

  } catch (error) {
    console.error('Error closing active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesiones activas'
    });
  }
});

// ===============================================
// 🤖 ENDPOINT DE INFORMACIÓN DE EJERCICIOS CON IA
// ===============================================

/**
 * POST /api/ia-home-training/exercise-info
 * Obtiene información detallada de un ejercicio usando IA con cache en BD
 */
router.post('/exercise-info', authenticateToken, async (req, res) => {
  try {
    const { exerciseName } = req.body;
    const user_id = req.user.userId || req.user.id;

    if (!exerciseName) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el nombre del ejercicio'
      });
    }

    // Normalizar nombre del ejercicio para búsqueda
    const normalizedName = exerciseName.toLowerCase().trim();

    console.log(`🔍 Buscando información para ejercicio: ${exerciseName}`);

    // 1. BUSCAR EN CACHE (tabla exercise_ai_info)
    const cacheResult = await pool.query(
      `SELECT ejecucion, consejos, errores_evitar, request_count, ai_model_used, created_at
       FROM app.exercise_ai_info
       WHERE exercise_name_normalized = $1 OR exercise_name = $2
       LIMIT 1`,
      [normalizedName, exerciseName]
    );

    if (cacheResult.rows.length > 0) {
      // ✅ ENCONTRADO EN CACHE - Incrementar contador y devolver
      const cachedInfo = cacheResult.rows[0];

      await pool.query(
        `UPDATE app.exercise_ai_info
         SET request_count = request_count + 1,
             last_updated = NOW()
         WHERE exercise_name_normalized = $1 OR exercise_name = $2`,
        [normalizedName, exerciseName]
      );

      console.log(`💾 Cache HIT para ${exerciseName} (solicitado ${cachedInfo.request_count + 1} veces)`);

      return res.json({
        success: true,
        exerciseInfo: {
          ejecucion: cachedInfo.ejecucion,
          consejos: cachedInfo.consejos,
          errores_evitar: cachedInfo.errores_evitar
        },
        source: 'cache',
        cached_at: cachedInfo.created_at,
        model_used: cachedInfo.ai_model_used
      });
    }

    // 2. NO ENCONTRADO EN CACHE - GENERAR CON IA
    console.log(`🤖 Cache MISS - Generando información para ejercicio: ${exerciseName}`);

    // Prompt específico para información de ejercicios
    const exerciseInfoPrompt = `Eres un experto entrenador personal y biomecánico. Te voy a dar el nombre de un ejercicio y necesito que me proporciones información detallada sobre él.

Ejercicio: "${exerciseName}"

Proporciona una respuesta en formato JSON con la siguiente estructura exacta:
{
  "ejecucion": "Explicación paso a paso de cómo ejecutar correctamente el ejercicio",
  "consejos": "Consejos específicos para mejorar la técnica y maximizar los beneficios",
  "errores_evitar": "Errores comunes que deben evitarse al realizar este ejercicio"
}

Instrucciones importantes:
- Sé específico y técnico en las explicaciones
- Cada sección debe tener entre 100-200 palabras
- Usa un lenguaje claro y profesional
- Si el ejercicio no existe o no lo conoces, indica alternativas similares
- Responde ÚNICAMENTE con el JSON, sin texto adicional`;

    try {
      // Obtener cliente OpenAI para home training
      const openai = getOpenAIClient('home');
      const model = "gpt-4o-mini";

      const startTime = Date.now();
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: exerciseInfoPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const aiResponse = completion.choices[0]?.message?.content;
      const tokensUsed = completion.usage?.total_tokens || 0;
      const responseTime = Date.now() - startTime;

      if (!aiResponse) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      // Intentar parsear la respuesta JSON
      let exerciseInfo;
      try {
        exerciseInfo = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Error parseando respuesta de IA:', parseError);
        throw new Error('Respuesta de IA no válida');
      }

      // Validar que la respuesta tenga la estructura esperada
      if (!exerciseInfo.ejecucion || !exerciseInfo.consejos || !exerciseInfo.errores_evitar) {
        throw new Error('Respuesta de IA incompleta');
      }

      // 3. GUARDAR EN CACHE (tabla exercise_ai_info)
      const estimatedCost = (tokensUsed / 1000) * 0.0015; // Estimación para gpt-4o-mini

      try {
        await pool.query(
          `INSERT INTO app.exercise_ai_info
           (exercise_name, exercise_name_normalized, ejecucion, consejos, errores_evitar,
            first_requested_by, ai_model_used, tokens_used, generation_cost, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (exercise_name) DO UPDATE SET
             request_count = app.exercise_ai_info.request_count + 1,
             last_updated = NOW()`,
          [
            exerciseName,
            normalizedName,
            exerciseInfo.ejecucion,
            exerciseInfo.consejos,
            exerciseInfo.errores_evitar,
            user_id,
            model,
            tokensUsed,
            estimatedCost
          ]
        );

        console.log(`💾 Información guardada en cache para: ${exerciseName} (${tokensUsed} tokens, ~$${estimatedCost.toFixed(4)})`);
      } catch (cacheError) {
        console.warn('⚠️ Error guardando en cache (no crítico):', cacheError.message);
      }

      console.log(`✅ Información generada exitosamente para: ${exerciseName} (${responseTime}ms)`);

      res.json({
        success: true,
        exerciseInfo: {
          ejecucion: exerciseInfo.ejecucion,
          consejos: exerciseInfo.consejos,
          errores_evitar: exerciseInfo.errores_evitar
        },
        source: 'ai_generated',
        tokens_used: tokensUsed,
        model_used: model,
        response_time_ms: responseTime
      });

    } catch (aiError) {
      console.error('Error llamando a OpenAI:', aiError);

      // Respuesta de fallback en caso de error de IA
      res.json({
        success: true,
        exerciseInfo: {
          ejecucion: `Para realizar ${exerciseName} correctamente, asegúrate de mantener una postura adecuada y realizar el movimiento de forma controlada. Consulta con un entrenador para obtener instrucciones específicas.`,
          consejos: `Concéntrate en la técnica antes que en la intensidad. Realiza el ejercicio lentamente al principio para dominar la forma correcta.`,
          errores_evitar: `Evita realizar movimientos bruscos, no mantener la postura correcta, y no calentar adecuadamente antes del ejercicio.`
        },
        source: 'fallback'
      });
    }

  } catch (error) {
    console.error('Error en endpoint exercise-info:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener información del ejercicio'
    });
  }
});

// ===============================================
// 📊 ENDPOINT DE ESTADÍSTICAS Y ADMINISTRACIÓN DE CACHE
// ===============================================

/**
 * GET /api/ia-home-training/exercise-info/stats
 * Obtiene estadísticas del cache de información de ejercicios
 */
router.get('/exercise-info/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del cache de ejercicios...');

    // Estadísticas generales
    const generalStats = await pool.query(`
      SELECT
        COUNT(*) as total_exercises,
        SUM(request_count) as total_requests,
        SUM(tokens_used) as total_tokens,
        SUM(generation_cost) as total_cost,
        COUNT(*) FILTER (WHERE is_verified = true) as verified_count,
        MAX(request_count) as max_requests,
        MIN(created_at) as first_exercise_date,
        MAX(last_updated) as last_request_date
      FROM app.exercise_ai_info
    `);

    // Top ejercicios más solicitados
    const topRequested = await pool.query(`
      SELECT
        exercise_name,
        request_count,
        ai_model_used,
        created_at,
        last_updated
      FROM app.exercise_ai_info
      ORDER BY request_count DESC, last_updated DESC
      LIMIT 10
    `);

    // Ejercicios recientes
    const recentExercises = await pool.query(`
      SELECT
        exercise_name,
        request_count,
        ai_model_used,
        created_at
      FROM app.exercise_ai_info
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Distribución por modelo de IA
    const modelDistribution = await pool.query(`
      SELECT
        ai_model_used,
        COUNT(*) as exercise_count,
        SUM(tokens_used) as total_tokens,
        SUM(generation_cost) as total_cost
      FROM app.exercise_ai_info
      GROUP BY ai_model_used
      ORDER BY exercise_count DESC
    `);

    const stats = generalStats.rows[0];

    res.json({
      success: true,
      stats: {
        general: {
          total_exercises: parseInt(stats.total_exercises),
          total_requests: parseInt(stats.total_requests || 0),
          total_tokens: parseInt(stats.total_tokens || 0),
          total_cost: parseFloat(stats.total_cost || 0),
          verified_count: parseInt(stats.verified_count || 0),
          max_requests: parseInt(stats.max_requests || 0),
          first_exercise_date: stats.first_exercise_date,
          last_request_date: stats.last_request_date,
          cache_efficiency: stats.total_requests > stats.total_exercises
            ? ((stats.total_requests - stats.total_exercises) / stats.total_requests * 100).toFixed(1) + '%'
            : '0%'
        },
        top_requested: topRequested.rows,
        recent_exercises: recentExercises.rows,
        model_distribution: modelDistribution.rows
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas del cache de ejercicios'
    });
  }
});

/**
 * PUT /api/ia-home-training/exercise-info/:exerciseId/verify
 * Marcar información de ejercicio como verificada
 */
router.put('/exercise-info/:exerciseId/verify', authenticateToken, async (req, res) => {
  try {
    const { exerciseId } = req.params;
    const { verified = true } = req.body;

    const result = await pool.query(
      `UPDATE app.exercise_ai_info
       SET is_verified = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING exercise_name, is_verified`,
      [verified, exerciseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ejercicio no encontrado'
      });
    }

    const exercise = result.rows[0];

    res.json({
      success: true,
      message: `Ejercicio "${exercise.exercise_name}" ${exercise.is_verified ? 'verificado' : 'marcado como no verificado'}`,
      exercise: exercise
    });

  } catch (error) {
    console.error('Error verificando ejercicio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar información del ejercicio'
    });
  }
});

export default router;
