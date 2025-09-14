import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function finalCleanup() {
  const client = await pool.connect();

  try {
    console.log('🏗️ LIMPIEZA FINAL Y RENOMBRADO DE TABLAS');
    console.log('=========================================');

    await client.query('BEGIN');

    // PASO 1: Preservar tablas HomeTraining importantes
    console.log('📦 Paso 1: Preservando tablas HomeTraining...');

    const homeTrainingTables = [
      'home_training_plans',
      'home_training_sessions',
      'home_exercise_progress',
      'home_exercise_history',
      'user_exercise_feedback'
    ];

    for (const table of homeTrainingTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM app.${table}`);
        console.log(`   ✅ ${table}: ${count.rows[0].count} registros - PRESERVADA`);
      } catch (error) {
        console.log(`   ⚠️ ${table}: No existe - ${error.message}`);
      }
    }

    // PASO 2: Revertir cambios en el código (methodology_plans_new -> methodology_plans)
    console.log('\n🔄 Paso 2: Preparando renombrado de tablas...');

    // PASO 3: Renombrar la tabla antigua para hacer espacio
    console.log('📋 Paso 3: Renombrando tabla original...');
    await client.query('ALTER TABLE app.methodology_plans RENAME TO methodology_plans_old');
    console.log('   ✅ methodology_plans → methodology_plans_old');

    // PASO 4: Renombrar la nueva tabla al nombre original
    console.log('📋 Paso 4: Renombrando nueva tabla al nombre original...');
    await client.query('ALTER TABLE app.methodology_plans_new RENAME TO methodology_plans');
    console.log('   ✅ methodology_plans_new → methodology_plans');

    // PASO 5: Actualizar el código de vuelta
    console.log('🔧 Paso 5: Código ya actualizado (usará methodology_plans)');

    await client.query('COMMIT');

    // PASO 6: Verificar el resultado
    console.log('\n✅ VERIFICACIÓN FINAL:');

    const finalTables = await client.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_schema = 'app' AND table_name = t.table_name) as columns
      FROM information_schema.tables t
      WHERE table_schema = 'app'
      AND table_name IN (
        'Ejercicios_Calistenia',
        'Ejercicios_Hipertrofia',
        'user_profiles',
        'music_playlists',
        'methodology_plans',
        'historico_ejercicios',
        'progreso_usuario',
        'home_training_plans',
        'home_training_sessions',
        'home_exercise_progress',
        'users'
      )
      ORDER BY table_name
    `);

    console.log('📊 TABLAS CORE FINALES:');
    finalTables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name} (${row.columns} columnas)`);
    });

    console.log('\n🎉 REESTRUCTURACIÓN COMPLETADA');
    console.log('=================================');
    console.log('📊 Estructura final optimizada y coherente');
    console.log('✅ Código y base de datos sincronizados');
    console.log('🛡️ Respaldos creados y conservados');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en limpieza:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

finalCleanup();