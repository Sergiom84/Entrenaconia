# ⚡ Quick Start - Debugging en 2 minutos

## 1️⃣ Reinicia el servidor

```bash
npm run dev:auto
```

Espera a que compile todo.

---

## 2️⃣ Abre la app en el navegador

```
http://localhost:5173
```

---

## 3️⃣ Abre la consola (F12)

Deberías ver algo como:

```
📚 DEBUGGING GUIDE
List all contexts:
  window.__DEBUG_CONTEXTS.listContexts()
Get context history:
  window.__DEBUG_CONTEXTS.getHistory("WorkoutContext")
...
```

---

## 4️⃣ Ejecuta esto en la consola para listar todos los contextos

```javascript
window.__DEBUG_CONTEXTS.listContexts();
```

**Output esperado:**

```javascript
["TraceContext", "AuthContext", "UserContext", "WorkoutContext"];
```

---

## 5️⃣ Realiza una acción en la app

### Opción A: Si estás en Login

- Ingresa credenciales (o crea una cuenta)
- Mira la consola
- Verás: `🔄 AuthContext Update #1` con todos los cambios

### Opción B: Si ya estás logueado

- Ve a "Metodologías"
- Selecciona "Calistenia" o similar
- Haz clic en "Comenzar"
- Verás múltiples logs:
  - `🔄 WorkoutContext Update #1`
  - `🔄 WorkoutContext Update #2`
  - etc.

---

## 6️⃣ Analiza los logs automáticos

Cada acción que hagas genera un log automático como:

```
🔄 WorkoutContext Update #5

│ Changes:
│ plan.currentPlan.name: "Calistenia" → "Hipertrofia"
│ plan.status: "draft" → "active"
│ session.status: "idle" → "starting"

📸 Full State: { plan: {...}, session: {...} }
```

---

## 7️⃣ Prueba el historial

En la consola, ejecuta:

```javascript
window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
```

**Verás:**

```javascript
[
  {
    timestamp: "10:30:45",
    changeNumber: 1,
    changes: { "plan.status": { before: "draft", after: "active" } },
    fullState: { plan: {...}, session: {...} }
  },
  {
    timestamp: "10:30:46",
    changeNumber: 2,
    changes: { "session.status": { before: "idle", after: "in_progress" } },
    fullState: { plan: {...}, session: {...} }
  },
  // ... más cambios
]
```

---

## 8️⃣ Busca un cambio específico

```javascript
// Encuentra todos los cambios de estado de plan
window.__DEBUG_CONTEXTS.findChanges(
  "WorkoutContext",
  (entry) => entry.changes["plan.status"],
);
```

**Verás cuándo cambió el estado del plan.**

---

## 9️⃣ Ve estadísticas

```javascript
window.__DEBUG_CONTEXTS.getAllStats();
```

**Output:**

```javascript
{
  WorkoutContext: { totalChanges: 5, historySize: 5, firstSeenAt: Date },
  AuthContext: { totalChanges: 2, historySize: 2, firstSeenAt: Date },
  UserContext: { totalChanges: 1, historySize: 1, firstSeenAt: Date },
  TraceContext: { totalChanges: 10, historySize: 10, firstSeenAt: Date }
}
```

---

## 🔟 Simula un Error

### En un componente cualquiera, ejecuta (en consola):

```javascript
// Para probar si el debugging capta errores
window.__DEBUG_CONTEXTS
  .getHistory("WorkoutContext")
  .filter((e) => e.fullState.error);
```

O fuerza un error en la app:

- Intenta un login con contraseña incorrecta
- Verás automáticamente en los logs: `❌ ERROR DETECTED`

---

## ✅ Confirmación: Ya está todo funcionando

Si viste:

- ✅ Logs automáticos en la consola
- ✅ `window.__DEBUG_CONTEXTS` disponible
- ✅ Historial de cambios
- ✅ Estadísticas

**¡FELICIDADES! El debugging automático está funcionando.** 🎉

---

## 📋 Comparación: Antes vs Después

### ANTES (Sin debugging)

```javascript
// Algo sale mal, no sabes qué cambió
// Tienes que: agregar console.log(), reiniciar, probar de nuevo
// 😤 Tedioso y lento
```

### AHORA (Con debugging automático)

```javascript
// Algo sale mal
// Abre consola → window.__DEBUG_CONTEXTS.getHistory("ContextName")
// VES TODO LO QUE CAMBIÓ
// 🎉 Rápido y eficiente
```

---

## 🚀 Casos de Uso Reales

### "Generé un plan pero no aparece"

```javascript
// Ve qué pasó en WorkoutContext:
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");

// Busca si SET_PLAN fue llamado:
history.find((e) => e.changes["plan.currentPlan"]);

// Mira el estado completo en ese momento:
history[nroDelCambio].fullState;
```

### "El usuario se desloguea solo"

```javascript
// Ve cuándo cambió el estado de autenticación:
window.__DEBUG_CONTEXTS.findChanges("AuthContext", (e) => e.changes["user"]);
```

### "Las acciones se ejecutan infinitamente"

```javascript
// Ve cuántos cambios ha habido en poco tiempo:
const stats = window.__DEBUG_CONTEXTS.getAllStats();

// Si WorkoutContext.totalChanges > 100, hay un loop
// Deshabilita el debugging y abre React DevTools > Profiler
```

---

## 💡 Pro Tips

### 1. Exportar datos para análisis posterior

```javascript
const data = JSON.stringify(
  window.__DEBUG_CONTEXTS.getHistory("WorkoutContext"),
  null,
  2,
);
navigator.clipboard.writeText(data);
// Ahora está en el portapapeles, cópialo a un archivo
```

### 2. Monitorear en tiempo real

```javascript
setInterval(() => {
  console.clear();
  console.table(window.__DEBUG_CONTEXTS.getAllStats());
}, 2000);
// Ve las estadísticas actualizadas cada 2 segundos
```

### 3. Desactivar debugging si va lento (raro)

```javascript
window.__DEBUG_CONTEXTS.disable();
// El debugging se detiene
// Performance mejora un poquito

// Para reactivar:
window.__DEBUG_CONTEXTS.enable();
```

---

## 📚 Documentación Completa

Para toda la información, lee:

```
/DEBUGGING_AUTOMATED.md (este archivo)
/DEBUGGING_GUIDE.md (la versión anterior, más detallada)
/src/providers/DebugProvider.jsx (el código fuente)
```

---

## ❓ Preguntas Frecuentes

### P: "¿El debugging afecta performance?"

**R:** En producción, NO. En desarrollo, es minimal (<5ms). Puedes desactivarlo si sientes que ralentiza.

### P: "¿Funciona en todos los navegadores?"

**R:** Sí, en Chrome, Firefox, Safari y Edge. Requiere que el navegador tenga consola.

### P: "¿Puedo usar esto con React DevTools también?"

**R:** Sí, son complementarios. Debugging automático = logs. React DevTools = inspeccionar árbol de componentes.

### P: "¿Qué pasa en producción?"

**R:** El debugging se desactiva automáticamente. Cero overhead.

---

**¡Listo! Ya tienes el debugging automático configurado.** 🚀

¿Necesitas ayuda? Lee `/DEBUGGING_AUTOMATED.md`
