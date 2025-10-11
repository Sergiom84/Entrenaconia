/**
 * Configuración de Niveles para Hipertrofia
 * Basado en principios científicos de volumen y periodización
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 1.0.0
 */

// Constantes de configuración
const LEVEL_ORDER = ['principiante', 'intermedio', 'avanzado'];

const TRAINING_CONSTANTS = {
  WARMUP_DURATION: {
    principiante: 10,
    intermedio: 15,
    avanzado: 20
  },
  COOLDOWN_DURATION: 10,
  VOLUME_PER_MUSCLE: {
    principiante: { min: 10, max: 15 },
    intermedio: { min: 15, max: 20 },
    avanzado: { min: 20, max: 25 }
  },
  INTENSITY_RANGE: {
    principiante: '60-75% 1RM',
    intermedio: '70-85% 1RM',
    avanzado: '75-90% 1RM'
  },
  MAX_TRAINING_DAYS: {
    principiante: 4,
    intermedio: 5,
    avanzado: 6
  }
};

// Sistema de temas de colores
const LEVEL_THEMES = {
  principiante: {
    primary: 'blue-500',
    background: 'blue-50',
    border: 'blue-200',
    text: 'blue-800',
    tailwindClass: 'bg-blue-100 border-blue-300 text-blue-800',
    icon: '🌱'
  },
  intermedio: {
    primary: 'purple-500',
    background: 'purple-50',
    border: 'purple-200',
    text: 'purple-800',
    tailwindClass: 'bg-purple-100 border-purple-300 text-purple-800',
    icon: '💪'
  },
  avanzado: {
    primary: 'orange-500',
    background: 'orange-50',
    border: 'orange-200',
    text: 'orange-800',
    tailwindClass: 'bg-orange-100 border-orange-300 text-orange-800',
    icon: '🏆'
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
      console.warn(`[HipertrofiaLevels] ${message}`, data);
    }
  },

  logError(message, error = null) {
    console.error(`[HipertrofiaLevels] ${message}`, error);
  }
};

export const HIPERTROFIA_LEVELS = {
  'principiante': {
    id: 'principiante',
    name: 'Principiante',
    description: '0-1 año de entrenamiento con pesas',
    frequency: '3-4 días/semana',
    restDays: 'Descanso mínimo 24-48h entre grupos musculares',
    duration: '45-60 minutos por sesión',

    hitos: [
      'Dominar técnica en press de banca, sentadilla, peso muerto',
      'Completar 3-4 series de 8-12 reps con buena forma',
      'Tolerar volumen de 12-15 series por grupo muscular/semana',
      'Conexión mente-músculo básica establecida',
      'Adherencia consistente de 3 meses'
    ],

    focus: [
      'Construcción de base de fuerza',
      'Técnica perfecta en ejercicios compuestos',
      'Volumen progresivo controlado',
      'Desarrollo de trabajo muscular eficiente'
    ],

    equipment: ['Barra', 'Mancuernas', 'Máquinas básicas'],

    technical: {
      setsPerExercise: '3-4 series',
      repsRange: '8-12 repeticiones',
      intensityRange: '60-75% 1RM',
      restBetweenSets: '60-90 segundos',
      volumePerMuscle: '10-15 series/semana',
      workoutDuration: '45-60 minutos'
    },

    theme: LEVEL_THEMES.principiante,
    color: LEVEL_THEMES.principiante.tailwindClass,
    icon: LEVEL_THEMES.principiante.icon,
    recommendedProgression: 'Enfoque en dominar técnica y aumentar volumen gradualmente'
  },

  'intermedio': {
    id: 'intermedio',
    name: 'Intermedio',
    description: '1-3 años de entrenamiento consistente',
    frequency: '4-5 días/semana',
    restDays: 'Descanso activo y periodización',
    duration: '60-75 minutos por sesión',

    hitos: [
      'Progresión clara en cargas durante 6+ meses',
      'Capacidad de trabajar en rangos 6-20 reps según fase',
      'Tolerancia a volumen de 18-20 series/semana',
      'Conexión mente-músculo avanzada',
      'Experiencia con diferentes técnicas de intensidad'
    ],

    focus: [
      'Periodización del volumen e intensidad',
      'Técnicas avanzadas (drop sets, rest-pause)',
      'Splits especializados (Push/Pull/Legs)',
      'Optimización de recuperación'
    ],

    equipment: ['Barra', 'Mancuernas', 'Poleas', 'Máquinas'],

    technical: {
      setsPerExercise: '3-5 series',
      repsRange: '6-15 repeticiones',
      intensityRange: '70-85% 1RM',
      restBetweenSets: '90-120 segundos',
      volumePerMuscle: '15-20 series/semana',
      workoutDuration: '60-75 minutos'
    },

    theme: LEVEL_THEMES.intermedio,
    color: LEVEL_THEMES.intermedio.tailwindClass,
    icon: LEVEL_THEMES.intermedio.icon,
    recommendedProgression: 'Periodización ondulante y especialización de grupos rezagados'
  },

  'avanzado': {
    id: 'avanzado',
    name: 'Avanzado',
    description: '+3 años de entrenamiento serio',
    frequency: '5-6 días/semana',
    restDays: 'Periodización avanzada con bloques',
    duration: '75-90 minutos por sesión',

    hitos: [
      'Progreso sostenido año tras año',
      'Manejo de alto volumen sin sobreentrenamiento',
      'Periodización avanzada (bloques, ondulante)',
      'Recuperación optimizada (sueño, nutrición)',
      'Experiencia competitiva o nivel próximo'
    ],

    focus: [
      'Especialización de grupos rezagados',
      'Periodización compleja (DUP, bloques)',
      'Técnicas de intensidad extrema',
      'Microajustes nutricionales y de recuperación'
    ],

    equipment: ['Barra', 'Mancuernas', 'Poleas', 'Máquinas especializadas', 'Cadenas/Bandas'],

    technical: {
      setsPerExercise: '4-6 series',
      repsRange: '4-20 repeticiones',
      intensityRange: '75-90% 1RM',
      restBetweenSets: '120-180 segundos',
      volumePerMuscle: '20-25 series/semana',
      workoutDuration: '75-90 minutos'
    },

    theme: LEVEL_THEMES.avanzado,
    color: LEVEL_THEMES.avanzado.tailwindClass,
    icon: LEVEL_THEMES.avanzado.icon,
    recommendedProgression: 'Periodización por bloques con fases de especialización'
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

  return HIPERTROFIA_LEVELS[sanitizedId] || null;
}

/**
 * Obtener todos los niveles disponibles ordenados por progresión
 */
export function getAllLevels() {
  return LEVEL_ORDER.map(levelId => HIPERTROFIA_LEVELS[levelId]);
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

  return HIPERTROFIA_LEVELS[LEVEL_ORDER[currentIndex + 1]];
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

  return HIPERTROFIA_LEVELS[LEVEL_ORDER[currentIndex - 1]];
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
    volumePerMuscle: TRAINING_CONSTANTS.VOLUME_PER_MUSCLE[levelId],
    intensityRange: TRAINING_CONSTANTS.INTENSITY_RANGE[levelId],
    maxTrainingDaysPerWeek: TRAINING_CONSTANTS.MAX_TRAINING_DAYS[levelId],
    setsPerExercise: config.technical.setsPerExercise,
    repsRange: config.technical.repsRange,
    restBetweenSets: config.technical.restBetweenSets,
    workoutDuration: config.technical.workoutDuration
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
export function canProgressToNextLevel(currentLevel, completedWeeks = 0, volumeTolerance = 'media') {
  const config = getLevelConfig(currentLevel);
  const nextLevel = getNextLevel(currentLevel);

  if (!config) {
    return { canProgress: false, reason: 'Nivel actual inválido' };
  }

  if (!nextLevel) {
    return { canProgress: false, reason: 'Ya estás en el nivel máximo' };
  }

  // Criterios de progresión para hipertrofia
  const minWeeks = currentLevel === 'principiante' ? 12 : 16;
  const canProgress = completedWeeks >= minWeeks && volumeTolerance !== 'baja';

  return {
    canProgress,
    currentLevel: config.name,
    nextLevel: nextLevel.name,
    completedWeeks,
    requiredWeeks: minWeeks,
    volumeTolerance,
    reason: canProgress
      ? 'Cumples los requisitos para avanzar de nivel'
      : `Necesitas ${minWeeks - completedWeeks} semanas más de entrenamiento consistente`
  };
}

export default HIPERTROFIA_LEVELS;
