# 🏗️ Arquitectura Técnica Detallada

## 📊 Flujo de Datos Usuario → IA

### 1. Recopilación de Datos del Usuario

```typescript
// Estructura de datos del usuario en Supabase
interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  edad: number;
  peso: number;
  altura: number;
  genero: 'masculino' | 'femenino' | 'otro';
  nivel_actividad: 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';
  objetivo: 'perder_peso' | 'mantener' | 'ganar_musculo' | 'mejorar_resistencia';
  experiencia: 'principiante' | 'intermedio' | 'avanzado';
  lesiones: string[];
  preferencias_alimentarias: string[];
  dias_disponibles: number;
  tiempo_por_sesion: number;
  equipamiento_disponible: string[];
  created_at: Date;
  updated_at: Date;
}
```

### 2. Proceso de Lectura de Datos

```javascript
// server/index.js - Endpoint que lee datos del usuario
app.post('/api/chat', async (req, res) => {
  const { message, userId } = req.body;
  
  // PASO 1: Obtener perfil del usuario de Supabase
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  // PASO 2: Obtener historial de entrenamiento
  const { data: trainingHistory } = await supabase
    .from('training_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  // PASO 3: Obtener datos nutricionales
  const { data: nutritionData } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(7);
  
  // PASO 4: Construir contexto para OpenAI
  const context = {
    usuario: {
      perfil: userProfile,
      historial_entrenamiento: trainingHistory,
      nutricion_reciente: nutritionData
    },
    solicitud: message
  };
  
  // PASO 5: Enviar a OpenAI con contexto completo
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(context)
      },
      {
        role: "user",
        content: message
      }
    ]
  });
  
  res.json({ response: completion.choices[0].message.content });
});
```

### 3. Construcción del Prompt con Contexto

```javascript
function buildSystemPrompt(context) {
  return `
    Eres un entrenador personal experto. 
    
    DATOS DEL USUARIO:
    - Edad: ${context.usuario.perfil.edad}
    - Peso: ${context.usuario.perfil.peso} kg
    - Altura: ${context.usuario.perfil.altura} cm
    - Objetivo: ${context.usuario.perfil.objetivo}
    - Nivel: ${context.usuario.perfil.experiencia}
    - Días disponibles: ${context.usuario.perfil.dias_disponibles}
    
    HISTORIAL RECIENTE:
    ${context.usuario.historial_entrenamiento.map(e => 
      `- ${e.fecha}: ${e.tipo_entrenamiento} (${e.duracion} min)`
    ).join('\n')}
    
    NUTRICIÓN ÚLTIMA SEMANA:
    - Promedio calorías: ${calculateAvgCalories(context.usuario.nutricion_reciente)}
    - Promedio proteínas: ${calculateAvgProtein(context.usuario.nutricion_reciente)}g
    
    Proporciona recomendaciones personalizadas basadas en estos datos.
  `;
}
```

## 🔄 Flujo de Componentes

### Dashboard Principal
```
Dashboard.tsx
    ├── Header (navegación)
    ├── StatsOverview (estadísticas)
    ├── QuickActions (accesos rápidos)
    │   ├── → EntrenamientoCasa
    │   ├── → EntrenamientoGimnasio
    │   ├── → Nutricion
    │   └── → AIChat
    └── RecentActivity (actividad reciente)
```

### Módulo de Entrenamiento
```
EntrenamientoCasa.tsx / EntrenamientoGimnasio.tsx
    ├── WorkoutSelector (selector de rutina)
    ├── ExerciseList (lista de ejercicios)
    │   └── ExerciseCard
    │       ├── VideoDemo
    │       ├── Instructions
    │       └── ProgressTracker
    ├── TimerComponent (cronómetro)
    └── SaveWorkout (guardar sesión)
```

## 🗄️ Estructura de Base de Datos

### Tablas Principales

```sql
-- Perfiles de usuario
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  nombre TEXT,
  edad INTEGER,
  peso DECIMAL,
  altura INTEGER,
  genero TEXT,
  nivel_actividad TEXT,
  objetivo TEXT,
  experiencia TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Historial de entrenamiento
CREATE TABLE training_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  fecha DATE,
  tipo_entrenamiento TEXT,
  ejercicios JSONB,
  duracion INTEGER,
  calorias_quemadas INTEGER,
  notas TEXT,
  created_at TIMESTAMP
);

-- Planes de entrenamiento
CREATE TABLE training_plans (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  nombre TEXT,
  tipo TEXT,
  metodologia TEXT,
  dias_semana INTEGER,
  duracion_semanas INTEGER,
  ejercicios JSONB,
  activo BOOLEAN,
  created_at TIMESTAMP
);

-- Registro nutricional
CREATE TABLE nutrition_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  fecha DATE,
  comidas JSONB,
  calorias_totales INTEGER,
  proteinas DECIMAL,
  carbohidratos DECIMAL,
  grasas DECIMAL,
  agua_ml INTEGER,
  created_at TIMESTAMP
);

-- Progreso y mediciones
CREATE TABLE progress_measurements (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  fecha DATE,
  peso DECIMAL,
  medidas JSONB,
  fotos TEXT[],
  notas TEXT,
  created_at TIMESTAMP
);
```

## 🔐 Seguridad y Autenticación

### Flujo de Autenticación
1. Usuario se registra/inicia sesión via Supabase Auth
2. Se genera JWT token
3. Token se almacena en localStorage
4. Todas las peticiones incluyen el token en headers
5. Backend valida token con Supabase
6. Se aplican Row Level Security (RLS) policies

### Ejemplo de Validación
```javascript
// Middleware de autenticación
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};
```