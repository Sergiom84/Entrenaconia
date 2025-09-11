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

import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { RefreshCw, Calendar, AlertTriangle, Dumbbell, ChevronRight } from 'lucide-react';

import RoutineSessionModal from '../RoutineSessionModal';
import RoutineSessionSummaryCard from '../RoutineSessionSummaryCard';
import { ExerciseList, SessionProgressSummary } from '../components/ExerciseList';
import { CancelConfirmModal, PendingExercisesModal } from '../components/ConfirmationModals';
import { useTodaySession } from '../../../hooks/useTodaySession';
import { formatExerciseName } from '../../../utils/exerciseUtils';
import { startSession, updateExercise, finishSession, cancelRoutine } from '../api';
import SafeComponent from '../../ui/SafeComponent';
import logger from '../../../utils/logger';

export default function TodayTrainingTab({
  plan,
  planId,
  methodologyPlanId,
  todayName,
  planStartDate,
  ensureMethodologyPlan,
  onGenerateAnother,
  onProgressUpdate
}) {
  // Estados del modal de sesión
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [routineSessionId, setRoutineSessionId] = useState(null);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Hook personalizado para manejo de sesión del día
  const {
    todaySession,
    todaySessionStatus,
    loadingStatus,
    pendingExercises,
    showPendingModal,
    yesterdayPendingExercises,
    loadingYesterdayPending,
    error,
    refreshSessionStatus,
    closePendingModal,
    setTodaySessionStatus,
    setYesterdayPendingExercises
  } = useTodaySession({ plan, todayName, methodologyPlanId });

  /**
   * Iniciar nueva sesión de entrenamiento
   */
  const handleStartSession = async (exerciseIndex = 0) => {
    if (!todaySession) {
      logger.warn('No hay sesión definida para hoy', null, 'Routines');
      return;
    }

    try {
      setIsLoading(true);
      const mId = methodologyPlanId || await ensureMethodologyPlan();

      const sessionData = await startSession({
        methodology_plan_id: mId,
        week_number: todaySession.weekNumber || 1,
        day_name: todaySession.dia,
        exercises: todaySession.ejercicios
      });

      if (sessionData?.session?.id) {
        setRoutineSessionId(sessionData.session.id);
        setLastSessionId(sessionData.session.id);
        setSelectedSession({
          ...todaySession,
          sessionId: sessionData.session.id,
          currentExerciseIndex: exerciseIndex
        });
        setShowSessionModal(true);
        
        // Cerrar modal de pendientes si está abierto
        if (showPendingModal) {
          closePendingModal();
        }
        
        logger.info('Sesión iniciada exitosamente', { sessionId: sessionData.session.id }, 'Routines');
      }
    } catch (error) {
      logger.error('Error iniciando sesión', error, 'Routines');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Finalizar ejercicio actual
   */
  const handleFinishExercise = async (exerciseIndex, seriesCompleted, timeSpent) => {
    if (!routineSessionId) return;

    try {
      await updateExercise({
        sessionId: routineSessionId,
        exerciseOrder: exerciseIndex,
        status: 'completed',
        series_completed: seriesCompleted,
        time_spent_seconds: timeSpent
      });

      await refreshSessionStatus();
      
      if (onProgressUpdate) {
        onProgressUpdate();
      }
      
      logger.info('Ejercicio completado', { exerciseIndex, seriesCompleted }, 'Routines');
    } catch (error) {
      logger.error('Error finalizando ejercicio', error, 'Routines');
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
    if (!routineSessionId) return;

    try {
      await finishSession(routineSessionId);
      setShowSessionModal(false);
      setSelectedSession(null);
      await refreshSessionStatus();
      
      if (onProgressUpdate) {
        onProgressUpdate();
      }
      
      logger.info('Sesión finalizada exitosamente', null, 'Routines');
    } catch (error) {
      logger.error('Error finalizando sesión', error, 'Routines');
    }
  };

  /**
   * Continuar con ejercicios pendientes del día anterior
   */
  const handleContinueYesterdayExercises = async () => {
    if (!yesterdayPendingExercises?.sessionId) {
      logger.warn('No hay sesión del día anterior para continuar', null, 'Routines');
      return;
    }

    try {
      setIsLoading(true);
      
      // Configurar la sesión con los ejercicios pendientes del día anterior
      // Formatear los ejercicios para que coincidan con el formato esperado
      const formattedExercises = (yesterdayPendingExercises.exercises || []).map(ex => ({
        nombre: ex.exercise_name,
        series: ex.series_total,
        repeticiones: ex.repeticiones,
        descanso_seg: ex.descanso_seg,
        intensidad: ex.intensidad,
        tempo: ex.tempo,
        notas: ex.notas,
        exercise_order: ex.exercise_order
      }));

      const pendingSession = {
        dia: yesterdayPendingExercises.dayName,
        weekNumber: yesterdayPendingExercises.weekNumber,
        ejercicios: formattedExercises,
        sessionId: yesterdayPendingExercises.sessionId
      };

      setRoutineSessionId(yesterdayPendingExercises.sessionId);
      setLastSessionId(yesterdayPendingExercises.sessionId);
      
      const finalSession = {
        ...pendingSession,
        currentExerciseIndex: 0
      };
      
      setSelectedSession(finalSession);
      
      // Usar setTimeout para asegurar que el estado se actualice
      setTimeout(() => {
        setShowSessionModal(true);
        // Limpiar el estado DESPUÉS de mostrar el modal
        setYesterdayPendingExercises(null);
      }, 100);
      
      logger.info('Continuando con ejercicios pendientes del día anterior', {
        sessionId: yesterdayPendingExercises.sessionId,
        totalPending: yesterdayPendingExercises.totalPending
      }, 'Routines');
    } catch (error) {
      logger.error('Error continuando ejercicios del día anterior', error, 'Routines');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Confirmar cancelación de rutina
   */
  const handleConfirmCancel = async () => {
    if (!methodologyPlanId) return;

    try {
      // Pasar como objeto con la clave correcta
      await cancelRoutine({ methodology_plan_id: methodologyPlanId });
      setShowCancelConfirm(false);
      setTodaySessionStatus(null);
      
      if (onProgressUpdate) {
        onProgressUpdate();
      }
      
      logger.info('Rutina cancelada exitosamente', null, 'Routines');
    } catch (error) {
      logger.error('Error cancelando rutina', error, 'Routines');
    }
  };

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

  if (!todaySession) {
    return (
      <SafeComponent context="TodayTrainingTab">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            Día de descanso
          </h3>
          <p className="text-gray-400 mb-6">
            No hay entrenamientos programados para hoy. ¡Disfruta tu día de recuperación!
          </p>
          
          {/* Sección de ejercicios pendientes del día anterior */}
          {loadingYesterdayPending ? (
            <div className="mb-6">
              <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin mx-auto" />
              <p className="text-gray-400 text-sm mt-2">Verificando ejercicios pendientes...</p>
            </div>
          ) : yesterdayPendingExercises && yesterdayPendingExercises.totalPending > 0 ? (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Dumbbell className="w-5 h-5 text-yellow-400" />
                <h4 className="text-yellow-400 font-medium">
                  ¿Te quedaron ejercicios pendientes?
                </h4>
              </div>
              <p className="text-gray-300 text-sm mb-4">
                Tienes {yesterdayPendingExercises.totalPending} ejercicio{yesterdayPendingExercises.totalPending > 1 ? 's' : ''} 
                {' '}pendiente{yesterdayPendingExercises.totalPending > 1 ? 's' : ''} del día {yesterdayPendingExercises.dayName}
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={handleContinueYesterdayExercises}
                  variant="default"
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  disabled={isLoading}
                >
                  Vamos
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  onClick={() => setYesterdayPendingExercises(null)}
                  variant="outline"
                  className="border-gray-600 text-gray-400 hover:bg-gray-800"
                  disabled={isLoading}
                >
                  Omitir
                </Button>
              </div>
            </div>
          ) : null}
          
          <Button
            onClick={onGenerateAnother}
            variant="outline"
            className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
          >
            Generar nueva rutina
          </Button>
        </div>

        {/* MODALES PARA DÍAS DE DESCANSO - Deben estar aquí para ser renderizados */}
        {showSessionModal && selectedSession && (
          <RoutineSessionModal
            session={selectedSession}
            sessionId={routineSessionId}
            onClose={() => setShowSessionModal(false)}
            onFinishExercise={handleFinishExercise}
            onSkipExercise={handleSkipExercise}
            onCancelExercise={handleCancelExercise}
            onEndSession={handleEndSession}
          />
        )}
        
      </SafeComponent>
    );
  }

  return (
    <SafeComponent context="TodayTrainingTab">
      <div className="space-y-6">
        {/* Resumen de progreso */}
        <SessionProgressSummary sessionStatus={todaySessionStatus} />

        {/* Lista de ejercicios */}
        <ExerciseList
          exercises={todaySession.ejercicios}
          sessionStatus={todaySessionStatus}
          onStartSession={handleStartSession}
        />

        {/* Resumen de sesión completada */}
        {todaySessionStatus?.session && (
          <RoutineSessionSummaryCard 
            session={todaySessionStatus.session}
            exercises={todaySessionStatus.exercises || []}
          />
        )}

        {/* Botones de acción */}
        <div className="flex gap-4 pt-4">
          <Button
            onClick={() => setShowCancelConfirm(true)}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            disabled={isLoading}
          >
            Cancelar rutina
          </Button>
          
          <Button
            onClick={onGenerateAnother}
            variant="outline"
            className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
            disabled={isLoading}
          >
            Generar nueva rutina
          </Button>
        </div>

        {/* Modales */}
        {showSessionModal && selectedSession && (
          <RoutineSessionModal
            session={selectedSession}
            sessionId={routineSessionId}
            onClose={() => setShowSessionModal(false)}
            onFinishExercise={handleFinishExercise}
            onSkipExercise={handleSkipExercise}
            onCancelExercise={handleCancelExercise}
            onEndSession={handleEndSession}
          />
        )}

        <CancelConfirmModal
          isOpen={showCancelConfirm}
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />

        <PendingExercisesModal
          isOpen={showPendingModal}
          exercises={pendingExercises}
          onClose={closePendingModal}
          onStartSession={() => handleStartSession(0)}
          formatExerciseName={formatExerciseName}
        />
      </div>
    </SafeComponent>
  );
}