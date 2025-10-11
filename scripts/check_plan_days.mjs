#!/usr/bin/env node
/**
 * 🔍 Script de verificación: Revisar datos en methodology_plan_days
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde backend/.env
dotenv.config({ path: join(__dirname, '..', 'backend', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkPlanDays() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando datos en methodology_plan_days para plan_id=28...\n');
    
    const result = await client.query(`
      SELECT plan_id, day_id, week_number, day_name, date_local, is_rest 
      FROM app.methodology_plan_days 
      WHERE plan_id = 28 
      ORDER BY day_id
    `);
    
    console.log(`📊 Total de registros: ${result.rowCount}\n`);
    console.log('day_id | week | day_name | date_local  | is_rest');
    console.log('-------|------|----------|-------------|--------');
    
    result.rows.forEach(row => {
      console.log(
        `  ${String(row.day_id).padStart(2)}   |  ${row.week_number}   | ${row.day_name.padEnd(8)} | ${row.date_local} | ${row.is_rest ? 'YES' : 'NO'}`
      );
    });
    
    // Verificar específicamente day_id=5
    console.log('\n🎯 Verificando day_id=5 específicamente:');
    const day5 = result.rows.find(r => r.day_id === 5);
    if (day5) {
      console.log(`   day_id: 5`);
      console.log(`   day_name: ${day5.day_name}`);
      console.log(`   date_local: ${day5.date_local}`);
      console.log(`   week_number: ${day5.week_number}`);
      
      // Calcular qué día de la semana debería ser
      const date = new Date(day5.date_local + 'T00:00:00Z');
      const dayOfWeek = date.getUTCDay();
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
      const expectedDayName = dayNames[dayOfWeek];
      
      console.log(`   día de la semana calculado: ${expectedDayName} (${dayOfWeek})`);
      
      if (day5.day_name !== expectedDayName) {
        console.log(`   ❌ INCONSISTENCIA: day_name="${day5.day_name}" pero debería ser "${expectedDayName}"`);
      } else {
        console.log(`   ✅ day_name es correcto`);
      }
    } else {
      console.log('   ❌ No se encontró day_id=5');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkPlanDays()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

