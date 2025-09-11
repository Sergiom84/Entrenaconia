// backend/scripts/diagnose_data_inconsistency.js
import { pool } from "../db.js";

async function analyzeDataInconsistency() {
  try {
    console.log("🔍 INICIANDO ANÁLISIS DE INCONSISTENCIA DE DATOS");
    console.log("=" .repeat(60));

    // 1. Verificar usuarios con múltiples methodology_plans activos
    console.log("\n📊 1. ANÁLISIS DE METHODOLOGY_PLANS ACTIVOS MÚLTIPLES");
    const multipleActivePlansQuery = `
      SELECT 
        user_id,
        COUNT(*) as active_plans_count,
        ARRAY_AGG(id ORDER BY created_at DESC) as plan_ids,
        ARRAY_AGG(methodology_type ORDER BY created_at DESC) as methodology_types,
        ARRAY_AGG(created_at::text ORDER BY created_at DESC) as created_dates
      FROM app.methodology_plans 
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC;
    `;
    
    const multipleActivePlans = await pool.query(multipleActivePlansQuery);
    
    if (multipleActivePlans.rowCount === 0) {
      console.log("✅ No se encontraron usuarios con múltiples methodology_plans activos");
    } else {
      console.log(`❌ ENCONTRADOS ${multipleActivePlans.rowCount} usuarios con múltiples planes activos:`);
      multipleActivePlans.rows.forEach(row => {
        console.log(`   • Usuario ${row.user_id}: ${row.active_plans_count} planes activos`);
        console.log(`     - Plan IDs: [${row.plan_ids.join(', ')}]`);
        console.log(`     - Metodologías: [${row.methodology_types.join(', ')}]`);
        console.log(`     - Fechas: [${row.created_dates.map(d => d.substring(0, 10)).join(', ')}]`);
      });
    }

    // 2. Analizar routine_plans con estados inconsistentes
    console.log("\n📊 2. ANÁLISIS DE ROUTINE_PLANS CON ESTADOS INCONSISTENTES");
    const inconsistentRoutinePlansQuery = `
      SELECT 
        user_id,
        id,
        status,
        is_active,
        created_at,
        updated_at,
        CASE 
          WHEN status = 'cancelled' AND is_active = true THEN 'INCONSISTENTE: cancelled pero is_active=true'
          WHEN status = 'active' AND is_active = false THEN 'INCONSISTENTE: active pero is_active=false'
          ELSE 'CONSISTENTE'
        END as consistency_status
      FROM app.routine_plans
      WHERE (status = 'cancelled' AND is_active = true) 
         OR (status = 'active' AND is_active = false)
      ORDER BY user_id, created_at DESC;
    `;
    
    const inconsistentRoutinePlans = await pool.query(inconsistentRoutinePlansQuery);
    
    if (inconsistentRoutinePlans.rowCount === 0) {
      console.log("✅ No se encontraron routine_plans con estados inconsistentes");
    } else {
      console.log(`❌ ENCONTRADOS ${inconsistentRoutinePlans.rowCount} routine_plans inconsistentes:`);
      inconsistentRoutinePlans.rows.forEach(row => {
        console.log(`   • Usuario ${row.user_id}, Plan ${row.id}:`);
        console.log(`     - Status: ${row.status}, is_active: ${row.is_active}`);
        console.log(`     - Problema: ${row.consistency_status}`);
        console.log(`     - Creado: ${row.created_at.toISOString().substring(0, 10)}`);
      });
    }

    // 3. Estadísticas generales de estados de planes
    console.log("\n📊 3. ESTADÍSTICAS GENERALES DE ESTADOS");
    
    // methodology_plans
    const methodologyStatsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM app.methodology_plans
      GROUP BY status
      ORDER BY count DESC;
    `;
    
    const methodologyStats = await pool.query(methodologyStatsQuery);
    console.log("\n📈 METHODOLOGY_PLANS por estado:");
    methodologyStats.rows.forEach(row => {
      console.log(`   • ${row.status}: ${row.count} planes (${row.unique_users} usuarios únicos)`);
    });

    // routine_plans
    const routineStatsQuery = `
      SELECT 
        status,
        is_active,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM app.routine_plans
      GROUP BY status, is_active
      ORDER BY status, is_active;
    `;
    
    const routineStats = await pool.query(routineStatsQuery);
    console.log("\n📈 ROUTINE_PLANS por estado:");
    routineStats.rows.forEach(row => {
      console.log(`   • ${row.status} + is_active=${row.is_active}: ${row.count} planes (${row.unique_users} usuarios únicos)`);
    });

    // 4. Verificar usuario 19 específicamente
    console.log("\n📊 4. ANÁLISIS ESPECÍFICO DEL USUARIO 19");
    
    const user19MethodologyQuery = `
      SELECT 
        id,
        methodology_type,
        status,
        created_at,
        confirmed_at
      FROM app.methodology_plans
      WHERE user_id = 19
      ORDER BY created_at DESC;
    `;
    
    const user19Methodology = await pool.query(user19MethodologyQuery);
    console.log(`\n👤 Usuario 19 - METHODOLOGY_PLANS (${user19Methodology.rowCount} total):`);
    user19Methodology.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Plan ${row.id}: ${row.methodology_type} - ${row.status}`);
      console.log(`      Creado: ${row.created_at.toISOString().substring(0, 19)}`);
      console.log(`      Confirmado: ${row.confirmed_at ? row.confirmed_at.toISOString().substring(0, 19) : 'No confirmado'}`);
    });

    const user19RoutineQuery = `
      SELECT 
        id,
        status,
        is_active,
        created_at,
        updated_at
      FROM app.routine_plans
      WHERE user_id = 19
      ORDER BY created_at DESC;
    `;
    
    const user19Routine = await pool.query(user19RoutineQuery);
    console.log(`\n👤 Usuario 19 - ROUTINE_PLANS (${user19Routine.rowCount} total):`);
    user19Routine.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Plan ${row.id}: ${row.status} - is_active=${row.is_active}`);
      console.log(`      Creado: ${row.created_at.toISOString().substring(0, 19)}`);
      console.log(`      Actualizado: ${row.updated_at.toISOString().substring(0, 19)}`);
    });

    // 5. Verificar constraints existentes
    console.log("\n📊 5. ANÁLISIS DE CONSTRAINTS EXISTENTES");
    
    const constraintsQuery = `
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'app' 
        AND tc.table_name IN ('methodology_plans', 'routine_plans')
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `;
    
    const constraints = await pool.query(constraintsQuery);
    console.log("\n🔒 CONSTRAINTS existentes:");
    let currentTable = '';
    constraints.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        console.log(`\n📋 Tabla: ${row.table_name}`);
        currentTable = row.table_name;
      }
      console.log(`   • ${row.constraint_type}: ${row.constraint_name}`);
      if (row.column_name) console.log(`     - Columna: ${row.column_name}`);
      if (row.check_clause) console.log(`     - Check: ${row.check_clause}`);
    });

    // 6. Usuarios afectados total
    console.log("\n📊 6. RESUMEN DE USUARIOS AFECTADOS");
    
    const affectedUsersQuery = `
      WITH problematic_users AS (
        SELECT DISTINCT user_id, 'multiple_methodology_active' as problem_type
        FROM (
          SELECT user_id, COUNT(*) as cnt 
          FROM app.methodology_plans 
          WHERE status = 'active' 
          GROUP BY user_id 
          HAVING COUNT(*) > 1
        ) multi
        UNION
        SELECT DISTINCT user_id, 'inconsistent_routine_state' as problem_type
        FROM app.routine_plans
        WHERE (status = 'cancelled' AND is_active = true) 
           OR (status = 'active' AND is_active = false)
      )
      SELECT 
        problem_type,
        COUNT(DISTINCT user_id) as affected_users,
        ARRAY_AGG(DISTINCT user_id ORDER BY user_id) as user_ids
      FROM problematic_users
      GROUP BY problem_type;
    `;
    
    const affectedUsers = await pool.query(affectedUsersQuery);
    if (affectedUsers.rowCount === 0) {
      console.log("✅ No hay usuarios con problemas de consistencia de datos");
    } else {
      console.log("❌ USUARIOS AFECTADOS POR PROBLEMA:");
      affectedUsers.rows.forEach(row => {
        console.log(`   • ${row.problem_type}: ${row.affected_users} usuarios`);
        console.log(`     - IDs: [${row.user_ids.join(', ')}]`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("🏁 ANÁLISIS COMPLETADO");

  } catch (error) {
    console.error("❌ Error en análisis:", error);
  }
}

// Ejecutar análisis
analyzeDataInconsistency()
  .then(() => {
    console.log("\n✅ Script de diagnóstico completado");
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });