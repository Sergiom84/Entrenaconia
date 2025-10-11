/**
 * Grupos Musculares y Patrones de Movimiento para Entrenamiento Funcional - v1.0
 * Clasificación basada en patrones de movimiento funcionales
 * Refactorizado con patrones arquitecturales consistentes y configuraciones centralizadas
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 1.0.0 - Funcional Implementation
 */

// Configuraciones centralizadas
const MUSCLE_GROUP_CONFIG = {
  DURATIONS: {
    principiante: 45,
    intermedio: 55,
    avanzado: 65
  },
  SPLIT_TYPES: {
    FULL_BODY: 'full_body',
    SPLIT: 'split'
  },
  FOCUS_TYPES: {
    STRENGTH: 'strength',
    POWER: 'power',
    ENDURANCE: 'endurance',
    MOBILITY: 'mobility'
  },
  SESSION_THRESHOLD: 3,
  MAX_SESSIONS: 5
};

// Sistema de tema consistente con FuncionalLevels.js
const MUSCLE_GROUP_THEMES = {
  empuje: {
    color: 'bg-blue-100 border-blue-300',
    darkColor: 'bg-blue-900/20 border-blue-400/30',
    icon: '⬆️',
    themeColor: 'blue-400'
  },
  traccion: {
    color: 'bg-green-100 border-green-300',
    darkColor: 'bg-green-900/20 border-green-400/30',
    icon: '⬇️',
    themeColor: 'green-400'
  },
  piernas: {
    color: 'bg-orange-100 border-orange-300',
    darkColor: 'bg-orange-900/20 border-orange-400/30',
    icon: '🦵',
    themeColor: 'orange-400'
  },
  core: {
    color: 'bg-purple-100 border-purple-300',
    darkColor: 'bg-purple-900/20 border-purple-400/30',
    icon: '🎯',
    themeColor: 'purple-400'
  },
  pliometrico: {
    color: 'bg-red-100 border-red-300',
    darkColor: 'bg-red-900/20 border-red-400/30',
    icon: '⚡',
    themeColor: 'red-400'
  },
  movilidad: {
    color: 'bg-teal-100 border-teal-300',
    darkColor: 'bg-teal-900/20 border-teal-400/30',
    icon: '🌀',
    themeColor: 'teal-400'
  },
  carga: {
    color: 'bg-amber-100 border-amber-300',
    darkColor: 'bg-amber-900/20 border-amber-400/30',
    icon: '💼',
    themeColor: 'amber-400'
  }
};

// Utilidades de validación para grupos musculares
const MuscleGroupValidationUtils = {
  isValidLevel(level) {
    return typeof level === 'string' && ['principiante', 'intermedio', 'avanzado'].includes(level.toLowerCase());
  },

  sanitizeLevel(level) {
    return typeof level === 'string' ? level.toLowerCase().trim() : 'principiante';
  },

  validateSessionCount(sessions) {
    const count = Number(sessions);
    return !isNaN(count) && count >= 1 && count <= MUSCLE_GROUP_CONFIG.MAX_SESSIONS ? count : 3;
  },

  logWarning(message, data = null) {
    if (import.meta.env.DEV) {
      console.warn(`[FuncionalMuscleGroups] ${message}`, data);
    }
  }
};

export const FUNCIONAL_MUSCLE_GROUPS = {
  empuje: {
    id: 'empuje',
    name: 'Empuje Funcional',
    description: 'Patrones de empuje aplicados a movimientos funcionales',
    primaryMuscles: [
      'Pectorales',
      'Deltoides anterior y medio',
      'Tríceps',
      'Serrato anterior'
    ],
    secondaryMuscles: [
      'Core (estabilización)',
      'Deltoides posterior',
      'Trapecio',
      'Estabilizadores escapulares'
    ],
    movementPatterns: [
      'Push horizontal (flexiones y variantes)',
      'Push vertical (press overhead, handstand)',
      'Push angular (landmine, press inclinado)'
    ],
    commonExercises: [
      'Flexiones (todas las variantes)',
      'Press overhead con kettlebell',
      'Turkish get-up',
      'Press landmine unilateral',
      'Handstand push-ups (avanzado)'
    ],
    progressionPrinciples: [
      'Aumentar dificultad del patrón',
      'Añadir inestabilidad (TRX, anillas)',
      'Incrementar carga externa',
      'Trabajo unilateral'
    ],
    ...MUSCLE_GROUP_THEMES.empuje
  },
  traccion: {
    id: 'traccion',
    name: 'Tracción Funcional',
    description: 'Patrones de tracción y control escapular',
    primaryMuscles: [
      'Latíssimo dorsi',
      'Trapecio medio e inferior',
      'Romboides',
      'Bíceps y braquial'
    ],
    secondaryMuscles: [
      'Deltoides posterior',
      'Infraespinoso',
      'Core (estabilización)',
      'Flexores de antebrazo'
    ],
    movementPatterns: [
      'Pull vertical (dominadas, muscle-up)',
      'Pull horizontal (remo TRX, remo invertido)',
      'Face pulls (salud de hombro)'
    ],
    commonExercises: [
      'Dominadas y variantes',
      'Remo TRX o invertido',
      'Dead hang (cuelgue)',
      'Face pulls funcionales',
      'Muscle-up (avanzado)'
    ],
    progressionPrinciples: [
      'Reducir asistencia gradualmente',
      'Aumentar rango de movimiento',
      'Variar agarre y estabilidad',
      'Añadir lastre'
    ],
    ...MUSCLE_GROUP_THEMES.traccion
  },
  piernas: {
    id: 'piernas',
    name: 'Piernas Funcionales',
    description: 'Patrones de piernas multiarticulares y locomoción',
    primaryMuscles: [
      'Cuádriceps',
      'Glúteos',
      'Isquiotibiales',
      'Gastrocnemios y sóleo'
    ],
    secondaryMuscles: [
      'Aductores',
      'Glúteo medio (estabilización)',
      'Core (estabilización)',
      'Erectores espinales'
    ],
    movementPatterns: [
      'Squat (sentadilla bilateral y unilateral)',
      'Hinge (bisagra de cadera - peso muerto)',
      'Locomotion (lunges, step-ups, carries)',
      'Plyometrics (saltos, box jumps)'
    ],
    commonExercises: [
      'Sentadilla goblet',
      'Peso muerto a una pierna',
      'Sentadilla búlgara',
      'Step-ups',
      'Box jumps',
      'Pistol squat (avanzado)'
    ],
    progressionPrinciples: [
      'Progresión unilateral',
      'Aumentar carga externa',
      'Añadir componente pliométrico',
      'Incrementar altura/distancia'
    ],
    ...MUSCLE_GROUP_THEMES.piernas
  },
  core: {
    id: 'core',
    name: 'Core Funcional',
    description: 'Estabilización del tronco y transferencia de fuerza',
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
      'Psoas',
      'Cuadrado lumbar',
      'Glúteos (estabilización)'
    ],
    movementPatterns: [
      'Anti-extension (plancha, dead bug)',
      'Anti-rotation (pallof press, bird dog)',
      'Anti-flexión lateral (plancha lateral, carry unilateral)',
      'Rotation controlada (russian twist, woodchop)'
    ],
    commonExercises: [
      'Plancha y variantes',
      'Dead bug',
      'Bird dog',
      'Pallof press',
      'L-sit (intermedio-avanzado)',
      'Dragon flag (avanzado)'
    ],
    progressionPrinciples: [
      'Aumentar tiempo bajo tensión',
      'Reducir puntos de apoyo',
      'Añadir movimiento dinámico',
      'Incrementar resistencia externa'
    ],
    ...MUSCLE_GROUP_THEMES.core
  },
  pliometrico: {
    id: 'pliometrico',
    name: 'Pliométrico',
    description: 'Trabajo de potencia y explosividad',
    primaryMuscles: [
      'Fibras musculares de contracción rápida (todo el cuerpo)',
      'Sistema neuromuscular',
      'Tendones (almacenamiento de energía elástica)'
    ],
    secondaryMuscles: [
      'Estabilizadores articulares',
      'Core (absorción de impacto)',
      'Sistema propioceptivo'
    ],
    movementPatterns: [
      'Saltos verticales (box jumps, squat jumps)',
      'Saltos horizontales (broad jumps)',
      'Saltos laterales y multidireccionales',
      'Plyometric upper (clapping push-ups, medicine ball throws)'
    ],
    commonExercises: [
      'Box jumps',
      'Broad jumps',
      'Burpees',
      'Medicine ball slams',
      'Clapping push-ups (avanzado)',
      'Depth jumps (avanzado)'
    ],
    progressionPrinciples: [
      'Aumentar altura o distancia',
      'Incrementar velocidad de ejecución',
      'Añadir peso externo',
      'Reducir tiempo de contacto con suelo'
    ],
    ...MUSCLE_GROUP_THEMES.pliometrico
  },
  movilidad: {
    id: 'movilidad',
    name: 'Movilidad',
    description: 'Rango de movimiento articular y control motor',
    primaryMuscles: [
      'Todos los grupos musculares (elongación activa)',
      'Fascia y tejido conectivo',
      'Cápsulas articulares'
    ],
    secondaryMuscles: [
      'Estabilizadores profundos',
      'Músculos posturales',
      'Sistema propioceptivo'
    ],
    movementPatterns: [
      'Flexión-extensión de columna (cat-cow)',
      'Rotaciones torácicas',
      'Movilidad de cadera (círculos, 90/90)',
      'Movilidad de hombro (dislocaciones, rotaciones)'
    ],
    commonExercises: [
      'Cat-cow',
      'Rotaciones torácicas',
      'Hip circles',
      '90/90 hip switch',
      'Shoulder dislocations',
      'World\'s greatest stretch'
    ],
    progressionPrinciples: [
      'Aumentar amplitud de movimiento',
      'Añadir carga ligera',
      'Incrementar control excéntrico',
      'Trabajo de movilidad activa'
    ],
    ...MUSCLE_GROUP_THEMES.movilidad
  },
  carga: {
    id: 'carga',
    name: 'Carga y Transporte',
    description: 'Movimientos de carga con aplicación funcional',
    primaryMuscles: [
      'Core (estabilización bajo carga)',
      'Trapecios',
      'Erectores espinales',
      'Glúteos y piernas'
    ],
    secondaryMuscles: [
      'Flexores de antebrazo (grip)',
      'Estabilizadores de hombro',
      'Oblicuos (resistencia a flexión lateral)',
      'Sistema cardiovascular'
    ],
    movementPatterns: [
      'Carry bilateral (farmer carry)',
      'Carry unilateral (suitcase carry)',
      'Carry overhead (waiter carry)',
      'Lift and carry (sandbag, yoke)'
    ],
    commonExercises: [
      'Farmer carry',
      'Suitcase carry',
      'Waiter carry (avanzado)',
      'Sandbag carry',
      'Yoke walk (avanzado)'
    ],
    progressionPrinciples: [
      'Aumentar carga transportada',
      'Incrementar distancia',
      'Variar posición de carga',
      'Añadir componente unilateral'
    ],
    ...MUSCLE_GROUP_THEMES.carga
  }
};

/**
 * Obtener información de un grupo muscular específico
 * @param {string} groupId - ID del grupo muscular
 * @returns {Object|null} Información del grupo muscular con validación
 */
export function getMuscleGroupInfo(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    MuscleGroupValidationUtils.logWarning('getMuscleGroupInfo called with invalid groupId', { groupId });
    return null;
  }

  return FUNCIONAL_MUSCLE_GROUPS[groupId.toLowerCase().trim()] || null;
}

/**
 * Obtener todos los grupos musculares
 * @returns {Array} Array de todos los grupos musculares
 */
export function getAllMuscleGroups() {
  return Object.values(FUNCIONAL_MUSCLE_GROUPS);
}

/**
 * Obtener grupos musculares principales (sin movilidad)
 * @returns {Array} Grupos musculares básicos
 */
export function getBasicMuscleGroups() {
  return Object.values(FUNCIONAL_MUSCLE_GROUPS).filter(group => group.id !== 'movilidad');
}

/**
 * Obtener grupos musculares recomendados por nivel
 * @param {string} level - Nivel del usuario
 * @returns {Array} Grupos musculares apropiados para el nivel
 */
export function getRecommendedGroupsByLevel(level) {
  const sanitizedLevel = MuscleGroupValidationUtils.sanitizeLevel(level);
  const allGroups = getAllMuscleGroups();

  // Configuración de grupos por nivel
  const LEVEL_GROUP_MAPPING = {
    principiante: ['empuje', 'traccion', 'piernas', 'core', 'movilidad'],
    intermedio: ['empuje', 'traccion', 'piernas', 'core', 'pliometrico', 'movilidad', 'carga'],
    avanzado: Object.keys(FUNCIONAL_MUSCLE_GROUPS) // Todos los grupos
  };

  const allowedGroups = LEVEL_GROUP_MAPPING[sanitizedLevel] || LEVEL_GROUP_MAPPING.principiante;

  return allGroups.filter(group => allowedGroups.includes(group.id));
}

/**
 * Generar plan de entrenamiento balanceado por grupos musculares
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
        muscleGroups: ['empuje', 'traccion', 'piernas', 'core'],
        focus: index % 2 === 0 ? MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH : MUSCLE_GROUP_CONFIG.FOCUS_TYPES.POWER,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel] || MUSCLE_GROUP_CONFIG.DURATIONS.principiante
      }))
    };
  } else {
    // Split approach con configuración centralizada
    const SPLIT_CONFIGURATIONS = {
      4: [
        { day: 1, groups: ['empuje', 'core'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 2, groups: ['traccion', 'piernas'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 3, groups: ['pliometrico', 'movilidad'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.POWER },
        { day: 4, groups: ['empuje', 'traccion', 'carga'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.ENDURANCE }
      ],
      5: [
        { day: 1, groups: ['empuje'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 2, groups: ['traccion'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 3, groups: ['piernas', 'core'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.STRENGTH },
        { day: 4, groups: ['pliometrico', 'movilidad'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.POWER },
        { day: 5, groups: ['empuje', 'traccion', 'carga'], focus: MUSCLE_GROUP_CONFIG.FOCUS_TYPES.ENDURANCE }
      ]
    };

    const selectedSplit = SPLIT_CONFIGURATIONS[Math.min(validatedSessions, MUSCLE_GROUP_CONFIG.MAX_SESSIONS)] ||
                         SPLIT_CONFIGURATIONS[4];

    return {
      type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.SPLIT,
      sessions: selectedSplit.map(session => ({
        ...session,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel] || MUSCLE_GROUP_CONFIG.DURATIONS.principiante,
        // Filtrar grupos que no están disponibles para el nivel
        groups: session.groups.filter(groupId =>
          recommendedGroups.some(group => group.id === groupId)
        )
      }))
    };
  }
}

/**
 * Obtener ejercicios complementarios entre grupos musculares
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
    empuje: ['core', 'movilidad'],
    traccion: ['core', 'movilidad'],
    piernas: ['core', 'movilidad'],
    core: ['empuje', 'traccion'],
    pliometrico: ['core', 'movilidad'],
    movilidad: ['empuje', 'traccion', 'piernas'],
    carga: ['core']
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
    mobilityGroups: allGroups.length - basicGroups.length,
    groupTypes: Object.keys(FUNCIONAL_MUSCLE_GROUPS),
    availableThemes: Object.keys(MUSCLE_GROUP_THEMES),
    supportedLevels: Object.keys(MUSCLE_GROUP_CONFIG.DURATIONS)
  };
}

export default FUNCIONAL_MUSCLE_GROUPS;
