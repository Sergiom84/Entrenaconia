# Arquitectura y Estructura del Código

## 📐 Arquitectura General

### Patrón de Diseño
La aplicación sigue una arquitectura de capas con separación clara de responsabilidades:

```
┌─────────────────────────────────────┐
│         Capa de Presentación        │
│     (Components, Pages, UI)         │
├─────────────────────────────────────┤
│         Capa de Lógica              │
│    (Hooks, Store, API Routes)       │
├─────────────────────────────────────┤
│         Capa de Datos               │
│   (Supabase, OpenAI, Types)         │
└─────────────────────────────────────┘
```

## 🗂️ Estructura Detallada por Carpetas

### `/src/app` - Rutas y Páginas

#### `/api/` - Endpoints del Backend
```typescript
api/
├── generate-training/     # Genera planes con IA
├── user-data/             # Obtiene datos del usuario
├── save-training/         # Guarda planes en DB
└── update-profile/        # Actualiza perfil usuario
```

**Función de cada endpoint:**
- `generate-training`: Procesa el perfil del usuario y genera un plan personalizado con OpenAI
- `user-data`: Recupera toda la información del usuario desde Supabase
- `save-training`: Persiste los planes generados en la base de datos
- `update-profile`: Actualiza los datos del perfil (objetivos, experiencia, etc.)

#### `/dashboard/` - Panel Principal
```typescript
dashboard/
├── page.tsx              # Vista principal del dashboard
├── profile/              # Gestión del perfil
├── training/             # Planes de entrenamiento
├── nutrition/            # Planes nutricionales
├── methodologies/        # Metodologías de entrenamiento
└── layout.tsx            # Layout del dashboard
```

### `/src/components` - Componentes React

#### Organización por Dominio
```typescript
components/
├── ui/                   # Componentes base reutilizables
│   ├── button.tsx       # Botones con variantes
│   ├── card.tsx         # Tarjetas de contenido
│   ├── modal.tsx        # Modales/Diálogos
│   └── input.tsx        # Campos de formulario
├── dashboard/           # Componentes específicos del dashboard
│   ├── StatsCard.tsx    # Tarjetas de estadísticas
│   ├── TrainingPlan.tsx # Visualización de planes
│   └── ProgressChart.tsx # Gráficos de progreso
└── auth/                # Componentes de autenticación
    ├── LoginForm.tsx    # Formulario de login
    └── RegisterForm.tsx # Formulario de registro
```

### `/src/lib` - Utilidades y Configuraciones

#### `/supabase/` - Cliente de Base de Datos
```typescript
supabase/
├── client.ts            # Cliente de Supabase
├── server.ts            # Cliente servidor-side
└── types.ts             # Tipos generados de la DB
```

#### `/openai/` - Integración con IA
```typescript
openai/
├── client.ts            # Cliente de OpenAI
├── prompts.ts           # Templates de prompts
└── processors.ts        # Procesadores de respuestas
```

### `/src/hooks` - Custom Hooks

```typescript
hooks/
├── useUser.ts           # Estado y datos del usuario
├── useTraining.ts       # Gestión de entrenamientos
├── useSupabase.ts       # Operaciones con Supabase
└── useAI.ts             # Interacción con OpenAI
```

### `/src/store` - Estado Global

```typescript
store/
├── userStore.ts         # Estado del usuario
├── trainingStore.ts     # Estado de entrenamientos
└── uiStore.ts           # Estado de la UI
```

## 🔄 Flujo de Datos

### 1. Autenticación de Usuario
```mermaid
Usuario → LoginForm → Supabase Auth → userStore → Dashboard
```

### 2. Generación de Plan de Entrenamiento
```mermaid
Dashboard → API Route → Supabase (fetch user) → OpenAI → Save to DB → Update UI
```

### 3. Actualización de Perfil
```mermaid
ProfileForm → Validation → API Route → Supabase Update → Refresh Store
```

## 🏗️ Patrones de Código

### Componentes
- **Atomic Design**: Componentes pequeños y reutilizables
- **Composition Pattern**: Componentes compuestos para flexibilidad
- **Props Interface**: Tipos estrictos para todas las props

### Estado
- **Single Source of Truth**: Zustand como estado global
- **Optimistic Updates**: Actualizaciones optimistas en UI
- **Cache Strategy**: Cache de datos con SWR/React Query

### API
- **RESTful Design**: Endpoints semánticos
- **Error Handling**: Manejo consistente de errores
- **Type Safety**: Tipos compartidos entre cliente y servidor