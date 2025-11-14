# 🔍 Guía de Debugging con React DevTools + Context API

## Instalación Rápida

Ya está todo configurado. Solo reinicia el dev server:

```bash
npm run dev:auto
```

---

## 1️⃣ React DevTools - Lo Básico

### Abrir React DevTools

- **Chrome**: F12 → Pestaña "Components"
- **Firefox**: F12 → Pestaña "Inspector"

### Ver Componentes en Tiempo Real

```
1. Abre React DevTools > Components
2. Busca tu componente (ej: RoutineScreen)
3. Ve el árbol de componentes
4. Haz clic en un componente para ver sus props
```

### Ver Contextos

```
1. En React DevTools, abre un componente que use Context
2. Verás algo como: "WorkoutContext.Provider"
3. Haz clic en él para ver el valor actual del contexto
```

---

## 2️⃣ useDebugContext - El Turbo Booster

### Uso Básico en tus Componentes

```jsx
import { useWorkout } from "@/contexts/WorkoutContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDebugContext } from "@/hooks/useDebugContext";

export function RoutineScreen() {
  // ✅ Ahora cada cambio de contexto se loguea automáticamente
  const workout = useDebugContext(useWorkout(), "WorkoutContext");
  const auth = useDebugContext(useAuth(), "AuthContext");

  return <div>{/* Tu JSX aquí */}</div>;
}
```

### Uso Avanzado con useDebugContextDetailed

```jsx
import { useWorkout } from "@/contexts/WorkoutContext";
import { useDebugContextDetailed } from "@/hooks/useDebugContext";

export function RoutineScreen() {
  const { state, logAction } = useDebugContextDetailed(
    useWorkout(),
    "WorkoutContext",
  );

  const handleGeneratePlan = async () => {
    // 🎬 Registrar acción
    logAction("START_GENERATE_PLAN", {
      methodology: "calistenia",
      weekCount: 4,
    });

    try {
      // Lógica aquí
      const result = await state.generatePlan(/* ... */);
      logAction("PLAN_GENERATED", {}, result);
    } catch (error) {
      logAction("PLAN_ERROR", {}, { error: error.message });
    }
  };

  return <button onClick={handleGeneratePlan}>Generar Plan</button>;
}
```

---

## 3️⃣ Consola JavaScript - Debugging Avanzado

Una vez que implementas `useDebugContextDetailed`, tienes acceso en la consola:

```javascript
// 📊 Ver historial completo de acciones
debug_WorkoutContext.getHistory();

// 🔍 Ver estado actual
debug_WorkoutContext.currentState;

// 🧹 Limpiar historial
debug_WorkoutContext.clearHistory();
```

### Ejemplo: Encontrar un bug de estado

```javascript
// 1. En la consola, ver historial:
const history = debug_WorkoutContext.getHistory();

// 2. Buscar acción problemática:
history.find((a) => a.type === "SET_PLAN");

// 3. Ver el estado ANTES y DESPUÉS:
history[10].stateAfter;

// 4. Comparar con el actual:
debug_WorkoutContext.currentState;
```

---

## 4️⃣ React DevTools Profiler - Performance

### Para encontrar re-renders innecesarios:

```
1. Abre React DevTools > Profiler
2. Haz clic en ⏺️ (recording)
3. Realiza una acción en la app (ej: cambiar de tab)
4. Haz clic en ⏹️ (stop)
5. Verás qué componentes se re-renderizaron
```

### Buscar problemas de Performance

```
- ¿Un componente se re-renderiza demasiado?
  → Está usando un contexto que cambia mucho

- ¿Tarda mucho un render?
  → Hay lógica pesada en el componente

- ¿Se re-renderiza sin razón aparente?
  → Probablemente un useEffect mal configurado
```

---

## 5️⃣ Network Tab - APIs y Errores

Para ver las llamadas a tu backend:

```
1. F12 > Network tab
2. Realiza una acción (ej: generar plan)
3. Verás las peticiones HTTP:
   - POST /api/routine-generation/...
   - GET /api/training-session/...
```

### Debugging de errores API

```javascript
// En la consola, busca un error 401, 500, etc:
// 1. Haz clic en la petición fallida
// 2. Pestaña "Response"
// 3. Verás el error exacto del backend

// Ejemplo:
// 401: Token expirado
// 500: Error en la base de datos
// 404: Endpoint no existe
```

---

## 6️⃣ Vite Inspector - Bundling y Imports

Accede a: **http://localhost:5173/\_\_inspect/**

### Para qué sirve:

```
- Ver el código transpilado de cada módulo
- Detectar imports/exports rotos
- Identificar dependencias circulares
- Optimizar el bundling
```

---

## 📋 Checklist de Debugging

Cuando encuentres un bug:

- [ ] 1. Abre React DevTools
- [ ] 2. Busca el componente problemático
- [ ] 3. Ve qué contextos usa
- [ ] 4. En la consola, ve `debug_[contextName].getHistory()`
- [ ] 5. Mira el Network tab para ver si hay errores API
- [ ] 6. Usa el Profiler si hay performance issues
- [ ] 7. Revisa Vite Inspector si hay problemas de bundling

---

## 🎯 Casos de Uso Prácticos

### Caso 1: "El plan no se guarda"

```javascript
// 1. Abre consola
debug_WorkoutContext.getHistory();

// 2. Busca la acción SET_PLAN:
history.find((a) => a.type === "SET_PLAN");

// 3. Ve si el estado cambió:
console.log(history[n].stateAfter.plan);

// 4. Ve el Network tab para ver si la API respondió bien
```

### Caso 2: "El componente se re-renderiza infinitamente"

```javascript
// 1. Abre React DevTools > Profiler
// 2. Empieza a registrar
// 3. Espera 2-3 segundos
// 4. Detén el recording
// 5. Verás qué componente causa el re-render

// Probable causa: useEffect sin dependencias correctas
// Solución: Revisa los useEffect en ese componente
```

### Caso 3: "El usuario hace clic pero nada pasa"

```javascript
// 1. En consola, haz:
debug_WorkoutContext.logAction("MANUAL_TEST", { test: true });

// 2. Ve si se loguea en la consola
// 3. Si no, el contexto no está cargado

// 4. En React DevTools, busca el Provider:
// Si no ves "WorkoutContext.Provider", el contexto no está envolviendo el componente
```

---

## 🚀 Tips de Oro

```javascript
// ⭐ Ver todo lo que pasó en los últimos 5 minutos
const history = debug_WorkoutContext.getHistory();
console.table(history.slice(-10)); // Últimas 10 acciones

// 🔍 Buscar una acción específica
history.filter((a) => a.type.includes("SESSION"));

// 📊 Ver cuántos cambios hubo en el plan
history.filter((a) => a.type.includes("PLAN")).length;

// 🎯 Comparar estado antes/después de una acción
const index = 42;
console.log("ANTES:", history[index - 1].stateAfter);
console.log("DESPUÉS:", history[index].stateAfter);
```

---

## 🐛 Si algo no funciona

```bash
# 1. Reinicia el servidor
npm run dev:auto

# 2. Limpia la caché
rm -rf node_modules/.vite
rm -rf .next (si usas Next.js)

# 3. Recarga la página (Ctrl+Shift+R o Cmd+Shift+R)

# 4. Abre una pestaña anónima (sin extensiones)

# 5. Si React DevTools no aparece, instálalo desde:
# - Chrome: https://chrome.google.com/webstore
# - Firefox: https://addons.mozilla.org
```

---

**¡Listo! Ahora tienes superpoderes de debugging.** 🚀
