/**
 * 🎯 Today Training Tab - Migrado a WorkoutContext
 *
 * CAMBIOS PRINCIPALES:
 * - Migrado de useTodaySession + API calls a WorkoutContext unificado
 * - Usando useWorkout() para acceso centralizado al estado
 * - Simplificada la gestión de estado con contexto unificado
 * - Mantenida la funcionalidad existente pero con mejor arquitectura
 * - Código más consistente con MethodologiesScreen y RoutineScreen
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { RefreshCw, Calendar, AlertTriangle, Dumbbell } from 'lucide-react';

import RoutineSessionModal from '../RoutineSessionModal';
import RoutineSessionSummaryCard from '../RoutineSessionSummaryCard';
import WarmupModal from '../WarmupModal';
import { ExerciseList, SessionProgressSummary } from '../components/ExerciseList';
import HomeTrainingRejectionModal from '../../HomeTraining/HomeTrainingRejectionModal.jsx';
import { useWorkout } from '@/contexts/WorkoutContext';
import { formatExerciseName } from '../../../utils/exerciseUtils';
import SafeComponent from '../../ui/SafeComponent';
import logger from '../../../utils/logger';

export default function TodayTrainingTab({
  routinePlan,
  routinePlanId,
  methodologyPlanId,
  planStartDate,
  todayName,
  onProgressUpdate,
  onStartTraining
}) {
  // ===============================================
  // 🎯 INTEGRACIÓN CON WorkoutContext
  // ===============================================

  const {
    // Estado unificado
    plan,
    session,
    ui,

    // Acciones de sesión
    startSession,
    updateExercise,
    completeSession,
    pauseSession,
    endSession,

    // Navegación
    goToMethodologies,

    // Utilidades
    isTraining,
    hasActivePlan,
    hasActiveSession
  } = useWorkout();

  // ===============================================
  // 🎛️ ESTADO LOCAL MÍNIMO
  // ===============================================

  const [localState, setLocalState] = useState({
    showSessionModal: false,
    showWarmupModal: false,
    showRejectionModal: false,
    pendingSessionData: null,
    planExercises: [],
    loadingExercises: false
  });

  const updateLocalState = (updates) => {
    setLocalState(prev => ({ ...prev, ...updates }));
  };

  // Hook de navegación
  const navigate = useNavigate();

  // ===============================================
  // 📅 UTILIDADES DE FECHA Y SESIÓN
  // ===============================================

  // Obtener la sesión del día actual del plan efectivo
  const todaySession = useMemo(() => {
    const effectivePlan = routinePlan || plan.currentPlan;
    if (!effectivePlan?.semanas?.length) return null;

    const totalWeeks = effectivePlan.duracion_total_semanas || effectivePlan.semanas.length;
    const expandedWeeks = Array.from({
      length: totalWeeks
    }, (_, i) => effectivePlan.semanas[i] || effectivePlan.semanas[0]);

    // Buscar en todas las semanas la sesión correspondiente al día actual
    for (let idx = 0; idx < expandedWeeks.length; idx++) {
      const semana = expandedWeeks[idx];
      if (semana.sesiones?.length) {
        const todaySessionFound = semana.sesiones.find(session => {
          const sessionDay = session.dia?.toLowerCase();
          const currentDay = todayName.toLowerCase();
          return sessionDay === currentDay ||
                 sessionDay === currentDay.replace('é', 'e') ||
                 (sessionDay === 'mie' && currentDay === 'miércoles') ||
                 (sessionDay === 'sab' && currentDay === 'sábado');
        });

        if (todaySessionFound) {
          return { ...todaySessionFound, weekNumber: idx + 1 };
        }
      }
    }
    return null;
  }, [routinePlan, plan.currentPlan, todayName]);

  // ===============================================
  // 🎯 HANDLERS DE ACCIONES
  // ===============================================

  /**
   * Iniciar nueva sesión de entrenamiento
   */
  const handleStartSession = async (exerciseIndex = 0) => {
    // Validaciones iniciales
    if (!todaySession) {
      logger.warn('No hay sesión definida para hoy', null, 'Routines');
      ui.setError('No hay sesión definida para hoy');
      return;
    }

    if (!todaySession.ejercicios || todaySession.ejercicios.length === 0) {
      logger.error('La sesión de hoy no tiene ejercicios definidos', { todaySession }, 'Routines');
      ui.setError('La sesión de hoy no tiene ejercicios definidos');
      return;
    }

    if (!methodologyPlanId) {
      logger.error('No se puede iniciar sesión: falta methodologyPlanId', null, 'Routines');
      ui.setError('No se puede iniciar sesión: falta información del plan');
      return;
    }

    try {
      ui.setLoading(true);

      // Usar la función startSession del WorkoutContext
      const result = await startSession({
        planId: methodologyPlanId,
        dayName: todaySession.dia,
        weekNumber: todaySession.weekNumber || 1,
        dayInfo: todaySession,
        exerciseIndex
      });

      if (result.success) {
        logger.info('Sesión iniciada exitosamente desde WorkoutContext', {
          sessionId: result.sessionId,
          totalExercises: todaySession.ejercicios.length,
          startingAt: exerciseIndex
        }, 'Routines');

        // Configurar datos de sesión para el modal
        const enrichedSession = {
          ...todaySession,
          sessionId: result.sessionId,
          currentExerciseIndex: Math.max(0, Math.min(exerciseIndex, todaySession.ejercicios.length - 1))
        };

        // Guardar datos de sesión para después del calentamiento
        updateLocalState({
          pendingSessionData: {
            session: enrichedSession,
            sessionId: result.sessionId
          },
          showWarmupModal: true
        });

        // Opcional: Callback para notificar al componente padre
        if (onStartTraining) {
          onStartTraining();
        }

      } else {
        throw new Error(result.error || 'Error iniciando la sesión');
      }

    } catch (error) {
      logger.error('Error iniciando sesión', {
        error: error.message,
        todaySession: todaySession?.dia,
        methodologyPlanId,
        exerciseCount: todaySession?.ejercicios?.length
      }, 'Routines');

      ui.setError(`Error al iniciar la sesión: ${error.message}`);
    } finally {
      ui.setLoading(false);
    }
  };

  /**
   * Manejar finalización del calentamiento
   */
  const handleWarmupComplete = () => {
    logger.info('Calentamiento completado, iniciando entrenamiento principal', null, 'Routines');

    if (localState.pendingSessionData) {
      updateLocalState({
        showWarmupModal: false,
        showSessionModal: true,
        pendingSessionData: null
      });
    }
  };

  /**
   * Manejar saltar calentamiento
   */
  const handleSkipWarmup = () => {
    logger.info('Calentamiento saltado, yendo directo al entrenamiento', null, 'Routines');

    if (localState.pendingSessionData) {
      updateLocalState({
        showWarmupModal: false,
        showSessionModal: true,
        pendingSessionData: null
      });
    }
  };

  /**
   * Cerrar modal de calentamiento (cancela entrenamiento)
   */
  const handleCloseWarmup = async () => {
    logger.info('Calentamiento cancelado', null, 'Routines');

    updateLocalState({
      showWarmupModal: false,
      pendingSessionData: null
    });

    // TODO: Considerar usar endSession del contexto para cancelar la sesión backend
    logger.debug('Estados de modal de calentamiento limpiados', null, 'Routines');
  };

  /**
   * Finalizar ejercicio actual
   */
  const handleFinishExercise = async (exerciseIndex, seriesCompleted, timeSpent) => {
    // Validaciones
    if (!session.sessionId) {
      logger.error('No se puede finalizar ejercicio: falta sessionId', { exerciseIndex }, 'Routines');
      ui.setError('No se puede finalizar ejercicio: sesión no encontrada');
      return;
    }

    if (typeof exerciseIndex !== 'number' || exerciseIndex < 0) {
      logger.error('exerciseIndex inválido', { exerciseIndex }, 'Routines');
      ui.setError('Índice de ejercicio inválido');
      return;
    }

    try {
      // Usar la función updateExercise del WorkoutContext
      const result = await updateExercise(exerciseIndex, {
        status: 'completed',
        series_completed: Math.max(0, parseInt(seriesCompleted) || 0),
        time_spent_seconds: Math.max(0, parseInt(timeSpent) || 0)
      });

      if (result.success) {
        logger.info('Ejercicio completado exitosamente desde WorkoutContext', {
          exerciseIndex,
          seriesCompleted: Math.max(0, parseInt(seriesCompleted) || 0),
          timeSpent: Math.max(0, parseInt(timeSpent) || 0),
          sessionId: session.sessionId
        }, 'Routines');

        // Notificar al componente padre si es necesario
        if (typeof onProgressUpdate === 'function') {
          onProgressUpdate();
        }
      } else {
        throw new Error(result.error || 'Error completando ejercicio');
      }

    } catch (error) {
      logger.error('Error finalizando ejercicio', {
        error: error.message,
        exerciseIndex,
        sessionId: session.sessionId,
        seriesCompleted,
        timeSpent
      }, 'Routines');

      ui.setError(`Error completando ejercicio: ${error.message}`);
    }
  };

  /**
   * Saltar ejercicio
   */
  const handleSkipExercise = async (exerciseIndex) => {
    if (!session.sessionId) return;

    try {
      const result = await updateExercise(exerciseIndex, {
        status: 'skipped'
      });

      if (result.success) {
        logger.info('Ejercicio saltado desde WorkoutContext', { exerciseIndex }, 'Routines');

        if (onProgressUpdate) {
          onProgressUpdate();
        }
      } else {
        throw new Error(result.error || 'Error saltando ejercicio');
      }
    } catch (error) {
      logger.error('Error saltando ejercicio', error, 'Routines');
      ui.setError(`Error saltando ejercicio: ${error.message}`);
    }
  };

  /**
   * Cancelar ejercicio
   */
  const handleCancelExercise = async (exerciseIndex) => {
    if (!session.sessionId) return;

    try {
      const result = await updateExercise(exerciseIndex, {
        status: 'cancelled'
      });

      if (result.success) {
        logger.info('Ejercicio cancelado desde WorkoutContext', { exerciseIndex }, 'Routines');

        if (onProgressUpdate) {
          onProgressUpdate();
        }
      } else {
        throw new Error(result.error || 'Error cancelando ejercicio');
      }
    } catch (error) {
      logger.error('Error cancelando ejercicio', error, 'Routines');
      ui.setError(`Error cancelando ejercicio: ${error.message}`);
    }
  };

  /**
   * Finalizar sesión completa
   */
  const handleEndSession = async () => {
    if (!session.sessionId) {
      logger.error('No se puede finalizar sesión: falta sessionId', null, 'Routines');
      ui.setError('No se puede finalizar sesión: sesión no encontrada');
      return;
    }

    try {
      ui.setLoading(true);

      // Usar la función completeSession del WorkoutContext
      const result = await completeSession();

      if (result.success) {
        logger.info('Sesión finalizada exitosamente desde WorkoutContext', {
          sessionId: session.sessionId,
          timestamp: new Date().toISOString()
        }, 'Routines');

        // Limpiar estado del modal
        updateLocalState({
          showSessionModal: false,
          pendingSessionData: null
        });

        // Notificar al componente padre
        if (typeof onProgressUpdate === 'function') {
          onProgressUpdate();
        }

        ui.showSuccess('¡Entrenamiento completado exitosamente!');

        // Navegar a la página de rutinas después de cerrar el modal
        setTimeout(() => {
          if (navigate && typeof navigate === 'function') {
            navigate('/routines');
          }
        }, 150);

      } else {
        throw new Error(result.error || 'Error finalizando la sesión');
      }

    } catch (error) {
      logger.error('Error finalizando sesión', {
        error: error.message,
        sessionId: session.sessionId
      }, 'Routines');

      ui.setError(`Error finalizando sesión: ${error.message}`);
    } finally {
      ui.setLoading(false);
    }
  };

  /**
   * Confirmar cancelación de rutina
   */
  const handleConfirmCancel = async () => {
    try {
      if (!methodologyPlanId) {
        throw new Error('No se pudo determinar methodology_plan_id para cancelar');
      }

      // TODO: Implementar cancelRoutine en WorkoutContext
      const { cancelRoutine } = await import('../api');
      await cancelRoutine({
        methodology_plan_id: methodologyPlanId,
        routine_plan_id: routinePlanId || null
      });

      updateLocalState({ showRejectionModal: false });

      logger.info('Rutina cancelada exitosamente', {
        methodology_plan_id: methodologyPlanId,
        routine_plan_id: routinePlanId || null
      }, 'Routines');

      // Navegar a metodologías para generar una nueva rutina
      goToMethodologies();

    } catch (error) {
      logger.error('Error cancelando rutina', error, 'Routines');
      ui.setError(`Error cancelando rutina: ${error.message}`);
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
    }
  };

  // Cancelar sin marcar ejercicios
  const handleSkipCancel = async () => {
    try {
      await handleConfirmCancel();
    } finally {
      updateLocalState({ showRejectionModal: false });
    }
  };

  // ===============================================
  // 🔄 EFECTOS Y CARGA DE DATOS
  // ===============================================

  // Cargar ejercicios reales del plan desde BD
  useEffect(() => {
    const loadPlanExercises = async () => {
      if (!methodologyPlanId) return;

      updateLocalState({ loadingExercises: true });
      try {
        const { getPlanExercises } = await import('../api');
        const exercises = await getPlanExercises({ methodologyPlanId });
        updateLocalState({ planExercises: exercises || [] });
        logger.debug('Ejercicios del plan cargados desde BD', { count: exercises?.length || 0 }, 'Routines');
      } catch (error) {
        logger.error('Error cargando ejercicios del plan', error, 'Routines');
        // Fallback a plan.semanas solo si falla la BD
        const effectivePlan = routinePlan || plan.currentPlan;
        const fallbackExercises = (effectivePlan?.semanas || []).flatMap(sem => sem?.sesiones || [])
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
        updateLocalState({ planExercises: fallbackExercises });
        logger.warn('Usando ejercicios fallback desde plan.semanas', { count: fallbackExercises.length }, 'Routines');
      } finally {
        updateLocalState({ loadingExercises: false });
      }
    };

    loadPlanExercises();
  }, [methodologyPlanId, routinePlan, plan.currentPlan]);

  // ===============================================
  // 🎨 ESTADOS DE CARGA Y ERROR
  // ===============================================

  // Estados de carga y error
  if (ui.isLoading) {
    return (
      <SafeComponent context="TodayTrainingTab">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin mr-2" />
          <span className="text-gray-400">Cargando sesión de hoy...</span>
        </div>
      </SafeComponent>
    );
  }

  if (ui.error) {
    return (
      <SafeComponent context="TodayTrainingTab">
        <Alert className="border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">
            Error cargando datos: {ui.error}
            <Button
              onClick={() => window.location.reload()}
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

  // ===============================================
  // 🎯 ESTADOS DE SESIÓN
  // ===============================================

  // Estados para mostrar el entrenamiento de hoy
  const hasActiveSession = session.status === 'in_progress' || isTraining;
  const hasCompletedSession = session.status === 'completed';
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
                Te quedan {session.exerciseProgress ?
                  Object.values(session.exerciseProgress).filter(ex => ex.status === 'pending').length :
                  0
                } ejercicios por completar
              </p>
              <Button
                onClick={() => handleStartSession(0)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                disabled={ui.isLoading}
              >
                Reanudar Entrenamiento
              </Button>
            </div>

            <ExerciseList
              exercises={session.exerciseProgress ? Object.values(session.exerciseProgress) : []}
              sessionStatus={session}
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
                disabled={ui.isLoading}
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
        {!isRestDay && hasCompletedSession && session.sessionId && (
          <RoutineSessionSummaryCard
            sessionId={session.sessionId}
            session={session.currentSession}
            exercises={session.exerciseProgress ? Object.values(session.exerciseProgress) : []}
          />
        )}

        {/* Modal de Calentamiento */}
        {localState.showWarmupModal && localState.pendingSessionData?.sessionId && (
          <WarmupModal
            level={(routinePlan || plan.currentPlan)?.level || 'básico'}
            sessionId={localState.pendingSessionData.sessionId}
            onComplete={handleWarmupComplete}
            onSkip={handleSkipWarmup}
            onClose={handleCloseWarmup}
          />
        )}

        {/* Modal de Entrenamiento */}
        {localState.showSessionModal && localState.pendingSessionData?.session && (
          <RoutineSessionModal
            session={localState.pendingSessionData.session}
            sessionId={session.sessionId}
            onClose={() => updateLocalState({ showSessionModal: false })}
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
            onClick={() => updateLocalState({ showRejectionModal: true })}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            disabled={ui.isLoading}
          >
            Cancelar rutina
          </Button>
        </div>

        {/* Modales adicionales */}
        {localState.showRejectionModal && (
          <HomeTrainingRejectionModal
            exercises={localState.planExercises}
            equipmentType={(routinePlan || plan.currentPlan)?.equipamiento || (routinePlan || plan.currentPlan)?.equipment || 'rutina'}
            trainingType={(routinePlan || plan.currentPlan)?.selected_style || (routinePlan || plan.currentPlan)?.metodologia || 'rutina'}
            onReject={handleRoutineRejections}
            onSkip={handleSkipCancel}
            onClose={() => updateLocalState({ showRejectionModal: false })}
            loading={localState.loadingExercises}
          />
        )}

      </div>
    </SafeComponent>
  );
}