// Script para ejecutar la migración de ejercicios de calistenia
import { pool } from './db.js';
import { readFileSync } from 'fs';

async function migrateCalistenia() {
  const client = await pool.connect();
  
  try {
    console.log('🤸‍♀️ Iniciando migración de ejercicios de calistenia...');
    
    // Leer el archivo SQL
    const sqlContent = readFileSync('../database_scripts/create_calistenia_exercises.sql', 'utf8');
    
    // Ejecutar todo el script SQL
    await client.query(sqlContent);
    
    console.log('✅ Migración de calistenia completada exitosamente');
    
    // Verificar la migración
    const verificationQuery = await client.query(`
      SELECT nivel, COUNT(*) as total_ejercicios 
      FROM app.calistenia_exercises 
      GROUP BY nivel 
      ORDER BY 
        CASE nivel 
          WHEN 'Básico' THEN 1 
          WHEN 'Intermedio' THEN 2 
          WHEN 'Avanzado' THEN 3 
        END
    `);
    
    console.log('📊 Ejercicios de calistenia por nivel:');
    verificationQuery.rows.forEach(row => {
      console.log(`   ${row.nivel}: ${row.total_ejercicios} ejercicios`);
    });
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️ La tabla ya existe, esto es normal si la migración se ejecutó previamente');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCalistenia().catch(console.error);
}

export default migrateCalistenia;