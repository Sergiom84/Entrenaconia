/**
 * Configuración de Niveles para Powerlifting
 * Basado en principios de fuerza máxima y periodización
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 1.0.0
 */

// Constantes de configuración
const LEVEL_ORDER = ['novato', 'intermedio', 'avanzado', 'elite'];

const TRAINING_CONSTANTS = {
  WARMUP_DURATION: {
    novato: 15,
    intermedio: 20,
    avanzado: 25,
    elite: 30
  },
  COOLDOWN_DURATION: 10,
  INTENSITY_RANGE: {
    novato: '60-75% 1RM',
    intermedio: '70-85% 1RM',
    avanzado: '75-90% 1RM',
    elite: '80-95% 1RM'
  },
  MAX_TRAINING_DAYS: {
    novato: 3,
    intermedio: 4,
    avanzado: 4,
    elite: 5
  },
  REST_BETWEEN_SETS: {
    novato: 180,
    intermedio: 240,
    avanzado: 300,
    elite: 300
  }
};

// Sistema de temas de colores
const LEVEL_THEMES = {
  novato: {
    primary: 'red-500',
    background: 'red-50',
    border: 'red-200',
    text: 'red-800',
    tailwindClass: 'bg-red-100 border-red-300 text-red-800',
    icon: '🔰'
  },
  intermedio: {
    primary: 'orange-500',
    background: 'orange-50',
    border: 'orange-200',
    text: 'orange-800',
    tailwindClass: 'bg-orange-100 border-orange-300 text-orange-800',
    icon: '💪'
  },
  avanzado: {
    primary: 'red-600',
    background: 'red-50',
    border: 'red-300',
    text: 'red-900',
    tailwindClass: 'bg-red-100 border-red-400 text-red-900',
    icon: '🏋️'
  },
  elite: {
    primary: 'purple-600',
    background: 'purple-50',
    border: 'purple-300',
    text: 'purple-900',
    tailwindClass: 'bg-purple-100 border-purple-400 text-purple-900',
    icon: '👑'
  }
};

// Utilidades de validación
const ValidationUtils = {
  isValidLevelId(levelId) {
    return typeof levelId === 'string' && LEVEL_ORDER.includes(levelId.toLowerCase());
  },

  sanitizeLevelId(levelId) {
    if (typeof levelId !== 'string') return null;
    return levelId.toLowerCase().trim();
  },

  logWarning(message, data = null) {
    if (import.meta.env.DEV) {
      console.warn(`[PowerliftingLevels] ${message}`, data);
    }
  },

  logError(message, error = null) {
    console.error(`[PowerliftingLevels] ${message}`, error);
  }
};

export const POWERLIFTING_LEVELS = {
  'novato': {
    id: 'novato',
    name: 'Novato',
    description: '0-6 meses de experiencia en powerlifting',
    frequency: '3 días/semana',
    restDays: 'Descanso mínimo 48h entre sesiones de mismo levantamiento',
    duration: '60-90 minutos por sesión',

    hitos: [
      'Dominar técnica en los 3 levantamientos principales',
      'Sentadilla: 1.0-1.25x peso corporal',
      'Press de banca: 0.6-0.75x peso corporal',
      'Peso muerto: 1.25-1.5x peso corporal',
      'Consistencia de al menos 3 meses de entrenamiento'
    ],

    focus: [
      'Técnica perfecta en sentadilla, press banca y peso muerto',
      'Construcción de base de fuerza general',
      'Adaptación del sistema nervioso a cargas pesadas',
      'Aprender movilidad y posiciones óptimas'
    ],

    equipment: ['Barra olímpica', 'Rack de sentadilla', 'Banco plano', 'Discos'],

    technical: {
      setsPerExercise: '3-5 series',
      repsRange: '5-8 repeticiones',
      intensityRange: '60-75% 1RM',
      restBetweenSets: '3-4 minutos',
      workoutDuration: '60-90 minutos',
      periodization: 'Linear (progresión lineal simple)'
    },

    theme: LEVEL_THEMES.novato,
    color: LEVEL_THEMES.novato.tailwindClass,
    icon: LEVEL_THEMES.novato.icon,
    recommendedProgression: 'Incrementos de 2.5-5kg por semana, enfoque en técnica'
  },

  'intermedio': {
    id: 'intermedio',
    name: 'Intermedio',
    description: '6 meses - 2 años de entrenamiento consistente',
    frequency: '4 días/semana',
    restDays: 'Periodización con días ligeros/pesados',
    duration: '75-100 minutos por sesión',

    hitos: [
      'Sentadilla: 1.5-2.0x peso corporal',
      'Press de banca: 1.0-1.25x peso corporal',
      'Peso muerto: 1.75-2.25x peso corporal',
      'Experiencia con periodización',
      'Participación en competencia local (opcional)'
    ],

    focus: [
      'Periodización ondulante o bloques',
      'Desarrollo de variantes específicas',
      'Trabajo de asistencia estratégico',
      'Corrección de debilidades específicas'
    ],

    equipment: ['Barra olímpica', 'Rack', 'Banco', 'Bandas elásticas', 'Cadenas (opcional)'],

    technical: {
      setsPerExercise: '4-6 series',
      repsRange: '3-8 repeticiones',
      intensityRange: '70-85% 1RM',
      restBetweenSets: '4-5 minutos',
      workoutDuration: '75-100 minutos',
      periodization: 'Ondulante o bloques'
    },

    theme: LEVEL_THEMES.intermedio,
    color: LEVEL_THEMES.intermedio.tailwindClass,
    icon: LEVEL_THEMES.intermedio.icon,
    recommendedProgression: 'Periodización semanal, variantes estratégicas'
  },

  'avanzado': {
    id: 'avanzado',
    name: 'Avanzado',
    description: '2-5 años de entrenamiento serio',
    frequency: '4-5 días/semana',
    restDays: 'Periodización avanzada con microciclos',
    duration: '90-120 minutos por sesión',

    hitos: [
      'Sentadilla: 2.0-2.5x peso corporal',
      'Press de banca: 1.25-1.5x peso corporal',
      'Peso muerto: 2.25-2.75x peso corporal',
      'Competencia regional/nacional',
      'Dominio de técnicas avanzadas (pausa, tempo, déficit)'
    ],

    focus: [
      'Periodización por bloques (acumulación, intensificación, realización)',
      'Especialización de puntos débiles',
      'Trabajo de asistencia altamente específico',
      'Preparación para competencia'
    ],

    equipment: ['Barra olímpica', 'Rack', 'Banco', 'Bandas', 'Cadenas', 'Boards', 'Bloques de déficit'],

    technical: {
      setsPerExercise: '5-8 series',
      repsRange: '1-6 repeticiones',
      intensityRange: '75-90% 1RM',
      restBetweenSets: '5-7 minutos',
      workoutDuration: '90-120 minutos',
      periodization: 'Bloques conjugados'
    },

    theme: LEVEL_THEMES.avanzado,
    color: LEVEL_THEMES.avanzado.tailwindClass,
    icon: LEVEL_THEMES.avanzado.icon,
    recommendedProgression: 'Periodización compleja, peaking para competencias'
  },

  'elite': {
    id: 'elite',
    name: 'Elite',
    description: '+5 años de entrenamiento competitivo',
    frequency: '5-6 días/semana',
    restDays: 'Periodización multi-ciclo para competencias',
    duration: '100-150 minutos por sesión',

    hitos: [
      'Sentadilla: 2.5x+ peso corporal',
      'Press de banca: 1.5x+ peso corporal',
      'Peso muerto: 2.75x+ peso corporal',
      'Competencia nacional/internacional',
      'Total competitivo Elite (IPF Class I+, USAPL Elite)'
    ],

    focus: [
      'Periodización anual multi-pico',
      'Microajustes individualizados',
      'Recuperación y nutrición optimizada',
      'Técnicas de peaking avanzadas',
      'Psicología deportiva y estrategia competitiva'
    ],

    equipment: ['Full powerlifting gym', 'Specialty bars', 'Bandas', 'Cadenas', 'Bloques', 'Slingshot', 'Wraps/Sleeves'],

    technical: {
      setsPerExercise: '6-10 series',
      repsRange: '1-5 repeticiones',
      intensityRange: '80-95% 1RM',
      restBetweenSets: '5-10 minutos',
      workoutDuration: '100-150 minutos',
      periodization: 'Conjugate, bloques multi-fase'
    },

    theme: LEVEL_THEMES.elite,
    color: LEVEL_THEMES.elite.tailwindClass,
    icon: LEVEL_THEMES.elite.icon,
    recommendedProgression: 'Individualización extrema, preparación de competencia multi-pico'
  }
};

/**
 * Obtener configuración de nivel por ID
 */
export function getLevelConfig(levelId) {
  const sanitizedId = ValidationUtils.sanitizeLevelId(levelId);

  if (!sanitizedId) {
    ValidationUtils.logWarning('getLevelConfig called with invalid levelId', { levelId });
    return null;
  }

  return POWERLIFTING_LEVELS[sanitizedId] || null;
}

/**
 * Obtener todos los niveles disponibles ordenados por progresión
 */
export function getAllLevels() {
  return LEVEL_ORDER.map(levelId => POWERLIFTING_LEVELS[levelId]);
}

/**
 * Obtener nivel siguiente en la progresión
 */
export function getNextLevel(currentLevel) {
  const sanitizedLevel = ValidationUtils.sanitizeLevelId(currentLevel);

  if (!ValidationUtils.isValidLevelId(sanitizedLevel)) {
    ValidationUtils.logWarning('getNextLevel called with invalid level', { currentLevel });
    return null;
  }

  const currentIndex = LEVEL_ORDER.indexOf(sanitizedLevel);

  if (currentIndex === -1 || currentIndex === LEVEL_ORDER.length - 1) {
    return null;
  }

  return POWERLIFTING_LEVELS[LEVEL_ORDER[currentIndex + 1]];
}

/**
 * Obtener nivel anterior en la progresión
 */
export function getPreviousLevel(currentLevel) {
  const sanitizedLevel = ValidationUtils.sanitizeLevelId(currentLevel);

  if (!ValidationUtils.isValidLevelId(sanitizedLevel)) {
    ValidationUtils.logWarning('getPreviousLevel called with invalid level', { currentLevel });
    return null;
  }

  const currentIndex = LEVEL_ORDER.indexOf(sanitizedLevel);

  if (currentIndex <= 0) {
    return null;
  }

  return POWERLIFTING_LEVELS[LEVEL_ORDER[currentIndex - 1]];
}

/**
 * Validar si un nivel es válido
 */
export function isValidLevel(level) {
  return ValidationUtils.isValidLevelId(level);
}

/**
 * Obtener recomendaciones generales por nivel
 */
export function getLevelRecommendations(level) {
  const config = getLevelConfig(level);

  if (!config) {
    ValidationUtils.logWarning('getLevelRecommendations called with invalid level', { level });
    return null;
  }

  const levelId = config.id;

  return {
    warmupDuration: TRAINING_CONSTANTS.WARMUP_DURATION[levelId],
    cooldownDuration: TRAINING_CONSTANTS.COOLDOWN_DURATION,
    intensityRange: TRAINING_CONSTANTS.INTENSITY_RANGE[levelId],
    maxTrainingDaysPerWeek: TRAINING_CONSTANTS.MAX_TRAINING_DAYS[levelId],
    setsPerExercise: config.technical.setsPerExercise,
    repsRange: config.technical.repsRange,
    restBetweenSets: config.technical.restBetweenSets,
    workoutDuration: config.technical.workoutDuration,
    periodization: config.technical.periodization,
    restBetweenSetsSeconds: TRAINING_CONSTANTS.REST_BETWEEN_SETS[levelId]
  };
}

/**
 * Obtener información de tema/colores para un nivel
 */
export function getLevelTheme(level) {
  const config = getLevelConfig(level);

  if (!config) {
    ValidationUtils.logWarning('getLevelTheme called with invalid level', { level });
    return null;
  }

  return config.theme;
}

/**
 * Obtener orden/índice de un nivel en la progresión
 */
export function getLevelIndex(level) {
  const sanitizedLevel = ValidationUtils.sanitizeLevelId(level);

  if (!ValidationUtils.isValidLevelId(sanitizedLevel)) {
    return -1;
  }

  return LEVEL_ORDER.indexOf(sanitizedLevel);
}

/**
 * Comparar dos niveles en la progresión
 */
export function compareLevels(levelA, levelB) {
  const indexA = getLevelIndex(levelA);
  const indexB = getLevelIndex(levelB);

  if (indexA === -1 || indexB === -1) {
    ValidationUtils.logWarning('compareLevels called with invalid levels', { levelA, levelB });
    return 0;
  }

  if (indexA < indexB) return -1;
  if (indexA > indexB) return 1;
  return 0;
}

/**
 * Verificar si un usuario puede progresar al siguiente nivel
 */
export function canProgressToNextLevel(currentLevel, currentLifts = {}) {
  const config = getLevelConfig(currentLevel);
  const nextLevel = getNextLevel(currentLevel);

  if (!config) {
    return { canProgress: false, reason: 'Nivel actual inválido' };
  }

  if (!nextLevel) {
    return { canProgress: false, reason: 'Ya estás en el nivel máximo (Elite)' };
  }

  // Criterios de progresión basados en fuerza relativa
  const bodyweight = currentLifts.bodyweight || 80; // kg default
  const squat = currentLifts.squat || 0;
  const bench = currentLifts.bench || 0;
  const deadlift = currentLifts.deadlift || 0;

  const squatRatio = squat / bodyweight;
  const benchRatio = bench / bodyweight;
  const deadliftRatio = deadlift / bodyweight;

  // Ratios mínimos por nivel (conservadores)
  const minimumRatios = {
    novato: { squat: 1.25, bench: 0.75, deadlift: 1.5 },
    intermedio: { squat: 1.75, bench: 1.0, deadlift: 2.0 },
    avanzado: { squat: 2.25, bench: 1.4, deadlift: 2.5 },
    elite: { squat: 2.5, bench: 1.5, deadlift: 2.75 }
  };

  const required = minimumRatios[currentLevel];
  const meetsRequirements = squatRatio >= required.squat &&
                           benchRatio >= required.bench &&
                           deadliftRatio >= required.deadlift;

  return {
    canProgress: meetsRequirements,
    currentLevel: config.name,
    nextLevel: nextLevel.name,
    currentRatios: {
      squat: squatRatio.toFixed(2),
      bench: benchRatio.toFixed(2),
      deadlift: deadliftRatio.toFixed(2)
    },
    requiredRatios: required,
    reason: meetsRequirements
      ? 'Cumples los requisitos de fuerza para avanzar de nivel'
      : `Necesitas mejorar tus ratios de fuerza (Sentadilla: ${required.squat}x, Press: ${required.bench}x, Peso muerto: ${required.deadlift}x)`
  };
}

export default POWERLIFTING_LEVELS;
