#!/usr/bin/env node
/**
 * 🔧 Script de reparación: Poblar methodology_plan_days y workout_schedule para plan 28
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', 'backend', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function populatePlan28Schedule() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Poblando schedule para plan 28...\n');
    
    await client.query('BEGIN');
    
    // 1. Obtener el plan y sus sesiones
    const planResult = await client.query(`
      SELECT id, user_id, plan_data, started_at
      FROM app.methodology_plans 
      WHERE id = 28
    `);
    
    if (planResult.rowCount === 0) {
      throw new Error('Plan 28 no encontrado');
    }
    
    const plan = planResult.rows[0];
    const userId = plan.user_id;
    const planData = plan.plan_data;
    
    // 2. Determinar fecha de inicio (usar la fecha de la primera sesión o hoy)
    const firstSessionResult = await client.query(`
      SELECT MIN(started_at) as first_start
      FROM app.methodology_exercise_sessions
      WHERE methodology_plan_id = 28
    `);
    
    const startDate = firstSessionResult.rows[0]?.first_start || new Date();
    console.log(`📅 Fecha de inicio del plan: ${startDate}`);
    
    // 3. Obtener todas las sesiones existentes
    const sessionsResult = await client.query(`
      SELECT id, week_number, day_name, started_at
      FROM app.methodology_exercise_sessions
      WHERE methodology_plan_id = 28
      ORDER BY week_number, id
    `);
    
    console.log(`📊 Sesiones encontradas: ${sessionsResult.rowCount}\n`);
    
    // 4. Mapear días de la semana
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayAbbrevs = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    
    // 5. Crear entradas en methodology_plan_days para TODOS los días desde el inicio
    // Calcular cuántos días han pasado desde el inicio del plan hasta hoy
    const planStartDate = new Date(startDate);
    planStartDate.setHours(0, 0, 0, 0); // Normalizar a medianoche

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((today - planStartDate) / (24 * 60 * 60 * 1000));
    const totalDays = Math.max(daysSinceStart + 1, 7); // Al menos una semana

    console.log(`📅 Días desde inicio: ${daysSinceStart + 1}`);
    console.log(`📅 Generando ${totalDays} días de calendario...\n`);

    // Crear un mapa de sesiones por día de la semana
    const sessionsByDay = {};
    for (const session of sessionsResult.rows) {
      sessionsByDay[session.day_name] = session;
    }

    // Generar todos los días desde el inicio
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = new Date(planStartDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);

      const dayOfWeek = currentDate.getDay();
      const dayName = dayNames[dayOfWeek];
      const dayAbbrev = dayAbbrevs[dayOfWeek];
      const dateLocal = currentDate.toISOString().split('T')[0];
      const dayId = dayOffset + 1;
      const weekNumber = Math.floor(dayOffset / 7) + 1;

      // Verificar si hay sesión para este día
      const hasSession = sessionsByDay[dayAbbrev] != null;
      const isRest = !hasSession;

      // Insertar en methodology_plan_days
      await client.query(`
        INSERT INTO app.methodology_plan_days (
          plan_id, day_id, week_number, day_name, date_local, is_rest, planned_exercises_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (plan_id, day_id) DO UPDATE SET
          week_number = EXCLUDED.week_number,
          day_name = EXCLUDED.day_name,
          date_local = EXCLUDED.date_local,
          is_rest = EXCLUDED.is_rest
      `, [28, dayId, weekNumber, dayAbbrev, dateLocal, isRest, hasSession ? 4 : 0]);

      const status = isRest ? '💤 DESCANSO' : '💪 ENTRENO';
      console.log(`✅ day_id=${dayId}, week=${weekNumber}, ${dayAbbrev} (${dateLocal}) - ${status}`);
    }
    
    // 6. Actualizar started_at del plan si es NULL
    if (!plan.started_at) {
      await client.query(`
        UPDATE app.methodology_plans
        SET started_at = $1
        WHERE id = 28
      `, [startDate]);
      
      console.log(`\n✅ Actualizado started_at del plan a ${startDate}`);
    }
    
    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Programación completada exitosamente');
    console.log('='.repeat(60));
    console.log(`📊 Días creados: ${totalDays}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la población:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

populatePlan28Schedule()
  .then(() => {
    console.log('\n🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

