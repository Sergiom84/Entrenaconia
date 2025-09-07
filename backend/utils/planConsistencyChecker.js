// utils/planConsistencyChecker.js
// Utilitario para detectar y reparar inconsistencias entre methodology_plans y routine_plans

import { pool } from '../db.js';

/**
 * Detecta inconsistencias de estado entre methodology_plans y routine_plans
 * @param {number} userId - ID del usuario específico, o null para todos
 * @returns {Promise<Object>} Reporte de inconsistencias
 */
export async function detectPlanInconsistencies(userId = null) {
  try {
    const query = `
      SELECT 
        mp.id as methodology_id,
        mp.user_id,
        mp.methodology_type,
        mp.status as methodology_status,
        mp.confirmed_at as methodology_confirmed,
        rp.id as routine_id,
        rp.status as routine_status,
        rp.confirmed_at as routine_confirmed,
        rp.is_active as routine_is_active,
        CASE 
          WHEN mp.status != rp.status THEN 'status_mismatch'
          WHEN mp.status = 'active' AND rp.status = 'cancelled' THEN 'methodology_active_routine_cancelled'
          WHEN mp.status = 'cancelled' AND rp.status = 'active' THEN 'methodology_cancelled_routine_active'
          ELSE 'consistent'
        END as inconsistency_type
      FROM app.methodology_plans mp
      LEFT JOIN app.routine_plans rp ON rp.user_id = mp.user_id 
        AND rp.methodology_type = mp.methodology_type
        AND ABS(EXTRACT(EPOCH FROM (rp.confirmed_at - mp.confirmed_at))) < 300
      WHERE ($1::integer IS NULL OR mp.user_id = $1)
        AND rp.id IS NOT NULL
      ORDER BY mp.user_id, mp.confirmed_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    const inconsistencies = result.rows.filter(row => row.inconsistency_type !== 'consistent');
    const consistent = result.rows.filter(row => row.inconsistency_type === 'consistent');
    
    console.log(`🔍 Análisis de consistencia completado:`);
    console.log(`   - Planes consistentes: ${consistent.length}`);
    console.log(`   - Inconsistencias detectadas: ${inconsistencies.length}`);
    
    if (inconsistencies.length > 0) {
      console.log(`\n⚠️ INCONSISTENCIAS DETECTADAS:`);
      inconsistencies.forEach(inc => {
        console.log(`   User ${inc.user_id}: methodology ${inc.methodology_id} (${inc.methodology_status}) vs routine ${inc.routine_id} (${inc.routine_status}) - ${inc.inconsistency_type}`);
      });
    }
    
    return {
      total: result.rows.length,
      consistent: consistent.length,
      inconsistent: inconsistencies.length,
      inconsistencies,
      consistent_plans: consistent
    };
    
  } catch (error) {
    console.error('❌ Error detectando inconsistencies:', error.message);
    throw error;
  }
}

/**
 * Repara inconsistencias automáticamente
 * @param {Array} inconsistencies - Array de inconsistencias del reporte
 * @param {boolean} dryRun - Si true, solo simula las reparaciones
 * @returns {Promise<Object>} Resultado de las reparaciones
 */
export async function repairPlanInconsistencies(inconsistencies, dryRun = true) {
  const client = await pool.connect();
  let repaired = 0;
  let errors = 0;
  
  try {
    if (!dryRun) {
      await client.query('BEGIN');
    }
    
    for (const inconsistency of inconsistencies) {
      try {
        const { user_id, methodology_id, routine_id, inconsistency_type, methodology_status, routine_status } = inconsistency;
        
        console.log(`${dryRun ? '🔄 [DRY RUN]' : '🔧'} Reparando inconsistencia user ${user_id}: ${inconsistency_type}`);
        
        // Estrategia de reparación: activar el que esté más reciente
        if (inconsistency_type === 'methodology_cancelled_routine_active') {
          // Caso más común: methodology cancelado pero routine activo
          // Solución: reactivar methodology para mantener consistencia
          if (!dryRun) {
            await client.query(
              `UPDATE app.methodology_plans 
               SET status = 'active', updated_at = NOW() 
               WHERE id = $1`,
              [methodology_id]
            );
          }
          console.log(`   ✅ ${dryRun ? '[SIMULATED]' : ''} Reactivado methodology_plan ${methodology_id}`);
          repaired++;
          
        } else if (inconsistency_type === 'methodology_active_routine_cancelled') {
          // Methodology activo pero routine cancelado
          // Solución: reactivar routine para mantener consistencia
          if (!dryRun) {
            await client.query(
              `UPDATE app.routine_plans 
               SET status = 'active', updated_at = NOW() 
               WHERE id = $1`,
              [routine_id]
            );
          }
          console.log(`   ✅ ${dryRun ? '[SIMULATED]' : ''} Reactivado routine_plan ${routine_id}`);
          repaired++;
        }
        
      } catch (err) {
        console.error(`❌ Error reparando inconsistencia:`, err.message);
        errors++;
      }
    }
    
    if (!dryRun) {
      await client.query('COMMIT');
      console.log(`✅ Transacción completada: ${repaired} reparaciones, ${errors} errores`);
    } else {
      console.log(`🔍 Dry run completado: ${repaired} reparaciones simuladas, ${errors} errores`);
    }
    
    return { repaired, errors, dryRun };
    
  } catch (error) {
    if (!dryRun) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Error durante reparación:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Función principal para ejecutar análisis y reparación completa
 * @param {number} userId - ID usuario específico, o null para todos
 * @param {boolean} autoRepair - Si true, repara automáticamente
 * @param {boolean} dryRun - Si true, solo simula reparaciones
 */
export async function checkAndRepairPlans(userId = null, autoRepair = false, dryRun = true) {
  console.log(`🔍 Iniciando análisis de consistencia de planes...`);
  
  const report = await detectPlanInconsistencies(userId);
  
  if (report.inconsistent > 0 && autoRepair) {
    console.log(`\n🔧 Iniciando reparación automática (dryRun: ${dryRun})...`);
    const repairResult = await repairPlanInconsistencies(report.inconsistencies, dryRun);
    
    return {
      analysis: report,
      repair: repairResult
    };
  }
  
  return {
    analysis: report,
    repair: null
  };
}