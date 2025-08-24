import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, SkipForward, X, Clock, Target, RotateCcw, CheckCircle, Star } from 'lucide-react';
import { getExerciseGifUrl } from '../../config/exerciseGifs';
import ExerciseFeedbackModal from './ExerciseFeedbackModal.jsx';

const RoutineExerciseModal = ({
  exercise,
  exerciseIndex,
  totalExercises,
  onComplete,
  onSkip,
  onCancel,
  onClose,
  sessionData
}) => {
  const [currentPhase, setCurrentPhase] = useState('ready'); // ready, exercise, rest, completed
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSeries, setCurrentSeries] = useState(1);
  const [exerciseGif, setExerciseGif] = useState(null);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const intervalRef = useRef(null);
  const lastPhaseHandledRef = useRef('');

  // Configurar tiempo inicial y GIF basado en el ejercicio
  useEffect(() => {
    setCurrentPhase('ready');
    setCurrentSeries(1);
    setIsRunning(false);
    setTotalTimeSpent(0);
    lastPhaseHandledRef.current = '';
    
    // Obtener duración del ejercicio (puede venir como repeticiones o tiempo)
    let duration = 45; // valor por defecto
    if (exercise?.repeticiones && typeof exercise.repeticiones === 'string') {
      // Si son repeticiones como "8-10" o "12", usar tiempo estimado
      const repsMatch = exercise.repeticiones.match(/(\d+)/);
      if (repsMatch) {
        const reps = parseInt(repsMatch[1]);
        duration = Math.max(30, reps * 3); // 3 segundos por repetición
      }
    }
    
    setTimeLeft(duration);
    
    // Configurar GIF del ejercicio
    setExerciseGif(getExerciseGifUrl(exercise?.nombre));
  }, [exercise]);

  // Timer principal
  useEffect(() => {
    if (isRunning && timeLeft > 0 && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
        if (currentPhase === 'exercise') {
          setTotalTimeSpent(prev => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timeLeft, currentPhase]);

  const handlePhaseComplete = () => {
    const signature = `${currentPhase}-${currentSeries}`;
    if (lastPhaseHandledRef.current === signature) return;
    lastPhaseHandledRef.current = signature;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);

    const seriesTotal = exercise?.series || 3;

    if (currentPhase === 'exercise') {
      if (currentSeries < seriesTotal) {
        setCurrentPhase('rest');
        setTimeLeft(Math.min(70, Math.max(30, Number(exercise.descanso_seg) || 60)));
        setTimeout(() => { lastPhaseHandledRef.current = ''; setIsRunning(true); }, 200);
      } else {
        setCurrentPhase('completed');
        setTimeout(() => { onComplete(totalTimeSpent); }, 500);
      }
    } else if (currentPhase === 'rest') {
      setCurrentSeries(prev => Math.min(prev + 1, seriesTotal));
      setCurrentPhase('exercise');
      
      // Calcular duración para la siguiente serie
      let duration = 45;
      if (exercise?.repeticiones && typeof exercise.repeticiones === 'string') {
        const repsMatch = exercise.repeticiones.match(/(\d+)/);
        if (repsMatch) {
          const reps = parseInt(repsMatch[1]);
          duration = Math.max(30, reps * 3);
        }
      }
      setTimeLeft(duration);
      setTimeout(() => { lastPhaseHandledRef.current = ''; setIsRunning(true); }, 200);
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

  const handleReset = () => {
    setIsRunning(false);
    setCurrentPhase('ready');
    setCurrentSeries(1);
    setTotalTimeSpent(0);
    
    let duration = 45;
    if (exercise?.repeticiones && typeof exercise.repeticiones === 'string') {
      const repsMatch = exercise.repeticiones.match(/(\d+)/);
      if (repsMatch) {
        const reps = parseInt(repsMatch[1]);
        duration = Math.max(30, reps * 3);
      }
    }
    setTimeLeft(duration);
  };

  const handleCancelExercise = () => {
    if (typeof onCancel === 'function') onCancel();
    setIsRunning(false);
    setCurrentPhase('completed');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseTitle = () => {
    const seriesTotal = exercise?.series || 3;
    switch (currentPhase) {
      case 'ready':
        return 'Preparado para comenzar';
      case 'exercise':
        return `Serie ${Math.min(currentSeries, seriesTotal)} de ${seriesTotal}`;
      case 'rest':
        return 'Tiempo de descanso';
      case 'completed':
        return '¡Ejercicio completado!';
      default:
        return '';
    }
  };

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

  const seriesTotal = exercise?.series || 3;
  const baseDuration = timeLeft + totalTimeSpent;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-yellow-400/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-yellow-400/30">
          <div>
            <h2 className="text-xl font-bold text-white">{exercise.nombre}</h2>
            <p className="text-sm text-gray-400">
              Ejercicio {exerciseIndex + 1} de {totalExercises}
            </p>
            <p className="text-sm text-yellow-400 mt-1">
              {sessionData?.dayName} - Semana {sessionData?.weekNumber}
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
                  transform: `rotate(${((baseDuration - timeLeft) / baseDuration) * 360}deg)`
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {formatTime(timeLeft)}
                </span>
                {!isRunning && (currentPhase === 'exercise' || currentPhase === 'rest') && (
                  <div className="text-xs text-gray-400 mt-1">Pausado</div>
                )}
              </div>
            </div>
          </div>

          {/* Información del ejercicio */}
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{seriesTotal}</div>
                <div className="text-sm text-gray-400">Series</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{exercise?.repeticiones || '8-10'}</div>
                <div className="text-sm text-gray-400">Repeticiones</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{exercise?.descanso_seg || 60}s</div>
                <div className="text-sm text-gray-400">Descanso</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{currentSeries}</div>
                <div className="text-sm text-gray-400">Serie Actual</div>
              </div>
            </div>
            {/* Línea patrón/implemento + botón Valorar */}
            <div className="mt-4 flex items-center gap-4">
              {exercise?.patron && (
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  <span className="text-gray-300">Patrón:</span>
                  <span className="text-white font-medium ml-1 capitalize">{String(exercise.patron).replaceAll('_',' ')}</span>
                </div>
              )}
              {exercise?.implemento && (
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  <span className="text-gray-300">Implemento:</span>
                  <span className="text-white font-medium ml-1 capitalize">{String(exercise.implemento).replaceAll('_',' ')}</span>
                </div>
              )}
              <button
                onClick={() => setShowFeedback(true)}
                className="ml-auto flex items-center gap-2 text-yellow-300 hover:text-yellow-200 border border-yellow-400/30 px-3 py-1 rounded-md"
                title="¿Cómo has sentido este ejercicio?"
              >
                <Star size={16} />
                Valorar
              </button>
            </div>
          </div>

          {/* Notas del ejercicio */}
          {exercise.notas && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-start mb-3">
                <Target size={16} className="text-blue-400 mr-2 mt-1 flex-shrink-0" />
                <h4 className="text-blue-200 font-semibold text-sm">Consejos de Ejecución</h4>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">{exercise.notas}</p>
            </div>
          )}

          {/* Intensidad */}
          {exercise.intensidad && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <Target size={16} className="text-red-400 mr-2" />
                <h4 className="text-red-200 font-semibold text-sm">Intensidad</h4>
              </div>
              <p className="text-red-200 text-sm">{exercise.intensidad}</p>
            </div>
          )}

          {/* Área del GIF */}
          <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
            <div className="text-center mb-4">
              <h4 className="text-white font-semibold mb-2">Demostración del Ejercicio</h4>
              {exerciseGif ? (
                <div className="relative inline-block">
                  <img
                    src={exerciseGif}
                    alt={exercise.nombre}
                    className="mx-auto max-h-64 rounded-md shadow-lg border border-yellow-400/30"
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
          </div>

          {/* Controles */}
          <div className="flex gap-3 justify-center">
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
                >
                  <RotateCcw size={20} />
                </button>
              </>
            )}

            {currentPhase !== 'completed' && (
              <>
                <button
                  onClick={() => onSkip()}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <SkipForward size={20} />
                  Saltar
                </button>
                <button
                  onClick={handleCancelExercise}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Square size={20} />
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Modal de feedback */}
        {showFeedback && (
          <ExerciseFeedbackModal
            show={showFeedback}
            exerciseName={exercise?.nombre}
            onClose={() => setShowFeedback(false)}
            onSubmit={() => setShowFeedback(false)}
          />
        )}
      </div>
    </div>
  );
};

export default RoutineExerciseModal;

