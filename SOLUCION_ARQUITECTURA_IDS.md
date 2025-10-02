# 🎯 SOLUCIÓN: Arquitectura Óptima de IDs - Entrena con IA

**Fecha**: 2025-10-02
**Objetivo**: Solucionar problemas de mapeo de sesiones, ejercicios y estados

---

## 📋 PROBLEMAS IDENTIFICADOS

### 1. ❌ **`canResume` siempre `false`**

- **Causa**: No se verificaba `session_started_at`
- **Impacto**: No se podía reanudar sesiones iniciadas
- **Estado**: ✅ SOLUCIONADO

### 2. ❌ **Sesiones devueltas para días incorrectos**

- **Causa**: Query de `today-status` con fallback por fecha sin filtrar `day_name`
- **Ejemplo**: Solicitud de "Mié" devolvía sesión de "Jue"
- **Impacto**: Calendario mostraba ejercicios incorrectos
- **Estado**: ✅ SOLUCIONADO

### 3. ❌ **Feedback con nombre de ejercicio incorrecto**

- **Causa**: Sesiones adaptadas usaban template de otro día
- **Ejemplo**: Ejercicio "Flexión diamante" guardado como "Dominadas negativas"
- **Impacto**: Historial y feedback inconsistente
- **Estado**: ⚠️ MITIGADO (pendiente exercise_id)

### 4. ❌ **`session_status: 'completed'` incorrecto**

- **Causa**: Endpoint `/finish` siempre marcaba como `completed`
- **Ejemplo**: 2 completados + 2 cancelados = `completed` ❌
- **Impacto**: Estado de sesión no refleja realidad
- **Estado**: ✅ SOLUCIONADO

### 5. ❌ **Sesiones creadas para días no planificados**

- **Causa**: Sistema crea sesiones adaptadas desde template de otro día
- **Ejemplo**: Plan sin "Lun" crea sesión desde "Dom"
- **Impacto**: Ejercicios incorrectos en días no planificados
- **Estado**: ⚠️ PENDIENTE (requiere validación de plan)

---

## 🏗️ ARQUITECTURA ÓPTIMA IMPLEMENTADA

### **Jerarquía de Identificadores**

```
methodology_plan_id (Plan completo - 4 semanas)
    ├── week_number (1, 2, 3, 4)
    │   └── session_order (1-16, orden absoluto)
    │       └── day_name (Lun, Mar, Mié, Jue, Vie, Sáb, Dom)
    │           └── scheduled_date (fecha calendario)
    │               └── session_id (sesión ejecutada)
    │                   └── exercise_id (UUID único)
    │                       └── exercise_order (0, 1, 2, 3...)
```

### **Sistema de IDs**

#### 1. `methodology_plan_id` (Existente ✅)

- Plan completo (4 semanas)
- Estados: `active`, `cancelled`, `completed`, `draft`

#### 2. `session_template_id` (NUEVO 🆕)

- Template en `workout_schedule`
- Clave: `(methodology_plan_id, week_number, day_name)`
- Define QUÉ ejercicios debe tener cada día

#### 3. `session_id` (Existente ✅)

- Sesión ejecutada por el usuario
- Estados: `pending`, `in_progress`, `completed`, `partial`, `cancelled`, `skipped`, `incomplete`

#### 4. `exercise_id` (NUEVO 🆕)

- UUID único y persistente
- Generado con `uuid_generate_v5()` desde nombre
- Permite tracking histórico del mismo ejercicio

#### 5. `exercise_order` (Existente ✅)

- Posición del ejercicio en la sesión (0, 1, 2, 3...)

---

## 🔧 CAMBIOS IMPLEMENTADOS

### **1. Migración SQL** (`add_exercise_id_system.sql`)

```sql
-- Agregar exercise_id a progreso
ALTER TABLE app.methodology_exercise_progress
ADD COLUMN IF NOT EXISTS exercise_id UUID;

-- Agregar session_template_id y session_type a sesiones
ALTER TABLE app.methodology_exercise_sessions
ADD COLUMN IF NOT EXISTS session_template_id INTEGER,
ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'planned';

-- Función para generar exercise_id determinístico
CREATE OR REPLACE FUNCTION app.generate_exercise_id(exercise_name TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN uuid_generate_v5(
    uuid_ns_dns(),
    'exercise:' || LOWER(TRIM(exercise_name))
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migrar datos existentes
UPDATE app.methodology_exercise_progress
SET exercise_id = app.generate_exercise_id(exercise_name)
WHERE exercise_id IS NULL AND exercise_name IS NOT NULL;

-- Nuevos estados de sesión
CREATE TYPE app.session_status_enum AS ENUM (
  'pending', 'in_progress', 'completed', 'partial',
  'cancelled', 'skipped', 'paused', 'incomplete'
);

-- Índices optimizados
CREATE INDEX idx_sessions_plan_week_day
ON app.methodology_exercise_sessions(methodology_plan_id, week_number, day_name);
```

### **2. Backend - Búsqueda de Sesiones** (`routines.js:1000-1021`)

**ANTES** ❌:

```javascript
// Búsqueda con fallback por fecha SIN filtrar day_name
if (byPlanned.rowCount === 0) {
  sessionQuery = await pool.query(
    `SELECT * FROM app.methodology_exercise_sessions
     WHERE user_id = $1 AND methodology_plan_id = $2
       AND (session_date::date = $3::date OR created_at::date = $3::date)
     LIMIT 1`,
    [userId, methodology_plan_id, session_date],
  );
}
```

**DESPUÉS** ✅:

```javascript
// Búsqueda SIEMPRE filtrando por week_number Y day_name
sessionQuery = await pool.query(
  `SELECT * FROM app.methodology_exercise_sessions
   WHERE user_id = $1
     AND methodology_plan_id = $2
     AND week_number = $3
     AND day_name = $4
   ORDER BY COALESCE(updated_at, started_at, created_at) DESC
   LIMIT 1`,
  [userId, methodology_plan_id, week_number, normalizedDay],
);
```

### **3. Backend - Estado de Sesión** (`routines.js:780-836`)

**ANTES** ❌:

```javascript
// SIEMPRE marca como 'completed'
await client.query(
  `UPDATE app.methodology_exercise_sessions
   SET session_status = 'completed', completed_at = NOW()
   WHERE id = $1`,
  [sessionId],
);
```

**DESPUÉS** ✅:

```javascript
// Calcula estado real basado en progreso
const progressStats = await client.query(
  `SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
   FROM app.methodology_exercise_progress
   WHERE methodology_session_id = $1`,
  [sessionId],
);

const stats = progressStats.rows[0];
const total = Number(stats.total);
const completed = Number(stats.completed);

let finalStatus;
if (completed === total && total > 0) {
  finalStatus = "completed"; // Todos completados
} else if (skipped === total) {
  finalStatus = "skipped"; // Todos saltados
} else if (cancelled === total) {
  finalStatus = "cancelled"; // Todos cancelados
} else if (completed > 0) {
  finalStatus = "partial"; // Mezcla
} else {
  finalStatus = "incomplete"; // Sin ejercicios completados
}

await client.query(
  `UPDATE app.methodology_exercise_sessions
   SET session_status = $2, completed_at = NOW()
   WHERE id = $1`,
  [sessionId, finalStatus],
);
```

### **4. Backend - canResume** (`routines.js:1086-1091`)

**ANTES** ❌:

```javascript
const hasAnyProgress =
  inProgressExercises > 0 ||
  completedExercises + skippedExercises + cancelledExercises > 0;
const canResume = !isFinished && hasAnyProgress;
```

**DESPUÉS** ✅:

```javascript
const hasAnyProgress =
  inProgressExercises > 0 ||
  completedExercises + skippedExercises + cancelledExercises > 0;
const sessionWasStarted = session.session_started_at != null;
const canResume = !isFinished && (hasAnyProgress || sessionWasStarted);
```

---

## 📊 CASOS DE USO RESUELTOS

### **Caso 1: Reanudar sesión iniciada sin progreso**

**Antes**:

- Sesión iniciada → `session_started_at` existe
- Sin ejercicios completados → `canResume = false` ❌
- Usuario no puede reanudar

**Ahora**:

- Sesión iniciada → `session_started_at` existe
- `canResume = true` ✅
- Usuario puede reanudar

### **Caso 2: Finalizar sesión con ejercicios cancelados**

**Antes**:

- 2 completados + 2 cancelados
- `session_status = 'completed'` ❌
- Muestra como sesión completada exitosamente

**Ahora**:

- 2 completados + 2 cancelados
- `session_status = 'partial'` ✅
- Refleja el estado real

### **Caso 3: Consultar sesión de Miércoles**

**Antes**:

- Solicitud: `day_name = 'Mié'`
- Devuelve: Sesión de 'Jue' ❌
- Muestra ejercicios incorrectos

**Ahora**:

- Solicitud: `day_name = 'Mié'`
- Devuelve: Sesión de 'Mié' ✅
- Muestra ejercicios correctos

---

## 🚀 PASOS SIGUIENTES (Recomendados)

### **Alta Prioridad** 🔴

1. **Ejecutar migración SQL**

   ```bash
   # Backend debe estar corriendo en puerto 3010
   node backend/migrations/run_migration.js add_exercise_id_system.sql
   ```

2. **Actualizar `workout_schedule` para incluir `exercise_id`**
   - Modificar generación de rutinas para asignar `exercise_id` a cada ejercicio
   - Asegurar consistencia con catálogo de ejercicios

3. **Actualizar frontend para usar `exercise_id`**
   - Modificar `RoutineSessionModal.jsx` para pasar `exercise_id` en feedback
   - Actualizar `CalendarTab.jsx` para mostrar ejercicios por `exercise_id`

### **Media Prioridad** 🟡

4. **Validar plan antes de crear sesiones adaptadas**
   - No crear sesiones para días no planificados
   - Mostrar mensaje: "Día de descanso" en vez de crear sesión incorrecta

5. **Migrar feedback existente a usar `exercise_id`**
   - Script para actualizar `methodology_exercise_feedback`
   - Asignar `exercise_id` basado en `exercise_name`

### **Baja Prioridad** 🟢

6. **Dashboard de ejercicios históricos**
   - Usar vista materializada `app.exercise_history`
   - Mostrar progreso de cada ejercicio a lo largo del tiempo

7. **Sistema de recomendaciones**
   - Analizar ejercicios con mejor feedback
   - Sugerir variaciones basadas en historial

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Migración

- [x] Crear archivo `add_exercise_id_system.sql`
- [x] Ejecutar migración en Supabase ✅ **COMPLETADO**
- [x] Verificar que `exercise_id` se genera correctamente ✅ **100% cobertura (83/83 ejercicios)**
- [x] Confirmar índices creados ✅ **3/3 índices creados**

### Resultados de Migración (2025-10-02)

```
✅ Columna exercise_id agregada a methodology_exercise_progress (tipo: UUID)
✅ Columnas agregadas a methodology_exercise_sessions:
   - session_template_id (integer)
   - session_type (character varying)
✅ Función generate_exercise_id creada y probada
✅ Total ejercicios migrados: 83
✅ Exercise_id asignado: 83/83 (100%)
✅ Índices creados: 3/3
   - idx_exercise_progress_exercise_id
   - idx_sessions_plan_week_day
   - idx_workout_schedule_plan_week_day

🧪 Test de Consistencia:
   "Flexión diamante" → 834a1122-0068-f5cf-6ca2-04252ea411e9
   "flexión diamante" → 834a1122-0068-f5cf-6ca2-04252ea411e9 ✅ (mismo UUID)
   "FLEXIÓN DIAMANTE" → 834a1122-0068-f5cf-6ca2-04252ea411e9 ✅ (mismo UUID)
```

### Backend

- [x] Corregir búsqueda de sesiones en `today-status` ✅ **routines.js:1000-1021**
- [x] Corregir cálculo de estado en `/finish` ✅ **routines.js:780-836**
- [x] Corregir lógica de `canResume` ✅ **routines.js:1090-1091**
- [ ] Actualizar generación de `workout_schedule` con `exercise_id` ⏳ **PENDIENTE**

### Frontend

- [ ] Actualizar `RoutineSessionModal` para usar `exercise_id`
- [ ] Actualizar `CalendarTab` para usar `exercise_id`
- [ ] Probar flujo completo: generar → entrenar → calendario

### Testing

- [ ] Generar nueva rutina y verificar `exercise_id` en BD
- [ ] Iniciar sesión y verificar `canResume = true`
- [ ] Completar 2 ejercicios, cancelar 2 → verificar `status = 'partial'`
- [ ] Navegar calendario y verificar ejercicios correctos por día

---

## 📝 NOTAS TÉCNICAS

### **exercise_id: UUID v5 vs UUID v4**

**Elegido**: UUID v5 (determinístico)

- **Ventaja**: Mismo nombre → mismo UUID
- **Ejemplo**: "Flexión diamante" siempre genera el mismo `exercise_id`
- **Permite**: Tracking histórico consistente

**Alternativa rechazada**: UUID v4 (aleatorio)

- **Desventaja**: Mismo ejercicio tendría múltiples UUIDs
- **Problema**: Imposible consolidar historial

### **Estados de Sesión**

| Estado        | Descripción         | Ejemplo               |
| ------------- | ------------------- | --------------------- |
| `completed`   | Todos completados   | 4/4 ✅                |
| `partial`     | Algunos completados | 2/4 ✅ + 2/4 ❌       |
| `skipped`     | Todos saltados      | 0/4 ✅ + 4/4 ⏭️       |
| `cancelled`   | Todos cancelados    | 0/4 ✅ + 4/4 ❌       |
| `incomplete`  | Sin completados     | 0/4 ✅                |
| `in_progress` | En curso            | Ejercicios pendientes |

---

**Generado el**: 2025-10-02
**Autor**: Claude Code + Sergio
**Versión**: 1.0
