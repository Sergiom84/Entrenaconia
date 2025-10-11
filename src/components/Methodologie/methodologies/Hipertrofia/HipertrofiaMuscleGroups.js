/**
 * Grupos Musculares y Splits para Hipertrofia - v1.0 Profesional
 * Clasificación científica basada en volumen y periodización
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 1.0.0
 */

// Configuraciones centralizadas
const MUSCLE_GROUP_CONFIG = {
  DURATIONS: {
    principiante: 50,
    intermedio: 65,
    avanzado: 80
  },
  SPLIT_TYPES: {
    FULL_BODY: 'full_body',
    UPPER_LOWER: 'upper_lower',
    PUSH_PULL_LEGS: 'push_pull_legs'
  },
  SESSION_THRESHOLD: {
    FULL_BODY: 3,
    UPPER_LOWER: 4,
    PPL: 5
  },
  MAX_SESSIONS: 6
};

// Sistema de tema consistente
const MUSCLE_GROUP_THEMES = {
  pecho: {
    color: 'bg-red-100 border-red-300',
    darkColor: 'bg-red-900/20 border-red-400/30',
    icon: '💪',
    themeColor: 'red-400'
  },
  espalda: {
    color: 'bg-blue-100 border-blue-300',
    darkColor: 'bg-blue-900/20 border-blue-400/30',
    icon: '🦾',
    themeColor: 'blue-400'
  },
  piernas: {
    color: 'bg-green-100 border-green-300',
    darkColor: 'bg-green-900/20 border-green-400/30',
    icon: '🦵',
    themeColor: 'green-400'
  },
  hombros: {
    color: 'bg-yellow-100 border-yellow-300',
    darkColor: 'bg-yellow-900/20 border-yellow-400/30',
    icon: '🏋️',
    themeColor: 'yellow-400'
  },
  brazos: {
    color: 'bg-purple-100 border-purple-300',
    darkColor: 'bg-purple-900/20 border-purple-400/30',
    icon: '💪',
    themeColor: 'purple-400'
  },
  core: {
    color: 'bg-orange-100 border-orange-300',
    darkColor: 'bg-orange-900/20 border-orange-400/30',
    icon: '🎯',
    themeColor: 'orange-400'
  }
};

// Utilidades de validación
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
      console.warn(`[HipertrofiaMuscleGroups] ${message}`, data);
    }
  }
};

export const HIPERTROFIA_MUSCLE_GROUPS = {
  pecho: {
    id: 'pecho',
    name: 'Pecho',
    description: 'Desarrollo completo del pectoral con variedad angular',
    primaryMuscles: [
      'Pectoral mayor (porción clavicular)',
      'Pectoral mayor (porción esternocostal)',
      'Pectoral menor'
    ],
    secondaryMuscles: [
      'Deltoides anterior',
      'Tríceps braquial',
      'Serrato anterior',
      'Core (estabilización)'
    ],
    movementPatterns: [
      'Empuje horizontal (press plano)',
      'Empuje inclinado (fibras superiores)',
      'Empuje declinado (fibras inferiores)',
      'Aducción horizontal (aperturas)'
    ],
    commonExercises: [
      'Press de banca con barra',
      'Press inclinado con mancuernas',
      'Aperturas con mancuernas',
      'Cruces en polea',
      'Fondos en paralelas'
    ],
    progressionPrinciples: [
      'Variar ángulos de trabajo (plano, inclinado, declinado)',
      'Combinar ejercicios compuestos y aislamiento',
      'Técnicas de intensidad: drop sets, pre-agotamiento',
      'Volumen progresivo por semana'
    ],
    ...MUSCLE_GROUP_THEMES.pecho
  },

  espalda: {
    id: 'espalda',
    name: 'Espalda',
    description: 'Desarrollo de ancho dorsal y grosor de espalda',
    primaryMuscles: [
      'Latíssimo dorsi',
      'Romboides',
      'Trapecio (medio e inferior)',
      'Redondo mayor'
    ],
    secondaryMuscles: [
      'Deltoides posterior',
      'Bíceps braquial',
      'Erectores espinales',
      'Flexores de antebrazo'
    ],
    movementPatterns: [
      'Tracción vertical (dominadas, jalón)',
      'Tracción horizontal (remos)',
      'Retracción escapular'
    ],
    commonExercises: [
      'Dominadas',
      'Jalón al pecho',
      'Remo con barra',
      'Remo con mancuerna',
      'Face pulls'
    ],
    progressionPrinciples: [
      'Priorizar movimientos compuestos pesados',
      'Variar agarres (prono, supino, neutro)',
      'Aumentar volumen gradualmente',
      'Trabajo de grosor y ancho separado'
    ],
    ...MUSCLE_GROUP_THEMES.espalda
  },

  piernas: {
    id: 'piernas',
    name: 'Piernas',
    description: 'Desarrollo completo de cuádriceps, femorales y glúteos',
    primaryMuscles: [
      'Cuádriceps (vasto medial, lateral, intermedio, recto femoral)',
      'Isquiotibiales (bíceps femoral, semitendinoso, semimembranoso)',
      'Glúteo mayor',
      'Gastrocnemio y sóleo'
    ],
    secondaryMuscles: [
      'Glúteo medio y menor',
      'Aductores',
      'Tibial anterior',
      'Core (estabilización)',
      'Erectores espinales'
    ],
    movementPatterns: [
      'Sentadilla (flexión de rodilla y cadera)',
      'Extensión de cadera (peso muerto, hip thrust)',
      'Flexión de rodilla aislada (curl femoral)',
      'Extensión de rodilla aislada (extensiones)'
    ],
    commonExercises: [
      'Sentadilla con barra',
      'Prensa de piernas',
      'Peso muerto rumano',
      'Zancadas',
      'Curl femoral',
      'Extensiones de cuádriceps'
    ],
    progressionPrinciples: [
      'Alto volumen (20-25 series/semana)',
      'Combinar rangos de reps (6-20)',
      'Trabajo bilateral y unilateral',
      'Énfasis en cuádriceps y femorales equilibrado'
    ],
    ...MUSCLE_GROUP_THEMES.piernas
  },

  hombros: {
    id: 'hombros',
    name: 'Hombros',
    description: 'Desarrollo de deltoides anterior, medio y posterior',
    primaryMuscles: [
      'Deltoides anterior',
      'Deltoides medio',
      'Deltoides posterior'
    ],
    secondaryMuscles: [
      'Trapecio superior',
      'Supraespinoso',
      'Tríceps braquial (en press)',
      'Serrato anterior'
    ],
    movementPatterns: [
      'Empuje vertical (press militar)',
      'Abducción lateral (elevaciones laterales)',
      'Extensión horizontal (pájaros, face pulls)'
    ],
    commonExercises: [
      'Press militar con barra',
      'Press Arnold',
      'Elevaciones laterales',
      'Remo al mentón',
      'Face pulls',
      'Pájaros con mancuernas'
    ],
    progressionPrinciples: [
      'Trabajo equilibrado de las 3 porciones',
      'Volumen moderado (evitar sobreuso)',
      'Técnica estricta en elevaciones',
      'Rango completo de movimiento'
    ],
    ...MUSCLE_GROUP_THEMES.hombros
  },

  brazos: {
    id: 'brazos',
    name: 'Brazos',
    description: 'Desarrollo de bíceps y tríceps con volumen controlado',
    primaryMuscles: [
      'Bíceps braquial',
      'Braquial',
      'Tríceps braquial (cabeza larga, lateral, medial)'
    ],
    secondaryMuscles: [
      'Braquiorradial',
      'Flexores de antebrazo',
      'Ancóneo'
    ],
    movementPatterns: [
      'Flexión de codo (curl)',
      'Extensión de codo (press, extensiones)'
    ],
    commonExercises: [
      'Curl con barra',
      'Curl martillo',
      'Curl inclinado',
      'Press francés',
      'Extensiones en polea',
      'Fondos para tríceps'
    ],
    progressionPrinciples: [
      'Volumen moderado (15-20 series/semana total)',
      'Combinar ejercicios compuestos y aislamiento',
      'Variar ángulos y agarres',
      'Tempo controlado en excéntrica'
    ],
    ...MUSCLE_GROUP_THEMES.brazos
  },

  core: {
    id: 'core',
    name: 'Core',
    description: 'Desarrollo de abdominales y estabilizadores del tronco',
    primaryMuscles: [
      'Recto abdominal',
      'Oblicuos externos e internos',
      'Transverso abdominal'
    ],
    secondaryMuscles: [
      'Erectores espinales',
      'Cuadrado lumbar',
      'Psoas mayor',
      'Diafragma'
    ],
    movementPatterns: [
      'Anti-extensión (plancha)',
      'Flexión de tronco (crunch)',
      'Anti-rotación (pallof press)',
      'Anti-flexión lateral'
    ],
    commonExercises: [
      'Plancha abdominal',
      'Crunch',
      'Elevaciones de piernas',
      'Rueda abdominal',
      'Pallof press',
      'L-sit'
    ],
    progressionPrinciples: [
      'Volumen moderado (2-3 veces/semana)',
      'Enfoque en control y tiempo bajo tensión',
      'Combinación de isométricos y dinámicos',
      'Progresión en dificultad antes que volumen'
    ],
    ...MUSCLE_GROUP_THEMES.core
  }
};

/**
 * Obtener información de un grupo muscular específico
 */
export function getMuscleGroupInfo(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    MuscleGroupValidationUtils.logWarning('getMuscleGroupInfo called with invalid groupId', { groupId });
    return null;
  }

  return HIPERTROFIA_MUSCLE_GROUPS[groupId.toLowerCase().trim()] || null;
}

/**
 * Obtener todos los grupos musculares
 */
export function getAllMuscleGroups() {
  return Object.values(HIPERTROFIA_MUSCLE_GROUPS);
}

/**
 * Obtener grupos musculares principales (sin core)
 */
export function getBasicMuscleGroups() {
  return Object.values(HIPERTROFIA_MUSCLE_GROUPS).filter(group => group.id !== 'core');
}

/**
 * Obtener grupos musculares recomendados por nivel
 */
export function getRecommendedGroupsByLevel(level) {
  const sanitizedLevel = MuscleGroupValidationUtils.sanitizeLevel(level);
  const allGroups = getAllMuscleGroups();

  // En hipertrofia todos los niveles trabajan todos los grupos
  return allGroups;
}

/**
 * Generar plan de entrenamiento balanceado por grupos musculares
 */
export function generateBalancedSplit(level, sessionsPerWeek) {
  const sanitizedLevel = MuscleGroupValidationUtils.sanitizeLevel(level);
  const validatedSessions = MuscleGroupValidationUtils.validateSessionCount(sessionsPerWeek);

  // FULL BODY (3 días)
  if (validatedSessions <= MUSCLE_GROUP_CONFIG.SESSION_THRESHOLD.FULL_BODY) {
    return {
      type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.FULL_BODY,
      name: 'Full Body 3x',
      sessions: [
        {
          sessionNumber: 1,
          name: 'Full Body A',
          muscleGroups: ['pecho', 'espalda', 'piernas'],
          focus: 'Compuestos principales',
          exercises: sanitizedLevel === 'principiante' ? 6 : 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 2,
          name: 'Full Body B',
          muscleGroups: ['hombros', 'brazos', 'core'],
          focus: 'Accesorios y estabilización',
          exercises: sanitizedLevel === 'principiante' ? 6 : 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 3,
          name: 'Full Body C',
          muscleGroups: ['piernas', 'pecho', 'espalda'],
          focus: 'Volumen adicional',
          exercises: sanitizedLevel === 'principiante' ? 6 : 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        }
      ]
    };
  }

  // UPPER/LOWER (4 días)
  if (validatedSessions === MUSCLE_GROUP_CONFIG.SESSION_THRESHOLD.UPPER_LOWER) {
    return {
      type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.UPPER_LOWER,
      name: 'Upper/Lower 4x',
      sessions: [
        {
          sessionNumber: 1,
          name: 'Upper A (Empuje)',
          muscleGroups: ['pecho', 'hombros', 'brazos'],
          focus: 'Empuje horizontal y vertical',
          exercises: 8,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 2,
          name: 'Lower A',
          muscleGroups: ['piernas', 'core'],
          focus: 'Cuádriceps dominante',
          exercises: 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 3,
          name: 'Upper B (Tracción)',
          muscleGroups: ['espalda', 'brazos'],
          focus: 'Tracción vertical y horizontal',
          exercises: 8,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 4,
          name: 'Lower B',
          muscleGroups: ['piernas'],
          focus: 'Femorales y glúteos dominante',
          exercises: 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        }
      ]
    };
  }

  // PUSH/PULL/LEGS (5-6 días)
  if (validatedSessions === 5) {
    return {
      type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.PUSH_PULL_LEGS,
      name: 'Push/Pull/Legs 5x',
      sessions: [
        {
          sessionNumber: 1,
          name: 'Push A (Pecho énfasis)',
          muscleGroups: ['pecho', 'hombros', 'brazos'],
          focus: 'Empuje con énfasis pectoral',
          exercises: 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 2,
          name: 'Pull',
          muscleGroups: ['espalda', 'brazos'],
          focus: 'Tracción completa',
          exercises: 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 3,
          name: 'Legs',
          muscleGroups: ['piernas', 'core'],
          focus: 'Piernas completas',
          exercises: 8,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 4,
          name: 'Push B (Hombros énfasis)',
          muscleGroups: ['hombros', 'pecho', 'brazos'],
          focus: 'Empuje con énfasis deltoides',
          exercises: 7,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        },
        {
          sessionNumber: 5,
          name: 'Pull + Accesorios',
          muscleGroups: ['espalda', 'core'],
          focus: 'Espalda y core',
          exercises: 6,
          duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
        }
      ]
    };
  }

  // 6 días (PPL x2)
  return {
    type: MUSCLE_GROUP_CONFIG.SPLIT_TYPES.PUSH_PULL_LEGS,
    name: 'Push/Pull/Legs 6x (PPL x2)',
    sessions: [
      {
        sessionNumber: 1,
        name: 'Push A',
        muscleGroups: ['pecho', 'hombros', 'brazos'],
        focus: 'Empuje pesado',
        exercises: 7,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
      },
      {
        sessionNumber: 2,
        name: 'Pull A',
        muscleGroups: ['espalda', 'brazos'],
        focus: 'Tracción pesada',
        exercises: 7,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
      },
      {
        sessionNumber: 3,
        name: 'Legs A',
        muscleGroups: ['piernas'],
        focus: 'Piernas pesadas',
        exercises: 8,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
      },
      {
        sessionNumber: 4,
        name: 'Push B',
        muscleGroups: ['hombros', 'pecho', 'brazos'],
        focus: 'Empuje volumen',
        exercises: 7,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
      },
      {
        sessionNumber: 5,
        name: 'Pull B',
        muscleGroups: ['espalda'],
        focus: 'Tracción volumen',
        exercises: 7,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
      },
      {
        sessionNumber: 6,
        name: 'Legs B + Core',
        muscleGroups: ['piernas', 'core'],
        focus: 'Piernas volumen + core',
        exercises: 7,
        duration: MUSCLE_GROUP_CONFIG.DURATIONS[sanitizedLevel]
      }
    ]
  };
}

/**
 * Obtener ejercicios complementarios entre grupos musculares
 */
export function getComplementaryGroups(primaryGroup) {
  if (!primaryGroup || typeof primaryGroup !== 'string') {
    MuscleGroupValidationUtils.logWarning('getComplementaryGroups called with invalid primaryGroup', { primaryGroup });
    return [];
  }

  const COMPLEMENTARY_GROUP_MAPPING = {
    pecho: ['hombros', 'brazos'],
    espalda: ['brazos', 'core'],
    piernas: ['core'],
    hombros: ['pecho', 'brazos'],
    brazos: ['pecho', 'espalda'],
    core: ['piernas']
  };

  const sanitizedGroup = primaryGroup.toLowerCase().trim();
  return COMPLEMENTARY_GROUP_MAPPING[sanitizedGroup] || [];
}

/**
 * Obtener información de tema para un grupo muscular
 */
export function getMuscleGroupTheme(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    return null;
  }

  return MUSCLE_GROUP_THEMES[groupId.toLowerCase().trim()] || null;
}

/**
 * Obtener estadísticas de grupos musculares
 */
export function getMuscleGroupStats() {
  const allGroups = getAllMuscleGroups();
  const basicGroups = getBasicMuscleGroups();

  return {
    totalGroups: allGroups.length,
    basicGroups: basicGroups.length,
    coreGroups: allGroups.length - basicGroups.length,
    groupTypes: Object.keys(HIPERTROFIA_MUSCLE_GROUPS),
    availableThemes: Object.keys(MUSCLE_GROUP_THEMES),
    supportedLevels: Object.keys(MUSCLE_GROUP_CONFIG.DURATIONS)
  };
}

export default HIPERTROFIA_MUSCLE_GROUPS;
