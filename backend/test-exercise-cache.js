/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';

/**
 * Script de prueba del sistema de caché de ejercicios
 * Verifica el flujo completo: búsqueda en tablas específicas → cache → generación IA
 */

// Copiar las funciones helper del endpoint
const EXERCISE_TABLES = [
  'Ejercicios_Bomberos',
  'Ejercicios_Calistenia',
  'Ejercicios_Casa',
  'Ejercicios_CrossFit',
  'Ejercicios_Funcional',
  'Ejercicios_Guardia_Civil',
  'Ejercicios_Halterofilia',
  'Ejercicios_Heavy_duty',
  'Ejercicios_Hipertrofia',
  'Ejercicios_Policia_Local',
  'Ejercicios_Powerlifting'
];

async function findExerciseInTables(exerciseName) {
  const normalizedName = exerciseName.toLowerCase().trim();

  for (const table of EXERCISE_TABLES) {
    try {
      const result = await pool.query(
        `SELECT nombre, ejecucion, consejos, errores_evitar
         FROM app."${table}"
         WHERE LOWER(TRIM(nombre)) = $1
         LIMIT 1`,
        [normalizedName]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const hasCache = row.ejecucion && row.consejos && row.errores_evitar;

        return {
          found: true,
          table: table,
          hasCache: hasCache,
          cacheData: hasCache ? {
            ejecucion: row.ejecucion,
            consejos: row.consejos,
            errores_evitar: row.errores_evitar
          } : null
        };
      }
    } catch (error) {
      console.warn(`Error buscando en ${table}:`, error.message);
      continue;
    }
  }

  return { found: false, table: null, hasCache: false, cacheData: null };
}

async function testExercise(exerciseName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Probando ejercicio: "${exerciseName}"`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. Buscar en tablas específicas
    console.log('\n1️⃣ Buscando en tablas de metodologías...');
    const exerciseLocation = await findExerciseInTables(exerciseName);

    if (exerciseLocation.found) {
      console.log(`✅ Encontrado en tabla: ${exerciseLocation.table}`);
      if (exerciseLocation.hasCache) {
        console.log(`💾 CACHE HIT - Tiene información cacheada`);
        console.log(`   - Ejecución: ${exerciseLocation.cacheData.ejecucion.slice(0, 100)}...`);
        console.log(`   - Consejos: ${exerciseLocation.cacheData.consejos.slice(0, 100)}...`);
        console.log(`   - Errores: ${exerciseLocation.cacheData.errores_evitar.slice(0, 100)}...`);
        return { status: 'cache_hit', source: exerciseLocation.table };
      } else {
        console.log(`📝 Sin caché - Se generaría con IA y guardaría en: ${exerciseLocation.table}`);
        return { status: 'needs_generation', target: exerciseLocation.table };
      }
    } else {
      console.log(`❌ No encontrado en tablas de metodologías`);

      // 2. Buscar en cache genérica
      console.log('\n2️⃣ Buscando en cache genérica (exercise_ai_info)...');
      const normalizedName = exerciseName.toLowerCase().trim();
      const cacheResult = await pool.query(
        `SELECT ejecucion, consejos, errores_evitar, request_count, ai_model_used, created_at
         FROM app.exercise_ai_info
         WHERE exercise_name_normalized = $1 OR exercise_name = $2
         LIMIT 1`,
        [normalizedName, exerciseName]
      );

      if (cacheResult.rows.length > 0) {
        console.log(`💾 CACHE HIT en tabla genérica`);
        console.log(`   - Solicitado: ${cacheResult.rows[0].request_count} veces`);
        console.log(`   - Modelo: ${cacheResult.rows[0].ai_model_used}`);
        return { status: 'generic_cache_hit', source: 'exercise_ai_info' };
      } else {
        console.log(`📝 Sin caché - Se generaría con IA y guardaría en: exercise_ai_info`);
        return { status: 'needs_generation', target: 'exercise_ai_info' };
      }
    }
  } catch (error) {
    console.error(`❌ Error probando ejercicio "${exerciseName}":`, error.message);
    return { status: 'error', error: error.message };
  }
}

async function runTests() {
  console.log('\n🚀 INICIANDO PRUEBAS DEL SISTEMA DE CACHÉ DE EJERCICIOS\n');

  // Ejercicios de prueba
  const testExercises = [
    // Ejercicios que deberían existir en Calistenia
    'Dominadas',
    'Flexiones',
    'Fondos en paralelas',

    // Ejercicios que deberían existir en Halterofilia
    'Clean and Jerk',
    'Snatch',
    'Front Squat',

    // Ejercicio inventado (no debería existir)
    'Ejercicio Super Raro Inventado XYZ'
  ];

  const results = [];

  for (const exercise of testExercises) {
    const result = await testExercise(exercise);
    results.push({ exercise, ...result });
  }

  // Resumen final
  console.log('\n\n');
  console.log(`${'='.repeat(60)}`);
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log(`${'='.repeat(60)}\n`);

  const cacheHits = results.filter(r => r.status === 'cache_hit').length;
  const genericHits = results.filter(r => r.status === 'generic_cache_hit').length;
  const needsGeneration = results.filter(r => r.status === 'needs_generation').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`✅ Cache hits en tablas específicas: ${cacheHits}`);
  console.log(`💾 Cache hits en tabla genérica: ${genericHits}`);
  console.log(`🤖 Necesitan generación con IA: ${needsGeneration}`);
  console.log(`❌ Errores: ${errors}\n`);

  // Detalle de cada resultado
  results.forEach((result) => {
    const icon = result.status === 'cache_hit' ? '✅' :
                 result.status === 'generic_cache_hit' ? '💾' :
                 result.status === 'needs_generation' ? '🤖' : '❌';
    console.log(`${icon} ${result.exercise}`);
    if (result.source) {
      console.log(`   └─ Fuente: ${result.source}`);
    }
    if (result.target) {
      console.log(`   └─ Guardará en: ${result.target}`);
    }
  });

  // Estadísticas adicionales
  console.log('\n\n');
  console.log(`${'='.repeat(60)}`);
  console.log('📈 ESTADÍSTICAS DE TABLAS');
  console.log(`${'='.repeat(60)}\n`);

  for (const table of EXERCISE_TABLES) {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN ejecucion IS NOT NULL THEN 1 END) as con_cache,
          COUNT(CASE WHEN ejecucion IS NULL THEN 1 END) as sin_cache
        FROM app."${table}"
      `);

      const stats = result.rows[0];
      const cachePercentage = stats.total > 0
        ? ((stats.con_cache / stats.total) * 100).toFixed(1)
        : '0';

      console.log(`📋 ${table}`);
      console.log(`   Total ejercicios: ${stats.total}`);
      console.log(`   Con caché: ${stats.con_cache} (${cachePercentage}%)`);
      console.log(`   Sin caché: ${stats.sin_cache}\n`);
    } catch (error) {
      console.warn(`⚠️ Error obteniendo stats de ${table}:`, error.message);
    }
  }

  process.exit(0);
}

runTests().catch(error => {
  console.error('❌ Error fatal en pruebas:', error);
  process.exit(1);
});
