import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 🎯 WRAPPER UNIVERSAL PARA HACER CUALQUIER ELEMENTO DRAGGABLE
 *
 * Este componente puede envolver:
 * - Botones
 * - Texto
 * - Cards
 * - Imágenes
 * - Cualquier componente React
 *
 * @example
 * // Hacer un botón draggable
 * <DraggableWrapper id="btn-completar" editMode={true}>
 *   <button>Completar Ejercicio</button>
 * </DraggableWrapper>
 *
 * @example
 * // Hacer un bloque de texto draggable
 * <DraggableWrapper id="titulo-nutricion" editMode={true}>
 *   <h2>Plan Nutricional</h2>
 * </DraggableWrapper>
 */
export function DraggableWrapper({
  id,
  children,
  editMode = false,
  disabled = false,
  className = '',
  dragHandleClass = '' // Clase CSS para identificar el "handle" de arrastre
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !editMode || disabled
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: editMode ? 'grab' : 'default',
    position: 'relative',
    ...(isDragging && { zIndex: 999 })
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${editMode ? 'draggable-item' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* Indicador visual de modo edición */}
      {editMode && !disabled && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-400 rounded-full opacity-50 animate-pulse" />
      )}

      {children}
    </div>
  );
}

/**
 * 🎨 VARIANTE CON HANDLE ESPECÍFICO
 *
 * Permite arrastrar solo desde un "handle" específico (ej: un ícono ⋮⋮)
 * El resto del elemento es clickeable normalmente
 *
 * @example
 * <DraggableWithHandle id="card-comida" editMode={true}>
 *   <div>
 *     <div className="drag-handle">⋮⋮</div>
 *     <h3>Desayuno</h3>
 *     <p>Contenido de la comida...</p>
 *   </div>
 * </DraggableWithHandle>
 */
export function DraggableWithHandle({
  id,
  children,
  editMode = false,
  disabled = false,
  className = '',
  handleSelector = '.drag-handle' // Selector CSS para el handle
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    setActivatorNodeRef,
  } = useSortable({
    id,
    disabled: !editMode || disabled
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    ...(isDragging && { zIndex: 999 })
  };

  // Clonar children y añadir listeners al handle
  const childrenWithHandle = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        ref: setActivatorNodeRef,
        ...attributes,
        ...listeners,
      });
    }
    return child;
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${editMode ? 'draggable-with-handle' : ''}`}
    >
      {editMode && !disabled && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-400 rounded-full opacity-50" />
      )}

      {childrenWithHandle}
    </div>
  );
}
