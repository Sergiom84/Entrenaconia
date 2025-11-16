# 🐛 ANÁLISIS DE BUGS: Distribución de Sesiones

**Fecha**: 2025-11-14  
**Usuario afectado**: ID 21  
**Plan**: ID 142 (HipertrofiaV2_MindFeed)

---

## 📊 BUGS IDENTIFICADOS

### **BUG 1: Distribución incorrecta de sesiones en primera semana** 🔴

**Síntoma**:
- Usuario eligió: "Viernes + Lunes" y "Entrenar sábados"
- Sistema generó: Vie, Sáb, Dom, Lun, Mar (5 días consecutivos) ❌
- Debería generar: Solo Viernes (1 sesión) ✅

**Causa raíz**:
El `startConfig` del usuario **NO se está enviando** al backend en `/api/routines/confirm-plan`.

**Evidencia en logs**:
```
📅 [Redistribución Inteligente] Generando plan en Viernes (día 5)
📊 Viernes: Extendiendo a 5 semanas
🔄 [Semana 1] Aplicando redistribución: Vie
[ensureWorkoutScheduleV3] Primera semana: asignando 1 sesiones a días consecutivos
```

El sistema detecta correctamente que es Viernes, pero **ignora** la configuración del usuario.

---

### **BUG 2: Semanas posteriores muestran "D1, D2, D3..." en lugar de fechas** 🔴

**Síntoma**:
- Primera semana: "Viernes 14, Sábado 15..." ✅
- Semanas 2-6: "D1 Pecho + Tríceps, D2 Espalda..." ❌

**Causa raíz**:
El modal `TrainingPlanConfirmationModal.jsx` tiene lógica para calcular fechas solo en la primera semana.

**Código problemático** (línea 46-93):
```javascript
const calculateSessionDate = (weekIndex, sessionDay, startDate, sessionIndex = null) => {
  // 🔧 PRIMERA SEMANA: Usar días consecutivos basados en el índice de sesión
  if (weekIndex === 0 && sessionIndex !== null) {
    // ... calcula fecha correctamente
  }

  // 🔧 SEMANAS POSTERIORES: Usar la lógica normal basada en días fijos del plan
  const targetDayNum = DAY_NAMES_MAP[sessionDay];
  if (targetDayNum === undefined) return sessionDay; // ❌ AQUÍ RETORNA "D1", "D2"...
```

Cuando `sessionDay` es "D1", "D2", etc., `DAY_NAMES_MAP[sessionDay]` es `undefined`, y retorna el string original.

---

### **BUG 3: Pestaña "Hoy" muestra "Día de descanso" con sesión incompleta** 🟡

**Síntoma**:
- Calendario muestra correctamente la sesión incompleta ✅
- Pestaña "Hoy" muestra "Día de descanso" ❌

**Causa raíz**:
El componente `TodayTrainingTab.jsx` no está detectando correctamente la sesión del día actual.

---

### **BUG 4: Sábados no aparecen en el calendario** 🔴

**Síntoma**:
- Usuario eligió entrenar sábados
- Calendario no muestra entrenamientos en sábado ❌

**Causa raíz**:
El sistema `ensureWorkoutScheduleV3` tiene lógica hardcodeada que solo genera sesiones Lun-Vie.

**Código problemático** (línea 409-440):
```javascript
// PRIMERA SEMANA: Usar días consecutivos desde hoy (solo lun-vie)
if (isFirstWeek && startDayOfWeek > 0 && startDayOfWeek < 6) {
  // Calcular días consecutivos disponibles desde hoy hasta viernes
  const consecutiveDaysAvailable = [];
  for (let d = startDayOfWeek; d <= 5; d++) { // ❌ SOLO HASTA VIERNES (5)
    consecutiveDaysAvailable.push(DAY_ABBREVS[d]);
  }
```

---

## 🔍 ANÁLISIS DE FLUJO ACTUAL

### **Flujo de generación de plan**:

```
1. Usuario elige metodología
   ↓
2. StartDayConfirmationModal se abre
   ↓
3. Usuario elige: "Viernes + Lunes, entrenar sábados"
   ↓
4. SessionDistributionModal se abre
   ↓
5. Usuario elige: "Entrenar sábados" (6 sesiones/semana)
   ↓
6. generatePlan() se llama con startConfig
   ↓
7. Backend genera plan draft
   ↓
8. TrainingPlanConfirmationModal se abre
   ↓
9. Usuario click en "Generar entrenamiento"
   ↓
10. handleStartTraining() llama a /api/routines/confirm-plan
    ❌ SIN ENVIAR startConfig
   ↓
11. ensureWorkoutScheduleV3() usa lógica hardcodeada
    ❌ IGNORA configuración del usuario
```

---

## 🎯 SOLUCIÓN PROPUESTA

### **Paso 1: Guardar startConfig en el plan draft**

Modificar el endpoint de generación de plan para guardar `startConfig` en la tabla `plan_start_config`.

**Archivos a modificar**:
- `backend/routes/routineGeneration.js` (endpoints de generación)

**Cambios**:
1. Recibir `startConfig` en el body
2. Guardar en `plan_start_config` al crear el draft
3. Incluir campos: `sessions_first_week`, `distribution_option`, `include_saturdays`

---

### **Paso 2: Leer startConfig en confirm-plan**

Modificar `/api/routines/confirm-plan` para leer `startConfig` de la BD.

**Archivos a modificar**:
- `backend/routes/routines.js` (endpoint confirm-plan)

**Cambios**:
1. Leer `plan_start_config` antes de llamar a `ensureWorkoutScheduleV3`
2. Pasar configuración a `ensureWorkoutScheduleV3`

---

### **Paso 3: Modificar ensureWorkoutScheduleV3**

Modificar la lógica para usar `startConfig` en lugar de lógica hardcodeada.

**Archivos a modificar**:
- `backend/utils/ensureScheduleV3.js`

**Cambios**:
1. Recibir `startConfig` como parámetro
2. Usar `sessionsFirstWeek` para primera semana
3. Usar `distributionOption` para calcular semanas totales
4. Usar `includeSaturdays` para incluir sábados en calendario

---

### **Paso 4: Corregir cálculo de fechas en modal**

Modificar `TrainingPlanConfirmationModal.jsx` para calcular fechas correctamente en todas las semanas.

**Archivos a modificar**:
- `src/components/routines/TrainingPlanConfirmationModal.jsx`

**Cambios**:
1. Mapear "D1", "D2"... a días reales (Lun, Mar, Mie...)
2. Calcular fechas para todas las semanas, no solo la primera

---

### **Paso 5: Corregir detección de sesión en TodayTrainingTab**

Modificar `TodayTrainingTab.jsx` para detectar correctamente sesiones incompletas.

**Archivos a modificar**:
- `src/components/routines/tabs/TodayTrainingTab.jsx`

---

## 📁 ARCHIVOS AFECTADOS

### **Backend**:
1. `backend/routes/routineGeneration.js` - Guardar startConfig
2. `backend/routes/routines.js` - Leer startConfig en confirm-plan
3. `backend/utils/ensureScheduleV3.js` - Usar startConfig

### **Frontend**:
4. `src/components/routines/TrainingPlanConfirmationModal.jsx` - Calcular fechas
5. `src/components/routines/tabs/TodayTrainingTab.jsx` - Detectar sesión

---

## 🚨 PRIORIDAD

1. **CRÍTICO**: BUG 1 y BUG 4 (distribución incorrecta y sábados faltantes)
2. **ALTO**: BUG 2 (fechas en semanas posteriores)
3. **MEDIO**: BUG 3 (detección de sesión en "Hoy")

---

## 🧪 PLAN DE PRUEBAS

### **Escenario 1: Viernes + Sábados**
```
1. Generar plan un Viernes
2. Elegir "Viernes + Lunes, entrenar sábados"
3. Elegir "Entrenar sábados" (6 sesiones/semana)
4. Verificar:
   - Primera semana: Solo Viernes ✅
   - Semanas 2-6: Lun-Sáb (6 sesiones) ✅
   - Fechas correctas en todas las semanas ✅
```

### **Escenario 2: Jueves + Semana extra**
```
1. Generar plan un Jueves
2. Elegir "Jueves + Viernes, seguir el lunes"
3. Elegir "Añadir semana extra" (5 sesiones/semana)
4. Verificar:
   - Primera semana: Jue + Vie (2 sesiones) ✅
   - Semanas 2-7: Lun-Vie (5 sesiones) ✅
   - Total: 7 semanas ✅
```

---

## 📊 IMPACTO

- **Usuarios afectados**: Todos los que generan planes Jue-Dom
- **Severidad**: CRÍTICA (funcionalidad core rota)
- **Urgencia**: ALTA (afecta experiencia de usuario)

