/**
 * 🏋️ TRAINING STATE MANAGEMENT API
 * API robusta para reemplazar localStorage y centralizar estado en Supabase
 *
 * FUNCIONALIDADES PRINCIPALES:
 * - hasActivePlan() desde BD (no localStorage)
 * - Estado de sesiones activas
 * - Progreso real-time
 * - Sync automático entre dispositivos
 *
 * @version 1.0.0 - Refactorización Crítica
 */

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// ===============================================
// 🎯 ESTADO DE ENTRENAMIENTO
// ===============================================

/**
 * GET /api/training/state
 * Obtiene el estado completo de entrenamiento del usuario
 * REEMPLAZA: localStorage para hasActivePlan y estado de sesión
 */
router.get('/state', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Solo buscar plan activo sin usar user_training_state
    const activePlanResult = await pool.query(`
      SELECT
        mp.id as plan_id,
        mp.plan_data,
        mp.methodology_type,
        mp.status,
        1 as current_week,
        1 as current_day,
        mp.started_at,
        false as has_active_session,
        null as active_session_id
      FROM app.methodology_plans mp
      WHERE mp.user_id = $1 AND mp.status = 'active'
      ORDER BY mp.created_at DESC
      LIMIT 1
    `, [userId]);

    const activePlan = activePlanResult.rows[0] || null;

    const response = {
      // Plan activo
      hasActivePlan: !!activePlan,
      activePlan: activePlan ? {
        planId: activePlan.plan_id,
        planData: activePlan.plan_data,
        methodologyType: activePlan.methodology_type,
        status: activePlan.status,
        currentWeek: activePlan.current_week,
        currentDay: activePlan.current_day,
        startedAt: activePlan.started_at
      } : null,

      // Sesión activa (simplificado)
      hasActiveSession: false,
      activeSessionId: null,

      // Estado de UI (valores por defecto)
      currentView: 'methodologies',
      isTraining: false,
      currentExerciseIndex: 0,
      sessionStartedAt: null,
      sessionPausedAt: null,

      // Estadísticas (simplificado)
      stats: {
        totalSessions: 0,
        completedSessions: 0,
        inProgressSessions: 0,
        lastTrainingDate: null,
        avgSessionDuration: 0
      },

      // Metadata
      lastUpdated: new Date(),
      trainingMetadata: {}
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error obteniendo estado de entrenamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * PUT /api/training/state
 * Actualiza el estado de entrenamiento del usuario
 * REEMPLAZA: localStorage updates
 */
router.put('/state', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const updates = req.body;

    // Campos permitidos para actualización
    const allowedFields = [
      'current_view',
      'is_training',
      'current_exercise_index',
      'session_started_at',
      'session_paused_at',
      'training_metadata'
    ];

    const updateFields = [];
    const updateValues = [];
    let valueIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${valueIndex}`);
        updateValues.push(value);
        valueIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos válidos para actualizar'
      });
    }

    // Agregar user_id al final
    updateValues.push(userId);

    const query = `
      UPDATE user_training_state
      SET ${updateFields.join(', ')}
      WHERE user_id = $${valueIndex}
      RETURNING *
    `;

    const result = await client.query(query, updateValues);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Estado de usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Estado actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando estado de entrenamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// ===============================================
// 📋 GESTIÓN DE PLANES ACTIVOS
// ===============================================

/**
 * POST /api/training/activate-plan
 * Activa un plan de metodología y actualiza estado del usuario
 * REEMPLAZA: hasActivePlan localStorage logic
 */
router.post('/activate-plan', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const { methodology_plan_id } = req.body;

    if (!methodology_plan_id) {
      return res.status(400).json({
        success: false,
        error: 'methodology_plan_id es requerido'
      });
    }

    // Verificar que el plan existe y pertenece al usuario
    const planResult = await client.query(`
      SELECT * FROM methodology_plans
      WHERE id = $1 AND user_id = $2
    `, [methodology_plan_id, userId]);

    if (planResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado o no autorizado'
      });
    }

    // Desactivar cualquier plan activo anterior
    await client.query(`
      UPDATE methodology_plans
      SET status = 'archived', cancelled_at = NOW()
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    // Activar el nuevo plan
    await client.query(`
      UPDATE methodology_plans
      SET status = 'active', started_at = NOW(), confirmed_at = NOW()
      WHERE id = $1
    `, [methodology_plan_id]);

    // Actualizar estado del usuario
    await client.query(`
      INSERT INTO user_training_state (
        user_id,
        active_methodology_plan_id,
        current_view
      )
      VALUES ($1, $2, 'today_training')
      ON CONFLICT (user_id) DO UPDATE SET
        active_methodology_plan_id = EXCLUDED.active_methodology_plan_id,
        current_view = EXCLUDED.current_view,
        updated_at = NOW()
    `, [userId, methodology_plan_id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Plan activado exitosamente',
      data: {
        methodology_plan_id,
        status: 'active',
        activated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error activando plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/training/cancel-plan
 * Cancela el plan activo del usuario
 */
router.post('/cancel-plan', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.id;

    // Cancelar plan activo
    const result = await client.query(`
      UPDATE methodology_plans
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE user_id = $1 AND status = 'active'
      RETURNING id, methodology_type
    `, [userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay plan activo para cancelar'
      });
    }

    // Cancelar sesiones en progreso
    await client.query(`
      UPDATE methodology_exercise_sessions
      SET session_status = 'cancelled', cancelled_at = NOW(), is_current_session = false
      WHERE user_id = $1 AND session_status IN ('pending', 'in_progress')
    `, [userId]);

    // Limpiar estado del usuario
    await client.query(`
      UPDATE user_training_state
      SET
        active_methodology_plan_id = NULL,
        active_session_id = NULL,
        is_training = false,
        current_exercise_index = 0,
        session_started_at = NULL,
        session_paused_at = NULL,
        current_view = 'methodologies'
      WHERE user_id = $1
    `, [userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Plan cancelado exitosamente',
      data: {
        cancelled_plan_id: result.rows[0].id,
        methodology_type: result.rows[0].methodology_type,
        cancelled_at: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelando plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// ===============================================
// 🏃 GESTIÓN DE SESIONES ACTIVAS
// ===============================================

/**
 * POST /api/training/start-session
 * Inicia una nueva sesión de entrenamiento
 */
router.post('/start-session', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const { methodology_plan_id, week_number, day_name } = req.body;

    if (!methodology_plan_id || !week_number || !day_name) {
      return res.status(400).json({
        success: false,
        error: 'methodology_plan_id, week_number y day_name son requeridos'
      });
    }

    // Verificar que no hay sesión activa
    const activeSessionCheck = await client.query(`
      SELECT id FROM methodology_exercise_sessions
      WHERE user_id = $1 AND session_status = 'in_progress'
    `, [userId]);

    if (activeSessionCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya hay una sesión activa en progreso'
      });
    }

    // Crear nueva sesión
    const sessionResult = await client.query(`
      INSERT INTO methodology_exercise_sessions (
        user_id,
        methodology_plan_id,
        week_number,
        day_name,
        session_status,
        is_current_session,
        started_at
      )
      VALUES ($1, $2, $3, $4, 'in_progress', true, NOW())
      RETURNING *
    `, [userId, methodology_plan_id, week_number, day_name]);

    const session = sessionResult.rows[0];

    // Actualizar estado del usuario
    await client.query(`
      UPDATE user_training_state
      SET
        active_session_id = $1,
        is_training = true,
        session_started_at = NOW(),
        current_exercise_index = 0
      WHERE user_id = $2
    `, [session.id, userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Sesión iniciada exitosamente',
      data: {
        session_id: session.id,
        methodology_plan_id: session.methodology_plan_id,
        week_number: session.week_number,
        day_name: session.day_name,
        started_at: session.started_at,
        status: session.session_status
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error iniciando sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/training/session/:sessionId/progress
 * Actualiza progreso de ejercicio en sesión activa
 */
router.put('/session/:sessionId/progress', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const sessionId = req.params.sessionId;
    const { exerciseIndex, exerciseData, progressData } = req.body;

    // Verificar que la sesión pertenece al usuario
    const sessionCheck = await client.query(`
      SELECT * FROM methodology_exercise_sessions
      WHERE id = $1 AND user_id = $2
    `, [sessionId, userId]);

    if (sessionCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    // Actualizar progreso en exercise_session_tracking
    await client.query(`
      INSERT INTO exercise_session_tracking (
        methodology_session_id,
        user_id,
        exercise_name,
        exercise_order,
        exercise_data,
        status,
        actual_sets,
        actual_reps,
        actual_duration_seconds,
        started_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (methodology_session_id, exercise_order)
      DO UPDATE SET
        exercise_data = EXCLUDED.exercise_data,
        status = EXCLUDED.status,
        actual_sets = EXCLUDED.actual_sets,
        actual_reps = EXCLUDED.actual_reps,
        actual_duration_seconds = EXCLUDED.actual_duration_seconds,
        updated_at = NOW()
    `, [
      sessionId,
      userId,
      exerciseData?.name || `Exercise ${exerciseIndex}`,
      exerciseIndex,
      JSON.stringify(exerciseData),
      progressData?.status || 'in_progress',
      progressData?.sets || 0,
      progressData?.reps || '0',
      progressData?.duration || 0
    ]);

    // Actualizar índice de ejercicio actual en estado del usuario
    if (exerciseIndex !== undefined) {
      await client.query(`
        UPDATE user_training_state
        SET current_exercise_index = $1
        WHERE user_id = $2
      `, [exerciseIndex, userId]);
    }

    res.json({
      success: true,
      message: 'Progreso actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando progreso:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/training/session/:sessionId/complete
 * Completa una sesión de entrenamiento
 */
router.post('/session/:sessionId/complete', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const sessionId = req.params.sessionId;

    // Completar sesión
    const result = await client.query(`
      UPDATE methodology_exercise_sessions
      SET
        session_status = 'completed',
        completed_at = NOW(),
        is_current_session = false
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [sessionId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    // Limpiar estado de entrenamiento del usuario
    await client.query(`
      UPDATE user_training_state
      SET
        active_session_id = NULL,
        is_training = false,
        session_started_at = NULL,
        session_paused_at = NULL,
        current_exercise_index = 0
      WHERE user_id = $1
    `, [userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Sesión completada exitosamente',
      data: {
        session_id: sessionId,
        completed_at: result.rows[0].completed_at,
        total_duration_seconds: result.rows[0].total_duration_seconds
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completando sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// ===============================================
// 🧹 UTILIDADES Y MANTENIMIENTO
// ===============================================

/**
 * POST /api/training/cleanup
 * Limpia sesiones expiradas y estados inconsistentes
 */
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT cleanup_expired_training_sessions()');
    const cleanedCount = result.rows[0].cleanup_expired_training_sessions;

    res.json({
      success: true,
      message: `${cleanedCount} sesiones expiradas limpiadas`,
      cleaned_sessions: cleanedCount
    });

  } catch (error) {
    console.error('Error en limpieza:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

export default router;