import { pool } from './db.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Test de Verificación: Cambios Calistenia Básico→Principiante\n');

let allTestsPassed = true;
const results = [];

// Test 1: Verificar niveles en BD
console.log('📋 Test 1: Niveles en Base de Datos...');
try {
  const niveles = await pool.query(`
    SELECT DISTINCT nivel, COUNT(*) as cantidad
    FROM app."Ejercicios_Calistenia"
    GROUP BY nivel
    ORDER BY nivel
  `);

  console.log('  Niveles encontrados:');
  niveles.rows.forEach(row => {
    console.log(`    ${row.nivel}: ${row.cantidad} ejercicios`);
  });

  // Verificar que NO existe "Básico"
  const basicoExists = niveles.rows.some(row => row.nivel === 'Básico');
  if (basicoExists) {
    throw new Error('Todavía existe nivel "Básico" en la BD');
  }

  // Verificar que existe "Principiante"
  const principianteExists = niveles.rows.some(row => row.nivel === 'Principiante');
  if (!principianteExists) {
    throw new Error('No existe nivel "Principiante" en la BD');
  }

  console.log('  ✅ BD actualizada correctamente');
  results.push({ test: '1 - BD Niveles', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '1 - BD Niveles', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 2: Verificar backend routes
console.log('\n📋 Test 2: Backend Routes...');
try {
  const routesPath = path.join(process.cwd(), 'routes', 'routineGeneration.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  // Verificar que NO contiene 'Básico' en contexto de Calistenia
  const basicoInCalistenia = routesContent.includes("nivel = 'Básico'") ||
                              routesContent.includes('nivel IN (\'Básico\'');
  if (basicoInCalistenia) {
    throw new Error('Todavía hay referencias a "Básico" en queries de Calistenia');
  }

  // Verificar que usa 'Principiante'
  if (!routesContent.includes('Principiante')) {
    throw new Error('No se encontró "Principiante" en routineGeneration.js');
  }

  // Verificar levelMapping
  if (!routesContent.includes("'principiante': 'Principiante'")) {
    throw new Error('levelMapping no tiene principiante');
  }

  // Verificar level_descriptions
  if (!routesContent.includes('principiante:')) {
    throw new Error('level_descriptions no tiene principiante');
  }

  console.log('  ✅ Routes backend actualizados');
  results.push({ test: '2 - Backend Routes', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '2 - Backend Routes', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 3: Verificar prompts
console.log('\n📋 Test 3: Prompts de IA...');
try {
  const promptPath = path.join(process.cwd(), 'prompts', 'calistenia_specialist.md');
  const promptContent = fs.readFileSync(promptPath, 'utf8');

  // No debería tener "De básico a avanzado"
  if (promptContent.includes('De básico a avanzado')) {
    throw new Error('Prompt todavía dice "De básico a avanzado"');
  }

  // Debería tener "De principiante a avanzado"
  if (!promptContent.includes('De principiante a avanzado')) {
    throw new Error('Prompt no dice "De principiante a avanzado"');
  }

  console.log('  ✅ Prompts actualizados');
  results.push({ test: '3 - Prompts', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '3 - Prompts', status: 'FAIL', error: error.message });
  allTestsPassed = false;
}

// Test 4: Verificar frontend
console.log('\n📋 Test 4: Archivos Frontend...');
try {
  const frontendFiles = [
    '../src/components/Methodologie/methodologies/CalisteniaManual/CalisteniaLevels.js',
    '../src/components/Methodologie/methodologies/CalisteniaManual/CalisteniaMuscleGroups.js',
    '../src/components/routines/WarmupModal.jsx',
    '../src/contexts/WorkoutContextRefactored.jsx'
  ];

  for (const file of frontendFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no existe: ${file}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Verificar que no tenga 'basico' en contexto de nivel
    const hasBasicoLevel = content.match(/['"]basico['"]\s*:/g) ||
                           content.match(/level\s*[=:]\s*['"]basico['"]/g);

    if (hasBasicoLevel) {
      throw new Error(`${file} todavía tiene 'basico' como nivel`);
    }
  }

  console.log('  ✅ Archivos frontend actualizados');
  results.push({ test: '4 - Frontend', status: 'PASS' });
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  results.push({ test: '4 - Frontend', status: 'FAIL', error: error.message });
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
  console.log('🎉 TODOS LOS TESTS PASARON - CAMBIOS COMPLETADOS ✅');
  console.log('\n📊 Verificación Final:');
  console.log('  - Base de datos: Básico → Principiante ✓');
  console.log('  - Backend routes: Actualizados ✓');
  console.log('  - Prompts IA: Actualizados ✓');
  console.log('  - Frontend: Actualizado ✓');
} else {
  console.log('⚠️ ALGUNOS TESTS FALLARON - REVISAR ERRORES');
}
console.log('='.repeat(60));

await pool.end();
process.exit(allTestsPassed ? 0 : 1);
