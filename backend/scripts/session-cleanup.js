#!/usr/bin/env node

/**
 * Script de limpieza automática de sesiones
 * Ejecuta mantenimiento de sesiones y limpieza de datos antiguos
 * Uso: node session-cleanup.js [--verbose] [--dry-run]
 */

import { pool } from '../db.js';
import { performSessionCleanup } from '../utils/sessionUtils.js';

const verbose = process.argv.includes('--verbose');
const dryRun = process.argv.includes('--dry-run');

async function runSessionCleanup() {
  console.log('🧹 Iniciando limpieza de sesiones...');
  console.log('Fecha:', new Date().toISOString());
  
  if (dryRun) {
    console.log('⚠️  MODO DRY-RUN - No se realizarán cambios');
  }

  try {
    // 1. Ejecutar mantenimiento básico de sesiones
    console.log('\n1️⃣  Ejecutando mantenimiento básico...');
    const maintenanceResult = await performSessionCleanup();
    
    if (maintenanceResult.success) {
      console.log('✅ Mantenimiento básico completado:', maintenanceResult.result);
    } else {
      console.error('❌ Error en mantenimiento básico:', maintenanceResult.error);
    }

    // 2. Obtener estadísticas antes de limpieza
    const statsBefore = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_sessions,
        COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_sessions,
        COUNT(*) FILTER (WHERE login_time < NOW() - INTERVAL '90 days') as old_sessions,
        MIN(login_time) as oldest_session,
        MAX(login_time) as newest_session
      FROM app.user_sessions
    `);

    console.log('\n📊 Estadísticas antes de limpieza:');
    if (verbose) {
      console.table(statsBefore.rows[0]);
    } else {
      const stats = statsBefore.rows[0];
      console.log(`- Total sesiones: ${stats.total_sessions}`);
      console.log(`- Sesiones activas: ${stats.active_sessions}`);
      console.log(`- Sesiones inactivas: ${stats.inactive_sessions}`);
      console.log(`- Sesiones antiguas (>90 días): ${stats.old_sessions}`);
    }

    // 3. Limpiar sesiones muy antiguas (más de 90 días)
    console.log('\n2️⃣  Limpiando sesiones antiguas...');
    
    if (!dryRun) {
      const oldCleanupResult = await pool.query('SELECT app.cleanup_old_sessions() as deleted');
      const deletedCount = oldCleanupResult.rows[0]?.deleted || 0;
      console.log(`✅ Sesiones antiguas eliminadas: ${deletedCount}`);
    } else {
      const oldSessionsCount = await pool.query(`
        SELECT COUNT(*) as count 
        FROM app.user_sessions 
        WHERE login_time < NOW() - INTERVAL '90 days' AND is_active = FALSE
      `);
      console.log(`🔍 Se eliminarían ${oldSessionsCount.rows[0].count} sesiones antiguas`);
    }

    // 4. Detectar sesiones sospechosas
    console.log('\n3️⃣  Detectando sesiones sospechosas...');
    
    const suspiciousSessions = await pool.query(`
      SELECT 
        session_id,
        user_id,
        login_time,
        last_activity,
        EXTRACT(EPOCH FROM (NOW() - last_activity))/3600 as hours_inactive,
        ip_address,
        is_active
      FROM app.user_sessions 
      WHERE is_active = TRUE 
        AND (
          last_activity < NOW() - INTERVAL '12 hours' OR
          login_time < NOW() - INTERVAL '7 days'
        )
      ORDER BY last_activity ASC
    `);

    if (suspiciousSessions.rows.length > 0) {
      console.log(`⚠️  ${suspiciousSessions.rows.length} sesiones sospechosas encontradas:`);
      if (verbose) {
        console.table(suspiciousSessions.rows);
      } else {
        suspiciousSessions.rows.forEach(session => {
          console.log(`- Sesión ${session.session_id}: Usuario ${session.user_id}, ${Math.round(session.hours_inactive)}h inactiva`);
        });
      }
    } else {
      console.log('✅ No se encontraron sesiones sospechosas');
    }

    // 5. Limpiar logs de autenticación antiguos (más de 6 meses)
    console.log('\n4️⃣  Limpiando logs de autenticación antiguos...');
    
    if (!dryRun) {
      const authLogsCleanup = await pool.query(`
        DELETE FROM app.auth_logs 
        WHERE created_at < NOW() - INTERVAL '6 months'
        RETURNING COUNT(*) as deleted
      `);
      // PostgreSQL doesn't support RETURNING COUNT(*) directly, so we'll use a different approach
      const authLogsResult = await pool.query(`
        WITH deleted AS (
          DELETE FROM app.auth_logs 
          WHERE created_at < NOW() - INTERVAL '6 months'
          RETURNING id
        )
        SELECT COUNT(*) as deleted FROM deleted
      `);
      console.log(`✅ Logs antiguos eliminados: ${authLogsResult.rows[0]?.deleted || 0}`);
    } else {
      const oldLogsCount = await pool.query(`
        SELECT COUNT(*) as count 
        FROM app.auth_logs 
        WHERE created_at < NOW() - INTERVAL '6 months'
      `);
      console.log(`🔍 Se eliminarían ${oldLogsCount.rows[0].count} logs antiguos`);
    }

    // 6. Estadísticas finales
    const statsAfter = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_sessions,
        COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_sessions,
        COUNT(*) as auth_logs_count
      FROM app.user_sessions
    `);

    const authLogsCount = await pool.query('SELECT COUNT(*) as count FROM app.auth_logs');

    console.log('\n📊 Estadísticas finales:');
    const finalStats = {
      ...statsAfter.rows[0],
      auth_logs_count: authLogsCount.rows[0].count
    };
    
    if (verbose) {
      console.table(finalStats);
    } else {
      console.log(`- Total sesiones: ${finalStats.total_sessions}`);
      console.log(`- Sesiones activas: ${finalStats.active_sessions}`);
      console.log(`- Logs de autenticación: ${finalStats.auth_logs_count}`);
    }

    console.log('\n✅ Limpieza de sesiones completada exitosamente');

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar script
runSessionCleanup().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});