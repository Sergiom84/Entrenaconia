import { pool } from './db.js';

(async () => {
  try {
    console.log('🔍 Verificando esquema de Ejercicios_Hipertrofia...\n');

    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name = 'Ejercicios_Hipertrofia'
      ORDER BY ordinal_position
    `);

    console.log('📋 Columnas disponibles:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
