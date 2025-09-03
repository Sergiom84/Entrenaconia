import { pool } from './backend/db.js';

async function investigateHomeProblem() {
  try {
    // Ver datos específicos del plan más reciente
    const planDetail = await pool.query(`
      SELECT id, user_id, plan_data, equipment_type, training_type 
      FROM app.home_training_plans 
      WHERE id = 109
    `);

    console.log('=== PLAN 109 COMPLETO ===');
    if (planDetail.rows.length > 0) {
      const plan = planDetail.rows[0];
      console.log('ID:', plan.id);
      console.log('User ID:', plan.user_id);
      console.log('Equipment:', plan.equipment_type);
      console.log('Training:', plan.training_type);
      console.log('Plan data keys:', Object.keys(plan.plan_data || {}));
      
      if (plan.plan_data?.plan_entrenamiento?.ejercicios) {
        console.log('Número de ejercicios en el plan:', plan.plan_data.plan_entrenamiento.ejercicios.length);
        console.log('Primer ejercicio:', plan.plan_data.plan_entrenamiento.ejercicios[0]?.nombre);
      }
    }

    // Ver progreso de la sesión
    const sessionProgress = await pool.query(`
      SELECT exercise_order, exercise_name, status, series_completed, total_series
      FROM app.home_exercise_progress 
      WHERE home_training_session_id = 71
      ORDER BY exercise_order
    `);

    console.log('\n=== PROGRESO SESIÓN 71 ===');
    sessionProgress.rows.forEach(ex => {
      console.log(`- Ejercicio ${ex.exercise_order}: ${ex.exercise_name} (${ex.status}) - Series: ${ex.series_completed}/${ex.total_series}`);
    });

    // Verificar cuántas sesiones activas hay para el user_id 18
    const activeSessions = await pool.query(`
      SELECT COUNT(*) as active_count
      FROM app.home_training_sessions 
      WHERE user_id = 18 AND status = 'in_progress'
    `);
    
    console.log('\n=== SESIONES ACTIVAS USUARIO 18 ===');
    console.log('Sesiones activas:', activeSessions.rows[0]?.active_count);

    // Ver historial de plans del usuario 18
    const userPlans = await pool.query(`
      SELECT id, equipment_type, training_type, created_at
      FROM app.home_training_plans 
      WHERE user_id = 18
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log('\n=== PLANES DEL USUARIO 18 ===');
    userPlans.rows.forEach(plan => {
      console.log(`Plan ${plan.id}: ${plan.equipment_type}/${plan.training_type} - ${plan.created_at}`);
    });

  } catch (error) {
    console.error('Error investigating home problem:', error);
  } finally {
    process.exit(0);
  }
}

investigateHomeProblem();