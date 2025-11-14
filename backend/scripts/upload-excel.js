import XLSX from 'xlsx';
import { pool } from '../db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function uploadExcelData() {
  try {
    // Buscar el archivo automáticamente en Desktop
    const desktopPath = 'c:\\Users\\Sergio\\Desktop';
    const files = fs.readdirSync(desktopPath);
    const excelFile = files.find(f => f.includes('Clasificaci') && f.endsWith('.xlsx'));

    if (!excelFile) {
      console.error('❌ No se encontró el archivo Excel en Desktop');
      console.log('📁 Archivos .xlsx encontrados:');
      files.filter(f => f.endsWith('.xlsx')).forEach(f => console.log('  -', f));
      process.exit(1);
    }

    const excelPath = join(desktopPath, excelFile);
    console.log('📂 Leyendo archivo Excel:', excelFile);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('📊 Estructura del archivo:');
    console.log('Total de filas:', data.length);
    console.log('Primeras 5 filas:');
    data.slice(0, 5).forEach((row, idx) => {
      console.log(`Fila ${idx}:`, row);
    });

    // Identificar si tiene encabezados
    const hasHeaders = typeof data[0][0] === 'string' && (
      data[0][0].toLowerCase().includes('tipo') ||
      data[0][0].toLowerCase().includes('base') ||
      data[0][0].toLowerCase().includes('ejecuci')
    );

    console.log('\n¿Tiene encabezados?', hasHeaders);

    // Preparar datos para inserción (omitir encabezados si existen)
    const startRow = hasHeaders ? 1 : 0;
    const allRows = data.slice(startRow);

    console.log('\n📋 Total de filas de datos:', allRows.length);

    // Obtener ejercicios actuales ordenados por exercise_id
    console.log('\n🔍 Obteniendo ejercicios existentes de la tabla...');
    const existingResult = await pool.query(`
      SELECT exercise_id, nombre, "Tipo base", "Ejecución"
      FROM app."Ejercicios_Hipertrofia"
      ORDER BY exercise_id
    `);

    console.log(`✅ Encontrados ${existingResult.rows.length} ejercicios en la tabla`);

    // Validación: verificar que tenemos suficientes filas
    if (allRows.length !== existingResult.rows.length) {
      console.warn(`⚠️ ADVERTENCIA: El Excel tiene ${allRows.length} filas pero la tabla tiene ${existingResult.rows.length} registros`);
      console.log('Se actualizarán solo los primeros', Math.min(allRows.length, existingResult.rows.length), 'registros');
    }

    // Preparar actualizaciones
    const updates = [];
    const limit = Math.min(allRows.length, existingResult.rows.length);

    for (let i = 0; i < limit; i++) {
      const excelRow = allRows[i];
      const dbRow = existingResult.rows[i];

      const tipoBase = excelRow[0] || null;
      const ejecucion = excelRow[1] || null;

      updates.push({
        exercise_id: dbRow.exercise_id,
        nombre: dbRow.nombre,
        tipoBase,
        ejecucion,
        rowNum: i + 1
      });
    }

    console.log('\n📝 Vista previa de actualizaciones (primeros 5):');
    updates.slice(0, 5).forEach(u => {
      console.log(`  ${u.rowNum}. ${u.nombre} → Tipo: "${u.tipoBase || 'NULL'}", Ejecución: "${u.ejecucion || 'NULL'}"`);
    });

    console.log('\n⚠️ Se actualizarán', updates.length, 'registros en app."Ejercicios_Hipertrofia"');
    console.log('Presiona Ctrl+C para cancelar o espera 3 segundos para continuar...');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Ejecutar actualizaciones
    console.log('\n🔄 Actualizando registros...');
    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await pool.query(`
          UPDATE app."Ejercicios_Hipertrofia"
          SET "Tipo base" = $1, "Ejecución" = $2
          WHERE exercise_id = $3
        `, [update.tipoBase, update.ejecucion, update.exercise_id]);
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`  ✓ Actualizados ${successCount}/${updates.length}...`);
        }
      } catch (err) {
        console.error(`  ✗ Error en fila ${update.rowNum} (${update.nombre}):`, err.message);
        errorCount++;
      }
    }

    console.log('\n✅ Proceso completado!');
    console.log(`  - Actualizados exitosamente: ${successCount}`);
    console.log(`  - Errores: ${errorCount}`);

    // Mostrar resumen de datos actualizados
    const summary = await pool.query(`
      SELECT
        "Tipo base",
        "Ejecución",
        COUNT(*) as cantidad
      FROM app."Ejercicios_Hipertrofia"
      WHERE "Tipo base" IS NOT NULL OR "Ejecución" IS NOT NULL
      GROUP BY "Tipo base", "Ejecución"
      ORDER BY cantidad DESC
    `);

    console.log('\n📊 Resumen de datos actualizados:');
    console.table(summary.rows);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

uploadExcelData();
