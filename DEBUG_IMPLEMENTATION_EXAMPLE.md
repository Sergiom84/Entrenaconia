# 📝 Cómo implementar el debugging en RoutineScreen.jsx

## Paso 1: Importar el hook

En la parte superior de `RoutineScreen.jsx`, agrega:

```jsx
import {
  useDebugContext,
  useDebugContextDetailed,
} from "@/hooks/useDebugContext";
```

---

## Paso 2: Usa el hook en el componente

### Opción A: Debugging Básico (RECOMENDADO PARA EMPEZAR)

```jsx
const RoutineScreen = () => {
  console.log("🔧 RoutineScreen.jsx cargado");

  const location = useLocation();

  // ✅ AGREGA ESTO:
  const workout = useDebugContext(useWorkout(), "WorkoutContext");

  // Luego usa 'workout' en lugar de destructurar
  const {
    plan,
    session,
    ui,
    // ... resto de propiedades
  } = workout;

  const { track } = useTrace();

  // ... resto del componente
};
```

### Opción B: Debugging Avanzado (PARA DEBUGGING PROFUNDO)

```jsx
const RoutineScreen = () => {
  const location = useLocation();

  // ✅ AGREGA ESTO:
  const { state: workout, logAction } = useDebugContextDetailed(
    useWorkout(),
    "WorkoutContext",
  );

  const {
    plan,
    session,
    ui,
    activatePlan,
    loadActivePlan,
    startSession,
    updateExercise,
    completeSession,
    goToMethodologies,
    isTraining,
    hasActivePlan,
    hasActiveSession,
  } = workout;

  // ✅ AHORA PUEDES USAR logAction EN TUS HANDLERS:
  const handleActivatePlan = useCallback(
    async (planId) => {
      logAction("ACTIVATE_PLAN_START", { planId });

      try {
        const result = await activatePlan(planId);
        logAction("ACTIVATE_PLAN_SUCCESS", { planId }, result);
        return result;
      } catch (error) {
        logAction("ACTIVATE_PLAN_ERROR", { planId }, { error: error.message });
        throw error;
      }
    },
    [activatePlan, logAction],
  );

  const handleStartSession = useCallback(async () => {
    logAction("START_SESSION_BEGIN", {});

    try {
      const result = await startSession();
      logAction("START_SESSION_SUCCESS", {}, result);
      return result;
    } catch (error) {
      logAction("START_SESSION_ERROR", {}, { error: error.message });
      throw error;
    }
  }, [startSession, logAction]);

  // ... resto del componente
};
```

---

## Paso 3: Probar en la consola

1. Abre la app en tu navegador
2. Abre F12 → Consola
3. Realiza una acción (ej: generar un plan)
4. En la consola verás logs como:

```
🔄 WorkoutContext Update
(table con los cambios)
📸 Full state: { plan: {...}, session: {...} }
```

---

## Paso 4: Debugging Avanzado en Consola

Una vez que uses `useDebugContextDetailed`, en la consola puedes:

```javascript
// Ver todas las acciones
debug_WorkoutContext.getHistory();

// Ver estado actual
debug_WorkoutContext.currentState;

// Buscar una acción específica
debug_WorkoutContext
  .getHistory()
  .filter((a) => a.type === "START_SESSION_BEGIN");

// Ver último cambio
debug_WorkoutContext.getHistory().slice(-1)[0];
```

---

## Opción Recomendada: Hybrid (LO QUE TE RECOMIENDO)

Usa **Opción B en Development** pero **Opción A en Production**:

```jsx
const useWorkoutDebug = () => {
  const workoutRaw = useWorkout();

  // En desarrollo, usa debugging detallado
  if (process.env.NODE_ENV === "development") {
    return useDebugContextDetailed(workoutRaw, "WorkoutContext").state;
  }

  // En producción, sin debugging
  return workoutRaw;
};

// En tu componente:
const RoutineScreen = () => {
  const workout = useWorkoutDebug();
  // ... resto del código
};
```

---

## 🎯 Ejemplo Completo Minimalista

```jsx
import React, { useCallback } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import { useDebugContextDetailed } from "@/hooks/useDebugContext";

const RoutineScreen = () => {
  const { state: workout, logAction } = useDebugContextDetailed(
    useWorkout(),
    "WorkoutContext",
  );

  const { plan, activatePlan } = workout;

  const handleClick = useCallback(async () => {
    logAction("BUTTON_CLICKED", { action: "activate" });

    try {
      const result = await activatePlan("plan-123");
      logAction("PLAN_ACTIVATED", {}, result);
    } catch (error) {
      logAction("PLAN_ACTIVATION_FAILED", {}, { error: error.message });
    }
  }, [activatePlan, logAction]);

  return (
    <div>
      <h1>Mi Plan: {plan?.currentPlan?.name}</h1>
      <button onClick={handleClick}>Activar Plan</button>
    </div>
  );
};

export default RoutineScreen;
```

---

## 🚨 Si algo no funciona

### "No veo logs en la consola"

```javascript
// 1. Verifica que el hook esté importado
import { useDebugContext } from "@/hooks/useDebugContext";

// 2. En la consola, verifica que el contexto exista
useWorkout(); // debería devolver un objeto

// 3. Si el contexto es null, el Provider no está envolviendo el componente
// Revisa en App.jsx que <WorkoutProvider> esté envolviendo todo
```

### "React DevTools no muestra los cambios del contexto"

```javascript
// 1. Abre React DevTools > Components
// 2. Busca "WorkoutContext.Provider"
// 3. Haz clic en él
// 4. En la derecha, verás "value" con el estado del contexto
// 5. Cambia algo en la app y haz clic nuevamente en el Provider
// 6. Debería mostrar el nuevo estado
```

### "getHistory() devuelve undefined"

```javascript
// Asegúrate de usar useDebugContextDetailed, NO useDebugContext
const { state, logAction, getHistory } = useDebugContextDetailed(/* ... */);

// O accede desde la ventana global:
debug_WorkoutContext.getHistory();
```

---

**¿Necesitas ayuda integrando esto en tu componente específico?**
Dime qué componente y lo hacemos juntos.
