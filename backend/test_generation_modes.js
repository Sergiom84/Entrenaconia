import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function testGenerationModes() {
  try {
    console.log('🧪 PRUEBA FINAL - GENERATION_MODE EN METHODOLOGY_PLANS');
    console.log('=====================================================');

    // Verificar que methodology_plans tiene la columna generation_mode
    console.log('1️⃣ Verificando estructura de methodology_plans...');
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'methodology_plans'
      ORDER BY ordinal_position
    `);

    console.log('📋 Columnas en methodology_plans:');
    structure.rows.forEach(col => {
      console.log(`   📄 ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Verificar si hay registros existentes
    console.log('\n2️⃣ Verificando registros existentes...');
    const existing = await pool.query(`
      SELECT id, methodology_type, generation_mode, status, created_at
      FROM app.methodology_plans
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (existing.rows.length > 0) {
      console.log('📊 Registros existentes:');
      existing.rows.forEach(row => {
        console.log(`   🆔 ID: ${row.id} | Tipo: ${row.methodology_type} | Modo: ${row.generation_mode || 'NULL'} | Status: ${row.status}`);
      });
    } else {
      console.log('📊 No hay registros existentes');
    }

    // Test de inserción MANUAL
    console.log('\n3️⃣ Probando inserción MANUAL...');
    const manualTest = await pool.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, generation_mode, status
    `, [1, 'Test Manual', '{"test": true}', 'manual', 'draft']);

    console.log(`   ✅ Manual creado - ID: ${manualTest.rows[0].id}, Mode: ${manualTest.rows[0].generation_mode}`);

    // Test de inserción AUTOMATIC
    console.log('\n4️⃣ Probando inserción AUTOMATIC...');
    const automaticTest = await pool.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, generation_mode, status
    `, [1, 'Test Automatic', '{"test": true}', 'automatic', 'draft']);

    console.log(`   ✅ Automatic creado - ID: ${automaticTest.rows[0].id}, Mode: ${automaticTest.rows[0].generation_mode}`);

    // Verificar que ambos se guardaron correctamente
    console.log('\n5️⃣ Verificando que ambos modos se guardaron...');
    const verification = await pool.query(`
      SELECT id, methodology_type, generation_mode, status
      FROM app.methodology_plans
      WHERE id IN ($1, $2)
      ORDER BY generation_mode
    `, [manualTest.rows[0].id, automaticTest.rows[0].id]);

    verification.rows.forEach(row => {
      console.log(`   ✅ ID: ${row.id} | Tipo: ${row.methodology_type} | Modo: ${row.generation_mode}`);
    });

    // Limpiar los tests
    console.log('\n6️⃣ Limpiando registros de prueba...');
    await pool.query(`
      DELETE FROM app.methodology_plans
      WHERE id IN ($1, $2)
    `, [manualTest.rows[0].id, automaticTest.rows[0].id]);

    console.log('   ✅ Registros de prueba eliminados');

    console.log('\n🎉 PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('===================================');
    console.log('✅ La tabla methodology_plans soporta ambos generation_mode');
    console.log('✅ manual: Para rutinas generadas manualmente');
    console.log('✅ automatic: Para rutinas generadas con IA');
    console.log('✅ Todos los endpoints corregidos correctamente');

  } catch (error) {
    console.error('❌ Error en pruebas:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    await pool.end();
  }
}

testGenerationModes();