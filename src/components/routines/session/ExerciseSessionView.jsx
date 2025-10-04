import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Info, SkipForward, Star, Target, Square } from 'lucide-react';
import { getExerciseGifUrl } from '@/config/exerciseGifs.js';
import { formatExerciseName } from '../../../utils/exerciseUtils';

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

  // Actualizar GIF cuando cambia ejercicio
  useEffect(() => {
    if (!exercise) return;
    if (exercise.gif_url) {
      setExerciseGif(exercise.gif_url);
    } else {
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

  const repsText = exercise?.repeticiones ?? '';
  // 🔥 CORRECCIÓN: Usar originalIndex para buscar feedback en BD
  const currentFeedback = exerciseFeedback?.[exercise?.originalIndex ?? exerciseIndex];

  return (
    <div className="bg-black/40 p-4 rounded-lg border border-gray-700">
      {/* Header del ejercicio */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-white font-semibold">{formatExerciseName(exercise.nombre)}</h4>
        <div className="text-gray-400 text-sm">{seriesText}</div>
      </div>

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
      <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
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

      {/* Botón de información del ejercicio */}
      <div className="text-center mb-6">
        <button
          onClick={onShowExerciseInfo}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          title="Ver información detallada del ejercicio"
        >
          <Info className="w-5 h-5" />
          Información del Ejercicio
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

      {/* Sección de valoración y feedback - Siempre visible */}
      <div className="bg-gray-700/30 rounded-lg p-3 mb-6">
        {/* Botón para valorar */}
        <div className="flex justify-end mb-3">
          <button
            onClick={onShowFeedback}
            className={`flex items-center gap-2 border px-3 py-1.5 rounded-md transition-colors ${
              currentFeedback
                ? 'text-green-300 hover:text-green-200 border-green-400/30 bg-green-900/20'
                : 'text-yellow-300 hover:text-yellow-200 border-yellow-400/30'
            }`}
            title={currentFeedback ? 'Editar valoración' : 'Cómo has sentido este ejercicio?'}
          >
            <Star className={`w-4 h-4 ${currentFeedback ? 'fill-current' : ''}`} />
            {currentFeedback ? 'Editado' : 'Valorar'}
          </button>
        </div>

        {/* Mostrar comentario del usuario si existe */}
        {currentFeedback?.comment && currentFeedback.comment.trim() && (
          <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-md mb-3">
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
          <div className="p-2 bg-yellow-400/10 border border-yellow-400/20 rounded-md flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-yellow-400 font-medium text-sm">
              Valoración: {currentFeedback.sentiment === 'like' ? '👍 Me gusta' : currentFeedback.sentiment === 'hard' ? '⚠️ Es difícil' : '👎 No me gusta'}
            </span>
          </div>
        )}
      </div>

      {/* Información adicional */}
      {(exercise?.patron || exercise?.implemento) && (
        <div className="bg-gray-700/30 rounded-lg p-3 mb-6">
          <div className="flex flex-wrap gap-4 text-sm">
            {exercise?.patron && (
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                <span className="text-gray-300">Patrón:</span>
                <span className="text-white font-medium ml-1 capitalize">
                  {String(exercise.patron).replaceAll('_', ' ')}
                </span>
              </div>
            )}
            {exercise?.implemento && (
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                <span className="text-gray-300">Implemento:</span>
                <span className="text-white font-medium ml-1 capitalize">
                  {String(exercise.implemento).replaceAll('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demostración del ejercicio */}
      <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
        <div className="text-center mb-4">
          <h4 className="text-white font-semibold mb-2">Demostración del Ejercicio</h4>
          {exerciseGif ? (
            <div className="relative inline-block">
              <img
                src={exerciseGif}
                alt={formatExerciseName(exercise.nombre)}
                className="mx-auto max-h-64 rounded-md shadow-lg border border-gray-600"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextSibling.style.display = 'block';
                }}
              />
              <div className="hidden text-center py-8">
                <Target className="mx-auto mb-2 text-gray-400" size={48} />
                <p className="text-gray-400">GIF no disponible</p>
                <p className="text-sm text-gray-500">({formatExerciseName(exercise.nombre)})</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-400">GIF no disponible</p>
              <p className="text-sm text-gray-500">({exercise.nombre})</p>
            </div>
          )}
        </div>

        {/* Input para URL de GIF personalizada */}
        <div className="bg-gray-800/50 rounded-md p-3">
          <div className="text-xs text-gray-400 mb-2">¿Tienes un GIF mejor? Pégalo aquí:</div>
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://ejemplo.com/ejercicio.gif"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = e.currentTarget.value.trim();
                  if (v) {
                    setExerciseGif(v);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousSibling;
                if (input && input.value.trim()) {
                  setExerciseGif(input.value.trim());
                  input.value = '';
                }
              }}
              className="bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold px-3 py-2 rounded-md transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Controles principales */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
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
        <div className="flex items-center gap-2 justify-center text-sm text-gray-400">
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
    </div>
  );
};

export default ExerciseSessionView;