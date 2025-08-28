# 🚨 SEPARACIÓN CRÍTICA DE MÓDULOS - ENTRENA CON IA

**Fecha de creación**: 27 de agosto de 2025  
**Versión**: 1.0  
**Estado**: CRÍTICO - NO MEZCLAR DATOS ENTRE MÓDULOS  

## ⚠️ SEPARACIÓN OBLIGATORIA

La aplicación tiene **DOS MÓDULOS COMPLETAMENTE SEPARADOS** que **NUNCA** deben mezclarse:

### 1. 🏠 ENTRENAMIENTO EN CASA
- **Ruta**: `/home-training`
- **Backend**: `/api/home-training/*` y `/api/ia-home-training/*`
- **Tabla de historial**: `app.home_exercise_history`
- **Tablas específicas**: `app.home_training_*`, `app.home_exercise_*`
- **Características**: Sin equipamiento/mínimo, ejercicios caseros
- **IA**: Módulo `HOME_TRAINING` (gpt-4.1-nano, temp 1.0)

### 2. 🏋️ METODOLOGÍAS/RUTINAS DE GIMNASIO
- **Ruta**: `/methodologies` → `/routines`
- **Backend**: `/api/methodologie/*`, `/api/methodology-manual/*`, `/api/routines/*`
- **Tabla de historial**: `app.exercise_history`
- **Tablas específicas**: `app.routine_*`, `app.methodology_*`
- **Características**: Equipamiento de gimnasio, metodologías científicas
- **IA**: Módulos `METHODOLOGIE` y `METHODOLOGIE_MANUAL`

---

## 🔄 FLUJOS VERIFICADOS

### ✅ Entrenamiento en Casa - CORRECTO
```
HomeTrainingSection.jsx
    ↓ Genera plan
/api/ia-home-training/generate
    ↓ Guarda
app.home_training_plans
    ↓ Sesión
app.home_training_sessions
    ↓ Progreso
app.home_exercise_progress
    ↓ Historial ESPECÍFICO
app.home_exercise_history ← SOLO ENTRENAMIENTO EN CASA
```

### ✅ Metodologías/Rutinas - CORRECTO
```
MethodologiesScreen.jsx
    ↓ Genera plan
/api/methodologie/generate-plan
    ↓ Guarda
app.methodology_plans
    ↓ Navega a rutinas
RoutineScreen.jsx
    ↓ Sesión
app.routine_sessions
    ↓ Progreso
app.routine_exercise_progress
    ↓ Historial ESPECÍFICO
app.exercise_history ← SOLO METODOLOGÍAS/RUTINAS
```

---

## 📊 TABLAS Y SU USO ESPECÍFICO

### 🏠 Solo para Entrenamiento en Casa
```sql
-- Planes y sesiones
app.home_training_plans
app.home_training_sessions

-- Progreso específico
app.home_exercise_progress

-- Historial ESPECÍFICO de entrenamiento en casa
app.home_exercise_history ← NUNCA debe mezclarse con rutinas

-- Estadísticas
app.user_home_training_stats
```

### 🏋️ Solo para Metodologías/Rutinas
```sql
-- Planes y sesiones
app.methodology_plans
app.routine_plans
app.routine_sessions

-- Progreso específico
app.routine_exercise_progress
app.routine_exercise_feedback

-- Historial ESPECÍFICO de metodologías/rutinas
app.exercise_history ← NUNCA debe mezclarse con home training

-- Políticas
app.exercise_repetition_policy
```

### ⚠️ TABLA DEPRECADA
```sql
-- Esta tabla NO debe usarse en nuevos desarrollos
app.user_exercise_history ← DEPRECADA
```

---

## 🛡️ VALIDACIONES IMPLEMENTADAS

### En el Backend
- ✅ `homeTraining.js` solo usa `app.home_exercise_history`
- ✅ `aiMethodologie.js` solo consulta `app.exercise_history`
- ✅ `routines.js` solo inserta en `app.exercise_history`
- ✅ Cada módulo tiene sus propias tablas de progreso

### En el Frontend
- ✅ `HomeTrainingSection.jsx` maneja solo datos de entrenamiento en casa
- ✅ `MethodologiesScreen.jsx` → `RoutineScreen.jsx` maneja solo metodologías
- ✅ Modales específicos para cada módulo
- ✅ Estados separados, sin compartir datos

### En la Base de Datos
- ✅ `app.home_exercise_history` - historial específico de casa
- ✅ `app.exercise_history` - historial específico de metodologías
- ✅ Funciones específicas por módulo
- ✅ Sin referencias cruzadas entre módulos

---

## 🚫 ERRORES COMUNES QUE EVITAR

### ❌ NO HACER NUNCA:
1. **Mezclar historiales**: Nunca consultar ambas tablas de historial en un mismo flujo
2. **Compartir sesiones**: Una sesión de casa no debe aparecer en rutinas y viceversa
3. **Reutilizar componentes**: Los modales son específicos por módulo
4. **Combinar estadísticas**: Las stats de casa y gimnasio son completamente separadas
5. **Usar tabla deprecada**: `app.user_exercise_history` está DEPRECADA

### ❌ Ejemplos de código PROHIBIDO:
```javascript
// PROHIBIDO - Mezclar historiales
SELECT * FROM app.home_exercise_history 
UNION 
SELECT * FROM app.exercise_history

// PROHIBIDO - Insertar home training en rutinas
INSERT INTO app.exercise_history 
VALUES (user_id, 'Flexiones', 'home_training')

// PROHIBIDO - Compartir componentes
<HomeTrainingExerciseModal exercise={routineExercise} />
```

---

## ✅ PATRONES CORRECTOS

### 🏠 Para Entrenamiento en Casa:
```javascript
// ✅ CORRECTO - Solo historiales de casa
const homeStats = await fetch('/api/home-training/stats');

// ✅ CORRECTO - Solo tabla específica
INSERT INTO app.home_exercise_history 
(user_id, exercise_name, session_id, plan_id)
VALUES ($1, $2, $3, $4)
```

### 🏋️ Para Metodologías/Rutinas:
```javascript
// ✅ CORRECTO - Solo historiales de rutinas
const routineStats = await fetch('/api/routines/stats');

// ✅ CORRECTO - Solo tabla específica
INSERT INTO app.exercise_history 
(user_id, exercise_name, methodology_type, session_id)
VALUES ($1, $2, $3, $4)
```

---

## 🎯 COMPROBACIONES DE SEPARACIÓN

### Para desarrolladores:
1. **Buscar mezclas**: `grep -r "home.*exercise.*routine" src/`
2. **Verificar consultas**: Revisar que no se consulten ambas tablas juntas
3. **Comprobar rutas**: Home training nunca debe llamar APIs de rutinas
4. **Validar componentes**: Cada módulo tiene sus propios modales y pantallas

### Comandos de verificación:
```bash
# Verificar que home training no usa exercise_history
grep -r "exercise_history" backend/routes/homeTraining.js
# Debe estar vacío

# Verificar que rutinas no usa home_exercise_history  
grep -r "home_exercise_history" backend/routes/routines.js
# Debe estar vacío
```

---

## 📋 CHECKLIST DE DESARROLLO

Antes de hacer cualquier cambio que involucre historiales de ejercicios:

- [ ] ¿Estoy trabajando con entrenamiento en casa o rutinas de gimnasio?
- [ ] ¿Estoy usando la tabla de historial correcta?
- [ ] ¿Mis componentes están en el módulo correcto?
- [ ] ¿Las rutas API corresponden al módulo?
- [ ] ¿No estoy mezclando datos entre módulos?

---

## 🚨 EN CASO DE EMERGENCIA

Si detectas mezcla de datos:

1. **DETENER** desarrollo inmediatamente
2. **IDENTIFICAR** qué tabla tiene datos incorrectos  
3. **LIMPIAR** datos mezclados con scripts SQL específicos
4. **REVISAR** todo el código del módulo afectado
5. **ACTUALIZAR** esta documentación si es necesario

---

## 🔄 ACTUALIZACIONES

Este documento debe actualizarse cada vez que:
- Se añadan nuevos módulos
- Se modifiquen tablas de historial
- Se detecten problemas de separación
- Se implementen nuevas funcionalidades

**Última actualización**: 27 de agosto de 2025
**Próxima revisión**: Cada vez que se modifique funcionalidad de ejercicios