import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// ===============================================================
// RUTAS PARA SISTEMA MANUAL DE METODOLOGÍAS
// ===============================================================

// Obtener plan activo manual (similar a routines.js pero para metodologías manuales)
router.get('/active-plan', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Buscar metodología activa de tipo manual
    const activeMethodologyQuery = await pool.query(`
      SELECT mp.id as methodology_plan_id, mp.methodology_type, mp.plan_data, 
             mp.confirmed_at, mp.generation_mode
      FROM app.methodology_plans mp
      WHERE mp.user_id = $1 
        AND mp.status = 'active' 
        AND mp.generation_mode = 'manual'
      ORDER BY mp.confirmed_at DESC LIMIT 1
    `, [userId]);

    if (activeMethodologyQuery.rowCount === 0) {
      return res.json({ hasActivePlan: false });
    }

    const activePlan = activeMethodologyQuery.rows[0];
    const planData = JSON.parse(activePlan.plan_data);

    res.json({
      hasActivePlan: true,
      routinePlan: planData,
      methodology_plan_id: activePlan.methodology_plan_id,
      planSource: { label: 'Manual' },
      generation_mode: 'manual'
    });

  } catch (error) {
    console.error('Error recuperando plan manual activo:', error);
    res.status(500).json({
      hasActivePlan: false,
      error: 'Error interno del servidor'
    });
  }
});

// Iniciar sesión de entrenamiento manual
router.post('/sessions/start', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { methodology_plan_id, week_number, day_name } = req.body;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Verificar que existe el plan y es manual
    const planQuery = await client.query(
      'SELECT plan_data, methodology_type FROM app.methodology_plans WHERE id = $1 AND user_id = $2 AND generation_mode = $3',
      [methodology_plan_id, userId, 'manual']
    );

    if (planQuery.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Plan de metodología manual no encontrado'
      });
    }

    const planData = JSON.parse(planQuery.rows[0].plan_data);
    const methodologyType = planQuery.rows[0].methodology_type;
    
    // Buscar sesión existente
    const existingSessionQuery = await client.query(
      `SELECT id FROM app.manual_methodology_exercise_sessions 
       WHERE user_id = $1 AND methodology_plan_id = $2 AND week_number = $3 AND day_name = $4`,
      [userId, methodology_plan_id, week_number, day_name]
    );

    let sessionId;
    let exercises = [];

    if (existingSessionQuery.rowCount > 0) {
      sessionId = existingSessionQuery.rows[0].id;
      
      // Cargar progreso existente
      const progressQuery = await client.query(
        `SELECT * FROM app.manual_methodology_exercise_progress 
         WHERE manual_methodology_session_id = $1 ORDER BY exercise_order`,
        [sessionId]
      );
      exercises = progressQuery.rows;
    } else {
      // Crear nueva sesión manual
      const semana = planData.semanas?.find(s => s.semana === week_number);
      if (!semana) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: `Semana ${week_number} no encontrada en el plan`
        });
      }

      const sesion = semana.sesiones?.find(s => s.dia === day_name);
      if (!sesion) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: `Día ${day_name} no encontrado en semana ${week_number}`
        });
      }

      const ejercicios = sesion.ejercicios || [];
      
      // Crear sesión manual
      const sessionResult = await client.query(
        `INSERT INTO app.manual_methodology_exercise_sessions (
           user_id, methodology_plan_id, methodology_type, session_name,
           week_number, day_name, total_exercises, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          userId, methodology_plan_id, methodologyType,
          `${methodologyType} Manual - Semana ${week_number} ${day_name}`,
          week_number, day_name, ejercicios.length
        ]
      );

      sessionId = sessionResult.rows[0].id;

      // Crear registros de progreso para cada ejercicio
      for (let i = 0; i < ejercicios.length; i++) {
        const ej = ejercicios[i];
        await client.query(
          `INSERT INTO app.manual_methodology_exercise_progress (
             manual_methodology_session_id, user_id, exercise_order, exercise_name,
             series_total, repeticiones, descanso_seg, intensidad, tempo, notas,
             ejercicio_ejecucion, ejercicio_consejos, ejercicio_errores_evitar
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            sessionId, userId, i, ej.nombre,
            ej.series || 3, ej.repeticiones || '10-12', 
            ej.descanso_seg || 90, ej.intensidad || 'RPE 7-8',
            ej.tempo || '2-0-2', ej.notas || '',
            ej.ejecucion || '', ej.consejos || '', ej.errores_comunes || ''
          ]
        );
      }

      // Obtener ejercicios creados
      const progressQuery = await client.query(
        `SELECT * FROM app.manual_methodology_exercise_progress 
         WHERE manual_methodology_session_id = $1 ORDER BY exercise_order`,
        [sessionId]
      );
      exercises = progressQuery.rows;
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      sessionId: sessionId,
      exercises: exercises,
      sessionInfo: {
        week_number,
        day_name,
        methodology_type: methodologyType,
        generation_mode: 'manual'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error iniciando sesión manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

// Actualizar progreso de ejercicio manual
router.post('/sessions/:sessionId/exercise/:exerciseOrder/progress', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const sessionId = parseInt(req.params.sessionId);
  const exerciseOrder = parseInt(req.params.exerciseOrder);
  const { series_completed, status, time_spent_seconds } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar sesión manual del usuario
    const sessionQuery = await client.query(
      'SELECT * FROM app.manual_methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionQuery.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Sesión manual no encontrada' });
    }

    // Actualizar progreso del ejercicio
    const updateResult = await client.query(
      `UPDATE app.manual_methodology_exercise_progress
       SET series_completed = $1, status = $2, time_spent_seconds = $3,
           completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE manual_methodology_session_id = $4 AND exercise_order = $5
       RETURNING *`,
      [series_completed, status, time_spent_seconds, sessionId, exerciseOrder]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Ejercicio no encontrado' });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      exercise: updateResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando progreso manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

// Guardar feedback de ejercicio manual
router.post('/sessions/:sessionId/exercise/:exerciseOrder/feedback', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const sessionId = parseInt(req.params.sessionId);
  const exerciseOrder = parseInt(req.params.exerciseOrder);
  const { sentiment, comment, exercise_name } = req.body;

  try {
    // Verificar que la sesión pertenece al usuario
    const sessionQuery = await pool.query(
      'SELECT * FROM app.manual_methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionQuery.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Sesión manual no encontrada' });
    }

    // Insertar o actualizar feedback
    const feedbackResult = await pool.query(
      `INSERT INTO app.manual_methodology_exercise_feedback 
       (manual_methodology_session_id, user_id, exercise_name, exercise_order, sentiment, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (manual_methodology_session_id, exercise_order) 
       DO UPDATE SET sentiment = $5, comment = $6, updated_at = NOW()
       RETURNING *`,
      [sessionId, userId, exercise_name, exerciseOrder, sentiment, comment]
    );

    res.json({
      success: true,
      feedback: feedbackResult.rows[0]
    });

  } catch (error) {
    console.error('Error guardando feedback manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener progreso de sesión manual
router.get('/sessions/:sessionId/progress', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const sessionId = parseInt(req.params.sessionId);

  try {
    // Verificar sesión manual
    const sessionQuery = await pool.query(
      'SELECT * FROM app.manual_methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionQuery.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Sesión manual no encontrada' });
    }

    // Obtener progreso con feedback
    const progressQuery = await pool.query(
      `SELECT 
         mep.*,
         mef.sentiment,
         mef.comment as feedback_comment
       FROM app.manual_methodology_exercise_progress mep
       LEFT JOIN app.manual_methodology_exercise_feedback mef 
         ON mef.manual_methodology_session_id = mep.manual_methodology_session_id 
         AND mef.exercise_order = mep.exercise_order
       WHERE mep.manual_methodology_session_id = $1
       ORDER BY mep.exercise_order`,
      [sessionId]
    );

    res.json({
      success: true,
      exercises: progressQuery.rows,
      sessionInfo: sessionQuery.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo progreso manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener estado de sesión de hoy (manual)
router.get('/sessions/today-status', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { methodology_plan_id, week_number, day_name } = req.query;

  try {
    const sessionQuery = await pool.query(
      `SELECT s.*, 
       array_agg(json_build_object(
         'exercise_order', p.exercise_order,
         'exercise_name', p.exercise_name,
         'status', p.status,
         'series_completed', p.series_completed,
         'series_total', p.series_total,
         'sentiment', f.sentiment,
         'comment', f.comment
       ) ORDER BY p.exercise_order) as exercises
       FROM app.manual_methodology_exercise_sessions s
       LEFT JOIN app.manual_methodology_exercise_progress p ON s.id = p.manual_methodology_session_id
       LEFT JOIN app.manual_methodology_exercise_feedback f 
         ON f.manual_methodology_session_id = s.id AND f.exercise_order = p.exercise_order
       WHERE s.user_id = $1 AND s.methodology_plan_id = $2 
         AND s.week_number = $3 AND s.day_name = $4
       GROUP BY s.id`,
      [userId, methodology_plan_id, week_number, day_name]
    );

    if (sessionQuery.rowCount === 0) {
      return res.json({
        hasSession: false,
        exercises: []
      });
    }

    const session = sessionQuery.rows[0];
    res.json({
      hasSession: true,
      sessionId: session.id,
      exercises: session.exercises.filter(e => e.exercise_order !== null),
      sessionInfo: {
        week_number: session.week_number,
        day_name: session.day_name,
        session_status: session.session_status,
        generation_mode: 'manual'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estado de sesión manual:', error);
    res.status(500).json({
      hasSession: false,
      error: 'Error interno del servidor'
    });
  }
});

// Confirmar plan manual
router.post('/confirm-plan', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { methodology_plan_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Marcar plan manual como activo
    const confirmResult = await client.query(
      `UPDATE app.methodology_plans 
       SET status = 'active', confirmed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND generation_mode = 'manual' AND status = 'draft'
       RETURNING *`,
      [methodology_plan_id, userId]
    );

    if (confirmResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'No se pudo confirmar el plan manual' 
      });
    }

    // Registrar ejercicios en historial manual
    const planData = JSON.parse(confirmResult.rows[0].plan_data);
    try {
      await client.query(
        'SELECT app.register_manual_plan_exercises($1, $2, $3, $4)',
        [userId, confirmResult.rows[0].methodology_type, JSON.stringify(planData), methodology_plan_id]
      );
      console.log('✅ Ejercicios registrados en historial manual');
    } catch (registerError) {
      console.log('⚠️ Error registrando en historial manual:', registerError.message);
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Plan manual confirmado correctamente' 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirmando plan manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

export default router;