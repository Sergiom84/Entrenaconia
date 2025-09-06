/**
 * Configuración de Niveles para Calistenia Manual
 * Basado en criterios científicos de progresión
 * 
 * @author Claude Code - Arquitectura Modular
 * @version 1.0.0
 */

export const CALISTENIA_LEVELS = {
  'basico': {
    id: 'basico',
    name: 'Básico',
    description: '0-6 meses de entrenamiento',
    frequency: '2-3 días/semana',
    restDays: 'Descanso mínimo 48h entre sesiones',
    duration: '30-45 minutos por sesión',
    hitos: [
      '3-5 dominadas estrictas o 20-30s de chin-over-bar hold',
      '12-20 flexiones estrictas; 4-6 fondos en paralelas',
      'Hollow hold 40s y Arch 40s; Hang 30s',
      'Handstand 20-30s a pared (alineación aceptable)',
      '20 sentadillas controladas; pistol asistido 5/5'
    ],
    focus: [
      'Construcción de base de fuerza funcional',
      'Desarrollo de técnica correcta',
      'Familiarización con patrones de movimiento',
      'Mejora de movilidad y flexibilidad básica'
    ],
    equipment: ['Suelo', 'Pared', 'Barra (opcional)'],
    color: 'bg-green-100 border-green-300 text-green-800',
    icon: '🟢',
    recommendedProgression: 'Enfoque en movimientos básicos hasta dominar técnica perfecta'
  },
  'intermedio': {
    id: 'intermedio',
    name: 'Intermedio', 
    description: '6-24 meses de entrenamiento',
    frequency: '3-5 días/semana',
    restDays: 'Descanso activo recomendado',
    duration: '45-60 minutos por sesión',
    hitos: [
      '10-12 dominadas estrictas (prono/neutral)',
      '15-20 fondos; 30-40 flexiones estrictas',
      'L-sit 20-30s; handstand 60s a pared o 10-20s libre',
      'Muscle-up estricto (barra) 1-3 reps o 10+ ring dips sólidos',
      'Pistol 5-8/5-8 sin asistencia'
    ],
    focus: [
      'Progresión hacia habilidades avanzadas',
      'Desarrollo de fuerza unilateral',
      'Introducción a movimientos estáticos',
      'Refinamiento técnico en ejercicios complejos'
    ],
    equipment: ['Barra', 'Paralelas', 'Anillas (opcional)'],
    color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    icon: '🟡',
    recommendedProgression: 'Combinación de progresiones específicas y trabajo de volumen'
  },
  'avanzado': {
    id: 'avanzado',
    name: 'Avanzado',
    description: '24+ meses (18+ si alta adherencia)', 
    frequency: '4-6 días/semana',
    restDays: 'Periodización con fases de descarga',
    duration: '60-90 minutos por sesión',
    hitos: [
      'One-arm chin-up progresiones avanzadas',
      'Handstand push-ups y movimientos estáticos',
      'Planche, front lever, back lever progresiones',
      'Human flag y movimientos unilaterales complejos',
      'Dragon flags y V-sits controlados'
    ],
    focus: [
      'Habilidades de alta especialización técnica',
      'Desarrollo de fuerza máxima relativa',
      'Movimientos estáticos avanzados',
      'Trabajo artístico y de expresión corporal'
    ],
    equipment: ['Barra', 'Paralelas', 'Anillas', 'Barra sueca'],
    color: 'bg-red-100 border-red-300 text-red-800',
    icon: '🔴',
    recommendedProgression: 'Especialización en habilidades específicas con alto volumen técnico'
  }
};

/**
 * Obtener configuración de nivel por ID
 * @param {string} levelId - ID del nivel ('basico', 'intermedio', 'avanzado')
 * @returns {Object|null} Configuración del nivel
 */
export function getLevelConfig(levelId) {
  return CALISTENIA_LEVELS[levelId?.toLowerCase()] || null;
}

/**
 * Obtener todos los niveles disponibles
 * @returns {Array} Array de configuraciones de nivel
 */
export function getAllLevels() {
  return Object.values(CALISTENIA_LEVELS);
}

/**
 * Obtener nivel siguiente en la progresión
 * @param {string} currentLevel - Nivel actual
 * @returns {Object|null} Configuración del siguiente nivel
 */
export function getNextLevel(currentLevel) {
  const levels = ['basico', 'intermedio', 'avanzado'];
  const currentIndex = levels.indexOf(currentLevel?.toLowerCase());
  
  if (currentIndex === -1 || currentIndex === levels.length - 1) {
    return null;
  }
  
  return CALISTENIA_LEVELS[levels[currentIndex + 1]];
}

/**
 * Obtener nivel anterior en la progresión
 * @param {string} currentLevel - Nivel actual
 * @returns {Object|null} Configuración del nivel anterior
 */
export function getPreviousLevel(currentLevel) {
  const levels = ['basico', 'intermedio', 'avanzado'];
  const currentIndex = levels.indexOf(currentLevel?.toLowerCase());
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return CALISTENIA_LEVELS[levels[currentIndex - 1]];
}

/**
 * Validar si un nivel es válido
 * @param {string} level - Nivel a validar
 * @returns {boolean} True si es válido
 */
export function isValidLevel(level) {
  return level && CALISTENIA_LEVELS.hasOwnProperty(level.toLowerCase());
}

/**
 * Obtener recomendaciones generales por nivel
 * @param {string} level - Nivel del usuario
 * @returns {Object} Recomendaciones específicas
 */
export function getLevelRecommendations(level) {
  const config = getLevelConfig(level);
  if (!config) return null;
  
  return {
    warmupDuration: config.id === 'basico' ? 10 : config.id === 'intermedio' ? 15 : 20,
    cooldownDuration: 10,
    skillWorkPercent: config.id === 'basico' ? 30 : config.id === 'intermedio' ? 50 : 70,
    strengthWorkPercent: config.id === 'basico' ? 70 : config.id === 'intermedio' ? 50 : 30,
    recommendedDeloadWeeks: config.id === 'basico' ? 6 : config.id === 'intermedio' ? 4 : 3,
    maxTrainingDaysPerWeek: config.id === 'basico' ? 3 : config.id === 'intermedio' ? 5 : 6
  };
}

export default CALISTENIA_LEVELS;