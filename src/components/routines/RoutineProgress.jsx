import React from 'react';
import { TrendingUp, Clock, Target, Calendar } from 'lucide-react';

const RoutineProgress = ({
  currentRoutine,
  sessionExercises = [],
  progress,
  userStats,
  onContinueTraining,
  onGenerateNewRoutine
}) => {
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

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

  if (!currentRoutine) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto mb-8">
      {/* Plan actual */}
      <div className="bg-gray-800/70 backdrop-blur-sm border border-gray-600 rounded-2xl p-6">
        <div className="flex items-center mb-4">
          <Target className="text-yellow-400 mr-2" size={24} />
          <h3 className="text-xl font-semibold text-yellow-400">
            {getMethodologyLabel(currentRoutine.methodology_type).toUpperCase()}
          </h3>
        </div>
        
        <p className="text-gray-300 mb-4">Rutina personalizada generada por IA</p>

        <div className="space-y-2 text-sm mb-6">
          <p className="text-gray-300">
            <span className="font-semibold">Metodología:</span> {currentRoutine.methodology_type}
          </p>
          <p className="text-gray-300">
            <span className="font-semibold">Frecuencia:</span> {currentRoutine.frequency_per_week} días/semana
          </p>
          <p className="text-gray-300">
            <span className="font-semibold">Duración del plan:</span> {currentRoutine.total_weeks} semanas
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-semibold">Progreso</span>
            <span className="text-white font-semibold">{Math.round(progress.percentage)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Información del entrenamiento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300 mb-6">
          <div className="flex items-center">
            <Calendar size={16} className="mr-2" />
            <span>Fecha: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
          </div>
          <div className="flex items-center">
            <Target size={16} className="mr-2" />
            <span>Semana: {progress.currentWeek || 1}</span>
          </div>
          <div className="flex items-center">
            <TrendingUp size={16} className="mr-2" />
            <span>Sesión: {progress.currentSession || 1}</span>
          </div>
          <div className="flex items-center">
            <Clock size={16} className="mr-2" />
            <span>Duración estimada: {currentRoutine.estimated_duration || 60} min</span>
          </div>
        </div>

        {/* Lista de ejercicios con progreso */}
        {currentRoutine.exercises && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-4">Ejercicios del Día</h4>
            <div className="space-y-3">
              {currentRoutine.exercises.map((ejercicio, idx) => {
                // Enlazar datos del backend (status/feedback y total_series) si existen
                const exSession = sessionExercises?.find(e => e.exercise_order === idx) || {};
                const status = exSession.status || (progress.completedExercises.includes(idx) ? 'completed' : (progress.currentExercise === idx ? 'in_progress' : 'pending'));
                const isCompleted = status === 'completed';
                const isCurrent = status === 'in_progress' || progress.currentExercise === idx;
                const sentiment = exSession.feedback_sentiment;
                const comment = exSession.feedback_comment || exSession.comment;

                return (
                  <div
                    key={idx}
                    className={`rounded-lg p-4 border-l-4 ${
                      isCompleted
                        ? 'bg-green-900/20 border-green-500'
                        : isCurrent
                        ? 'bg-blue-900/20 border-blue-500'
                        : status === 'cancelled'
                        ? 'bg-red-900/10 border-red-500'
                        : 'bg-gray-700/30 border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h5 className={`font-semibold ${
                        isCompleted ? 'text-green-400' : isCurrent ? 'text-blue-400' : status === 'cancelled' ? 'text-red-300' : 'text-white'
                      }`}>
                        {ejercicio.nombre}
                        {isCompleted && comment && comment.trim() && (
                          <span className="ml-2 text-xs">
                            • {comment}
                          </span>
                        )}
                        {!isCompleted && isCurrent && <span className="ml-2 text-xs text-blue-300">• En progreso</span>}
                        {!isCompleted && !isCurrent && status === 'skipped' && (
                          <span className="ml-2 text-xs text-gray-300">• Saltado{sentiment ? `, ${sentiment === 'love' ? 'Me encanta' : sentiment === 'hard' ? 'Es difícil' : 'No me gusta'}` : ''}</span>
                        )}
                        {!isCompleted && !isCurrent && status === 'cancelled' && (
                          <span className="ml-2 text-xs text-red-300">• Cancelado{sentiment ? `, ${sentiment === 'love' ? 'Me encanta' : sentiment === 'hard' ? 'Es difícil' : 'No me gusta'}` : ''}</span>
                        )}
                      </h5>
                      
                      {/* Estado del ejercicio en el lado derecho */}
                      <div className="text-sm">
                        {isCompleted ? (
                          <span className="text-green-400">Completado</span>
                        ) : isCurrent ? (
                          <span className="text-blue-400">En progreso</span>
                        ) : status === 'skipped' ? (
                          <span className="text-gray-400">Saltado</span>
                        ) : status === 'cancelled' ? (
                          <span className="text-red-400">Cancelado</span>
                        ) : (
                          <span className="text-gray-500">Pendiente</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300 mt-2">
                      <span>Series: {ejercicio.series}</span>
                      {ejercicio.repeticiones && <span>Reps: {ejercicio.repeticiones}</span>}
                      {ejercicio.duracion_seg && <span>Duración: {ejercicio.duracion_seg}s</span>}
                      <span>Descanso: {ejercicio.descanso_seg}s</span>
                    </div>

                    {ejercicio.notas && (
                      <p className="text-xs text-gray-400 italic mt-2">{ejercicio.notas}</p>
                    )}

                    {/* Información adicional del ejercicio */}
                    {(ejercicio.intensidad || ejercicio.tempo) && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {ejercicio.intensidad && (
                          <span className="text-red-300">
                            <span className="text-gray-400">Intensidad:</span> {ejercicio.intensidad}
                          </span>
                        )}
                        {ejercicio.tempo && (
                          <span className="text-purple-300">
                            <span className="text-gray-400">Tempo:</span> {ejercicio.tempo}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Mostrar comentario del usuario si existe */}
                    {comment && comment.trim() && (
                      <div className="mt-2 p-2 bg-yellow-400/10 border border-yellow-400/20 rounded text-xs">
                        <span className="text-yellow-400 font-medium">Mi comentario: </span>
                        <span className="text-yellow-200">{comment}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-4">
          <button
            onClick={onGenerateNewRoutine}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Generar Nueva Rutina
          </button>
          
          {(() => {
            // Verificar si todos los ejercicios de la sesión actual están completados
            const todosEjerciciosCompletados = currentRoutine.exercises && 
              currentRoutine.exercises.every((_, idx) => {
                const exSession = sessionExercises?.find(e => e.exercise_order === idx) || {};
                return exSession.status === 'completed' || progress.completedExercises.includes(idx);
              });
            
            // Si todos los ejercicios están completados, mostrar "Entrenamiento Finalizado"
            if (todosEjerciciosCompletados && currentRoutine.exercises && currentRoutine.exercises.length > 0) {
              return (
                <button
                  onClick={onContinueTraining}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Entrenamiento Finalizado
                </button>
              );
            }
            
            // Si la rutina completa está terminada (todas las semanas)
            if (progress.percentage >= 100) {
              return (
                <>
                  <button
                    onClick={onGenerateNewRoutine}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    ¡Rutina Completada! Generar Nueva
                  </button>
                  <button
                    onClick={onContinueTraining}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    Reanudar ejercicios
                  </button>
                </>
              );
            }
            
            // Caso normal - entrenamientos pendientes
            return (
              <button
                onClick={onContinueTraining}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                {progress.percentage === 0 ? 'Comenzar Rutina' : 'Continuar Entrenamiento'}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default RoutineProgress;