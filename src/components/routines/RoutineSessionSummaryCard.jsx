import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Dumbbell, AlertTriangle, CheckCircle } from 'lucide-react';
import { getSessionProgress } from './api';

/**
 * Muestra el resumen de la sesión con barra de progreso y listado de ejercicios
 * - Colores por estado: completed (verde), skipped (gris), cancelled (rojo)
 * - Muestra comentarios y "Es difícil" si el feedback lo indica
 */
export default function RoutineSessionSummaryCard({ sessionId, plan, planSource, selectedSession, onGenerateAnother, onContinueTraining }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // { session, exercises, summary }

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getSessionProgress(sessionId);
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e.message || 'No se pudo cargar el progreso');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [sessionId]);

  const exercises = useMemo(() => Array.isArray(data?.exercises) ? data.exercises : [], [data]);
  const session = data?.session || {};

  const computed = useMemo(() => {
    const total = exercises.length || 0;
    const completed = exercises.filter(e => (e.status || '').toLowerCase() === 'completed').length;
    const skipped = exercises.filter(e => (e.status || '').toLowerCase() === 'skipped').length;
    const cancelled = exercises.filter(e => (e.status || '').toLowerCase() === 'cancelled').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, skipped, cancelled, percentage };
  }, [exercises]);

  const renderStatusPill = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return <span className="ml-2 text-green-300 text-xs inline-flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Completado</span>;
    if (s === 'cancelled') return <span className="ml-2 text-red-300 text-xs">Cancelado</span>;
    if (s === 'skipped') return <span className="ml-2 text-gray-400 text-xs">Saltado</span>;
    return null;
  };

  const cardClassesByStatus = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'border-green-600 bg-green-900/20';
    if (s === 'cancelled') return 'border-red-600 bg-red-900/20';
    if (s === 'skipped') return 'border-gray-700 bg-gray-800/50';
    return 'border-gray-700 bg-gray-800/40';
  };

  if (!sessionId) return null;

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-5 text-white">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-yellow-400 rounded-full" />
        <h2 className="text-xl font-semibold">
          {plan?.selected_style || plan?.metodologia || session?.methodology_type || 'Entrenamiento de Hoy'}
        </h2>
      </div>
      <p className="text-sm text-gray-300">
        {(() => {
          const methodology = plan?.selected_style || session?.methodology_type;
          if (methodology === 'Hipertrofia') return 'Entrenamiento de hipertrofia para gimnasio';
          if (methodology === 'Powerlifting') return 'Entrenamiento de fuerza con pesas libres';
          if (methodology === 'Funcional') return 'Entrenamiento funcional completo';
          if (methodology === 'Heavy Duty') return 'Entrenamiento de alta intensidad';
          if (methodology === 'Crossfit') return 'Entrenamiento variado de alta intensidad';
          if (methodology === 'Oposiciones') return 'Preparación física específica';
          return 'Entrenamiento personalizado adaptado a tu perfil';
        })()}
      </p>
      <div className="text-xs text-gray-400 mt-1 mb-4">
        <div>Fuente del plan: {planSource?.label || 'OpenAI'}</div>
        {/* Perfil */}
        <div>
          Perfil: {(() => {
            try {
              const p = JSON.parse(localStorage.getItem('userProfile') || '{}');
              const edad = p.edad ? `${p.edad}` : '—';
              const peso = p.peso ? `${Number(p.peso).toFixed(1)} kg` : '—';
              const altura = p.altura ? `${p.altura} cm` : '—';
              const nivel = p.nivel || p.nivel_entrenamiento || '—';
              const imc = p.peso && p.altura ? (p.peso / ((p.altura/100)*(p.altura/100))).toFixed(1) : '—';
              return `Edad: ${edad}, Peso: ${peso}, Altura: ${altura}, Nivel: ${nivel}, IMC: ${imc}`;
            } catch { return '—'; }
          })()}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-300 mb-1">
          <span>Progreso</span>
          <span>{computed.percentage}%</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-300" style={{ width: `${computed.percentage}%` }} />
        </div>
        <div className="mt-2 text-xs text-gray-400">
          {computed.completed}/{computed.total} completados
          {computed.skipped ? ` • ${computed.skipped} saltados` : ''}
          {computed.cancelled ? ` • ${computed.cancelled} cancelados` : ''}
        </div>
      </div>

      {/* Metadatos */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mb-4">
        <div className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Fecha: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'numeric' })}</div>
        <div className="inline-flex items-center gap-1"><Dumbbell className="w-3 h-3"/> Equipo: {plan?.equipamiento || plan?.equipment || 'Mínimo'}</div>
        <div className="inline-flex items-center gap-1"><Dumbbell className="w-3 h-3"/> Tipo: {plan?.selected_style || plan?.metodologia || 'HIIT'}</div>
        <div className="inline-flex items-center gap-1"><Clock className="w-3 h-3"/> Duración estimada: {(() => {
          const semana1 = Array.isArray(plan?.semanas) ? plan.semanas[0] : null;
          const ses = semana1 ? (semana1.sesiones || [])[0] : null;
          const est = ses?.duracion_sesion_min || session?.estimated_min;
          return est ? `${est} min` : '—';
        })()}</div>
      </div>

      {/* Lista de ejercicios */}
      <div className="space-y-3">
        <h3 className="text-sm text-gray-300 font-semibold">Ejercicios del plan</h3>
        {loading && <div className="text-gray-400 text-sm">Cargando progreso…</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {!loading && !error && exercises.map((e, idx) => {
          const status = (e.status || '').toLowerCase();
          const sentiment = (e.feedback?.sentiment || e.sentiment || '').toLowerCase();
          const comment = e.feedback?.comment || e.comment || '';
          // const isHard = sentiment === 'hard'; // unused variable
          return (
            <div key={idx} className={`rounded-lg border p-3 ${cardClassesByStatus(status)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-white">
                  {e.exercise_name || e.nombre || `Ejercicio ${idx + 1}`}
                  {renderStatusPill(status)}
                  {sentiment === 'love' && <span className="ml-2 text-green-300 text-xs inline-flex items-center gap-1">❤️ Me ha encantado</span>}
                  {sentiment === 'hard' && <span className="ml-2 text-yellow-300 text-xs inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Es difícil</span>}
                  {sentiment === 'dislike' && <span className="ml-2 text-red-300 text-xs inline-flex items-center gap-1">😞 No me gusta</span>}
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  Descanso: {Number(e.descanso_seg) || 45}s
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-300 mt-2">
                <div><span className="text-gray-400">Series:</span> {Number(e.series_total || e.series) || 3}</div>
                <div><span className="text-gray-400">Reps:</span> {e.repeticiones || '—'}</div>
                <div className="md:col-span-2 text-gray-400">
                  {(e.notas || e.tip) && <span className="text-gray-300">{e.notas || e.tip}</span>}
                </div>
              </div>
              {comment && (
                <div className="mt-2 text-xs bg-yellow-900/20 border border-yellow-500/40 rounded px-2 py-1 text-yellow-200 inline-block">
                  Mi comentario: {comment}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <button onClick={onGenerateAnother} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded">Generar Otro Plan</button>
        <button onClick={onContinueTraining} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded">
          Rutina del día: {(selectedSession?.dia || session?.day_name || '').toString()} finalizada
        </button>
      </div>
    </div>
  );
}

