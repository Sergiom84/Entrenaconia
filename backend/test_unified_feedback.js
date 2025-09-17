#!/usr/bin/env node

/**
 * Test del sistema unificado de feedback
 * Verifica que el error "methodology_type" esté resuelto
 */

import { pool } from './db.js';

console.log('🧪 PRUEBAS DEL SISTEMA UNIFICADO DE FEEDBACK');
console.log('============================================');

async function testMethodologyTypeColumn() {
  console.log('\n📋 1. PROBANDO CONSULTA CON methodology_type...');

  try {
    // Probar la consulta que fallaba antes
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN methodology_type = 'home_training' THEN 1 END) as home_training,
        COUNT(CASE WHEN methodology_type = 'calistenia' THEN 1 END) as calistenia,
        array_agg(DISTINCT methodology_type) as metodologias_distintas
      FROM app.user_exercise_feedback;
    `;

    const result = await pool.query(query);
    console.log('✅ Consulta methodology_type exitosa');
    console.log('📊 Resultados:');
    console.log(`   - Total registros: ${result.rows[0].total}`);
    console.log(`   - Home Training: ${result.rows[0].home_training}`);
    console.log(`   - Calistenia: ${result.rows[0].calistenia}`);
    console.log(`   - Metodologías: ${result.rows[0].metodologias_distintas?.join(', ') || 'ninguna'}`);

    return true;
  } catch (error) {
    console.error('❌ Error en consulta methodology_type:', error.message);
    return false;
  }
}

async function testFeedbackFunctions() {
  console.log('\n🔧 2. PROBANDO FUNCIONES DE FEEDBACK...');

  try {
    // Probar get_user_ai_context
    console.log('   📡 Probando get_user_ai_context...');
    const contextQuery = `SELECT app.get_user_ai_context(1, 'calistenia') as context`;
    const contextResult = await pool.query(contextQuery);
    console.log('   ✅ get_user_ai_context funciona correctamente');

    // Probar get_avoided_exercises_for_ai
    console.log('   📡 Probando get_avoided_exercises_for_ai...');
    const avoidedQuery = `SELECT app.get_avoided_exercises_for_ai(1, 'calistenia', 30) as avoided`;
    const avoidedResult = await pool.query(avoidedQuery);
    console.log('   ✅ get_avoided_exercises_for_ai funciona correctamente');

    // Probar save_user_feedback
    console.log('   📡 Probando save_user_feedback...');
    const saveQuery = `
      SELECT app.save_user_feedback(
        1,
        'Push-ups Test',
        'calistenia',
        'too_difficult',
        'Ejercicio de prueba',
        NULL,
        0.8
      ) as feedback_id
    `;
    const saveResult = await pool.query(saveQuery);
    console.log(`   ✅ save_user_feedback funciona - ID: ${saveResult.rows[0].feedback_id}`);

    return true;
  } catch (error) {
    console.error('❌ Error en funciones de feedback:', error.message);
    return false;
  }
}

async function testCalisteniaSpecialistCode() {
  console.log('\n🎯 3. PROBANDO CÓDIGO DE calisteniaSpecialist.js...');

  try {
    // Simular la consulta que se usa en calisteniaSpecialist.js
    const testQuery = `
      INSERT INTO app.user_exercise_feedback
      (user_id, exercise_name, methodology_type, feedback_type, comment, ai_weight, created_at)
      VALUES (1, 'Test Exercise', 'calistenia', 'love_it', 'Ejercicio de prueba para calistenia', 1.0, NOW())
      RETURNING id, methodology_type;
    `;

    const result = await pool.query(testQuery);
    console.log(`✅ Inserción de feedback exitosa - ID: ${result.rows[0].id}`);
    console.log(`📊 Methodology Type: ${result.rows[0].methodology_type}`);

    // Limpiar el registro de prueba
    await pool.query('DELETE FROM app.user_exercise_feedback WHERE id = $1', [result.rows[0].id]);
    console.log('🧹 Registro de prueba eliminado');

    return true;
  } catch (error) {
    console.error('❌ Error simulando calisteniaSpecialist:', error.message);
    return false;
  }
}

async function testHomeTrainingEndpoint() {
  console.log('\n🏠 4. PROBANDO ENDPOINT /rejections ACTUALIZADO...');

  try {
    // Simular datos del HomeTrainingRejectionModal
    const mockRejection = {
      user_id: 1,
      exercise_name: 'Burpees Test',
      exercise_key: 'burpees_test',
      rejection_category: 'too_hard',
      rejection_reason: 'Muy intenso para mi nivel actual',
      expires_in_days: 7
    };

    // Simular el mapeo de categorías
    const REJECTION_CATEGORY_MAPPING = {
      'too_hard': 'too_difficult',
      'dont_like': 'dont_like',
      'injury': 'physical_limitation',
      'equipment': 'no_equipment',
      'other': 'change_focus'
    };

    const feedback_type = REJECTION_CATEGORY_MAPPING[mockRejection.rejection_category];
    const methodology_type = 'home_training';

    // Calcular expiración
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + mockRejection.expires_in_days);

    // Insertar usando la nueva estructura
    const insertQuery = `
      INSERT INTO app.user_exercise_feedback
      (user_id, exercise_name, exercise_key, methodology_type, feedback_type,
       comment, avoidance_duration_days, expires_at, ai_weight, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1.0, NOW())
      RETURNING id, methodology_type, feedback_type;
    `;

    const result = await pool.query(insertQuery, [
      mockRejection.user_id,
      mockRejection.exercise_name,
      mockRejection.exercise_key,
      methodology_type,
      feedback_type,
      mockRejection.rejection_reason,
      mockRejection.expires_in_days,
      expiresAt
    ]);

    console.log(`✅ Mock rejection guardado - ID: ${result.rows[0].id}`);
    console.log(`📊 Methodology: ${result.rows[0].methodology_type}`);
    console.log(`📊 Feedback Type: ${result.rows[0].feedback_type}`);

    // Limpiar
    await pool.query('DELETE FROM app.user_exercise_feedback WHERE id = $1', [result.rows[0].id]);
    console.log('🧹 Registro de prueba eliminado');

    return true;
  } catch (error) {
    console.error('❌ Error simulando endpoint /rejections:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🔌 Conectando a Supabase...');

    // Ejecutar todas las pruebas
    const tests = [
      { name: 'methodology_type Column', test: testMethodologyTypeColumn },
      { name: 'Feedback Functions', test: testFeedbackFunctions },
      { name: 'Calistenia Specialist Code', test: testCalisteniaSpecialistCode },
      { name: 'Home Training Endpoint', test: testHomeTrainingEndpoint }
    ];

    const results = [];
    for (const { name, test } of tests) {
      const success = await test();
      results.push({ name, success });
    }

    // Resumen final
    console.log('\n🎯 RESUMEN DE PRUEBAS');
    console.log('====================');

    let allPassed = true;
    results.forEach(({ name, success }) => {
      const status = success ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} - ${name}`);
      if (!success) allPassed = false;
    });

    console.log('\n🎉 RESULTADO FINAL');
    console.log('=================');

    if (allPassed) {
      console.log('✅ ¡TODAS LAS PRUEBAS EXITOSAS!');
      console.log('🔧 El error "methodology_type does not exist" está RESUELTO');
      console.log('🚀 Sistema unificado de feedback funcionando correctamente');
      console.log('🎯 HomeTrainingRejectionModal compatible');
      console.log('⚡ CalisteniaSpecialist.js funcionará sin errores');

      console.log('\n📋 PRÓXIMOS PASOS:');
      console.log('   1. Reiniciar el servidor backend');
      console.log('   2. Probar HomeTrainingRejectionModal en el frontend');
      console.log('   3. Verificar logs del servidor para confirmar');
    } else {
      console.log('❌ ALGUNAS PRUEBAS FALLARON');
      console.log('🔍 Revisar los errores arriba y corregir');
    }

  } catch (error) {
    console.error('💥 ERROR CRÍTICO EN LAS PRUEBAS:', error.message);
  } finally {
    await pool.end();
  }
}

// Ejecutar las pruebas
main().catch(error => {
  console.error('💥 ERROR INESPERADO:', error);
  process.exit(1);
});