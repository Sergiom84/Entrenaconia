#!/usr/bin/env node
/**
 * 🔧 Script de migración: Normalizar day_name en methodology_plan_days
 * 
 * PROBLEMA: methodology_plan_days tiene nombres completos ("Jueves")
 *           pero methodology_exercise_sessions usa abreviaturas ("Jue")
 * 
 * SOLUCIÓN: Convertir todos los day_name en methodology_plan_days a abreviaturas
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

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para normalizar nombres de días a abreviaturas
function normalizeDayName(dayName) {
  if (!dayName) return dayName;
  
  const lower = dayName.toLowerCase().trim();
  const map = {
    'lunes': 'Lun',
    'martes': 'Mar',
    'miércoles': 'Mie',
    'miercoles': 'Mie',
    'jueves': 'Jue',
    'viernes': 'Vie',
    'sábado': 'Sab',
    'sabado': 'Sab',
    'domingo': 'Dom',
    // Ya normalizados
    'lun': 'Lun',
    'mar': 'Mar',
    'mie': 'Mie',
    'jue': 'Jue',
    'vie': 'Vie',
    'sab': 'Sab',
    'dom': 'Dom'
  };
  
  return map[lower] || dayName;
}

async function fixDayNamesConsistency() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando migración de day_name en methodology_plan_days...\n');
    
    await client.query('BEGIN');
    
    // 1. Obtener todos los registros de methodology_plan_days
    const result = await client.query(`
      SELECT plan_id, day_id, day_name 
      FROM app.methodology_plan_days 
      ORDER BY plan_id, day_id
    `);
    
    console.log(`📊 Total de registros encontrados: ${result.rowCount}\n`);
    
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // 2. Actualizar cada registro
    for (const row of result.rows) {
      const { plan_id, day_id, day_name } = row;
      const normalizedName = normalizeDayName(day_name);
      
      if (normalizedName !== day_name) {
        await client.query(`
          UPDATE app.methodology_plan_days 
          SET day_name = $1 
          WHERE plan_id = $2 AND day_id = $3
        `, [normalizedName, plan_id, day_id]);
        
        console.log(`✅ Plan ${plan_id}, Day ${day_id}: "${day_name}" → "${normalizedName}"`);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migración completada exitosamente');
    console.log('='.repeat(60));
    console.log(`📊 Registros actualizados: ${updatedCount}`);
    console.log(`📊 Registros sin cambios: ${unchangedCount}`);
    console.log(`📊 Total procesados: ${result.rowCount}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar migración
fixDayNamesConsistency()
  .then(() => {
    console.log('\n🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

