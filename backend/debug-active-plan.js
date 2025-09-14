// Script de diagnóstico para el problema de active-plan
import { pool } from './db.js';

async function debugActivePlan() {
  const client = await pool.connect();

  try {
    console.log('=== DIAGNÓSTICO DE ACTIVE-PLAN ===\n');

    // 1. Verificar todos los planes de metodología
    const allPlansQuery = await client.query(`
      SELECT
        id,
        user_id,
        status,
        methodology_type,
        confirmed_at,
        created_at,
        updated_at
      FROM app.methodology_plans
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('📊 Últimos 10 planes de metodología:');
    console.table(allPlansQuery.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      type: row.methodology_type,
      confirmed: row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString() : 'No',
      created: new Date(row.created_at).toLocaleDateString()
    })));

    // 2. Verificar planes activos
    const activePlansQuery = await client.query(`
      SELECT
        id,
        user_id,
        status,
        methodology_type,
        confirmed_at
      FROM app.methodology_plans
      WHERE status = 'active'
    `);

    console.log(`\n✅ Planes con status 'active': ${activePlansQuery.rowCount}`);
    if (activePlansQuery.rowCount > 0) {
      console.table(activePlansQuery.rows);
    }

    // 3. Verificar sesiones completadas recientemente
    const recentSessionsQuery = await client.query(`
      SELECT
        mes.id as session_id,
        mes.user_id,
        mes.methodology_plan_id,
        mes.session_status,
        mes.completed_at,
        mp.status as plan_status,
        mp.methodology_type
      FROM app.methodology_exercise_sessions mes
      JOIN app.methodology_plans mp ON mp.id = mes.methodology_plan_id
      WHERE mes.completed_at IS NOT NULL
      ORDER BY mes.completed_at DESC
      LIMIT 10
    `);

    console.log('\n🏋️ Últimas 10 sesiones completadas:');
    console.table(recentSessionsQuery.rows.map(row => ({
      session_id: row.session_id,
      user_id: row.user_id,
      plan_id: row.methodology_plan_id,
      session_status: row.session_status,
      plan_status: row.plan_status,
      completed: row.completed_at ? new Date(row.completed_at).toLocaleDateString() : 'No'
    })));

    // 4. Verificar si hay planes que deberían estar activos pero no lo están
    const shouldBeActiveQuery = await client.query(`
      SELECT
        mp.id,
        mp.user_id,
        mp.status,
        mp.confirmed_at,
        COUNT(DISTINCT mes.id) as total_sessions,
        COUNT(DISTINCT CASE WHEN mes.session_status = 'completed' THEN mes.id END) as completed_sessions,
        MAX(mes.completed_at) as last_session_completed
      FROM app.methodology_plans mp
      LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
      WHERE mp.confirmed_at IS NOT NULL
      GROUP BY mp.id
      HAVING COUNT(DISTINCT mes.id) > 0
      ORDER BY MAX(mes.completed_at) DESC NULLS LAST
      LIMIT 10
    `);

    console.log('\n📈 Planes con sesiones (deberían estar activos si no están todas completadas):');
    console.table(shouldBeActiveQuery.rows.map(row => ({
      plan_id: row.id,
      user_id: row.user_id,
      status: row.status,
      confirmed: row.confirmed_at ? 'Sí' : 'No',
      total_sessions: row.total_sessions,
      completed: row.completed_sessions,
      last_completed: row.last_session_completed ? new Date(row.last_session_completed).toLocaleDateString() : 'Nunca'
    })));

    // 5. Verificar función activate_plan_atomic
    const functionCheckQuery = await client.query(`
      SELECT
        routine_name,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'app'
        AND routine_name = 'activate_plan_atomic'
    `);

    console.log(`\n🔧 Función activate_plan_atomic existe: ${functionCheckQuery.rowCount > 0 ? 'SÍ' : 'NO'}`);

    // 6. Verificar si hay problemas de concurrencia (múltiples planes activos por usuario)
    const multipleActiveQuery = await client.query(`
      SELECT
        user_id,
        COUNT(*) as active_plans_count,
        array_agg(id) as plan_ids
      FROM app.methodology_plans
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);

    if (multipleActiveQuery.rowCount > 0) {
      console.log('\n⚠️ PROBLEMA: Usuarios con múltiples planes activos:');
      console.table(multipleActiveQuery.rows);
    } else {
      console.log('\n✅ No hay usuarios con múltiples planes activos');
    }

    // 7. Buscar el plan específico del problema reportado
    console.log('\n🔍 Buscando planes recientes que podrían tener el problema...');
    const problemPlansQuery = await client.query(`
      SELECT
        mp.id,
        mp.user_id,
        mp.status,
        mp.methodology_type,
        mp.confirmed_at,
        mp.updated_at,
        (
          SELECT COUNT(*)
          FROM app.methodology_exercise_sessions mes
          WHERE mes.methodology_plan_id = mp.id
        ) as total_sessions,
        (
          SELECT COUNT(*)
          FROM app.methodology_exercise_sessions mes
          WHERE mes.methodology_plan_id = mp.id
            AND mes.session_status = 'completed'
        ) as completed_sessions
      FROM app.methodology_plans mp
      WHERE mp.methodology_type LIKE '%calistenia%'
         OR mp.methodology_type LIKE '%Calistenia%'
         OR mp.methodology_type LIKE '%IA Specialist%'
      ORDER BY mp.created_at DESC
      LIMIT 5
    `);

    console.log('Planes de calistenia recientes:');
    console.table(problemPlansQuery.rows.map(row => ({
      id: row.id,
      user: row.user_id,
      status: row.status,
      type: row.methodology_type,
      confirmed: row.confirmed_at ? 'Sí' : 'No',
      sessions: `${row.completed_sessions}/${row.total_sessions}`,
      updated: new Date(row.updated_at).toLocaleString()
    })));

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

debugActivePlan();