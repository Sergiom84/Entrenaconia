import { pool } from './db.js';

console.log('🧪 TEST DE NORMALIZACIÓN DE TABLAS DE EJERCICIOS\n');

let allTestsPassed = true;
const results = [];

async function runTests() {
  const client = await pool.connect();

  try {
    // Test 1: Verificar exercise_id en Heavy_duty
    console.log('📋 Test 1: Heavy_duty tiene exercise_id como PRIMARY KEY...');
    try {
      const pkCheck = await client.query(`
        SELECT constraint_name, column_name
        FROM information_schema.key_column_usage
        WHERE table_schema = 'app'
        AND table_name = 'Ejercicios_Heavy_duty'
        AND constraint_name LIKE '%pkey%';
      `);

      if (pkCheck.rows.length === 0) {
        throw new Error('No se encontró PRIMARY KEY');
      }

      if (pkCheck.rows[0].column_name !== 'exercise_id') {
        throw new Error(`PRIMARY KEY es ${pkCheck.rows[0].column_name}, debería ser exercise_id`);
      }

      console.log('  ✅ exercise_id es PRIMARY KEY');
      results.push({ test: '1 - PK Heavy_duty', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '1 - PK Heavy_duty', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

    // Test 2: Verificar que slug existe y es único
    console.log('\n📋 Test 2: Heavy_duty tiene slug único...');
    try {
      const slugCheck = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'app'
        AND table_name = 'Ejercicios_Heavy_duty'
        AND column_name = 'slug';
      `);

      if (slugCheck.rows.length === 0) {
        throw new Error('Columna slug no existe');
      }

      // Verificar que no hay slugs duplicados
      const duplicates = await client.query(`
        SELECT slug, COUNT(*)
        FROM app."Ejercicios_Heavy_duty"
        GROUP BY slug
        HAVING COUNT(*) > 1;
      `);

      if (duplicates.rows.length > 0) {
        throw new Error(`Slugs duplicados encontrados: ${duplicates.rows.length}`);
      }

      console.log('  ✅ Columna slug existe y todos los valores son únicos');
      results.push({ test: '2 - Slug único', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '2 - Slug único', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

    // Test 3: Verificar niveles normalizados en Powerlifting
    console.log('\n📋 Test 3: Powerlifting usa niveles estándar...');
    try {
      const nivelesCheck = await client.query(`
        SELECT DISTINCT nivel
        FROM app."Ejercicios_Powerlifting"
        WHERE nivel NOT IN ('Principiante', 'Intermedio', 'Avanzado', 'Elite')
      `);

      if (nivelesCheck.rows.length > 0) {
        throw new Error(`Niveles no estándar encontrados: ${nivelesCheck.rows.map(r => r.nivel).join(', ')}`);
      }

      // Verificar que no existe "Novato"
      const novatoCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM app."Ejercicios_Powerlifting"
        WHERE nivel = 'Novato'
      `);

      if (parseInt(novatoCheck.rows[0].count) > 0) {
        throw new Error('"Novato" todavía existe en la tabla');
      }

      console.log('  ✅ Todos los niveles son estándar (Principiante, Intermedio, Avanzado, Elite)');
      results.push({ test: '3 - Niveles Powerlifting', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '3 - Niveles Powerlifting', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

    // Test 4: Verificar descanso_seg en Heavy_duty
    console.log('\n📋 Test 4: Heavy_duty tiene descanso_seg poblado...');
    try {
      const descansoCheck = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(descanso_seg) as con_descanso,
          MIN(descanso_seg) as min_val,
          MAX(descanso_seg) as max_val
        FROM app."Ejercicios_Heavy_duty"
      `);

      const { total, con_descanso, min_val, max_val } = descansoCheck.rows[0];

      if (parseInt(total) !== parseInt(con_descanso)) {
        throw new Error(`${parseInt(total) - parseInt(con_descanso)} ejercicios sin descanso_seg`);
      }

      if (parseInt(min_val) < 180 || parseInt(max_val) > 600) {
        throw new Error(`Valores fuera de rango: min=${min_val}, max=${max_val}`);
      }

      console.log('  ✅ Todos los ejercicios tienen descanso_seg (180-600 seg)');
      console.log(`     Rango: ${min_val}-${max_val} segundos`);
      results.push({ test: '4 - descanso_seg Heavy_duty', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '4 - descanso_seg Heavy_duty', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

    // Test 5: Verificar consistencia de niveles entre tablas
    console.log('\n📋 Test 5: Consistencia de niveles entre tablas...');
    try {
      const tables = ['Ejercicios_Calistenia', 'Ejercicios_Hipertrofia', 'Ejercicios_Heavy_duty'];
      const expectedLevels = ['Principiante', 'Intermedio', 'Avanzado'];

      for (const table of tables) {
        const levels = await client.query(`
          SELECT DISTINCT nivel
          FROM app."${table}"
          WHERE nivel NOT IN ('Principiante', 'Intermedio', 'Avanzado')
        `);

        if (levels.rows.length > 0) {
          throw new Error(`${table} tiene niveles no estándar: ${levels.rows.map(r => r.nivel).join(', ')}`);
        }
      }

      console.log('  ✅ Calistenia, Hipertrofia y Heavy_duty usan niveles consistentes');
      console.log('     (Principiante, Intermedio, Avanzado)');
      results.push({ test: '5 - Consistencia niveles', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '5 - Consistencia niveles', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

    // Test 6: Verificar que progresion_desde/hacia se mantienen
    console.log('\n📋 Test 6: Campos de progresión intactos...');
    try {
      const tables = ['Ejercicios_Calistenia', 'Ejercicios_Hipertrofia', 'Ejercicios_Heavy_duty'];

      for (const table of tables) {
        const progCheck = await client.query(`
          SELECT
            COUNT(*) as total,
            COUNT(progresion_desde) FILTER (WHERE progresion_desde IS NOT NULL AND progresion_desde != '') as con_desde,
            COUNT(progresion_hacia) FILTER (WHERE progresion_hacia IS NOT NULL AND progresion_hacia != '') as con_hacia
          FROM app."${table}"
        `);

        const { total, con_desde, con_hacia } = progCheck.rows[0];

        if (parseInt(con_desde) === 0 || parseInt(con_hacia) === 0) {
          throw new Error(`${table} perdió datos de progresión`);
        }

        console.log(`  ✅ ${table}: ${con_desde}/${total} con progresión`);
      }

      results.push({ test: '6 - Progresión intacta', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '6 - Progresión intacta', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

    // Test 7: Verificar conteos totales (no se perdieron datos)
    console.log('\n📋 Test 7: Conteos de ejercicios intactos...');
    try {
      const counts = {
        'Calistenia': 65,
        'Hipertrofia': 68,
        'Heavy_duty': 44,
        'Powerlifting': 77
      };

      for (const [name, expected] of Object.entries(counts)) {
        const result = await client.query(`SELECT COUNT(*) as count FROM app."Ejercicios_${name}"`);
        const actual = parseInt(result.rows[0].count);

        if (actual !== expected) {
          throw new Error(`${name}: esperaba ${expected}, encontró ${actual}`);
        }

        console.log(`  ✅ ${name}: ${actual} ejercicios (sin pérdidas)`);
      }

      results.push({ test: '7 - Conteos intactos', status: 'PASS' });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ test: '7 - Conteos intactos', status: 'FAIL', error: error.message });
      allTestsPassed = false;
    }

  } finally {
    client.release();
  }
}

// Ejecutar tests
runTests().then(() => {
  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE TESTS DE NORMALIZACIÓN');
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
    console.log('🎉 TODOS LOS TESTS PASARON - NORMALIZACIÓN EXITOSA ✅');
    console.log('\n📋 Cambios aplicados:');
    console.log('  ✅ Heavy_duty: exercise_id PRIMARY KEY + slug único');
    console.log('  ✅ Heavy_duty: descanso_seg (240-360 seg) por nivel');
    console.log('  ✅ Powerlifting: niveles normalizados (Novato → Principiante)');
    console.log('  ✅ Consistencia: Principiante/Intermedio/Avanzado en 3 tablas');
    console.log('  ✅ Powerlifting: mantiene nivel Elite para competición');
  } else {
    console.log('⚠️ ALGUNOS TESTS FALLARON - REVISAR ERRORES');
  }
  console.log('='.repeat(60));

  pool.end();
  process.exit(allTestsPassed ? 0 : 1);
}).catch(error => {
  console.error('❌ Error ejecutando tests:', error);
  pool.end();
  process.exit(1);
});
