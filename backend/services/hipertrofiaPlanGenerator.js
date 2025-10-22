import { randomUUID } from 'node:crypto';

const WEEKDAY_ORDER = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

export const HIPERTROFIA_LEVEL_RULES = {
  principiante: {
    dbLabel: 'Principiante',
    weeks: 4,
    sessionsPerWeek: 3,
    exercisesPerSession: { min: 4, max: 5 },
    defaultDays: ['Lunes', 'Miercoles', 'Viernes']
  },
  intermedio: {
    dbLabel: 'Intermedio',
    weeks: 4,
    sessionsPerWeek: 4,
    exercisesPerSession: { min: 5, max: 6 },
    defaultDays: ['Lunes', 'Martes', 'Jueves', 'Viernes']
  },
  avanzado: {
    dbLabel: 'Avanzado',
    weeks: 4,
    sessionsPerWeek: 5,
    exercisesPerSession: { min: 6, max: 7 },
    defaultDays: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']
  }
};

// Mapeo de categorías de BD a grupos musculares principales
const CATEGORY_NORMALIZATION = {
  // Hombros (todas las variantes)
  'hombro': 'Hombros',
  'hombros': 'Hombros',
  'hombro (medios)': 'Hombros',
  'hombro (delanteros)': 'Hombros',
  'hombro (traseros)': 'Hombros',
  'hombro medios': 'Hombros',
  'hombro delanteros': 'Hombros',
  'hombro traseros': 'Hombros',

  // Piernas (todas las variantes)
  'pierna': 'Piernas',
  'piernas': 'Piernas',
  'cuadriceps': 'Piernas',
  'femoral': 'Piernas',
  'gemelos': 'Piernas',
  'gemelo': 'Piernas',

  // Glúteos
  'gluteo': 'Gluteos',
  'gluteos': 'Gluteos',
  'glúteo': 'Gluteos',
  'glúteos': 'Gluteos',

  // Pecho
  'pecho': 'Pecho',
  'pectoral': 'Pecho',

  // Espalda
  'espalda': 'Espalda',
  'dorsal': 'Espalda',
  'trapecio': 'Espalda',

  // Brazos
  'brazo': 'Brazos',
  'brazos': 'Brazos',
  'biceps': 'Brazos',
  'triceps': 'Brazos',
  'antebrazo': 'Brazos',

  // Core
  'core': 'Core',
  'abdomen': 'Core',
  'abdominal': 'Core',
  'abdominales': 'Core'
};

const DEFAULT_GROUP_SEQUENCE = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Brazos',
  'Core',
  'Gluteos'
];

const SESSION_BLUEPRINTS = {
  3: [
    ['Pecho', 'Espalda', 'Piernas', 'Hombros'],
    ['Piernas', 'Espalda', 'Brazos', 'Core'],
    ['Pecho', 'Piernas', 'Brazos', 'Core']
  ],
  4: [
    ['Pecho', 'Espalda', 'Hombros', 'Brazos'],
    ['Piernas', 'Gluteos', 'Core'],
    ['Pecho', 'Espalda', 'Hombros', 'Core'],
    ['Piernas', 'Gluteos', 'Brazos', 'Core']
  ],
  5: [
    ['Pecho', 'Espalda', 'Hombros'],
    ['Piernas', 'Gluteos', 'Core'],
    ['Pecho', 'Brazos', 'Hombros', 'Core'],
    ['Espalda', 'Piernas', 'Core', 'Brazos'],
    ['Piernas', 'Gluteos', 'Core', 'Hombros']
  ]
};

function normalizeGroupName(name) {
  if (!name || typeof name !== 'string') return null;

  // Normalizar input: lowercase, quitar acentos, trim
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) return null;

  // Buscar en el mapeo de categorías
  if (CATEGORY_NORMALIZATION[normalized]) {
    return CATEGORY_NORMALIZATION[normalized];
  }

  // Si no está en el mapeo, intentar capitalizar (fallback)
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildMusclePools(exercises) {
  const pools = new Map();
  const unmappedCategories = new Set();

  exercises.forEach((exercise) => {
    const rawCategory = exercise.grupo_muscular || exercise.categoria;
    const group = normalizeGroupName(rawCategory);

    if (!group) {
      console.warn(`⚠️ Ejercicio sin categoría válida: ${exercise.nombre}`);
      return;
    }

    // Detectar categorías no mapeadas
    if (!DEFAULT_GROUP_SEQUENCE.includes(group)) {
      unmappedCategories.add(`${rawCategory} → ${group}`);
    }

    if (!pools.has(group)) {
      pools.set(group, []);
    }
    pools.get(group).push(exercise);
  });

  // Logging de diagnóstico
  if (unmappedCategories.size > 0) {
    console.log('⚠️ Categorías no mapeadas encontradas:');
    unmappedCategories.forEach(cat => console.log(`  - ${cat}`));
  }

  console.log(`✅ Grupos musculares detectados: ${Array.from(pools.keys()).join(', ')}`);
  console.log('📊 Distribución de ejercicios por grupo:');
  pools.forEach((exercises, group) => {
    console.log(`  - ${group}: ${exercises.length} ejercicios`);
  });

  return pools;
}

function sanitizeFocusGroups(focusGroups, availableGroups) {
  const sanitized = [];
  const seen = new Set();

  (focusGroups || []).forEach((group) => {
    const normalized = normalizeGroupName(group);
    if (!normalized || seen.has(normalized)) return;
    if (availableGroups.has(normalized)) {
      sanitized.push(normalized);
      seen.add(normalized);
    }
  });

  if (sanitized.length === 0) {
    DEFAULT_GROUP_SEQUENCE.forEach((group) => {
      if (availableGroups.has(group)) {
        sanitized.push(group);
      }
    });
  }

  return sanitized.length > 0 ? sanitized : Array.from(availableGroups);
}

function resolveSessionDays(rule, preferredDays = []) {
  const preferred = preferredDays
    .map((day) => normalizeGroupName(day))
    .filter((day) => WEEKDAY_ORDER.includes(day));

  const baseDays = rule.defaultDays || WEEKDAY_ORDER;
  const days = [];
  const seen = new Set();

  [...preferred, ...baseDays, ...WEEKDAY_ORDER].forEach((day) => {
    if (seen.has(day) || !WEEKDAY_ORDER.includes(day)) return;
    days.push(day);
    seen.add(day);
  });

  return days.slice(0, rule.sessionsPerWeek);
}

function chooseSessionGroups({
  weekIndex,
  sessionIndex,
  rule,
  focusGroups,
  availableGroups
}) {
  const blueprint =
    SESSION_BLUEPRINTS[rule.sessionsPerWeek]?.[sessionIndex] || [];

  const groups = new Set();

  // 1. Intentar usar el blueprint pero solo con grupos disponibles
  blueprint.forEach((group) => {
    const normalized = normalizeGroupName(group);
    if (normalized && availableGroups.has(normalized)) {
      groups.add(normalized);
    }
  });

  // 2. Agregar grupos prioritarios de la evaluación IA
  focusGroups.forEach((group, idx) => {
    // Alternancia para distribuir focus areas
    if (!groups.has(group) && availableGroups.has(group) && (idx + weekIndex + sessionIndex) % 2 === 0) {
      groups.add(group);
    }
  });

  // 3. Completar con grupos disponibles si no alcanzamos el mínimo
  const needed = Math.max(rule.exercisesPerSession.min, 3); // Al menos 3 grupos diferentes
  let cursor = 0;
  const maxAttempts = DEFAULT_GROUP_SEQUENCE.length * 2;

  while (groups.size < needed && cursor < maxAttempts) {
    // Rotar por la secuencia default
    const candidate = DEFAULT_GROUP_SEQUENCE[cursor % DEFAULT_GROUP_SEQUENCE.length];
    if (availableGroups.has(candidate)) {
      groups.add(candidate);
    }
    cursor += 1;
  }

  // 4. Si aún no hay suficientes grupos, usar TODOS los disponibles
  if (groups.size < Math.min(3, availableGroups.size)) {
    availableGroups.forEach(group => groups.add(group));
  }

  return Array.from(groups);
}

function parseSeriesReps(seriesReps) {
  if (!seriesReps || typeof seriesReps !== 'string') {
    return { series: 3, repeticiones: '10-12' };
  }

  const cleaned = seriesReps.replace(/\s+/g, '').toLowerCase();
  const [seriesPart, repsPart] = cleaned.split('x');
  const series = Number.parseInt(seriesPart, 10);

  if (!repsPart) {
    return {
      series: Number.isFinite(series) ? series : 3,
      repeticiones: cleaned.includes('x') ? cleaned.split('x')[1] : cleaned
    };
  }

  const repRange = repsPart.replace(/_/g, '-').replace(/:/g, '-');
  return {
    series: Number.isFinite(series) ? series : 3,
    repeticiones: repRange || '10-12'
  };
}

function mapExerciseRow(row) {
  const { series, repeticiones } = parseSeriesReps(row.series_reps_objetivo);
  return {
    ejercicio_id: row.exercise_id,
    nombre: row.nombre,
    nivel: row.nivel,
    grupo_muscular: normalizeGroupName(row.grupo_muscular || row.categoria),
    patron: row.patron,
    equipamiento: row.equipamiento,
    series,
    repeticiones,
    series_reps: row.series_reps_objetivo || `${series}x${repeticiones}`,
    descanso_seg: Number.parseInt(row.descanso_seg, 10) || 60,
    notas: row.notas || row.ejecucion || null,
    consejos: row.consejos || null,
    errores_evitar: row.errores_evitar || null,
    criterio_de_progreso: row.criterio_de_progreso || null,
    progresion_desde: row.progresion_desde || null,
    progresion_hacia: row.progresion_hacia || null,
    uuid: randomUUID()
  };
}

function pickExercisesForSession({
  groups,
  rule,
  groupPools,
  groupCursors,
  usedExerciseNames
}) {
  const exercises = [];
  const target =
    rule.exercisesPerSession.min +
    ((rule.exercisesPerSession.max - rule.exercisesPerSession.min) > 0
      ? (groups.length % (rule.exercisesPerSession.max - rule.exercisesPerSession.min + 1))
      : 0);
  const maxExercises = Math.min(
    rule.exercisesPerSession.max,
    target || rule.exercisesPerSession.max
  );

  const poolGroups = groups.filter((group) => groupPools.has(group));

  // Primera pasada: intentar con ejercicios únicos (no usados en esta semana)
  let round = 0;
  const maxRounds = 2; // 2 pasadas: 1) únicos, 2) permitir repetir

  while (exercises.length < maxExercises && poolGroups.length > 0 && round < maxRounds) {
    const group = poolGroups[exercises.length % poolGroups.length];
    const pool = groupPools.get(group) || [];

    if (pool.length === 0) {
      poolGroups.splice(poolGroups.indexOf(group), 1);
      continue;
    }

    const cursor = groupCursors.get(group) ?? 0;
    let attempts = 0;
    let selectedExercise = null;

    while (attempts < pool.length) {
      const exercise = pool[(cursor + attempts) % pool.length];

      // En la primera ronda, evitar ejercicios ya usados
      // En la segunda ronda (si no hay suficientes), permitir repetir
      const canUse = round === 0
        ? !usedExerciseNames.has(exercise.nombre)
        : true;

      if (canUse) {
        selectedExercise = exercise;
        groupCursors.set(group, (cursor + attempts + 1) % pool.length);
        break;
      }
      attempts += 1;
    }

    if (!selectedExercise) {
      // Si no encontramos ejercicio, intentar siguiente grupo
      const currentGroupIndex = poolGroups.indexOf(group);
      if (currentGroupIndex !== -1) {
        poolGroups.splice(currentGroupIndex, 1);
      }

      // Si ya no hay más grupos, pasar a la siguiente ronda (permitir repetir)
      if (poolGroups.length === 0 && round === 0) {
        round = 1;
        poolGroups.push(...groups.filter(g => groupPools.has(g)));
      }
      continue;
    }

    usedExerciseNames.add(selectedExercise.nombre);
    exercises.push(mapExerciseRow(selectedExercise));
  }

  return exercises;
}

export function buildHipertrofiaPlan({
  levelKey,
  dbLevel,
  selectedMuscleGroups,
  availableExercises,
  goals,
  evaluation,
  startDate,
  preferredDays
}) {
  const normalizedLevel = levelKey?.toLowerCase();
  const rule =
    HIPERTROFIA_LEVEL_RULES[normalizedLevel] ||
    HIPERTROFIA_LEVEL_RULES.principiante;

  const groupPools = buildMusclePools(availableExercises);
  const availableGroups = new Set(groupPools.keys());
  if (availableGroups.size === 0) {
    throw new Error('No hay ejercicios disponibles para los grupos musculares requeridos');
  }

  const focusGroups = sanitizeFocusGroups(
    selectedMuscleGroups?.length ? selectedMuscleGroups : evaluation?.suggested_focus_areas,
    availableGroups
  );

  const sessionDays = resolveSessionDays(rule, preferredDays);
  const groupCursors = new Map();

  const weeks = [];
  let globalExerciseIndex = 0;

  for (let week = 0; week < rule.weeks; week += 1) {
    const weekSessions = [];
    const usedExercisesThisWeek = new Set();

    for (let session = 0; session < rule.sessionsPerWeek; session += 1) {
      const dayName = sessionDays[session % sessionDays.length] || WEEKDAY_ORDER[session];
      const sessionGroups = chooseSessionGroups({
        weekIndex: week,
        sessionIndex: session,
        rule,
        focusGroups,
        availableGroups
      });

      const exercises = pickExercisesForSession({
        groups: sessionGroups,
        rule,
        groupPools,
        groupCursors,
        usedExerciseNames: usedExercisesThisWeek
      }).map((exercise) => ({
        ...exercise,
        originalIndex: globalExerciseIndex++
      }));

      if (exercises.length < rule.exercisesPerSession.min) {
        // Diagnóstico detallado del error
        console.error(`\n❌ ERROR: Semana ${week + 1}, Sesión ${session + 1} (${dayName})`);
        console.error(`📋 Grupos requeridos: ${sessionGroups.join(', ')}`);
        console.error(`📊 Ejercicios disponibles por grupo:`);
        sessionGroups.forEach(group => {
          const available = groupPools.get(group)?.length || 0;
          console.error(`  - ${group}: ${available} ejercicios`);
        });
        console.error(`🎯 Necesarios: ${rule.exercisesPerSession.min}, Obtenidos: ${exercises.length}`);
        console.error(`💡 Ejercicios usados en esta semana: ${usedExercisesThisWeek.size}`);

        throw new Error(
          `No hay suficientes ejercicios para construir sesión de ${sessionGroups.join(', ')}. ` +
          `Se necesitan ${rule.exercisesPerSession.min} ejercicios pero solo se obtuvieron ${exercises.length}. ` +
          `Verifica que haya suficientes ejercicios de estos grupos musculares en la base de datos.`
        );
      }

      weekSessions.push({
        dia: dayName,
        tipo: `Hipertrofia ${rule.dbLabel} - Dia ${session + 1}`,
        grupos_musculares: sessionGroups,
        duracion_min: 60,
        ejercicios: exercises
      });
    }

    weeks.push({
      numero: week + 1,
      enfoque: `Semana ${week + 1} - ${rule.dbLabel}`,
      sesiones: weekSessions
    });
  }

  const totalSessions = rule.weeks * rule.sessionsPerWeek;

  return {
    metodologia: 'Hipertrofia',
    metodologia_solicitada: 'Hipertrofia',
    selected_style: 'Hipertrofia',
    nivel_usuario: dbLevel || rule.dbLabel,
    nivel_detectado: rule.dbLabel,
    descripcion_general:
      'Plan automatizado de hipertrofia construido a partir de la base de datos de ejercicios y la evaluacion del usuario.',
    objetivos: goals || 'Hipertrofia muscular general',
    duracion_total_semanas: rule.weeks,
    frecuencia_por_semana: rule.sessionsPerWeek,
    fecha_inicio: startDate,
    dia_inicio: sessionDays[0],
    total_sesiones: totalSessions,
    ejercicios_por_sesion: `${rule.exercisesPerSession.min}-${rule.exercisesPerSession.max}`,
    resumen_plan: {
      total_semanas: rule.weeks,
      sesiones_por_semana: rule.sessionsPerWeek,
      ejercicios_por_sesion_min: rule.exercisesPerSession.min,
      ejercicios_por_sesion_max: rule.exercisesPerSession.max,
      grupos_prioritarios: focusGroups
    },
    semanas: weeks,
    metadata: {
      generated_at: new Date().toISOString(),
      generator: 'hipertrofia_plan_generator_v1',
      level_rule: normalizedLevel || 'principiante'
    }
  };
}
