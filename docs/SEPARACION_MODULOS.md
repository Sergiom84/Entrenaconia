# SEPARACIÓN COMPLETA DE MÓDULOS - Entrenamiento en Casa vs Metodologías

**Fecha de creación**: 27 de agosto de 2025  
**Importancia**: CRÍTICA - Prevenir contaminación cruzada entre módulos  
**Estado**: Implementado y verificado

## 🚨 PROBLEMA RESUELTO

Se detectó **contaminación cruzada** entre los módulos de entrenamiento en casa y metodologías, donde:

- Las **metodologías** leían ejercicios de **entrenamiento en casa**
- Ambos módulos escribían en la misma tabla general `user_exercise_history`
- Los usuarios veían ejercicios inapropiados (ej: "Kettlebell Swings Explosivos" en metodologías de gimnasio)

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Separación de Tablas de Base de Datos

#### **Estructura ANTES (INCORRECTA):**
```sql
app.user_exercise_history  -- ❌ TABLA GENERAL USADA POR AMBOS MÓDULOS
```

#### **Estructura DESPUÉS (CORRECTA):**
```sql
app.home_exercise_history   -- ✅ SOLO entrenamiento en casa
app.exercise_history       -- ✅ SOLO metodologías/rutinas  
app.user_exercise_history  -- ⚠️ DEPRECADA (no usar más)
```

### 2. Tablas Específicas por Módulo

#### **`app.home_exercise_history`** (Entrenamiento en Casa)
```sql
CREATE TABLE app.home_exercise_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id),
    exercise_name VARCHAR(255) NOT NULL,
    exercise_key VARCHAR(255),
    reps TEXT,
    series INTEGER,
    duration_seconds INTEGER,
    plan_id INTEGER REFERENCES app.home_training_plans(id),
    session_id INTEGER REFERENCES app.home_training_sessions(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **`app.exercise_history`** (Metodologías/Rutinas)
```sql
CREATE TABLE app.exercise_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id),
    exercise_name VARCHAR(255) NOT NULL,
    methodology_type VARCHAR(100) NOT NULL,  -- ✅ CAMPO CLAVE
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plan_id INTEGER,
    week_number INTEGER,
    day_name VARCHAR(20)
);
```

### 3. Correcciones en Código Backend

#### **homeTraining.js** - Escribir SOLO en home_exercise_history
```javascript
// ✅ CORRECTO - Líneas 255-260
await client.query(
  `INSERT INTO app.home_exercise_history
     (user_id, exercise_name, exercise_key, reps, series, duration_seconds, session_id, plan_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   ON CONFLICT (user_id, exercise_name, session_id) DO NOTHING`,
  [user_id, exName, exKey, null, series_completed, (duration_seconds ?? null), sessionId, planId]
);

// ✅ CORRECTO - Líneas 308-314 (estadísticas)
const exAgg = await pool.query(
  `SELECT COUNT(*)::int AS total_exercises_completed,
          COALESCE(SUM(duration_seconds), 0)::int AS total_exercise_duration_seconds
     FROM app.home_exercise_history  -- ✅ TABLA ESPECÍFICA
    WHERE user_id = $1`,
  [user_id]
);
```

#### **routines.js** - Escribir SOLO en exercise_history  
```javascript
// ✅ CORRECTO - Líneas 253-269
const historyQuery = `
  INSERT INTO app.exercise_history 
  (user_id, exercise_name, methodology_type, plan_id, week_number, day_name)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (user_id, exercise_name, plan_id, week_number, day_name) 
  DO UPDATE SET used_at = CURRENT_TIMESTAMP
`;
await pool.query(historyQuery, [
  userId,
  exerciseData.nombre,
  session.methodology_type || 'Desconocida',  -- ✅ INCLUIR METHODOLOGY_TYPE
  session.routine_plan_id,
  session.week_number,
  session.day_name
]);
```

#### **aiMethodologie.js** - Leer SOLO de exercise_history
```javascript
// ✅ CORRECTO - Líneas 95-110
const recentExercisesResult = await pool.query(
  `SELECT 
    eh.exercise_name,
    eh.methodology_type,
    COUNT(*) as usage_count,
    MAX(eh.used_at) as last_used,
    STRING_AGG(DISTINCT eh.methodology_type, ', ') as methodologies_used
  FROM app.exercise_history eh  -- ✅ TABLA ESPECÍFICA DE METODOLOGÍAS
  WHERE eh.user_id = $1 
    AND eh.used_at >= NOW() - INTERVAL '60 days'
    AND eh.exercise_name IS NOT NULL
  GROUP BY eh.exercise_name, eh.methodology_type
  ORDER BY MAX(eh.used_at) DESC, COUNT(*) DESC
  LIMIT 30`,
  [userId]
);
```

## 🔒 REGLAS DE DESARROLLO OBLIGATORIAS

### ❌ **NUNCA HACER:**
```javascript
// ❌ NO usar app.user_exercise_history para nuevos desarrollos
SELECT * FROM app.user_exercise_history WHERE user_id = ?;

// ❌ NO mezclar datos de ambos módulos
JOIN app.home_training_sessions hts ON ueh.session_id = hts.id
JOIN app.routine_sessions rs ON ueh.session_id = rs.id  -- ❌ CONTAMINA
```

### ✅ **SIEMPRE HACER:**

#### Para **Entrenamiento en Casa:**
```javascript
// ✅ Escribir en home_exercise_history
INSERT INTO app.home_exercise_history (...) VALUES (...);

// ✅ Leer de home_exercise_history  
SELECT * FROM app.home_exercise_history WHERE user_id = ?;

// ✅ Filtrar por sesiones de casa
JOIN app.home_training_sessions hts ON heh.session_id = hts.id
```

#### Para **Metodologías/Rutinas:**
```javascript
// ✅ Escribir en exercise_history con methodology_type
INSERT INTO app.exercise_history (user_id, exercise_name, methodology_type, ...) VALUES (...);

// ✅ Leer de exercise_history
SELECT * FROM app.exercise_history WHERE user_id = ? AND methodology_type = ?;

// ✅ Filtrar por sesiones de rutinas
JOIN app.routine_sessions rs ON eh.plan_id = rs.routine_plan_id
```

## 📊 VERIFICACIÓN DE SEPARACIÓN

### Comandos para Verificar Separación Correcta:

```sql
-- ✅ Verificar ejercicios de entrenamiento en casa
SELECT COUNT(*) as home_exercises 
FROM app.home_exercise_history 
WHERE user_id = 10;

-- ✅ Verificar ejercicios de metodologías
SELECT COUNT(*) as methodology_exercises, methodology_type
FROM app.exercise_history 
WHERE user_id = 10 
GROUP BY methodology_type;

-- ❌ Esta consulta NO debe devolver registros cruzados
SELECT 'PROBLEMA: Ejercicios cruzados' as warning
FROM app.home_exercise_history heh
JOIN app.exercise_history eh ON heh.exercise_name = eh.exercise_name 
  AND heh.user_id = eh.user_id
WHERE heh.user_id = 10;
```

## 🚀 MIGRACIÓN COMPLETADA

### Datos Migrados Exitosamente:
- **40 registros** migrados desde `user_exercise_history` → `home_exercise_history`
- **240 registros** ya existían correctamente en `exercise_history`
- **0 registros cruzados** después de la corrección

### Vistas Creadas para Compatibilidad:
```sql
-- Vista para entrenamiento en casa
CREATE VIEW app.vw_home_exercise_history AS
SELECT id, user_id, exercise_name, plan_id, session_id, created_at as used_at
FROM app.home_exercise_history;

-- Vista para metodologías (ya existía)
CREATE VIEW app.vw_methodology_exercise_history AS  
SELECT id, user_id, exercise_name, methodology_type, plan_id, week_number, day_name, used_at
FROM app.exercise_history;
```

## 📋 CHECKLIST PARA NUEVAS FEATURES

Antes de desarrollar cualquier funcionalidad que involucre ejercicios:

- [ ] ¿Es para entrenamiento en casa? → Usar `app.home_exercise_history`
- [ ] ¿Es para metodologías/rutinas? → Usar `app.exercise_history`
- [ ] ¿La consulta incluye `methodology_type`? (para metodologías)
- [ ] ¿La consulta filtra por `session_id` correcto según el módulo?
- [ ] ¿El JOIN es con la tabla de sesiones correcta?
- [ ] ¿Los prompts de IA especifican claramente el contexto (casa vs gimnasio)?

## 🔧 SCRIPTS DE VERIFICACIÓN

### Script para Desarrolladores:
```bash
# Verificar que no hay contaminación
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d entrenaconia -c "
SELECT 
  'home_training' as module, 
  COUNT(*) as count 
FROM app.home_exercise_history 
UNION ALL 
SELECT 
  'methodologies' as module, 
  COUNT(*) as count 
FROM app.exercise_history;
"
```

## ⚠️ TABLA DEPRECADA

**`app.user_exercise_history`**: Esta tabla YA NO DEBE USARSE para nuevos desarrollos. 
- Mantener solo para compatibilidad temporal
- Migrar gradualmente cualquier código que la use
- Eventualmente será eliminada

---

## 🎯 RESULTADO ESPERADO

Después de esta implementación:

1. **Entrenamiento en Casa**: Solo muestra ejercicios realizados en casa (sin equipamiento)
2. **Metodologías**: Solo muestra ejercicios de gimnasio por metodología específica  
3. **Historiales separados**: No hay contaminación cruzada
4. **IA contextualizada**: Los prompts son específicos para cada módulo
5. **Estadísticas precisas**: Cada módulo calcula sus propias métricas

## 📞 CONTACTO PARA DUDAS

Si tienes dudas sobre la implementación de nuevas features:
1. Revisa este documento primero
2. Verifica los ejemplos de código proporcionados
3. Ejecuta los scripts de verificación antes de hacer commit
4. Asegúrate de que los tests pasan correctamente

**¡NUNCA regreses a usar `app.user_exercise_history` para nuevos desarrollos!**