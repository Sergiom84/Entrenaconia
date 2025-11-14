# 🚀 ENDPOINTS MINDFEED - FASE 1

## ✅ ENDPOINTS IMPLEMENTADOS

Todos los endpoints están en `/backend/routes/hipertrofiaV2.js`

---

## 📦 **1. GENERACIÓN D1-D5**

### `POST /api/hipertrofiav2/generate-d1d5`

**Descripción**: Genera plan completo D1-D5 (Motor MindFeed)

**Body**:

```json
{
  "nivel": "Principiante",
  "totalWeeks": 6
}
```

**Response**:

```json
{
  "success": true,
  "plan": {
    "metodologia": "HipertrofiaV2_MindFeed",
    "version": "MindFeed_v1.0",
    "ciclo_type": "D1-D5",
    "sessions": [
      {
        "cycle_day": 1,
        "session_name": "D1: Pecho + Tríceps",
        "intensity_percentage": 80,
        "exercises": [...]
      },
      ...
    ]
  },
  "methodologyPlanId": 123,
  "system_info": {
    "motor": "MindFeed v1.0",
    "ciclo": "D1-D5",
    "progresion": "Por microciclo (+2.5%)"
  }
}
```

**Lo que hace**:

1. Obtiene configuración D1-D5 de la BD
2. Para cada sesión, selecciona ejercicios por tipo (multiarticular/unilateral/analítico)
3. Crea plan en `methodology_plans`
4. Inicializa estado en `hipertrofia_v2_state` (cycle_day=1)

---

## 🔄 **2. MOTOR DE CICLO**

### `GET /api/hipertrofiav2/cycle-status/:userId`

**Descripción**: Obtiene estado actual del ciclo del usuario

**Response**:

```json
{
  "success": true,
  "cycleState": {
    "user_id": 1,
    "cycle_day": 3,
    "microcycles_completed": 2,
    "next_session": "D3",
    "next_session_name": "D3: Piernas Completas",
    "deload_active": false,
    "recent_mean_rir": 2.8
  }
}
```

---

### `POST /api/hipertrofiav2/advance-cycle`

**Descripción**: Avanza el día del ciclo (D1→D2→...→D5→D1)

**Body**:

```json
{
  "sessionDayName": "D2"
}
```

**Response**:

```json
{
  "success": true,
  "cycle_day": 3,
  "microcycles_completed": 0,
  "microcycle_completed": false,
  "message": "Avanzaste a D3"
}
```

**Si completa microciclo (D5→D1)**:

```json
{
  "success": true,
  "cycle_day": 1,
  "microcycles_completed": 1,
  "microcycle_completed": true,
  "message": "¡Microciclo completado! Progresión aplicada.",
  "progression": {
    "progression_applied": true,
    "mean_rir": 3.2,
    "increment_pct": 2.5,
    "exercises_updated": 15
  }
}
```

**Lógica automática**:

- Si es D5 → reinicia a D1 e incrementa `microcycles_completed`
- Si completó microciclo → aplica automáticamente progresión +2.5%

---

## 📈 **3. PROGRESIÓN**

### `POST /api/hipertrofiav2/apply-progression`

**Descripción**: Aplica progresión +2.5% al completar microciclo

**Body**:

```json
{
  "methodologyPlanId": 123
}
```

**Response**:

```json
{
  "success": true,
  "progression_applied": true,
  "mean_rir": 3.1,
  "increment_pct": 2.5,
  "exercises_updated": 15,
  "message": "Progresión +2.5% aplicada a 15 ejercicios"
}
```

**Lógica**:

- Solo aplica si `mean_RIR >= 3` y NO está en deload
- Incrementa `target_weight_next_cycle` en todos los ejercicios del usuario

---

## ⚠️ **4. DELOAD**

### `GET /api/hipertrofiav2/check-deload/:userId`

**Descripción**: Verifica si necesita deload

**Response**:

```json
{
  "success": true,
  "should_trigger": true,
  "reason": "planificado",
  "microcycles_completed": 6,
  "message": "Deload requerido (planificado)"
}
```

---

### `POST /api/hipertrofiav2/activate-deload`

**Descripción**: Activa deload (reduce -30% carga, -50% volumen)

**Body**:

```json
{
  "methodologyPlanId": 123,
  "reason": "planificado"
}
```

**Response**:

```json
{
  "success": true,
  "deload_activated": true,
  "reason": "planificado",
  "load_reduction_pct": 30,
  "volume_reduction_pct": 50,
  "exercises_affected": 15
}
```

---

### `POST /api/hipertrofiav2/deactivate-deload`

**Descripción**: Desactiva deload tras completarlo

**Response**:

```json
{
  "success": true,
  "deload_deactivated": true,
  "message": "Deload completado. Reiniciando progresión con +2% de recarga"
}
```

**Lógica**:

- Restaura pesos a valores pre-deload + 2% extra
- Reinicia `microcycles_completed` a 0

---

## 🎯 **5. SELECCIÓN DE EJERCICIOS**

### `POST /api/hipertrofiav2/select-exercises-by-type`

**Descripción**: Selecciona ejercicios por tipo (multiarticular/unilateral/analítico)

**Body**:

```json
{
  "tipo_ejercicio": "multiarticular",
  "categoria": "Pecho",
  "nivel": "Principiante",
  "cantidad": 2
}
```

**Response**:

```json
{
  "success": true,
  "exercises": [
    {
      "exercise_id": 1,
      "nombre": "Press Banca con Mancuernas",
      "categoria": "Pecho",
      "tipo_ejercicio": "multiarticular",
      "patron_movimiento": "empuje_horizontal",
      "orden_recomendado": 1,
      "descanso_seg": 120,
      "notas": "..."
    }
  ]
}
```

**Fallback**: Si no encuentra ejercicios del tipo solicitado, devuelve cualquier tipo disponible con `fallback: true`.

---

## 📋 **6. CONFIGURACIÓN DE SESIONES**

### `GET /api/hipertrofiav2/session-config/:cycleDay`

**Descripción**: Obtiene configuración de una sesión (D1-D5)

**Ejemplo**: `GET /api/hipertrofiav2/session-config/1` (D1)

**Response**:

```json
{
  "success": true,
  "sessionConfig": {
    "cycle_day": 1,
    "session_name": "D1: Pecho + Tríceps (Empuje Principal)",
    "muscle_groups": ["Pecho", "Tríceps"],
    "intensity_percentage": 80,
    "is_heavy_day": true,
    "multiarticular_count": 2,
    "unilateral_count": 1,
    "analitico_count": 1,
    "default_sets": 3,
    "default_reps_range": "8-12",
    "default_rir_target": "2-3",
    "description": "Día de empuje principal...",
    "coach_tip": "Prioriza la técnica en los press..."
  }
}
```

---

### `GET /api/hipertrofiav2/session-config-all`

**Descripción**: Obtiene todas las configuraciones D1-D5

**Response**:

```json
{
  "success": true,
  "sessions": [
    { "cycle_day": 1, ... },
    { "cycle_day": 2, ... },
    { "cycle_day": 3, ... },
    { "cycle_day": 4, ... },
    { "cycle_day": 5, ... }
  ]
}
```

---

## 🔗 **FLUJO COMPLETO DE USO**

### **1. Generación del Plan**

```
POST /api/hipertrofiav2/generate-d1d5
→ Crea plan D1-D5
→ Inicializa estado (cycle_day=1, microcycles_completed=0)
```

### **2. Usuario Entrena (Día 1)**

```
Usuario completa sesión D1
→ Frontend guarda series con peso/reps/RIR
→ POST /api/hipertrofiav2/save-set (múltiples llamadas)
→ Al finalizar sesión:
   POST /api/hipertrofiav2/advance-cycle { sessionDayName: "D1" }
   → Estado avanza a cycle_day=2
```

### **3. Usuario Entrena Días 2-5**

```
Repite proceso D2, D3, D4
→ Estado avanza: cycle_day=3, 4, 5...
```

### **4. Usuario Completa D5 (Microciclo Completo)**

```
POST /api/hipertrofiav2/advance-cycle { sessionDayName: "D5" }
→ Estado: cycle_day=1, microcycles_completed=1
→ Automáticamente aplica progresión +2.5% si mean_RIR >= 3
```

### **5. Tras 6 Microciclos Completados**

```
GET /api/hipertrofiav2/check-deload/:userId
→ should_trigger: true

POST /api/hipertrofiav2/activate-deload
→ Reduce cargas -30%, volumen -50%
→ Usuario hace semana de deload

POST /api/hipertrofiav2/deactivate-deload
→ Restaura cargas + 2%
→ Reinicia microcycles_completed a 0
```

---

## 🎯 **DIFERENCIAS CON SISTEMA ANTERIOR**

| Aspecto        | Anterior (A/B/C)         | Nuevo (D1-D5)                    |
| -------------- | ------------------------ | -------------------------------- |
| **Estructura** | 3 días Full Body         | 5 días rotativos                 |
| **Progresión** | Por ejercicio individual | Por microciclo completo          |
| **Intensidad** | Fija                     | Variable (80% D1-3, 73% D4-5)    |
| **Frecuencia** | 3 días/semana fijos      | Flexible (usuario decide cuándo) |
| **Ejercicios** | Selección aleatoria      | Por tipo (multi/uni/analítico)   |
| **Deload**     | Manual                   | Automático (6 microciclos)       |
| **Tracking**   | Básico                   | Motor de ciclo completo          |

---

## ✅ **ESTADO ACTUAL: BACKEND COMPLETO**

- ✅ 9 endpoints nuevos creados
- ✅ Motor de ciclo funcional
- ✅ Progresión automática por microciclo
- ✅ Deload automático
- ✅ Selección inteligente de ejercicios
- ✅ Integración con funciones SQL

**Próximo paso**: Modificar frontend para usar estos endpoints.
