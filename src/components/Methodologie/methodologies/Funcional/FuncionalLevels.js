/**
 * Configuración de Niveles para Entrenamiento Funcional
 * Basado en principios de movimientos multiarticulares y patrones funcionales
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 1.0.0 - Funcional Implementation
 */

// Constantes de configuración
const LEVEL_ORDER = ['principiante', 'intermedio', 'avanzado'];

const TRAINING_CONSTANTS = {
  WARMUP_DURATION: {
    principiante: 10,
    intermedio: 12,
    avanzado: 15
  },
  COOLDOWN_DURATION: 10, // Igual para todos los niveles
  MOBILITY_WORK_PERCENT: {
    principiante: 30,
    intermedio: 25,
    avanzado: 20
  },
  STRENGTH_WORK_PERCENT: {
    principiante: 50,
    intermedio: 55,
    avanzado: 50
  },
  POWER_WORK_PERCENT: {
    principiante: 20,
    intermedio: 20,
    avanzado: 30
  },
  DELOAD_WEEKS: {
    principiante: 6,
    intermedio: 5,
    avanzado: 4
  },
  MAX_TRAINING_DAYS: {
    principiante: 3,
    intermedio: 4,
    avanzado: 5
  }
};

// Sistema de temas de colores
const LEVEL_THEMES = {
  principiante: {
    primary: 'emerald-500',
    background: 'emerald-50',
    border: 'emerald-200',
    text: 'emerald-800',
    tailwindClass: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    icon: '🟢'
  },
  intermedio: {
    primary: 'orange-500',
    background: 'orange-50',
    border: 'orange-200',
    text: 'orange-800',
    tailwindClass: 'bg-orange-100 border-orange-300 text-orange-800',
    icon: '🟠'
  },
  avanzado: {
    primary: 'red-500',
    background: 'red-50',
    border: 'red-200',
    text: 'red-800',
    tailwindClass: 'bg-red-100 border-red-300 text-red-800',
    icon: '🔴'
  }
};

// Utilidades de validación
const ValidationUtils = {
  isValidLevelId(levelId) {
    return typeof levelId === 'string' && LEVEL_ORDER.includes(levelId.toLowerCase());
  },

  sanitizeLevelId(levelId) {
    if (typeof levelId !== 'string') return null;
    try {
      const noDiacritics = levelId
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return noDiacritics.toLowerCase().trim();
    } catch {
      return levelId.toLowerCase().trim();
    }
  },

  validateLevelData(levelData) {
    if (!levelData || typeof levelData !== 'object') {
      return { isValid: false, error: 'Invalid level data provided' };
    }

    const requiredFields = ['id', 'name', 'description', 'frequency', 'duration', 'hitos', 'focus'];
    const missingFields = requiredFields.filter(field => !levelData[field]);

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      };
    }

    return { isValid: true };
  },

  logWarning(message, data = null) {
    if (import.meta.env.DEV) {
      console.warn(`[FuncionalLevels] ${message}`, data);
    }
  },

  logError(message, error = null) {
    console.error(`[FuncionalLevels] ${message}`, error);
  }
};

export const FUNCIONAL_LEVELS = {
  'principiante': {
    id: 'principiante',
    name: 'Principiante',
    description: '0-6 meses de entrenamiento funcional',
    frequency: '3 días/semana',
    restDays: 'Descanso mínimo 48h entre sesiones',
    duration: '35-50 minutos por sesión',
    hitos: [
      'Dominar patrones básicos: squat, hinge, push, pull',
      'Realizar flexiones en rodillas 3x10 con buena técnica',
      'Sentadilla goblet con 8-12kg por 3x12 repeticiones',
      'Plancha frontal 3x30-40 segundos con forma correcta',
      'Completar 10 step-ups consecutivos por pierna'
    ],
    focus: [
      'Aprendizaje de patrones de movimiento fundamentales',
      'Desarrollo de estabilidad y control corporal',
      'Construcción de base de fuerza funcional',
      'Mejora de movilidad articular y flexibilidad'
    ],
    equipment: ['Peso corporal', 'Kettlebell ligera', 'Mancuernas', 'TRX/Bandas'],
    theme: LEVEL_THEMES.principiante,
    // Backward compatibility
    color: LEVEL_THEMES.principiante.tailwindClass,
    icon: LEVEL_THEMES.principiante.icon,
    recommendedProgression: 'Enfoque en técnica perfecta antes de aumentar intensidad o carga'
  },
  'intermedio': {
    id: 'intermedio',
    name: 'Intermedio',
    description: '6-18 meses de entrenamiento funcional',
    frequency: '4 días/semana',
    restDays: 'Descanso activo con movilidad',
    duration: '45-60 minutos por sesión',
    hitos: [
      'Dominadas asistidas con banda 3x8 o dead hang 60 segundos',
      'Sentadilla búlgara con 12-20kg por 3x10 cada pierna',
      'Flexiones diamante 3x10 con técnica estricta',
      'L-sit hold en paralelas 3x20 segundos',
      'Box jumps a 50-60cm de altura con aterrizaje controlado'
    ],
    focus: [
      'Incremento de fuerza relativa y potencia',
      'Introducción a movimientos pliométricos básicos',
      'Desarrollo de estabilidad unilateral',
      'Trabajo de movilidad activa y dinámica'
    ],
    equipment: ['TRX', 'Kettlebells', 'Medicine Ball', 'Cajón', 'Barra'],
    theme: LEVEL_THEMES.intermedio,
    // Backward compatibility
    color: LEVEL_THEMES.intermedio.tailwindClass,
    icon: LEVEL_THEMES.intermedio.icon,
    recommendedProgression: 'Aumentar complejidad de movimientos y añadir trabajo unilateral'
  },
  'avanzado': {
    id: 'avanzado',
    name: 'Avanzado',
    description: '18+ meses de entrenamiento funcional',
    frequency: '5 días/semana',
    restDays: 'Periodización con fases de descarga',
    duration: '60-75 minutos por sesión',
    hitos: [
      'Dominadas con lastre +10kg por 3x8 repeticiones',
      'Pistol squat 3x6 cada pierna con técnica perfecta',
      'Muscle-up en barra o anillas 3x3 repeticiones',
      'Turkish get-up con 20-24kg por 3x5 cada lado',
      'Dragon flag 3x6 repeticiones con control'
    ],
    focus: [
      'Movimientos complejos de alta coordinación',
      'Desarrollo de fuerza máxima relativa',
      'Trabajo pliométrico avanzado y explosivo',
      'Integración de movimientos multi-plano y carga'
    ],
    equipment: ['Barra', 'Anillas', 'Kettlebells pesadas', 'Medicine Ball', 'Sandbag'],
    theme: LEVEL_THEMES.avanzado,
    // Backward compatibility
    color: LEVEL_THEMES.avanzado.tailwindClass,
    icon: LEVEL_THEMES.avanzado.icon,
    recommendedProgression: 'Especialización en movimientos complejos y desarrollo de potencia máxima'
  }
};

/**
 * Obtener configuración de nivel por ID
 * @param {string} levelId - ID del nivel ('principiante', 'intermedio', 'avanzado')
 * @returns {Object|null} Configuración del nivel
 */
export function getLevelConfig(levelId) {
  const sanitizedId = ValidationUtils.sanitizeLevelId(levelId);

  if (!sanitizedId) {
    ValidationUtils.logWarning('getLevelConfig called with invalid levelId', { levelId });
    return null;
  }

  return FUNCIONAL_LEVELS[sanitizedId] || null;
}

/**
 * Obtener todos los niveles disponibles ordenados por progresión
 * @returns {Array} Array de configuraciones de nivel
 */
export function getAllLevels() {
  return LEVEL_ORDER.map(levelId => FUNCIONAL_LEVELS[levelId]);
}

/**
 * Obtener nivel siguiente en la progresión
 * @param {string} currentLevel - Nivel actual
 * @returns {Object|null} Configuración del siguiente nivel
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

  return FUNCIONAL_LEVELS[LEVEL_ORDER[currentIndex + 1]];
}

/**
 * Obtener nivel anterior en la progresión
 * @param {string} currentLevel - Nivel actual
 * @returns {Object|null} Configuración del nivel anterior
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

  return FUNCIONAL_LEVELS[LEVEL_ORDER[currentIndex - 1]];
}

/**
 * Validar si un nivel es válido
 * @param {string} level - Nivel a validar
 * @returns {boolean} True si es válido
 */
export function isValidLevel(level) {
  return ValidationUtils.isValidLevelId(level);
}

/**
 * Obtener recomendaciones generales por nivel
 * @param {string} level - Nivel del usuario
 * @returns {Object|null} Recomendaciones específicas
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
    mobilityWorkPercent: TRAINING_CONSTANTS.MOBILITY_WORK_PERCENT[levelId],
    strengthWorkPercent: TRAINING_CONSTANTS.STRENGTH_WORK_PERCENT[levelId],
    powerWorkPercent: TRAINING_CONSTANTS.POWER_WORK_PERCENT[levelId],
    recommendedDeloadWeeks: TRAINING_CONSTANTS.DELOAD_WEEKS[levelId],
    maxTrainingDaysPerWeek: TRAINING_CONSTANTS.MAX_TRAINING_DAYS[levelId],
    // Recomendaciones adicionales calculadas
    totalWorkoutTime: TRAINING_CONSTANTS.WARMUP_DURATION[levelId] + TRAINING_CONSTANTS.COOLDOWN_DURATION,
    mobilityWorkMinutes: Math.round((TRAINING_CONSTANTS.MOBILITY_WORK_PERCENT[levelId] / 100) * 45),
    strengthWorkMinutes: Math.round((TRAINING_CONSTANTS.STRENGTH_WORK_PERCENT[levelId] / 100) * 45),
    powerWorkMinutes: Math.round((TRAINING_CONSTANTS.POWER_WORK_PERCENT[levelId] / 100) * 45)
  };
}

/**
 * Obtener información de tema/colores para un nivel
 * @param {string} level - Nivel del usuario
 * @returns {Object|null} Información de tema
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
 * @param {string} level - Nivel del usuario
 * @returns {number} Índice del nivel (0-2) o -1 si es inválido
 */
export function getLevelIndex(level) {
  const sanitizedLevel = ValidationUtils.sanitizeLevelId(level);

  if (!ValidationUtils.isValidLevelId(sanitizedLevel)) {
    return -1;
  }

  return LEVEL_ORDER.indexOf(sanitizedLevel);
}

/**
 * Obtener estadísticas de progresión entre niveles
 * @returns {Object} Información de progresión completa
 */
export function getProgressionStats() {
  return {
    totalLevels: LEVEL_ORDER.length,
    levelOrder: [...LEVEL_ORDER],
    progressionPath: LEVEL_ORDER.map(levelId => ({
      id: levelId,
      name: FUNCIONAL_LEVELS[levelId].name,
      description: FUNCIONAL_LEVELS[levelId].description,
      theme: FUNCIONAL_LEVELS[levelId].theme
    })),
    trainingConstants: { ...TRAINING_CONSTANTS }
  };
}

/**
 * Comparar dos niveles en la progresión
 * @param {string} levelA - Primer nivel
 * @param {string} levelB - Segundo nivel
 * @returns {number} -1 si levelA es anterior, 0 si son iguales, 1 si levelA es posterior
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
 * @param {string} currentLevel - Nivel actual
 * @param {Array} completedHitos - Hitos completados por el usuario
 * @returns {Object} Información sobre elegibilidad para progresión
 */
export function canProgressToNextLevel(currentLevel, completedHitos = []) {
  const config = getLevelConfig(currentLevel);
  const nextLevel = getNextLevel(currentLevel);

  if (!config) {
    return { canProgress: false, reason: 'Nivel actual inválido' };
  }

  if (!nextLevel) {
    return { canProgress: false, reason: 'Ya estás en el nivel máximo' };
  }

  const totalHitos = config.hitos.length;
  const completedCount = completedHitos.length;
  const completionRate = totalHitos > 0 ? (completedCount / totalHitos) * 100 : 0;

  const canProgress = completionRate >= 80; // Requerimos 80% de hitos completados

  return {
    canProgress,
    currentLevel: config.name,
    nextLevel: nextLevel.name,
    completionRate: Math.round(completionRate),
    completedHitos: completedCount,
    totalHitos,
    requiredRate: 80,
    reason: canProgress
      ? 'Cumples los requisitos para avanzar'
      : `Necesitas completar al menos ${Math.ceil(totalHitos * 0.8)} hitos (${Math.ceil(totalHitos * 0.8) - completedCount} más)`
  };
}

export default FUNCIONAL_LEVELS;
