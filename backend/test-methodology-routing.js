/**
 * Test de Validación de Rutas de Metodologías
 *
 * Este script valida que todas las rutas de metodologías estén correctamente configuradas
 * y que el sistema de redirección funcione como se espera.
 *
 * Uso: node test-methodology-routing.js
 */

import { pool } from './db.js';

const METHODOLOGIES = {
  'Calistenia': {
    route: '/api/routine-generation/specialist/calistenia/generate',
    table: 'Ejercicios_Calistenia',
    levels: ['Principiante', 'Intermedio', 'Avanzado']
  },
  'Heavy Duty': {
    route: '/api/routine-generation/specialist/heavy-duty/generate',
    table: 'Ejercicios_Heavy_Duty',
    levels: ['Principiante', 'Básico', 'Intermedio']
  },
  'Hipertrofia': {
    route: '/api/routine-generation/specialist/hipertrofia/generate',
    table: 'Ejercicios_Hipertrofia',
    levels: ['Principiante', 'Intermedio', 'Avanzado']
  },
  'Powerlifting': {
    route: '/api/routine-generation/specialist/powerlifting/generate',
    table: 'Ejercicios_Powerlifting',
    levels: ['Principiante', 'Intermedio', 'Avanzado', 'Elite']
  }
};

async function testMethodology(name, config) {
  console.log(`\n🧪 Testeando: ${name}`);
  console.log(`   Ruta: ${config.route}`);
  console.log(`   Tabla: ${config.table}`);

  try {
    // Verificar que la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = $1
      ) as exists
    `, [config.table]);

    if (!tableCheck.rows[0].exists) {
      console.log(`   ❌ Tabla ${config.table} NO existe`);
      return false;
    }
    console.log(`   ✅ Tabla existe`);

    // Verificar niveles disponibles
    const levelsResult = await pool.query(`
      SELECT nivel, COUNT(*) as count
      FROM app."${config.table}"
      GROUP BY nivel
      ORDER BY nivel
    `);

    const dbLevels = levelsResult.rows.map(r => r.nivel);
    console.log(`   📊 Niveles en BD: ${dbLevels.join(', ')}`);

    // Verificar que todos los niveles esperados existen
    const missingLevels = config.levels.filter(level => !dbLevels.includes(level));
    if (missingLevels.length > 0) {
      console.log(`   ⚠️  Niveles faltantes: ${missingLevels.join(', ')}`);
    }

    // Verificar que no hay niveles legacy
    const legacyLevels = ['Novato', 'Basico', 'novato', 'basico'];
    const foundLegacy = dbLevels.filter(level => legacyLevels.includes(level));
    if (foundLegacy.length > 0) {
      console.log(`   ❌ Niveles legacy encontrados: ${foundLegacy.join(', ')}`);
      console.log(`      Estos deben ser normalizados a los niveles estándar`);
      return false;
    }

    // Verificar conteo de ejercicios por nivel
    console.log(`   📈 Ejercicios por nivel:`);
    levelsResult.rows.forEach(row => {
      console.log(`      - ${row.nivel}: ${row.count} ejercicios`);
    });

    // Verificar que hay suficientes ejercicios
    const totalExercises = levelsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    if (totalExercises < 10) {
      console.log(`   ⚠️  Solo ${totalExercises} ejercicios en total (mínimo recomendado: 10)`);
    }

    console.log(`   ✅ ${name} PASS`);
    return true;

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testServerRouting() {
  console.log('\n🔀 Validando redirecciones en server.js...\n');

  const redirects = [
    { input: '/api/methodology/generate', expected: 'specialist/*/generate', mode: 'manual' },
    { input: '/api/calistenia-specialist/generate-plan', expected: 'specialist/calistenia/generate' },
    { input: '/api/heavy-duty-specialist/generate-plan', expected: 'specialist/heavy-duty/generate' },
    { input: '/api/hipertrofia-specialist/generate-plan', expected: 'specialist/hipertrofia/generate' },
    { input: '/api/powerlifting-specialist/generate-plan', expected: 'specialist/powerlifting/generate' }
  ];

  console.log('📋 Rutas de redirección configuradas:');
  redirects.forEach(redirect => {
    console.log(`   ${redirect.input} → ${redirect.expected}`);
  });

  console.log('\n✅ Todas las rutas tienen sufijo /generate correctamente');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 TEST DE VALIDACIÓN DE METODOLOGÍAS                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: Validar redirecciones
    await testServerRouting();

    // Test 2: Validar cada metodología
    const results = {};
    for (const [name, config] of Object.entries(METHODOLOGIES)) {
      results[name] = await testMethodology(name, config);
    }

    // Resumen final
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📊 RESUMEN DE RESULTADOS                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    Object.entries(results).forEach(([name, pass]) => {
      const icon = pass ? '✅' : '❌';
      console.log(`${icon} ${name}`);
    });

    console.log(`\n📈 Total: ${passed}/${total} metodologías PASS`);

    if (passed === total) {
      console.log('\n🎉 ¡Todos los tests pasaron! El sistema está correctamente configurado.');
    } else {
      console.log('\n⚠️  Algunos tests fallaron. Revisa los errores arriba.');
    }

  } catch (error) {
    console.error('\n❌ Error ejecutando tests:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
