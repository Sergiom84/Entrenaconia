import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { X as IconX, TrendingUp } from 'lucide-react';
import { formatExerciseName } from '../../utils/exerciseUtils';
import ExerciseFeedbackModal from '../HomeTraining/ExerciseFeedbackModal';
import ExerciseInfoModal from './ExerciseInfoModal';
import { saveExerciseFeedback, getSessionFeedback } from './api';
import SeriesTrackingModal from '../Methodologie/methodologies/HipertrofiaV2/components/SeriesTrackingModal';

// Componentes refactorizados
import { useExerciseTimer } from './session/useExerciseTimer';
import { useExerciseProgress } from './session/useExerciseProgress';
import { ExerciseSessionView } from './session/ExerciseSessionView';
import { SessionSummaryModal } from './session/SessionSummaryModal';

/**
 * Modal de sesión de ejercicios - REFACTORIZADO
 *
 * Ahora usa componentes organizados y hooks especializados:
 * - useExerciseTimer: Maneja timer y fases
 * - useExerciseProgress: Maneja estados y navegación
 * - ExerciseSessionView: UI del ejercicio actual
 * - SessionSummaryModal: Modal de resumen final
 *
 * Mantiene TODA la funcionalidad original:
 * - Estados: completed, skipped, cancelled, mixed
 * - Navegación inteligente
 * - Feedback de ejercicios
 * - Salida segura con confirmación
 * - Persistencia en BD al cerrar
 */
export default function RoutineSessionModal({
  session,
  onClose,
  onFinishExercise,
  onSkipExercise,
  onCancelExercise,
  onEndSession,
  sessionId,
  allowManualTimer = true,
  navigateToRoutines = null,
  isOpen = true,
  onProgressUpdate,
}) {
  // Datos de la sesión (soporta "ejercicios" y fallback a "exercises")
  const exercises = useMemo(() => {
    if (Array.isArray(session?.ejercicios)) return session.ejercicios;
    if (Array.isArray(session?.exercises)) return session.exercises;
    return [];
  }, [session?.ejercicios, session?.exercises]);

  // Hooks de estado (siempre llamar hooks, validar después)
  const progressState = useExerciseProgress(session, exercises);
  const timerState = useExerciseTimer(progressState.currentExercise, progressState.seriesTotal, 45, allowManualTimer);

  // Estados locales para modales y feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);
  const [exerciseFeedback, setExerciseFeedback] = useState({});
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showExerciseToast, setShowExerciseToast] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // 🎯 Estados para tracking RIR (HipertrofiaV2)
  const [showSeriesTracking, setShowSeriesTracking] = useState(false);
  const [seriesTrackingData, setSeriesTrackingData] = useState([]);
  const [exerciseProgression, setExerciseProgression] = useState({});
  // Guards y refs
  const closingRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  // Cierre seguro para evitar múltiples llamadas a onClose (según traces)
  const safeClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose?.();
  }, [onClose]);

  // 🎯 Obtener progresión previa del ejercicio (para sugerencias) - MOVIDO AQUÍ PARA EVITAR ERROR DE INICIALIZACIÓN
  const fetchExerciseProgression = useCallback(async (exerciseId) => {
    if (!exerciseId) return null;

    try {
      const token = localStorage.getItem('authToken');
      const userId = JSON.parse(localStorage.getItem('userProfile'))?.id;

      if (!userId || !token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/hipertrofiav2/progression/${userId}/${exerciseId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.progression;
      }
    } catch (error) {
      console.error('Error obteniendo progresión:', error);
    }

    return null;
  }, []);

  // Gestionar timeout del toast de ejercicio completado con cleanup
  useEffect(() => {
    if (!showExerciseToast) return;
    toastTimeoutRef.current = setTimeout(() => setShowExerciseToast(false), 1500);
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, [showExerciseToast]);


  // Cargar feedback existente al abrir modal
  useEffect(() => {
    if (!isOpen || !sessionId) return;
    let cancelled = false;

    const loadExistingFeedback = async () => {
      try {
        const feedbackData = await getSessionFeedback({ sessionId });
        if (cancelled) return;
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
        if (!cancelled) {
          console.error('Error cargando feedback existente:', error);
        }
      }
    };

    loadExistingFeedback();
    return () => { cancelled = true; };
  }, [sessionId, isOpen]);

  // 🎯 Cargar progresión del ejercicio actual (para sugerencias de peso)
  useEffect(() => {
    if (!progressState.currentExercise?.exercise_id) return;

    const loadProgression = async () => {
      const progression = await fetchExerciseProgression(progressState.currentExercise.exercise_id);
      if (progression) {
        setExerciseProgression(prev => ({
          ...prev,
          [progressState.currentExercise.exercise_id]: progression
        }));
        console.log('📊 Progresión cargada:', progression);
      }
    };

    loadProgression();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressState.currentExercise?.exercise_id]);

  // Detectar si hay ejercicio en progreso
  const isCurrentExerciseInProgress = useCallback(() => {
    return timerState.phase === 'exercise' ||
           timerState.phase === 'rest' ||
           (timerState.phase === 'ready' && timerState.series > 1);
  }, [timerState.phase, timerState.series]);

  // Manejar auto-avance del timer
  useEffect(() => {
    if (!isOpen) return;
    if (timerState.timeLeft === 0 && timerState.isRunning) {
      if (timerState.phase === 'exercise') {
        // Fin de ejercicio -> descanso
        timerState.actions._setPhase('rest');
        timerState.actions._setTimeLeft(timerState.restDuration);
        timerState.actions._setIsRunning(true);
      } else if (timerState.phase === 'rest') {
        if (timerState.series < timerState.seriesTotal) {
          // Siguiente serie
          timerState.actions._setSeries(prev => prev + 1);
          timerState.actions._setPhase('exercise');
          timerState.actions._setTimeLeft(timerState.baseDuration);
          timerState.actions._setIsRunning(true);
        } else {
          // Ejercicio completado
          handleCompleteExercise();
        }
      }
    }
  }, [timerState.timeLeft, timerState.isRunning, timerState.phase, timerState.series, timerState.seriesTotal, timerState.baseDuration, timerState.restDuration, isOpen]);

  // Completar ejercicio actual
  const handleCompleteExercise = useCallback(() => {
    const result = progressState.actions.complete(
      timerState.seriesTotal,
      timerState.spent,
      onFinishExercise
    );

    if (result.hasNext) {
      // Hay más ejercicios -> avanzar y resetear timer
      timerState.actions.prepareNext();
      setShowExerciseToast(true);
      console.log('✅ Ejercicio completado, avanzando a ejercicio', result.nextIndex);
    } else {
      // No hay más ejercicios -> mostrar resumen
      setShowEndModal(true);
    }
  }, [progressState.actions, timerState.seriesTotal, timerState.spent, timerState.actions, onFinishExercise]);

  // Saltar ejercicio actual
  const handleSkipExercise = useCallback(() => {
    const result = progressState.actions.skip(onSkipExercise);

    if (result.hasNext) {
      timerState.actions.prepareNext();
      console.log('⏩ Saltando a ejercicio', result.nextIndex);
    } else {
      setShowEndModal(true);
    }
  }, [progressState.actions, timerState.actions, onSkipExercise]);

  // Cancelar ejercicio actual
  const handleCancelExercise = useCallback(() => {
    const result = progressState.actions.cancel(onCancelExercise);

    if (result.hasNext) {
      timerState.actions.prepareNext();
      console.log('⛔ Cancelando ejercicio', progressState.currentIndex, 'y avanzando a', result.nextIndex);
    } else {
      setShowEndModal(true);
    }
  }, [progressState.actions, timerState.actions, onCancelExercise, progressState.currentIndex]);

  // Salida inteligente con X
  const handleSmartExit = useCallback(() => {
    const currentInProgress = isCurrentExerciseInProgress();

    if (currentInProgress) {
      setShowExitConfirmModal(true);
    } else {
      safeClose();
    }
  }, [isCurrentExerciseInProgress, onClose]);

  // Manejar confirmación de salida
  const handleExitConfirmation = useCallback((action) => {
    const currentInProgress = isCurrentExerciseInProgress();

    if (currentInProgress) {
      // 🔥 CORRECCIÓN: Usar originalIndex del ejercicio actual para la API
      const originalIdx = progressState.currentExercise?.originalIndex ?? progressState.currentIndex;

      if (action === 'save-as-partial') {
        // Guardar progreso parcial
        const partialSeries = Math.max(1, timerState.series - 1);
        onFinishExercise?.(originalIdx, {
          status: 'completed',
          series_completed: partialSeries,
          time_spent_seconds: timerState.spent
        });
        progressState.actions.markAs(progressState.currentIndex, 'completed');
      } else if (action === 'skip-current') {
        onSkipExercise?.(originalIdx, {
          status: 'skipped',
          series_completed: 0,
          time_spent_seconds: 0
        });
        progressState.actions.markAs(progressState.currentIndex, 'skipped');
      } else if (action === 'cancel-current') {
        onCancelExercise?.(originalIdx, {
          status: 'cancelled',
          series_completed: 0,
          time_spent_seconds: 0
        });
        progressState.actions.markAs(progressState.currentIndex, 'cancelled');
      }
    }

    setShowExitConfirmModal(false);
    safeClose();
  }, [isCurrentExerciseInProgress, timerState.series, timerState.spent, progressState.currentIndex, progressState.currentExercise, progressState.actions, onFinishExercise, onSkipExercise, onCancelExercise, safeClose]);

  // 🎯 Guardar datos de tracking RIR
  const handleSaveSeriesTracking = useCallback(async (trackingData) => {
    try {
      console.log('💾 Guardando tracking RIR:', trackingData);
      console.log('🔍 DEBUG - trackingData.exercise_id:', trackingData.exercise_id);

      const token = localStorage.getItem('authToken');
      const userId = JSON.parse(localStorage.getItem('userProfile'))?.id;

      if (!userId || !sessionId || !token) {
        throw new Error('Faltan datos para guardar tracking');
      }

      const payload = {
        userId,
        methodologyPlanId: session?.methodologyPlanId,
        sessionId,
        ...trackingData
      };

      console.log('🔍 DEBUG - Payload completo a enviar:', payload);
      console.log('🔍 DEBUG - Payload.exercise_id:', payload.exercise_id);

      // Guardar en backend
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/hipertrofiav2/save-set`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error('Error guardando serie');
      }

      const result = await response.json();
      console.log('✅ Serie guardada:', result);

      // Guardar en estado local
      setSeriesTrackingData(prev => [...prev, trackingData]);

      // Actualizar progresión
      if (trackingData.exercise_id) {
        const progression = await fetchExerciseProgression(trackingData.exercise_id);
        if (progression) {
          setExerciseProgression(prev => ({
            ...prev,
            [trackingData.exercise_id]: progression
          }));
        }
      }

      // Cerrar modal y mostrar toast
      setShowSeriesTracking(false);
      setShowExerciseToast(true);

      // Si completó todas las series, avanzar
      if (trackingData.set_number >= progressState.seriesTotal) {
        setTimeout(() => {
          handleCompleteExercise();
        }, 1000);
      }

    } catch (error) {
      console.error('❌ Error guardando tracking:', error);
      alert('Error al guardar la serie. Por favor, intenta de nuevo.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.methodologyPlanId, progressState.seriesTotal]);

  // Guardar feedback de ejercicio
  const handleSaveFeedback = useCallback(async (payload) => {
    try {
      console.log('Enviando feedback rutina:', payload);

      if (!sessionId) {
        throw new Error('No se puede guardar feedback: falta sessionId');
      }

      // 🔥 CORRECCIÓN: Usar originalIndex para la API
      const originalIdx = progressState.currentExercise?.originalIndex ?? progressState.currentIndex;

      const savedFeedback = await saveExerciseFeedback({
        sessionId,
        exerciseOrder: originalIdx,
        sentiment: payload.sentiment,
        comment: payload.comment,
        exerciseName: formatExerciseName(progressState.currentExercise?.nombre)
      });

      // Actualizar estado local usando índice original (mismo que BD)
      setExerciseFeedback(prev => ({
        ...prev,
        [originalIdx]: {
          sentiment: payload.sentiment,
          comment: payload.comment
        }
      }));

      // Notificar al padre para refrescar calendario/progreso
      if (typeof onProgressUpdate === 'function') {
        onProgressUpdate();
      }

      console.log('✅ Feedback guardado:', savedFeedback);
    } catch (error) {
      console.error('❌ Error enviando feedback:', error);
    } finally {
      setShowFeedback(false);
    }
  }, [sessionId, progressState.currentIndex, progressState.currentExercise, onProgressUpdate]);

  if (!isOpen || !session || exercises.length === 0) return null;

  return (
    <>
      {/* Modal principal */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                {formatExerciseName(progressState.currentExercise?.nombre) || 'Ejercicio'}
                {/* 🎯 NUEVO: Indicador de volumen ajustado */}
                {progressState.currentExercise?.intensity_adjusted && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-md text-xs font-normal">
                    <span className="text-lg">⚡</span>
                    Volumen ajustado
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-400">
                {progressState.progressText}
                {/* 🎯 NUEVO: Mostrar nota de ajuste si existe */}
                {progressState.currentExercise?.adjustment_note && (
                  <span className="ml-2 text-xs text-orange-300">
                    ({progressState.currentExercise.adjustment_note})
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleSmartExit}
              className="text-gray-400 hover:text-white"
              aria-label="Cerrar"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Body - Vista del ejercicio */}
          <div className="p-6 space-y-4">
            <ExerciseSessionView
              exercise={progressState.currentExercise}
              exerciseIndex={progressState.currentIndex}
              exerciseFeedback={exerciseFeedback}
              timerState={timerState}
              timerActions={timerState.actions}
              progressState={progressState}
              onShowFeedback={() => setShowFeedback(true)}
              onShowExerciseInfo={() => setShowExerciseInfo(true)}
              onShowSeriesTracking={() => {
                // 🎯 Abrir modal de tracking con datos del ejercicio actual
                setShowSeriesTracking(true);
              }}
              onComplete={handleCompleteExercise}
              onSkip={handleSkipExercise}
              onCancel={handleCancelExercise}
              allowManualTimer={allowManualTimer}
            />
          </div>
        </div>
      </div>

      {/* Modal de feedback */}
      {showFeedback && (
        <ExerciseFeedbackModal
          show={showFeedback}
          exerciseName={formatExerciseName(progressState.currentExercise?.nombre)}
          initialFeedback={exerciseFeedback[progressState.currentExercise?.originalIndex ?? progressState.currentIndex]}
          onClose={() => setShowFeedback(false)}
          onSubmit={handleSaveFeedback}
        />
      )}

      {/* Modal de información del ejercicio */}
      {showExerciseInfo && (
        <ExerciseInfoModal
          show={showExerciseInfo}
          exercise={progressState.currentExercise}
          onClose={() => setShowExerciseInfo(false)}
        />
      )}

      {/* 🎯 Modal de Tracking RIR (HipertrofiaV2) */}
      {showSeriesTracking && progressState.currentExercise && (() => {
        // 🐛 Debug: Verificar estructura del ejercicio
        console.log('🔍 DEBUG - currentExercise:', progressState.currentExercise);
        console.log('🔍 DEBUG - exercise_id:', progressState.currentExercise?.exercise_id);
        console.log('🔍 DEBUG - id:', progressState.currentExercise?.id);

        const exerciseId = progressState.currentExercise?.exercise_id || progressState.currentExercise?.id;
        console.log('🔍 DEBUG - exerciseId final:', exerciseId);

        return (
          <SeriesTrackingModal
            exerciseName={formatExerciseName(progressState.currentExercise?.nombre)}
            exerciseId={exerciseId}
            seriesNumber={timerState.series}
            totalSeries={timerState.seriesTotal}
            previousPR={exerciseProgression[exerciseId]?.current_pr}
            suggestedWeight={exerciseProgression[exerciseId]?.target_weight_80}
            onSave={handleSaveSeriesTracking}
            onClose={() => setShowSeriesTracking(false)}
          />
        );
      })()}

      {/* Toast: Ejercicio completado */}
      {showExerciseToast && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-24 pointer-events-none">
          <div className="bg-green-600 text-white px-4 py-2 rounded shadow-lg">
            Ejercicio completado
          </div>
        </div>
      )}

      {/* Modal de resumen final */}
      <SessionSummaryModal
        show={showEndModal}
        endTitle={progressState.endMessage.title}
        endMessage={progressState.endMessage.message}
        progressState={progressState}
        onClose={() => { setShowEndModal(false); safeClose(); }}
        onEndSession={onEndSession}
        navigateToRoutines={navigateToRoutines}
      />

      {/* Modal de confirmación de salida */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowExitConfirmModal(false)} />
          <div className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-semibold mb-3">⚠️ Ejercicio en progreso</h3>
            <p className="text-gray-300 mb-4">
              Tienes un ejercicio en progreso. ¿Qué quieres hacer antes de salir?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleExitConfirmation('save-as-partial')}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm"
              >
                💾 Guardar progreso parcial (series: {Math.max(1, timerState.series - 1)})
              </button>

              <button
                onClick={() => handleExitConfirmation('skip-current')}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-md text-sm"
              >
                ⏭️ Marcar como saltado
              </button>

              <button
                onClick={() => handleExitConfirmation('cancel-current')}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-sm"
              >
                ❌ Marcar como cancelado
              </button>

              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm"
              >
                🔙 Continuar entrenando
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}