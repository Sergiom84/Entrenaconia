/**
 * 🗓️ CalendarTab REFACTORIZADO - Sin localStorage
 *
 * CAMBIOS CRÍTICOS:
 * ✅ Progreso desde BD (no localStorage)
 * ✅ Estado real-time con WorkoutContext refactorizado
 * ✅ Historial de sesiones desde Supabase
 * ✅ Sincronización automática
 *
 * @version 2.0.0 - Refactorización Crítica
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Target,
  Dumbbell,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Database
} from 'lucide-react';
import { useWorkout } from '@/contexts/WorkoutContextRefactored'; // <-- NUEVO CONTEXTO
import { mapSessionsToWeekDays } from '../../../utils/calendarMapping';
import { getSentimentIcon } from '../../../utils/exerciseUtils';
import { CalendarExerciseCard } from './components/CalendarExerciseCard';
import { useTrace } from '@/contexts/TraceContext.jsx';

// ===============================================
// 📅 HELPER FUNCTIONS
// ===============================================

function formatDateForDisplay(date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function getWeekDates(startDate, weekOffset = 0) {
  const start = new Date(startDate);
  start.setDate(start.getDate() + (weekOffset * 7));

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }

  return dates;
}

export default function CalendarTabRefactored() {
  const { track } = useTrace();

  // ===============================================
  // 🚀 WORKOUT CONTEXT REFACTORIZADO
  // ===============================================

  const {
    // Estado desde BD (no localStorage)
    plan,
    session,
    stats,
    ui,
    sync,

    // Acciones
    syncTrainingState,
    startSession,

    // Utilidades
    hasActivePlan,
    hasActiveSession
  } = useWorkout();

  // ===============================================
  // 🎯 ESTADO LOCAL
  // ===============================================

  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ===============================================
  // 🔄 CARGA DE HISTORIAL DESDE BD
  // ===============================================

  const loadSessionHistory = useCallback(async () => {
    if (!hasActivePlan || !plan.planId) return;

    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/training-session/history/${plan.planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.sessions)) {
        // Mapear sesiones por semana y día
        const historyMap = {};

        result.sessions.forEach(sessionData => {
          const key = `${sessionData.week_number}-${sessionData.day_name}`;
          historyMap[key] = {
            ...sessionData,
            status: sessionData.session_status,
            completedAt: sessionData.completed_at,
            duration: sessionData.total_duration_seconds,
            exercisesCompleted: sessionData.exercises_completed,
            totalExercises: sessionData.total_exercises,
            progress: sessionData.exercises_completed && sessionData.total_exercises
              ? (sessionData.exercises_completed / sessionData.total_exercises) * 100
              : 0
          };
        });

        if (mountedRef.current) {
          setSessionHistory(historyMap);
        }
      }

    } catch (error) {
      console.error('Error cargando historial de sesiones:', error);
      if (mountedRef.current) {
        setHistoryError(error.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingHistory(false);
      }
    }
  }, [hasActivePlan, plan.planId]);

  // Cargar historial cuando cambie el plan
  useEffect(() => {
    if (hasActivePlan && plan.planId) {
      loadSessionHistory();
    }
  }, [hasActivePlan, plan.planId, loadSessionHistory]);

  // ===============================================
  // 📅 CÁLCULOS DE FECHAS Y SEMANAS
  // ===============================================

  const planStartDate = useMemo(() => {
    return plan.startedAt ? new Date(plan.startedAt) : new Date();
  }, [plan.startedAt]);

  const getInitialWeek = useCallback(() => {
    if (!planStartDate) return 0;
    const startDate = new Date(planStartDate);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysDifference = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const weeksDifference = Math.floor(daysDifference / 7);

    return Math.max(0, Math.min(weeksDifference, (plan.currentPlan?.semanas?.length || 1) - 1));
  }, [planStartDate, plan.currentPlan?.semanas?.length]);

  useEffect(() => {
    if (hasActivePlan) {
      setCurrentWeekIndex(getInitialWeek());
    }
  }, [hasActivePlan, getInitialWeek]);

  // ===============================================
  // 📊 MAPEO DE SESIONES PARA LA SEMANA ACTUAL
  // ===============================================

  const currentWeekSessions = useMemo(() => {
    if (!hasActivePlan || !plan.currentPlan?.semanas?.[currentWeekIndex]) {
      return [];
    }

    const currentWeek = plan.currentPlan.semanas[currentWeekIndex];
    const weekDates = getWeekDates(planStartDate, currentWeekIndex);

    // Usar utilidad existente para mapear sesiones
    const mappedSessions = mapSessionsToWeekDays(
      currentWeek.sesiones || [],
      weekDates
    );

    // Enriquecer con datos del historial
    return mappedSessions.map((sessionData, dayIndex) => {
      const historyKey = `${currentWeekIndex + 1}-${sessionData?.dia}`;
      const historyData = sessionHistory[historyKey];

      return {
        ...sessionData,
        date: weekDates[dayIndex],
        dayIndex,
        weekNumber: currentWeekIndex + 1,

        // Estado desde BD (no localStorage)
        status: historyData?.status || 'pending',
        progress: historyData?.progress || 0,
        completedAt: historyData?.completedAt,
        duration: historyData?.duration,
        exercisesCompleted: historyData?.exercisesCompleted || 0,
        totalExercises: historyData?.totalExercises || sessionData?.ejercicios?.length || 0,

        // Indicador de sesión actual
        isToday: weekDates[dayIndex].toDateString() === new Date().toDateString(),
        isCurrentSession: hasActiveSession && session.weekNumber === (currentWeekIndex + 1) &&
                         session.dayName === sessionData?.dia
      };
    });
  }, [hasActivePlan, plan.currentPlan, currentWeekIndex, planStartDate, sessionHistory, hasActiveSession, session]);

  // ===============================================
  // 🎯 HANDLERS DE EVENTOS
  // ===============================================

  const handleStartSession = useCallback(async (sessionData) => {
    if (!sessionData || hasActiveSession) return;

    try {
      console.log('🏃 Iniciando sesión:', sessionData);

      const result = await startSession({
        planId: plan.planId,
        dayName: sessionData.dia,
        weekNumber: sessionData.weekNumber
      });

      if (result.success) {
        track('session_started_from_calendar', {
          planId: plan.planId,
          weekNumber: sessionData.weekNumber,
          dayName: sessionData.dia
        });

        // Recargar historial para ver la nueva sesión
        await loadSessionHistory();
      }

    } catch (error) {
      console.error('Error iniciando sesión desde calendar:', error);
      ui.setError(error.message);
    }
  }, [hasActiveSession, startSession, plan.methodologyPlanId, loadSessionHistory, track, ui]);

  const handleSessionClick = useCallback((sessionData) => {
    setSelectedSession(sessionData);
    track('calendar_session_clicked', {
      dayName: sessionData.dia,
      weekNumber: sessionData.weekNumber,
      status: sessionData.status
    });
  }, [track]);

  const navigateWeek = useCallback((direction) => {
    const maxWeeks = plan.currentPlan?.semanas?.length || 1;
    setCurrentWeekIndex(prev => {
      if (direction === 'prev') {
        return Math.max(0, prev - 1);
      } else {
        return Math.min(maxWeeks - 1, prev + 1);
      }
    });
  }, [plan.currentPlan?.semanas?.length]);

  // ===============================================
  // 📊 ESTADÍSTICAS DE LA SEMANA
  // ===============================================

  const weekStats = useMemo(() => {
    const sessionsWithData = currentWeekSessions.filter(s => s?.ejercicios?.length);
    const completedSessions = sessionsWithData.filter(s => s.status === 'completed');
    const inProgressSessions = sessionsWithData.filter(s => s.status === 'in_progress');

    return {
      total: sessionsWithData.length,
      completed: completedSessions.length,
      inProgress: inProgressSessions.length,
      pending: sessionsWithData.length - completedSessions.length - inProgressSessions.length,
      completionRate: sessionsWithData.length > 0
        ? Math.round((completedSessions.length / sessionsWithData.length) * 100)
        : 0
    };
  }, [currentWeekSessions]);

  // ===============================================
  // 🎨 RENDER
  // ===============================================

  if (!hasActivePlan) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Calendar className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plan activo</h3>
        <p className="text-gray-600">
          Genera una metodología de entrenamiento para ver tu calendario
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* =============================================== */}
      {/* 🎯 HEADER CON NAVEGACIÓN Y STATS */}
      {/* =============================================== */}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
              disabled={currentWeekIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center min-w-[120px]">
              <h2 className="font-semibold">
                Semana {currentWeekIndex + 1}
              </h2>
              <p className="text-sm text-gray-600">
                {plan.methodologyType}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
              disabled={currentWeekIndex >= (plan.currentPlan?.semanas?.length || 1) - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Botón de sincronización */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              syncTrainingState();
              loadSessionHistory();
            }}
            disabled={sync.isSyncing || isLoadingHistory}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(sync.isSyncing || isLoadingHistory) ? 'animate-spin' : ''}`} />
            {sync.isSyncing || isLoadingHistory ? 'Sincronizando...' : 'Actualizar'}
          </Button>
        </div>

        {/* Estadísticas de la semana */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>{weekStats.completed}/{weekStats.total}</span>
          </div>
          <Badge variant="secondary">
            {weekStats.completionRate}% completado
          </Badge>
        </div>
      </div>

      {/* =============================================== */}
      {/* 📅 GRID DEL CALENDARIO */}
      {/* =============================================== */}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {currentWeekSessions.map((sessionData, index) => {
          const hasSession = sessionData?.ejercicios?.length > 0;
          const statusColor = {
            pending: 'border-gray-200 bg-white',
            in_progress: 'border-blue-300 bg-blue-50',
            completed: 'border-green-300 bg-green-50',
            cancelled: 'border-red-300 bg-red-50'
          }[sessionData?.status] || 'border-gray-200 bg-gray-50';

          return (
            <Card
              key={index}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${statusColor} ${
                sessionData?.isToday ? 'ring-2 ring-blue-400' : ''
              } ${!hasSession ? 'opacity-60' : ''}`}
              onClick={() => hasSession && handleSessionClick(sessionData)}
            >
              {/* Fecha */}
              <div className="text-center mb-3">
                <div className="font-medium text-gray-900">
                  {formatDateForDisplay(sessionData.date)}
                </div>
                {sessionData?.isToday && (
                  <Badge variant="default" className="mt-1 text-xs">
                    Hoy
                  </Badge>
                )}
              </div>

              {/* Contenido de la sesión */}
              {hasSession ? (
                <div className="space-y-2">
                  {/* Nombre del día */}
                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {sessionData.dia}
                    </span>
                  </div>

                  {/* Ejercicios count */}
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                    <Dumbbell className="h-3 w-3" />
                    <span>{sessionData.ejercicios?.length || 0}</span>
                  </div>

                  {/* Progreso */}
                  {sessionData.status !== 'pending' && (
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">
                        {sessionData.exercisesCompleted || 0}/{sessionData.totalExercises || 0}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-blue-600 h-1 rounded-full transition-all"
                          style={{ width: `${sessionData.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Duración si está completada */}
                  {sessionData.status === 'completed' && sessionData.duration && (
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                      <Clock className="h-3 w-3" />
                      <span>{Math.round(sessionData.duration / 60)}min</span>
                    </div>
                  )}

                  {/* Botón de acción */}
                  {sessionData.status === 'pending' && !hasActiveSession && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartSession(sessionData);
                      }}
                      className="w-full text-xs"
                    >
                      Iniciar
                    </Button>
                  )}

                  {sessionData.isCurrentSession && (
                    <Badge className="w-full justify-center bg-blue-600">
                      En progreso
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <div className="text-sm">Descanso</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* =============================================== */}
      {/* 📊 ESTADÍSTICAS GLOBALES */}
      {/* =============================================== */}

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium">Estadísticas desde BD</h3>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-medium text-gray-900">{stats.totalSessions}</div>
              <div className="text-gray-600">Total sesiones</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-green-600">{stats.completedSessions}</div>
              <div className="text-gray-600">Completadas</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-600">{stats.inProgressSessions}</div>
              <div className="text-gray-600">En progreso</div>
            </div>
            {stats.lastTrainingDate && (
              <div className="text-center">
                <div className="font-medium text-gray-900">
                  {new Date(stats.lastTrainingDate).toLocaleDateString('es-ES')}
                </div>
                <div className="text-gray-600">Último entreno</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* =============================================== */}
      {/* 🎭 MODAL DE DETALLE DE SESIÓN */}
      {/* =============================================== */}

      {selectedSession && (
        <Dialog
          open={!!selectedSession}
          onOpenChange={() => setSelectedSession(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedSession.dia} - Semana {selectedSession.weekNumber}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Info de la sesión */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="font-medium">Estado</div>
                  <Badge className={
                    selectedSession.status === 'completed' ? 'bg-green-600' :
                    selectedSession.status === 'in_progress' ? 'bg-blue-600' :
                    'bg-gray-600'
                  }>
                    {selectedSession.status === 'completed' ? 'Completada' :
                     selectedSession.status === 'in_progress' ? 'En progreso' : 'Pendiente'}
                  </Badge>
                </div>

                {selectedSession.progress > 0 && (
                  <div className="text-center">
                    <div className="font-medium">Progreso</div>
                    <div className="text-lg">{Math.round(selectedSession.progress)}%</div>
                  </div>
                )}

                {selectedSession.duration && (
                  <div className="text-center">
                    <div className="font-medium">Duración</div>
                    <div className="text-lg">{Math.round(selectedSession.duration / 60)}min</div>
                  </div>
                )}
              </div>

              {/* Lista de ejercicios */}
              <div>
                <h4 className="font-medium mb-3">
                  Ejercicios ({selectedSession.ejercicios?.length || 0})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedSession.ejercicios?.map((ejercicio, index) => (
                    <CalendarExerciseCard
                      key={index}
                      exercise={ejercicio}
                      index={index}
                    />
                  ))}
                </div>
              </div>

              {/* Acciones */}
              {selectedSession.status === 'pending' && !hasActiveSession && (
                <Button
                  onClick={() => {
                    setSelectedSession(null);
                    handleStartSession(selectedSession);
                  }}
                  className="w-full"
                >
                  Iniciar Sesión
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Estados de carga y error */}
      {isLoadingHistory && (
        <div className="text-center text-gray-600 py-4">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
          Cargando historial...
        </div>
      )}

      {historyError && (
        <div className="text-center text-red-600 py-4">
          <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
          Error: {historyError}
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessionHistory}
            className="ml-2"
          >
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}