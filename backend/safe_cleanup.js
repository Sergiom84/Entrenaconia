import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function safeCleanup() {
  try {
    console.log('🔥 ELIMINACIÓN SEGURA PASO A PASO');
    console.log('=================================');

    // Primero vamos a ver qué causó el error anterior
    console.log('🔍 Identificando vistas problemáticas...');

    const views = await pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'app'
      ORDER BY table_name
    `);

    console.log('📋 Vistas encontradas:');
    views.rows.forEach(row => {
      console.log(`   👁️ ${row.table_name}`);
    });

    // Eliminar vistas primero (sin transacción para evitar bloqueos)
    console.log('\n🗑️ Eliminando vistas una por una...');

    for (const view of views.rows) {
      try {
        await pool.query(`DROP VIEW IF EXISTS app.${view.table_name} CASCADE`);
        console.log(`   ✅ Vista ${view.table_name} eliminada`);
      } catch (error) {
        console.log(`   ❌ Error con vista ${view.table_name}: ${error.message}`);
      }
    }

    // Ahora eliminar tablas obsoletas específicas (las más problemáticas)
    console.log('\n🗑️ Eliminando tablas obsoletas específicas...');

    const specificTables = [
      'routine_exercise_feedback',
      'routine_exercise_progress',
      'routine_plans',
      'routine_sessions',
      'user_exercise_history',
      'user_exercise_stats',
      'user_routine_stats',
      'test_table'
    ];

    for (const table of specificTables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS app.${table} CASCADE`);
        console.log(`   ✅ Tabla ${table} eliminada`);
      } catch (error) {
        console.log(`   ❌ Error con tabla ${table}: ${error.message}`);
      }
    }

    // Verificar resultado
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'app\'');
    console.log(`\n📊 Tablas restantes: ${finalCount.rows[0].count}`);

    // Mostrar tablas que quedaron
    const remaining = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'app'
      AND table_name IN (
        'Ejercicios_Calistenia', 'Ejercicios_Hipertrofia', 'user_profiles',
        'methodology_plans', 'historico_ejercicios', 'progreso_usuario',
        'home_training_plans', 'home_training_sessions', 'home_exercise_progress',
        'music_playlists', 'users', 'auth_logs'
      )
      ORDER BY table_name
    `);

    console.log('\n✅ TABLAS PRINCIPALES VERIFICADAS:');
    remaining.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name} (${row.table_type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

safeCleanup();