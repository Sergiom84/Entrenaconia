/**
 * 🚀 useDebuggedContext - Hook Wrapper Automático
 *
 * PROPÓSITO: Registrar automáticamente cualquier contexto para debugging
 * sin modificar el código existente.
 *
 * USO (OPCIONAL - El debugging funciona sin esto también):
 * const workout = useDebuggedContext(useWorkout, 'WorkoutContext');
 * // Ahora todos los cambios en workout se loguean automáticamente
 */

import { useContextDebug } from '@/providers/DebugProvider';

/**
 * 🎯 Wrapper que ejecuta un hook de contexto y lo debuggea automáticamente
 */
export const useDebuggedContext = (useContextHook, contextName) => {
  // Ejecutar el hook original
  const contextValue = useContextHook();

  // Registrar para debugging automático
  return useContextDebug(contextValue, contextName);
};

export default useDebuggedContext;
