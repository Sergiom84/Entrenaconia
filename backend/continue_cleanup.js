import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function continueCleanup() {
  try {
    console.log('🔥 CONTINUANDO LIMPIEZA - ELIMINACIÓN MASIVA');
    console.log('============================================');

    // Obtener todas las tablas actuales
    const allTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`📊 Tablas actuales: ${allTables.rows.length}`);

    // Definir qué tablas MANTENER
    const tablesToKeep = [
      'Ejercicios_Calistenia',
      'Ejercicios_Hipertrofia',
      'user_profiles',
      'methodology_plans',
      'historico_ejercicios',
      'progreso_usuario',
      'home_training_plans',
      'home_training_sessions',
      'home_exercise_progress',
      'home_exercise_history', // Esta la mantenemos del HomeTraining
      'user_exercise_feedback', // Esta también del HomeTraining
      'music_playlists',
      'users',
      'auth_logs'
    ];

    // Identificar tablas a eliminar
    const tablesToDelete = allTables.rows.filter(row =>
      !tablesToKeep.includes(row.table_name) &&
      !row.table_name.includes('_backup')
    );

    console.log(`\n🗑️ TABLAS A ELIMINAR (${tablesToDelete.length}):`);
    tablesToDelete.forEach(table => {
      console.log(`   🗑️ ${table.table_name}`);
    });

    console.log(`\n✅ TABLAS A MANTENER (${tablesToKeep.length}):`);
    tablesToKeep.forEach(table => {
      console.log(`   ✅ ${table}`);
    });

    // Eliminar todas las tablas obsoletas de una vez
    console.log('\n🔥 ELIMINANDO TABLAS OBSOLETAS...');

    let eliminatedCount = 0;
    for (const table of tablesToDelete) {
      try {
        await pool.query(`DROP TABLE IF EXISTS app.${table.table_name} CASCADE`);
        console.log(`   ✅ ${table.table_name} - ELIMINADA`);
        eliminatedCount++;
      } catch (error) {
        console.log(`   ❌ ${table.table_name}: ${error.message}`);
      }
    }

    // Verificación final
    console.log(`\n🎉 LIMPIEZA COMPLETADA`);
    console.log(`=======================`);
    console.log(`✅ Tablas eliminadas: ${eliminatedCount}`);

    const finalCount = await pool.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'app\'');
    console.log(`📊 Tablas finales: ${finalCount.rows[0].count}`);

    // Mostrar todas las tablas que quedaron
    const finalTables = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'app'
      ORDER BY table_name
    `);

    console.log(`\n📋 TODAS LAS TABLAS FINALES:`);
    finalTables.rows.forEach(row => {
      console.log(`   ${row.table_type === 'BASE TABLE' ? '📋' : '👁️'} ${row.table_name}`);
    });

    console.log(`\n🏆 REESTRUCTURACIÓN FINAL COMPLETADA`);
    console.log(`=====================================`);
    console.log(`📈 REDUCCIÓN: De 83 → ${finalCount.rows[0].count} tablas`);
    console.log(`📉 OPTIMIZACIÓN: ${Math.round(((83 - finalCount.rows[0].count) / 83) * 100)}% menos complejidad`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

continueCleanup();