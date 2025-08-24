# 🧩 Guía Completa de Componentes

## 📱 Dashboard.tsx
**Propósito**: Panel principal de control del usuario

### Botones y Funciones
- **🏠 Botón "Entrenar en Casa"**
  - Función: `navigateToHomeTraining()`
  - Acción: Redirige a `/entrenamiento-casa`
  - Muestra rutinas sin equipamiento

- **🏋️ Botón "Ir al Gimnasio"**
  - Función: `navigateToGymTraining()`
  - Acción: Redirige a `/entrenamiento-gimnasio`
  - Muestra rutinas con equipamiento

- **🥗 Botón "Nutrición"**
  - Función: `navigateToNutrition()`
  - Acción: Redirige a `/nutricion`
  - Abre panel de registro alimenticio

- **💬 Botón "Chat IA"**
  - Función: `openAIChat()`
  - Acción: Abre modal de chat
  - Inicia conversación con asistente

- **📊 Botón "Ver Progreso"**
  - Función: `viewProgress()`
  - Acción: Muestra gráficas de evolución
  - Compara medidas anteriores

## 🏠 EntrenamientoCasa.tsx
**Propósito**: Gestión de entrenamientos sin equipamiento

### Estructura del Componente
```typescript
interface EntrenamientoCasaProps {
  userId: string;
  userProfile: UserProfile;
}

const EntrenamientoCasa: React.FC<EntrenamientoCasaProps> = ({ userId, userProfile }) => {
  // Estados
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [completedExercises, setCompletedExercises] = useState([]);
  
  // Funciones principales
  const generateWorkout = async () => {
    // Genera rutina basada en perfil del usuario
  };
  
  const startExercise = (exerciseId) => {
    // Inicia ejercicio y cronómetro
  };
  
  const completeExercise = (exerciseId, data) => {
    // Marca ejercicio como completado
    // Guarda datos en base de datos
  };
  
  const saveWorkoutSession = async () => {
    // Guarda sesión completa en training_history
  };
}
```

### Botones Específicos
- **"Generar Rutina"** → `generateWorkout()`
  - Crea plan personalizado con IA
  - Considera nivel y tiempo disponible

- **"Iniciar Ejercicio"** → `startExercise(exerciseId)`
  - Activa cronómetro
  - Muestra instrucciones detalladas

- **"Marcar Completado"** → `completeExercise()`
  - Registra series y repeticiones
  - Actualiza progreso

- **"Ver Video"** → `showVideoDemo(exerciseId)`
  - Abre modal con demostración
  - Muestra técnica correcta

## 🏋️ EntrenamientoGimnasio.tsx
**Propósito**: Gestión de entrenamientos con equipamiento completo

### Funcionalidades Específicas
```typescript
interface GymFeatures {
  equipmentSelector: boolean;      // Selector de equipamiento disponible
  weightTracker: boolean;          // Registro de pesos utilizados
  restTimer: boolean;              // Temporizador entre series
  exerciseSubstitution: boolean;   // Sustitución de ejercicios
  plateCalculator: boolean;        // Calculadora de discos
}
```

### Botones y Acciones
- **"Seleccionar Equipamiento"** → `selectEquipment()`
  - Filtra ejercicios por máquinas disponibles
  
- **"Registrar Peso"** → `logWeight(exerciseId, weight)`
  - Guarda peso utilizado
  - Calcula progresión

- **"Calcular Discos"** → `calculatePlates(targetWeight)`
  - Muestra combinación óptima de discos

- **"Sustituir Ejercicio"** → `substituteExercise(exerciseId)`
  - Sugiere alternativas equivalentes

## 📚 Metodologias.tsx
**Propósito**: Selector de diferentes metodologías de entrenamiento

### Metodologías Disponibles

#### 1. Weider
```typescript
const weiderPlan = {
  tipo: 'weider',
  division: ['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Piernas'],
  frecuencia: 5,
  descripcion: 'División clásica por grupos musculares',
  generarPlan: () => generateWeiderPlan(userProfile)
};
```

#### 2. Full Body
```typescript
const fullBodyPlan = {
  tipo: 'fullbody',
  division: ['Cuerpo Completo'],
  frecuencia: 3,
  descripcion: 'Todos los grupos en cada sesión',
  generarPlan: () => generateFullBodyPlan(userProfile)
};
```

#### 3. Push/Pull/Legs
```typescript
const pplPlan = {
  tipo: 'ppl',
  division: ['Push (Empuje)', 'Pull (Tirón)', 'Legs (Piernas)'],
  frecuencia: 3-6,
  descripcion: 'División por patrones de movimiento',
  generarPlan: () => generatePPLPlan(userProfile)
};
```

### Botones de Metodología
- **"Seleccionar Metodología"** → `selectMethodology(type)`
  - Aplica metodología al plan actual
  - Reorganiza ejercicios según patrón

- **"Ver Ejemplo"** → `showMethodologyExample(type)`
  - Muestra rutina de ejemplo
  - Explica beneficios

- **"Personalizar"** → `customizeMethodology()`
  - Permite ajustes manuales
  - Guarda como plantilla personal

## 🥗 Nutricion.tsx
**Propósito**: Control y seguimiento nutricional

### Estructura de Datos
```typescript
interface NutritionData {
  dailyCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fats: number;
  };
  meals: Meal[];
  waterIntake: number;
  supplements: Supplement[];
}
```

### Funcionalidades
- **"Registrar Comida"** → `logMeal(mealData)`
  - Abre formulario de registro
  - Calcula macros automáticamente

- **"Escanear Código"** → `scanBarcode()`
  - Activa cámara para escanear
  - Busca información nutricional

- **"Generar Plan"** → `generateMealPlan()`
  - Crea plan semanal con IA
  - Basado en objetivos y preferencias

- **"Ver Análisis"** → `showNutritionAnalysis()`
  - Muestra gráficos de macros
  - Compara con objetivos

## 💬 AIChat.tsx
**Propósito**: Interfaz de chat con asistente IA

### Configuración
```typescript
interface AIChatConfig {
  model: 'gpt-4';
  temperature: 0.7;
  maxTokens: 1000;
  contextWindow: 10; // mensajes anteriores a incluir
  personalization: true;
}
```

### Botones del Chat
- **"Enviar Mensaje"** → `sendMessage(text)`
  - Envía consulta a OpenAI
  - Incluye contexto del usuario

- **"Limpiar Chat"** → `clearChat()`
  - Borra historial de conversación
  - Reinicia contexto

- **"Exportar Conversación"** → `exportChat()`
  - Descarga chat en PDF
  - Incluye recomendaciones

- **"Modo Voz"** → `toggleVoiceMode()`
  - Activa entrada/salida por voz
  - Usa Web Speech API

## 👤 UserProfile.tsx
**Propósito**: Gestión del perfil de usuario

### Secciones del Perfil
```typescript
interface ProfileSections {
  personalInfo: {
    nombre: string;
    edad: number;
    genero: string;
  };
  physicalData: {
    peso: number;
    altura: number;
    imc: number;
  };
  goals: {
    objetivo: string;
    plazo: string;
  };
  preferences: {
    diasDisponibles: number;
    tiempoPorSesion: number;
    equipamiento: string[];
  };
}
```

### Botones de Perfil
- **"Editar Perfil"** → `editProfile()`
  - Habilita modo edición
  - Valida cambios

- **"Actualizar Medidas"** → `updateMeasurements()`
  - Registra nuevo peso/medidas
  - Calcula tendencias

- **"Subir Foto"** → `uploadProgressPhoto()`
  - Añade foto de progreso
  - Organiza por fecha

- **"Ver Historial"** → `viewHistory()`
  - Muestra evolución temporal
  - Genera comparativas