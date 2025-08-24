# Funcionalidades Detalladas

## 🏠 Entrenamiento en Casa

### Descripción
Sistema completo para usuarios que entrenan sin acceso a gimnasio.

### Características Principales

#### 1. Generación de Rutinas Sin Equipamiento
- **Ejercicios con peso corporal**: Flexiones, sentadillas, planchas
- **Progresiones adaptativas**: De principiante a avanzado
- **Variaciones por espacio**: Apartamento pequeño, casa con jardín

#### 2. Biblioteca de Ejercicios
```typescript
interface HomeExercise {
  id: string;
  name: string;
  muscleGroups: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  spaceRequired: 'minimal' | 'moderate' | 'large';
  equipment: 'none' | 'minimal'; // banda elástica, esterilla
  videoUrl: string;
  instructions: string[];
  commonMistakes: string[];
}
```

#### 3. Planes Progresivos
- **Semana 1-4**: Adaptación y técnica
- **Semana 5-8**: Incremento de volumen
- **Semana 9-12**: Intensidad y variaciones avanzadas

### Botones y Acciones
- **"Generar Plan Casero"**: Crea rutina personalizada
- **"Ajustar Espacio"**: Define limitaciones del área
- **"Ver Alternativas"**: Muestra ejercicios sustitutos

---

## 💪 Metodologías de Entrenamiento

### 1. HIIT (High Intensity Interval Training)

#### Características
- **Duración**: 15-30 minutos
- **Estructura**: Intervalos trabajo/descanso
- **Beneficios**: Quema grasa, mejora cardiovascular

#### Configuración
```typescript
interface HIITConfig {
  workTime: number; // segundos (20-60)
  restTime: number; // segundos (10-30)
  rounds: number; // (4-10)
  exercises: Exercise[];
  warmup: boolean;
  cooldown: boolean;
}
```

### 2. Fuerza Progresiva

#### Características
- **Periodización**: Lineal o ondulante
- **Progresión**: +2.5-5kg por semana
- **Descanso**: 2-5 minutos entre series

#### Fases
1. **Hipertrofia** (8-12 reps, 70-80% 1RM)
2. **Fuerza** (3-6 reps, 80-90% 1RM)
3. **Potencia** (1-3 reps, 90-100% 1RM)

### 3. Entrenamiento Funcional

#### Características
- **Movimientos multiarticulares**
- **Patrones de movimiento natural**
- **Enfoque en estabilidad y coordinación**

#### Ejercicios Clave
- Sentadilla con salto
- Burpees
- Turkish get-ups
- Farmer's walks

### 4. Calistenia

#### Progresiones
```typescript
const progressions = {
  pushups: [
    'Wall pushups',
    'Incline pushups',
    'Knee pushups',
    'Regular pushups',
    'Diamond pushups',
    'Archer pushups',
    'One-arm pushups'
  ],
  pullups: [
    'Dead hangs',
    'Scapular pulls',
    'Negative pullups',
    'Band-assisted pullups',
    'Regular pullups',
    'Wide-grip pullups',
    'Muscle-ups'
  ]
};
```

### 5. Powerlifting

#### Movimientos Principales
1. **Sentadilla**: Back squat, front squat
2. **Press de Banca**: Flat, incline, close-grip
3. **Peso Muerto**: Convencional, sumo, rumano

#### Programación
- **Volumen**: 3-5 series x 1-5 repeticiones
- **Intensidad**: 75-95% 1RM
- **Frecuencia**: 2-4 veces por semana por movimiento

---

## 🥗 Sistema de Nutrición

### Cálculo de Macronutrientes

```typescript
function calculateMacros(user: UserProfile): Macros {
  // 1. Calcular TMB (Tasa Metabólica Basal)
  const bmr = user.gender === 'male' 
    ? (10 * user.weight) + (6.25 * user.height) - (5 * user.age) + 5
    : (10 * user.weight) + (6.25 * user.height) - (5 * user.age) - 161;
  
  // 2. Factor de actividad
  const activityMultiplier = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9
  }[user.activityLevel];
  
  const tdee = bmr * activityMultiplier;
  
  // 3. Ajustar según objetivo
  let calories = tdee;
  if (user.goal === 'fat_loss') calories -= 500;
  if (user.goal === 'muscle_gain') calories += 300;
  
  // 4. Distribución de macros
  return {
    calories: Math.round(calories),
    protein: Math.round(user.weight * 2.2), // g
    carbs: Math.round(calories * 0.4 / 4), // g
    fats: Math.round(calories * 0.3 / 9) // g
  };
}
```

### Planes de Comidas

#### Estructura Diaria
```typescript
interface MealPlan {
  breakfast: Meal;
  midMorningSnack?: Meal;
  lunch: Meal;
  afternoonSnack?: Meal;
  dinner: Meal;
  postWorkout?: Meal;
  
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}
```

### Recetas Personalizadas

#### Filtros Disponibles
- Preferencias dietéticas (vegano, vegetariano, keto)
- Alergias e intolerancias
- Tiempo de preparación
- Presupuesto
- Ingredientes disponibles

---

## 📊 Seguimiento de Progreso

### Métricas Registradas

#### 1. Medidas Corporales
```typescript
interface BodyMetrics {
  date: Date;
  weight: number;
  bodyFat?: number;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    biceps?: number;
    thighs?: number;
    calves?: number;
  };
  photos?: {
    front?: string;
    side?: string;
    back?: string;
  };
}
```

#### 2. Rendimiento
```typescript
interface PerformanceMetrics {
  exercise: string;
  personalRecord: {
    weight?: number;
    reps?: number;
    time?: number;
    distance?: number;
  };
  date: Date;
  notes?: string;
}
```

### Visualización de Datos

#### Gráficos Disponibles
1. **Evolución de Peso**: Línea temporal
2. **Cambio de Composición**: Gráfico de áreas
3. **PRs por Ejercicio**: Barras comparativas
4. **Consistencia**: Calendario de actividad
5. **Volumen de Entrenamiento**: Gráfico acumulativo

### Logros y Gamificación

```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'consistency' | 'strength' | 'endurance' | 'milestone';
  requirement: {
    type: string;
    value: number;
  };
  unlockedAt?: Date;
  progress: number; // 0-100
}

// Ejemplos
const achievements = [
  {
    name: "Primera Semana",
    requirement: { type: "workouts", value: 7 }
  },
  {
    name: "Peso Muerto 100kg",
    requirement: { type: "pr_deadlift", value: 100 }
  },
  {
    name: "30 Días Consistente",
    requirement: { type: "streak", value: 30 }
  }
];
```

---

## 🔔 Sistema de Notificaciones

### Tipos de Notificaciones

1. **Recordatorios de Entrenamiento**
   - Hora programada de sesión
   - Motivación diaria
   - Recordatorio de descanso

2. **Actualizaciones de Progreso**
   - Nuevo PR alcanzado
   - Logro desbloqueado
   - Resumen semanal

3. **Nutrición**
   - Recordatorio de comidas
   - Registro de agua
   - Preparación de comidas

### Configuración
```typescript
interface NotificationSettings {
  enabled: boolean;
  channels: ('email' | 'push' | 'sms')[];
  schedule: {
    workoutReminder: string; // "08:00"
    mealReminder: boolean;
    weeklyReport: 'monday' | 'sunday';
  };
  preferences: {
    motivationalQuotes: boolean;
    progressUpdates: boolean;
    nutritionTips: boolean;
  };
}
```