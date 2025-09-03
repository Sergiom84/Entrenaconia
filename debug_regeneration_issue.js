import { pool } from './backend/db.js';

async function debugRegenerationIssue() {
  try {
    const userId = 18; // Tu usuario
    
    console.log('🔍 INVESTIGANDO PROBLEMA DE REGENERACIÓN');
    console.log('=======================================\n');

    // 1. Verificar estado actual de sesiones
    console.log('1. SESIONES ACTIVAS:');
    const activeSessions = await pool.query(`
      SELECT id, home_training_plan_id, status, started_at, completed_at 
      FROM app.home_training_sessions 
      WHERE user_id = $1 
      ORDER BY started_at DESC 
      LIMIT 5
    `, [userId]);
    
    activeSessions.rows.forEach(session => {
      console.log(`   Sesión ${session.id}: Plan ${session.home_training_plan_id} - ${session.status} (${session.started_at})`);
    });

    // 2. Verificar planes más recientes
    console.log('\n2. PLANES RECIENTES:');
    const recentPlans = await pool.query(`
      SELECT id, equipment_type, training_type, created_at,
             LENGTH(plan_data::text) as plan_size
      FROM app.home_training_plans 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [userId]);
    
    recentPlans.rows.forEach(plan => {
      console.log(`   Plan ${plan.id}: ${plan.equipment_type}/${plan.training_type} - ${plan.created_at} (${plan.plan_size} chars)`);
    });

    // 3. Verificar ejercicios rechazados
    console.log('\n3. EJERCICIOS RECHAZADOS:');
    const rejections = await pool.query(`
      SELECT exercise_name, rejection_category, rejected_at, expires_at
      FROM app.home_exercise_rejections 
      WHERE user_id = $1 AND is_active = true
      ORDER BY rejected_at DESC
    `, [userId]);
    
    if (rejections.rows.length > 0) {
      rejections.rows.forEach(rej => {
        console.log(`   - ${rej.exercise_name} (${rej.rejection_category}) - ${rej.rejected_at}`);
      });
    } else {
      console.log('   No hay ejercicios rechazados activos');
    }

    // 4. Verificar progreso de ejercicios en sesión más reciente
    console.log('\n4. PROGRESO DE ÚLTIMA SESIÓN:');
    if (activeSessions.rows.length > 0) {
      const latestSessionId = activeSessions.rows[0].id;
      const sessionProgress = await pool.query(`
        SELECT exercise_order, exercise_name, status, series_completed, total_series
        FROM app.home_exercise_progress 
        WHERE home_training_session_id = $1
        ORDER BY exercise_order
      `, [latestSessionId]);
      
      sessionProgress.rows.forEach(ex => {
        console.log(`   ${ex.exercise_order}: ${ex.exercise_name} (${ex.status}) - ${ex.series_completed}/${ex.total_series}`);
      });
    }

    // 5. Verificar si hay múltiples sesiones activas
    console.log('\n5. VERIFICANDO SESIONES MÚLTIPLES:');
    const multipleActiveSessions = await pool.query(`
      SELECT COUNT(*) as active_count, 
             array_agg(id) as session_ids,
             array_agg(home_training_plan_id) as plan_ids
      FROM app.home_training_sessions 
      WHERE user_id = $1 AND status = 'in_progress'
    `, [userId]);
    
    const activeCount = multipleActiveSessions.rows[0]?.active_count || 0;
    console.log(`   Sesiones "in_progress": ${activeCount}`);
    if (activeCount > 0) {
      console.log(`   IDs: ${multipleActiveSessions.rows[0].session_ids}`);
      console.log(`   Plan IDs: ${multipleActiveSessions.rows[0].plan_ids}`);
    }

  } catch (error) {
    console.error('❌ Error investigando problema:', error);
  } finally {
    process.exit(0);
  }
}

debugRegenerationIssue();