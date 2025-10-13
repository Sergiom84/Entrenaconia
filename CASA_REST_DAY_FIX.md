# ✅ Corrección: TodayTrainingTab mostrando "día de descanso" para sesiones Casa

## 🐛 Problema Reportado

**Síntoma**: Después de generar un plan de "Entrenamiento en Casa", completar varios ejercicios y salir del modal, la pestaña "Hoy" mostraba incorrectamente "día de descanso" a pesar de haber una sesión activa.

**Contexto del Usuario**:
- methodology_plan_id: 48
- session_id: 44
- Día: Lunes (Monday)
- Backend logs mostraban: `day_name: 'Lun'`
- La pestaña "Calendario" mostraba la información correctamente

## 🔍 Investigación y Root Cause

### Análisis del Problema

1. **TodayTrainingTab determina día de descanso con**:
   ```javascript
   const isRestDay = hasActivePlan && !todaySessionData;
   ```
   Si `todaySessionData` es null, muestra "día de descanso".

2. **La función `findTodaySession()` retornaba null**:
   ```javascript
   function findTodaySession(plan, targetDay, weekIdx = 0) {
     // ...
     return week.sesiones.find((sesion) =>
       sesion.dia?.toLowerCase() === targetDay?.toLowerCase()
     ) || null;
   }
   ```
   Solo buscaba en el campo `sesion.dia`.

3. **El prompt de Casa usa un campo diferente**:
   - Archivo: `backend/prompts/casa_specialist.md` (línea 208)
   - Estructura definida por la IA:
   ```json
   {
     "sesiones": [
       {
         "dia_semana": "Lunes",  // ← Campo usado por Casa
         "categoria_principal": "Funcional",
         "ejercicios": [...]
       }
     ]
   }
   ```

4. **Mismatch de campos**:
   - Código buscaba: `sesion.dia`
   - Casa definía: `sesion.dia_semana`
   - Resultado: Sesión no encontrada → Aparecía como día de descanso

## ✅ Solución Implementada

### 1. **TodayTrainingTab.jsx** (Líneas 88-92)

**Antes**:
```javascript
return week.sesiones.find((sesion) =>
  sesion.dia?.toLowerCase() === targetDay?.toLowerCase()
) || null;
```

**Después**:
```javascript
// Buscar por 'dia' o 'dia_semana' (compatibilidad con diferentes formatos de prompt)
return week.sesiones.find((sesion) => {
  const diaField = sesion.dia || sesion.dia_semana;
  return diaField?.toLowerCase() === targetDay?.toLowerCase();
}) || null;
```

**Impacto**: Ahora `findTodaySession()` busca en ambos campos, garantizando compatibilidad con todos los formatos de prompts de metodologías.

### 2. **calendarMapping.js** (Líneas 77-85)

Para garantizar consistencia en toda la aplicación, también actualicé la función de mapeo del calendario:

**Antes**:
```javascript
const session = sesiones.find(ses => {
  const sessionDay = ses.dia?.toLowerCase();
  return sessionDay === dayName || /* ... otros casos ... */;
});
```

**Después**:
```javascript
// Compatibilidad: Buscar en 'dia' o 'dia_semana' (diferentes formatos de prompt)
const session = sesiones.find(ses => {
  const sessionDay = (ses.dia || ses.dia_semana)?.toLowerCase();
  return sessionDay === dayName || /* ... otros casos ... */;
});
```

**Impacto**: El CalendarTab también maneja ambos formatos de campo, previniendo posibles inconsistencias futuras.

## 📊 Archivos Modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `src/components/routines/tabs/TodayTrainingTab.jsx` | 88-92 | ✅ Añadido soporte para `dia_semana` |
| `src/utils/calendarMapping.js` | 77-85 | ✅ Añadido soporte para `dia_semana` |

## 🎯 Compatibilidad

La solución es **100% backward compatible**:

### Metodologías que usan `dia`:
- Calistenia
- Hipertrofia
- Powerlifting
- CrossFit
- Oposiciones

**Resultado**: ✅ Siguen funcionando correctamente (usa `sesion.dia`)

### Metodologías que usan `dia_semana`:
- Entrenamiento en Casa

**Resultado**: ✅ Ahora funcionan correctamente (usa `sesion.dia_semana`)

## 🧪 Testing Manual

Para verificar que el fix funciona:

1. **Generar plan Casa**:
   - Ir a Metodologías → Manual
   - Seleccionar "Entrenamiento en Casa"
   - Completar formulario y generar plan

2. **Iniciar sesión**:
   - Click en "Comenzar Entrenamiento"
   - Completar calentamiento
   - Realizar algunos ejercicios

3. **Salir y verificar**:
   - Cerrar el modal de entrenamiento
   - Ir a Rutinas → pestaña "Hoy"

4. **Resultado Esperado**:
   - ✅ Debe mostrar "Entrenamiento de hoy: Lunes" (o día correspondiente)
   - ✅ Debe mostrar lista de ejercicios
   - ✅ Debe permitir "Reanudar Entrenamiento"
   - ❌ NO debe mostrar "Día de descanso"

5. **Verificar Calendario**:
   - Ir a pestaña "Calendario"
   - ✅ Debe mostrar los ejercicios del día correctamente
   - ✅ Debe coincidir con la información de la pestaña "Hoy"

## 📝 Notas Técnicas

### ¿Por qué diferentes prompts usan diferentes campos?

- Los prompts de las metodologías son creados manualmente
- Casa usaba `dia_semana` para ser más explícito
- Otras metodologías usan `dia` por simplicidad
- La solución ahora soporta ambos enfoques

### ¿Por qué CalendarTab funcionaba correctamente?

Inicialmente parecía que CalendarTab funcionaba, pero tras la investigación descubrimos que también tenía el mismo problema potencial. El fix preventivo en `calendarMapping.js` asegura que ambos componentes manejen consistentemente los datos.

### Debug Script

Se creó `backend/debug-casa-plan.js` para inspeccionar la estructura del plan en la base de datos, pero debido a problemas de red no se ejecutó. Sin embargo, la inspección del prompt fue suficiente para identificar el campo correcto.

## 🔮 Prevención de Problemas Futuros

### Recomendaciones para Nuevas Metodologías:

1. **Estandarizar el campo de día**:
   - Usar `dia` o `dia_semana` consistentemente
   - Documentar en el prompt qué campo se usa

2. **Testing checklist**:
   - Verificar que TodayTrainingTab detecta correctamente el día
   - Confirmar que CalendarTab muestra las sesiones
   - Probar con diferentes días de inicio de plan

3. **Validación en backend**:
   - Considerar normalizar el campo al guardar el plan en BD
   - Añadir validación del esquema JSON antes de guardar

## ✅ Estado Final

- [x] Problema identificado (mismatch de campos `dia` vs `dia_semana`)
- [x] Fix implementado en TodayTrainingTab
- [x] Fix preventivo en CalendarTab
- [x] Compatibilidad backward garantizada
- [x] Documentación completada
- [ ] Testing manual pendiente (por usuario)
- [ ] Verificación en producción

## 🚀 Próximos Pasos

1. **Usuario debe testear el fix**:
   - Generar nuevo plan Casa o usar plan existente (ID 48)
   - Verificar que la pestaña "Hoy" muestra correctamente la sesión
   - Confirmar que puede reanudar entrenamiento

2. **Si funciona correctamente**:
   - Cerrar issue como resuelto
   - Considerar estandarizar campos en futuros prompts

3. **Si persiste el problema**:
   - Verificar estructura exacta del plan en Supabase
   - Inspeccionar logs del backend durante la consulta
   - Considerar normalización en backend

---

**Fecha**: 2025-01-15
**Estado**: ✅ Fix implementado - Pendiente testing de usuario
**Issue**: TodayTrainingTab mostrando "día de descanso" para Casa
**Metodología Afectada**: Entrenamiento en Casa
**Solución**: Compatibilidad dual para campos `dia` y `dia_semana`
