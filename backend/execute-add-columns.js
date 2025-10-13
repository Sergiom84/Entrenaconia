/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeScript() {
  try {
    console.log('🚀 Ejecutando script SQL para añadir columnas...\n');

    const sqlPath = path.join(__dirname, '..', 'scripts', 'add-exercise-info-columns.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sqlScript);

    console.log('\n✅ Script ejecutado exitosamente!\n');

    // Verificar resultados
    const result = await pool.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_schema = 'app'
                AND table_name = t.table_name
                AND column_name IN ('ejecucion', 'consejos', 'errores_evitar')) as cache_columns
      FROM information_schema.tables t
      WHERE table_schema = 'app'
        AND table_name LIKE 'Ejercicios_%'
      ORDER BY table_name;
    `);

    console.log('📊 Estado final de las tablas:\n');
    result.rows.forEach(row => {
      const status = row.cache_columns === '3' ? '✅' : '❌';
      console.log(`${status} ${row.table_name}: ${row.cache_columns}/3 columnas`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  }
}

executeScript();
