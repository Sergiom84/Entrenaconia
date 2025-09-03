import React, { useEffect, useState } from 'react';
import { X, Info } from 'lucide-react';

export default function ExerciseInfoModal({ show, exercise, onClose }) {
  const [tab, setTab] = useState('ejecucion'); // ejecucion | consejos | errores
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ ejecucion: '', consejos: '', errores_evitar: '' });

  useEffect(() => {
    if (!show) return;
    let isCancelled = false;

    const fetchInfo = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const res = await fetch('/api/ia-home-training/exercise-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ exerciseName: exercise?.nombre })
        });
        const json = await res.json();
        if (!isCancelled) {
          if (json?.success && json?.exerciseInfo) {
            setData(json.exerciseInfo);
          } else {
            setError('No se pudo obtener la información en este momento.');
          }
        }
      } catch (e) {
        if (!isCancelled) setError('Error de red al obtener la información.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchInfo();
    return () => { isCancelled = true; };
  }, [show, exercise?.nombre]);

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

          {/* Métricas básicas */}
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

          {/* Pestañas */}
          <div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setTab('ejecucion')} className={`px-3 py-2 rounded-md text-sm font-semibold ${tab==='ejecucion' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>Cómo ejecutarlo</button>
              <button onClick={() => setTab('consejos')} className={`px-3 py-2 rounded-md text-sm font-semibold ${tab==='consejos' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>Consejos para ejecutarlo</button>
              <button onClick={() => setTab('errores')} className={`px-3 py-2 rounded-md text-sm font-semibold ${tab==='errores' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>Qué evitar y errores comunes</button>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-3 min-h-[120px]">
              {loading && <p className="text-gray-300 text-sm">Cargando…</p>}
              {!loading && error && <p className="text-red-300 text-sm">{error}</p>}
              {!loading && !error && (
                <p className="text-gray-200 text-sm leading-relaxed">
                  {tab==='ejecucion' && (data.ejecucion || 'Sin datos disponibles')}
                  {tab==='consejos' && (data.consejos || 'Sin datos disponibles')}
                  {tab==='errores' && (data.errores_evitar || 'Sin datos disponibles')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
