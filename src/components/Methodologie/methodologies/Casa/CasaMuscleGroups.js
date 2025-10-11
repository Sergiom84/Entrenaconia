/**
 * Categorías y Patrones de Entrenamiento para Casa
 * Clasificación basada en tipo de entrenamiento y adaptabilidad con equipamiento mínimo
 *
 * @author Claude Code - Arquitectura Modular
 * @version 1.0.0 - Implementación inicial Casa
 */

// Configuraciones centralizadas
const TRAINING_CATEGORY_CONFIG = {
  DURATIONS: {
    principiante: 30,
    intermedio: 40,
    avanzado: 50
  },
  SPLIT_TYPES: {
    FULL_BODY: 'full_body',
    CATEGORY_FOCUS: 'category_focus'
  },
  INTENSITY_LEVELS: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    VERY_HIGH: 'very_high'
  },
  SESSION_THRESHOLD: 3,
  MAX_SESSIONS: 6
};

// Sistema de temas consistente con CasaLevels.js
const CATEGORY_THEMES = {
  funcional: {
    color: 'bg-green-100 border-green-300',
    darkColor: 'bg-green-900/20 border-green-400/30',
    icon: '🏃',
    themeColor: 'green-400',
    description: 'Movimientos naturales y completos'
  },
  hiit: {
    color: 'bg-red-100 border-red-300',
    darkColor: 'bg-red-900/20 border-red-400/30',
    icon: '🔥',
    themeColor: 'red-400',
    description: 'Alta intensidad por intervalos'
  },
  fuerza: {
    color: 'bg-blue-100 border-blue-300',
    darkColor: 'bg-blue-900/20 border-blue-400/30',
    icon: '💪',
    themeColor: 'blue-400',
    description: 'Desarrollo de fuerza muscular'
  },
  cardio: {
    color: 'bg-yellow-100 border-yellow-300',
    darkColor: 'bg-yellow-900/20 border-yellow-400/30',
    icon: '❤️',
    themeColor: 'yellow-400',
    description: 'Resistencia cardiovascular'
  },
  movilidad: {
    color: 'bg-purple-100 border-purple-300',
    darkColor: 'bg-purple-900/20 border-purple-400/30',
    icon: '🧘',
    themeColor: 'purple-400',
    description: 'Flexibilidad y rango de movimiento'
  }
};

// Utilidades de validación
const CategoryValidationUtils = {
  isValidLevel(level) {
    return typeof level === 'string' && ['principiante', 'intermedio', 'avanzado'].includes(level.toLowerCase());
  },

  sanitizeLevel(level) {
    return typeof level === 'string' ? level.toLowerCase().trim() : 'principiante';
  },

  validateSessionCount(sessions) {
    const count = Number(sessions);
    return !isNaN(count) && count >= 1 && count <= TRAINING_CATEGORY_CONFIG.MAX_SESSIONS ? count : 3;
  },

  logWarning(message, data = null) {
    if (import.meta.env.DEV) {
      console.warn(`[CasaMuscleGroups] ${message}`, data);
    }
  }
};

export const CASA_TRAINING_CATEGORIES = {
  funcional: {
    id: 'funcional',
    name: 'Funcional',
    description: 'Entrenamiento con movimientos naturales que mejoran la capacidad del cuerpo para realizar actividades cotidianas',
    primaryFocus: [
      'Coordinación multi-articular',
      'Balance y estabilidad',
      'Fuerza aplicada a movimientos reales',
      'Integración de múltiples grupos musculares'
    ],
    secondaryBenefits: [
      'Mejora de la postura corporal',
      'Prevención de lesiones diarias',
      'Aumento de la conciencia corporal',
      'Versatilidad en entornos cambiantes'
    ],
    movementPatterns: [
      'Sentadillas y variantes (goblet, búlgara, pistol)',
      'Zancadas dinámicas y estáticas',
      'Empujes combinados (flexiones + rotación)',
      'Levantamientos completos (turkish get-up)'
    ],
    commonExercises: [
      'Sentadillas con mancuernas',
      'Lunges caminando',
      'Push-ups con rotación',
      'Remo invertido',
      'Turkish get-up',
      'Inchworm'
    ],
    equipmentAdaptations: {
      minimo: 'Peso corporal, silla, toalla como deslizadores',
      basico: 'Añade bandas para resistencia variable',
      avanzado: 'TRX, kettlebells para movimientos complejos'
    },
    progressionPrinciples: [
      'Aumentar complejidad del movimiento (unilateral, rotacional)',
      'Reducir estabilidad (superficies inestables, TRX)',
      'Combinar patrones de movimiento',
      'Añadir carga externa progresivamente'
    ],
    ...CATEGORY_THEMES.funcional
  },
  hiit: {
    id: 'hiit',
    name: 'HIIT (Alta Intensidad)',
    description: 'Entrenamiento por intervalos de alta intensidad que maximiza quema calórica y mejora cardiovascular',
    primaryFocus: [
      'Quema calórica máxima en mínimo tiempo',
      'Mejora de VO2 max',
      'Aceleración del metabolismo post-ejercicio (EPOC)',
      'Desarrollo de potencia anaeróbica'
    ],
    secondaryBenefits: [
      'Ahorro de tiempo (sesiones de 20-30 min)',
      'Versatilidad sin equipamiento',
      'Mejora de resistencia mental',
      'Preservación de masa muscular'
    ],
    movementPatterns: [
      'Pliométricos (saltos, burpees)',
      'Sprints en el sitio',
      'Movimientos explosivos combinados',
      'Transiciones rápidas entre ejercicios'
    ],
    commonExercises: [
      'Burpees (modificados a completos)',
      'Jumping jacks',
      'Mountain climbers',
      'High knees',
      'Tuck jumps',
      'Sentadilla con salto'
    ],
    intervalProtocols: {
      principiante: '30s trabajo / 30s descanso (4-6 rondas)',
      intermedio: '40s trabajo / 20s descanso (6-8 rondas)',
      avanzado: '45s trabajo / 15s descanso o Tabata (20s/10s x 8)'
    },
    equipmentAdaptations: {
      minimo: '100% peso corporal, variaciones de velocidad e intensidad',
      basico: 'Añade bandas para resistencia en movimientos explosivos',
      avanzado: 'Box jumps, battle ropes con toallas, kettlebell swings'
    },
    progressionPrinciples: [
      'Reducir tiempo de descanso progresivamente',
      'Aumentar tiempo de trabajo',
      'Incrementar complejidad del movimiento',
      'Añadir más rondas o circuitos'
    ],
    safetyConsiderations: [
      'Calentamiento exhaustivo obligatorio',
      'No apto para personas con problemas cardíacos sin supervisión',
      'Controlar aterrizajes en pliométricos',
      'No hacer HIIT más de 3-4 veces por semana'
    ],
    ...CATEGORY_THEMES.hiit
  },
  fuerza: {
    id: 'fuerza',
    name: 'Fuerza',
    description: 'Desarrollo de fuerza muscular con resistencia progresiva adaptada al hogar',
    primaryFocus: [
      'Hipertrofia muscular',
      'Aumento de fuerza máxima relativa',
      'Desarrollo de resistencia muscular',
      'Densidad ósea y salud articular'
    ],
    secondaryBenefits: [
      'Aumento del metabolismo basal',
      'Mejora de la composición corporal',
      'Prevención de sarcopenia',
      'Confianza y autoestima'
    ],
    movementPatterns: [
      'Empuje horizontal (flexiones y variantes)',
      'Empuje vertical (press de hombros)',
      'Tracción horizontal (remos)',
      'Dominantes de cadera (hip thrust)',
      'Dominantes de rodilla (sentadillas)'
    ],
    commonExercises: [
      'Flexiones (todas las variantes)',
      'Fondos en silla',
      'Remo con banda/mesa',
      'Hip thrust con banda',
      'Sentadillas búlgaras',
      'Curl de bíceps con mancuernas/banda'
    ],
    equipmentAdaptations: {
      minimo: 'Progresiones de peso corporal (ángulos, tempo, pausas)',
      basico: 'Bandas elásticas (3 resistencias) + mancuernas ajustables',
      avanzado: 'Kettlebells, mancuernas pesadas, chaleco lastrado'
    },
    progressionPrinciples: [
      'Sobrecarga progresiva (más peso o resistencia)',
      'Aumentar volumen (series x reps)',
      'Manipular tempo (excéntricos lentos)',
      'Reducir estabilidad (unilaterales, superficies inestables)'
    ],
    repRanges: {
      fuerza_maxima: '1-6 reps, descanso 90-120s',
      hipertrofia: '8-12 reps, descanso 60-90s',
      resistencia: '15-20+ reps, descanso 30-60s'
    },
    ...CATEGORY_THEMES.fuerza
  },
  cardio: {
    id: 'cardio',
    name: 'Cardio',
    description: 'Entrenamiento cardiovascular sostenido para mejorar resistencia aeróbica',
    primaryFocus: [
      'Mejora de capacidad aeróbica',
      'Salud cardiovascular',
      'Quema calórica sostenida',
      'Resistencia de larga duración'
    ],
    secondaryBenefits: [
      'Reducción de estrés y ansiedad',
      'Mejora del sueño',
      'Control de presión arterial',
      'Aumento de energía diaria'
    ],
    movementPatterns: [
      'Movimientos cíclicos repetitivos',
      'Bajo impacto articular (para principiantes)',
      'Intensidad moderada sostenida',
      'Variaciones de ritmo'
    ],
    commonExercises: [
      'Marcha en el sitio',
      'Jumping jacks',
      'High knees moderados',
      'Escaladores lentos/rápidos',
      'Desplazamientos laterales',
      'Shadowboxing'
    ],
    intensityZones: {
      zona_2: '60-70% FCmax - Conversacional, base aeróbica',
      zona_3: '70-80% FCmax - Ritmo sostenido, conversación difícil',
      zona_4: '80-90% FCmax - Tempo, solo frases cortas'
    },
    equipmentAdaptations: {
      minimo: 'Movimientos de peso corporal, escaleras del hogar',
      basico: 'Comba (si hay espacio), step (o escalón)',
      avanzado: 'Remo concept, bici estática'
    },
    progressionPrinciples: [
      'Aumentar duración progresivamente (5 min/semana)',
      'Introducir intervalos de ritmo',
      'Reducir descansos entre ejercicios',
      'Aumentar intensidad gradualmente'
    ],
    sessionStructures: {
      principiante: '15-20 min continuos, baja intensidad',
      intermedio: '25-35 min, incluir picos de intensidad',
      avanzado: '40-50 min, trabajo de tempo o fartlek'
    },
    ...CATEGORY_THEMES.cardio
  },
  movilidad: {
    id: 'movilidad',
    name: 'Movilidad y Flexibilidad',
    description: 'Trabajo de rango de movimiento, flexibilidad y salud articular',
    primaryFocus: [
      'Ampliar rango de movimiento activo',
      'Salud y lubricación articular',
      'Prevención de lesiones',
      'Recuperación activa'
    ],
    secondaryBenefits: [
      'Reducción de dolores posturales',
      'Mejora del rendimiento en otros ejercicios',
      'Reducción de estrés y tensión',
      'Conciencia corporal incrementada'
    ],
    movementPatterns: [
      'Estiramientos dinámicos (pre-entreno)',
      'Estiramientos estáticos (post-entreno)',
      'Movilidad articular controlada',
      'Liberación miofascial (si hay rodillo)'
    ],
    commonExercises: [
      'Cat-Cow (movilidad columna)',
      'World\'s Greatest Stretch',
      'Hip circles 90/90',
      'Cossack squats',
      'Rotaciones de cadera',
      'Estiramiento de isquiotibiales'
    ],
    equipmentAdaptations: {
      minimo: 'Esterilla, pared, uso de propio cuerpo',
      basico: 'Banda elástica para asistir estiramientos, rodillo de espuma',
      avanzado: 'Lacrosse ball, bandas de movilidad, bloques de yoga'
    },
    progressionPrinciples: [
      'Aumentar tiempo de mantención (15s → 30s → 60s)',
      'Incrementar rango de movimiento gradualmente',
      'Pasar de asistido a activo',
      'Combinar movilidad con control de fuerza (end-range strength)'
    ],
    sessionTiming: {
      warmup: '5-8 min de movilidad dinámica pre-entreno',
      cooldown: '10-15 min de estiramientos estáticos post-entreno',
      dedicated: '20-30 min de sesión dedicada 2-3x/semana'
    },
    keyJoints: [
      'Tobillos (dorsiflexión para sentadilla profunda)',
      'Caderas (rotación interna/externa, flexión)',
      'Columna torácica (extensión y rotación)',
      'Hombros (rotación externa, flexión overhead)'
    ],
    ...CATEGORY_THEMES.movilidad
  }
};

/**
 * Genera un split balanceado según días por semana y categorías seleccionadas
 * @param {number} sessionsPerWeek - Número de sesiones semanales (3-6)
 * @param {Array} selectedCategories - Categorías seleccionadas por el usuario
 * @param {string} level - Nivel del usuario (principiante, intermedio, avanzado)
 * @returns {Object} Split semanal estructurado
 */
export function generateBalancedSplit(sessionsPerWeek = 4, selectedCategories = [], level = 'intermedio') {
  const validSessions = CategoryValidationUtils.validateSessionCount(sessionsPerWeek);
  const sanitizedLevel = CategoryValidationUtils.sanitizeLevel(level);

  // Si no hay categorías seleccionadas, usar todas
  const categories = selectedCategories.length > 0
    ? selectedCategories
    : ['funcional', 'hiit', 'fuerza', 'cardio', 'movilidad'];

  const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Templates de splits según número de días
  const splitTemplates = {
    3: {
      principiante: [
        { day: 'Lunes', categories: ['funcional', 'movilidad'], duration: 30 },
        { day: 'Miércoles', categories: ['fuerza', 'cardio'], duration: 30 },
        { day: 'Viernes', categories: ['hiit', 'movilidad'], duration: 25 }
      ],
      intermedio: [
        { day: 'Lunes', categories: ['funcional', 'fuerza'], duration: 40 },
        { day: 'Miércoles', categories: ['hiit', 'cardio'], duration: 35 },
        { day: 'Viernes', categories: ['fuerza', 'movilidad'], duration: 40 }
      ],
      avanzado: [
        { day: 'Lunes', categories: ['fuerza', 'funcional'], duration: 50 },
        { day: 'Miércoles', categories: ['hiit'], duration: 40 },
        { day: 'Sábado', categories: ['fuerza', 'cardio'], duration: 50 }
      ]
    },
    4: {
      principiante: [
        { day: 'Lunes', categories: ['funcional'], duration: 30 },
        { day: 'Miércoles', categories: ['cardio', 'movilidad'], duration: 30 },
        { day: 'Viernes', categories: ['fuerza'], duration: 30 },
        { day: 'Sábado', categories: ['hiit', 'movilidad'], duration: 25 }
      ],
      intermedio: [
        { day: 'Lunes', categories: ['fuerza', 'funcional'], duration: 40 },
        { day: 'Martes', categories: ['cardio', 'movilidad'], duration: 35 },
        { day: 'Jueves', categories: ['hiit'], duration: 35 },
        { day: 'Sábado', categories: ['fuerza', 'movilidad'], duration: 40 }
      ],
      avanzado: [
        { day: 'Lunes', categories: ['fuerza'], duration: 50 },
        { day: 'Martes', categories: ['hiit'], duration: 40 },
        { day: 'Jueves', categories: ['funcional', 'cardio'], duration: 50 },
        { day: 'Sábado', categories: ['fuerza', 'movilidad'], duration: 50 }
      ]
    },
    5: {
      principiante: [
        { day: 'Lunes', categories: ['funcional'], duration: 30 },
        { day: 'Martes', categories: ['cardio'], duration: 25 },
        { day: 'Miércoles', categories: ['movilidad'], duration: 20 },
        { day: 'Viernes', categories: ['fuerza'], duration: 30 },
        { day: 'Sábado', categories: ['hiit'], duration: 25 }
      ],
      intermedio: [
        { day: 'Lunes', categories: ['fuerza', 'funcional'], duration: 40 },
        { day: 'Martes', categories: ['hiit'], duration: 35 },
        { day: 'Miércoles', categories: ['cardio', 'movilidad'], duration: 35 },
        { day: 'Viernes', categories: ['fuerza'], duration: 40 },
        { day: 'Sábado', categories: ['funcional', 'cardio'], duration: 40 }
      ],
      avanzado: [
        { day: 'Lunes', categories: ['fuerza'], duration: 50 },
        { day: 'Martes', categories: ['hiit'], duration: 40 },
        { day: 'Miércoles', categories: ['cardio'], duration: 45 },
        { day: 'Jueves', categories: ['fuerza'], duration: 50 },
        { day: 'Sábado', categories: ['funcional', 'movilidad'], duration: 50 }
      ]
    },
    6: {
      intermedio: [
        { day: 'Lunes', categories: ['fuerza'], duration: 40 },
        { day: 'Martes', categories: ['cardio'], duration: 35 },
        { day: 'Miércoles', categories: ['hiit'], duration: 35 },
        { day: 'Jueves', categories: ['funcional'], duration: 40 },
        { day: 'Viernes', categories: ['fuerza'], duration: 40 },
        { day: 'Sábado', categories: ['movilidad', 'cardio'], duration: 30 }
      ],
      avanzado: [
        { day: 'Lunes', categories: ['fuerza'], duration: 50 },
        { day: 'Martes', categories: ['hiit'], duration: 40 },
        { day: 'Miércoles', categories: ['cardio'], duration: 45 },
        { day: 'Jueves', categories: ['fuerza'], duration: 50 },
        { day: 'Viernes', categories: ['funcional'], duration: 50 },
        { day: 'Sábado', categories: ['movilidad'], duration: 30 }
      ]
    }
  };

  // Seleccionar template apropiado
  const sessionKey = Math.min(validSessions, 6);
  const levelKey = sanitizedLevel;

  let template = splitTemplates[sessionKey]?.[levelKey];

  // Fallback si no existe template exacto
  if (!template) {
    template = splitTemplates[sessionKey]?.intermedio || splitTemplates[4].intermedio;
  }

  return {
    sessionsPerWeek: validSessions,
    level: sanitizedLevel,
    selectedCategories: categories,
    weeklySchedule: template,
    totalWeeklyMinutes: template.reduce((sum, day) => sum + day.duration, 0),
    restDays: weekDays.filter(day => !template.find(t => t.day === day)),
    recommendations: getRecommendationsForSplit(validSessions, sanitizedLevel)
  };
}

/**
 * Obtiene recomendaciones específicas según el split
 * @param {number} sessions - Número de sesiones
 * @param {string} level - Nivel del usuario
 * @returns {Array} Array de recomendaciones
 */
function getRecommendationsForSplit(sessions, level) {
  const recommendations = [];

  if (sessions >= 5) {
    recommendations.push('Con 5+ sesiones semanales, asegúrate de dormir 7-8 horas para recuperación óptima.');
    recommendations.push('Considera tomar 1 día de descanso activo (caminata, estiramientos suaves).');
  }

  if (level === 'principiante') {
    recommendations.push('Como principiante, prioriza la técnica sobre la intensidad.');
    recommendations.push('No tengas miedo de descansar extra si sientes fatiga excesiva.');
  }

  if (level === 'avanzado') {
    recommendations.push('Implementa semanas de descarga cada 4-6 semanas (reducir volumen/intensidad 40%).');
    recommendations.push('Considera tracking de progreso semanal para ajustar carga.');
  }

  recommendations.push('Mantén sesiones de movilidad cortas (10-15 min) en días de descanso.');
  recommendations.push('Hidratación: bebe 500ml de agua 1-2 horas antes de entrenar.');

  return recommendations;
}

/**
 * Valida si una categoría existe
 * @param {string} categoryId - ID de la categoría
 * @returns {boolean} true si existe
 */
export function isValidCategory(categoryId) {
  return typeof categoryId === 'string' && categoryId in CASA_TRAINING_CATEGORIES;
}

/**
 * Obtiene información de una categoría específica
 * @param {string} categoryId - ID de la categoría
 * @returns {Object|null} Información de la categoría o null
 */
export function getCategoryInfo(categoryId) {
  return isValidCategory(categoryId) ? CASA_TRAINING_CATEGORIES[categoryId] : null;
}

/**
 * Obtiene todas las categorías disponibles
 * @returns {Array} Array de objetos de categoría
 */
export function getAllCategories() {
  return Object.values(CASA_TRAINING_CATEGORIES);
}

export default CASA_TRAINING_CATEGORIES;
