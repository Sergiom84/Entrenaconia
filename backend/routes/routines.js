import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// ========================================
// RUTAS PARA SESIONES DE RUTINAS
// ========================================

// Crear una nueva sesión de rutina
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { routinePlanId, weekNumber, dayName } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Obtener datos de la rutina desde routine_plans o migrar desde methodology_plans
    const routineQuery = `
      SELECT plan_data FROM app.routine_plans
      WHERE id = $1 AND user_id = $2
    `;
    let effectivePlanId = routinePlanId;
    let planData = null;

    const routineResult = await pool.query(routineQuery, [routinePlanId, userId]);

    if (routineResult.rows.length === 0) {
      // Intentar con methodology_plans (compatibilidad: el plan se generó allí)
      const methQuery = `
        SELECT plan_data FROM app.methodology_plans
        WHERE id = $1 AND user_id = $2
      `;
      const methRes = await pool.query(methQuery, [routinePlanId, userId]);

      if (methRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Rutina no encontrada' });
      }

      planData = methRes.rows[0].plan_data;

      // Crear entrada en routine_plans a partir del plan de metodología
      const insertQuery = `
        INSERT INTO app.routine_plans (user_id, methodology_type, plan_data, generation_mode, created_at)
        VALUES ($1, $2, $3, 'automatic', NOW())
        RETURNING id
      `;
      const methodologyType = (planData && planData.selected_style) ? planData.selected_style : 'Rutina';
      const insertRes = await pool.query(insertQuery, [userId, methodologyType, JSON.stringify(planData)]);
      effectivePlanId = insertRes.rows[0].id;
    } else {
      planData = routineResult.rows[0].plan_data;
    }

    // Crear sesiones para esta rutina si no existen
    const createSessionsQuery = `
      SELECT app.create_routine_sessions($1, $2, $3)
    `;
    await pool.query(createSessionsQuery, [
      userId,
      effectivePlanId,
      JSON.stringify(planData)
    ]);

    // Obtener la sesión específica
    const sessionQuery = `
      SELECT * FROM app.routine_sessions
      WHERE user_id = $1 AND routine_plan_id = $2 AND week_number = $3 AND day_name = $4
    `;
    const sessionResult = await pool.query(sessionQuery, [userId, effectivePlanId, weekNumber, dayName]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    // Actualizar status a in_progress
    const updateQuery = `
      UPDATE app.routine_sessions 
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await pool.query(updateQuery, [sessionResult.rows[0].id]);

    res.json({
      success: true,
      session: sessionResult.rows[0]
    });

  } catch (error) {
    console.error('Error creando sesión de rutina:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener progreso de una rutina
router.get('/progress/:routinePlanId', authenticateToken, async (req, res) => {
  try {
    const { routinePlanId } = req.params;
    const userId = req.user?.userId || req.user?.id;

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

// Obtener detalles de una sesión específica
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const sessionQuery = `
      SELECT 
        rs.*,
        array_agg(
          json_build_object(
            'exercise_order', rep.exercise_order,
            'exercise_name', rep.exercise_name,
            'status', rep.status,
            'series_completed', rep.series_completed,
            'series_total', rep.series_total,
            'time_spent_seconds', rep.time_spent_seconds,
            'feedback_sentiment', ref.sentiment,
            'feedback_comment', ref.comment
          ) ORDER BY rep.exercise_order
        ) as exercises
      FROM app.routine_sessions rs
      LEFT JOIN app.routine_exercise_progress rep ON rs.id = rep.routine_session_id
      LEFT JOIN app.routine_exercise_feedback ref ON rs.id = ref.routine_session_id 
        AND rep.exercise_order = ref.exercise_order
      WHERE rs.id = $1 AND rs.user_id = $2
      GROUP BY rs.id
    `;

    const sessionResult = await pool.query(sessionQuery, [sessionId, userId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    res.json({
      success: true,
      session: sessionResult.rows[0]
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

// Obtener historial de rutinas del usuario
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { limit = 10, offset = 0 } = req.query;

    const historyQuery = `
      SELECT 
        rp.id,
        rp.methodology_type,
        rp.frequency_per_week,
        rp.total_weeks,
        rp.created_at,
        rp.is_active,
        COUNT(rs.id) as total_sessions,
        COUNT(CASE WHEN rs.status = 'completed' THEN 1 END) as completed_sessions
      FROM app.routine_plans rp
      LEFT JOIN app.routine_sessions rs ON rp.id = rs.routine_plan_id
      WHERE rp.user_id = $1
      GROUP BY rp.id, rp.methodology_type, rp.frequency_per_week, rp.total_weeks, rp.created_at, rp.is_active
      ORDER BY rp.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const historyResult = await pool.query(historyQuery, [userId, parseInt(limit), parseInt(offset)]);

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

// Obtener estadísticas de un plan de rutina específico
router.get('/plans/:planId/stats', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    console.log(`🔍 DEBUG Stats - planId: ${planId}, userId: ${userId}`);

    // Obtener o migrar plan para asegurar que existe en routine_plans
    const routineQuery = `
      SELECT id FROM app.routine_plans
      WHERE id = $1 AND user_id = $2
    `;
    let effectivePlanId = parseInt(planId);
    
    const routineResult = await pool.query(routineQuery, [planId, userId]);

    if (routineResult.rows.length === 0) {
      console.log(`⚠️ Plan ${planId} no encontrado en routine_plans, usando función helper...`);
      
      // Usar función helper que previene duplicados
      const helperQuery = `SELECT app.get_or_create_routine_plan($1, $2) as routine_plan_id`;
      const helperResult = await pool.query(helperQuery, [planId, userId]);
      
      if (helperResult.rows.length > 0) {
        effectivePlanId = helperResult.rows[0].routine_plan_id;
        console.log(`✅ Plan obtenido/creado: methodology_plan ${planId} -> routine_plan ${effectivePlanId}`);
      } else {
        console.log(`❌ No se pudo obtener/crear plan para methodology_plan ${planId}`);
        return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      }
    } else {
      console.log(`✅ Plan ${planId} encontrado en routine_plans`);
    }

    // Verificar que el plan esté activo antes de obtener estadísticas
    const activeCheckQuery = `
      SELECT id, is_active FROM app.routine_plans 
      WHERE id = $1 AND user_id = $2
    `;
    
    const activeResult = await pool.query(activeCheckQuery, [effectivePlanId, userId]);
    
    if (activeResult.rows.length === 0) {
      console.log(`❌ Plan ${effectivePlanId} no encontrado para userId: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Plan de rutina no encontrado'
      });
    }
    
    const planData = activeResult.rows[0];
    if (planData.is_active === false) {
      console.log(`❌ Plan ${effectivePlanId} está inactivo para userId: ${userId}`);
      return res.status(410).json({
        success: false,
        error: 'Este plan de rutina ha sido cancelado',
        code: 'ROUTINE_CANCELLED'
      });
    }

    // Usar la nueva función mejorada para obtener estadísticas con el plan efectivo
    const statsQuery = `
      SELECT * FROM app.get_enhanced_routine_plan_stats($1, $2)
    `;

    const statsResult = await pool.query(statsQuery, [userId, effectivePlanId]);
    
    console.log(`🔍 DEBUG Stats Result:`, statsResult.rows);
    
    if (statsResult.rows.length === 0) {
      console.log(`❌ No stats found for planId: ${planId}, userId: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Plan de rutina no encontrado'
      });
    }

    const stats = statsResult.rows[0];
    console.log(`🔍 DEBUG Processed Stats:`, stats);

    res.json({
      success: true,
      stats: {
        completed_sessions: stats.completed_sessions,
        completed_exercises: stats.total_exercises_attempted, // Todos los ejercicios realizados
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

    // Obtener o migrar plan para asegurar que existe en routine_plans
    const routineQuery = `
      SELECT id FROM app.routine_plans
      WHERE id = $1 AND user_id = $2
    `;
    let effectivePlanId = parseInt(planId);
    
    const routineResult = await pool.query(routineQuery, [planId, userId]);

    if (routineResult.rows.length === 0) {
      console.log(`⚠️ Plan ${planId} no encontrado en routine_plans para activity, usando función helper...`);
      
      // Usar función helper que previene duplicados
      const helperQuery = `SELECT app.get_or_create_routine_plan($1, $2) as routine_plan_id`;
      const helperResult = await pool.query(helperQuery, [planId, userId]);
      
      if (helperResult.rows.length > 0) {
        effectivePlanId = helperResult.rows[0].routine_plan_id;
        console.log(`✅ Plan obtenido/creado para activity: methodology_plan ${planId} -> routine_plan ${effectivePlanId}`);
      } else {
        console.log(`❌ No se pudo obtener/crear plan para activity methodology_plan ${planId}`);
        return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      }
    }

    // Registrar la actividad diaria con el plan correcto
    const registerQuery = `
      SELECT app.register_daily_activity($1, $2, $3)
    `;

    await pool.query(registerQuery, [userId, effectivePlanId, activityType]);

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

    // Verificar que el plan pertenezca al usuario
    const checkQuery = `
      SELECT id, methodology_type FROM app.routine_plans 
      WHERE id = $1 AND user_id = $2
    `;
    
    const checkResult = await pool.query(checkQuery, [planId, userId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rutina no encontrada o no tienes permisos' 
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

      // 5. Marcar plan como inactivo (en lugar de eliminar para auditoría)
      const deactivateResult = await pool.query(`
        UPDATE app.routine_plans 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND user_id = $2
        RETURNING id, methodology_type
      `, [planId, userId]);

      await pool.query('COMMIT');

      console.log(`✅ [Routines] Rutina ${planId} cancelada exitosamente:`);
      console.log(`   - Sesiones eliminadas: ${deleteSessionsResult.rowCount}`);
      console.log(`   - Plan desactivado: ${deactivateResult.rowCount}`);

      res.json({
        success: true,
        message: 'Rutina cancelada exitosamente',
        deleted: {
          sessions: deleteSessionsResult.rowCount,
          plan_deactivated: deactivateResult.rowCount > 0
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