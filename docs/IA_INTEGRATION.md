# Integración con Inteligencia Artificial

## 🤖 Flujo de Datos Usuario → OpenAI

### 1. Recolección de Datos del Usuario

#### Proceso de Lectura desde Base de Datos

```typescript
// 1. El proceso inicia en /api/generate-training/route.ts
async function getUserData(userId: string) {
  const supabase = createServerClient();
  
  // Obtener perfil del usuario
  const { data: profile } = await supabase
    .from('user_profiles')
    .select(`
      *,
      fitness_level,
      goals,
      preferences,
      medical_conditions,
      available_equipment,
      time_availability,
      experience_years,
      body_metrics (
        weight,
        height,
        body_fat_percentage,
        muscle_mass
      )
    `)
    .eq('id', userId)
    .single();
    
  return profile;
}
```

### 2. Estructura de Datos Enviada a OpenAI

#### Formato del Contexto de Usuario

```typescript
interface UserContext {
  // Datos Personales
  personal: {
    age: number;
    gender: string;
    weight: number;
    height: number;
    bodyFatPercentage?: number;
    muscleMass?: number;
  };
  
  // Objetivos
  goals: {
    primary: 'muscle_gain' | 'fat_loss' | 'endurance' | 'strength';
    secondary?: string[];
    timeframe: string; // "3 months", "6 months", etc.
    specificTargets?: string[]; // "Lose 10kg", "Run 5k", etc.
  };
  
  // Nivel y Experiencia
  fitness: {
    level: 'beginner' | 'intermediate' | 'advanced';
    experienceYears: number;
    currentActivity: string[];
    injuryHistory?: string[];
  };
  
  // Preferencias
  preferences: {
    trainingStyle: string[]; // ["HIIT", "Strength", "Yoga"]
    exerciseBlacklist?: string[]; // Ejercicios a evitar
    schedulePreference: 'morning' | 'afternoon' | 'evening';
    sessionDuration: number; // minutos
  };
  
  // Disponibilidad
  availability: {
    daysPerWeek: number;
    minutesPerSession: number;
    equipment: string[]; // ["dumbbells", "barbell", "none"]
    location: 'home' | 'gym' | 'outdoor';
  };
  
  // Restricciones Médicas
  medical?: {
    conditions: string[];
    medications?: string[];
    limitations: string[];
  };
}
```

### 3. Construcción del Prompt para OpenAI

#### Template de Prompt

```typescript
// En /lib/openai/prompts.ts
export function buildTrainingPrompt(userContext: UserContext): string {
  return `
    Eres un entrenador personal experto. Crea un plan de entrenamiento personalizado.
    
    DATOS DEL USUARIO:
    ${JSON.stringify(userContext, null, 2)}
    
    REQUISITOS DEL PLAN:
    1. Adaptado al nivel ${userContext.fitness.level}
    2. Objetivo principal: ${userContext.goals.primary}
    3. ${userContext.availability.daysPerWeek} días por semana
    4. Sesiones de ${userContext.availability.minutesPerSession} minutos
    5. Equipamiento disponible: ${userContext.availability.equipment.join(', ')}
    
    FORMATO DE RESPUESTA:
    {
      "planName": "Nombre descriptivo del plan",
      "duration": "8 semanas",
      "frequency": ${userContext.availability.daysPerWeek},
      "weeks": [
        {
          "weekNumber": 1,
          "focus": "Adaptación y técnica",
          "sessions": [
            {
              "day": "Lunes",
              "type": "Fuerza - Tren Superior",
              "exercises": [
                {
                  "name": "Press de banca",
                  "sets": 3,
                  "reps": "8-10",
                  "rest": "90s",
                  "intensity": "70% 1RM",
                  "notes": "Técnica estricta"
                }
              ]
            }
          ]
        }
      ],
      "progressionStrategy": "Incremento de carga progresivo",
      "nutritionGuidelines": "...",
      "recoveryProtocol": "..."
    }
  `;
}
```

### 4. Llamada a la API de OpenAI

```typescript
// En /api/generate-training/route.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // 1. Obtener ID del usuario
    const session = await getSession();
    const userId = session.user.id;
    
    // 2. Leer datos del usuario de Supabase
    const userProfile = await getUserData(userId);
    
    // 3. Construir contexto
    const userContext = buildUserContext(userProfile);
    
    // 4. Generar prompt
    const prompt = buildTrainingPrompt(userContext);
    
    // 5. Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "Eres un entrenador personal certificado con 10 años de experiencia."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });
    
    // 6. Parsear respuesta
    const trainingPlan = JSON.parse(completion.choices[0].message.content);
    
    // 7. Validar estructura
    validateTrainingPlan(trainingPlan);
    
    // 8. Guardar en base de datos
    await saveTrainingPlan(userId, trainingPlan);
    
    return NextResponse.json({ success: true, plan: trainingPlan });
    
  } catch (error) {
    console.error('Error generating training:', error);
    return NextResponse.json(
      { error: 'Failed to generate training plan' },
      { status: 500 }
    );
  }
}
```

### 5. Validación y Procesamiento de Respuesta

```typescript
// Validación de la respuesta de OpenAI
function validateTrainingPlan(plan: any): void {
  const requiredFields = [
    'planName',
    'duration',
    'frequency',
    'weeks'
  ];
  
  for (const field of requiredFields) {
    if (!plan[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validar estructura de semanas
  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    throw new Error('Invalid weeks structure');
  }
  
  // Validar cada semana
  plan.weeks.forEach((week: any, index: number) => {
    if (!week.sessions || !Array.isArray(week.sessions)) {
      throw new Error(`Invalid sessions in week ${index + 1}`);
    }
  });
}
```

### 6. Almacenamiento del Plan Generado

```typescript
async function saveTrainingPlan(userId: string, plan: any) {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('training_plans')
    .insert({
      user_id: userId,
      plan_name: plan.planName,
      plan_data: plan,
      duration: plan.duration,
      frequency: plan.frequency,
      created_at: new Date().toISOString(),
      status: 'active'
    });
    
  if (error) throw error;
  return data;
}
```

## 🔍 Verificación de Integridad de Datos

### Checklist de Validación

1. **Perfil Completo**
   - ✅ Edad y género presentes
   - ✅ Métricas corporales actualizadas
   - ✅ Objetivos definidos
   - ✅ Nivel de fitness especificado

2. **Datos Coherentes**
   - ✅ Experiencia acorde al nivel
   - ✅ Objetivos realistas para el timeframe
   - ✅ Disponibilidad suficiente para objetivos

3. **Seguridad**
   - ✅ Condiciones médicas consideradas
   - ✅ Limitaciones respetadas
   - ✅ Progresión apropiada al nivel

## 📊 Monitoreo y Logs

```typescript
// Sistema de logging para debugging
function logAIInteraction(userId: string, prompt: string, response: any) {
  console.log({
    timestamp: new Date().toISOString(),
    userId,
    promptLength: prompt.length,
    responseTokens: response.usage?.total_tokens,
    model: response.model,
    success: true
  });
  
  // Opcionalmente guardar en base de datos
  supabase.from('ai_logs').insert({
    user_id: userId,
    prompt_hash: hashPrompt(prompt),
    response_summary: summarizeResponse(response),
    tokens_used: response.usage?.total_tokens
  });
}
```

## 🚨 Manejo de Errores

```typescript
// Errores comunes y soluciones
const ERROR_HANDLERS = {
  'rate_limit_exceeded': async () => {
    // Implementar retry con backoff
    await delay(1000);
    return retry();
  },
  
  'invalid_api_key': () => {
    // Notificar al admin
    notifyAdmin('OpenAI API key issue');
    throw new Error('Configuration error');
  },
  
  'timeout': () => {
    // Usar plan genérico de respaldo
    return getGenericPlan();
  }
};
```