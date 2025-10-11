import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function diagnoseProgressSync() {
  const client = await pool.connect();

  try {
    // Set search_path
    await client.query('SET search_path TO app,public');

    console.log('\n=== DIAGNÓSTICO DE SINCRONIZACIÓN DE PROGRESO ===\n');

    // 1. Obtener planes activos recientes
    const plansQuery = await client.query(`
      SELECT id, user_id, methodology_type, status, created_at, confirmed_at
      FROM app.methodology_plans
      WHERE status = 'active'
      ORDER BY confirmed_at DESC NULLS LAST
      LIMIT 5
    `);

    console.log('📋 PLANES ACTIVOS RECIENTES:');
    console.log('============================');
    plansQuery.rows.forEach(p => {
      console.log(`  ID: ${p.id} | User: ${p.user_id} | Type: ${p.methodology_type} | Status: ${p.status}`);
      console.log(`  Created: ${p.created_at} | Confirmed: ${p.confirmed_at}`);
    });

    if (plansQuery.rows.length === 0) {
      console.log('\n⚠️ No hay planes activos\n');
      return;
    }

    // Tomar el primer plan activo para análisis detallado
    const testPlan = plansQuery.rows[0];
    const planId = testPlan.id;
    const userId = testPlan.user_id;

    console.log(`\n\n🔍 ANALIZANDO PLAN ID ${planId} (User ${userId})`);
    console.log('='.repeat(50));

    // 2. Consultar sesiones completadas
    const sessionsQuery = await client.query(`
      SELECT
        id,
        week_number,
        day_name,
        session_status,
        started_at,
        completed_at,
        total_duration_seconds,
        warmup_time_seconds
      FROM app.methodology_exercise_sessions
      WHERE methodology_plan_id = $1 AND user_id = $2
      ORDER BY week_number, started_at
    `, [planId, userId]);

    console.log(`\n📅 SESIONES (Total: ${sessionsQuery.rows.length})`);
    console.log('-'.repeat(80));
    sessionsQuery.rows.forEach(s => {
      console.log(`  Session ${s.id} | W${s.week_number} ${s.day_name} | Status: ${s.session_status}`);
      console.log(`    Started: ${s.started_at} | Completed: ${s.completed_at}`);
      console.log(`    Duration: ${s.total_duration_seconds}s | Warmup: ${s.warmup_time_seconds}s`);
    });

    // 3. Consultar progreso de ejercicios
    const progressQuery = await client.query(`
      SELECT
        mep.id,
        mep.methodology_session_id,
        mep.exercise_order,
        mep.exercise_name,
        mep.status,
        mep.series_completed,
        mep.time_spent_seconds,
        mes.week_number,
        mes.day_name
      FROM app.methodology_exercise_progress mep
      JOIN app.methodology_exercise_sessions mes ON mes.id = mep.methodology_session_id
      WHERE mes.methodology_plan_id = $1 AND mes.user_id = $2
      ORDER BY mes.week_number, mes.started_at, mep.exercise_order
    `, [planId, userId]);

    console.log(`\n\n💪 PROGRESO DE EJERCICIOS (Total: ${progressQuery.rows.length})`);
    console.log('-'.repeat(80));

    const bySession = {};
    progressQuery.rows.forEach(e => {
      if (!bySession[e.methodology_session_id]) {
        bySession[e.methodology_session_id] = [];
      }
      bySession[e.methodology_session_id].push(e);
    });

    Object.entries(bySession).forEach(([sessionId, exercises]) => {
      const first = exercises[0];
      console.log(`\n  Sesión ${sessionId} (W${first.week_number} ${first.day_name}):`);
      exercises.forEach(e => {
        console.log(`    ${e.exercise_order}. ${e.exercise_name} | Status: ${e.status} | Series: ${e.series_completed} | Tiempo: ${e.time_spent_seconds}s`);
      });
    });

    // 4. Simular cálculo del endpoint /progress-data
    console.log('\n\n📊 SIMULACIÓN DE ENDPOINT /progress-data');
    console.log('='.repeat(50));

    const generalStatsQuery = await client.query(`
      SELECT
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as total_sessions_completed,
        COUNT(DISTINCT mes.id) as total_sessions_started,
        COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as total_exercises_completed,
        COUNT(DISTINCT mep.id) as total_exercises_attempted,
        SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_completed,
        SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) +
        SUM(CASE WHEN mes.session_status = 'completed' THEN COALESCE(mes.warmup_time_seconds, 0) ELSE 0 END) as total_time_seconds
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2
    `, [userId, planId]);

    const stats = generalStatsQuery.rows[0];
    console.log('\nEstadísticas Generales:');
    console.log(`  Sesiones completadas: ${stats.total_sessions_completed}`);
    console.log(`  Sesiones iniciadas: ${stats.total_sessions_started}`);
    console.log(`  Ejercicios completados: ${stats.total_exercises_completed}`);
    console.log(`  Ejercicios intentados: ${stats.total_exercises_attempted}`);
    console.log(`  Series completadas: ${stats.total_series_completed}`);
    console.log(`  Tiempo total: ${stats.total_time_seconds}s (${Math.floor(stats.total_time_seconds / 60)}min)`);

    // 5. Progreso por semanas
    const weeklyQuery = await client.query(`
      SELECT
        mes.week_number,
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as sessions_completed,
        COUNT(DISTINCT mes.id) as total_sessions,
        COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as exercises_completed,
        COUNT(DISTINCT mep.id) as total_exercises,
        SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as series_completed
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2
      GROUP BY mes.week_number
      ORDER BY mes.week_number ASC
    `, [userId, planId]);

    console.log('\nProgreso por Semanas:');
    weeklyQuery.rows.forEach(w => {
      console.log(`  Semana ${w.week_number}: ${w.sessions_completed}/${w.total_sessions} sesiones | ${w.exercises_completed}/${w.total_exercises} ejercicios | ${w.series_completed} series`);
    });

    // 6. Verificar si ProgressTab recibiría estos datos
    console.log('\n\n🔍 VERIFICACIÓN DE DATOS PARA PROGRESSTAB');
    console.log('='.repeat(50));

    if (parseInt(stats.total_sessions_completed) > 0) {
      console.log('✅ El usuario TIENE sesiones completadas en la BD');
      console.log(`   - ${stats.total_sessions_completed} sesiones completadas`);
      console.log(`   - ${stats.total_exercises_completed} ejercicios completados`);
      console.log(`   - ${stats.total_series_completed} series completadas`);
      console.log('\n   📌 ESTOS DATOS DEBERÍAN MOSTRARSE EN PROGRESSTAB');
    } else {
      console.log('❌ No hay sesiones completadas en la BD');
      console.log('   ProgressTab mostrará valores en 0');
    }

    // 7. Verificar actividad reciente
    const recentQuery = await client.query(`
      SELECT
        mes.id,
        mes.completed_at,
        mes.week_number,
        mes.day_name,
        COUNT(mep.id) as exercises_count,
        SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2 AND mes.session_status = 'completed'
      GROUP BY mes.id, mes.completed_at, mes.week_number, mes.day_name
      ORDER BY mes.completed_at DESC
      LIMIT 10
    `, [userId, planId]);

    console.log('\n\n📅 ACTIVIDAD RECIENTE (últimas 10 sesiones):');
    console.log('-'.repeat(80));

    if (recentQuery.rows.length > 0) {
      recentQuery.rows.forEach((a, i) => {
        const date = new Date(a.completed_at);
        console.log(`  ${i + 1}. Session ${a.id} | W${a.week_number} ${a.day_name}`);
        console.log(`     Fecha: ${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES')}`);
        console.log(`     ${a.exercises_count} ejercicios | ${a.total_series} series`);
      });
    } else {
      console.log('  (Sin actividad reciente)');
    }

    // 8. DIAGNÓSTICO FINAL
    console.log('\n\n🎯 DIAGNÓSTICO FINAL');
    console.log('='.repeat(50));

    const hasCompletedSessions = parseInt(stats.total_sessions_completed) > 0;
    const hasCompletedExercises = parseInt(stats.total_exercises_completed) > 0;
    const hasRecentActivity = recentQuery.rows.length > 0;

    if (hasCompletedSessions && hasCompletedExercises) {
      console.log('✅ Los datos EXISTEN en la base de datos');
      console.log('✅ El endpoint /progress-data DEBERÍA retornar estos datos');
      console.log('\n🔍 PROBLEMA DETECTADO:');
      console.log('   El componente ProgressTab NO se actualiza automáticamente');
      console.log('   porque su useEffect NO incluye progressUpdatedAt como dependencia');
      console.log('\n   📍 UBICACIÓN DEL PROBLEMA:');
      console.log('   Archivo: src/components/routines/tabs/ProgressTab.jsx');
      console.log('   Línea: 73');
      console.log('   Código actual:');
      console.log('     useEffect(() => { ... }, [effectiveMethodologyPlanId, effectivePlan]);');
      console.log('\n   ✅ SOLUCIÓN:');
      console.log('     useEffect(() => { ... }, [effectiveMethodologyPlanId, effectivePlan, progressUpdatedAt]);');
      console.log('\n   Con esto, ProgressTab se refrescará cada vez que se actualice el progreso');
    } else {
      console.log('❌ NO hay datos de progreso en la base de datos');
      console.log('   El usuario no ha completado ninguna sesión aún');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseProgressSync();
