import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function createEquipmentCatalog() {
  const client = await pool.connect();

  try {
    console.log('🏋️ CREANDO CATÁLOGO DE EQUIPAMIENTO');
    console.log('==================================');

    await client.query('BEGIN');

    // 1. Crear tabla equipment_items
    console.log('📋 1. Creando tabla equipment_items...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.equipment_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        category VARCHAR(100) NOT NULL,
        equipment_type VARCHAR(100),
        description TEXT,
        muscle_groups TEXT[],
        difficulty_level VARCHAR(20) DEFAULT 'intermedio',
        price_range VARCHAR(50),
        is_essential BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('   ✅ equipment_items creada');

    // 2. Crear índices
    console.log('📋 2. Creando índices...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON app.equipment_items(category)',
      'CREATE INDEX IF NOT EXISTS idx_equipment_items_type ON app.equipment_items(equipment_type)',
      'CREATE INDEX IF NOT EXISTS idx_equipment_items_essential ON app.equipment_items(is_essential)',
      'CREATE INDEX IF NOT EXISTS idx_equipment_items_difficulty ON app.equipment_items(difficulty_level)'
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }
    console.log('   ✅ Índices creados');

    // 3. Poblar catálogo con equipamientos estándar
    console.log('📋 3. Poblando catálogo con equipamientos estándar...');
    await client.query(`
      INSERT INTO app.equipment_items (
        name, category, equipment_type, description, muscle_groups, difficulty_level, price_range, is_essential
      ) VALUES
      -- Equipamiento básico esencial
      ('Esterilla de ejercicio', 'basico', 'accesorio', 'Esterilla antideslizante para ejercicios en el suelo', ARRAY['core', 'general'], 'principiante', '10-30€', true),
      ('Toalla de ejercicio', 'basico', 'accesorio', 'Toalla absorbente para entrenamientos', ARRAY['general'], 'principiante', '5-15€', true),

      -- Pesas y mancuernas
      ('Mancuernas ajustables', 'pesas', 'pesas', 'Set de mancuernas con peso ajustable', ARRAY['brazos', 'pecho', 'espalda', 'piernas'], 'intermedio', '50-150€', true),
      ('Mancuernas 2kg (par)', 'pesas', 'pesas', 'Par de mancuernas de 2 kilogramos', ARRAY['brazos', 'hombros'], 'principiante', '15-25€', false),
      ('Mancuernas 5kg (par)', 'pesas', 'pesas', 'Par de mancuernas de 5 kilogramos', ARRAY['brazos', 'pecho', 'hombros'], 'intermedio', '25-40€', false),
      ('Mancuernas 10kg (par)', 'pesas', 'pesas', 'Par de mancuernas de 10 kilogramos', ARRAY['brazos', 'pecho', 'espalda'], 'intermedio', '40-60€', false),
      ('Kettlebell 8kg', 'pesas', 'kettlebell', 'Kettlebell de 8 kilogramos para entrenamiento funcional', ARRAY['piernas', 'core', 'brazos'], 'intermedio', '25-40€', false),
      ('Kettlebell 12kg', 'pesas', 'kettlebell', 'Kettlebell de 12 kilogramos para entrenamiento funcional', ARRAY['piernas', 'core', 'brazos', 'espalda'], 'intermedio', '35-50€', false),
      ('Kettlebell 16kg', 'pesas', 'kettlebell', 'Kettlebell de 16 kilogramos para entrenamiento avanzado', ARRAY['piernas', 'core', 'brazos', 'espalda'], 'avanzado', '45-65€', false),

      -- Bandas de resistencia
      ('Banda elástica ligera', 'resistencia', 'banda', 'Banda de resistencia ligera para rehabilitación', ARRAY['brazos', 'hombros'], 'principiante', '5-15€', false),
      ('Banda elástica media', 'resistencia', 'banda', 'Banda de resistencia media para entrenamiento general', ARRAY['brazos', 'piernas', 'espalda'], 'intermedio', '8-20€', true),
      ('Banda elástica fuerte', 'resistencia', 'banda', 'Banda de resistencia fuerte para entrenamiento avanzado', ARRAY['piernas', 'espalda', 'pecho'], 'avanzado', '10-25€', false),
      ('Set bandas elásticas', 'resistencia', 'banda', 'Set completo de bandas con diferentes resistencias', ARRAY['general'], 'intermedio', '20-40€', true),

      -- Equipamiento funcional
      ('Pelota de ejercicio', 'funcional', 'pelota', 'Pelota suiza para ejercicios de core y equilibrio', ARRAY['core', 'equilibrio'], 'intermedio', '15-30€', false),
      ('Bosu ball', 'funcional', 'equilibrio', 'Plataforma de equilibrio para entrenamiento funcional', ARRAY['core', 'piernas', 'equilibrio'], 'avanzado', '80-150€', false),
      ('TRX o sistema suspensión', 'funcional', 'suspension', 'Sistema de entrenamiento en suspensión', ARRAY['general'], 'intermedio', '100-200€', false),
      ('Cuerda de saltar', 'cardio', 'cuerda', 'Cuerda ajustable para ejercicios cardiovasculares', ARRAY['piernas', 'cardio'], 'principiante', '8-25€', true),

      -- Equipamiento avanzado
      ('Barra de dominadas', 'avanzado', 'barra', 'Barra para dominadas y ejercicios de tracción', ARRAY['espalda', 'brazos'], 'intermedio', '30-80€', false),
      ('Paralelas', 'avanzado', 'paralelas', 'Paralelas para fondos y ejercicios avanzados', ARRAY['pecho', 'brazos', 'core'], 'avanzado', '50-120€', false),
      ('Anillas de gimnasia', 'avanzado', 'anillas', 'Anillas para entrenamiento de calistenia avanzada', ARRAY['brazos', 'pecho', 'espalda', 'core'], 'avanzado', '25-60€', false)

      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('   ✅ Catálogo poblado con equipamientos estándar');

    await client.query('COMMIT');

    // 4. Verificación
    console.log('\n✅ VERIFICACIÓN DEL CATÁLOGO:');

    // Contar por categorías
    const categoryStats = await client.query(`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_essential = true) as essential_count
      FROM app.equipment_items
      GROUP BY category
      ORDER BY category
    `);

    console.log('📊 Equipamientos por categoría:');
    categoryStats.rows.forEach(stat => {
      console.log(`   🏷️ ${stat.category}: ${stat.total} items (${stat.essential_count} esenciales)`);
    });

    // Mostrar algunos ejemplos
    const examples = await client.query(`
      SELECT name, category, equipment_type, is_essential
      FROM app.equipment_items
      WHERE is_essential = true
      ORDER BY category, name
      LIMIT 8
    `);

    console.log('\n🌟 Equipamientos esenciales:');
    examples.rows.forEach(item => {
      console.log(`   ⭐ ${item.name} (${item.category})`);
    });

    const totalCount = await client.query('SELECT COUNT(*) as count FROM app.equipment_items');

    console.log('\n🎉 CATÁLOGO DE EQUIPAMIENTO COMPLETADO');
    console.log('====================================');
    console.log(`✅ Total de equipamientos: ${totalCount.rows[0].count}`);
    console.log('✅ Organizados por categorías y tipos');
    console.log('✅ Incluye niveles de dificultad');
    console.log('✅ Identificados equipamientos esenciales');
    console.log('✅ El error equipment.catalog debería estar solucionado');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

createEquipmentCatalog();