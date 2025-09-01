import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/equipment/catalog
router.get('/catalog', authenticateToken, async (_req, res) => {
  try {
    // Si existe la vista app.equipment_catalog (code,name,level,icon) úsala.
    // Si no, caemos a la tabla legacy equipment_items (key,label,level)
    let rows = [];
    try {
      const r1 = await pool.query(`SELECT code, name, level, icon FROM app.equipment_catalog ORDER BY level, name`);
      rows = r1.rows;
    } catch {
      const r2 = await pool.query(`SELECT key AS code, label AS name, level FROM app.equipment_items ORDER BY level, label`);
      rows = r2.rows;
    }
    res.json({ success: true, catalog: rows });
  } catch (e) {
    console.error('equipment.catalog error:', e);
    res.status(500).json({ success: false, error: 'Error obteniendo catálogo' });
  }
});

// GET /api/equipment/user => curated + custom
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const curatedRes = await pool.query(
      `SELECT
         COALESCE(ei.key, ei2.key, ec.code)   AS key,
         COALESCE(ei.label, ei2.label, ec.name) AS label,
         COALESCE(ei.level, ei2.level, NULL)  AS level
       FROM app.user_equipment ue
       LEFT JOIN app.equipment_items ei   ON ei.key = ue.equipment_key::text
       LEFT JOIN app.equipment_items ei2  ON ei2.key = ue.equipment_id::text -- fallback si la columna es equipment_id
       LEFT JOIN app.equipment_catalog ec ON ec.id = ue.equipment_id
       WHERE ue.user_id = $1
       ORDER BY 2`,
      [userId]
    );
    const customRes = await pool.query(
      `SELECT id, name, created_at FROM app.user_custom_equipment WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, curated: curatedRes.rows, custom: customRes.rows });
  } catch (e) {
    console.error('equipment.user error:', e);
    res.status(500).json({ success: false, error: 'Error obteniendo equipamiento del usuario' });
  }
});

// POST /api/equipment/user { equipment_key }
router.post('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { equipment_key } = req.body || {};
    if (!equipment_key) return res.status(400).json({ success: false, error: 'equipment_key requerido' });

    // ¿Existe equipment_id y es NOT NULL?
    const meta = await pool.query(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema='app' AND table_name='user_equipment' AND column_name='equipment_id'`
    );
    const needsId = meta.rows[0]?.is_nullable === 'NO';

    let equipmentId = null;
    if (needsId) {
      // Intentar mapear via app.equipment_catalog (code -> id)
      try {
        const r = await pool.query(
          `SELECT id FROM app.equipment_catalog WHERE code = $1 LIMIT 1`,
          [equipment_key]
        );
        equipmentId = r.rows[0]?.id ?? null; // si no existe, dejamos null
      } catch {
        equipmentId = null; // si no existe la tabla/vista
      }
    }

    if (needsId && equipmentId == null) {
      return res.status(409).json({ success: false, error: `Falta mapping en app.equipment_catalog para code='${equipment_key}'. O bien relaja NOT NULL en app.user_equipment.equipment_id o añade ese code a equipment_catalog.` });
    }

    if (needsId) {
      await pool.query(
        `INSERT INTO app.user_equipment (user_id, equipment_key, equipment_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, equipment_key, equipmentId]
      );
    } else {
      await pool.query(
        `INSERT INTO app.user_equipment (user_id, equipment_key)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, equipment_key]
      );
    }

    res.json({ success: true });
  } catch (e) {
    console.error('equipment.add error:', e);
    res.status(500).json({ success: false, error: 'Error añadiendo equipamiento' });
  }
});

// DELETE /api/equipment/user/:key
router.delete('/user/:key', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { key } = req.params;
    await pool.query(
      `DELETE FROM app.user_equipment WHERE user_id = $1 AND equipment_key = $2`,
      [userId, key]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('equipment.remove error:', e);
    res.status(500).json({ success: false, error: 'Error eliminando equipamiento' });
  }
});

// POST /api/equipment/custom { name, note? }
router.post('/custom', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name requerido' });

    const { rows } = await pool.query(
      `INSERT INTO app.user_custom_equipment (user_id, name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO NOTHING
       RETURNING id, name, created_at`,
      [userId, name.trim()]
    );
    res.json({ success: true, item: rows[0] || null });
  } catch (e) {
    console.error('equipment.custom.add error:', e);
    res.status(500).json({ success: false, error: 'Error añadiendo equipamiento personalizado' });
  }
});

// DELETE /api/equipment/custom/:id
router.delete('/custom/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM app.user_custom_equipment WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('equipment.custom.remove error:', e);
    res.status(500).json({ success: false, error: 'Error eliminando equipamiento personalizado' });
  }
});

export default router;

