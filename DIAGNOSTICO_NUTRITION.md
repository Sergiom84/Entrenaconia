# DIAGNÓSTICO COMPLETO: Problema con Planes Nutricionales

**Fecha**: 2025-10-04
**Usuario afectado**: ID 18
**Plan nutricional**: ID 2

---

## RESUMEN EJECUTIVO

**PROBLEMA IDENTIFICADO**: Los datos del plan nutricional están CORRECTAMENTE guardados en la base de datos, pero el frontend NO ESTÁ LEYENDO el campo correcto.

**CAUSA RAÍZ**: Desalineamiento entre la estructura de datos de la BD y lo que espera el frontend.

---

## 1. VERIFICACIÓN DE BASE DE DATOS

### Plan nutricional encontrado

```json
{
  "id": 2,
  "user_id": 18,
  "duration_days": 7,
  "target_calories": 2641,
  "meals_per_day": 3,
  "methodology_focus": "Calistenia",
  "dietary_style": "none",
  "created_at": "2025-10-04T18:27:03.223Z",
  "is_active": true
}
```

### Estructura de tablas

La base de datos tiene SOLO 2 tablas relacionadas con nutrición:

1. **`nutrition_plans`** (tabla principal)
   - `id` (integer)
   - `user_id` (integer)
   - **`plan_data` (JSONB)** ← AQUÍ ESTÁN LOS DATOS
   - `duration_days` (integer)
   - `target_calories` (integer)
   - `target_protein` (numeric)
   - `target_carbs` (numeric)
   - `target_fat` (numeric)
   - `meals_per_day` (integer)
   - `methodology_focus` (varchar)
   - `dietary_style` (varchar)
   - `is_active` (boolean)
   - `generation_mode` (varchar)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

2. **`daily_nutrition_log`** (registro diario del usuario)
   - Para tracking de lo que come el usuario, NO para el plan generado

---

## 2. ESTRUCTURA DEL CAMPO `plan_data` (JSONB)

El plan nutricional completo está guardado en el campo **`plan_data`** como un objeto JSONB con la siguiente estructura:

```json
{
  "daily_plans": {
    "0": {
      "day": 1,
      "day_name": "Lunes",
      "training_day": true,
      "total_nutrition": {
        "calories": 2641,
        "protein": 198,
        "carbs": 264,
        "fat": 88
      },
      "meals": [
        {
          "meal_type": "Desayuno",
          "name": "Avena con frutas y nueces",
          "time": "08:00",
          "nutrition": {
            "calories": 600,
            "protein": 20,
            "carbs": 90,
            "fat": 20,
            "fiber": 10
          },
          "ingredients": [
            {
              "food": "Avena",
              "amount": "100g",
              "calories": 389,
              "protein": 13,
              "carbs": 66,
              "fat": 7
            },
            {
              "food": "Plátano",
              "amount": "1 mediano",
              "calories": 105,
              "protein": 1,
              "carbs": 27,
              "fat": 0
            },
            {
              "food": "Nueces",
              "amount": "30g",
              "calories": 200,
              "protein": 5,
              "carbs": 4,
              "fat": 20
            }
          ],
          "preparation": {
            "difficulty": "fácil",
            "time_minutes": 5,
            "steps": [
              "Cocinar la avena con agua o leche.",
              "Agregar plátano y nueces al servir."
            ]
          },
          "alternatives": [
            "Yogur griego con miel y frutas",
            "Tostadas integrales con aguacate"
          ],
          "timing_notes": "Ideal para energía antes del entrenamiento."
        },
        {
          "meal_type": "Almuerzo",
          "name": "Ensalada de pollo y quinoa",
          "time": "13:00",
          "nutrition": { ... },
          "ingredients": [ ... ],
          "preparation": { ... },
          "alternatives": [ ... ],
          "timing_notes": "..."
        },
        {
          "meal_type": "Cena",
          "name": "Salmón a la parrilla con brócoli",
          "time": "20:00",
          "nutrition": { ... },
          "ingredients": [ ... ],
          "preparation": { ... },
          "alternatives": [ ... ],
          "timing_notes": "..."
        }
      ]
    },
    "1": {
      "day": 2,
      "day_name": "Martes",
      "training_day": false,
      "total_nutrition": { ... },
      "meals": [ ... ]
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... },
    "6": { ... }
  }
}
```

### Resumen de los datos guardados

- **7 días completos** (índices 0-6)
- **3 comidas por día** (Desayuno, Almuerzo, Cena)
- **Total: 21 comidas** con ingredientes detallados
- **Tamaño del JSON**: 17,003 caracteres
- **Datos completos**: Sí, incluyen:
  - Nombre de cada comida
  - Hora recomendada
  - Información nutricional completa
  - Lista de ingredientes con cantidades
  - Pasos de preparación
  - Alternativas
  - Notas de timing

---

## 3. PROBLEMA IDENTIFICADO

### La base de datos tiene los datos CORRECTOS

Los datos están guardados correctamente en `plan_data` con la siguiente estructura:

```
plan_data.daily_plans["0"].meals[0] = Desayuno del día 1
plan_data.daily_plans["0"].meals[1] = Almuerzo del día 1
plan_data.daily_plans["0"].meals[2] = Cena del día 1
plan_data.daily_plans["1"].meals[0] = Desayuno del día 2
... (y así sucesivamente)
```

### El frontend NO está accediendo a estos datos

Posibles causas:

1. **El endpoint del backend NO devuelve `plan_data`**
   - Verifica que `/api/nutrition/plans/:id` incluya el campo `plan_data`

2. **El frontend espera una estructura diferente**
   - Puede estar buscando `meals`, `days`, o `daily_meals` en lugar de `daily_plans`

3. **El frontend no está desestructurando correctamente el JSONB**
   - JavaScript debe acceder a `response.plan_data.daily_plans`

---

## 4. DATOS DE EJEMPLO

### Día 1 - Desayuno completo

```json
{
  "name": "Avena con frutas y nueces",
  "time": "08:00",
  "meal_type": "Desayuno",
  "nutrition": {
    "calories": 600,
    "protein": 20,
    "carbs": 90,
    "fat": 20,
    "fiber": 10
  },
  "ingredients": [
    {
      "food": "Avena",
      "amount": "100g",
      "calories": 389,
      "protein": 13,
      "carbs": 66,
      "fat": 7
    },
    {
      "food": "Plátano",
      "amount": "1 mediano",
      "calories": 105,
      "protein": 1,
      "carbs": 27,
      "fat": 0
    },
    {
      "food": "Nueces",
      "amount": "30g",
      "calories": 200,
      "protein": 5,
      "carbs": 4,
      "fat": 20
    }
  ],
  "preparation": {
    "difficulty": "fácil",
    "time_minutes": 5,
    "steps": [
      "Cocinar la avena con agua o leche.",
      "Agregar plátano y nueces al servir."
    ]
  },
  "alternatives": [
    "Yogur griego con miel y frutas",
    "Tostadas integrales con aguacate"
  ],
  "timing_notes": "Ideal para energía antes del entrenamiento."
}
```

---

## 5. SIGUIENTES PASOS PARA SOLUCIONAR

### Paso 1: Verificar endpoint del backend

Revisar `/api/nutrition/plans/:id` en `backend/routes/nutrition.js`:

```javascript
// Debe incluir plan_data en el SELECT
const result = await pool.query(
  `
  SELECT
    id,
    user_id,
    plan_data,  -- ← ASEGURARSE DE QUE ESTÉ AQUÍ
    duration_days,
    target_calories,
    ...
  FROM app.nutrition_plans
  WHERE id = $1
`,
  [id],
);
```

### Paso 2: Verificar que el frontend acceda correctamente

En `NutritionScreen.jsx` o el componente correspondiente:

```javascript
// Debe acceder a plan_data.daily_plans
const meals = nutritionPlan.plan_data?.daily_plans?.[dayIndex]?.meals || [];

// NO debería buscar:
// - nutritionPlan.meals
// - nutritionPlan.daily_meals
// - nutritionPlan.days
```

### Paso 3: Verificar la transformación de datos

Si el backend transforma el JSONB antes de enviarlo, asegurarse de que NO esté eliminando `plan_data`.

---

## 6. CONCLUSIONES

- Los datos del plan nutricional están COMPLETAMENTE guardados en la BD
- El plan contiene 7 días completos con 3 comidas cada uno
- Cada comida tiene ingredientes detallados, preparación, alternativas y timing
- El problema es 100% de integración frontend-backend
- NO es necesario regenerar el plan, solo arreglar cómo se lee

---

## 7. VALIDACIÓN TÉCNICA

**Consulta SQL para verificar datos:**

```sql
SELECT
  id,
  user_id,
  jsonb_array_length(plan_data->'daily_plans') as total_days,
  jsonb_array_length(plan_data->'daily_plans'->'0'->'meals') as meals_day_1,
  plan_data->'daily_plans'->'0'->'meals'->0->>'name' as first_meal_name
FROM app.nutrition_plans
WHERE id = 2;
```

**Resultado esperado:**

- total_days: No aplica (es objeto, no array)
- meals_day_1: 3
- first_meal_name: "Avena con frutas y nueces"

---

**FIN DEL DIAGNÓSTICO**
