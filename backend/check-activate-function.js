// Script para verificar y corregir la función activate_plan_atomic
import { pool } from './db.js';

async function checkActivateFunction() {
  const client = await pool.connect();

  try {
    console.log('=== VERIFICACIÓN DE FUNCIÓN activate_plan_atomic ===\n');

    // 1. Obtener definición actual de la función
    const functionDefQuery = await client.query(`
      SELECT
        proname as function_name,
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'activate_plan_atomic'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
    `);

    if (functionDefQuery.rowCount > 0) {
      console.log('📄 Definición actual de la función:');
      console.log(functionDefQuery.rows[0].definition);
      console.log('\n');
    } else {
      console.log('❌ La función no existe');
    }

    // 2. Verificar qué tablas existen
    console.log('📊 Tablas en el schema app:');
    const tablesQuery = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      ORDER BY table_name
    `);

    tablesQuery.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // 3. Crear o reemplazar la función corregida
    console.log('\n🔧 Creando versión corregida de activate_plan_atomic...');

    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION app.activate_plan_atomic(
        p_user_id INTEGER,
        p_methodology_plan_id INTEGER,
        p_routine_plan_id INTEGER DEFAULT NULL
      ) RETURNS BOOLEAN AS $$
      BEGIN
        -- 1. Cancelar cualquier plan activo previo del usuario
        UPDATE app.methodology_plans
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE user_id = p_user_id
          AND status = 'active'
          AND id != p_methodology_plan_id;

        -- 2. Activar el nuevo plan de metodología
        UPDATE app.methodology_plans
        SET status = 'active',
            confirmed_at = COALESCE(confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = p_methodology_plan_id
          AND user_id = p_user_id
          AND status IN ('draft', 'active'); -- Permitir reactivación

        -- Verificar que se actualizó
        IF NOT FOUND THEN
          RETURN FALSE;
        END IF;

        -- 3. Actualizar sesiones de ejercicio asociadas si existen
        UPDATE app.methodology_exercise_sessions
        SET session_status = CASE
              WHEN session_status = 'completed' THEN 'completed'
              ELSE 'pending'
            END,
            updated_at = NOW()
        WHERE methodology_plan_id = p_methodology_plan_id
          AND user_id = p_user_id;

        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await client.query(createFunctionSQL);
    console.log('✅ Función activate_plan_atomic creada/actualizada correctamente');

    // 4. Probar la función con un plan draft
    console.log('\n🧪 Probando la función corregida...');
    const testPlanQuery = await client.query(`
      SELECT id, user_id, status
      FROM app.methodology_plans
      WHERE status = 'draft'
      LIMIT 1
    `);

    if (testPlanQuery.rowCount > 0) {
      const testPlan = testPlanQuery.rows[0];
      console.log('Plan de prueba:', testPlan);

      await client.query('BEGIN');
      try {
        const result = await client.query(
          'SELECT app.activate_plan_atomic($1, $2, NULL) as success',
          [testPlan.user_id, testPlan.id]
        );

        if (result.rows[0].success) {
          console.log('✅ Función ejecutada exitosamente');

          // Verificar el cambio
          const verifyQuery = await client.query(
            'SELECT status, confirmed_at FROM app.methodology_plans WHERE id = $1',
            [testPlan.id]
          );

          console.log('Estado después de activación:', verifyQuery.rows[0]);
        } else {
          console.log('❌ La función retornó false');
        }

        await client.query('ROLLBACK');
        console.log('⚠️ Cambios revertidos (era solo una prueba)');

      } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en prueba:', error.message);
      }
    }

    // 5. También crear función confirm_routine_plan si no existe
    console.log('\n🔧 Verificando función confirm_routine_plan...');
    const confirmFunctionCheck = await client.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'confirm_routine_plan'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
    `);

    if (confirmFunctionCheck.rowCount === 0) {
      console.log('Creando función confirm_routine_plan...');

      const createConfirmSQL = `
        CREATE OR REPLACE FUNCTION app.confirm_routine_plan(
          p_user_id INTEGER,
          p_methodology_plan_id INTEGER,
          p_routine_plan_id INTEGER DEFAULT NULL
        ) RETURNS BOOLEAN AS $$
        BEGIN
          -- Simplemente delegar a activate_plan_atomic
          RETURN app.activate_plan_atomic(p_user_id, p_methodology_plan_id, p_routine_plan_id);
        END;
        $$ LANGUAGE plpgsql;
      `;

      await client.query(createConfirmSQL);
      console.log('✅ Función confirm_routine_plan creada');
    } else {
      console.log('✅ Función confirm_routine_plan ya existe');
    }

    console.log('\n✅ TODAS LAS FUNCIONES ESTÁN LISTAS');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkActivateFunction();