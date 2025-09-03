import { pool } from './backend/db.js';

async function debugSessionFlow() {
  try {
    const sessionId = 72;
    const userId = 18;
    
    console.log('🕵️ INVESTIGANDO SESIÓN 72');
    console.log('==========================\n');

    // 1. Información básica de la sesión
    console.log('1. INFORMACIÓN DE LA SESIÓN:');
    const sessionInfo = await pool.query(`
      SELECT id, user_id, home_training_plan_id, status, started_at, completed_at,
             total_exercises, exercises_completed, progress_percentage
      FROM app.home_training_sessions 
      WHERE id = $1
    `, [sessionId]);
    
    if (sessionInfo.rows.length > 0) {
      const session = sessionInfo.rows[0];
      console.log(`   📋 Sesión ${session.id}:`);
      console.log(`       - Plan ID: ${session.home_training_plan_id}`);
      console.log(`       - Estado: ${session.status}`);
      console.log(`       - Inicio: ${session.started_at}`);
      console.log(`       - Fin: ${session.completed_at || 'No completada'}`);
      console.log(`       - Progreso: ${session.exercises_completed}/${session.total_exercises} (${session.progress_percentage}%)`);
    } else {
      console.log('   ❌ Sesión no encontrada');
      process.exit(0);
    }

    // 2. Progreso detallado de ejercicios
    console.log('\n2. PROGRESO DE EJERCICIOS:');
    const exerciseProgress = await pool.query(`
      SELECT exercise_order, exercise_name, status, series_completed, total_series,
             duration_seconds, started_at, completed_at
      FROM app.home_exercise_progress 
      WHERE home_training_session_id = $1
      ORDER BY exercise_order
    `, [sessionId]);
    
    exerciseProgress.rows.forEach((ex, index) => {
      const orderNum = ex.exercise_order + 1; // Para mostrar 1-indexed
      console.log(`   ${orderNum}. ${ex.exercise_name}:`);
      console.log(`       - Estado: ${ex.status}`);
      console.log(`       - Series: ${ex.series_completed}/${ex.total_series}`);
      console.log(`       - Duración: ${ex.duration_seconds || 'N/A'} segundos`);
      console.log(`       - Iniciado: ${ex.started_at || 'No iniciado'}`);
      console.log(`       - Completado: ${ex.completed_at || 'No completado'}`);
      console.log('');
    });

    // 3. Historial de actualizaciones (si existe log)
    console.log('3. ANÁLISIS DEL COMPORTAMIENTO:');
    
    const completedExercises = exerciseProgress.rows.filter(ex => ex.status === 'completed');
    const skippedExercises = exerciseProgress.rows.filter(ex => ex.status === 'skipped');
    const cancelledExercises = exerciseProgress.rows.filter(ex => ex.status === 'cancelled');
    const inProgressExercises = exerciseProgress.rows.filter(ex => ex.status === 'in_progress');
    
    console.log(`   ✅ Completados: ${completedExercises.length}`);
    completedExercises.forEach(ex => console.log(`       - ${ex.exercise_name} (${ex.series_completed}/${ex.total_series} series)`));
    
    console.log(`   ⏭️ Saltados: ${skippedExercises.length}`);
    skippedExercises.forEach(ex => console.log(`       - ${ex.exercise_name}`));
    
    console.log(`   ❌ Cancelados: ${cancelledExercises.length}`);
    cancelledExercises.forEach(ex => console.log(`       - ${ex.exercise_name}`));
    
    console.log(`   🔄 En progreso: ${inProgressExercises.length}`);
    inProgressExercises.forEach(ex => console.log(`       - ${ex.exercise_name} (${ex.series_completed}/${ex.total_series} series)`));

    // 4. Verificar el estado de la sesión calculado
    console.log('\n4. CÁLCULO DE ESTADO:');
    const totalExercises = exerciseProgress.rows.length;
    const actualCompleted = completedExercises.length;
    const calculatedPercentage = totalExercises > 0 ? Math.round((actualCompleted / totalExercises) * 100) : 0;
    
    console.log(`   📊 Total ejercicios: ${totalExercises}`);
    console.log(`   ✅ Realmente completados: ${actualCompleted}`);
    console.log(`   📈 Porcentaje calculado: ${calculatedPercentage}%`);
    console.log(`   📈 Porcentaje en DB: ${sessionInfo.rows[0].progress_percentage}%`);
    
    if (calculatedPercentage !== parseFloat(sessionInfo.rows[0].progress_percentage)) {
      console.log('   ⚠️ INCONSISTENCIA: Los porcentajes no coinciden');
    }

    // 5. Verificar datos del plan original
    console.log('\n5. PLAN ORIGINAL:');
    const planInfo = await pool.query(`
      SELECT id, plan_data
      FROM app.home_training_plans 
      WHERE id = $1
    `, [sessionInfo.rows[0].home_training_plan_id]);
    
    if (planInfo.rows.length > 0) {
      const plan = planInfo.rows[0];
      const ejercicios = plan.plan_data?.plan_entrenamiento?.ejercicios || [];
      console.log(`   📋 Plan ${plan.id} tiene ${ejercicios.length} ejercicios:`);
      ejercicios.forEach((ej, idx) => {
        console.log(`       ${idx + 1}. ${ej.nombre} (${ej.series} series)`);
      });
    }

    console.log('\n🔍 ANÁLISIS COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error investigando sesión:', error);
  } finally {
    process.exit(0);
  }
}

debugSessionFlow();