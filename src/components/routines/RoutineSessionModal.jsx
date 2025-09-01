import { useEffect, useState, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Info, X as IconX, Square, SkipForward, Star, Target } from 'lucide-react';
import { getExerciseGifUrl } from '@/config/exerciseGifs.js';
import ExerciseFeedbackModal from '../HomeTraining/ExerciseFeedbackModal';
import ExerciseInfoModal from './ExerciseInfoModal';
import { saveExerciseFeedback, getSessionFeedback } from './api';

// Modal de sesión: lista de ejercicios, sets/reps, descanso con cuenta atrás
export default function RoutineSessionModal({
  session,
  onClose,
  onFinishExercise, // (exerciseIndex, seriesCompleted, timeSpent)
  onSkipExercise, // (exerciseIndex)
  onEndSession,
  sessionId, // Necesario para guardar feedback
  allowManualTimer = true,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('ready'); // ready | exercise | rest | done
  const [series, setSeries] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [spent, setSpent] = useState(0);
  const [exerciseGif, setExerciseGif] = useState(null);
  const [timePerSeries, setTimePerSeries] = useState(45);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);
  const [anySkipped, setAnySkipped] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [endMessage, setEndMessage] = useState('');
  const [showExerciseToast, setShowExerciseToast] = useState(false);
  const [exerciseFeedback, setExerciseFeedback] = useState({}); // { exerciseIndex: { sentiment, comment } }
  const intervalRef = useRef(null);

  const exercises = useMemo(() => Array.isArray(session?.ejercicios) ? session.ejercicios : [], [session?.ejercicios]);
  const total = exercises.length;

  const ex = exercises[currentIndex] || null;
  const seriesTotal = Number(ex?.series) || 3;
  const repsText = ex?.repeticiones ?? '';
  const durValue = Number(ex?.duracion_seg ?? ex?.duracion ?? ex?.tiempo_segundos);
  const isTimeBased = Number.isFinite(durValue) && durValue > 0;
  const baseDuration = isTimeBased ? durValue : timePerSeries;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'ready':
        return 'text-blue-400';
      case 'exercise':
        return 'text-green-400';
      case 'rest':
        return 'text-yellow-400';
      case 'done':
        return 'text-purple-400';
      default:
        return 'text-white';
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      setSpent((s) => s + 1);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // Actualizar GIF cuando cambia ejercicio
  useEffect(() => {
    if (!ex) return;
    if (ex.gif_url) setExerciseGif(ex.gif_url);
    else setExerciseGif(getExerciseGifUrl(ex.nombre));
  }, [ex]);

  // Cargar feedback existente cuando se abre el modal
  useEffect(() => {
    const loadExistingFeedback = async () => {
      if (!sessionId) return;
      
      try {
        const feedbackData = await getSessionFeedback({ sessionId });
        const feedbackMap = {};
        
        feedbackData.forEach(fb => {
          feedbackMap[fb.exercise_order] = {
            sentiment: fb.sentiment,
            comment: fb.comment
          };
        });
        
        setExerciseFeedback(feedbackMap);
        console.log('📝 Feedback cargado:', feedbackMap);
      } catch (error) {
        console.error('Error cargando feedback existente:', error);
      }
    };

    loadExistingFeedback();
  }, [sessionId]);

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      // fin de fase
      if (phase === 'exercise') {
        setPhase('rest');
        const rest = Math.min(120, Math.max(30, Number(exercises[currentIndex]?.descanso_seg) || 60));
        setTimeLeft(rest);
        setIsRunning(true);
      } else if (phase === 'rest') {
        if (series < seriesTotal) {
          setSeries((s) => s + 1);
          setPhase('exercise');
          setTimeLeft(baseDuration);
          setIsRunning(true);
        } else {
          // ejercicio completado
          onFinishExercise?.(currentIndex, seriesTotal, spent);
          if (currentIndex < total - 1) {
            setCurrentIndex((i) => i + 1);
            setSeries(1);
            setPhase('ready');
            setTimeLeft(0);
            setIsRunning(false);
            // Mostrar toast "Ejercicio completado"
            setShowExerciseToast(true);
            setTimeout(() => setShowExerciseToast(false), 1500);
          } else {
            setPhase('done');
            setIsRunning(false);
            setEndMessage(anySkipped ? 'Rutina finalizada sin haber realizado todos los ejercicios' : '¡Rutina completada!');
            setShowEndModal(true);
          }
        }
      }
    }
  }, [timeLeft, isRunning, phase, currentIndex, exercises, series, total, onFinishExercise, spent, seriesTotal, baseDuration, anySkipped]);

  const startExercise = () => {
    setPhase('exercise');
    setTimeLeft(baseDuration);
    setIsRunning(true);
  };

  const skipToNext = () => {
    onSkipExercise?.(currentIndex);
    setAnySkipped(true);
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSeries(1);
      setPhase('ready');
      setIsRunning(false);
      setTimeLeft(0);
    } else {
      setPhase('done');
      setIsRunning(false);
      setEndMessage('Rutina finalizada sin haber realizado todos los ejercicios');
      setShowEndModal(true);
    }
  };



  if (!session) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl text-white font-bold">{ex?.nombre || 'Ejercicio'}</h2>
            <p className="text-sm text-gray-400">Ejercicio {currentIndex + 1} de {total}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Panel del ejercicio actual (estilo HomeTraining) */}
          {ex && (
            <div className="bg-black/40 p-4 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-semibold">{ex.nombre}</h4>
                <div className="text-gray-400 text-sm">Serie {series}/{seriesTotal}</div>
              </div>

              {/* Estado y cronómetro */}
              <div className="text-center mb-6">
                <h3 className={`text-lg font-semibold mb-2 ${getPhaseColor()}`}>
                  {phase === 'ready' ? `Serie ${series} de ${seriesTotal}` : phase === 'exercise' ? `Serie ${series} de ${seriesTotal}` : phase === 'rest' ? 'Tiempo de descanso' : '¡Ejercicio completado!'}
                </h3>
                <div className="relative w-32 h-32 mx-auto mb-2">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
                  <div
                    className={`absolute inset-0 rounded-full border-4 border-t-transparent transition-all duration-1000 ${
                      phase === 'exercise' ? 'border-green-400' : phase === 'rest' ? 'border-yellow-400' : 'border-blue-400'
                    }`}
                    style={{ transform: `rotate(${(((baseDuration) - timeLeft) / (baseDuration)) * 360}deg)` }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-3xl font-bold ${timeLeft === 0 ? 'text-green-400 animate-pulse' : 'text-white'}`}>
                      {timeLeft === 0 ? '¡Listo!' : formatTime(timeLeft)}
                    </span>
                    {!isRunning && (phase === 'exercise' || phase === 'rest') && timeLeft > 0 && (
                      <div className="text-xs text-gray-400 mt-1">Pausado</div>
                    )}
                    {timeLeft === 0 && phase === 'exercise' && (
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
                    <div className="text-2xl font-bold text-white">{isTimeBased ? `${durValue}s` : (repsText || '—')}</div>
                    <div className="text-sm text-gray-400">{isTimeBased ? 'Duración' : 'Repeticiones'}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{(Number(ex?.descanso_seg) || 45)}s</div>
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
                <button onClick={() => setShowExerciseInfo(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors" title="Ver información detallada del ejercicio">
                  <Info className="w-5 h-5" /> Información del Ejercicio
                </button>
              </div>

              {/* Notas / Consejos de ejecución */}
              {ex?.notas && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
                  <div className="flex items-start mb-3">
                    <Target className="w-4 h-4 text-blue-400 mr-2 mt-1 flex-shrink-0" />
                    <h4 className="text-blue-200 font-semibold text-sm">Consejos de Ejecución</h4>
                  </div>
                  <p className="text-blue-200 text-sm leading-relaxed">{ex.notas}</p>
                </div>
              )}

              {/* Información adicional */}
              <div className="bg-gray-700/30 rounded-lg p-3 mb-6">
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
                  {/* Botón de feedback - siempre visible */}
                  <button
                    onClick={() => setShowFeedback(true)}
                    className={`ml-auto flex items-center gap-2 border px-3 py-1 rounded-md transition-colors ${
                      exerciseFeedback[currentIndex] 
                        ? 'text-green-300 border-green-400/50 bg-green-400/10 hover:text-green-200' 
                        : 'text-yellow-300 hover:text-yellow-200 border-yellow-400/30 hover:bg-yellow-400/10'
                    }`}
                    title={exerciseFeedback[currentIndex] ? 'Feedback guardado - Editar valoración' : 'Cómo has sentido este ejercicio?'}
                  >
                    <Star className={`w-4 h-4 ${exerciseFeedback[currentIndex] ? 'fill-current' : ''}`} />
                    {exerciseFeedback[currentIndex] ? 'Valorado' : 'Valorar'}
                  </button>
                </div>
              </div>

              {/* Mostrar feedback guardado */}
              {exerciseFeedback[currentIndex] && (
                <div className="bg-green-900/20 border border-green-600/40 rounded-lg p-4 mb-6">
                  <div className="flex items-start mb-3">
                    <Star className="w-4 h-4 text-green-400 mr-2 mt-1 flex-shrink-0 fill-current" />
                    <h4 className="text-green-200 font-semibold text-sm">Tu valoración guardada</h4>
                  </div>
                  
                  <div className="mb-2">
                    <span className="text-sm text-green-200">Sensación: </span>
                    <span className={`text-sm font-medium ${
                      exerciseFeedback[currentIndex].sentiment === 'love' ? 'text-green-400' :
                      exerciseFeedback[currentIndex].sentiment === 'normal' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {exerciseFeedback[currentIndex].sentiment === 'love' ? '😍 Me encanta' :
                       exerciseFeedback[currentIndex].sentiment === 'normal' ? '😐 Normal' :
                       '😰 Difícil'}
                    </span>
                  </div>
                  
                  {exerciseFeedback[currentIndex].comment && (
                    <div>
                      <span className="text-sm text-green-200">Comentario: </span>
                      <p className="text-sm text-green-100 mt-1 italic">"{exerciseFeedback[currentIndex].comment}"</p>
                    </div>
                  )}
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
                        alt={ex.nombre}
                        className="mx-auto max-h-64 rounded-md shadow-lg border border-gray-600"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className="hidden text-center py-8">
                        <Target className="mx-auto mb-2 text-gray-400" size={48} />
                        <p className="text-gray-400">GIF no disponible</p>
                        <p className="text-sm text-gray-500">({ex.nombre})</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="mx-auto mb-2 text-gray-400" size={48} />
                      <p className="text-gray-400">GIF no disponible</p>
                      <p className="text-sm text-gray-500">({ex.nombre})</p>
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
                          if (v) { setExerciseGif(v); e.currentTarget.value = ''; }
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

              {/* Controles */}
              <div className="flex flex-wrap gap-2 justify-center">
                {phase === 'ready' && (
                  <button onClick={startExercise} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded">
                    <Play className="w-4 h-4" /> Comenzar
                  </button>
                )}
                {phase !== 'ready' && (
                  <button onClick={()=> setIsRunning(r=>!r)} className="flex items-center gap-2 bg-gray-200 hover:bg-white text-black font-semibold py-2 px-4 rounded">
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {isRunning ? 'Pausar' : 'Reanudar'}
                  </button>
                )}
                <button onClick={() => { setPhase('ready'); setSeries(1); setTimeLeft(0); setIsRunning(false); }} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded" title="Reiniciar ejercicio actual"><RotateCcw className="w-4 h-4" /> Repetir</button>
                <button onClick={skipToNext} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded"><SkipForward className="w-4 h-4" /> Saltar Ejercicio</button>
                <button onClick={skipToNext} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded"><Square className="w-4 h-4" /> Cancelar Ejercicio</button>
              </div>

              {/* Selector de tiempo por serie cuando es por repeticiones */}
              {!isTimeBased && allowManualTimer && (
                <div className="mt-3 flex items-center gap-2 justify-center text-sm text-gray-400">
                  <span>Tiempo por serie:</span>
                  {[30,45,60].map((opt)=> (
                    <button key={opt} onClick={()=> { setTimePerSeries(opt); if (phase==='exercise') setTimeLeft(opt); }} className={`px-2 py-1 border rounded ${timePerSeries===opt? 'border-yellow-400 text-yellow-300':'border-gray-600'}`}>{opt}s</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Modal de feedback */}
      {showFeedback && (
        <ExerciseFeedbackModal
          show={showFeedback}
          exerciseName={ex?.nombre}
          initialFeedback={exerciseFeedback[currentIndex]}
          onClose={() => setShowFeedback(false)}
          onSubmit={async (payload) => {
            try {
              console.log('Enviando feedback rutina:', payload);
              
              if (!sessionId) {
                throw new Error('No se puede guardar feedback: falta sessionId');
              }

              const savedFeedback = await saveExerciseFeedback({
                sessionId,
                exerciseOrder: currentIndex,
                sentiment: payload.sentiment,
                comment: payload.comment,
                exerciseName: ex?.nombre
              });

              // Actualizar estado local para mostrar feedback inmediatamente
              setExerciseFeedback(prev => ({
                ...prev,
                [currentIndex]: {
                  sentiment: payload.sentiment,
                  comment: payload.comment
                }
              }));

              console.log('✅ Feedback guardado:', savedFeedback);
            } catch (error) {
              console.error('❌ Error enviando feedback:', error);
              // Mostrar error al usuario si es necesario
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
          exercise={ex}
          onClose={() => setShowExerciseInfo(false)}
        />
      )}

      {/* Toast: Ejercicio completado */}
      {showExerciseToast && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-24 pointer-events-none">
          <div className="bg-green-600 text-white px-4 py-2 rounded shadow-lg">Ejercicio completado</div>
        </div>
      )}

      {/* Modal de fin de rutina */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowEndModal(false); onEndSession?.(); }} />
          <div className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-semibold mb-2">Resumen de la sesión</h3>
            <p className="text-gray-300 mb-4">{endMessage}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowEndModal(false); onEndSession?.(); }} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md">Aceptar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

