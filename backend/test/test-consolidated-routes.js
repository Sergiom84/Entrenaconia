/**
 * Script de prueba para verificar el sistema consolidado de rutas
 * Ejecutar con: node test/test-consolidated-routes.js
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3002/api';
const TOKEN = 'YOUR_JWT_TOKEN'; // Reemplazar con un token válido

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function testEndpoint(method, path, description, body = null) {
  console.log(`\n${colors.blue}Testing: ${description}${colors.reset}`);
  console.log(`${method} ${path}`);

  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);

    if (response.ok) {
      console.log(`${colors.green}✅ Status: ${response.status}${colors.reset}`);
      const data = await response.json();
      console.log('Response preview:', JSON.stringify(data).substring(0, 200) + '...');
      return { success: true, data };
    } else {
      console.log(`${colors.red}❌ Status: ${response.status}${colors.reset}`);
      const text = await response.text();
      console.log('Error:', text.substring(0, 200));
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log(`${colors.red}❌ Network Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(`${colors.yellow}========================================`);
  console.log('TESTING CONSOLIDATED ROUTINE GENERATION');
  console.log(`========================================${colors.reset}`);

  const tests = [
    // Health check
    {
      method: 'GET',
      path: '/routine-generation/health',
      description: 'Health Check - Sistema Consolidado'
    },

    // Metodologías disponibles
    {
      method: 'GET',
      path: '/routine-generation/methodologies',
      description: 'Obtener Metodologías Disponibles'
    },

    // Niveles de calistenia
    {
      method: 'GET',
      path: '/routine-generation/calistenia/levels',
      description: 'Obtener Niveles de Calistenia'
    },

    // Test de aliases legacy
    {
      method: 'GET',
      path: '/gym-routine/methodologies',
      description: 'Alias Legacy - Metodologías de Gimnasio'
    },

    // Evaluación de calistenia (necesita token válido)
    {
      method: 'POST',
      path: '/calistenia-specialist/evaluate-profile',
      description: 'Alias Legacy - Evaluación de Perfil Calistenia',
      body: {}
    },

    // Plan actual del usuario (necesita token válido)
    {
      method: 'GET',
      path: '/routine-generation/user/current-plan',
      description: 'Obtener Plan Activo del Usuario'
    }
  ];

  let successCount = 0;
  let failureCount = 0;

  for (const test of tests) {
    const result = await testEndpoint(test.method, test.path, test.description, test.body);
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  // Resumen
  console.log(`\n${colors.yellow}========================================`);
  console.log('RESUMEN DE PRUEBAS');
  console.log(`========================================${colors.reset}`);
  console.log(`${colors.green}✅ Exitosas: ${successCount}${colors.reset}`);
  console.log(`${colors.red}❌ Fallidas: ${failureCount}${colors.reset}`);
  console.log(`Total: ${successCount + failureCount}`);

  // Notas
  console.log(`\n${colors.blue}NOTAS:${colors.reset}`);
  console.log('1. Los endpoints POST requieren un token JWT válido');
  console.log('2. Reemplaza YOUR_JWT_TOKEN con un token real');
  console.log('3. Asegúrate de que el servidor esté corriendo en localhost:3002');
  console.log('4. Los endpoints que requieren autenticación fallarán sin un token válido');
}

// Ejecutar tests
runTests().catch(console.error);