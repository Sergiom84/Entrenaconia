// Script completo de diagnóstico para problemas con rutinas
import fetch from 'node-fetch';
import { pool } from './backend/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_BASE = 'http://localhost:3002';

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log('═'.repeat(60), 'cyan');
  log(` ${title}`, 'cyan');
  log('═'.repeat(60), 'cyan');
}

// 1. Verificar estado del servidor
async function checkServerStatus() {
  logSection('1. ESTADO DEL SERVIDOR');

  try {
    const response = await fetch(`${API_BASE}/api/health`);
    if (response.ok) {
      log('✅ Backend está corriendo en puerto 3002', 'green');
      return true;
    } else {
      log(`❌ Backend responde pero con error: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Backend no está accesible', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    return false;
  }
}

// 2. Verificar conexión a base de datos
async function checkDatabaseConnection() {
  logSection('2. CONEXIÓN A BASE DE DATOS');

  try {
    const result = await pool.query('SELECT current_database(), current_user, version()');
    const dbInfo = result.rows[0];
    log('✅ Conexión a PostgreSQL exitosa', 'green');
    log(`   Database: ${dbInfo.current_database}`, 'blue');
    log(`   User: ${dbInfo.current_user}`, 'blue');
    log(`   Version: ${dbInfo.version.split(',')[0]}`, 'blue');
    return true;
  } catch (error) {
    log('❌ Error conectando a la base de datos', 'red');
    log(`   ${error.message}`, 'yellow');
    return false;
  }
}

// 3. Verificar estructura de tablas de rutinas
async function checkRoutinesTables() {
  logSection('3. ESTRUCTURA DE TABLAS DE RUTINAS');

  const tables = [
    'app.methodology_plans',
    'app.methodology_exercise_sessions',
    'app.methodology_exercise_progress',
    'app.methodology_exercise_feedback',
    'app.methodology_exercise_history_complete'
  ];

  for (const table of tables) {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count,
               (SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = split_part($1, '.', 1)
                AND table_name = split_part($1, '.', 2)) as columns
        FROM ${table}
      `, [table]);

      const { count, columns } = result.rows[0];
      log(`✅ ${table}`, 'green');
      log(`   Registros: ${count} | Columnas: ${columns}`, 'blue');
    } catch (error) {
      log(`❌ ${table} - Error: ${error.message}`, 'red');
    }
  }
}

// 4. Verificar funciones de base de datos
async function checkDatabaseFunctions() {
  logSection('4. FUNCIONES DE BASE DE DATOS');

  const functions = [
    'app.create_methodology_exercise_sessions',
    'app.confirm_routine_plan',
    'app.activate_plan_atomic'
  ];

  for (const func of functions) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = split_part($1, '.', 1)
          AND p.proname = split_part($1, '.', 2)
        ) as exists
      `, [func]);

      if (result.rows[0].exists) {
        log(`✅ ${func} existe`, 'green');
      } else {
        log(`❌ ${func} NO EXISTE`, 'red');
      }
    } catch (error) {
      log(`❌ Error verificando ${func}: ${error.message}`, 'red');
    }
  }
}

// 5. Verificar rutas del API
async function checkAPIRoutes() {
  logSection('5. RUTAS DEL API DE RUTINAS');

  const routes = [
    { method: 'GET', path: '/api/routines/active-plan', auth: false },
    { method: 'POST', path: '/api/routines/bootstrap-plan', auth: false },
    { method: 'POST', path: '/api/routines/confirm-plan', auth: false },
    { method: 'GET', path: '/api/routines/plan-status/1', auth: false },
    { method: 'POST', path: '/api/routines/sessions/start', auth: false },
    { method: 'GET', path: '/api/routines/sessions/1/progress', auth: false }
  ];

  for (const route of routes) {
    try {
      const response = await fetch(`${API_BASE}${route.path}`, {
        method: route.method,
        headers: {
          'Content-Type': 'application/json',
          ...(route.auth ? { 'Authorization': 'Bearer test-token' } : {})
        },
        ...(route.method === 'POST' ? { body: '{}' } : {})
      });

      if (response.status === 401) {
        log(`⚠️  ${route.method} ${route.path} - Requiere autenticación`, 'yellow');
      } else if (response.status === 404 && route.path.includes('/1')) {
        log(`✅ ${route.method} ${route.path} - Ruta existe (404 es esperado para ID test)`, 'green');
      } else if (response.ok) {
        log(`✅ ${route.method} ${route.path} - OK (${response.status})`, 'green');
      } else {
        log(`⚠️  ${route.method} ${route.path} - Status ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`❌ ${route.method} ${route.path} - Error: ${error.message}`, 'red');
    }
  }
}

// 6. Verificar datos de usuario de prueba
async function checkTestUserData() {
  logSection('6. DATOS DE USUARIO DE PRUEBA');

  try {
    // Buscar usuarios con rutinas activas
    const result = await pool.query(`
      SELECT
        u.id as user_id,
        u.email,
        COUNT(DISTINCT mp.id) as methodology_plans,
        COUNT(DISTINCT mp.id) FILTER (WHERE mp.status = 'active') as active_plans,
        COUNT(DISTINCT mes.id) as total_sessions,
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as completed_sessions
      FROM app.users u
      LEFT JOIN app.methodology_plans mp ON mp.user_id = u.id
      LEFT JOIN app.methodology_exercise_sessions mes ON mes.user_id = u.id
      GROUP BY u.id, u.email
      HAVING COUNT(mp.id) > 0
      ORDER BY active_plans DESC, total_sessions DESC
      LIMIT 5
    `);

    if (result.rows.length > 0) {
      log('Usuarios con planes de rutina:', 'cyan');
      for (const user of result.rows) {
        log(`\n  Usuario ID ${user.user_id} (${user.email})`, 'blue');
        log(`    Plans: ${user.methodology_plans} total, ${user.active_plans} activos`, 'white');
        log(`    Sesiones: ${user.total_sessions} total, ${user.completed_sessions} completadas`, 'white');
      }
    } else {
      log('⚠️  No hay usuarios con planes de rutina', 'yellow');
    }
  } catch (error) {
    log(`❌ Error consultando usuarios: ${error.message}`, 'red');
  }
}

// 7. Verificar logs recientes de errores
async function checkRecentErrors() {
  logSection('7. ERRORES RECIENTES EN RUTINAS');

  try {
    // Verificar si hay sesiones con problemas
    const result = await pool.query(`
      SELECT
        mes.id,
        mes.user_id,
        mes.week_number,
        mes.day_name,
        mes.session_status,
        mes.created_at,
        COUNT(mep.id) as progress_count
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY mes.id
      ORDER BY mes.created_at DESC
      LIMIT 10
    `);

    if (result.rows.length > 0) {
      log('Sesiones recientes (últimas 24h):', 'cyan');
      for (const session of result.rows) {
        const status = session.session_status === 'completed' ? '✅' :
                      session.session_status === 'in_progress' ? '🏃' : '⏸️';
        log(`  ${status} Sesión ${session.id} - Usuario ${session.user_id}`, 'white');
        log(`     Semana ${session.week_number}, ${session.day_name}, ${session.progress_count} ejercicios`, 'blue');
      }
    } else {
      log('⚠️  No hay sesiones en las últimas 24 horas', 'yellow');
    }
  } catch (error) {
    log(`❌ Error consultando sesiones recientes: ${error.message}`, 'red');
  }
}

// 8. Verificar CORS y middleware
async function checkCORSConfig() {
  logSection('8. CONFIGURACIÓN CORS');

  try {
    const response = await fetch(`${API_BASE}/api/routines/active-plan`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'
      }
    });

    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers')
    };

    if (corsHeaders['access-control-allow-origin']) {
      log('✅ CORS configurado correctamente', 'green');
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value) log(`   ${key}: ${value}`, 'blue');
      });
    } else {
      log('❌ CORS no está configurado', 'red');
    }
  } catch (error) {
    log(`❌ Error verificando CORS: ${error.message}`, 'red');
  }
}

// 9. Test completo de flujo
async function testCompleteFlow() {
  logSection('9. TEST DE FLUJO COMPLETO');

  // Aquí deberíamos tener un token válido
  const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Token de prueba

  try {
    // Intentar obtener plan activo con token
    log('\n🔍 Intentando obtener plan activo...', 'cyan');
    const response = await fetch(`${API_BASE}/api/routines/active-plan`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });

    if (response.status === 401) {
      log('❌ Token inválido o expirado', 'red');
      log('   Necesitas un token válido para continuar las pruebas', 'yellow');
      return;
    }

    const data = await response.json();

    if (data.success && data.hasActivePlan) {
      log('✅ Plan activo encontrado', 'green');
      log(`   methodology_plan_id: ${data.methodology_plan_id}`, 'blue');
      log(`   planType: ${data.planType}`, 'blue');

      // Intentar obtener estado del plan
      log('\n🔍 Verificando estado del plan...', 'cyan');
      const statusResponse = await fetch(
        `${API_BASE}/api/routines/plan-status/${data.methodology_plan_id}`,
        {
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        log('✅ Estado del plan obtenido', 'green');
        log(`   isConfirmed: ${statusData.isConfirmed}`, 'blue');
        log(`   status: ${statusData.status}`, 'blue');
      }
    } else {
      log('⚠️  No hay plan activo para este usuario', 'yellow');
    }
  } catch (error) {
    log(`❌ Error en test de flujo: ${error.message}`, 'red');
  }
}

// Ejecutar todos los tests
async function runDiagnostics() {
  console.clear();
  log('╔══════════════════════════════════════════════════════════╗', 'magenta');
  log('║     DIAGNÓSTICO COMPLETO DE API DE RUTINAS              ║', 'magenta');
  log('╚══════════════════════════════════════════════════════════╝', 'magenta');

  const serverOk = await checkServerStatus();
  if (!serverOk) {
    log('\n⚠️  El servidor no está corriendo. Inicialo con: npm run backend', 'red');
    process.exit(1);
  }

  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    log('\n⚠️  No se puede conectar a la base de datos', 'red');
    process.exit(1);
  }

  await checkRoutinesTables();
  await checkDatabaseFunctions();
  await checkAPIRoutes();
  await checkTestUserData();
  await checkRecentErrors();
  await checkCORSConfig();
  await testCompleteFlow();

  logSection('DIAGNÓSTICO COMPLETADO');
  log('✨ Revisa los resultados arriba para identificar problemas', 'cyan');

  process.exit(0);
}

// Manejo de errores global
process.on('unhandledRejection', (error) => {
  log(`\n❌ Error no manejado: ${error.message}`, 'red');
  process.exit(1);
});

// Ejecutar diagnósticos
runDiagnostics();