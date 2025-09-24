/**
 * 🧹 Session Cleanup Utilities
 * Utilidades para limpiar sesiones en limbo y estados inconsistentes
 */

import { pool } from '../db.js';

/**
 * Limpia sesiones que han quedado en limbo (in_progress por mucho tiempo)
 * @param {number} userId - ID del usuario
 * @param {number} methodologyPlanId - ID del plan de metodología
 * @param {number} hoursThreshold - Horas después de las cuales cancelar sesión (default: 2)
 * @returns {Promise<number>} Número de sesiones limpiadas
 */
export async function cleanupLimboSessions(userId, methodologyPlanId = null, hoursThreshold = 2) {
  try {
    let query = `
      UPDATE app.methodology_exercise_sessions
      SET session_status = 'cancelled'
      WHERE user_id = $1
        AND session_status = 'in_progress'
        AND started_at < NOW() - INTERVAL '${hoursThreshold} hours'
    `;

    let params = [userId];

    if (methodologyPlanId) {
      query += ' AND methodology_plan_id = $2';
      params.push(methodologyPlanId);
    }

    query += ' RETURNING id, day_name, started_at';

    const result = await pool.query(query, params);

    if (result.rowCount > 0) {
      console.log(`🧹 Limpieza de sesiones en limbo:`);
      console.log(`   Usuario: ${userId}, Plan: ${methodologyPlanId || 'todos'}`);
      console.log(`   Sesiones canceladas: ${result.rowCount}`);
      result.rows.forEach(row => {
        console.log(`   - Sesión ${row.id} (${row.day_name}) iniciada: ${row.started_at}`);
      });
    }

    return result.rowCount;
  } catch (error) {
    console.error('❌ Error limpiando sesiones en limbo:', error);
    return 0;
  }
}

/**
 * Corrige estados inconsistentes (sesiones marcadas como in_progress pero con completed_at)
 * @param {number} userId - ID del usuario (opcional)
 * @returns {Promise<number>} Número de sesiones corregidas
 */
export async function fixInconsistentSessionStates(userId = null) {
  try {
    let query = `
      UPDATE app.methodology_exercise_sessions
      SET session_status = 'completed'
      WHERE session_status = 'in_progress'
        AND completed_at IS NOT NULL
    `;

    let params = [];

    if (userId) {
      query += ' AND user_id = $1';
      params.push(userId);
    }

    query += ' RETURNING id, day_name, completed_at';

    const result = await pool.query(query, params);

    if (result.rowCount > 0) {
      console.log(`🔧 Corrección de estados inconsistentes:`);
      console.log(`   Usuario: ${userId || 'todos'}`);
      console.log(`   Sesiones corregidas: ${result.rowCount}`);
      result.rows.forEach(row => {
        console.log(`   - Sesión ${row.id} (${row.day_name}) completada: ${row.completed_at}`);
      });
    }

    return result.rowCount;
  } catch (error) {
    console.error('❌ Error corrigiendo estados inconsistentes:', error);
    return 0;
  }
}

/**
 * Valida que un plan existe y está activo
 * @param {number} planId - ID del plan de metodología
 * @param {number} userId - ID del usuario
 * @returns {Promise<boolean>} true si el plan es válido y activo
 */
export async function validateActivePlan(planId, userId) {
  try {
    const result = await pool.query(`
      SELECT id, status, methodology_type
      FROM app.methodology_plans
      WHERE id = $1 AND user_id = $2
    `, [planId, userId]);

    if (result.rowCount === 0) {
      console.log(`⚠️ Plan ${planId} no encontrado para usuario ${userId}`);
      return false;
    }

    const plan = result.rows[0];
    if (plan.status !== 'active') {
      console.log(`⚠️ Plan ${planId} no está activo. Estado: ${plan.status}`);
      return false;
    }

    console.log(`✅ Plan ${planId} validado: ${plan.methodology_type} (${plan.status})`);
    return true;
  } catch (error) {
    console.error('❌ Error validando plan activo:', error);
    return false;
  }
}

/**
 * Limpieza completa antes de iniciar una nueva sesión
 * @param {number} userId - ID del usuario
 * @param {number} methodologyPlanId - ID del plan de metodología
 * @returns {Promise<{success: boolean, cleanedSessions: number, fixedStates: number}>}
 */
export async function preSessionCleanup(userId, methodologyPlanId) {
  try {
    console.log(`🧹 Iniciando limpieza pre-sesión para usuario ${userId}, plan ${methodologyPlanId}`);

    // 1. Validar que el plan está activo
    const isValidPlan = await validateActivePlan(methodologyPlanId, userId);
    if (!isValidPlan) {
      return {
        success: false,
        error: 'Plan no válido o no activo',
        cleanedSessions: 0,
        fixedStates: 0
      };
    }

    // 2. Limpiar sesiones en limbo para este plan específico
    const cleanedSessions = await cleanupLimboSessions(userId, methodologyPlanId, 1); // 1 hora threshold

    // 3. Corregir estados inconsistentes
    const fixedStates = await fixInconsistentSessionStates(userId);

    console.log(`✅ Limpieza pre-sesión completada:`);
    console.log(`   - Sesiones en limbo limpiadas: ${cleanedSessions}`);
    console.log(`   - Estados inconsistentes corregidos: ${fixedStates}`);

    return {
      success: true,
      cleanedSessions,
      fixedStates
    };
  } catch (error) {
    console.error('❌ Error en limpieza pre-sesión:', error);
    return {
      success: false,
      error: error.message,
      cleanedSessions: 0,
      fixedStates: 0
    };
  }
}

/**
 * Limpieza general del sistema (para ejecutar periódicamente)
 * @returns {Promise<{totalCleaned: number, totalFixed: number}>}
 */
export async function systemWideCleanup() {
  try {
    console.log('🧹 Iniciando limpieza general del sistema...');

    // Limpiar sesiones en limbo de más de 24 horas
    const limboQuery = await pool.query(`
      UPDATE app.methodology_exercise_sessions
      SET session_status = 'cancelled'
      WHERE session_status = 'in_progress'
        AND started_at < NOW() - INTERVAL '24 hours'
      RETURNING id, user_id, day_name, started_at
    `);

    // Corregir todos los estados inconsistentes
    const inconsistentQuery = await pool.query(`
      UPDATE app.methodology_exercise_sessions
      SET session_status = 'completed'
      WHERE session_status = 'in_progress'
        AND completed_at IS NOT NULL
      RETURNING id, user_id, day_name, completed_at
    `);

    const totalCleaned = limboQuery.rowCount;
    const totalFixed = inconsistentQuery.rowCount;

    console.log(`✅ Limpieza general completada:`);
    console.log(`   - Sesiones en limbo canceladas: ${totalCleaned}`);
    console.log(`   - Estados inconsistentes corregidos: ${totalFixed}`);

    if (totalCleaned > 0) {
      console.log('   Sesiones en limbo canceladas:');
      limboQuery.rows.forEach(row => {
        console.log(`     - Usuario ${row.user_id}, Sesión ${row.id} (${row.day_name})`);
      });
    }

    if (totalFixed > 0) {
      console.log('   Estados inconsistentes corregidos:');
      inconsistentQuery.rows.forEach(row => {
        console.log(`     - Usuario ${row.user_id}, Sesión ${row.id} (${row.day_name})`);
      });
    }

    return { totalCleaned, totalFixed };
  } catch (error) {
    console.error('❌ Error en limpieza general del sistema:', error);
    return { totalCleaned: 0, totalFixed: 0 };
  }
}