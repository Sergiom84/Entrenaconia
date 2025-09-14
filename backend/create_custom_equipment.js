import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function createCustomEquipment() {
  const client = await pool.connect();

  try {
    console.log('🔧 CREANDO TABLA USER_CUSTOM_EQUIPMENT');
    console.log('=====================================');

    await client.query('BEGIN');

    // Crear tabla user_custom_equipment
    console.log('📋 Creando tabla user_custom_equipment...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.user_custom_equipment (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        equipment_name VARCHAR(200) NOT NULL,
        equipment_type VARCHAR(100),
        description TEXT,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, equipment_name)
      );
    `);
    console.log('   ✅ user_custom_equipment creada');

    // Crear índices
    console.log('📋 Creando índices...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_user_custom_equipment_user_id ON app.user_custom_equipment(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_custom_equipment_type ON app.user_custom_equipment(equipment_type)',
      'CREATE INDEX IF NOT EXISTS idx_user_custom_equipment_available ON app.user_custom_equipment(is_available)'
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }
    console.log('   ✅ Índices creados');

    // Insertar algunos equipamientos de ejemplo para el usuario 18
    console.log('📋 Insertando equipamientos de ejemplo...');
    await client.query(`
      INSERT INTO app.user_custom_equipment (
        user_id, equipment_name, equipment_type, description
      ) VALUES
      (18, 'Mancuernas 10kg', 'pesas', 'Par de mancuernas de 10 kilogramos'),
      (18, 'Banda elástica', 'resistencia', 'Banda elástica de resistencia media'),
      (18, 'Esterilla de yoga', 'accesorio', 'Esterilla antideslizante para ejercicios'),
      (18, 'Kettlebell 12kg', 'pesas', 'Kettlebell de 12 kilogramos')
      ON CONFLICT (user_id, equipment_name) DO NOTHING;
    `);
    console.log('   ✅ Equipamientos de ejemplo insertados');

    await client.query('COMMIT');

    // Verificación final
    console.log('\n✅ VERIFICACIÓN:');
    const verification = await client.query(`
      SELECT
        equipment_name,
        equipment_type,
        description,
        is_available
      FROM app.user_custom_equipment
      WHERE user_id = 18
      ORDER BY equipment_type, equipment_name
    `);

    console.log(`📊 Equipamientos del usuario 18: ${verification.rows.length}`);
    verification.rows.forEach(eq => {
      const status = eq.is_available ? '✅' : '❌';
      console.log(`   ${status} ${eq.equipment_name} (${eq.equipment_type}): ${eq.description}`);
    });

    // Verificar que la tabla existe y funciona
    console.log('\n🔍 Probando funcionalidad...');
    const testCount = await client.query('SELECT COUNT(*) as count FROM app.user_custom_equipment');
    console.log(`   📊 Total de equipamientos personalizados: ${testCount.rows[0].count}`);

    console.log('\n🎉 TABLA USER_CUSTOM_EQUIPMENT LISTA');
    console.log('===================================');
    console.log('✅ Tabla creada y configurada');
    console.log('✅ Índices optimizados');
    console.log('✅ Datos de ejemplo insertados');
    console.log('✅ El error de equipment.custom.add debería estar solucionado');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

createCustomEquipment();