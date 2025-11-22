import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Info, SkipForward, Star, Target, Square, TrendingUp } from 'lucide-react';
import { getExerciseGifUrl } from '@/config/exerciseGifs.js';
import { getExerciseVideoUrl } from '@/config/exerciseVideos.js';
import { formatExerciseName } from '../../../utils/exerciseUtils';

function parseRepsText(raw) {
  if (!raw) return '';
  const str = String(raw);
  if (!str.includes('x')) return str;
  const parts = str.split('x');
  if (parts.length < 2) return str;
  return parts[1].trim();
}

/**
 * Vista del ejercicio actual - Solo UI
 *
 * Extraído de RoutineSessionModal.jsx para mejor organización
 * Se encarga únicamente de mostrar la interfaz del ejercicio actual
 * Sin lógica de estado compleja, recibe todo por props
 */
export const ExerciseSessionView = ({
  // Datos del ejercicio
  exercise,
  exerciseIndex,
  exerciseFeedback,

  // Estado del timer
  timerState,
  timerActions,

  // Estado del progreso
  progressState,

  // Callbacks de acciones
  onShowFeedback,
  onShowExerciseInfo,
  onShowSeriesTracking, // 🎯 Nuevo: Callback para tracking RIR
  onComplete,
  onSkip,
  onCancel,

  // Configuración
  allowManualTimer = true,
  timePerSeriesOptions = [
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '60s', value: 60 },
    { label: 'Off', value: 0 }
  ]
}) => {
  const [exerciseGif, setExerciseGif] = useState(null);

  // 🎬 Actualizar video/GIF cuando cambia ejercicio
  // Usa la configuración centralizada de src/config/exerciseVideos.js
  useEffect(() => {
    if (!exercise) return;

    // 🎯 PRIORIDAD DE CARGA:
    // 1. video_url de BD (producción)
    // 2. Video local (desarrollo según config)
    // 3. gif_url de BD
    // 4. GIF por defecto (getExerciseGifUrl)

    const videoUrl = getExerciseVideoUrl(exercise);

    if (videoUrl) {
      setExerciseGif(videoUrl);
    } else {
      // Fallback final: GIF por defecto
      setExerciseGif(getExerciseGifUrl(exercise.nombre));
    }
  }, [exercise]);

  if (!exercise) return null;

  const {
    phase,
    series,
    seriesTotal,
    timeLeft,
    isRunning,
    formattedTimeLeft,
    phaseColor,
    progressPercent,
    seriesText,
    isTimeBased,
    customTimePerSeries,
    canAdvanceManually,
    hasTimer
  } = timerState;

  const {
    start,
    toggle,
    reset,
    manualAdvance,
    setTimePerSeries
  } = timerActions;

  // Buscar reps en múltiples campos posibles
  let repsText = exercise?.series_reps_objetivo || exercise?.repeticiones || exercise?.reps || '';
  
  // 🎯 PARSEO INTELIGENTE: Si viene como "3-5x8-12", mostrar solo "8-12"
  // Regex busca patrón: (números) x (cualquier cosa)
  const seriesRepsMatch = typeof repsText === 'string' ? repsText.match(/^(\d+(?:-\d+)?)\s*x\s*(.+)$/i) : null;
  if (seriesRepsMatch) {
    repsText = seriesRepsMatch[2]; // Nos quedamos con la segunda parte (las reps)
  }

  // 🔥 CORRECCIÓN: Usar originalIndex para buscar feedback en BD
  const currentFeedback = exerciseFeedback?.[exercise?.originalIndex ?? exerciseIndex];

  return (
    <div className="bg-black/40 p-4 rounded-lg border border-gray-700">
      {/* Header del ejercicio - Nueva estructura unificada */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h4 className="text-white font-semibold text-lg flex-1">
          {formatExerciseName(exercise.nombre)}
          {/* 🎯 Indicador de volumen ajustado */}
          {exercise?.intensity_adjusted && (
            <span className="inline-flex items-center gap-1 px-2 py-1 ml-2 bg-orange-500/20 text-orange-400 rounded-md text-xs font-normal">
              <span className="text-lg">⚡</span>
              Volumen ajustado
            </span>
          )}
        </h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-gray-300">
            <span className="text-yellow-400 font-semibold">Ejercicio {progressState.currentIndex + 1}</span>
            <span className="text-gray-400"> de {progressState.total}</span>
          </div>
          <div className="text-gray-300">
            <span className="text-green-400 font-semibold">Serie {series}</span>
            <span className="text-gray-400"> de {seriesTotal}</span>
          </div>
        </div>
      </div>

      {/* 🎯 Mostrar nota de ajuste si existe */}
      {exercise?.adjustment_note && (
        <div className="mb-4 text-sm text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-md px-3 py-2">
          <span className="font-semibold">Nota:</span> {exercise.adjustment_note}
        </div>
      )}

      {/* Estado y cronómetro */}
      <div className="text-center mb-6">
        <h3 className={`text-lg font-semibold mb-2 ${phaseColor}`}>
          {phase === 'ready' ? `${seriesText}` :
           phase === 'exercise' ? `${seriesText}` :
           phase === 'rest' ? 'Tiempo de descanso' :
           '¡Ejercicio completado!'}
        </h3>

        {/* Timer circular */}
        <div className="relative w-32 h-32 mx-auto mb-2">
          <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
          <div
            className={`absolute inset-0 rounded-full border-4 border-t-transparent transition-all duration-1000 ${
              phase === 'exercise' ? 'border-green-400' :
              phase === 'rest' ? 'border-yellow-400' :
              'border-blue-400'
            }`}
            style={{ transform: `rotate(${progressPercent}deg)` }}
          />
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className={`text-3xl font-bold ${
              customTimePerSeries === 0 && phase === 'exercise' ? 'text-white' :
              timeLeft === 0 ? 'text-green-400 animate-pulse' :
              'text-white'
            }`}>
              {customTimePerSeries === 0 && phase === 'exercise' ? '--:--' :
               timeLeft === 0 ? '¡Listo!' :
               formattedTimeLeft}
            </span>
            {!isRunning && (phase === 'exercise' || phase === 'rest') && timeLeft > 0 && (
              <div className="text-xs text-gray-400 mt-1">Pausado</div>
            )}
            {timeLeft === 0 && phase === 'exercise' && customTimePerSeries !== 0 && (
              <div className="text-xs text-green-400 mt-1 animate-pulse">Serie completada</div>
            )}
            {timeLeft === 0 && phase === 'rest' && (
              <div className="text-xs text-green-400 mt-1 animate-pulse">Descanso terminado</div>
            )}
          </div>
        </div>
      </div>

      {/* Información del ejercicio */}
      <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{seriesTotal}</div>
            <div className="text-sm text-gray-400">Series</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {isTimeBased ? `${timerState.baseDuration}s` : (repsText || '—')}
            </div>
            <div className="text-sm text-gray-400">
              {isTimeBased ? 'Duración' : 'Repeticiones'}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {Number(exercise?.descanso_seg) || 45}s
            </div>
            <div className="text-sm text-gray-400">Descanso</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{series}</div>
            <div className="text-sm text-gray-400">Serie Actual</div>
          </div>
        </div>
      </div>

      {/* Controles principales */}
      <div className="flex flex-wrap gap-2 justify-center mb-3">
        {phase === 'ready' && (
          <button
            onClick={start}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded"
          >
            <Play className="w-4 h-4" /> Comenzar
          </button>
        )}

        {phase !== 'ready' && hasTimer && (
          <button
            onClick={toggle}
            className="flex items-center gap-2 bg-gray-200 hover:bg-white text-black font-semibold py-2 px-4 rounded"
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Pausar' : 'Reanudar'}
          </button>
        )}

        {canAdvanceManually && (
          <button
            onClick={manualAdvance}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded"
          >
            <SkipForward className="w-4 h-4" /> Avanzar
          </button>
        )}

        <button
          onClick={reset}
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded"
          title="Reiniciar ejercicio actual"
        >
          <RotateCcw className="w-4 h-4" /> Repetir
        </button>

        <button
          onClick={onSkip}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded"
        >
          <SkipForward className="w-4 h-4" /> Saltar Ejercicio
        </button>

        <button
          onClick={onCancel}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded"
        >
          <Square className="w-4 h-4" /> Cancelar Ejercicio
        </button>
      </div>

      {/* Selector de tiempo por serie */}
      {!isTimeBased && allowManualTimer && (
        <div className="flex items-center gap-2 justify-center text-sm text-gray-400 mb-4">
          <span>Tiempo por serie:</span>
          {timePerSeriesOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimePerSeries(opt.value)}
              className={`px-2 py-1 border rounded ${
                customTimePerSeries === opt.value
                  ? 'border-yellow-400 text-yellow-300'
                  : 'border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Botones de Información y Valorar */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {/* Botón circular de información */}
        <button
          onClick={onShowExerciseInfo}
          className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors shadow-lg"
          title="Ver información detallada del ejercicio"
        >
          <Info className="w-6 h-6" />
        </button>

        {/* Botón de valorar */}
        <button
          onClick={onShowFeedback}
          className={`flex items-center gap-2 border px-4 py-2 rounded-lg transition-colors shadow-md ${
            currentFeedback
              ? 'text-green-300 hover:text-green-200 border-green-400/50 bg-green-900/30'
              : 'text-yellow-300 hover:text-yellow-200 border-yellow-400/50 bg-yellow-900/20'
          }`}
          title={currentFeedback ? 'Editar valoración' : 'Cómo has sentido este ejercicio?'}
        >
          <Star className={`w-5 h-5 ${currentFeedback ? 'fill-current' : ''}`} />
          {currentFeedback ? 'Editado' : 'Valorar'}
        </button>
      </div>

      {/* Notas / Consejos de ejecución */}
      {exercise?.notas && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-start mb-3">
            <Target className="w-4 h-4 text-blue-400 mr-2 mt-1 flex-shrink-0" />
            <h4 className="text-blue-200 font-semibold text-sm">Consejos de Ejecución</h4>
          </div>
          <p className="text-blue-200 text-sm leading-relaxed">{exercise.notas}</p>
        </div>
      )}

      {/* Mostrar comentario del feedback si existe */}
      {currentFeedback?.comment && currentFeedback.comment.trim() && (
        <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-md mb-6">
          <div className="flex items-start gap-2">
            <Star className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5 fill-current" />
            <div>
              <div className="text-yellow-400 font-medium text-sm mb-1">Mi comentario:</div>
              <div className="text-yellow-200 text-sm leading-relaxed">{currentFeedback.comment}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mostrar valoración si existe */}
      {currentFeedback?.sentiment && (
        <div className="p-2 bg-yellow-400/10 border border-yellow-400/20 rounded-md flex items-center gap-2 mb-6">
          <Star className="w-4 h-4 text-yellow-400 fill-current" />
          <span className="text-yellow-400 font-medium text-sm">
            Valoración: {currentFeedback.sentiment === 'like' ? '👍 Me gusta' : currentFeedback.sentiment === 'hard' ? '⚠️ Es difícil' : '👎 No me gusta'}
          </span>
        </div>
      )}

      {/* Demostración del ejercicio - Simplificado */}
      <div className="mb-6">
        {exerciseGif ? (
          <div className="relative inline-block w-full">
            {/* 🎬 Detectar si es video o imagen por extensión */}
            {exerciseGif.match(/\.(mp4|webm|mov|avi)$/i) ? (
              <video
                src={exerciseGif}
                autoPlay
                loop
                muted
                playsInline
                className="mx-auto max-h-64 rounded-md shadow-lg border border-gray-600"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling.style.display = 'block';
                }}
              />
            ) : (
              <img
                src={exerciseGif}
                alt={formatExerciseName(exercise.nombre)}
                className="mx-auto max-h-64 rounded-md shadow-lg border border-gray-600"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling.style.display = 'block';
                }}
              />
            )}
            <div className="hidden text-center py-8">
              <Target className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-400">Demostración no disponible</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="mx-auto mb-2 text-gray-400" size={48} />
            <p className="text-gray-400">Demostración no disponible</p>
          </div>
        )}
      </div>

      {/* 🎯 BOTÓN DE TRACKING RIR - Aparece durante descanso o al completar serie */}
      {onShowSeriesTracking && (phase === 'rest' || (phase === 'exercise' && !isRunning)) && (
        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg border border-yellow-400/30">
          <div className="text-center">
            <p className="text-yellow-300 text-sm mb-2 font-semibold">
              {phase === 'rest' ? '💪 Serie completada - Registra tus datos' : '📊 Registra tu serie'}
            </p>
            <button
              onClick={onShowSeriesTracking}
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all hover:scale-105"
            >
              <TrendingUp className="w-5 h-5" />
              Registrar Serie (RIR)
            </button>
            <p className="text-gray-400 text-xs mt-2">
              Peso, Repeticiones y RIR para tracking de progreso
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseSessionView;
