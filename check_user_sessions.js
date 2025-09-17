#!/usr/bin/env node

import { pool } from './backend/db.js';

async function checkUserSessionsTable() {
  try {
    console.log('🔍 Verificando tabla user_sessions...');

    // Verificar si la tabla existe
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'user_sessions'
      ) as table_exists;
    `;

    const tableCheck = await pool.query(tableExistsQuery);
    console.log('Tabla user_sessions existe:', tableCheck.rows[0].table_exists);

    if (tableCheck.rows[0].table_exists) {
      // Verificar estructura de la tabla
      const structureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
        ORDER BY ordinal_position;
      `;

      const structure = await pool.query(structureQuery);

      console.log('\n📋 Estructura de la tabla user_sessions:');
      structure.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
        console.log(`- ${col.column_name}: ${col.data_type} ${nullable}`);
      });

      // Buscar específicamente la columna session_metadata
      const metadataColumn = structure.rows.find(col => col.column_name === 'session_metadata');
      console.log('\n🔍 Columna session_metadata:', metadataColumn ? '✅ EXISTE' : '❌ NO EXISTE');

      if (!metadataColumn) {
        console.log('\n🚨 PROBLEMA IDENTIFICADO:');
        console.log('La tabla user_sessions existe pero NO tiene la columna session_metadata');
        console.log('Esto explica el error: column "session_metadata" of relation "user_sessions" does not exist');
      }

    } else {
      console.log('\n🚨 PROBLEMA IDENTIFICADO:');
      console.log('La tabla user_sessions NO existe en el esquema app');
      console.log('Se necesita ejecutar el script de migración correspondiente');
    }

  } catch (error) {
    console.error('❌ Error verificando tabla:', error.message);
    console.error('Detalles:', error);
  } finally {
    await pool.end();
  }
}

checkUserSessionsTable();