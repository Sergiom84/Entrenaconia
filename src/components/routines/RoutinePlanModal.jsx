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
  if (!plan) return null;

  const metodo = plan.selected_style || plan.metodologia || 'Rutina';
  const rationale = plan.rationale || plan.consideraciones || '';
  const semanas = Array.isArray(plan.semanas) ? plan.semanas : [];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-1">{metodo}</h2>
            <p className="text-sm text-gray-400">Fuente del plan: {planSource?.label || 'OpenAI'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Rationale / Motivo */}
        {rationale && (
          <div className="p-6">
            <div className="bg-black/40 border border-yellow-400/20 rounded-lg p-4">
              <h3 className="text-yellow-300 font-semibold mb-2">¿Por qué esta metodología?</h3>
              <p className="text-gray-200 text-sm whitespace-pre-line">{rationale}</p>
            </div>
          </div>
        )}

        {/* Resumen semanal */}
        <div className="px-6 pb-6">
          <h3 className="text-white font-semibold mb-3">Resumen del plan</h3>
          <div className="space-y-4">
            {semanas.length === 0 && (
              <p className="text-gray-400 text-sm">No hay semanas para mostrar.</p>
            )}
            {semanas.map((sem) => (
              <div key={sem.semana} className="bg-gray-800/60 border border-gray-700 rounded-lg">
                <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-gray-200 font-medium">Semana {sem.semana}</span>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-3">
                  {(sem.sesiones || []).map((ses, idx) => {
                    const ejercicios = Array.isArray(ses.ejercicios) ? ses.ejercicios : [];
                    const preview = ejercicios.slice(0, 3).map((e) => e.nombre).filter(Boolean).join(', ');
                    return (
                      <div key={idx} className="bg-black/40 rounded-md p-3 border border-gray-700">
                        <div className="text-yellow-300 font-semibold text-sm mb-1">{ses.dia || `Día ${idx + 1}`}</div>
                        <div className="text-gray-300 text-sm">{preview || 'Ver detalles en la sesión'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="p-6 border-t border-gray-800 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onGenerateAnother}
            className="px-4 py-2 rounded-lg bg-transparent border border-gray-600 text-gray-200 hover:bg-gray-800"
          >
            Generar otro
          </button>
          <button
            onClick={onStart}
            disabled={isConfirming}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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

