import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function fixRemainingIssues() {
  const client = await pool.connect();

  try {
    console.log('🔧 SOLUCIONANDO PROBLEMAS RESTANTES DE HOMETRAINING');
    console.log('==================================================');

    await client.query('BEGIN');

    // 1. Agregar columna jwt_token_hash a user_sessions
    console.log('📋 1. Agregando jwt_token_hash a user_sessions...');
    try {
      await client.query('ALTER TABLE app.user_sessions ADD COLUMN jwt_token_hash VARCHAR(255)');
      console.log('   ✅ Columna jwt_token_hash agregada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚪ Columna jwt_token_hash ya existe');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 2. Crear tabla home_combination_exercise_history
    console.log('📋 2. Creando tabla home_combination_exercise_history...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.home_combination_exercise_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        combination_id INTEGER NOT NULL,
        combination_code VARCHAR(50),
        exercise_name VARCHAR(200) NOT NULL,
        exercise_key VARCHAR(100),
        times_used INTEGER DEFAULT 1,
        last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_rating VARCHAR(20),
        difficulty_feedback VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, combination_id, exercise_name)
      );
    `);
    console.log('   ✅ home_combination_exercise_history creada');

    // 3. Crear índices para la nueva tabla
    console.log('📋 3. Creando índices para home_combination_exercise_history...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_home_combo_history_user_id ON app.home_combination_exercise_history(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_home_combo_history_combo_id ON app.home_combination_exercise_history(combination_id)',
      'CREATE INDEX IF NOT EXISTS idx_home_combo_history_exercise ON app.home_combination_exercise_history(exercise_name)',
      'CREATE INDEX IF NOT EXISTS idx_home_combo_history_times_used ON app.home_combination_exercise_history(times_used DESC)'
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }
    console.log('   ✅ Índices creados');

    // 4. Insertar algunos datos de ejemplo para el usuario 18
    console.log('📋 4. Insertando datos de ejemplo...');
    await client.query(`
      INSERT INTO app.home_combination_exercise_history (
        user_id, combination_id, combination_code, exercise_name, exercise_key, times_used, user_rating
      ) VALUES
      (18, 1, 'MINIMO_FUNCIONAL_01', 'Flexiones', 'flexiones', 5, 'bueno'),
      (18, 1, 'MINIMO_FUNCIONAL_01', 'Sentadillas', 'sentadillas', 3, 'excelente'),
      (18, 1, 'MINIMO_FUNCIONAL_01', 'Plancha', 'plancha', 2, 'bueno'),
      (18, 2, 'MINIMO_FUERZA_01', 'Flexiones diamante', 'flexiones_diamante', 1, 'desafiante')
      ON CONFLICT (user_id, combination_id, exercise_name) DO NOTHING;
    `);
    console.log('   ✅ Datos de ejemplo insertados');

    // 5. Verificar estructura de user_sessions
    console.log('📋 5. Verificando estructura final de user_sessions...');
    const sessionCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'user_sessions'
      ORDER BY ordinal_position
    `);

    console.log('   📊 Columnas en user_sessions:');
    sessionCols.rows.forEach(col => {
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });

    await client.query('COMMIT');

    console.log('\n✅ VERIFICACIÓN FINAL:');

    // Verificar que todo esté correcto
    const verificationQueries = [
      { name: 'user_sessions', query: 'SELECT COUNT(*) as count FROM app.user_sessions' },
      { name: 'home_combination_exercise_history', query: 'SELECT COUNT(*) as count FROM app.home_combination_exercise_history' },
      { name: 'home_training_combinations', query: 'SELECT COUNT(*) as count FROM app.home_training_combinations' }
    ];

    for (const {name, query} of verificationQueries) {
      try {
        const result = await client.query(query);
        console.log(`   ✅ ${name}: ${result.rows[0].count} registros`);
      } catch (error) {
        console.log(`   ❌ ${name}: ${error.message}`);
      }
    }

    console.log('\n🎉 PROBLEMAS SOLUCIONADOS');
    console.log('========================');
    console.log('✅ jwt_token_hash agregado a user_sessions');
    console.log('✅ home_combination_exercise_history creada');
    console.log('✅ Datos de ejemplo insertados');
    console.log('✅ HomeTraining debería funcionar completamente');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error('📄 Detalles:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRemainingIssues();