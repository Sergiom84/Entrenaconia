/**
 * Script de corrección: Plan 26 activo cuando debería estar cancelado
 * Usuario: 18
 * Fecha: 2025-10-06
 *
 * Este script:
 * 1. Verifica el estado actual del plan 26
 * 2. Lo marca como cancelado
 * 3. Limpia workout_schedule y methodology_plan_days
 * 4. Audita otros planes potencialmente huérfanos
 */

import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixPlan26() {
  const client = await pool.connect();

  try {
    await client.query('SET search_path TO app, public');

    console.log('='.repeat(80));
    console.log('🔧 INICIANDO CORRECCIÓN DEL PLAN 26');
    console.log('='.repeat(80));

    // ========================================================================
    // PASO 1: VERIFICAR ESTADO ACTUAL
    // ========================================================================
    console.log('\n📊 PASO 1: VERIFICANDO ESTADO ACTUAL DEL PLAN 26\n');

    const planStatus = await client.query(
      `SELECT
        id,
        user_id,
        methodology_type,
        status,
        created_at,
        updated_at,
        cancelled_at,
        completed_at
       FROM app.methodology_plans
       WHERE id = 26 AND user_id = 18`
    );

    if (planStatus.rowCount === 0) {
      console.log('⚠️  Plan 26 no encontrado. Nada que corregir.');
      return;
    }

    const plan = planStatus.rows[0];
    console.log('Plan 26 encontrado:');
    console.log(`  - Status: ${plan.status}`);
    console.log(`  - Methodology: ${plan.methodology_type}`);
    console.log(`  - Created: ${plan.created_at}`);
    console.log(`  - Updated: ${plan.updated_at}`);
    console.log(`  - Cancelled: ${plan.cancelled_at || 'NULL'}`);

    if (plan.status === 'cancelled') {
      console.log('\n✅ El plan ya está cancelado. Verificando consistencia...\n');
    } else {
      console.log(`\n❌ PROBLEMA DETECTADO: Plan status='${plan.status}' (debería ser 'cancelled')\n`);
    }

    // Verificar sesiones
    const sessions = await client.query(
      `SELECT
        id,
        session_status,
        day_name,
        week_number,
        started_at,
        cancelled_at,
        is_current_session
       FROM app.methodology_exercise_sessions
       WHERE methodology_plan_id = 26`
    );

    console.log(`Sesiones asociadas: ${sessions.rowCount}`);
    sessions.rows.forEach(s => {
      console.log(`  - Sesión ${s.id}: ${s.session_status} (${s.day_name}, Week ${s.week_number})`);
    });

    // Verificar workout_schedule
    const workoutSchedule = await client.query(
      `SELECT COUNT(*) as total
       FROM app.workout_schedule
       WHERE methodology_plan_id = 26`
    );

    console.log(`\nWorkout schedule: ${workoutSchedule.rows[0].total} días programados`);

    // Verificar methodology_plan_days
    const planDays = await client.query(
      `SELECT COUNT(*) as total
       FROM app.methodology_plan_days
       WHERE plan_id = 26`
    );

    console.log(`Plan days: ${planDays.rows[0].total} días generados`);

    // ========================================================================
    // PASO 2: CORRECCIÓN
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔧 PASO 2: APLICANDO CORRECCIÓN');
    console.log('='.repeat(80) + '\n');

    await client.query('BEGIN');

    try {
      // 2.1. Actualizar plan a cancelado
      if (plan.status !== 'cancelled') {
        console.log('📝 Actualizando plan 26 a status=cancelled...');
        await client.query(
          `UPDATE app.methodology_plans
           SET
             status = 'cancelled',
             cancelled_at = NOW(),
             updated_at = NOW()
           WHERE id = 26 AND user_id = 18`
        );
        console.log('✅ Plan 26 marcado como cancelled');
      } else {
        console.log('ℹ️  Plan ya estaba cancelado, actualizando cancelled_at...');
        await client.query(
          `UPDATE app.methodology_plans
           SET
             cancelled_at = COALESCE(cancelled_at, NOW()),
             updated_at = NOW()
           WHERE id = 26 AND user_id = 18`
        );
      }

      // 2.2. Limpiar workout_schedule
      console.log('\n🧹 Limpiando workout_schedule...');
      const deletedSchedule = await client.query(
        `DELETE FROM app.workout_schedule
         WHERE methodology_plan_id = 26 AND user_id = 18
         RETURNING id`
      );
      console.log(`✅ Eliminados ${deletedSchedule.rowCount} días de workout_schedule`);

      // 2.3. Limpiar methodology_plan_days
      console.log('\n🧹 Limpiando methodology_plan_days...');
      const deletedDays = await client.query(
        `DELETE FROM app.methodology_plan_days
         WHERE plan_id = 26
         RETURNING plan_id`
      );
      console.log(`✅ Eliminados ${deletedDays.rowCount} días de plan_days`);

      await client.query('COMMIT');
      console.log('\n✅ TRANSACCIÓN COMPLETADA EXITOSAMENTE\n');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ ERROR EN LA CORRECCIÓN:', error.message);
      throw error;
    }

    // ========================================================================
    // PASO 3: VERIFICACIÓN POST-CORRECCIÓN
    // ========================================================================
    console.log('='.repeat(80));
    console.log('✅ PASO 3: VERIFICACIÓN POST-CORRECCIÓN');
    console.log('='.repeat(80) + '\n');

    const verifyPlan = await client.query(
      `SELECT status, cancelled_at, updated_at
       FROM app.methodology_plans
       WHERE id = 26`
    );

    if (verifyPlan.rowCount > 0) {
      const p = verifyPlan.rows[0];
      console.log('Plan 26 después de corrección:');
      console.log(`  - Status: ${p.status}`);
      console.log(`  - Cancelled at: ${p.cancelled_at}`);
      console.log(`  - Updated at: ${p.updated_at}`);

      if (p.status === 'cancelled' && p.cancelled_at) {
        console.log('\n✅ CORRECCIÓN EXITOSA\n');
      } else {
        console.log('\n⚠️  ADVERTENCIA: Verifica manualmente el estado del plan\n');
      }
    }

    // ========================================================================
    // PASO 4: AUDITORÍA DE OTROS PLANES HUÉRFANOS
    // ========================================================================
    console.log('='.repeat(80));
    console.log('🔍 PASO 4: AUDITORÍA DE OTROS PLANES HUÉRFANOS');
    console.log('='.repeat(80) + '\n');

    const orphanPlans = await client.query(
      `SELECT
        mp.id as plan_id,
        mp.user_id,
        mp.status as plan_status,
        mp.methodology_type,
        mp.created_at,
        COUNT(DISTINCT mes.id) as total_sessions,
        COUNT(DISTINCT CASE WHEN mes.session_status = 'cancelled' THEN mes.id END) as cancelled_sessions,
        COUNT(DISTINCT CASE WHEN mes.session_status IN ('active', 'pending', 'in_progress') THEN mes.id END) as active_sessions
       FROM app.methodology_plans mp
       LEFT JOIN app.methodology_exercise_sessions mes ON mp.id = mes.methodology_plan_id
       WHERE mp.status = 'active'
       GROUP BY mp.id, mp.user_id, mp.status, mp.methodology_type, mp.created_at
       HAVING COUNT(DISTINCT mes.id) > 0
          AND COUNT(DISTINCT mes.id) = COUNT(DISTINCT CASE WHEN mes.session_status = 'cancelled' THEN mes.id END)
       ORDER BY mp.user_id, mp.created_at DESC`
    );

    if (orphanPlans.rowCount > 0) {
      console.log(`⚠️  ENCONTRADOS ${orphanPlans.rowCount} PLANES HUÉRFANOS:\n`);
      orphanPlans.rows.forEach(p => {
        console.log(`  Plan ID ${p.plan_id}:`);
        console.log(`    - Usuario: ${p.user_id}`);
        console.log(`    - Tipo: ${p.methodology_type}`);
        console.log(`    - Status: ${p.plan_status}`);
        console.log(`    - Sesiones: ${p.total_sessions} total, ${p.cancelled_sessions} canceladas`);
        console.log('');
      });
      console.log('⚠️  RECOMENDACIÓN: Ejecutar corrección masiva con FIX_PLAN_26.sql (Paso 5)\n');
    } else {
      console.log('✅ No se encontraron otros planes huérfanos\n');
    }

    // ========================================================================
    // PASO 5: VERIFICAR USUARIO 18
    // ========================================================================
    console.log('='.repeat(80));
    console.log('👤 PASO 5: VERIFICANDO TODOS LOS PLANES DEL USUARIO 18');
    console.log('='.repeat(80) + '\n');

    const user18Plans = await client.query(
      `SELECT
        id,
        methodology_type,
        status,
        created_at,
        cancelled_at
       FROM app.methodology_plans
       WHERE user_id = 18
       ORDER BY created_at DESC
       LIMIT 10`
    );

    console.log(`Total planes del usuario 18: ${user18Plans.rowCount}\n`);
    user18Plans.rows.forEach((p, idx) => {
      const statusIcon = p.status === 'cancelled' ? '✅' : p.status === 'active' ? '🔴' : 'ℹ️';
      console.log(`${idx + 1}. ${statusIcon} Plan ${p.id} (${p.methodology_type})`);
      console.log(`   Status: ${p.status} | Created: ${p.created_at.toISOString().split('T')[0]}`);
    });

    const activePlansCount = await client.query(
      `SELECT COUNT(*) as count
       FROM app.methodology_plans
       WHERE user_id = 18 AND status = 'active'`
    );

    console.log(`\nPlanes activos del usuario 18: ${activePlansCount.rows[0].count}`);

    if (activePlansCount.rows[0].count === '0') {
      console.log('✅ CORRECTO: No hay planes activos\n');
    } else {
      console.log('⚠️  ADVERTENCIA: Aún hay planes activos. Verifica manualmente.\n');
    }

    // ========================================================================
    // RESUMEN FINAL
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📋 RESUMEN DE LA CORRECCIÓN');
    console.log('='.repeat(80) + '\n');
    console.log('✅ Plan 26 marcado como cancelled');
    console.log('✅ Workout schedule limpiado');
    console.log('✅ Plan days limpiado');
    console.log('✅ Auditoría completada');
    console.log('\n' + '='.repeat(80));
    console.log('🎉 CORRECCIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar el script
fixPlan26()
  .then(() => {
    console.log('\n✅ Script finalizado exitosamente\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script finalizado con errores:', error.message, '\n');
    process.exit(1);
  });
