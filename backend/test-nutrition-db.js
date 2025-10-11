/**
 * Script de prueba para verificar el almacenamiento de progreso nutricional
 */

import { pool } from './db.js';

const TEST_USER_ID = 18;
const TEST_DATE = '2025-10-03';

async function testNutritionStorage() {
  console.log('🧪 INICIANDO PRUEBA DE ALMACENAMIENTO NUTRICIONAL');
  console.log('='.repeat(80));

  try {
    // 1. Verificar qué hay actualmente en la BD
    console.log('\n📊 PASO 1: Verificar datos actuales');
    const currentData = await pool.query(`
      SELECT
        user_id,
        log_date,
        daily_log,
        created_at,
        updated_at
      FROM app.daily_nutrition_log
      WHERE user_id = $1 AND log_date = $2
    `, [TEST_USER_ID, TEST_DATE]);

    if (currentData.rows.length > 0) {
      console.log('✅ Registro encontrado:');
      console.log(JSON.stringify(currentData.rows[0], null, 2));
    } else {
      console.log('⚠️ No hay registro para esta fecha');
    }

    // 2. Simular guardado de mealProgress
    console.log('\n📥 PASO 2: Simular guardado de mealProgress');
    const testMealProgress = {
      "10": true,
      "20": false
    };

    const logData = {
      mealProgress: testMealProgress,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };

    console.log('Datos a guardar:', JSON.stringify(logData, null, 2));

    await pool.query(`
      INSERT INTO app.daily_nutrition_log (user_id, log_date, daily_log, calories, protein, carbs, fat)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, log_date)
      DO UPDATE SET
        daily_log = EXCLUDED.daily_log,
        calories = EXCLUDED.calories,
        protein = EXCLUDED.protein,
        carbs = EXCLUDED.carbs,
        fat = EXCLUDED.fat,
        updated_at = NOW()
    `, [
      TEST_USER_ID,
      TEST_DATE,
      JSON.stringify(logData),
      logData.calories,
      logData.protein,
      logData.carbs,
      logData.fat
    ]);

    console.log('✅ Datos guardados exitosamente');

    // 3. Recuperar y verificar
    console.log('\n📤 PASO 3: Recuperar datos guardados');
    const savedData = await pool.query(`
      SELECT
        user_id,
        log_date,
        daily_log,
        daily_log->'mealProgress' as meal_progress_extracted,
        created_at,
        updated_at
      FROM app.daily_nutrition_log
      WHERE user_id = $1 AND log_date = $2
    `, [TEST_USER_ID, TEST_DATE]);

    if (savedData.rows.length > 0) {
      console.log('✅ Datos recuperados:');
      console.log(JSON.stringify(savedData.rows[0], null, 2));

      // Verificar estructura
      const dailyLog = savedData.rows[0].daily_log;
      if (dailyLog && dailyLog.mealProgress) {
        console.log('\n✅ ÉXITO: mealProgress está presente en el JSON guardado');
        console.log('   Contenido:', JSON.stringify(dailyLog.mealProgress, null, 2));
      } else {
        console.log('\n❌ ERROR: mealProgress NO está en el JSON guardado');
      }
    }

    // 4. Simular actualización (agregar nueva comida)
    console.log('\n🔄 PASO 4: Actualizar con nueva comida');
    const existingResult = await pool.query(`
      SELECT daily_log FROM app.daily_nutrition_log
      WHERE user_id = $1 AND log_date = $2
    `, [TEST_USER_ID, TEST_DATE]);

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0].daily_log;
      const updatedMealProgress = {
        ...existing.mealProgress,
        "30": true // Nueva comida
      };

      const updatedLogData = {
        ...existing,
        mealProgress: updatedMealProgress
      };

      console.log('Datos actualizados a guardar:', JSON.stringify(updatedLogData, null, 2));

      await pool.query(`
        UPDATE app.daily_nutrition_log
        SET
          daily_log = $1,
          updated_at = NOW()
        WHERE user_id = $2 AND log_date = $3
      `, [
        JSON.stringify(updatedLogData),
        TEST_USER_ID,
        TEST_DATE
      ]);

      console.log('✅ Datos actualizados exitosamente');

      // Verificar actualización
      const finalCheck = await pool.query(`
        SELECT daily_log FROM app.daily_nutrition_log
        WHERE user_id = $1 AND log_date = $2
      `, [TEST_USER_ID, TEST_DATE]);

      console.log('\n📊 VERIFICACIÓN FINAL:');
      console.log(JSON.stringify(finalCheck.rows[0].daily_log, null, 2));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ PRUEBA COMPLETADA CON ÉXITO');

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error);
  } finally {
    await pool.end();
  }
}

testNutritionStorage();
