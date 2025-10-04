# SOLUCIÓN: Problema con Planes Nutricionales

**Fecha**: 2025-10-04
**Usuario afectado**: ID 18
**Plan nutricional**: ID 2

---

## DIAGNÓSTICO FINAL

### PROBLEMA IDENTIFICADO

El usuario NO ve los alimentos/comidas del plan nutricional generado por la IA.

### CAUSA RAÍZ

**Bug en `NutritionCalendar.jsx` línea 162-172**

El componente está intentando acceder a `nutritionPlan.plan_data.daily_plans` como si fuera un **array**, pero en realidad es un **objeto** con claves numéricas como strings.

#### Estructura REAL en la base de datos:

```json
{
  "daily_plans": {
    "0": { "day": 1, "meals": [...] },
    "1": { "day": 2, "meals": [...] },
    "2": { "day": 3, "meals": [...] },
    ...
    "6": { "day": 7, "meals": [...] }
  }
}
```

#### Lo que el código está intentando hacer:

```javascript
// LÍNEA 162 - INCORRECTO
if (!dayPlan && nutritionPlan?.plan_data?.daily_plans) {
  const dailyPlans = nutritionPlan.plan_data.daily_plans;

  // ❌ ERROR: Intenta acceder como array
  if (planDayIndex >= 0 && planDayIndex < dailyPlans.length && dailyPlans[planDayIndex]) {
    //                                      ^^^^^^^^^^^^^^^^ - undefined porque es un objeto, no array
```

### PROBLEMA ESPECÍFICO

1. `dailyPlans.length` es `undefined` porque `daily_plans` es un **objeto**, no un array
2. La condición `planDayIndex < dailyPlans.length` siempre falla
3. Por lo tanto, nunca se accede a los datos de las comidas
4. El usuario ve solo el plan por defecto vacío

---

## SOLUCIÓN

### Opción 1: Corregir acceso a objeto (RECOMENDADO)

Modificar `NutritionCalendar.jsx` línea 160-191 para acceder correctamente al objeto:

```javascript
// Estructura 2: nutritionPlan.plan_data.daily_plans (OBJETO, no array)
if (!dayPlan && nutritionPlan?.plan_data?.daily_plans) {
  const dailyPlans = nutritionPlan.plan_data.daily_plans;

  // Usar el índice del día si está disponible, sino buscar por nombre
  let planDayIndex = dayIndex;
  if (planDayIndex === undefined) {
    planDayIndex = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ].indexOf(dayName);
  }

  // ✅ CORRECCIÓN: Acceder como objeto, no como array
  const dayKey = planDayIndex.toString();
  if (dailyPlans[dayKey]) {
    const planDay = dailyPlans[dayKey];
    console.log(
      `📅 Mapeando día ${dayName} (índice ${planDayIndex}):`,
      planDay,
    );

    // Convertir estructura de meals a estructura esperada
    dayPlan = {};
    (planDay.meals || []).forEach((meal) => {
      const mealType = (meal.meal_type || "almuerzo").toLowerCase();
      const nutrition = meal.nutrition || {};
      dayPlan[mealType] = {
        name: meal.name || meal.title || meal.meal_name || mealType,
        time: meal.time || "12:00",
        calories: Math.round(nutrition.calories || 0),
        protein: Math.round(nutrition.protein || 0),
        carbs: Math.round(nutrition.carbs || 0),
        fat: Math.round(nutrition.fat || 0),
        foods: meal.ingredients || [],
      };
    });
  }
}
```

### Opción 2: Normalizar en el backend (COMPLEMENTARIA)

Modificar el endpoint `/api/nutrition/profile` para transformar el objeto en array:

```javascript
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    const planQuery = `
      SELECT * FROM app.nutrition_plans
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const planResult = await pool.query(planQuery, [userId]);

    // ✅ Normalizar plan_data si existe
    if (planResult.rows[0]?.plan_data?.daily_plans) {
      const dailyPlans = planResult.rows[0].plan_data.daily_plans;

      // Convertir objeto {"0": {...}, "1": {...}} a array [{...}, {...}]
      if (typeof dailyPlans === 'object' && !Array.isArray(dailyPlans)) {
        const daysArray = Object.keys(dailyPlans)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map(key => dailyPlans[key]);

        planResult.rows[0].plan_data.daily_plans = daysArray;
      }
    }

    // ... resto del código
  }
});
```

---

## IMPLEMENTACIÓN RECOMENDADA

**Usar Opción 1** (corregir frontend) porque:

1. Es más rápido y directo
2. No rompe la estructura de datos guardada
3. Mantiene compatibilidad con otros componentes

**Agregar Opción 2 después** para:

1. Normalizar todos los endpoints
2. Evitar futuros bugs similares
3. Hacer el código más mantenible

---

## VALIDACIÓN DE LA SOLUCIÓN

Después de implementar la corrección, verificar que:

1. El usuario puede ver las 21 comidas (7 días × 3 comidas)
2. Cada comida muestra:
   - Nombre (ej: "Avena con frutas y nueces")
   - Hora (ej: "08:00")
   - Macros (calorías, proteína, carbos, grasas)
   - Ingredientes con cantidades
3. Los logs de consola muestran:
   ```
   📅 Mapeando día Lunes (índice 0): { day: 1, meals: [...] }
   ```

---

## ARCHIVOS A MODIFICAR

### 1. Frontend (OBLIGATORIO)

**Archivo**: `src/components/nutrition/NutritionCalendar.jsx`
**Líneas**: 160-191
**Cambio**: Acceder a `daily_plans` como objeto, no como array

### 2. Backend (OPCIONAL pero recomendado)

**Archivo**: `backend/routes/nutrition.js`
**Líneas**: 39-78 (endpoint `/profile`)
**Cambio**: Normalizar `plan_data.daily_plans` de objeto a array

---

## LOGS DE PRUEBA

Una vez aplicada la corrección, deberías ver en consola:

```
📅 NutritionCalendar - Plan recibido: {
  hasDirectDays: false,
  hasPlanData: true,
  hasDailyPlans: true,
  dailyPlansLength: undefined, // ← Esto es normal si es objeto
  durationDays: 7,
  structure: ['id', 'user_id', 'plan_data', 'duration_days', ...]
}

📅 Primeros 2 días del plan: [
  { dayIndex: 0, mealsCount: 3, mealTypes: ['Desayuno', 'Almuerzo', 'Cena'] },
  { dayIndex: 1, mealsCount: 3, mealTypes: ['Desayuno', 'Almuerzo', 'Cena'] }
]

📅 Mapeando día Lunes (índice 0): {
  day: 1,
  day_name: 'Lunes',
  training_day: true,
  meals: [
    { meal_type: 'Desayuno', name: 'Avena con frutas y nueces', ... },
    { meal_type: 'Almuerzo', name: 'Ensalada de pollo y quinoa', ... },
    { meal_type: 'Cena', name: 'Salmón a la parrilla con brócoli', ... }
  ]
}
```

---

## CÓDIGO COMPLETO CORREGIDO

### NutritionCalendar.jsx - Función `getMealPlanForDay`

```javascript
const getMealPlanForDay = (dayName, dayIndex) => {
  // Intentar obtener el plan del día desde diferentes estructuras posibles
  let dayPlan = null;

  // Estructura 1: nutritionPlan[dayName] (directo)
  if (nutritionPlan && nutritionPlan[dayName]) {
    dayPlan = nutritionPlan[dayName];
  }

  // Estructura 2: nutritionPlan.plan_data.daily_plans (objeto con claves numéricas)
  if (!dayPlan && nutritionPlan?.plan_data?.daily_plans) {
    const dailyPlans = nutritionPlan.plan_data.daily_plans;

    // Usar el índice del día si está disponible, sino buscar por nombre
    let planDayIndex = dayIndex;
    if (planDayIndex === undefined) {
      planDayIndex = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ].indexOf(dayName);
    }

    // ✅ CORRECCIÓN: Acceder como objeto usando la clave como string
    const dayKey = planDayIndex.toString();
    if (dailyPlans[dayKey]) {
      const planDay = dailyPlans[dayKey];
      console.log(
        `📅 Mapeando día ${dayName} (índice ${planDayIndex}):`,
        planDay,
      );

      // Convertir estructura de meals a estructura esperada
      dayPlan = {};
      (planDay.meals || []).forEach((meal) => {
        const mealType = (meal.meal_type || "almuerzo").toLowerCase();
        const nutrition = meal.nutrition || {};
        dayPlan[mealType] = {
          name: meal.name || meal.title || meal.meal_name || mealType,
          time: meal.time || "12:00",
          calories: Math.round(nutrition.calories || 0),
          protein: Math.round(nutrition.protein || 0),
          carbs: Math.round(nutrition.carbs || 0),
          fat: Math.round(nutrition.fat || 0),
          foods: (meal.ingredients || []).map(
            (ing) =>
              `${ing.food || ing.name || "Alimento"} (${ing.amount || "cantidad no especificada"})`,
          ),
        };
      });
    } else {
      console.warn(
        `⚠️ No se encontró el día ${dayName} (clave "${dayKey}") en daily_plans`,
      );
    }
  }

  // Si no hay plan, usar el plan por defecto
  return dayPlan || getDefaultMealPlan(dayName);
};
```

---

## RESUMEN EJECUTIVO

- **Datos guardados**: ✅ Correctos (7 días, 21 comidas, todos los detalles)
- **Backend**: ✅ Funciona correctamente
- **Frontend**: ❌ Bug de acceso a datos (objeto vs array)
- **Solución**: Cambiar 10 líneas de código en `NutritionCalendar.jsx`
- **Tiempo estimado**: 5 minutos

**NO es necesario regenerar el plan nutricional, solo corregir el código del frontend.**

---

**FIN DE LA SOLUCIÓN**
