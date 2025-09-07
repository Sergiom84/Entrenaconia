import express from 'express';
import { pool } from '../db.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();

// Obtener perfil de usuario
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el usuario solo pueda acceder a su propio perfil
    if (req.user.userId !== parseInt(id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      `SELECT 
        u.id, u.nombre, u.apellido, u.email, u.created_at,
        u.edad, u.sexo, u.peso, u.altura,
        u.nivel_entrenamiento, u.anos_entrenando, u.frecuencia_semanal,
        u.nivel_actividad, u.cintura, u.pecho, u.brazos,
        u.muslos, u.cuello, u.antebrazos, u.historial_medico, 
        u.alergias, u.medicamentos, u.meta_peso, u.meta_grasa,
        u.fecha_inicio_objetivo, u.fecha_meta_objetivo, u.notas_progreso,
        u.meta_grasa_corporal, u.enfoque_entrenamiento, u.horario_preferido,
        u.comidas_por_dia, u.suplementacion, u.alimentos_excluidos,
        u.grasa_corporal, u.masa_muscular, u.agua_corporal, u.metabolismo_basal,
        u.cadera,
        p.metodologia_preferida, p.limitaciones_fisicas, p.objetivo_principal
      FROM app.users u
      LEFT JOIN app.user_profiles p ON u.id = p.user_id
      WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar perfil de usuario
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el usuario solo pueda actualizar su propio perfil
    if (req.user.userId !== parseInt(id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Campos que se pueden actualizar
    const allowedFields = [
      'nombre', 'apellido', 'edad', 'sexo', 'peso', 'altura',
      'nivel_entrenamiento', 'anos_entrenando', 'frecuencia_semanal',
      'metodologia_preferida', 'nivel_actividad', 'cintura', 'pecho', 'brazos',
      'muslos', 'cuello', 'antebrazos', 'historial_medico', 'limitaciones_fisicas',
      'alergias', 'medicamentos', 'objetivo_principal', 'meta_peso', 'meta_grasa',
      'fecha_inicio_objetivo', 'fecha_meta_objetivo', 'notas_progreso',
      'meta_grasa_corporal', 'enfoque_entrenamiento', 'horario_preferido',
      'comidas_por_dia', 'suplementacion', 'alimentos_excluidos',
      'grasa_corporal', 'masa_muscular', 'agua_corporal', 'metabolismo_basal', 'cadera'
    ];

    // Construir query dinámicamente
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id); // ID para el WHERE

    const query = `
      UPDATE app.users
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, nombre, apellido, email
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
