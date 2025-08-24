# 💪 Aplicación de Entrenamiento Personal con IA

## 📋 Índice
- [Descripción General](#descripción-general)
- [Arquitectura de la Aplicación](#arquitectura-de-la-aplicación)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Funcionalidades Principales](#funcionalidades-principales)
- [Guía de Estilos](#guía-de-estilos)
- [Documentación Técnica](#documentación-técnica)

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
- **Base de Datos**: Supabase (PostgreSQL)
- **IA**: OpenAI GPT-4
- **Autenticación**: Supabase Auth
- **Estilos**: CSS Modules + Variables CSS globales

### Flujo de Datos
```
Usuario → Frontend React → API Backend → Supabase DB
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
│   ├── lib/                 # Configuraciones (Supabase)
│   ├── services/            # Servicios API
│   ├── styles/              # Estilos globales y módulos CSS
│   └── types/               # Tipos TypeScript
├── server/                  # Backend Node.js
│   ├── index.js            # Servidor Express
│   └── routes/             # Rutas API
├── prompts/                # Prompts para OpenAI
└── docs/                   # Documentación
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

## 🎨 Guía de Estilos

Ver [STYLE_GUIDE.md](./STYLE_GUIDE.md) para detalles completos sobre:
- Colores y temas
- Tipografía
- Componentes UI
- Animaciones

## 📚 Documentación Técnica

- [Arquitectura Técnica](./TECHNICAL_ARCHITECTURE.md)
- [Flujo de Datos](./DATA_FLOW.md)
- [Guía de Componentes](./COMPONENTS_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Mejoras Propuestas](./IMPROVEMENTS.md)