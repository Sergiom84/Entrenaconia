import React from 'react';
import { TrendingUp, Calendar, Clock, Target, Zap } from 'lucide-react';

const RoutineStatsCard = ({ routineStats, plan, totalProgress }) => {
  if (!routineStats && !plan) return null;

  const stats = routineStats || {};
  
  const formatTime = (minutes) => {
    if (!minutes || minutes === 0) return '0m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatStreak = (days) => {
    if (!days || days === 0) return '0 días';
    return `${days} día${days !== 1 ? 's' : ''}`;
  };

  const getNivelLabel = (nivel) => {
    const niveles = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio', 
      'avanzado': 'Avanzado',
      'beginner': 'Principiante',
      'intermediate': 'Intermedio',
      'advanced': 'Avanzado'
    };
    return niveles[nivel?.toLowerCase()] || 'Intermedio';
  };

  return (
    <div className="bg-gray-800/70 backdrop-blur-sm border border-yellow-400/40 rounded-2xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
          <TrendingUp size={18} className="text-black" />
        </div>
        <div>
          <h3 className="text-yellow-400 font-semibold text-lg">
            Tu Progreso en {plan?.selected_style || 'Rutina'}
          </h3>
          <p className="text-gray-400 text-sm">
            Estadísticas de tu entrenamiento actual
          </p>
        </div>
      </div>

      {/* Barra de progreso total */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-medium">Progreso Total</span>
          <span className="text-white">{Math.round(totalProgress || 0)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-yellow-400 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${totalProgress || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Estadísticas en grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Sesiones Completadas */}
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">
            {stats.completed_sessions || 0}
          </div>
          <div className="text-xs text-gray-300">
            Sesiones<br />Completadas
          </div>
        </div>

        {/* Ejercicios Completados */}
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {stats.completed_exercises || 0}
          </div>
          <div className="text-xs text-gray-300">
            Ejercicios<br />Completados
          </div>
        </div>

        {/* Tiempo Total */}
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400 mb-1">
            {formatTime(stats.total_training_time || 0)}
          </div>
          <div className="text-xs text-gray-300">
            Tiempo<br />Total
          </div>
        </div>

        {/* Nivel Actual */}
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            {getNivelLabel(stats.current_level)}
          </div>
          <div className="text-xs text-gray-300">
            Nivel<br />Actual
          </div>
        </div>

        {/* Racha Actual */}
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400 mb-1">
            {formatStreak(stats.current_streak || 0)}
          </div>
          <div className="text-xs text-gray-300">
            Racha<br />Actual
          </div>
        </div>
      </div>

      {/* Información adicional */}
      {stats.methodology_type && (
        <div className="mt-4 text-xs text-gray-400 border-t border-gray-700 pt-4">
          <p>
            <span className="font-medium">Metodología:</span> {stats.methodology_type} • 
            <span className="font-medium"> Última sesión:</span> {
              stats.last_session_date 
                ? new Date(stats.last_session_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
                : 'Ninguna'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default RoutineStatsCard;