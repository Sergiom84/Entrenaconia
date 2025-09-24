# 🔑 CONCEPTOS CLAVE DE IDs EN ENTRENA CON IA

## 📋 RESUMEN EJECUTIVO

Esta documentación clarifica los conceptos fundamentales de identificadores en la aplicación Entrena con IA para evitar confusiones y errores como sesiones en limbo.

---

## 1️⃣ **METHODOLOGY_PLAN_ID**

### 🎯 **Propósito**
Identificador único del plan de entrenamiento completo generado por IA o creado manualmente.

### 📊 **Ubicación en BD**
- **Tabla principal**: `app.methodology_plans`
- **Campo**: `id` (se usa como `methodology_plan_id`)
- **Tipo**: `INTEGER (Primary Key)`

### 🔄 **Estados posibles**
- `active` - Plan actualmente en uso
- `cancelled` - Plan cancelado por el usuario
- `completed` - Plan terminado exitosamente
- `draft` - Plan creado pero no confirmado

### 📝 **Ejemplo real**
```sql
-- Plan activo actual del usuario 18
methodology_plan_id: 23
status: 'active'
methodology_type: 'Calistenia'
```

### 🎯 **Uso en la aplicación**
- ✅ **Frontend**: Se almacena en `localStorage` como `planId`
- ✅ **Backend**: Clave para todas las consultas de plan
- ✅ **APIs**: Parámetro obligatorio en la mayoría de endpoints

---

## 2️⃣ **DAY_ID**

### 🎯 **Propósito**
Identificador secuencial de cada día dentro de un plan de entrenamiento (1, 2, 3, 4, 5, 6, 7...).

### 📊 **Ubicación en BD**
- **Tabla principal**: `app.methodology_plan_days`
- **Campo**: `day_id`
- **Tipo**: `INTEGER`

### 🗓️ **Estructura**
- **Día 1**: Primer día del plan (ej: viernes)
- **Día 2**: Segundo día (ej: sábado)
- **Día 7**: Séptimo día (ej: jueves)
- **Día 8**: Primera semana siguiente (viernes semana 2)

### 📝 **Ejemplo real**
```sql
-- Plan de 7 días (semana 1)
day_id: 1 → 'friday'    (2025-09-18)
day_id: 2 → 'saturday'  (2025-09-19)
day_id: 6 → 'wednesday' (2025-09-23) ← Día actual
day_id: 7 → 'thursday'  (2025-09-24)
```

### 🎯 **Uso en la aplicación**
- ✅ **Frontend**: Se calcula automáticamente según la fecha actual
- ✅ **Backend**: Se usa para resolver `week_number` y `day_name`
- ✅ **APIs**: Parámetro en `/today-status` y `/sessions/start`

---

## 3️⃣ **SESSION_ID**

### 🎯 **Propósito**
Identificador único de una sesión de entrenamiento específica (una ejecución real de ejercicios).

### 📊 **Ubicación en BD**
- **Tabla principal**: `app.methodology_exercise_sessions`
- **Campo**: `id`
- **Tipo**: `INTEGER (Primary Key)`

### 🔄 **Estados posibles**
- `in_progress` - Sesión actualmente ejecutándose
- `completed` - Sesión terminada exitosamente
- `cancelled` - Sesión cancelada
- `paused` - Sesión pausada (no implementado)

### 📝 **Ejemplo real**
```sql
-- Sesiones del plan 23
session_id: 17 → 'today' (in_progress)
session_id: 18 → 'Vie' (completed)
session_id: 19 → 'Lun' (completed)
session_id: 20 → 'monday' (in_progress) ⚠️
session_id: 21 → 'wednesday' (cancelled)
```

### 🚨 **Problema detectado**
**Sesión ID 20** está `in_progress` pero con `completed_at` definido → **Estado inconsistente**

### 🎯 **Uso en la aplicación**
- ✅ **Frontend**: Se almacena en contexto durante ejecución
- ✅ **Backend**: Clave para tracking de progreso
- ✅ **APIs**: Parámetro en endpoints de progreso y finalización

---

## 4️⃣ **PLAN_ID (Concepto confuso)**

### ⚠️ **PROBLEMA DE NOMENCLATURA**

El término `plan_id` se usa inconsistentemente en el código:

#### 📍 **En Base de Datos**
```sql
-- methodology_plan_days.plan_id → FK a methodology_plans.id
-- Es decir: plan_id = methodology_plan_id
```

#### 📍 **En Frontend**
```javascript
// WorkoutContext.jsx
planId: 14  // ← localStorage obsoleto (PROBLEMA)
planId: 23  // ← Valor correcto actual
```

#### 📍 **En APIs**
```javascript
// A veces se usa plan_id, a veces methodology_plan_id
// INCONSISTENTE y causa confusión
```

### ✅ **RECOMENDACIÓN**
**Usar SIEMPRE `methodology_plan_id`** en todo el código para evitar ambigüedades.

---

## 🚨 **PROBLEMAS IDENTIFICADOS Y SOLUCIONES**

### 1. **Sesiones en Limbo**

#### 💥 **Problema**
```sql
-- Sesión que queda "in_progress" para siempre
session_status: 'in_progress'
completed_at: null
-- Usuario no puede iniciar nueva sesión
```

#### ✅ **Solución implementada**
```sql
-- Auto-cancelar sesiones antiguas en limbo
UPDATE methodology_exercise_sessions
SET session_status = 'cancelled'
WHERE session_status = 'in_progress'
  AND started_at < NOW() - INTERVAL '2 hours';
```

### 2. **localStorage Obsoleto**

#### 💥 **Problema**
```javascript
// localStorage mantiene datos de planes eliminados
planId: 14  // ← Plan que ya no existe
```

#### ✅ **Solución implementada**
```javascript
// Validar plan contra BD antes de usar localStorage
const validatePlan = async (planId) => {
  const exists = await checkPlanExists(planId);
  if (!exists) {
    localStorage.removeItem('workout_state_18');
    return null;
  }
  return planId;
};
```

### 3. **Inconsistencia de Estados**

#### 💥 **Problema detectado**
```sql
-- Sesión ID 20: in_progress PERO con completed_at
session_status: 'in_progress'
completed_at: '2025-09-22T17:35:58.977Z' -- ⚠️ INCONSISTENTE
```

#### ✅ **Solución recomendada**
```sql
-- Corregir estados inconsistentes
UPDATE methodology_exercise_sessions
SET session_status = 'completed'
WHERE session_status = 'in_progress'
  AND completed_at IS NOT NULL;
```

---

## 🛡️ **VALIDACIONES ANTI-LIMBO PROPUESTAS**

### 1. **Validación en Session Start**
```javascript
// Antes de crear nueva sesión, limpiar limbo
const cleanupLimboSessions = async (userId, planId) => {
  await pool.query(`
    UPDATE methodology_exercise_sessions
    SET session_status = 'cancelled'
    WHERE user_id = $1
      AND methodology_plan_id = $2
      AND session_status = 'in_progress'
      AND started_at < NOW() - INTERVAL '1 hour'
  `, [userId, planId]);
};
```

### 2. **Validación de Plan Activo**
```javascript
// Verificar que el plan existe y está activo
const validateActivePlan = async (planId, userId) => {
  const result = await pool.query(`
    SELECT status FROM methodology_plans
    WHERE id = $1 AND user_id = $2
  `, [planId, userId]);

  if (result.rows.length === 0) {
    throw new Error('Plan no encontrado');
  }

  if (result.rows[0].status !== 'active') {
    throw new Error('Plan no está activo');
  }
};
```

### 3. **Limpieza Automática Periódica**
```javascript
// Cron job para limpiar sesiones en limbo
const cleanupOldSessions = async () => {
  const result = await pool.query(`
    UPDATE methodology_exercise_sessions
    SET session_status = 'cancelled'
    WHERE session_status = 'in_progress'
      AND started_at < NOW() - INTERVAL '24 hours'
    RETURNING id;
  `);

  console.log(`🧹 Limpieza: ${result.rowCount} sesiones en limbo canceladas`);
};
```

---

## 📊 **RESUMEN DE RELACIONES**

```
Usuario (18)
    ├── methodology_plan_id: 23 (active)
    │   ├── day_id: 1-7 (methodology_plan_days)
    │   └── session_id: 17,18,19,20,21 (methodology_exercise_sessions)
    │
    ├── methodology_plan_id: 22 (cancelled)
    ├── methodology_plan_id: 21 (cancelled)
    └── methodology_plan_id: 20 (cancelled)
```

---

## 🎯 **MEJORES PRÁCTICAS**

### ✅ **DO - Hacer**
- Usar `methodology_plan_id` consistentemente
- Validar existencia del plan antes de usar
- Limpiar localStorage cuando el plan no exista
- Implementar timeouts para sesiones en limbo
- Validar estados antes de transiciones

### ❌ **DON'T - No hacer**
- Mezclar `plan_id` y `methodology_plan_id`
- Confiar ciegamente en localStorage
- Dejar sesiones en `in_progress` indefinidamente
- Crear sesiones sin validar el plan activo
- Ignorar estados inconsistentes

---

## 🚀 **PRÓXIMOS PASOS RECOMENDADOS**

1. **Implementar validaciones anti-limbo**
2. **Estandarizar nomenclatura de IDs**
3. **Crear sistema de limpieza automática**
4. **Mejorar logging para debugging**
5. **Documentar flujos de estado de sesiones**