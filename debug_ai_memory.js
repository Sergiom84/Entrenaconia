import { pool } from './backend/db.js';

async function investigateAIMemory() {
  try {
    const userId = 18; // Usuario que tenía el plan personalizado/hiit
    
    console.log('=== INVESTIGACIÓN MEMORIA IA HOME TRAINING ===');
    console.log(`Usuario ID: ${userId}\n`);

    // 1. Verificar función get_exercises_for_combination
    console.log('1. CONSULTANDO get_exercises_for_combination...');
    const combinationResult = await pool.query(
      `SELECT exercise_name, times_used, last_used_at, user_rating, combination_code
       FROM app.get_exercises_for_combination($1, $2, $3, 20)`,
      [userId, 'personalizado', 'hiit']
    );
    
    console.log(`Ejercicios encontrados para personalizado+hiit: ${combinationResult.rows.length}`);
    combinationResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.exercise_name} (usado ${row.times_used} veces)`);
    });

    // 2. Verificar función get_home_training_history
    console.log('\n2. CONSULTANDO get_home_training_history...');
    const generalResult = await pool.query(
      `SELECT exercise_name, last_used_at, times_used 
       FROM app.get_home_training_history($1, 10)`,
      [userId]
    );
    
    console.log(`Ejercicios en historial general: ${generalResult.rows.length}`);
    generalResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.exercise_name} (usado ${row.times_used} veces)`);
    });

    // 3. Verificar si las funciones existen
    console.log('\n3. VERIFICANDO EXISTENCIA DE FUNCIONES...');
    const functions = await pool.query(`
      SELECT proname, proargnames 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'app' 
      AND proname LIKE '%exercise%' 
      OR proname LIKE '%home%training%'
    `);
    
    console.log('Funciones encontradas:');
    functions.rows.forEach(func => {
      console.log(`  - ${func.proname}(${func.proargnames ? func.proargnames.join(', ') : 'sin parámetros'})`);
    });

    // 4. Verificar tablas de historial
    console.log('\n4. VERIFICANDO DATOS EN TABLAS DE HISTORIAL...');
    
    // home_exercise_history
    const homeHistory = await pool.query(`
      SELECT exercise_name, COUNT(*) as count
      FROM app.home_exercise_history
      WHERE user_id = $1
      GROUP BY exercise_name
      ORDER BY count DESC
      LIMIT 10
    `, [userId]);
    
    console.log(`Registros en home_exercise_history: ${homeHistory.rows.length}`);
    homeHistory.rows.forEach(row => {
      console.log(`  - ${row.exercise_name}: ${row.count} veces`);
    });

    // home_combination_exercise_history
    const combinationHistory = await pool.query(`
      SELECT exercise_name, combination_code, COUNT(*) as count
      FROM app.home_combination_exercise_history
      WHERE user_id = $1
      GROUP BY exercise_name, combination_code
      ORDER BY count DESC
      LIMIT 10
    `, [userId]);
    
    console.log(`\nRegistros en home_combination_exercise_history: ${combinationHistory.rows.length}`);
    combinationHistory.rows.forEach(row => {
      console.log(`  - ${row.exercise_name} (${row.combination_code}): ${row.count} veces`);
    });

  } catch (error) {
    console.error('Error investigating AI memory:', error);
  } finally {
    process.exit(0);
  }
}

investigateAIMemory();