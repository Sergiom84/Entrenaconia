import { X } from 'lucide-react';

const RoutinePlanModal = ({
  plan,
  planSource,
  personalizedMessage,
  onStart,
  onGenerateAnother,
  onClose,
}) => {
  if (!plan) return null;

  const getMethodologyLabel = (methodology) => {
    const methodologies = {
      'Heavy Duty': 'Heavy Duty',
      'Powerlifting': 'Powerlifting', 
      'Hipertrofia': 'Hipertrofia',
      'Funcional': 'Funcional',
      'Oposiciones': 'Oposiciones',
      'Crossfit': 'Crossfit',
      'Calistenia': 'Calistenia',
      'Entrenamiento en casa': 'Entrenamiento en Casa'
    };
    return methodologies[methodology] || methodology;
  };

  // Obtener los primeros ejercicios de la primera semana para mostrar
  const getFirstExercises = () => {
    if (!plan.semanas || !plan.semanas[0] || !plan.semanas[0].sesiones || !plan.semanas[0].sesiones[0]) {
      return [];
    }
    return plan.semanas[0].sesiones[0].ejercicios || [];
  };

  const firstExercises = getFirstExercises();
  const estimatedDuration = plan.duracion_estimada_min || 
    (firstExercises.length * 3) + (firstExercises.reduce((acc, ex) => acc + (ex.series * (ex.descanso_seg || 45) / 60), 0));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          {/* Título principal */}
          <h1 className="text-2xl font-bold text-white mb-2">
            {getMethodologyLabel(plan.selected_style || plan.methodology_type)} — Propuesta de Rutina
          </h1>
          <p className="text-gray-300 text-sm mb-6">
            Ejercicios innovadores y efectivos para avanzar en tu objetivo
          </p>

          {/* Mensaje destacado */}
          <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-6">
            <p className="text-yellow-200 text-sm leading-relaxed">
              {personalizedMessage || plan.rationale || `Vamos a optimizar tu entrenamiento de ${getMethodologyLabel(plan.selected_style || plan.methodology_type)} con una progresión efectiva y variada.`}
            </p>
          </div>

          {/* Información del plan */}
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center mr-3">
              <span className="text-black font-bold text-sm">●</span>
            </div>
            <div>
              <h2 className="text-yellow-400 font-semibold">
                {getMethodologyLabel(plan.selected_style || plan.methodology_type)}
              </h2>
              <p className="text-gray-400 text-sm">
                Rutina personalizada basada en la metodología seleccionada
              </p>
            </div>
          </div>

          {/* Detalles del plan */}
          <div className="mb-6 text-sm">
            <p className="text-gray-300">
              <span className="font-medium">Fuente del plan:</span> {planSource?.label || 'OpenAI'} {planSource?.detail || '(gpt-4.1-nano)'}
            </p>
            <p className="text-gray-300">
              <span className="font-medium">Perfil:</span> Edad: {plan.perfil_echo?.edad || 'N/A'}, Peso: {plan.perfil_echo?.peso || 'N/A'} kg, Altura: {plan.perfil_echo?.estatura || 'N/A'} cm, Nivel: {plan.perfil_echo?.nivel_actual_entreno || 'intermedio'}, IMC: {plan.perfil_echo?.imc || 'N/A'}
            </p>
          </div>

          {/* Barra de progreso */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Progreso</span>
              <span className="text-white">0%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-xs text-gray-400">
            <div>
              <span className="block">Fecha: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
            </div>
            <div>
              <span className="block">Tipo: {getMethodologyLabel(plan.selected_style || plan.methodology_type)}</span>
            </div>
            <div>
              <span className="block">Duración estimada: {Math.round(estimatedDuration)} min</span>
            </div>
          </div>

          {/* Lista de ejercicios del plan */}
          <div className="mb-8">
            <h3 className="text-white font-semibold mb-4">Ejercicios del Plan</h3>
            <div className="space-y-4">
              {firstExercises.slice(0, 4).map((exercise, index) => (
                <div key={index} className="bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">{exercise.nombre}</h4>
                  <div className="text-sm text-gray-300 mb-2">
                    <span className="font-medium">Series:</span> {exercise.series} &nbsp;&nbsp;&nbsp;
                    <span className="font-medium">Reps:</span> {exercise.repeticiones} &nbsp;&nbsp;&nbsp;
                    <span className="font-medium">Descanso:</span> {exercise.descanso_seg}s
                  </div>
                  <p className="text-gray-400 text-xs">{exercise.notas}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={onGenerateAnother}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              Generar Otro Plan
            </button>
            <button
              onClick={onStart}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              Comenzar Entrenamiento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutinePlanModal;