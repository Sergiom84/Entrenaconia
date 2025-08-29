# 💪 Aplicación de Entrenamiento Personal con IA

## 📝 Descripción General

Esta aplicación es un sistema completo de entrenamiento personal potenciado por IA que ofrece:
- Planes de entrenamiento personalizados
- Seguimiento de progreso
- Análisis nutricional
- Entrenamiento en casa y gimnasio
- Diferentes metodologías de entrenamiento
- Chat con IA para asesoramiento personalizado

## 🏗️ Arquitectura de la Aplicación

### Stack Tecnológico
- **Frontend**: React con TypeScript
- **Backend**: Node.js con Express
- **Base de Datos**: PostgreSQL local
- **IA**: OpenAI GPT-4
- **Autenticación**: JWT con bcrypt
- **Estilos**: Tailwind CSS

### Flujo de Datos
```
Usuario → Frontend React → API Backend → PostgreSQL local
                         ↓
                    OpenAI API
                         ↓
                 Respuesta Personalizada
```

## 📁 Estructura del Proyecto

```
/
├── src/
│   ├── components/          # Componentes React reutilizables
│   │   ├── AIChat.tsx       # Chat con IA
│   │   ├── Dashboard.tsx    # Panel principal
│   │   ├── EntrenamientoCasa.tsx  # Módulo entrenamiento en casa
│   │   ├── EntrenamientoGimnasio.tsx  # Módulo entrenamiento gimnasio
│   │   ├── Metodologias.tsx # Diferentes metodologías
│   │   ├── Nutricion.tsx    # Módulo nutricional
│   │   └── UserProfile.tsx  # Perfil de usuario
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Configuraciones (API clients)
│   ├── services/            # Servicios API
│   ├── styles/              # Estilos globales y módulos CSS
│   └── types/               # Tipos TypeScript
├── server/                  # Backend Node.js
│   ├── index.js            # Servidor Express
│   └── routes/             # Rutas API
├── prompts/                # Prompts para OpenAI
```

## 🎯 Funcionalidades Principales

### 1. **Entrenamiento en Casa** (`EntrenamientoCasa.tsx`)
- Planes sin equipamiento
- Ejercicios con peso corporal
- Rutinas adaptadas al espacio disponible
- Seguimiento de progreso

### 2. **Entrenamiento en Gimnasio** (`EntrenamientoGimnasio.tsx`)
- Rutinas con equipamiento completo
- Planes por grupos musculares
- Periodización del entrenamiento
- Control de cargas

### 3. **Metodologías** (`Metodologias.tsx`)
- **Weider**: División por grupos musculares
- **Full Body**: Cuerpo completo
- **Push/Pull/Legs**: División funcional
- **Upper/Lower**: Tren superior/inferior
- **HIIT**: Alta intensidad
- **Funcional**: Movimientos cotidianos

### 4. **Nutrición** (`Nutricion.tsx`)
- Cálculo de macronutrientes
- Planes alimenticios
- Registro de comidas
- Análisis nutricional con IA

### 5. **Chat IA** (`AIChat.tsx`)
- Asesoramiento personalizado
- Respuestas basadas en el perfil del usuario
- Ajustes de rutinas en tiempo real
- Resolución de dudas

#

