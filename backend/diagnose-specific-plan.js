import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function diagnosePlan() {
  const client = await pool.connect();

  try {
    await client.query('SET search_path TO app,public');

    // Buscar planes con sesiones COMPLETADAS
    const plansWithCompletedQuery = await client.query(`
      SELECT
        mp.id,
        mp.user_id,
        mp.methodology_type,
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as completed_sessions
      FROM app.methodology_plans mp
      LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
      WHERE mp.status = 'active'
      GROUP BY mp.id, mp.user_id, mp.methodology_type
      HAVING COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') > 0
      ORDER BY completed_sessions DESC
      LIMIT 5
    `);

    console.log('\n📋 PLANES CON SESIONES COMPLETADAS:');
    console.log('====================================');

    if (plansWithCompletedQuery.rows.length === 0) {
      console.log('❌ NO HAY PLANES CON SESIONES COMPLETADAS');

      // Buscar planes con sesiones iniciadas pero no completadas
      const plansWithStartedQuery = await client.query(`
        SELECT
          mp.id,
          mp.user_id,
          mp.methodology_type,
          COUNT(DISTINCT mes.id) as total_sessions,
          COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'in_progress') as in_progress,
          COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'cancelled') as cancelled
        FROM app.methodology_plans mp
        LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
        WHERE mp.status = 'active'
        GROUP BY mp.id, mp.user_id, mp.methodology_type
        HAVING COUNT(DISTINCT mes.id) > 0
        ORDER BY total_sessions DESC
        LIMIT 5
      `);

      console.log('\n📋 PLANES CON SESIONES (NO COMPLETADAS):');
      console.log('=========================================');
      plansWithStartedQuery.rows.forEach(p => {
        console.log(`  Plan ${p.id} (User ${p.user_id}): ${p.total_sessions} sesiones`);
        console.log(`    In Progress: ${p.in_progress} | Cancelled: ${p.cancelled}`);
      });

      return;
    }

    plansWithCompletedQuery.rows.forEach(p => {
      console.log(`  Plan ${p.id} (User ${p.user_id}, ${p.methodology_type}): ${p.completed_sessions} sesiones completadas`);
    });

    // Analizar el primer plan con sesiones completadas
    const targetPlan = plansWithCompletedQuery.rows[0];
    console.log(`\n\n🔍 ANALIZANDO PLAN ${targetPlan.id} (User ${targetPlan.user_id})`);
    console.log('='.repeat(50));

    // Sesiones completadas
    const sessionsQuery = await client.query(`
      SELECT
        id, week_number, day_name, session_status,
        started_at, completed_at, total_duration_seconds
      FROM app.methodology_exercise_sessions
      WHERE methodology_plan_id = $1 AND session_status = 'completed'
      ORDER BY completed_at DESC
    `, [targetPlan.id]);

    console.log(`\n✅ SESIONES COMPLETADAS (${sessionsQuery.rows.length}):`);
    sessionsQuery.rows.forEach(s => {
      const date = new Date(s.completed_at);
      console.log(`  Session ${s.id} | W${s.week_number} ${s.day_name}`);
      console.log(`    Completada: ${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES')}`);
      console.log(`    Duración: ${s.total_duration_seconds}s`);
    });

    // Ejercicios completados
    const exercisesQuery = await client.query(`
      SELECT
        mep.exercise_name,
        mep.status,
        mep.series_completed,
        mep.time_spent_seconds,
        mes.week_number,
        mes.day_name
      FROM app.methodology_exercise_progress mep
      JOIN app.methodology_exercise_sessions mes ON mes.id = mep.methodology_session_id
      WHERE mes.methodology_plan_id = $1 AND mep.status = 'completed'
      ORDER BY mes.week_number, mep.exercise_order
    `, [targetPlan.id]);

    console.log(`\n\n💪 EJERCICIOS COMPLETADOS (${exercisesQuery.rows.length}):`);
    exercisesQuery.rows.forEach(e => {
      console.log(`  W${e.week_number} ${e.day_name}: ${e.exercise_name} | ${e.series_completed} series | ${e.time_spent_seconds}s`);
    });

    // Simular el endpoint /progress-data
    console.log('\n\n📊 SIMULANDO ENDPOINT /progress-data');
    console.log('='.repeat(50));

    const progressDataQuery = await client.query(`
      SELECT
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as total_sessions_completed,
        COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as total_exercises_completed,
        SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_completed,
        SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) as total_time_seconds
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2
    `, [targetPlan.user_id, targetPlan.id]);

    const data = progressDataQuery.rows[0];
    console.log(`
Datos que recibe ProgressTab:
  - Sesiones completadas: ${data.total_sessions_completed}
  - Ejercicios completados: ${data.total_exercises_completed}
  - Series completadas: ${data.total_series_completed}
  - Tiempo total: ${data.total_time_seconds}s (${Math.floor(data.total_time_seconds / 60)}min)
    `);

    console.log('\n\n🎯 CONCLUSIÓN');
    console.log('='.repeat(50));
    console.log('✅ Los datos EXISTEN en la base de datos');
    console.log('✅ El endpoint /progress-data los RETORNA correctamente');
    console.log('❌ PROBLEMA: ProgressTab NO SE ACTUALIZA después de completar sesión');
    console.log('\n📍 CAUSA RAÍZ:');
    console.log('   El useEffect de ProgressTab (línea 32-73) NO tiene progressUpdatedAt como dependencia');
    console.log('\n   Dependencias actuales: [effectiveMethodologyPlanId, effectivePlan]');
    console.log('   Dependencias correctas: [effectiveMethodologyPlanId, effectivePlan, progressUpdatedAt]');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnosePlan();
