import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Info, SkipForward, Star, Target, Square, TrendingUp, Settings } from 'lucide-react';
import { getExerciseGifUrl } from '@/config/exerciseGifs.js';
import { getExerciseVideoUrl } from '@/config/exerciseVideos.js';
import { formatExerciseName } from '../../../utils/exerciseUtils';
import { DraggableWrapper, CustomizableContainer, useCustomLayout, useEditMode } from '../../customization';

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

  // 🎯 SISTEMA DE PERSONALIZACIÓN - Drag & Drop de botones
  const [editMode, toggleEditMode, saveAndExit] = useEditMode(false);

  // Layout por defecto de botones (orden inicial)
  const defaultButtonLayout = [
    'btn-play-pause',
    'btn-advance',
    'btn-reset',
    'btn-skip',
    'btn-cancel'
  ];

  const [buttonLayout, saveButtonLayout] = useCustomLayout(
    'exercise-control-buttons',
    defaultButtonLayout
  );

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

          {/* Equipamiento necesario */}
          {exercise?.equipamiento && (
            <div className="mt-4 pt-4 border-t border-blue-700/30">
              <div className="flex items-start mb-2">
                <Square className="w-4 h-4 text-blue-400 mr-2 mt-1 flex-shrink-0" />
                <h4 className="text-blue-200 font-semibold text-sm">Equipamiento</h4>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed capitalize">
                {String(exercise.equipamiento).replaceAll('_', ' ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Solo equipamiento si no hay notas */}
      {!exercise?.notas && exercise?.equipamiento && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-start mb-3">
            <Square className="w-4 h-4 text-blue-400 mr-2 mt-1 flex-shrink-0" />
            <h4 className="text-blue-200 font-semibold text-sm">Equipamiento</h4>
          </div>
          <p className="text-blue-200 text-sm leading-relaxed capitalize">
            {String(exercise.equipamiento).replaceAll('_', ' ')}
          </p>
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
                <p className="text-sm text-gray-500">({formatExerciseName(exercise.nombre)})</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-400">Demostración no disponible</p>
              <p className="text-sm text-gray-500">({exercise.nombre})</p>
            </div>
          )}
        </div>

        {/* Input para URL de GIF/Video personalizada */}
        <div className="bg-gray-800/50 rounded-md p-3">
          <div className="text-xs text-gray-400 mb-2">¿Tienes un GIF o vídeo mejor? Pégalo aquí:</div>
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://ejemplo.com/ejercicio.mp4 o .gif"
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
          <div className="text-xs text-gray-500 mt-2">
            🎬 Soporta: MP4, WebM, GIF, MOV
          </div>
        </div>
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

      {/* 🎯 TOGGLE MODO EDICIÓN */}
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleEditMode}
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md transition-all ${
            editMode
              ? 'bg-yellow-400 text-gray-900 font-semibold'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title="Personalizar orden de botones"
        >
          <Settings className="w-3 h-3" />
          {editMode ? 'Guardar Orden' : 'Personalizar'}
        </button>
      </div>

      {/* Banner de modo edición */}
      {editMode && (
        <div className="mb-3 p-3 bg-yellow-400/20 border border-yellow-400/40 rounded-lg">
          <p className="text-yellow-300 text-sm font-semibold mb-1">
            🎯 Modo Personalización Activo
          </p>
          <p className="text-yellow-200/80 text-xs">
            Arrastra los botones para cambiar su orden. Los cambios se guardarán automáticamente.
          </p>
        </div>
      )}

      {/* Controles principales - CON DRAG & DROP */}
      <CustomizableContainer
        items={buttonLayout}
        onReorder={saveButtonLayout}
        editMode={editMode}
        strategy="horizontal"
        className="flex flex-wrap gap-2 justify-center mb-4"
      >
        {buttonLayout.map((buttonId) => {
          // Definir cada botón según su ID
          let button = null;

          if (buttonId === 'btn-play-pause') {
            if (phase === 'ready') {
              button = (
                <button
                  onClick={start}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  <Play className="w-4 h-4" /> Comenzar
                </button>
              );
            } else if (phase !== 'ready' && hasTimer) {
              button = (
                <button
                  onClick={toggle}
                  className="flex items-center gap-2 bg-gray-200 hover:bg-white text-black font-semibold py-2 px-4 rounded transition-colors"
                >
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isRunning ? 'Pausar' : 'Reanudar'}
                </button>
              );
            }
          }

          if (buttonId === 'btn-advance' && canAdvanceManually) {
            button = (
              <button
                onClick={manualAdvance}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                <SkipForward className="w-4 h-4" /> Avanzar
              </button>
            );
          }

          if (buttonId === 'btn-reset') {
            button = (
              <button
                onClick={reset}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded transition-colors"
                title="Reiniciar ejercicio actual"
              >
                <RotateCcw className="w-4 h-4" /> Repetir
              </button>
            );
          }

          if (buttonId === 'btn-skip') {
            button = (
              <button
                onClick={onSkip}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                <SkipForward className="w-4 h-4" /> Saltar Ejercicio
              </button>
            );
          }

          if (buttonId === 'btn-cancel') {
            button = (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                <Square className="w-4 h-4" /> Cancelar Ejercicio
              </button>
            );
          }

          // Si el botón no debe renderizarse (ej: play-pause cuando no aplica), skip
          if (!button) return null;

          // Envolver en DraggableWrapper
          return (
            <DraggableWrapper key={buttonId} id={buttonId} editMode={editMode}>
              {button}
            </DraggableWrapper>
          );
        })}
      </CustomizableContainer>

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