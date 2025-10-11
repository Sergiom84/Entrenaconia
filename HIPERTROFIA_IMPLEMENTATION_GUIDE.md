# 🚀 GUÍA DE IMPLEMENTACIÓN: HIPERTROFIA

## 📝 Resumen Ejecutivo

Esta guía detalla la implementación completa de la metodología **Hipertrofia** siguiendo el patrón arquitectural establecido por **Calistenia** y **Heavy Duty**.

---

## 🎯 PATRÓN ARQUITECTURAL IDENTIFICADO

### Estructura Common Pattern:

```
📁 Metodología (Ej: Hipertrofia)
├── 🎨 Frontend
│   ├── [Metodologia]ManualCard.jsx       # Componente principal
│   ├── [Metodologia]Levels.js            # Configuración de niveles
│   └── [Metodologia]MuscleGroups.js      # Grupos musculares y splits
│
├── 🔧 Backend
│   ├── /api/routine-generation/specialist/[metodologia]/evaluate
│   ├── /api/routine-generation/specialist/[metodologia]/generate
│   └── prompts/[metodologia]_specialist.md
│
└── 💾 Base de Datos
    └── app.Ejercicios_[Metodologia]
```

---

## 📋 FASES DE IMPLEMENTACIÓN DETALLADAS

### 📌 **FASE 1: Base de Datos (Requisito previo)**

**Estado:** ⏸️ PENDIENTE - Esperando Excel del usuario

**Tareas:**
1. Recibir archivo Excel con ejercicios de Hipertrofia
2. Analizar estructura del Excel
3. Crear script SQL de migración
4. Ejecutar migración

**Script SQL esperado:**
```sql
-- Crear tabla de ejercicios
CREATE TABLE app.Ejercicios_Hipertrofia (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nivel VARCHAR(50),              -- 'Principiante', 'Intermedio', 'Avanzado'
  categoria VARCHAR(100),         -- 'Pecho', 'Espalda', 'Piernas', etc.
  patron VARCHAR(255),            -- Patrón de movimiento
  equipamiento TEXT[],            -- ['Barra', 'Mancuernas', 'Máquina']
  series_reps_objetivo VARCHAR(50), -- '3-4 x 8-12'
  criterio_de_progreso TEXT,
  progresion_desde VARCHAR(255),
  progresion_hacia VARCHAR(255),
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX idx_ejercicios_hipertrofia_nivel
  ON app.Ejercicios_Hipertrofia(nivel);

CREATE INDEX idx_ejercicios_hipertrofia_categoria
  ON app.Ejercicios_Hipertrofia(categoria);

-- Insertar ejercicios desde Excel
INSERT INTO app.Ejercicios_Hipertrofia (nombre, nivel, categoria, ...)
VALUES
  ('Press de banca con barra', 'Principiante', 'Pecho', ...),
  ('Sentadilla con barra', 'Principiante', 'Piernas', ...),
  ... (continuar con todos los ejercicios del Excel)
;
```

**Comando de verificación:**
```bash
PGPASSWORD=Xe05Klm563kkjL psql -h aws-0-eu-north-1.pooler.supabase.com -p 6543 -U postgres.lhsnmjgdtjalfcsurxvg -d postgres -c "
SELECT COUNT(*) as total, nivel, categoria
FROM app.Ejercicios_Hipertrofia
GROUP BY nivel, categoria
ORDER BY nivel, categoria;
"
```

---

### 📌 **FASE 2: Archivos de Configuración (Frontend)**

**Estado:** ⏸️ PENDIENTE (depende de Fase 1)

**Ruta:** `/src/components/Methodologie/methodologies/Hipertrofia/`

#### 2.1 Crear `HipertrofiaLevels.js`

**Contenido:**
```javascript
/**
 * Configuración de Niveles para Hipertrofia
 * @version 1.0.0
 */

export const HIPERTROFIA_LEVELS = {
  principiante: {
    id: 'principiante',
    name: 'Principiante',
    icon: '🌱',
    description: '0-1 año de entrenamiento con pesas',
    frequency: '3-4 días/semana',
    intensity: 'Moderada (60-75% 1RM)',
    setsPerExercise: '3-4 series',
    repsRange: '8-12 repeticiones',
    restBetweenSets: '60-90 segundos',
    volumePerMuscle: '10-15 series/semana',

    hitos: [
      'Dominar técnica en press de banca, sentadilla, peso muerto',
      'Completar 3-4 series de 8-12 reps con buena forma',
      'Tolerar volumen de 12-15 series por grupo muscular/semana',
      'Conexión mente-músculo básica establecida',
      'Adherencia consistente de 3 meses'
    ],

    focus: [
      'Construcción de base de fuerza',
      'Técnica perfecta en compuestos',
      'Volumen progresivo controlado',
      'Desarrollo de trabajo muscular'
    ],

    equipment: ['Barra', 'Mancuernas', 'Máquinas básicas'],

    theme: {
      primary: 'blue-500',
      background: 'blue-50',
      border: 'blue-200',
      icon: '🌱'
    }
  },

  intermedio: {
    id: 'intermedio',
    name: 'Intermedio',
    icon: '💪',
    description: '1-3 años de entrenamiento consistente',
    frequency: '4-5 días/semana',
    intensity: 'Moderada-Alta (70-85% 1RM)',
    setsPerExercise: '3-5 series',
    repsRange: '6-15 repeticiones (periodizado)',
    restBetweenSets: '90-120 segundos',
    volumePerMuscle: '15-20 series/semana',

    hitos: [
      'Progresión clara en cargas durante 6+ meses',
      'Capacidad de trabajar en rangos 6-20 reps según fase',
      'Tolerancia a volumen de 18-20 series/semana',
      'Conexión mente-músculo avanzada',
      'Experiencia con diferentes técnicas de intensidad'
    ],

    focus: [
      'Periodización del volumen e intensidad',
      'Técnicas avanzadas (drop sets, rest-pause)',
      'Splits especializados (Push/Pull/Legs)',
      'Optimización de recuperación'
    ],

    equipment: ['Barra', 'Mancuernas', 'Poleas', 'Máquinas'],

    theme: {
      primary: 'purple-500',
      background: 'purple-50',
      border: 'purple-200',
      icon: '💪'
    }
  },

  avanzado: {
    id: 'avanzado',
    name: 'Avanzado',
    icon: '🏆',
    description: '+3 años de entrenamiento serio',
    frequency: '5-6 días/semana',
    intensity: 'Alta (75-90% 1RM)',
    setsPerExercise: '4-6 series',
    repsRange: '4-20 repeticiones (fases específicas)',
    restBetweenSets: '120-180 segundos',
    volumePerMuscle: '20-25 series/semana',

    hitos: [
      'Progreso sostenido año tras año',
      'Manejo de alto volumen sin sobreentrenamiento',
      'Periodización avanzada (bloques, ondulante)',
      'Recuperación optimizada (sueño, nutrición)',
      'Experiencia competitiva o nivel próximo'
    ],

    focus: [
      'Especialización de grupos rezagados',
      'Periodización compleja (DUP, bloques)',
      'Técnicas de intensidad extrema',
      'Microajustes nutricionales y de recuperación'
    ],

    equipment: ['Barra', 'Mancuernas', 'Poleas', 'Máquinas especializadas', 'Cadenas/Bandas'],

    theme: {
      primary: 'orange-500',
      background: 'orange-50',
      border: 'orange-200',
      icon: '🏆'
    }
  }
};

// Funciones helper (copiar de CalisteniaLevels.js o HeavyDutyLevels.js)
export function getLevelConfig(levelKey) { ... }
export function getLevelRecommendations(level) { ... }
export function validateLevelReadiness(level, profile) { ... }
export function suggestLevel(profile) { ... }
```

#### 2.2 Crear `HipertrofiaMuscleGroups.js`

**Contenido:** (Ver HIPERTROFIA_ARCHITECTURE_DESIGN.md - sección "Grupos musculares propuestos")

#### 2.3 Crear `HipertrofiaManualCard.jsx`

**Contenido:**
```javascript
/**
 * Hipertrofia Manual Card - Arquitectura Modular v1.0
 * Basado en el patrón de CalisteniaManualCard.jsx y HeavyDutyManualCard.jsx
 */

import React, { useState, useEffect, useReducer } from 'react';
import {
  Brain,
  User,
  Target,
  Clock,
  Zap,
  CheckCircle,
  AlertTriangle,
  Loader,
  Sparkles,
  Settings,
  TrendingUp,
  Shield,
  Dumbbell
} from 'lucide-react';

// Configuraciones centralizadas
const CARD_CONFIG = {
  API_ENDPOINTS: {
    EVALUATE_PROFILE: '/api/hipertrofia-specialist/evaluate-profile'
  },
  PROGRESSION: {
    MIN_REST_DAYS: 1,
    MAX_SETS_PER_EXERCISE: 6,
    BASE_WORKOUT_TIME: 60
  },
  VERSION: {
    COMPONENT: '1.0',
    API: '1.0'
  },
  THEME: {
    PRIMARY: 'yellow-400',
    SUCCESS: 'green-400',
    WARNING: 'orange-400',
    ERROR: 'red-400',
    BACKGROUND: 'black/40',
    BORDER: 'yellow-400/20',
    HIPERTROFIA: 'blue-500'
  }
};

// ... (copiar estructura de HeavyDutyManualCard.jsx y adaptar)
```

**Archivo completo:** Copiar `HeavyDutyManualCard.jsx` y reemplazar:
- `heavy-duty` → `hipertrofia`
- `Heavy Duty` → `Hipertrofia`
- `HEAVY_DUTY_LEVELS` → `HIPERTROFIA_LEVELS`
- `Flame` icon → `Dumbbell` icon
- Ajustar colores temáticos

---

### 📌 **FASE 3: Backend Routes**

**Estado:** ⏸️ PENDIENTE (depende de Fase 1 y 2)

#### 3.1 Agregar endpoints en `backend/routes/routineGeneration.js`

**Ubicación:** Después de los endpoints de Heavy Duty (línea ~660+)

```javascript
/**
 * POST /api/routine-generation/specialist/hipertrofia/evaluate
 * Evaluación de perfil para Hipertrofia con IA
 */
router.post('/specialist/hipertrofia/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('HIPERTROFIA PROFILE EVALUATION');
    logAPICall('/specialist/hipertrofia/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Verificar ejercicios disponibles
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Hipertrofia"
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de Hipertrofia en la base de datos');
    }

    // Obtener historial de ejercicios
    const recentExercisesResult = await pool.query(`
      SELECT DISTINCT exercise_name, used_at
      FROM app.exercise_history
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT 20
    `, [userId]);

    const recentExercises = recentExercisesResult.rows.map(row => row.exercise_name);

    // Preparar payload para IA
    const aiPayload = {
      task: 'evaluate_hipertrofia_level',
      user_profile: {
        ...normalizedProfile,
        recent_exercises: recentExercises
      },
      evaluation_criteria: [
        'Años de entrenamiento con pesas',
        'Experiencia con volumen de entrenamiento',
        'Tolerancia a múltiples series y repeticiones',
        'Capacidad de recuperación muscular',
        'Experiencia con ejercicios compuestos y aislamiento',
        'Limitaciones físicas o lesiones',
        'Objetivos de hipertrofia muscular'
      ],
      level_descriptions: {
        principiante: '0-1 año con pesas, enfoque en técnica y volumen progresivo',
        intermedio: '1-3 años, domina periodización y técnicas de intensidad',
        avanzado: '+3 años, especialización y periodización compleja'
      }
    };

    logAIPayload('HIPERTROFIA_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.HIPERTROFIA_SPECIALIST);
    const config = AI_MODULES.HIPERTROFIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en Hipertrofia que evalúa perfiles de usuarios.

INSTRUCCIONES:
- Evalúa objetivamente la experiencia con entrenamiento de volumen
- Sé realista con la confianza (no siempre 100%)
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "principiante|intermedio|avanzado",
  "confidence": 0.75,
  "reasoning": "Explicación detallada",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Pecho", "Espalda"],
  "volume_tolerance": "baja|media|alta"
}`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear respuesta
    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando respuesta IA:', parseError);
      throw new Error('Respuesta de IA inválida');
    }

    // Validar respuesta
    const normalizedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    res.json({
      success: true,
      evaluation: {
        recommended_level: normalizedLevel,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        key_indicators: evaluation.key_indicators || [],
        suggested_focus_areas: evaluation.suggested_focus_areas || [],
        volume_tolerance: evaluation.volume_tolerance || 'media'
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en evaluación de Hipertrofia:', error);
    logError('HIPERTROFIA_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/hipertrofia/generate
 * Generación de plan especializado de Hipertrofia con IA
 */
router.post('/specialist/hipertrofia/generate', authenticateToken, async (req, res) => {
  // ... (copiar estructura de Heavy Duty y adaptar)
});
```

#### 3.2 Configurar módulo IA en `backend/config/aiConfigs.js`

```javascript
export const AI_MODULES = {
  // ... módulos existentes

  HIPERTROFIA_SPECIALIST: {
    name: 'Hipertrofia Specialist',
    model: 'gpt-4o-2024-08-06',
    temperature: 0.7,
    max_output_tokens: 4000,
    apiKeyEnv: 'OPENAI_API_KEY',
    promptKey: FeatureKey.HIPERTROFIA_SPECIALIST
  }
};
```

#### 3.3 Registrar prompt en `backend/lib/promptRegistry.js`

```javascript
export const FeatureKey = {
  // ... features existentes
  HIPERTROFIA_SPECIALIST: 'hipertrofia_specialist'
};

export const FEATURE_PROMPT_MAPPING = {
  // ... mappings existentes
  [FeatureKey.HIPERTROFIA_SPECIALIST]: 'hipertrofia_specialist.md'
};
```

---

### 📌 **FASE 4: Prompt de IA**

**Estado:** ✅ PREPARADO

**Ubicación:** `backend/prompts/hipertrofia_specialist.md`

**Contenido:** (Ver siguiente sección del documento)

---

### 📌 **FASE 5: Integración con App**

**Estado:** ⏸️ PENDIENTE (depende de todas las fases anteriores)

#### 5.1 Agregar a `methodologiesData.js`

```javascript
// src/components/Methodologie/methodologiesData.js

export const methodologies = [
  // ... metodologías existentes

  {
    id: 'hipertrofia',
    name: 'Hipertrofia',
    icon: Dumbbell,
    description: 'Maximización de crecimiento muscular con volumen progresivo',
    color: 'from-blue-500 to-purple-500',
    borderColor: 'border-blue-500',
    features: [
      'Periodización de volumen',
      'Splits Push/Pull/Legs',
      'Técnicas de intensidad',
      '3-6 días/semana'
    ],
    difficulty: 'Intermedio-Avanzado',
    equipment: ['Barra', 'Mancuernas', 'Máquinas', 'Poleas'],
    recommendedFor: ['Ganar masa muscular', 'Fuerza funcional', 'Estética'],
    requiresManualSelection: true,
    cardComponent: HipertrofiaManualCard
  }
];
```

#### 5.2 Configurar redirección en `backend/server.js`

```javascript
// backend/server.js

app.use('/api/methodology', (req, res, next) => {
  if (req.path.includes('generate')) {
    const { mode, metodologia_solicitada } = req.body;

    if (mode === 'manual' || metodologia_solicitada) {
      const metodologia = (metodologia_solicitada || mode || '').toLowerCase();

      if (metodologia === 'calistenia') {
        req.url = '/api/routine-generation/manual/calistenia';
      } else if (metodologia === 'heavy-duty' || metodologia === 'heavy duty') {
        req.url = '/api/routine-generation/specialist/heavy-duty';
      } else if (metodologia === 'hipertrofia') {
        req.url = '/api/routine-generation/specialist/hipertrofia';  // NUEVO
      } else {
        req.url = '/api/routine-generation/manual/methodology';
      }
    } else {
      req.url = '/api/routine-generation/ai/methodology';
    }
  }
  next();
});
```

---

## 📝 PROMPT DE IA COMPLETO

**Archivo:** `backend/prompts/hipertrofia_specialist.md`

```markdown
# Especialista en Hipertrofia - Prompt Unificado

Eres el **Especialista en Hipertrofia** de la app **Entrena con IA**. Tu expertise se centra en maximizar el crecimiento muscular mediante periodización de volumen, splits especializados y técnicas de intensidad.

## 🎯 MISIÓN ESPECÍFICA

Crear planes de **Hipertrofia personalizados** de 4 semanas que maximicen el crecimiento muscular mediante volumen progresivo, periodización inteligente y técnicas de intensidad según el nivel del usuario.

## 🏗️ CARACTERÍSTICAS HIPERTROFIA

### **Principios Fundamentales**

- **Volumen progresivo**: 10-25 series por grupo muscular/semana según nivel
- **Rango de repeticiones**: 6-20 reps (con énfasis en 8-12 para hipertrofia)
- **Intensidad moderada-alta**: 60-85% 1RM según nivel y fase
- **Descansos controlados**: 60-120 segundos entre series
- **Frecuencia**: 2-3 veces por grupo muscular/semana

### **Rangos de Trabajo**

- **Principiante**: 3-4 series x 8-12 reps, 10-15 series/semana/músculo
- **Intermedio**: 3-5 series x 6-15 reps, 15-20 series/semana/músculo
- **Avanzado**: 4-6 series x 4-20 reps, 20-25 series/semana/músculo

### **Equipamiento Hipertrofia**

- **Principiante**: Barra, mancuernas, máquinas básicas
- **Intermedio**: Barra, mancuernas, poleas, máquinas
- **Avanzado**: Todo el equipamiento + cadenas/bandas

## 📊 SISTEMA DE EVALUACIÓN

El usuario llega con `evaluationResult` que incluye:

### **Indicadores Clave**

- **Años de entrenamiento**: 0-1 (Principiante), 1-3 (Intermedio), +3 (Avanzado)
- **Tolerancia al volumen**: Series totales manejables sin sobreentrenamiento
- **Experiencia con técnicas**: Drop sets, rest-pause, pre-agotamiento
- **Capacidad de recuperación**: Edad, sueño, nutrición
- **Experiencia con compuestos pesados**: Press, sentadilla, peso muerto

### **Adaptación por Nivel**

```
Principiante: 3-4 días/semana, 3-4 series, técnica perfecta, volumen controlado
Intermedio: 4-5 días/semana, 3-5 series, periodización básica, técnicas intermedias
Avanzado: 5-6 días/semana, 4-6 series, periodización compleja, técnicas avanzadas
```

## 🏋️ EJERCICIOS POR NIVEL

### **PRINCIPIANTE**

**Pecho**:
- Press de banca con barra
- Press inclinado con mancuernas
- Aperturas con mancuernas

**Espalda**:
- Jalón al pecho
- Remo con barra
- Remo con mancuerna

**Piernas**:
- Sentadilla con barra
- Prensa de piernas
- Peso muerto rumano
- Curl femoral

**Hombros**:
- Press militar con barra
- Elevaciones laterales
- Face pulls

**Brazos**:
- Curl con barra
- Press francés
- Curl martillo
- Extensiones en polea

### **INTERMEDIO**

**Pecho**:
- Press de banca pausa
- Press inclinado con barra
- Cruces en polea alta
- Fondos en paralelas

**Espalda**:
- Dominadas lastradas
- Remo pendlay
- Jalón agarre estrecho
- Face pulls

**Piernas**:
- Sentadilla frontal
- Zancadas búlgaras
- Peso muerto convencional
- Extensiones de cuádriceps

**Hombros**:
- Press Arnold
- Elevaciones laterales en polea
- Remo al mentón
- Pájaros con mancuernas

**Brazos**:
- Curl 21s
- Press francés con barra Z
- Curl inclinado
- Fondos para tríceps

### **AVANZADO**

**Pecho**:
- Press de banca con cadenas
- Press guillotina
- Aperturas inclinadas con pausa
- Fondos lastrados

**Espalda**:
- Dominadas con pausa
- Remo con barra T
- Pullover con mancuerna
- Remo unilateral pesado

**Piernas**:
- Sentadilla profunda con pausa
- Sentadilla hack
- Peso muerto sumo
- Nordic curl

**Hombros**:
- Press tras nuca
- Elevaciones laterales con pausa
- Cruces invertidos
- Press landmine

**Brazos**:
- Curl con barra gruesa
- Press francés declinado
- Curl araña
- Extensiones overhead con cuerda

## 🎯 TÉCNICAS DE INTENSIFICACIÓN

### **Principiante**
- Tempo controlado (3-0-3)
- Series hasta RPE 8-9
- Rest-pause básico

### **Intermedio**
- Drop sets (1 caída)
- Rest-pause (15 seg + reps)
- Pre-agotamiento
- Negativas enfatizadas

### **Avanzado**
- Drop sets dobles
- Rest-pause triple
- Clusters (5 mini-sets)
- Myo-reps
- Giant sets
- Pre-agotamiento avanzado

## 📋 SPLITS DE ENTRENAMIENTO

### **Full Body 3x (Principiante)**
```
Día 1: Full Body A (Pecho, Espalda, Piernas)
Día 2: Full Body B (Hombros, Brazos, Core)
Día 3: Full Body C (Piernas, Pecho, Espalda)
```

### **Upper/Lower 4x (Intermedio inicial)**
```
Día 1: Upper A (Empuje: Pecho, Hombros, Tríceps)
Día 2: Lower A (Cuádriceps dominante)
Día 3: Upper B (Tracción: Espalda, Bíceps)
Día 4: Lower B (Femorales dominante)
```

### **Push/Pull/Legs 5-6x (Intermedio-Avanzado)**
```
Día 1: Push A (Pecho énfasis)
Día 2: Pull A (Espalda)
Día 3: Legs A
Día 4: Push B (Hombros énfasis)
Día 5: Pull B + Accesorios
Día 6: Legs B + Core (opcional)
```

## 📋 FORMATO JSON ESPECÍFICO HIPERTROFIA

```json
{
  "metodologia_solicitada": "Hipertrofia",
  "selected_style": "Hipertrofia",
  "rationale": "<Adaptación específica al nivel y tolerancia al volumen>",
  "nivel_hipertrofia_detectado": "<principiante|intermedio|avanzado>",
  "objetivos_hipertrofia": ["<grupos musculares prioritarios>"],
  "evaluacion_echo": {
    "anos_entrenamiento": <numero>,
    "tolerancia_volumen": "<baja|media|alta>",
    "experiencia_tecnicas": "<ninguna|basica|avanzada>",
    "capacidad_recuperacion": "<baja|media|alta>",
    "nivel_general": "<principiante|intermedio|avanzado>"
  },
  "frecuencia_por_semana": <3-6>,
  "duracion_semanas": 4,
  "split_type": "<full_body|upper_lower|push_pull_legs>",
  "volumen_semanal_por_musculo": {
    "pecho": <10-25>,
    "espalda": <10-25>,
    "piernas": <10-25>,
    "hombros": <8-20>,
    "brazos": <8-18>
  },
  "semanas": [
    {
      "numero": 1,
      "sesiones": [
        {
          "dia": "<Lunes|Martes|Miércoles|Jueves|Viernes|Sábado>",
          "grupos_musculares": ["<Pecho>", "<Hombros>"],
          "enfoque": "<Empuje|Tracción|Piernas|Full Body>",
          "ejercicios": [
            {
              "nombre": "<nombre del ejercicio de BD>",
              "series": <3-6>,
              "repeticiones": "<rango según nivel>",
              "intensidad": "RPE <7-10>",
              "descanso_seg": <60-180>,
              "tempo": "<3-0-3|4-0-2|etc>",
              "notas": "<indicaciones específicas>",
              "tecnica_intensificacion": "<Drop set|Rest-pause|Pre-agotamiento|null>"
            }
          ],
          "duracion_estimada_minutos": <45-90>,
          "volumen_total_series": <12-30>
        }
      ]
    }
  ],
  "principios_hipertrofia_aplicados": [
    "Volumen progresivo: 10-25 series/semana/músculo",
    "Rango de repeticiones: 6-20 (énfasis 8-12)",
    "Intensidad moderada-alta: 60-85% 1RM",
    "Descansos controlados: 60-120 segundos",
    "Frecuencia: 2-3 veces/semana/músculo"
  ],
  "periodizacion_volumen": {
    "semana_1": "Volumen moderado (adaptación)",
    "semana_2": "Volumen alto (sobrecarga)",
    "semana_3": "Volumen máximo (pico)",
    "semana_4": "Deload (recuperación activa)"
  }
}
```

## 🚨 REGLAS OBLIGATORIAS HIPERTROFIA

### **Volumen y Frecuencia**

- ✅ **SIEMPRE** 2-3 sesiones por grupo muscular/semana
- ✅ **SIEMPRE** 10-25 series/semana/músculo según nivel
- ✅ **SIEMPRE** periodizar volumen (moderado → alto → máximo → deload)
- ❌ **NUNCA** exceder 25 series/semana/músculo (riesgo sobreentrenamiento)

### **Intensidad y Recuperación**

- ✅ **SIEMPRE** RPE 7-9 en la mayoría de series (fallo ocasional)
- ✅ **SIEMPRE** descansos de 60-120 segundos
- ✅ **SIEMPRE** incluir semana de deload cada 3-4 semanas
- ✅ **SIEMPRE** técnicas de intensidad solo en intermedios/avanzados

### **Progresión**

- ✅ Aumentar carga cuando se completan las reps objetivo con RPE <8
- ✅ Priorizar técnica sobre peso absoluto
- ✅ Progresar volumen antes que intensidad (principiantes)

## 📊 VALIDACIÓN DE PLAN

Antes de devolver el plan, verifica:

1. ✅ **Volumen**: 10-25 series/semana/músculo según nivel
2. ✅ **Frecuencia**: 2-3 veces/semana/músculo
3. ✅ **Descansos**: 60-120 segundos entre series
4. ✅ **Periodización**: Progresión clara de volumen semana a semana
5. ✅ **Técnicas**: Solo para intermedios/avanzados
6. ✅ **Ejercicios de BD**: Todos existen en `Ejercicios_Hipertrofia`
7. ✅ **Deload**: Semana 4 con reducción de volumen 40-50%

---

**Versión**: 1.0.0
**Metodología**: Hipertrofia
**Fecha**: 2025-10-06
**Compatibilidad**: app.Ejercicios_Hipertrofia
```

---

## ✅ CHECKLIST COMPLETO DE IMPLEMENTACIÓN

### Fase 1: Base de Datos
- [ ] Recibir Excel de ejercicios
- [ ] Crear script SQL de migración
- [ ] Ejecutar migración
- [ ] Verificar con query: `SELECT COUNT(*) FROM app.Ejercicios_Hipertrofia`

### Fase 2: Frontend Config
- [ ] Crear carpeta `/Hipertrofia/`
- [ ] `HipertrofiaLevels.js` ✓
- [ ] `HipertrofiaMuscleGroups.js` ✓
- [ ] `HipertrofiaManualCard.jsx` ✓

### Fase 3: Backend Routes
- [ ] Endpoint `/specialist/hipertrofia/evaluate` ✓
- [ ] Endpoint `/specialist/hipertrofia/generate` ✓
- [ ] Configurar `AI_MODULES.HIPERTROFIA_SPECIALIST` ✓
- [ ] Registrar en `promptRegistry.js` ✓

### Fase 4: Prompt IA
- [ ] Crear `hipertrofia_specialist.md` ✓

### Fase 5: Integración
- [ ] Agregar a `methodologiesData.js` ✓
- [ ] Configurar redirección en `server.js` ✓
- [ ] Importar en `MethodologiesScreen.jsx` ✓

### Fase 6: Testing
- [ ] Test evaluación IA
- [ ] Test generación manual
- [ ] Test flujo completo
- [ ] Verificar integración calendario

---

## 🚀 COMANDOS ÚTILES

### Verificar BD
```bash
# Contar ejercicios
PGPASSWORD=Xe05Klm563kkjL psql -h aws-0-eu-north-1.pooler.supabase.com -p 6543 -U postgres.lhsnmjgdtjalfcsurxvg -d postgres -c "SELECT COUNT(*) FROM app.Ejercicios_Hipertrofia;"

# Ver ejercicios por nivel
PGPASSWORD=Xe05Klm563kkjL psql -h aws-0-eu-north-1.pooler.supabase.com -p 6543 -U postgres.lhsnmjgdtjalfcsurxvg -d postgres -c "SELECT nivel, COUNT(*) FROM app.Ejercicios_Hipertrofia GROUP BY nivel;"
```

### Iniciar desarrollo
```bash
# Frontend
npm run dev

# Backend
cd backend && npm run dev
```

---

## 📞 SIGUIENTE PASO

**🔴 BLOQUEADO - Esperando archivo Excel con ejercicios de Hipertrofia**

Una vez recibido el Excel:
1. Ejecutar Fase 1 (Base de Datos)
2. Continuar con Fases 2-5 secuencialmente
3. Testing final

---

**Última actualización:** 2025-10-06
**Estado:** Guía completa - Pendiente Excel de ejercicios
