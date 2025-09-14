import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function addSpanishTranslations() {
  const client = await pool.connect();

  try {
    console.log('🇪🇸 AGREGANDO TRADUCCIONES AL ESPAÑOL');
    console.log('====================================');

    await client.query('BEGIN');

    // 1. Agregar columnas de traducción a equipment_items
    console.log('📋 1. Agregando columnas de traducción...');
    try {
      await client.query('ALTER TABLE app.equipment_items ADD COLUMN name_es VARCHAR(200)');
      console.log('   ✅ Columna name_es agregada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚪ Columna name_es ya existe');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    try {
      await client.query('ALTER TABLE app.equipment_items ADD COLUMN category_es VARCHAR(100)');
      console.log('   ✅ Columna category_es agregada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚪ Columna category_es ya existe');
      }
    }

    try {
      await client.query('ALTER TABLE app.equipment_items ADD COLUMN equipment_type_es VARCHAR(100)');
      console.log('   ✅ Columna equipment_type_es agregada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚪ Columna equipment_type_es ya existe');
      }
    }

    // 2. Crear diccionario de traducciones para tipos
    console.log('📋 2. Actualizando traducciones de tipos de equipamiento...');
    const typeTranslations = {
      'accesorio': 'Accesorio',
      'pesas': 'Pesas',
      'kettlebell': 'Pesa rusa',
      'banda': 'Banda elástica',
      'pelota': 'Pelota',
      'equilibrio': 'Equilibrio',
      'suspension': 'Suspensión',
      'cuerda': 'Cuerda',
      'barra': 'Barra',
      'paralelas': 'Paralelas',
      'anillas': 'Anillas'
    };

    const categoryTranslations = {
      'basico': 'Básico',
      'pesas': 'Pesas',
      'resistencia': 'Resistencia',
      'funcional': 'Funcional',
      'cardio': 'Cardio',
      'avanzado': 'Avanzado'
    };

    // 3. Actualizar todas las traducciones
    console.log('📋 3. Aplicando traducciones...');
    await client.query(`
      UPDATE app.equipment_items SET
        name_es = CASE name
          WHEN 'Esterilla de ejercicio' THEN 'Esterilla de ejercicio'
          WHEN 'Toalla de ejercicio' THEN 'Toalla de ejercicio'
          WHEN 'Mancuernas ajustables' THEN 'Mancuernas ajustables'
          WHEN 'Mancuernas 2kg (par)' THEN 'Mancuernas 2kg (par)'
          WHEN 'Mancuernas 5kg (par)' THEN 'Mancuernas 5kg (par)'
          WHEN 'Mancuernas 10kg (par)' THEN 'Mancuernas 10kg (par)'
          WHEN 'Kettlebell 8kg' THEN 'Pesa rusa 8kg'
          WHEN 'Kettlebell 12kg' THEN 'Pesa rusa 12kg'
          WHEN 'Kettlebell 16kg' THEN 'Pesa rusa 16kg'
          WHEN 'Banda elástica ligera' THEN 'Banda elástica ligera'
          WHEN 'Banda elástica media' THEN 'Banda elástica media'
          WHEN 'Banda elástica fuerte' THEN 'Banda elástica fuerte'
          WHEN 'Set bandas elásticas' THEN 'Set de bandas elásticas'
          WHEN 'Pelota de ejercicio' THEN 'Pelota de ejercicio'
          WHEN 'Bosu ball' THEN 'Pelota bosu'
          WHEN 'TRX o sistema suspensión' THEN 'Sistema de suspensión TRX'
          WHEN 'Cuerda de saltar' THEN 'Cuerda de saltar'
          WHEN 'Barra de dominadas' THEN 'Barra de dominadas'
          WHEN 'Paralelas' THEN 'Barras paralelas'
          WHEN 'Anillas de gimnasia' THEN 'Anillas de gimnasia'
          ELSE name
        END,
        category_es = CASE category
          WHEN 'basico' THEN 'Básico'
          WHEN 'pesas' THEN 'Pesas'
          WHEN 'resistencia' THEN 'Resistencia'
          WHEN 'funcional' THEN 'Funcional'
          WHEN 'cardio' THEN 'Cardio'
          WHEN 'avanzado' THEN 'Avanzado'
          ELSE category
        END,
        equipment_type_es = CASE equipment_type
          WHEN 'accesorio' THEN 'Accesorio'
          WHEN 'pesas' THEN 'Pesas'
          WHEN 'kettlebell' THEN 'Pesa rusa'
          WHEN 'banda' THEN 'Banda elástica'
          WHEN 'pelota' THEN 'Pelota'
          WHEN 'equilibrio' THEN 'Equilibrio'
          WHEN 'suspension' THEN 'Suspensión'
          WHEN 'cuerda' THEN 'Cuerda'
          WHEN 'barra' THEN 'Barra'
          WHEN 'paralelas' THEN 'Paralelas'
          WHEN 'anillas' THEN 'Anillas'
          ELSE equipment_type
        END
    `);
    console.log('   ✅ Traducciones aplicadas');

    // 4. Crear tabla de traducciones para equipment_type de usuario
    console.log('📋 4. Creando tabla de traducciones para tipos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.equipment_translations (
        id SERIAL PRIMARY KEY,
        equipment_type_en VARCHAR(100) NOT NULL UNIQUE,
        equipment_type_es VARCHAR(100) NOT NULL,
        category_en VARCHAR(100),
        category_es VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insertar traducciones comunes
    await client.query(`
      INSERT INTO app.equipment_translations (equipment_type_en, equipment_type_es, category_en, category_es) VALUES
      ('resistance_bands', 'Bandas elásticas', 'resistance', 'Resistencia'),
      ('dumbbells', 'Mancuernas', 'weights', 'Pesas'),
      ('kettlebell', 'Pesa rusa', 'weights', 'Pesas'),
      ('exercise_mat', 'Esterilla de ejercicio', 'basic', 'Básico'),
      ('yoga_mat', 'Esterilla de yoga', 'basic', 'Básico'),
      ('pull_up_bar', 'Barra de dominadas', 'advanced', 'Avanzado'),
      ('jump_rope', 'Cuerda de saltar', 'cardio', 'Cardio'),
      ('exercise_ball', 'Pelota de ejercicio', 'functional', 'Funcional'),
      ('bosu_ball', 'Pelota bosu', 'functional', 'Funcional'),
      ('suspension_trainer', 'Sistema de suspensión', 'functional', 'Funcional'),
      ('gym_rings', 'Anillas de gimnasia', 'advanced', 'Avanzado'),
      ('parallel_bars', 'Barras paralelas', 'advanced', 'Avanzado'),
      ('resistance', 'Resistencia', 'resistance', 'Resistencia'),
      ('weights', 'Pesas', 'weights', 'Pesas'),
      ('basic', 'Básico', 'basic', 'Básico'),
      ('functional', 'Funcional', 'functional', 'Funcional'),
      ('cardio', 'Cardio', 'cardio', 'Cardio'),
      ('advanced', 'Avanzado', 'advanced', 'Avanzado')
      ON CONFLICT (equipment_type_en) DO NOTHING;
    `);
    console.log('   ✅ Tabla de traducciones creada');

    await client.query('COMMIT');

    // 5. Verificación
    console.log('\n✅ VERIFICACIÓN DE TRADUCCIONES:');

    const translated = await client.query(`
      SELECT name, name_es, category, category_es, equipment_type, equipment_type_es
      FROM app.equipment_items
      WHERE name_es IS NOT NULL
      ORDER BY category_es, name_es
      LIMIT 10
    `);

    console.log('📋 Ejemplos de traducciones:');
    translated.rows.forEach(item => {
      console.log(`   🏷️ ${item.name_es} (${item.category_es}) - Tipo: ${item.equipment_type_es}`);
    });

    const translationsCount = await client.query(`
      SELECT COUNT(*) as count FROM app.equipment_translations
    `);

    console.log(`\n📊 Traducciones disponibles: ${translationsCount.rows[0].count}`);

    console.log('\n🎉 TRADUCCIONES AL ESPAÑOL COMPLETADAS');
    console.log('====================================');
    console.log('✅ Columnas de traducción agregadas');
    console.log('✅ Nombres traducidos al español');
    console.log('✅ Categorías y tipos traducidos');
    console.log('✅ Tabla de traducciones creada');
    console.log('\n📝 SIGUIENTE PASO: Actualizar frontend para usar las traducciones');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

addSpanishTranslations();