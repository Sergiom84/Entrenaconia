/* eslint-env node */
import process from 'node:process';
import { pool } from './db.js';

async function debugPlan() {
  try {
    console.log('🔍 Verificando plan ID 53...\n');

    // 1. Verificar que el plan existe
    const planResult = await pool.query(`
      SELECT id, user_id, methodology_type, status,
             created_at, confirmed_at
      FROM app.methodology_plans
      WHERE id = 53
    `);

    if (planResult.rows.length === 0) {
      console.log('❌ Plan 53 no encontrado en la BD');
      process.exit(1);
    }

    const plan = planResult.rows[0];
    console.log('✅ Plan encontrado:', {
      id: plan.id,
      user_id: plan.user_id,
      methodology_type: plan.methodology_type,
      status: plan.status,
      created_at: plan.created_at,
      confirmed_at: plan.confirmed_at
    });

    // 2. Obtener el plan_data completo
    const planDataResult = await pool.query(`
      SELECT plan_data
      FROM app.methodology_plans
      WHERE id = 53
    `);

    const planData = planDataResult.rows[0].plan_data;
    console.log('\n📋 Estructura del plan:');
    console.log('- Semanas:', planData.semanas?.length || 0);

    if (planData.semanas && planData.semanas[0]) {
      const firstWeek = planData.semanas[0];
      console.log('- Sesiones en semana 1:', firstWeek.sesiones?.length || 0);

      if (firstWeek.sesiones && firstWeek.sesiones[0]) {
        const firstSession = firstWeek.sesiones[0];
        console.log('\n🎯 Primera sesión (estructura):');
        console.log('  - Día:', firstSession.dia || firstSession.dia_semana);
        console.log('  - Tiene ejercicios directos:', !!firstSession.ejercicios);
        console.log('  - Tiene bloques:', !!firstSession.bloques);

        if (firstSession.bloques) {
          console.log('  - Número de bloques:', firstSession.bloques.length);
          firstSession.bloques.forEach((bloque, idx) => {
            console.log(`    Bloque ${idx + 1}: "${bloque.nombre}" - ${bloque.ejercicios?.length || 0} ejercicios`);
          });

          // Contar ejercicios totales
          const totalExercises = firstSession.bloques.reduce((sum, bloque) =>
            sum + (bloque.ejercicios?.length || 0), 0
          );
          console.log(`  - Total de ejercicios en sesión 1: ${totalExercises}`);

          // Mostrar primeros 3 ejercicios
          console.log('\n📝 Primeros ejercicios:');
          let count = 0;
          for (const bloque of firstSession.bloques) {
            for (const ej of (bloque.ejercicios || [])) {
              if (count < 3) {
                console.log(`  ${count + 1}. ${ej.nombre} (${ej.series_reps || 'N/A'})`);
                count++;
              }
            }
          }
        } else if (firstSession.ejercicios) {
          console.log('  - Ejercicios directos:', firstSession.ejercicios.length);
        }
      }
    }

    // 3. Verificar sesión 47
    console.log('\n\n🎯 Verificando sesión ID 47...');
    const sessionResult = await pool.query(`
      SELECT id, methodology_plan_id, session_status,
             started_at, week_number, day_name
      FROM app.methodology_exercise_sessions
      WHERE id = 47
    `);

    if (sessionResult.rows.length === 0) {
      console.log('❌ Sesión 47 no encontrada');
    } else {
      const session = sessionResult.rows[0];
      console.log('✅ Sesión encontrada:', session);

      // 4. Verificar ejercicios en la sesión
      const exercisesResult = await pool.query(`
        SELECT exercise_order, exercise_name, status
        FROM app.methodology_exercise_progress
        WHERE methodology_session_id = 47
        ORDER BY exercise_order
      `);

      console.log(`\n📊 Ejercicios en sesión 47: ${exercisesResult.rows.length}`);
      if (exercisesResult.rows.length > 0) {
        exercisesResult.rows.forEach(ex => {
          console.log(`  ${ex.exercise_order}. ${ex.exercise_name} - ${ex.status}`);
        });
      } else {
        console.log('❌ No hay ejercicios insertados en methodology_exercise_progress');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugPlan();
