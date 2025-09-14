/**
 * Methodologies Data - Arquitectura Modular Profesional v3.0
 * Centralized methodology database with validation utilities
 * Refactored with type safety, consistency, and maintainability focus
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 3.0.0 - Centralized Config & Data Consistency
 */

import { Zap, Trophy, Dumbbell, Activity, Target, User, Home, Shield } from 'lucide-react';

// Configuraciones centralizadas
const METHODOLOGIES_CONFIG = {
  // Niveles consistentes y validados
  LEVELS: {
    BEGINNER: 'principiante',
    INTERMEDIATE: 'intermedio',
    ADVANCED: 'avanzado',
    COMPETITION: 'competición'
  },

  // Duraciones estandarizadas (en semanas)
  DURATIONS: {
    SHORT: { min: 4, max: 6 },    // 4-6 semanas
    MEDIUM: { min: 6, max: 10 },  // 6-10 semanas
    LONG: { min: 8, max: 16 },    // 8-16 semanas
    EXTENDED: { min: 10, max: 20 } // 10-20 semanas
  },

  // Frecuencias estandarizadas (días por semana)
  FREQUENCIES: {
    LOW: { min: 2, max: 3 },      // 2-3 días/semana
    MODERATE: { min: 3, max: 4 }, // 3-4 días/semana
    HIGH: { min: 4, max: 5 },     // 4-5 días/semana
    INTENSE: { min: 4, max: 6 },  // 4-6 días/semana
    DAILY: { min: 5, max: 7 }     // 5-7 días/semana
  },

  // Volúmenes de entrenamiento
  VOLUMES: {
    VERY_LOW: 'muy_bajo',
    LOW: 'bajo',
    MODERATE: 'moderado',
    HIGH: 'alto',
    VERY_HIGH: 'muy_alto'
  },

  // Intensidades de entrenamiento
  INTENSITIES: {
    LOW: 'baja',
    MODERATE: 'moderada',
    HIGH: 'alta',
    VERY_HIGH: 'muy_alta'
  },

  // Compatibilidad con entrenamiento en casa
  HOME_COMPATIBILITY: {
    FULL: 'total',        // 100% compatible
    PARTIAL: 'parcial',   // Algunas limitaciones
    MINIMAL: 'mínima',    // Muy limitado
    NONE: 'ninguna'       // Requiere gimnasio
  }
};

// Campos numéricos para validación de perfiles
export const NUMBER_KEYS = [
  'edad', 'peso_kg', 'altura_cm', 'grasa_corporal', 'masa_muscular', 'agua_corporal', 'metabolismo_basal',
  'cintura', 'pecho', 'brazos', 'muslos', 'cuello', 'antebrazos',
  'comidas_diarias', 'frecuencia_semanal', 'años_entrenando', 'meta_peso', 'meta_grasa'
];

// Utilidades de validación y sanitización
const ProfileValidationUtils = {
  /**
   * Sanitiza un perfil de usuario convirtiendo strings a números donde corresponde
   * @param {Object} profile - Perfil de usuario a sanitizar
   * @returns {Object} Perfil sanitizado con tipos correctos
   */
  sanitizeProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      console.warn('[MethodologiesData] Invalid profile provided to sanitizeProfile');
      return {};
    }

    const sanitized = { ...profile };

    NUMBER_KEYS.forEach((key) => {
      if (sanitized[key] != null) {
        if (typeof sanitized[key] === 'string' && sanitized[key].trim() !== '') {
          const numericValue = Number(sanitized[key]);
          if (!Number.isNaN(numericValue) && numericValue >= 0) {
            sanitized[key] = numericValue;
          }
        }
      }
    });

    return sanitized;
  },

  /**
   * Valida que un perfil tenga los campos mínimos requeridos
   * @param {Object} profile - Perfil a validar
   * @returns {Object} { isValid: boolean, missingFields: string[] }
   */
  validateProfile(profile) {
    const requiredFields = ['edad', 'peso_kg', 'altura_cm', 'nivel_entrenamiento'];
    const missingFields = requiredFields.filter(field => !profile || profile[field] == null);

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
};

// Helper para formatear duraciones consistentemente
const formatDuration = (duration) => `${duration.min}-${duration.max} semanas`;

// Helper para formatear frecuencias consistentemente
const formatFrequency = (frequency) => `${frequency.min}-${frequency.max} días/semana`;

// Helper para generar rangos de nivel consistentes
const formatLevelRange = (levels) => levels.join('-');

// Funciones de utilidad adicionales
const MethodologyUtils = {
  /**
   * Busca una metodología por su ID
   * @param {string} methodologyId - ID de la metodología
   * @returns {Object|null} Metodología encontrada o null
   */
  findMethodologyById(methodologyId) {
    return METHODOLOGIES.find(methodology => methodology.id === methodologyId) || null;
  },

  /**
   * Filtra metodologías por compatibilidad con casa
   * @param {boolean} homeOnly - Si solo buscar compatibles con casa
   * @returns {Array} Lista de metodologías filtradas
   */
  filterByHomeCompatibility(homeOnly = true) {
    if (!homeOnly) return METHODOLOGIES;
    return METHODOLOGIES.filter(methodology =>
      methodology.homeCompatible === METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL
    );
  },

  /**
   * Filtra metodologías por nivel de usuario
   * @param {string} userLevel - Nivel del usuario
   * @returns {Array} Lista de metodologías apropiadas
   */
  filterByUserLevel(userLevel) {
    return METHODOLOGIES.filter(methodology => {
      const methodologyLevels = methodology.level.toLowerCase();
      return methodologyLevels.includes(userLevel.toLowerCase());
    });
  },

  /**
   * Obtiene estadísticas de las metodologías
   * @returns {Object} Estadísticas generales
   */
  getMethodologyStats() {
    return {
      total: METHODOLOGIES.length,
      homeCompatible: METHODOLOGIES.filter(m => m.homeCompatible === METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL).length,
      byLevel: {
        beginner: METHODOLOGIES.filter(m => m.level.toLowerCase().includes('principiante')).length,
        intermediate: METHODOLOGIES.filter(m => m.level.toLowerCase().includes('intermedio')).length,
        advanced: METHODOLOGIES.filter(m => m.level.toLowerCase().includes('avanzado')).length
      }
    };
  }
};

// Exportaciones para compatibilidad hacia atrás
export function sanitizeProfile(profile) {
  return ProfileValidationUtils.sanitizeProfile(profile);
}

// Exportaciones adicionales
export { METHODOLOGIES_CONFIG, ProfileValidationUtils, MethodologyUtils };

export const METHODOLOGIES = [
  {
    id: 'heavy-duty',
    name: 'Heavy Duty',
    description: 'Entrenamiento de alta intensidad con bajo volumen y máximo descanso',
    detailedDescription: 'Metodología desarrollada por Mike Mentzer que revolucionó el entrenamiento con pesas. Se basa en entrenamientos breves pero extremadamente intensos, seguidos de períodos de descanso prolongados para permitir la supercompensación muscular completa.',
    focus: 'Intensidad máxima',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.INTERMEDIATE, METHODOLOGIES_CONFIG.LEVELS.ADVANCED]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL,
    icon: Zap,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.SHORT),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.LOW),
    volume: METHODOLOGIES_CONFIG.VOLUMES.VERY_LOW,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.VERY_HIGH,
    principles: [
      'Intensidad máxima en cada serie hasta el fallo muscular',
      'Descansos de 4-7 días entre entrenamientos del mismo grupo muscular',
      'Pocas series por grupo muscular (1-2 series efectivas)',
      'Progresión lenta pero constante en cargas',
      'Enfoque en ejercicios compuestos básicos'
    ],
    benefits: [
      'Máximo estímulo de crecimiento con mínimo volumen de entrenamiento',
      'Ideal para personas con poca disponibilidad de tiempo',
      'Previene el sobreentrenamiento y el burnout',
      'Permite recuperación completa entre sesiones',
      'Desarrolla fuerza mental y concentración extrema'
    ],
    targetAudience: 'Intermedios y avanzados con buena técnica y experiencia en fallo muscular',
    duration: '45-60 minutos por sesión',
    scientificBasis: 'Basado en la teoría de supercompensación, adaptación específica y el principio de sobrecarga progresiva de Arthur Jones',
    videoPlaceholder: true
  },
  {
    id: 'powerlifting',
    name: 'Powerlifting',
    description: 'Enfoque en los tres levantamientos básicos: sentadilla, press banca y peso muerto',
    detailedDescription: 'Deporte de fuerza que se centra en maximizar la carga en tres movimientos fundamentales. Combina entrenamiento técnico específico con desarrollo de fuerza absoluta, utilizando periodización avanzada para alcanzar picos de rendimiento.',
    focus: 'Fuerza máxima',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.INTERMEDIATE, METHODOLOGIES_CONFIG.LEVELS.COMPETITION]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.NONE,
    icon: Trophy,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.LONG),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.INTENSE),
    volume: METHODOLOGIES_CONFIG.VOLUMES.HIGH,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.HIGH,
    principles: [
      'Especificidad absoluta en sentadilla, press banca y peso muerto',
      'Periodización lineal o ondulante según objetivos',
      'Técnica perfecta como prioridad número uno',
      'Trabajo de accesorios específico para debilidades',
      'Progresión gradual y medible en cada ciclo'
    ],
    benefits: [
      'Desarrollo de fuerza funcional máxima en patrones básicos',
      'Mejora significativa de la densidad ósea y conectiva',
      'Desarrollo de disciplina mental y concentración extrema',
      'Base sólida de fuerza para cualquier otro deporte',
      'Comunidad competitiva y objetivos medibles claros'
    ],
    targetAudience: 'Intermedios a avanzados con acceso a gimnasio completo y experiencia en levantamientos básicos',
    duration: '90-120 minutos por sesión',
    scientificBasis: 'Principios de especificidad, sobrecarga progresiva, adaptaciones neuromusculares y periodización del entrenamiento',
    videoPlaceholder: true
  },
  {
    id: 'hipertrofia',
    name: 'Hipertrofia',
    description: 'Entrenamiento orientado al crecimiento muscular con volumen moderado-alto',
    detailedDescription: 'Metodología científicamente respaldada para maximizar el crecimiento muscular. Combina tensión mecánica, estrés metabólico y daño muscular controlado para estimular la síntesis proteica y el desarrollo de masa muscular magra.',
    focus: 'Volumen muscular',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.BEGINNER, METHODOLOGIES_CONFIG.LEVELS.ADVANCED]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL,
    icon: Dumbbell,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.MEDIUM),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.HIGH),
    volume: METHODOLOGIES_CONFIG.VOLUMES.HIGH,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.HIGH,
    principles: [
      'Volumen de entrenamiento optimizado (10-20 series por grupo muscular/semana)',
      'Rango de repeticiones 6-20 con énfasis en 8-15',
      'Tensión mecánica sostenida y tiempo bajo tensión controlado',
      'Frecuencia de 2-3 veces por semana por grupo muscular',
      'Progresión en volumen, intensidad o densidad'
    ],
    benefits: [
      'Aumento significativo y visible de masa muscular',
      'Mejora del metabolismo basal y composición corporal',
      'Fortalecimiento de articulaciones y tejido conectivo',
      'Mejor definición muscular y simetría corporal',
      'Aumento de la autoestima y confianza personal'
    ],
    targetAudience: 'Desde principiantes hasta avanzados que buscan maximizar el crecimiento muscular',
    duration: '60-90 minutos por sesión',
    scientificBasis: 'Basado en investigación sobre síntesis proteica muscular, mTOR, tensión mecánica y adaptaciones metabólicas',
    videoPlaceholder: true
  },
  {
    id: 'funcional',
    name: 'Funcional',
    description: 'Movimientos naturales y ejercicios que mejoran la funcionalidad diaria',
    detailedDescription: 'Entrenamiento basado en patrones de movimiento que replican actividades de la vida cotidiana. Integra múltiples grupos musculares trabajando en diferentes planos de movimiento para mejorar la coordinación, estabilidad y transferencia al rendimiento diario.',
    focus: 'Funcionalidad',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.BEGINNER, METHODOLOGIES_CONFIG.LEVELS.INTERMEDIATE]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL,
    icon: Activity,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.MEDIUM),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.MODERATE),
    volume: METHODOLOGIES_CONFIG.VOLUMES.MODERATE,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.MODERATE,
    principles: [
      'Movimientos multiplanares (sagital, frontal, transversal)',
      'Integración de cadenas musculares completas',
      'Desarrollo simultáneo de estabilidad y movilidad',
      'Transferencia directa a actividades de la vida diaria',
      'Progresión desde estabilidad a movilidad dinámica'
    ],
    benefits: [
      'Mejora significativa de coordinación y propiocepción',
      'Prevención efectiva de lesiones cotidianas',
      'Mayor eficiencia en movimientos diarios',
      'Desarrollo de equilibrio y estabilidad core',
      'Rehabilitación y corrección de desequilibrios musculares'
    ],
    targetAudience: 'Ideal para principiantes, personas en rehabilitación y atletas buscando transferencia',
    duration: '45-75 minutos por sesión',
    scientificBasis: 'Basado en principios de biomecánica, control motor, cadenas cinéticas y neuroplasticidad',
    videoPlaceholder: true
  },
  {
    id: 'oposiciones',
    name: 'Oposiciones',
    description: 'Preparación física específica para pruebas de oposiciones',
    detailedDescription: 'Programa especializado diseñado para superar las pruebas físicas de oposiciones (policía, bomberos, militar, etc.). Combina resistencia cardiovascular, fuerza funcional y agilidad específica según los requerimientos de cada convocatoria.',
    focus: 'Acondicionamiento específico',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.BEGINNER, METHODOLOGIES_CONFIG.LEVELS.INTERMEDIATE]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL,
    icon: Shield,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.LONG),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.HIGH),
    volume: METHODOLOGIES_CONFIG.VOLUMES.HIGH,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.HIGH,
    principles: [
      'Especificidad según pruebas de la oposición',
      'Periodización hacia fecha de examen',
      'Combinación de resistencia y fuerza funcional',
      'Simulacros de pruebas reales',
      'Progresión gradual y sostenible'
    ],
    benefits: [
      'Preparación específica para superar baremos oficiales',
      'Mejora integral de capacidades físicas requeridas',
      'Desarrollo de resistencia mental bajo presión',
      'Optimización del rendimiento en fecha clave',
      'Reducción del riesgo de lesiones durante pruebas'
    ],
    targetAudience: 'Opositores de cuerpos de seguridad, bomberos, militar y similares',
    duration: '60-90 minutos por sesión',
    scientificBasis: 'Entrenamiento específico, periodización deportiva y adaptaciones cardiorrespiratorias',
    videoPlaceholder: true
  },
  {
    id: 'crossfit',
    name: 'CrossFit',
    description: 'Entrenamiento funcional de alta intensidad con movimientos variados',
    detailedDescription: 'Metodología que combina levantamiento olímpico, gimnasia y acondicionamiento metabólico. Busca desarrollar las 10 capacidades físicas generales a través de movimientos funcionales ejecutados a alta intensidad y constantemente variados.',
    focus: 'Condición física general',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.INTERMEDIATE, METHODOLOGIES_CONFIG.LEVELS.ADVANCED]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.MINIMAL,
    icon: Target,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.MEDIUM),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.HIGH),
    volume: METHODOLOGIES_CONFIG.VOLUMES.HIGH,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.HIGH,
    principles: [
      'Movimientos funcionales constantemente variados',
      'Alta intensidad relativa adaptada al individuo',
      'Escalabilidad universal para todos los niveles',
      'Comunidad y competición como motivación',
      'Medición y registro constante del progreso'
    ],
    benefits: [
      'Desarrollo completo de las 10 capacidades físicas',
      'Mejora dramática de la composición corporal',
      'Versatilidad atlética y preparación física general',
      'Motivación grupal y sentido de comunidad',
      'Transferencia a actividades deportivas y cotidianas'
    ],
    targetAudience: 'Intermedios a avanzados con buena base técnica y capacidad de aprendizaje motor',
    duration: '60-75 minutos por sesión',
    scientificBasis: 'Adaptaciones metabólicas mixtas, transferencia atlética y principios de entrenamiento concurrente',
    videoPlaceholder: true
  },
  {
    id: 'calistenia',
    name: 'Calistenia',
    description: 'Entrenamiento con peso corporal enfocado en control y fuerza relativa',
    detailedDescription: 'Arte del movimiento corporal que desarrolla fuerza, flexibilidad y control motor usando únicamente el peso del cuerpo. Progresa desde movimientos básicos hasta habilidades avanzadas como muscle-ups, handstands y human flags.',
    focus: 'Fuerza relativa',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.BEGINNER, METHODOLOGIES_CONFIG.LEVELS.ADVANCED]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL,
    icon: User,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.EXTENDED),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.INTENSE),
    volume: METHODOLOGIES_CONFIG.VOLUMES.HIGH,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.HIGH,
    principles: [
      'Progresión gradual con peso corporal únicamente',
      'Desarrollo de control motor y propiocepción avanzada',
      'Integración de movimientos artísticos y funcionales',
      'Fuerza funcional relativa al peso corporal',
      'Paciencia y consistencia en la progresión'
    ],
    benefits: [
      'Desarrollo de fuerza relativa excepcional',
      'Control corporal y coordinación avanzada',
      'Mejora significativa de flexibilidad y movilidad',
      'Entrenamiento accesible sin necesidad de equipamiento',
      'Desarrollo de habilidades impresionantes y motivadoras'
    ],
    targetAudience: 'Desde principiantes hasta avanzados con paciencia para progresión gradual',
    duration: '45-90 minutos por sesión',
    scientificBasis: 'Adaptaciones neuromusculares, control motor, plasticidad neural y biomecánica corporal',
    videoPlaceholder: true
  },
  {
    id: 'entrenamiento-casa',
    name: 'Entrenamiento en Casa',
    description: 'Rutinas adaptadas para entrenar en casa con equipamiento mínimo',
    detailedDescription: 'Programa versátil diseñado para maximizar resultados con equipamiento básico del hogar. Combina peso corporal, bandas elásticas y objetos domésticos para crear rutinas efectivas adaptadas a cualquier espacio y horario.',
    focus: 'Adaptabilidad',
    level: formatLevelRange([METHODOLOGIES_CONFIG.LEVELS.BEGINNER, METHODOLOGIES_CONFIG.LEVELS.INTERMEDIATE]),
    homeCompatible: METHODOLOGIES_CONFIG.HOME_COMPATIBILITY.FULL,
    icon: Home,
    programDuration: formatDuration(METHODOLOGIES_CONFIG.DURATIONS.SHORT),
    frequency: formatFrequency(METHODOLOGIES_CONFIG.FREQUENCIES.HIGH),
    volume: METHODOLOGIES_CONFIG.VOLUMES.MODERATE,
    intensity: METHODOLOGIES_CONFIG.INTENSITIES.MODERATE,
    principles: [
      'Máximo resultado con equipamiento mínimo disponible',
      'Adaptación creativa al espacio y recursos disponibles',
      'Progresión con resistencia variable y peso corporal',
      'Flexibilidad horaria total sin dependencias externas',
      'Sostenibilidad a largo plazo desde casa'
    ],
    benefits: [
      'Conveniencia total y accesibilidad las 24 horas',
      'Ahorro significativo de tiempo y dinero en gimnasios',
      'Privacidad completa y comodidad del hogar',
      'Flexibilidad de horarios adaptada a tu rutina',
      'Eliminación de excusas y barreras para entrenar'
    ],
    targetAudience: 'Ideal para todos los niveles sin acceso a gimnasio o con limitaciones de tiempo',
    duration: '30-60 minutos por sesión',
    scientificBasis: 'Adaptaciones musculares con resistencia progresiva variable, entrenamiento funcional y biomecánica adaptativa',
    videoPlaceholder: true,
    isNew: true
  }
];
