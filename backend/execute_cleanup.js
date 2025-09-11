import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de la base de datos
const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL',
  ssl: { rejectUnauthorized: false },
  search_path: 'app,public'
});

async function executeCleanupScript() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando limpieza de planes activos duplicados...\n');
    
    // Primero, obtener reporte de problemas ANTES de limpiar
    console.log('📊 === REPORTE PRE-LIMPIEZA ===\n');
    
    // Usuarios con múltiples methodology_plans activos
    const duplicateMethodology = await client.query(`
      SELECT 
          'METHODOLOGY PLANS DUPLICADOS' as tipo,
          user_id,
          COUNT(*) as cantidad_activos,
          ARRAY_AGG(id ORDER BY confirmed_at DESC NULLS LAST, created_at DESC) as plan_ids
      FROM app.methodology_plans 
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    
    if (duplicateMethodology.rows.length > 0) {
      console.log('🚨 METHODOLOGY PLANS DUPLICADOS ENCONTRADOS:');
      console.table(duplicateMethodology.rows);
    } else {
      console.log('✅ No se encontraron methodology plans duplicados');
    }
    
    // Estados inconsistentes en routine_plans  
    const inconsistentStates = await client.query(`
      SELECT 
          'ESTADOS INCONSISTENTES' as tipo,
          COUNT(*) as cantidad
      FROM app.routine_plans 
      WHERE (status = 'cancelled' AND is_active = true) 
         OR (status = 'active' AND is_active = false)
    `);
    
    console.log('\n🔍 ESTADOS INCONSISTENTES:');
    console.table(inconsistentStates.rows);
    
    console.log('\n🛠️  APLICANDO CORRECCIONES...\n');
    
    // LIMPIEZA 1: Methodology plans duplicados
    const cleanupMethodology = await client.query(`
      WITH users_with_duplicates AS (
          SELECT DISTINCT user_id 
          FROM app.methodology_plans 
          WHERE status = 'active'
          GROUP BY user_id
          HAVING COUNT(*) > 1
      ),
      plans_to_keep AS (
          SELECT DISTINCT ON (user_id) 
              user_id,
              id as plan_to_keep
          FROM app.methodology_plans mp
          JOIN users_with_duplicates uwd ON mp.user_id = uwd.user_id
          WHERE mp.status = 'active'
          ORDER BY user_id, 
                   confirmed_at DESC NULLS LAST, 
                   created_at DESC
      ),
      cancellation_log AS (
          UPDATE app.methodology_plans 
          SET status = 'cancelled',
              updated_at = NOW()
          FROM plans_to_keep ptk
          WHERE app.methodology_plans.user_id = ptk.user_id
            AND app.methodology_plans.status = 'active'  
            AND app.methodology_plans.id != ptk.plan_to_keep
          RETURNING app.methodology_plans.user_id, app.methodology_plans.id
      )
      SELECT 
          'METHODOLOGY_PLANS CANCELADOS' as action,
          COUNT(*) as cantidad_cancelados
      FROM cancellation_log
    `);
    
    console.log('📝 RESULTADOS METHODOLOGY CLEANUP:');
    console.table(cleanupMethodology.rows);
    
    // LIMPIEZA 2: Corregir estados inconsistentes
    const fixInconsistentCancelled = await client.query(`
      UPDATE app.routine_plans 
      SET is_active = false,
          updated_at = NOW()
      WHERE status = 'cancelled' AND is_active = true
      RETURNING user_id, id
    `);
    
    const fixInconsistentActive = await client.query(`
      UPDATE app.routine_plans 
      SET is_active = true,
          updated_at = NOW()
      WHERE status = 'active' AND is_active = false  
      RETURNING user_id, id
    `);
    
    console.log('\n🔧 CORRECCIONES DE ESTADOS:');
    console.log(`- Planes cancelled→is_active=false: ${fixInconsistentCancelled.rowCount}`);
    console.log(`- Planes active→is_active=true: ${fixInconsistentActive.rowCount}`);
    
    // VERIFICACIÓN POST-LIMPIEZA
    console.log('\n📊 === VERIFICACIÓN POST-LIMPIEZA ===\n');
    
    const verifyMethodology = await client.query(`
      SELECT 
          'METHODOLOGY PLANS POST-LIMPIEZA' as tipo,
          user_id,
          COUNT(*) as cantidad_activos
      FROM app.methodology_plans 
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    
    if (verifyMethodology.rows.length > 0) {
      console.log('❌ TODAVÍA HAY DUPLICADOS:');
      console.table(verifyMethodology.rows);
    } else {
      console.log('✅ Ya no hay methodology plans duplicados');
    }
    
    const verifyInconsistent = await client.query(`
      SELECT 
          'ESTADOS INCONSISTENTES POST-LIMPIEZA' as tipo,
          COUNT(*) as cantidad
      FROM app.routine_plans 
      WHERE (status = 'cancelled' AND is_active = true) 
         OR (status = 'active' AND is_active = false)
    `);
    
    console.table(verifyInconsistent.rows);
    
    // Estadísticas finales
    const finalStats = await client.query(`
      SELECT 
          'ESTADISTICAS FINALES' as tipo,
          (SELECT COUNT(*) FROM app.methodology_plans WHERE status = 'active') as methodology_activos,
          (SELECT COUNT(*) FROM app.routine_plans WHERE status = 'active' AND is_active = true) as routine_activos,
          (SELECT COUNT(DISTINCT user_id) FROM app.methodology_plans WHERE status = 'active') as usuarios_con_methodology_activo,
          (SELECT COUNT(DISTINCT user_id) FROM app.routine_plans WHERE status = 'active' AND is_active = true) as usuarios_con_routine_activo
    `);
    
    console.log('\n📈 ESTADÍSTICAS FINALES:');
    console.table(finalStats.rows);
    
    console.log('\n🎉 ¡Limpieza completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error ejecutando script:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    pool.end();
  }
}

executeCleanupScript();