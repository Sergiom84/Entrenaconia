/**
 * Servicio principal de generación de planes D1-D5 para HipertrofiaV2
 * Consolida toda la lógica del motor MindFeed
 */

import { CYCLE_LENGTH, DEFAULT_WEEKS_BY_LEVEL, WEEK_0_CONFIG } from './constants.js';
import { buildTrainingCalendar, getDefaultDayMapping } from './calendarService.js';
import { loadSessionsConfig, generateSessionExercises } from './sessionService.js';
import { logger } from './logger.js';

/**
 * Genera plan completo D1-D5 con motor MindFeed
 * @param {object} dbClient - Cliente de base de datos (transaction)
 * @param {object} config - Configuración del plan
 * @returns {Promise<object>} Plan generado con ID
 */
export async function generateD1D5Plan(dbClient, config) {
  const {
    userId,
    nivel = 'Principiante',
    totalWeeks,
    startConfig,
    includeWeek0 = true
  } = config;

  const defaultWeeks = DEFAULT_WEEKS_BY_LEVEL[nivel] || 10;
  const actualTotalWeeks = totalWeeks ?? defaultWeeks;

  logger.info('🏋️ [MINDFEED] Generando plan D1-D5');
  logger.info(`📅 Nivel: ${nivel}, Semanas: ${actualTotalWeeks}, Week 0: ${includeWeek0}`);

  // Obtener información del usuario
  const userResult = await dbClient.query(
    `SELECT sexo FROM app.users WHERE id = $1`,
    [userId]
  );
  const userSex = userResult.rows[0]?.sexo || 'male';
  const isFemale = ['female', 'f', 'mujer', 'femenino'].includes(userSex.toLowerCase());

  logger.debug('👤 Sexo:', userSex, 'Ajuste femenino:', isFemale);

  // Obtener prioridad muscular activa
  const priorityResult = await dbClient.query(
    `SELECT priority_muscle FROM app.hipertrofia_v2_state WHERE user_id = $1`,
    [userId]
  );
  const priorityMuscle = priorityResult.rows[0]?.priority_muscle || null;

  if (priorityMuscle) {
    logger.info(`🎯 [PRIORIDAD] Músculo prioritario: ${priorityMuscle}`);
  }

  // Calcular calendario cíclico
  let trainingDays = null;
  let dynamicDayMapping = {};

  if (startConfig?.startDate) {
    const calendar = buildTrainingCalendar({
      startDate: startConfig.startDate,
      includeSaturday: startConfig.distributionOption === 'saturdays' || startConfig.includeSaturdays,
      totalWeeks: actualTotalWeeks,
      cycleLength: CYCLE_LENGTH
    });

    trainingDays = calendar.trainingDays;
    dynamicDayMapping = calendar.dynamicDayMapping;

    logger.info(`📅 Calendario generado: ${trainingDays.length} sesiones`);
  } else {
    dynamicDayMapping = getDefaultDayMapping(CYCLE_LENGTH);
    logger.warn('⚠️ Sin fecha de inicio, usando mapeo por defecto');
  }

  // Cargar configuración de sesiones D1-D5
  const sessionsConfig = await loadSessionsConfig(dbClient);

  // Generar ejercicios para cada sesión del ciclo
  const sessionsWithExercises = [];

  for (const sessionConfig of sessionsConfig) {
    const session = await generateSessionExercises(
      dbClient,
      sessionConfig,
      nivel,
      isFemale,
      priorityMuscle
    );

    sessionsWithExercises.push(session);
    logger.debug(`  ✅ D${session.cycle_day}: ${session.exercises.length} ejercicios`);
  }

  // Crear plantilla de sesiones
  const templateByCycleDay = new Map(
    sessionsWithExercises
      .sort((a, b) => a.cycle_day - b.cycle_day)
      .map(session => [
        session.cycle_day,
        {
          nombre: session.session_name,
          ciclo_dia: session.cycle_day,
          descripcion: session.description,
          coach_tip: session.coach_tip,
          intensidad_porcentaje: session.intensity_percentage,
          es_dia_pesado: session.is_heavy_day,
          grupos_musculares: session.muscle_groups,
          ejercicios: session.exercises.map(ex => ({ ...ex }))
        }
      ])
  );

  // Generar semanas
  const semanas = [];

  // Semana 0 de calibración
  if (includeWeek0) {
    const semana0Sessions = Array.from({ length: CYCLE_LENGTH }, (_, idx) => {
      const cycleDay = idx + 1;
      const template = templateByCycleDay.get(cycleDay);
      const actualDayName = trainingDays?.[idx]?.dayName || dynamicDayMapping[`D${cycleDay}`] || `D${cycleDay}`;

      return {
        ...JSON.parse(JSON.stringify(template)),
        dia: actualDayName,
        fecha: trainingDays?.[idx]?.date ? trainingDays[idx].date.toISOString().split('T')[0] : null,
        orden: idx + 1,
        id: `W0-D${cycleDay}`,
        intensidad_porcentaje: WEEK_0_CONFIG.intensity,
        es_calibracion: true,
        coach_tip: 'Semana de calibración: Enfócate en la técnica correcta y el control del movimiento.',
        ejercicios: template.ejercicios.map(ex => ({
          ...ex,
          intensidad_porcentaje: WEEK_0_CONFIG.intensity,
          rir_target: WEEK_0_CONFIG.rir_target,
          notas: `${ex.notas || ''} - ${WEEK_0_CONFIG.note}`
        }))
      };
    });

    semanas.push({
      numero: 0,
      tipo: 'calibracion',
      descripcion: 'Semana de calibración técnica y ajuste de cargas',
      sesiones: semana0Sessions,
      is_week_zero: true,
      no_progression: true,
      objetivo: 'Establecer técnica base y calibrar cargas iniciales (70% 1RM)'
    });

    logger.info('✅ [WEEK 0] Semana de calibración añadida');
  }

  // Semanas regulares
  for (let weekIndex = 0; weekIndex < actualTotalWeeks; weekIndex++) {
    const weekSessions = Array.from({ length: CYCLE_LENGTH }, (_, idx) => {
      const sessionNumber = weekIndex * CYCLE_LENGTH + idx;
      const cycleDay = (sessionNumber % CYCLE_LENGTH) + 1;
      const template = templateByCycleDay.get(cycleDay);
      const calendarDay = startConfig?.startDate && trainingDays
        ? trainingDays[sessionNumber]
        : null;

      const actualDayName = calendarDay?.dayName || dynamicDayMapping[`D${cycleDay}`] || `D${cycleDay}`;

      return {
        ...JSON.parse(JSON.stringify(template)),
        dia: actualDayName,
        fecha: calendarDay?.date ? calendarDay.date.toISOString().split('T')[0] : null,
        orden: idx + 1,
        id: `W${weekIndex + 1}-D${cycleDay}`
      };
    });

    semanas.push({
      numero: weekIndex + 1,
      tipo: 'entrenamiento',
      sesiones: weekSessions
    });
  }

  // Crear estructura del plan
  const planData = {
    metodologia: 'HipertrofiaV2_MindFeed',
    version: 'MindFeed_v2.0',
    nivel,
    ciclo_type: 'D1-D5',
    total_weeks: actualTotalWeeks,
    has_week_0: includeWeek0,
    duracion_total_semanas: includeWeek0 ? actualTotalWeeks + 1 : actualTotalWeeks,
    frecuencia_semanal: CYCLE_LENGTH,
    fecha_inicio: new Date().toISOString(),
    sessions: sessionsWithExercises,
    semanas,
    configuracion: {
      progression_type: 'microcycle',
      progression_increment: 2.5,
      deload_trigger: 6,
      rir_target: '2-3',
      tracking_enabled: true,
      week_0_intensity: WEEK_0_CONFIG.intensity,
      duration_weeks: actualTotalWeeks,
      sex_adjusted: isFemale,
      rest_adjustment_factor: isFemale ? 0.85 : 1.0
    }
  };

  // Guardar plan en DB
  const planResult = await dbClient.query(`
    INSERT INTO app.methodology_plans (
      user_id, methodology_type, plan_data, generation_mode, status, created_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING id
  `, [userId, 'HipertrofiaV2_MindFeed', JSON.stringify(planData), 'manual', 'draft']);

  const methodologyPlanId = planResult.rows[0].id;

  // Crear estado inicial
  await dbClient.query(`
    INSERT INTO app.hipertrofia_v2_state (
      user_id,
      methodology_plan_id,
      cycle_day,
      microcycles_completed,
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      methodology_plan_id = EXCLUDED.methodology_plan_id,
      cycle_day = 1,
      microcycles_completed = 0,
      deload_active = false,
      updated_at = NOW()
  `, [userId, methodologyPlanId, 1, 0]);

  // Guardar configuración de inicio
  if (startConfig) {
    await savePlanStartConfig(dbClient, methodologyPlanId, userId, startConfig, trainingDays, CYCLE_LENGTH);
  }

  logger.info(`✅ [MINDFEED] Plan generado con ID: ${methodologyPlanId}`);

  return {
    methodologyPlanId,
    planId: methodologyPlanId,
    plan: planData
  };
}

/**
 * Guarda configuración de inicio del plan
 */
async function savePlanStartConfig(dbClient, methodologyPlanId, userId, startConfig, trainingDays, cycleLength) {
  logger.debug('💾 Guardando configuración de inicio...');

  const startDate = startConfig.startDate === 'today'
    ? new Date()
    : startConfig.startDate === 'next_monday'
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
        return d;
      })()
    : new Date(startConfig.startDate);

  const includeSaturdays = startConfig.includeSaturdays || false;
  const firstWeekPattern = (trainingDays && trainingDays.length >= cycleLength)
    ? trainingDays.slice(0, cycleLength).map(d => d.dayName).join('-')
    : 'Lun-Mar-Mie-Jue-Vie';

  await dbClient.query(`
    INSERT INTO app.plan_start_config (
      methodology_plan_id,
      user_id,
      start_day_of_week,
      start_date,
      first_week_pattern,
      include_saturdays,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (methodology_plan_id) DO UPDATE SET
      start_day_of_week = EXCLUDED.start_day_of_week,
      start_date = EXCLUDED.start_date,
      first_week_pattern = EXCLUDED.first_week_pattern,
      include_saturdays = EXCLUDED.include_saturdays,
      updated_at = NOW()
  `, [
    methodologyPlanId,
    userId,
    startDate.getDay(),
    startDate.toISOString().split('T')[0],
    firstWeekPattern,
    includeSaturdays
  ]);

  logger.info('✅ Configuración de inicio guardada');
}
