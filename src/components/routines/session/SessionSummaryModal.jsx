import React from 'react';

import { useTrace } from '@/contexts/TraceContext.jsx';

/**
 * Modal de resumen final de sesión
 *
 * Extraído de RoutineSessionModal.jsx para mejor organización
 * Muestra el resumen completo de la sesión al finalizar
 * Incluye estadísticas y opciones de navegación
 */
export const SessionSummaryModal = ({
  show,
  endTitle,
  endMessage,
  progressState,
  onClose,
  onEndSession,
  navigateToRoutines
}) => {
  const { track } = useTrace();
  React.useEffect(() => {
    track(show ? 'MODAL_OPEN' : 'MODAL_CLOSE', { name: 'SessionSummaryModal' }, { component: 'SessionSummaryModal' });
  }, [show]);
  if (!show) return null;

  const { exerciseStates, total } = progressState;

  // Calcular estadísticas
  const completed = Object.values(exerciseStates).filter(state => state === 'completed').length;
  const skipped = Object.values(exerciseStates).filter(state => state === 'skipped').length;
  const cancelled = Object.values(exerciseStates).filter(state => state === 'cancelled').length;

  const handleViewProgress = async () => {
    track('BUTTON_CLICK', { id: 'view_progress' }, { component: 'SessionSummaryModal' });
    console.log('🎯 Terminando sesión y navegando a rutinas');

    // Llamar a onEndSession primero para guardar los datos
    if (onEndSession) {
      await onEndSession();
    }

    // Si se proporcionó una función de navegación, usarla
    // De lo contrario, intentar navegar manualmente
    if (navigateToRoutines) {
      navigateToRoutines();
    } else if (typeof window !== 'undefined' && window.location) {
      // Fallback: navegación directa si no hay función de navegación
      setTimeout(() => {
        window.location.href = '/routines';
      }, 100);
    }

    // Cerrar modal al final
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          track('MODAL_DISMISS', { via: 'backdrop' }, { component: 'SessionSummaryModal' });
          onClose?.();
          onEndSession?.();
        }}
      />

      <div className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-white text-xl font-bold mb-2">{endTitle}</h3>
          <p className="text-gray-300">{endMessage}</p>
        </div>

        {/* Estadísticas detalladas */}
        <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
          <h4 className="text-white font-semibold mb-3 text-center">Resumen de la sesión</h4>

          <div className="space-y-2">
            {/* Total de ejercicios */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total de ejercicios:</span>
              <span className="text-white font-semibold">{total}</span>
            </div>

            {/* Completados */}
            {completed > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                  <span className="text-green-200">Completados:</span>
                </div>
                <span className="text-green-400 font-semibold">{completed}</span>
              </div>
            )}

            {/* Saltados */}
            {skipped > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                  <span className="text-yellow-200">Saltados:</span>
                </div>
                <span className="text-yellow-400 font-semibold">{skipped}</span>
              </div>
            )}

            {/* Cancelados */}
            {cancelled > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                  <span className="text-red-200">Cancelados:</span>
                </div>
                <span className="text-red-400 font-semibold">{cancelled}</span>
              </div>
            )}

            {/* Progreso visual */}
            <div className="mt-4 pt-3 border-t border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Progreso:</span>
                <span className="text-white text-sm font-semibold">
                  {Math.round((completed / total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje motivacional */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
          <div className="text-center">
            {completed === total ? (
              <div>
                <div className="text-2xl mb-2">🎉</div>
                <p className="text-blue-200 text-sm">
                  ¡Increíble! Has completado todos los ejercicios. ¡Sigue así!
                </p>
              </div>
            ) : completed > total / 2 ? (
              <div>
                <div className="text-2xl mb-2">💪</div>
                <p className="text-blue-200 text-sm">
                  ¡Gran trabajo! Has completado la mayoría de ejercicios.
                </p>
              </div>
            ) : completed > 0 ? (
              <div>
                <div className="text-2xl mb-2">👏</div>
                <p className="text-blue-200 text-sm">
                  ¡Buen esfuerzo! Cada paso cuenta en tu progreso.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-2xl mb-2">🌟</div>
                <p className="text-blue-200 text-sm">
                  ¡No te rindas! El siguiente entrenamiento será mejor.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleViewProgress}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>📊</span>
            Ver progreso en Rutinas
          </button>

          <button
            onClick={() => {
              track('BUTTON_CLICK', { id: 'close' }, { component: 'SessionSummaryModal' });
              onClose?.();
              onEndSession?.();
            }}
            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>

        {/* Footer con recordatorio */}
        <div className="mt-4 pt-3 border-t border-gray-600">
          <p className="text-xs text-gray-400 text-center">
            Tu progreso ha sido guardado automáticamente
          </p>
        </div>
      </div>
    </div>
  );
};

export default SessionSummaryModal;