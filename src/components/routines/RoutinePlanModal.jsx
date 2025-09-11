import { useEffect, useCallback } from 'react';
import { X, Calendar, Dumbbell, Info } from 'lucide-react';

// Modal principal para previsualizar el plan generado por la IA
// Muestra: título (metodología), justificación/rationale y resumen por días
export default function RoutinePlanModal({
  plan,
  planSource = { label: 'OpenAI' },
  onStart,
  onGenerateAnother,
  onClose,
  isConfirming = false,
}) {
  // Manejo de tecla Escape
  useEffect(() => {
    if (!plan) return;

    const handleEscape = (event) => {
      if ((event.key === 'Escape' || event.keyCode === 27) && !isConfirming) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [plan, isConfirming, onClose]);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (plan) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [plan]);

  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget && !isConfirming) {
      onClose();
    }
  }, [isConfirming, onClose]);

  if (!plan) return null;

  const metodo = plan.selected_style || plan.metodologia || 'Rutina';
  const rationale = plan.rationale || plan.consideraciones || '';
  const semanas = Array.isArray(plan.semanas) ? plan.semanas : [];

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl transform transition-all duration-200 scale-100 opacity-100">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Dumbbell className="text-yellow-400 mt-1" size={24} />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-1">{metodo}</h2>
              <p className="text-xs sm:text-sm text-gray-400">Fuente del plan: {planSource?.label || 'OpenAI'}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded-lg"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Rationale / Motivo */}
        {rationale && (
          <div className="p-4 sm:p-6">
            <div className="bg-black/40 border border-yellow-400/20 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <Info className="text-yellow-300 mt-0.5" size={18} />
                <h3 className="text-yellow-300 font-semibold">¿Por qué esta metodología?</h3>
              </div>
              <p className="text-gray-200 text-xs sm:text-sm whitespace-pre-line leading-relaxed">{rationale}</p>
            </div>
          </div>
        )}

        {/* Resumen semanal */}
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="text-gray-400" size={20} />
            <h3 className="text-white font-semibold">Resumen del plan</h3>
          </div>
          <div className="space-y-4">
            {semanas.length === 0 && (
              <p className="text-gray-400 text-sm">No hay semanas para mostrar.</p>
            )}
            {semanas.map((sem) => (
              <div key={sem.semana} className="bg-gray-800/60 border border-gray-700 rounded-lg">
                <div className="px-3 sm:px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-gray-200 font-medium text-sm sm:text-base">Semana {sem.semana}</span>
                </div>
                <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {(sem.sesiones || []).map((ses, idx) => {
                    const ejercicios = Array.isArray(ses.ejercicios) ? ses.ejercicios : [];
                    const preview = ejercicios.slice(0, 3).map((e) => e.nombre).filter(Boolean).join(', ');
                    return (
                      <div key={idx} className="bg-black/40 rounded-md p-2 sm:p-3 border border-gray-700 hover:border-gray-600 transition-colors">
                        <div className="text-yellow-300 font-semibold text-xs sm:text-sm mb-1">{ses.dia || `Día ${idx + 1}`}</div>
                        <div className="text-gray-300 text-xs sm:text-sm line-clamp-2">{preview || 'Ver detalles en la sesión'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 sm:p-6 border-t border-gray-800 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onGenerateAnother}
            className="px-4 py-2 rounded-lg bg-transparent border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors text-sm sm:text-base"
          >
            Generar otro
          </button>
          <button
            onClick={onStart}
            disabled={isConfirming}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            {isConfirming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent mr-2"></div>
                Guardando rutina...
              </>
            ) : (
              'Comenzar entrenamiento'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

