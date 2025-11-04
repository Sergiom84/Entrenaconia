import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

/**
 * 🎯 CONTENEDOR UNIVERSAL PARA DRAG-AND-DROP
 *
 * Este componente gestiona TODO el sistema de arrastre:
 * - Detecta eventos de mouse, touch y teclado
 * - Optimiza performance con sensors
 * - Maneja reordenamiento automático
 * - Soporta layouts verticales, horizontales y grid
 *
 * @example
 * // Layout vertical (lista)
 * <CustomizableContainer
 *   items={['btn-1', 'btn-2', 'btn-3']}
 *   onReorder={setItems}
 *   editMode={true}
 *   strategy="vertical"
 * >
 *   {items.map(id => (
 *     <DraggableWrapper key={id} id={id} editMode={true}>
 *       <button>{id}</button>
 *     </DraggableWrapper>
 *   ))}
 * </CustomizableContainer>
 *
 * @example
 * // Layout grid (cards)
 * <CustomizableContainer
 *   items={['card-1', 'card-2', 'card-3']}
 *   onReorder={setItems}
 *   editMode={true}
 *   strategy="grid"
 * >
 *   {items.map(id => (
 *     <DraggableWrapper key={id} id={id} editMode={true}>
 *       <div className="card">{id}</div>
 *     </DraggableWrapper>
 *   ))}
 * </CustomizableContainer>
 */
export function CustomizableContainer({
  children,
  items = [],
  onReorder,
  editMode = false,
  strategy = 'vertical', // 'vertical' | 'horizontal' | 'grid'
  className = '',
  disabled = false,
}) {
  // 🎯 Configuración de sensores (optimizado para móvil + desktop)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requiere mover 8px para activar drag (evita clicks accidentales)
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms de delay en móvil (evita scroll accidental)
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates, // Accesibilidad (Tab + Space/Enter)
    })
  );

  // 🎯 Estrategia de sorting según layout
  const sortingStrategy = {
    vertical: verticalListSortingStrategy,
    horizontal: horizontalListSortingStrategy,
    grid: rectSortingStrategy,
  }[strategy] || verticalListSortingStrategy;

  // 🎯 Handler de drag end
  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(active.id);
    const newIndex = items.indexOf(over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder?.(newItems);
    }
  }

  // Si no está en modo edición, renderizar children sin drag-and-drop
  if (!editMode || disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={sortingStrategy}>
        <div className={`${className} ${editMode ? 'edit-mode-active' : ''}`}>
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * 🎨 VARIANTE CON INDICADOR VISUAL DE MODO EDICIÓN
 *
 * Muestra un banner superior cuando está en modo edición
 */
export function CustomizableContainerWithIndicator({
  children,
  items,
  onReorder,
  editMode,
  strategy = 'vertical',
  className = '',
  disabled = false,
  onExitEditMode,
  title = 'Modo Edición',
  description = 'Arrastra los elementos para reorganizar'
}) {
  return (
    <div className="relative">
      {/* Banner de modo edición */}
      {editMode && (
        <div className="sticky top-0 z-50 bg-yellow-400 text-gray-900 px-4 py-2 flex items-center justify-between mb-4 rounded-lg shadow-lg">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs">{description}</p>
          </div>
          {onExitEditMode && (
            <button
              onClick={onExitEditMode}
              className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Guardar y Salir
            </button>
          )}
        </div>
      )}

      {/* Contenedor draggable */}
      <CustomizableContainer
        items={items}
        onReorder={onReorder}
        editMode={editMode}
        strategy={strategy}
        className={className}
        disabled={disabled}
      >
        {children}
      </CustomizableContainer>
    </div>
  );
}
