import React from 'react';
import { X, Info } from 'lucide-react';

export default function ExerciseInfoModal({ show, exercise, onClose }) {
  if (!show) return null;
  const ex = exercise || {};
  const repsValue = Number(ex?.repeticiones ?? ex?.reps ?? ex?.repeticiones_por_serie);
  const durValue = Number(ex?.duracion_seg ?? ex?.duracion ?? ex?.tiempo_segundos);
  const seriesTotal = Number(ex?.series ?? ex?.total_series ?? ex?.series_totales) || 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-800 border border-gray-700 rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Info className="text-blue-400" size={20} />
            <h3 className="text-white font-semibold">Información del Ejercicio</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-lg font-bold text-white">{ex?.nombre || 'Ejercicio'}</h4>
            {(ex?.categoria || ex?.grupo_muscular) && (
              <p className="text-sm text-gray-400">{ex?.categoria || ex?.grupo_muscular}</p>
            )}
          </div>

          {/* Bloque métrico como HomeTraining */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center bg-gray-700/30 rounded-lg p-3">
            <div>
              <div className="text-xl font-bold text-white">{seriesTotal}</div>
              <div className="text-xs text-gray-400">Series</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {Number.isFinite(repsValue) && repsValue > 0
                  ? repsValue
                  : Number.isFinite(durValue) && durValue > 0
                    ? `${durValue}s`
                    : '—'}
              </div>
              <div className="text-xs text-gray-400">
                {Number.isFinite(repsValue) && repsValue > 0 ? 'Repeticiones' : 'Duración'}
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">{(Number(ex?.descanso_seg) || 45)}s</div>
              <div className="text-xs text-gray-400">Descanso</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white capitalize">{String(ex?.nivel || '—')}</div>
              <div className="text-xs text-gray-400">Nivel</div>
            </div>
          </div>

          {/* Información del ejercicio estilo HomeTraining */}
          {(ex?.patron || ex?.implemento) && (
            <div className="bg-gray-700/30 rounded-lg p-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {ex?.patron && (
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    <span className="text-gray-300">Patrón:</span>
                    <span className="text-white font-medium ml-1 capitalize">{String(ex.patron).replaceAll('_',' ')}</span>
                  </div>
                )}
                {ex?.implemento && (
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    <span className="text-gray-300">Implemento:</span>
                    <span className="text-white font-medium ml-1 capitalize">{String(ex.implemento).replaceAll('_',' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pestañas simples: Ejecución / Consejos / A evitar */}
          {(ex?.informacion_detallada || ex?.ejercicio_ejecucion || ex?.ejercicio_consejos || ex?.ejercicio_errores_evitar || ex?.notas) && (
            <div className="space-y-3">
              { (ex?.informacion_detallada?.ejecucion || ex?.ejercicio_ejecucion) && (
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <h5 className="text-white font-semibold text-sm mb-1">Ejecución</h5>
                  <p className="text-gray-300 text-sm leading-relaxed">{ex?.informacion_detallada?.ejecucion || ex?.ejercicio_ejecucion}</p>
                </div>
              )}
              { (ex?.informacion_detallada?.consejos || ex?.ejercicio_consejos || ex?.notas) && (
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                  <h5 className="text-blue-200 font-semibold text-sm mb-1">Consejos</h5>
                  <p className="text-blue-200 text-sm leading-relaxed">{ex?.informacion_detallada?.consejos || ex?.ejercicio_consejos || ex?.notas}</p>
                </div>
              )}
              { (ex?.informacion_detallada?.errores_evitar || ex?.ejercicio_errores_evitar) && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3">
                  <h5 className="text-red-200 font-semibold text-sm mb-1">A evitar</h5>
                  <p className="text-red-200 text-sm leading-relaxed">{ex?.informacion_detallada?.errores_evitar || ex?.ejercicio_errores_evitar}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

