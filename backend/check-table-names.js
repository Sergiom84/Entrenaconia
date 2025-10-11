import { pool } from './db.js';

async function checkTableNames() {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'app'
    AND table_name LIKE 'Ejercicios_%'
    ORDER BY table_name
  `);

  console.log('📋 Tablas de ejercicios en BD:');
  result.rows.forEach(row => console.log(`  - ${row.table_name}`));

  pool.end();
}

checkTableNames();
