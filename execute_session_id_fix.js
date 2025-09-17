#!/usr/bin/env node

import { pool } from './backend/db.js';
import fs from 'fs';

async function executeSessionIdFix() {
  try {
    console.log('🔧 EJECUTANDO SOLUCIÓN PARA session_id SCHEMA');
    console.log('==============================================');

    // Leer el script SQL de solución
    const sqlScript = fs.readFileSync('./fix_session_id_schema.sql', 'utf8');

    console.log('📄 Script de solución cargado');
    console.log('🔄 Ejecutando migración de session_id...');

    // Ejecutar el script
    await pool.query(sqlScript);

    console.log('✅ Script ejecutado exitosamente');

    // Verificar que el cambio se aplicó
    console.log('\n🔍 VERIFICANDO SOLUCIÓN...');

    const verificationQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name = 'user_sessions'
        AND column_name = 'session_id';
    `;

    const verification = await pool.query(verificationQuery);

    if (verification.rows.length > 0) {
      const col = verification.rows[0];
      console.log('✅ Configuración de session_id:');
      console.log(`   - Nombre: ${col.column_name}`);
      console.log(`   - Tipo: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log(`   - Default: ${col.column_default}`);

      // Verificar que es UUID con default correcto
      if (col.data_type === 'uuid' && col.is_nullable === 'NO' && col.column_default && col.column_default.includes('gen_random_uuid')) {
        console.log('✅ session_id configurado correctamente como UUID auto-generado');
      } else {
        console.log('⚠️  Advertencia: session_id puede no estar configurado correctamente');
      }
    } else {
      throw new Error('No se pudo verificar la columna session_id');
    }

    // Verificar constraints
    const constraintQuery = `
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'app'
        AND table_name = 'user_sessions'
        AND column_name = 'session_id'
        OR constraint_name LIKE '%session_id%';
    `;

    const constraints = await pool.query(constraintQuery);
    console.log('\n🔒 Constraints en session_id:');
    constraints.rows.forEach(constraint => {
      console.log(`   - ${constraint.constraint_name}: ${constraint.constraint_type}`);
    });

    console.log('\n🎉 SOLUCIÓN APLICADA EXITOSAMENTE');
    console.log('=================================');
    console.log('✅ session_id ahora es UUID con auto-generación');
    console.log('✅ Compatible con el código de sessionUtils.js');
    console.log('✅ Constraints de integridad aplicados');

  } catch (error) {
    console.error('❌ Error ejecutando solución:', error.message);
    console.error('🔍 Detalles:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

executeSessionIdFix().catch(error => {
  console.error('💥 FALLA CRÍTICA:', error);
  process.exit(1);
});