#!/usr/bin/env node
/**
 * Script de verificación FASE 1
 * Verifica que los cambios de FASE 1 se aplicaron correctamente
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

async function verifyPhase1() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN FASE 1 - CAMBIOS IMPLEMENTADOS');
    console.log('='.repeat(80) + '\n');

    // 1. Verificar que las tablas existen
    console.log('📋 1. Verificando estructura de tablas...\n');
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app' 
        AND table_name IN ('methodology_plan_days', 'workout_schedule', 'methodology_exercise_sessions')
      ORDER BY table_name
    `);
    
    console.log('✅ Tablas encontradas:');
    tablesCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // 2. Verificar columnas de methodology_plan_days
    console.log('\n📋 2. Verificando columnas de methodology_plan_days...\n');
    
    const columnsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'app' 
        AND table_name = 'methodology_plan_days'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Columnas de methodology_plan_days:');
    columnsCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // 3. Verificar planes existentes
    console.log('\n📋 3. Verificando planes existentes...\n');
    
    const plansCheck = await client.query(`
      SELECT 
        mp.id,
        mp.user_id,
        mp.methodology_type,
        mp.status,
        mp.plan_start_date,
        mp.confirmed_at,
        (SELECT COUNT(*) FROM app.methodology_exercise_sessions WHERE methodology_plan_id = mp.id) as sessions_count,
        (SELECT COUNT(*) FROM app.methodology_plan_days WHERE plan_id = mp.id) as days_count,
        (SELECT COUNT(*) FROM app.workout_schedule WHERE methodology_plan_id = mp.id) as schedule_count
      FROM app.methodology_plans mp
      WHERE mp.status IN ('active', 'confirmed', 'draft')
      ORDER BY mp.id DESC
      LIMIT 5
    `);
    
    if (plansCheck.rowCount === 0) {
      console.log('⚠️  No hay planes activos/confirmados/draft');
    } else {
      console.log('✅ Planes encontrados:\n');
      plansCheck.rows.forEach(plan => {
        console.log(`   Plan ID: ${plan.id}`);
        console.log(`   Usuario: ${plan.user_id}`);
        console.log(`   Metodología: ${plan.methodology_type}`);
        console.log(`   Estado: ${plan.status}`);
        console.log(`   Fecha inicio: ${plan.plan_start_date || 'NULL'}`);
        console.log(`   Confirmado: ${plan.confirmed_at || 'NULL'}`);
        console.log(`   📊 Sesiones: ${plan.sessions_count}`);
        console.log(`   📅 Días (methodology_plan_days): ${plan.days_count}`);
        console.log(`   🗓️  Schedule (workout_schedule): ${plan.schedule_count}`);
        
        if (plan.days_count === 0 && plan.status === 'active') {
          console.log(`   ⚠️  PROBLEMA: Plan activo sin días en methodology_plan_days`);
        } else if (plan.days_count > 0) {
          console.log(`   ✅ Plan tiene programación completa`);
        }
        console.log('');
      });
    }

    // 4. Verificar un plan específico en detalle (el más reciente)
    if (plansCheck.rowCount > 0) {
      const latestPlan = plansCheck.rows[0];
      
      console.log('\n📋 4. Detalle del plan más reciente (ID: ' + latestPlan.id + ')...\n');
      
      const daysDetail = await client.query(`
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
        LIMIT 10
      `, [latestPlan.id]);
      
      if (daysDetail.rowCount > 0) {
        console.log('✅ Primeros 10 días del plan:\n');
        daysDetail.rows.forEach(day => {
          const status = day.is_rest ? '💤 DESCANSO' : `💪 ENTRENO (${day.planned_exercises_count} ejercicios)`;
          console.log(`   day_id=${day.day_id}, semana=${day.week_number}, ${day.day_name} (${day.date_local}) - ${status}`);
        });
      } else {
        console.log('⚠️  No hay días registrados para este plan');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
verifyPhase1().catch(console.error);

