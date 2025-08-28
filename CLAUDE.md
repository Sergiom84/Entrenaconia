# CLAUDE.md - Entrena con IA

**Fecha de creación**: 26 de agosto de 2025  
**Última actualización**: 26 de agosto de 2025  
**Versión**: 1.0  
**Estado del proyecto**: En desarrollo activo  

## 🎯 Resumen del Proyecto

**Entrena con IA** es una aplicación de fitness personalizada que utiliza inteligencia artificial para generar rutinas de entrenamiento adaptativas. Combina análisis de perfil del usuario, metodologías científicas de entrenamiento, y corrección técnica mediante IA para proporcionar una experiencia de entrenamiento completa y segura.

### Características Principales
- **Generación de rutinas con IA**: Planes personalizados usando OpenAI GPT-4
- **Entrenamiento en casa**: Sistema especializado para entrenar sin gimnasio
- **Metodologías científicas**: 8 metodologías validadas (HIIT, Powerlifting, Funcional, etc.)
- **Corrección por foto/video**: Análisis de técnica mediante visión artificial
- **Sistema de rutinas**: Calendario de entrenamientos con seguimiento de progreso
- **Perfil completo**: Gestión detallada de datos biométricos, objetivos y limitaciones

## 🏗️ Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Node.js + Express 
- **Base de datos**: PostgreSQL (esquema `app`)
- **IA**: OpenAI API (múltiples keys específicas por feature)
- **UI**: Radix UI + Lucide Icons + Framer Motion

### Estructura de Directorios
```
├── backend/
│   ├── config/aiConfigs.js          # Configuración IA centralizada
│   ├── lib/
│   │   ├── openaiClient.js          # Cliente OpenAI con múltiples keys
│   │   └── promptRegistry.js        # Gestión de prompts centralizados
│   ├── routes/                      # 16 rutas API especializadas
│   ├── prompts/                     # Prompts de IA en archivos .md
│   └── server.js                    # Servidor principal
├── src/
│   ├── components/
│   │   ├── HomeTraining/           # Entrenamiento en casa
│   │   ├── Methodologie/           # Sistema de metodologías
│   │   ├── routines/               # Sistema de rutinas
│   │   ├── profile/                # Gestión de perfil
│   │   ├── auth/                   # Autenticación
│   │   └── ui/                     # Componentes base
│   ├── contexts/                   # AuthContext + UserContext
│   └── hooks/                      # Custom hooks
├── docs/                           # Documentación técnica completa
└── database_scripts/               # Scripts SQL de BD
```

## 🤖 Sistema de IA

### Configuración por Módulos
La aplicación utiliza **5 módulos de IA independientes**, cada uno con su propia API key y configuración:

1. **VIDEO_CORRECTION**: Análisis de técnica por video
   - Modelo: `gpt-4.1-nano`
   - Temperatura: 0.43
   - Max tokens: 2048

2. **PHOTO_CORRECTION**: Análisis de técnica por foto
   - Modelo: `gpt-4o-mini`
   - Temperatura: 0.3
   - Max tokens: 1500

3. **HOME_TRAINING**: Generación de rutinas caseras
   - Modelo: `gpt-4.1-nano`
   - Temperatura: 1.0
   - Max tokens: 2048

4. **METHODOLOGIE**: Generación automática de metodologías
   - Modelo: `gpt-4o-mini`
   - Temperatura: 0.7
   - Max tokens: 12000

5. **METHODOLOGIE_MANUAL**: Generación manual de metodologías
   - Modelo: `gpt-4o-mini`
   - Temperatura: 0.7
   - Max tokens: 12000

### Gestión de Prompts
- **Archivo**: `/backend/lib/promptRegistry.js`
- **Caché**: Prompts cargados en memoria al iniciar servidor
- **Fuente**: Archivos `.md` en `/backend/prompts/`
- **Features soportadas**: `photo`, `video`, `home`, `methodologie`

## 📊 Base de Datos

### Esquema Principal (`app`)
```sql
-- Tablas principales
app.users                    # Usuarios registrados
app.user_profiles            # Perfiles detallados
app.home_training_plans      # Planes de entrenamiento en casa
app.home_training_sessions   # Sesiones de entrenamiento en casa
app.home_exercise_history    # ✅ Historial ESPECÍFICO de entrenamiento en casa
app.exercise_history         # ✅ Historial ESPECÍFICO de metodologías/rutinas
app.methodology_plans        # Planes de metodologías
app.routines                 # Rutinas del sistema
app.routine_sessions         # Sesiones de rutinas
app.user_exercise_history    # ⚠️ DEPRECADA - No usar para nuevos desarrollos
```

### ⚠️ SEPARACIÓN CRÍTICA DE MÓDULOS - NUNCA MEZCLAR
- **`app.home_exercise_history`**: SOLO para entrenamiento en casa
- **`app.exercise_history`**: SOLO para metodologías/rutinas de gimnasio
- **`app.user_exercise_history`**: ⚠️ DEPRECADA - NO usar en nuevos desarrollos
- **REGLA DE ORO**: Los módulos están completamente separados. Entrenamiento en casa y metodologías/rutinas son mundos diferentes con historiales, tablas, rutas y componentes propios.

### Características de BD
- **PostgreSQL 16**: Base de datos principal
- **search_path**: `app,public` (configurado automáticamente)
- **Funciones**: `can_use_exercise()` para control de repetición
- **Triggers**: Validaciones automáticas
- **JSONB**: Almacenamiento flexible para datos de entrenamientos

## 🔧 API Endpoints

### Rutas Principales
```
/api/auth/*                    # Autenticación (login, register)
/api/users/*                   # Gestión de usuarios
/api/home-training/*           # Entrenamiento en casa
/api/ia-home-training/*        # IA para entrenamiento casero
/api/methodologie/*            # Metodologías automáticas
/api/methodology-manual/*      # Metodologías manuales
/api/ai-photo-correction/*     # Corrección por foto
/api/ai/*                      # Corrección por video
/api/routines/*                # Sistema de rutinas
/api/body-composition/*        # Composición corporal
/api/equipment/*               # Equipamiento
/api/exercises/*               # Base de datos de ejercicios
```

### Funcionalidades por Endpoint
- **Health check**: `/api/health`
- **Test IA**: `/api/test-ai-modules` (validación de módulos)
- **Upload**: `/api/uploads/*` (subida de archivos)

## 🧩 Componentes Frontend

### Sistema de Metodologías
- **MethodologiesScreen**: Pantalla principal con selección automática/manual
- **MethodologyCard**: Tarjetas de metodologías con información
- **MethodologyDetailsDialog**: Modal detallado con tabs informativos
- **MethodologyConfirmationModal**: Confirmación de selección

### Entrenamiento en Casa
- **HomeTrainingSection**: Componente principal
- **HomeTrainingCard**: Tarjetas de planes generados
- **HomeTrainingProgress**: Seguimiento de progreso
- **HomeTrainingExerciseModal**: Modal de ejecución de ejercicios

### Sistema de Rutinas
- **RoutineScreen**: Pantalla principal del sistema
- **RoutineCalendar**: Calendario de entrenamientos
- **RoutineDayModal**: Modal de días específicos
- **RoutineExerciseModal**: Ejecución de ejercicios

### Perfil de Usuario
- **ProfileSection**: Gestión completa del perfil
- **BasicInfoTab**: Información básica
- **BodyCompositionTab**: Composición corporal
- **GoalsTab**: Objetivos de entrenamiento
- **EquipmentTab**: Equipamiento disponible

## 📱 Rutas de Navegación

```javascript
'/'                    # HomePage (dashboard principal)
'/home-training'       # Entrenamiento en casa
'/methodologies'       # Sistema de metodologías  
'/routines'           # Sistema de rutinas
'/video-correction'   # Corrección por video
'/profile'            # Perfil de usuario
'/login'              # Inicio de sesión
'/register'           # Registro de usuario
```

## 🎨 Sistema de Diseño

### Colores
- **Fondo**: Gradientes oscuros (`from-gray-950 to-gray-900`)
- **Acento principal**: Amarillo (`bg-yellow-400`, `text-yellow-400`)
- **Texto**: Blanco y grises (`text-white`, `text-gray-300`)
- **Bordes**: Grises sutiles (`border-gray-800`)

### Componentes UI Base
- **Button**: Variantes primary, secondary, outline, ghost
- **Card**: Contenedores con bordes y fondos
- **Dialog**: Modales con overlay
- **Tabs**: Sistema de pestañas
- **Input**: Campos de formulario
- **Badge**: Etiquetas informativas

## 🔄 Flujos Principales

### 1. Generación de Rutina en Casa
```
Usuario selecciona equipamiento 
→ Elige tipo de entrenamiento (HIIT/Funcional/Fuerza)
→ Backend consulta perfil + historial
→ IA genera plan personalizado
→ Se guarda en BD
→ Usuario puede iniciar sesión
```

### 2. Metodología Automática
```
Usuario activa "Activar IA"
→ Backend analiza perfil completo
→ IA selecciona mejor metodología
→ Genera plan de 4-5 semanas
→ Usuario confirma y se guarda
→ Navegación a rutinas
```

### 3. Metodología Manual
```
Usuario selecciona metodología específica
→ Modal de confirmación con detalles
→ IA genera plan según metodología elegida
→ Respeta restricciones específicas
→ Plan guardado y navegación
```

## ⚙️ Variables de Entorno

### Backend (.env)
```bash
# Base de datos
DATABASE_URL=postgresql://...
DB_SEARCH_PATH=app,public

# OpenAI API Keys (específicas por módulo)
OPENAI_API_KEY_CORRECTION_VIDEO=sk-...
OPENAI_API_KEY_HOME_TRAINING=sk-...
OPENAI_API_KEY_CORRECTION_PHOTO=sk-...
OPENAI_API_KEY_METHODOLOGIE=sk-...
OPENAI_API_KEY_METHODOLOGIE_MANUAL=sk-...

# Servidor
PORT=3002
NODE_ENV=development
```

## 🚀 Comandos de Desarrollo

### Frontend
```bash
npm run dev          # Servidor desarrollo (puerto 5173)
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Linting con ESLint
```

### Backend
```bash
cd backend
npm start           # Servidor backend (puerto 3002)
```

## 📝 Estado Actual del Desarrollo

### ✅ Funcionalidades Completadas
- [x] Sistema de autenticación completo
- [x] Perfil de usuario con BD
- [x] Entrenamiento en casa con IA
- [x] Sistema de metodologías (automático + manual)
- [x] Sistema de rutinas y calendario
- [x] Corrección por foto/video
- [x] Gestión de equipamiento
- [x] Composición corporal
- [x] Sistema de progreso

### 🔄 En Desarrollo
- [ ] Análisis avanzado por video
- [ ] Gamificación y logros
- [ ] Nutrición personalizada
- [ ] Sistema de estadísticas
- [ ] Notificaciones push

### 📋 Archivos Clave para Modificaciones

#### Para añadir nuevos ejercicios:
- `/backend/routes/exercises.js`
- `/src/config/exerciseGifs.js`

#### Para modificar prompts de IA:
- `/backend/prompts/*.md`
- `/backend/lib/promptRegistry.js`

#### Para nueva funcionalidad en perfil:
- `/src/components/profile/*`
- `/backend/routes/users.js`

#### Para nuevas metodologías:
- `/src/components/Methodologie/methodologiesData.js`
- `/backend/routes/aiMethodologie.js`

## 🔍 Debugging y Logs

### Backend Logs
- Inicialización: Validación de API keys y prompts
- Requests: Logging automático de todas las peticiones
- Errores: Stack traces en desarrollo

### Frontend Debugging
- React DevTools disponible
- Console logs para estados importantes
- Error boundaries implementados

## 📚 Documentación Adicional

### Archivos de Documentación
- `docs/README.md`: Índice general
- `docs/ARCHITECTURE.md`: Arquitectura detallada
- `docs/COMPONENTS.md`: Guía de componentes
- `docs/FUNCIONALIDADES.md`: Funcionalidades implementadas
- `docs/DATABASE.md`: Esquema de base de datos
- `docs/IA_INTEGRATION.md`: Integración con IA

### Instrucciones de Implementación
- `INSTRUCCIONES_IMPLEMENTACION.md`: Guía paso a paso
- `SISTEMA_IA_OPTIMIZADO.md`: Sistema de IA optimizado

---

## 💡 Notas para Claude

### Patrones Comunes del Código
1. **Componentes React**: Usan hooks personalizados para lógica de estado
2. **API calls**: Centralizadas con manejo de errores consistente
3. **Modales**: Patrón consistente con Radix UI Dialog
4. **Formularios**: React Hook Form + validación personalizada
5. **Estados**: Context API para estado global, useState para local

### Convenciones de Naming
- **Archivos**: PascalCase para componentes, camelCase para utilities
- **Variables**: camelCase para JS, snake_case para BD
- **CSS**: Tailwind classes, sem custom CSS
- **API**: RESTful con prefijo `/api/`

### Arquitectura de Decisiones
- **Monorepo**: Frontend y backend en mismo repo
- **Database First**: Esquema PostgreSQL como fuente de verdad  
- **Component Composition**: Componentes reutilizables sobre duplicación
- **Type Safety**: PropTypes + validación manual (no TypeScript aún)

Este documento debe actualizarse cada vez que se realicen cambios significativos en la arquitectura, nuevas funcionalidades, o modificaciones en el sistema de IA.