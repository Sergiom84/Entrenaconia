import { Target } from 'lucide-react';

const HomeTrainingPlanModal = ({
  plan,
  planSource,
  personalizedMessage,
  onStart,
  onGenerateAnother,
  onClose,
}) => {
  if (!plan) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header del modal */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {plan.titulo}
              </h2>
              <p className="text-gray-300">
                {plan.subtitulo}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido del modal */}
        <div className="p-6 space-y-6">
          {/* Mensaje personalizado */}
          {personalizedMessage && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4">
              <p className="text-yellow-100">{personalizedMessage}</p>
            </div>
          )}

          {/* Información del entrenamiento */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Target size={20} className="text-yellow-400 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-400">
                {plan.tipo_nombre?.toUpperCase()} en Casa
              </h3>
            </div>
            <p className="text-gray-300 mb-4">Entrenamiento personalizado adaptado a tu equipamiento</p>

            <div className="space-y-2 text-sm">
              <p className="text-gray-300">
                <span className="font-semibold">Fuente del plan:</span> {planSource?.label || 'OpenAI'}{planSource?.detail ? ` (${planSource.detail})` : ''}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold">Perfil:</span> {plan.perfil_usuario}
              </p>
            </div>

            {/* Barra de progreso */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Progreso</span>
                <span>0%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>

            {/* Información adicional */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
              <span>Fecha: {plan.fecha_formateada}</span>
              <span>Equipo: {plan.equipamiento}</span>
              <span>Tipo: {plan.tipoEntrenamiento}</span>
              <span>Duración estimada: {plan.duracion_estimada_min} min</span>
            </div>
          </div>

          {/* Lista de ejercicios */}
          {plan.ejercicios && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Ejercicios del Plan</h4>
              <div className="space-y-3">
                {plan.ejercicios.map((ejercicio, idx) => (
                  <div key={idx} className="bg-gray-700/30 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">{ejercicio.nombre}</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300 mb-2">
                      <span>Series: {ejercicio.series}</span>
                      {ejercicio.repeticiones && <span>Reps: {ejercicio.repeticiones}</span>}
                      {ejercicio.duracion_seg && <span>Duración: {ejercicio.duracion_seg}s</span>}
                      <span>Descanso: {ejercicio.descanso_seg}s</span>
                    </div>
                    {ejercicio.notas && (
                      <p className="text-xs text-gray-400 italic">{ejercicio.notas}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={onGenerateAnother}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Generar Otro Plan
            </button>
            <button
              onClick={onStart}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Comenzar Entrenamiento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeTrainingPlanModal;

