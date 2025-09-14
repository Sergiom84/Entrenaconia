import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function migrateData() {
  try {
    console.log('🔄 Migrando datos de methodology_plans a methodology_plans_new');

    // Contar datos originales
    const countOld = await pool.query('SELECT COUNT(*) as count FROM app.methodology_plans');
    console.log(`📊 Filas en methodology_plans: ${countOld.rows[0].count}`);

    // Migrar datos básicos
    const migrationQuery = `
      INSERT INTO app.methodology_plans_new (
        nombre_ejercicio, nivel, categoria, notas, created_at
      )
      SELECT
        'Plan ' || id::text as nombre_ejercicio,
        'basico' as nivel,
        'core' as categoria,
        'Migrado - Tipo: ' || methodology_type as notas,
        created_at
      FROM app.methodology_plans
    `;

    const result = await pool.query(migrationQuery);
    console.log(`✅ Migrados registros: ${result.rowCount}`);

    // Verificar migración
    const countNew = await pool.query('SELECT COUNT(*) as count FROM app.methodology_plans_new');
    console.log(`📊 Filas en methodology_plans_new: ${countNew.rows[0].count}`);

    console.log('✅ Migración completada');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

migrateData();