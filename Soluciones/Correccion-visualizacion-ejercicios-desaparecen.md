# Corrección: Ejercicios Desaparecen en Pestaña HOY

## Problema Identificado

Los ejercicios no se mostraban en la pestaña "Hoy" cuando había ejercicios saltados o cancelados. Al recargar la página (F5), aparecían por un segundo y luego desaparecían.

### Síntomas

- Lista de ejercicios no visible
- Solo se mostraba el botón "Reanudar Entrenamiento"
- Al presionar F5, los ejercicios aparecían brevemente y desaparecían

## Causa Raíz

La condición `!isFinishedToday` en la línea 1389 estaba ocultando incorrectamente la lista de ejercicios.

### Lógica Incorrecta

```javascript
// ANTES (incorrecto)
{
  todaySessionData?.ejercicios &&
    todaySessionData.ejercicios.length > 0 &&
    !isFinishedToday && (
      <Card className="p-6">{/* Lista de ejercicios */}</Card>
    );
}
```

El problema:

- `isFinishedToday = todayStatus?.session?.session_status === 'completed'`
- Cuando una sesión está marcada como "completed" (incluso con ejercicios saltados/cancelados), `isFinishedToday` es `true`
- Por lo tanto, `!isFinishedToday` es `false` y la lista no se muestra

## Solución Implementada

### Archivo Modificado

- `src/components/routines/tabs/TodayTrainingTab.jsx` (línea 1389)

### Cambio Realizado

```javascript
// DESPUÉS (correcto)
{
  todaySessionData?.ejercicios &&
    todaySessionData.ejercicios.length > 0 &&
    !hasCompletedSession && (
      <Card className="p-6">{/* Lista de ejercicios */}</Card>
    );
}
```

### Diferencia Clave

- **`isFinishedToday`**: `true` cuando la sesión está marcada como completada (puede tener saltados/cancelados)
- **`hasCompletedSession`**: `true` SOLO cuando TODOS los ejercicios están completados exitosamente

## Comportamiento Corregido

### Antes

- Sesión con 4/6 completados, 1 saltado, 1 cancelado → Lista NO se mostraba ❌

### Después

- Sesión con 4/6 completados, 1 saltado, 1 cancelado → Lista SÍ se muestra ✅
- Solo se oculta cuando TODOS están completados exitosamente

## Casos de Uso

| Estado                         | Visualización Lista |
| ------------------------------ | ------------------- |
| Todos completados exitosamente | Oculta ✅           |
| Algunos saltados/cancelados    | Visible ✅          |
| Sesión en progreso             | Visible ✅          |
| Sesión nueva                   | Visible ✅          |

## Verificación

1. ESLint sin errores: ✅
2. Compilación exitosa: ✅
3. Pre-commit hooks pasados: ✅

## Commit

```
fix(routines): mostrar lista de ejercicios cuando hay saltados/cancelados
```

Fecha: 2025-10-24
