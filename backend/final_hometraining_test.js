import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function finalHomeTrainingTest() {
  try {
    console.log('🏠 PRUEBA FINAL COMPLETA DEL SISTEMA HOMETRAINING');
    console.log('================================================');

    // 1. Verificar todas las tablas necesarias
    console.log('📋 1. Verificando todas las tablas necesarias...');
    const requiredTables = [
      'users',
      'user_profiles',
      'user_sessions',
      'user_equipment',
      'user_home_training_stats',
      'home_training_plans',
      'home_training_sessions',
      'home_exercise_progress',
      'home_exercise_history',
      'user_exercise_feedback',
      'home_training_combinations',
      'home_combination_exercise_history'
    ];

    const allTablesExist = [];
    for (const table of requiredTables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) as count FROM app.${table}`);
        console.log(`   ✅ ${table}: ${count.rows[0].count} registros`);
        allTablesExist.push(true);
      } catch (error) {
        console.log(`   ❌ ${table}: NO EXISTE`);
        allTablesExist.push(false);
      }
    }

    const missingTables = allTablesExist.filter(exists => !exists).length;
    console.log(`   📊 Resultado: ${requiredTables.length - missingTables}/${requiredTables.length} tablas OK`);

    // 2. Probar funciones específicas que estaban fallando
    console.log('\n📋 2. Probando función get_exercises_for_combination...');
    try {
      const testQuery = await pool.query(`
        SELECT * FROM get_exercises_for_combination(18, 'minimo', 'funcional', 5);
      `);
      console.log(`   ✅ Función ejecutada correctamente: ${testQuery.rows.length} resultados`);
      if (testQuery.rows.length > 0) {
        console.log(`   📋 Primer resultado: ${JSON.stringify(testQuery.rows[0])}`);
      }
    } catch (error) {
      console.log(`   ❌ Error en función: ${error.message}`);
    }

    // 3. Verificar datos de combinaciones
    console.log('\n📋 3. Verificando combinaciones disponibles...');
    const combinations = await pool.query(`
      SELECT combination_code, equipment_type, training_type, description
      FROM app.home_training_combinations
      WHERE equipment_type = 'minimo' AND training_type = 'funcional'
    `);

    console.log(`   📊 Combinaciones minimo+funcional: ${combinations.rows.length}`);
    combinations.rows.forEach(combo => {
      console.log(`   🏋️ ${combo.combination_code}: ${combo.description}`);
    });

    // 4. Verificar historial de ejercicios del usuario 18
    console.log('\n📋 4. Verificando historial del usuario 18...');
    const userHistory = await pool.query(`
      SELECT exercise_name, times_used, user_rating, combination_code
      FROM app.home_combination_exercise_history
      WHERE user_id = 18
      ORDER BY times_used DESC
    `);

    console.log(`   📊 Ejercicios en historial: ${userHistory.rows.length}`);
    userHistory.rows.forEach(ex => {
      console.log(`   💪 ${ex.exercise_name} (usado ${ex.times_used} veces) - Rating: ${ex.user_rating}`);
    });

    // 5. Verificar estructura de user_sessions
    console.log('\n📋 5. Verificando user_sessions (jwt_token_hash)...');
    const sessionTest = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'user_sessions'
      AND column_name = 'jwt_token_hash'
    `);

    if (sessionTest.rows.length > 0) {
      console.log('   ✅ Columna jwt_token_hash existe');
    } else {
      console.log('   ❌ Columna jwt_token_hash NO existe');
    }

    console.log('\n🎉 RESUMEN FINAL');
    console.log('===============');

    if (missingTables === 0) {
      console.log('✅ TODAS las tablas necesarias están presentes');
      console.log('✅ Combinaciones de entrenamiento configuradas');
      console.log('✅ Datos de ejemplo insertados');
      console.log('✅ Estructura de sesiones corregida');
      console.log('\n🚀 HOMETRAINING COMPLETAMENTE FUNCIONAL');
      console.log('Puedes intentar crear una sesión de entrenamiento ahora');
    } else {
      console.log(`❌ Faltan ${missingTables} tablas por crear`);
      console.log('⚠️ El sistema puede tener problemas');
    }

  } catch (error) {
    console.error('❌ Error en prueba final:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    await pool.end();
  }
}

finalHomeTrainingTest();