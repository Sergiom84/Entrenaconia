/**
 * Grupos Musculares y Patrones de Movimiento para Calistenia - v2.0 Profesional
 * Clasificación científica basada en biomecánica y funcionalidad
 * Refactorizado con patrones arquitecturales consistentes y configuraciones centralizadas
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 2.0.0 - Architectural Standards Alignment
 */

// Configuraciones centralizadas
const MUSCLE_GROUP_CONFIG = {
  DURATIONS: {
    basico: 45,
    intermedio: 60,
    avanzado: 75
  },
  SPLIT_TYPES: {
    FULL_BODY: 'full_body',
    SPLIT: 'split'
  },
  FOCUS_TYPES: {
    STRENGTH: 'strength',
    SKILL: 'skill',
    ENDURANCE: 'endurance'
  },
  SESSION_THRESHOLD: 3,
  MAX_SESSIONS: 6
};

// Sistema de tema consistente con CalisteniaLevels.js
const MUSCLE_GROUP_THEMES = {
  empuje: {
    color: 'bg-blue-100 border-blue-300',
    darkColor: 'bg-blue-900/20 border-blue-400/30',
    icon: '💪',
    themeColor: 'blue-400'
  },
  traccion: {
    color: 'bg-green-100 border-green-300',
    darkColor: 'bg-green-900/20 border-green-400/30',
    icon: '🏋️',
    themeColor: 'green-400'
  },
  piernas: {
    color: 'bg-yellow-100 border-yellow-300',
    darkColor: 'bg-yellow-900/20 border-yellow-400/30',
    icon: '🦵',
    themeColor: 'yellow-400'
  },
  core: {
    color: 'bg-purple-100 border-purple-300',
    darkColor: 'bg-purple-900/20 border-purple-400/30',
    icon: '🌟',
    themeColor: 'purple-400'
  },
  habilidades: {
    color: 'bg-red-100 border-red-300',
    darkColor: 'bg-red-900/20 border-red-400/30',
    icon: '🎯',
    themeColor: 'red-400'
  }
};

// Utilidades de validación para grupos musculares
const MuscleGroupValidationUtils = {
  isValidLevel(level) {
    return typeof level === 'string' && ['basico', 'intermedio', 'avanzado'].includes(level.toLowerCase());
  },

  sanitizeLevel(level) {
    return typeof level === 'string' ? level.toLowerCase().trim() : 'basico';
  },

  validateSessionCount(sessions) {
    const count = Number(sessions);
    return !isNaN(count) && count >= 1 && count <= MUSCLE_GROUP_CONFIG.MAX_SESSIONS ? count : 3;
  },

  logWarning(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[CalisteniaMuscleGroups] ${message}`, data);
    }
  }
};

export const CALISTENIA_MUSCLE_GROUPS = {
  empuje: {
    id: 'empuje',
    name: 'Empuje',
    description: 'Movimientos que alejan el cuerpo de una superficie o empujan una resistencia',
    primaryMuscles: [
      'Pectorales (mayor y menor)',
      'Deltoides (anterior y medio)',
      'Tríceps braquial',
      'Serrato anterior'
    ],
    secondaryMuscles: [
      'Core (estabilización)',
      'Deltoides posterior (estabilización)',
      'Trapecio inferior',
      'Glúteos (plancha y variantes)'
    ],
    movementPatterns: [
      'Empuje horizontal (flexiones)',
      'Empuje vertical (handstand push-ups)',
      'Empuje inclinado (pike push-ups)'
    ],
    commonExercises: [
      'Flexiones (todas las variantes)',
      'Fondos en paralelas',
      'Pike push-ups',
      'Handstand push-ups',
      'Flexiones en anillas'
    ],
    progressionPrinciples: [
      'Aumentar ángulo de inclinación',
      'Reducir puntos de apoyo',
      'Agregar inestabilidad (anillas)',
      'Modificar tempo y pausas'
    ],
    // Tema modernizado
    ...MUSCLE_GROUP_THEMES.empuje
  },
  traccion: {
    id: 'traccion',
    name: 'Tracción',
    description: 'Movimientos que acercan el cuerpo hacia una superficie o tiran de una resistencia',
    primaryMuscles: [
      'Latíssimo dorsi',
      'Romboides',
      'Trapecio (medio e inferior)',
      'Bíceps braquial',
      'Braquial y braquioradial'
    ],
    secondaryMuscles: [
      'Deltoides posterior',
      'Infraespinoso y redondo menor',
      'Core (estabilización)',
      'Flexores de dedos y antebrazo'
    ],
    movementPatterns: [
      'Tracción vertical (dominadas)',
      'Tracción horizontal (remo)',
      'Tracción angular (face pulls corporales)'
    ],
    commonExercises: [
      'Dominadas (todas las variantes)',
      'Remo corporal',
      'Muscle-ups',
      'Colgarse (dead hang)',
      'Face pulls en anillas'
    ],
    progressionPrinciples: [
      'Reducir asistencia gradualmente',
      'Aumentar rango de movimiento',
      'Variar agarre y anchura',
      'Agregar peso o resistencia adicional'
    ],
    ...MUSCLE_GROUP_THEMES.traccion
  },
  piernas: {
    id: 'piernas',
    name: 'Piernas',
    description: 'Movimientos que involucran principalmente la musculatura del tren inferior',
    primaryMuscles: [
      'Cuádriceps',
      'Glúteo mayor',
      'Isquiotibiales',
      'Gastrocnemio y sóleo'
    ],
    secondaryMuscles: [
      'Aductores',
      'Glúteo medio y menor',
      'Tibial anterior',
      'Core (estabilización)',
      'Erectores espinales'
    ],
    movementPatterns: [
      'Flexión de cadera dominante (sentadillas)',
      'Bisagra de cadera (peso muerto unilateral)',
      'Locomoción unilateral (zancadas, pistol)'
    ],
    commonExercises: [
      'Sentadillas (todas las variantes)',
      'Pistol squats',
      'Zancadas y lunges',
      'Saltos pliométricos',
      'Peso muerto a una pierna'
    ],
    progressionPrinciples: [
      'Progresión unilateral',
      'Aumentar rango de movimiento',
      'Agregar componente pliométrico',
      'Modificar base de sustentación'
    ],
    ...MUSCLE_GROUP_THEMES.piernas
  },
  core: {
    id: 'core',
    name: 'Core',
    description: 'Musculatura estabilizadora del tronco y transferencia de fuerza',
    primaryMuscles: [
      'Recto abdominal',
      'Oblicuos externos e internos',
      'Transverso abdominal',
      'Multífidos',
      'Erectores espinales'
    ],
    secondaryMuscles: [
      'Diafragma',
      'Suelo pélvico',
      'Psoas mayor',
      'Cuadrado lumbar',
      'Glúteos (estabilización pélvica)'
    ],
    movementPatterns: [
      'Antiextensión (plancha)',
      'Antiflexión (superman)',
      'Antirotación (side plank)',
      'Antiflexión lateral (suitcase carry)'
    ],
    commonExercises: [
      'Plancha (todas las variantes)',
      'Hollow body holds',
      'L-sits',
      'V-ups',
      'Dragon flags',
      'Human flags'
    ],
    progressionPrinciples: [
      'Aumentar tiempo bajo tensión',
      'Reducir puntos de apoyo',
      'Agregar movimiento dinámico',
      'Incrementar palanca (distancia)'
    ],
    ...MUSCLE_GROUP_THEMES.core
  },
  habilidades: {
    id: 'habilidades',
    name: 'Habilidades',
    description: 'Movimientos complejos que requieren coordinación, fuerza y técnica avanzada',
    primaryMuscles: [
      'Integración de múltiples grupos musculares',
      'Coordinación intermuscular',
      'Sistema propioceptivo',
      'Control motor fino'
    ],
    secondaryMuscles: [
      'Toda la musculatura corporal trabajando en sinergia',
      'Énfasis en estabilizadores profundos',
      'Activación secuencial específica'
    ],
    movementPatterns: [
      'Equilibrio estático (handstands)',
      'Transiciones dinámicas (muscle-ups)',
      'Movimientos de fuerza pura (planche)',
      'Combinaciones complejas (flow movements)'
    ],
    commonExercises: [
      'Handstand',
      'Front lever',
      'Back lever',
      'Planche',
      'Human flag',
      'Muscle-up',
      'One arm chin-up'
    ],
    progressionPrinciples: [
      'Desarrollo de prerrequisitos específicos',
      'Progresión técnica gradual',
      'Trabajo de movilidad específica',
      'Paciencia y constancia en la práctica'
    ],
    ...MUSCLE_GROUP_THEMES.habilidades
  }
};

/**
 * Obtener información de un grupo muscular específico - v2.0 Mejorada
 * @param {string} groupId - ID del grupo muscular
 * @returns {Object|null} Información del grupo muscular con validación
 */
export function getMuscleGroupInfo(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    MuscleGroupValidationUtils.logWarning('getMuscleGroupInfo called with invalid groupId', { groupId });
    return null;
  }

  return CALISTENIA_MUSCLE_GROUPS[groupId.toLowerCase().trim()] || null;
}

/**
 * Obtener todos los grupos musculares
 * @returns {Array} Array de todos los grupos musculares
 */
export function getAllMuscleGroups() {
  return Object.values(CALISTENIA_MUSCLE_GROUPS);
}

/**
 * Obtener grupos musculares principales (sin habilidades)
 * @returns {Array} Grupos musculares básicos
 */
export function getBasicMuscleGroups() {
  return Object.values(CALISTENIA_MUSCLE_GROUPS).filter(group => group.id !== 'habilidades');
}

/**
 * Obtener grupos musculares recomendados por nivel - v2.0 Con constantes
 * @param {string} level - Nivel del usuario
 * @returns {Array} Grupos musculares apropiados para el nivel
 */
export function getRecommendedGroupsByLevel(level) {
  const sanitizedLevel = MuscleGroupValidationUtils.sanitizeLevel(level);
  const allGroups = getAllMuscleGroups();

  // Configuración de grupos por nivel (centralizada)
  const LEVEL_GROUP_MAPPING = {
    basico: ['empuje', 'traccion', 'piernas', 'core'],
    intermedio: ['empuje', 'traccion', 'piernas', 'core', 'habilidades'],
    avanzado: Object.keys(CALISTENIA_MUSCLE_GROUPS) // Todos los grupos
  };

  const allowedGroups = LEVEL_GROUP_MAPPING[sanitizedLevel] || LEVEL_GROUP_MAPPING.basico;

  return allGroups.filter(group => allowedGroups.includes(group.id));
}

/**
 * Generar plan de entrenamiento balanceado por grupos musculares - v2.0 Profesional
 * @param {string} level - Nivel del usuario
 * @param {number} sessionsPerWeek - Sesiones por semana
 * @returns {Object} Distribución de grupos musculares por sesión con validación
 */
export function generateBalancedSplit(level, sessionsPerWeek) {
  const sanitizedLevel = MuscleGroupValidationUtils.sanitizeLevel(level);
  const validatedSessions = MuscleGroupValidationUtils.validateSessionCount(sessionsPerWeek);
  const recommendedGroups = getRecommendedGroupsByLevel(sanitizedLevel);

  if (validatedSessions <= MUSCLE_GROUP_CONFIG.SESSION_THRESHOLD) {
    // Full body approach
    return {
      type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.FULL_BODY,
      sessions: Array(validatedSessions).fill().map((_, index) => ({
        sessionNumber: index + 1,
        muscleGroups: recommendedGroups.map(group => group.id),
        focus: index % 2 === 0 ? MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH : MUSCLE_GROUP_CONFIG.FOCUS_TYPES.SKILL,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel] || MUSCLE_GROUP_CONFIG.DURATIONS.basico
      }))
    };
  } else {
    // Split approach con configuración centralizada
    const SPLIT_CONFIGURATIONS = {
      4: [
        { day: 1, groups: ['empuje', 'core'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 2, groups: ['traccion', 'piernas'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 3, groups: ['habilidades', 'core'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.SKILL },
        { day: 4, groups: ['empuje', 'traccion'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.ENDURANCE }
      ],
      5: [
        { day: 1, groups: ['empuje'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 2, groups: ['traccion'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 3, groups: ['piernas', 'core'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 4, groups: ['habilidades'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.SKILL },
        { day: 5, groups: ['empuje', 'traccion'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.ENDURANCE }
      ],
      6: [
        { day: 1, groups: ['empuje'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 2, groups: ['traccion'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 3, groups: ['piernas'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 4, groups: ['core', 'habilidades'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.SKILL },
        { day: 5, groups: ['empuje'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.ENDURANCE },
        { day: 6, groups: ['traccion'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.ENDURANCE }
      ]
    };

    const selectedSplit = SPLIT_CONFIGURATIONS[Math.min(validatedSessions, MUSCLE_GROUP_CONFIG.MAX_SESSIONS)] ||
                         SPLIT_CONFIGURATIONS[4];

    return {
      type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.SPLIT,
      sessions: selectedSplit.map(session => ({
        ...session,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel] || MUSCLE_GROUP_CONFIG.DURATIONS.basico,
        // Filtrar grupos que no están disponibles para el nivel
        groups: session.groups.filter(groupId =>
          recommendedGroups.some(group => group.id === groupId)
        )
      }))
    };
  }
}

/**
 * Obtener ejercicios complementarios entre grupos musculares - v2.0 Mejorada
 * @param {string} primaryGroup - Grupo muscular principal
 * @returns {Array} Grupos musculares complementarios con validación
 */
export function getComplementaryGroups(primaryGroup) {
  if (!primaryGroup || typeof primaryGroup !== 'string') {
    MuscleGroupValidationUtils.logWarning('getComplementaryGroups called with invalid primaryGroup', { primaryGroup });
    return [];
  }

  // Configuración centralizada de grupos complementarios
  const COMPLEMENTARY_GROUP_MAPPING = {
    empuje: ['core', 'traccion'],
    traccion: ['core', 'empuje'],
    piernas: ['core'],
    core: ['empuje', 'traccion'],
    habilidades: ['core']
  };

  const sanitizedGroup = primaryGroup.toLowerCase().trim();
  return COMPLEMENTARY_GROUP_MAPPING[sanitizedGroup] || [];
}

/**
 * Obtener información de tema para un grupo muscular
 * @param {string} groupId - ID del grupo muscular
 * @returns {Object|null} Información de tema del grupo
 */
export function getMuscleGroupTheme(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    return null;
  }

  return MUSCLE_GROUP_THEMES[groupId.toLowerCase().trim()] || null;
}

/**
 * Obtener estadísticas de grupos musculares
 * @returns {Object} Información estadística completa
 */
export function getMuscleGroupStats() {
  const allGroups = getAllMuscleGroups();
  const basicGroups = getBasicMuscleGroups();

  return {
    totalGroups: allGroups.length,
    basicGroups: basicGroups.length,
    skillGroups: allGroups.length - basicGroups.length,
    groupTypes: Object.keys(CALISTENIA_MUSCLE_GROUPS),
    availableThemes: Object.keys(MUSCLE_GROUP_THEMES),
    supportedLevels: Object.keys(MUSCLE_GROUP_CONFIG.DURATIONS)
  };
}

export default CALISTENIA_MUSCLE_GROUPS;