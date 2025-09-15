/**
 * Constantes para tipos de entrenamiento y metodologías
 */
export const METHODOLOGY_TYPES = {
  HIPERTROFIA: 'Hipertrofia',
  POWERLIFTING: 'Powerlifting',
  FUNCIONAL: 'Funcional',
  HEAVY_DUTY: 'Heavy Duty',
  CROSSFIT: 'Crossfit',
  CALISTENIA: 'Calistenia',
  OPOSICIONES: 'Oposiciones'
};

export const METHODOLOGY_DESCRIPTIONS = {
  [METHODOLOGY_TYPES.HIPERTROFIA]: 'Entrenamiento de hipertrofia para gimnasio',
  [METHODOLOGY_TYPES.POWERLIFTING]: 'Entrenamiento de fuerza con pesas libres',
  [METHODOLOGY_TYPES.FUNCIONAL]: 'Entrenamiento funcional completo',
  [METHODOLOGY_TYPES.HEAVY_DUTY]: 'Entrenamiento de alta intensidad',
  [METHODOLOGY_TYPES.CROSSFIT]: 'Entrenamiento variado de alta intensidad',
  [METHODOLOGY_TYPES.CALISTENIA]: 'Entrenamiento de calistenia con peso corporal',
  [METHODOLOGY_TYPES.OPOSICIONES]: 'Preparación física específica'
};

/**
 * Estados de ejercicios
 */
export const EXERCISE_STATUS = {
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress'
};

/**
 * Tipos de sentimientos para feedback
 */
export const SENTIMENT_TYPES = {
  LIKE: 'like',
  DISLIKE: 'dislike',
  HARD: 'hard'
};

/**
 * Colores por estado de ejercicio
 */
export const STATUS_COLORS = {
  [EXERCISE_STATUS.COMPLETED]: {
    bg: 'bg-green-900/20',
    border: 'border-green-600',
    text: 'text-green-300'
  },
  [EXERCISE_STATUS.CANCELLED]: {
    bg: 'bg-red-900/20',
    border: 'border-red-600',
    text: 'text-red-300'
  },
  [EXERCISE_STATUS.SKIPPED]: {
    bg: 'bg-gray-800/50',
    border: 'border-gray-700',
    text: 'text-gray-400'
  },
  default: {
    bg: 'bg-gray-800/40',
    border: 'border-gray-700',
    text: 'text-gray-300'
  }
};

/**
 * Colores por sentimiento
 */
export const SENTIMENT_COLORS = {
  [SENTIMENT_TYPES.LIKE]: {
    text: 'text-green-300',
    icon: '❤️'
  },
  [SENTIMENT_TYPES.HARD]: {
    text: 'text-red-300',
    icon: '⚠️'
  },
  [SENTIMENT_TYPES.DISLIKE]: {
    text: 'text-orange-300',
    icon: '👎'
  }
};

/**
 * Configuración de equipamiento
 */
export const EQUIPMENT_TYPES = {
  MINIMO: 'Mínimo',
  INTERMEDIO: 'Intermedio',
  COMPLETO: 'Completo',
  GIMNASIO: 'Gimnasio'
};

export default {
  METHODOLOGY_TYPES,
  METHODOLOGY_DESCRIPTIONS,
  EXERCISE_STATUS,
  SENTIMENT_TYPES,
  STATUS_COLORS,
  SENTIMENT_COLORS,
  EQUIPMENT_TYPES
};