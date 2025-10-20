/**
 * Script para cargar ejercicios de Bomberos en la base de datos
 *
 * @author Claude Code - Sistema de Oposiciones
 * @version 1.0.0
 * @date 2025-10-20
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadExercises() {
  console.log('🚒 CARGANDO EJERCICIOS DE BOMBEROS EN SUPABASE');
  console.log('=====================================');

  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../../scripts/insert-bomberos-exercises.sql');
    let sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Eliminar comentarios de una línea y líneas vacías
    sqlContent = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');

    // Separar las queries principales (DELETE, INSERT, SELECT)
    const queries = [];

    // Buscar DELETE
    const deleteMatch = sqlContent.match(/DELETE FROM[^;]+;/);
    if (deleteMatch) {
      queries.push(deleteMatch[0]);
    }

    // Buscar todos los INSERT (pueden ser múltiples)
    const insertMatches = sqlContent.match(/INSERT INTO[^;]+;/g);
    if (insertMatches) {
      queries.push(...insertMatches);
    }

    // Buscar SELECT de verificación al final
    const selectMatches = sqlContent.match(/SELECT[^;]+;/g);
    if (selectMatches) {
      queries.push(...selectMatches.slice(-2)); // Solo los últimos 2 SELECT (verificación)
    }

    console.log(`📝 Total de queries a ejecutar: ${queries.length}`);

    // Ejecutar cada query
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];

      // Saltar comentarios y queries SELECT de verificación
      if (query.startsWith('SELECT')) {
        console.log(`📊 Query de verificación ${i + 1}...`);
        const result = await pool.query(query);
        console.table(result.rows);
        continue;
      }

      if (query.startsWith('DELETE') || query.startsWith('INSERT')) {
        console.log(`⚙️ Ejecutando query ${i + 1}...`);
        const result = await pool.query(query);

        if (query.startsWith('DELETE')) {
          console.log(`   ✅ Registros eliminados: ${result.rowCount}`);
        } else if (query.startsWith('INSERT')) {
          console.log(`   ✅ Ejercicios insertados: ${result.rowCount}`);
        }
      }
    }

    // Verificación final
    console.log('\n📊 VERIFICACIÓN FINAL:');
    console.log('======================');

    const verifyQuery = `
      SELECT
        nivel,
        categoria,
        tipo_prueba,
        COUNT(*) as total
      FROM app."Ejercicios_Bomberos"
      GROUP BY nivel, categoria, tipo_prueba
      ORDER BY
        CASE nivel
          WHEN 'Principiante' THEN 1
          WHEN 'Intermedio' THEN 2
          WHEN 'Avanzado' THEN 3
        END,
        categoria, tipo_prueba
    `;

    const result = await pool.query(verifyQuery);
    console.table(result.rows);

    const totalQuery = `SELECT COUNT(*) as total FROM app."Ejercicios_Bomberos"`;
    const totalResult = await pool.query(totalQuery);
    console.log(`\n✅ TOTAL DE EJERCICIOS CARGADOS: ${totalResult.rows[0].total}`);

    // Verificar que tenemos ejercicios para cada nivel
    const levelsQuery = `
      SELECT DISTINCT nivel, COUNT(*) as total
      FROM app."Ejercicios_Bomberos"
      GROUP BY nivel
    `;
    const levelsResult = await pool.query(levelsQuery);
    console.log('\n📊 Ejercicios por nivel:');
    console.table(levelsResult.rows);

    console.log('\n✅ ¡Ejercicios de Bomberos cargados exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error cargando ejercicios:', error);
    console.error('Detalle del error:', error.message);
    if (error.detail) {
      console.error('Detalle adicional:', error.detail);
    }
    process.exit(1);
  }
}

// Ejecutar el script
loadExercises();