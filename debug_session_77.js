import { pool } from './backend/db.js';

async function debugSession77() {
  console.log('🔍 DEBUGGEANDO SESIÓN 77');
  console.log('========================');
  
  try {
    // 1. Estado de la sesión 77
    const session = await pool.query(`
      SELECT id, user_id, status, started_at, completed_at, 
             total_exercises, exercises_completed, progress_percentage
      FROM app.home_training_sessions 
      WHERE id = 77
    `);
    
    console.log('📋 SESIÓN 77:');
    if (session.rows.length > 0) {
      const s = session.rows[0];
      console.log(`   Estado: ${s.status}`);
      console.log(`   Progreso: ${s.exercises_completed}/${s.total_exercises} (${s.progress_percentage}%)`);
      console.log(`   Iniciada: ${s.started_at}`);
      console.log(`   Completada: ${s.completed_at || 'No'}`);
    }
    
    // 2. Progreso individual de ejercicios
    console.log('\n🏋️ PROGRESO DE EJERCICIOS:');
    const progress = await pool.query(`
      SELECT exercise_order, exercise_name, status, series_completed, total_series,
             duration_seconds, started_at, completed_at
      FROM app.home_exercise_progress 
      WHERE home_training_session_id = 77
      ORDER BY exercise_order
    `);
    
    progress.rows.forEach((ex, idx) => {
      console.log(`   ${ex.exercise_order}. ${ex.exercise_name}:`);
      console.log(`       Estado: ${ex.status}`);
      console.log(`       Series: ${ex.series_completed}/${ex.total_series}`);
      console.log(`       Duración: ${ex.duration_seconds || 'N/A'} seg`);
      console.log('');
    });
    
    // 3. Simular exactamente lo que devuelve el endpoint /sessions/77/progress
    console.log('\n📡 SIMULACIÓN DEL ENDPOINT /sessions/77/progress:');
    const endpointSimulation = await pool.query(`
      SELECT 
        s.id as session_id,
        s.status as session_status,
        s.progress_percentage,
        s.exercises_completed,
        s.total_exercises,
        json_agg(
          json_build_object(
            'exercise_order', p.exercise_order,
            'exercise_name', p.exercise_name,
            'status', p.status,
            'series_completed', p.series_completed,
            'total_series', p.total_series,
            'duration_seconds', p.duration_seconds
          ) ORDER BY p.exercise_order
        ) as exercises
      FROM app.home_training_sessions s
      LEFT JOIN app.home_exercise_progress p ON s.id = p.home_training_session_id
      WHERE s.id = 77
      GROUP BY s.id, s.status, s.progress_percentage, s.exercises_completed, s.total_exercises
    `);
    
    const result = endpointSimulation.rows[0];
    console.log('📊 Lo que devuelve el endpoint:');
    console.log('   session:', {
      id: result.session_id,
      status: result.session_status,
      progress: `${result.exercises_completed}/${result.total_exercises} (${result.progress_percentage}%)`
    });
    console.log('   exercises:');
    result.exercises.forEach((ex, idx) => {
      console.log(`     [${idx}] order:${ex.exercise_order} ${ex.exercise_name} - ${ex.status} (${ex.series_completed}/${ex.total_series})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

debugSession77();