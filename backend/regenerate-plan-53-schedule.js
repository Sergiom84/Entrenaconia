/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';

async function regenerateSchedule() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🔄 Regenerando programación para plan 53...\n');

    const methodologyPlanId = 53;
    const userId = 25;

    // 1. Obtener el plan_data
    const planResult = await client.query(
      'SELECT plan_data FROM app.methodology_plans WHERE id = $1',
      [methodologyPlanId]
    );

    if (planResult.rows.length === 0) {
      throw new Error('Plan 53 no encontrado');
    }

    const planData = planResult.rows[0].plan_data;
    console.log('✅ Plan obtenido');

    // 2. Limpiar tablas existentes
    await client.query(
      'DELETE FROM app.workout_schedule WHERE methodology_plan_id = $1 AND user_id = $2',
      [methodologyPlanId, userId]
    );
    console.log('✅ workout_schedule limpiado');

    await client.query(
      'DELETE FROM app.methodology_plan_days WHERE plan_id = $1',
      [methodologyPlanId]
    );
    console.log('✅ methodology_plan_days limpiado');

    // 3. Recrear con la lógica corregida
    const dayAbbrevs = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const planStartDate = new Date('2025-10-13'); // Ajusta si es necesario

    let day_id = 1;
    let globalSessionOrder = 1;

    for (let weekIndex = 0; weekIndex < planData.semanas.length; weekIndex++) {
      const semana = planData.semanas[weekIndex];
      const weekNumber = weekIndex + 1;

      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        const dayOffset = (weekIndex * 7) + dayInWeek;
        const currentDate = new Date(planStartDate);
        currentDate.setDate(currentDate.getDate() + dayOffset);

        const dow = currentDate.getDay();
        const dayName = dayNames[dow];
        const dayAbbrev = dayAbbrevs[dow];

        // Buscar sesión para este día
        const sesion = semana.sesiones?.find(s => {
          const normDay = s.dia || s.dia_semana || '';
          return normDay.toLowerCase().includes(dayAbbrev.toLowerCase().slice(0, 3));
        });

        if (!sesion) {
          // Día de descanso
          await client.query(
            `INSERT INTO app.methodology_plan_days (
              plan_id, day_id, week_number, day_name, date_local, is_rest
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [methodologyPlanId, day_id, weekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], true]
          );
          day_id++;
          continue;
        }

        // 📦 Extraer ejercicios: soportar bloques
        let ejercicios = [];
        if (Array.isArray(sesion.ejercicios)) {
          ejercicios = sesion.ejercicios;
        } else if (Array.isArray(sesion.bloques)) {
          ejercicios = sesion.bloques.flatMap(bloque =>
            Array.isArray(bloque.ejercicios) ? bloque.ejercicios : []
          );
        }

        console.log(`  Semana ${weekNumber}, ${dayAbbrev}: ${ejercicios.length} ejercicios`);

        // Insertar en workout_schedule
        await client.query(
          `INSERT INTO app.workout_schedule (
            methodology_plan_id, user_id, week_number, session_order,
            week_session_order, scheduled_date, day_name, day_abbrev,
            session_title, exercises, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            methodologyPlanId, userId, weekNumber, globalSessionOrder,
            dayInWeek + 1, currentDate.toISOString().split('T')[0],
            dayName, dayAbbrev,
            sesion.titulo || sesion.tipo || `Sesión ${globalSessionOrder}`,
            JSON.stringify(ejercicios), 'scheduled'
          ]
        );

        // Insertar en methodology_plan_days
        await client.query(
          `INSERT INTO app.methodology_plan_days (
            plan_id, day_id, week_number, day_name, date_local,
            is_rest, planned_exercises_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [methodologyPlanId, day_id, weekNumber, dayAbbrev,
           currentDate.toISOString().split('T')[0], false, ejercicios.length]
        );

        day_id++;
        globalSessionOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Programación regenerada exitosamente');
    console.log(`Total de días creados: ${day_id - 1}`);
    console.log(`Total de sesiones: ${globalSessionOrder - 1}`);

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

regenerateSchedule();
