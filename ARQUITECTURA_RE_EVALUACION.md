# 🏗️ Arquitectura del Sistema de Re-evaluación Progresiva

## 📊 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  WorkoutContext (Estado Global)                                │      │
│  │  ┌──────────────────────────────────────────────────────────┐ │      │
│  │  │  reEvaluation: {                                         │ │      │
│  │  │    shouldTrigger: false,                                 │ │      │
│  │  │    currentWeek: 1,                                       │ │      │
│  │  │    weeksSinceLastEval: 0                                 │ │      │
│  │  │  }                                                       │ │      │
│  │  │  ui: { showReEvaluation: false }                        │ │      │
│  │  └──────────────────────────────────────────────────────────┘ │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                                                           │
│  ┌───────────────────────────┐  ┌────────────────────────────────┐      │
│  │ ReEvaluationModal.jsx     │  │ ReEvaluationConfig.jsx         │      │
│  │ ┌───────────────────────┐ │  │ ┌────────────────────────────┐ │      │
│  │ │ Universal Modal       │ │  │ │ User Configuration UI      │ │      │
│  │ │ - Loads form registry │ │  │ │ - Frequency selection      │ │      │
│  │ │ - Handles submission  │ │  │ │ - Notifications toggle     │ │      │
│  │ │ - Shows AI feedback   │ │  │ │ - Save/Reset buttons       │ │      │
│  │ └───────────────────────┘ │  │ └────────────────────────────┘ │      │
│  │           ↓               │  │           ↓                    │      │
│  │ ┌───────────────────────┐ │  │ API Calls:                     │      │
│  │ │ FORMS_REGISTRY        │ │  │ GET  /api/progress/config      │      │
│  │ │ ├─ CalisteniaReEvalForm│ │  │ PUT  /api/progress/config      │      │
│  │ │ ├─ HipertrofiaReEvalForm│ │  └────────────────────────────────┘      │
│  │ │ └─ GenericReEvalForm   │ │                                         │
│  │ └───────────────────────┘ │                                         │
│  └───────────────────────────┘                                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  API Layer (src/components/routines/api.js)                      │    │
│  │  ├─ shouldTriggerReEvaluation({ methodologyPlanId, currentWeek })│    │
│  │  ├─ submitReEvaluation({ methodology, exercises, sentiment })    │    │
│  │  ├─ getKeyExercisesForReEvaluation({ methodologyPlanId, week })  │    │
│  │  └─ getReEvaluationHistory({ methodologyPlanId })                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ HTTP (Bearer Token Auth)
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express.js)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Routes (backend/routes/progressReEvaluation.js)                 │    │
│  │                                                                   │    │
│  │  POST   /api/progress/re-evaluation                              │    │
│  │  ├─ Valida datos                                                 │    │
│  │  ├─ Guarda en DB (user_re_evaluations + re_evaluation_exercises)│    │
│  │  ├─ Llama a AI Re-evaluator                                      │    │
│  │  └─ Guarda sugerencias (ai_adjustment_suggestions)               │    │
│  │                                                                   │    │
│  │  GET    /api/progress/should-trigger                             │    │
│  │  └─ Llama a SQL function should_trigger_re_evaluation()          │    │
│  │                                                                   │    │
│  │  GET    /api/progress/key-exercises                              │    │
│  │  └─ Extrae ejercicios clave de la semana del plan                │    │
│  │                                                                   │    │
│  │  GET    /api/progress/re-evaluation-history                      │    │
│  │  └─ Consulta vista v_re_evaluation_history                       │    │
│  │                                                                   │    │
│  │  GET    /api/progress/config        ← ⭐ FASE 2                  │    │
│  │  └─ Lee configuración del usuario (crea default si no existe)    │    │
│  │                                                                   │    │
│  │  PUT    /api/progress/config        ← ⭐ FASE 2                  │    │
│  │  └─ Actualiza configuración (UPSERT)                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  AI Re-Evaluators (backend/lib/aiReEvaluators/)                  │    │
│  │                                                                   │    │
│  │  RE_EVALUATORS_REGISTRY:                                         │    │
│  │  ├─ calisteniaReEvaluator.js                                     │    │
│  │  │  └─ analyze({ currentPlan, userData, reEvaluationData })      │    │
│  │  │     ├─ Llama a GPT-4o con prompt especializado                │    │
│  │  │     └─ Retorna: progress_assessment, adjustments, feedback    │    │
│  │  │                                                                │    │
│  │  ├─ hipertrofiaReEvaluator.js (Fase 3)                           │    │
│  │  ├─ crossfitReEvaluator.js (Fase 3)                              │    │
│  │  └─ genericReEvaluator.js (Fallback sin IA)                      │    │
│  │                                                                   │    │
│  │  getReEvaluatorForMethodology(methodology) → Returns evaluator   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ SQL Queries
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (PostgreSQL/Supabase)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TABLAS (Schema: app)                                            │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │  user_re_evaluations                                       │  │    │
│  │  │  ├─ id                                                      │  │    │
│  │  │  ├─ user_id                                                 │  │    │
│  │  │  ├─ methodology_plan_id                                     │  │    │
│  │  │  ├─ week_number                                             │  │    │
│  │  │  ├─ sentiment (excelente, bien, regular, dificil...)        │  │    │
│  │  │  ├─ overall_comment                                         │  │    │
│  │  │  └─ created_at                                              │  │    │
│  │  │  UNIQUE(methodology_plan_id, week_number)                   │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │  re_evaluation_exercises                                   │  │    │
│  │  │  ├─ id                                                      │  │    │
│  │  │  ├─ re_evaluation_id (FK)                                   │  │    │
│  │  │  ├─ exercise_name                                           │  │    │
│  │  │  ├─ series_achieved                                         │  │    │
│  │  │  ├─ reps_achieved                                           │  │    │
│  │  │  ├─ weight_kg (si aplica)                                   │  │    │
│  │  │  ├─ difficulty_rating (facil, adecuado, dificil)            │  │    │
│  │  │  └─ notes                                                   │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │  ai_adjustment_suggestions                                 │  │    │
│  │  │  ├─ id                                                      │  │    │
│  │  │  ├─ re_evaluation_id (FK)                                   │  │    │
│  │  │  ├─ progress_assessment (progressing, stalled, regressing)  │  │    │
│  │  │  ├─ intensity_change (+10%, -10%, maintain)                 │  │    │
│  │  │  ├─ volume_change (+5%, -5%, maintain)                      │  │    │
│  │  │  ├─ rest_modifications (increase, decrease, maintain)       │  │    │
│  │  │  ├─ suggested_progressions (JSONB)                          │  │    │
│  │  │  ├─ ai_reasoning (TEXT)                                     │  │    │
│  │  │  ├─ motivational_feedback (TEXT)                            │  │    │
│  │  │  ├─ warnings (TEXT[])                                       │  │    │
│  │  │  ├─ applied (BOOLEAN)                                       │  │    │
│  │  │  └─ applied_at                                              │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │  user_re_eval_config                ← ⭐ FASE 2             │  │    │
│  │  │  ├─ user_id (PK, FK)                                        │  │    │
│  │  │  ├─ frequency_weeks (2-12, default 3)                       │  │    │
│  │  │  ├─ auto_apply_suggestions (default false)                  │  │    │
│  │  │  ├─ notification_enabled (default true)                     │  │    │
│  │  │  ├─ reminder_days_before (default 1)                        │  │    │
│  │  │  ├─ updated_at                                              │  │    │
│  │  │  └─ created_at                                              │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  VISTAS                                                          │    │
│  │                                                                   │    │
│  │  v_re_evaluation_history                                         │    │
│  │  └─ Consolidación de re-evaluaciones con métricas agregadas     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  FUNCIONES SQL                                                   │    │
│  │                                                                   │    │
│  │  should_trigger_re_evaluation(user_id, plan_id, current_week)   │    │
│  │  ├─ Lee frequency_weeks de user_re_eval_config                  │    │
│  │  ├─ Calcula semanas desde última evaluación                     │    │
│  │  └─ Retorna BOOLEAN (true si debe triggerear)                   │    │
│  │                                                                   │    │
│  │  get_last_re_evaluation(methodology_plan_id)                    │    │
│  │  └─ Retorna última evaluación con semanas transcurridas         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TRIGGERS                                                        │    │
│  │                                                                   │    │
│  │  trg_update_re_eval_config_timestamp                             │    │
│  │  └─ Actualiza updated_at automáticamente en UPDATE              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPENAI API (GPT-4o)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Calistenia Re-Evaluator Prompt:                                         │
│  ├─ System: "Eres un entrenador experto en Calistenia..."                │
│  ├─ User: "PLAN ACTUAL: {...}, RE-EVALUACIÓN: {...}"                     │
│  └─ Response Format: JSON puro con adjustments                           │
│                                                                           │
│  Retorna:                                                                 │
│  {                                                                        │
│    "progress_assessment": "progressing|stalled|regressing|excellent",    │
│    "suggested_adjustments": {                                            │
│      "intensity_change": "+10%",                                         │
│      "volume_change": "maintain",                                        │
│      "exercise_progressions": [                                          │
│        {                                                                 │
│          "exercise": "Pull-ups",                                         │
│          "current_level": "3x10",                                        │
│          "suggested_progression": "Weighted Pull-ups (+2.5kg)",          │
│          "reasoning": "Supera consistentemente 3x10"                     │
│        }                                                                 │
│      ]                                                                   │
│    },                                                                    │
│    "motivational_feedback": "...",                                       │
│    "warnings": [...],                                                    │
│    "reasoning": "..."                                                    │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo de Usuario Típico

### Escenario 1: Usuario en Semana 3 (Primera Re-evaluación)

```
1. Usuario completa sesión de entrenamiento (Semana 3, Día 5)
   ↓
2. Sistema verifica: should_trigger_re_evaluation(user_id, plan_id, 3)
   ↓ SQL Function consulta user_re_eval_config
   ↓ frequency_weeks = 3 (default)
   ↓ last_eval = NULL (nunca ha evaluado)
   ↓ current_week (3) >= frequency_weeks (3) → TRUE
   ↓
3. WorkoutContext actualiza: reEvaluation.shouldTrigger = true
   ↓
4. ReEvaluationModal se muestra
   ↓
5. Carga CalisteniaReEvalForm desde FORMS_REGISTRY
   ↓
6. Form carga ejercicios clave: GET /api/progress/key-exercises?week=3
   ↓
7. Usuario completa formulario:
   - Sentiment: "bien"
   - Pull-ups: 3 series, 8-9 reps, dificultad "adecuado"
   - Push-ups: 3 series, 12-15 reps, dificultad "facil"
   - Comentario: "Me siento más fuerte pero las pull-ups siguen costando"
   ↓
8. Usuario presiona "Enviar Evaluación"
   ↓
9. Frontend: POST /api/progress/re-evaluation
   {
     methodology: "calistenia",
     methodology_plan_id: 42,
     week: 3,
     sentiment: "bien",
     overall_comment: "Me siento más fuerte...",
     exercises: [...]
   }
   ↓
10. Backend (Transaction):
    ├─ INSERT INTO user_re_evaluations
    ├─ INSERT INTO re_evaluation_exercises (x2)
    ├─ Llama a calisteniaReEvaluator.analyze()
    │  └─ OpenAI GPT-4o analiza datos
    │     └─ Retorna sugerencias JSON
    └─ INSERT INTO ai_adjustment_suggestions
    ↓
11. Backend responde con sugerencias de IA
    ↓
12. Modal muestra feedback:
    ┌────────────────────────────────────────────────┐
    │ ✅ ¡Excelente progreso!                         │
    │                                                │
    │ Análisis: Progresando bien                    │
    │                                                │
    │ Sugerencias:                                   │
    │ • Pull-ups: Intenta 3x10 consistentemente     │
    │ • Push-ups: Progresa a Archer Push-ups        │
    │ • Mantén intensidad actual (+0%)              │
    │                                                │
    │ "Estás en el camino correcto. Las pull-ups    │
    │  mejorarán con el tiempo. Enfócate en técnica"│
    └────────────────────────────────────────────────┘
    ↓
13. Usuario cierra modal
    ↓
14. Sistema marca: last_re_evaluation_week = 3
    ↓
15. Próxima evaluación: Semana 6 (3 + frequency_weeks)
```

### Escenario 2: Usuario Configura Frecuencia

```
1. Usuario navega a Perfil → Configuración
   ↓
2. Abre ReEvaluationConfig component
   ↓
3. Component carga: GET /api/progress/config
   ↓ Si no existe config → Backend crea default automáticamente
   ↓ Si existe → Retorna config guardada
   ↓
4. Usuario ve opciones de frecuencia:
   [ ] Cada 2 semanas
   [✓] Cada 3 semanas ⭐ Recomendado
   [ ] Cada 4 semanas
   [ ] Cada 6 semanas
   [ ] Cada 8 semanas
   ↓
5. Usuario cambia a "Cada 4 semanas"
   ↓
6. Usuario activa notificaciones (toggle ON)
   ↓
7. Usuario presiona "Guardar cambios"
   ↓
8. Frontend: PUT /api/progress/config
   {
     frequency_weeks: 4,
     notification_enabled: true
   }
   ↓
9. Backend valida (1 <= 4 <= 12) ✓
   ↓
10. Backend ejecuta UPSERT:
    INSERT INTO user_re_eval_config ...
    ON CONFLICT (user_id)
    DO UPDATE SET frequency_weeks = 4, ...
    ↓
11. Trigger actualiza updated_at automáticamente
    ↓
12. Backend responde: { success: true, config: {...} }
    ↓
13. Frontend muestra: "✅ Configuración guardada correctamente"
    ↓
14. Próxima evaluación será cada 4 semanas en vez de 3
```

## 🎯 Puntos Clave de Escalabilidad

### 1. Registry Pattern
- **Frontend:** Añadir metodología = 1 línea en `FORMS_REGISTRY`
- **Backend:** Añadir metodología = 1 línea en `RE_EVALUATORS_REGISTRY`

### 2. Configuración por Usuario
- Cada usuario puede personalizar su frecuencia
- SQL function `should_trigger_re_evaluation()` respeta esta config

### 3. Arquitectura Modular
- **Modal universal** carga forms específicos dinámicamente
- **Re-evaluators** pueden tener lógica completamente diferente
- **Database schema** agnóstica a metodología (usa JSONB para flexibilidad)

### 4. Extensibilidad Futura
- Auto-aplicación de ajustes (UI preparada, backend ready)
- Notificaciones push (config ya existe)
- Análisis comparativo entre evaluaciones
- Gráficas de progreso histórico

## 📈 Métricas del Sistema

- **Tablas:** 4 (user_re_evaluations, re_evaluation_exercises, ai_adjustment_suggestions, user_re_eval_config)
- **Vistas:** 1 (v_re_evaluation_history)
- **Funciones SQL:** 2 (should_trigger, get_last)
- **Triggers:** 1 (updated_at automático)
- **Endpoints Backend:** 6 (re-evaluation, key-exercises, should-trigger, history, config GET/PUT)
- **Componentes React:** 3 (Modal, Config, Calistenia Form)
- **AI Evaluators:** 2 (calistenia, generic fallback)
- **Líneas de código total:** ~1200 (SQL + Backend + Frontend)

## ✅ Estado Actual

**Fase 1:** ✅ Completa (Calistenia functional)
**Fase 2:** ✅ Completa (User configuration system)
**Fase 3:** ⚪ Pendiente (Expandir a otras metodologías)

---

**Última actualización:** Enero 2025
