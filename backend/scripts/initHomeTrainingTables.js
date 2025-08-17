import pool from '../db.js';

const createHomeTrainingTables = async () => {
  try {
    console.log('Creando tablas de entrenamiento en casa...');

    // Tabla para almacenar planes de entrenamiento en casa generados
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home_training_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plan_data JSONB NOT NULL,
        equipment_type VARCHAR(20) NOT NULL,
        training_type VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Tabla para almacenar sesiones de entrenamiento en casa completadas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home_training_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        home_training_plan_id INTEGER REFERENCES home_training_plans(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        total_duration_seconds INTEGER,
        exercises_completed INTEGER DEFAULT 0,
        total_exercises INTEGER DEFAULT 0,
        progress_percentage DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'in_progress',
        session_data JSONB
      )
    `);

    // Tabla para almacenar el progreso de ejercicios individuales en casa
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home_exercise_progress (
        id SERIAL PRIMARY KEY,
        home_training_session_id INTEGER REFERENCES home_training_sessions(id) ON DELETE CASCADE,
        exercise_name VARCHAR(255) NOT NULL,
        exercise_order INTEGER NOT NULL,
        series_completed INTEGER DEFAULT 0,
        total_series INTEGER NOT NULL,
        duration_seconds INTEGER,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'pending',
        exercise_data JSONB
      )
    `);

    // Tabla para estadísticas de entrenamiento en casa del usuario
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_home_training_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        total_sessions INTEGER DEFAULT 0,
        total_duration_seconds INTEGER DEFAULT 0,
        current_streak_days INTEGER DEFAULT 0,
        longest_streak_days INTEGER DEFAULT 0,
        last_training_date DATE,
        favorite_equipment VARCHAR(20),
        favorite_training_type VARCHAR(20),
        total_exercises_completed INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Crear índices
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_home_training_plans_user_id ON home_training_plans(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_home_training_sessions_user_id ON home_training_sessions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_home_training_sessions_plan_id ON home_training_sessions(home_training_plan_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_home_exercise_progress_session_id ON home_exercise_progress(home_training_session_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_training_stats_user_id ON user_home_training_stats(user_id)
    `);

    // Crear función para actualizar updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_home_training_plans_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Crear trigger para updated_at en home_training_plans
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_home_training_plans_updated_at ON home_training_plans
    `);
    
    await pool.query(`
      CREATE TRIGGER trg_home_training_plans_updated_at
      BEFORE UPDATE ON home_training_plans
      FOR EACH ROW
      EXECUTE FUNCTION update_home_training_plans_updated_at()
    `);

    // Crear función para actualizar estadísticas del usuario
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_user_home_training_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
          INSERT INTO user_home_training_stats (user_id, total_sessions, total_duration_seconds, last_training_date, total_exercises_completed)
          VALUES (NEW.user_id, 1, COALESCE(NEW.total_duration_seconds, 0), CURRENT_DATE, NEW.exercises_completed)
          ON CONFLICT (user_id) DO UPDATE SET
            total_sessions = user_home_training_stats.total_sessions + 1,
            total_duration_seconds = user_home_training_stats.total_duration_seconds + COALESCE(NEW.total_duration_seconds, 0),
            last_training_date = CURRENT_DATE,
            total_exercises_completed = user_home_training_stats.total_exercises_completed + NEW.exercises_completed,
            updated_at = CURRENT_TIMESTAMP;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Crear trigger para actualizar estadísticas automáticamente
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_update_user_home_stats ON home_training_sessions
    `);
    
    await pool.query(`
      CREATE TRIGGER trg_update_user_home_stats
      AFTER UPDATE ON home_training_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_user_home_training_stats()
    `);

    console.log('✅ Tablas de entrenamiento en casa creadas exitosamente');
    
    // Verificar que las tablas se crearon
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('home_training_plans', 'home_training_sessions', 'home_exercise_progress', 'user_home_training_stats')
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas creadas:', result.rows.map(row => row.table_name));
    
  } catch (error) {
    console.error('❌ Error creando tablas de entrenamiento en casa:', error);
    throw error;
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createHomeTrainingTables()
    .then(() => {
      console.log('🎉 Inicialización completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error en la inicialización:', error);
      process.exit(1);
    });
}

export default createHomeTrainingTables;
