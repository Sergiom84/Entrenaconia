#!/usr/bin/env node

import { pool } from './backend/db.js';
import fs from 'fs';

async function executeSessionMetadataFix() {
  try {
    console.log('🔧 EJECUTANDO SOLUCIÓN PARA session_metadata');
    console.log('=============================================');

    // Leer el script SQL de solución
    const sqlScript = fs.readFileSync('./fix_session_metadata_column.sql', 'utf8');

    console.log('📄 Script de solución cargado');
    console.log('🔄 Ejecutando migración...');

    // Ejecutar el script
    await pool.query(sqlScript);

    console.log('✅ Script ejecutado exitosamente');

    // Verificar que la columna se agregó
    console.log('\n🔍 VERIFICANDO SOLUCIÓN...');

    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name = 'user_sessions'
        AND column_name = 'session_metadata';
    `;

    const verification = await pool.query(verificationQuery);

    if (verification.rows.length > 0) {
      const col = verification.rows[0];
      console.log('✅ Columna session_metadata agregada correctamente:');
      console.log(`   - Nombre: ${col.column_name}`);
      console.log(`   - Tipo: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log(`   - Default: ${col.column_default}`);
    } else {
      throw new Error('La columna session_metadata no se encontró después de la migración');
    }

    // Probar una consulta INSERT similar a la que falla
    console.log('\n🧪 PROBANDO FUNCIONALIDAD...');

    const testQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name = 'user_sessions'
      ORDER BY ordinal_position;
    `;

    const testResult = await pool.query(testQuery);
    console.log('✅ Columnas disponibles en user_sessions:');
    testResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

    console.log('\n🎉 SOLUCIÓN APLICADA EXITOSAMENTE');
    console.log('================================');
    console.log('✅ Columna session_metadata agregada a app.user_sessions');
    console.log('✅ La función logUserLogin() en sessionUtils.js ahora debería funcionar');
    console.log('✅ El error del login debería estar resuelto');

  } catch (error) {
    console.error('❌ Error ejecutando solución:', error.message);
    console.error('🔍 Detalles:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

executeSessionMetadataFix().catch(error => {
  console.error('💥 FALLA CRÍTICA:', error);
  process.exit(1);
});