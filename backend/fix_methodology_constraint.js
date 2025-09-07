// ============================================================
// FIX URGENT: Migración de constraint methodology_exercise_feedback
// ============================================================
import { pool } from './db.js';
import fs from 'fs';
import path from 'path';

async function fixMethodologyConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 INICIANDO MIGRACIÓN DE CONSTRAINT CRÍTICO...');
    console.log('📋 Problema: constraint no permite valor "like", solo "love"');
    console.log('🎯 Solución: migrar "love" → "like" y actualizar constraint');
    console.log();

    // 1. Verificar estado actual
    console.log('1️⃣ VERIFICANDO ESTADO ACTUAL...');
    const currentConstraints = await client.query(`
      SELECT cc.constraint_name, cc.check_clause 
      FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_table_usage ctu 
        ON cc.constraint_name = ctu.constraint_name
      WHERE ctu.table_name = 'methodology_exercise_feedback' 
        AND ctu.table_schema = 'app'
    `);
    
    console.log('📊 Constraints actuales:');
    currentConstraints.rows.forEach(row => {
      console.log(`   - ${row.constraint_name}: ${row.check_clause}`);
    });
    
    const currentData = await client.query(`
      SELECT sentiment, COUNT(*) as cantidad 
      FROM app.methodology_exercise_feedback 
      GROUP BY sentiment 
      ORDER BY sentiment
    `);
    
    console.log('📊 Datos actuales por sentiment:');
    currentData.rows.forEach(row => {
      console.log(`   - ${row.sentiment}: ${row.cantidad} registros`);
    });
    console.log();

    // 2. Eliminar constraints problemáticos
    console.log('2️⃣ ELIMINANDO CONSTRAINTS PROBLEMÁTICOS...');
    
    try {
      await client.query('ALTER TABLE app.methodology_exercise_feedback DROP CONSTRAINT IF EXISTS methodology_feedback_sentiment_check');
      console.log('✅ Eliminado: methodology_feedback_sentiment_check');
    } catch (e) {
      console.log('⚠️ No se pudo eliminar methodology_feedback_sentiment_check:', e.message);
    }
    
    try {
      await client.query('ALTER TABLE app.methodology_exercise_feedback DROP CONSTRAINT IF EXISTS feedback_sentiment_final');
      console.log('✅ Eliminado: feedback_sentiment_final');
    } catch (e) {
      console.log('⚠️ No se pudo eliminar feedback_sentiment_final:', e.message);
    }
    console.log();

    // 3. Migrar datos existentes
    console.log('3️⃣ MIGRANDO DATOS: "love" → "like"...');
    const migrationResult = await client.query(`
      UPDATE app.methodology_exercise_feedback 
      SET sentiment = 'like' 
      WHERE sentiment = 'love'
    `);
    console.log(`✅ Migrados ${migrationResult.rowCount} registros de "love" a "like"`);
    console.log();

    // 4. Crear nuevo constraint unificado
    console.log('4️⃣ CREANDO CONSTRAINT UNIFICADO...');
    await client.query(`
      ALTER TABLE app.methodology_exercise_feedback 
      ADD CONSTRAINT methodology_feedback_sentiment_unified 
      CHECK (sentiment IN ('like', 'dislike', 'hard'))
    `);
    console.log('✅ Creado: methodology_feedback_sentiment_unified');
    console.log('📋 Valores permitidos: like, dislike, hard');
    console.log();

    // 5. Verificar resultado final
    console.log('5️⃣ VERIFICACIÓN FINAL...');
    const finalConstraints = await client.query(`
      SELECT cc.constraint_name, cc.check_clause 
      FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_table_usage ctu 
        ON cc.constraint_name = ctu.constraint_name
      WHERE ctu.table_name = 'methodology_exercise_feedback' 
        AND ctu.table_schema = 'app'
    `);
    
    console.log('📊 Constraints finales:');
    finalConstraints.rows.forEach(row => {
      console.log(`   - ${row.constraint_name}: ${row.check_clause}`);
    });
    
    const finalData = await client.query(`
      SELECT sentiment, COUNT(*) as cantidad 
      FROM app.methodology_exercise_feedback 
      GROUP BY sentiment 
      ORDER BY sentiment
    `);
    
    console.log('📊 Datos finales por sentiment:');
    finalData.rows.forEach(row => {
      console.log(`   - ${row.sentiment}: ${row.cantidad} registros`);
    });
    console.log();

    // 6. Prueba de inserción
    console.log('6️⃣ PROBANDO INSERCIÓN CON NUEVO VALOR "like"...');
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO app.methodology_exercise_feedback 
        (methodology_session_id, user_id, exercise_name, exercise_order, sentiment, comment) 
        VALUES (-1, -1, 'TEST_EXERCISE', 99, 'like', 'TEST')
      `);
      await client.query(`
        DELETE FROM app.methodology_exercise_feedback 
        WHERE methodology_session_id = -1 AND user_id = -1
      `);
      await client.query('COMMIT');
      console.log('✅ Prueba exitosa: valor "like" ahora es aceptado');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('❌ ERROR en prueba:', e.message);
      throw e;
    }
    
    console.log();
    console.log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('✅ El sistema ahora acepta los valores unificados: like, dislike, hard');
    console.log('✅ Los datos existentes han sido migrados correctamente');
    console.log('🚀 El usuario ID18 ahora podrá guardar feedback sin errores');

  } catch (error) {
    console.error('❌ ERROR EN MIGRACIÓN:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar migración
fixMethodologyConstraint()
  .then(() => {
    console.log('🏁 Script completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script falló:', error);
    process.exit(1);
  });