// Datos y utilidades para metodologías de entrenamiento
import { Zap, Trophy, Dumbbell, Activity, Target, User, Home } from 'lucide-react';

export const NUMBER_KEYS = [
  'edad','peso_kg','altura_cm','grasa_corporal','masa_muscular','agua_corporal','metabolismo_basal',
  'cintura','pecho','brazos','muslos','cuello','antebrazos',
  'comidas_diarias','frecuencia_semanal','años_entrenando','meta_peso','meta_grasa'
];

export function sanitizeProfile(p) {
  const out = { ...p };
  NUMBER_KEYS.forEach((k) => {
    if (out[k] != null && typeof out[k] === 'string' && out[k].trim() !== '') {
      const n = Number(out[k]);
      if (!Number.isNaN(n)) out[k] = n;
    }
  });
  return out;
}

export const METHODOLOGIES = [
  {
    name: 'Heavy Duty',
    description: 'Entrenamiento de alta intensidad con bajo volumen y máximo descanso',
    detailedDescription: 'Metodología desarrollada por Mike Mentzer que revolucionó el entrenamiento con pesas. Se basa en entrenamientos breves pero extremadamente intensos, seguidos de períodos de descanso prolongados para permitir la supercompensación muscular completa.',
    focus: 'Intensidad máxima',
    level: 'Intermedio-Avanzado',
    homeCompatible: true,
    icon: Zap,
    programDuration: '6-8 semanas',
    frequency: '2-3 días/semana',
    volume: 'Muy bajo',
    intensity: 'Muy alta',
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
    name: 'Powerlifting',
    description: 'Enfoque en los tres levantamientos básicos: sentadilla, press banca y peso muerto',
    detailedDescription: 'Deporte de fuerza que se centra en maximizar la carga en tres movimientos fundamentales. Combina entrenamiento técnico específico con desarrollo de fuerza absoluta, utilizando periodización avanzada para alcanzar picos de rendimiento.',
    focus: 'Fuerza máxima',
    level: 'Intermedio-Competición',
    homeCompatible: false,
    icon: Trophy,
    programDuration: '12-16 semanas',
    frequency: '4-6 días/semana',
    volume: 'Alto',
    intensity: 'Alta',
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
    name: 'Hipertrofia',
    description: 'Entrenamiento orientado al crecimiento muscular con volumen moderado-alto',
    detailedDescription: 'Metodología científicamente respaldada para maximizar el crecimiento muscular. Combina tensión mecánica, estrés metabólico y daño muscular controlado para estimular la síntesis proteica y el desarrollo de masa muscular magra.',
    focus: 'Volumen muscular',
    level: 'Principiante-Avanzado',
    homeCompatible: true,
    icon: Dumbbell,
    programDuration: '8-12 semanas',
    frequency: '4-5 días/semana',
    volume: 'Moderado-Alto',
    intensity: 'Moderada-Alta',
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
    name: 'Funcional',
    description: 'Movimientos naturales y ejercicios que mejoran la funcionalidad diaria',
    detailedDescription: 'Entrenamiento basado en patrones de movimiento que replican actividades de la vida cotidiana. Integra múltiples grupos musculares trabajando en diferentes planos de movimiento para mejorar la coordinación, estabilidad y transferencia al rendimiento diario.',
    focus: 'Funcionalidad',
    level: 'Principiante-Intermedio',
    homeCompatible: true,
    icon: Activity,
    programDuration: '6-10 semanas',
    frequency: '3-4 días/semana',
    volume: 'Moderado',
    intensity: 'Moderada',
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
    name: 'Oposiciones',
    description: 'Preparación física específica para pruebas de oposiciones',
    detailedDescription: 'Programa especializado diseñado para superar las pruebas físicas de oposiciones (policía, bomberos, militar, etc.). Combina resistencia cardiovascular, fuerza funcional y agilidad específica según los requerimientos de cada convocatoria.',
    focus: 'Acondicionamiento específico',
    level: 'Principiante-Intermedio',
    homeCompatible: true,
    icon: Target,
    programDuration: '8-16 semanas',
    frequency: '4-5 días/semana',
    volume: 'Alto',
    intensity: 'Moderada-Alta',
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
    name: 'CrossFit',
    description: 'Entrenamiento funcional de alta intensidad con movimientos variados',
    detailedDescription: 'Metodología que combina levantamiento olímpico, gimnasia y acondicionamiento metabólico. Busca desarrollar las 10 capacidades físicas generales a través de movimientos funcionales ejecutados a alta intensidad y constantemente variados.',
    focus: 'Condición física general',
    level: 'Intermedio-Avanzado',
    homeCompatible: false,
    icon: Target,
    programDuration: '8-12 semanas',
    frequency: '3-5 días/semana',
    volume: 'Alto',
    intensity: 'Alta',
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
    name: 'Calistenia',
    description: 'Entrenamiento con peso corporal enfocado en control y fuerza relativa',
    detailedDescription: 'Arte del movimiento corporal que desarrolla fuerza, flexibilidad y control motor usando únicamente el peso del cuerpo. Progresa desde movimientos básicos hasta habilidades avanzadas como muscle-ups, handstands y human flags.',
    focus: 'Fuerza relativa',
    level: 'Principiante-Avanzado',
    homeCompatible: true,
    icon: User,
    programDuration: '10-16 semanas',
    frequency: '4-6 días/semana',
    volume: 'Moderado-Alto',
    intensity: 'Moderada-Alta',
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
    name: 'Entrenamiento en Casa',
    description: 'Rutinas adaptadas para entrenar en casa con equipamiento mínimo',
    detailedDescription: 'Programa versátil diseñado para maximizar resultados con equipamiento básico del hogar. Combina peso corporal, bandas elásticas y objetos domésticos para crear rutinas efectivas adaptadas a cualquier espacio y horario.',
    focus: 'Adaptabilidad',
    level: 'Principiante-Intermedio',
    homeCompatible: true,
    icon: Home,
    programDuration: '4-8 semanas',
    frequency: '3-5 días/semana',
    volume: 'Moderado',
    intensity: 'Moderada',
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
