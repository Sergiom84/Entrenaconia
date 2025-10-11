import { AI_MODULES } from './config/aiConfigs.js';
import { FeatureKey } from './lib/promptRegistry.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Test 4: Verificación de Integración Completa de Hipertrofia\n');

let allTestsPassed = true;
const results = [];

// Test 4.1: Verificar configuración AI
console.log('📋 Test 4.1: Configuración AI...');
try {
  const hipertrofiaConfig = AI_MODULES.HIPERTROFIA_SPECIALIST;

  if (!hipertrofiaConfig) {
    throw new Error('HIPERTROFIA_SPECIALIST no está en AI_MODULES');
  }

  const requiredFields = ['key', 'envKey', 'model', 'temperature', 'max_output_tokens', 'systemPrompt'];
  const missingFields = requiredFields.filter(field => !hipertrofiaConfig[field]);

  if (missingFields.length > 0) {
    throw new Error(`Faltan campos: ${missingFields.join(', ')}`);
  }

  console.log('  ✅ Configuración AI correcta');
  console.log(`     - Modelo: ${hipertrofiaConfig.model}`);
  console.log(`     - Temperature: ${hipertrofiaConfig.temperature}`);
  console.log(`     - Max tokens: ${hipertrofiaConfig.max_output_tokens}`);
  results.push({ test: '4.1 - Config AI', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4.1 - Config AI', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4.2: Verificar prompt existe
console.log('\n📋 Test 4.2: Archivo de Prompt...');
try {
  const promptPath = path.join(process.cwd(), 'prompts', 'hipertrofia_specialist.md');

  if (!fs.existsSync(promptPath)) {
    throw new Error('Archivo de prompt no existe');
  }

  const promptContent = fs.readFileSync(promptPath, 'utf8');

  if (promptContent.length < 1000) {
    throw new Error('Prompt muy corto');
  }

  // Verificar keywords importantes
  const requiredKeywords = ['Hipertrofia', 'volumen', 'intensidad', 'principiante', 'intermedio', 'avanzado'];
  const missingKeywords = requiredKeywords.filter(keyword => !promptContent.includes(keyword));

  if (missingKeywords.length > 0) {
    throw new Error(`Keywords faltantes: ${missingKeywords.join(', ')}`);
  }

  console.log('  ✅ Prompt válido');
  console.log(`     - Tamaño: ${(promptContent.length / 1024).toFixed(2)} KB`);
  console.log(`     - Keywords: ${requiredKeywords.length} encontradas`);
  results.push({ test: '4.2 - Prompt', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4.2 - Prompt', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4.3: Verificar Feature Key
console.log('\n📋 Test 4.3: Feature Key Registry...');
try {
  if (!FeatureKey.HIPERTROFIA_SPECIALIST) {
    throw new Error('HIPERTROFIA_SPECIALIST no está en FeatureKey');
  }

  if (FeatureKey.HIPERTROFIA_SPECIALIST !== 'hipertrofia_specialist') {
    throw new Error('Valor de FeatureKey incorrecto');
  }

  console.log('  ✅ Feature Key registrado correctamente');
  console.log(`     - Key: ${FeatureKey.HIPERTROFIA_SPECIALIST}`);
  results.push({ test: '4.3 - Feature Key', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4.3 - Feature Key', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4.4: Verificar archivos frontend
console.log('\n📋 Test 4.4: Archivos Frontend...');
try {
  const frontendPath = '../src/components/Methodologie/methodologies/Hipertrofia';
  const requiredFiles = [
    'HipertrofiaLevels.js',
    'HipertrofiaMuscleGroups.js',
    'HipertrofiaManualCard.jsx'
  ];

  const missingFiles = requiredFiles.filter(file => {
    const filePath = path.join(process.cwd(), frontendPath, file);
    return !fs.existsSync(filePath);
  });

  if (missingFiles.length > 0) {
    throw new Error(`Archivos faltantes: ${missingFiles.join(', ')}`);
  }

  console.log('  ✅ Todos los archivos frontend presentes');
  console.log(`     - ${requiredFiles.length} archivos verificados`);
  results.push({ test: '4.4 - Frontend', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4.4 - Frontend', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4.5: Verificar endpoints en routineGeneration.js
console.log('\n📋 Test 4.5: Endpoints Backend...');
try {
  const routesPath = path.join(process.cwd(), 'routes', 'routineGeneration.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  const requiredEndpoints = [
    "/specialist/hipertrofia/evaluate",
    "/specialist/hipertrofia/generate"
  ];

  const missingEndpoints = requiredEndpoints.filter(endpoint => !routesContent.includes(endpoint));

  if (missingEndpoints.length > 0) {
    throw new Error(`Endpoints faltantes: ${missingEndpoints.join(', ')}`);
  }

  // Verificar que usa AI_MODULES.HIPERTROFIA_SPECIALIST
  if (!routesContent.includes('AI_MODULES.HIPERTROFIA_SPECIALIST')) {
    throw new Error('No usa AI_MODULES.HIPERTROFIA_SPECIALIST');
  }

  console.log('  ✅ Endpoints backend configurados');
  console.log(`     - ${requiredEndpoints.length} endpoints verificados`);
  results.push({ test: '4.5 - Endpoints', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4.5 - Endpoints', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4.6: Verificar redirecciones en server.js
console.log('\n📋 Test 4.6: Redirecciones Server...');
try {
  const serverPath = path.join(process.cwd(), 'server.js');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  const requiredRedirects = [
    '/api/hipertrofia-specialist/evaluate-profile',
    '/api/hipertrofia-specialist/generate-plan',
    "methodology === 'hipertrofia'"
  ];

  const missingRedirects = requiredRedirects.filter(redirect => !serverContent.includes(redirect));

  if (missingRedirects.length > 0) {
    throw new Error(`Redirecciones faltantes: ${missingRedirects.join(', ')}`);
  }

  console.log('  ✅ Redirecciones configuradas');
  console.log(`     - ${requiredRedirects.length} redirecciones verificadas`);
  results.push({ test: '4.6 - Redirecciones', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4.6 - Redirecciones', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Resumen final
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE TESTS');
console.log('='.repeat(60));

results.forEach(result => {
  const icon = result.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${result.test}: ${result.status}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
});

console.log('\n' + '='.repeat(60));
if (allTestsPassed) {
  console.log('🎉 TODOS LOS TESTS PASARON - INTEGRACIÓN COMPLETA ✅');
} else {
  console.log('⚠️ ALGUNOS TESTS FALLARON - REVISAR ERRORES');
}
console.log('='.repeat(60));

process.exit(allTestsPassed ? 0 : 1);
