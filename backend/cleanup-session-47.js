/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';

async function cleanupSession() {
  try {
    console.log('🧹 Limpiando sesión 47...\n');

    // Eliminar progreso de ejercicios
    const progressResult = await pool.query(
      'DELETE FROM app.methodology_exercise_progress WHERE methodology_session_id = 47'
    );
    console.log(`✅ Eliminados ${progressResult.rowCount} registros de progreso`);

    // Eliminar sesión
    const sessionResult = await pool.query(
      'DELETE FROM app.methodology_exercise_sessions WHERE id = 47'
    );
    console.log(`✅ Eliminada ${sessionResult.rowCount} sesión`);

    console.log('\n✅ Limpieza completada. Ahora puedes iniciar una nueva sesión.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupSession();
