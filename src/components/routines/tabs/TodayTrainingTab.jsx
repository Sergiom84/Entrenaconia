/**
 * 🎯 Today Training Tab - Versión Refactorizada
 *
 * CAMBIOS PRINCIPALES:
 * - Reducido de 1,168 líneas a ~200 líneas
 * - Utilidades extraídas a exerciseUtils.js
 * - Lógica de sesión extraída a useTodaySession.js
 * - Modales extraídos a ConfirmationModals.jsx
 * - Lista de ejercicios extraída a ExerciseList.jsx
 * - Mejor separación de responsabilidades
 * - Código más mantenible y testeable
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { RefreshCw, Calendar, AlertTriangle, Dumbbell } from 'lucide-react';

import RoutineSessionModal from '../RoutineSessionModal';
import RoutineSessionSummaryCard from '../RoutineSessionSummaryCard';
import WarmupModal from '../WarmupModal';
import { ExerciseList, SessionProgressSummary } from '../components/ExerciseList';
import HomeTrainingRejectionModal from '../../HomeTraining/HomeTrainingRejectionModal.jsx';
import { useTodaySession } from '../../../hooks/useTodaySession';
import { formatExerciseName } from '../../../utils/exerciseUtils';
import { startSession, updateExercise, finishSession, cancelRoutine, getPlanExercises } from '../api';
import SafeComponent from '../../ui/SafeComponent';
import logger from '../../../utils/logger';

export default function TodayTrainingTab({
  plan,
  planId,
  methodologyPlanId,
  todayName,
  ensureMethodologyPlan,
  onProgressUpdate,
  onGenerateAnother
}) {
  // Estados del modal de sesión
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [routineSessionId, setRoutineSessionId] = useState(null);
  const [lastSessionId, setLastSessionId] = useState(() => {
    // Recuperar lastSessionId del localStorage si existe
    const stored = localStorage.getItem(`lastSessionId_${methodologyPlanId}`);
    return stored ? stored : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [pendingSessionData, setPendingSessionData] = useState(null);

  // Estado para ejercicios del plan (datos reales de BD)
  const [planExercises, setPlanExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(false);

  // Hook de navegación
  const navigate = useNavigate();

  // Hook personalizado para manejo de sesión del día
  const {
    todaySession,
    todaySessionStatus,
    loadingStatus,
    error,
    refreshSessionStatus,
    setTodaySessionStatus
  } = useTodaySession({ plan, todayName, methodologyPlanId });

  // Persistir lastSessionId cuando cambie
  useEffect(() => {
    if (lastSessionId && methodologyPlanId) {
      localStorage.setItem(`lastSessionId_${methodologyPlanId}`, lastSessionId);
      logger.info('LastSessionId persistido en localStorage', { lastSessionId, methodologyPlanId }, 'Routines');
    }
  }, [lastSessionId, methodologyPlanId]);

  // Sincronizar lastSessionId con estado real de BD
  useEffect(() => {
    const syncSessionState = async () => {
      if (!todaySessionStatus || !methodologyPlanId) return;

      const currentSessionId = todaySessionStatus.session?.id;
      const sessionStatus = todaySessionStatus.session?.status;

      // Si hay una sesión completada, actualizar lastSessionId
      if (sessionStatus === 'finished' || sessionStatus === 'completed') {
        if (currentSessionId && currentSessionId !== lastSessionId) {
          setLastSessionId(currentSessionId);
          logger.debug('LastSessionId actualizado con sesión completada', { sessionId: currentSessionId }, 'Routines');
        }
      }
      // Si la sesión está activa/en progreso, limpiar lastSessionId obsoleto
      else if (sessionStatus === 'active' || sessionStatus === 'in_progress') {
        if (lastSessionId) {
          // Verificar si lastSessionId sigue siendo válido
          const storedSessionId = localStorage.getItem(`lastSessionId_${methodologyPlanId}`);
          if (storedSessionId && storedSessionId !== currentSessionId) {
            logger.debug('Limpiando lastSessionId obsoleto durante sesión activa', {
              stored: storedSessionId, current: currentSessionId
            }, 'Routines');
            setLastSessionId(null);
            localStorage.removeItem(`lastSessionId_${methodologyPlanId}`);
          }
        }
      }
      // Si no hay sesión del día, validar que lastSessionId sea de hoy
      else if (!sessionStatus && lastSessionId) {
        try {
          // Validar que la sesión guardada existe y es válida
          const { getSessionById } = await import('../api');
          const sessionData = await getSessionById(lastSessionId);
          if (!sessionData || !sessionData.session) {
            logger.warn('LastSessionId inválido detectado, limpiando', { sessionId: lastSessionId }, 'Routines');
            setLastSessionId(null);
            localStorage.removeItem(`lastSessionId_${methodologyPlanId}`);
          }
        } catch (error) {
          logger.warn('Error validando lastSessionId, limpiando por seguridad', error, 'Routines');
          setLastSessionId(null);
          localStorage.removeItem(`lastSessionId_${methodologyPlanId}`);
        }
      }
    };

    syncSessionState();
  }, [todaySessionStatus, lastSessionId, methodologyPlanId]);

  /**
   * Iniciar nueva sesión de entrenamiento
   */
  const handleStartSession = async (exerciseIndex = 0) => {
    // Validaciones iniciales
    if (!todaySession) {
      logger.warn('No hay sesión definida para hoy', null, 'Routines');
      return;
    }

    if (!todaySession.ejercicios || todaySession.ejercicios.length === 0) {
      logger.error('La sesión de hoy no tiene ejercicios definidos', { todaySession }, 'Routines');
      return;
    }

    if (!methodologyPlanId && typeof ensureMethodologyPlan !== 'function') {
      logger.error('No se puede iniciar sesión: falta methodologyPlanId y ensureMethodologyPlan', null, 'Routines');
      return;
    }

    try {
      setIsLoading(true);
      const mId = methodologyPlanId || await ensureMethodologyPlan();

      if (!mId) {
        throw new Error('No se pudo obtener o crear methodology_plan_id');
      }

      const sessionData = await startSession({
        methodology_plan_id: mId,
        week_number: todaySession.weekNumber || 1,
        day_name: todaySession.dia,
        exercises: todaySession.ejercicios
      });

      if (!sessionData?.session?.id) {
        throw new Error('La respuesta del servidor no contiene un ID de sesión válido');
      }

      const newSessionId = sessionData.session.id;
      setRoutineSessionId(newSessionId);
      setLastSessionId(newSessionId);

      const enrichedSession = {
        ...todaySession,
        sessionId: newSessionId,
        currentExerciseIndex: Math.max(0, Math.min(exerciseIndex, todaySession.ejercicios.length - 1))
      };

      setSelectedSession(enrichedSession);

      // Guardar datos de sesión para después del calentamiento
      setPendingSessionData({
        session: enrichedSession,
        sessionId: newSessionId
      });

      // Mostrar modal de calentamiento DESPUÉS de configurar pendingSessionData
      setTimeout(() => setShowWarmupModal(true), 0);

      logger.info('Sesión iniciada exitosamente, iniciando calentamiento', {
        sessionId: newSessionId,
        totalExercises: todaySession.ejercicios.length,
        startingAt: exerciseIndex
      }, 'Routines');

    } catch (error) {
      logger.error('Error iniciando sesión', {
        error: error.message,
        todaySession: todaySession?.dia,
        methodologyPlanId,
        exerciseCount: todaySession?.ejercicios?.length
      }, 'Routines');

      // Mostrar error al usuario si es necesario
      setError && setError(`Error al iniciar la sesión: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Manejar finalización del calentamiento
   */
  const handleWarmupComplete = () => {
    logger.info('Calentamiento completado, iniciando entrenamiento principal', null, 'Routines');
    setShowWarmupModal(false);

    if (pendingSessionData) {
      setSelectedSession(pendingSessionData.session);
      setRoutineSessionId(pendingSessionData.sessionId);
      setShowSessionModal(true);
      setPendingSessionData(null);
    }
  };

  /**
   * Manejar saltar calentamiento
   */
  const handleSkipWarmup = () => {
    logger.info('Calentamiento saltado, yendo directo al entrenamiento', null, 'Routines');
    setShowWarmupModal(false);

    if (pendingSessionData) {
      setSelectedSession(pendingSessionData.session);
      setRoutineSessionId(pendingSessionData.sessionId);
      setShowSessionModal(true);
      setPendingSessionData(null);
    }
  };

  /**
   * Cerrar modal de calentamiento (cancela entrenamiento)
   */
  const handleCloseWarmup = async () => {
    logger.info('Calentamiento cancelado', null, 'Routines');
    setShowWarmupModal(false);

    // Limpiar estados relacionados
    setSelectedSession(null);
    setRoutineSessionId(null);
    setPendingSessionData(null);

    // TODO: Considerar cancelar la sesión creada en el backend si es necesario
    logger.debug('Estados de modal de calentamiento limpiados', null, 'Routines');
  };

  /**
   * Finalizar ejercicio actual
   */
  const handleFinishExercise = async (exerciseIndex, seriesCompleted, timeSpent) => {
    // Validaciones
    if (!routineSessionId) {
      logger.error('No se puede finalizar ejercicio: falta routineSessionId', { exerciseIndex }, 'Routines');
      return;
    }

    if (typeof exerciseIndex !== 'number' || exerciseIndex < 0) {
      logger.error('exerciseIndex inválido', { exerciseIndex }, 'Routines');
      return;
    }

    try {
      const updateData = {
        sessionId: routineSessionId,
        exerciseOrder: exerciseIndex,
        status: 'completed',
        series_completed: Math.max(0, parseInt(seriesCompleted) || 0),
        time_spent_seconds: Math.max(0, parseInt(timeSpent) || 0)
      };

      await updateExercise(updateData);
      await refreshSessionStatus();

      if (typeof onProgressUpdate === 'function') {
        onProgressUpdate();
      }

      logger.info('Ejercicio completado exitosamente', {
        exerciseIndex,
        seriesCompleted: updateData.series_completed,
        timeSpent: updateData.time_spent_seconds,
        sessionId: routineSessionId
      }, 'Routines');

    } catch (error) {
      logger.error('Error finalizando ejercicio', {
        error: error.message,
        exerciseIndex,
        sessionId: routineSessionId,
        seriesCompleted,
        timeSpent
      }, 'Routines');

      // En caso de error, intentar refrescar el estado de todos modos
      try {
        await refreshSessionStatus();
      } catch (refreshError) {
        logger.error('Error en fallback de refreshSessionStatus tras fallo de finishExercise', refreshError, 'Routines');
      }
    }
  };

  /**
   * Saltar ejercicio
   */
  const handleSkipExercise = async (exerciseIndex) => {
    if (!routineSessionId) return;

    try {
      await updateExercise({
        sessionId: routineSessionId,
        exerciseOrder: exerciseIndex,
        status: 'skipped'
      });

      await refreshSessionStatus();

      if (onProgressUpdate) {
        onProgressUpdate();
      }

      logger.info('Ejercicio saltado', { exerciseIndex }, 'Routines');
    } catch (error) {
      logger.error('Error saltando ejercicio', error, 'Routines');
    }
  };

  /**
   * Cancelar ejercicio
   */
  const handleCancelExercise = async (exerciseIndex) => {
    if (!routineSessionId) return;

    try {
      await updateExercise({
        sessionId: routineSessionId,
        exerciseOrder: exerciseIndex,
        status: 'cancelled'
      });

      await refreshSessionStatus();

      if (onProgressUpdate) {
        onProgressUpdate();
      }

      logger.info('Ejercicio cancelado', { exerciseIndex }, 'Routines');
    } catch (error) {
      logger.error('Error cancelando ejercicio', error, 'Routines');
    }
  };

  /**
   * Finalizar sesión completa
   */
  const handleEndSession = async () => {
    if (!routineSessionId) {
      logger.error('No se puede finalizar sesión: falta routineSessionId', null, 'Routines');
      return;
    }

    try {
      setIsLoading(true);

      await finishSession(routineSessionId);

      // Limpiar estado del modal
      setShowSessionModal(false);
      setSelectedSession(null);
      setRoutineSessionId(null);
      setPendingSessionData(null);

      // Mantener el sessionId para que se muestre el resumen
      const completedSessionId = routineSessionId;
      setLastSessionId(completedSessionId);

      // Actualizar el estado de la sesión para reflejar que está completada
      await refreshSessionStatus();

      if (typeof onProgressUpdate === 'function') {
        onProgressUpdate();
      }

      logger.info('Sesión finalizada exitosamente', {
        sessionId: completedSessionId,
        timestamp: new Date().toISOString()
      }, 'Routines');

      // Navegar a la página de rutinas después de cerrar el modal
      setTimeout(() => {
        if (navigate && typeof navigate === 'function') {
          navigate('/routines');
        }
      }, 150);

    } catch (error) {
      logger.error('Error finalizando sesión', {
        error: error.message,
        sessionId: routineSessionId
      }, 'Routines');

      // En caso de error, intentar actualizar el estado de todos modos
      try {
        await refreshSessionStatus();
      } catch (fallbackError) {
        logger.error('Error en fallback de refreshSessionStatus tras fallo de endSession', {
          originalError: error.message,
          fallbackError: fallbackError.message
        }, 'Routines');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ELIMINADO: función compleja de yesterday-pending

  /**
   * Confirmar cancelación de rutina
   */
  const handleConfirmCancel = async () => {
    try {
      // Asegurar que tenemos un methodology_plan_id válido (bootstrap si venimos de fallback de routine_plans)
      const mId = methodologyPlanId || (typeof ensureMethodologyPlan === 'function' ? await ensureMethodologyPlan() : null);
      if (!mId) throw new Error('No se pudo determinar methodology_plan_id para cancelar');

      await cancelRoutine({ methodology_plan_id: mId, routine_plan_id: planId || null });
      setShowRejectionModal(false);
      setTodaySessionStatus(null);

      logger.info('Rutina cancelada exitosamente', { methodology_plan_id: mId, routine_plan_id: planId || null }, 'Routines');

      // Navegar a metodologías para generar una nueva rutina
      if (onGenerateAnother) {
        onGenerateAnother();
      } else if (onProgressUpdate) {
        onProgressUpdate();
      }
    } catch (error) {
      logger.error('Error cancelando rutina', error, 'Routines');
    }
  };


  // Guardar rechazos y cancelar rutina (flujo unificado)
  const handleRoutineRejections = async (rejections) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/home-training/rejections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rejections }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        logger.error('Error guardando ejercicios rechazados', { status: resp.status, ...errBody }, 'Routines');
      } else {
        logger.info('Rechazos guardados (rutina)', { count: rejections?.length || 0 }, 'Routines');
      }
    } catch (e) {
      logger.error('Error guardando ejercicios rechazados', e, 'Routines');
    } finally {
      await handleConfirmCancel();
      setShowRejectionModal(false);
    }
  };

  // Cancelar sin marcar ejercicios
  const handleSkipCancel = async () => {
    try {
      await handleConfirmCancel();
    } finally {
      setShowRejectionModal(false);
    }
  };

  // Cargar ejercicios reales del plan desde BD
  useEffect(() => {
    const loadPlanExercises = async () => {
      if (!methodologyPlanId) return;

      setLoadingExercises(true);
      try {
        const exercises = await getPlanExercises({ methodologyPlanId });
        setPlanExercises(exercises || []);
        logger.debug('Ejercicios del plan cargados desde BD', { count: exercises?.length || 0 }, 'Routines');
      } catch (error) {
        logger.error('Error cargando ejercicios del plan', error, 'Routines');
        // Fallback a plan.semanas solo si falla la BD
        const fallbackExercises = (plan?.semanas || []).flatMap(sem => sem?.sesiones || [])
          .flatMap(ses => ses?.ejercicios || [])
          .reduce((acc, ej) => {
            const nombre = ej?.nombre || ej?.name || '';
            if (!nombre) return acc;
            if (!acc.find(x => x.nombre?.toLowerCase() === nombre.toLowerCase())) {
              acc.push({
                nombre,
                series: ej.series ?? ej.series_total ?? 3,
                repeticiones: ej.repeticiones ?? ej.reps ?? null,
                duracion_seg: ej.duracion_seg ?? ej.duration_sec ?? null,
              });
            }
            return acc;
          }, []);
        setPlanExercises(fallbackExercises);
        logger.warn('Usando ejercicios fallback desde plan.semanas', { count: fallbackExercises.length }, 'Routines');
      } finally {
        setLoadingExercises(false);
      }
    };

    loadPlanExercises();
  }, [methodologyPlanId, plan]);

  // Estados de carga y error
  if (loadingStatus) {
    return (
      <SafeComponent context="TodayTrainingTab">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin mr-2" />
          <span className="text-gray-400">Cargando sesión de hoy...</span>
        </div>
      </SafeComponent>
    );
  }

  if (error) {
    return (
      <SafeComponent context="TodayTrainingTab">
        <Alert className="border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">
            Error cargando datos: {error}
            <Button
              onClick={refreshSessionStatus}
              variant="ghost"
              size="sm"
              className="ml-2 text-red-400 hover:text-red-300"
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </SafeComponent>
    );
  }

  // Estados para mostrar el entrenamiento de hoy
  const hasActiveSession = todaySessionStatus?.session?.status === 'in_progress';
  const hasCompletedSession = todaySessionStatus?.session?.status === 'finished';
  const isRestDay = !todaySession;

  return (
    <SafeComponent context="TodayTrainingTab">
      <div className="space-y-6">

        {/* Si hay una sesión en progreso - mostrar botón continuar */}
        {hasActiveSession && !isRestDay && (
          <>
            <div className="text-center py-6">
              <Dumbbell className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Continúa tu entrenamiento
              </h3>
              <p className="text-gray-400 mb-4">
                Te quedan {todaySessionStatus.summary?.pending || 0} ejercicios por completar
              </p>
              <Button
                onClick={() => handleStartSession(0)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                disabled={isLoading}
              >
                Reanudar Entrenamiento
              </Button>
            </div>

            <ExerciseList
              exercises={todaySessionStatus.exercises || []}
              sessionStatus={todaySessionStatus}
              onStartSession={handleStartSession}
              showProgress={true}
            />
          </>
        )}

        {/* Si es día de entrenamiento y no hay sesión activa */}
        {!isRestDay && !hasActiveSession && !hasCompletedSession && (
          <>
            <div className="text-center py-6">
              <Dumbbell className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Entrenamiento de hoy: {todaySession.dia}
              </h3>
              <p className="text-gray-400 mb-4">
                {todaySession.ejercicios?.length || 0} ejercicios programados
              </p>
              <Button
                onClick={() => handleStartSession(0)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                disabled={isLoading}
              >
                Comenzar Entrenamiento
              </Button>
            </div>

            <ExerciseList
              exercises={todaySession.ejercicios || []}
              sessionStatus={null}
              onStartSession={handleStartSession}
              showProgress={false}
            />
          </>
        )}

        {/* Si es día de descanso o ya completó el entrenamiento */}
        {(isRestDay || hasCompletedSession) && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {isRestDay ? 'Día de descanso' : 'Entrenamiento completado'}
            </h3>
            <p className="text-gray-400 mb-6">
              {isRestDay ?
                'No hay entrenamientos programados para hoy. ¡Disfruta tu día de recuperación!' :
                '¡Buen trabajo! Has completado el entrenamiento de hoy.'
              }
            </p>


          </div>
        )}

        {/* Resumen de última sesión completada */}
        {!isRestDay && lastSessionId && (
          <RoutineSessionSummaryCard
            sessionId={lastSessionId}
            session={todaySessionStatus?.session}
            exercises={todaySessionStatus?.exercises || []}
          />
        )}

        {/* Modal de Calentamiento */}
        {showWarmupModal && pendingSessionData?.sessionId && (
          <WarmupModal
            level={plan?.level || 'básico'} // Nivel del plan actual
            sessionId={pendingSessionData.sessionId} // ✅ NUEVO: ID de sesión para guardar tiempo
            onComplete={handleWarmupComplete}
            onSkip={handleSkipWarmup}
            onClose={handleCloseWarmup}
          />
        )}

        {/* Modal de Entrenamiento */}
        {showSessionModal && selectedSession && (
          <RoutineSessionModal
            session={selectedSession}
            sessionId={routineSessionId}
            onClose={() => setShowSessionModal(false)}
            onFinishExercise={handleFinishExercise}
            onSkipExercise={handleSkipExercise}
            onCancelExercise={handleCancelExercise}
            onEndSession={handleEndSession}
            navigateToRoutines={() => navigate('/routines')}
          />
        )}

        {/* Botones de acción */}
        <div className="flex gap-4 justify-center pt-4">
          <Button
            onClick={() => setShowRejectionModal(true)}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            disabled={isLoading}
          >
            Cancelar rutina
          </Button>
        </div>

        {/* Modales adicionales */}
        {showRejectionModal && (
          <HomeTrainingRejectionModal
            exercises={planExercises} // Usar ejercicios reales de BD
            equipmentType={plan?.equipamiento || plan?.equipment || 'rutina'}
            trainingType={plan?.selected_style || plan?.metodologia || 'rutina'}
            onReject={handleRoutineRejections}
            onSkip={handleSkipCancel}
            onClose={() => setShowRejectionModal(false)}
            loading={loadingExercises}
          />
        )}

      </div>
    </SafeComponent>
  );
}