# 🚀 Comienza a Debuggear - Guía de Inicio Rápido

## ✅ Checklist: Todo está configurado

- ✅ `src/providers/DebugProvider.jsx` - Motor de debugging
- ✅ `src/providers/AppProviders.jsx` - Wrapper de providers
- ✅ `src/hooks/useDebuggedContext.js` - Hook opcional
- ✅ `vite.config.js` - Vite Inspector activado
- ✅ `src/App.jsx` - Integrado AppProviders
- ✅ Documentación completa (4 archivos)

---

## 🎬 Paso 1: Reinicia el Servidor

```bash
npm run dev:auto
```

Espera a que diga:

```
✓ built in XXXms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

## 🌐 Paso 2: Abre la App

Abre en tu navegador:

```
http://localhost:5173
```

---

## 🖥️ Paso 3: Abre la Consola

Presiona: `F12` (o `Cmd+Option+I` en Mac)

Verás algo como:

```
📚 DEBUGGING GUIDE
List all contexts:
  window.__DEBUG_CONTEXTS.listContexts()
Get context history:
  window.__DEBUG_CONTEXTS.getHistory("WorkoutContext")
...
```

Si NO ves nada, recarga la página: `Ctrl+Shift+R` (o `Cmd+Shift+R` en Mac)

---

## 📋 Paso 4: Verifica que Todo Está Cargado

En la consola, copia y pega esto:

```javascript
window.__DEBUG_CONTEXTS.listContexts();
```

Deberías ver:

```javascript
["TraceContext", "AuthContext", "UserContext", "WorkoutContext"];
```

Si ves esto, **¡TODO ESTÁ FUNCIONANDO!** ✅

---

## 🎬 Paso 5: Realiza una Acción

### Si estás en Login:

1. Ingresa email y contraseña (o crea una cuenta)
2. Haz clic en "Iniciar Sesión"

### Si ya estás logueado:

1. Ve a cualquier sección (ej: "Metodologías")
2. Haz clic en cualquier botón

**Observa la consola:** Verás logs como:

```
🔄 AuthContext Update #1
│ user: null → { id: "123", name: "Juan" }
│ isAuthenticated: false → true

📸 Full State: { user: {...}, isAuthenticated: true }
```

---

## 📊 Paso 6: Inspecciona el Historial

En la consola, ejecuta:

```javascript
window.__DEBUG_CONTEXTS.getHistory("AuthContext");
```

Verás un array con todos los cambios que sucedieron:

```javascript
[
  {
    timestamp: "10:30:45",
    changeNumber: 1,
    changes: {
      "user": { before: null, after: { id: "123", ... } },
      "isAuthenticated": { before: false, after: true }
    },
    fullState: { user: {...}, isAuthenticated: true }
  },
  // ... más cambios
]
```

---

## 🔍 Paso 7: Busca un Cambio Específico

Por ejemplo, busca todos los cambios de autenticación:

```javascript
window.__DEBUG_CONTEXTS.findChanges(
  "AuthContext",
  (entry) => entry.changes["isAuthenticated"],
);
```

Esto te mostrará solo los momentos en que cambió `isAuthenticated`.

---

## 📈 Paso 8: Ver Estadísticas

```javascript
window.__DEBUG_CONTEXTS.getAllStats();
```

Verás cuántos cambios ha habido en cada contexto:

```javascript
{
  AuthContext: { totalChanges: 2, historySize: 2, ... },
  UserContext: { totalChanges: 1, historySize: 1, ... },
  WorkoutContext: { totalChanges: 0, historySize: 0, ... },
  TraceContext: { totalChanges: 10, historySize: 10, ... }
}
```

---

## 🎯 Paso 9: Realiza una Acción Compleja

Ahora intenta algo más complejo, como:

1. Ir a "Metodologías"
2. Seleccionar una (ej: Calistenia)
3. Hacer clic en "Comenzar"

En la consola verás **múltiples logs automáticos**:

```
🔄 WorkoutContext Update #1 (Se inició el plan)
🔄 WorkoutContext Update #2 (Se cargaron ejercicios)
🔄 TraceContext Update #5 (Se registró la acción)
...
```

---

## 💡 Paso 10: Analiza un Problema (Simulado)

Imagina que algo salió mal. Ahora sabes cómo investigar:

```javascript
// 1. Ver historial completo del contexto problemático
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");

// 2. Buscar errores
const errors = history.filter((e) => e.fullState.error);
if (errors.length > 0) {
  console.log("❌ Errores encontrados:", errors);
}

// 3. Ver últimas N cambios
console.table(history.slice(-5));

// 4. Analizar un cambio específico
const cambio = history[5];
console.log("Estado completo en ese momento:", cambio.fullState);
```

---

## 📱 Bonus: Vite Inspector

También habilitamos Vite Inspector. Accede a:

```
http://localhost:5173/__inspect/
```

Te muestra:

- Código transpilado
- Imports/exports
- Dependencias

(Menos importante que los logs, pero útil para debugging avanzado)

---

## 🎓 Ahora que sabes Cómo Funciona

### Para encontrar bugs:

1. **Reproduce el problema**
2. **Abre la consola** (F12)
3. **Ejecuta:** `window.__DEBUG_CONTEXTS.getHistory("ContextoProblematico")`
4. **Analiza:** Qué cambio de manera extraña
5. **¡Solucionado!** Ahora sabes dónde está el problema

### Ejemplos de Problemas Que Puedes Encontrar:

**P: "El usuario no se loguea"**

```javascript
window.__DEBUG_CONTEXTS.getHistory("AuthContext");
// Busca si 'isAuthenticated' cambió a true
```

**P: "El plan no se genera"**

```javascript
window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
// Busca si 'plan.currentPlan' tiene un valor
```

**P: "Los ejercicios no cargan"**

```javascript
window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
// Busca cambios en 'session.exercises'
```

---

## 🚨 Si Algo No Funciona

### "No veo `window.__DEBUG_CONTEXTS`"

```bash
# 1. Verifica que estés en development
npm run dev:auto

# 2. Recarga la página (Ctrl+Shift+R)

# 3. Si aún no aparece, revisa que App.jsx esté actualizado:
# Debe tener: import AppProviders from './providers/AppProviders';
```

### "Los logs están lentos"

```javascript
// Desactiva debugging temporalmente:
window.__DEBUG_CONTEXTS.disable();

// Haz lo que necesites

// Reactiva:
window.__DEBUG_CONTEXTS.enable();
```

### "Quiero exportar el historial"

```javascript
const history = window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
const json = JSON.stringify(history, null, 2);

// Copiar a portapapeles
navigator.clipboard.writeText(json);

// O descargar
const a = document.createElement("a");
a.href = "data:application/json," + encodeURIComponent(json);
a.download = "debug.json";
a.click();
```

---

## 🎯 Comandos Rápidos (Copiar/Pegar)

### Ver todos los contextos

```javascript
window.__DEBUG_CONTEXTS.listContexts();
```

### Ver historial de un contexto

```javascript
window.__DEBUG_CONTEXTS.getHistory("WorkoutContext");
window.__DEBUG_CONTEXTS.getHistory("AuthContext");
```

### Ver estadísticas

```javascript
window.__DEBUG_CONTEXTS.getAllStats();
```

### Buscar cambios específicos

```javascript
window.__DEBUG_CONTEXTS.findChanges(
  "WorkoutContext",
  (e) => e.changes["plan.status"],
);
```

### Deshabilitar/Habilitar

```javascript
window.__DEBUG_CONTEXTS.disable(); // Apagar
window.__DEBUG_CONTEXTS.enable(); // Encender
```

### Ver si está activo

```javascript
window.__DEBUG_CONTEXTS.isEnabled();
```

---

## 📚 Más Documentación

Para información más detallada, lee:

- **DEBUGGING_QUICKSTART.md** - 2 minutos de lectura
- **DEBUGGING_AUTOMATED.md** - Guía completa
- **DEBUGGING_SETUP_COMPLETE.md** - Detalles técnicos
- **DEBUGGING_GUIDE.md** - Método anterior (aún válido)

---

## ✨ Resumen

### Ya tienes:

✅ **Debugging automático** de todos los contextos
✅ **Logs en tiempo real** en la consola
✅ **Historial** de todos los cambios
✅ **Estadísticas** de qué cambió y cuándo
✅ **Acceso desde consola** a toda la información
✅ **Cero impacto** en producción
✅ **Integrado** sin modificar código existente

### Puedes:

🔍 Ver **exactamente qué cambió** en cada acción
📊 Analizar **por qué algo salió mal**
📈 Monitorear **la actividad en tiempo real**
💾 Exportar **datos para análisis posterior**
🚀 Debuggear **10x más rápido**

---

## 🎉 ¡LISTO!

**Abre tu app y comienza a debuggear como un profesional.**

Cualquier cambio en cualquier contexto aparecerá automáticamente en los logs.

```javascript
// Simplemente ejecuta en la consola:
window.__DEBUG_CONTEXTS.getHistory("TuContexto");

// Y verás TODO lo que pasó
```

---

**¿Preguntas?** Lee la documentación o abre la consola y experimenta.

**¡Que disfrutes!** 🚀
