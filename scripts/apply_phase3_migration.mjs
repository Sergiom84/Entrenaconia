#!/usr/bin/env node
/**
 * Script para aplicar la migración FASE 3
 * Elimina el stored procedure obsoleto create_methodology_exercise_sessions
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', 'backend', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 APLICANDO MIGRACIÓN FASE 3');
    console.log('='.repeat(80) + '\n');

    // Leer el archivo SQL
    const migrationPath = join(__dirname, '..', 'backend', 'migrations', 'phase3_remove_stored_procedure.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📋 Ejecutando migración...\n');

    // Ejecutar la migración
    await client.query(migrationSQL);

    console.log('✅ Migración aplicada exitosamente\n');

    // Verificar que el stored procedure fue eliminado
    const procCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
        AND p.proname = 'create_methodology_exercise_sessions'
    `);

    if (procCheck.rows[0].count === 0) {
      console.log('✅ Verificación: Stored procedure eliminado correctamente');
    } else {
      console.log('❌ Advertencia: Stored procedure aún existe');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error aplicando migración:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
applyMigration().catch(console.error);

