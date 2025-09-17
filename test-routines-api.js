// Script de prueba para verificar endpoints de rutinas
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

const API_BASE = 'http://localhost:3002';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test endpoint con manejo de errores mejorado
async function testEndpoint(name, method, path, body = null) {
  log(`\n📍 Testing: ${name}`, 'cyan');
  log(`   ${method} ${path}`, 'blue');

  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
      log(`   Body: ${JSON.stringify(body, null, 2)}`, 'yellow');
    }

    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => null);

    if (response.ok) {
      log(`   ✅ SUCCESS (${response.status})`, 'green');
      if (data) {
        log(`   Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`, 'green');
      }
    } else {
      log(`   ❌ FAILED (${response.status})`, 'red');
      if (data) {
        log(`   Error: ${JSON.stringify(data, null, 2)}`, 'red');
      }
    }

    return { success: response.ok, status: response.status, data };
  } catch (error) {
    log(`   ❌ NETWORK ERROR: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// Verificar que el backend está corriendo
async function checkBackendHealth() {
  log('\n🏥 Checking backend health...', 'cyan');

  try {
    const response = await fetch(`${API_BASE}/api/health`);
    if (response.ok) {
      log('   ✅ Backend is running', 'green');
      return true;
    }
  } catch (error) {
    log('   ❌ Backend is not accessible', 'red');
    log(`   Make sure backend is running on port 3002`, 'yellow');
    return false;
  }
}

// Verificar autenticación
async function checkAuth() {
  log('\n🔐 Checking authentication...', 'cyan');

  try {
    const response = await fetch(`${API_BASE}/api/user/profile`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      log('   ✅ Authentication valid', 'green');
      if (data?.user) {
        log(`   User ID: ${data.user.id}`, 'green');
        log(`   Email: ${data.user.email}`, 'green');
      }
      return data?.user?.id;
    } else {
      log('   ❌ Authentication failed', 'red');
      log(`   Status: ${response.status}`, 'red');
      if (data?.error) {
        log(`   Error: ${data.error}`, 'red');
      }
      return null;
    }
  } catch (error) {
    log(`   ❌ Auth check error: ${error.message}`, 'red');
    return null;
  }
}

// Main test runner
async function runTests() {
  log('\n🚀 ROUTINE API TEST SUITE', 'cyan');
  log('================================\n', 'cyan');

  // 1. Verificar backend
  const backendOk = await checkBackendHealth();
  if (!backendOk) {
    log('\n⚠️  Cannot continue without backend', 'red');
    process.exit(1);
  }

  // 2. Verificar autenticación
  const userId = await checkAuth();
  if (!userId) {
    log('\n⚠️  Cannot continue without valid auth token', 'red');
    log('   Set TEST_TOKEN in .env.local or update this script', 'yellow');
    process.exit(1);
  }

  // 3. Probar endpoints principales
  log('\n📋 TESTING ROUTINE ENDPOINTS', 'cyan');
  log('================================\n', 'cyan');

  // Test 1: GET /api/routines/active-plan
  const activePlanResult = await testEndpoint(
    'Get Active Plan',
    'GET',
    '/api/routines/active-plan'
  );

  // Test 2: POST /api/routines/bootstrap-plan (solo si hay plan activo)
  if (activePlanResult.data?.planId) {
    await testEndpoint(
      'Bootstrap Plan',
      'POST',
      '/api/routines/bootstrap-plan',
      { routine_plan_id: activePlanResult.data.planId }
    );
  }

  // Test 3: GET /api/routines/plan-status/:id (si hay methodology_plan_id)
  if (activePlanResult.data?.methodology_plan_id) {
    await testEndpoint(
      'Get Plan Status',
      'GET',
      `/api/routines/plan-status/${activePlanResult.data.methodology_plan_id}`
    );
  }

  // Test 4: POST /api/routines/confirm-plan (ejemplo con datos dummy)
  if (activePlanResult.data?.methodology_plan_id) {
    await testEndpoint(
      'Confirm Plan',
      'POST',
      '/api/routines/confirm-plan',
      {
        methodology_plan_id: activePlanResult.data.methodology_plan_id,
        routine_plan_id: activePlanResult.data.planId
      }
    );
  }

  // Test 5: POST /api/routines/sessions/start (ejemplo con datos dummy)
  if (activePlanResult.data?.methodology_plan_id) {
    await testEndpoint(
      'Start Session',
      'POST',
      '/api/routines/sessions/start',
      {
        methodology_plan_id: activePlanResult.data.methodology_plan_id,
        week_number: 1,
        day_name: 'Lunes'
      }
    );
  }

  // Test 6: GET /api/routines/progress-data
  if (activePlanResult.data?.methodology_plan_id) {
    await testEndpoint(
      'Get Progress Data',
      'GET',
      `/api/routines/progress-data?methodology_plan_id=${activePlanResult.data.methodology_plan_id}`
    );
  }

  // Test 7: GET /api/routines/historical-data
  await testEndpoint(
    'Get Historical Data',
    'GET',
    '/api/routines/historical-data'
  );

  log('\n✨ TEST SUITE COMPLETED', 'cyan');
  log('================================\n', 'cyan');

  // Resumen
  log('📊 SUMMARY:', 'cyan');
  log(`   Backend: ${backendOk ? '✅ Running' : '❌ Not running'}`, backendOk ? 'green' : 'red');
  log(`   Auth: ${userId ? `✅ Valid (User ${userId})` : '❌ Invalid'}`, userId ? 'green' : 'red');
}

// Ejecutar tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});