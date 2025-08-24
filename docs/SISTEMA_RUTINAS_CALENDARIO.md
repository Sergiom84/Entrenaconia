# 📅 SISTEMA DE RUTINAS PERSONALIZADO

## 🎯 Funcionalidades Implementadas

### 🔧 Backend
- **Nuevo módulo IA**: `METHODOLOGIE` con API key específica
- **Endpoint**: `/api/methodologie/generate-plan` 
- **Prompt personalizado**: Carga desde `Methodologie_(Auto).md`
- **Configuración completa**: Integrada en sistema modular de IA

### 🎨 Frontend
- **Nueva sección**: `/routines` con navegación dedicada
- **Vista calendario**: Organización semanal de entrenamientos
- **Modales interactivos**: Detalles completos por día de entrenamiento
- **Navegación mejorada**: Indicador visual cuando hay rutinas disponibles

## 🔄 Flujo de Usuario

### 1. Generación de Rutina
1. Usuario va a **Metodologías**
2. Selecciona modo **Automático** o **Manual**  
3. Hace clic en **"Activar IA"**
4. IA analiza perfil y genera plan personalizado
5. Modal muestra resumen del plan generado
6. Automáticamente navega a **Rutinas**

### 2. Visualización de Rutinas  
1. **Vista calendario semanal** con días de entrenamiento y descanso
2. **Selector de semanas** (4-5 semanas según el plan)
3. **Clic en día** abre modal con detalles completos
4. **Información detallada**: Ejercicios, series, reps, descansos, intensidad

### 3. Navegación
- **Icono calendario** en navegación inferior
- **Indicador visual** (punto amarillo) cuando hay rutinas disponibles  
- **Estado activo** resaltado en navegación
- **Acceso directo** desde cualquier parte de la app

## 📊 Datos del Plan Generado

### Información General
- **Metodología seleccionada** (Heavy Duty, Powerlifting, Hipertrofia, etc.)
- **Duración total** (4-5 semanas)
- **Frecuencia semanal** (2-6 sesiones por semana)
- **Progresión** (carga, reps, series, ondulante)
- **Rationale** (explicación de por qué se eligió esa metodología)

### Por Sesión
- **Día de la semana** (Lun, Mar, Mié, etc.)
- **Duración** (35-75 minutos)
- **Intensidad guía** (RPE 7-8 o 70-80% 1RM)
- **Objetivo** (fuerza, hipertrofia, condición, etc.)

### Por Ejercicio  
- **Nombre del ejercicio**
- **Series y repeticiones**
- **Descanso** (≤ 70 segundos según prompt)
- **Intensidad específica** (RPE x o %1RM)
- **Tempo** (opcional: 3-1-1)
- **Notas técnicas** y alternativas

## 🎨 Elementos Visuales

### Colores y Estilo
- **Consistencia**: Mismo esquema de colores que MethodologiesScreen
- **Amarillo**: Color principal para elementos activos (#fde047)
- **Negro**: Fondo principal (#000000)
- **Grises**: Elementos secundarios y texto

### Iconografía
- **Calendar** (lucide-react): Icono principal de rutinas
- **PlayCircle**: Días con entrenamiento
- **Moon**: Días de descanso
- **Dumbbell, Clock, Target**: Métricas de entrenamiento

### Estados Interactivos
- **Hover effects**: Transiciones suaves
- **Estado activo**: Resaltado en navegación
- **Modal responsive**: Máx. altura 90vh con scroll
- **Indicadores visuales**: RPE con barras de colores

## 🔧 Componentes Creados

### `RoutineScreen.jsx`
- **Pantalla principal** de rutinas
- **Manejo de estados**: Loading, error, sin datos
- **Integración**: localStorage y navegación
- **Selector de semanas** dinámico

### `RoutineCalendar.jsx` 
- **Vista calendario semanal**
- **Renderizado inteligente**: Días con/sin entrenamiento
- **Interactividad**: Click para abrir modales
- **Información resumida**: Duración, ejercicios, intensidad

### `RoutineDayModal.jsx`
- **Modal detallado por día**
- **Lista completa de ejercicios** con todas las especificaciones
- **Indicadores visuales**: RPE, series, reps, descansos
- **Botón de acción**: "Comenzar Entrenamiento" (preparado para futura implementación)

## 🚀 Estados de la Aplicación

### Con Rutina Disponible
- **Navegación**: Punto amarillo visible en icono Rutinas
- **Vista completa**: Calendario, semanas, ejercicios
- **Persistencia**: Datos guardados en localStorage

### Sin Rutina Disponible  
- **Mensaje guía**: Instrucciones para generar rutina
- **Botón de acción**: Navega a Metodologías
- **Estado vacío**: Icono y mensaje explicativo

### Transición entre Estados
- **Flujo automático**: Metodologías → Rutinas
- **Datos pasados**: Via navegación state
- **Persistencia**: Auto-guardado en localStorage

## 📱 Responsividad

### Mobile First
- **Navegación inferior**: Fácil acceso con pulgares
- **Modales**: Responsive con scroll automático
- **Calendario**: Grid adaptativo
- **Texto**: Tamaños optimizados para móvil

### Desktop Enhanced  
- **Layouts amplios**: Mejor uso del espacio
- **Hover states**: Más refinados
- **Modales grandes**: Máximo aprovechamiento de pantalla

---

## ✅ Estado Actual: **COMPLETAMENTE FUNCIONAL**

El sistema de rutinas está integrado y funcionando con:
- ✅ Backend con IA específica para metodologías
- ✅ Frontend con vista calendario y modales
- ✅ Navegación mejorada con indicadores visuales  
- ✅ Persistencia de datos y manejo de estados
- ✅ Flujo completo desde generación hasta visualización
