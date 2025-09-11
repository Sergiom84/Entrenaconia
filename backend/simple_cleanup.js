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

async function executeSimpleCleanup() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Ejecutando limpieza simple y directa...\n');
    
    // Paso 1: Obtener usuario 19 y sus planes duplicados
    const user19plans = await client.query(`
      SELECT id, created_at, confirmed_at 
      FROM app.methodology_plans 
      WHERE user_id = 19 AND status = 'active'
      ORDER BY confirmed_at DESC NULLS LAST, created_at DESC
    `);
    
    console.log(`📋 Usuario 19 tiene ${user19plans.rows.length} planes activos`);
    
    if (user19plans.rows.length > 1) {
      // Mantener solo el primero (más reciente)
      const planToKeep = user19plans.rows[0].id;
      const plansToCancel = user19plans.rows.slice(1).map(p => p.id);
      
      console.log(`✅ Manteniendo plan: ${planToKeep}`);
      console.log(`❌ Cancelando planes: ${plansToCancel.join(', ')}`);
      
      // Cancelar los planes antiguos
      for (const planId of plansToCancel) {
        await client.query(`
          UPDATE app.methodology_plans 
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1
        `, [planId]);
      }
      
      console.log(`🎉 ${plansToCancel.length} planes cancelados exitosamente`);
    }
    
    // Paso 2: Corregir estados inconsistentes en routine_plans
    const fixCancelled = await client.query(`
      UPDATE app.routine_plans 
      SET is_active = false, updated_at = NOW()
      WHERE status = 'cancelled' AND is_active = true
    `);
    
    const fixActive = await client.query(`
      UPDATE app.routine_plans 
      SET is_active = true, updated_at = NOW()
      WHERE status = 'active' AND is_active = false
    `);
    
    console.log(`\n🔧 Estados corregidos:`);
    console.log(`- Cancelled→is_active=false: ${fixCancelled.rowCount}`);
    console.log(`- Active→is_active=true: ${fixActive.rowCount}`);
    
    // Verificación final
    const finalCheck = await client.query(`
      SELECT user_id, COUNT(*) as activos
      FROM app.methodology_plans 
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);
    
    console.log('\n📊 VERIFICACIÓN FINAL:');
    if (finalCheck.rows.length === 0) {
      console.log('✅ ¡Ya no hay usuarios con planes duplicados!');
    } else {
      console.log('❌ Aún hay usuarios con planes duplicados:');
      console.table(finalCheck.rows);
    }
    
    console.log('\n🎉 ¡Limpieza completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    pool.end();
  }
}

executeSimpleCleanup();