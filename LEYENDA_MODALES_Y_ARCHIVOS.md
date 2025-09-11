# 🗺️ **LEYENDA DE MODALES Y ARCHIVOS - ENTRENA CON IA**

## 📋 **GUÍA DE REFERENCIA PARA COMUNICACIÓN PRECISA**

Esta leyenda te permitirá referirte exactamente a cada modal, pantalla o funcionalidad de forma precisa.

---

## 🧠 **1. METODOLOGÍAS** (`/methodologies`)

### 📱 **Pantalla Principal**
**`MethodologiesScreen.jsx`** - Pantalla principal de metodologías con tabs automático/manual

### 🎯 **Metodologías Tradicionales**
- **`MethodologyCard.jsx`** - Tarjeta individual para cada metodología (Weider, Full Body, etc.)
- **`MethodologyDetailsDialog.jsx`** - Modal de detalles de metodología (descripción, enfoque, duración)
- **`MethodologyConfirmationModal.jsx`** - Modal de confirmación antes de generar plan
- **`MethodologyVersionSelectionModal.jsx`** - Modal para elegir versión de metodología

### 🤸 **Sistema Calistenia Manual (Especializado)**
- **`CalisteniaManualCard.jsx`** - Tarjeta especializada de calistenia con evaluación IA
- **Modal de Evaluación IA** - Embedded en CalisteniaManualCard, muestra:
  - Análisis del perfil del usuario
  - Nivel recomendado (básico/intermedio/avanzado)
  - Razonamiento de la IA
  - Indicadores clave del nivel
  - Botón "Generar con IA"

### ⚠️ **Modales de Estado**
- **Modal de Entrenamiento Activo** - Avisa si ya tienes un plan activo
- **Modal de Mensaje Personalizado** - Muestra resultado de generación de IA

---

## 🏠 **2. ENTRENAMIENTO EN CASA** (`/home-training`)

### 📱 **Pantalla Principal**
**`HomeTrainingSection.jsx`** - Pantalla principal con equipamiento y progreso

### 🏃 **Modales de Entrenamiento**
- **`HomeTrainingExerciseModal.jsx`** - Modal principal de ejercicio individual:
  - Cronómetro con fases (preparación, ejercicio, descanso)
  - Series y repeticiones
  - GIF del ejercicio
  - Botones: Completar, Saltar, Cancelar, Info, Feedback
  - Contador de tiempo total

- **`ExerciseFeedbackModal.jsx`** - Modal de feedback de ejercicio:
  - Opciones: "Me gusta", "No me gusta", "Es difícil"
  - Campo de comentarios opcionales
  - Sistema de sentiment unificado

- **`HomeTrainingPlanModal.jsx`** - Modal de vista previa del plan:
  - Lista de ejercicios generados
  - Duración estimada
  - Equipamiento necesario
  - Botones: "Comenzar Entrenamiento", "Regenerar"

### 📊 **Modales de Estado y Progreso**
- **`HomeTrainingRejectionModal.jsx`** - Modal cuando rechazas un plan generado
- **`HomeTrainingPreferencesHistory.jsx`** - Historial de preferencias y feedback
- **`HomeTrainingUserProgressCard.jsx`** - Tarjeta de progreso del usuario

---

## 💪 **3. RUTINAS** (`/routines`)

### 📱 **Pantalla Principal**
**`RoutineScreen.jsx`** - Pantalla principal con tabs: Today, Calendar, Progress

### 📅 **Tab Today Training**
**`TodayTrainingTab.jsx`** - Tab del entrenamiento de hoy:
- Lista de ejercicios del día
- Estados visuales: Verde (completado), Naranja (saltado), Gris (pendiente)
- Botones: "Comenzar Entrenamiento", "Ver Ejercicios Pendientes"

### 🗓️ **Tab Calendar**
**`CalendarTab.jsx`** - Vista calendario semanal:
- Grid de días de la semana
- Indicadores de ejercicios por día
- Navegación entre semanas
- Modal de día individual

### 📈 **Tab Progress**
**`ProgressTab.jsx`** - Análisis y estadísticas:
- Gráficos de progreso
- Métricas de completado
- Historial de sesiones

### 🎯 **Modales de Sesión de Ejercicios**
- **`RoutineSessionModal.jsx`** - Modal PRINCIPAL de sesión activa:
  - Lista de ejercicios con navegación
  - Cronómetro por ejercicio y serie
  - Fases: ejercicio → descanso → siguiente
  - Serie actual vs total (ej: "Serie 2/3")
  - Tiempo gastado acumulativo
  - Botones: Play/Pausa, Saltar, Info, Feedback
  - GIF del ejercicio actual
  - **Modal de fin de rutina** - Resumen al completar toda la sesión

- **`RoutinePlanModal.jsx`** - Modal de confirmación del plan:
  - Vista previa del plan generado por IA
  - Desglose de ejercicios por día
  - Botón "Confirmar Plan"

- **`ExerciseInfoModal.jsx`** - Modal de información del ejercicio:
  - Descripción técnica
  - Músculos trabajados
  - Consejos de ejecución

### ⚠️ **Modales de Confirmación**
**`ConfirmationModals.jsx`** - Contiene varios modales:
- **`CancelConfirmModal`** - Confirma cancelar rutina
- **`PendingExercisesModal`** - Muestra ejercicios pendientes de días anteriores
- **`GenericConfirmModal`** - Modal genérico para confirmaciones

---

## 🎛️ **FLUJOS DE USO COMUNES**

### **Generar Nueva Metodología:**
1. `MethodologiesScreen.jsx` → Seleccionar metodología
2. `MethodologyDetailsDialog.jsx` → Ver detalles
3. `MethodologyConfirmationModal.jsx` → Confirmar
4. `RoutinePlanModal.jsx` → Revisar plan generado

### **Calistenia Especializada:**
1. `MethodologiesScreen.jsx` → Tab Manual → Calistenia
2. `CalisteniaManualCard.jsx` → Modal de evaluación IA automática
3. Ver nivel recomendado → "Generar con IA"
4. `RoutinePlanModal.jsx` → Confirmar plan

### **Sesión de Entrenamiento Completa:**
1. `TodayTrainingTab.jsx` → "Comenzar Entrenamiento"
2. `RoutineSessionModal.jsx` → Ejercicio por ejercicio
3. Para cada ejercicio: cronómetro → descanso → siguiente
4. `ExerciseFeedbackModal.jsx` → Opcional después de cada ejercicio
5. Modal de fin de rutina → Resumen final

### **Entrenamiento en Casa:**
1. `HomeTrainingSection.jsx` → "Generar Plan"
2. `HomeTrainingPlanModal.jsx` → Revisar ejercicios
3. `HomeTrainingExerciseModal.jsx` → Ejecutar cada ejercicio
4. `ExerciseFeedbackModal.jsx` → Feedback por ejercicio

---

## 💡 **EJEMPLOS DE USO PARA COMUNICACIÓN:**

❌ **Antes:** "En el modal de ejercicios, añade un contador"
✅ **Ahora:** "En `RoutineSessionModal.jsx`, añade un contador de ejercicios completados"

❌ **Antes:** "El modal que sale cuando confirmas"  
✅ **Ahora:** "En `MethodologyConfirmationModal.jsx`, modifica el botón de confirmación"

❌ **Antes:** "La pantalla de evaluación de calistenia"
✅ **Ahora:** "En el modal de evaluación IA dentro de `CalisteniaManualCard.jsx`"

❌ **Antes:** "Cuando termina el entrenamiento"
✅ **Ahora:** "En el modal de fin de rutina dentro de `RoutineSessionModal.jsx`"

---

## 🏷️ **TAGS RÁPIDOS DE REFERENCIA:**

- **`#metodologia-principal`** → `MethodologiesScreen.jsx`
- **`#calistenia-evaluacion`** → Modal IA en `CalisteniaManualCard.jsx`
- **`#ejercicio-activo`** → `RoutineSessionModal.jsx`
- **`#ejercicio-casa`** → `HomeTrainingExerciseModal.jsx`
- **`#feedback-ejercicio`** → `ExerciseFeedbackModal.jsx`
- **`#today-training`** → `TodayTrainingTab.jsx`
- **`#calendario-rutinas`** → `CalendarTab.jsx`
- **`#confirmaciones`** → `ConfirmationModals.jsx`

---

*Actualizado: Enero 2025 - Versión 1.0*  
*Con esta leyenda podrás referirte exactamente a cualquier modal o funcionalidad* 🎯