import React from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const RoutineSessionSummary = ({
  currentRoutine,
  sessionExercises = [],
  progress,
  onContinueTraining,
  onGenerateNewPlan
}) => {
  if (!currentRoutine) return null;

  const planSourceLabel = currentRoutine?.planSource?.label || 'OpenAI';
  const planSourceDetail = currentRoutine?.planSource?.detail || '';
  const perfil = currentRoutine?.perfil || {};

  const fmt2 = (v) => (v == null || isNaN(Number(v)) ? '—' : Number(v).toFixed(2));
  const fmt1 = (v) => (v == null || isNaN(Number(v)) ? '—' : Number(v).toFixed(1));

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

  const getExerciseStatus = (exerciseIndex) => {
    const session = sessionExercises?.[exerciseIndex];
    if (session?.status) return session.status;
    if (progress.completedExercises.includes(exerciseIndex)) return 'completed';
    if (progress.currentExercise === exerciseIndex) return 'in_progress';
    return 'pending';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'in_progress':
        return <Clock size={16} className="text-blue-400" />;
      case 'skipped':
        return <AlertCircle size={16} className="text-yellow-400" />;
      case 'cancelled':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-500 rounded-full"></div>;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      case 'skipped':
        return 'Saltado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return 'Pendiente';
    }
  };

  const getStatusColors = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900/20 border-green-500';
      case 'in_progress':
        return 'bg-blue-900/20 border-blue-500';
      case 'skipped':
        return 'bg-yellow-900/20 border-yellow-500';
      case 'cancelled':
        return 'bg-red-900/20 border-red-500';
      default:
        return 'bg-gray-700/30 border-gray-600';
    }
  };

  return (
    <div className="bg-gray-800/70 backdrop-blur-sm border border-gray-600 rounded-2xl p-6 mb-8">
      {/* Header del resumen */}
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center mr-3">
          <span className="text-black font-bold text-sm">●</span>
        </div>
        <div>
          <h3 className="text-yellow-400 font-semibold text-lg">
            {getMethodologyLabel(currentRoutine.methodology_type)}
          </h3>
          <p className="text-gray-400 text-sm">
            Rutina personalizada basada en la metodología seleccionada
          </p>
        </div>
      </div>

      {/* Información del perfil */}
      <div className="mb-4 text-xs text-gray-300">
        <p>
          <span className="font-medium">Fuente del plan:</span> {planSourceLabel} {planSourceDetail && <span className="text-gray-400">{planSourceDetail}</span>}
        </p>
        <p>
          <span className="font-medium">Perfil:</span> {perfil?.nombre || '—'} — Edad: {perfil?.edad ?? '—'}, Peso: {fmt2(perfil?.peso)} kg, Altura: {fmt2(perfil?.altura)} cm, Nivel: {perfil?.nivel || '—'}, IMC: {fmt1(perfil?.imc)}
        </p>
      </div>

      {/* Barra de progreso */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-medium">Progreso</span>
          <span className="text-white">{Math.round(progress?.percentage || 0)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${progress?.percentage || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Información adicional en grid */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-xs text-gray-400">
        <div>
          <span className="block">Fecha: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
        </div>
        <div>
          <span className="block">Tipo: {getMethodologyLabel(currentRoutine.methodology_type)}</span>
        </div>
        <div>
          <span className="block">Duración estimada: {currentRoutine.estimated_duration} min</span>
        </div>
      </div>

      {/* Lista de ejercicios del plan */}
      <div className="mb-6">
        <h4 className="text-white font-semibold mb-4">Ejercicios del Plan</h4>
        <div className="space-y-3">
          {currentRoutine.exercises && currentRoutine.exercises.map((exercise, index) => {
            const status = getExerciseStatus(index);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'in_progress';
            const isSkipped = status === 'skipped';
            const isCancelled = status === 'cancelled';
            
            return (
              <div 
                key={index} 
                className={`rounded-lg p-4 border-l-4 ${getStatusColors(status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      {getStatusIcon(status)}
                      <h5 className={`font-medium ml-2 ${
                        isCompleted ? 'text-green-300' : 
                        isCurrent ? 'text-blue-300' :
                        isSkipped ? 'text-yellow-300' :
                        isCancelled ? 'text-red-300' :
                        'text-white'
                      }`}>
                        {exercise.nombre}
                        {isCompleted && <span className="text-green-400 ml-2">• Completado</span>}
                        {isSkipped && <span className="text-yellow-400 ml-2">• Saltado</span>}
                        {isCancelled && <span className="text-red-400 ml-2">• Cancelado</span>}
                      </h5>
                    </div>
                    
                    <div className="text-sm text-gray-300 mb-2">
                      <span className="font-medium">Series:</span> {exercise.series} &nbsp;&nbsp;&nbsp;
                      <span className="font-medium">Reps:</span> {exercise.repeticiones} &nbsp;&nbsp;&nbsp;
                      <span className="font-medium">Descanso:</span> {exercise.descanso_seg}s
                    </div>
                    
                    {exercise.notas && (
                      <p className="text-gray-400 text-xs">{exercise.notas}</p>
                    )}

                    {/* Comentarios del usuario si existen */}
                    {sessionExercises[index]?.comment && (
                      <div className="mt-2 bg-gray-600/30 rounded p-2">
                        <p className="text-gray-300 text-xs">
                          <span className="font-medium">Comentario:</span> {sessionExercises[index].comment}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 text-right">
                    <span className={`text-xs px-2 py-1 rounded ${
                      isCompleted ? 'bg-green-900/30 text-green-300' : 
                      isCurrent ? 'bg-blue-900/30 text-blue-300' :
                      isSkipped ? 'bg-yellow-900/30 text-yellow-300' :
                      isCancelled ? 'bg-red-900/30 text-red-300' :
                      'bg-gray-700/30 text-gray-400'
                    }`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={onGenerateNewPlan}
          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Generar Otro Plan
        </button>
        <button
          onClick={onContinueTraining}
          className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Continuar Entrenamiento
        </button>
      </div>
    </div>
  );
};

export default RoutineSessionSummary;