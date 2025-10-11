/**
 * HeavyDutyLevels.js - Configuración de Niveles Heavy Duty
 * =========================================================
 *
 * Define los niveles de entrenamiento Heavy Duty basados en la metodología de Mike Mentzer:
 * - Principiante: Introducción al fallo muscular controlado
 * - Intermedio: Dominio de intensidad máxima
 * - Avanzado: Maestría del entrenamiento al fallo absoluto
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 1.0.0
 */

// ============================================================================
// NIVELES HEAVY DUTY
// ============================================================================

export const HEAVY_DUTY_LEVELS = {
  principiante: {
    name: 'Principiante',
    icon: '🌱',
    description: 'Introducción al entrenamiento de alta intensidad con fallo muscular controlado',

    // Parámetros de entrenamiento
    frequency: '2 sesiones/semana',
    intensity: 'Media-Alta (70-80% 1RM)',
    setsPerExercise: '1-2 series efectivas',
    repsRange: '8-12 repeticiones',
    restBetweenSets: '3-5 minutos',
    restBetweenWorkouts: '3-4 días',

    // Hitos a alcanzar
    hitos: [
      'Dominar la técnica perfecta en ejercicios básicos compuestos',
      'Alcanzar el fallo muscular de forma controlada y segura',
      'Comprender la importancia de descansos prolongados',
      'Diferenciar entre series efectivas y volumen innecesario',
      'Desarrollar conexión mente-músculo en cada repetición'
    ],

    // Características técnicas
    technical: {
      intensityRange: '70-80% 1RM',
      timeUnderTension: '40-70 segundos',
      cadence: '2-1-3 (subida-pausa-bajada)',
      failureType: 'Fallo muscular controlado (con seguridad)',
      restProtocol: {
        betweenSets: '3-5 minutos',
        betweenMuscleGroups: '4 días',
        betweenWorkouts: '3-4 días'
      },
      workoutDuration: '30-45 minutos',
      exercisesPerMuscle: '1-2 ejercicios compuestos'
    },

    // Ejercicios recomendados
    recommendedExercises: [
      'Press de pecho en máquina',
      'Jalón al pecho en polea',
      'Prensa de piernas',
      'Press de hombros en máquina',
      'Curl con barra',
      'Extensiones de tríceps en polea'
    ],

    // Equipamiento prioritario
    equipmentPriority: ['Máquinas', 'Poleas', 'Mancuernas ligeras'],

    // Progresión
    progression: {
      method: 'Aumento gradual de carga',
      trigger: 'Completar 12 reps con buena técnica en 2 sesiones consecutivas',
      increment: '2.5-5 kg (5-10 lbs)',
      notes: 'La técnica nunca se sacrifica por más peso'
    }
  },

  intermedio: {
    name: 'Intermedio',
    icon: '⚡',
    description: 'Dominio de la intensidad máxima con fallo muscular absoluto',

    frequency: '2-3 sesiones/semana',
    intensity: 'Muy Alta (80-90% 1RM)',
    setsPerExercise: '1 serie efectiva al fallo',
    repsRange: '6-10 repeticiones',
    restBetweenSets: '5-7 minutos',
    restBetweenWorkouts: '4-7 días',

    hitos: [
      'Fallo muscular absoluto con total seguridad y control',
      'Recuperación óptima entre sesiones de alta intensidad',
      'Progresión constante en cargas a lo largo de 8-12 semanas',
      'Mentalidad inquebrantable de intensidad extrema',
      'Capacidad de auto-regular el volumen según recuperación'
    ],

    technical: {
      intensityRange: '80-90% 1RM',
      timeUnderTension: '50-90 segundos',
      cadence: '4-2-2 (énfasis en negativa lenta)',
      failureType: 'Fallo muscular absoluto (concéntrica imposible)',
      restProtocol: {
        betweenSets: '5-7 minutos (recuperación completa)',
        betweenMuscleGroups: '5-7 días',
        betweenWorkouts: '4-7 días'
      },
      workoutDuration: '45-60 minutos',
      exercisesPerMuscle: '1-2 ejercicios (1 compuesto + 1 aislamiento opcional)'
    },

    recommendedExercises: [
      'Press de banca con barra',
      'Sentadilla con barra',
      'Peso muerto rumano',
      'Remo con barra',
      'Press militar con barra',
      'Fondos en paralelas lastrados'
    ],

    equipmentPriority: ['Barra libre', 'Mancuernas', 'Máquinas (pre-agotamiento)'],

    progression: {
      method: 'Micro-progresión conservadora',
      trigger: 'Completar 10 reps al fallo absoluto en 2 sesiones',
      increment: '2.5 kg (5 lbs) - nunca más',
      notes: 'La progresión lenta es la clave del éxito a largo plazo'
    },

    // Técnicas avanzadas permitidas
    advancedTechniques: [
      'Pre-agotamiento (aislamiento + compuesto)',
      'Negativas enfatizadas (6-8 segundos)',
      'Rest-pause (10-15 segundos + 2-3 reps)',
      'Static holds (mantener en punto de máxima tensión)'
    ]
  },

  avanzado: {
    name: 'Avanzado',
    icon: '💪',
    description: 'Maestría absoluta del entrenamiento al fallo - máxima eficiencia',

    frequency: '2 sesiones/semana',
    intensity: 'Máxima (85-95% 1RM)',
    setsPerExercise: '1 serie al fallo absoluto',
    repsRange: '5-8 repeticiones',
    restBetweenSets: '7-10 minutos',
    restBetweenWorkouts: '5-10 días',

    hitos: [
      'Una única serie genera el máximo estímulo posible de crecimiento',
      'Descansos de 7+ días sin pérdida de fuerza (supercompensación)',
      'Control mental extremo: cada repetición es una batalla',
      'Comprensión profunda de la recuperación completa',
      'Resultados continuos con volumen mínimo absoluto'
    ],

    technical: {
      intensityRange: '85-95% 1RM',
      timeUnderTension: '60-100 segundos',
      cadence: '4-3-1 (negativa ultra-controlada)',
      failureType: 'Fallo absoluto + técnicas de intensificación',
      restProtocol: {
        betweenSets: '7-10 minutos (recuperación total del sistema nervioso)',
        betweenMuscleGroups: '7-10 días',
        betweenWorkouts: '5-10 días'
      },
      workoutDuration: '45-75 minutos (máximo)',
      exercisesPerMuscle: '1 ejercicio compuesto (ocasional aislamiento pre-exhaustion)'
    },

    recommendedExercises: [
      'Press de banca con pausa (3 seg en pecho)',
      'Sentadilla con pausa en paralelo',
      'Peso muerto con deficit',
      'Dominadas lastradas',
      'Press militar tras nuca (movilidad permitiendo)',
      'Fondos lastrados con cadenas'
    ],

    equipmentPriority: ['Barra libre', 'Cadenas/Bandas (resistencia variable)', 'Máquinas (seguridad en fallo)'],

    progression: {
      method: 'Micro-dosificación extrema',
      trigger: 'Completar 8 reps al fallo absoluto + técnica avanzada',
      increment: '1.25-2.5 kg (2.5-5 lbs) - absolutamente conservador',
      notes: 'La paciencia es la virtud más importante. El progreso es inevitable con descanso adecuado.'
    },

    advancedTechniques: [
      'Pre-agotamiento avanzado (2 ejercicios sin descanso)',
      'Rest-pause triple (3 mini-series con 10-15 seg descanso)',
      'Negativas ultra-lentas (8-10 segundos)',
      'Drop sets mecánicos (cambio de ángulo, no de peso)',
      'Contrast sets (pesado-ligero-pesado)',
      'Static holds extremos (ISO-dinámico-ISO)'
    ],

    // Filosofía avanzada
    philosophy: [
      'Menos es más - una serie perfecta supera 10 mediocres',
      'El descanso es donde ocurre el crecimiento, no en el gimnasio',
      'La intensidad mental es tan importante como la física',
      'Nunca añadir volumen "por si acaso" - confía en el proceso',
      'La supercompensación requiere tiempo - resistir la tentación de entrenar'
    ]
  }
};

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Obtiene la configuración completa de un nivel
 * @param {string} levelKey - 'principiante', 'intermedio', o 'avanzado'
 * @returns {Object} Configuración del nivel
 */
export function getLevelConfig(levelKey) {
  const normalizedKey = levelKey?.toLowerCase();
  return HEAVY_DUTY_LEVELS[normalizedKey] || HEAVY_DUTY_LEVELS.principiante;
}

/**
 * Obtiene recomendaciones de entrenamiento para un nivel
 * @param {string} levelKey - Nivel del usuario
 * @returns {Object} Recomendaciones de entrenamiento
 */
export function getLevelRecommendations(levelKey) {
  const level = getLevelConfig(levelKey);

  return {
    // Frecuencia
    maxTrainingDaysPerWeek: levelKey === 'avanzado' ? 2 : levelKey === 'intermedio' ? 3 : 2,
    minRestDaysBetweenSessions: levelKey === 'avanzado' ? 5 : levelKey === 'intermedio' ? 4 : 3,

    // Volumen
    setsPerExercise: levelKey === 'avanzado' ? 1 : levelKey === 'intermedio' ? 1 : 2,
    exercisesPerMuscleGroup: levelKey === 'avanzado' ? 1 : levelKey === 'intermedio' ? 2 : 2,

    // Intensidad
    targetIntensity: level.technical.intensityRange,
    targetReps: level.repsRange,

    // Descansos
    restBetweenSets: level.technical.restProtocol.betweenSets,
    restBetweenMuscles: level.technical.restProtocol.betweenMuscleGroups,

    // Duración
    workoutDuration: level.technical.workoutDuration,

    // Técnicas permitidas
    advancedTechniquesAllowed: level.advancedTechniques || [],

    // Equipamiento
    preferredEquipment: level.equipmentPriority,

    // Progresión
    progressionMethod: level.progression
  };
}

/**
 * Valida si un usuario está listo para un nivel específico
 * @param {string} targetLevel - Nivel objetivo
 * @param {Object} userProfile - Perfil del usuario
 * @returns {Object} { ready: boolean, reason: string }
 */
export function validateLevelReadiness(targetLevel, userProfile) {
  const {
    anos_entrenando = 0,
    nivel_entrenamiento = 'principiante',
    experiencia_fallo_muscular = false
  } = userProfile;

  // Requisitos por nivel
  const requirements = {
    principiante: {
      minYearsTraining: 0,
      minLevel: 'principiante',
      failureExperience: false
    },
    intermedio: {
      minYearsTraining: 1,
      minLevel: 'intermedio',
      failureExperience: true
    },
    avanzado: {
      minYearsTraining: 3,
      minLevel: 'avanzado',
      failureExperience: true
    }
  };

  const req = requirements[targetLevel] || requirements.principiante;

  // Validaciones
  if (anos_entrenando < req.minYearsTraining) {
    return {
      ready: false,
      reason: `Se requieren al menos ${req.minYearsTraining} año(s) de experiencia en entrenamiento.`
    };
  }

  const levelOrder = ['principiante', 'intermedio', 'avanzado'];
  const userLevelIndex = levelOrder.indexOf(nivel_entrenamiento.toLowerCase());
  const requiredLevelIndex = levelOrder.indexOf(req.minLevel);

  if (userLevelIndex < requiredLevelIndex) {
    return {
      ready: false,
      reason: `Se requiere nivel ${req.minLevel} o superior. Tu nivel actual: ${nivel_entrenamiento}.`
    };
  }

  if (req.failureExperience && !experiencia_fallo_muscular) {
    return {
      ready: false,
      reason: 'Heavy Duty Intermedio/Avanzado requiere experiencia previa con entrenamiento al fallo muscular.'
    };
  }

  return {
    ready: true,
    reason: 'Usuario cumple con todos los requisitos para este nivel.'
  };
}

/**
 * Sugiere el nivel apropiado basándose en el perfil del usuario
 * @param {Object} userProfile - Perfil del usuario
 * @returns {string} Nivel sugerido ('principiante', 'intermedio', 'avanzado')
 */
export function suggestLevel(userProfile) {
  const {
    anos_entrenando = 0,
    nivel_entrenamiento = 'principiante',
    experiencia_fallo_muscular = false
  } = userProfile;

  // Lógica de sugerencia
  if (anos_entrenando >= 3 &&
      nivel_entrenamiento.toLowerCase() === 'avanzado' &&
      experiencia_fallo_muscular) {
    return 'avanzado';
  }

  if (anos_entrenando >= 1 &&
      (nivel_entrenamiento.toLowerCase() === 'intermedio' ||
       nivel_entrenamiento.toLowerCase() === 'avanzado') &&
      experiencia_fallo_muscular) {
    return 'intermedio';
  }

  return 'principiante';
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  HEAVY_DUTY_LEVELS,
  getLevelConfig,
  getLevelRecommendations,
  validateLevelReadiness,
  suggestLevel
};
