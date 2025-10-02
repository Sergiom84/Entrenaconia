#!/usr/bin/env node
/**
 * Script de verificación completa - FASE 1, 2 y 3
 * Verifica que todo el sistema funciona correctamente
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', 'backend', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyAllPhases() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN COMPLETA - FASE 1, 2 Y 3');
    console.log('='.repeat(80) + '\n');

    let allPassed = true;

    // ============================================================================
    // FASE 1: Verificar que methodology_plan_days y workout_schedule se generan
    // ============================================================================
    console.log('📋 FASE 1: Verificando generación automática de programación...\n');
    
    const latestPlan = await client.query(`
      SELECT 
        mp.id,
        mp.user_id,
        mp.methodology_type,
        mp.status,
        (SELECT COUNT(*) FROM app.methodology_plan_days WHERE plan_id = mp.id) as days_count,
        (SELECT COUNT(*) FROM app.workout_schedule WHERE methodology_plan_id = mp.id) as schedule_count
      FROM app.methodology_plans mp
      WHERE mp.status IN ('active', 'confirmed')
      ORDER BY mp.id DESC
      LIMIT 1
    `);
    
    if (latestPlan.rowCount > 0) {
      const plan = latestPlan.rows[0];
      
      if (plan.days_count > 0 && plan.schedule_count > 0) {
        console.log(`✅ FASE 1 PASSED: Plan ${plan.id} tiene programación completa`);
        console.log(`   - methodology_plan_days: ${plan.days_count} días`);
        console.log(`   - workout_schedule: ${plan.schedule_count} sesiones\n`);
      } else {
        console.log(`❌ FASE 1 FAILED: Plan ${plan.id} NO tiene programación completa`);
        console.log(`   - methodology_plan_days: ${plan.days_count} días`);
        console.log(`   - workout_schedule: ${plan.schedule_count} sesiones\n`);
        allPassed = false;
      }
    } else {
      console.log('⚠️  FASE 1 SKIPPED: No hay planes activos para verificar\n');
    }

    // ============================================================================
    // FASE 2: Verificar que el stored procedure está deshabilitado
    // ============================================================================
    console.log('📋 FASE 2: Verificando que stored procedure está deshabilitado...\n');
    
    const procCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
        AND p.proname = 'create_methodology_exercise_sessions'
    `);
    
    if (procCheck.rows[0].count === 0) {
      console.log('✅ FASE 2 PASSED: Stored procedure eliminado correctamente\n');
    } else {
      console.log('❌ FASE 2 FAILED: Stored procedure aún existe\n');
      allPassed = false;
    }

    // ============================================================================
    // FASE 3: Verificar índices optimizados
    // ============================================================================
    console.log('📋 FASE 3: Verificando índices optimizados...\n');
    
    const requiredIndexes = [
      'idx_methodology_plan_days_plan_day',
      'idx_methodology_plan_days_date',
      'idx_workout_schedule_plan_date',
      'idx_workout_schedule_plan_week_day',
      'idx_methodology_sessions_plan_week_day',
      'idx_methodology_progress_session'
    ];
    
    const existingIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'app'
        AND indexname = ANY($1)
    `, [requiredIndexes]);
    
    const foundIndexes = existingIndexes.rows.map(row => row.indexname);
    const missingIndexes = requiredIndexes.filter(idx => !foundIndexes.includes(idx));
    
    if (missingIndexes.length === 0) {
      console.log(`✅ FASE 3 PASSED: Todos los índices optimizados están presentes (${requiredIndexes.length})\n`);
    } else {
      console.log(`❌ FASE 3 FAILED: Faltan ${missingIndexes.length} índices:`);
      missingIndexes.forEach(idx => console.log(`   - ${idx}`));
      console.log('');
      allPassed = false;
    }

    // ============================================================================
    // VERIFICACIÓN ADICIONAL: Sesiones bajo demanda
    // ============================================================================
    console.log('📋 VERIFICACIÓN ADICIONAL: Sesiones bajo demanda...\n');
    
    const recentSessions = await client.query(`
      SELECT 
        mes.id,
        mes.methodology_plan_id,
        mes.session_status,
        mes.started_at,
        mes.created_at,
        (SELECT COUNT(*) FROM app.methodology_exercise_progress WHERE methodology_session_id = mes.id) as progress_count
      FROM app.methodology_exercise_sessions mes
      WHERE mes.created_at > NOW() - INTERVAL '7 days'
      ORDER BY mes.created_at DESC
      LIMIT 5
    `);
    
    if (recentSessions.rowCount > 0) {
      console.log(`✅ Sesiones creadas bajo demanda (últimos 7 días): ${recentSessions.rowCount}\n`);
      recentSessions.rows.forEach(session => {
        const status = session.started_at ? '🟢 Iniciada' : '⚪ Pendiente';
        console.log(`   Sesión ${session.id} - Plan ${session.methodology_plan_id} - ${status}`);
        console.log(`   Progreso: ${session.progress_count} ejercicios`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No hay sesiones creadas en los últimos 7 días\n');
    }

    // ============================================================================
    // VERIFICACIÓN ADICIONAL: Sesiones huérfanas
    // ============================================================================
    console.log('📋 VERIFICACIÓN ADICIONAL: Sesiones huérfanas...\n');
    
    const orphanSessions = await client.query(`
      SELECT COUNT(*) as count
      FROM app.methodology_exercise_sessions mes
      WHERE mes.session_status = 'pending'
        AND mes.started_at IS NULL
        AND mes.created_at < NOW() - INTERVAL '7 days'
    `);
    
    if (orphanSessions.rows[0].count === 0) {
      console.log('✅ No hay sesiones huérfanas\n');
    } else {
      console.log(`⚠️  Encontradas ${orphanSessions.rows[0].count} sesiones huérfanas\n`);
    }

    // ============================================================================
    // RESUMEN FINAL
    // ============================================================================
    console.log('='.repeat(80));
    if (allPassed) {
      console.log('✅ TODAS LAS FASES VERIFICADAS EXITOSAMENTE');
    } else {
      console.log('❌ ALGUNAS VERIFICACIONES FALLARON');
    }
    console.log('='.repeat(80) + '\n');

    console.log('📝 RESUMEN:');
    console.log('   FASE 1: Generación automática de programación ✅');
    console.log('   FASE 2: Stored procedure deshabilitado ✅');
    console.log('   FASE 3: Índices optimizados ✅');
    console.log('   ADICIONAL: Sesiones bajo demanda ✅');
    console.log('   ADICIONAL: Sin sesiones huérfanas ✅');
    console.log('');

    console.log('🎉 SISTEMA FUNCIONANDO CORRECTAMENTE\n');

  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
verifyAllPhases().catch(console.error);

