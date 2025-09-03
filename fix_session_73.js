import { pool } from './backend/db.js';

async function fixSession73() {
  console.log('🛠️ REPARANDO SESIÓN 73');
  console.log('=====================');
  
  try {
    // 1. Mostrar estado actual
    console.log('📊 Estado actual:');
    const currentState = await pool.query(`
      SELECT exercise_order, exercise_name, status, series_completed, total_series
      FROM app.home_exercise_progress 
      WHERE home_training_session_id = 73
      ORDER BY exercise_order
    `);
    
    currentState.rows.forEach((ex, idx) => {
      console.log(`   ${ex.exercise_order + 1}. ${ex.exercise_name}: ${ex.status} (${ex.series_completed}/${ex.total_series})`);
    });
    
    // 2. Resetear todos los ejercicios a pending
    console.log('\n🔄 Reseteando ejercicios a estado inicial...');
    await pool.query(`
      UPDATE app.home_exercise_progress
      SET 
        status = 'pending',
        series_completed = 0,
        duration_seconds = NULL,
        completed_at = NULL
      WHERE home_training_session_id = 73
    `);
    
    // 3. Resetear la sesión
    console.log('🔄 Reseteando sesión...');
    await pool.query(`
      UPDATE app.home_training_sessions
      SET 
        exercises_completed = 0,
        progress_percentage = 0,
        total_duration_seconds = 0,
        completed_at = NULL,
        status = 'in_progress'
      WHERE id = 73
    `);
    
    // 4. Verificar resultado
    console.log('\n✅ Estado tras reparación:');
    const newState = await pool.query(`
      SELECT exercise_order, exercise_name, status, series_completed, total_series
      FROM app.home_exercise_progress 
      WHERE home_training_session_id = 73
      ORDER BY exercise_order
    `);
    
    newState.rows.forEach((ex, idx) => {
      console.log(`   ${ex.exercise_order + 1}. ${ex.exercise_name}: ${ex.status} (${ex.series_completed}/${ex.total_series})`);
    });
    
    console.log('\n🎯 Sesión 73 lista para prueba limpia');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixSession73();