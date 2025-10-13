# ✅ Corrección del Flujo de "Entrenamiento en Casa"

## 🎯 Problemas Resueltos

### **Problema 1: Modal de selección AI/Manual innecesario**
**Antes:** Al hacer clic en "Entrenamiento en Casa", aparecía un modal preguntando si querías evaluación con IA o selección manual.

**Ahora:** Va directamente al formulario de selección manual (nivel, categorías, equipamiento, espacio, objetivos).

### **Problema 2: Modal de selección no se ocultaba durante generación**
**Antes:** Al presionar "Generar Plan de Entrenamiento en Casa", el formulario seguía visible.

**Ahora:** Se oculta el formulario y aparece un overlay con "La IA está generando el entrenamiento" (igual que Calistenia).

---

## 🔧 Cambios Realizados

### **Archivo:** `src/components/Methodologie/methodologies/Casa/CasaManualCard.jsx`

#### **Cambio 1: Estado inicial en modo 'manual'**
```javascript
// ANTES
const initialState = {
  mode: null, // 'ai' | 'manual'
  ...
};

// DESPUÉS
const initialState = {
  mode: 'manual', // 'ai' | 'manual' - Inicia directo en modo manual
  ...
};
```

#### **Cambio 2: Añadido overlay de loading**
```jsx
{/* Loading Overlay - Similar a Calistenia */}
{isLoading && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
    <div className="bg-black/90 border border-yellow-400/30 rounded-lg p-6 text-center shadow-xl">
      <svg className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
      </svg>
      <p className="text-white font-semibold">La IA está generando el entrenamiento</p>
    </div>
  </div>
)}
```

#### **Cambio 3: Eliminadas secciones innecesarias**
- ❌ Selector de modo (AI vs Manual)
- ❌ Sección de evaluación con IA
- ❌ Resultados de evaluación IA
- ❌ Función `evaluateUserProfile()`
- ❌ Botón "Volver atrás"

---

## 🔧 Cambios Adicionales de Funcionalidad

### **Archivo:** `src/components/Methodologie/methodologies/Casa/CasaManualCard.jsx`

#### **Cambio 4: Selección única de categoría en lugar de múltiple**
```javascript
// ANTES
const initialState = {
  selectedCategories: [], // Array para múltiple selección
  ...
};

case 'TOGGLE_CATEGORY': {
  const category = action.payload;
  const isSelected = state.selectedCategories.includes(category);
  return {
    ...state,
    selectedCategories: isSelected
      ? state.selectedCategories.filter(c => c !== category)
      : [...state.selectedCategories, category]
  };
}

// DESPUÉS
const initialState = {
  selectedCategory: null, // String único para selección única
  ...
};

case 'SET_CATEGORY':
  return { ...state, selectedCategory: action.payload };
```

#### **Cambio 5: Inclusión del perfil de usuario**
```javascript
// AÑADIDO: Import de useUserContext
import { useUserContext } from '../../../../contexts/UserContext';

// DENTRO DEL COMPONENTE:
const { userData } = useUserContext();

// CONSTRUCCIÓN DEL PERFIL (igual que Calistenia)
const fullProfile = {
  id: userData?.id || user?.id
};

// AÑADIDO A casaData
const casaData = {
  mode: state.mode,
  selectedLevel: state.selectedLevel,
  selectedCategory: state.selectedCategory, // Singular, no plural
  equipmentLevel: state.equipmentLevel,
  spaceAvailable: state.spaceAvailable,
  customGoals: state.customGoals,
  userProfile: fullProfile, // ← NUEVO
  aiEvaluation: state.mode === 'ai' ? state.aiEvaluation : null
};
```

#### **Cambio 6: Actualización de validación**
```javascript
// ANTES
if (state.mode === 'manual' && state.selectedCategories.length === 0) {
  dispatch({ type: 'SET_ERROR', payload: 'Debes seleccionar al menos una categoría' });
  return;
}

// DESPUÉS
if (state.mode === 'manual' && !state.selectedCategory) {
  dispatch({ type: 'SET_ERROR', payload: 'Debes seleccionar una categoría de entrenamiento' });
  return;
}
```

#### **Cambio 7: UI actualizada para selección única**
```jsx
{/* Cambio en el label */}
<p className="text-gray-400 text-xs">Selecciona una categoría</p>

{/* Cambio en la lógica de selección */}
const isSelected = state.selectedCategory === key; // No array.includes()

{/* Cambio en el onClick */}
onClick={() => dispatch({ type: 'SET_CATEGORY', payload: key })} // No TOGGLE

{/* Cambio en disabled del botón */}
disabled={isLoading || !state.selectedLevel || !state.selectedCategory}
```

#### **Cambio 8: Eliminado botón "Reiniciar Selección"**
```jsx
// ELIMINADO COMPLETAMENTE:
// <button
//   onClick={() => dispatch({ type: 'RESET' })}
//   className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
// >
//   Reiniciar Selección
// </button>
```

---

## 🎬 Flujo Actualizado

### **Modo MANUAL (Entrenamiento en Casa)**

```
Usuario hace clic en "Entrenamiento en Casa" (modo manual)
↓
Se abre modal con CasaManualCard directamente en el formulario
├─ Selecciona nivel (principiante/intermedio/avanzado)
├─ Selecciona categorías (funcional, fuerza, cardio, etc.)
├─ Selecciona equipamiento disponible (mínimo/básico/avanzado)
├─ Selecciona espacio disponible (reducido/medio/amplio)
└─ Opcionalmente añade objetivos específicos
↓
Usuario presiona "Generar Plan de Entrenamiento en Casa"
↓
Modal del formulario se OCULTA (ui.hideModal('casaManual'))
↓
Aparece overlay: "La IA está generando el entrenamiento"
↓
Backend genera el plan con IA
↓
Overlay desaparece
↓
Aparece TrainingPlanConfirmationModal con la propuesta
↓
Usuario acepta
↓
WarmupModal
↓
RoutineSessionModal
↓
Navigate a TodayTrainingTab
```

---

## 🧪 Cómo Probar

1. **Ir a Metodologías**
   - Click en botón "Manual" en la parte superior

2. **Click en tarjeta "Entrenamiento en Casa"**
   - ✅ Debe abrir directamente el formulario de selección
   - ❌ NO debe mostrar selector AI vs Manual

3. **Completar formulario:**
   - Seleccionar nivel (ej: Principiante)
   - Seleccionar UNA categoría (ej: Funcional) - solo una debe quedar marcada
   - Equipamiento ya está preseleccionado (Básico)
   - Espacio ya está preseleccionado (Medio)
   - ✅ Verificar que al hacer clic en otra categoría, la anterior se desmarca (selección única)

4. **Presionar "Generar Plan de Entrenamiento en Casa"**
   - ✅ El formulario debe desaparecer
   - ✅ Debe aparecer overlay con spinner amarillo y texto "La IA está generando el entrenamiento"

5. **Esperar generación**
   - Overlay desaparece
   - Aparece modal de confirmación de plan

6. **Aceptar y continuar flujo**
   - WarmupModal → RoutineSessionModal → TodayTrainingTab

---

## 📋 Comparación con Calistenia

| Aspecto | Calistenia | Casa (ANTES) | Casa (AHORA) |
|---------|------------|--------------|--------------|
| **Selector AI/Manual** | ❌ No tiene | ✅ Sí tenía | ❌ Eliminado |
| **Inicia en modo** | Automático (AI) | Ninguno | Manual |
| **Overlay de loading** | ✅ Sí | ❌ No | ✅ Añadido |
| **Oculta modal al generar** | ✅ Sí | ❌ No | ✅ Sí |
| **Flujo consistente** | ✅ | ❌ | ✅ |

---

## 🎨 Patrones Visuales

### **Overlay de Loading (ahora consistente en ambas metodologías)**
```
┌─────────────────────────────────────────┐
│  Fondo negro semi-transparente (80%)   │
│                                         │
│      ┌────────────────────────┐        │
│      │ ⚪ Spinner amarillo     │        │
│      │                        │        │
│      │ "La IA está generando  │        │
│      │  el entrenamiento"     │        │
│      └────────────────────────┘        │
│                                         │
└─────────────────────────────────────────┘
```

### **z-index hierarchy**
```
z-50: Modales principales (Dialog)
z-60: Overlay de loading (por encima de modales)
```

---

## 📝 Notas Técnicas

### **Por qué se eliminó el modo AI:**
El componente tenía dos modos (`ai` y `manual`), pero en el contexto de "Entrenamiento en Casa" desde la sección de metodologías, solo se usa el modo manual. El modo AI podría usarse en el futuro desde otro punto de entrada (ej: un botón "Activar IA" global), pero no desde la tarjeta de metodología.

### **Compatibilidad con otros componentes:**
- `MethodologiesScreen.jsx` (línea 722-763): No requiere cambios, ya llamaba correctamente a `handleCasaManualGenerate`
- `WorkoutContext.jsx`: No requiere cambios
- Backend (`/api/casa-specialist/*`): No requiere cambios

### **Comportamiento del reducer:**
El reducer sigue soportando ambos modos internamente por si en el futuro se quiere re-habilitar el modo AI desde otro contexto. Solo se cambió el estado inicial.

---

## ✅ Checklist de Verificación

- [x] Estado inicial en modo 'manual'
- [x] Overlay de loading añadido
- [x] Selector de modo eliminado
- [x] Secciones AI eliminadas
- [x] Función evaluateUserProfile eliminada
- [x] Botón "Volver atrás" eliminado
- [x] Flujo consistente con Calistenia
- [x] Categorías cambiadas a selección única (no múltiple)
- [x] Perfil de usuario incluido en casaData
- [x] Botón "Reiniciar Selección" eliminado
- [x] Validación actualizada para categoría única
- [ ] Testing manual completado (pendiente por usuario)
- [ ] Verificar en móvil/tablet
- [ ] Verificar que el plan se genera correctamente

---

## 🚀 Próximos Pasos

1. **Probar el flujo completo** siguiendo las instrucciones de la sección "Cómo Probar"
2. **Verificar que el plan se genera correctamente** con la IA
3. **Confirmar que el modal de confirmación aparece** con los datos del plan
4. **Verificar el flujo hasta TodayTrainingTab**

Si todo funciona correctamente, el flujo de "Entrenamiento en Casa" ahora será **idéntico** al de Calistenia en términos de UX.

---

## 📊 Resumen de Cambios Completados

### Cambios Fase 1 (UX Flow):
1. ✅ Eliminado selector AI vs Manual
2. ✅ Overlay de loading añadido
3. ✅ Estado inicial en modo 'manual'

### Cambios Fase 2 (Funcionalidad):
4. ✅ Categorías cambiadas a selección única
5. ✅ Perfil de usuario incluido en casaData
6. ✅ Validación actualizada
7. ✅ UI actualizada para reflejar selección única
8. ✅ Botón "Reiniciar Selección" eliminado

### Datos Enviados a la IA:
El siguiente objeto se envía al backend/IA para generar el plan:
```javascript
{
  mode: 'manual',
  selectedLevel: 'principiante' | 'intermedio' | 'avanzado',
  selectedCategory: 'funcional' | 'fuerza' | 'cardio' | 'hiit' | 'movilidad' | 'yoga_pilates',
  equipmentLevel: 'minimo' | 'basico' | 'avanzado',
  spaceAvailable: 'reducido' | 'medio' | 'amplio',
  customGoals: 'texto libre del usuario',
  userProfile: {
    id: userId
  },
  aiEvaluation: null
}
```

---

**Fecha Inicio:** 2025-01-15
**Fecha Completado:** 2025-01-15
**Estado:** ✅ Implementado completamente y listo para testing
