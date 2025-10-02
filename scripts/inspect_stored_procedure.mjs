#!/usr/bin/env node
/**
 * Script para inspeccionar el stored procedure create_methodology_exercise_sessions
 * y entender qué hace exactamente
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

async function inspectStoredProcedure() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 INSPECCIÓN DEL STORED PROCEDURE');
    console.log('='.repeat(80) + '\n');

    // 1. Verificar si existe el stored procedure
    console.log('📋 1. Verificando existencia del stored procedure...\n');
    
    const procExists = await client.query(`
      SELECT 
        p.proname as name,
        pg_get_functiondef(p.oid) as definition,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_function_result(p.oid) as return_type,
        d.description
      FROM pg_proc p
      LEFT JOIN pg_description d ON p.oid = d.objoid
      WHERE p.proname = 'create_methodology_exercise_sessions'
        AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
    `);

    if (procExists.rowCount === 0) {
      console.log('❌ El stored procedure NO existe en el schema app');
      console.log('\n📝 Esto significa que el código está intentando llamar a una función que no existe.');
      console.log('   Opciones:');
      console.log('   A) Crear el stored procedure');
      console.log('   B) Reemplazar la llamada con código JavaScript (RECOMENDADO)\n');
      
      // Buscar en otros schemas
      const otherSchemas = await client.query(`
        SELECT 
          n.nspname as schema,
          p.proname as name
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'create_methodology_exercise_sessions'
      `);
      
      if (otherSchemas.rowCount > 0) {
        console.log('⚠️  Pero SÍ existe en otros schemas:');
        otherSchemas.rows.forEach(row => {
          console.log(`   - ${row.schema}.${row.name}`);
        });
      }
      
    } else {
      console.log('✅ El stored procedure SÍ existe\n');
      
      const proc = procExists.rows[0];
      
      console.log('📦 Información del stored procedure:');
      console.log(`   Nombre: ${proc.name}`);
      console.log(`   Argumentos: ${proc.arguments}`);
      console.log(`   Retorna: ${proc.return_type}`);
      if (proc.description) {
        console.log(`   Descripción: ${proc.description}`);
      }
      
      console.log('\n📝 Definición completa:\n');
      console.log('─'.repeat(80));
      console.log(proc.definition);
      console.log('─'.repeat(80));
    }

    // 2. Verificar la tabla methodology_exercise_sessions
    console.log('\n📋 2. Verificando tabla methodology_exercise_sessions...\n');
    
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'app' 
          AND table_name = 'methodology_exercise_sessions'
      ) as exists
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ La tabla methodology_exercise_sessions existe\n');
      
      // Obtener estructura de la tabla
      const columns = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'app' 
          AND table_name = 'methodology_exercise_sessions'
        ORDER BY ordinal_position
      `);
      
      console.log('📊 Columnas de methodology_exercise_sessions:');
      columns.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`   - ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
      });
      
      // Contar registros
      const count = await client.query(`
        SELECT COUNT(*) as total FROM app.methodology_exercise_sessions
      `);
      console.log(`\n📈 Total de registros: ${count.rows[0].total}`);
      
      // Mostrar algunos ejemplos
      const examples = await client.query(`
        SELECT 
          id,
          user_id,
          methodology_plan_id,
          methodology_type,
          session_name,
          week_number,
          day_name,
          total_exercises,
          session_status,
          created_at
        FROM app.methodology_exercise_sessions
        ORDER BY id DESC
        LIMIT 5
      `);
      
      if (examples.rowCount > 0) {
        console.log('\n📋 Últimas 5 sesiones creadas:\n');
        examples.rows.forEach(row => {
          console.log(`   ID: ${row.id}`);
          console.log(`   Usuario: ${row.user_id}`);
          console.log(`   Plan: ${row.methodology_plan_id}`);
          console.log(`   Metodología: ${row.methodology_type}`);
          console.log(`   Nombre: ${row.session_name}`);
          console.log(`   Semana: ${row.week_number}, Día: ${row.day_name}`);
          console.log(`   Ejercicios: ${row.total_exercises}`);
          console.log(`   Estado: ${row.session_status}`);
          console.log(`   Creada: ${row.created_at}`);
          console.log('');
        });
      }
      
    } else {
      console.log('❌ La tabla methodology_exercise_sessions NO existe');
    }

    // 3. Verificar la tabla methodology_exercise_progress
    console.log('\n📋 3. Verificando tabla methodology_exercise_progress...\n');
    
    const progressTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'app' 
          AND table_name = 'methodology_exercise_progress'
      ) as exists
    `);
    
    if (progressTableExists.rows[0].exists) {
      console.log('✅ La tabla methodology_exercise_progress existe\n');
      
      const progressCount = await client.query(`
        SELECT COUNT(*) as total FROM app.methodology_exercise_progress
      `);
      console.log(`📈 Total de registros de progreso: ${progressCount.rows[0].total}`);
    } else {
      console.log('❌ La tabla methodology_exercise_progress NO existe');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ INSPECCIÓN COMPLETADA');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error durante la inspección:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
inspectStoredProcedure().catch(console.error);

