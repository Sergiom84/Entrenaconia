import { useState, useCallback } from 'react';

// Hook responsable de gestionar la sesión de rutina:
// - Crear/hidratar sesión
// - Mantener estados locales (modal, índices, progreso)
// - Persistir progreso de ejercicios, completar sesión, feedback
export default function useRoutineSession() {
  const [routineSessionId, setRoutineSessionId] = useState(null);
  const [sessionStartAtMs, setSessionStartAtMs] = useState(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(-1);
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [completedExercises, setCompletedExercises] = useState([]);
  const [sessionExerciseStatuses, setSessionExerciseStatuses] = useState([]);

  // Hidratar sesión desde backend
  const hydrateSession = useCallback(async (sessId, routinePlanId, fetchRoutineStats) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No hay token de autenticación disponible');

    const resp = await fetch(`/api/routines/sessions/${sessId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) {
      if (resp.status === 204) throw new Error('La sesión no está disponible o el plan ha sido archivado');
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Error del servidor (${resp.status})`);
    }

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'No se pudo obtener la sesión');

    const s = data.session;
    const exercises = Array.isArray(s.exercises_data) ? s.exercises_data : [];
    const progressArray = Array.isArray(s.exercises) ? s.exercises : [];
    const completedIdxs = progressArray
      .filter(e => e.status === 'completed')
      .map(e => e.exercise_order);
    const inProgIdx = progressArray.findIndex(e => e.status === 'in_progress');
    const currentIdx = inProgIdx >= 0 ? inProgIdx : -1;

    // Normalizar estados
    const normalizedStatuses = exercises.map((_, idx) => {
      const p = progressArray.find(pe => pe.exercise_order === idx) || {};
      return {
        status: p.status || 'pending',
        series_completed: p.series_completed || 0,
        series_total: p.series_total || 0,
        comment: p.feedback_comment || null,
      };
    });

    const sessionData = {
      metodologia: 'Rutina',
      sesion: { dia: s.day_name, weekNumber: s.week_number },
      weekNumber: s.week_number,
      dayName: s.day_name,
      exercises: exercises.map((ej, idx) => {
        const p = progressArray.find(pe => pe.exercise_order === idx) || {};
        const initialSeries = Math.max(1, Math.min((p.series_completed || 0) + 1, Number(ej.series) || 1));
        return {
          nombre: ej.nombre,
          series: ej.series,
          repeticiones: ej.repeticiones,
          descanso_seg: ej.descanso_seg,
          intensidad: ej.intensidad,
          tempo: ej.tempo || '',
          notas: ej.notas || '',
          initialSeries
        };
      })
    };

    setCurrentSessionData(sessionData);
    setCompletedExercises(completedIdxs);
    setSessionExerciseStatuses(normalizedStatuses);
    setCurrentExerciseIndex(currentIdx);

    const hasActiveProgress = progressArray.some(e => e.status === 'completed' || e.status === 'in_progress');
    setTrainingInProgress(hasActiveProgress);

    if (typeof fetchRoutineStats === 'function' && routinePlanId) {
      await fetchRoutineStats();
    }
  }, []);

  const startTraining = useCallback(async (dayData, routinePlanId, currentWeek, fetchRoutineStats) => {
    if (!dayData || !dayData.dia) throw new Error('Datos del día de entrenamiento no válidos');
    const planId = routinePlanId || Number(localStorage.getItem('currentRoutinePlanId'));
    if (!planId) throw new Error('No se encontró el ID del plan de rutina. Genera un nuevo plan desde Metodologías.');

    const token = localStorage.getItem('token');
    if (!token) throw new Error('No hay sesión activa. Por favor, inicia sesión de nuevo.');

    const requestData = {
      routinePlanId: planId,
      weekNumber: dayData.weekNumber || currentWeek,
      dayName: dayData.dia
    };

    const resp = await fetch('/api/routines/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(requestData)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      if (resp.status === 409) throw new Error('El plan ha sido archivado. Genera un nuevo plan desde Metodologías.');
      if (resp.status === 404) throw new Error(`Plan de rutina no encontrado (ID: ${planId}). Genera un nuevo plan desde Metodologías.`);
      throw new Error(data.error || `Error del servidor (${resp.status}): ${resp.statusText}`);
    }

    const sess = data.session;
    if (!sess || !sess.id) throw new Error('Respuesta del servidor inválida - sesión no creada');

    setRoutineSessionId(sess.id);
    localStorage.setItem('currentRoutineSessionId', String(sess.id));
    const startMs = Date.now();
    setSessionStartAtMs(startMs);
    localStorage.setItem('currentRoutineSessionStartAt', String(startMs));

    await hydrateSession(sess.id, routinePlanId, fetchRoutineStats);
    // Si no hay índice activo aún, arrancar por el primero
    setCurrentExerciseIndex(prev => (prev != null && prev >= 0) ? prev : 0);
    setShowExerciseModal(true);
  }, [hydrateSession]);

  const persistExerciseProgress = useCallback(async ({ exerciseIndex, seriesCompleted, status, timeSpent }) => {
    if (!routineSessionId) return false;
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/routines/sessions/${routineSessionId}/exercise/${exerciseIndex}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ seriesCompleted, status, timeSpent })
    });
    return response.ok;
  }, [routineSessionId]);

  const updateProgress = useCallback(async (exerciseIndex, seriesCompleted, seriesTotal, fetchRoutineStats) => {
    const status = seriesCompleted >= seriesTotal ? 'completed' : 'in_progress';
    const ok = await persistExerciseProgress({ exerciseIndex, seriesCompleted, status });
    if (!ok) return;

    // Actualizar estado local
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      const existing = next[exerciseIndex] || {};
      next[exerciseIndex] = {
        ...existing,
        status,
        series_completed: seriesCompleted,
        series_total: seriesTotal
      };
      return next;
    });

    if (status === 'completed') {
      setCompletedExercises(prev => prev.includes(exerciseIndex) ? prev : [...prev, exerciseIndex]);
      if (typeof fetchRoutineStats === 'function') setTimeout(() => fetchRoutineStats(true), 1000);
    }
  }, [persistExerciseProgress]);

  const completeExercise = useCallback(async (timeSpent, fetchRoutineStats) => {
    const idx = currentExerciseIndex;
    const sc = (currentSessionData?.exercises?.[idx]?.series) || 0;
    await persistExerciseProgress({ exerciseIndex: idx, seriesCompleted: sc, status: 'completed', timeSpent });
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      next[idx] = { ...(next[idx] || {}), status: 'completed', series_completed: sc, series_total: sc };
      return next;
    });
    setCompletedExercises(prev => Array.from(new Set([...prev, idx])));
  }, [currentExerciseIndex, currentSessionData, persistExerciseProgress]);

  const skipExercise = useCallback(async () => {
    const idx = currentExerciseIndex;
    await persistExerciseProgress({ exerciseIndex: idx, seriesCompleted: 0, status: 'skipped' });
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      next[idx] = { ...(next[idx] || {}), status: 'skipped', series_completed: 0 };
      return next;
    });
  }, [currentExerciseIndex, persistExerciseProgress]);

  const cancelExercise = useCallback(async () => {
    const idx = currentExerciseIndex;
    await persistExerciseProgress({ exerciseIndex: idx, seriesCompleted: 0, status: 'cancelled' });
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      next[idx] = { ...(next[idx] || {}), status: 'cancelled', series_completed: 0 };
      return next;
    });
    setShowExerciseModal(false);
  }, [currentExerciseIndex, persistExerciseProgress]);

  const completeSession = useCallback(async (fetchRoutineStats) => {
    if (!routineSessionId) return;
    try {
      const token = localStorage.getItem('token');
      const totalDuration = sessionStartAtMs ? Math.floor((Date.now() - sessionStartAtMs) / 1000) : 0;
      await fetch(`/api/routines/sessions/${routineSessionId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ totalDuration })
      });
      if (typeof fetchRoutineStats === 'function') await fetchRoutineStats(true);
    } catch (e) {
      console.error('Error completando sesión:', e);
    } finally {
      setShowExerciseModal(false);
      setTrainingInProgress(false);
      setCurrentSessionData(null);
      setCurrentExerciseIndex(0);
      setCompletedExercises([]);
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
      alert('¡Felicidades! Has completado tu entrenamiento.');
    }
  }, [routineSessionId, sessionStartAtMs]);

  const value = {
    // state
    routineSessionId,
    sessionStartAtMs,
    showExerciseModal,
    currentExerciseIndex,
    currentSessionData,
    trainingInProgress,
    completedExercises,
    sessionExerciseStatuses,
    // actions
    setShowExerciseModal,
    setCurrentExerciseIndex,
    hydrateSession,
    startTraining,
    updateProgress,
    completeExercise,
    skipExercise,
    cancelExercise,
    completeSession,
    setRoutineSessionId,
    setSessionStartAtMs,
    setCurrentSessionData,
    setTrainingInProgress,
    setSessionExerciseStatuses,
    setCompletedExercises,
  };

  return value;
}

