/**
 * 🎯 TodayTrainingTab REFACTORIZADO - Sin localStorage
 *
 * CAMBIOS CRÍTICOS:
 * ✅ Estado de sesión desde BD (no localStorage)
 * ✅ useWorkout refactorizado sin localStorage
 * ✅ Progreso real-time desde Supabase
 * ✅ Sincronización automática
 * ✅ Estado persistente entre dispositivos
 *
 * @version 2.0.0 - Refactorización Crítica
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  RefreshCw,
  Calendar,
  AlertTriangle,
  Dumbbell,
  Clock,
  Target,
  CheckCircle,
  Play,
  Pause,
  Database
} from 'lucide-react';

import RoutineSessionModal from '../RoutineSessionModal';
import WarmupModal from '../WarmupModal';
import ExerciseSessionView from '../ExerciseSessionView';
import { useWorkout } from '@/contexts/WorkoutContextRefactored'; // <-- NUEVO CONTEXTO
import { formatExerciseName } from '../../../utils/exerciseUtils';
import SafeComponent from '../../ui/SafeComponent';
import { useTrace } from '@/contexts/TraceContext.jsx';

// ===============================================
// 🎯 HELPER FUNCTIONS
// ===============================================

function getTodayName() {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[new Date().getDay()];
}

function findTodaySession(plan, targetDay) {
  if (!plan?.weeks?.[0]?.sesiones) return null;

  // Buscar sesión por nombre de día
  return plan.weeks[0].sesiones.find(sesion =>
    sesion.dia?.toLowerCase() === targetDay?.toLowerCase()
  );
}

export default function TodayTrainingTabRefactored() {
  const { track } = useTrace();

  // ===============================================
  // 🚀 WORKOUT CONTEXT REFACTORIZADO
  // ===============================================

  const {
    // Estado desde BD (no localStorage)
    plan,
    session,
    ui,
    stats,
    sync,

    // Acciones sin localStorage
    startSession,
    completeSession,
    updateExerciseProgress,
    syncTrainingState,

    // Modales
    showModal,
    hideModal,

    // Utilidades basadas en BD
    hasActivePlan,
    hasActiveSession,
    isTraining,

    // Constantes
    SESSION_STATUS
  } = useWorkout();

  // ===============================================
  // 🎯 ESTADO LOCAL
  // ===============================================

  const [todaySessionData, setTodaySessionData] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseProgress, setExerciseProgress] = useState({});
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  const mountedRef = useRef(true);
  const todayName = useMemo(() => getTodayName(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ===============================================
  // 🔄 SINCRONIZACIÓN CON BD
  // ===============================================

  useEffect(() => {
    if (hasActivePlan && plan.currentPlan) {
      const sessionData = findTodaySession(plan.currentPlan, todayName);
      setTodaySessionData(sessionData);

      // Si hay sesión activa, cargar estado desde contexto
      if (hasActiveSession && session.sessionId) {
        setCurrentExerciseIndex(session.currentExerciseIndex || 0);
        setSessionStartTime(session.sessionStarted ? new Date(session.sessionStarted) : null);

        // Cargar progreso de ejercicios desde BD
        loadExerciseProgress();
      }
    }
  }, [hasActivePlan, plan.currentPlan, todayName, hasActiveSession, session]);

  const loadExerciseProgress = useCallback(async () => {
    if (!session.sessionId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/training-session/progress/${session.sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.progress) {
          setExerciseProgress(result.progress);
        }
      }
    } catch (error) {
      console.error('Error cargando progreso de ejercicios:', error);
    }
  }, [session.sessionId]);

  // ===============================================
  // 🏃 HANDLERS DE SESIÓN
  // ===============================================

  const handleStartSession = useCallback(async () => {
    if (!todaySessionData || hasActiveSession) return;

    setIsLoadingSession(true);
    setSessionError(null);

    try {
      console.log('🏃 Iniciando sesión de hoy:', todaySessionData);

      const result = await startSession({
        planId: plan.planId,
        dayName: todayName,
        weekNumber: plan.currentWeek || 1
      });

      if (result.success) {
        setSessionStartTime(new Date());
        setCurrentExerciseIndex(0);
        setExerciseProgress({});

        // Mostrar modal de calentamiento
        showModal('warmup');

        track('today_session_started', {
          planId: plan.planId,
          dayName: todayName,
          exerciseCount: todaySessionData.ejercicios?.length || 0
        });
      }

    } catch (error) {
      console.error('Error iniciando sesión de hoy:', error);
      setSessionError(error.message);
    } finally {
      setIsLoadingSession(false);
    }
  }, [todaySessionData, hasActiveSession, startSession, plan.planId, plan.currentWeek, todayName, showModal, track]);

  const handleCompleteSession = useCallback(async () => {
    if (!hasActiveSession) return;

    try {
      const result = await completeSession();

      if (result.success) {
        setSessionStartTime(null);
        setCurrentExerciseIndex(0);
        setExerciseProgress({});

        track('today_session_completed', {
          sessionId: session.sessionId,
          duration: sessionStartTime ? Date.now() - sessionStartTime.getTime() : 0,
          exercisesCompleted: Object.keys(exerciseProgress).length
        });

        // Mostrar resumen o feedback
        showModal('feedback');
      }

    } catch (error) {
      console.error('Error completando sesión:', error);
      ui.setError(error.message);
    }
  }, [hasActiveSession, completeSession, session.sessionId, sessionStartTime, exerciseProgress, track, showModal, ui]);

  const handleExerciseUpdate = useCallback(async (exerciseIndex, progressData) => {
    // Actualizar estado local
    setExerciseProgress(prev => ({
      ...prev,
      [exerciseIndex]: progressData
    }));

    // Actualizar en BD a través del contexto
    await updateExerciseProgress(exerciseIndex, progressData);

    // Si el ejercicio se completó, avanzar al siguiente
    if (progressData.status === 'completed') {
      const nextIndex = exerciseIndex + 1;
      if (nextIndex < (todaySessionData?.ejercicios?.length || 0)) {
        setCurrentExerciseIndex(nextIndex);
      }
    }
  }, [updateExerciseProgress, todaySessionData?.ejercicios?.length]);

  // ===============================================
  // 📊 CÁLCULOS DE PROGRESO
  // ===============================================

  const sessionStats = useMemo(() => {
    if (!todaySessionData?.ejercicios) {
      return { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 };
    }

    const totalExercises = todaySessionData.ejercicios.length;
    const completedCount = Object.values(exerciseProgress).filter(p => p.status === 'completed').length;
    const inProgressCount = Object.values(exerciseProgress).filter(p => p.status === 'in_progress').length;

    return {
      total: totalExercises,
      completed: completedCount,
      inProgress: inProgressCount,
      pending: totalExercises - completedCount - inProgressCount,
      progress: totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0
    };
  }, [todaySessionData?.ejercicios, exerciseProgress]);

  const estimatedDuration = useMemo(() => {
    if (!todaySessionData?.ejercicios) return 0;

    return todaySessionData.ejercicios.reduce((total, ejercicio) => {
      const sets = parseInt(ejercicio.series) || 3;
      const reps = parseInt(ejercicio.repeticiones) || 10;
      const rest = parseInt(ejercicio.descanso_seg) || 60;

      // Estimación básica: (tiempo por rep * reps * sets) + descansos
      const exerciseTime = (2 * reps * sets) + (rest * (sets - 1));
      return total + exerciseTime;
    }, 0);
  }, [todaySessionData?.ejercicios]);

  const actualDuration = useMemo(() => {
    if (!sessionStartTime) return 0;
    return Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
  }, [sessionStartTime]);

  // ===============================================
  // 🎨 RENDER
  // ===============================================

  if (!hasActivePlan) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Calendar className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plan activo</h3>
        <p className="text-gray-600">
          Genera una metodología de entrenamiento para comenzar
        </p>
      </div>
    );
  }

  return (
    <SafeComponent fallback={<div>Error cargando entrenamiento de hoy</div>}>
      <div className="space-y-6">
        {/* =============================================== */}
        {/* 🎯 HEADER CON ESTADO ACTUAL */}
        {/* =============================================== */}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Entrenamiento de Hoy
            </h2>
            <p className="text-gray-600">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Indicador de sincronización */}
            {sync.isSyncing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700">Sincronizando...</span>
              </div>
            )}

            {/* Botón de sincronización */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncTrainingState()}
              disabled={sync.isSyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${sync.isSyncing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* =============================================== */}
        {/* 📊 ESTADÍSTICAS DESDE BD */}
        {/* =============================================== */}

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium">Estado desde BD (Real-time)</h3>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-medium text-gray-900">{stats.totalSessions}</div>
                <div className="text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-green-600">{stats.completedSessions}</div>
                <div className="text-gray-600">Completadas</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-blue-600">
                  {hasActiveSession ? 'ACTIVA' : 'INACTIVA'}
                </div>
                <div className="text-gray-600">Sesión</div>
              </div>
            </div>
          </div>
        </Card>

        {/* =============================================== */}
        {/* 🏃 SESIÓN ACTIVA */}
        {/* =============================================== */}

        {hasActiveSession && todaySessionData && (
          <Card className="p-6 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Play className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Sesión en Progreso</h3>
                  <p className="text-sm text-blue-700">
                    {sessionStats.completed}/{sessionStats.total} ejercicios completados
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {sessionStartTime && (
                  <div className="text-center">
                    <div className="font-medium text-blue-900">
                      {Math.floor(actualDuration / 60)}:{(actualDuration % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-xs text-blue-700">Tiempo</div>
                  </div>
                )}

                <div className="text-center">
                  <div className="font-medium text-blue-900">{sessionStats.progress}%</div>
                  <div className="text-xs text-blue-700">Progreso</div>
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mb-4">
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${sessionStats.progress}%` }}
                />
              </div>
            </div>

            {/* Vista de ejercicio actual */}
            {todaySessionData.ejercicios?.[currentExerciseIndex] && (
              <ExerciseSessionView
                exercise={todaySessionData.ejercicios[currentExerciseIndex]}
                exerciseIndex={currentExerciseIndex}
                totalExercises={todaySessionData.ejercicios.length}
                progress={exerciseProgress[currentExerciseIndex] || {}}
                onProgressUpdate={handleExerciseUpdate}
                onNext={() => {
                  const nextIndex = currentExerciseIndex + 1;
                  if (nextIndex < todaySessionData.ejercicios.length) {
                    setCurrentExerciseIndex(nextIndex);
                  }
                }}
                onPrevious={() => {
                  if (currentExerciseIndex > 0) {
                    setCurrentExerciseIndex(currentExerciseIndex - 1);
                  }
                }}
                isLast={currentExerciseIndex === todaySessionData.ejercicios.length - 1}
                onComplete={handleCompleteSession}
              />
            )}
          </Card>
        )}

        {/* =============================================== */}
        {/* 📋 SESIÓN DEL DÍA (NO INICIADA) */}
        {/* =============================================== */}

        {!hasActiveSession && todaySessionData && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Sesión de {todayName}
                </h3>
                <p className="text-gray-600 mt-1">
                  {todaySessionData.ejercicios?.length || 0} ejercicios programados
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>~{Math.round(estimatedDuration / 60)}min</span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>{plan.methodologyType}</span>
                </div>
              </div>
            </div>

            {/* Lista de ejercicios */}
            {todaySessionData.ejercicios && todaySessionData.ejercicios.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Ejercicios programados:</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {todaySessionData.ejercicios.map((ejercicio, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        <Badge variant="secondary">{index + 1}</Badge>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {formatExerciseName(ejercicio.nombre)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {ejercicio.series} series × {ejercicio.repeticiones} reps
                          {ejercicio.descanso_seg && ` • ${ejercicio.descanso_seg}s descanso`}
                        </div>
                      </div>
                      <Dumbbell className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de inicio */}
            <Button
              onClick={handleStartSession}
              disabled={isLoadingSession || hasActiveSession}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isLoadingSession ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Iniciar Entrenamiento
                </>
              )}
            </Button>
          </Card>
        )}

        {/* =============================================== */}
        {/* ❌ NO HAY SESIÓN PARA HOY */}
        {/* =============================================== */}

        {!todaySessionData && (
          <Card className="p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay entrenamiento programado para hoy
            </h3>
            <p className="text-gray-600 mb-4">
              Es tu día de descanso o el plan no incluye entrenamiento para {todayName}
            </p>
            <Button
              variant="outline"
              onClick={() => syncTrainingState()}
              className="flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Verificar Plan
            </Button>
          </Card>
        )}

        {/* =============================================== */}
        {/* ⚠️ ERRORES Y ALERTAS */}
        {/* =============================================== */}

        {sessionError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Error de sesión:</strong> {sessionError}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSessionError(null)}
                className="ml-2"
              >
                Cerrar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {sync.syncError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Error de sincronización:</strong> {sync.syncError}
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncTrainingState()}
                className="ml-2"
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {ui.error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Error:</strong> {ui.error}
              <Button
                variant="outline"
                size="sm"
                onClick={() => ui.clearError()}
                className="ml-2"
              >
                Cerrar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* =============================================== */}
        {/* 🎭 MODALES */}
        {/* =============================================== */}

        {/* Modal de calentamiento */}
        {ui.showWarmup && (
          <WarmupModal
            isOpen={ui.showWarmup}
            onClose={() => hideModal('warmup')}
            onComplete={() => {
              hideModal('warmup');
              // El entrenamiento ya está iniciado desde startSession
            }}
          />
        )}

        {/* Modal de sesión (si es necesario para algunos flujos) */}
        {ui.showSession && todaySessionData && (
          <RoutineSessionModal
            isOpen={ui.showSession}
            onClose={() => hideModal('session')}
            sessionData={todaySessionData}
            exerciseProgress={exerciseProgress}
            onProgressUpdate={handleExerciseUpdate}
            onComplete={handleCompleteSession}
          />
        )}
      </div>
    </SafeComponent>
  );
}