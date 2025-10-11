import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL',
  ssl: { rejectUnauthorized: false }
});

async function diagnose() {
  try {
    await pool.query('SET search_path TO app,public');

    console.log('=== DIAGNÓSTICO DEL PROBLEMA DE PERSISTENCIA ===\n');

    // 1. Identificar sesiones completadas vs no completadas
    console.log('📊 ANÁLISIS DE ESTADOS DE SESIÓN:\n');
    const statusAnalysis = await pool.query(`
      SELECT
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as with_completed_at,
        COUNT(CASE WHEN completed_at IS NULL THEN 1 END) as without_completed_at
      FROM app.home_training_sessions
      WHERE started_at >= NOW() - INTERVAL '72 hours'
      GROUP BY status
      ORDER BY count DESC
    `);

    statusAnalysis.rows.forEach(row => {
      console.log(`Status: "${row.status}"`);
      console.log(`  Total: ${row.count}`);
      console.log(`  Con completed_at: ${row.with_completed_at}`);
      console.log(`  Sin completed_at: ${row.without_completed_at}\n`);
    });

    // 2. Sesiones "completadas" sin completed_at
    console.log('🔍 SESIONES COMPLETADAS SIN TIMESTAMP:\n');
    const incompleteSessions = await pool.query(`
      SELECT
        id, user_id, status, progress_percentage,
        exercises_completed, total_exercises,
        started_at, completed_at, created_at
      FROM app.home_training_sessions
      WHERE started_at >= NOW() - INTERVAL '72 hours'
        AND (status = 'completed' AND completed_at IS NULL)
      ORDER BY started_at DESC
    `);

    if (incompleteSessions.rows.length === 0) {
      console.log('✅ No hay sesiones con inconsistencias de completed_at\n');
    } else {
      incompleteSessions.rows.forEach(s => {
        console.log(`⚠️  Sesión #${s.id} (Usuario ${s.user_id})`);
        console.log(`    Estado: ${s.status} pero completed_at es NULL`);
        console.log(`    Progreso: ${s.exercises_completed}/${s.total_exercises}\n`);
      });
    }

    // 3. Verificar el último estado de cada sesión completada
    console.log('📋 ÚLTIMA SESIÓN COMPLETADA POR USUARIO:\n');
    const lastCompleted = await pool.query(`
      SELECT DISTINCT ON (user_id)
        id, user_id, status, progress_percentage,
        exercises_completed, total_exercises,
        started_at, completed_at,
        abandoned_at, abandon_reason
      FROM app.home_training_sessions
      WHERE status = 'completed'
      ORDER BY user_id, completed_at DESC NULLS LAST, started_at DESC
    `);

    lastCompleted.rows.forEach(s => {
      console.log(`Usuario ${s.user_id}:`);
      console.log(`  Última sesión completada: #${s.id}`);
      console.log(`  Progreso: ${s.exercises_completed}/${s.total_exercises} (${s.progress_percentage}%)`);
      console.log(`  Completada: ${s.completed_at || 'NULL ⚠️'}`);
      console.log(`  Iniciada: ${s.started_at}`);
      if (s.abandoned_at) {
        console.log(`  ⚠️  Abandonada: ${s.abandoned_at} (${s.abandon_reason})`);
      }
      console.log('');
    });

    // 4. Verificar qué sucede con el endpoint current-plan
    console.log('🔎 SIMULACIÓN: ¿QUÉ DEVUELVE /current-plan?\n');
    const userId = 18; // Usuario de las sesiones que vemos en los datos

    // Simular la query del endpoint current-plan
    const currentPlanQuery = await pool.query(`
      SELECT * FROM app.home_training_plans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (currentPlanQuery.rows.length > 0) {
      const plan = currentPlanQuery.rows[0];
      console.log(`Plan más reciente encontrado:`);
      console.log(`  Plan ID: ${plan.id}`);
      console.log(`  Usuario: ${plan.user_id}`);
      console.log(`  Tipo: ${plan.equipment_type}/${plan.training_type}`);
      console.log(`  Creado: ${plan.created_at}\n`);

      // Buscar sesión activa para este plan
      const activeSessionQuery = await pool.query(`
        SELECT * FROM app.home_training_sessions
        WHERE user_id = $1 AND home_training_plan_id = $2 AND status = 'in_progress'
        ORDER BY started_at DESC
        LIMIT 1
      `, [userId, plan.id]);

      if (activeSessionQuery.rows.length > 0) {
        const session = activeSessionQuery.rows[0];
        console.log(`✅ Sesión activa encontrada:`);
        console.log(`  Sesión ID: ${session.id}`);
        console.log(`  Estado: ${session.status}`);
        console.log(`  Progreso: ${session.exercises_completed}/${session.total_exercises}`);
      } else {
        console.log(`⚠️  NO hay sesión activa (in_progress) para este plan`);

        // Buscar TODAS las sesiones de este plan
        const allSessionsQuery = await pool.query(`
          SELECT id, status, progress_percentage, started_at, completed_at
          FROM app.home_training_sessions
          WHERE home_training_plan_id = $1
          ORDER BY started_at DESC
        `, [plan.id]);

        console.log(`\n   Sesiones existentes para este plan:`);
        allSessionsQuery.rows.forEach(s => {
          console.log(`     - Sesión #${s.id}: ${s.status} (${s.progress_percentage}%) - Completada: ${s.completed_at || 'NULL'}`);
        });
      }
    } else {
      console.log('❌ No hay planes de entrenamiento para el usuario');
    }

    // 5. Verificar sesiones abandonadas
    console.log('\n\n🚪 SESIONES ABANDONADAS (pero no cerradas):\n');
    const abandonedSessions = await pool.query(`
      SELECT
        id, user_id, status, abandoned_at, abandon_reason,
        exercises_completed, total_exercises,
        started_at, completed_at
      FROM app.home_training_sessions
      WHERE abandoned_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '72 hours'
      ORDER BY abandoned_at DESC
    `);

    if (abandonedSessions.rows.length === 0) {
      console.log('✅ No hay sesiones abandonadas registradas\n');
    } else {
      abandonedSessions.rows.forEach(s => {
        console.log(`Sesión #${s.id} (Usuario ${s.user_id})`);
        console.log(`  Estado actual: ${s.status}`);
        console.log(`  Progreso: ${s.exercises_completed}/${s.total_exercises}`);
        console.log(`  Abandonada: ${s.abandoned_at} (${s.abandon_reason})`);
        console.log(`  Completada: ${s.completed_at || 'NULL'}\n`);
      });
    }

    // 6. Problema específico: Sesión #91
    console.log('🔬 ANÁLISIS DETALLADO: Sesión #91 (actual "in_progress")\n');
    const session91 = await pool.query(`
      SELECT * FROM app.home_training_sessions WHERE id = 91
    `);

    if (session91.rows.length > 0) {
      const s = session91.rows[0];
      console.log('Estado de la sesión:');
      console.log(`  ID: ${s.id}`);
      console.log(`  Usuario: ${s.user_id}`);
      console.log(`  Plan ID: ${s.home_training_plan_id}`);
      console.log(`  Estado: ${s.status}`);
      console.log(`  Progreso: ${s.exercises_completed}/${s.total_exercises} (${s.progress_percentage}%)`);
      console.log(`  Iniciada: ${s.started_at}`);
      console.log(`  Completada: ${s.completed_at || 'NULL'}`);
      console.log(`  Abandonada: ${s.abandoned_at || 'N/A'}`);
      console.log(`  Session Data:`, JSON.stringify(s.session_data, null, 2));
    }

    await pool.end();
    console.log('\n\n✅ Diagnóstico completado');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

diagnose();
