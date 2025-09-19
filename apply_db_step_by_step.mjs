import { pool } from './backend/db.js';

async function applyDatabaseImprovements() {
  const client = await pool.connect();

  try {
    console.log('🚀 Aplicando mejoras a la base de datos paso a paso...');

    // Paso 1: Mejorar methodology_plans
    console.log('\n📋 Paso 1: Mejorando tabla methodology_plans...');
    try {
      await client.query(`
        ALTER TABLE methodology_plans
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS current_day VARCHAR(20),
        ADD COLUMN IF NOT EXISTS current_exercise_index INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS plan_progress JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS last_session_date DATE;
      `);
      console.log('✅ methodology_plans mejorada');
    } catch (error) {
      console.error('❌ Error mejorando methodology_plans:', error.message);
    }

    // Paso 2: Mejorar methodology_exercise_sessions
    console.log('\n🏃 Paso 2: Mejorando tabla methodology_exercise_sessions...');
    try {
      await client.query(`
        ALTER TABLE methodology_exercise_sessions
        ADD COLUMN IF NOT EXISTS current_exercise_index INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS exercises_data JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS is_current_session BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITHOUT TIME ZONE,
        ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'methodology';
      `);
      console.log('✅ methodology_exercise_sessions mejorada');
    } catch (error) {
      console.error('❌ Error mejorando methodology_exercise_sessions:', error.message);
    }

    // Paso 3: Crear tabla exercise_session_tracking
    console.log('\n🎯 Paso 3: Creando tabla exercise_session_tracking...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS exercise_session_tracking (
          id SERIAL PRIMARY KEY,
          methodology_session_id INTEGER REFERENCES methodology_exercise_sessions(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          exercise_name VARCHAR(200) NOT NULL,
          exercise_order INTEGER NOT NULL,
          exercise_data JSONB NOT NULL DEFAULT '{}',

          -- Estado del ejercicio
          status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, skipped, cancelled

          -- Progreso planificado vs real
          planned_sets INTEGER DEFAULT 0,
          planned_reps VARCHAR(50) DEFAULT '0',
          planned_duration_seconds INTEGER DEFAULT 0,
          planned_rest_seconds INTEGER DEFAULT 60,

          -- Progreso real
          actual_sets INTEGER DEFAULT 0,
          actual_reps VARCHAR(50) DEFAULT '0',
          actual_duration_seconds INTEGER DEFAULT 0,
          actual_rest_seconds INTEGER DEFAULT 0,

          -- Feedback
          difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
          effort_rating INTEGER CHECK (effort_rating >= 1 AND effort_rating <= 5),
          personal_feedback TEXT,
          was_difficult BOOLEAN,

          -- Timestamps
          started_at TIMESTAMP WITHOUT TIME ZONE,
          completed_at TIMESTAMP WITHOUT TIME ZONE,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('✅ exercise_session_tracking creada');
    } catch (error) {
      console.error('❌ Error creando exercise_session_tracking:', error.message);
    }

    // Paso 4: Crear tabla user_training_state
    console.log('\n👤 Paso 4: Creando tabla user_training_state...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_training_state (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,

          -- Plan activo
          active_methodology_plan_id INTEGER REFERENCES methodology_plans(id) ON DELETE SET NULL,
          active_session_id INTEGER REFERENCES methodology_exercise_sessions(id) ON DELETE SET NULL,

          -- Estado de navegación
          current_view VARCHAR(50) DEFAULT 'methodologies',

          -- Estado de sesión activa
          is_training BOOLEAN DEFAULT false,
          current_exercise_index INTEGER DEFAULT 0,
          session_started_at TIMESTAMP WITHOUT TIME ZONE,
          session_paused_at TIMESTAMP WITHOUT TIME ZONE,

          -- Estados de modales (temporal, pero para consistencia)
          active_modals JSONB DEFAULT '{}',

          -- Metadata general
          training_metadata JSONB DEFAULT '{}',

          -- Timestamps
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('✅ user_training_state creada');
    } catch (error) {
      console.error('❌ Error creando user_training_state:', error.message);
    }

    // Paso 5: Crear índices
    console.log('\n📊 Paso 5: Creando índices...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_methodology_plans_user_status ON methodology_plans(user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_methodology_plans_active ON methodology_plans(user_id) WHERE status = \'active\'',
      'CREATE INDEX IF NOT EXISTS idx_methodology_exercise_sessions_current ON methodology_exercise_sessions(user_id, is_current_session) WHERE is_current_session = true',
      'CREATE INDEX IF NOT EXISTS idx_methodology_exercise_sessions_user_date ON methodology_exercise_sessions(user_id, session_date)',
      'CREATE INDEX IF NOT EXISTS idx_methodology_exercise_sessions_plan ON methodology_exercise_sessions(methodology_plan_id, session_status)',
      'CREATE INDEX IF NOT EXISTS idx_exercise_session_tracking_session ON exercise_session_tracking(methodology_session_id)',
      'CREATE INDEX IF NOT EXISTS idx_exercise_session_tracking_user ON exercise_session_tracking(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_exercise_session_tracking_status ON exercise_session_tracking(status)',
      'CREATE INDEX IF NOT EXISTS idx_user_training_state_user ON user_training_state(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_training_state_active_plan ON user_training_state(active_methodology_plan_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_training_state_active_session ON user_training_state(active_session_id)'
    ];

    for (const indexSQL of indexes) {
      try {
        await client.query(indexSQL);
        console.log('✅ Índice creado');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️ Índice ya existe');
        } else {
          console.error('❌ Error creando índice:', error.message);
        }
      }
    }

    // Paso 6: Crear funciones y triggers
    console.log('\n⚙️ Paso 6: Creando funciones...');
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      console.log('✅ Función update_updated_at_column creada');
    } catch (error) {
      console.error('❌ Error creando función:', error.message);
    }

    // Paso 7: Aplicar triggers
    console.log('\n🔄 Paso 7: Aplicando triggers...');
    const triggers = [
      { table: 'methodology_plans', trigger: 'update_methodology_plans_updated_at' },
      { table: 'methodology_exercise_sessions', trigger: 'update_methodology_exercise_sessions_updated_at' },
      { table: 'exercise_session_tracking', trigger: 'update_exercise_session_tracking_updated_at' },
      { table: 'user_training_state', trigger: 'update_user_training_state_updated_at' }
    ];

    for (const { table, trigger } of triggers) {
      try {
        await client.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`);
        await client.query(`
          CREATE TRIGGER ${trigger}
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
        `);
        console.log(`✅ Trigger ${trigger} aplicado`);
      } catch (error) {
        console.error(`❌ Error aplicando trigger ${trigger}:`, error.message);
      }
    }

    // Paso 8: Crear función get_user_active_plan
    console.log('\n👤 Paso 8: Creando función get_user_active_plan...');
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION get_user_active_plan(p_user_id INTEGER)
        RETURNS TABLE (
            plan_id INTEGER,
            plan_data JSONB,
            methodology_type VARCHAR,
            status VARCHAR,
            current_week INTEGER,
            current_day VARCHAR,
            started_at TIMESTAMP WITH TIME ZONE,
            has_active_session BOOLEAN,
            active_session_id INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                mp.id,
                mp.plan_data,
                mp.methodology_type,
                mp.status,
                mp.current_week,
                mp.current_day,
                mp.started_at,
                (uts.active_session_id IS NOT NULL AND uts.is_training = true) as has_active_session,
                uts.active_session_id
            FROM methodology_plans mp
            LEFT JOIN user_training_state uts ON uts.active_methodology_plan_id = mp.id
            WHERE mp.user_id = p_user_id
                AND mp.status = 'active'
            ORDER BY mp.created_at DESC
            LIMIT 1;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Función get_user_active_plan creada');
    } catch (error) {
      console.error('❌ Error creando función get_user_active_plan:', error.message);
    }

    console.log('\n🎉 Mejoras aplicadas exitosamente!');

    // Verificación final
    console.log('\n🔍 Verificación final...');
    try {
      const result = await client.query('SELECT COUNT(*) FROM user_training_state');
      console.log(`✅ user_training_state: ${result.rows[0].count} registros`);

      const result2 = await client.query('SELECT COUNT(*) FROM exercise_session_tracking');
      console.log(`✅ exercise_session_tracking: ${result2.rows[0].count} registros`);

      await client.query('SELECT get_user_active_plan(1) LIMIT 0');
      console.log('✅ Función get_user_active_plan funcionando');

    } catch (error) {
      console.error('❌ Error en verificación:', error.message);
    }

  } catch (error) {
    console.error('💥 Error general:', error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

applyDatabaseImprovements();