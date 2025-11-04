import { useState, useEffect, useCallback } from 'react';

/**
 * 🎯 HOOK UNIVERSAL PARA PERSISTIR LAYOUTS PERSONALIZADOS
 *
 * Gestiona automáticamente:
 * - Carga de layout desde localStorage
 * - Guardado en localStorage (sincronización inmediata)
 * - Sincronización con BD (en background)
 * - Reset a layout por defecto
 *
 * @example
 * // En cualquier componente
 * const [layout, saveLayout, resetLayout] = useCustomLayout('routine-modal-buttons', [
 *   'btn-completar',
 *   'btn-saltar',
 *   'btn-cancelar'
 * ]);
 *
 * // Usar con CustomizableContainer
 * <CustomizableContainer
 *   items={layout}
 *   onReorder={saveLayout}
 *   editMode={true}
 * >
 *   {layout.map(id => (
 *     <DraggableWrapper key={id} id={id}>
 *       <button>{id}</button>
 *     </DraggableWrapper>
 *   ))}
 * </CustomizableContainer>
 *
 * @param {string} layoutId - ID único para identificar este layout (ej: 'nutrition-cards', 'profile-widgets')
 * @param {array} defaultLayout - Layout por defecto (array de IDs)
 * @param {object} options - Opciones adicionales
 * @returns {[array, function, function]} - [layout, saveLayout, resetLayout]
 */
export function useCustomLayout(layoutId, defaultLayout = [], options = {}) {
  const {
    syncWithBackend = true,       // ¿Sincronizar con BD?
    debounceTime = 1000,           // Tiempo de debounce para sync BD (ms)
    storagePrefix = 'layout_',     // Prefijo para localStorage
  } = options;

  const storageKey = `${storagePrefix}${layoutId}`;

  // 🎯 Estado inicial: cargar desde localStorage o usar default
  const [layout, setLayout] = useState(() => {
    try {
      const savedLayout = localStorage.getItem(storageKey);
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        console.log(`✅ Layout cargado desde localStorage: ${layoutId}`, parsed);
        return parsed;
      }
    } catch (error) {
      console.error('❌ Error al cargar layout desde localStorage:', error);
    }
    return defaultLayout;
  });

  // 🎯 Función para guardar layout
  const saveLayout = useCallback((newLayout) => {
    console.log(`💾 Guardando layout: ${layoutId}`, newLayout);

    setLayout(newLayout);

    // 1. Guardar inmediatamente en localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify(newLayout));
      console.log(`✅ Layout guardado en localStorage: ${layoutId}`);
    } catch (error) {
      console.error('❌ Error al guardar en localStorage:', error);
    }

    // 2. Sincronizar con BD (si está habilitado)
    if (syncWithBackend) {
      syncLayoutToBackend(layoutId, newLayout);
    }
  }, [layoutId, storageKey, syncWithBackend]);

  // 🎯 Función para resetear a layout por defecto
  const resetLayout = useCallback(() => {
    console.log(`🔄 Reseteando layout a default: ${layoutId}`);
    setLayout(defaultLayout);
    localStorage.removeItem(storageKey);

    if (syncWithBackend) {
      deleteLayoutFromBackend(layoutId);
    }
  }, [layoutId, defaultLayout, storageKey, syncWithBackend]);

  // 🎯 Sincronizar con BD (con debounce)
  useEffect(() => {
    if (!syncWithBackend) return;

    const timeoutId = setTimeout(() => {
      syncLayoutToBackend(layoutId, layout);
    }, debounceTime);

    return () => clearTimeout(timeoutId);
  }, [layout, layoutId, syncWithBackend, debounceTime]);

  return [layout, saveLayout, resetLayout];
}

/**
 * 🌐 Sincronizar layout con backend
 */
async function syncLayoutToBackend(layoutId, layoutData) {
  try {
    const token = localStorage.getItem('authToken');
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');

    if (!token || !userProfile.id) {
      console.warn('⚠️ No se puede sincronizar: usuario no autenticado');
      return;
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/user/layout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        layout_id: layoutId,
        layout_data: layoutData,
        user_id: userProfile.id
      })
    });

    if (response.ok) {
      console.log(`✅ Layout sincronizado con BD: ${layoutId}`);
    } else {
      console.error('❌ Error al sincronizar layout con BD:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Error en sincronización con BD:', error);
  }
}

/**
 * 🗑️ Eliminar layout del backend
 */
async function deleteLayoutFromBackend(layoutId) {
  try {
    const token = localStorage.getItem('authToken');
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');

    if (!token || !userProfile.id) return;

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/user/layout/${layoutId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      console.log(`✅ Layout eliminado de BD: ${layoutId}`);
    }
  } catch (error) {
    console.error('❌ Error al eliminar layout de BD:', error);
  }
}

/**
 * 🎨 HOOK PARA MODO EDICIÓN (toggle + guardado automático)
 *
 * @example
 * const [editMode, toggleEditMode, saveAndExit] = useEditMode();
 *
 * <button onClick={toggleEditMode}>
 *   {editMode ? 'Salir de Edición' : 'Personalizar'}
 * </button>
 */
export function useEditMode(initialMode = false) {
  const [editMode, setEditMode] = useState(initialMode);

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
  }, []);

  const saveAndExit = useCallback(() => {
    setEditMode(false);
    // Aquí podrías agregar lógica adicional de guardado
    console.log('✅ Cambios guardados, saliendo de modo edición');
  }, []);

  return [editMode, toggleEditMode, saveAndExit];
}
