# Módulo: Entrenamiento en Casa - Entrena con IA

## Estado actual (2025-08-17)

- Triggers UI: equipamiento (minimo, basico, avanzado) y tipo (funcional, hiit, fuerza)
- Botón “Generar Mi Entrenamiento” llama al backend /api/ia-home-training/generate
- Prompt de IA estandarizado (MindFit Coach) con salida JSON estricta
- Persistencia: el plan devuelto se guarda en home_training_plans
- Sistema de sesiones: start, progreso por ejercicio, completar, estadísticas por usuario
- Perfil: cargado desde BD al entrar; editable y persistido vía /api/users/:id (PUT)


> **⚠️ IMPORTANTE**: Este documento solo se actualizará cuando el usuario lo indique explícitamente.

## 🏠 Descripción del Módulo

El módulo "Entrenamiento en Casa" es una funcionalidad central de la aplicación que permite a los usuarios realizar entrenamientos completos y efectivos desde la comodidad de su hogar, utilizando equipamiento básico y el poder de la inteligencia artificial para personalización y corrección.

## 🎯 Objetivos Principales

- Proporcionar entrenamientos efectivos sin necesidad de gimnasio
- Adaptar rutinas según el equipamiento disponible del usuario
- Ofrecer corrección en tiempo real mediante IA
- Mantener la motivación a través de progreso visible
- Prevenir lesiones con análisis de técnica

## 🏋️ Tipos de Entrenamiento Soportados

### 1. Peso Corporal
- **Ejercicios**: Push-ups, squats, lunges, planks, burpees
- **Ventajas**: Sin equipamiento necesario, accesible para todos
- **Progresiones**: Variaciones de dificultad automáticas

### 2. Bandas Elásticas
- **Ejercicios**: Resistencia variable, trabajo de músculos específicos
- **Ventajas**: Portátil, versátil, bajo impacto
- **Niveles**: Diferentes resistencias según progreso

### 3. Mancuernas
- **Ejercicios**: Fuerza, tonificación, hipertrofia
- **Ventajas**: Progresión clara de peso, trabajo bilateral/unilateral
- **Adaptación**: Ajuste automático según capacidad

### 4. Entrenamiento Mixto
- **Combinaciones**: Circuitos que mezclan diferentes equipamientos
- **Variedad**: Previene monotonía y estancamiento
- **Eficiencia**: Maximiza resultados en tiempo limitado

## 🤖 Funcionalidades de IA

### Generación Inteligente de Rutinas
- [ ] **Cuestionario inicial**: Evaluación de nivel, objetivos y equipamiento
- [ ] **Algoritmo adaptativo**: Creación de rutinas personalizadas
- [ ] **Progresión automática**: Ajuste de dificultad según evolución
- [ ] **Variaciones dinámicas**: Prevención de estancamiento

### Análisis de Progreso
- [ ] **Métricas de rendimiento**: Tracking de repeticiones, series, peso
- [ ] **Evolución temporal**: Comparativas de progreso a lo largo del tiempo
- [ ] **Recomendaciones**: Sugerencias basadas en datos históricos
- [ ] **Ajustes automáticos**: Modificación de rutinas según resultados

## 📹 Sistema de Corrección por Video IA

### Captura y Análisis
- [ ] **Detección de postura**: Análisis de alineación corporal
- [ ] **Seguimiento de movimiento**: Evaluación de rango de movimiento
- [ ] **Identificación de errores**: Detección de técnica incorrecta
- [ ] **Feedback en tiempo real**: Correcciones instantáneas

### Características Técnicas
- [ ] **Procesamiento local**: Análisis en dispositivo para privacidad
- [ ] **Múltiples ángulos**: Soporte para diferentes posiciones de cámara
- [ ] **Calibración automática**: Ajuste según espacio disponible
- [ ] **Historial de sesiones**: Almacenamiento para revisión posterior

## 📱 Interfaz de Usuario del Módulo

### Pantallas Específicas
- [ ] **Configuración inicial**: Setup de equipamiento y espacio
- [ ] **Selección de rutina**: Catálogo de entrenamientos disponibles
- [ ] **Vista previa**: Demostración de ejercicios antes de comenzar
- [ ] **Entrenamiento activo**: Pantalla principal durante ejercicio
- [ ] **Resumen de sesión**: Métricas y logros post-entrenamiento

### Componentes UI Específicos
- [ ] **Equipment Selector**: Selector de equipamiento disponible
- [ ] **Exercise Demo**: Reproductor de demostraciones
- [ ] **Live Feedback**: Panel de correcciones en tiempo real
- [ ] **Progress Tracker**: Seguimiento de series y repeticiones
- [ ] **Rest Timer**: Cronómetro para descansos entre ejercicios

## 🎮 Elementos de Gamificación

### Sistema de Logros
- [ ] **Badges de consistencia**: Entrenamientos consecutivos
- [ ] **Mejoras de técnica**: Reconocimiento por forma correcta
- [ ] **Progresión de fuerza**: Incrementos en peso o repeticiones
- [ ] **Variedad de ejercicios**: Exploración de diferentes movimientos

### Motivación y Engagement
- [ ] **Streaks**: Rachas de entrenamientos
- [ ] **Challenges**: Desafíos semanales/mensuales
- [ ] **Progress photos**: Comparativas visuales de progreso
- [ ] **Social sharing**: Compartir logros (opcional)

## 🔧 Especificaciones Técnicas

### Requerimientos de Hardware
- **Cámara**: Resolución mínima 720p para análisis de movimiento
- **Espacio**: Área mínima de 2x2 metros para ejercicios
- **Iluminación**: Luz adecuada para detección precisa
- **Dispositivo**: Smartphone/tablet con capacidad de procesamiento IA

### Integración con Backend
- [ ] **Sincronización de datos**: Backup automático de progreso
- [ ] **Rutinas en la nube**: Acceso desde múltiples dispositivos
- [ ] **Análisis avanzado**: Procesamiento de patrones en servidor
- [ ] **Actualizaciones**: Nuevos ejercicios y rutinas automáticas

## 📊 Métricas y Analytics

### Datos de Usuario
- [ ] **Tiempo de entrenamiento**: Duración total y por ejercicio
- [ ] **Frecuencia**: Sesiones por semana/mes
- [ ] **Intensidad**: Nivel de esfuerzo percibido
- [ ] **Progresión**: Mejoras en fuerza, resistencia, técnica

### Insights de IA
- [ ] **Patrones de comportamiento**: Horarios preferidos, tipos de ejercicio
- [ ] **Predicción de adherencia**: Probabilidad de continuidad
- [ ] **Recomendaciones personalizadas**: Sugerencias basadas en datos
- [ ] **Optimización de rutinas**: Ajustes para máxima efectividad

---

**Estado de desarrollo**: Planificación inicial
**Prioridad**: Alta (próximo módulo a desarrollar)
**Dependencias**: Sistema de usuario, base de datos, integración IA
**Última actualización**: 16 de agosto de 2025
**Versión del documento**: 1.0
