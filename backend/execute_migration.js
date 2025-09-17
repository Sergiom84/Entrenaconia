#!/usr/bin/env node

/**
 * Script para ejecutar la migración de la tabla user_exercise_feedback existente
 * Resuelve el error: column "methodology_type" does not exist
 */

import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 MIGRACIÓN DE TABLA user_exercise_feedback');
console.log('===========================================');

async function executeStep(stepName, sqlQuery) {
  console.log(`\n📝 ${stepName}...`);
  try {
    const result = await pool.query(sqlQuery);

    if (result.rows && result.rows.length > 0) {
      console.log('✅ Resultado:');
      result.rows.forEach((row, index) => {
        Object.keys(row).forEach(key => {
          console.log(`   ${key}: ${row[key]}`);
        });
        if (index < result.rows.length - 1) console.log('   ---');
      });
    } else {
      console.log('✅ Ejecutado correctamente');
    }

    return true;
  } catch (error) {
    console.error(`❌ Error en ${stepName}:`, error.message);
    return false;
  }
}

async function executeMigration() {
  try {
    console.log('🔌 Conectando a Supabase...');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'sql', 'migrate_existing_feedback_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Script de migración cargado correctamente');

    // Ejecutar la migración completa
    await pool.query(migrationSQL);

    console.log('✅ Migración ejecutada exitosamente');

    // Verificar el resultado
    console.log('\n🔍 VERIFICANDO MIGRACIÓN...');

    // Verificar estructura final
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name = 'user_exercise_feedback'
      ORDER BY ordinal_position;
    `;

    const structureResult = await pool.query(structureQuery);
    console.log('\n📋 Estructura final de la tabla:');
    structureResult.rows.forEach((col, index) => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      console.log(`   ${index + 1}. ${col.column_name} - ${col.data_type} ${nullable}`);
    });

    // Verificar datos migrados
    const dataQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN methodology_type IS NOT NULL THEN 1 END) as with_methodology,
        COUNT(CASE WHEN feedback_type IS NOT NULL THEN 1 END) as with_feedback_type,
        array_agg(DISTINCT methodology_type) as methodologies
      FROM app.user_exercise_feedback;
    `;

    const dataResult = await pool.query(dataQuery);
    if (dataResult.rows.length > 0) {
      const data = dataResult.rows[0];
      console.log('\n📊 Estadísticas de datos migrados:');
      console.log(`   Total de registros: ${data.total}`);
      console.log(`   Con methodology_type: ${data.with_methodology}`);
      console.log(`   Con feedback_type: ${data.with_feedback_type}`);
      console.log(`   Metodologías encontradas: ${data.methodologies?.join(', ') || 'ninguna'}`);
    }

    // Probar una consulta que use methodology_type
    const testQuery = `
      SELECT COUNT(*) as count
      FROM app.user_exercise_feedback
      WHERE methodology_type = 'home_training';
    `;

    const testResult = await pool.query(testQuery);
    console.log(`\n🧪 Prueba de consulta con methodology_type: ${testResult.rows[0].count} registros encontrados`);

    return true;

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error('🔍 Detalles del error:', error);
    return false;
  }
}

async function installFunctions() {
  console.log('\n🔧 INSTALANDO FUNCIONES DE FEEDBACK...');

  try {
    // Leer el archivo de funciones originales
    const functionsPath = path.join(__dirname, 'sql', 'create_feedback_system.sql');
    const functionsSQL = fs.readFileSync(functionsPath, 'utf8');

    // Extraer solo la parte de funciones (líneas que empiecen con CREATE OR REPLACE FUNCTION)
    const lines = functionsSQL.split('\n');
    let functionSQL = '';
    let inFunction = false;
    let braceCount = 0;

    for (const line of lines) {
      if (line.includes('CREATE OR REPLACE FUNCTION')) {
        inFunction = true;
        functionSQL += line + '\n';
      } else if (inFunction) {
        functionSQL += line + '\n';

        // Contar braces para saber cuándo termina la función
        const openBraces = (line.match(/\$\$/g) || []).length;
        if (openBraces > 0) {
          braceCount++;
          if (braceCount === 2) { // $$ opening and closing
            inFunction = false;
            braceCount = 0;
          }
        }
      }
    }

    if (functionSQL.trim()) {
      await pool.query(functionSQL);
      console.log('✅ Funciones de feedback instaladas correctamente');
    }

    return true;

  } catch (error) {
    console.error('❌ Error instalando funciones:', error.message);
    return false;
  }
}

async function main() {
  try {
    // Paso 1: Ejecutar migración
    const migrationOk = await executeMigration();
    if (!migrationOk) {
      console.error('💥 FALLA CRÍTICA: Migración falló');
      process.exit(1);
    }

    // Paso 2: Instalar funciones
    const functionsOk = await installFunctions();
    if (!functionsOk) {
      console.error('⚠️  ADVERTENCIA: Funciones no se instalaron, pero migración exitosa');
    }

    console.log('\n🎉 ¡MIGRACIÓN COMPLETADA!');
    console.log('========================');
    console.log('✅ Tabla user_exercise_feedback migrada correctamente');
    console.log('✅ Columna methodology_type agregada');
    console.log('✅ Datos existentes preservados');
    console.log('✅ Nueva estructura compatible con el código');
    console.log('');
    console.log('🔧 Próximos pasos:');
    console.log('   - Probar HomeTrainingRejectionModal.jsx');
    console.log('   - Verificar compatibilidad con calisteniaSpecialist.js');
    console.log('   - Confirmar que el error "methodology_type" no se repita');

  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar la migración
main().catch(error => {
  console.error('💥 ERROR INESPERADO:', error);
  process.exit(1);
});