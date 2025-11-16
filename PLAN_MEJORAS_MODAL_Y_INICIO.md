# 🎯 PLAN DE MEJORAS - Modal de Confirmación y Sistema de Inicio Inteligente

**Fecha**: 2025-11-15  
**Estado**: 🚧 EN PROGRESO

---

## 📋 RESUMEN EJECUTIVO

Se van a implementar 2 mejoras críticas para la UX:

1. **Modal de Día de Inicio Inteligente** - Detecta el día y ofrece opciones personalizadas
2. **Mejora del Modal de Confirmación** - Preview de días con grupos musculares + modal de detalle

---

## ✅ FASE 1: MODAL DE DÍA DE INICIO (COMPLETADO)

### **Componente Creado**

- ✅ `src/components/routines/modals/StartDayConfirmationModal.jsx`

### **Funcionalidad**

- ✅ Detecta día de la semana automáticamente
- ✅ Muestra opciones personalizadas según día:
  - **Jueves**: 3 opciones (Lunes, Hoy+Mañana, Hoy+Mañana+Sábado)
  - **Viernes**: 3 opciones (Lunes, Hoy+Sábado, Solo Hoy)
  - **Sábado**: 2 opciones (Home Training Hoy, Empezar Hoy)
  - **Domingo**: 2 opciones (Home Training Hoy, Empezar Mañana)
- ✅ Retorna configuración de inicio:
  ```javascript
  {
    startDate: 'today' | 'next_monday' | 'home_training_today',
    sessionsFirstWeek: 1 | 2 | 3,
    isHomeTraining: boolean
  }
  ```

---

## ✅ FASE 2: MEJORA DEL MODAL DE CONFIRMACIÓN (COMPLETADO)

### **Componentes Creados**

- ✅ `src/components/routines/modals/DayDetailModal.jsx`

### **Componentes Modificados**

- ✅ `src/components/routines/TrainingPlanConfirmationModal.jsx`

### **Funcionalidad Implementada**

- ✅ Modal aumentado de tamaño: `max-w-3xl` → `max-w-5xl`
- ✅ Preview de grupos musculares en cada día: "💪 Pecho + Tríceps"
- ✅ Click en día → Abre `DayDetailModal` con ejercicios completos
- ✅ Función `getMuscleGroupsPreview()` que extrae grupos de:
  - HipertrofiaV2: `session.grupos_musculares` (JSON)
  - Otros planes: Infiere de `ejercicio.grupo_muscular` o `ejercicio.categoria`
- ✅ Colores por intensidad: Alta (rojo), Media (amarillo), Baja (verde)
- ✅ Preview muestra solo 2 ejercicios + contador "X más..."
- ✅ Botón "Ver detalles" con icono Eye

---

## ✅ FASE 3: MODAL DE DISTRIBUCIÓN DE SESIONES (COMPLETADO)

### **Componente Creado**

- ✅ `src/components/routines/modals/SessionDistributionModal.jsx`

### **Funcionalidad**

- ✅ Aparece cuando usuario comienza en día incompleto (Mar, Mié, Jue, Vie)
- ✅ Muestra 2 opciones:
  - **Opción A**: Entrenar sábados (6 sesiones/semana)
  - **Opción B**: Añadir semana extra (5 sesiones/semana)
- ✅ Calcula automáticamente:
  - Número de semanas totales
  - Distribución de sesiones por semana
  - Sesiones en última semana
- ✅ Retorna opción seleccionada: `'saturdays'` o `'extra_week'`

---

## 🚧 FASE 4: INTEGRACIÓN DEL MODAL DE INICIO (PENDIENTE)

### **Archivos a Modificar**

#### 1. `src/components/Methodologie/MethodologiesScreen.jsx`

```javascript
// Importar modal
import StartDayConfirmationModal from "../routines/modals/StartDayConfirmationModal.jsx";

// Estado para controlar modal
const [showStartDayModal, setShowStartDayModal] = useState(false);
const [pendingMethodology, setPendingMethodology] = useState(null);

// Función para detectar si es Jue/Vie/Sáb/Dom
const shouldShowStartDayModal = () => {
  const today = new Date().getDay();
  return [0, 4, 5, 6].includes(today); // Dom, Jue, Vie, Sáb
};

// Al hacer click en metodología
const handleManualCardClick = (methodologyName) => {
  if (shouldShowStartDayModal()) {
    setPendingMethodology(methodologyName);
    setShowStartDayModal(true);
  } else {
    // Continuar flujo normal
    proceedWithMethodology(methodologyName);
  }
};

// Callback del modal
const handleStartDayConfirm = async (config) => {
  setShowStartDayModal(false);

  if (config.isHomeTraining) {
    // Redirigir a Home Training
    navigate("/home-training");
  } else {
    // Continuar con generación de plan
    await proceedWithMethodology(pendingMethodology, config);
  }
};
```

#### 2. Backend - Ajustar distribución de sesiones

**Archivo**: `backend/services/sessionDistributionService.js` (NUEVO)

```javascript
/**
 * Calcula la distribución de sesiones según día de inicio
 */
export function calculateSessionDistribution(config) {
  const {
    totalSessions = 30,
    sessionsPerWeek = 5,
    sessionsFirstWeek,
    startDate,
  } = config;

  // Ejemplo: Si empieza Martes (4 sesiones primera semana)
  // Semana 1: 4 sesiones
  // Semanas 2-6: 25 sesiones (5 por semana)
  // Semana 7: 1 sesión (para completar 30)

  const weeks = [];
  let remainingSessions = totalSessions;
  let weekNumber = 1;

  // Primera semana (puede ser incompleta)
  if (sessionsFirstWeek && sessionsFirstWeek < sessionsPerWeek) {
    weeks.push({
      weekNumber: weekNumber++,
      sessions: sessionsFirstWeek,
    });
    remainingSessions -= sessionsFirstWeek;
  }

  // Semanas completas
  while (remainingSessions >= sessionsPerWeek) {
    weeks.push({
      weekNumber: weekNumber++,
      sessions: sessionsPerWeek,
    });
    remainingSessions -= sessionsPerWeek;
  }

  // Última semana (si quedan sesiones)
  if (remainingSessions > 0) {
    weeks.push({
      weekNumber: weekNumber,
      sessions: remainingSessions,
    });
  }

  return weeks;
}
```

---

## 🚧 FASE 3: MEJORA DEL MODAL DE CONFIRMACIÓN (PENDIENTE)

### **Problema Actual**

- Modal pequeño, texto solapado
- No se ven bien los ejercicios en desktop
- Falta preview de grupos musculares

### **Solución Propuesta**

#### 1. Crear `DayDetailModal.jsx` (NUEVO)

```javascript
// Modal secundario para ver ejercicios de un día específico
const DayDetailModal = ({ isOpen, onClose, day, exercises }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{day.date}</DialogTitle>
          <DialogDescription>{day.muscleGroups.join(" + ")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {exercises.map((exercise, idx) => (
            <div key={idx} className="bg-gray-800/50 p-4 rounded-lg">
              <h4 className="font-semibold text-white">{exercise.nombre}</h4>
              <div className="flex gap-4 text-sm text-gray-400 mt-2">
                <span>{exercise.series} series</span>
                <span>×</span>
                <span>{exercise.repeticiones} reps</span>
                <span>•</span>
                <span>Intensidad: {exercise.intensidad}</span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

#### 2. Modificar `TrainingPlanConfirmationModal.jsx`

**Cambios**:

- ✅ Aumentar tamaño del modal: `max-w-3xl` → `max-w-5xl`
- ✅ Mostrar preview de grupos musculares en cada día
- ✅ Click en día → Abrir `DayDetailModal`
- ✅ Extraer grupos musculares del plan

**Código**:

```javascript
// Función para extraer grupos musculares de una sesión
const getMuscleGroupsPreview = (session) => {
  // Para HipertrofiaV2 MindFeed
  if (session.grupos_musculares) {
    return Array.isArray(session.grupos_musculares)
      ? session.grupos_musculares
      : JSON.parse(session.grupos_musculares);
  }

  // Para otros planes: inferir de ejercicios
  const exercises = session.ejercicios || [];
  const groups = new Set();
  exercises.forEach((ex) => {
    if (ex.grupo_muscular) groups.add(ex.grupo_muscular);
    if (ex.categoria) groups.add(ex.categoria);
  });

  return Array.from(groups).slice(0, 2); // Máximo 2 grupos
};

// Renderizar día con preview
<div
  className="bg-gray-800/60 rounded-lg p-4 cursor-pointer hover:bg-gray-700/60"
  onClick={() => handleDayClick(session)}
>
  <div className="flex justify-between items-center mb-2">
    <span className="text-yellow-300 font-semibold">{sessionDate}</span>
    <Badge variant="secondary">{exercises.length} ejercicios</Badge>
  </div>
  <div className="text-gray-300 text-sm">
    💪 {getMuscleGroupsPreview(session).join(" + ")}
  </div>
  <div className="text-blue-400 text-xs mt-2 flex items-center gap-1">
    <Eye className="w-3 h-3" />
    Ver detalles →
  </div>
</div>;
```

---

## 📊 DISTRIBUCIÓN DE SESIONES - LÓGICA COMPLETA

### **Escenario 1: Comienza Martes (30 sesiones, 5/semana)**

```
Semana 1: Mar, Mié, Jue, Vie = 4 sesiones (1-4)
Semana 2: Lun, Mar, Mié, Jue, Vie = 5 sesiones (5-9)
Semana 3: Lun, Mar, Mié, Jue, Vie = 5 sesiones (10-14)
Semana 4: Lun, Mar, Mié, Jue, Vie = 5 sesiones (15-19)
Semana 5: Lun, Mar, Mié, Jue, Vie = 5 sesiones (20-24)
Semana 6: Lun, Mar, Mié, Jue, Vie = 5 sesiones (25-29)
Semana 7: Lun = 1 sesión (30)
```

### **Escenario 2: Comienza Miércoles (30 sesiones, 5/semana)**

```
Semana 1: Mié, Jue, Vie = 3 sesiones (1-3)
Semana 2-6: Lun-Vie = 25 sesiones (4-28)
Semana 7: Lun, Mar = 2 sesiones (29-30)
```

### **Modal de Confirmación para Usuario**

Cuando el usuario comienza en Martes, mostrar:

```
⚠️ Has comenzado en MARTES

¿Cómo prefieres completar las 30 sesiones?

Opción 1: 📅 Entrenar Sábados (Recomendado)
  → Semana 1-6: Mar-Sáb (5 sesiones/semana)
  → Completarás el plan en 6 semanas exactas

Opción 2: 🗓️ Añadir semana extra
  → Semana 1: Mar-Vie (4 sesiones)
  → Semana 2-6: Lun-Vie (25 sesiones)
  → Semana 7: Lun (1 sesión final)
```

---

## 🎯 PRÓXIMOS PASOS

### **Inmediatos** (Hoy)

1. [ ] Integrar `StartDayConfirmationModal` en `MethodologiesScreen.jsx`
2. [ ] Crear servicio `sessionDistributionService.js`
3. [ ] Actualizar backend para recibir `sessionsFirstWeek`

### **Corto Plazo** (Esta semana)

4. [ ] Crear `DayDetailModal.jsx`
5. [ ] Mejorar `TrainingPlanConfirmationModal.jsx` con preview
6. [ ] Implementar modal de "¿Entrenar sábados o semana extra?"

### **Medio Plazo** (Próxima semana)

7. [ ] Testing completo de todos los escenarios
8. [ ] Documentación de usuario
9. [ ] Ajustes de UX según feedback

---

**¿Continuamos con la integración del modal de inicio en MethodologiesScreen?** 🚀
