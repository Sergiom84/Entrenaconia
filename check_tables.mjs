import { pool } from './backend/db.js';

async function showTables() {
  try {
    const result = await pool.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema IN ('app', 'public')
      ORDER BY table_schema, table_name
    `);

    console.log('📊 Tablas disponibles:');
    console.table(result.rows);

    // Revisar específicamente las tablas de entrenamiento
    const trainingTables = result.rows.filter(row =>
      row.table_name.includes('methodology') ||
      row.table_name.includes('training') ||
      row.table_name.includes('session') ||
      row.table_name.includes('exercise')
    );

    console.log('\n🏋️ Tablas relacionadas con entrenamiento:');
    console.table(trainingTables);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

showTables();