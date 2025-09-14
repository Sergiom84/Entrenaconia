import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function recreateMissingTables() {
  const client = await pool.connect();

  try {
    console.log('🔧 RECREANDO TABLAS FALTANTES PARA HOMETRAINING');
    console.log('===============================================');

    await client.query('BEGIN');

    // 1. user_sessions - Para sesiones de usuario
    console.log('📋 1. Creando tabla user_sessions...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        jwt_token TEXT,
        jwt_expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        logout_time TIMESTAMP WITH TIME ZONE,
        logout_type VARCHAR(20),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT,
        device_info TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('   ✅ user_sessions creada');

    // 2. user_equipment - Para equipamiento del usuario
    console.log('📋 2. Creando tabla user_equipment...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.user_equipment (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        equipment_type VARCHAR(100) NOT NULL,
        has_equipment BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, equipment_type)
      );
    `);
    console.log('   ✅ user_equipment creada');

    // 3. user_home_training_stats - Para estadísticas
    console.log('📋 3. Creando tabla user_home_training_stats...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.user_home_training_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        total_sessions INTEGER DEFAULT 0,
        total_exercises_completed INTEGER DEFAULT 0,
        total_time_minutes INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        last_workout_date DATE,
        average_session_time INTEGER DEFAULT 0,
        favorite_training_type VARCHAR(100),
        total_calories_burned INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);
    console.log('   ✅ user_home_training_stats creada');

    // 4. home_training_combinations - Para combinaciones de entrenamientos
    console.log('📋 4. Creando tabla home_training_combinations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.home_training_combinations (
        id SERIAL PRIMARY KEY,
        combination_code VARCHAR(50) UNIQUE NOT NULL,
        equipment_type VARCHAR(50) NOT NULL,
        training_type VARCHAR(50) NOT NULL,
        difficulty_level VARCHAR(20) DEFAULT 'intermedio',
        description TEXT,
        exercises JSONB,
        duration_minutes INTEGER,
        calories_estimate INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('   ✅ home_training_combinations creada');

    // 5. Insertar algunas combinaciones básicas
    console.log('📋 5. Insertando combinaciones básicas...');
    await client.query(`
      INSERT INTO app.home_training_combinations (
        combination_code, equipment_type, training_type, description, exercises, duration_minutes, calories_estimate
      ) VALUES
      ('MINIMO_FUNCIONAL_01', 'minimo', 'funcional', 'Entrenamiento funcional con equipamiento mínimo',
       '["Flexiones", "Sentadillas", "Plancha", "Burpees", "Mountain Climbers"]'::jsonb, 30, 200),
      ('MINIMO_FUERZA_01', 'minimo', 'fuerza', 'Entrenamiento de fuerza con peso corporal',
       '["Flexiones diamante", "Sentadillas búlgaras", "Plancha lateral", "Fondos en silla"]'::jsonb, 35, 180),
      ('BASICO_FUNCIONAL_01', 'basico', 'funcional', 'Entrenamiento funcional con equipamiento básico',
       '["Flexiones con mancuernas", "Sentadillas con peso", "Remo con banda", "Press militar"]'::jsonb, 40, 250)
      ON CONFLICT (combination_code) DO NOTHING;
    `);
    console.log('   ✅ Combinaciones básicas insertadas');

    // 6. Crear índices importantes
    console.log('📋 6. Creando índices...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app.user_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON app.user_sessions(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON app.user_equipment(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_home_stats_user_id ON app.user_home_training_stats(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_home_combinations_type ON app.home_training_combinations(equipment_type, training_type)'
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }
    console.log('   ✅ Índices creados');

    await client.query('COMMIT');

    // Verificación final
    console.log('\n✅ VERIFICACIÓN FINAL:');
    const verification = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      AND table_name IN ('user_sessions', 'user_equipment', 'user_home_training_stats', 'home_training_combinations')
      ORDER BY table_name
    `);

    verification.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name} - Disponible`);
    });

    console.log('\n🎉 TABLAS RECREADAS EXITOSAMENTE');
    console.log('================================');
    console.log('✅ HomeTraining debería funcionar correctamente ahora');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recreando tablas:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

recreateMissingTables();