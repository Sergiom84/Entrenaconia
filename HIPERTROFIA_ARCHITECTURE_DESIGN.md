# 🏗️ ARQUITECTURA HIPERTROFIA - Diseño Completo

## 📋 ANÁLISIS COMPARATIVO DE PATRONES

### 🎯 Patrón Identificado: METODOLOGÍA ESPECIALIZADA

Tras analizar **Calistenia Manual** y **Heavy Duty**, he identificado un patrón arquitectural consistente y escalable:

---

## 📊 COMPARACIÓN ESTRUCTURAL

| Componente | Calistenia | Heavy Duty | Hipertrofia (Nuevo) |
|-----------|-----------|-----------|---------------------|
| **Card Frontend** | `CalisteniaManualCard.jsx` | `HeavyDutyManualCard.jsx` | `HipertrofiaManualCard.jsx` |
| **Niveles** | `CalisteniaLevels.js` | `HeavyDutyLevels.js` | `HipertrofiaLevels.js` |
| **Grupos Musculares** | `CalisteniaMuscleGroups.js` | `HeavyDutyMuscleGroups.js` | `HipertrofiaMuscleGroups.js` |
| **Ruta Evaluación** | `/specialist/calistenia/evaluate` | `/specialist/heavy-duty/evaluate` | `/specialist/hipertrofia/evaluate` |
| **Ruta Generación** | `/specialist/calistenia/generate` | `/specialist/heavy-duty/generate` | `/specialist/hipertrofia/generate` |
| **Tabla BD** | `Ejercicios_Calistenia` | `Ejercicios_Heavy_Duty` | `Ejercicios_Hipertrofia` |
| **Prompt IA** | Calistenia Specialist | `heavy_duty_specialist.md` | `hipertrofia_specialist.md` |

---

## 🧩 COMPONENTES DEL PATRÓN

### 1️⃣ **Frontend Card** (React Component)

**Responsabilidades:**
- Evaluación automática con IA (paso 1)
- Selección manual de nivel (paso 2)
- Configuración de grupos musculares
- Objetivos personalizados
- Generación de plan

**Estado compartido:**
```javascript
const initialState = {
  currentStep: 'evaluation',      // 'evaluation' | 'manual_selection'
  aiEvaluation: null,
  loadingEvaluation: false,
  evaluationError: null,
  selectedLevel: null,
  userGoals: '',
  selectedMuscleGroups: []
};
```

**Flujo de navegación:**
```
1. Auto-evaluación IA → Resultado + botón "Generar con IA"
2. Opción: "Elegir Manualmente" → Selección de nivel
3. Configuración de grupos musculares
4. Generación de plan → onGenerate(data)
```

---

### 2️⃣ **Niveles (Levels.js)**

**Estructura estándar:**
```javascript
export const METODOLOGIA_LEVELS = {
  nivel_1: {
    id: 'nivel_1',
    name: 'Nombre Nivel',
    icon: '🎯',
    description: 'Descripción del nivel',
    frequency: 'X días/semana',
    intensity: 'Rango de intensidad',
    duration: 'Duración por sesión',
    hitos: [
      'Hito 1',
      'Hito 2',
      'Hito 3'
    ],
    focus: ['Enfoque 1', 'Enfoque 2'],
    equipment: ['Equipo necesario'],
    theme: {
      primary: 'color-500',
      background: 'color-50',
      icon: '🎯'
    }
  }
};
```

**Funciones helper:**
- `getLevelConfig(levelKey)` - Obtener configuración
- `getLevelRecommendations(level)` - Parámetros de entrenamiento
- `validateLevelReadiness(level, profile)` - Validación
- `suggestLevel(profile)` - Sugerencia automática

---

### 3️⃣ **Grupos Musculares (MuscleGroups.js)**

**Estructura estándar:**
```javascript
export const METODOLOGIA_MUSCLE_GROUPS = {
  grupo_1: {
    id: 'grupo_1',
    name: 'Nombre Grupo',
    icon: '💪',
    description: 'Descripción',
    exercises: {
      nivel_1: ['Ejercicio A', 'Ejercicio B'],
      nivel_2: ['Ejercicio C', 'Ejercicio D'],
      nivel_3: ['Ejercicio E', 'Ejercicio F']
    },
    movementPatterns: ['Patrón 1', 'Patrón 2'],
    primaryMuscles: ['Músculo 1', 'Músculo 2'],
    secondaryMuscles: ['Músculo A', 'Músculo B']
  }
};
```

**Funciones helper:**
- `getMuscleGroupInfo(groupId)` - Info de grupo
- `getRecommendedGroupsByLevel(level)` - Grupos por nivel
- `generateBalancedSplit(level, daysPerWeek)` - Split de entrenamiento

---

### 4️⃣ **Backend Routes**

**Endpoints estándar:**

#### A) Evaluación de perfil
```javascript
POST /api/routine-generation/specialist/METODOLOGIA/evaluate

Request:
{
  "source": "modal_evaluation_v1.0"
}

Response:
{
  "success": true,
  "evaluation": {
    "recommended_level": "intermedio",
    "confidence": 0.85,
    "reasoning": "Justificación detallada",
    "key_indicators": ["Factor 1", "Factor 2"],
    "suggested_focus_areas": ["Área 1", "Área 2"]
  }
}
```

#### B) Generación de plan
```javascript
POST /api/routine-generation/specialist/METODOLOGIA/generate

Request:
{
  "userProfile": { id, edad, peso, ... },
  "selectedLevel": "intermedio",
  "goals": "Objetivos del usuario",
  "selectedMuscleGroups": ["pecho", "espalda", ...],
  "version": "1.0"
}

Response:
{
  "success": true,
  "plan": {
    "methodology_plan_id": 123,
    "duracion_semanas": 4,
    "frecuencia_por_semana": 4,
    "semanas": [...],
    "start_date": "2025-10-06"
  }
}
```

---

### 5️⃣ **Base de Datos**

**Tabla de ejercicios (pattern común):**
```sql
CREATE TABLE app.Ejercicios_METODOLOGIA (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nivel VARCHAR(50),              -- 'Principiante', 'Intermedio', 'Avanzado'
  categoria VARCHAR(100),         -- Grupo muscular
  patron VARCHAR(255),            -- Patrón de movimiento
  equipamiento TEXT[],            -- Array de equipamiento
  series_reps_objetivo VARCHAR(50),
  criterio_de_progreso TEXT,
  progresion_desde VARCHAR(255),  -- Ejercicio previo
  progresion_hacia VARCHAR(255),  -- Ejercicio siguiente
  notas TEXT
);

CREATE INDEX idx_ejercicios_metodologia_nivel
  ON app.Ejercicios_METODOLOGIA(nivel);

CREATE INDEX idx_ejercicios_metodologia_categoria
  ON app.Ejercicios_METODOLOGIA(categoria);
```

---

### 6️⃣ **Prompt de IA**

**Estructura estándar del prompt:**
```markdown
# Especialista en METODOLOGIA - Prompt Unificado

## 🎯 MISIÓN
Crear planes personalizados de METODOLOGIA de 4 semanas...

## 🏗️ CARACTERÍSTICAS METODOLOGIA
- Principio 1
- Principio 2
- Principio 3

## 📊 SISTEMA DE EVALUACIÓN
- Indicador 1
- Indicador 2
- Indicador 3

## 🏋️ EJERCICIOS POR NIVEL
### NIVEL 1
- Ejercicio A
- Ejercicio B

### NIVEL 2
- Ejercicio C
- Ejercicio D

## 📋 FORMATO JSON ESPECÍFICO
{
  "metodologia_solicitada": "METODOLOGIA",
  "selected_style": "METODOLOGIA",
  "nivel_detectado": "intermedio",
  "semanas": [...]
}

## 🚨 REGLAS OBLIGATORIAS
- Regla 1
- Regla 2
- Regla 3
```

---

## 🎯 DISEÑO ESPECÍFICO: HIPERTROFIA

### **Niveles propuestos:**

```javascript
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
    ]
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
    ]
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
    ]
  }
};
```

### **Grupos musculares propuestos:**

```javascript
export const HIPERTROFIA_MUSCLE_GROUPS = {
  pecho: {
    id: 'pecho',
    name: 'Pecho',
    icon: '💪',
    description: 'Desarrollo completo del pectoral',
    exercises: {
      principiante: [
        'Press de banca con barra',
        'Press inclinado con mancuernas',
        'Aperturas con mancuernas'
      ],
      intermedio: [
        'Press de banca pausa',
        'Press inclinado con barra',
        'Cruces en polea alta',
        'Fondos en paralelas'
      ],
      avanzado: [
        'Press de banca con cadenas',
        'Press guillotina',
        'Aperturas inclinadas con pausa',
        'Fondos lastrados'
      ]
    },
    primaryMuscles: ['Pectoral mayor', 'Pectoral menor'],
    secondaryMuscles: ['Deltoides anterior', 'Tríceps'],
    movementPatterns: [
      'Empuje horizontal',
      'Empuje inclinado',
      'Aducción horizontal'
    ]
  },

  espalda: {
    id: 'espalda',
    name: 'Espalda',
    icon: '🦾',
    description: 'Desarrollo de dorsal ancho y grosor',
    exercises: {
      principiante: [
        'Jalón al pecho',
        'Remo con barra',
        'Remo con mancuerna'
      ],
      intermedio: [
        'Dominadas lastradas',
        'Remo pendlay',
        'Jalón agarre estrecho',
        'Face pulls'
      ],
      avanzado: [
        'Dominadas con pausa',
        'Remo con barra T',
        'Pullover con mancuerna',
        'Remo unilateral pesado'
      ]
    },
    primaryMuscles: ['Dorsal ancho', 'Romboides', 'Trapecio medio'],
    secondaryMuscles: ['Bíceps', 'Deltoides posterior'],
    movementPatterns: [
      'Tracción vertical',
      'Tracción horizontal',
      'Retracción escapular'
    ]
  },

  piernas: {
    id: 'piernas',
    name: 'Piernas',
    icon: '🦵',
    description: 'Desarrollo completo de cuádriceps, femorales y glúteos',
    exercises: {
      principiante: [
        'Sentadilla con barra',
        'Prensa de piernas',
        'Peso muerto rumano',
        'Curl femoral'
      ],
      intermedio: [
        'Sentadilla frontal',
        'Zancadas búlgaras',
        'Peso muerto convencional',
        'Extensiones de cuádriceps'
      ],
      avanzado: [
        'Sentadilla profunda con pausa',
        'Sentadilla hack',
        'Peso muerto sumo',
        'Nordic curl'
      ]
    },
    primaryMuscles: ['Cuádriceps', 'Isquiotibiales', 'Glúteos'],
    secondaryMuscles: ['Gemelos', 'Aductores', 'Core'],
    movementPatterns: [
      'Flexión de rodilla',
      'Extensión de cadera',
      'Flexión de cadera'
    ]
  },

  hombros: {
    id: 'hombros',
    name: 'Hombros',
    icon: '🏋️',
    description: 'Desarrollo de deltoides anterior, medio y posterior',
    exercises: {
      principiante: [
        'Press militar con barra',
        'Elevaciones laterales',
        'Face pulls'
      ],
      intermedio: [
        'Press Arnold',
        'Elevaciones laterales en polea',
        'Remo al mentón',
        'Pájaros con mancuernas'
      ],
      avanzado: [
        'Press tras nuca',
        'Elevaciones laterales con pausa',
        'Cruces invertidos',
        'Press landmine'
      ]
    },
    primaryMuscles: ['Deltoides anterior', 'Deltoides medio', 'Deltoides posterior'],
    secondaryMuscles: ['Trapecio superior', 'Tríceps'],
    movementPatterns: [
      'Empuje vertical',
      'Abducción lateral',
      'Extensión horizontal'
    ]
  },

  brazos: {
    id: 'brazos',
    name: 'Brazos',
    icon: '💪',
    description: 'Desarrollo de bíceps y tríceps',
    exercises: {
      principiante: [
        'Curl con barra',
        'Press francés',
        'Curl martillo',
        'Extensiones en polea'
      ],
      intermedio: [
        'Curl 21s',
        'Press francés con barra Z',
        'Curl inclinado',
        'Fondos para tríceps'
      ],
      avanzado: [
        'Curl con barra gruesa',
        'Press francés declinado',
        'Curl araña',
        'Extensiones overhead con cuerda'
      ]
    },
    primaryMuscles: ['Bíceps braquial', 'Tríceps braquial'],
    secondaryMuscles: ['Braquial', 'Braquiorradial', 'Antebrazo'],
    movementPatterns: [
      'Flexión de codo',
      'Extensión de codo'
    ]
  },

  core: {
    id: 'core',
    name: 'Core',
    icon: '🎯',
    description: 'Desarrollo de abdominales y estabilizadores',
    exercises: {
      principiante: [
        'Plancha abdominal',
        'Crunch',
        'Elevaciones de piernas'
      ],
      intermedio: [
        'Rueda abdominal',
        'L-sit',
        'Pallof press',
        'Ab coaster'
      ],
      avanzado: [
        'Dragon flags',
        'Plancha con peso',
        'Hanging leg raises con peso',
        'Ab wheel completo'
      ]
    },
    primaryMuscles: ['Recto abdominal', 'Oblicuos', 'Transverso'],
    secondaryMuscles: ['Erectores espinales', 'Psoas'],
    movementPatterns: [
      'Anti-extensión',
      'Anti-rotación',
      'Flexión de tronco'
    ]
  }
};
```

### **Splits de entrenamiento:**

```javascript
export function generateBalancedSplit(level, daysPerWeek) {
  if (daysPerWeek === 3) {
    return {
      type: 'full_body',
      name: 'Full Body 3x',
      days: [
        {
          name: 'Día 1 - Full Body A',
          muscleGroups: ['pecho', 'espalda', 'piernas'],
          exercises: level === 'principiante' ? 6 : 7
        },
        {
          name: 'Día 2 - Full Body B',
          muscleGroups: ['hombros', 'brazos', 'core'],
          exercises: level === 'principiante' ? 6 : 7
        },
        {
          name: 'Día 3 - Full Body C',
          muscleGroups: ['piernas', 'pecho', 'espalda'],
          exercises: level === 'principiante' ? 6 : 7
        }
      ]
    };
  }

  if (daysPerWeek === 4) {
    return {
      type: 'upper_lower',
      name: 'Upper/Lower 4x',
      days: [
        {
          name: 'Día 1 - Upper A (Empuje)',
          muscleGroups: ['pecho', 'hombros', 'brazos'],
          focus: 'Empuje',
          exercises: 8
        },
        {
          name: 'Día 2 - Lower A',
          muscleGroups: ['piernas', 'core'],
          focus: 'Cuádriceps dominante',
          exercises: 7
        },
        {
          name: 'Día 3 - Upper B (Tracción)',
          muscleGroups: ['espalda', 'brazos'],
          focus: 'Tracción',
          exercises: 8
        },
        {
          name: 'Día 4 - Lower B',
          muscleGroups: ['piernas'],
          focus: 'Femorales dominante',
          exercises: 7
        }
      ]
    };
  }

  if (daysPerWeek === 5) {
    return {
      type: 'push_pull_legs',
      name: 'Push/Pull/Legs 5x',
      days: [
        {
          name: 'Día 1 - Push (Pecho énfasis)',
          muscleGroups: ['pecho', 'hombros', 'brazos'],
          exercises: 7
        },
        {
          name: 'Día 2 - Pull',
          muscleGroups: ['espalda', 'brazos'],
          exercises: 7
        },
        {
          name: 'Día 3 - Legs',
          muscleGroups: ['piernas', 'core'],
          exercises: 8
        },
        {
          name: 'Día 4 - Push (Hombros énfasis)',
          muscleGroups: ['hombros', 'pecho', 'brazos'],
          exercises: 7
        },
        {
          name: 'Día 5 - Pull + Accesorios',
          muscleGroups: ['espalda', 'core'],
          exercises: 6
        }
      ]
    };
  }

  // 6 días
  return {
    type: 'ppl_twice',
    name: 'Push/Pull/Legs 6x (PPL x2)',
    days: [
      {
        name: 'Día 1 - Push A',
        muscleGroups: ['pecho', 'hombros', 'brazos'],
        exercises: 7
      },
      {
        name: 'Día 2 - Pull A',
        muscleGroups: ['espalda', 'brazos'],
        exercises: 7
      },
      {
        name: 'Día 3 - Legs A',
        muscleGroups: ['piernas'],
        exercises: 8
      },
      {
        name: 'Día 4 - Push B',
        muscleGroups: ['hombros', 'pecho', 'brazos'],
        exercises: 7
      },
      {
        name: 'Día 5 - Pull B',
        muscleGroups: ['espalda'],
        exercises: 7
      },
      {
        name: 'Día 6 - Legs B + Core',
        muscleGroups: ['piernas', 'core'],
        exercises: 7
      }
    ]
  };
}
```

---

## 📋 FASES DE IMPLEMENTACIÓN

### ✅ **FASE 1: Preparación (Backend - Base de Datos)**
- [ ] Crear tabla `app.Ejercicios_Hipertrofia`
- [ ] Insertar ejercicios de Excel (cuando el usuario los proporcione)
- [ ] Crear índices optimizados
- [ ] Verificar compatibilidad con `methodology_plans`

### ✅ **FASE 2: Configuración Frontend**
- [ ] Crear `/src/components/Methodologie/methodologies/Hipertrofia/`
- [ ] `HipertrofiaLevels.js` (niveles y configuración)
- [ ] `HipertrofiaMuscleGroups.js` (grupos musculares y splits)
- [ ] `HipertrofiaManualCard.jsx` (componente principal)

### ✅ **FASE 3: Backend Routes**
- [ ] Agregar endpoints en `routineGeneration.js`:
  - `POST /specialist/hipertrofia/evaluate`
  - `POST /specialist/hipertrofia/generate`
- [ ] Configurar módulo IA en `aiConfigs.js`
- [ ] Crear prompt `hipertrofia_specialist.md`

### ✅ **FASE 4: Integración**
- [ ] Agregar Hipertrofia a `methodologiesData.js`
- [ ] Crear card en `MethodologiesScreen.jsx`
- [ ] Configurar redirección en `server.js`

### ✅ **FASE 5: Testing**
- [ ] Test de evaluación IA
- [ ] Test de generación manual
- [ ] Test de flujo completo
- [ ] Verificar integración con calendario

---

## 🚀 PRÓXIMOS PASOS

**Esperando archivo Excel del usuario con ejercicios de Hipertrofia**

Una vez recibido:
1. Crear script de inserción SQL
2. Ejecutar migración de base de datos
3. Comenzar Fase 2 (archivos de configuración)

---

**Última actualización:** 2025-10-06
**Estado:** Diseño completo - Esperando datos de ejercicios
