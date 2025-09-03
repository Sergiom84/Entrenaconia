import { pool } from './backend/db.js';

async function investigateSession73() {
  console.log('🔍 INVESTIGANDO SESIÓN 73');
  console.log('========================');
  
  try {
    // 1. Estado de la sesión
    const session = await pool.query(`
      SELECT id, user_id, status, started_at, completed_at, 
             total_exercises, exercises_completed, progress_percentage
      FROM app.home_training_sessions 
      WHERE id = 73
    `);
    
    if (session.rows.length > 0) {
      const s = session.rows[0];
      console.log('📋 SESIÓN 73:');
      console.log(`   Estado: ${s.status}`);
      console.log(`   Progreso: ${s.exercises_completed}/${s.total_exercises} (${s.progress_percentage}%)`);
      console.log(`   Iniciada: ${s.started_at}`);
      console.log(`   Completada: ${s.completed_at || 'No'}`);
    } else {
      console.log('❌ Sesión 73 no encontrada');
      process.exit(0);
    }
    
    // 2. Progreso individual de ejercicios
    console.log('\n🏋️ PROGRESO DE EJERCICIOS:');
    const progress = await pool.query(`
      SELECT exercise_order, exercise_name, status, series_completed, total_series,
             duration_seconds, started_at, completed_at
      FROM app.home_exercise_progress 
      WHERE home_training_session_id = 73
      ORDER BY exercise_order
    `);
    
    progress.rows.forEach((ex, idx) => {
      console.log(`   ${ex.exercise_order + 1}. ${ex.exercise_name}:`);
      console.log(`       Estado: ${ex.status}`);
      console.log(`       Series: ${ex.series_completed}/${ex.total_series}`);
      console.log(`       Duración: ${ex.duration_seconds || 'N/A'} seg`);
      console.log(`       Iniciado: ${ex.started_at || 'No'}`);
      console.log(`       Completado: ${ex.completed_at || 'No'}`);
      console.log('');
    });
    
    // 3. Verificar inconsistencias
    console.log('⚠️ ANÁLISIS DE INCONSISTENCIAS:');
    const completedCount = progress.rows.filter(ex => ex.status === 'completed').length;
    const inProgressCount = progress.rows.filter(ex => ex.status === 'in_progress').length;
    const expectedPercentage = progress.rows.length > 0 ? Math.round((completedCount / progress.rows.length) * 100) : 0;
    
    console.log(`   Total ejercicios: ${progress.rows.length}`);
    console.log(`   Completados: ${completedCount}`);
    console.log(`   En progreso: ${inProgressCount}`);
    console.log(`   Porcentaje calculado: ${expectedPercentage}%`);
    console.log(`   Porcentaje en DB: ${session.rows[0]?.progress_percentage}%`);
    
    if (expectedPercentage !== session.rows[0]?.progress_percentage) {
      console.log('   ❌ INCONSISTENCIA DETECTADA');
    }
    
    // 4. Mostrar ejercicios problemáticos
    console.log('\n🚨 EJERCICIOS PROBLEMÁTICOS:');
    progress.rows.forEach((ex, idx) => {
      if (ex.status === 'completed' && ex.series_completed === 0) {
        console.log(`   ❌ ${ex.exercise_name}: Marcado como completado pero 0 series`);
      }
      if (ex.status === 'in_progress' && ex.series_completed === ex.total_series) {
        console.log(`   ⚠️ ${ex.exercise_name}: En progreso pero todas las series completadas`);
      }
      if (ex.status === 'completed' && !ex.completed_at) {
        console.log(`   ❌ ${ex.exercise_name}: Completado pero sin timestamp`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

investigateSession73();