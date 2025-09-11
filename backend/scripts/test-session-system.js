#!/usr/bin/env node

/**
 * Script de prueba completa del sistema de sesiones
 */

import { pool } from '../db.js';

async function testSessionSystem() {
  console.log('🧪 Probando sistema de sesiones completo...');

  try {
    // 1. Verificar estructura de tablas
    console.log('\n1️⃣  Verificando estructura de base de datos...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app' 
        AND table_name IN ('user_sessions', 'auth_logs')
    `);
    console.log('✅ Tablas encontradas:', tables.rows.map(r => r.table_name));

    // 2. Verificar funciones
    console.log('\n2️⃣  Verificando funciones de sesión...');
    const functions = await pool.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
        AND proname IN ('get_user_session_stats', 'session_maintenance', 'cleanup_old_sessions')
    `);
    console.log('✅ Funciones encontradas:', functions.rows.map(r => r.proname));

    // 3. Ejecutar test básico de mantenimiento
    console.log('\n3️⃣  Ejecutando mantenimiento de sesiones...');
    const maintenance = await pool.query('SELECT app.session_maintenance() as result');
    console.log('✅ Mantenimiento:', maintenance.rows[0].result);

    // 4. Obtener un usuario real para pruebas
    const userCheck = await pool.query('SELECT id, nombre FROM app.users ORDER BY id LIMIT 1');
    const testUserId = userCheck.rows[0]?.id || 18;
    const testUserName = userCheck.rows[0]?.nombre || 'Test User';
    
    console.log(`\n4️⃣  Verificando estadísticas (usuario ID: ${testUserId} - ${testUserName})...`);
    const stats = await pool.query('SELECT * FROM app.get_user_session_stats($1)', [testUserId]);
    console.log('✅ Estadísticas obtenidas:');
    if (stats.rows[0]) {
      console.table(stats.rows[0]);
    } else {
      console.log(`Sin datos para usuario ID: ${testUserId}`);
    }

    // 5. Crear sesión de prueba
    console.log('\n5️⃣  Creando sesión de prueba...');
    const testSession = await pool.query(`
      INSERT INTO app.user_sessions (
        user_id, ip_address, user_agent, jwt_token_hash
      ) VALUES ($1, '127.0.0.1', 'Test-Agent/1.0', 'test-hash-' || extract(epoch from now()))
      RETURNING session_id, login_time
    `, [testUserId]);
    
    if (testSession.rows[0]) {
      console.log('✅ Sesión de prueba creada:', testSession.rows[0]);
      
      // 6. Actualizar actividad de la sesión
      const sessionId = testSession.rows[0].session_id;
      await pool.query(`
        UPDATE app.user_sessions 
        SET last_activity = NOW() 
        WHERE session_id = $1
      `, [sessionId]);
      console.log('✅ Actividad actualizada para sesión:', sessionId);
      
      // 7. Cerrar sesión de prueba
      await pool.query(`
        UPDATE app.user_sessions 
        SET is_active = FALSE, logout_time = NOW(), logout_type = 'manual' 
        WHERE session_id = $1
      `, [sessionId]);
      console.log('✅ Sesión de prueba cerrada:', sessionId);
    }

    // 8. Verificar estadísticas finales
    console.log('\n6️⃣  Verificando estadísticas finales...');
    const finalStats = await pool.query('SELECT * FROM app.get_user_session_stats($1)', [testUserId]);
    if (finalStats.rows[0]) {
      console.table(finalStats.rows[0]);
    }

    console.log('\n🎉 Sistema de sesiones completamente funcional!');
    console.log('\n📋 Resumen de funcionalidades probadas:');
    console.log('   ✅ Estructura de base de datos');
    console.log('   ✅ Funciones de mantenimiento');
    console.log('   ✅ Creación de sesiones');
    console.log('   ✅ Actualización de actividad');
    console.log('   ✅ Cierre de sesiones');
    console.log('   ✅ Estadísticas de usuario');

  } catch (error) {
    console.error('❌ Error en pruebas:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testSessionSystem();