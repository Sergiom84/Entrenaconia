/**
 * Servicio de entrenamientos extra para HipertrofiaV2
 * Consolida la lógica de fullbody y single-day
 */

import { DAY_NAMES, MONTH_NAMES } from './constants.js';
import { selectExercises } from './exerciseSelector.js';
import { logger } from './logger.js';

/**
 * Configuración de categorías para Full Body
 */
const FULLBODY_CATEGORIES = [
  { category: 'Pecho', count: 1, priority: 1 },
  { category: 'Espalda', count: 1, priority: 1 },
  { category: 'Piernas (cuádriceps)', count: 1, priority: 1 },
  { category: 'Hombro', count: 1, priority: 2 },
  { category: 'Core', count: 1, priority: 3 }
];

/**
 * Genera rutina Full Body para entrenamientos de fin de semana
 * @param {object} dbClient - Cliente de base de datos
 * @param {number} userId - ID del usuario
 * @param {string} nivel - Nivel del usuario
 * @returns {Promise<object>} Plan generado con ID y ejercicios
 */
export async function generateFullBodyWorkout(dbClient, userId, nivel) {
  logger.info('💪 [FULLBODY] Generando rutina para usuario:', userId, 'Nivel:', nivel);

  const fullBodyExercises = [];

  // Configurar categorías según nivel
  const categories = [...FULLBODY_CATEGORIES];
  if (nivel === 'Avanzado') {
    categories.push(
      { category: 'Bíceps', count: 1, priority: 4 },
      { category: 'Tríceps', count: 1, priority: 4 }
    );
  }

  // Seleccionar ejercicios
  for (const config of categories) {
    const exercises = await selectExercises(dbClient, {
      nivel,
      categoria: config.category,
      cantidad: config.count
    });

    if (exercises.length > 0) {
      fullBodyExercises.push(...exercises.map(ex => ({
        ...ex,
        id: ex.exercise_id,
        series_reps_objetivo: nivel === 'Principiante' ? '2-3x10-12' : '3x8-10',
        descanso_seg: nivel === 'Principiante' ? 60 : 75,
        notas_fullbody: 'Ejercicio adaptado para rutina Full Body de fin de semana'
      })));
    }
  }

  logger.info(`📊 [FULLBODY] Seleccionados ${fullBodyExercises.length} ejercicios`);

  // Crear plan
  const planResult = await dbClient.query(`
    INSERT INTO app.methodology_plans (
      user_id,
      methodology_type,
      plan_name,
      training_days_per_week,
      total_weeks,
      status,
      created_at,
      updated_at,
      plan_data,
      plan_description
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8)
    RETURNING id, methodology_type, plan_name
  `, [
    userId,
    'full-body',
    `Full Body ${nivel} - Fin de Semana`,
    1,
    1,
    'active',
    JSON.stringify({
      exercises: fullBodyExercises,
      nivel,
      type: 'weekend_fullbody',
      generated_for: 'weekend_training',
      notes: 'Rutina Full Body diseñada para entrenamientos de fin de semana'
    }),
    'Rutina Full Body completa para entrenar todo el cuerpo en una sesión.'
  ]);

  const methodologyPlanId = planResult.rows[0].id;

  // Crear sesión
  const sessionData = {
    dia: 1,
    sesion_numero: 1,
    ejercicios: fullBodyExercises.map((exercise, index) => ({
      orden: index + 1,
      id: exercise.id,
      exercise_id: exercise.id,
      nombre: exercise.nombre,
      categoria: exercise.categoria,
      series: parseInt(exercise.series_reps_objetivo.split('x')[0].split('-')[0]),
      reps_objetivo: exercise.series_reps_objetivo.split('x')[1] || '10-12',
      descanso_seg: exercise.descanso_seg,
      notas: exercise.notas_fullbody || exercise.notas,
      patron: exercise.patron
    }))
  };

  await dbClient.query(`
    INSERT INTO app.methodology_exercise_sessions (
      methodology_plan_id,
      session_number,
      session_name,
      exercises,
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
  `, [methodologyPlanId, 1, 'Full Body - Sesión Completa', JSON.stringify(sessionData.ejercicios)]);

  // Crear entrada en workout_schedule
  await dbClient.query(`
    INSERT INTO app.workout_schedule (
      user_id,
      methodology_plan_id,
      scheduled_date,
      week_number,
      day_in_week,
      session_number,
      completed,
      created_at
    ) VALUES ($1, $2, CURRENT_DATE, 1, 1, 1, false, NOW())
  `, [userId, methodologyPlanId]);

  // Guardar configuración
  await savePlanStartConfig(dbClient, methodologyPlanId);

  return {
    methodologyPlanId,
    plan: {
      id: methodologyPlanId,
      name: planResult.rows[0].plan_name,
      type: 'full-body',
      exercises_count: fullBodyExercises.length,
      nivel,
      exercises: fullBodyExercises
    }
  };
}

/**
 * Genera entrenamiento de día único
 * @param {object} dbClient - Cliente de base de datos
 * @param {number} userId - ID del usuario
 * @param {string} nivel - Nivel del usuario
 * @param {boolean} isWeekendExtra - Si es entrenamiento extra de fin de semana
 * @returns {Promise<object>} Sesión generada
 */
export async function generateSingleDayWorkout(dbClient, userId, nivel, isWeekendExtra = false) {
  logger.info('🏋️ [SINGLE-DAY] Generando para usuario:', userId, 'Nivel:', nivel);

  // Mapear nivel
  const nivelMapping = {
    'Principiante': 'basico',
    'Intermedio': 'intermedio',
    'Avanzado': 'avanzado',
    'basico': 'basico',
    'intermedio': 'intermedio',
    'avanzado': 'avanzado'
  };
  const nivelNormalized = nivelMapping[nivel] || 'basico';

  // Seleccionar ejercicios Full Body
  const targetGroups = [
    { categoria: 'Pecho', count: 1 },
    { categoria: 'Espalda', count: 1 },
    { categoria: 'Piernas', count: 2 },
    { categoria: 'Hombros', count: 1 },
    { categoria: 'Core', count: 1 }
  ];

  const fullBodyExercises = [];

  for (const group of targetGroups) {
    const exercises = await selectExercises(dbClient, {
      nivel,
      categoria: group.categoria,
      cantidad: group.count
    });

    fullBodyExercises.push(...exercises.map((ex, idx) => ({
      ...ex,
      orden: fullBodyExercises.length + idx + 1,
      series: nivel === 'Principiante' ? 3 : nivel === 'Intermedio' ? 3 : 4,
      isWeekendExtra
    })));
  }

  const currentDate = new Date();

  // Crear plan temporal
  const planResult = await dbClient.query(`
    INSERT INTO app.methodology_plans (
      user_id,
      methodology_type,
      nivel,
      plan_name,
      plan_start_date,
      status,
      total_days,
      generation_mode,
      version_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    userId,
    'hipertrofia',
    nivelNormalized,
    'Entrenamiento Extra Fin de Semana',
    currentDate,
    'completed',
    1,
    'manual',
    'weekend-extra'
  ]);

  const planId = planResult.rows[0].id;

  // Crear sesión
  const sessionResult = await dbClient.query(`
    INSERT INTO app.methodology_exercise_sessions (
      user_id,
      methodology_plan_id,
      methodology_type,
      methodology_level,
      session_name,
      day_name,
      session_date,
      session_type,
      total_exercises,
      session_status,
      started_at,
      day_of_month,
      month_name,
      month_number,
      year_number,
      exercises_data,
      session_metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id
  `, [
    userId,
    planId,
    'hipertrofia',
    nivel,
    'Full Body Extra - Fin de Semana',
    DAY_NAMES[currentDate.getDay()],
    currentDate,
    'weekend-extra',
    fullBodyExercises.length,
    'pending',
    currentDate,
    currentDate.getDate(),
    MONTH_NAMES[currentDate.getMonth()],
    currentDate.getMonth() + 1,
    currentDate.getFullYear(),
    JSON.stringify(fullBodyExercises),
    JSON.stringify({
      nivel,
      generated_at: currentDate,
      type: 'single-day-workout',
      weekend_extra: isWeekendExtra
    })
  ]);

  const sessionId = sessionResult.rows[0].id;

  // Crear tracking para ejercicios
  for (const exercise of fullBodyExercises) {
    await dbClient.query(`
      INSERT INTO app.exercise_session_tracking (
        methodology_session_id,
        user_id,
        exercise_name,
        exercise_order,
        exercise_data,
        status,
        planned_sets,
        planned_reps,
        planned_rest_seconds,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      sessionId,
      userId,
      exercise.nombre,
      exercise.orden,
      JSON.stringify(exercise),
      'pending',
      exercise.series,
      exercise.series_reps_objetivo || '8-12',
      exercise.descanso_seg || 90,
      currentDate
    ]);
  }

  logger.info('✅ [SINGLE-DAY] Entrenamiento generado exitosamente');

  return {
    sessionId,
    workout: {
      id: sessionId,
      type: 'full-body-single',
      nivel,
      exercises_count: fullBodyExercises.length,
      exercises: fullBodyExercises
    }
  };
}

/**
 * Guarda configuración de inicio del plan
 * @param {object} dbClient - Cliente de base de datos
 * @param {number} methodologyPlanId - ID del plan
 */
async function savePlanStartConfig(dbClient, methodologyPlanId) {
  const currentDayOfWeek = new Date().getDay();

  await dbClient.query(`
    INSERT INTO app.plan_start_config (
      methodology_plan_id,
      start_day_of_week,
      is_consecutive_days,
      intensity_adjusted,
      first_week_pattern,
      regular_pattern,
      day_mappings,
      warnings,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (methodology_plan_id) DO UPDATE SET
      warnings = $8,
      first_week_pattern = $5
  `, [
    methodologyPlanId,
    currentDayOfWeek,
    false,
    false,
    'Full Body',
    'Full Body',
    JSON.stringify({ 'Hoy': 'sesion_completa' }),
    JSON.stringify([
      {
        type: 'info',
        icon: '💪',
        title: 'Rutina Full Body',
        message: 'Esta es una rutina especial de cuerpo completo para el fin de semana.'
      }
    ])
  ]);
}
