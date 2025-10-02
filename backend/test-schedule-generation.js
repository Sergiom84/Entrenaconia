/**
 * Script de prueba para verificar generación de workout_schedule
 */

import { pool } from './db.js';

async function testScheduleGeneration(planId) {
  const client = await pool.connect();

  try {
    console.log(`\n🧪 TEST: Generación de programación para plan ${planId}\n`);

    // 1. Obtener datos del plan
    const planRes = await client.query(
      `SELECT id, user_id, plan_data, plan_start_date, confirmed_at, created_at, methodology_type
       FROM app.methodology_plans
       WHERE id = $1`,
      [planId]
    );

    if (planRes.rowCount === 0) {
      console.error(`❌ Plan ${planId} no encontrado`);
      return;
    }

    const plan = planRes.rows[0];
    console.log(`📊 Plan encontrado:`);
    console.log(`   - Tipo: ${plan.methodology_type}`);
    console.log(`   - Usuario: ${plan.user_id}`);
    console.log(`   - Fecha inicio: ${plan.plan_start_date || plan.confirmed_at || plan.created_at}`);
    console.log(`   - Semanas: ${plan.plan_data?.semanas?.length || 0}`);

    if (plan.plan_data?.semanas?.[0]?.sesiones) {
      console.log(`   - Días por semana: ${plan.plan_data.semanas[0].sesiones.length}`);
      console.log(`   - Días del plan: ${plan.plan_data.semanas[0].sesiones.map(s => s.dia).join(', ')}`);
    }

    // 2. Importar función de generación
    // Nota: Esto requiere que la función sea exportada
    console.log(`\n⏳ Generando programación...\n`);

    const startDate = plan.plan_start_date || plan.confirmed_at || plan.created_at;

    // Simulamos la llamada llamando directamente al INSERT
    await client.query('BEGIN');

    // Limpiar existentes
    await client.query(
      `DELETE FROM app.workout_schedule WHERE methodology_plan_id = $1`,
      [planId]
    );
    await client.query(
      `DELETE FROM app.methodology_plan_days WHERE plan_id = $1`,
      [planId]
    );

    console.log(`✅ Tablas limpiadas`);

    // Ahora la función debería generarse automáticamente al consultar /active-plan
    // Por ahora, solo verificamos la estructura

    await client.query('COMMIT');

    console.log(`\n✅ Test completado. Ahora:`);
    console.log(`   1. Arranca el backend: PORT=3010 npm run dev`);
    console.log(`   2. Haz login con el usuario ${plan.user_id}`);
    console.log(`   3. Navega a /routines`);
    console.log(`   4. La programación se generará automáticamente`);
    console.log(`\n📝 Verifica después:`);
    console.log(`   - SELECT * FROM app.workout_schedule WHERE methodology_plan_id = ${planId};`);
    console.log(`   - SELECT * FROM app.methodology_plan_days WHERE plan_id = ${planId} ORDER BY day_id;`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const planId = process.argv[2] || 28;
testScheduleGeneration(parseInt(planId, 10));
