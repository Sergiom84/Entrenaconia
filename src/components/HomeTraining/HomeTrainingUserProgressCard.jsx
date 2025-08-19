import React from 'react';
import { TrendingUp } from 'lucide-react';

const HomeTrainingUserProgressCard = ({ userStats }) => {
  if (!userStats) return null;

  const formatDuration = (seconds) => {
    const hours = Math.floor((Number(seconds) || 0) / 3600);
    const minutes = Math.floor(((Number(seconds) || 0) % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getNivelLabel = (nivel) => {
    const niveles = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    return niveles[nivel] || 'Intermedio';
  };

  return (
    <div className="bg-gray-800/70 backdrop-blur-sm border border-gray-600 rounded-2xl p-6 mb-6">
      <div className="flex items-center mb-4">
        <TrendingUp className="text-yellow-400 mr-2" size={24} />
        <h3 className="text-xl font-semibold text-white">
          Tu Progreso en Casa - {userStats.userName || 'Usuario'}
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-400 mb-1">
            {userStats.total_sessions || 0}
          </div>
          <div className="text-sm text-gray-400">Rutinas Completadas</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400 mb-1">
            {userStats.total_exercises_completed || 0}
          </div>
          <div className="text-sm text-gray-400">Ejercicios Completados</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-blue-400 mb-1">
            {formatDuration(userStats.total_exercise_duration_seconds || userStats.total_duration_seconds || 0)}
          </div>
          <div className="text-sm text-gray-400">Tiempo Total</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-400 mb-1">
            {getNivelLabel(userStats.current_level)}
          </div>
          <div className="text-sm text-gray-400">Nivel Actual</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-purple-400 mb-1">
            {userStats.current_streak_days || 0} días
          </div>
          <div className="text-sm text-gray-400">Racha Actual</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          <span className="font-semibold">Tu Espacio de Entrenamiento:</span>
          {userStats.training_space || 'No especificado'}
        </p>
      </div>
    </div>
  );
};

export default HomeTrainingUserProgressCard;

