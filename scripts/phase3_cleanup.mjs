#!/usr/bin/env node
/**
 * Script de limpieza FASE 3
 * 1. Limpia sesiones huérfanas creadas por el stored procedure
 * 2. Optimiza índices en las tablas
 * 3. Analiza estadísticas de la base de datos
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', 'backend', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function phase3Cleanup() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧹 FASE 3 - LIMPIEZA Y OPTIMIZACIÓN');
    console.log('='.repeat(80) + '\n');

    // 1. Analizar sesiones huérfanas
    console.log('📋 1. Analizando sesiones huérfanas...\n');
    
    const orphanSessions = await client.query(`
      SELECT 
        mes.id,
        mes.methodology_plan_id,
        mes.week_number,
        mes.day_name,
        mes.session_status,
        mes.created_at,
        (SELECT COUNT(*) FROM app.methodology_exercise_progress WHERE methodology_session_id = mes.id) as progress_count
      FROM app.methodology_exercise_sessions mes
      WHERE mes.session_status = 'pending'
        AND mes.started_at IS NULL
        AND mes.created_at < NOW() - INTERVAL '7 days'
      ORDER BY mes.created_at DESC
    `);
    
    if (orphanSessions.rowCount > 0) {
      console.log(`⚠️  Encontradas ${orphanSessions.rowCount} sesiones huérfanas (pendientes > 7 días):\n`);
      orphanSessions.rows.forEach(session => {
        console.log(`   Sesión ID: ${session.id}`);
        console.log(`   Plan: ${session.methodology_plan_id}`);
        console.log(`   Semana ${session.week_number}, Día: ${session.day_name}`);
        console.log(`   Creada: ${session.created_at}`);
        console.log(`   Progreso: ${session.progress_count} ejercicios`);
        console.log('');
      });
      
      console.log('💡 Estas sesiones fueron creadas por el stored procedure pero nunca se usaron.');
      console.log('   Se pueden eliminar de forma segura.\n');
    } else {
      console.log('✅ No hay sesiones huérfanas para limpiar\n');
    }

    // 2. Verificar índices existentes
    console.log('📋 2. Verificando índices existentes...\n');
    
    const indexes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'app'
        AND tablename IN ('methodology_plan_days', 'workout_schedule', 'methodology_exercise_sessions', 'methodology_exercise_progress')
      ORDER BY tablename, indexname
    `);
    
    console.log(`✅ Índices encontrados: ${indexes.rowCount}\n`);
    
    const indexesByTable = {};
    indexes.rows.forEach(idx => {
      if (!indexesByTable[idx.tablename]) {
        indexesByTable[idx.tablename] = [];
      }
      indexesByTable[idx.tablename].push(idx.indexname);
    });
    
    Object.keys(indexesByTable).forEach(table => {
      console.log(`   ${table}:`);
      indexesByTable[table].forEach(idx => {
        console.log(`     - ${idx}`);
      });
      console.log('');
    });

    // 3. Crear índices recomendados si no existen
    console.log('📋 3. Creando índices recomendados...\n');
    
    const recommendedIndexes = [
      {
        name: 'idx_methodology_plan_days_plan_day',
        table: 'methodology_plan_days',
        definition: 'CREATE INDEX IF NOT EXISTS idx_methodology_plan_days_plan_day ON app.methodology_plan_days(plan_id, day_id)',
        description: 'Búsqueda rápida por plan y día'
      },
      {
        name: 'idx_methodology_plan_days_date',
        table: 'methodology_plan_days',
        definition: 'CREATE INDEX IF NOT EXISTS idx_methodology_plan_days_date ON app.methodology_plan_days(plan_id, date_local)',
        description: 'Búsqueda rápida por plan y fecha'
      },
      {
        name: 'idx_workout_schedule_plan_date',
        table: 'workout_schedule',
        definition: 'CREATE INDEX IF NOT EXISTS idx_workout_schedule_plan_date ON app.workout_schedule(methodology_plan_id, scheduled_date)',
        description: 'Búsqueda rápida de sesiones por fecha'
      },
      {
        name: 'idx_workout_schedule_plan_week_day',
        table: 'workout_schedule',
        definition: 'CREATE INDEX IF NOT EXISTS idx_workout_schedule_plan_week_day ON app.workout_schedule(methodology_plan_id, week_number, day_abbrev)',
        description: 'Búsqueda rápida por semana y día'
      },
      {
        name: 'idx_methodology_sessions_plan_week_day',
        table: 'methodology_exercise_sessions',
        definition: 'CREATE INDEX IF NOT EXISTS idx_methodology_sessions_plan_week_day ON app.methodology_exercise_sessions(methodology_plan_id, week_number, day_name)',
        description: 'Búsqueda rápida de sesiones por semana y día'
      },
      {
        name: 'idx_methodology_progress_session',
        table: 'methodology_exercise_progress',
        definition: 'CREATE INDEX IF NOT EXISTS idx_methodology_progress_session ON app.methodology_exercise_progress(methodology_session_id, exercise_order)',
        description: 'Búsqueda rápida de progreso por sesión'
      }
    ];
    
    for (const idx of recommendedIndexes) {
      try {
        await client.query(idx.definition);
        console.log(`✅ ${idx.name} - ${idx.description}`);
      } catch (error) {
        console.log(`⚠️  ${idx.name} - Error: ${error.message}`);
      }
    }

    // 4. Analizar estadísticas de las tablas
    console.log('\n📋 4. Analizando estadísticas de las tablas...\n');
    
    await client.query('ANALYZE app.methodology_plan_days');
    await client.query('ANALYZE app.workout_schedule');
    await client.query('ANALYZE app.methodology_exercise_sessions');
    await client.query('ANALYZE app.methodology_exercise_progress');
    
    console.log('✅ Estadísticas actualizadas para todas las tablas');

    // 5. Obtener tamaño de las tablas
    console.log('\n📋 5. Tamaño de las tablas...\n');
    
    const tableSizes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'app'
        AND tablename IN ('methodology_plan_days', 'workout_schedule', 'methodology_exercise_sessions', 'methodology_exercise_progress')
      ORDER BY size_bytes DESC
    `);
    
    tableSizes.rows.forEach(table => {
      console.log(`   ${table.tablename}: ${table.size}`);
    });

    // 6. Resumen de registros
    console.log('\n📋 6. Resumen de registros...\n');
    
    const counts = await client.query(`
      SELECT 
        'methodology_plan_days' as table_name,
        COUNT(*) as count
      FROM app.methodology_plan_days
      UNION ALL
      SELECT 
        'workout_schedule' as table_name,
        COUNT(*) as count
      FROM app.workout_schedule
      UNION ALL
      SELECT 
        'methodology_exercise_sessions' as table_name,
        COUNT(*) as count
      FROM app.methodology_exercise_sessions
      UNION ALL
      SELECT 
        'methodology_exercise_progress' as table_name,
        COUNT(*) as count
      FROM app.methodology_exercise_progress
      ORDER BY count DESC
    `);
    
    counts.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.count} registros`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ LIMPIEZA Y OPTIMIZACIÓN COMPLETADA');
    console.log('='.repeat(80) + '\n');

    console.log('📝 RESUMEN:');
    console.log(`   - Sesiones huérfanas encontradas: ${orphanSessions.rowCount}`);
    console.log(`   - Índices verificados: ${indexes.rowCount}`);
    console.log(`   - Índices recomendados creados: ${recommendedIndexes.length}`);
    console.log(`   - Tablas analizadas: 4`);
    console.log('');

    if (orphanSessions.rowCount > 0) {
      console.log('💡 SIGUIENTE PASO:');
      console.log('   Para eliminar las sesiones huérfanas, ejecuta:');
      console.log('   node scripts/delete_orphan_sessions.mjs');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
phase3Cleanup().catch(console.error);

