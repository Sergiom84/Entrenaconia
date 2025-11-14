# 🧪 GUÍA DE TESTING - FASE 1 MINDFEED

## ✅ RESUMEN DE IMPLEMENTACIÓN

### **Backend (Completado)**

- ✅ 9 endpoints nuevos en `/backend/routes/hipertrofiaV2.js`
- ✅ Motor de ciclo D1-D5 funcional
- ✅ Progresión automática por microciclo
- ✅ Deload automático cada 6 microciclos
- ✅ Clasificación de ejercicios por tipo

### **Frontend (Completado)**

- ✅ `HipertrofiaV2ManualCard.jsx` actualizado con generación D1-D5
- ✅ `SessionSummaryModal.jsx` integrado con advance-cycle
- ✅ `CycleStatusBadge.jsx` creado y mostrado en TodayTrainingTab
- ✅ UI actualizada con información del sistema MindFeed

---

## 🎯 PLAN DE TESTING

### **FASE 1: Generación del Plan D1-D5**

#### Test 1.1: Evaluación de Perfil

1. **Navegar a**: `/methodologies`
2. **Hacer clic en**: Card de "Hipertrofia V2"
3. **Verificar**:
   - ✅ Modal muestra "Sistema de Periodización Inteligente D1-D5"
   - ✅ Características mencionan "Ciclo D1-D5" y "Progresión por Microciclo"
   - ✅ Botón "Evaluar Perfil" funciona
4. **Consola esperada**:
   ```
   🏋️ [MINDFEED] Generando plan D1-D5 para nivel: Principiante
   ```

#### Test 1.2: Generación del Plan

1. **Hacer clic en**: "Generar Plan" (después de evaluación)
2. **Verificar**:
   - ✅ Loading spinner aparece
   - ✅ Modal se cierra al completar
   - ✅ Navega a `/routines`
3. **Consola esperada**:
   ```
   ✅ [MINDFEED] Plan D1-D5 generado
   ✅ [MINDFEED] Datos preparados, llamando a onGenerate callback
   ```

#### Test 1.3: Verificación en BD

```sql
-- Verificar que se creó el plan
SELECT * FROM app.methodology_plans
WHERE user_id = [TU_USER_ID]
ORDER BY created_at DESC LIMIT 1;

-- Verificar estado inicial del ciclo
SELECT * FROM app.hipertrofia_v2_state
WHERE user_id = [TU_USER_ID];

-- Debe mostrar:
-- cycle_day = 1
-- microcycles_completed = 0
-- deload_active = false
```

---

### **FASE 2: Visualización del Estado**

#### Test 2.1: Badge de Estado del Ciclo

1. **Navegar a**: `/routines` (Today Training Tab)
2. **Verificar badge visible**:
   - ✅ Muestra "Ciclo D1" (o el día correspondiente)
   - ✅ Muestra "0 microciclos"
   - ✅ Muestra "6 para deload"
3. **Consola esperada**:
   ```
   🔄 [BADGE] Estado de ciclo cargado: { cycle_day: 1, microcycles_completed: 0, ... }
   ```

#### Test 2.2: Información de Sesión

1. **En Today Training Tab**, verificar:
   - ✅ Sesión muestra nombre: "D1: Pecho + Tríceps"
   - ✅ Lista de ejercicios clasificados (multiarticulares primero)

---

### **FASE 3: Ejecución de Sesión y Avance de Ciclo**

#### Test 3.1: Completar Sesión D1

1. **Hacer clic en**: "Comenzar Entrenamiento"
2. **Completar todos los ejercicios** (o al menos marcarlos como completados)
3. **Al finalizar**, hacer clic en: "Ver progreso en Rutinas"
4. **Verificar consola**:
   ```
   📝 Llamando a onEndSession para completar sesión en BD
   ✅ onEndSession completado, estado actualizado
   🔄 [MINDFEED] Detectado HipertrofiaV2, avanzando ciclo...
   🔄 [MINDFEED] Avanzando ciclo desde D1...
   ✅ [MINDFEED] Ciclo avanzado: { cycle_day: 2, microcycles_completed: 0, ... }
   ```
5. **Verificar en UI**:
   - ✅ Badge ahora muestra "Ciclo D2"
   - ✅ Próxima sesión: "D2: Espalda + Bíceps"

#### Test 3.2: Verificación en BD después de D1

```sql
SELECT * FROM app.hipertrofia_v2_state
WHERE user_id = [TU_USER_ID];

-- Debe mostrar:
-- cycle_day = 2
-- microcycles_completed = 0
```

---

### **FASE 4: Completar Microciclo (D1→D5)**

#### Test 4.1: Avanzar hasta D5

1. **Repetir el flujo** de completar sesión para D2, D3, D4
2. **En cada sesión**, verificar:
   - ✅ Badge muestra el día correcto (D2, D3, D4)
   - ✅ Nombre de sesión coincide con el día del ciclo
3. **Consola en cada avance**:
   ```
   ✅ [MINDFEED] Ciclo avanzado: { cycle_day: 3, ... }
   ✅ [MINDFEED] Ciclo avanzado: { cycle_day: 4, ... }
   ✅ [MINDFEED] Ciclo avanzado: { cycle_day: 5, ... }
   ```

#### Test 4.2: Completar D5 (Trigger de Progresión)

1. **Completar sesión D5**
2. **Verificar consola**:
   ```
   🔄 [MINDFEED] Avanzando ciclo desde D5...
   ✅ [MINDFEED] Ciclo avanzado: {
     cycle_day: 1,
     microcycles_completed: 1,
     microcycle_completed: true,
     message: "¡Microciclo completado! Progresión aplicada.",
     progression: {
       progression_applied: true,
       mean_rir: 3.2,
       increment_pct: 2.5,
       exercises_updated: 15
     }
   }
   🎉 [MINDFEED] ¡Microciclo completado!
   ```
3. **Verificar en UI**:
   - ✅ Badge muestra "Ciclo D1" (reiniciado)
   - ✅ Badge muestra "1 microciclos" completados
   - ✅ Badge muestra "5 para deload"

#### Test 4.3: Verificación de Progresión en BD

```sql
-- Verificar estado actualizado
SELECT * FROM app.hipertrofia_v2_state
WHERE user_id = [TU_USER_ID];
-- cycle_day = 1, microcycles_completed = 1

-- Verificar que los pesos incrementaron
SELECT exercise_id, current_weight, target_weight_next_cycle
FROM app.hypertrophy_progression
WHERE user_id = [TU_USER_ID]
LIMIT 5;

-- target_weight_next_cycle debe ser 2.5% mayor que current_weight
```

---

### **FASE 5: Deload Automático (Opcional - Requiere 6 Microciclos)**

#### Test 5.1: Completar 6 Microciclos

1. **Repetir el ciclo D1-D5** seis veces (30 sesiones totales)
2. **En el 6to microciclo completado**, verificar:
   ```
   ✅ [MINDFEED] Ciclo avanzado con deload activado automáticamente
   ```

#### Test 5.2: Verificar Deload en BD

```sql
SELECT * FROM app.hipertrofia_v2_state
WHERE user_id = [TU_USER_ID];
-- deload_active = true
-- microcycles_completed resetea a 0 después de deload
```

#### Test 5.3: Verificar UI con Deload

- ✅ Badge muestra "⚠️ DELOAD" en lugar de "Ciclo DX"
- ✅ Mensaje: "Estás en semana de descarga. Cargas reducidas -30%, volumen -50%"

---

## 🔍 TESTING CON CURL (Backend Directo)

### Test de Generación D1-D5

```bash
curl -X POST http://localhost:3010/api/hipertrofiav2/generate-d1d5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nivel": "Principiante",
    "totalWeeks": 6
  }'
```

### Test de Estado de Ciclo

```bash
curl -X GET http://localhost:3010/api/hipertrofiav2/cycle-status/YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test de Avance de Ciclo

```bash
curl -X POST http://localhost:3010/api/hipertrofiav2/advance-cycle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "sessionDayName": "D1" }'
```

---

## ❌ ERRORES COMUNES Y SOLUCIONES

### Error 1: Badge no aparece

**Problema**: CycleStatusBadge no se muestra
**Solución**:

- Verificar que `plan.metodologia === 'HipertrofiaV2_MindFeed'`
- Verificar en consola si hay error 404 al cargar `/cycle-status`
- Verificar que existe registro en `hipertrofia_v2_state`

### Error 2: Ciclo no avanza

**Problema**: Al completar sesión, el ciclo no progresa
**Solución**:

- Verificar consola: debe aparecer `🔄 [MINDFEED] Detectado HipertrofiaV2`
- Verificar que `session.session_name` empieza con "D1", "D2", etc.
- Revisar que el endpoint `/advance-cycle` responde 200

### Error 3: Progresión no se aplica

**Problema**: Al completar D5, no se incrementan los pesos
**Solución**:

- Verificar que `mean_RIR >= 3` (necesario para progresión)
- Verificar que no hay `deload_active = true`
- Revisar logs de backend: debe mostrar "Applying progression..."

---

## 📊 CHECKLIST FINAL

### Backend

- [ ] 9 endpoints responden correctamente
- [ ] Motor de ciclo avanza D1→D2→...→D5→D1
- [ ] Progresión aplica +2.5% al completar D5
- [ ] Deload se activa automáticamente tras 6 microciclos

### Frontend

- [ ] HipertrofiaV2ManualCard genera plan D1-D5
- [ ] CycleStatusBadge muestra estado actual
- [ ] SessionSummaryModal llama a advance-cycle
- [ ] Navegación funciona correctamente

### Base de Datos

- [ ] Tabla `hipertrofia_v2_state` se crea y actualiza
- [ ] Tabla `hipertrofia_v2_session_config` tiene 5 filas (D1-D5)
- [ ] Columna `tipo_ejercicio` tiene valores (multiarticular/unilateral/analitico)
- [ ] Funciones SQL ejecutan sin errores

---

## 🚀 PRÓXIMOS PASOS (FASE 2)

Una vez completada FASE 1 exitosamente, proceder con:

### FASE 2: Inteligencia Adaptativa

- [ ] Sistema de fatiga flags (light/critical/cognitive)
- [ ] Detección de neural overlap
- [ ] Módulo de priorización muscular
- [ ] Ajustes automáticos basados en feedback

### FASE 3: Perfeccionamiento

- [ ] Transiciones automáticas de bloque (Adaptación → Hipertrofia)
- [ ] Series de calentamiento específicas
- [ ] Análisis de técnica con IA
- [ ] Dashboard de progreso avanzado

---

## 📝 NOTAS IMPORTANTES

1. **Orden de Testing**: Seguir el orden propuesto (Generación → Visualización → Ejecución → Microciclo)
2. **Consola del Navegador**: Mantener abierta para ver logs detallados
3. **Base de Datos**: Verificar después de cada test crítico
4. **Tokens**: Asegurarse de tener token válido en localStorage

---

✅ **FASE 1 LISTA PARA TESTING** - Todos los componentes integrados y documentados.
