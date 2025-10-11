/**
 * Bomberos Levels Configuration
 * Niveles de preparación para oposiciones de Bombero
 *
 * @author Claude Code
 * @version 1.0.0
 */

export const BOMBEROS_LEVELS = {
  principiante: {
    name: 'Principiante',
    description: 'Iniciando preparación para oposiciones de bombero',
    icon: '🌱',
    duration: '12-16 semanas',
    frequency: '4-5 días/semana',
    hitos: [
      'Nadar 50m en menos de 70 segundos',
      'Realizar 10-15 dominadas consecutivas',
      'Correr 100m en menos de 16 segundos',
      'Completar 2800m en menos de 14 minutos',
      'Press banca 30kg (15 repeticiones)',
      'Trepa de cuerda con ayuda de piernas'
    ],
    objetivos: [
      'Desarrollar base aeróbica sólida',
      'Aprender técnicas de natación eficientes',
      'Construir fuerza general de tracción y empuje',
      'Familiarizarse con las pruebas oficiales'
    ]
  },
  intermedio: {
    name: 'Intermedio',
    description: 'Acercándose a los baremos mínimos oficiales',
    icon: '💪',
    duration: '10-14 semanas',
    frequency: '5-6 días/semana',
    hitos: [
      'Nadar 50m en menos de 60 segundos',
      'Buceo 25m en menos de 40 segundos',
      'Realizar 15-20 dominadas consecutivas',
      'Correr 100m en menos de 14.5 segundos',
      'Completar 2800m en menos de 12:30 minutos',
      'Press banca 40kg (20+ repeticiones)',
      'Trepa 6m sin piernas en 15-20 segundos'
    ],
    objetivos: [
      'Alcanzar los baremos mínimos en todas las pruebas',
      'Perfeccionar técnica en trepa sin piernas',
      'Desarrollar resistencia muscular específica',
      'Trabajar puntos débiles identificados'
    ]
  },
  avanzado: {
    name: 'Avanzado',
    description: 'Superando baremos mínimos y maximizando puntuación',
    icon: '🔥',
    duration: '8-12 semanas',
    frequency: '5-6 días/semana + técnica',
    hitos: [
      'Nadar 50m en menos de 55 segundos',
      'Buceo 25m en menos de 35 segundos',
      'Realizar 20+ dominadas en 30 segundos',
      'Correr 100m en menos de 14 segundos',
      'Completar 2800m en menos de 12 minutos',
      'Press banca 40kg (25+ repeticiones en 30 seg)',
      'Trepa 6m sin piernas en menos de 10 segundos',
      'Lanzar balón medicinal 5kg más de 10m'
    ],
    objetivos: [
      'Maximizar puntuación en todas las pruebas',
      'Perfeccionar técnica competitiva',
      'Desarrollar potencia explosiva',
      'Preparación mental para el día del examen',
      'Peaking para fecha de convocatoria'
    ]
  }
};

// Obtener configuración de nivel
export function getLevelConfig(levelKey) {
  return BOMBEROS_LEVELS[levelKey] || BOMBEROS_LEVELS.principiante;
}

// Obtener recomendaciones por nivel
export function getLevelRecommendations(levelKey) {
  const recommendations = {
    principiante: {
      maxTrainingDaysPerWeek: 5,
      restDaysPerWeek: 2,
      sessionDuration: '60-90 minutos',
      intensityRange: '60-75% esfuerzo máximo',
      focusAreas: ['Técnica de natación', 'Fuerza base', 'Resistencia aeróbica', 'Familiarización con pruebas']
    },
    intermedio: {
      maxTrainingDaysPerWeek: 6,
      restDaysPerWeek: 1,
      sessionDuration: '75-105 minutos',
      intensityRange: '70-85% esfuerzo máximo',
      focusAreas: ['Velocidad', 'Potencia', 'Resistencia específica', 'Trepa técnica']
    },
    avanzado: {
      maxTrainingDaysPerWeek: 6,
      restDaysPerWeek: 1,
      sessionDuration: '90-120 minutos',
      intensityRange: '80-95% esfuerzo máximo',
      focusAreas: ['Peaking', 'Técnica competitiva', 'Potencia explosiva', 'Simulaciones completas']
    }
  };

  return recommendations[levelKey] || recommendations.principiante;
}

// Calcular nivel sugerido basado en marcas actuales
export function calculateSuggestedLevel(userMarks) {
  let score = 0;
  let totalTests = 0;

  // Natación 50m
  if (userMarks.natacion50m) {
    totalTests++;
    if (userMarks.natacion50m <= 55) score += 3;
    else if (userMarks.natacion50m <= 60) score += 2;
    else if (userMarks.natacion50m <= 70) score += 1;
  }

  // Dominadas
  if (userMarks.dominadas) {
    totalTests++;
    if (userMarks.dominadas >= 20) score += 3;
    else if (userMarks.dominadas >= 15) score += 2;
    else if (userMarks.dominadas >= 10) score += 1;
  }

  // Carrera 2800m (en segundos)
  if (userMarks.carrera2800m) {
    totalTests++;
    const minutos = userMarks.carrera2800m / 60;
    if (minutos <= 12) score += 3;
    else if (minutos <= 12.5) score += 2;
    else if (minutos <= 14) score += 1;
  }

  if (totalTests === 0) return 'principiante';

  const avgScore = score / totalTests;
  if (avgScore >= 2.5) return 'avanzado';
  if (avgScore >= 1.5) return 'intermedio';
  return 'principiante';
}
