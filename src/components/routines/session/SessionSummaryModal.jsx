import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkout } from '@/contexts/WorkoutContext.jsx';
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
  const { plan, getTodayStatusCached } = useWorkout();
  const { track } = useTrace();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Compute day_id from plan start datetime and timezone (calendar days, 1-indexed)
  function computeDayId(startISO, timezone = 'Europe/Madrid', now = new Date()) {
    try {
      const getParts = (d, tz) => {
        const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        const [y, m, dd] = s.split('-').map(Number);
        return { y, m, d: dd };
      };
      const s = getParts(new Date(startISO), timezone);
      const n = getParts(now, timezone);
      const startUTC = Date.UTC(s.y, s.m - 1, s.d);
      const nowUTC = Date.UTC(n.y, n.m - 1, n.d);
      const diffDays = Math.floor((nowUTC - startUTC) / 86400000) + 1;
      return Math.max(1, diffDays);
    } catch (e) {
      // Fallback simple sin timezone
      const start = new Date(startISO);
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const current = new Date();
      const currentDateOnly = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      const diffDays = Math.floor((currentDateOnly - startDateOnly) / 86400000) + 1;
      return Math.max(1, diffDays);
    }
  }


  // Ref para evitar loop infinito en tracking
  const prevShowRef = React.useRef(show);

  // Tracking corregido con useRef
  React.useEffect(() => {
    if (prevShowRef.current !== show) {
      track(show ? 'MODAL_OPEN' : 'MODAL_CLOSE', { name: 'SessionSummaryModal' }, { component: 'SessionSummaryModal' });
      prevShowRef.current = show;
    }
  }, [show, track]);
  if (!show) return null;

  const { exerciseStates, total } = progressState;

  // Calcular estadísticas
  const completed = Object.values(exerciseStates).filter(state => state === 'completed').length;
  const skipped = Object.values(exerciseStates).filter(state => state === 'skipped').length;
  const cancelled = Object.values(exerciseStates).filter(state => state === 'cancelled').length;

  const handleViewProgress = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    track('BUTTON_CLICK', { id: 'view_progress' }, { component: 'SessionSummaryModal' });
    console.log('🎯 Terminando sesión y navegando a rutinas');

    try {
      // Llamar a onEndSession primero para guardar los datos
      if (onEndSession) {
        await onEndSession();
      }

      // Prefetch del estado del día para que TodayTrainingTab llegue con datos frescos
      try {
        const methodologyPlanId = plan?.methodologyPlanId;
        const startISO = plan?.planStartDate || new Date().toISOString();
        if (methodologyPlanId) {
          const dayId = computeDayId(startISO, 'Europe/Madrid');
          await getTodayStatusCached({ methodologyPlanId, dayId });
        }
      } catch (e) {
        console.warn('Prefetch today-status falló (no bloqueante):', e);
      }

      // Navegar a Rutinas
      if (typeof navigateToRoutines === 'function') {
        navigateToRoutines();
      } else {
        navigate('/routines');
      }

      // Cerrar modal al final
      onClose?.();
    } finally {
      // Evitar quedarse bloqueado si algo falla
      setTimeout(() => setIsSubmitting(false), 300);
    }
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
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${isSubmitting ? 'bg-green-800 text-white cursor-not-allowed opacity-70' : 'bg-green-600 hover:bg-green-500 text-white'}`}
          >
            <span>📊</span>
            {isSubmitting ? 'Guardando y navegando…' : 'Ver progreso en Rutinas'}
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