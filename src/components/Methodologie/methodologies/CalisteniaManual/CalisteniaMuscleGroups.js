/**
 * Grupos Musculares y Patrones de Movimiento para Calistenia
 * Clasificación científica basada en biomecánica y funcionalidad
 * 
 * @author Claude Code - Arquitectura Modular
 * @version 1.0.0
 */

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
    color: 'bg-blue-50 border-blue-200',
    icon: '💪'
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
    color: 'bg-green-50 border-green-200', 
    icon: '🏋️'
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
    color: 'bg-yellow-50 border-yellow-200',
    icon: '🦵'
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
    color: 'bg-purple-50 border-purple-200',
    icon: '🌟'
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
    color: 'bg-red-50 border-red-200',
    icon: '🎯'
  }
};

/**
 * Obtener información de un grupo muscular específico
 * @param {string} groupId - ID del grupo muscular
 * @returns {Object|null} Información del grupo muscular
 */
export function getMuscleGroupInfo(groupId) {
  return CALISTENIA_MUSCLE_GROUPS[groupId?.toLowerCase()] || null;
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
 * Obtener grupos musculares recomendados por nivel
 * @param {string} level - Nivel del usuario
 * @returns {Array} Grupos musculares apropiados para el nivel
 */
export function getRecommendedGroupsByLevel(level) {
  const allGroups = getAllMuscleGroups();
  
  switch (level?.toLowerCase()) {
    case 'basico':
      return allGroups.filter(group => 
        ['empuje', 'traccion', 'piernas', 'core'].includes(group.id)
      );
    case 'intermedio':
      return allGroups.filter(group =>
        ['empuje', 'traccion', 'piernas', 'core', 'habilidades'].includes(group.id)
      );
    case 'avanzado':
      return allGroups; // Todos los grupos
    default:
      return getBasicMuscleGroups();
  }
}

/**
 * Generar plan de entrenamiento balanceado por grupos musculares
 * @param {string} level - Nivel del usuario
 * @param {number} sessionsPerWeek - Sesiones por semana
 * @returns {Object} Distribución de grupos musculares por sesión
 */
export function generateBalancedSplit(level, sessionsPerWeek) {
  const recommendedGroups = getRecommendedGroupsByLevel(level);
  
  if (sessionsPerWeek <= 3) {
    // Full body approach
    return {
      type: 'full_body',
      sessions: Array(sessionsPerWeek).fill().map((_, index) => ({
        sessionNumber: index + 1,
        muscleGroups: recommendedGroups.map(group => group.id),
        focus: index % 2 === 0 ? 'strength' : 'skill',
        duration: level === 'basico' ? 45 : level === 'intermedio' ? 60 : 75
      }))
    };
  } else {
    // Split approach
    const splits = {
      4: [
        { day: 1, groups: ['empuje', 'core'], focus: 'strength' },
        { day: 2, groups: ['traccion', 'piernas'], focus: 'strength' },  
        { day: 3, groups: ['habilidades', 'core'], focus: 'skill' },
        { day: 4, groups: ['empuje', 'traccion'], focus: 'endurance' }
      ],
      5: [
        { day: 1, groups: ['empuje'], focus: 'strength' },
        { day: 2, groups: ['traccion'], focus: 'strength' },
        { day: 3, groups: ['piernas', 'core'], focus: 'strength' },
        { day: 4, groups: ['habilidades'], focus: 'skill' },
        { day: 5, groups: ['empuje', 'traccion'], focus: 'endurance' }
      ],
      6: [
        { day: 1, groups: ['empuje'], focus: 'strength' },
        { day: 2, groups: ['traccion'], focus: 'strength' },
        { day: 3, groups: ['piernas'], focus: 'strength' },
        { day: 4, groups: ['core', 'habilidades'], focus: 'skill' },
        { day: 5, groups: ['empuje'], focus: 'endurance' },
        { day: 6, groups: ['traccion'], focus: 'endurance' }
      ]
    };
    
    return {
      type: 'split',
      sessions: splits[Math.min(sessionsPerWeek, 6)] || splits[4]
    };
  }
}

/**
 * Obtener ejercicios complementarios entre grupos musculares
 * @param {string} primaryGroup - Grupo muscular principal
 * @returns {Array} Grupos musculares complementarios
 */
export function getComplementaryGroups(primaryGroup) {
  const complementaryMap = {
    empuje: ['core', 'traccion'],
    traccion: ['core', 'empuje'], 
    piernas: ['core'],
    core: ['empuje', 'traccion'],
    habilidades: ['core']
  };
  
  return complementaryMap[primaryGroup?.toLowerCase()] || [];
}

export default CALISTENIA_MUSCLE_GROUPS;