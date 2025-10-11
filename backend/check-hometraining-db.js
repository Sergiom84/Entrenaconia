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

async function checkDatabase() {
  try {
    await pool.query('SET search_path TO app,public');

    // 1. Ver esquema de tablas HomeTraining
    console.log('=== TABLAS HOME TRAINING EN LA BASE DE DATOS ===\n');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      AND table_name LIKE '%home%'
      ORDER BY table_name
    `);
    console.log('Tablas encontradas:', tables.rows.map(r => r.table_name).join(', '));

    // 2. Estructura de home_training_sessions
    console.log('\n=== ESTRUCTURA: home_training_sessions ===');
    const sessionsCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'home_training_sessions'
      ORDER BY ordinal_position
    `);
    if (sessionsCols.rows.length > 0) {
      sessionsCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    } else {
      console.log('  Tabla no encontrada o sin columnas');
    }

    // 3. Últimas sesiones (últimas 72h)
    console.log('\n=== ÚLTIMAS SESIONES (72 horas) ===');
    const sessions = await pool.query(`
      SELECT
        id, user_id, status,
        total_exercises, exercises_completed, progress_percentage,
        started_at, completed_at, created_at
      FROM app.home_training_sessions
      WHERE started_at >= NOW() - INTERVAL '72 hours'
      ORDER BY started_at DESC
      LIMIT 15
    `);

    if (sessions.rows.length === 0) {
      console.log('❌ No hay sesiones en las últimas 72 horas');
    } else {
      sessions.rows.forEach(s => {
        console.log(`\n📊 Sesión #${s.id} (Usuario: ${s.user_id})`);
        console.log(`   Estado: ${s.status}`);
        console.log(`   Progreso: ${s.exercises_completed}/${s.total_exercises} (${s.progress_percentage}%)`);
        console.log(`   Inicio: ${s.started_at}`);
        console.log(`   Completado: ${s.completed_at || 'N/A'}`);
        console.log(`   Creado: ${s.created_at}`);
      });
    }

    // 4. Verificar progreso de ejercicios
    console.log('\n\n=== PROGRESO DE EJERCICIOS (últimas 72h) ===');
    const exerciseProgress = await pool.query(`
      SELECT
        hep.home_training_session_id,
        hep.exercise_order,
        hep.exercise_name,
        hep.status,
        hep.series_completed,
        hep.total_series,
        hep.duration_seconds,
        hep.completed_at
      FROM app.home_exercise_progress hep
      JOIN app.home_training_sessions hts ON hts.id = hep.home_training_session_id
      WHERE hts.started_at >= NOW() - INTERVAL '72 hours'
      ORDER BY hts.started_at DESC, hep.exercise_order
      LIMIT 30
    `);

    if (exerciseProgress.rows.length === 0) {
      console.log('❌ No hay progreso de ejercicios registrado');
    } else {
      let currentSession = null;
      exerciseProgress.rows.forEach(ex => {
        if (currentSession !== ex.home_training_session_id) {
          currentSession = ex.home_training_session_id;
          console.log(`\n🏋️ Sesión #${currentSession}:`);
        }
        console.log(`   ${ex.exercise_order}. ${ex.exercise_name} - ${ex.status} (${ex.series_completed}/${ex.total_series} series) - ${ex.duration_seconds || 0}s`);
      });
    }

    // 5. Historial de ejercicios
    console.log('\n\n=== HISTORIAL DE EJERCICIOS (últimas 72h) ===');
    const history = await pool.query(`
      SELECT
        user_id,
        exercise_name,
        series,
        duration_seconds,
        session_id,
        created_at
      FROM app.home_exercise_history
      WHERE created_at >= NOW() - INTERVAL '72 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    if (history.rows.length === 0) {
      console.log('❌ No hay historial de ejercicios en las últimas 72 horas');
    } else {
      history.rows.forEach(h => {
        console.log(`📝 Usuario ${h.user_id} - ${h.exercise_name} (${h.series} series, ${h.duration_seconds}s) - Sesión #${h.session_id} - ${h.created_at}`);
      });
    }

    // 6. Planes de entrenamiento recientes
    console.log('\n\n=== PLANES DE ENTRENAMIENTO (últimos 3) ===');
    const plans = await pool.query(`
      SELECT
        id, user_id, equipment_type, training_type, created_at
      FROM app.home_training_plans
      ORDER BY created_at DESC
      LIMIT 3
    `);

    if (plans.rows.length === 0) {
      console.log('❌ No hay planes de entrenamiento guardados');
    } else {
      plans.rows.forEach(p => {
        console.log(`📋 Plan #${p.id} (Usuario ${p.user_id}) - ${p.equipment_type}/${p.training_type} - ${p.created_at}`);
      });
    }

    // 7. Estadísticas de usuario
    console.log('\n\n=== ESTADÍSTICAS DE USUARIOS ===');
    const stats = await pool.query(`
      SELECT
        user_id, total_sessions, last_training_date, created_at, updated_at
      FROM app.user_home_training_stats
      ORDER BY total_sessions DESC
      LIMIT 5
    `);

    if (stats.rows.length === 0) {
      console.log('❌ No hay estadísticas de usuarios');
    } else {
      stats.rows.forEach(s => {
        console.log(`📊 Usuario ${s.user_id} - ${s.total_sessions} sesiones - Último: ${s.last_training_date || 'N/A'}`);
      });
    }

    await pool.end();
    console.log('\n✅ Consulta finalizada');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

checkDatabase();
