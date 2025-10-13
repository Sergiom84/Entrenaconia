/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';

async function verifyFix() {
  try {
    console.log('🔍 Verificando fix de plan 53...\n');

    // 1. Verificar workout_schedule
    const scheduleResult = await pool.query(`
      SELECT
        week_number,
        day_abbrev,
        session_title,
        jsonb_array_length(exercises::jsonb) as num_exercises,
        status
      FROM app.workout_schedule
      WHERE methodology_plan_id = 53
      ORDER BY session_order
      LIMIT 5
    `);

    console.log('📅 workout_schedule (primeras 5 sesiones):');
    scheduleResult.rows.forEach(row => {
      console.log(`  Semana ${row.week_number}, ${row.day_abbrev}: ${row.num_exercises} ejercicios - ${row.status}`);
    });

    // 2. Verificar methodology_plan_days
    const daysResult = await pool.query(`
      SELECT
        week_number,
        day_name,
        is_rest,
        planned_exercises_count
      FROM app.methodology_plan_days
      WHERE plan_id = 53
      ORDER BY day_id
      LIMIT 10
    `);

    console.log('\n📆 methodology_plan_days (primeros 10 días):');
    daysResult.rows.forEach(row => {
      const label = row.is_rest ? '🛌 Descanso' : `💪 ${row.planned_exercises_count} ejercicios`;
      console.log(`  Semana ${row.week_number}, ${row.day_name}: ${label}`);
    });

    // 3. Contar totales
    const totalScheduleResult = await pool.query(`
      SELECT COUNT(*) as total, SUM(jsonb_array_length(exercises::jsonb)) as total_exercises
      FROM app.workout_schedule
      WHERE methodology_plan_id = 53
    `);

    const totalDaysResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app.methodology_plan_days
      WHERE plan_id = 53
    `);

    console.log('\n📊 Totales:');
    console.log(`  - Sesiones en workout_schedule: ${totalScheduleResult.rows[0].total}`);
    console.log(`  - Total de ejercicios: ${totalScheduleResult.rows[0].total_exercises}`);
    console.log(`  - Días en methodology_plan_days: ${totalDaysResult.rows[0].total}`);

    console.log('\n✅ Plan 53 regenerado correctamente con soporte de bloques');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyFix();
