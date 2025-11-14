# 🤖 Debugging Automático - Guía Rápida

## ✅ Lo que acabamos de configurar

```
App.jsx
  ↓
AppProviders (Nuevo!)
  ↓
DebugProvider (Automático)
  ├─ TraceProvider
  ├─ AuthProvider
  ├─ UserProvider
  └─ WorkoutProvider

Resultado: TODOS tus contextos están siendo debuggeados automáticamente
```

---

## 🚀 Cómo usar (Es muy fácil)

### Paso 1: Reinicia el servidor

```bash
npm run dev:auto
```

### Paso 2: Abre la consola (F12)

Verás un mensaje como:

```
📚 DEBUGGING GUIDE
List all contexts:
  window.__DEBUG_CONTEXTS.listContexts()
Get context history:
  window.__DEBUG_CONTEXTS.getHistory("WorkoutContext")
...
```

### Paso 3: ¡Haz una acción en tu app!

- Genera un plan de entrenamiento
- Inicia una sesión
- Cambia de tab
- Cualquier acción que cambiar el estado

Automáticamente en la consola verás:

```
🔄 WorkoutContext Update #5
├─ plan.currentPlan.name: "Calistenia Pro"
├─ plan.status: "active"
└─ session.status: "in_progress"

📸 Full State: { plan: {...}, session: {...} }
```

---

## 📊 Comandos de Debugging

En la consola, puedes usar:

### Ver todos los contextos registrados

```javascript
window.__DEBUG_CONTEXTS.listContexts();
// Output: ["WorkoutContext", "AuthContext", "UserContext", "TraceContext"]
```

### Ver historial de un contexto

```javascript
window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
// Output: Array con todos los cambios
```

### Ver últimas N cambios

```javascript
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
history.slice(-5); // Últimos 5 cambios
```

### Buscar un cambio específico

```javascript
window.__DEBUG_CONTEXTS.findChanges(
  "WorkoutContext",
  (entry) => entry.changes["plan.status"],
);
// Devuelve solo los cambios de plan.status
```

### Ver estadísticas

```javascript
window.__DEBUG_CONTEXTS.getStats("WorkoutContext");
// Output: { name, totalChanges, history, firstSeenAt }
```

### Ver TODAS las estadísticas

```javascript
window.__DEBUG_CONTEXTS.getAllStats();
// Output: Estadísticas de todos los contextos
```

### Deshabilitar debugging (para mejorar performance si es necesario)

```javascript
window.__DEBUG_CONTEXTS.disable();
// Los logs se detendrán, pero puedes:

window.__DEBUG_CONTEXTS.enable();
// Reactivarlo en cualquier momento
```

### Ver si está habilitado

```javascript
window.__DEBUG_CONTEXTS.isEnabled();
// Output: true o false
```

### Limpiar historial

```javascript
window.__DEBUG_CONTEXTS.clearHistory("WorkoutContext");
// Limpia el historial de ese contexto
```

---

## 🎯 Casos de Uso Prácticos

### Caso 1: "El plan no se genera"

```javascript
// 1. En consola:
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");

// 2. Ver si SET_PLAN fue llamado:
history.find((e) => e.changes["plan.currentPlan"]);

// 3. Ver el estado en ese momento:
history[n].fullState;

// 4. Buscar errores:
history.filter((e) => e.fullState.error);
```

### Caso 2: "El usuario no se loguea"

```javascript
// 1. Ver historial de Auth:
window.__DEBUG_CONTEXTS.getHistory("AuthContext");

// 2. Buscar cambios de user:
window.__DEBUG_CONTEXTS.findChanges("AuthContext", (e) => e.changes["user"]);

// 3. Ver si hay errores de login:
const auth = window.__DEBUG_CONTEXTS.getHistory("AuthContext");
auth.filter((e) => e.fullState.error);
```

### Caso 3: "Algo se actualiza infinitamente"

```javascript
// 1. Ver estadísticas:
window.__DEBUG_CONTEXTS.getAllStats();

// Si WorkoutContext tiene changeCount > 100 en poco tiempo,
// hay un loop infinito

// 2. Deshabilitar debugging momentáneamente:
window.__DEBUG_CONTEXTS.disable();

// 3. Investigar con React DevTools
// (el problema está en un useEffect sin dependencias correctas)
```

---

## 🔍 Interpretando los Logs

Cuando veas un log como:

```
🔄 WorkoutContext Update #3

│ Key               │ Before           │ After                  │
├───────────────────┼──────────────────┼────────────────────────┤
│ plan.status       │ "draft"          │ "active"               │
│ plan.currentPlan  │ null             │ { name: "Cal..." }     │
│ session.status    │ "idle"           │ "starting"             │
```

Significa:

- **Update #3**: Es el cambio número 3 en este contexto
- **plan.status**: Cambió de "draft" a "active"
- **plan.currentPlan**: Cambió de null a un objeto
- **session.status**: Cambió de "idle" a "starting"

---

## ⚙️ Configuración

### Habilitar/Deshabilitar automáticamente

El debugging se habilita por defecto en **desarrollo** y se deshabilita en **producción**.

Para cambiar esto manualmente:

```javascript
// En la consola:
localStorage.setItem("debug-contexts-enabled", "true"); // Para habilitar
localStorage.setItem("debug-contexts-enabled", "false"); // Para deshabilitar

// Luego recarga la página
```

---

## 🎨 Colores en los Logs

- 🟡 **Amarillo (FFD700)**: Headers principales
- 🔵 **Azul (00D4FF)**: Full State
- 🟠 **Naranja (FFA500)**: Loading states
- 🔴 **Rojo (FF6B6B)**: Errores
- 🟢 **Verde (00FF00)**: Comandos disponibles

---

## 💡 Tips Avanzados

### Guardar un historial completo en un archivo

```javascript
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
const json = JSON.stringify(history, null, 2);

// Copiar a portapapeles
navigator.clipboard.writeText(json);

// O descargar como archivo
const a = document.createElement("a");
a.href = "data:application/json," + encodeURIComponent(json);
a.download = "workout-debug.json";
a.click();
```

### Monitorear cambios en tiempo real

```javascript
// En la consola:
setInterval(() => {
  const stats = window.__DEBUG_CONTEXTS.getAllStats();
  console.table(stats);
}, 2000);

// Verás cada 2 segundos cuántos cambios ha habido en cada contexto
```

### Encontrar el cambio más costoso

```javascript
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
const costs = history.map((e, i) => ({
  index: i,
  changesCount: Object.keys(e.changes).length,
  timestamp: e.timestamp,
}));

console.table(costs.sort((a, b) => b.changesCount - a.changesCount));
// El primero es el cambio más grande
```

---

## 🚨 Troubleshooting

### "window.\_\_DEBUG_CONTEXTS is undefined"

```javascript
// 1. Verifica que estés en development mode
console.log(process.env.NODE_ENV); // Debe ser "development"

// 2. Recarga la página (no solo F5, usa Ctrl+Shift+R)

// 3. Abre una pestaña anónima sin extensiones
```

### "Veo logs pero no puedo acceder a los comandos"

```javascript
// 1. Espera a que se cargue el DebugProvider:
setTimeout(() => {
  window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
}, 1000);

// 2. O recarga la página
```

### "El debugging es muy lento"

```javascript
// Deshabilita momentáneamente:
window.__DEBUG_CONTEXTS.disable();

// El debugging no afecta la performance en producción,
// pero si en desarrollo agrega un pequeño overhead

// Para mejorar en desarrollo:
localStorage.setItem("debug-contexts-enabled", "false");
location.reload();
```

---

## ✨ Próximos Pasos

Ahora que tienes debugging automático, puedes:

1. **Crear bugs** sin miedo - sabrás exactamente qué cambió
2. **Investigar problemas** rápidamente - toda la información está en la consola
3. **Colaborar mejor** - exporta el historial y comparte con el equipo
4. **Optimizar** - identifica loops infinitos y re-renders inncesarios

---

## 🎯 El Mejor Workflow

```
1. Realiza una acción en la app
   ↓
2. Algo sale mal
   ↓
3. Abre F12 (Consola)
   ↓
4. Ejecuta: window.__DEBUG_CONTEXTS.getHistory("ContextName")
   ↓
5. Análiza el array para ver qué salió mal
   ↓
6. Copias el JSON y lo analizas
   ↓
7. ¡SOLUCIONADO! Ahora sabes exactamente dónde fue el error
```

---

**¡Disfruta del debugging automático! 🚀**

Si tienes dudas, este archivo está en la raíz del proyecto:
`/DEBUGGING_AUTOMATED.md`
