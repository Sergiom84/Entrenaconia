/**
 * ENDPOINTS LEGACY de HipertrofiaV2
 * Mantenidos para retrocompatibilidad
 * NOTA: Estos endpoints están deprecados y serán removidos en versiones futuras
 */

import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper: Limpiar drafts del usuario
 */
async function cleanUserDrafts(userId, client = null) {
  const dbClient = client || pool;
  try {
    await dbClient.query(
      `DELETE FROM app.methodology_plans WHERE user_id = $1 AND status = 'draft'`,
      [userId]
    );
  } catch (error) {
    console.error('Error limpiando drafts:', error.message);
  }
}

/**
 * POST /api/hipertrofiav2/legacy/generate
 * DEPRECADO: Genera plan con planData ya armado desde frontend
 * USAR: /api/hipertrofiav2/generate-d1d5 en su lugar
 */
router.post('/generate', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { planData } = req.body;

    if (!planData) {
      return res.status(400).json({
        success: false,
        error: 'planData es requerido'
      });
    }

    console.warn('⚠️ [LEGACY] Usando endpoint deprecado /generate. Migrar a /generate-d1d5');

    await dbClient.query('BEGIN');

    // Limpiar drafts previos
    await cleanUserDrafts(userId, dbClient);

    // Insertar plan
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `, [userId, 'HipertrofiaV2', JSON.stringify(planData), 'manual', 'draft']);

    const methodologyPlanId = planResult.rows[0].id;

    await dbClient.query('COMMIT');

    res.json({
      success: true,
      plan: planData,
      methodologyPlanId,
      planId: methodologyPlanId,
      message: 'Plan generado (endpoint legacy)',
      warning: 'Este endpoint está deprecado. Por favor migrar a /generate-d1d5'
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ [LEGACY] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar plan',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

export default router;
