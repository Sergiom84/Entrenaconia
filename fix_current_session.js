import { pool } from './backend/db.js';

async function fixCurrentSession() {
  try {
    const userId = 18; // Tu usuario
    
    console.log('🛠️ ARREGLANDO TU SESIÓN ACTUAL');
    console.log('==============================\n');

    // 1. Cerrar sesión activa problemática
    console.log('1. Cerrando sesión activa problemática...');
    const closeResult = await pool.query(`
      UPDATE app.home_training_sessions
      SET status = 'cancelled', 
          completed_at = NOW()
      WHERE user_id = $1 AND status = 'in_progress'
      RETURNING id, home_training_plan_id
    `, [userId]);
    
    if (closeResult.rows.length > 0) {
      closeResult.rows.forEach(session => {
        console.log(`✅ Cerrada sesión ${session.id} del plan ${session.home_training_plan_id}`);
      });
    } else {
      console.log('ℹ️ No había sesiones activas que cerrar');
    }

    // 2. Verificar estado actual
    console.log('\n2. Verificando estado actual...');
    const currentState = await pool.query(`
      SELECT COUNT(*) as active_sessions_count
      FROM app.home_training_sessions 
      WHERE user_id = $1 AND status = 'in_progress'
    `, [userId]);
    
    console.log(`✅ Sesiones activas ahora: ${currentState.rows[0].active_sessions_count}`);

    // 3. Mostrar plan más reciente
    console.log('\n3. Plan más reciente disponible:');
    const latestPlan = await pool.query(`
      SELECT id, equipment_type, training_type, created_at,
             (plan_data->>'plan_entrenamiento')::json->'ejercicios' as ejercicios_json
      FROM app.home_training_plans 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);
    
    if (latestPlan.rows.length > 0) {
      const plan = latestPlan.rows[0];
      const ejercicios = plan.ejercicios_json || [];
      console.log(`✅ Plan ${plan.id}: ${plan.equipment_type}/${plan.training_type}`);
      console.log(`   Creado: ${plan.created_at}`);
      console.log(`   Ejercicios: ${ejercicios.length}`);
      
      if (ejercicios.length > 0) {
        console.log('   Primer ejercicio:', ejercicios[0]?.nombre || 'sin nombre');
        console.log('   Último ejercicio:', ejercicios[ejercicios.length - 1]?.nombre || 'sin nombre');
      }
    }

    // 4. Mostrar rechazos activos
    console.log('\n4. Ejercicios rechazados activos:');
    const rejections = await pool.query(`
      SELECT exercise_name, rejection_category, rejected_at
      FROM app.home_exercise_rejections 
      WHERE user_id = $1 AND is_active = true
      ORDER BY rejected_at DESC
    `, [userId]);
    
    if (rejections.rows.length > 0) {
      rejections.rows.forEach(rej => {
        console.log(`   ❌ ${rej.exercise_name} (${rej.rejection_category})`);
      });
    } else {
      console.log('   ℹ️ No hay ejercicios rechazados');
    }

    console.log('\n✅ SESIÓN ARREGLADA - Ahora puedes usar Home Training sin conflictos');
    
  } catch (error) {
    console.error('❌ Error arreglando sesión:', error);
  } finally {
    process.exit(0);
  }
}

fixCurrentSession();