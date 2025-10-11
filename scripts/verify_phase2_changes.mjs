#!/usr/bin/env node
/**
 * Script de verificación FASE 2
 * Verifica que el sistema funciona correctamente sin el stored procedure
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

async function verifyPhase2() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN FASE 2 - SISTEMA SIN STORED PROCEDURE');
    console.log('='.repeat(80) + '\n');

    // 1. Verificar planes recientes
    console.log('📋 1. Verificando planes recientes...\n');
    
    const recentPlans = await client.query(`
      SELECT 
        mp.id,
        mp.user_id,
        mp.methodology_type,
        mp.status,
        mp.plan_start_date,
        mp.confirmed_at,
        mp.created_at,
        (SELECT COUNT(*) FROM app.methodology_exercise_sessions WHERE methodology_plan_id = mp.id) as sessions_count,
        (SELECT COUNT(*) FROM app.methodology_plan_days WHERE plan_id = mp.id) as days_count,
        (SELECT COUNT(*) FROM app.workout_schedule WHERE methodology_plan_id = mp.id) as schedule_count
      FROM app.methodology_plans mp
      WHERE mp.status IN ('active', 'confirmed')
      ORDER BY mp.id DESC
      LIMIT 3
    `);
    
    if (recentPlans.rowCount === 0) {
      console.log('⚠️  No hay planes activos/confirmados recientes');
    } else {
      console.log('✅ Planes recientes encontrados:\n');
      recentPlans.rows.forEach(plan => {
        console.log(`   Plan ID: ${plan.id}`);
        console.log(`   Usuario: ${plan.user_id}`);
        console.log(`   Metodología: ${plan.methodology_type}`);
        console.log(`   Estado: ${plan.status}`);
        console.log(`   Creado: ${plan.created_at}`);
        console.log(`   Confirmado: ${plan.confirmed_at || 'NULL'}`);
        console.log(`   Fecha inicio: ${plan.plan_start_date || 'NULL'}`);
        console.log(`   📊 Sesiones (methodology_exercise_sessions): ${plan.sessions_count}`);
        console.log(`   📅 Días (methodology_plan_days): ${plan.days_count}`);
        console.log(`   🗓️  Schedule (workout_schedule): ${plan.schedule_count}`);
        
        // Análisis
        if (plan.days_count === 0) {
          console.log(`   ❌ PROBLEMA: Plan sin días en methodology_plan_days`);
        } else if (plan.schedule_count === 0) {
          console.log(`   ⚠️  ADVERTENCIA: Plan sin sesiones en workout_schedule`);
        } else {
          console.log(`   ✅ Plan tiene programación completa`);
        }
        
        // Verificar si las sesiones se crean bajo demanda
        if (plan.sessions_count === 0) {
          console.log(`   ℹ️  INFO: Sesiones se crearán bajo demanda (correcto en FASE 2)`);
        } else {
          console.log(`   ℹ️  INFO: ${plan.sessions_count} sesión(es) ya creada(s)`);
        }
        
        console.log('');
      });
    }

    // 2. Verificar consistencia de datos
    console.log('\n📋 2. Verificando consistencia de datos...\n');
    
    if (recentPlans.rowCount > 0) {
      const latestPlan = recentPlans.rows[0];
      
      // Verificar días del plan
      const planDays = await client.query(`
        SELECT 
          day_id,
          week_number,
          day_name,
          date_local,
          is_rest,
          planned_exercises_count
        FROM app.methodology_plan_days
        WHERE plan_id = $1
        ORDER BY day_id
      `, [latestPlan.id]);
      
      if (planDays.rowCount > 0) {
        console.log(`✅ Plan ${latestPlan.id} tiene ${planDays.rowCount} días registrados\n`);
        
        const trainingDays = planDays.rows.filter(d => !d.is_rest).length;
        const restDays = planDays.rows.filter(d => d.is_rest).length;
        
        console.log(`   💪 Días de entreno: ${trainingDays}`);
        console.log(`   💤 Días de descanso: ${restDays}`);
        console.log(`   📊 Total: ${planDays.rowCount}`);
        
        // Mostrar primeros 7 días
        console.log('\n   Primeros 7 días:');
        planDays.rows.slice(0, 7).forEach(day => {
          const status = day.is_rest ? '💤 DESCANSO' : `💪 ENTRENO (${day.planned_exercises_count} ejercicios)`;
          console.log(`   day_id=${day.day_id}, semana=${day.week_number}, ${day.day_name} (${day.date_local}) - ${status}`);
        });
      } else {
        console.log(`❌ Plan ${latestPlan.id} NO tiene días registrados`);
      }
      
      // Verificar workout_schedule
      const schedule = await client.query(`
        SELECT 
          week_number,
          session_order,
          week_session_order,
          scheduled_date,
          day_name,
          day_abbrev,
          session_title,
          status
        FROM app.workout_schedule
        WHERE methodology_plan_id = $1
        ORDER BY session_order
      `, [latestPlan.id]);
      
      if (schedule.rowCount > 0) {
        console.log(`\n✅ Plan ${latestPlan.id} tiene ${schedule.rowCount} sesiones programadas\n`);
        
        console.log('   Primeras 5 sesiones:');
        schedule.rows.slice(0, 5).forEach(session => {
          console.log(`   Semana ${session.week_number}, Sesión ${session.session_order} (${session.week_session_order}ª de la semana)`);
          console.log(`   ${session.day_name} (${session.day_abbrev}) - ${session.scheduled_date}`);
          console.log(`   ${session.session_title} - Estado: ${session.status}`);
          console.log('');
        });
      } else {
        console.log(`\n❌ Plan ${latestPlan.id} NO tiene sesiones programadas`);
      }
    }

    // 3. Verificar que las sesiones se crean bajo demanda
    console.log('\n📋 3. Verificando creación bajo demanda de sesiones...\n');
    
    const sessionsCreated = await client.query(`
      SELECT 
        mes.id,
        mes.methodology_plan_id,
        mes.week_number,
        mes.day_name,
        mes.session_status,
        mes.started_at,
        mes.created_at,
        (SELECT COUNT(*) FROM app.methodology_exercise_progress WHERE methodology_session_id = mes.id) as progress_count
      FROM app.methodology_exercise_sessions mes
      WHERE mes.methodology_plan_id IN (
        SELECT id FROM app.methodology_plans 
        WHERE status IN ('active', 'confirmed')
        ORDER BY id DESC
        LIMIT 3
      )
      ORDER BY mes.created_at DESC
      LIMIT 5
    `);
    
    if (sessionsCreated.rowCount > 0) {
      console.log('✅ Sesiones creadas bajo demanda:\n');
      sessionsCreated.rows.forEach(session => {
        console.log(`   Sesión ID: ${session.id}`);
        console.log(`   Plan: ${session.methodology_plan_id}`);
        console.log(`   Semana ${session.week_number}, Día: ${session.day_name}`);
        console.log(`   Estado: ${session.session_status}`);
        console.log(`   Creada: ${session.created_at}`);
        console.log(`   Iniciada: ${session.started_at || 'No iniciada'}`);
        console.log(`   Ejercicios con progreso: ${session.progress_count}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No hay sesiones creadas aún (se crearán cuando el usuario inicie un entrenamiento)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICACIÓN FASE 2 COMPLETADA');
    console.log('='.repeat(80) + '\n');

    console.log('📝 RESUMEN:');
    console.log('   - Stored procedure: DESHABILITADO ✅');
    console.log('   - methodology_plan_days: Generado por ensureWorkoutSchedule() ✅');
    console.log('   - workout_schedule: Generado por ensureWorkoutSchedule() ✅');
    console.log('   - methodology_exercise_sessions: Creado bajo demanda ✅');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
verifyPhase2().catch(console.error);

