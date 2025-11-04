# 🎯 Sistema Universal de Drag & Drop

**Versión**: 1.0
**Fecha**: 2025-01-04
**Estado**: ✅ Implementado y funcional

---

## 📋 Índice

1. [Introducción](#introducción)
2. [¿Dónde puedo usarlo?](#dónde-puedo-usarlo)
3. [Instalación Completa](#instalación-completa)
4. [Uso Básico](#uso-básico)
5. [Ejemplos Prácticos](#ejemplos-prácticos)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

---

## 🎬 Introducción

Este sistema permite **personalizar el orden de cualquier elemento** en la aplicación mediante drag-and-drop:

- ✅ **Botones** (controles de ejercicio, navegación, etc.)
- ✅ **Texto** (títulos, descripciones, labels)
- ✅ **Cards** (tarjetas de comidas, widgets, estadísticas)
- ✅ **Listas** (ejercicios, rutinas, progreso)
- ✅ **Grids** (dashboard, perfil de usuario)

### Características

- 🎯 **Universal**: Funciona en cualquier componente React
- 💾 **Persistente**: Guarda cambios en localStorage y BD
- 📱 **Móvil-first**: Optimizado para touch y gestos
- ♿ **Accesible**: Soporta teclado y screen readers
- ⚡ **Performante**: 0 re-renders innecesarios, usa transforms GPU

---

## 🌍 ¿Dónde puedo usarlo?

### ✅ YA IMPLEMENTADO

- **Modal de Entrenamiento** (`RoutineSessionModal`)
  - Botones de control: Comenzar, Pausar, Saltar, Cancelar, etc.
  - Toggle de personalización en esquina superior

### 🚀 LISTO PARA USAR EN:

1. **Modal de Propuesta de Ejercicios**
   - Reordenar ejercicios propuestos
   - Cambiar orden de botones (Aceptar, Regenerar, etc.)

2. **Apartado de Nutrición**
   - Arrastrar comidas (Desayuno, Comida, Cena)
   - Reordenar macros y widgets

3. **Perfil de Usuario**
   - Personalizar dashboard de estadísticas
   - Reorganizar widgets de progreso

4. **Cualquier pantalla/modal** que tenga elementos repetidos

---

## 🔧 Instalación Completa

### 1️⃣ Backend (Base de Datos)

**Ejecutar migración SQL en Supabase:**

```bash
# Desde Supabase SQL Editor o terminal
psql $DATABASE_URL -f backend/migrations/create_user_layouts_table.sql
```

**O manualmente:**

```sql
CREATE TABLE app.user_layouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  layout_id VARCHAR(100) NOT NULL,
  layout_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, layout_id)
);

CREATE INDEX idx_user_layouts_user_id ON app.user_layouts(user_id);
```

### 2️⃣ Frontend (Ya instalado)

Las dependencias ya están instaladas:

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

### 3️⃣ Verificar Backend

**Archivo**: `backend/server.js`

```javascript
import userPreferencesRoutes from './routes/userPreferences.js';
app.use('/api/user', userPreferencesRoutes); // ✅ Ya registrado
```

---

## 🎯 Uso Básico

### Paso 1: Importar Componentes

```jsx
import {
  DraggableWrapper,
  CustomizableContainer,
  useCustomLayout,
  useEditMode
} from '@/components/customization';
```

### Paso 2: Setup en tu Componente

```jsx
function MiComponente() {
  // 1. Hook para modo edición (toggle)
  const [editMode, toggleEditMode] = useEditMode(false);

  // 2. Layout por defecto (IDs de tus elementos)
  const defaultLayout = ['item-1', 'item-2', 'item-3'];

  // 3. Hook para persistencia automática
  const [layout, saveLayout] = useCustomLayout(
    'mi-componente-layout', // ID único
    defaultLayout
  );

  return (
    <>
      {/* Botón para activar modo edición */}
      <button onClick={toggleEditMode}>
        {editMode ? 'Guardar' : 'Personalizar'}
      </button>

      {/* Contenedor draggable */}
      <CustomizableContainer
        items={layout}
        onReorder={saveLayout}
        editMode={editMode}
        strategy="vertical" // 'vertical' | 'horizontal' | 'grid'
      >
        {layout.map(id => (
          <DraggableWrapper key={id} id={id} editMode={editMode}>
            <div>Elemento {id}</div>
          </DraggableWrapper>
        ))}
      </CustomizableContainer>
    </>
  );
}
```

---

## 🎨 Ejemplos Prácticos

### Ejemplo 1: Botones Horizontales

```jsx
import { DraggableWrapper, CustomizableContainer, useCustomLayout, useEditMode } from '@/components/customization';
import { Play, Stop, Skip } from 'lucide-react';

function ControlPanel() {
  const [editMode, toggleEditMode] = useEditMode();
  const [layout, saveLayout] = useCustomLayout('control-buttons', [
    'btn-play',
    'btn-stop',
    'btn-skip'
  ]);

  return (
    <div>
      <button onClick={toggleEditMode}>
        {editMode ? '💾 Guardar' : '⚙️ Personalizar'}
      </button>

      <CustomizableContainer
        items={layout}
        onReorder={saveLayout}
        editMode={editMode}
        strategy="horizontal"
        className="flex gap-2"
      >
        {layout.map(id => {
          let button;
          if (id === 'btn-play') button = <button><Play /> Play</button>;
          if (id === 'btn-stop') button = <button><Stop /> Stop</button>;
          if (id === 'btn-skip') button = <button><Skip /> Skip</button>;

          return (
            <DraggableWrapper key={id} id={id} editMode={editMode}>
              {button}
            </DraggableWrapper>
          );
        })}
      </CustomizableContainer>
    </div>
  );
}
```

### Ejemplo 2: Cards de Nutrición (Grid)

```jsx
function NutritionDashboard() {
  const [editMode, toggleEditMode] = useEditMode();
  const [layout, saveLayout] = useCustomLayout('nutrition-cards', [
    'card-breakfast',
    'card-lunch',
    'card-dinner',
    'card-snacks'
  ]);

  const meals = {
    'card-breakfast': { title: 'Desayuno', icon: '🍳', calories: 450 },
    'card-lunch': { title: 'Comida', icon: '🍽️', calories: 650 },
    'card-dinner': { title: 'Cena', icon: '🌙', calories: 550 },
    'card-snacks': { title: 'Snacks', icon: '🍎', calories: 200 }
  };

  return (
    <div>
      <button onClick={toggleEditMode}>
        {editMode ? 'Guardar Orden' : 'Reorganizar Comidas'}
      </button>

      <CustomizableContainer
        items={layout}
        onReorder={saveLayout}
        editMode={editMode}
        strategy="grid"
        className="grid grid-cols-2 gap-4"
      >
        {layout.map(id => {
          const meal = meals[id];
          return (
            <DraggableWrapper key={id} id={id} editMode={editMode}>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-3xl mb-2">{meal.icon}</div>
                <h3 className="text-white font-bold">{meal.title}</h3>
                <p className="text-gray-400">{meal.calories} kcal</p>
              </div>
            </DraggableWrapper>
          );
        })}
      </CustomizableContainer>
    </div>
  );
}
```

### Ejemplo 3: Lista Vertical de Ejercicios

```jsx
function ExerciseList({ exercises }) {
  const [editMode, toggleEditMode] = useEditMode();
  const exerciseIds = exercises.map(ex => `exercise-${ex.id}`);
  const [layout, saveLayout] = useCustomLayout('exercise-order', exerciseIds);

  return (
    <>
      <button onClick={toggleEditMode}>Reordenar Ejercicios</button>

      <CustomizableContainer
        items={layout}
        onReorder={saveLayout}
        editMode={editMode}
        strategy="vertical"
      >
        {layout.map(id => {
          const exercise = exercises.find(ex => `exercise-${ex.id}` === id);
          return (
            <DraggableWrapper key={id} id={id} editMode={editMode}>
              <div className="p-4 bg-gray-700 rounded mb-2">
                <h4>{exercise.name}</h4>
                <p>{exercise.sets} x {exercise.reps}</p>
              </div>
            </DraggableWrapper>
          );
        })}
      </CustomizableContainer>
    </>
  );
}
```

---

## 📚 API Reference

### `useCustomLayout(layoutId, defaultLayout, options)`

Hook para gestionar layouts personalizados con persistencia.

**Parámetros:**

- `layoutId` (string): ID único del layout
- `defaultLayout` (array): Array de IDs por defecto
- `options` (object):
  - `syncWithBackend` (boolean): ¿Sincronizar con BD? (default: `true`)
  - `debounceTime` (number): Tiempo de debounce para BD (default: `1000ms`)
  - `storagePrefix` (string): Prefijo localStorage (default: `'layout_'`)

**Retorna:** `[layout, saveLayout, resetLayout]`

**Ejemplo:**

```jsx
const [layout, saveLayout, resetLayout] = useCustomLayout(
  'my-buttons',
  ['btn-1', 'btn-2'],
  { syncWithBackend: true, debounceTime: 2000 }
);
```

---

### `useEditMode(initialMode)`

Hook para gestionar el toggle de modo edición.

**Parámetros:**

- `initialMode` (boolean): Estado inicial (default: `false`)

**Retorna:** `[editMode, toggleEditMode, saveAndExit]`

**Ejemplo:**

```jsx
const [editMode, toggleEditMode, saveAndExit] = useEditMode(false);

<button onClick={toggleEditMode}>
  {editMode ? 'Guardar' : 'Editar'}
</button>
```

---

### `<CustomizableContainer>`

Contenedor que gestiona el drag-and-drop.

**Props:**

- `items` (array): Array de IDs de elementos
- `onReorder` (function): Callback cuando cambia el orden
- `editMode` (boolean): ¿Está activo el modo edición?
- `strategy` (string): Estrategia de layout: `'vertical'`, `'horizontal'`, `'grid'`
- `className` (string): Clases CSS adicionales
- `disabled` (boolean): Deshabilitar drag-and-drop

**Ejemplo:**

```jsx
<CustomizableContainer
  items={['a', 'b', 'c']}
  onReorder={setItems}
  editMode={true}
  strategy="horizontal"
  className="flex gap-4"
/>
```

---

### `<DraggableWrapper>`

Wrapper que hace cualquier elemento draggable.

**Props:**

- `id` (string): ID único del elemento
- `editMode` (boolean): ¿Está activo el modo edición?
- `disabled` (boolean): Deshabilitar este elemento específico
- `className` (string): Clases CSS adicionales

**Ejemplo:**

```jsx
<DraggableWrapper id="btn-1" editMode={true}>
  <button>Click me</button>
</DraggableWrapper>
```

---

## 🔍 Troubleshooting

### Problema: "La tabla user_layouts no existe"

**Solución:**

```bash
psql $DATABASE_URL -f backend/migrations/create_user_layouts_table.sql
```

### Problema: Los cambios no se guardan en BD

**Causa**: El backend no está corriendo o hay error de autenticación.

**Solución:**

1. Verificar que el backend está corriendo: `npm run dev:backend`
2. Revisar localStorage: `localStorage.getItem('authToken')`
3. Ver logs del backend en la terminal

### Problema: Los elementos no se arrastran

**Causa**: `editMode` está en `false` o falta el wrapper.

**Solución:**

```jsx
// ❌ Incorrecto
<div>Mi elemento</div>

// ✅ Correcto
<DraggableWrapper id="item-1" editMode={editMode}>
  <div>Mi elemento</div>
</DraggableWrapper>
```

### Problema: El orden se resetea al recargar

**Causa**: localStorage no se está leyendo correctamente.

**Solución:**

```jsx
// Verificar en console
console.log(localStorage.getItem('layout_mi-componente-layout'));
```

---

## 🎯 Próximos Pasos

1. ✅ **Sistema implementado** en `RoutineSessionModal`
2. 🔄 **Implementar en**:
   - Modal de propuesta de ejercicios
   - Dashboard de nutrición
   - Perfil de usuario
3. 🚀 **Features futuras**:
   - Presets de layouts (Compacto, Clásico, Minimalista)
   - Exportar/importar configuraciones
   - Compartir layouts entre usuarios

---

## 📞 Soporte

Si tienes dudas o problemas:

1. Revisa esta documentación
2. Consulta los ejemplos en `src/components/routines/session/ExerciseSessionView.jsx`
3. Revisa logs del backend: Terminal donde corre `npm run dev:backend`

---

**¡Disfruta personalizando tu aplicación!** 🎨
