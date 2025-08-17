## Actualización técnica (2025-08-17)

- Frontend (React + Vite)
  - Perfil enlazado a backend: GET/PUT /api/users/:id (Auth Bearer)
  - Entrenamiento en casa (HomeTrainingSection):
    - Trigger 1 (equipamiento): minimo | basico | avanzado
    - Trigger 2 (tipo): funcional | hiit | fuerza
    - Botón “Generar Mi Entrenamiento” -> llama al backend
    - Muestra modal con plan y ejercicios; persiste plan y permite iniciar sesión de entrenamiento
  - Persistencia local: userProfile en localStorage sincronizado tras leer la API

- Backend (Express + pg)
  - Rutas principales:
    - /api/auth (register, login, verify)
    - /api/users (GET/PUT perfil)
    - /api/medical-docs (PDFs)
    - /api/home-training
      - POST /plans (guardar plan IA)
      - GET /current-plan (último plan + sesión en progreso)
      - POST /sessions/start (iniciar sesión)
      - PUT /sessions/:id/exercise/:order (progreso)
      - GET /sessions/:id/progress (estado de la sesión)
      - GET /stats (estadísticas de usuario)
    - /api/ia-home-training
      - POST /generate (OpenAI: gpt-4o-mini, temperature 0.30, response_format=json_object)
  - OpenAI API Key: OPENAI_API_KEY (backend/.env). Se respeta el prompt definido por producto.
  - search_path de PostgreSQL forzado por conexión a "app,public".

- Base de datos (PostgreSQL)
  - Esquema operativo confirmado en esquema "app":
    - users
    - home_training_plans
    - home_training_sessions
    - home_exercise_progress
    - user_home_training_stats
  - Columnas ARRAY (TEXT[]) confirmadas: alergias, medicamentos, suplementacion, alimentos_excluidos, limitaciones_fisicas.

- Variables de entorno (backend/.env ejemplo)
  - DATABASE_URL=postgresql://.../entrenaconia
  - OPENAI_API_KEY=sk-...
  - PORT=3001
  - NODE_ENV=development

- Notas
  - La generación IA ahora se hace exclusivamente en el backend (no se expone la API key en el cliente).
  - El frontend sigue guardando el plan en home_training_plans tras recibirlo del backend.
  - Se ha eliminado código de pruebas y archivos temporales (ver commit de limpieza).

# Stack Técnico - Entrena con IA

## 🏗️ Arquitectura del Sistema

### Frontend (React + Vite)
```
Puerto: 5174
Framework: React 18.2.0
Build Tool: Vite 5.0.0
Styling: Tailwind CSS 3.4.0
Componentes: shadcn/ui
Iconos: Lucide React
Estado: React Hooks + localStorage
```

### Backend (Node.js + Express)
```
Puerto: 3001
Runtime: Node.js 18+
Framework: Express 4.18.2
Base de Datos: PostgreSQL 16.8
ORM: pg (node-postgres)
Archivos: Multer 1.4.5
PDF: pdf-parse 1.1.1
IA: OpenAI API 4.20.1
```

### Base de Datos (PostgreSQL)
```
Host: localhost
Puerto: 5432
Base de Datos: entrenaconia
Usuario: postgres
Contraseña: postgres
Versión: PostgreSQL 16.8
```

## 📊 Esquema de Datos Confirmado

### Tablas Principales (✅ CREADAS)
1. **users** - Perfil completo del usuario
2. **equipamiento_casa** - Equipamiento disponible por usuario
3. **preferencias_entrenamiento** - Configuración de entrenamientos
4. **rutinas** - Rutinas generadas por IA
5. **ejercicios_realizados** - Historial de entrenamientos
6. **progreso_usuario** - Seguimiento de medidas y progreso

### Campos Clave para IA
```sql
-- Datos demográficos
edad, sexo, peso, altura, nivel_actividad, años_entrenando

-- Equipamiento (triggers)
mancuernas, bandas_elasticas, colchoneta,           -- Básico
barra_dominadas, kettlebells, banco_ejercicio,      -- Avanzado
trx, bosu, cuerda_saltar, step                      -- Funcional

-- Tipo de entrenamiento (triggers)
tipo_entrenamiento: 'funcional' | 'hiit' | 'fuerza'

-- Objetivos y restricciones
objetivo_principal, alergias[], medicamentos[]
```

## 🎯 Flujo de Entrenamiento (CONFIRMADO)

### Secuencia del Usuario
```
1. Acceso → "Entrenamiento en Casa"
2. Trigger 1 → Selecciona Equipamiento (Básico/Avanzado/Funcional)
3. Trigger 2 → Selecciona Tipo (Funcional/HIIT/Fuerza)
4. Acción → "Generar mi Entrenamiento"
5. Resultado → Modal con rutina personalizada
```

### Ejemplo Confirmado: HIIT + Avanzado
```
Input:
- Equipamiento: Avanzado (barra_dominadas, kettlebells, banco_ejercicio)
- Tipo: HIIT
- Usuario: 30 años, 70kg, 175cm, nivel moderado, 1 año experiencia

Output Modal:
┌─────────────────────────────────────────────────────────────┐
│ HIIT en Casa - Mejora de Forma Física                      │
│ Personalizado para nivel intermedio                        │
│                                                             │
│ Perfil: Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm   │
│ Nivel: Moderado, IMC: 22.9, Lesiones: Ninguna             │
│                                                             │
│ Ejercicios del Plan:                                        │
│ • Burpees - Series: 4, Duración: 30s, Descanso: 30s      │
│ • Sentadillas con salto - Series: 4, Duración: 30s, 30s   │
│ • Flexiones de brazos - Series: 4, Duración: 30s, 30s     │
│ • Planchas laterales alternas - Series: 4, 30s, 30s       │
│ • Escaladores - Series: 4, Duración: 30s, Descanso: 30s   │
│                                                             │
│ [Generar Otro Plan] [Comenzar Entrenamiento]              │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuración Técnica

### Variables de Entorno
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/entrenaconia
OPENAI_API_KEY=sk-...
PORT=3001
NODE_ENV=development
UPLOAD_DIR=uploads
MAX_FILE_SIZE=26214400  # 25MB
```

### Dependencias Principales

#### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.3",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.14",
    "postcss": "^8.4.24"
  }
}
```

#### Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "multer": "^1.4.5",
    "pdf-parse": "^1.1.1",
    "openai": "^4.20.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

## 🚀 Comandos de Desarrollo

### Instalación
```bash
# Frontend
npm install

# Backend
cd backend
npm install
npm install multer pdf-parse  # Dependencias adicionales
```

### Ejecución
```bash
# Terminal 1 - Frontend
npm run dev  # Puerto 5174

# Terminal 2 - Backend
cd backend
npm run dev  # Puerto 3001
```

### Base de Datos
```bash
# Conectar a PostgreSQL
psql -h localhost -p 5432 -U postgres

# Crear base de datos
CREATE DATABASE entrenaconia;

# Ejecutar esquema
\i database_schema.sql
```

## 🔍 Endpoints API

### Documentación Médica
```
GET    /api/users/:id/medical-docs           # Listar documentos
POST   /api/users/:id/medical-docs           # Subir documento
GET    /api/users/:id/medical-docs/:docId/view  # Ver PDF
DELETE /api/users/:id/medical-docs/:docId    # Eliminar documento
POST   /api/users/:id/medical-docs/:docId/extract  # Extraer texto
```

### Usuarios y Perfil
```
GET    /api/users/:id                        # Obtener perfil
PUT    /api/users/:id                        # Actualizar perfil
GET    /api/users/:id/equipamiento           # Obtener equipamiento
PUT    /api/users/:id/equipamiento           # Actualizar equipamiento
```

### Rutinas y Entrenamientos
```
POST   /api/users/:id/rutinas                # Generar rutina con IA
GET    /api/users/:id/rutinas                # Listar rutinas
POST   /api/users/:id/ejercicios             # Registrar ejercicio realizado
GET    /api/users/:id/progreso               # Obtener progreso
```

## 🤖 Integración IA (OpenAI)

### Modelo Utilizado
```
Modelo: gpt-4o-mini
Temperatura: 0.7
Max Tokens: 2000
```

### Prompt Template
```javascript
const prompt = `
Genera una rutina de entrenamiento personalizada:

PERFIL: ${user.edad} años, ${user.sexo}, ${user.peso}kg, ${user.altura}cm
EXPERIENCIA: ${user.años_entrenando} años, nivel ${user.nivel_actividad}
OBJETIVO: ${user.objetivo_principal}

EQUIPAMIENTO SELECCIONADO: ${equipamiento_trigger}
TIPO SELECCIONADO: ${tipo_trigger}

Genera un modal con ejercicios específicos, series, duración y descansos.
`;
```

### Respuesta Esperada
```json
{
  "titulo": "string",
  "subtitulo": "string",
  "mensaje_motivacional": "string",
  "ejercicios": [
    {
      "nombre": "string",
      "series": number,
      "duracion": "string",
      "descanso": "string",
      "instrucciones": "string"
    }
  ]
}
```

## 📁 Estructura de Archivos

### Frontend
```
src/
├── components/
│   ├── profile/              # Gestión de perfil
│   │   ├── ProfileSection.jsx
│   │   ├── BasicInfoTab.jsx
│   │   ├── BodyCompositionTab.jsx
│   │   ├── BodyCompositionCalculator.jsx
│   │   ├── MedicalDocsCard.jsx
│   │   └── ...
│   ├── ui/                   # Componentes base
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   └── badge.jsx
│   └── EditableField.jsx     # Campo reutilizable
├── hooks/
│   └── useProfileState.js    # Estado centralizado
├── pages/
└── styles/
```

### Backend
```
backend/
├── routes/
│   ├── medicalDocs.js        # API documentos médicos
│   ├── users.js              # API usuarios
│   └── rutinas.js            # API rutinas IA
├── uploads/                  # Archivos subidos
│   └── medical/
│       └── {userId}/
├── db.js                     # Configuración BD
└── server.js                 # Servidor principal
```

## 🔒 Seguridad y Validaciones

### Validaciones Frontend
- Tipos de archivo (solo PDF)
- Tamaño máximo (25MB)
- Campos obligatorios
- Rangos de valores (peso, altura, edad)

### Validaciones Backend
- Sanitización de inputs
- Validación de tipos de datos
- Límites de archivos
- Verificación de permisos

### Base de Datos
- Constraints en campos
- Índices para performance
- Triggers para auditoría
- Backup automático

## 📈 Performance y Optimización

### Frontend
- Lazy loading de componentes
- Memoización de cálculos
- Debounce en inputs
- Compresión de imágenes

### Backend
- Índices en consultas frecuentes
- Pool de conexiones BD
- Cache de respuestas IA
- Compresión de respuestas

### Base de Datos
- Índices optimizados
- Particionado de tablas grandes
- Vacuum automático
- Estadísticas actualizadas

## 🚀 Estado Actual del Sistema

✅ **Frontend**: Completamente funcional
✅ **Backend**: APIs implementadas
✅ **Base de Datos**: Esquema confirmado y operativo
✅ **Perfil de Usuario**: Sistema completo con calculadora
✅ **Documentación Médica**: Subida, visualización y gestión
✅ **Flujo de Entrenamiento**: Triggers funcionando
✅ **Integración IA**: Lista para implementar

**Próximo paso**: Conectar generación de rutinas con OpenAI API
