export const METHODOLOGY_CONFIGS = {
  'Heavy Duty': {
    key: 'HEAVY_DUTY',
    name: 'Heavy Duty',
    category: 'fuerza',
    description: 'Entrenamiento de alta intensidad con baja frecuencia',
    characteristics: {
      frequency: { min: 3, max: 4, optimal: 3 },
      intensity: { type: 'RPE', range: [8, 10], optimal: 9 },
      volume: 'bajo',
      rest: { min: 60, max: 120, optimal: 90 },
      session_duration: { min: 30, max: 50, optimal: 40 }
    },
    equipment: {
      required: ['mancuernas', 'barra'],
      optional: ['banco', 'rack'],
      bodyweight_alternative: false
    },
    target_goals: ['fuerza_maxima', 'definicion'],
    contraindications: ['principiante_absoluto'],
    progression_style: 'intensidad'
  },

  'Powerlifting': {
    key: 'POWERLIFTING',
    name: 'Powerlifting',
    category: 'fuerza',
    description: 'Especialización en los tres movimientos básicos',
    characteristics: {
      frequency: { min: 4, max: 6, optimal: 5 },
      intensity: { type: '%1RM', range: [70, 95], optimal: 85 },
      volume: 'medio-alto',
      rest: { min: 180, max: 300, optimal: 240 },
      session_duration: { min: 60, max: 90, optimal: 75 }
    },
    equipment: {
      required: ['barra', 'discos', 'rack'],
      optional: ['banco', 'cinturon'],
      bodyweight_alternative: false
    },
    target_goals: ['fuerza_maxima', 'competicion'],
    contraindications: ['lesiones_espalda_graves'],
    progression_style: 'carga'
  },

  'Hipertrofia': {
    key: 'HIPERTROFIA',
    name: 'Hipertrofia',
    category: 'volumen',
    description: 'Maximización del crecimiento muscular',
    characteristics: {
      frequency: { min: 4, max: 6, optimal: 5 },
      intensity: { type: 'RPE', range: [6, 9], optimal: 7.5 },
      volume: 'alto',
      rest: { min: 60, max: 90, optimal: 75 },
      session_duration: { min: 50, max: 80, optimal: 65 }
    },
    equipment: {
      required: ['mancuernas'],
      optional: ['barra', 'maquinas', 'cables'],
      bodyweight_alternative: true
    },
    target_goals: ['ganancia_masa', 'estetica'],
    contraindications: [],
    progression_style: 'volumen'
  },

  'Funcional': {
    key: 'FUNCIONAL',
    name: 'Funcional',
    category: 'movimiento',
    description: 'Patrones de movimiento naturales y funcionales',
    characteristics: {
      frequency: { min: 4, max: 6, optimal: 5 },
      intensity: { type: 'RPE', range: [6, 8], optimal: 7 },
      volume: 'medio',
      rest: { min: 45, max: 75, optimal: 60 },
      session_duration: { min: 45, max: 70, optimal: 55 }
    },
    equipment: {
      required: [],
      optional: ['kettlebells', 'medicine_ball', 'suspension'],
      bodyweight_alternative: true
    },
    target_goals: ['funcionalidad', 'atletismo', 'vida_diaria'],
    contraindications: [],
    progression_style: 'complejidad'
  },

  'Oposiciones': {
    key: 'OPOSICIONES',
    name: 'Oposiciones',
    category: 'rendimiento',
    description: 'Preparación específica para pruebas físicas oficiales',
    characteristics: {
      frequency: { min: 5, max: 6, optimal: 6 },
      intensity: { type: 'mixto', range: [6, 9], optimal: 7.5 },
      volume: 'alto',
      rest: { min: 30, max: 90, optimal: 60 },
      session_duration: { min: 60, max: 90, optimal: 75 }
    },
    equipment: {
      required: [],
      optional: ['barra_dominadas', 'cronometro'],
      bodyweight_alternative: true
    },
    target_goals: ['rendimiento_especifico', 'resistencia', 'fuerza_relativa'],
    contraindications: [],
    progression_style: 'especificidad'
  },

  'Crossfit': {
    key: 'CROSSFIT',
    name: 'Crossfit',
    category: 'mixto',
    description: 'Entrenamiento constantemente variado de alta intensidad',
    characteristics: {
      frequency: { min: 4, max: 6, optimal: 5 },
      intensity: { type: 'RPE', range: [7, 9], optimal: 8 },
      volume: 'alto',
      rest: { min: 30, max: 60, optimal: 45 },
      session_duration: { min: 45, max: 75, optimal: 60 }
    },
    equipment: {
      required: ['barra', 'discos'],
      optional: ['kettlebells', 'box', 'cuerdas'],
      bodyweight_alternative: true
    },
    target_goals: ['condicion_general', 'competicion', 'variedad'],
    contraindications: ['principiante_absoluto'],
    progression_style: 'mixto'
  },

  'Calistenia': {
    key: 'CALISTENIA',
    name: 'Calistenia',
    category: 'peso_corporal',
    description: 'Dominio del peso corporal y movimientos avanzados',
    characteristics: {
      frequency: { min: 4, max: 6, optimal: 5 },
      intensity: { type: 'RPE', range: [6, 9], optimal: 7.5 },
      volume: 'medio-alto',
      rest: { min: 60, max: 120, optimal: 90 },
      session_duration: { min: 45, max: 75, optimal: 60 }
    },
    equipment: {
      required: [],
      optional: ['barra_dominadas', 'paralelas', 'anillas'],
      bodyweight_alternative: true
    },
    target_goals: ['control_corporal', 'fuerza_relativa', 'habilidades'],
    contraindications: [],
    progression_style: 'progresiones'
  },

  'Entrenamiento en casa': {
    key: 'HOME_TRAINING',
    name: 'Entrenamiento en casa',
    category: 'adaptado',
    description: 'Entrenamientos efectivos con equipamiento mínimo',
    characteristics: {
      frequency: { min: 4, max: 6, optimal: 5 },
      intensity: { type: 'RPE', range: [6, 8], optimal: 7 },
      volume: 'medio',
      rest: { min: 45, max: 75, optimal: 60 },
      session_duration: { min: 35, max: 60, optimal: 45 }
    },
    equipment: {
      required: [],
      optional: ['mancuernas', 'bandas_elasticas', 'esterilla'],
      bodyweight_alternative: true
    },
    target_goals: ['conveniencia', 'mantenimiento', 'flexibilidad'],
    contraindications: [],
    progression_style: 'adaptativo'
  }
};

export const METHODOLOGY_CATEGORIES = {
  fuerza: ['Heavy Duty', 'Powerlifting'],
  volumen: ['Hipertrofia'],
  movimiento: ['Funcional'],
  rendimiento: ['Oposiciones'],
  mixto: ['Crossfit'],
  peso_corporal: ['Calistenia'],
  adaptado: ['Entrenamiento en casa']
};

export const EQUIPMENT_CATALOG = {
  peso_corporal: {
    name: 'Peso corporal',
    required_space: 'minimo',
    cost: 'gratis',
    exercises: ['flexiones', 'sentadillas', 'plancha', 'burpees']
  },
  mancuernas: {
    name: 'Mancuernas',
    required_space: 'pequeno',
    cost: 'bajo',
    exercises: ['press', 'remo', 'curl', 'extension']
  },
  barra: {
    name: 'Barra olímpica',
    required_space: 'medio',
    cost: 'medio',
    exercises: ['sentadilla', 'peso_muerto', 'press_banca', 'remo']
  },
  bandas_elasticas: {
    name: 'Bandas elásticas',
    required_space: 'minimo',
    cost: 'muy_bajo',
    exercises: ['resistencia_variable', 'asistencia', 'traccion']
  }
};

export function getMethodologyConfig(methodologyName) {
  const config = METHODOLOGY_CONFIGS[methodologyName];
  if (!config) {
    throw new Error(`Metodología "${methodologyName}" no encontrada`);
  }
  return config;
}

export function getCompatibleMethodologies(userProfile) {
  const { nivel_actual_entreno, objetivo_principal, equipamiento_disponible } = userProfile;

  return Object.entries(METHODOLOGY_CONFIGS).filter(([name, config]) => {
    // Filtrar por nivel
    if (nivel_actual_entreno === 'principiante' && config.contraindications.includes('principiante_absoluto')) {
      return false;
    }

    // Filtrar por equipamiento si es limitado
    if (equipamiento_disponible === 'minimo' && !config.equipment.bodyweight_alternative) {
      return false;
    }

    return true;
  }).map(([name, config]) => ({ name, ...config }));
}

export function getRecommendedMethodology(userProfile) {
  const compatible = getCompatibleMethodologies(userProfile);
  const { objetivo_principal, nivel_actual_entreno, tiempo_disponible } = userProfile;

  // Lógica de recomendación basada en objetivos y perfil
  const recommendations = {
    'ganar_fuerza': ['Powerlifting', 'Heavy Duty'],
    'ganar_masa': ['Hipertrofia'],
    'perder_grasa': ['Crossfit', 'Funcional'],
    'mejorar_condicion': ['Crossfit', 'Funcional'],
    'aprender_habilidades': ['Calistenia'],
    'conveniencia': ['Entrenamiento en casa'],
    'preparar_oposiciones': ['Oposiciones']
  };

  const preferred = recommendations[objetivo_principal] || ['Funcional'];

  // Encontrar la primera metodología compatible de las recomendadas
  for (const methodName of preferred) {
    const found = compatible.find(m => m.name === methodName);
    if (found) return found;
  }

  // Fallback a la primera compatible
  return compatible[0] || getMethodologyConfig('Funcional');
}