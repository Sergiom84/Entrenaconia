# Funcionalidades - Entrena con IA

> **⚠️ IMPORTANTE**: Este documento solo se actualizará cuando el usuario lo indique explícitamente.

## 🎯 Visión General

Actualización 2025-08-17
- [x] Registro y login reales contra BD
- [x] Perfil conectado a BD (GET/PUT). Arrays: alergias, medicamentos, suplementacion, alimentos_excluidos, limitaciones_fisicas
- [x] Entrenamiento en Casa: generación IA desde backend (OpenAI gpt-4o-mini)
- [x] Guardado de planes y sistema de sesiones con progreso
- [x] Limpieza de archivos de prueba


Entrena con IA es una aplicación de entrenamiento personal que utiliza inteligencia artificial para proporcionar una experiencia de fitness personalizada y adaptativa.

## 🏠 Módulo: Entrenamiento en Casa

### Descripción
Modalidad multifuncional que permite entrenar desde casa utilizando equipamiento básico como bandas elásticas, mancuernas y ejercicios de peso corporal.

### Características Principales

#### 🤖 IA Adaptativa
- **Análisis en tiempo real**: Evaluación continua del progreso del usuario
- **Adaptación automática**: Ajuste de rutinas según evolución anatómica y metabólica
- **Personalización**: Rutinas adaptadas a objetivos específicos del usuario

#### 📹 Corrección por Video IA
- **Análisis de técnica**: Evaluación en tiempo real de la forma de ejercicio
- **Feedback inmediato**: Correcciones instantáneas durante el entrenamiento
- **Prevención de lesiones**: Detección de movimientos incorrectos

#### 🏋️ Equipamiento Soportado
- **Peso corporal**: Ejercicios sin equipamiento adicional
- **Bandas elásticas**: Rutinas con resistencia variable
- **Mancuernas**: Entrenamientos de fuerza y tonificación
- **Equipamiento mixto**: Combinación de diferentes herramientas

## 🚀 Funcionalidades Core

### 1. Sistema de Usuario
- [ ] Registro y autenticación
- [ ] Perfil de usuario personalizable
- [ ] Configuración de objetivos
- [ ] Historial de entrenamientos

### 2. Generación de Rutinas IA
- [ ] Cuestionario inicial de evaluación
- [ ] Generación automática de rutinas personalizadas
- [ ] Adaptación basada en progreso
- [ ] Variaciones según equipamiento disponible

### 3. Seguimiento de Entrenamientos
- [ ] Timer integrado para ejercicios
- [ ] Registro de repeticiones y series
- [ ] Tracking de peso utilizado
- [ ] Notas y observaciones del usuario

### 4. Análisis y Métricas
- [ ] Dashboard de progreso
- [ ] Gráficos de evolución
- [ ] Estadísticas de rendimiento
- [ ] Comparativas temporales

### 5. Corrección por Video
- [ ] Captura de video en tiempo real
- [ ] Análisis de postura y movimiento
- [ ] Feedback visual y auditivo
- [ ] Almacenamiento de sesiones para revisión

## 📱 Interfaz de Usuario

### Pantallas Principales
- [x] **Home**: Pantalla de inicio con características principales
- [ ] **Login/Registro**: Autenticación de usuarios
- [ ] **Dashboard**: Panel principal del usuario
- [ ] **Rutinas**: Listado y selección de entrenamientos
- [ ] **Entrenamiento**: Pantalla activa de ejercicio
- [ ] **Progreso**: Métricas y análisis de evolución
- [ ] **Perfil**: Configuración y datos del usuario

### Componentes UI
- [ ] **Timer**: Cronómetro para ejercicios y descansos
- [ ] **Exercise Card**: Tarjeta de ejercicio con instrucciones
- [ ] **Progress Bar**: Barra de progreso de rutina
- [ ] **Video Player**: Reproductor para demostraciones
- [ ] **Camera View**: Vista de cámara para corrección IA

## 🔧 Integraciones Técnicas

### OpenAI API
- [ ] Generación de rutinas personalizadas
- [ ] Análisis de progreso y recomendaciones
- [ ] Procesamiento de feedback del usuario
- [ ] Adaptación inteligente de entrenamientos

### Base de Datos
- [ ] Esquema de usuarios y perfiles
- [ ] Almacenamiento de rutinas y ejercicios
- [ ] Historial de entrenamientos
- [ ] Métricas y estadísticas

### Multimedia
- [ ] Subida y procesamiento de videos
- [ ] Almacenamiento de imágenes de progreso
- [ ] Streaming de video en tiempo real
- [ ] Compresión y optimización de archivos

## 🎯 Objetivos de UX/UI

### Experiencia de Usuario
- **Simplicidad**: Interfaz intuitiva y fácil de usar
- **Motivación**: Elementos gamificados y de progreso
- **Accesibilidad**: Diseño inclusivo para todos los usuarios
- **Personalización**: Adaptación a preferencias individuales

### Diseño Visual
- **Tema oscuro**: Fondo principal con gradientes
- **Acentos amarillos**: Color principal para CTAs e iconos
- **Tipografía clara**: Inter para legibilidad óptima
- **Animaciones suaves**: Transiciones fluidas sin distracciones

---

**Estado actual**: Pantalla de inicio implementada
**Próximo desarrollo**: Módulo de Entrenamiento en Casa
**Última actualización**: 16 de agosto de 2025
**Versión del documento**: 1.0
