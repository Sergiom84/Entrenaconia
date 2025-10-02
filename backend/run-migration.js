/**
 * Script para ejecutar migraciones SQL en la BD
 * Uso: node run-migration.js <nombre-archivo-sql>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(migrationFile) {
  const filePath = path.join(__dirname, 'migrations', migrationFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`🚀 Ejecutando migración: ${migrationFile}`);
  console.log(`📄 Archivo: ${filePath}`);
  console.log('─'.repeat(60));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('─'.repeat(60));
    console.log(`✅ Migración completada exitosamente`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al ejecutar migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.log('Uso: node run-migration.js <nombre-archivo-sql>');
  console.log('\nEjemplo:');
  console.log('  node run-migration.js create_methodology_plan_days.sql');
  process.exit(1);
}

runMigration(migrationFile);
