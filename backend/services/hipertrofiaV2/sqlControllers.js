/**
 * Controladores para endpoints que envuelven funciones SQL
 * Consolida el patrón repetitivo try/catch -> query -> res.json
 */

import pool from '../../db.js';
import { logger } from './logger.js';

/**
 * Helper genérico para llamar funciones SQL
 * @param {object} res - Response object de Express
 * @param {string} queryText - Query SQL a ejecutar
 * @param {Array} params - Parámetros de la query
 * @param {string} [logPrefix='SQL'] - Prefijo para logs
 * @returns {Promise<void>}
 */
async function callDbFunction(res, queryText, params, logPrefix = 'SQL') {
  try {
    const result = await pool.query(queryText, params);
    const data = result.rows[0]?.result || result.rows[0];

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    logger.error(`❌ [${logPrefix}] Error:`, error);
    res.status(500).json({
      success: false,
      error: `Error en ${logPrefix}`,
      details: error.message
    });
  }
}

/**
 * ============================================================
 * CONTROLADORES DE CICLO
 * ============================================================
 */

export const cycleControllers = {
  /**
   * GET /cycle-status/:userId
   */
  async getCycleStatus(req, res) {
    try {
      const { userId } = req.params;
      logger.debug(`📊 [CYCLE] Obteniendo estado para usuario ${userId}`);

      const result = await pool.query(
        `SELECT * FROM app.hipertrofia_v2_user_status WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          cycleState: null,
          message: 'Usuario sin estado de ciclo (comenzará en D1)'
        });
      }

      res.json({
        success: true,
        cycleState: result.rows[0]
      });
    } catch (error) {
      logger.error('❌ [CYCLE] Error obteniendo estado:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estado del ciclo'
      });
    }
  },

  /**
   * POST /advance-cycle
   */
  async advanceCycle(req, res) {
    try {
      const userId = req.user?.userId || req.user?.id;
      const { sessionDayName, sessionPatterns = [] } = req.body;

      if (!sessionDayName) {
        return res.status(400).json({
          success: false,
          error: 'sessionDayName es requerido'
        });
      }

      const normalizedPatterns = Array.isArray(sessionPatterns)
        ? sessionPatterns.filter(v => typeof v === 'string' && v.trim().length > 0)
            .map(v => v.toLowerCase().trim())
        : [];

      logger.debug(`🔄 [CYCLE] Avanzando para usuario ${userId} desde ${sessionDayName}`);

      const result = await pool.query(
        `SELECT app.advance_cycle_day($1, $2, $3::jsonb) as result`,
        [userId, sessionDayName, JSON.stringify(normalizedPatterns)]
      );

      const cycleResult = result.rows[0].result;

      // Si completó microciclo, aplicar progresión
      if (cycleResult.microcycle_completed) {
        logger.info(`🎯 [CYCLE] Microciclo completado! Aplicando progresión...`);

        const planResult = await pool.query(
          `SELECT methodology_plan_id FROM app.hipertrofia_v2_state WHERE user_id = $1`,
          [userId]
        );

        if (planResult.rows.length > 0) {
          const methodologyPlanId = planResult.rows[0].methodology_plan_id;

          const progressionResult = await pool.query(
            `SELECT app.apply_microcycle_progression($1, $2) as result`,
            [userId, methodologyPlanId]
          );

          cycleResult.progression = progressionResult.rows[0].result;
        }
      }

      res.json({
        success: true,
        cycleAdvanced: true,
        ...cycleResult
      });
    } catch (error) {
      logger.error('❌ [CYCLE] Error avanzando:', error);
      res.status(500).json({
        success: false,
        error: 'Error al avanzar ciclo',
        details: error.message
      });
    }
  }
};

/**
 * ============================================================
 * CONTROLADORES DE DELOAD
 * ============================================================
 */

export const deloadControllers = {
  /**
   * GET /check-deload/:userId
   */
  async checkDeload(req, res) {
    const { userId } = req.params;
    logger.debug(`🔍 [DELOAD] Verificando para usuario ${userId}`);

    await callDbFunction(
      res,
      `SELECT app.check_deload_trigger($1) as result`,
      [userId],
      'DELOAD'
    );
  },

  /**
   * POST /activate-deload
   */
  async activateDeload(req, res) {
    const userId = req.user?.userId || req.user?.id;
    const { methodologyPlanId, reason = 'planificado' } = req.body;

    logger.info(`⚠️ [DELOAD] Activando para usuario ${userId} (${reason})`);

    await callDbFunction(
      res,
      `SELECT app.activate_deload($1, $2, $3) as result`,
      [userId, methodologyPlanId, reason],
      'DELOAD'
    );
  },

  /**
   * POST /deactivate-deload
   */
  async deactivateDeload(req, res) {
    const userId = req.user?.userId || req.user?.id;
    logger.info(`✅ [DELOAD] Desactivando para usuario ${userId}`);

    await callDbFunction(
      res,
      `SELECT app.deactivate_deload($1) as result`,
      [userId],
      'DELOAD'
    );
  }
};

/**
 * ============================================================
 * CONTROLADORES DE PRIORIDAD
 * ============================================================
 */

export const priorityControllers = {
  /**
   * POST /activate-priority
   */
  async activatePriority(req, res) {
    const userId = req.user?.userId || req.user?.id;
    const { muscleGroup } = req.body || {};

    if (!muscleGroup) {
      return res.status(400).json({ success: false, error: 'muscleGroup es requerido' });
    }

    logger.info(`🎯 [PRIORITY] Activando ${muscleGroup} para usuario ${userId}`);

    await callDbFunction(
      res,
      `SELECT app.activate_muscle_priority($1, $2) AS result`,
      [userId, muscleGroup],
      'PRIORITY'
    );
  },

  /**
   * POST /deactivate-priority
   */
  async deactivatePriority(req, res) {
    const userId = req.user?.userId || req.user?.id;
    logger.info(`🛑 [PRIORITY] Desactivando para usuario ${userId}`);

    await callDbFunction(
      res,
      `SELECT app.deactivate_muscle_priority($1) AS result`,
      [userId],
      'PRIORITY'
    );
  },

  /**
   * GET /priority-status/:userId
   */
  async getPriorityStatus(req, res) {
    try {
      const { userId } = req.params;
      logger.debug(`🔎 [PRIORITY] Consultando estado para usuario ${userId}`);

      const state = await pool.query(
        `SELECT priority_muscle, priority_started_at, priority_microcycles_completed, priority_top_sets_this_week
         FROM app.hipertrofia_v2_state WHERE user_id = $1`,
        [userId]
      );

      const timeoutCheck = await pool.query(
        `SELECT app.check_priority_timeout($1) AS result`,
        [userId]
      );

      res.json({
        success: true,
        priority: state.rows[0] || null,
        timeout_check: timeoutCheck.rows[0].result
      });
    } catch (error) {
      logger.error('❌ [PRIORITY] Error obteniendo estado:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estado de prioridad',
        details: error.message
      });
    }
  }
};

/**
 * ============================================================
 * CONTROLADORES DE NEURAL OVERLAP
 * ============================================================
 */

export const overlapControllers = {
  /**
   * POST /check-neural-overlap
   */
  async checkNeuralOverlap(req, res) {
    const userId = req.user?.userId || req.user?.id;
    const { sessionPatterns = [] } = req.body || {};

    if (!Array.isArray(sessionPatterns)) {
      return res.status(400).json({
        success: false,
        error: 'sessionPatterns debe ser un arreglo'
      });
    }

    const normalizedPatterns = sessionPatterns
      .filter(v => typeof v === 'string' && v.trim().length > 0)
      .map(v => v.toLowerCase().trim());

    logger.debug(`🧠 [OVERLAP] Detectando para usuario ${userId}`);

    await callDbFunction(
      res,
      `SELECT app.detect_neural_overlap($1, $2::jsonb) as result`,
      [userId, JSON.stringify(normalizedPatterns)],
      'OVERLAP'
    );
  },

  /**
   * GET /current-session-with-adjustments/:userId/:cycleDay
   */
  async getCurrentSessionWithAdjustments(req, res) {
    try {
      const { userId, cycleDay } = req.params;
      logger.debug(`🔍 [SESSION+OVERLAP] Obteniendo D${cycleDay} para usuario ${userId}`);

      // Obtener nivel del usuario
      const userQuery = await pool.query(
        `SELECT nivel_entrenamiento FROM app.users WHERE id = $1`,
        [userId]
      );
      const nivel = userQuery.rows[0]?.nivel_entrenamiento || 'Principiante';

      // Obtener plan activo
      const planQuery = await pool.query(
        `SELECT plan_data FROM app.methodology_plans
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (planQuery.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No hay plan activo' });
      }

      const planData = planQuery.rows[0].plan_data;
      let currentSession = null;

      // Buscar sesión del cycleDay
      for (const semana of (planData.semanas || [])) {
        for (const sesion of (semana.sesiones || [])) {
          if (sesion.ciclo_dia == cycleDay || sesion.cycle_day == cycleDay) {
            currentSession = sesion;
            break;
          }
        }
        if (currentSession) break;
      }

      if (!currentSession) {
        return res.status(404).json({ success: false, error: `Sesión D${cycleDay} no encontrada` });
      }

      // Detectar solapamiento (solo principiantes)
      let adjustedSession = { ...currentSession };
      let overlapInfo = null;

      if (nivel === 'Principiante' && currentSession.ejercicios) {
        const currentPatterns = currentSession.ejercicios
          .map(ex => ex.patron_movimiento)
          .filter(Boolean);

        const overlapResult = await pool.query(
          `SELECT app.detect_neural_overlap($1, $2::jsonb) as result`,
          [userId, JSON.stringify(currentPatterns)]
        );

        overlapInfo = overlapResult.rows[0]?.result || {};

        if (overlapInfo.overlap !== 'none' && overlapInfo.adjustment < 0) {
          logger.info(`⚠️ [OVERLAP] ${overlapInfo.overlap} detectado, ajustando -10%`);

          adjustedSession.ejercicios = currentSession.ejercicios.map(ex => {
            if (ex.tipo_ejercicio === 'multiarticular') {
              return {
                ...ex,
                intensidad_porcentaje: Math.round(ex.intensidad_porcentaje * 0.9 * 10) / 10,
                notas: (ex.notas || '') + ' [⚠️ -10% por solapamiento neural]'
              };
            }
            return ex;
          });
        }
      }

      res.json({
        success: true,
        session: adjustedSession,
        overlap_detected: overlapInfo?.overlap !== 'none',
        overlap_info: overlapInfo,
        nivel
      });
    } catch (error) {
      logger.error('❌ [SESSION+OVERLAP] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

/**
 * ============================================================
 * CONTROLADOR DE PROGRESIÓN
 * ============================================================
 */

export const progressionControllers = {
  /**
   * POST /apply-progression
   */
  async applyProgression(req, res) {
    const userId = req.user?.userId || req.user?.id;
    const { methodologyPlanId } = req.body;

    logger.info(`📈 [PROGRESSION] Aplicando para usuario ${userId}`);

    await callDbFunction(
      res,
      `SELECT app.apply_microcycle_progression($1, $2) as result`,
      [userId, methodologyPlanId],
      'PROGRESSION'
    );
  },

  /**
   * GET /progression/:userId/:exerciseId
   */
  async getProgression(req, res) {
    try {
      const { userId, exerciseId } = req.params;

      const result = await pool.query(
        `SELECT * FROM app.hypertrophy_progression WHERE user_id = $1 AND exercise_id = $2`,
        [userId, exerciseId]
      );

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
      logger.error('❌ [PROGRESSION] Error obteniendo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener progresión'
      });
    }
  },

  /**
   * POST /update-progression
   */
  async updateProgression(req, res) {
    try {
      const { userId, exerciseId, exerciseName } = req.body;

      logger.info(`📊 [PROGRESSION] Actualizando ${exerciseName} para usuario ${userId}`);

      await pool.query(
        `SELECT app.update_exercise_progression($1, $2, $3)`,
        [userId, exerciseId, exerciseName]
      );

      const result = await pool.query(
        `SELECT * FROM app.hypertrophy_progression WHERE user_id = $1 AND exercise_id = $2`,
        [userId, exerciseId]
      );

      res.json({
        success: true,
        progression: result.rows[0]
      });
    } catch (error) {
      logger.error('❌ [PROGRESSION] Error actualizando:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar progresión'
      });
    }
  }
};
