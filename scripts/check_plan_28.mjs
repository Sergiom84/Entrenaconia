#!/usr/bin/env node
/**
 * 🔍 Script de verificación: Revisar plan 28 y sus sesiones
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', 'backend', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkPlan28() {
  const client = await pool.connect();
  
  try {
    // 1. Verificar el plan
    console.log('🔍 Verificando plan 28...\n');
    const planResult = await client.query(`
      SELECT id, user_id, methodology_type, started_at, plan_data->>'selected_style' as style
      FROM app.methodology_plans 
      WHERE id = 28
    `);
    
    if (planResult.rowCount === 0) {
      console.log('❌ Plan 28 no existe');
      return;
    }
    
    const plan = planResult.rows[0];
    console.log('✅ Plan encontrado:');
    console.log(`   ID: ${plan.id}`);
    console.log(`   User ID: ${plan.user_id}`);
    console.log(`   Methodology: ${plan.methodology_type}`);
    console.log(`   Style: ${plan.style}`);
    console.log(`   Started at: ${plan.started_at}`);
    
    // 2. Verificar sesiones
    console.log('\n🔍 Verificando sesiones del plan 28...\n');
    const sessionsResult = await client.query(`
      SELECT id, week_number, day_name, session_status, started_at, total_exercises
      FROM app.methodology_exercise_sessions 
      WHERE methodology_plan_id = 28
      ORDER BY week_number, id
    `);
    
    console.log(`📊 Total de sesiones: ${sessionsResult.rowCount}\n`);
    console.log('session_id | week | day_name | status      | exercises');
    console.log('-----------|------|----------|-------------|----------');
    
    sessionsResult.rows.forEach(row => {
      console.log(
        `   ${String(row.id).padStart(3)}     |  ${row.week_number}   | ${row.day_name.padEnd(8)} | ${row.session_status.padEnd(11)} | ${row.total_exercises}`
      );
    });
    
    // 3. Verificar workout_schedule
    console.log('\n🔍 Verificando workout_schedule...\n');
    const scheduleResult = await client.query(`
      SELECT week_number, day_name, day_abbrev, scheduled_date, session_order
      FROM app.workout_schedule 
      WHERE methodology_plan_id = 28
      ORDER BY session_order
    `);
    
    console.log(`📊 Total en schedule: ${scheduleResult.rowCount}\n`);
    console.log('order | week | day_name | day_abbrev | scheduled_date');
    console.log('------|------|----------|------------|---------------');
    
    scheduleResult.rows.forEach(row => {
      console.log(
        `  ${String(row.session_order).padStart(2)}  |  ${row.week_number}   | ${row.day_name.padEnd(8)} | ${row.day_abbrev.padEnd(10)} | ${row.scheduled_date}`
      );
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkPlan28()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

