import { pool } from "../db.js";

/**
 * Obtiene un cliente de base de datos. Si se pasa client (transacción) lo usa,
 * de lo contrario recurre al pool global.
 */
function getRunner(client) {
  return client || pool;
}

/**
 * Marca un plan como el actual del usuario (al generar/activar uno nuevo).
 * Desactiva cualquier otro plan que estuviera marcado como actual.
 */
export async function setCurrentMethodologyPlan(userId, planId, client) {
  const runner = getRunner(client);

  await runner.query(
    `UPDATE app.methodology_plans
     SET is_current = FALSE
     WHERE user_id = $1 AND id <> $2 AND is_current = TRUE`,
    [userId, planId]
  );

  await runner.query(
    `UPDATE app.methodology_plans
     SET is_current = TRUE,
         status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [planId, userId]
  );
}

/**
 * Revisa si todas las sesiones de un plan están finalizadas (completed/cancelled/skipped/missed/partial)
 * y, de ser así, marca el plan como completado y lo saca del estado actual.
 */
export async function finalizePlanIfCompleted(planId, client) {
  const runner = getRunner(client);

  const { rows } = await runner.query(
    `SELECT
        COUNT(*) FILTER (
          WHERE session_status NOT IN ('completed','cancelled','skipped','missed','partial')
        ) AS remaining
     FROM app.methodology_exercise_sessions
     WHERE methodology_plan_id = $1`,
    [planId]
  );

  const remaining = Number(rows?.[0]?.remaining ?? 0);

  if (remaining === 0) {
    await runner.query(
      `UPDATE app.methodology_plans
       SET status = 'completed',
           is_current = FALSE,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [planId]
    );
    console.log(`🏁 Plan ${planId} finalizado automáticamente`);
    return true;
  }

  return false;
}

/**
 * Cancela todos los planes activos del usuario antes de crear uno nuevo
 * @param {number} userId - ID del usuario
 * @param {object} client - Cliente de transacción (opcional)
 * @returns {Promise<number>} - Número de planes cancelados
 */
export async function cancelActivePlans(userId, client) {
  const runner = getRunner(client);

  const result = await runner.query(
    `UPDATE app.methodology_plans
     SET status = 'cancelled',
         is_current = FALSE,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $1
       AND status = 'active'
       AND origin = 'methodology'
     RETURNING id, methodology_type`,
    [userId]
  );

  if (result.rowCount > 0) {
    console.log(`🧹 Cancelados ${result.rowCount} planes activos:`,
      result.rows.map(r => `${r.id} (${r.methodology_type})`));
  }

  return result.rowCount;
}

/**
 * Activa un plan de metodología como único plan activo
 * Cancela automáticamente cualquier otro plan activo
 */
export async function activateMethodologyPlan(userId, planId, client) {
  const runner = getRunner(client);

  // 1. Cancelar planes activos anteriores
  await cancelActivePlans(userId, runner);

  // 2. Activar el nuevo plan
  await runner.query(
    `UPDATE app.methodology_plans
     SET status = 'active',
         is_current = TRUE,
         confirmed_at = COALESCE(confirmed_at, NOW()),
         started_at = COALESCE(started_at, NOW()),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [planId, userId]
  );

  console.log(`✅ Plan ${planId} activado como único plan activo para usuario ${userId}`);
}

/**
 * Obtiene el plan activo actual del usuario
 */
export async function getCurrentPlan(userId, client) {
  const runner = getRunner(client);

  const result = await runner.query(
    `SELECT * FROM app.methodology_plans
     WHERE user_id = $1 AND is_current = TRUE AND status = 'active'
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}
