import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, SkipForward, X, Clock, Target, RotateCcw } from 'lucide-react';
import { getExerciseGifUrl } from '../../config/exerciseGifs';

const HomeTrainingExerciseModal = ({ 
  exercise, 
  exerciseIndex, 
  totalExercises, 
  onComplete, 
  onSkip, 
  onClose,
  onUpdateProgress 
}) => {
  const [currentPhase, setCurrentPhase] = useState('ready'); // ready, exercise, rest, completed
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSeries, setCurrentSeries] = useState(1);
  const [exerciseGif, setExerciseGif] = useState(null);

  // Configurar tiempo inicial y GIF basado en el ejercicio
  useEffect(() => {
    // tiempo inicial
    if (exercise.duracion_seg) {
      setTimeLeft(exercise.duracion_seg);
    } else {
      setTimeLeft(45); // reps: usar 45s por defecto
    }
    // gif
    if (exercise?.gif_url) {
      setExerciseGif(exercise.gif_url);
    } else {
      setExerciseGif(getExerciseGifUrl(exercise?.nombre));
    }
  }, [exercise]);

  // Timer principal
  useEffect(() => {
    let interval = null;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            handlePhaseComplete();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const handlePhaseComplete = () => {
    if (currentPhase === 'exercise') {
      if (currentSeries < exercise.series) {
        // Pasar a descanso y arrancar automáticamente
        setCurrentPhase('rest');
        setTimeLeft(exercise.descanso_seg || 60);
        setIsRunning(true);
        onUpdateProgress(exerciseIndex, currentSeries, exercise.series);
      } else {
        // Ejercicio completado
        setIsRunning(false);
        setCurrentPhase('completed');
        onUpdateProgress(exerciseIndex, exercise.series, exercise.series);
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    } else if (currentPhase === 'rest') {
      // Pasar a la siguiente serie y arrancar
      setCurrentSeries(prev => prev + 1);
      setCurrentPhase('exercise');
      if (exercise.duracion_seg) {
        setTimeLeft(exercise.duracion_seg);
      } else {
        setTimeLeft(45);
      }
      setIsRunning(true);
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

  const handleStop = () => {
    setIsRunning(false);
    setCurrentPhase('ready');
    setCurrentSeries(1);
    if (exercise.duracion_seg) {
      setTimeLeft(exercise.duracion_seg);
    } else {
      setTimeLeft(45);
    }
  };

  const handleSkipExercise = () => {
    onSkip();
  };

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
        return `Serie ${currentSeries} de ${exercise.series}`;
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
                  transform: `rotate(${((exercise.duracion_seg || 45) - timeLeft) / (exercise.duracion_seg || 45) * 360}deg)`
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
          <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{exercise.series}</div>
                <div className="text-sm text-gray-400">Series</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {exercise.repeticiones || `${exercise.duracion_seg}s`}
                </div>
                <div className="text-sm text-gray-400">
                  {exercise.repeticiones ? 'Repeticiones' : 'Duración'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{exercise.descanso_seg}s</div>
                <div className="text-sm text-gray-400">Descanso</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{currentSeries}</div>
                <div className="text-sm text-gray-400">Serie Actual</div>
              </div>
            </div>
          </div>

          {/* Notas del ejercicio */}
          {exercise.notas && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
              <p className="text-blue-200 text-sm">{exercise.notas}</p>
            </div>
          )}

          {/* Área de media del ejercicio */}
          <div className="bg-gray-700/30 rounded-lg p-4 mb-6 text-center">
            {exerciseGif ? (
              <img
                src={exerciseGif}
                alt={exercise.nombre}
                className="mx-auto max-h-64 rounded-md shadow-md"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="text-gray-400 py-6">
                <Target size={48} className="mx-auto mb-2" />
                <p>GIF no disponible</p>
                <p className="text-sm">({exercise.nombre})</p>
              </div>
            )}

            {/* Input rápido para probar URL de GIF */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="url"
                placeholder="Pega una URL de GIF y pulsa Aplicar"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = e.currentTarget.value.trim();
                    if (v) setExerciseGif(v);
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.previousSibling;
                  if (input && input.value) setExerciseGif(input.value.trim());
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-md"
              >
                Aplicar
              </button>
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
                  onClick={handleStop}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Square size={20} />
                  Parar
                </button>
              </>
            )}

            <button
              onClick={handleSkipExercise}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <SkipForward size={20} />
              Saltar Ejercicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeTrainingExerciseModal;
