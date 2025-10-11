#!/usr/bin/env node
/**
 * Script para probar el endpoint de progreso
 * Simula lo que hace el ProgressTab
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

async function testProgressTab() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST - PROGRESS TAB');
    console.log('='.repeat(80) + '\n');

    // 1. Obtener el plan más reciente
    console.log('📋 1. Obteniendo plan más reciente...\n');
    
    const latestPlan = await client.query(`
      SELECT 
        mp.id,
        mp.user_id,
        mp.methodology_type,
        mp.status,
        mp.plan_data
      FROM app.methodology_plans mp
      WHERE mp.status IN ('active', 'confirmed')
      ORDER BY mp.id DESC
      LIMIT 1
    `);
    
    if (latestPlan.rowCount === 0) {
      console.log('❌ No hay planes activos para probar');
      return;
    }
    
    const plan = latestPlan.rows[0];
    console.log(`✅ Plan encontrado: ID ${plan.id}, Usuario ${plan.user_id}, Tipo: ${plan.methodology_type}\n`);

    // 2. Simular la consulta del endpoint /api/routines/progress-data
    console.log('📋 2. Consultando datos de progreso...\n');
    
    // Estadísticas generales
    const generalStats = await client.query(`
      SELECT
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as total_sessions_completed,
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status IN ('in_progress', 'completed', 'cancelled')) as total_sessions_started,
        COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as total_exercises_completed,
        COUNT(DISTINCT mep.id) FILTER (WHERE mep.status IN ('in_progress', 'completed', 'cancelled', 'skipped')) as total_exercises_attempted,
        SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_completed,
        SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) +
        SUM(DISTINCT COALESCE(mes.warmup_time_seconds, 0)) as total_time_seconds,
        MIN(mes.started_at) as first_session_date,
        MAX(mes.completed_at) as last_session_date
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2
    `, [plan.user_id, plan.id]);

    const stats = generalStats.rows[0];
    
    console.log('📊 Estadísticas Generales:');
    console.log(`   Sesiones completadas: ${stats.total_sessions_completed}`);
    console.log(`   Sesiones iniciadas: ${stats.total_sessions_started}`);
    console.log(`   Ejercicios completados: ${stats.total_exercises_completed}`);
    console.log(`   Ejercicios intentados: ${stats.total_exercises_attempted}`);
    console.log(`   Series completadas: ${stats.total_series_completed}`);
    console.log(`   Tiempo total: ${Math.floor(stats.total_time_seconds / 60)} minutos`);
    console.log(`   Primera sesión: ${stats.first_session_date || 'N/A'}`);
    console.log(`   Última sesión: ${stats.last_session_date || 'N/A'}`);
    console.log('');

    // Progreso por semanas
    const weeklyProgress = await client.query(`
      SELECT
        mes.week_number,
        COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as sessions_completed,
        COUNT(DISTINCT mes.id) as total_sessions,
        COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as exercises_completed,
        COUNT(DISTINCT mep.id) as total_exercises,
        SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as series_completed
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2
      GROUP BY mes.week_number
      ORDER BY mes.week_number ASC
    `, [plan.user_id, plan.id]);

    console.log('📊 Progreso por Semanas:');
    weeklyProgress.rows.forEach(week => {
      const progress = Math.round((week.sessions_completed / week.total_sessions) * 100);
      console.log(`   Semana ${week.week_number}: ${week.sessions_completed}/${week.total_sessions} sesiones (${progress}%)`);
      console.log(`      Ejercicios: ${week.exercises_completed}/${week.total_exercises}`);
      console.log(`      Series: ${week.series_completed}`);
    });
    console.log('');

    // Actividad reciente
    const recentActivity = await client.query(`
      SELECT
        mes.id as methodology_session_id,
        mes.completed_at as session_date,
        mes.week_number,
        mes.day_name,
        COUNT(mep.id) as exercises_count,
        SUM(mep.series_completed) as total_series,
        SUM(COALESCE(mep.time_spent_seconds, 0)) + COALESCE(mes.warmup_time_seconds, 0) as session_duration_seconds
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
      WHERE mes.user_id = $1 
        AND mes.methodology_plan_id = $2
        AND mes.session_status = 'completed'
      GROUP BY mes.id, mes.completed_at, mes.week_number, mes.day_name, mes.warmup_time_seconds
      ORDER BY mes.completed_at DESC
      LIMIT 5
    `, [plan.user_id, plan.id]);

    console.log('📊 Actividad Reciente:');
    recentActivity.rows.forEach(activity => {
      const date = new Date(activity.session_date).toLocaleDateString('es-ES');
      const duration = Math.floor(activity.session_duration_seconds / 60);
      console.log(`   ${date} - Semana ${activity.week_number}, ${activity.day_name}`);
      console.log(`      ${activity.exercises_count} ejercicios, ${activity.total_series} series, ${duration} min`);
    });
    console.log('');

    // 3. Calcular métricas adicionales
    console.log('📋 3. Calculando métricas adicionales...\n');

    // Racha actual
    const sortedActivity = [...recentActivity.rows].sort((a, b) => 
      new Date(b.session_date) - new Date(a.session_date)
    );
    
    let currentStreak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const activity of sortedActivity) {
      const activityDate = new Date(activity.session_date);
      activityDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((currentDate - activityDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === currentStreak) {
        currentStreak++;
      } else if (diffDays > currentStreak) {
        break;
      }
    }

    console.log(`🔥 Racha actual: ${currentStreak} días consecutivos`);

    // Intensidad promedio
    const intensity = stats.total_exercises_attempted > 0
      ? Math.round((stats.total_exercises_completed / stats.total_exercises_attempted) * 100)
      : 0;
    
    console.log(`⚡ Intensidad promedio: ${intensity}%`);

    // Consistencia
    const planData = plan.plan_data;
    const totalSessionsInPlan = planData?.semanas?.reduce((acc, semana) =>
      acc + (semana.sesiones?.length || 0), 0) || 0;
    
    const consistency = totalSessionsInPlan > 0
      ? Math.round((stats.total_sessions_completed / totalSessionsInPlan) * 100)
      : 0;
    
    console.log(`📊 Consistencia: ${consistency}% (${stats.total_sessions_completed}/${totalSessionsInPlan} sesiones)`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETADO');
    console.log('='.repeat(80) + '\n');

    console.log('📝 RESUMEN:');
    console.log(`   Plan ID: ${plan.id}`);
    console.log(`   Usuario: ${plan.user_id}`);
    console.log(`   Sesiones completadas: ${stats.total_sessions_completed}`);
    console.log(`   Racha actual: ${currentStreak} días`);
    console.log(`   Intensidad: ${intensity}%`);
    console.log(`   Consistencia: ${consistency}%`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
testProgressTab().catch(console.error);

