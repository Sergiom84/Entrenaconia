/**
 * Servicio de entrenamientos extra para HipertrofiaV2
 * Consolida la lógica de fullbody y single-day
 */

import { DAY_NAMES, MONTH_NAMES } from './constants.js';
import { selectExercises } from './exerciseSelector.js';
import { logger } from './logger.js';

// Número de ejercicios recientes que intentaremos evitar repetir
const DEFAULT_RECENT_EXERCISES_LIMIT = 8;

// Mapeo de categorías permitidas para selección dirigida
const ALLOWED_MUSCLE_GROUPS = {
  Pecho: 'Pecho',
  Espalda: 'Espalda',
  Pierna: 'Piernas',
  Piernas: 'Piernas',
  Hombro: 'Hombro',
  Hombros: 'Hombro',
  Brazos: 'Brazos',
  Core: 'Core',
  Abdominales: 'Core',
  Gluteo: 'Glúteos',
  Gluteos: 'Glúteos',
  Glúteos: 'Glúteos',
  Biceps: 'Bíceps',
  Bíceps: 'Bíceps',
  Triceps: 'Tríceps',
  Tríceps: 'Tríceps'
};

// Variantes de categorías reales en BD para selección por grupo
const CATEGORY_VARIANTS = {
  'Piernas (cuádriceps)': ['Piernas (cuádriceps)', 'Piernas (glúteo/cuádriceps)'],
  'Piernas (isquios)': ['Piernas (isquios)', 'Isquios', 'Glúteo'],
  Hombro: ['Hombro', 'Hombros'],
  'Tríceps': ['Tríceps', 'Triceps']
};

/**
 * Configuración de categorías para Full Body
 */
const FULLBODY_CATEGORIES = [
  { category: 'Pecho', count: 1, priority: 1 },
  { category: 'Espalda', count: 1, priority: 1 },
  { category: 'Piernas (cuádriceps)', count: 1, priority: 1 },
  { category: 'Piernas (isquios)', count: 1, priority: 1 },
  { category: 'Hombro', count: 1, priority: 2 },
  { category: 'Tríceps', count: 1, priority: 2 },
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
export async function generateSingleDayWorkout(dbClient, userId, nivel, isWeekendExtra = false, options = {}) {
  logger.info('🏋️ [SINGLE-DAY] Generando para usuario:', userId, 'Nivel:', nivel, 'Opciones:', options);

  const { selectionMode = 'full_body', focusGroup = null } = options || {};

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

  // Seleccionar ejercicios según patrón:
  // - Principiante: Full Body
  // - Intermedio/Avanzado: Full Body por defecto o grupo focal según selectionMode
  const focusGroupNormalized = normalizeMuscleGroup(focusGroup);
  const targetGroups = selectionMode === 'focus' && focusGroupNormalized
    ? buildFocusGroups(nivel, focusGroupNormalized)
    : buildTargetGroups(nivel);

  let fullBodyExercises = [];

  for (const group of targetGroups) {
    const exercises = await selectExercisesWithHistory(dbClient, {
      userId,
      nivel,
      categoria: group.categoria,
      cantidad: group.count,
      avoidRecent: DEFAULT_RECENT_EXERCISES_LIMIT
    });

    fullBodyExercises.push(
      ...exercises.map((ex) => ({
        ...ex,
        series: nivel === 'Principiante' ? 3 : nivel === 'Intermedio' ? 3 : 4,
        isWeekendExtra
      }))
    );
  }

  // 🛡️ FALLBACK: Garantizar mínimo de ejercicios (6 para Full Body)
  // Si por alguna razón (falta de stock en BD o filtros muy estrictos) tenemos pocos ejercicios,
  // rellenamos con básicos multiarticulares.
  const MIN_EXERCISES = 6;
  if (fullBodyExercises.length < MIN_EXERCISES) {
    logger.warn(`⚠️ [SINGLE-DAY] Solo se encontraron ${fullBodyExercises.length} ejercicios. Aplicando fallback...`);
    
    const needed = MIN_EXERCISES - fullBodyExercises.length;
    const fallbackCategories = ['Pecho', 'Espalda', 'Piernas (cuádriceps)'];
    
    // Evitar repetir nombres que ya tenemos
    const existingNames = fullBodyExercises.map(e => e.nombre);
    
    try {
      // Intentar buscar ejercicios extra de categorías básicas
      for (let i = 0; i < needed; i++) {
        const cat = fallbackCategories[i % fallbackCategories.length];
        const extra = await selectExercises(dbClient, {
          nivel,
          categoria: cat,
          cantidad: 1,
          excludeNames: existingNames
        });
        
        if (extra && extra.length > 0) {
          fullBodyExercises.push({
            ...extra[0],
            series: 3,
            isWeekendExtra,
            notas: 'Ejercicio añadido por fallback para completar volumen'
          });
          existingNames.push(extra[0].nombre);
        }
      }
    } catch (err) {
      logger.error('❌ Error en fallback de ejercicios:', err);
    }
  }

  // Fallback: asegurar un mínimo de 7 ejercicios en sesiones Full Body
  if (selectionMode === 'full_body' && fullBodyExercises.length < 7) {
    const minExercises = 7;
    const extraCategories = [
      'Pecho',
      'Espalda',
      'Piernas (cuádriceps)',
      'Piernas (isquios)',
      'Hombro',
      'Tríceps',
      'Core'
    ];

    for (const extraCat of extraCategories) {
      if (fullBodyExercises.length >= minExercises) break;
      const needed = minExercises - fullBodyExercises.length;
      const extra = await selectExercisesWithHistory(dbClient, {
        userId,
        nivel,
        categoria: extraCat,
        cantidad: needed,
        avoidRecent: DEFAULT_RECENT_EXERCISES_LIMIT
      });
      if (extra && extra.length > 0) {
        fullBodyExercises = [...fullBodyExercises, ...extra];
      }
    }
  }

  // Barajar ejercicios globalmente para variar el orden presentado
  const shuffledExercises = shuffleArray(fullBodyExercises).map((ex, idx) => ({
    ...ex,
    orden: idx + 1
  }));

  const currentDate = new Date();
  const isFocusSession = selectionMode === 'focus' && !!focusGroupNormalized;
  const sessionLabel = isFocusSession
    ? `${focusGroupNormalized} - Sesión Especial`
    : 'Full Body Extra - Fin de Semana';
  const planLabel = isFocusSession
    ? `Sesión de ${focusGroupNormalized} - Fin de Semana`
    : 'Entrenamiento Extra Fin de Semana';

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
    planLabel,
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
    sessionLabel,
    DAY_NAMES[currentDate.getDay()],
    currentDate,
    'weekend-extra',
    shuffledExercises.length,
    'pending',
    currentDate,
    currentDate.getDate(),
    MONTH_NAMES[currentDate.getMonth()],
    currentDate.getMonth() + 1,
    currentDate.getFullYear(),
    JSON.stringify(shuffledExercises),
    JSON.stringify({
      nivel,
      generated_at: currentDate,
      type: 'single-day-workout',
      weekend_extra: isWeekendExtra,
      selection_mode: selectionMode,
      focus_group: focusGroupNormalized
    })
  ]);

  const sessionId = sessionResult.rows[0].id;

  // Crear tracking para ejercicios
  for (const exercise of shuffledExercises) {
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
      exercises_count: shuffledExercises.length,
      exercises: shuffledExercises
    }
  };
}

/**
 * Construye el patrón de categorías a seleccionar según nivel
 */
function buildTargetGroups(nivel) {
  // Patrón base Full Body (primer sábado/domingos para principiantes)
  // Mapeo corregido a nombres reales de la BD
  const baseGroups = [
    { categoria: 'Pecho', count: 1 },
    { categoria: 'Espalda', count: 1 },
    // Dividimos Piernas en Anterior y Posterior para balancear
    { categoria: 'Piernas (cuádriceps)', count: 1 },
    { categoria: 'Piernas (isquios)', count: 1 }, 
    { categoria: 'Hombro', count: 1 }, // Corregido de 'Hombros' a 'Hombro'
    { categoria: 'Core', count: 1 }
  ];

  if (nivel === 'Avanzado') {
    return [...baseGroups, { categoria: 'Bíceps', count: 1 }, { categoria: 'Tríceps', count: 1 }];
  }

  return baseGroups;
}

/**
 * Construye patrón focalizado en un grupo muscular concreto
 */
function buildFocusGroups(nivel, focusGroup) {
  const baseCount = nivel === 'Avanzado' ? 5 : 4;
  return [{ categoria: focusGroup, count: baseCount }];
}

/**
 * Normaliza el nombre de grupo muscular permitido
 */
function normalizeMuscleGroup(group) {
  if (!group) return null;
  return ALLOWED_MUSCLE_GROUPS[group] || ALLOWED_MUSCLE_GROUPS[group?.trim()?.replace(/\s+/g, ' ')] || group;
}

/**
 * Selecciona ejercicios evitando repeticiones recientes
 */
async function selectExercisesWithHistory(dbClient, { userId, nivel, categoria, cantidad, avoidRecent = DEFAULT_RECENT_EXERCISES_LIMIT }) {
  // Obtener ejercicios recientes del usuario (por nombre) para intentar evitarlos
  const recentQuery = await dbClient.query(
    `
      SELECT DISTINCT ON (exercise_name) exercise_name
      FROM app.methodology_exercise_history_complete
      WHERE user_id = $1
        AND exercise_name IS NOT NULL
      ORDER BY exercise_name, completed_at DESC
      LIMIT $2
    `,
    [userId, avoidRecent]
  );
  const recentNames = recentQuery.rows.map((row) => row.exercise_name).filter(Boolean);

  const variantCategories = CATEGORY_VARIANTS[categoria] || [categoria];
  const selected = [];

  for (const cat of variantCategories) {
    if (selected.length >= cantidad) break;
    const remaining = cantidad - selected.length;

    // Intento principal evitando ejercicios recientes y ya seleccionados
    const primary = await selectExercises(dbClient, {
      nivel,
      categoria: cat,
      cantidad: remaining,
      excludeNames: [...recentNames, ...selected.map((e) => e.nombre)]
    }).catch(() => []);

    if (primary.length > 0) {
      selected.push(...primary);
    }

    if (selected.length >= cantidad) break;

    // Segundo intento sin exclusiones si aún faltan
    const remainingAfterPrimary = cantidad - selected.length;
    if (remainingAfterPrimary > 0) {
      const fallback = await selectExercises(dbClient, {
        nivel,
        categoria: cat,
        cantidad: remainingAfterPrimary
      }).catch(() => []);

      if (fallback.length > 0) {
        selected.push(...fallback);
      }
    }
  }

  if (selected.length === 0) {
    return [];
  }

  return shuffleArray(selected).slice(0, cantidad);
}

/**
 * Utilidad simple para barajar arrays
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
