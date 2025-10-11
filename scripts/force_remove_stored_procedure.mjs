#!/usr/bin/env node
/**
 * Script para forzar la eliminación del stored procedure
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

async function forceRemove() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 ELIMINACIÓN FORZADA DEL STORED PROCEDURE');
    console.log('='.repeat(80) + '\n');

    // 1. Verificar si existe
    console.log('📋 1. Verificando existencia...\n');
    
    const procCheck = await client.query(`
      SELECT 
        p.oid,
        p.proname,
        pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
        AND p.proname = 'create_methodology_exercise_sessions'
    `);

    if (procCheck.rowCount === 0) {
      console.log('✅ El stored procedure NO existe - nada que hacer\n');
      return;
    }

    console.log(`⚠️  Encontrado ${procCheck.rowCount} stored procedure(s):\n`);
    procCheck.rows.forEach(proc => {
      console.log(`   OID: ${proc.oid}`);
      console.log(`   Nombre: ${proc.proname}`);
      console.log(`   Argumentos: ${proc.args}`);
      console.log('');
    });

    // 2. Intentar eliminar con CASCADE
    console.log('📋 2. Intentando eliminar con CASCADE...\n');
    
    try {
      await client.query(`
        DROP FUNCTION IF EXISTS app.create_methodology_exercise_sessions(p_user_id integer, p_methodology_plan_id integer, p_plan_data jsonb) CASCADE
      `);
      console.log('✅ Eliminado exitosamente\n');
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
      
      // 3. Intentar con DROP FUNCTION sin especificar argumentos
      console.log('📋 3. Intentando DROP sin especificar argumentos...\n');
      
      try {
        await client.query(`
          DROP FUNCTION IF EXISTS app.create_methodology_exercise_sessions CASCADE
        `);
        console.log('✅ Eliminado exitosamente\n');
      } catch (error2) {
        console.log(`❌ Error: ${error2.message}\n`);
      }
    }

    // 4. Verificar eliminación
    console.log('📋 4. Verificando eliminación...\n');
    
    const finalCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
        AND p.proname = 'create_methodology_exercise_sessions'
    `);

    if (finalCheck.rows[0].count === 0) {
      console.log('✅ Stored procedure eliminado correctamente\n');
    } else {
      console.log('❌ Stored procedure aún existe\n');
      console.log('💡 Puede que necesites eliminarlo manualmente desde la consola de Supabase:\n');
      console.log('   DROP FUNCTION IF EXISTS app.create_methodology_exercise_sessions CASCADE;\n');
    }

    // 5. Verificar función auxiliar
    console.log('📋 5. Verificando función auxiliar get_current_day_spanish...\n');
    
    const auxCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
        AND p.proname = 'get_current_day_spanish'
    `);

    if (auxCheck.rows[0].count > 0) {
      console.log('⚠️  Función auxiliar encontrada - intentando eliminar...\n');
      
      try {
        await client.query(`DROP FUNCTION IF EXISTS app.get_current_day_spanish() CASCADE`);
        console.log('✅ Función auxiliar eliminada\n');
      } catch (error) {
        console.log(`❌ Error eliminando función auxiliar: ${error.message}\n`);
      }
    } else {
      console.log('✅ Función auxiliar no existe\n');
    }

    console.log('='.repeat(80));
    console.log('✅ PROCESO COMPLETADO');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error durante el proceso:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
forceRemove().catch(console.error);

