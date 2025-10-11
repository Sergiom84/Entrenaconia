import { pool } from './db.js';

const tableName = process.argv[2] || 'methodology_plan_days';

pool.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'app'
  AND table_name = $1
  ORDER BY ordinal_position
`, [tableName])
  .then(res => {
    console.log(`📋 Estructura de ${tableName}:`);
    if (res.rowCount === 0) {
      console.log('❌ Tabla no existe en schema app');
    } else {
      res.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
