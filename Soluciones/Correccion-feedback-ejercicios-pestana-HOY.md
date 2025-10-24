# Corrección: Feedback Visual de Ejercicios en Pestaña "HOY"

## 📋 Índice

1. [Problema Detectado](#problema-detectado)
2. [Síntomas](#síntomas)
3. [Diagnóstico](#diagnóstico)
4. [Causa Raíz](#causa-raíz)
5. [Solución Implementada](#solución-implementada)
6. [Cambios en el Código](#cambios-en-el-código)
7. [Verificación](#verificación)
8. [Troubleshooting](#troubleshooting)

---

## 🐛 Problema Detectado

**Fecha:** 24 de octubre de 2025
**Componente:** `TodayTrainingTab.jsx`
**Ubicación:** `src/components/routines/tabs/TodayTrainingTab.jsx`

### Descripción

Los ejercicios en la pestaña "Hoy" no mostraban el feedback visual de estados ni los comentarios/sentimientos del usuario, mientras que en la pestaña "Calendario" sí funcionaba correctamente.

---

## 🔍 Síntomas

### Lo que NO funcionaba:

- ❌ Los ejercicios no mostraban colores según su estado (verde=completado, gris=saltado, rojo=cancelado)
- ❌ No aparecían los iconos/pills de sentimiento (❤️ Me gusta, ⚠️ Es difícil, 👎 No me gusta)
- ❌ Los comentarios del usuario no se mostraban

### Lo que SÍ funcionaba:

- ✅ CalendarTab mostraba correctamente todos los feedbacks
- ✅ Los datos existían en la base de datos

### Ejemplo de datos en BD (Plan 104, Usuario 19):

```sql
-- Resultados reales de la base de datos
✅ 3 ejercicios completados
⏭️ 2 ejercicios saltados
❌ 1 ejercicio cancelado
```

---

## 🔬 Diagnóstico

### Paso 1: Verificar Base de Datos

```bash
# Query ejecutado para verificar datos
SELECT
  exercise_order,
  exercise_name,
  status,
  series_completed,
  time_spent_seconds,
  personal_feedback
FROM app.methodology_exercise_progress
WHERE methodology_session_id = 101
ORDER BY exercise_order;
```

**Resultado:** Los datos existen correctamente en BD ✅

### Paso 2: Verificar Endpoint del Backend

```javascript
// Endpoint: GET /api/training-session/today-status
// Parámetros: methodology_plan_id, week_number, day_name
```

**Resultado:** El endpoint devuelve correctamente:

```json
{
  "success": true,
  "session": { ... },
  "exercises": [
    {
      "exercise_order": 0,
      "exercise_name": "Press inclinado con mancuernas",
      "status": "completed",
      "sentiment": null,
      "comment": null
    },
    // ... más ejercicios
  ],
  "summary": {
    "total": 6,
    "completed": 3,
    "skipped": 2,
    "cancelled": 1
  }
}
```

**Resultado:** El endpoint funciona correctamente ✅

### Paso 3: Verificar Frontend

```javascript
// TodayTrainingTab.jsx línea ~157
getTodayStatusCached; // ❌ Esta función NO EXISTE en WorkoutContext
```

**Resultado:** Función inexistente ❌

---

## 🎯 Causa Raíz

### Problema 1: Función Inexistente

```javascript
// ANTES (línea 157)
const { getTodayStatusCached } = useWorkout(); // ❌ No existe

// La función se usaba en línea 195
const data = await getTodayStatusCached({
  methodologyPlanId: currentMethodologyPlanId,
  dayId,
}); // ❌ Nunca se ejecutaba
```

### Problema 2: Parámetros Incorrectos

El componente intentaba usar `dayId` pero el endpoint espera:

- ✅ `week_number` (número de semana del plan)
- ✅ `day_name` (nombre del día: Lun, Mar, Mie, etc.)

### Problema 3: Datos No Propagados

Aunque el endpoint devolvía `sentiment` y `comment`, el componente no los pasaba a `ExerciseListItem`:

```javascript
// ANTES
const ex = {
  ...ejercicio,
  status,
  exercise_name: ejercicio.nombre,
  series_total: ejercicio.series,
  // ❌ Faltaba: sentiment y comment
};
```

---

## 💡 Solución Implementada

### Solución 1: Implementar `fetchTodayStatus` Local

**Archivo:** `TodayTrainingTab.jsx` (líneas 185-269)

```javascript
const fetchTodayStatus = useCallback(async () => {
  const currentMethodologyPlanId = methodologyPlanId || plan.methodologyPlanId;
  if (!hasActivePlan || !currentMethodologyPlanId) return null;

  setLoadingTodayStatus(true);
  try {
    // 1. Verificar token
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.error("❌ No hay token de autenticación");
      return null;
    }

    // 2. Calcular parámetros correctos
    const startISO =
      plan.planStartDate || planStartDate || new Date().toISOString();
    const dayId = computeDayId(startISO, "Europe/Madrid");
    const weekNumber = Math.max(1, Math.ceil(dayId / 7));

    // Normalizar día
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const dayName = dayNames[new Date().getDay()];

    // 3. Construir URL con query params
    const url = `/training-session/today-status?methodology_plan_id=${currentMethodologyPlanId}&week_number=${weekNumber}&day_name=${dayName}`;

    // 4. Usar fetch directo
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:3010"}/api${url}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error en today-status:", response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.success) {
      const normalized = {
        session: data.session,
        exercises: data.exercises,
        summary: data.summary,
      };
      setTodayStatus(normalized);
      return normalized;
    }

    return null;
  } catch (error) {
    console.error("❌ Error obteniendo estado del día:", error);
    return null;
  } finally {
    setLoadingTodayStatus(false);
  }
}, [
  methodologyPlanId,
  plan.methodologyPlanId,
  plan.planStartDate,
  planStartDate,
  hasActivePlan,
]);
```

### Solución 2: Propagar `sentiment` y `comment`

**Archivo:** `TodayTrainingTab.jsx` (3 ubicaciones)

#### Ubicación 1: Sesión en Progreso (líneas 1362-1397)

```javascript
{
  todaySessionData.ejercicios.map((ejercicio, index) => {
    const backendExercise = todayStatus?.exercises?.[index];

    const status = (() => {
      if (backendExercise?.status) {
        return String(backendExercise.status).toLowerCase();
      }
      if (exerciseProgress[index]?.status) {
        return String(exerciseProgress[index].status).toLowerCase();
      }
      if (hasActiveSession && session.currentExerciseIndex === index) {
        return "in_progress";
      }
      return "pending";
    })();

    const ex = {
      ...ejercicio,
      status,
      exercise_name: ejercicio.nombre,
      series_total: ejercicio.series,
      // ✅ NUEVO: Agregar feedback
      sentiment: backendExercise?.sentiment,
      comment: backendExercise?.comment,
    };

    return <ExerciseListItem key={index} exercise={ex} index={index} />;
  });
}
```

#### Ubicación 2: Sesión Finalizada Incompleta (líneas 1432-1449)

```javascript
{
  todaySessionData.ejercicios.map((ejercicio, index) => {
    const backendExercise = todayStatus?.exercises?.[index];
    const status = backendExercise?.status || "pending";

    const ex = {
      ...ejercicio,
      status: String(status).toLowerCase(),
      exercise_name: ejercicio.nombre,
      series_total: ejercicio.series,
      // ✅ NUEVO: Agregar feedback
      sentiment: backendExercise?.sentiment,
      comment: backendExercise?.comment,
    };

    return <ExerciseListItem key={index} exercise={ex} index={index} />;
  });
}
```

#### Ubicación 3: Sesión Completada (líneas 1493-1510)

```javascript
{
  todaySessionData.ejercicios.map((ejercicio, index) => {
    const backendExercise = todayStatus?.exercises?.[index];
    const status = backendExercise?.status || "completed";

    const ex = {
      ...ejercicio,
      status: String(status).toLowerCase(),
      exercise_name: ejercicio.nombre,
      series_total: ejercicio.series,
      // ✅ NUEVO: Agregar feedback
      sentiment: backendExercise?.sentiment,
      comment: backendExercise?.comment,
    };

    return <ExerciseListItem key={index} exercise={ex} index={index} />;
  });
}
```

---

## 📝 Cambios en el Código

### Commits Realizados

#### Commit 1: `e315209`

```
fix(routines): restaurar feedback visual en TodayTrainingTab

PROBLEMA:
- Los ejercicios en la pestaña "Hoy" no mostraban colores de feedback
- Los datos existían en BD pero no llegaban al frontend

CAUSA RAÍZ:
- La función getTodayStatusCached() no existía en WorkoutContext
- Los parámetros de la llamada al endpoint no coincidían

SOLUCIÓN:
- Implementar fetchTodayStatus() localmente en TodayTrainingTab
- Usar apiClient.get('/training-session/today-status') con parámetros correctos
- Calcular week_number correctamente desde plan_start_date
- Normalizar day_name al formato esperado por el backend
```

#### Commit 2: `2bef0e6`

```
fix(routines): usar fetch directo en fetchTodayStatus para mejor debugging

- Verificar token antes de hacer la petición
- Construir URL con query params manualmente
- Usar fetch directo en lugar de apiClient
- Agregar logs detallados para debugging
- Verificar response.ok antes de parsear JSON
```

#### Commit 3: `684aa24`

```
feat(routines): agregar sentiment y comment a ejercicios en TodayTrainingTab

PROBLEMA:
- Los ejercicios mostraban colores pero no el feedback (sentiment/comment)

SOLUCIÓN:
- Agregar sentiment y comment desde todayStatus.exercises[index]
- Aplicar en las 3 secciones del componente
```

### Resumen de Archivos Modificados

```
src/components/routines/tabs/TodayTrainingTab.jsx
  - Líneas 130-156: Eliminado getTodayStatusCached del useWorkout
  - Líneas 185-269: Implementado fetchTodayStatus local
  - Líneas 1362-1397: Agregado sentiment/comment (sección 1)
  - Líneas 1432-1449: Agregado sentiment/comment (sección 2)
  - Líneas 1493-1510: Agregado sentiment/comment (sección 3)
```

---

## ✅ Verificación

### Cómo Verificar que Funciona

1. **Iniciar el backend:**

   ```bash
   cd backend && npm run dev
   ```

2. **Iniciar el frontend:**

   ```bash
   npm run dev
   ```

3. **Navegar a la aplicación:**
   - Ir a: `http://localhost:5173/routines`
   - Seleccionar pestaña "Hoy"

4. **Verificar en DevTools Console:**

   ```javascript
   // Deberías ver estos logs:
   🔍 fetchTodayStatus params: {
     methodologyPlanId: 104,
     weekNumber: 1,
     dayName: "Vie",
     hasToken: true
   }

   📥 Respuesta completa de today-status: { ... }

   ✅ todayStatus actualizado: {
     session_id: 101,
     exercises_count: 6,
     completed: 3,
     skipped: 2,
     cancelled: 1
   }
   ```

5. **Verificar visualmente:**
   - ✅ Ejercicios completados: **fondo verde claro**, borde verde
   - ✅ Ejercicios saltados: **fondo gris oscuro**, borde gris
   - ✅ Ejercicios cancelados: **fondo rojo oscuro**, borde rojo
   - ✅ Pills de sentimiento: ❤️ / ⚠️ / 👎
   - ✅ Comentarios: Recuadro amarillo con el texto

---

## 🔧 Troubleshooting

### Problema: No se muestran colores

#### Causa Posible 1: No hay token de autenticación

```javascript
// Console log:
❌ No hay token de autenticación
```

**Solución:**

```javascript
// En la consola del navegador:
localStorage.clear();
// Luego vuelve a loguearte en la app
```

#### Causa Posible 2: Error 401 (Token expirado)

```javascript
// Console log:
❌ Error en today-status: 401 {"error": "Token de acceso requerido"}
```

**Solución:**

1. Cerrar sesión en la app
2. Volver a iniciar sesión
3. El nuevo token debería funcionar

#### Causa Posible 3: Error 404 (No hay sesión)

```javascript
// Console log:
❌ Error en today-status: 404 {"error": "No hay sesión para este día"}
```

**Solución:**
Verificar que:

1. El `plan_start_date` está configurado en la BD
2. Hay una sesión registrada para el día actual
3. Los parámetros `week_number` y `day_name` son correctos

### Problema: Se muestran colores pero no sentiment/comment

#### Causa: El backend no devuelve sentiment/comment

**Verificar query del backend:**

```sql
-- En trainingSession.js línea 988-1001
SELECT
  p.exercise_order, p.exercise_name, p.status,
  f.sentiment, f.comment  -- ✅ Debe incluir estas columnas
FROM app.methodology_exercise_progress p
LEFT JOIN app.methodology_exercise_feedback f
  ON p.methodology_session_id = f.methodology_session_id
  AND p.exercise_order = f.exercise_order
WHERE p.methodology_session_id = $1
ORDER BY p.exercise_order ASC
```

**Solución:**
Asegurarse de que el JOIN con `methodology_exercise_feedback` está presente.

### Problema: Los datos no se actualizan en tiempo real

#### Causa: Cache del navegador

**Solución:**

```bash
# Limpiar cache del navegador:
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

#### Causa: Estado stale en el componente

**Solución:**

```javascript
// Forzar refresh del estado:
// En TodayTrainingTab.jsx línea 322
useEffect(() => {
  if (!hasActivePlan) return;

  if (localState.showSessionModal === false) {
    console.log("🔄 Modal cerrado, forzando refresh del estado desde BD...");
    fetchTodayStatus(); // ✅ Se llama automáticamente
  }
}, [hasActivePlan, localState.showSessionModal, fetchTodayStatus]);
```

---

## 📊 Comparación: Antes vs Después

### Antes

```
Pestaña "Hoy":
┌─────────────────────────────────┐
│ Press inclinado con mancuernas  │  ⚪ Sin color
│ Series: 3 | Reps: 8-12         │
└─────────────────────────────────┘

❌ No hay indicador de estado
❌ No hay feedback visual
❌ No hay comentarios
```

### Después

```
Pestaña "Hoy":
┌─────────────────────────────────┐
│ Press inclinado con mancuernas  │  🟢 Completado
│ Series: 3 | Reps: 8-12         │
│ ❤️ Me gusta                     │
│ 💬 "Buen ejercicio para pecho"  │
└─────────────────────────────────┘

✅ Color verde = completado
✅ Pill de sentimiento visible
✅ Comentario del usuario visible
```

---

## 🎓 Lecciones Aprendidas

1. **Siempre verificar que las funciones existen antes de usarlas**
   - `getTodayStatusCached` no existía en WorkoutContext
   - Usar TypeScript ayudaría a detectar esto en compile-time

2. **Los parámetros del endpoint deben coincidir con lo que espera el backend**
   - Frontend usaba `dayId`
   - Backend esperaba `week_number` + `day_name`

3. **Verificar la propagación de datos en todos los niveles**
   - Backend devolvía `sentiment` y `comment`
   - Pero el componente no los pasaba a `ExerciseListItem`

4. **El debugging sistemático es clave**
   - Verificar BD → Backend → Frontend en ese orden
   - Usar logs detallados en cada paso

5. **Documentar las soluciones para el futuro**
   - Este documento es prueba de ello 📝

---

## 📚 Referencias

### Archivos Relacionados

- `src/components/routines/tabs/TodayTrainingTab.jsx` - Componente principal
- `src/components/routines/tabs/CalendarTab.jsx` - Referencia de implementación correcta
- `src/components/routines/summary/ExerciseListItem.jsx` - Componente de visualización
- `backend/routes/trainingSession.js` - Endpoint `/today-status`

### Endpoints Relevantes

- `GET /api/training-session/today-status` - Obtener estado del día
- Parámetros: `methodology_plan_id`, `week_number`, `day_name`

### Tablas de Base de Datos

- `app.methodology_exercise_sessions` - Sesiones de entrenamiento
- `app.methodology_exercise_progress` - Progreso de ejercicios
- `app.methodology_exercise_feedback` - Feedback de usuario

---

## 🤝 Contribuyentes

- **Desarrollador:** Claude Code + Sergio
- **Fecha:** 24 de octubre de 2025
- **Tiempo de resolución:** ~2 horas

---

**Última actualización:** 24 de octubre de 2025
**Versión del documento:** 1.0
