import { AI_MODULES } from './config/aiConfigs.js';
import { FeatureKey } from './lib/promptRegistry.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Test de Integración Completa de Powerlifting\n');

let allTestsPassed = true;
const results = [];

// Test 1: Verificar configuración AI
console.log('📋 Test 1: Configuración AI...');
try {
  const powerliftingConfig = AI_MODULES.POWERLIFTING_SPECIALIST;

  if (!powerliftingConfig) {
    throw new Error('POWERLIFTING_SPECIALIST no está en AI_MODULES');
  }

  const requiredFields = ['key', 'envKey', 'model', 'temperature', 'max_output_tokens', 'systemPrompt'];
  const missingFields = requiredFields.filter(field => !powerliftingConfig[field]);

  if (missingFields.length > 0) {
    throw new Error(`Faltan campos: ${missingFields.join(', ')}`);
  }

  console.log('  ✅ Configuración AI correcta');
  console.log(`     - Modelo: ${powerliftingConfig.model}`);
  console.log(`     - Temperature: ${powerliftingConfig.temperature}`);
  console.log(`     - Max tokens: ${powerliftingConfig.max_output_tokens}`);
  results.push({ test: '1 - Config AI', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '1 - Config AI', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 2: Verificar prompt existe
console.log('\n📋 Test 2: Archivo de Prompt...');
try {
  const promptPath = path.join(process.cwd(), 'prompts', 'powerlifting_specialist.md');

  if (!fs.existsSync(promptPath)) {
    throw new Error('Archivo de prompt no existe');
  }

  const promptContent = fs.readFileSync(promptPath, 'utf8');

  if (promptContent.length < 1000) {
    throw new Error('Prompt muy corto');
  }

  // Verificar keywords importantes
  const requiredKeywords = ['Powerlifting', 'sentadilla', 'press', 'peso muerto', 'novato', 'intermedio', 'avanzado'];
  const missingKeywords = requiredKeywords.filter(keyword => !promptContent.toLowerCase().includes(keyword.toLowerCase()));

  if (missingKeywords.length > 0) {
    throw new Error(`Keywords faltantes: ${missingKeywords.join(', ')}`);
  }

  console.log('  ✅ Prompt válido');
  console.log(`     - Tamaño: ${(promptContent.length / 1024).toFixed(2)} KB`);
  console.log(`     - Keywords: ${requiredKeywords.length} encontradas`);
  results.push({ test: '2 - Prompt', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '2 - Prompt', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 3: Verificar Feature Key
console.log('\n📋 Test 3: Feature Key Registry...');
try {
  if (!FeatureKey.POWERLIFTING_SPECIALIST) {
    throw new Error('POWERLIFTING_SPECIALIST no está en FeatureKey');
  }

  if (FeatureKey.POWERLIFTING_SPECIALIST !== 'powerlifting_specialist') {
    throw new Error('Valor de FeatureKey incorrecto');
  }

  console.log('  ✅ Feature Key registrado correctamente');
  console.log(`     - Key: ${FeatureKey.POWERLIFTING_SPECIALIST}`);
  results.push({ test: '3 - Feature Key', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '3 - Feature Key', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4: Verificar archivos frontend
console.log('\n📋 Test 4: Archivos Frontend...');
try {
  const frontendPath = '../src/components/Methodologie/methodologies/Powerlifting';
  const requiredFiles = [
    'PowerliftingLevels.js',
    'PowerliftingMuscleGroups.js',
    'PowerliftingManualCard.jsx'
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
  results.push({ test: '4 - Frontend', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4 - Frontend', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 5: Verificar endpoints en routineGeneration.js
console.log('\n📋 Test 5: Endpoints Backend...');
try {
  const routesPath = path.join(process.cwd(), 'routes', 'routineGeneration.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  const requiredEndpoints = [
    "/specialist/powerlifting/evaluate",
    "/specialist/powerlifting/generate"
  ];

  const missingEndpoints = requiredEndpoints.filter(endpoint => !routesContent.includes(endpoint));

  if (missingEndpoints.length > 0) {
    throw new Error(`Endpoints faltantes: ${missingEndpoints.join(', ')}`);
  }

  // Verificar que usa AI_MODULES.POWERLIFTING_SPECIALIST
  if (!routesContent.includes('AI_MODULES.POWERLIFTING_SPECIALIST')) {
    throw new Error('No usa AI_MODULES.POWERLIFTING_SPECIALIST');
  }

  console.log('  ✅ Endpoints backend configurados');
  console.log(`     - ${requiredEndpoints.length} endpoints verificados`);
  results.push({ test: '5 - Endpoints', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '5 - Endpoints', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 6: Verificar redirecciones en server.js
console.log('\n📋 Test 6: Redirecciones Server...');
try {
  const serverPath = path.join(process.cwd(), 'server.js');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  const requiredRedirects = [
    '/api/powerlifting-specialist/evaluate-profile',
    '/api/powerlifting-specialist/generate-plan',
    "methodology === 'powerlifting'"
  ];

  const missingRedirects = requiredRedirects.filter(redirect => !serverContent.includes(redirect));

  if (missingRedirects.length > 0) {
    throw new Error(`Redirecciones faltantes: ${missingRedirects.join(', ')}`);
  }

  console.log('  ✅ Redirecciones configuradas');
  console.log(`     - ${requiredRedirects.length} redirecciones verificadas`);
  results.push({ test: '6 - Redirecciones', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '6 - Redirecciones', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 7: Verificar tabla de ejercicios en base de datos
console.log('\n📋 Test 7: Tabla Ejercicios_Powerlifting...');
try {
  const { pool } = await import('./db.js');
  const client = await pool.connect();

  try {
    // Verificar que la tabla existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app'
        AND table_name = 'Ejercicios_Powerlifting'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      throw new Error('Tabla Ejercicios_Powerlifting no existe');
    }

    // Verificar que tiene ejercicios
    const countResult = await client.query('SELECT COUNT(*) FROM app."Ejercicios_Powerlifting"');
    const count = parseInt(countResult.rows[0].count);

    if (count === 0) {
      throw new Error('Tabla Ejercicios_Powerlifting está vacía');
    }

    // Verificar distribución por nivel
    const levelDistribution = await client.query(`
      SELECT nivel, COUNT(*) as total
      FROM app."Ejercicios_Powerlifting"
      GROUP BY nivel
      ORDER BY nivel;
    `);

    console.log('  ✅ Tabla de ejercicios configurada');
    console.log(`     - Total ejercicios: ${count}`);
    console.log('     - Distribución por nivel:');
    levelDistribution.rows.forEach(row => {
      console.log(`       · ${row.nivel}: ${row.total} ejercicios`);
    });

    results.push({ test: '7 - Base de Datos', status: 'PASS' });
  } finally {
    client.release();
    await pool.end();
  }
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '7 - Base de Datos', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 8: Verificar integración en MethodologiesScreen
console.log('\n📋 Test 8: Integración Frontend...');
try {
  const methodologiesScreenPath = path.join(process.cwd(), '../src/components/Methodologie/MethodologiesScreen.jsx');
  const screenContent = fs.readFileSync(methodologiesScreenPath, 'utf8');

  const requiredIntegrations = [
    'import PowerliftingManualCard',
    'handlePowerliftingManualGenerate',
    "ui.showPowerliftingManual",
    "methodology.name === 'Powerlifting'"
  ];

  const missingIntegrations = requiredIntegrations.filter(integration => !screenContent.includes(integration));

  if (missingIntegrations.length > 0) {
    throw new Error(`Integraciones faltantes: ${missingIntegrations.join(', ')}`);
  }

  console.log('  ✅ MethodologiesScreen integrado correctamente');
  console.log(`     - ${requiredIntegrations.length} integraciones verificadas`);
  results.push({ test: '8 - Integración Frontend', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '8 - Integración Frontend', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 9: Verificar methodologiesData.js
console.log('\n📋 Test 9: methodologiesData.js...');
try {
  const methodologiesDataPath = path.join(process.cwd(), '../src/components/Methodologie/methodologiesData.js');
  const dataContent = fs.readFileSync(methodologiesDataPath, 'utf8');

  const requiredFields = [
    "id: 'powerlifting'",
    "name: 'Powerlifting'",
    "sentadilla",
    "press banca",
    "peso muerto"
  ];

  const missingFields = requiredFields.filter(field => !dataContent.toLowerCase().includes(field.toLowerCase()));

  if (missingFields.length > 0) {
    throw new Error(`Campos faltantes: ${missingFields.join(', ')}`);
  }

  console.log('  ✅ methodologiesData.js configurado');
  console.log(`     - ${requiredFields.length} campos verificados`);
  results.push({ test: '9 - methodologiesData', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '9 - methodologiesData', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Resumen final
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE TESTS DE POWERLIFTING');
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
  console.log('🎉 TODOS LOS TESTS PASARON - POWERLIFTING INTEGRADO ✅');
  console.log('\n📋 Componentes verificados:');
  console.log('  ✅ Configuración AI (aiConfigs.js)');
  console.log('  ✅ Prompt especializado (powerlifting_specialist.md)');
  console.log('  ✅ Feature Key registry');
  console.log('  ✅ Componentes frontend (Levels, MuscleGroups, Card)');
  console.log('  ✅ Endpoints backend (evaluate, generate)');
  console.log('  ✅ Redirecciones en server.js');
  console.log('  ✅ Base de datos (tabla + ejercicios)');
  console.log('  ✅ Integración en MethodologiesScreen');
  console.log('  ✅ Datos de metodología');
} else {
  console.log('⚠️ ALGUNOS TESTS FALLARON - REVISAR ERRORES');
}
console.log('='.repeat(60));

process.exit(allTestsPassed ? 0 : 1);
