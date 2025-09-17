#!/usr/bin/env node

/**
 * Script para ejecutar directamente el sistema de feedback en Supabase
 * Resuelve el error: column "methodology_type" does not exist
 */

import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 EJECUTANDO SISTEMA DE FEEDBACK EN SUPABASE');
console.log('===============================================');

async function checkCurrentTables() {
  console.log('\n📋 1. VERIFICANDO ESTADO ACTUAL DE TABLAS...');

  try {
    // Verificar qué tablas existen en el schema app
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      ORDER BY table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);
    console.log(`✅ Encontradas ${tablesResult.rows.length} tablas en schema 'app':`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

    // Verificar si existe user_exercise_feedback
    const feedbackTableCheck = tablesResult.rows.find(row =>
      row.table_name === 'user_exercise_feedback'
    );

    if (feedbackTableCheck) {
      console.log('\n📋 Tabla user_exercise_feedback EXISTE. Verificando estructura...');

      // Obtener estructura de la tabla
      const structureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_exercise_feedback'
        ORDER BY ordinal_position;
      `;

      const structureResult = await pool.query(structureQuery);
      console.log('   Columnas actuales:');
      structureResult.rows.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type})`);
      });

      // Verificar si methodology_type existe
      const hasMethodologyType = structureResult.rows.find(col =>
        col.column_name === 'methodology_type'
      );

      if (!hasMethodologyType) {
        console.log('\n❌ PROBLEMA ENCONTRADO: Columna "methodology_type" NO EXISTE');
        return false;
      } else {
        console.log('\n✅ Columna "methodology_type" existe correctamente');
        return true;
      }
    } else {
      console.log('\n❌ Tabla user_exercise_feedback NO EXISTE');
      return false;
    }

  } catch (error) {
    console.error('❌ Error verificando tablas:', error.message);
    return false;
  }
}

async function executeFeedbackSystem() {
  console.log('\n🚀 2. EJECUTANDO SCRIPT create_feedback_system.sql...');

  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'sql', 'create_feedback_system.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Script SQL cargado correctamente');

    // Ejecutar el script completo
    await pool.query(sqlContent);

    console.log('✅ Script ejecutado exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error ejecutando script:', error.message);
    console.error('🔍 Detalles:', error);
    return false;
  }
}

async function verifyInstallation() {
  console.log('\n🔍 3. VERIFICANDO INSTALACIÓN...');

  try {
    // Verificar tablas creadas
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
        AND table_name IN ('user_exercise_feedback', 'user_training_preferences')
      ORDER BY table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);
    console.log(`✅ Tablas de feedback encontradas: ${tablesResult.rows.length}/2`);

    if (tablesResult.rows.length === 2) {
      console.log('   - user_exercise_feedback ✅');
      console.log('   - user_training_preferences ✅');
    }

    // Verificar funciones creadas
    const functionsQuery = `
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'app'
        AND routine_name LIKE '%feedback%'
        OR routine_name LIKE '%ai_context%'
        OR routine_name LIKE '%avoided_exercises%'
      ORDER BY routine_name;
    `;

    const functionsResult = await pool.query(functionsQuery);
    console.log(`✅ Funciones de feedback encontradas: ${functionsResult.rows.length}`);
    functionsResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.routine_name}()`);
    });

    // Probar funciones principales
    console.log('\n🧪 Probando función get_user_ai_context...');
    const testQuery = `SELECT app.get_user_ai_context(1, 'calistenia') as context;`;
    const testResult = await pool.query(testQuery);

    if (testResult.rows.length > 0) {
      console.log('✅ Función get_user_ai_context funciona correctamente');
      console.log('📊 Contexto de ejemplo:', JSON.stringify(testResult.rows[0].context, null, 2));
    }

    return true;

  } catch (error) {
    console.error('❌ Error verificando instalación:', error.message);
    return false;
  }
}

async function checkMethodologyTypeUsage() {
  console.log('\n🔍 4. VERIFICANDO USO DE methodology_type EN EL CÓDIGO...');

  try {
    // Simular una consulta que usa methodology_type
    const testQuery = `
      SELECT COUNT(*) as total
      FROM app.user_exercise_feedback
      WHERE methodology_type = 'calistenia';
    `;

    const result = await pool.query(testQuery);
    console.log(`✅ Consulta con methodology_type ejecutada exitosamente`);
    console.log(`📊 Registros de feedback de calistenia: ${result.rows[0].total}`);

    return true;

  } catch (error) {
    console.error('❌ Error probando methodology_type:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🔌 Conectando a Supabase...');

    // Paso 1: Verificar estado actual
    const currentStateOk = await checkCurrentTables();

    // Paso 2: Ejecutar sistema si es necesario
    if (!currentStateOk) {
      console.log('\n📥 Sistema de feedback no está completo. Ejecutando...');
      const installOk = await executeFeedbackSystem();

      if (!installOk) {
        console.error('💥 FALLA CRÍTICA: No se pudo instalar el sistema de feedback');
        process.exit(1);
      }
    } else {
      console.log('\n✅ Sistema de feedback ya existe. Omitiendo instalación...');
    }

    // Paso 3: Verificar instalación final
    const verifyOk = await verifyInstallation();
    if (!verifyOk) {
      console.error('💥 FALLA CRÍTICA: Verificación falló');
      process.exit(1);
    }

    // Paso 4: Probar methodology_type específicamente
    const methodologyOk = await checkMethodologyTypeUsage();
    if (!methodologyOk) {
      console.error('💥 FALLA CRÍTICA: methodology_type no funciona');
      process.exit(1);
    }

    console.log('\n🎉 ¡ÉXITO TOTAL!');
    console.log('================');
    console.log('✅ Sistema de feedback instalado y funcionando');
    console.log('✅ Columna methodology_type verificada');
    console.log('✅ Funciones de IA disponibles');
    console.log('✅ Compatible con código existente');

  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
main().catch(error => {
  console.error('💥 ERROR INESPERADO:', error);
  process.exit(1);
});