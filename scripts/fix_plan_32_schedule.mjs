#!/usr/bin/env node
/**
 * Script para regenerar la programación del plan 32
 * Usa la función ensureWorkoutSchedule() corregida
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

// Copiar las funciones necesarias del backend
function normalizeDayAbbrev(dayStr) {
  if (!dayStr) return '';
  const s = String(dayStr).toLowerCase().trim();
  if (s.startsWith('dom')) return 'Dom';
  if (s.startsWith('lun')) return 'Lun';
  if (s.startsWith('mar')) return 'Mar';
  if (s.startsWith('mie') || s.startsWith('mié')) return 'Mié';
  if (s.startsWith('jue')) return 'Jue';
  if (s.startsWith('vie')) return 'Vie';
  if (s.startsWith('sab') || s.startsWith('sáb')) return 'Sáb';
  return dayStr;
}

function normalizePlanDays(planData) {
  if (!planData?.semanas) return planData;
  const normalized = { ...planData };
  normalized.semanas = planData.semanas.map(semana => ({
    ...semana,
    sesiones: (semana.sesiones || []).map(sesion => ({
      ...sesion,
      dia: normalizeDayAbbrev(sesion.dia)
    }))
  }));
  return normalized;
}

async function ensureWorkoutSchedule(client, userId, methodologyPlanId, planDataJson, startDate = new Date()) {
  console.log(`📅 [ensureWorkoutSchedule] Iniciando para plan ${methodologyPlanId}, usuario ${userId}`);
  
  const planData = typeof planDataJson === 'string' ? JSON.parse(planDataJson) : planDataJson;
  if (!planData || !Array.isArray(planData.semanas) || planData.semanas.length === 0) {
    console.warn(`⚠️ [ensureWorkoutSchedule] Plan vacío o sin semanas para plan ${methodologyPlanId}`);
    return;
  }

  console.log(`📊 [ensureWorkoutSchedule] Plan tiene ${planData.semanas.length} semanas`);

  const normalizedPlan = normalizePlanDays(planData);

  // Limpiar programación existente
  await client.query(
    `DELETE FROM app.workout_schedule WHERE methodology_plan_id = $1 AND user_id = $2`,
    [methodologyPlanId, userId]
  );

  await client.query(
    `DELETE FROM app.methodology_plan_days WHERE plan_id = $1`,
    [methodologyPlanId]
  );
  
  console.log(`🧹 [ensureWorkoutSchedule] Tablas limpiadas para plan ${methodologyPlanId}`);

  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const dayAbbrevs = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  const planStartDate = new Date(startDate);

  let day_id = 1;
  let globalSessionOrder = 1;

  for (let weekIndex = 0; weekIndex < normalizedPlan.semanas.length; weekIndex++) {
    const semana = normalizedPlan.semanas[weekIndex];
    const weekNumber = weekIndex + 1;

    if (!semana?.sesiones?.length) continue;

    let weekSessionOrder = 1;

    for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
      const dayOffset = (weekIndex * 7) + dayInWeek;

      const currentDate = new Date(planStartDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);

      const dow = currentDate.getDay();
      const dayName = dayNames[dow];
      const dayAbbrev = dayAbbrevs[dow];

      const sesion = semana.sesiones.find(s => {
        const sesionDay = normalizeDayAbbrev(s.dia);
        return sesionDay === dayAbbrev;
      });

      if (!sesion) {
        await client.query(
          `INSERT INTO app.methodology_plan_days (
            plan_id, day_id, week_number, day_name, date_local, is_rest
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (plan_id, day_id) DO NOTHING`,
          [methodologyPlanId, day_id, weekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], true]
        );
        day_id++;
        continue;
      }

      const sessionTitle = sesion?.titulo || sesion?.title || `Sesión ${globalSessionOrder}`;

      await client.query(
        `INSERT INTO app.workout_schedule (
          methodology_plan_id,
          user_id,
          week_number,
          session_order,
          week_session_order,
          scheduled_date,
          day_name,
          day_abbrev,
          session_title,
          exercises,
          status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          methodologyPlanId,
          userId,
          weekNumber,
          globalSessionOrder,
          weekSessionOrder,
          currentDate.toISOString().split('T')[0],
          dayName,
          dayAbbrev,
          sessionTitle,
          JSON.stringify(sesion.ejercicios || []),
          'scheduled'
        ]
      );

      await client.query(
        `INSERT INTO app.methodology_plan_days (
          plan_id, day_id, week_number, day_name, date_local, is_rest, planned_exercises_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (plan_id, day_id) DO NOTHING`,
        [methodologyPlanId, day_id, weekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], false, sesion.ejercicios?.length || 0]
      );

      day_id++;
      globalSessionOrder++;
      weekSessionOrder++;
    }
  }

  const totalSessions = globalSessionOrder - 1;
  const totalDays = day_id - 1;
  const restDays = totalDays - totalSessions;
  
  console.log(`✅ [ensureWorkoutSchedule] Programación generada para plan ${methodologyPlanId}:`);
  console.log(`   📊 Total días: ${totalDays}`);
  console.log(`   💪 Días de entreno: ${totalSessions}`);
  console.log(`   💤 Días de descanso: ${restDays}`);
  console.log(`   📅 Fecha inicio: ${startDate.toISOString().split('T')[0]}`);
}

async function fixPlan32() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 REGENERANDO PROGRAMACIÓN DEL PLAN 32');
    console.log('='.repeat(80) + '\n');

    // Obtener datos del plan 32
    const planResult = await client.query(`
      SELECT 
        id,
        user_id,
        plan_data,
        confirmed_at,
        plan_start_date
      FROM app.methodology_plans
      WHERE id = 32
    `);

    if (planResult.rowCount === 0) {
      console.log('❌ Plan 32 no encontrado');
      return;
    }

    const plan = planResult.rows[0];
    console.log(`✅ Plan 32 encontrado`);
    console.log(`   Usuario: ${plan.user_id}`);
    console.log(`   Confirmado: ${plan.confirmed_at}`);
    console.log(`   Fecha inicio: ${plan.plan_start_date || 'NULL (usaremos confirmed_at)'}`);

    const startDate = plan.plan_start_date || plan.confirmed_at || new Date();
    console.log(`   📅 Usando fecha: ${startDate}\n`);

    // Regenerar programación
    await ensureWorkoutSchedule(client, plan.user_id, 32, plan.plan_data, startDate);

    console.log('\n' + '='.repeat(80));
    console.log('✅ REGENERACIÓN COMPLETADA');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error durante la regeneración:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
fixPlan32().catch(console.error);

