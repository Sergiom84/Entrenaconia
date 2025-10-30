/**
 * adjustWorkoutIntensity.js
 *
 * Función para ajustar la intensidad de los ejercicios cuando hay días consecutivos
 * Reduce el volumen en 20-30% para permitir recuperación adecuada
 */

/**
 * Ajusta la intensidad de una sesión de ejercicios
 * @param {Array} exercises - Array de ejercicios a ajustar
 * @param {Object} options - Opciones de ajuste
 * @returns {Object} - Ejercicios ajustados y metadata
 */
export function adjustWorkoutIntensity(exercises, options = {}) {
  const {
    reductionPercent = 0.25, // 25% de reducción por defecto
    isFirstWeek = true,
    consecutiveDays = 3,
    dayInSequence = 1 // 1, 2, o 3 para saber qué día de los consecutivos es
  } = options;

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { exercises, adjusted: false };
  }

  console.log(`⚡ Ajustando intensidad para días consecutivos - Día ${dayInSequence} de ${consecutiveDays}`);

  const adjustedExercises = exercises.map((exercise, index) => {
    const adjustedExercise = { ...exercise };

    // Ajustar series
    if (exercise.series || exercise.sets) {
      const originalSeries = parseInt(exercise.series || exercise.sets);
      if (originalSeries > 2) {
        // Reducción progresiva: menos reducción el primer día, más el último
        const progressiveReduction = dayInSequence === 1 ? 0.15 :
                                    dayInSequence === 2 ? 0.25 : 0.30;
        const newSeries = Math.max(2, Math.floor(originalSeries * (1 - progressiveReduction)));

        if (exercise.series) adjustedExercise.series = newSeries;
        if (exercise.sets) adjustedExercise.sets = newSeries;
        adjustedExercise.series_original = originalSeries;
        adjustedExercise.adjustment_note = `Series reducidas de ${originalSeries} a ${newSeries}`;
      }
    }

    // Ajustar repeticiones
    if (exercise.repeticiones || exercise.reps) {
      const repsField = exercise.repeticiones || exercise.reps;

      // Si es un rango (ej: "8-12")
      if (typeof repsField === 'string' && repsField.includes('-')) {
        const [min, max] = repsField.split('-').map(n => parseInt(n));
        const newMin = Math.max(4, Math.floor(min * 0.75)); // Reducir 25%
        const newMax = Math.max(newMin + 2, Math.floor(max * 0.75));

        const newReps = `${newMin}-${newMax}`;
        if (exercise.repeticiones) adjustedExercise.repeticiones = newReps;
        if (exercise.reps) adjustedExercise.reps = newReps;
        adjustedExercise.reps_original = repsField;

        if (!adjustedExercise.adjustment_note) {
          adjustedExercise.adjustment_note = `Reps ajustadas de ${repsField} a ${newReps}`;
        } else {
          adjustedExercise.adjustment_note += `, reps de ${repsField} a ${newReps}`;
        }
      }
      // Si es un número fijo
      else if (typeof repsField === 'number' || !isNaN(parseInt(repsField))) {
        const originalReps = parseInt(repsField);
        const newReps = Math.max(4, Math.floor(originalReps * 0.75));

        if (exercise.repeticiones) adjustedExercise.repeticiones = newReps.toString();
        if (exercise.reps) adjustedExercise.reps = newReps;
        adjustedExercise.reps_original = originalReps;
      }
    }

    // Ajustar descanso (aumentar para mejor recuperación)
    if (exercise.descanso || exercise.rest || exercise.descanso_seg) {
      const restField = exercise.descanso_seg || exercise.descanso || exercise.rest;
      const originalRest = parseInt(restField);

      if (!isNaN(originalRest)) {
        // Aumentar descanso en 15-30 segundos según el día
        const extraRest = dayInSequence === 1 ? 15 :
                         dayInSequence === 2 ? 20 : 30;
        const newRest = originalRest + extraRest;

        if (exercise.descanso_seg) adjustedExercise.descanso_seg = newRest;
        if (exercise.descanso) adjustedExercise.descanso = `${newRest}s`;
        if (exercise.rest) adjustedExercise.rest = newRest;
        adjustedExercise.rest_original = originalRest;

        if (!adjustedExercise.adjustment_note) {
          adjustedExercise.adjustment_note = `Descanso aumentado de ${originalRest}s a ${newRest}s`;
        } else {
          adjustedExercise.adjustment_note += `, descanso de ${originalRest}s a ${newRest}s`;
        }
      }
    }

    // Marcar ejercicio como ajustado
    adjustedExercise.intensity_adjusted = true;
    adjustedExercise.adjustment_reason = 'consecutive_days';
    adjustedExercise.adjustment_day = dayInSequence;

    return adjustedExercise;
  });

  // Generar warnings para el usuario
  const warnings = [];

  if (dayInSequence === 1) {
    warnings.push({
      type: 'info',
      title: 'Inicio de días consecutivos',
      message: 'Hoy es el primero de 3 días consecutivos. El volumen ha sido ligeramente reducido para permitir entrenamiento sostenible.',
      icon: '💪'
    });
  } else if (dayInSequence === 2) {
    warnings.push({
      type: 'warning',
      title: 'Día 2 de entrenamiento consecutivo',
      message: 'El volumen ha sido moderadamente reducido. Escucha a tu cuerpo y ajusta si es necesario.',
      icon: '⚡'
    });
  } else if (dayInSequence === 3) {
    warnings.push({
      type: 'important',
      title: 'Último día consecutivo',
      message: 'Volumen significativamente reducido para completar los 3 días. Mañana es día de descanso.',
      icon: '🎯'
    });
  }

  return {
    exercises: adjustedExercises,
    adjusted: true,
    metadata: {
      originalExerciseCount: exercises.length,
      adjustedExerciseCount: adjustedExercises.length,
      reductionApplied: reductionPercent,
      dayInSequence,
      consecutiveDays,
      warnings
    }
  };
}

/**
 * Determina si una sesión necesita ajuste de intensidad
 * @param {Number} weekNumber - Número de semana
 * @param {String} dayAbbrev - Abreviatura del día
 * @param {Object} config - Configuración del plan
 * @returns {Object} - Información sobre si necesita ajuste
 */
export function shouldAdjustIntensity(weekNumber, dayAbbrev, config) {
  // Solo ajustar en la primera semana
  if (weekNumber !== 1) {
    return { shouldAdjust: false };
  }

  // Verificar si hay días consecutivos configurados
  if (!config?.is_consecutive_days) {
    return { shouldAdjust: false };
  }

  // Verificar el patrón de la primera semana
  const firstWeekPattern = config?.first_week_pattern;
  if (!firstWeekPattern) {
    return { shouldAdjust: false };
  }

  // Detectar días consecutivos (Mié-Jue-Vie típicamente)
  const consecutiveDaysPattern = ['Mie', 'Jue', 'Vie'];
  const patternDays = firstWeekPattern.split('-').map(d => d.trim());

  // Verificar si el patrón actual son días consecutivos
  const hasConsecutive = patternDays.every((day, idx) => {
    if (idx === 0) return true;
    const prevDay = patternDays[idx - 1];
    const dayMap = { 'Lun': 1, 'Mar': 2, 'Mie': 3, 'Jue': 4, 'Vie': 5, 'Sab': 6, 'Dom': 0 };
    const prevDayNum = dayMap[prevDay];
    const currDayNum = dayMap[day];

    // Son consecutivos si la diferencia es 1 (o 6 para Dom-Lun)
    return Math.abs(currDayNum - prevDayNum) === 1 || Math.abs(currDayNum - prevDayNum) === 6;
  });

  if (!hasConsecutive) {
    return { shouldAdjust: false };
  }

  // Determinar qué día de la secuencia es
  const dayIndex = patternDays.findIndex(d => d === dayAbbrev);
  if (dayIndex === -1) {
    return { shouldAdjust: false };
  }

  return {
    shouldAdjust: true,
    dayInSequence: dayIndex + 1,
    consecutiveDays: patternDays.length,
    pattern: firstWeekPattern
  };
}

/**
 * Genera una nota explicativa para el usuario sobre el ajuste
 * @param {Object} adjustmentInfo - Información del ajuste
 * @returns {String} - Mensaje para mostrar al usuario
 */
export function generateAdjustmentNote(adjustmentInfo) {
  const { dayInSequence, consecutiveDays } = adjustmentInfo;

  const notes = {
    1: `📌 Día 1 de ${consecutiveDays} consecutivos: Volumen ligeramente reducido para entrenamiento sostenible`,
    2: `⚡ Día 2 de ${consecutiveDays} consecutivos: Volumen moderadamente reducido para permitir recuperación`,
    3: `🎯 Día 3 de ${consecutiveDays} consecutivos: Volumen significativamente reducido. ¡Último día antes del descanso!`
  };

  return notes[dayInSequence] || 'Volumen ajustado para optimizar recuperación';
}

export default {
  adjustWorkoutIntensity,
  shouldAdjustIntensity,
  generateAdjustmentNote
};