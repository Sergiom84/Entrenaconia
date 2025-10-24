# Corrección: Modal de Reanudar Solo Muestra Ejercicios Saltados/Cancelados

## Problema Identificado

Cuando el usuario pulsaba "Reanudar Entrenamiento", el modal mostraba todos los 6 ejercicios en lugar de solo los que fueron saltados o cancelados.

## Solución Implementada

### Archivo Modificado

- `src/components/routines/tabs/TodayTrainingTab.jsx`

### Cambios Realizados

#### 1. Lógica de Filtrado Mejorada (líneas 391-421)

Se modificó `filteredSessionData` para detectar el modo "retry":

```javascript
// Detectar si estamos en modo "retry" (cuando hay ejercicios saltados o cancelados)
const hasSkippedOrCancelled =
  todayStatus?.exercises?.some((ex) => {
    const status = String(ex?.status || "").toLowerCase();
    return status === "skipped" || status === "cancelled";
  }) ||
  Object.values(exerciseProgress || {}).some((p) => {
    const status = String(p?.status || "").toLowerCase();
    return status === "skipped" || status === "cancelled";
  });

// Si hay ejercicios saltados/cancelados, SOLO incluir esos
// Si no hay saltados/cancelados, incluir todos los no completados (comportamiento normal)
const shouldInclude = hasSkippedOrCancelled
  ? effectiveStatus === "skipped" || effectiveStatus === "cancelled"
  : effectiveStatus !== "completed";
```

### Comportamiento Corregido

#### Modo Retry (con ejercicios saltados/cancelados):

- **Solo incluye**: Ejercicios con estado `skipped` o `cancelled`
- **Excluye**: Ejercicios `completed`, `pending`, `in_progress`
- **Resultado**: El modal solo muestra los ejercicios que necesitan ser reintentados

#### Modo Normal (sin ejercicios saltados/cancelados):

- **Incluye**: Todos los ejercicios no completados (`pending`, `in_progress`, `skipped`, `cancelled`)
- **Excluye**: Solo ejercicios `completed`
- **Resultado**: Comportamiento estándar para iniciar sesión

### Logging Mejorado

Se añadió información de debug para verificar el modo de filtrado:

```javascript
console.log("🔍 DEBUG Filtrado de ejercicios para modal:", {
  modoRetry: hasSkippedOrCancelled,
  filtro: hasSkippedOrCancelled
    ? "Solo saltados/cancelados"
    : "Todos los no completados",
  // ... más información de debug
});
```

## Casos de Uso Soportados

1. **Todos completados**: No muestra botón de reanudar
2. **Algunos saltados/cancelados**: Botón "Reanudar Entrenamiento" → Modal solo con esos ejercicios
3. **Sesión en progreso**: Continúa desde donde estaba
4. **Sesión nueva**: Muestra todos los ejercicios pendientes

## Verificación

1. Compilación sin errores: ✅
2. ESLint sin errores: ✅
3. Build de producción: ✅

## Commit

```
fix(routines): filtrar solo ejercicios saltados/cancelados al reanudar
```

Fecha: 2025-10-24
