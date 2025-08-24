import React from 'react';

// Muestra progreso de la sesión de Rutinas (local). percentage = 0..100
export default function SessionProgress({ total, completed }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300">Progreso</span>
        <span className="text-gray-400">{percent}%</span>
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

