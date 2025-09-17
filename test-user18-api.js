// Test específico para usuario 18 con plan activo
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const API_BASE = 'http://localhost:3002';
const JWT_SECRET = 'entrenaconjwtsecret2024supersecure'; // Debe coincidir con backend

// Crear token para usuario 18
function createTestToken() {
  const payload = {
    userId: 18,
    email: 'sergiohernandezlara07@gmail.com',
    role: 'user'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

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

async function testEndpoint(name, method, path, body = null, token) {
  log(`\n📍 Testing: ${name}`, 'cyan');
  log(`   ${method} ${path}`, 'blue');

  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
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
        const preview = JSON.stringify(data, null, 2);
        log(`   Response: ${preview.substring(0, 500)}${preview.length > 500 ? '...' : ''}`, 'green');
      }
      return { success: true, data };
    } else {
      log(`   ❌ FAILED (${response.status})`, 'red');
      if (data) {
        log(`   Error: ${JSON.stringify(data, null, 2)}`, 'red');
      }
      return { success: false, data };
    }
  } catch (error) {
    log(`   ❌ NETWORK ERROR: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n🚀 TEST DE API DE RUTINAS - USUARIO 18', 'cyan');
  log('════════════════════════════════════════\n', 'cyan');

  const token = createTestToken();
  log(`🔑 Token JWT generado para usuario 18`, 'green');

  // Test 1: Ir directo a obtener plan activo (que valida el token)
  log('\n🔐 Saltando verificación de profile (endpoint no existe)', 'yellow');
  log('   Probando directamente con endpoints de rutinas...', 'blue');

  // Test 2: Obtener plan activo
  const activePlanResult = await testEndpoint(
    'Obtener plan activo',
    'GET',
    '/api/routines/active-plan',
    null,
    token
  );

  if (!activePlanResult.success || !activePlanResult.data?.hasActivePlan) {
    log('\n⚠️  No hay plan activo', 'yellow');
    return;
  }

  const { methodology_plan_id, planId } = activePlanResult.data;
  log(`\n📋 Plan activo encontrado:`, 'cyan');
  log(`   methodology_plan_id: ${methodology_plan_id}`, 'blue');
  log(`   planId: ${planId}`, 'blue');

  // Test 3: Verificar estado del plan
  await testEndpoint(
    'Verificar estado del plan',
    'GET',
    `/api/routines/plan-status/${methodology_plan_id}`,
    null,
    token
  );

  // Test 4: Obtener datos de progreso
  await testEndpoint(
    'Obtener datos de progreso',
    'GET',
    `/api/routines/progress-data?methodology_plan_id=${methodology_plan_id}`,
    null,
    token
  );

  // Test 5: Intentar iniciar sesión de entrenamiento
  const sessionResult = await testEndpoint(
    'Iniciar sesión de entrenamiento',
    'POST',
    '/api/routines/sessions/start',
    {
      methodology_plan_id,
      week_number: 1,
      day_name: 'Lunes'
    },
    token
  );

  if (sessionResult.success && sessionResult.data?.session_id) {
    const sessionId = sessionResult.data.session_id;
    log(`\n🏋️ Sesión iniciada con ID: ${sessionId}`, 'green');

    // Test 6: Obtener progreso de la sesión
    await testEndpoint(
      'Obtener progreso de sesión',
      'GET',
      `/api/routines/sessions/${sessionId}/progress`,
      null,
      token
    );

    // Test 7: Actualizar un ejercicio
    await testEndpoint(
      'Actualizar ejercicio',
      'PUT',
      `/api/routines/sessions/${sessionId}/exercise/0`,
      {
        series_completed: 3,
        status: 'completed',
        time_spent_seconds: 120
      },
      token
    );
  }

  // Test 8: Obtener historial
  await testEndpoint(
    'Obtener datos históricos',
    'GET',
    '/api/routines/historical-data',
    null,
    token
  );

  log('\n✨ TESTS COMPLETADOS', 'cyan');
  log('════════════════════════════════════════\n', 'cyan');
}

// Ejecutar tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});