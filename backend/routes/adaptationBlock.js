/**
 * Rutas de Bloque de Adaptación - HipertrofiaV2
 *
 * Endpoints para gestionar la fase de adaptación inicial
 * antes de entrar al ciclo D1-D5 completo.
 *
 * Criterios de transición:
 * 1. Adherencia >80% (4/5 sesiones por semana)
 * 2. RIR medio <4 (control de esfuerzo)
 * 3. Flags técnicas <1/semana (técnica aceptable)
 * 4. Progreso carga >8% (adaptación neuromuscular)
 */

import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: calcular semana actual del bloque de adaptación
function getWeekBounds(startDate) {
  // startDate es Date
  const start = new Date(startDate);
  const today = new Date();
  const diffDays = Math.floor((today - start) / 86400000);
  const weekNumber = Math.floor(diffDays / 7) + 1;

  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { weekNumber, weekStart, weekEnd };
}

// ============================================
// POST /api/adaptation/generate
// ============================================
/**
 * Genera un plan de bloque de adaptación (Full Body o Half Body)
 * para principiantes antes del ciclo D1-D5
 */
router.post('/generate', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { blockType, durationWeeks } = req.body;

    if (!blockType || !['full_body', 'half_body'].includes(blockType)) {
      return res.status(400).json({
        success: false,
        error: 'blockType debe ser "full_body" o "half_body"'
      });
    }

    console.log(`🎯 [ADAPTACIÓN] Generando bloque ${blockType} para usuario:`, userId);

    await dbClient.query('BEGIN');

    // Verificar si ya tiene un bloque activo
    const existingBlock = await dbClient.query(
      `SELECT id FROM app.adaptation_blocks
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    if (existingBlock.rows.length > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Ya tienes un bloque de adaptación activo',
        blockId: existingBlock.rows[0].id
      });
    }

    // Crear bloque de adaptación
    const blockResult = await dbClient.query(
      `INSERT INTO app.adaptation_blocks (
        user_id,
        block_type,
        duration_weeks,
        start_date,
        status
      )
      VALUES ($1, $2, $3, CURRENT_DATE, 'active')
      RETURNING *`,
      [userId, blockType, durationWeeks || 2]
    );

    const block = blockResult.rows[0];

    // Crear primera semana de tracking (inicializada en 0)
    await dbClient.query(
      `INSERT INTO app.adaptation_criteria_tracking (
        adaptation_block_id,
        week_number,
        sessions_planned,
        sessions_completed,
        mean_rir,
        technique_flags_count,
        initial_average_weight,
        current_average_weight,
        week_start_date,
        week_end_date
      )
      VALUES ($1, 1, 5, 0, NULL, 0, NULL, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days')`,
      [block.id]
    );

    await dbClient.query('COMMIT');

    console.log('✅ [ADAPTACIÓN] Bloque creado:', block.id);

    res.json({
      success: true,
      message: 'Bloque de adaptación creado exitosamente',
      block: {
        id: block.id,
        blockType: block.block_type,
        durationWeeks: block.duration_weeks,
        startDate: block.start_date,
        status: block.status
      },
      nextSteps: [
        'Completar 4-5 sesiones de entrenamiento por semana',
        'Mantener RIR medio en rango 2-4',
        'Evitar flags de técnica',
        'Incrementar cargas progresivamente'
      ]
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ [ADAPTACIÓN] Error generando bloque:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando bloque de adaptación',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

// ============================================
// GET /api/adaptation/progress
// ============================================
/**
 * Obtiene el progreso actual del bloque de adaptación del usuario
 */
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    console.log('📊 [ADAPTACIÓN] Obteniendo progreso para usuario:', userId);

    // Usar la vista de progreso
    const result = await pool.query(
      `SELECT * FROM app.adaptation_progress_summary
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasActiveBlock: false,
        message: 'No tienes un bloque de adaptación activo'
      });
    }

    const progress = result.rows[0];

    // Obtener detalles de todas las semanas
    const weeksResult = await pool.query(
      `SELECT
        week_number,
        adherence_percentage,
        adherence_met,
        mean_rir,
        rir_met,
        technique_flags_count,
        technique_met,
        weight_progress_percentage,
        progress_met,
        (adherence_met AND rir_met AND technique_met AND progress_met) AS all_criteria_met
       FROM app.adaptation_criteria_tracking
       WHERE adaptation_block_id = $1
       ORDER BY week_number`,
      [progress.adaptation_block_id]
    );

    res.json({
      success: true,
      hasActiveBlock: true,
      block: {
        id: progress.adaptation_block_id,
        blockType: progress.block_type,
        durationWeeks: progress.duration_weeks,
        startDate: progress.start_date,
        status: progress.status,
        weeksTracked: progress.weeks_tracked,
        weeksCriteriaMet: progress.weeks_criteria_met,
        latestWeek: progress.latest_week,
        readyForTransition: progress.ready_for_transition
      },
      weeks: weeksResult.rows,
      latestCriteria: {
        adherence: {
          met: progress.latest_adherence_met,
          threshold: 80
        },
        rir: {
          met: progress.latest_rir_met,
          threshold: 4
        },
        technique: {
          met: progress.latest_technique_met,
          threshold: 1
        },
        progress: {
          met: progress.latest_progress_met,
          threshold: 8
        },
        allMet: progress.latest_all_criteria_met
      }
    });

  } catch (error) {
    console.error('❌ [ADAPTACIÓN] Error obteniendo progreso:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo progreso',
      details: error.message
    });
  }
});

// ============================================
// POST /api/adaptation/evaluate-week
// ============================================
/**
 * Evalúa una semana completada y actualiza los criterios
 */
router.post('/evaluate-week', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      weekNumber,
      sessionsCompleted,
      meanRir,
      techniqueFlagsCount,
      initialAverageWeight,
      currentAverageWeight
    } = req.body;

    console.log(`📈 [ADAPTACIÓN] Evaluando semana ${weekNumber} para usuario:`, userId);

    await dbClient.query('BEGIN');

    // Obtener bloque activo
    const blockResult = await dbClient.query(
      `SELECT id FROM app.adaptation_blocks
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (blockResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'No tienes un bloque de adaptación activo'
      });
    }

    const blockId = blockResult.rows[0].id;

    // Actualizar o insertar tracking de la semana
    const updateResult = await dbClient.query(
      `INSERT INTO app.adaptation_criteria_tracking (
        adaptation_block_id,
        week_number,
        sessions_planned,
        sessions_completed,
        mean_rir,
        technique_flags_count,
        initial_average_weight,
        current_average_weight,
        week_start_date,
        week_end_date,
        evaluated_at
      )
      VALUES (
        $1, $2, 5, $3, $4, $5, $6, $7,
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        NOW()
      )
      ON CONFLICT (adaptation_block_id, week_number)
      DO UPDATE SET
        sessions_completed = EXCLUDED.sessions_completed,
        mean_rir = EXCLUDED.mean_rir,
        technique_flags_count = EXCLUDED.technique_flags_count,
        initial_average_weight = EXCLUDED.initial_average_weight,
        current_average_weight = EXCLUDED.current_average_weight,
        evaluated_at = NOW()
      RETURNING *`,
      [
        blockId,
        weekNumber,
        sessionsCompleted,
        meanRir,
        techniqueFlagsCount || 0,
        initialAverageWeight,
        currentAverageWeight
      ]
    );

    const weekData = updateResult.rows[0];

    await dbClient.query('COMMIT');

    console.log('✅ [ADAPTACIÓN] Semana evaluada:', weekNumber);

    // Calcular si todos los criterios se cumplieron
    const allCriteriaMet =
      weekData.adherence_met &&
      weekData.rir_met &&
      weekData.technique_met &&
      weekData.progress_met;

    res.json({
      success: true,
      message: 'Semana evaluada exitosamente',
      week: {
        number: weekData.week_number,
        criteria: {
          adherence: {
            value: weekData.adherence_percentage,
            met: weekData.adherence_met,
            sessions: `${weekData.sessions_completed}/${weekData.sessions_planned}`
          },
          rir: {
            value: weekData.mean_rir,
            met: weekData.rir_met
          },
          technique: {
            flags: weekData.technique_flags_count,
            met: weekData.technique_met
          },
          progress: {
            value: weekData.weight_progress_percentage,
            met: weekData.progress_met,
            initialWeight: weekData.initial_average_weight,
            currentWeight: weekData.current_average_weight
          }
        },
        allCriteriaMet
      },
      readyForTransition: allCriteriaMet
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ [ADAPTACIÓN] Error evaluando semana:', error);
    res.status(500).json({
      success: false,
      error: 'Error evaluando semana',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

// ============================================
// POST /api/adaptation/transition
// ============================================
/**
 * Completa el bloque de adaptación y habilita transición a D1-D5
 */
router.post('/transition', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    console.log('🚀 [ADAPTACIÓN] Solicitando transición a D1-D5 para usuario:', userId);

    // Obtener bloque activo
    const blockResult = await pool.query(
      `SELECT id FROM app.adaptation_blocks
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (blockResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No tienes un bloque de adaptación activo'
      });
    }

    const blockId = blockResult.rows[0].id;

    // Llamar a la función de transición
    const result = await pool.query(
      `SELECT * FROM app.transition_to_hypertrophy($1, $2)`,
      [userId, blockId]
    );

    const transitionResult = result.rows[0].transition_to_hypertrophy;

    if (!transitionResult.success) {
      return res.status(400).json(transitionResult);
    }

    console.log('✅ [ADAPTACIÓN] Transición completada, usuario listo para D1-D5');

    res.json({
      success: true,
      message: 'Bloque de adaptación completado exitosamente',
      readyForD1D5: true,
      evaluation: transitionResult.evaluation,
      nextSteps: [
        'Genera tu plan D1-D5 de HipertrofiaV2',
        'El sistema usará los datos de tu adaptación para ajustar las cargas iniciales',
        'Comenzarás con intensidades apropiadas basadas en tu progreso'
      ]
    });

  } catch (error) {
    console.error('❌ [ADAPTACIÓN] Error en transición:', error);
    res.status(500).json({
      success: false,
      error: 'Error al transicionar a D1-D5',
      details: error.message
    });
  }
});

// ============================================
// GET /api/adaptation/evaluate
// ============================================
/**
 * Evalúa si el usuario está listo para transicionar (sin completar el bloque)
 */
router.get('/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    console.log('🔍 [ADAPTACIÓN] Evaluando criterios para usuario:', userId);

    // Llamar a la función de evaluación
    const result = await pool.query(
      `SELECT * FROM app.evaluate_adaptation_completion($1)`,
      [userId]
    );

    const evaluation = result.rows[0].evaluate_adaptation_completion;

    res.json(evaluation);

  } catch (error) {
    console.error('❌ [ADAPTACIÓN] Error evaluando criterios:', error);
    res.status(500).json({
      success: false,
      error: 'Error evaluando criterios',
      details: error.message
    });
  }
});

// ============================================
// POST /api/adaptation/auto-evaluate-week
// ============================================
/**
 * Calcula métricas de la semana actual usando los logs reales
 * y registra la evaluación semanal automáticamente.
 * Pensado para HipertrofiaV2 (usa hypertrophy_set_logs).
 */
router.post('/auto-evaluate-week', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;

    console.log('🤖 [ADAPTACIÓN] Auto-evaluando semana para usuario:', userId);

    // Obtener bloque activo
    const blockResult = await dbClient.query(
      `SELECT id, start_date
       FROM app.adaptation_blocks
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (blockResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'No tienes un bloque de adaptación activo'
      });
    }

    const block = blockResult.rows[0];
    const { weekNumber, weekStart, weekEnd } = getWeekBounds(block.start_date);

    // Sesiones completadas en la ventana (solo metodologías de hipertrofia)
    const sessionsResult = await dbClient.query(
      `SELECT COUNT(*) AS count
       FROM app.methodology_exercise_sessions
       WHERE user_id = $1
         AND session_status = 'completed'
         AND session_date::date BETWEEN $2::date AND $3::date
         AND (methodology_type ILIKE 'HipertrofiaV2%' OR methodology_type ILIKE 'hipertrofia%')`,
      [userId, weekStart, weekEnd]
    );

    const sessionsCompleted = parseInt(sessionsResult.rows[0].count, 10) || 0;

    // Métricas desde hypertrophy_set_logs
    const rirResult = await dbClient.query(
      `SELECT
         AVG(rir_reported)                       AS mean_rir,
         AVG(weight_used)                        AS avg_weight
       FROM app.hypertrophy_set_logs
       WHERE user_id = $1
         AND created_at BETWEEN $2 AND ($3 + INTERVAL '1 day')`,
      [userId, weekStart, weekEnd]
    );

    const meanRir = parseFloat(rirResult.rows[0].mean_rir) || null;
    const currentAverageWeight = parseFloat(rirResult.rows[0].avg_weight) || null;

    // Peso inicial (baseline): primera semana evaluada o week 1
    let initialAverageWeight = null;
    const baselineResult = await dbClient.query(
      `SELECT initial_average_weight
       FROM app.adaptation_criteria_tracking
       WHERE adaptation_block_id = $1 AND week_number = 1
       ORDER BY evaluated_at DESC
       LIMIT 1`,
      [block.id]
    );
    if (baselineResult.rows.length > 0) {
      initialAverageWeight = parseFloat(baselineResult.rows[0].initial_average_weight) || null;
    }
    if (!initialAverageWeight && weekNumber === 1) {
      initialAverageWeight = currentAverageWeight;
    }

    // Flags técnicos en la semana
    const techniqueFlagsResult = await dbClient.query(
      `SELECT COUNT(*) AS count
       FROM app.adaptation_technique_flags
       WHERE adaptation_block_id = $1
         AND flagged_at BETWEEN $2 AND ($3 + INTERVAL '1 day')`,
      [block.id, weekStart, weekEnd]
    );
    const techniqueFlagsCount = parseInt(techniqueFlagsResult.rows[0].count, 10) || 0;

    // Upsert usando misma lógica que /evaluate-week
    const updateResult = await dbClient.query(
      `INSERT INTO app.adaptation_criteria_tracking (
        adaptation_block_id,
        week_number,
        sessions_planned,
        sessions_completed,
        mean_rir,
        technique_flags_count,
        initial_average_weight,
        current_average_weight,
        week_start_date,
        week_end_date,
        evaluated_at
      )
      VALUES (
        $1, $2, 5, $3, $4, $5, $6, $7,
        $8::date, $9::date, NOW()
      )
      ON CONFLICT (adaptation_block_id, week_number)
      DO UPDATE SET
        sessions_completed = EXCLUDED.sessions_completed,
        mean_rir = EXCLUDED.mean_rir,
        technique_flags_count = EXCLUDED.technique_flags_count,
        initial_average_weight = COALESCE(app.adaptation_criteria_tracking.initial_average_weight, EXCLUDED.initial_average_weight),
        current_average_weight = EXCLUDED.current_average_weight,
        week_start_date = EXCLUDED.week_start_date,
        week_end_date = EXCLUDED.week_end_date,
        evaluated_at = NOW()
      RETURNING *`,
      [
        block.id,
        weekNumber,
        sessionsCompleted,
        meanRir,
        techniqueFlagsCount,
        initialAverageWeight,
        currentAverageWeight,
        weekStart,
        weekEnd
      ]
    );

    const weekData = updateResult.rows[0];
    const allCriteriaMet =
      weekData.adherence_met &&
      weekData.rir_met &&
      weekData.technique_met &&
      weekData.progress_met;

    res.json({
      success: true,
      message: 'Semana auto-evaluada exitosamente',
      week: {
        number: weekData.week_number,
        criteria: {
          adherence: {
            value: weekData.adherence_percentage,
            met: weekData.adherence_met,
            sessions: `${weekData.sessions_completed}/${weekData.sessions_planned}`
          },
          rir: {
            value: weekData.mean_rir,
            met: weekData.rir_met
          },
          technique: {
            flags: weekData.technique_flags_count,
            met: weekData.technique_met
          },
          progress: {
            value: weekData.weight_progress_percentage,
            met: weekData.progress_met,
            initialWeight: weekData.initial_average_weight,
            currentWeight: weekData.current_average_weight
          }
        },
        allCriteriaMet
      },
      readyForTransition: allCriteriaMet,
      window: {
        start: weekStart,
        end: weekEnd
      }
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ [ADAPTACIÓN] Error en auto-evaluación:', error);
    res.status(500).json({
      success: false,
      error: 'Error auto-evaluando semana',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

// ============================================
// POST /api/adaptation/technique-flag
// ============================================
/**
 * Registra un flag de técnica durante el bloque de adaptación
 */
router.post('/technique-flag', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionId, exerciseId, flagType, severity, description } = req.body;

    if (!flagType) {
      return res.status(400).json({
        success: false,
        error: 'flagType es requerido'
      });
    }

    console.log('⚠️  [ADAPTACIÓN] Registrando flag de técnica:', flagType);

    // Obtener bloque activo
    const blockResult = await pool.query(
      `SELECT id FROM app.adaptation_blocks
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (blockResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No tienes un bloque de adaptación activo'
      });
    }

    const blockId = blockResult.rows[0].id;

    // Insertar flag
    const result = await pool.query(
      `INSERT INTO app.adaptation_technique_flags (
        adaptation_block_id,
        user_id,
        session_id,
        exercise_id,
        flag_type,
        severity,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [blockId, userId, sessionId, exerciseId, flagType, severity || 'moderate', description]
    );

    const flag = result.rows[0];

    console.log('✅ [ADAPTACIÓN] Flag registrado:', flag.id);

    res.json({
      success: true,
      message: 'Flag de técnica registrado',
      flag: {
        id: flag.id,
        type: flag.flag_type,
        severity: flag.severity,
        description: flag.description,
        flaggedAt: flag.flagged_at
      }
    });

  } catch (error) {
    console.error('❌ [ADAPTACIÓN] Error registrando flag:', error);
    res.status(500).json({
      success: false,
      error: 'Error registrando flag de técnica',
      details: error.message
    });
  }
});

export default router;
