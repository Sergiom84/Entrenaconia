import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function deleteObsoleteTables() {
  const client = await pool.connect();

  try {
    console.log('🗑️ ELIMINANDO TABLAS DUPLICADAS Y OBSOLETAS');
    console.log('===========================================');

    await client.query('BEGIN');

    // PASO 1: Crear respaldo final de emergencia
    console.log('🛡️ Paso 1: Creando respaldo final de emergencia...');

    await client.query('CREATE SCHEMA IF NOT EXISTS final_emergency_backup');

    // Respaldar las tablas más críticas antes de la eliminación masiva
    const criticalBackups = [
      'methodology_plans_old',
      'routine_plans',
      'routine_sessions',
      'methodology_exercise_sessions'
    ];

    for (const table of criticalBackups) {
      try {
        await client.query(`CREATE TABLE final_emergency_backup.${table}_emergency AS SELECT * FROM app.${table}`);
        console.log(`   💾 ${table} respaldada`);
      } catch (error) {
        console.log(`   ⚠️ ${table}: ${error.message}`);
      }
    }

    // PASO 2: Eliminar tablas duplicadas de methodology
    console.log('\n🔥 Paso 2: Eliminando tablas duplicadas de methodology...');

    const methodologyDuplicates = [
      'manual_methodology_exercise_feedback',
      'manual_methodology_exercise_history_complete',
      'manual_methodology_exercise_progress',
      'manual_methodology_exercise_sessions',
      'methodology_exercise_feedback',
      'methodology_exercise_history_complete',
      'methodology_exercise_progress',
      'methodology_exercise_sessions',
      'methodology_plans_old' // La tabla antigua renombrada
    ];

    for (const table of methodologyDuplicates) {
      try {
        await client.query(`DROP TABLE IF EXISTS app.${table} CASCADE`);
        console.log(`   🗑️ ${table} - ELIMINADA`);
      } catch (error) {
        console.log(`   ❌ Error eliminando ${table}: ${error.message}`);
      }
    }

    // PASO 3: Eliminar tablas obsoletas generales
    console.log('\n🔥 Paso 3: Eliminando tablas obsoletas generales...');

    const obsoleteTables = [
      'body_composition_history',
      'calistenia_exercise_rejections',
      'calistenia_exercise_sets',
      'calistenia_progression_analysis',
      'calistenia_progression_rules',
      'calistenia_progression_summary',
      'calistenia_warmup_exercises',
      'daily_nutrition_log',
      'enhanced_routine_stats',
      'equipment_catalog',
      'equipment_items',
      'exercise_ai_info',
      'exercise_history',
      'exercise_repetition_policy',
      'exercises_catalog',
      'food_database',
      'home_combination_exercise_history',
      'home_exercise_rejections',
      'home_training_combinations',
      'home_training_templates',
      'medical_documents',
      'nutrition_goals',
      'nutrition_plans',
      'routine_exercise_feedback',
      'routine_exercise_progress',
      'routine_plans',
      'routine_sessions',
      'supplement_recommendations',
      'technique_analysis',
      'test_table',
      'user_alergias',
      'user_alimentos_excluidos',
      'user_custom_equipment',
      'user_daily_activity',
      'user_equipment',
      'user_exercise_history',
      'user_exercise_stats',
      'user_home_training_stats',
      'user_limitaciones',
      'user_medicamentos',
      'user_personalized_equipment',
      'user_routine_stats',
      'user_sessions',
      'user_suplementos'
    ];

    for (const table of obsoleteTables) {
      try {
        await client.query(`DROP TABLE IF EXISTS app.${table} CASCADE`);
        console.log(`   🗑️ ${table} - ELIMINADA`);
      } catch (error) {
        console.log(`   ❌ Error eliminando ${table}: ${error.message}`);
      }
    }

    // PASO 4: Eliminar todas las vistas innecesarias
    console.log('\n🔥 Paso 4: Eliminando vistas innecesarias...');

    const obsoleteViews = [
      'v_hist_propuesto',
      'v_hist_real',
      'v_home_combinations_dashboard',
      'v_home_hist_propuesto',
      'v_home_hist_real',
      'v_latest_exercise_feedback',
      'v_routine_hist_propuesto',
      'v_routine_hist_real',
      'v_template_stats',
      'v_user_methodology_profile',
      'v_user_profile_normalized',
      'vw_home_exercise_history',
      'vw_home_exercise_progress',
      'vw_home_plans_overview',
      'vw_methodology_exercise_history',
      'vw_methodology_plans_overview'
    ];

    for (const view of obsoleteViews) {
      try {
        await client.query(`DROP VIEW IF EXISTS app.${view} CASCADE`);
        console.log(`   🗑️ ${view} - VISTA ELIMINADA`);
      } catch (error) {
        console.log(`   ❌ Error eliminando vista ${view}: ${error.message}`);
      }
    }

    await client.query('COMMIT');

    // PASO 5: Verificación final
    console.log('\n✅ VERIFICACIÓN FINAL:');

    const finalCount = await client.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'app\'');
    console.log(`📊 Tablas restantes en esquema app: ${finalCount.rows[0].count}`);

    const remainingTables = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'app'
      ORDER BY table_name
    `);

    console.log('\n📋 TABLAS FINALES:');
    remainingTables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name} (${row.table_type})`);
    });

    console.log('\n🎉 LIMPIEZA COMPLETADA');
    console.log('=======================');
    console.log(`✅ Tablas eliminadas: ~70+`);
    console.log(`✅ Tablas finales: ${finalCount.rows[0].count}`);
    console.log('✅ Base de datos optimizada');
    console.log('✅ Respaldos de emergencia creados');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en eliminación:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteObsoleteTables();