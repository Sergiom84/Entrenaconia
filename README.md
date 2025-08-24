# Entrena con IA

Una aplicación web completa para generar rutinas de entrenamiento personalizadas usando inteligencia artificial, con gestión completa de perfiles de usuario y documentación médica.

## 🚀 Características Principales

### 👤 Gestión de Perfil Completa
- **Información Básica**: Datos personales, medidas corporales, nivel de actividad
- **Composición Corporal**: Calculadora automática con fórmulas científicas (Harris-Benedict, US Navy)
- **Experiencia**: Metodologías de entrenamiento, años de experiencia
- **Preferencias**: Horarios, enfoques de entrenamiento, suplementación
- **Objetivos**: Metas específicas con seguimiento de progreso
- **Salud**: Alergias, medicamentos, documentación médica con análisis IA

### 🏠 Entrenamiento en Casa
- **Equipamiento**: Gestión de equipamiento básico, avanzado y funcional
- **Tipos de Entrenamiento**: Funcional, HIIT, Fuerza
- **Rutinas Personalizadas**: Generadas por IA según perfil y equipamiento
- **Seguimiento**: Historial de ejercicios y progreso
- **Flujo Inteligente**: Selección por triggers → Generación automática → Modal detallado

### 📄 Documentación Médica
- **Subida de PDFs**: Hasta 25MB con validación automática
- **Análisis IA**: Extracción y resumen automático de información médica
- **Previsualización**: Visor integrado de documentos
- **Gestión Completa**: CRUD de documentos con metadatos

### 🤖 Inteligencia Artificial
- **Rutinas Personalizadas**: Basadas en perfil completo del usuario
- **Análisis Médico**: Procesamiento de documentos médicos
- **Recomendaciones**: Adaptadas a objetivos y limitaciones
- **Generación por Triggers**: Sistema de selección inteligente (Equipamiento + Tipo)
- **Modal Detallado**: Planes específicos con ejercicios, series, duración y descansos

## 🛠️ Tecnologías

### Frontend
- **React 18** + **Vite** - Framework y build tool
- **Tailwind CSS** - Styling y diseño responsive
- **shadcn/ui** - Componentes UI modernos
- **Lucide React** - Iconografía

### Backend
- **Node.js** + **Express** - Servidor y API REST
- **PostgreSQL** - Base de datos principal
- **Multer** - Gestión de archivos
- **pdf-parse** - Extracción de texto de PDFs
- **OpenAI API** - Inteligencia artificial

### Base de Datos
- **PostgreSQL 16.8** - Base de datos principal
- **JSONB** - Almacenamiento flexible para documentos
- **Triggers** - Actualización automática de timestamps
- **Índices** - Optimización de consultas

## 📊 Esquema de Base de Datos

### Tablas Principales
- `users` - Información completa del usuario y perfil
- `equipamiento_casa` - Equipamiento disponible por usuario
- `preferencias_entrenamiento` - Configuración de entrenamientos
- `rutinas` - Rutinas generadas por IA
- `ejercicios_realizados` - Historial de entrenamientos
- `progreso_usuario` - Seguimiento de medidas y progreso

### Configuración de Base de Datos
```
Host: localhost
Port: 5432
Database: entrenaconia
Usuario: postgres
Contraseña: postgres
```

## 🚀 Instalación y Configuración

### 1. Prerrequisitos
```bash
# Node.js 18+ y npm
node --version
npm --version

# PostgreSQL 16+
psql --version
```

### 2. Configuración de Base de Datos
```bash
# Conectar a PostgreSQL
psql -h localhost -p 5432 -U postgres

# Crear base de datos
CREATE DATABASE entrenaconia;

# Ejecutar script de esquema (usar database_schema.sql)
\i database_schema.sql
```

### 3. Instalación del Proyecto
```bash
# Clonar repositorio
git clone [URL_DEL_REPO]
cd Entrena_con_IA

# Instalar dependencias del frontend
npm install

# Instalar dependencias del backend
cd backend
npm install
```

### 4. Variables de Entorno
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/entrenaconia
OPENAI_API_KEY=tu_api_key_de_openai
PORT=3001
```

### 5. Dependencias Adicionales del Backend
```bash
cd backend
npm install multer pdf-parse
```

## 🏃‍♂️ Ejecución

### Desarrollo
```bash
# Terminal 1 - Frontend (puerto 5174)
npm run dev

# Terminal 2 - Backend (puerto 3001)
cd backend
npm run dev
```

### Acceso
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3001
- **Perfil de Usuario**: http://localhost:5174/profile
- **Entrenamiento en Casa**: http://localhost:5174/entrenamiento-casa

## 🎯 Flujo de Entrenamiento en Casa

### Secuencia del Usuario
1. **Acceso**: Usuario navega a "Entrenamiento en Casa"
2. **Primer Trigger**: Selecciona tipo de equipamiento
   - **Básico**: Mancuernas, bandas elásticas, colchoneta
   - **Avanzado**: Barra dominadas, kettlebells, banco, rack sentadillas
   - **Funcional**: TRX, BOSU, cuerda saltar, step
3. **Segundo Trigger**: Selecciona tipo de entrenamiento
   - **Funcional**: Movimientos naturales y funcionales
   - **HIIT**: Alta intensidad por intervalos
   - **Fuerza**: Desarrollo de fuerza máxima
4. **Generación**: Presiona "Generar mi Entrenamiento"
5. **Modal IA**: Se abre con rutina personalizada completa

### Ejemplo de Modal Generado
```
HIIT en Casa - Mejora de Forma Física
Personalizado para nivel intermedio

¡Hola! Veo que tu objetivo es mejorar tu forma física. Con un año de experiencia
y un nivel de actividad moderado, he diseñado un plan HIIT con equipamiento
mínimo que te ayudará a maximizar tu rendimiento y alcanzar tus metas.

Fuente del plan: OpenAI
Perfil: Usuario — Edad: 30, Peso: 70 kg, Altura: 175 cm, Nivel: Moderado,
IMC: 22.9, Lesiones: Ninguna

Progreso: [████████████████████████████████████████] 0%

Ejercicios del Plan:
• Burpees - Series: 4, Duración: 30s, Descanso: 30s
• Sentadillas con salto - Series: 4, Duración: 30s, Descanso: 30s
• Flexiones de brazos - Series: 4, Duración: 30s, Descanso: 30s
• Planchas laterales alternas - Series: 4, Duración: 30s, Descanso: 30s
• Escaladores - Series: 4, Duración: 30s, Descanso: 30s

[Generar Otro Plan] [Comenzar Entrenamiento]
```

## 📁 Estructura del Proyecto

```
Entrena_con_IA/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── profile/             # Componentes del perfil
│   │   │   ├── ProfileSection.jsx
│   │   │   ├── BasicInfoTab.jsx
│   │   │   ├── BasicInfoCard.jsx
│   │   │   ├── BodyCompositionTab.jsx
│   │   │   ├── BodyCompositionCard.jsx
│   │   │   ├── BodyCompositionCalculator.jsx
│   │   │   ├── ExperienceTab.jsx
│   │   │   ├── ExperienceCard.jsx
│   │   │   ├── PreferencesCard.jsx
│   │   │   ├── GoalsTab.jsx
│   │   │   ├── GoalsCard.jsx
│   │   │   ├── HealthTab.jsx
│   │   │   ├── MedicalDocsCard.jsx
│   │   │   └── SettingsTab.jsx
│   │   ├── ui/                  # Componentes UI base
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   └── badge.jsx
│   │   └── EditableField.jsx    # Campo editable reutilizable
│   ├── hooks/
│   │   └── useProfileState.js   # Hook centralizado del perfil
│   ├── pages/
│   └── styles/
├── backend/                      # Backend Node.js
│   ├── routes/
│   │   ├── medicalDocs.js       # API documentación médica
│   │   └── users.js             # API usuarios
│   ├── db.js                    # Configuración base de datos
│   └── server.js                # Servidor principal
├── database_schema.sql          # Script de base de datos
└── README.md                    # Documentación

```

## 🗃️ Información de Base de Datos para IA

### Datos del Usuario que la IA Puede Leer

#### Perfil Básico (tabla `users`)
```sql
-- Datos demográficos
edad, sexo, peso, altura, nivel_actividad, años_entrenando

-- Composición corporal
grasa_corporal, masa_muscular, agua_corporal, metabolismo_basal

-- Medidas corporales
cintura, cuello, cadera, pecho, brazo, muslo

-- Experiencia y preferencias
metodologia, enfoque, horario_preferido, objetivo_principal

-- Salud
alergias[], medicamentos[], historial_medico_docs
```

#### Equipamiento Disponible (tabla `equipamiento_casa`)
```sql
-- Básico
mancuernas, bandas_elasticas, colchoneta, pelota_ejercicio

-- Avanzado
barra_dominadas, kettlebells, banco_ejercicio, rack_sentadillas,
barra_olimpica, discos_peso

-- Funcional
trx, bosu, cuerda_saltar, step
```

#### Preferencias de Entrenamiento (tabla `preferencias_entrenamiento`)
```sql
-- Configuración
tipo_entrenamiento (funcional|hiit|fuerza)
duracion_sesion, frecuencia_semanal, intensidad
```

### Consultas SQL para la IA

#### Obtener Perfil Completo para Generación de Rutinas
```sql
-- Query principal que usa la IA para generar entrenamientos
SELECT
    -- Datos demográficos básicos
    u.peso, u.altura, u.edad, u.sexo, u.nivel_actividad, u.años_entrenando,

    -- Objetivos y metodología
    u.metodologia, u.enfoque, u.objetivo_principal,

    -- Composición corporal
    u.grasa_corporal, u.masa_muscular, u.metabolismo_basal,

    -- Equipamiento básico
    e.mancuernas, e.bandas_elasticas, e.colchoneta, e.pelota_ejercicio,

    -- Equipamiento avanzado
    e.barra_dominadas, e.kettlebells, e.banco_ejercicio, e.rack_sentadillas,
    e.barra_olimpica, e.discos_peso,

    -- Equipamiento funcional
    e.trx, e.bosu, e.cuerda_saltar, e.step,

    -- Preferencias de entrenamiento
    p.tipo_entrenamiento, p.duracion_sesion, p.frecuencia_semanal, p.intensidad,

    -- Restricciones médicas
    u.alergias, u.medicamentos

FROM users u
LEFT JOIN equipamiento_casa e ON u.id = e.user_id
LEFT JOIN preferencias_entrenamiento p ON u.id = p.user_id
WHERE u.id = $1;
```

#### Guardar Rutina Generada
```sql
-- Insertar rutina generada por IA
INSERT INTO rutinas (
    user_id, nombre, descripcion, tipo, duracion_estimada, nivel,
    ejercicios, equipamiento_requerido, generada_por_ia, prompt_original
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, true, $9
) RETURNING id;
```

#### Obtener Historial de Entrenamientos
```sql
SELECT fecha_realizacion, ejercicio_nombre, series, repeticiones, peso_usado
FROM ejercicios_realizados
WHERE user_id = $1
ORDER BY fecha_realizacion DESC
LIMIT 10;
```

## 🤖 Integración con IA

### Sistema de Triggers para Generación
El sistema utiliza un flujo de dos triggers para personalizar la generación:

1. **Trigger 1 - Equipamiento**: Usuario selecciona tipo de equipamiento disponible
2. **Trigger 2 - Tipo de Entrenamiento**: Usuario selecciona modalidad preferida
3. **Generación**: IA combina perfil + triggers para crear rutina personalizada

### Prompt Base para Generación de Rutinas
```
Genera una rutina de entrenamiento personalizada con los siguientes datos:

PERFIL DEL USUARIO:
- Edad: {edad} años
- Sexo: {sexo}
- Peso: {peso} kg
- Altura: {altura} cm
- Nivel de actividad: {nivel_actividad}
- Años entrenando: {años_entrenando}
- Objetivo principal: {objetivo_principal}
- IMC: {imc}

EQUIPAMIENTO SELECCIONADO: {equipamiento_trigger}
{lista_equipamiento_disponible}

TIPO DE ENTRENAMIENTO SELECCIONADO: {tipo_trigger}
- Modalidad: {tipo_entrenamiento}
- Duración preferida: {duracion_sesion} minutos
- Frecuencia: {frecuencia_semanal} días/semana
- Intensidad: {intensidad}

RESTRICCIONES MÉDICAS:
- Alergias: {alergias}
- Medicamentos: {medicamentos}

FORMATO DE RESPUESTA:
Genera un modal con:
1. Título descriptivo del plan
2. Personalización para el nivel del usuario
3. Mensaje motivacional personalizado
4. Lista de ejercicios con: nombre, series, duración/repeticiones, descanso
5. Instrucciones específicas para cada ejercicio

El plan debe ser específico para el equipamiento y tipo seleccionado.
```

### Ejemplo de Respuesta IA
```json
{
  "titulo": "HIIT en Casa - Mejora de Forma Física",
  "subtitulo": "Personalizado para nivel intermedio",
  "mensaje_motivacional": "¡Hola! Veo que tu objetivo es mejorar tu forma física...",
  "duracion_total": 20,
  "ejercicios": [
    {
      "nombre": "Burpees",
      "series": 4,
      "duracion": "30s",
      "descanso": "30s",
      "instrucciones": "Mantén un ritmo constante y asegúrate de realizar el salto al final de cada repetición."
    }
  ],
  "equipamiento_usado": ["peso_corporal", "espacio_minimo"],
  "nivel_dificultad": "intermedio"
}
```

## 🔧 Configuración Adicional

### Variables de Entorno Completas
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/entrenaconia
OPENAI_API_KEY=sk-...
PORT=3001
NODE_ENV=development

# Configuración de archivos
UPLOAD_DIR=uploads
MAX_FILE_SIZE=26214400  # 25MB en bytes
```

### Dependencias del Backend
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

## 📝 Notas de Desarrollo

### Estados del Perfil
- **Completitud**: Se calcula automáticamente basado en campos completados
- **Validación**: Campos obligatorios y tipos de datos
- **Persistencia**: localStorage + base de datos

### Flujo de Documentación Médica
1. Usuario sube PDF (máx 25MB)
2. Archivo se almacena en `/uploads/medical/{userId}/`
3. Metadatos se guardan en `historial_medico_docs` (JSONB)
4. IA puede extraer texto y generar resumen
5. Información se integra en recomendaciones

### Calculadora de Composición Corporal
- **IMC**: peso / (altura_m)²
- **Grasa corporal**: Fórmula US Navy
- **Metabolismo basal**: Harris-Benedict
- **Agua corporal**: 60% hombres, 55% mujeres

