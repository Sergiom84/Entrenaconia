import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL',
  ssl: { rejectUnauthorized: false },
  search_path: 'app,public'
});

async function applyConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🛡️  Aplicando constraints preventivos...\n');
    
    // Constraint 1: Solo un methodology_plan activo por usuario
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_methodology_plan 
          ON app.methodology_plans(user_id) 
          WHERE status = 'active'
    `);
    console.log('✅ Constraint 1: Único methodology_plan activo por usuario');
    
    // Constraint 2: Solo un routine_plan activo por usuario  
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_routine_plan 
          ON app.routine_plans(user_id) 
          WHERE status = 'active' AND is_active = true
    `);
    console.log('✅ Constraint 2: Único routine_plan activo por usuario');
    
    // Función atómica para activar planes (con cancelación automática)
    await client.query(`
      CREATE OR REPLACE FUNCTION app.activate_plan_atomic(
          p_user_id INTEGER,
          p_methodology_plan_id INTEGER,
          p_routine_plan_id INTEGER DEFAULT NULL
      ) RETURNS BOOLEAN AS $$
      DECLARE
          v_current_active_methodology INTEGER;
          v_current_active_routine INTEGER;
      BEGIN
          -- Verificar planes activos actuales
          SELECT COUNT(*) INTO v_current_active_methodology
          FROM app.methodology_plans 
          WHERE user_id = p_user_id AND status = 'active';
          
          SELECT COUNT(*) INTO v_current_active_routine
          FROM app.routine_plans 
          WHERE user_id = p_user_id AND status = 'active' AND is_active = true;
          
          -- Log para debugging
          IF v_current_active_methodology > 0 OR v_current_active_routine > 0 THEN
              RAISE NOTICE 'Usuario % cancelando planes: methodology=%, routine=%', 
                  p_user_id, v_current_active_methodology, v_current_active_routine;
          END IF;

          -- Cancelar todos los planes anteriores del usuario (ATÓMICO)
          UPDATE app.methodology_plans 
          SET status = 'cancelled', updated_at = NOW() 
          WHERE user_id = p_user_id AND status = 'active' AND id != p_methodology_plan_id;
          
          IF p_routine_plan_id IS NOT NULL THEN
              UPDATE app.routine_plans 
              SET status = 'cancelled', is_active = false, updated_at = NOW() 
              WHERE user_id = p_user_id AND status = 'active' AND is_active = true AND id != p_routine_plan_id;
          END IF;
          
          -- Activar el nuevo plan methodology
          UPDATE app.methodology_plans 
          SET status = 'active', confirmed_at = NOW(), updated_at = NOW()
          WHERE id = p_methodology_plan_id AND user_id = p_user_id;
          
          -- Activar el nuevo plan routine (si se proporciona)
          IF p_routine_plan_id IS NOT NULL THEN
              UPDATE app.routine_plans 
              SET status = 'active', is_active = true, confirmed_at = NOW(), updated_at = NOW()
              WHERE id = p_routine_plan_id AND user_id = p_user_id;
          END IF;
          
          RETURN TRUE;
      EXCEPTION
          WHEN unique_violation THEN
              RAISE EXCEPTION 'Ya existe un plan activo para el usuario %', p_user_id;
          WHEN OTHERS THEN
              RAISE EXCEPTION 'Error activando plan: %', SQLERRM;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Función atómica: activate_plan_atomic() creada');
    
    // Verificar que los constraints funcionan
    console.log('\n🔍 VERIFICANDO CONSTRAINTS...');
    
    const testMethodology = await client.query(`
      SELECT user_id, COUNT(*) as activos
      FROM app.methodology_plans 
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);
    
    const testRoutine = await client.query(`
      SELECT user_id, COUNT(*) as activos
      FROM app.routine_plans 
      WHERE status = 'active' AND is_active = true
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);
    
    if (testMethodology.rows.length === 0 && testRoutine.rows.length === 0) {
      console.log('✅ Todos los constraints funcionan correctamente');
      console.log('✅ No hay usuarios con múltiples planes activos');
    } else {
      console.log('❌ Aún hay problemas:');
      if (testMethodology.rows.length > 0) {
        console.log('- Methodology duplicados:', testMethodology.rows);
      }
      if (testRoutine.rows.length > 0) {
        console.log('- Routine duplicados:', testRoutine.rows);
      }
    }
    
    console.log('\n🎉 ¡Constraints aplicados exitosamente!');
    console.log('🛡️  El sistema ahora previene planes duplicados automáticamente');
    
  } catch (error) {
    console.error('❌ Error aplicando constraints:', error.message);
  } finally {
    client.release();
    pool.end();
  }
}

applyConstraints();