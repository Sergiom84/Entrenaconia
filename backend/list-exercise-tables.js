/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';

async function listExerciseTables() {
  try {
    console.log('🔍 Buscando tablas de ejercicios en Supabase...\n');

    const result = await pool.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_schema = 'app' AND table_name = t.table_name) as total_columns
      FROM information_schema.tables t
      WHERE table_schema = 'app'
        AND table_name LIKE 'Ejercicios_%'
      ORDER BY table_name;
    `);

    console.log(`✅ Encontradas ${result.rows.length} tablas de ejercicios:\n`);

    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name} (${row.total_columns} columnas)`);
    });

    // Verificar si ya tienen las columnas de caché
    console.log('\n\n🔍 Verificando columnas existentes en cada tabla...\n');

    for (const row of result.rows) {
      const columnsCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = $1
          AND column_name IN ('ejecucion', 'consejos', 'errores_evitar')
        ORDER BY column_name;
      `, [row.table_name]);

      const hasColumns = columnsCheck.rows.length > 0;
      const columnNames = columnsCheck.rows.map(c => c.column_name).join(', ');

      if (hasColumns) {
        console.log(`✅ ${row.table_name}: YA TIENE [${columnNames}]`);
      } else {
        console.log(`❌ ${row.table_name}: NO TIENE columnas de caché`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listExerciseTables();
