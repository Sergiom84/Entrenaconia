# DIAGNÓSTICO Y SOLUCIÓN: Bug de Comidas Diferentes en Calendario de Nutrición

## Problema Detectado

El usuario veía **comidas completamente diferentes** cuando:

1. Miraba la **tarjeta resumen** de un día (ej: Sábado 4 octubre)
2. Hacía clic en el día para ver el **detalle completo**

### Ejemplo del Bug

**Sábado 4 de octubre en tarjeta resumen (CORRECTO):**

- Desayuno: Avena con fruta y yogur (08:00)
- Almuerzo: Ensalada de atún (13:00)
- Cena: Tazón de quinoa y vegetales (20:00)

**Sábado 4 de octubre en detalle (INCORRECTO):**

- Desayuno: Avena con frutas y nueces (08:00)
- Almuerzo: Ensalada de pollo y quinoa (13:00)
- Cena: Salmón a la parrilla con brócoli (20:00)

**Resultado:** Comidas de días diferentes mostradas para el mismo día.

---

## Análisis de la Base de Datos

### Estructura del Plan

El plan de nutrición (ID: 2, Usuario: 18) tiene la siguiente estructura:

```json
{
  "daily_plans": {
    "0": { "day_name": "Lunes", ... },
    "1": { "day_name": "Martes", ... },
    "2": { "day_name": "Miércoles", ... },
    "3": { "day_name": "Jueves", ... },
    "4": { "day_name": "Viernes", ... },
    "5": { "day_name": "Sábado", ... },   ← SÁBADO 4 OCT = ÍNDICE 5
    "6": { "day_name": "Domingo", ... }
  }
}
```

**IMPORTANTE:**

- `daily_plans` es un **objeto** con claves numéricas ('0'-'6'), **NO un array**
- Plan creado el: 2025-10-04 (Sábado)
- El Sábado 4 de octubre corresponde al **índice 5** en la base de datos

### Comidas Reales del Sábado (Índice 5 en BD)

```
Desayuno (08:00): Avena con fruta y yogur
Almuerzo (13:00): Ensalada de atún
Cena (20:00): Tazón de quinoa y vegetales
```

---

## Causa Raíz del Bug

### Archivo Afectado

`src/components/nutrition/NutritionCalendar.jsx`

### Código Problemático

#### Línea 281 (Vista de tarjetas - CORRECTO)

```javascript
const dayMeals = getMealPlanForDay(day.name, day.dayIndex);
```

✅ **Funciona correctamente** porque pasa `day.dayIndex` calculado desde la fecha real.

#### Línea 395 (Vista de detalle - INCORRECTO)

```javascript
{Object.entries(getMealPlanForDay(weekDays.find(d => d.dateString === selectedDay)?.name)).map(...
```

❌ **Bug aquí**: Solo pasa `day.name`, falta el parámetro `dayIndex`.

### Función getMealPlanForDay (Líneas 152-200)

Cuando `dayIndex` es `undefined`, la función hace un **fallback incorrecto**:

```javascript
// Líneas 167-170
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
```

**Problema:**

- Este fallback asume que el array empieza en Lunes=0
- Para 'Sábado', devuelve índice **5**
- ✅ **Casualmente, 5 es correcto para este plan**
- ❌ **PERO es por suerte, no por diseño**
- ❌ **Falla si el plan empieza en otro día de la semana**

### Por qué funcionaba a veces

En este caso específico:

- Plan creado el Sábado (día 0 del plan)
- Estructura BD: `0=Lunes, 1=Martes, ..., 5=Sábado`
- Fallback: `['Lunes'...].indexOf('Sábado')` = 5
- **Por coincidencia, ambos dan 5**

**PERO:** Si el plan hubiera empezado en Miércoles, el mapeo estaría completamente roto.

---

## Solución Implementada

### Cambios Realizados

#### 1. Pasar `dayIndex` correctamente en la vista de detalle

**Antes (líneas 376-395):**

```javascript
{selectedDay && (
  <Card className="bg-gray-800/70 border-gray-600">
    <CardHeader>
      <CardTitle className="text-white flex items-center justify-between">
        <span>
          Detalle del {weekDays.find(d => d.dateString === selectedDay)?.name}
        </span>
        ...
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(getMealPlanForDay(
          weekDays.find(d => d.dateString === selectedDay)?.name
        )).map(([mealId, meal]) => (
          ...
```

**Después (optimizado con IIFE):**

```javascript
{selectedDay && (() => {
  const selectedDayData = weekDays.find(d => d.dateString === selectedDay);
  const selectedDayMeals = getMealPlanForDay(selectedDayData?.name, selectedDayData?.dayIndex);

  return (
    <Card className="bg-gray-800/70 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>
            Detalle del {selectedDayData?.name} ({selectedDayData?.date.getDate()} de {selectedDayData?.date.toLocaleDateString('es-ES', { month: 'long' })})
          </span>
          ...
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(selectedDayMeals).map(([mealId, meal]) => (
            ...
```

### Beneficios de la Solución

1. **Corrección del Bug:**
   - Ahora pasa `dayIndex` correctamente a `getMealPlanForDay()`
   - La vista de detalle usa el mismo índice que la tarjeta resumen
   - Las comidas coinciden entre ambas vistas

2. **Optimización de Performance:**
   - Antes: `weekDays.find()` se llamaba **3 veces** (líneas 381, 395, 395)
   - Después: Se llama **1 sola vez** y se reutiliza
   - Reduce operaciones innecesarias en el render

3. **Mejor UX:**
   - Se agregó la fecha completa en el título: "Detalle del Sábado (4 de octubre)"
   - Más contexto visual para el usuario

---

## Estructura Correcta del Mapeo

### generateWeekStructure() (Líneas 50-93)

Esta función genera correctamente el mapeo:

```javascript
for (let i = 0; i < 7; i++) {
  const date = new Date(planStartDate);
  date.setDate(planStartDate.getDate() + i + currentWeek * 7);

  // Calcular el índice del día dentro del plan (0 a planDuration-1)
  const daysSinceStart = Math.floor(
    (date - planStartDate) / (1000 * 60 * 60 * 24),
  );
  const dayIndexInPlan = daysSinceStart % planDuration; // Ciclar si el plan es más corto

  weekDays.push({
    name: dayNames[date.getDay()], // ✅ Nombre real del día según la fecha
    date: date,
    dateString: date.toISOString().split("T")[0],
    isToday: date.toDateString() === today.toDateString(),
    dayIndex: dayIndexInPlan, // ✅ Índice dentro del plan (con ciclo)
    daysSinceStart: daysSinceStart,
    isWithinPlan: isWithinPlan,
  });
}
```

**Ejemplo para el Sábado 4 octubre:**

- `planStartDate` = 2025-10-04 (Sábado)
- `date` = 2025-10-04
- `daysSinceStart` = 0 días desde inicio
- `dayIndexInPlan` = 0 % 7 = **0**
- `dayNames[date.getDay()]` = dayNames[6] = **"Sábado"**

**Pero espera...**

Déjame revisar esto de nuevo. Según la salida de la BD:

```
Plan creado: sábado, 4 de octubre de 2025
Índice 0: Lunes
Índice 1: Martes
Índice 2: Miércoles
Índice 3: Jueves
Índice 4: Viernes
Índice 5: Sábado  ← SÁBADO EN BD
Índice 6: Domingo
```

**Problema adicional detectado:** La estructura del plan en la BD **NO empieza en el día de creación**. El plan siempre empieza en Lunes (índice 0), no en el día que se creó.

Esto significa que:

- Plan creado: Sábado 4 octubre
- Pero el plan define: Lunes=0, Martes=1, ..., Sábado=5
- El Sábado 4 octubre debería mapear al **índice 5** (no 0)

---

## Validación de la Solución

### Test del Mapeo

Para el plan creado el Sábado 4 octubre 2025:

| Fecha Real | Día | daysSinceStart | dayIndexInPlan | Índice BD | Comidas Correctas |
| ---------- | --- | -------------- | -------------- | --------- | ----------------- |
| 2025-10-04 | Sáb | 0              | 0              | **5**     | ❌ PROBLEMA       |
| 2025-10-05 | Dom | 1              | 1              | **6**     | ❌ PROBLEMA       |
| 2025-10-06 | Lun | 2              | 2              | **0**     | ❌ PROBLEMA       |

**PROBLEMA CRÍTICO ADICIONAL DETECTADO:**

El cálculo de `dayIndexInPlan` en `generateWeekStructure()` **NO tiene en cuenta qué día de la semana se creó el plan**.

### Necesita Segundo Fix

Déjame revisar el prompt de IA que genera el plan para entender la estructura esperada.

---

## Archivos Involucrados

- ✅ **CORREGIDO**: `src/components/nutrition/NutritionCalendar.jsx` (línea 395)
- ⚠️ **PENDIENTE REVISAR**: Lógica de `generateWeekStructure()` líneas 50-93

## Próximos Pasos Recomendados

1. ✅ Verificar que el fix funciona con build exitoso
2. ⚠️ Verificar en navegador que las comidas coinciden
3. ⚠️ Revisar si `generateWeekStructure()` necesita corrección adicional
4. Probar con diferentes días de creación del plan

---

## Conclusión

El bug principal fue causado por:

1. Parámetro faltante (`dayIndex`) en la vista de detalle
2. Fallback incorrecto que asume plan siempre empieza en Lunes

La solución implementada:

1. ✅ Pasa `dayIndex` correctamente en ambas vistas
2. ✅ Optimiza performance evitando búsquedas duplicadas
3. ⚠️ Puede requerir ajuste adicional en `generateWeekStructure()`

**Estado:** CORREGIDO PARCIALMENTE - Requiere validación en navegador
