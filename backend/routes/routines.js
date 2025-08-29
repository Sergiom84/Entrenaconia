import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// ========================================
// RUTAS PARA SESIONES DE RUTINAS
// ========================================

// Crear/hidratar sesión de rutina (idempotente)
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { routinePlanId, weekNumber, dayName, totalExpected } = req.body;
    const userId = req.user?.userId || req.user?.id;

    console.log('[POST /api/routines/sessions]', { userId, routinePlanId, weekNumber, dayName, totalExpected });

    // Validar parámetros
    if (!Number.isInteger(routinePlanId) || !Number.isInteger(weekNumber) || !dayName) {
      console.log('[POST /api/routines/sessions] error - parámetros inválidos');
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }

    // Verificar que el plan existe y no está archivado
    const planQ = await pool.query(
      `SELECT id, archived_at FROM app.routine_plans WHERE id = $1 AND user_id = $2`,
      [routinePlanId, userId]
    );
    
    if (planQ.rowCount === 0) {
      console.log('[POST /api/routines/sessions] error - plan no encontrado');
      return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    }
    
    if (planQ.rows[0].archived_at) {
      console.log('[POST /api/routines/sessions] error - plan archivado', { archived_at: planQ.rows[0].archived_at });
      return res.status(409).json({ success: false, error: 'Plan archivado' });
    }

    // Lock para evitar multi-click concurrente
    await pool.query(`SELECT pg_advisory_xact_lock($1, $2)`, [userId, routinePlanId]);

    const total = Number.isInteger(totalExpected) ? Math.max(0, totalExpected) : 0;

    // Obtener el plan con los ejercicios del JSON para este día específico
    const planWithDataQ = await pool.query(
      `SELECT plan_data FROM app.routine_plans WHERE id = $1`,
      [routinePlanId]
    );

    let exercisesForThisDay = [];
    if (planWithDataQ.rowCount > 0 && planWithDataQ.rows[0].plan_data) {
      try {
        const planData = planWithDataQ.rows[0].plan_data;
        console.log('[POST /api/routines/sessions] DEBUG planData keys:', Object.keys(planData || {}));
        if (planData && planData.semanas) {
          console.log('[POST /api/routines/sessions] DEBUG semanas count:', planData.semanas.length);
          const semanaActual = planData.semanas.find(s => s.semana === weekNumber);
          console.log('[POST /api/routines/sessions] DEBUG looking for week:', weekNumber, 'found:', !!semanaActual);
          if (semanaActual && semanaActual.sesiones) {
            console.log('[POST /api/routines/sessions] DEBUG sesiones count:', semanaActual.sesiones.length);
            const sessionForDay = semanaActual.sesiones.find(ses => ses.dia === dayName);
            console.log('[POST /api/routines/sessions] DEBUG looking for day:', dayName, 'found:', !!sessionForDay);
            if (sessionForDay && sessionForDay.ejercicios) {
              exercisesForThisDay = sessionForDay.ejercicios;
              console.log('[POST /api/routines/sessions] DEBUG ejercicios count:', exercisesForThisDay.length);
            }
          }
        }
      } catch (parseError) {
        console.warn('[POST /api/routines/sessions] error parsing plan_data:', parseError);
      }
    }

    // Calcular el total de ejercicios basado en el JSON si no se proporcionó
    const actualTotal = Number.isInteger(totalExpected) && totalExpected > 0 
      ? totalExpected 
      : exercisesForThisDay.length;

    // Upsert de la sesión
    const upsert = await pool.query(
      `INSERT INTO app.routine_sessions (user_id, routine_plan_id, week_number, day_name, total_exercises, exercises_completed, status)
       VALUES ($1,$2,$3,$4,$5,0,'pending')
       ON CONFLICT (user_id, routine_plan_id, week_number, day_name)
       DO UPDATE SET 
         total_exercises = CASE WHEN app.routine_sessions.total_exercises = 0 THEN EXCLUDED.total_exercises ELSE app.routine_sessions.total_exercises END,
         updated_at = NOW()
       RETURNING *;`,
      [userId, routinePlanId, weekNumber, dayName, actualTotal]
    );

    const sessionId = upsert.rows[0].id;
    const wasInserted = upsert.rows[0].created_at === upsert.rows[0].updated_at;
    
    console.log('[POST /api/routines/sessions] DEBUG Session result:', {
      sessionId,
      wasInserted,
      total_exercises: upsert.rows[0].total_exercises,
      actualTotal,
      exercisesForThisDayLength: exercisesForThisDay.length
    });

    // Crear ejercicios SIEMPRE que tengamos ejercicios del JSON y no existan ya
    if (exercisesForThisDay.length > 0) {
      console.log('[POST /api/routines/sessions] Creating exercise progress records:', exercisesForThisDay.length);
      
      // Verificar si ya existen ejercicios para esta sesión
      const existingExercises = await pool.query(
        `SELECT COUNT(*) FROM app.routine_exercise_progress WHERE routine_session_id = $1`,
        [sessionId]
      );
      
      const exerciseCount = parseInt(existingExercises.rows[0].count);
      console.log('[POST /api/routines/sessions] Existing exercises count:', exerciseCount);
      
      // Solo crear si no existen ejercicios
      if (exerciseCount === 0) {
        for (let i = 0; i < exercisesForThisDay.length; i++) {
          const ejercicio = exercisesForThisDay[i];
          try {
            await pool.query(
              `INSERT INTO app.routine_exercise_progress 
               (user_id, routine_session_id, exercise_order, exercise_name, series_total, status) 
               VALUES ($1, $2, $3, $4, $5, 'pending')`,
              [userId, sessionId, i + 1, ejercicio.nombre, ejercicio.series || 0] // i + 1 para empezar en 1
            );
          } catch (progressError) {
            console.warn('[POST /api/routines/sessions] error creating exercise progress:', progressError);
          }
        }
        
        // Actualizar el total_exercises de la sesión también
        await pool.query(
          `UPDATE app.routine_sessions SET total_exercises = $1, updated_at = NOW() WHERE id = $2`,
          [exercisesForThisDay.length, sessionId]
        );
        
        console.log('[POST /api/routines/sessions] Exercise progress records created successfully');
      } else {
        console.log('[POST /api/routines/sessions] Exercises already exist, skipping creation');
      }
    }

    console.log('[POST /api/routines/sessions] success', { sessionId: sessionId });
    return res.status(200).json({
      success: true,
      session: upsert.rows[0]
    });
    
  } catch (err) {
    console.error('[POST /api/routines/sessions] error', err);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// Obtener progreso de una rutina (filtrar archivados)
router.get('/progress/:routinePlanId', authenticateToken, async (req, res) => {
  try {
    const { routinePlanId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    console.log('[GET /api/routines/progress]', { userId, routinePlanId });

    // Verificar plan no archivado
    const planCheck = await pool.query(
      `SELECT id, archived_at FROM app.routine_plans WHERE id = $1 AND user_id = $2`,
      [routinePlanId, userId]
    );
    
    if (planCheck.rowCount === 0) {
      console.log('[GET /api/routines/progress] plan no encontrado');
      return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    }
    
    if (planCheck.rows[0].archived_at) {
      console.log('[GET /api/routines/progress] plan archivado', { archived_at: planCheck.rows[0].archived_at });
      return res.status(409).json({ success: false, error: 'Plan archivado' });
    }

    const progressQuery = `
      SELECT * FROM app.get_routine_progress($1, $2)
    `;
    const progressResult = await pool.query(progressQuery, [userId, parseInt(routinePlanId)]);

    res.json({
      success: true,
      progress: progressResult.rows[0] || {
        total_sessions: 0,
        completed_sessions: 0,
        in_progress_sessions: 0,
        total_exercises: 0,
        completed_exercises: 0,
        current_week: 1,
        current_day: 'Lun',
        overall_percentage: 0
      }
    });

  } catch (error) {
    console.error('Error obteniendo progreso de rutina:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener detalles de una sesión específica (hidratación controlada)
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    console.log('[GET /api/routines/sessions/:sessionId]', { userId, sessionId });

    // Primera consulta: obtener sesión básica y plan
    const sessionQuery = `
      SELECT 
        rs.*,
        rp.archived_at,
        rp.plan_data
      FROM app.routine_sessions rs
      JOIN app.routine_plans rp ON rs.routine_plan_id = rp.id
      WHERE rs.id = $1 AND rs.user_id = $2
    `;

    const sessionResult = await pool.query(sessionQuery, [sessionId, userId]);

    if (sessionResult.rows.length === 0) {
      console.log('[GET /api/routines/sessions/:sessionId] no encontrada');
      return res.status(204).end();
    }

    const session = sessionResult.rows[0];
    if (session.archived_at) {
      console.log('[GET /api/routines/sessions/:sessionId] plan archivado', { archived_at: session.archived_at });
      return res.status(204).end();
    }

    // Obtener ejercicios del plan JSON para la semana y día actual
    let exercises = [];
    if (session.plan_data && session.plan_data.semanas) {
      const semanaActual = session.plan_data.semanas.find(s => s.semana === session.week_number);
      if (semanaActual && semanaActual.sesiones) {
        const sesionActual = semanaActual.sesiones.find(s => s.dia === session.day_name);
        if (sesionActual && sesionActual.ejercicios) {
          exercises = sesionActual.ejercicios.map((ejercicio, index) => ({
            exercise_order: index + 1, // Coincidir con BD que empieza en 1
            exercise_name: ejercicio.nombre,
            status: 'pending',
            series_completed: 0,
            series_total: ejercicio.series || 0,
            repetitions: ejercicio.repeticiones,
            rest_time: ejercicio.descanso_seg,
            intensity: ejercicio.intensidad,
            tempo: ejercicio.tempo,
            notes: ejercicio.notas,
            detailed_info: ejercicio.informacion_detallada,
            time_spent_seconds: 0,
            feedback_sentiment: null,
            feedback_comment: null
          }));
        }
      }
    }

    // Obtener progreso real de la base de datos para sobrescribir valores predeterminados
    if (exercises.length > 0) {
      const progressQuery = `
        SELECT 
          rep.exercise_order,
          rep.status,
          rep.series_completed,
          rep.time_spent_seconds,
          ref.sentiment as feedback_sentiment,
          ref.comment as feedback_comment
        FROM app.routine_exercise_progress rep
        LEFT JOIN app.routine_exercise_feedback ref ON rep.routine_session_id = ref.routine_session_id 
          AND rep.exercise_order = ref.exercise_order
        WHERE rep.routine_session_id = $1
        ORDER BY rep.exercise_order
      `;
      
      const progressResult = await pool.query(progressQuery, [sessionId]);
      
      // Merge con el progreso real
      progressResult.rows.forEach(progress => {
        const exerciseIndex = exercises.findIndex(e => e.exercise_order === progress.exercise_order);
        if (exerciseIndex >= 0) {
          exercises[exerciseIndex].status = progress.status;
          exercises[exerciseIndex].series_completed = progress.series_completed;
          exercises[exerciseIndex].time_spent_seconds = progress.time_spent_seconds;
          exercises[exerciseIndex].feedback_sentiment = progress.feedback_sentiment;
          exercises[exerciseIndex].feedback_comment = progress.feedback_comment;
        }
      });
    }

    // Remover campos internos
    delete session.archived_at;
    delete session.plan_data;

    // Añadir ejercicios a la sesión
    session.exercises = exercises;

    console.log(`[GET /api/routines/sessions/:sessionId] devolviendo ${exercises.length} ejercicios`);

    res.json({
      success: true,
      session: session
    });

  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Actualizar progreso de un ejercicio
router.put('/sessions/:sessionId/exercise/:exerciseIndex/progress', authenticateToken, async (req, res) => {
  try {
    const { sessionId, exerciseIndex } = req.params;
    const { seriesCompleted, status, timeSpent } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Verificar que la sesión pertenece al usuario
    const verifyQuery = `
      SELECT id FROM app.routine_sessions 
      WHERE id = $1 AND user_id = $2
    `;
    const verifyResult = await pool.query(verifyQuery, [sessionId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    // Actualizar progreso
    const updateQuery = `
      SELECT app.update_routine_exercise_progress($1, $2, $3, $4, $5)
    `;
    await pool.query(updateQuery, [
      parseInt(sessionId),
      parseInt(exerciseIndex),
      parseInt(seriesCompleted),
      status,
      timeSpent ? parseInt(timeSpent) : null
    ]);

    // Si el ejercicio se completó, también guardarlo en el historial del usuario para la IA
    if (status === 'completed') {
      try {
        // Obtener información del ejercicio de la sesión incluyendo methodology_type
        const sessionQuery = `
          SELECT rs.*, rp.plan_data, rp.methodology_type
          FROM app.routine_sessions rs
          JOIN app.routine_plans rp ON rs.routine_plan_id = rp.id
          WHERE rs.id = $1 AND rs.user_id = $2
        `;
        const sessionResult = await pool.query(sessionQuery, [sessionId, userId]);
        
        if (sessionResult.rows.length > 0) {
          const session = sessionResult.rows[0];
          const planData = session.plan_data;
          
          // Encontrar el ejercicio específico
          let exerciseData = null;
          if (planData && planData.semanas) {
            for (const semana of planData.semanas) {
              if (semana.sesiones) {
                for (const sesion of semana.sesiones) {
                  if (sesion.ejercicios && sesion.ejercicios[exerciseIndex]) {
                    exerciseData = sesion.ejercicios[exerciseIndex];
                    break;
                  }
                }
              }
              if (exerciseData) break;
            }
          }

          // Insertar en historial de metodologías (tabla específica)
          if (exerciseData) {
            const historyQuery = `
              INSERT INTO app.exercise_history 
              (user_id, exercise_name, methodology_type, plan_id, week_number, day_name)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (user_id, exercise_name, plan_id, week_number, day_name) 
              DO UPDATE SET 
                used_at = CURRENT_TIMESTAMP
            `;
            await pool.query(historyQuery, [
              userId,
              exerciseData.nombre,
              session.methodology_type || 'Desconocida',
              session.routine_plan_id,
              session.week_number,
              session.day_name
            ]);
            console.log(`✅ Ejercicio "${exerciseData.nombre}" guardado en historial de metodologías (${session.methodology_type})`);
          }
        }
      } catch (historyError) {
        console.error('❌ Error guardando en historial de usuario:', historyError);
        // No fallar la respuesta principal por este error
      }
    }

    res.json({
      success: true,
      message: 'Progreso actualizado'
    });

  } catch (error) {
    console.error('Error actualizando progreso:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Enviar feedback de un ejercicio
router.post('/sessions/:sessionId/exercise/:exerciseIndex/feedback', authenticateToken, async (req, res) => {
  try {
    const { sessionId, exerciseIndex } = req.params;
    const { sentiment, comment, exercise_name } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Verificar que la sesión pertenece al usuario
    const verifyQuery = `
      SELECT id FROM app.routine_sessions 
      WHERE id = $1 AND user_id = $2
    `;
    const verifyResult = await pool.query(verifyQuery, [sessionId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    // Insertar o actualizar feedback
    const feedbackQuery = `
      INSERT INTO app.routine_exercise_feedback (
        user_id, routine_session_id, exercise_order, exercise_name, sentiment, comment
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (routine_session_id, exercise_order)
      DO UPDATE SET 
        sentiment = EXCLUDED.sentiment,
        comment = EXCLUDED.comment,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(feedbackQuery, [
      userId,
      parseInt(sessionId),
      parseInt(exerciseIndex),
      exercise_name,
      sentiment,
      comment
    ]);

    res.json({
      success: true,
      message: 'Feedback guardado'
    });

  } catch (error) {
    console.error('Error guardando feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Completar una sesión
router.put('/sessions/:sessionId/complete', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { totalDuration } = req.body;
    const userId = req.user?.userId || req.user?.id;

    const completeQuery = `
      UPDATE app.routine_sessions 
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        total_duration_seconds = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `;

    await pool.query(completeQuery, [sessionId, userId, totalDuration || 0]);

    res.json({
      success: true,
      message: 'Sesión completada'
    });

  } catch (error) {
    console.error('Error completando sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ========================================
// RUTAS PARA ESTADÍSTICAS
// ========================================

// Obtener estadísticas del usuario
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    const statsQuery = `
      SELECT * FROM app.user_routine_stats WHERE user_id = $1
    `;
    const statsResult = await pool.query(statsQuery, [userId]);

    res.json({
      success: true,
      stats: statsResult.rows[0] || {
        user_id: userId,
        total_routines_generated: 0,
        completed_sessions: 0,
        completed_exercises: 0,
        total_feedback_given: 0,
        loved_exercises: 0,
        hard_exercises: 0,
        avg_session_duration_seconds: 0,
        last_workout_date: null
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener historial de rutinas del usuario (filtrar archivados)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { limit = 10, offset = 0 } = req.query;

    console.log('[GET /api/routines/history]', { userId, limit, offset });

    const historyQuery = `
      SELECT 
        rp.id,
        rp.methodology_type,
        rp.frequency_per_week,
        rp.total_weeks,
        rp.created_at,
        rp.is_active,
        rp.archived_at,
        COUNT(rs.id) as total_sessions,
        COUNT(CASE WHEN rs.status = 'completed' THEN 1 END) as completed_sessions
      FROM app.routine_plans rp
      LEFT JOIN app.routine_sessions rs ON rp.id = rs.routine_plan_id
      WHERE rp.user_id = $1 AND rp.archived_at IS NULL
      GROUP BY rp.id, rp.methodology_type, rp.frequency_per_week, rp.total_weeks, rp.created_at, rp.is_active, rp.archived_at
      ORDER BY rp.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const historyResult = await pool.query(historyQuery, [userId, parseInt(limit), parseInt(offset)]);

    console.log('[GET /api/routines/history] found:', historyResult.rowCount, 'routines');

    res.json({
      success: true,
      routines: historyResult.rows
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener estadísticas de un plan de rutina específico (filtrar archivados)
router.get('/plans/:planId/stats', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    console.log('[GET /api/routines/plans/:planId/stats]', { planId, userId });

    // Verificar plan y estado archivado
    const planCheck = await pool.query(
      `SELECT id, archived_at, is_active FROM app.routine_plans WHERE id = $1 AND user_id = $2`,
      [planId, userId]
    );

    if (planCheck.rowCount === 0) {
      console.log('[GET /api/routines/plans/:planId/stats] plan no encontrado');
      return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    }

    const plan = planCheck.rows[0];
    console.log('[GET /api/routines/plans/:planId/stats] plan check', { archived_at: plan.archived_at, is_active: plan.is_active });
    
    if (plan.archived_at) {
      return res.status(409).json({ success: false, error: 'Plan archivado' });
    }

    if (plan.is_active === false) {
      return res.status(410).json({
        success: false,
        error: 'Este plan de rutina ha sido cancelado',
        code: 'ROUTINE_CANCELLED'
      });
    }

    // Usar la nueva función mejorada para obtener estadísticas
    const statsQuery = `
      SELECT * FROM app.get_enhanced_routine_plan_stats($1, $2)
    `;

    const statsResult = await pool.query(statsQuery, [userId, parseInt(planId)]);
    
    if (statsResult.rows.length === 0) {
      console.log('[GET /api/routines/plans/:planId/stats] no stats found');
      return res.status(404).json({
        success: false,
        error: 'Plan de rutina no encontrado'
      });
    }

    const stats = statsResult.rows[0];
    console.log('[GET /api/routines/plans/:planId/stats] success', { total_exercises: stats.total_exercises_attempted });

    res.json({
      success: true,
      stats: {
        completed_sessions: stats.completed_sessions,
        completed_exercises: stats.total_exercises_attempted,
        total_training_time: stats.total_training_time_minutes,
        current_streak: stats.current_streak_days,
        methodology_type: stats.methodology_type,
        current_level: stats.generation_mode === 'auto' ? 'Intermedio' : 'Personalizado',
        last_session_date: stats.last_session_date,
        loved_exercises: stats.loved_exercises,
        hard_exercises: stats.hard_exercises,
        plan_created_at: stats.plan_created_at,
        plan_total_weeks: stats.total_weeks,
        plan_frequency_per_week: stats.frequency_per_week,
        overall_progress: stats.overall_progress_percentage
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas del plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Registrar actividad diaria (cuando usuario hace clic en "Continuar Entrenamiento")
router.post('/plans/:planId/activity', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user?.userId || req.user?.id;
    const { activityType = 'continue_training' } = req.body;

    console.log('[POST /api/routines/plans/:planId/activity]', { planId, userId, activityType });

    // Verificar plan y estado archivado
    const planCheck = await pool.query(
      `SELECT id, archived_at FROM app.routine_plans WHERE id = $1 AND user_id = $2`,
      [planId, userId]
    );

    if (planCheck.rowCount === 0) {
      console.log('[POST /api/routines/plans/:planId/activity] plan no encontrado');
      return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    }

    if (planCheck.rows[0].archived_at) {
      console.log('[POST /api/routines/plans/:planId/activity] plan archivado', { archived_at: planCheck.rows[0].archived_at });
      return res.status(409).json({ success: false, error: 'Plan archivado' });
    }

    // Registrar la actividad diaria
    const registerQuery = `
      SELECT app.register_daily_activity($1, $2, $3)
    `;

    await pool.query(registerQuery, [userId, parseInt(planId), activityType]);

    console.log('[POST /api/routines/plans/:planId/activity] success');
    res.json({
      success: true,
      message: 'Actividad registrada exitosamente'
    });

  } catch (error) {
    console.error('Error registrando actividad diaria:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ========================================
// CANCELAR/ELIMINAR RUTINAS
// ========================================

// Cancelar rutina completamente (marcar como inactiva y limpiar sesiones)
router.delete('/plans/:planId', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user?.userId || req.user?.id;
    
    console.log(`🗑️ [Routines] Cancelando rutina planId: ${planId}, userId: ${userId}`);

    // Verificar que el plan pertenezca al usuario y no esté archivado
    const checkQuery = `
      SELECT id, methodology_type, archived_at FROM app.routine_plans 
      WHERE id = $1 AND user_id = $2
    `;
    
    const checkResult = await pool.query(checkQuery, [planId, userId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rutina no encontrada o no tienes permisos' 
      });
    }

    const plan = checkResult.rows[0];
    if (plan.archived_at) {
      return res.status(409).json({ 
        success: false, 
        error: 'La rutina ya está archivada' 
      });
    }

    // TRANSACCIÓN para limpiar todo relacionado con la rutina
    await pool.query('BEGIN');

    try {
      // 1. Eliminar feedback de ejercicios
      await pool.query(`
        DELETE FROM app.routine_exercise_feedback 
        WHERE routine_session_id IN (
          SELECT id FROM app.routine_sessions 
          WHERE routine_plan_id = $1 AND user_id = $2
        )
      `, [planId, userId]);

      // 2. Eliminar progreso de ejercicios
      await pool.query(`
        DELETE FROM app.routine_exercise_progress 
        WHERE routine_session_id IN (
          SELECT id FROM app.routine_sessions 
          WHERE routine_plan_id = $1 AND user_id = $2
        )
      `, [planId, userId]);

      // 3. Eliminar actividad diaria relacionada (tabla no existe - omitir)
      // await pool.query(`
      //   DELETE FROM app.daily_activity 
      //   WHERE user_id = $1 AND routine_plan_id = $2
      // `, [userId, planId]);

      // 4. Eliminar sesiones de rutina
      const deleteSessionsResult = await pool.query(`
        DELETE FROM app.routine_sessions 
        WHERE routine_plan_id = $1 AND user_id = $2
        RETURNING id
      `, [planId, userId]);

      // 5. Archivar plan (marcar como archived_at para que no reaparezca)
      const archiveResult = await pool.query(`
        UPDATE app.routine_plans 
        SET archived_at = CURRENT_TIMESTAMP, is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND user_id = $2
        RETURNING id, methodology_type
      `, [planId, userId]);

      await pool.query('COMMIT');

      console.log(`✅ [Routines] Rutina ${planId} cancelada exitosamente:`);
      console.log(`   - Sesiones eliminadas: ${deleteSessionsResult.rowCount}`);
      console.log(`   - Plan archivado: ${archiveResult.rowCount}`);

      res.json({
        success: true,
        message: 'Rutina cancelada exitosamente',
        deleted: {
          sessions: deleteSessionsResult.rowCount,
          plan_archived: archiveResult.rowCount > 0
        }
      });

    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [Routines] Error cancelando rutina:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Limpiar todas las rutinas inactivas del usuario
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    console.log(`🧹 [Routines] Limpiando rutinas inactivas para userId: ${userId}`);

    await pool.query('BEGIN');

    try {
      // Obtener todos los planes inactivos del usuario
      const inactiveQuery = `
        SELECT id, methodology_type FROM app.routine_plans 
        WHERE user_id = $1 AND (is_active = false OR is_active IS NULL)
      `;
      
      const inactivePlans = await pool.query(inactiveQuery, [userId]);
      
      if (inactivePlans.rows.length === 0) {
        await pool.query('COMMIT');
        return res.json({
          success: true,
          message: 'No hay rutinas inactivas para limpiar',
          cleaned: 0
        });
      }

      const planIds = inactivePlans.rows.map(plan => plan.id);

      // Eliminar datos relacionados en orden
      await pool.query(`
        DELETE FROM app.routine_exercise_feedback 
        WHERE routine_session_id IN (
          SELECT rs.id FROM app.routine_sessions rs 
          WHERE rs.routine_plan_id = ANY($1) AND rs.user_id = $2
        )
      `, [planIds, userId]);

      await pool.query(`
        DELETE FROM app.routine_exercise_progress 
        WHERE routine_session_id IN (
          SELECT rs.id FROM app.routine_sessions rs 
          WHERE rs.routine_plan_id = ANY($1) AND rs.user_id = $2
        )
      `, [planIds, userId]);

      // Eliminar actividad diaria relacionada (tabla no existe - omitir)
      // await pool.query(`
      //   DELETE FROM app.daily_activity 
      //   WHERE user_id = $1 AND routine_plan_id = ANY($2)
      // `, [userId, planIds]);

      const deleteSessionsResult = await pool.query(`
        DELETE FROM app.routine_sessions 
        WHERE routine_plan_id = ANY($1) AND user_id = $2
        RETURNING id
      `, [planIds, userId]);

      const deletePlansResult = await pool.query(`
        DELETE FROM app.routine_plans 
        WHERE id = ANY($1) AND user_id = $2 AND (is_active = false OR is_active IS NULL)
        RETURNING id, methodology_type
      `, [planIds, userId]);

      await pool.query('COMMIT');

      console.log(`✅ [Routines] Limpieza completada:`);
      console.log(`   - Planes eliminados: ${deletePlansResult.rowCount}`);
      console.log(`   - Sesiones eliminadas: ${deleteSessionsResult.rowCount}`);

      res.json({
        success: true,
        message: 'Limpieza de rutinas inactivas completada',
        cleaned: deletePlansResult.rowCount
      });

    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [Routines] Error en limpieza:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ENDPOINT DE EMERGENCIA: Limpiar TODAS las rutinas de un usuario
router.post('/emergency-cleanup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    console.log(`🚨 [EMERGENCY] Limpieza completa para userId: ${userId}`);

    await pool.query('BEGIN');

    try {
      // Eliminar TODO sin verificar is_active
      await pool.query(`
        DELETE FROM app.routine_exercise_feedback 
        WHERE routine_session_id IN (
          SELECT rs.id FROM app.routine_sessions rs 
          JOIN app.routine_plans rp ON rs.routine_plan_id = rp.id
          WHERE rp.user_id = $1
        )
      `, [userId]);

      await pool.query(`
        DELETE FROM app.routine_exercise_progress 
        WHERE routine_session_id IN (
          SELECT rs.id FROM app.routine_sessions rs 
          JOIN app.routine_plans rp ON rs.routine_plan_id = rp.id
          WHERE rp.user_id = $1
        )
      `, [userId]);

      const deleteSessionsResult = await pool.query(`
        DELETE FROM app.routine_sessions 
        WHERE routine_plan_id IN (
          SELECT id FROM app.routine_plans WHERE user_id = $1
        )
        RETURNING id
      `, [userId]);

      const deletePlansResult = await pool.query(`
        DELETE FROM app.routine_plans 
        WHERE user_id = $1
        RETURNING id, methodology_type
      `, [userId]);

      await pool.query('COMMIT');

      console.log(`✅ [EMERGENCY] Limpieza completada:`);
      console.log(`   - Planes eliminados: ${deletePlansResult.rowCount}`);
      console.log(`   - Sesiones eliminadas: ${deleteSessionsResult.rowCount}`);

      res.json({
        success: true,
        message: 'Limpieza de emergencia completada',
        deleted: {
          plans: deletePlansResult.rowCount,
          sessions: deleteSessionsResult.rowCount,
          plans_ids: deletePlansResult.rows.map(r => r.id),
          sessions_ids: deleteSessionsResult.rows.map(r => r.id)
        }
      });

    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [EMERGENCY] Error en limpieza:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;