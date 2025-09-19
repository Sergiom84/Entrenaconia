/**
 * Crear función faltante cleanup_expired_training_sessions
 */

import dotenv from 'dotenv';
import { pool } from './backend/db.js';

console.log(`🔌 Usando pool de PostgreSQL existente...`);

try {
  const client = await pool.connect();
  console.log('✅ Conexión exitosa');

  // Crear función de limpieza
  const cleanupFunctionSQL = `
    CREATE OR REPLACE FUNCTION cleanup_expired_training_sessions()
    RETURNS INTEGER AS $$
    DECLARE
        cleaned_count INTEGER;
    BEGIN
        -- Cancelar sesiones "in_progress" abandonadas por más de 24 horas
        UPDATE methodology_exercise_sessions
        SET session_status = 'cancelled',
            cancelled_at = NOW(),
            is_current_session = false
        WHERE session_status = 'in_progress'
            AND started_at < NOW() - INTERVAL '24 hours';

        GET DIAGNOSTICS cleaned_count = ROW_COUNT;

        -- Limpiar estados de usuario para sesiones canceladas
        UPDATE user_training_state
        SET active_session_id = NULL,
            is_training = false,
            session_started_at = NULL,
            session_paused_at = NULL
        WHERE active_session_id IN (
            SELECT id FROM methodology_exercise_sessions
            WHERE session_status = 'cancelled'
        );

        RETURN cleaned_count;
    END;
    $$ LANGUAGE plpgsql;
  `;

  await client.query(cleanupFunctionSQL);
  console.log('✅ Función cleanup_expired_training_sessions creada');

  // Verificar que funciona
  const testResult = await client.query('SELECT cleanup_expired_training_sessions()');
  console.log(`✅ Función funciona correctamente, retornó: ${testResult.rows[0].cleanup_expired_training_sessions}`);

  client.release();

  console.log('🎉 Función creada exitosamente');

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}