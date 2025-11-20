/**
 * Servicio de calendario para HipertrofiaV2
 * Maneja la generación de calendarios cíclicos D1-D5
 */

import { DAY_NAMES, CYCLE_LENGTH } from './constants.js';
import { logger } from './logger.js';

/**
 * Construye calendario de entrenamiento cíclico D1-D5
 * @param {object} config - Configuración del calendario
 * @param {Date|string} config.startDate - Fecha de inicio
 * @param {boolean} config.includeSaturday - Si se permite usar sábado (solo primer ciclo si empieza jueves)
 * @param {number} config.totalWeeks - Semanas totales del plan
 * @param {number} [config.cycleLength=5] - Longitud del ciclo (default 5)
 * @returns {object} Calendario con días de entrenamiento y mapeo dinámico
 */
export function buildTrainingCalendar(config) {
  const {
    startDate,
    includeSaturday = false,
    totalWeeks,
    cycleLength = CYCLE_LENGTH
  } = config;

  const sessionsNeeded = totalWeeks * cycleLength;
  const startDateObj = new Date(startDate);
  const startDay = startDateObj.getDay();
  const allowOneSaturday = includeSaturday && startDay === 4; // Solo si empieza jueves

  const trainingDays = [];
  let currentDate = new Date(startDateObj);
  let usedSaturday = false;

  while (trainingDays.length < sessionsNeeded) {
    const dayOfWeek = currentDate.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const canUseFirstSaturday = allowOneSaturday && !usedSaturday && dayOfWeek === 6;

    if (isWeekday || canUseFirstSaturday) {
      trainingDays.push({
        date: new Date(currentDate),
        dayName: DAY_NAMES[dayOfWeek],
        sessionNumber: trainingDays.length + 1,
        cycleDay: ((trainingDays.length) % cycleLength) + 1
      });

      if (canUseFirstSaturday) {
        usedSaturday = true;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Mapeo dinámico D1-D5 con los primeros días válidos
  const dynamicDayMapping = {};
  for (let i = 0; i < cycleLength; i++) {
    if (trainingDays[i]) {
      dynamicDayMapping[`D${i + 1}`] = trainingDays[i].dayName;
    }
  }

  logger.info('🔄 [CALENDAR] Mapeo dinámico D1-D5:', dynamicDayMapping);
  logger.info(`📅 [CALENDAR] Total sesiones: ${trainingDays.length}`);

  return {
    trainingDays,
    dynamicDayMapping,
    startDate: startDateObj,
    usedSaturday
  };
}

/**
 * Genera calendario por defecto (Lun-Vie) cuando no hay fecha de inicio
 * @param {number} [cycleLength=5] - Longitud del ciclo
 * @returns {object} Mapeo por defecto
 */
export function getDefaultDayMapping(cycleLength = CYCLE_LENGTH) {
  return {
    'D1': 'Lunes',
    'D2': 'Martes',
    'D3': 'Miércoles',
    'D4': 'Jueves',
    'D5': 'Viernes'
  };
}

/**
 * Calcula el primer día válido de entrenamiento según fecha de inicio
 * @param {Date|string} startDate - Fecha de inicio
 * @param {string} [distributionOption] - Opción de distribución ('saturdays', etc.)
 * @returns {object} Información del primer día
 */
export function calculateFirstTrainingDay(startDate, distributionOption) {
  const date = new Date(startDate);
  const dayOfWeek = date.getDay();
  const dayName = DAY_NAMES[dayOfWeek];
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isSaturday = dayOfWeek === 6;
  const allowSaturday = distributionOption === 'saturdays';

  return {
    date,
    dayOfWeek,
    dayName,
    isWeekend,
    isSaturday,
    allowSaturday,
    isValidStartDay: !isWeekend || (isSaturday && allowSaturday)
  };
}
