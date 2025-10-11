/**
 * Utilidades para mapeo de sesiones en el calendario
 *
 * PROBLEMA:
 * Las rutinas generadas por IA vienen con días específicos (Lunes, Miércoles, Viernes)
 * pero cuando el usuario genera una rutina en cualquier día (ej: sábado),
 * necesitamos mapear las sesiones desde ese día de inicio.
 */

/**
 * Mapea las sesiones de una semana a los días del calendario
 * @param {Array} sesiones - Array de sesiones de la semana
 * @param {Date} weekStartDate - Fecha de inicio de la semana en el calendario
 * @param {Date} planStartDate - Fecha de inicio del plan completo
 * @param {number} weekIndex - Índice de la semana (0-based)
 * @returns {Array} Array de 7 elementos, uno por cada día de la semana
 */
export function mapSessionsToWeekDays(sesiones, weekStartDate, planStartDate, weekIndex) {
  const weekDays = [];

  // Crear array de 7 días
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayDate = new Date(weekStartDate);
    dayDate.setDate(weekStartDate.getDate() + dayIndex);
    dayDate.setHours(0, 0, 0, 0);

    weekDays.push({
      date: dayDate,
      dayIndex,
      session: null
    });
  }

  if (!sesiones || sesiones.length === 0) {
    return weekDays;
  }

  // Detectar formato de las sesiones
  const firstSessionDay = sesiones[0]?.dia?.toLowerCase();
  const usesWeekDayNames = firstSessionDay && isWeekDayName(firstSessionDay);

  if (usesWeekDayNames) {
    // MODO LEGACY: Mapear por nombre del día
    mapByDayNames(weekDays, sesiones);
  } else {
    // MODO NUEVO: Distribuir secuencialmente
    distributeSessionsEvenly(weekDays, sesiones, weekIndex);
  }

  return weekDays;
}

/**
 * Verifica si un string es un nombre de día de la semana
 */
function isWeekDayName(str) {
  const weekDayNames = [
    'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
    'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom', 'mie', 'sab'
  ];
  return weekDayNames.includes(str.toLowerCase());
}

/**
 * Mapea sesiones por nombre del día (modo legacy)
 */
function mapByDayNames(weekDays, sesiones) {
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dayNamesShort = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  weekDays.forEach((day, index) => {
    const dayOfWeek = day.date.getDay();
    const dayName = dayNames[dayOfWeek];
    const dayNameShort = dayNamesShort[dayOfWeek];

    // Buscar sesión para este día
    const session = sesiones.find(ses => {
      const sessionDay = ses.dia?.toLowerCase();
      return sessionDay === dayName ||
             sessionDay === dayNameShort ||
             sessionDay === dayNameShort.replace('é', 'e') ||
             (sessionDay === 'mie' && dayName === 'miércoles') ||
             (sessionDay === 'sab' && dayName === 'sábado');
    });

    if (session) {
      day.session = session;
    }
  });
}

/**
 * Distribuye las sesiones uniformemente en la semana (modo nuevo)
 */
function distributeSessionsEvenly(weekDays, sesiones, weekIndex) {
  const sessionsPerWeek = sesiones.length;

  // Calcular distribución óptima
  if (sessionsPerWeek === 1) {
    // Una sesión: en el primer día
    weekDays[0].session = sesiones[0];
  } else if (sessionsPerWeek === 2) {
    // Dos sesiones: días 0 y 3 (ej: lunes y jueves)
    weekDays[0].session = sesiones[0];
    weekDays[3].session = sesiones[1];
  } else if (sessionsPerWeek === 3) {
    // Tres sesiones: días 0, 2 y 4 (ej: lunes, miércoles, viernes)
    weekDays[0].session = sesiones[0];
    weekDays[2].session = sesiones[1];
    weekDays[4].session = sesiones[2];
  } else if (sessionsPerWeek === 4) {
    // Cuatro sesiones: días 0, 2, 4, 6
    weekDays[0].session = sesiones[0];
    weekDays[2].session = sesiones[1];
    weekDays[4].session = sesiones[2];
    weekDays[6].session = sesiones[3];
  } else if (sessionsPerWeek === 5) {
    // Cinco sesiones: días 0, 1, 3, 4, 6
    weekDays[0].session = sesiones[0];
    weekDays[1].session = sesiones[1];
    weekDays[3].session = sesiones[2];
    weekDays[4].session = sesiones[3];
    weekDays[6].session = sesiones[4];
  } else if (sessionsPerWeek === 6) {
    // Seis sesiones: todos los días excepto uno (descanso en domingo)
    for (let i = 0; i < 6; i++) {
      weekDays[i].session = sesiones[i];
    }
  } else if (sessionsPerWeek === 7) {
    // Siete sesiones: todos los días
    for (let i = 0; i < 7; i++) {
      weekDays[i].session = sesiones[i];
    }
  } else {
    // Más de 7 o casos especiales: distribuir proporcionalmente
    const spacing = Math.floor(7 / sessionsPerWeek);
    for (let i = 0; i < Math.min(sessionsPerWeek, 7); i++) {
      const dayIndex = Math.min(i * spacing, 6);
      weekDays[dayIndex].session = sesiones[i];
    }
  }
}

/**
 * Obtiene el patrón de distribución recomendado para N sesiones por semana
 */
export function getRecommendedDistribution(sessionsPerWeek) {
  const patterns = {
    1: [0], // Solo un día
    2: [0, 3], // Lunes y Jueves
    3: [0, 2, 4], // Lunes, Miércoles, Viernes
    4: [0, 2, 4, 6], // Lunes, Miércoles, Viernes, Domingo
    5: [0, 1, 3, 4, 6], // Lunes, Martes, Jueves, Viernes, Domingo
    6: [0, 1, 2, 3, 4, 5], // Todos excepto Domingo
    7: [0, 1, 2, 3, 4, 5, 6] // Todos los días
  };

  return patterns[sessionsPerWeek] || patterns[3]; // Default a 3 días
}

/**
 * Convierte un patrón de días a nombres de días comenzando desde una fecha
 */
export function patternToDayNames(pattern, startDate) {
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const result = [];

  for (const dayOffset of pattern) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayOffset);
    const dayOfWeek = date.getDay();
    result.push({
      offset: dayOffset,
      name: dayNames[dayOfWeek],
      date: date
    });
  }

  return result;
}