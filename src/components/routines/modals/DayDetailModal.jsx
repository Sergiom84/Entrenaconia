import React from 'react';
import { X, Dumbbell } from 'lucide-react';

/**
 * Modal de Detalle de Día
 * Muestra los ejercicios completos de un día específico del plan
 * NO es Home Training - es solo preview de la sesión del plan
 */
const DayDetailModal = ({ isOpen, onClose, day }) => {
  if (!isOpen || !day) return null;

  const exercises = day.ejercicios || [];
  const muscleGroups = day.muscleGroups || [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">
              {day.date || 'Día de Entrenamiento'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {muscleGroups.map((group, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium"
                >
                  {group}
                </span>
              ))}
            </div>
            <p className="text-white/80 text-sm mt-2">
              {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors ml-4"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {exercises.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay ejercicios para este día</p>
            </div>
          ) : (
            exercises.map((exercise, idx) => {
              const intensityColor = getIntensityColor(exercise.intensidad);
              
              return (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  {/* Exercise Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                          #{idx + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                          {exercise.nombre || exercise.name || 'Ejercicio'}
                        </h3>
                      </div>
                      {exercise.grupo_muscular && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {exercise.grupo_muscular}
                        </p>
                      )}
                    </div>
                    {exercise.intensidad && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${intensityColor}`}>
                        {exercise.intensidad}
                      </span>
                    )}
                  </div>

                  {/* Exercise Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {exercise.series && (
                      <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Series</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {exercise.series}
                        </p>
                      </div>
                    )}
                    {exercise.repeticiones && (
                      <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reps</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {exercise.repeticiones}
                        </p>
                      </div>
                    )}
                    {exercise.descanso && (
                      <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Descanso</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {exercise.descanso}s
                        </p>
                      </div>
                    )}
                    {exercise.rir !== undefined && (
                      <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">RIR</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {exercise.rir}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Additional Info */}
                  {exercise.notas && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-200">
                        💡 {exercise.notas}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function for intensity colors
const getIntensityColor = (intensity) => {
  if (!intensity) return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  
  const intensityLower = intensity.toLowerCase();
  
  if (intensityLower.includes('alta') || intensityLower.includes('high')) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  }
  if (intensityLower.includes('media') || intensityLower.includes('medium')) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  }
  if (intensityLower.includes('baja') || intensityLower.includes('low')) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  }
  
  return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
};

export default DayDetailModal;

