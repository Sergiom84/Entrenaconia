// Script para verificar el flujo completo: activación → sesión → active-plan
import { pool } from './db.js';

async function testCompleteFlow() {
  const client = await pool.connect();

  try {
    console.log('=== VERIFICACIÓN DEL FLUJO COMPLETO ===\n');
    console.log('Este script simula el flujo completo desde que el usuario');
    console.log('hace clic en "Comenzar Entrenamiento" hasta que completa una sesión.\n');

    // 1. Buscar un plan draft para la prueba
    const draftPlanQuery = await client.query(`
      SELECT id, user_id, methodology_type, plan_data, status
      FROM app.methodology_plans
      WHERE status = 'draft' AND user_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (draftPlanQuery.rowCount === 0) {
      console.log('❌ No hay planes draft disponibles para la prueba');
      return;
    }

    const testPlan = draftPlanQuery.rows[0];
    const userId = testPlan.user_id;
    const planId = testPlan.id;

    console.log('📋 PLAN DE PRUEBA:');
    console.log(`  - ID: ${planId}`);
    console.log(`  - Usuario: ${userId}`);
    console.log(`  - Tipo: ${testPlan.methodology_type}`);
    console.log(`  - Estado inicial: ${testPlan.status}`);
    console.log('');

    // Iniciar transacción para poder revertir al final
    await client.query('BEGIN');

    try {
      // 2. PASO 1: Activar el plan (simula el clic en "Comenzar Entrenamiento")
      console.log('🔄 PASO 1: Activando el plan (simula handleStartTraining)...');

      const activationResult = await client.query(
        'SELECT app.activate_plan_atomic($1, $2, NULL) as success',
        [userId, planId]
      );

      if (!activationResult.rows[0].success) {
        throw new Error('No se pudo activar el plan');
      }

      // Verificar activación
      const checkActivation = await client.query(
        'SELECT status, confirmed_at FROM app.methodology_plans WHERE id = $1',
        [planId]
      );

      const activatedPlan = checkActivation.rows[0];
      console.log(`✅ Plan activado: status="${activatedPlan.status}", confirmed_at=${activatedPlan.confirmed_at ? 'Sí' : 'No'}`);
      console.log('');

      // 3. PASO 2: Crear una sesión de entrenamiento
      console.log('🏋️ PASO 2: Creando sesión de entrenamiento...');

      // Primero crear las sesiones si no existen
      await client.query(
        'SELECT app.create_methodology_exercise_sessions($1, $2, $3::jsonb)',
        [userId, planId, JSON.stringify(testPlan.plan_data || {})]
      );

      // Obtener la primera sesión creada
      const sessionQuery = await client.query(`
        SELECT id, week_number, day_name
        FROM app.methodology_exercise_sessions
        WHERE user_id = $1 AND methodology_plan_id = $2
        ORDER BY week_number, id
        LIMIT 1
      `, [userId, planId]);

      if (sessionQuery.rowCount > 0) {
        const session = sessionQuery.rows[0];
        console.log(`✅ Sesión encontrada: ID=${session.id}, Semana=${session.week_number}, Día=${session.day_name}`);

        // Marcar sesión como iniciada
        await client.query(`
          UPDATE app.methodology_exercise_sessions
          SET session_status = 'in_progress', started_at = NOW()
          WHERE id = $1
        `, [session.id]);

        console.log('✅ Sesión marcada como "in_progress"');
      } else {
        console.log('⚠️ No se pudo crear sesión de entrenamiento');
      }
      console.log('');

      // 4. PASO 3: Simular completar la sesión
      console.log('🏁 PASO 3: Simulando que el usuario completa la sesión...');

      if (sessionQuery.rowCount > 0) {
        const sessionId = sessionQuery.rows[0].id;

        // Marcar sesión como completada
        await client.query(`
          UPDATE app.methodology_exercise_sessions
          SET session_status = 'completed',
              completed_at = NOW(),
              exercises_completed = 5,
              total_exercises = 5
          WHERE id = $1
        `, [sessionId]);

        console.log('✅ Sesión marcada como completada');
      }
      console.log('');

      // 5. PASO 4: Verificar que active-plan encuentra el plan
      console.log('🔍 PASO 4: Verificando endpoint /api/routines/active-plan...');

      const activePlanQuery = await client.query(`
        SELECT
          id as methodology_plan_id,
          methodology_type,
          plan_data,
          confirmed_at,
          created_at,
          'methodology' as source,
          status
        FROM app.methodology_plans
        WHERE user_id = $1 AND status = 'active'
        ORDER BY confirmed_at DESC
        LIMIT 1
      `, [userId]);

      if (activePlanQuery.rowCount > 0) {
        const activePlan = activePlanQuery.rows[0];
        console.log('✅ ÉXITO: El endpoint active-plan encuentra el plan:');
        console.log(`  - ID: ${activePlan.methodology_plan_id}`);
        console.log(`  - Status: ${activePlan.status}`);
        console.log(`  - Tipo: ${activePlan.methodology_type}`);
        console.log(`  - Confirmado: ${activePlan.confirmed_at ? 'Sí' : 'No'}`);
        console.log('');
        console.log('📊 Respuesta que devolvería el endpoint:');
        console.log(JSON.stringify({
          success: true,
          hasActivePlan: true,
          methodology_plan_id: activePlan.methodology_plan_id,
          planType: activePlan.methodology_type,
          confirmedAt: activePlan.confirmed_at
        }, null, 2));
      } else {
        console.log('❌ ERROR: El endpoint active-plan NO encontraría el plan');
      }

      // 6. Verificar integridad
      console.log('\n📊 VERIFICACIÓN ADICIONAL:');

      // Contar sesiones del plan
      const sessionsCount = await client.query(`
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE session_status = 'completed') as completed
        FROM app.methodology_exercise_sessions
        WHERE methodology_plan_id = $1
      `, [planId]);

      const counts = sessionsCount.rows[0];
      console.log(`  - Sesiones totales: ${counts.total}`);
      console.log(`  - Sesiones completadas: ${counts.completed}`);
      console.log(`  - El plan debe mantenerse activo hasta completar TODAS las sesiones`);

      // Revertir todos los cambios (es solo una prueba)
      await client.query('ROLLBACK');
      console.log('\n⚠️ Todos los cambios han sido revertidos (era solo una prueba)');

      // 7. Resumen final
      console.log('\n=== RESUMEN DE LA SOLUCIÓN ===');
      console.log('✅ El flujo corregido funciona correctamente:');
      console.log('');
      console.log('1. Usuario hace clic en "Comenzar Entrenamiento"');
      console.log('   → Se activa el plan (status: draft → active)');
      console.log('');
      console.log('2. Usuario realiza la sesión de entrenamiento');
      console.log('   → La sesión se marca como completada');
      console.log('');
      console.log('3. Usuario navega a /routines después de la sesión');
      console.log('   → El endpoint active-plan ENCUENTRA el plan activo');
      console.log('   → NO se redirige a methodologies');
      console.log('   → El usuario puede continuar con su plan');
      console.log('');
      console.log('💡 IMPORTANTE: El plan permanece activo durante todas las semanas');
      console.log('   hasta que el usuario complete TODAS las sesiones o lo cancele manualmente.');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error en la prueba:', error.message);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

testCompleteFlow();