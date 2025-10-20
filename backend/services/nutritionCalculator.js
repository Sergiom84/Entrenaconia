/**
 * Servicio de Cálculo Determinista de Nutrición
 * Sistema basado en fórmulas científicas (Mifflin-St Jeor)
 * Carb Cycling para optimización
 */

/**
 * Calcula la Tasa Metabólica Basal (BMR) usando Mifflin-St Jeor
 * @param {Object} profile - Perfil del usuario
 * @param {string} profile.sexo - 'hombre' | 'mujer'
 * @param {number} profile.peso_kg - Peso en kilogramos
 * @param {number} profile.altura_cm - Altura en centímetros
 * @param {number} profile.edad - Edad en años
 * @returns {number} BMR en kcal/día
 */
export function calculateBMR({ sexo, peso_kg, altura_cm, edad }) {
  // Mifflin-St Jeor Equation (más precisa que Harris-Benedict)
  const baseBMR = 10 * peso_kg + 6.25 * altura_cm - 5 * edad;

  if (sexo === 'hombre') {
    return Math.round(baseBMR + 5);
  } else {
    return Math.round(baseBMR - 161);
  }
}

/**
 * Factores de actividad física para TDEE
 */
const ACTIVITY_FACTORS = {
  sedentario: 1.2,    // Poco o ningún ejercicio
  ligero: 1.375,      // Ejercicio ligero 1-3 días/semana
  moderado: 1.55,     // Ejercicio moderado 3-5 días/semana
  alto: 1.725,        // Ejercicio intenso 6-7 días/semana
  muy_alto: 1.9       // Ejercicio muy intenso + trabajo físico
};

/**
 * Calcula el Gasto Energético Total Diario (TDEE)
 * @param {number} bmr - Tasa metabólica basal
 * @param {string} actividad - Nivel de actividad
 * @returns {number} TDEE en kcal/día
 */
export function calculateTDEE(bmr, actividad) {
  const factor = ACTIVITY_FACTORS[actividad] || ACTIVITY_FACTORS.moderado;
  return Math.round(bmr * factor);
}

/**
 * Ajusta calorías según objetivo
 * @param {number} tdee - Gasto energético total diario
 * @param {string} objetivo - 'cut' | 'mant' | 'bulk'
 * @returns {number} Calorías objetivo ajustadas
 */
export function adjustCaloriesForGoal(tdee, objetivo) {
  switch (objetivo) {
    case 'cut':
      // Déficit del 15-20% (usamos 17% como término medio)
      return Math.round(tdee * 0.83);
    case 'bulk':
      // Superávit del 10-15% (usamos 12% como término medio)
      return Math.round(tdee * 1.12);
    case 'mant':
    default:
      // Mantenimiento
      return tdee;
  }
}

/**
 * Calcula la distribución de macronutrientes
 * @param {number} kcalObjetivo - Calorías objetivo diarias
 * @param {number} peso_kg - Peso del usuario en kg
 * @param {string} trainingType - Tipo de entrenamiento
 * @param {string} objetivo - 'cut' | 'mant' | 'bulk'
 * @returns {Object} Distribución de macros {protein_g, carbs_g, fat_g}
 */
export function calculateMacros(kcalObjetivo, peso_kg, trainingType, objetivo) {
  // 1. PROTEÍNA: Según objetivo y tipo de entrenamiento
  let proteinPerKg;

  if (trainingType === 'hipertrofia' || trainingType === 'fuerza') {
    proteinPerKg = objetivo === 'bulk' ? 2.2 : 2.0;
  } else if (trainingType === 'resistencia') {
    proteinPerKg = 1.6;
  } else {
    proteinPerKg = 1.8; // Default
  }

  const protein_g = Math.round(peso_kg * proteinPerKg);
  const proteinKcal = protein_g * 4; // 4 kcal por gramo de proteína

  // 2. GRASAS: 25% de las calorías totales (20-30% rango saludable)
  const fatPercentage = objetivo === 'cut' ? 0.25 : 0.28;
  const fatKcal = Math.round(kcalObjetivo * fatPercentage);
  const fat_g = Math.round(fatKcal / 9); // 9 kcal por gramo de grasa

  // 3. CARBOHIDRATOS: El resto de las calorías
  const carbsKcal = kcalObjetivo - proteinKcal - fatKcal;
  const carbs_g = Math.round(carbsKcal / 4); // 4 kcal por gramo de carbohidratos

  return {
    protein_g,
    carbs_g,
    fat_g
  };
}

/**
 * Aplica carb cycling a los macros base
 * @param {Object} baseMacros - Macros base diarios
 * @param {boolean} isTrainingDay - Si es día de entrenamiento
 * @returns {Object} Macros ajustados con carb cycling
 */
export function applyCarbCycling(baseMacros, isTrainingDay) {
  const { protein_g, carbs_g, fat_g } = baseMacros;

  if (isTrainingDay) {
    // Día de entrenamiento: +10% carbohidratos
    const newCarbs = Math.round(carbs_g * 1.10);
    const carbsDiff = (newCarbs - carbs_g) * 4; // Diferencia en kcal

    return {
      protein_g,
      carbs_g: newCarbs,
      fat_g,
      kcal: protein_g * 4 + newCarbs * 4 + fat_g * 9
    };
  } else {
    // Día de descanso: -15% carbohidratos, +grasas compensar
    const newCarbs = Math.round(carbs_g * 0.85);
    const carbsDiff = (carbs_g - newCarbs) * 4; // kcal reducidas
    const addedFat = Math.round(carbsDiff / 9); // Compensar con grasa

    return {
      protein_g,
      carbs_g: newCarbs,
      fat_g: fat_g + addedFat,
      kcal: protein_g * 4 + newCarbs * 4 + (fat_g + addedFat) * 9
    };
  }
}

/**
 * Distribuye macros entre comidas del día
 * @param {Object} dayMacros - Macros totales del día
 * @param {number} numMeals - Número de comidas (3-6)
 * @param {boolean} isTrainingDay - Si es día de entrenamiento
 * @returns {Array} Array de objetos con macros por comida
 */
export function distributeMacrosAcrossMeals(dayMacros, numMeals = 4, isTrainingDay = false) {
  const { protein_g, carbs_g, fat_g, kcal } = dayMacros;

  // Distribución estándar por comida
  const mealNames = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Snack nocturno'];
  const meals = [];

  if (numMeals === 3) {
    // 3 comidas: 30% - 40% - 30%
    const distributions = [0.30, 0.40, 0.30];
    for (let i = 0; i < 3; i++) {
      meals.push({
        nombre: ['Desayuno', 'Comida', 'Cena'][i],
        orden: i + 1,
        kcal: Math.round(kcal * distributions[i]),
        macros: {
          protein_g: Math.round(protein_g * distributions[i]),
          carbs_g: Math.round(carbs_g * distributions[i]),
          fat_g: Math.round(fat_g * distributions[i])
        }
      });
    }
  } else if (numMeals === 4) {
    // 4 comidas: 25% - 15% - 35% - 25%
    const distributions = [0.25, 0.15, 0.35, 0.25];
    for (let i = 0; i < 4; i++) {
      meals.push({
        nombre: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'][i],
        orden: i + 1,
        kcal: Math.round(kcal * distributions[i]),
        macros: {
          protein_g: Math.round(protein_g * distributions[i]),
          carbs_g: Math.round(carbs_g * distributions[i]),
          fat_g: Math.round(fat_g * distributions[i])
        },
        timing_note: isTrainingDay && i === 2 ? 'Post-entreno' : null
      });
    }
  } else if (numMeals === 5) {
    // 5 comidas: 20% - 15% - 30% - 15% - 20%
    const distributions = [0.20, 0.15, 0.30, 0.15, 0.20];
    for (let i = 0; i < 5; i++) {
      meals.push({
        nombre: ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena'][i],
        orden: i + 1,
        kcal: Math.round(kcal * distributions[i]),
        macros: {
          protein_g: Math.round(protein_g * distributions[i]),
          carbs_g: Math.round(carbs_g * distributions[i]),
          fat_g: Math.round(fat_g * distributions[i])
        },
        timing_note: isTrainingDay && i === 3 ? 'Post-entreno' : null
      });
    }
  } else if (numMeals === 6) {
    // 6 comidas: 20% - 10% - 25% - 15% - 20% - 10%
    const distributions = [0.20, 0.10, 0.25, 0.15, 0.20, 0.10];
    for (let i = 0; i < 6; i++) {
      meals.push({
        nombre: mealNames[i],
        orden: i + 1,
        kcal: Math.round(kcal * distributions[i]),
        macros: {
          protein_g: Math.round(protein_g * distributions[i]),
          carbs_g: Math.round(carbs_g * distributions[i]),
          fat_g: Math.round(fat_g * distributions[i])
        },
        timing_note: isTrainingDay && i === 3 ? 'Post-entreno' : null
      });
    }
  }

  return meals;
}

/**
 * Genera un plan nutricional completo para N días
 * @param {Object} profile - Perfil nutricional del usuario
 * @param {number} duracionDias - Duración del plan (3-31 días)
 * @param {Array} trainingSchedule - Días de entrenamiento [true, false, true, ...]
 * @returns {Object} Plan nutricional completo
 */
export function generateNutritionPlan(profile, duracionDias, trainingSchedule = []) {
  const {
    sexo,
    edad,
    altura_cm,
    peso_kg,
    objetivo,
    actividad,
    comidas_dia,
    training_type = 'general'
  } = profile;

  // 1. Calcular BMR y TDEE
  const bmr = calculateBMR({ sexo, peso_kg, altura_cm, edad });
  const tdee = calculateTDEE(bmr, actividad);

  // 2. Ajustar calorías por objetivo
  const kcalObjetivo = adjustCaloriesForGoal(tdee, objetivo);

  // 3. Calcular macros base
  const baseMacros = calculateMacros(kcalObjetivo, peso_kg, training_type, objetivo);

  // 4. Generar días del plan con carb cycling
  const days = [];
  for (let i = 0; i < duracionDias; i++) {
    const isTrainingDay = trainingSchedule[i % trainingSchedule.length] || (i % 2 === 0);
    const dayMacros = applyCarbCycling(baseMacros, isTrainingDay);
    const meals = distributeMacrosAcrossMeals(dayMacros, comidas_dia, isTrainingDay);

    days.push({
      day_index: i,
      tipo_dia: isTrainingDay ? 'entreno' : 'descanso',
      kcal: dayMacros.kcal,
      macros: {
        protein_g: dayMacros.protein_g,
        carbs_g: dayMacros.carbs_g,
        fat_g: dayMacros.fat_g
      },
      meals
    });
  }

  return {
    bmr,
    tdee,
    kcal_objetivo: kcalObjetivo,
    macros_objetivo: baseMacros,
    meta: objetivo,
    duracion_dias: duracionDias,
    training_type,
    comidas_por_dia: comidas_dia,
    fuente: 'determinista',
    version_reglas: 'v1',
    days
  };
}

/**
 * Valida los macros calculados
 * @param {Object} macros - Macros a validar
 * @param {number} kcalTarget - Calorías objetivo
 * @param {number} tolerance - Tolerancia en % (default 2%)
 * @returns {boolean} true si los macros son válidos
 */
export function validateMacros(macros, kcalTarget, tolerance = 0.02) {
  const { protein_g, carbs_g, fat_g } = macros;
  const calculatedKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;

  const diff = Math.abs(calculatedKcal - kcalTarget);
  const diffPercent = diff / kcalTarget;

  return diffPercent <= tolerance;
}
