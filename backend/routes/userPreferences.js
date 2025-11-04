import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * 🎯 API DE PREFERENCIAS DE USUARIO
 *
 * Gestiona layouts personalizados y otras preferencias de usuario
 * Endpoints:
 * - POST /api/user/layout - Guardar/actualizar layout
 * - GET /api/user/layout/:layoutId - Obtener layout específico
 * - GET /api/user/layouts - Obtener todos los layouts del usuario
 * - DELETE /api/user/layout/:layoutId - Eliminar layout (reset a default)
 */

/**
 * 💾 GUARDAR O ACTUALIZAR LAYOUT
 *
 * @route POST /api/user/layout
 * @body {layout_id: string, layout_data: array, user_id: number}
 */
router.post('/layout', async (req, res) => {
  const { layout_id, layout_data, user_id } = req.body;

  if (!layout_id || !layout_data || !user_id) {
    return res.status(400).json({
      error: 'Faltan parámetros: layout_id, layout_data y user_id son requeridos'
    });
  }

  try {
    // UPSERT: Si existe, actualizar; si no, insertar
    const query = `
      INSERT INTO app.user_layouts (user_id, layout_id, layout_data, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, layout_id)
      DO UPDATE SET
        layout_data = EXCLUDED.layout_data,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await pool.query(query, [user_id, layout_id, JSON.stringify(layout_data)]);

    console.log(`✅ Layout guardado: ${layout_id} para usuario ${user_id}`);

    res.json({
      success: true,
      message: 'Layout guardado correctamente',
      layout: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al guardar layout:', error);

    // Si la tabla no existe, informar al usuario
    if (error.code === '42P01') {
      return res.status(500).json({
        error: 'La tabla user_layouts no existe. Ejecuta la migración SQL primero.',
        hint: 'Ver documentación en DRAG_AND_DROP_SETUP.md'
      });
    }

    res.status(500).json({
      error: 'Error al guardar layout',
      details: error.message
    });
  }
});

/**
 * 📖 OBTENER LAYOUT ESPECÍFICO
 *
 * @route GET /api/user/layout/:layoutId
 * @query {user_id: number}
 */
router.get('/layout/:layoutId', async (req, res) => {
  const { layoutId } = req.params;
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id es requerido' });
  }

  try {
    const query = `
      SELECT * FROM app.user_layouts
      WHERE user_id = $1 AND layout_id = $2;
    `;

    const result = await pool.query(query, [user_id, layoutId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Layout no encontrado',
        message: 'El usuario no tiene un layout personalizado para este ID'
      });
    }

    res.json({
      success: true,
      layout: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al obtener layout:', error);
    res.status(500).json({
      error: 'Error al obtener layout',
      details: error.message
    });
  }
});

/**
 * 📋 OBTENER TODOS LOS LAYOUTS DEL USUARIO
 *
 * @route GET /api/user/layouts
 * @query {user_id: number}
 */
router.get('/layouts', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id es requerido' });
  }

  try {
    const query = `
      SELECT * FROM app.user_layouts
      WHERE user_id = $1
      ORDER BY updated_at DESC;
    `;

    const result = await pool.query(query, [user_id]);

    res.json({
      success: true,
      layouts: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error al obtener layouts:', error);
    res.status(500).json({
      error: 'Error al obtener layouts',
      details: error.message
    });
  }
});

/**
 * 🗑️ ELIMINAR LAYOUT (RESET A DEFAULT)
 *
 * @route DELETE /api/user/layout/:layoutId
 * @query {user_id: number}
 */
router.delete('/layout/:layoutId', async (req, res) => {
  const { layoutId } = req.params;
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id es requerido' });
  }

  try {
    const query = `
      DELETE FROM app.user_layouts
      WHERE user_id = $1 AND layout_id = $2
      RETURNING *;
    `;

    const result = await pool.query(query, [user_id, layoutId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Layout no encontrado'
      });
    }

    console.log(`✅ Layout eliminado: ${layoutId} para usuario ${user_id}`);

    res.json({
      success: true,
      message: 'Layout eliminado correctamente (reseteado a default)',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al eliminar layout:', error);
    res.status(500).json({
      error: 'Error al eliminar layout',
      details: error.message
    });
  }
});

export default router;
