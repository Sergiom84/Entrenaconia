// Script para verificar que la solución de activación funciona correctamente
import { pool } from './db.js';

async function testActivationFix() {
  const client = await pool.connect();

  try {
    console.log('=== PRUEBA DE SOLUCIÓN DE ACTIVACIÓN ===\n');

    // 1. Simular activación de un plan draft
    console.log('📋 PASO 1: Buscando un plan en estado draft para probar...');
    const draftPlanQuery = await client.query(`
      SELECT id, user_id, methodology_type, status
      FROM app.methodology_plans
      WHERE status = 'draft'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (draftPlanQuery.rowCount === 0) {
      console.log('❌ No hay planes en estado draft para probar');
      return;
    }

    const testPlan = draftPlanQuery.rows[0];
    console.log('✅ Plan encontrado:', {
      id: testPlan.id,
      user_id: testPlan.user_id,
      type: testPlan.methodology_type,
      status: testPlan.status
    });

    // 2. Simular llamada a activate_plan_atomic
    console.log('\n📋 PASO 2: Probando función activate_plan_atomic...');

    // Primero verificar que la función existe
    const functionCheck = await client.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'activate_plan_atomic'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
    `);

    if (functionCheck.rowCount === 0) {
      console.log('❌ La función activate_plan_atomic no existe en el schema app');
      console.log('💡 Necesitas crear esta función en la base de datos');
      return;
    }

    console.log('✅ Función activate_plan_atomic encontrada');

    // 3. Activar el plan
    console.log('\n📋 PASO 3: Activando el plan...');
    await client.query('BEGIN');

    try {
      const activationResult = await client.query(
        'SELECT app.activate_plan_atomic($1, $2, $3) as success',
        [testPlan.user_id, testPlan.id, null]
      );

      const success = activationResult.rows[0]?.success;

      if (success) {
        console.log('✅ Plan activado exitosamente');

        // Verificar el nuevo estado
        const verifyQuery = await client.query(
          'SELECT status, confirmed_at FROM app.methodology_plans WHERE id = $1',
          [testPlan.id]
        );

        const updatedPlan = verifyQuery.rows[0];
        console.log('📊 Estado actualizado:', {
          status: updatedPlan.status,
          confirmed_at: updatedPlan.confirmed_at ? 'Sí' : 'No'
        });

        // 4. Probar endpoint active-plan
        console.log('\n📋 PASO 4: Simulando consulta de active-plan...');
        const activePlanQuery = await client.query(`
          SELECT id as methodology_plan_id, methodology_type, plan_data,
                 confirmed_at, created_at, 'methodology' as source, status
          FROM app.methodology_plans
          WHERE user_id = $1 AND status = 'active'
          ORDER BY confirmed_at DESC
          LIMIT 1`,
          [testPlan.user_id]
        );

        if (activePlanQuery.rowCount > 0) {
          console.log('✅ El endpoint active-plan ahora encontraría este plan:', {
            id: activePlanQuery.rows[0].methodology_plan_id,
            status: activePlanQuery.rows[0].status,
            type: activePlanQuery.rows[0].methodology_type
          });
        } else {
          console.log('❌ El endpoint active-plan NO encontraría el plan');
        }

        // Revertir cambios (es solo una prueba)
        await client.query('ROLLBACK');
        console.log('\n⚠️ Cambios revertidos (era solo una prueba)');

      } else {
        console.log('❌ La función activate_plan_atomic devolvió false');
        await client.query('ROLLBACK');
      }

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error activando plan:', error.message);
    }

    // 5. Verificar que no hay planes huérfanos (activos sin confirmación)
    console.log('\n📋 PASO 5: Verificando integridad de datos...');
    const orphanedPlansQuery = await client.query(`
      SELECT COUNT(*) as count
      FROM app.methodology_plans
      WHERE status = 'active' AND confirmed_at IS NULL
    `);

    const orphanedCount = parseInt(orphanedPlansQuery.rows[0].count);
    if (orphanedCount > 0) {
      console.log(`⚠️ Hay ${orphanedCount} planes activos sin fecha de confirmación`);
    } else {
      console.log('✅ No hay planes activos sin fecha de confirmación');
    }

    // 6. Resumen final
    console.log('\n=== RESUMEN DE LA SOLUCIÓN ===');
    console.log('1. ✅ El problema identificado: Los planes se creaban en draft pero nunca se activaban');
    console.log('2. ✅ La solución: Llamar a confirm-and-activate antes de iniciar la sesión');
    console.log('3. ✅ El resultado esperado: El plan tendrá status="active" y active-plan lo encontrará');
    console.log('\n💡 RECOMENDACIÓN: Ahora cuando el usuario haga clic en "Comenzar Entrenamiento":');
    console.log('   - Primero se activará el plan (status: draft → active)');
    console.log('   - Luego se iniciará la sesión de entrenamiento');
    console.log('   - Al completar la sesión y navegar a /routines, active-plan encontrará el plan');

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

testActivationFix();