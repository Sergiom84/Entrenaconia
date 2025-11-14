# ✅ SCRIPTS SQL CORREGIDOS - FASE 1

## 🔧 **ERRORES CORREGIDOS**

### **ERROR 1 (línea 583)** ✅ SOLUCIONADO

```sql
-- ❌ ANTES (causaba error):
(SELECT should_trigger FROM app.check_deload_trigger(s.user_id)) as deload_should_trigger

-- ✅ AHORA (correcto):
(app.check_deload_trigger(s.user_id)->>'should_trigger')::boolean as deload_should_trigger
```

**Explicación**: La función devuelve JSONB, no una tabla. Necesitábamos extraer el campo con el operador `->>`.

### **ERROR 2 (línea 41)** ✅ SOLUCIONADO

El segundo script fallaba porque las columnas no se crearon (efecto dominó del error 1). Ahora debería funcionar perfectamente.

---

## 📋 **NUEVOS ARCHIVOS**

### 1. `hipertrofia_v2_mindfeed_fase1_FIXED.sql`

Versión corregida de la migración principal.

### 2. `hipertrofia_v2_clasificar_ejercicios_FIXED.sql`

Script de clasificación (sin cambios, pero renombrado para claridad).

---

## 🚀 **INSTRUCCIONES DE EJECUCIÓN**

### **PASO 1: Limpiar ejecución anterior (si fallaste antes)**

Si ejecutaste los scripts anteriores y fallaron, primero limpia:

```sql
-- Solo ejecuta esto SI ya intentaste ejecutar los scripts antes
DROP TABLE IF EXISTS app.hipertrofia_v2_state CASCADE;
DROP TABLE IF EXISTS app.hipertrofia_v2_session_config CASCADE;
DROP VIEW IF EXISTS app.hipertrofia_v2_user_status CASCADE;

-- Eliminar funciones anteriores (si existen)
DROP FUNCTION IF EXISTS app.advance_cycle_day CASCADE;
DROP FUNCTION IF EXISTS app.calculate_mean_rir_last_microcycle CASCADE;
DROP FUNCTION IF EXISTS app.apply_microcycle_progression CASCADE;
DROP FUNCTION IF EXISTS app.check_deload_trigger CASCADE;
DROP FUNCTION IF EXISTS app.activate_deload CASCADE;
DROP FUNCTION IF EXISTS app.deactivate_deload CASCADE;

-- Eliminar columnas añadidas (si existen)
ALTER TABLE app."Ejercicios_Hipertrofia" DROP COLUMN IF EXISTS tipo_ejercicio CASCADE;
ALTER TABLE app."Ejercicios_Hipertrofia" DROP COLUMN IF EXISTS patron_movimiento CASCADE;
ALTER TABLE app."Ejercicios_Hipertrofia" DROP COLUMN IF EXISTS orden_recomendado CASCADE;

ALTER TABLE app.hypertrophy_progression DROP COLUMN IF EXISTS target_weight_next_cycle CASCADE;
ALTER TABLE app.hypertrophy_progression DROP COLUMN IF EXISTS last_microcycle_completed CASCADE;
ALTER TABLE app.hypertrophy_progression DROP COLUMN IF EXISTS progression_locked CASCADE;
```

### **PASO 2: Ejecutar migración principal (CORREGIDA)**

1. Abre Supabase Dashboard → SQL Editor
2. Copia **TODO** el contenido de `hipertrofia_v2_mindfeed_fase1_FIXED.sql`
3. Pega y ejecuta (RUN)
4. **Verifica éxito**: Deberías ver al final una tabla con 2 filas mostrando las tablas creadas

### **PASO 3: Ejecutar clasificación de ejercicios**

1. En el mismo SQL Editor
2. Copia **TODO** el contenido de `hipertrofia_v2_clasificar_ejercicios_FIXED.sql`
3. Pega y ejecuta (RUN)
4. **Verifica éxito**: Al final verás reportes de clasificación con ejercicios por tipo

---

## ✅ **VERIFICACIÓN POST-EJECUCIÓN**

Ejecuta esto para confirmar que todo funcionó:

```sql
-- 1. Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'app'
  AND table_name LIKE 'hipertrofia_v2%'
ORDER BY table_name;

-- Debe devolver:
-- hipertrofia_v2_session_config
-- hipertrofia_v2_state

-- 2. Verificar D1-D5 configurados
SELECT cycle_day, session_name
FROM app.hipertrofia_v2_session_config
ORDER BY cycle_day;

-- Debe devolver 5 filas:
-- D1: Pecho + Tríceps
-- D2: Espalda + Bíceps
-- D3: Piernas Completas
-- D4: Pecho + Tríceps (Frecuencia 2)
-- D5: Espalda + Bíceps + Hombros + Core

-- 3. Verificar ejercicios clasificados
SELECT tipo_ejercicio, COUNT(*) as total
FROM app."Ejercicios_Hipertrofia"
WHERE nivel = 'Principiante'
  AND tipo_ejercicio IS NOT NULL
GROUP BY tipo_ejercicio;

-- Debe mostrar:
-- analitico: X ejercicios
-- multiarticular: Y ejercicios
-- unilateral: Z ejercicios

-- 4. Verificar funciones creadas
SELECT COUNT(*) as funciones_creadas
FROM information_schema.routines
WHERE routine_schema = 'app'
  AND (routine_name LIKE '%cycle%'
    OR routine_name LIKE '%microcycle%'
    OR routine_name LIKE '%deload%');

-- Debe devolver: 6 funciones

-- 5. Verificar vista
SELECT COUNT(*) FROM app.hipertrofia_v2_user_status;

-- Debe devolver: 0 (vacía al inicio)
```

---

## ✅ **SI TODO FUNCIONA**

Una vez ejecutados ambos scripts sin errores, avísame diciendo:

**"✅ Scripts FIXED ejecutados correctamente"**

Y continuaré con:

1. Modificar backend para generar D1-D5
2. Implementar motor de ciclo en endpoints
3. Actualizar frontend para usar nuevo sistema

---

## 🆘 **SI SIGUE FALLANDO**

Dame el error **EXACTO** que aparece, incluyendo:

1. Qué script estabas ejecutando
2. Número de línea del error
3. Mensaje completo del error

---

## 📊 **LO QUE SE CREÓ**

### **Tablas Nuevas**

- `hipertrofia_v2_state` - Motor de ciclo (cycle_day, microcycles_completed, deload_active)
- `hipertrofia_v2_session_config` - Configuración D1-D5 (con 5 filas pre-cargadas)

### **Columnas Nuevas**

- `Ejercicios_Hipertrofia.tipo_ejercicio` - multiarticular | unilateral | analitico
- `Ejercicios_Hipertrofia.patron_movimiento` - empuje_horizontal | traccion_vertical | etc.
- `Ejercicios_Hipertrofia.orden_recomendado` - 1 (primero) | 2 (medio) | 3 (final)
- `hypertrophy_progression.target_weight_next_cycle` - Peso objetivo próximo ciclo
- `hypertrophy_progression.last_microcycle_completed` - Último microciclo actualizado
- `hypertrophy_progression.progression_locked` - Bloqueado durante deload/prioridad

### **Funciones Nuevas**

1. `advance_cycle_day()` - Avanza D1→D2→...→D5→D1
2. `calculate_mean_rir_last_microcycle()` - Calcula RIR medio
3. `apply_microcycle_progression()` - Aplica +2.5% al completar ciclo
4. `check_deload_trigger()` - Detecta si necesita deload
5. `activate_deload()` - Activa deload (-30% carga, -50% volumen)
6. `deactivate_deload()` - Desactiva deload y reinicia

### **Vista Nueva**

- `hipertrofia_v2_user_status` - Estado consolidado del usuario

---

¡Listo para ejecutar! 🚀
