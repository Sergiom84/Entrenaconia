/**
 * 🔧 ENDPOINT ACTUALIZADO PARA SISTEMA UNIFICADO DE FEEDBACK
 *
 * Este archivo contiene el endpoint /rejections actualizado para usar
 * la nueva tabla user_exercise_feedback con methodology_type
 */

// Mapeo de categorías del modal a feedback_type
const REJECTION_CATEGORY_MAPPING = {
  'too_hard': 'too_difficult',
  'dont_like': 'dont_like',
  'injury': 'physical_limitation',
  'equipment': 'no_equipment',
  'other': 'change_focus'
};

// Endpoint actualizado para /rejections
const updatedRejectionsEndpoint = `
// Guardar ejercicios rechazados - VERSIÓN ACTUALIZADA PARA SISTEMA UNIFICADO
router.post('/rejections', authenticateToken, async (req, res) => {
  try {
    const { rejections } = req.body || {};
    const user_id = req.user.userId || req.user.id;

    if (!Array.isArray(rejections) || rejections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de ejercicios rechazados'
      });
    }

    console.log('🔄 USANDO SISTEMA UNIFICADO DE FEEDBACK');
    console.log(\`📊 Procesando \${rejections.length} rechazo(s) de ejercicios\`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertedFeedback = [];

      for (const raw of rejections) {
        // Normalizar datos del modal
        const exercise_name = String(raw?.exercise_name || '').trim().slice(0, 255) || 'Ejercicio';
        const exercise_key = (raw?.exercise_key && String(raw.exercise_key).trim()) || toExerciseKey(exercise_name);
        const equipment_type = normalizeEquipmentType(raw?.equipment_type);
        const training_type = normalizeTrainingType(raw?.training_type);
        const rejection_category = raw?.rejection_category || 'other';
        const rejection_reason = raw?.rejection_reason ? String(raw.rejection_reason).slice(0, 1000) : null;
        const expires_in_days = Number(raw?.expires_in_days) || null;

        // Mapear categoría del modal a feedback_type del sistema unificado
        const feedback_type = REJECTION_CATEGORY_MAPPING[rejection_category] || 'dont_like';

        // Calcular fecha de expiración
        let expiresAt = null;
        if (expires_in_days && expires_in_days > 0) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expires_in_days);
        }

        // Determinar methodology_type basado en training_type
        let methodology_type = 'home_training'; // Por defecto
        if (training_type?.toLowerCase().includes('calistenia')) {
          methodology_type = 'calistenia';
        } else if (training_type?.toLowerCase().includes('hipertrofia')) {
          methodology_type = 'hipertrofia';
        }

        console.log(\`📝 Guardando feedback: \${exercise_name} - \${feedback_type} (\${methodology_type})\`);

        // Verificar si ya existe feedback para este ejercicio
        const existingResult = await client.query(
          \`SELECT id FROM app.user_exercise_feedback
           WHERE user_id = $1 AND exercise_name = $2
           AND methodology_type = $3
           AND (expires_at IS NULL OR expires_at > NOW())\`,
          [user_id, exercise_name, methodology_type]
        );

        if (existingResult.rows.length > 0) {
          // Actualizar feedback existente
          const updateResult = await client.query(
            \`UPDATE app.user_exercise_feedback
             SET feedback_type = $1,
                 comment = $2,
                 avoidance_duration_days = $3,
                 expires_at = $4,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *\`,
            [feedback_type, rejection_reason, expires_in_days, expiresAt, existingResult.rows[0].id]
          );
          insertedFeedback.push(updateResult.rows[0]);
          console.log(\`✏️  Feedback actualizado para: \${exercise_name}\`);
        } else {
          // Crear nuevo feedback usando el sistema unificado
          const insertResult = await client.query(
            \`INSERT INTO app.user_exercise_feedback
             (user_id, exercise_name, exercise_key, methodology_type, feedback_type,
              comment, avoidance_duration_days, expires_at, ai_weight, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1.0, NOW())
             RETURNING *\`,
            [user_id, exercise_name, exercise_key, methodology_type, feedback_type,
             rejection_reason, expires_in_days, expiresAt]
          );
          insertedFeedback.push(insertResult.rows[0]);
          console.log(\`✅ Nuevo feedback creado para: \${exercise_name}\`);
        }
      }

      await client.query('COMMIT');

      console.log(\`🎉 Procesamiento completo: \${insertedFeedback.length} registros\`);

      res.json({
        success: true,
        message: \`\${insertedFeedback.length} ejercicio\${insertedFeedback.length !== 1 ? 's' : ''} marcado\${insertedFeedback.length !== 1 ? 's' : ''} como rechazado\${insertedFeedback.length !== 1 ? 's' : ''}\`,
        feedback: insertedFeedback,
        system: 'unified_feedback' // Identificador del nuevo sistema
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error dentro de transacción /rejections (unified):', err);
      return res.status(500).json({
        success: false,
        message: 'Error al guardar las preferencias de ejercicios',
        details: err.message,
        system: 'unified_feedback'
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error saving exercise feedback (unified system):', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar las preferencias de ejercicios'
    });
  }
});
`;

module.exports = {
  updatedRejectionsEndpoint,
  REJECTION_CATEGORY_MAPPING
};