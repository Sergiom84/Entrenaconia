# Corrección: Modal Reanudar Empieza por Ejercicio Correcto

## Problema Identificado

Al pulsar "Reanudar Entrenamiento", el modal mostraba TODOS los ejercicios y empezaba desde el primero (incluyendo los ya completados), en lugar de mostrar solo los saltados/cancelados y empezar por el primer ejercicio no completado.

### Ejemplo del Problema

- Ejercicio 1: Press inclinado con mancuernas - ✅ COMPLETADO
- Ejercicio 2: Remo con barra Penday - ✅ COMPLETADO
- Ejercicio 3: Press militar con mancuernas - ⚠️ SALTADO
- Ejercicio 4: Elevación de talones - ⚠️ SALTADO
- Ejercicio 5: Curl en polea baja - ❌ CANCELADO
- Ejercicio 6: Crunch en máquina - ❌ CANCELADO

**Comportamiento incorrecto**: El modal mostraba los 6 ejercicios empezando por el #1 (ya completado)
**Comportamiento esperado**: El modal debe mostrar solo los ejercicios 3-6 empezando por el #3

## Causa Raíz

En `handleResumeSession`, se estaba pasando `todaySessionData` completo (todos los ejercicios) al abrir el modal:

```javascript
// ANTES (incorrecto)
pendingSessionData: {
  session: todaySessionData ? { ...todaySessionData, sessionId: existingSessionId } : null,
  sessionId: existingSessionId
}
```

## Solución Implementada

### Archivo Modificado

- `src/components/routines/tabs/TodayTrainingTab.jsx` (líneas 702-712)

### Cambio Realizado

```javascript
// DESPUÉS (correcto)
updateLocalState({
  pendingSessionData: {
    session: null, // Será llenado por effectiveSession usando filteredSessionData
    sessionId: existingSessionId,
  },
  showWarmupModal: false,
  showSessionModal: true,
  wantRoutineModal: true, // Activar para que filteredSessionData se compute
});
```

### Flujo Corregido

1. Usuario pulsa "Reanudar Entrenamiento"
2. Se activa `wantRoutineModal = true`
3. `filteredSessionData` se computa con solo ejercicios saltados/cancelados
4. `effectiveSession` usa `filteredSessionData` (no `todaySessionData`)
5. El modal abre con solo los ejercicios no completados
6. Empieza desde el índice 0 del array filtrado (primer ejercicio no completado)

## Comportamiento Actual

### Lógica de Filtrado (líneas 391-421)

```javascript
// Detectar modo "retry"
const hasSkippedOrCancelled = todayStatus?.exercises?.some((ex) =>
  ["skipped", "cancelled"].includes(ex?.status?.toLowerCase()),
);

// Si hay saltados/cancelados: solo incluir esos
// Si no: incluir todos los no completados (comportamiento normal)
const shouldInclude = hasSkippedOrCancelled
  ? effectiveStatus === "skipped" || effectiveStatus === "cancelled"
  : effectiveStatus !== "completed";
```

### effectiveSession (líneas 1225-1234)

```javascript
const effectiveSession =
  localState.pendingSessionData?.session ||
  (wantRoutineModal && filteredSessionData
    ? {
        ...filteredSessionData,
        sessionId:
          session.sessionId || localState.pendingSessionData?.sessionId,
        currentExerciseIndex: 0, // Primer ejercicio del array filtrado
      }
    : null);
```

## Casos de Uso

| Situación                                | Modal Muestra             | Empieza Por    |
| ---------------------------------------- | ------------------------- | -------------- |
| 4/6 completados, 2 saltados              | Solo los 2 saltados       | Primer saltado |
| 3/6 completados, 2 saltados, 1 cancelado | Solo los 3 no completados | Primer saltado |
| Todos completados                        | No se abre                | N/A            |
| Ninguno completado                       | Todos los ejercicios      | Ejercicio 1    |

## Verificación

1. ESLint sin errores: ✅
2. Pre-commit hooks pasados: ✅
3. Compilación exitosa: ✅

## Commits Relacionados

1. `fix(routines): filtrar solo ejercicios saltados/cancelados al reanudar`
2. `fix(routines): mostrar lista de ejercicios cuando hay saltados/cancelados`
3. `fix(routines): usar datos filtrados al reanudar entrenamiento`

Fecha: 2025-10-24
