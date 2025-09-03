import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, SkipForward, X, Clock, Target, RotateCcw, CheckCircle, Star, Info } from 'lucide-react';
import { getExerciseGifUrl } from '../../config/exerciseGifs';
import ExerciseFeedbackModal from './ExerciseFeedbackModal';
// import ExerciseInfoModal from '../routines/ExerciseInfoModal'; // TODO: Restore when routines are rebuilt

const HomeTrainingExerciseModal = ({
  exercise,
  exerciseIndex,
  totalExercises,
  isLastExercise = false,
  onComplete,
  onSkip,
  onCancel,
  onClose,
  onUpdateProgress,
  overrideSeriesTotal,
  sessionId,
  onFeedbackSubmitted
}) => {
  const [currentPhase, setCurrentPhase] = useState('ready'); // ready, exercise, rest, completed
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSeries, setCurrentSeries] = useState(1);
  const [exerciseGif, setExerciseGif] = useState(null);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);
  const [showRepeatConfirm, setShowRepeatConfirm] = useState(false);
  const intervalRef = useRef(null);
  const lastPhaseHandledRef = useRef(''); // evita manejar la misma transición dos veces
  const lastReportedSeriesRef = useRef(''); // evita PUT duplicados para la misma serie

  // Configurar tiempo inicial y GIF basado en el ejercicio
  useEffect(() => {
    setCurrentPhase('ready');
    setCurrentSeries(1);
    setIsRunning(false);
    setTotalTimeSpent(0);
    lastPhaseHandledRef.current = '';
    lastReportedSeriesRef.current = '';
    const durValueInit = Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos);
    if (Number.isFinite(durValueInit) && durValueInit > 0) {
      setTimeLeft(durValueInit);
    } else {
      setTimeLeft(45);
    }
    if (exercise?.gif_url) {
      setExerciseGif(exercise.gif_url);
    } else {
      setExerciseGif(getExerciseGifUrl(exercise?.nombre));
    }
  }, [exercise]);

  // Timer principal con guardas mejoradas para evitar dobles disparos
  useEffect(() => {
    if (isRunning && timeLeft > 0 && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Cerrar intervalo ANTES de completar fase
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            // Usar requestAnimationFrame en lugar de setTimeout para mejor control
            requestAnimationFrame(() => {
              // Double-check que no se haya llamado ya
              const currentSig = `${currentPhase}-${currentSeries}`;
              if (lastPhaseHandledRef.current !== currentSig) {
                handlePhaseComplete();
              }
            });
            return 0;
          }
          return prev - 1;
        });
        if (currentPhase === 'exercise') {
          setTotalTimeSpent(prev => prev + 1);
        }
      }, 1000);
    } else if (!isRunning && intervalRef.current) {
      // Limpiar intervalo cuando se pausa
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timeLeft]); // Removed currentPhase from dependencies to avoid re-creating timer

  const handlePhaseComplete = () => {
    console.log(`🔄 [HomeTraining] Phase complete: ${currentPhase}, Series: ${currentSeries}/${seriesTotal}`);
    
    // Evitar manejar la misma fase más de una vez
    const currentSignature = `${currentPhase}-${currentSeries}`;
    if (lastPhaseHandledRef.current === currentSignature) {
      console.log('🚫 [HomeTraining] Duplicate phase transition blocked:', currentSignature);
      return;
    }
    lastPhaseHandledRef.current = currentSignature;

    // Cortar el intervalo inmediatamente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);

    if (currentPhase === 'exercise') {
      console.log('✅ [HomeTraining] Exercise phase completed');
      const reportSig = `${exerciseIndex}-${currentSeries}`;
      if (lastReportedSeriesRef.current !== reportSig) {
        lastReportedSeriesRef.current = reportSig;
        onUpdateProgress(exerciseIndex, currentSeries, seriesTotal);
      }

      if (currentSeries < seriesTotal) {
        console.log(`🔄 [HomeTraining] Starting rest phase, series ${currentSeries}/${seriesTotal}`);
        
        // Usar setTimeout para hacer las transiciones de estado de forma asíncrona
        setTimeout(() => {
          setCurrentPhase('rest');
          const restTime = Math.min(60, Math.max(45, Number(exercise.descanso_seg) || 60));
          setTimeLeft(restTime);
          
          // Reset signature y auto-start después de un pequeño delay
          setTimeout(() => { 
            lastPhaseHandledRef.current = '';
            setIsRunning(true); 
          }, 200);
        }, 100);
      } else {
        console.log('🎉 [HomeTraining] All series completed, finishing exercise');
        setTimeout(() => {
          setCurrentPhase('completed');
          setTimeout(() => { onComplete(totalTimeSpent); }, 300);
        }, 100);
      }
    } else if (currentPhase === 'rest') {
      console.log('⏰ [HomeTraining] Rest phase completed, moving to next series');
      
      // Usar setTimeout para transiciones asíncronas
      setTimeout(() => {
        const nextSeries = Math.min(currentSeries + 1, seriesTotal);
        setCurrentSeries(nextSeries);
        setCurrentPhase('exercise');
        
        // Configurar tiempo del próximo ejercicio
        const exerciseTime = Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos) || 45;
        setTimeLeft(exerciseTime);
        
        // Reset signature y auto-start
        setTimeout(() => { 
          lastPhaseHandledRef.current = '';
          setIsRunning(true); 
          console.log(`🏃‍♂️ [HomeTraining] Starting series ${nextSeries}/${seriesTotal} automatically`);
        }, 200);
      }, 100);
    }
  };

  const handleStart = () => {
    if (currentPhase === 'ready') {
      setCurrentPhase('exercise');
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const handleForceNext = () => {
    console.log('🔄 [HomeTraining] Force next phase triggered');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    
    if (currentPhase === 'rest') {
      // Forzar avance a siguiente serie
      const nextSeries = Math.min(currentSeries + 1, seriesTotal);
      setCurrentSeries(nextSeries);
      setCurrentPhase('exercise');
      const exerciseTime = Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos) || 45;
      setTimeLeft(exerciseTime);
      lastPhaseHandledRef.current = '';
      console.log(`🏃‍♂️ [HomeTraining] Forced advance to series ${nextSeries}/${seriesTotal}`);
    } else if (currentPhase === 'exercise') {
      // Forzar avance a descanso o completar
      const reportSig = `${exerciseIndex}-${currentSeries}`;
      if (lastReportedSeriesRef.current !== reportSig) {
        lastReportedSeriesRef.current = reportSig;
        onUpdateProgress(exerciseIndex, currentSeries, seriesTotal);
      }

      if (currentSeries < seriesTotal) {
        setCurrentPhase('rest');
        const restTime = Math.min(60, Math.max(45, Number(exercise.descanso_seg) || 60));
        setTimeLeft(restTime);
        lastPhaseHandledRef.current = '';
        console.log(`⏰ [HomeTraining] Forced advance to rest, series ${currentSeries}/${seriesTotal}`);
      } else {
        setCurrentPhase('completed');
        setTimeout(() => { onComplete(totalTimeSpent); }, 500);
      }
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentPhase('ready');
    setCurrentSeries(1);
    setTotalTimeSpent(0);
    setTimeLeft((Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos) || 45));
  };

  const handleCancelExercise = () => {
    // Marca el ejercicio como cancelado desde el modal
    if (typeof onCancel === 'function') onCancel();
    setIsRunning(false);
    setCurrentPhase('completed'); // cerramos el flujo localmente
  };

  const handleRepeatTraining = () => {
    setShowRepeatConfirm(true);
  };

  const confirmRepeatTraining = () => {
    console.log('🔄 [HomeTraining] Reiniciando entrenamiento completo');
    // Reiniciar completamente el ejercicio
    setCurrentPhase('ready');
    setCurrentSeries(1);
    setIsRunning(false);
    setTotalTimeSpent(0);
    setTimeLeft((Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos) || 45));
    lastPhaseHandledRef.current = '';
    lastReportedSeriesRef.current = '';
    
    // Limpiar el intervalo si existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setShowRepeatConfirm(false);
  };

  // Reservado para futura UI de saltar solo una serie
  // const handleSkipSeries = () => {
  //   if (currentSeries < seriesTotal) {
  //     setCurrentSeries(prev => prev + 1);
  //     setCurrentPhase('exercise');
  //     setTimeLeft((Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos) || 45));
  //     setIsRunning(false);
  //   } else {
  //     onSkip();
  //   }
  // };


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseTitle = () => {
    switch (currentPhase) {
      case 'ready':
        return 'Preparado para comenzar';
      case 'exercise':
        return `Serie ${Math.min(currentSeries, seriesTotal || currentSeries)} de ${seriesTotal}`;
      case 'rest':
        return 'Tiempo de descanso';
      case 'completed':
        return '¡Ejercicio completado!';
      default:
        return '';
    }
  };

  // helpers para pintar métricas
  const repsValue = Number(exercise?.repeticiones ?? exercise?.reps ?? exercise?.repeticiones_por_serie);
  const durValue  = Number(exercise?.duracion_seg ?? exercise?.duracion ?? exercise?.tiempo_segundos);
  const baseDuration = Math.max(1, (durValue || 45));
  const rawSeries = Number(exercise?.series ?? exercise?.total_series ?? exercise?.totalSeries ?? exercise?.series_totales);
  const seriesTotal = Number.isFinite(Number(overrideSeriesTotal)) && Number(overrideSeriesTotal) > 0
    ? Number(overrideSeriesTotal)
    : ((Number.isFinite(rawSeries) && rawSeries > 0) ? rawSeries : 4);

  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'ready':
        return 'text-blue-400';
      case 'exercise':
        return 'text-green-400';
      case 'rest':
        return 'text-yellow-400';
      case 'completed':
        return 'text-purple-400';
      default:
        return 'text-white';
    }
  };

  // Safety check: if exercise is undefined, don't render the modal
  if (!exercise || !exercise.nombre) {
    console.error('HomeTrainingExerciseModal: ejercicio no válido:', exercise);
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">{exercise.nombre}</h2>
            <p className="text-sm text-gray-400">
              Ejercicio {exerciseIndex + 1} de {totalExercises}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Contenido principal */}
        <div className="p-6">
          {/* Estado actual */}
          <div className="text-center mb-6">
            <h3 className={`text-lg font-semibold mb-2 ${getPhaseColor()}`}>
              {getPhaseTitle()}
            </h3>

            {/* Timer circular */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
              <div
                className={`absolute inset-0 rounded-full border-4 border-t-transparent transition-all duration-1000 ${
                  currentPhase === 'exercise' ? 'border-green-400' :
                  currentPhase === 'rest' ? 'border-yellow-400' : 'border-blue-400'
                }`}
                style={{
                  transform: `rotate(${(((baseDuration) - timeLeft) / (baseDuration)) * 360}deg)`
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className={`text-3xl font-bold ${timeLeft === 0 ? 'text-green-400 animate-pulse' : 'text-white'}`}>
                  {timeLeft === 0 ? '¡Listo!' : formatTime(timeLeft)}
                </span>
                {!isRunning && (currentPhase === 'exercise' || currentPhase === 'rest') && timeLeft > 0 && (
                  <div className="text-xs text-gray-400 mt-1">Pausado</div>
                )}
                {timeLeft === 0 && currentPhase === 'rest' && (
                  <div className="text-xs text-green-400 mt-1 animate-pulse">Descanso terminado</div>
                )}
                {timeLeft === 0 && currentPhase === 'exercise' && (
                  <div className="text-xs text-green-400 mt-1 animate-pulse">Serie completada</div>
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
                  {Number.isFinite(repsValue) && repsValue > 0
                    ? repsValue
                    : Number.isFinite(durValue) && durValue > 0
                      ? `${durValue}s`
                      : '—'}
                </div>
                <div className="text-sm text-gray-400">
                  {Number.isFinite(repsValue) && repsValue > 0
                    ? 'Repeticiones'
                    : Number.isFinite(durValue) && durValue > 0
                      ? 'Duración'
                      : 'Repeticiones'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{(Number(exercise?.descanso_seg) || 45)}s</div>
                <div className="text-sm text-gray-400">Descanso</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{currentSeries}</div>
                <div className="text-sm text-gray-400">Serie Actual</div>
              </div>
            </div>
          </div>

          {/* Botón de información del ejercicio */}
          <div className="text-center mb-6">
            <button
              onClick={() => setShowExerciseInfo(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              title="Ver información detallada del ejercicio"
            >
              <Info size={20} />
              Información del Ejercicio
            </button>
          </div>

          {/* Notas del ejercicio y consejos de ejecución */}
          {exercise.notas && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-start mb-3">
                <Target size={16} className="text-blue-400 mr-2 mt-1 flex-shrink-0" />
                <h4 className="text-blue-200 font-semibold text-sm">Consejos de Ejecución</h4>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">{exercise.notas}</p>
            </div>
          )}

          {/* Información adicional */}
          {(exercise.patron || exercise.implemento) && (
            <div className="bg-gray-700/30 rounded-lg p-3 mb-6">
              <div className="flex flex-wrap gap-4 text-sm">
                {exercise.patron && (
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    <span className="text-gray-300">Patrón:</span>
                    <span className="text-white font-medium ml-1 capitalize">{String(exercise.patron).replaceAll('_',' ')}</span>
                  </div>
                )}
                {exercise.implemento && (
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    <span className="text-gray-300">Implemento:</span>
                    <span className="text-white font-medium ml-1 capitalize">{String(exercise.implemento).replaceAll('_',' ')}</span>
                  </div>
                )}
                {/* Botón de feedback */}
                <button
                  onClick={() => setShowFeedback(true)}
                  className="ml-auto flex items-center gap-2 text-yellow-300 hover:text-yellow-200 border border-yellow-400/30 px-3 py-1 rounded-md"
                  title="Cómo has sentido este ejercicio?"
                >
                  <Star size={16} />
                  Valorar
                </button>
              </div>
            </div>
          )}

          {/* Área de media del ejercicio mejorada */}
          <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
            <div className="text-center mb-4">
              <h4 className="text-white font-semibold mb-2">Demostración del Ejercicio</h4>
              {exerciseGif ? (
                <div className="relative inline-block">
                  <img
                    src={exerciseGif}
                    alt={exercise.nombre}
                    className="mx-auto max-h-64 rounded-md shadow-lg border border-gray-600"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextSibling.style.display = 'block';
                    }}
                  />
                  <div className="hidden text-center py-8">
                    <Target size={48} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-400">GIF no disponible</p>
                    <p className="text-sm text-gray-500">({exercise.nombre})</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target size={48} className="mx-auto mb-2 text-gray-400" />
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

          {/* Controles mejorados */}
          <div className="flex flex-wrap gap-3 justify-center">
            {currentPhase === 'ready' && (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <Play size={20} />
                Comenzar
              </button>
            )}

            {(currentPhase === 'exercise' || currentPhase === 'rest') && (
              <>
                {isRunning ? (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    <Pause size={20} />
                    Pausar
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    <Play size={20} />
                    Reanudar
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  title="Reiniciar ejercicio actual"
                >
                  <RotateCcw size={20} />
                </button>

                {/* Botón para forzar avance solo cuando hay problemas */}
                {(timeLeft === 0 && !isRunning) && (
                  <button
                    onClick={handleForceNext}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors animate-pulse"
                    title={currentPhase === 'rest' ? 'Continuar (si no avanza automáticamente)' : 'Continuar ejercicio'}
                  >
                    <CheckCircle size={20} />
                    Continuar
                  </button>
                )}
              </>
            )}

            {currentPhase !== 'completed' && (
              <>
                <button
                  onClick={() => onSkip()}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <SkipForward size={20} />
                  Saltar Ejercicio
                </button>
                <button
                  onClick={handleCancelExercise}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Square size={20} />
                  Cancelar Ejercicio
                </button>
              </>
            )}
          </div>

          {/* Botón para repetir entrenamiento - solo visible al completar el ÚLTIMO ejercicio */}
          {currentPhase === 'completed' && isLastExercise && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="text-center">
                <button
                  onClick={handleRepeatTraining}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl mx-auto"
                >
                  <RotateCcw size={20} />
                  ¿Quieres repetir el entrenamiento del día?
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Reiniciará el ejercicio completo desde cero
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Modal de feedback */}
        {showFeedback && (
          <ExerciseFeedbackModal
            show={showFeedback}
            exerciseName={exercise?.nombre}
            onClose={() => setShowFeedback(false)}
            onSubmit={async (payload) => {
              try {
                console.log('Enviando feedback ejercicio:', payload);
                if (sessionId != null) {
                  const token = localStorage.getItem('token');
                  await fetch(`/api/home-training/sessions/${sessionId}/exercise/${exerciseIndex}/feedback`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                      sentiment: payload.sentiment, 
                      comment: payload.comment, 
                      exercise_name: exercise?.nombre 
                    })
                  });
                  onFeedbackSubmitted?.();
                }
              } catch (error) {
                console.error('Error enviando feedback:', error);
              } finally {
                setShowFeedback(false);
              }
            }}
          />
        )}

        {/* Modal de información del ejercicio */}
        {showExerciseInfo && (
          <ExerciseInfoModal
            show={showExerciseInfo}
            exercise={exercise}
            onClose={() => setShowExerciseInfo(false)}
          />
        )}

        {/* Modal de confirmación para repetir entrenamiento */}
        {showRepeatConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-md">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RotateCcw size={24} className="text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">¿Estás seguro?</h3>
                <p className="text-gray-300 text-sm">
                  Esto reiniciará completamente el ejercicio actual desde el principio.
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Perderás todo el progreso de las series completadas.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRepeatConfirm(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRepeatTraining}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Sí, repetir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HomeTrainingExerciseModal;
