/**
 * 🎯 TodayTrainingTab - Version Final Consolidada
 *
 * CAMBIOS CRÍTICOS:
 * ✅ Estado de sesión desde BD (no localStorage)
 * ✅ useWorkout refactorizado sin localStorage
 * ✅ Progreso real-time desde Supabase
 * ✅ Sincronización automática
 * ✅ Estado persistente entre dispositivos
 * ✅ PROBLEMA DE HOOKS RESUELTO - Sin returns tempranos problemáticos
 *
 * @version 3.0.0 - Consolidación Final
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Card } from '@/components/ui/card.jsx';

import {
  RefreshCw,
  Calendar,
  AlertTriangle,
  Dumbbell,
  Clock,
  Target,
  Play
} from 'lucide-react';

import RoutineSessionModal from '../RoutineSessionModal';
import WarmupModal from '../WarmupModal';
import { useWorkout } from '@/contexts/WorkoutContext'; // Mantenemos el contexto original
import apiClient from '@/lib/apiClient';

import SafeComponent from '../../ui/SafeComponent';
import { useTrace } from '@/contexts/TraceContext.jsx';
import { ExerciseListItem } from '../summary/ExerciseListItem.jsx';
import { SummaryHeader } from '../summary/SummaryHeader.jsx';
import { UserProfileDisplay } from '../summary/UserProfileDisplay.jsx';
import { ProgressBar } from '../summary/ProgressBar.jsx';



// ===============================================
// 🎯 HELPER FUNCTIONS
// ===============================================

function getTodayName() {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[new Date().getDay()];
}

// Compute day_id from plan start datetime and timezone (calendar days, 1-indexed)
function computeDayId(startISO, timezone = 'Europe/Madrid', now = new Date()) {
  try {
    const getParts = (d, tz) => {
      const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      const [y, m, dd] = s.split('-').map(Number);
      return { y, m, d: dd };
    };
    const s = getParts(new Date(startISO), timezone);
    const n = getParts(now, timezone);
    const startUTC = Date.UTC(s.y, s.m - 1, s.d);
    const nowUTC = Date.UTC(n.y, n.m - 1, n.d);
    const diffDays = Math.floor((nowUTC - startUTC) / 86400000) + 1;
    return Math.max(1, diffDays);
  } catch (e) {
    // Fallback simple sin timezone
    const start = new Date(startISO);
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const current = new Date();
    const currentDateOnly = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    const diffDays = Math.floor((currentDateOnly - startDateOnly) / 86400000) + 1;
    return Math.max(1, diffDays);
  }
}

function findTodaySession(plan, targetDay, weekIdx = 0) {
  const semanas = plan?.semanas;
  if (!Array.isArray(semanas) || semanas.length === 0) return null;

  const safeWeekIdx = Math.max(0, Math.min(weekIdx, semanas.length - 1));
  const week = semanas[safeWeekIdx];
  if (!week?.sesiones) return null;

  return week.sesiones.find((sesion) => sesion.dia?.toLowerCase() === targetDay?.toLowerCase()) || null;
}

export default function TodayTrainingTab({
  routinePlan,
  routinePlanId,
  methodologyPlanId,
  planStartDate,
  todayName,
  onProgressUpdate,
  onStartTraining
}) {
  const { track } = useTrace();

  // ===============================================
  // 🚀 WORKOUT CONTEXT
  // ===============================================

  const {
    // Estado desde BD (mejorado)
    plan,
    session,
    ui,

    // Acciones principales
    startSession,
    completeSession,
    updateExercise,

    // Modales
    showModal,
    hideModal,

    // Utilidades basadas en BD
    hasActivePlan,
    hasActiveSession,
    isTraining,

    // Funciones adicionales
    setLoading,
    setError,
    showSuccess,
    goToMethodologies,
    cancelPlan,

    // Cache compartida
    getTodayStatusCached
  } = useWorkout();

  // ===============================================
  // 🎯 ESTADO LOCAL
  // ===============================================

  const [localState, setLocalState] = useState({
    showSessionModal: false,
    showWarmupModal: false,
    showRejectionModal: false,
    pendingSessionData: null,
    planExercises: [],
    loadingExercises: false
  });

  const [todaySessionData, setTodaySessionData] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseProgress, setExerciseProgress] = useState({});
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isStarting, setIsStarting] = useState(false); // Prevenir doble click
  const [sessionError, setSessionError] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [loadingTodayStatus, setLoadingTodayStatus] = useState(false);

  // Nombre del día actual disponible para hooks que lo requieren
  const currentTodayName = todayName || getTodayName();


  const fetchTodayStatus = useCallback(async () => {
    const currentMethodologyPlanId = methodologyPlanId || plan.methodologyPlanId;
    if (!hasActivePlan || !currentMethodologyPlanId) return;

    setLoadingTodayStatus(true);
    try {
      const startISO = (plan.planStartDate || planStartDate || new Date().toISOString());
      const dayId = computeDayId(startISO, 'Europe/Madrid');
      const data = await getTodayStatusCached({ methodologyPlanId: currentMethodologyPlanId, dayId });
      if (data?.success) {
        setTodayStatus({ session: data.session, exercises: data.exercises, summary: data.summary });
      }
    } catch (e) {
      console.error('Error obteniendo estado del día:', e);
    } finally {
      setLoadingTodayStatus(false);
    }
  }, [methodologyPlanId, plan.planId, plan.planStartDate, planStartDate, hasActivePlan, getTodayStatusCached]);


  const mountedRef = useRef(true);

  const updateLocalState = (updates) => {
    setLocalState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ===============================================
  // 🔄 SINCRONIZACIÓN CON BD
  // ===============================================

  useEffect(() => {
    // Usar el plan de props si existe, sino el del contexto
    const effectivePlan = routinePlan || plan.currentPlan;

    console.log('🔍 DEBUG TodayTrainingTab - Estado inicial:', {
      hasActivePlan,
      effectivePlan: effectivePlan,
      currentTodayName,
      routinePlan: routinePlan,
      planFromContext: plan.currentPlan
    });

    if (hasActivePlan && effectivePlan) {
      // Calcular dayId y semana actual a partir de la fecha de inicio del plan
      const startISO = (plan.planStartDate || planStartDate || new Date().toISOString());
      const dayId = computeDayId(startISO, 'Europe/Madrid');
      const currentWeekIdx = Math.max(0, Math.ceil(dayId / 7) - 1);

      const sessionData = findTodaySession(effectivePlan, currentTodayName, currentWeekIdx);
      console.log('🔍 DEBUG sessionData encontrada:', {
        sessionData,
        todayName: currentTodayName,
        currentWeekIdx,
        dayId,
        ejercicios: sessionData?.ejercicios,
        cantidadEjercicios: sessionData?.ejercicios?.length
      });
      setTodaySessionData(sessionData);

      // Si hay sesión activa, cargar estado desde contexto
      if (hasActiveSession && session.sessionId) {
        setCurrentExerciseIndex(session.currentExerciseIndex || 0);
        setSessionStartTime(session.sessionStarted ? new Date(session.sessionStarted) : null);

        // Cargar progreso de ejercicios desde BD
        loadExerciseProgress();
      }
    }
  }, [hasActivePlan, routinePlan, plan.currentPlan, currentTodayName, hasActiveSession, session, plan.planStartDate, planStartDate]);

  const loadExerciseProgress = useCallback(async () => {
    if (!session.sessionId) return;

    console.log('🔍 DEBUG loadExerciseProgress: TEMPORALMENTE DESHABILITADO para evitar 404');
    // TEMPORALMENTE COMENTADO PARA EVITAR ERROR 404
    // TODO: Implementar endpoint /api/training-session/progress/:sessionId en backend
    /*

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
    */
  }, [session.sessionId]);

  // ===============================================
  // 🏃 HANDLERS DE SESIÓN
  // ===============================================


  // Refrescar resumen del día al cambiar estado de sesión o cerrar el modal
  useEffect(() => {
    if (!hasActivePlan) return;
    fetchTodayStatus();
  }, [hasActivePlan, currentTodayName, session.status, localState.showSessionModal, fetchTodayStatus]);

  const handleStartSession = useCallback(async (exerciseIndex = 0) => {
    // 🚫 Prevenir doble ejecución
    if (isStarting || isLoadingSession) {
      console.log('⚠️ handleStartSession ya en progreso, evitando doble ejecución');
      return;
    }

    track('BUTTON_CLICK', { id: 'start_session', exerciseIndex }, { component: 'TodayTrainingTab' });

    // 🎯 NUEVA LÓGICA: Verificar si realmente debe reanudar usando backend
    if (!todaySessionData) {
      console.log('⚠️ No hay datos de sesión de hoy');
      return;
    }

    // Si el backend dice que debe reanudar, usar handleResumeSession en su lugar
    if (shouldResume) {
      console.log('🔄 Redirigiendo a reanudar sesión');
      handleResumeSession();
      return;
    }

    // Validaciones iniciales
    if (!todaySessionData?.ejercicios || todaySessionData.ejercicios.length === 0) {
      setError('La sesión de hoy no tiene ejercicios definidos');
      return;
    }

    if (!methodologyPlanId) {
      setError('No se puede iniciar sesión: falta información del plan');
      return;
    }

    // ✅ Pre-check robusto: si existe sesión hoy y NO debemos reanudar, abrir Warmup y evitar /start
    {
      const existingSid = todayStatus?.session?.id;
      const neverStarted = todayStatus?.session?.session_started_at == null;
      const shouldOpenWarmup = (!!existingSid && !shouldResume) || neverStarted;
      if (shouldOpenWarmup && existingSid) {
        updateLocalState({
          pendingSessionData: {
            session: { ...todaySessionData, sessionId: existingSid },
            sessionId: existingSid
          },
          showWarmupModal: true
        });
        return;
      }
    }

    setIsLoadingSession(true);
    setIsStarting(true); // 🔒 Bloquear nuevas ejecuciones
    setSessionError(null);

    try {
      console.log('🏃 Iniciando sesión de hoy:', todaySessionData);

      const startISO = (plan.planStartDate || planStartDate || new Date().toISOString());
      const dayId = computeDayId(startISO, 'Europe/Madrid');
      const result = await startSession({
        planId: methodologyPlanId,
        dayId,
        dayInfo: todaySessionData,
        exerciseIndex
      });

      if (result.success) {
        setSessionStartTime(new Date());
        setCurrentExerciseIndex(exerciseIndex);
        setExerciseProgress({});

        // Configurar datos de sesión para el modal
        const enrichedSession = {
          ...todaySessionData,
          sessionId: result.sessionId,
          currentExerciseIndex: Math.max(0, Math.min(exerciseIndex, (todaySessionData?.ejercicios?.length || 1) - 1)),
          exerciseProgress: sessionExerciseProgress
        };

        // Guardar datos de sesión para después del calentamiento
        updateLocalState({
          pendingSessionData: {
            session: enrichedSession,
            sessionId: result.sessionId || result.session_id || session.sessionId
          },
          showWarmupModal: true
        });

        track('SESSION_START', {
          sessionId: result.sessionId,
          totalExercises: todaySessionData?.ejercicios?.length || 0,
          startingAt: exerciseIndex
        });

        // Opcional: Callback para notificar al componente padre
        if (onStartTraining) {
          onStartTraining();
        }
      } else {
        throw new Error(result.error || 'Error iniciando la sesión');
      }

    } catch (error) {
      console.error('Error iniciando sesión de hoy:', error);

      // 🎯 MANEJO ESPECIAL: Sesión ya existente
      {
        const existingSid = todayStatus?.session?.id;
        const sid = error?.data?.session_id || existingSid;
        const msg = String(error?.message || '').toLowerCase();
        if ((error?.status === 400 && sid) || (msg.includes('ya existe una sesión activa') && sid)) {
          console.log('🔄 Sesión existente detectada, usando session_id y mostrando WarmupModal...');
          updateLocalState({
            pendingSessionData: {
              session: { ...todaySessionData, sessionId: sid },
              sessionId: sid
            },
            showWarmupModal: true
          });
          return;
        }
      }

      setSessionError(error.message);
      setError(`Error al iniciar la sesión: ${error.message}`);
    } finally {
      setIsLoadingSession(false);
      setIsStarting(false); // 🔓 Desbloquear
    }
  }, [todaySessionData, hasActiveSession, startSession, methodologyPlanId, currentTodayName, session.sessionId, track, onStartTraining, setError, isStarting, isLoadingSession]);

  const handleResumeSession = useCallback(() => {
    track('BUTTON_CLICK', { id: 'resume_session' }, { component: 'TodayTrainingTab' });

    // Si no hay sesión activa aún, inicia el flujo normal (abrirá WarmupModal)
    if (!hasActiveSession) {
      handleStartSession(currentExerciseIndex || 0);
      return;
    }

    // Con sesión activa: abrir directamente el modal de sesión (saltamos calentamiento)
    const sid = session.sessionId || localState.pendingSessionData?.sessionId;
    if (!sid) {
      setError('No se pudo reanudar: falta sessionId');
      return;
    }

    const baseSession = todaySessionData || findTodaySession(routinePlan || plan.currentPlan, currentTodayName) || {};

    updateLocalState({
      pendingSessionData: {
        session: {
          ...baseSession,
          sessionId: sid,
          currentExerciseIndex: session.currentExerciseIndex || 0,
          exerciseProgress: sessionExerciseProgress
        },
        sessionId: sid
      },
      showWarmupModal: false,
      showSessionModal: true
    });
  }, [hasActiveSession, handleStartSession, currentExerciseIndex, session.sessionId, session.currentExerciseIndex, localState.pendingSessionData?.sessionId, todaySessionData, routinePlan, plan.currentPlan, currentTodayName, setError, track]);

  const handleCompleteSession = useCallback(async () => {
    const sid = localState.pendingSessionData?.sessionId || session.sessionId;
    if (!sid) return;

    try {
      let ok = false;

      if (hasActiveSession) {
        const result = await completeSession();
        ok = !!result?.success;
      } else {
        // Fallback cuando el contexto no tiene sessionId activo
        await apiClient.post(`/training-session/complete/methodology/${sid}`, {
          completedAt: new Date().toISOString()
        });
        ok = true;
      }

      if (ok) {
        setSessionStartTime(null);
        setCurrentExerciseIndex(0);
        setExerciseProgress({});

        // Limpiar estado del modal
        updateLocalState({
          showSessionModal: false,
          pendingSessionData: null
        });

        track('SESSION_COMPLETE', {
          sessionId: sid,
          duration: sessionStartTime ? Date.now() - sessionStartTime.getTime() : 0,
          exercisesCompleted: Object.keys(exerciseProgress).length
        });

        if (typeof onProgressUpdate === 'function') {
          onProgressUpdate();
        }

        showSuccess('¡Entrenamiento completado exitosamente!');
      } else {
        throw new Error('Error finalizando la sesión');
      }

    } catch (error) {
      console.error('Error completando sesión:', error);
      setError(`Error finalizando sesión: ${error.message}`);
    }
  }, [hasActiveSession, completeSession, session.sessionId, sessionStartTime, exerciseProgress, track, onProgressUpdate, showSuccess, setError, localState.pendingSessionData?.sessionId]);

  const handleExerciseUpdate = useCallback(async (exerciseIndex, progressData) => {
    // Actualizar estado local
    setExerciseProgress(prev => ({
      ...prev,
      [exerciseIndex]: progressData
    }));

    const sid = localState.pendingSessionData?.sessionId || session.sessionId;
    const payload = {
      status: progressData.status || 'completed',
      series_completed: Math.max(0, parseInt(progressData.series_completed ?? progressData.seriesCompleted) || 0),
      time_spent_seconds: Math.max(0, parseInt(progressData.time_spent_seconds ?? progressData.timeSpent) || 0)
    };

    try {
      let ok = false;

      if (session.sessionId) {
        const result = await updateExercise(exerciseIndex, payload);
        ok = !!result?.success;
      } else if (sid) {
        await apiClient.put(`/routines/sessions/${sid}/exercise/${exerciseIndex}`, payload);
        ok = true;
      }

      if (ok) {
        // Si el ejercicio se completó, avanzar al siguiente
        if ((progressData.status || 'completed') === 'completed') {
          const nextIndex = exerciseIndex + 1;
          if (nextIndex < (todaySessionData?.ejercicios?.length || 0)) {
            setCurrentExerciseIndex(nextIndex);
          }
        }
        // Notificar al padre para refrescar calendario/progreso
        if (typeof onProgressUpdate === 'function') {
          onProgressUpdate();
        }
      }
    } catch (error) {
      console.error('Error actualizando ejercicio:', error);
      setError(`Error actualizando ejercicio: ${error.message}`);
    }
  }, [updateExercise, todaySessionData?.ejercicios?.length, setError, onProgressUpdate, session.sessionId, localState.pendingSessionData?.sessionId]);

  // Handlers de calentamiento
  const handleWarmupComplete = async () => {
    track('BUTTON_CLICK', { id: 'warmup_complete' }, { component: 'TodayTrainingTab' });

    const pendingId = localState.pendingSessionData?.sessionId || session.sessionId;
    if (!pendingId) return;

    // Marcar inicio real de la sesión en backend (idempotente)
    try {
      await apiClient.post(`/routines/sessions/${pendingId}/mark-started`);
    } catch (e) {
      console.warn('mark-started fallo (no bloqueante):', e?.message || e);
    }

    updateLocalState({
      showWarmupModal: false,
      showSessionModal: true
    });

    setTimeout(() => {
      updateLocalState(prev => ({ ...prev, showSessionModal: true }));
    }, 0);
  };

  const handleSkipWarmup = () => {
    track('BUTTON_CLICK', { id: 'warmup_skip' }, { component: 'TodayTrainingTab' });

    const pendingId = localState.pendingSessionData?.sessionId || session.sessionId;
    if (!pendingId) return;

    updateLocalState({
      showWarmupModal: false,
      showSessionModal: true
    });

    setTimeout(() => {
      updateLocalState(prev => ({ ...prev, showSessionModal: true }));
    }, 0);
  };

  const handleCloseWarmup = () => {
    track('BUTTON_CLICK', { id: 'warmup_close' }, { component: 'TodayTrainingTab' });

    updateLocalState({
      showWarmupModal: false,
      pendingSessionData: null
    });
  };

  // Handler para cancelar rutina
  const handleCancelPlan = useCallback(async () => {
    track('BUTTON_CLICK', { id: 'cancel_plan_confirm' }, { component: 'TodayTrainingTab' });

    try {
      setLoading(true);
      const result = await cancelPlan();

      if (result.success) {
        updateLocalState({ showRejectionModal: false });
        showSuccess('Rutina cancelada exitosamente');
        // Redirigir a metodologías después de un breve delay
        setTimeout(() => {
          goToMethodologies();
        }, 1500);
      } else {
        throw new Error(result.error || 'Error cancelando la rutina');
      }
    } catch (error) {
      console.error('Error cancelando rutina:', error);
      setError(`Error cancelando rutina: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [cancelPlan, setLoading, showSuccess, setError, goToMethodologies, track]);

  const handleCloseCancelModal = () => {
    track('BUTTON_CLICK', { id: 'cancel_plan_close' }, { component: 'TodayTrainingTab' });
    updateLocalState({ showRejectionModal: false });
  };

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

  // Progreso por ejercicio que usará el modal para saltar completados
  const sessionExerciseProgress = useMemo(() => {
    // Fuente preferente: todayStatus.exercises (estructura del backend)
    if (Array.isArray(todayStatus?.exercises) && todayStatus.exercises.length > 0) {
      return todayStatus.exercises.map((ex, idx) => ({
        exercise_order: idx,
        status: String(ex?.status || 'pending').toLowerCase()
      }));
    }

    // Fallback: estado local exerciseProgress
    if (todaySessionData?.ejercicios?.length) {
      return todaySessionData.ejercicios.map((_, idx) => ({
        exercise_order: idx,
        status: String(exerciseProgress?.[idx]?.status || 'pending').toLowerCase()
      }));
    }

    return [];
  }, [todayStatus?.exercises, exerciseProgress, todaySessionData?.ejercicios]);


  // 🎯 NUEVA LÓGICA: Usar canResume del backend en lugar de calcular localmente
  const shouldResume = useMemo(() => {
    // 1. Prioridad: Usar la decisión inteligente del backend
    if (todayStatus?.session?.canResume !== undefined) {
      return todayStatus.session.canResume;
    }

    // 2. Fallback: Si no hay respuesta del backend, calcular localmente
    if (Array.isArray(todayStatus?.exercises)) {
      return todayStatus.exercises.some((ex) => {
        const s = String(ex?.status || 'pending').toLowerCase();
        return s !== 'pending';
      });
    }
    return Object.values(exerciseProgress || {}).some((p) => {
      const s = String(p?.status || 'pending').toLowerCase();
      return s !== 'pending';
    });
  }, [todayStatus?.session?.canResume, todayStatus?.exercises, exerciseProgress]);

  // Índice recomendado para reanudar (primer ejercicio pendiente)
  const nextPendingIndex = useMemo(() => {
    if (Array.isArray(todayStatus?.exercises) && todayStatus.exercises.length > 0) {
      const idx = todayStatus.exercises.findIndex((ex) => String(ex?.status || 'pending').toLowerCase() === 'pending');
      return idx >= 0 ? idx : 0;
    }
    if (todaySessionData?.ejercicios?.length) {
      for (let i = 0; i < todaySessionData.ejercicios.length; i++) {
        const s = String(exerciseProgress?.[i]?.status || 'pending').toLowerCase();
        if (s === 'pending') return i;
      }
    }
    return 0;
  }, [todayStatus?.exercises, exerciseProgress, todaySessionData?.ejercicios?.length]);

  // Cuando no hay sesión activa, preparar el índice para reanudar
  useEffect(() => {
    if (!hasActiveSession) {
      setCurrentExerciseIndex(nextPendingIndex);
    }
  }, [hasActiveSession, nextPendingIndex]);


  const actualDuration = useMemo(() => {
    if (!sessionStartTime) return 0;
    return Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
  }, [sessionStartTime]);

  // Estados para mostrar el entrenamiento de hoy
  // ✅ CORREGIDO: Verificar tanto contexto como backend para sesión completada
  const hasCompletedSession = session.status === 'completed' ||
                              todayStatus?.session?.session_status === 'completed' ||
                              todayStatus?.summary?.isComplete === true;
  const isRestDay = hasActivePlan && !todaySessionData;
  const noActivePlan = !hasActivePlan;
  const sessionMatchesToday = hasActiveSession && !!session?.dayName && !!todaySessionData?.dia && (
    session.dayName.toLowerCase() === todaySessionData.dia.toLowerCase()
  );

  const hasToday = Boolean(todaySessionData?.ejercicios?.length > 0);

  // Progreso para header (completados/total/skip/cancel)
  const headerProgressStats = useMemo(() => {
    const total = (todaySessionData?.ejercicios?.length) || (todayStatus?.summary?.total) || 0;
    let completed = 0, skipped = 0, cancelled = 0;

    if (Array.isArray(todayStatus?.exercises)) {
      for (const ex of todayStatus.exercises) {
        const s = String(ex?.status || '').toLowerCase();
        if (s === 'completed') completed++;
        else if (s === 'skipped') skipped++;
        else if (s === 'cancelled') cancelled++;
      }
    } else if (exerciseProgress && typeof exerciseProgress === 'object') {
      for (const p of Object.values(exerciseProgress)) {
        const s = String(p?.status || '').toLowerCase();
        if (s === 'completed') completed++;
        else if (s === 'skipped') skipped++;
        else if (s === 'cancelled') cancelled++;
      }
    }

    // Fallback a summary si existe (prioriza datos de backend)
    if (todayStatus?.summary) {
      completed = todayStatus.summary.completed ?? completed;
      skipped = todayStatus.summary.skipped ?? skipped;
      cancelled = todayStatus.summary.cancelled ?? cancelled;
    }

    return { completed, total, skipped, cancelled };
  }, [todayStatus?.exercises, todayStatus?.summary, exerciseProgress, todaySessionData?.ejercicios?.length]);

  // 🔍 DEBUG: Verificar qué está pasando antes del render
  console.log('🔍 DEBUG TodayTrainingTab SECTIONS:', {
    // Condiciones principales
    hasActivePlan,
    hasToday,
    hasCompletedSession,
    todayStatus: !!todayStatus,

    // Sección 1: Sesión NO completada
    showSection1: hasToday && hasActivePlan && !hasCompletedSession,

    // Sección 2: Sesión SÍ completada
    showSection2: hasActivePlan && hasToday && hasCompletedSession && todayStatus,

    // Estados para debug
    sessionStatus: session.status,
    todayStatusSessionStatus: todayStatus?.session?.session_status,
    todayStatusIsComplete: todayStatus?.summary?.isComplete
  });

  const wantRoutineModal = localState.showSessionModal || ui.showRoutineSession || ui.showSession;
  const effectiveSession = localState.pendingSessionData?.session || (
    wantRoutineModal && (session.sessionId || localState.pendingSessionData?.sessionId) && todaySessionData
      ? {
          ...todaySessionData,
          sessionId: session.sessionId || localState.pendingSessionData?.sessionId,
          currentExerciseIndex: localState.pendingSessionData?.session?.currentExerciseIndex || 0,
          exerciseProgress: sessionExerciseProgress
        }
      : null
  );
  const effectiveSessionId = localState.pendingSessionData?.sessionId || session.sessionId;

  // ===============================================
  // 🎨 RENDER - SIN RETURNS TEMPRANOS PROBLEMÁTICOS
  // ===============================================

  return (
    <SafeComponent fallback={<div>Error cargando entrenamiento de hoy</div>}>
      <div className="space-y-6">
        {/* =============================================== */}
        {/* 🎯 ESTADOS DE CARGA Y ERROR - INLINE */}
        {/* =============================================== */}

        {ui.isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin mr-2" />
            <span className="text-gray-400">Cargando sesión de hoy...</span>
          </div>
        )}

        {ui.error && (
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
        )}

        {/* =============================================== */}
        {/* 🎯 HEADER CON ESTADO ACTUAL */}
        {/* =============================================== */}

        {!ui.isLoading && !ui.error && (
          <>
            {/* Solo mostrar header completo si hay plan activo */}
            {hasActivePlan && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Entrenamiento de Hoy
                    </h2>
                    <p className="text-gray-400">
                      {new Date().toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Header enriquecido con metodología, fuente, perfil y progreso */}
                <section className="mt-4">
                  <SummaryHeader plan={plan?.currentPlan || plan} session={session} planSource={{ label: 'OpenAI' }} />
                  <UserProfileDisplay />
                  <ProgressBar progressStats={headerProgressStats} />
                </section>
              </>
            )}


            {/* =============================================== */}
            {/* 🏃 SESIÓN ACTIVA */}
            {/* =============================================== */}


            {/* =============================================== */}
            {/* 📋 SESIÓN DEL DÍA (NO INICIADA) */}
            {/* =============================================== */}

            {hasToday && hasActivePlan && !hasCompletedSession && (
              <section>

                <div className="text-center py-6">
                  <Dumbbell className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Entrenamiento de hoy: {todaySessionData?.dia || 'Sin información'}
                  </h3>
                  <p className="text-gray-400 mb-4">
                    {todaySessionData?.ejercicios?.length || 0} ejercicios programados
                  </p>
                  {/* Decidir si debemos reanudar (hay sesión activa o ya hay ejercicios realizados) */}
                  <Button
                    onClick={() => (shouldResume ? handleResumeSession() : handleStartSession(0))}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                    disabled={ui.isLoading || isLoadingSession || isStarting}
                  >
                    {isLoadingSession ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        {shouldResume ? 'Reanudar Entrenamiento' : 'Comenzar Entrenamiento'}
                      </>
                    )}
                  </Button>
                </div>

                {/* Lista de ejercicios */}
                {todaySessionData?.ejercicios && todaySessionData.ejercicios.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          Sesión de {currentTodayName}
                        </h3>
                        <p className="text-gray-400 mt-1">
                          {todaySessionData.ejercicios.length} ejercicios programados
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>~{Math.round(estimatedDuration / 60)}min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          <span>{plan.methodologyType || 'Rutina'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {todaySessionData.ejercicios.map((ejercicio, index) => {
                        const status = (() => {
                          if (todayStatus?.exercises?.[index]?.status) return String(todayStatus.exercises[index].status).toLowerCase();
                          if (exerciseProgress[index]?.status) return String(exerciseProgress[index].status).toLowerCase();
                          if (hasActiveSession && (session.currentExerciseIndex === index)) return 'in_progress';
                          return 'pending';
                        })();
                        const ex = { ...ejercicio, status, exercise_name: ejercicio.nombre, series_total: ejercicio.series };
                        return (
                          <ExerciseListItem key={index} exercise={ex} index={index} />
                        );
                      })}
                    </div>
                  </Card>
                )}
              </section>
            )}



                {/* Resumen de sesión completada */}
                {hasActivePlan && hasToday && hasCompletedSession && todayStatus && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-semibold text-white">Resumen de hoy ({currentTodayName})</h3>
                        <p className="text-gray-400 mt-1">
                          {todayStatus.summary.completed} completados · {todayStatus.summary.skipped} saltados · {todayStatus.summary.total} ejercicios
                        </p>
                      </div>
                      <div className="text-sm text-gray-400">
                        Duración total: {todayStatus.session?.total_duration_seconds ? Math.round((todayStatus.session.total_duration_seconds + (todayStatus.session.warmup_time_seconds || 0)) / 60) : 0} min
                      </div>
                    </div>

                    <div className="space-y-2">
                      {todayStatus.exercises.map((ex, index) => (
                        <ExerciseListItem key={index} exercise={ex} index={index} />
                      ))}
                    </div>
                  </Card>
                )}



            {/* =============================================== */}
            {/* ❌ NO HAY PLAN ACTIVO */}
            {/* =============================================== */}

            {noActivePlan && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No hay rutina programada
                </h3>
                <p className="text-gray-400 mb-6">
                  No tienes ninguna rutina activa. Ve a metodologías para crear una nueva rutina.
                </p>
              </div>
            )}

            {/* =============================================== */}
            {/* 🛌 DÍA DE DESCANSO */}
            {/* =============================================== */}

            {hasActivePlan && !hasToday && !sessionMatchesToday && !hasCompletedSession && (
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

            {/* =============================================== */}
            {/* ⚠️ ERRORES Y ALERTAS */}
            {/* =============================================== */}

            {sessionError && (
              <Alert className="border-red-200 bg-red-50/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  <strong>Error de sesión:</strong> {sessionError}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSessionError(null)}
                    className="ml-2 text-red-400 hover:text-red-300"
                  >
                    Cerrar
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Botones de acción - Solo mostrar si hay plan activo */}
            {hasActivePlan && (
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
            )}

          </>
        )}

      {/* =============================================== */}
      {/* 🎭 MODALES (fuera de gating de loading/error para no bloquear apertura) */}
      {/* =============================================== */}

      {/* Modal de Calentamiento */}
      {(localState.showWarmupModal || ui.showWarmup) && (localState.pendingSessionData?.sessionId || session.sessionId) && (
        <WarmupModal
          level={(routinePlan || plan.currentPlan)?.level || 'básico'}
          sessionId={localState.pendingSessionData?.sessionId || session.sessionId}
          onComplete={handleWarmupComplete}
          onSkip={handleSkipWarmup}
          onClose={handleCloseWarmup}
        />
      )}

      {/* Modal de Entrenamiento */}
      {(localState.showSessionModal || ui.showRoutineSession) && effectiveSession && (
        <RoutineSessionModal
          session={effectiveSession}
          sessionId={effectiveSessionId}
          onClose={() => {
            updateLocalState({ showSessionModal: false, pendingSessionData: null });
            ui.hideModal?.('routineSession');
          }}
          onFinishExercise={handleExerciseUpdate}
          onSkipExercise={(exerciseIndex) => handleExerciseUpdate(exerciseIndex, { status: 'skipped' })}
          onCancelExercise={(exerciseIndex) => handleExerciseUpdate(exerciseIndex, { status: 'cancelled' })}
          onEndSession={handleCompleteSession}
          navigateToRoutines={() => goToTraining()}
          onProgressUpdate={onProgressUpdate}
        />
      )}

      {/* Modal de Confirmación de Cancelación */}
      {localState.showRejectionModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100/10 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">
                ¿Cancelar rutina actual?
              </h3>

              <p className="text-gray-400 mb-6">
                Esta acción cancelará tu rutina activa. El progreso realizado se conservará en tu historial,
                pero tendrás que crear una nueva rutina para continuar entrenando.
              </p>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleCloseCancelModal}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  disabled={ui.isLoading}
                >
                  Mantener rutina
                </Button>

                <Button
                  onClick={handleCancelPlan}
                  className="bg-red-500 hover:bg-red-600 text-white"
                  disabled={ui.isLoading}
                >
                  {ui.isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Cancelando...
                    </>
                  ) : (
                    'Sí, cancelar rutina'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </SafeComponent>
  );
}