import React from 'react';

// Muestra progreso de la sesión de Rutinas (local y de BD). percentage = 0..100
export default function SessionProgress({ total, completed, session }) {
  // Usar datos de la sesión de BD si están disponibles
  const sessionTotal = session?.total_exercises ?? total;
  const sessionCompleted = session?.exercises_completed ?? completed;
  const percent = sessionTotal > 0 ? Math.round((sessionCompleted / sessionTotal) * 100) : 0;
  
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300">Progreso de la Sesión</span>
        <span className="text-gray-400">
          {percent}% ({sessionCompleted}/{sessionTotal})
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-2 bg-yellow-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

