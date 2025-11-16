/**
 * Servicio para calcular y gestionar estados de sesiones de entrenamiento
 * @module services/sessionStatusService
 */

/**
 * Calcula el estado final de una sesión basado en el estado de sus ejercicios
 * 
 * Estados posibles:
 * - 'scheduled': Sesión programada, no iniciada
 * - 'in_progress': Usuario comenzó pero no terminó
 * - 'completed': TODOS los ejercicios completados
 * - 'partial': Algunos completados, otros saltados/cancelados (usuario finalizó sesión)
 * - 'cancelled': Usuario canceló la sesión completa
 * - 'skipped': Usuario saltó la sesión completa
 * - 'missed': No realizada antes de 23:49h (marcado por job automático)
 * 
 * @param {Array} exercises - Lista de ejercicios con su estado
 * @param {string} exercises[].status - Estado del ejercicio: 'pending', 'in_progress', 'completed', 'skipped', 'cancelled'
 * @param {number} exercises[].series_completed - Series completadas
 * @param {number} exercises[].series_total - Series totales
 * @returns {Object} { status, completionRate, metrics }
 */
export function calculateSessionStatus(exercises) {
  if (!exercises || exercises.length === 0) {
    return {
      status: 'scheduled',
      completionRate: 0.00,
      metrics: {
        total: 0,
        completed: 0,
        skipped: 0,
        cancelled: 0,
        pending: 0,
        inProgress: 0
      }
    };
  }

  const total = exercises.length;
  const completed = exercises.filter(e => 
    String(e.status).toLowerCase() === 'completed'
  ).length;
  const skipped = exercises.filter(e => 
    String(e.status).toLowerCase() === 'skipped'
  ).length;
  const cancelled = exercises.filter(e => 
    String(e.status).toLowerCase() === 'cancelled'
  ).length;
  const pending = exercises.filter(e => 
    String(e.status).toLowerCase() === 'pending'
  ).length;
  const inProgress = exercises.filter(e => 
    String(e.status).toLowerCase() === 'in_progress'
  ).length;

  const completionRate = total > 0 
    ? parseFloat(((completed / total) * 100).toFixed(2))
    : 0.00;

  // 🎯 LÓGICA DE ESTADOS
  let status;

  if (completed === total && total > 0) {
    // Caso 1: TODO completado
    status = 'completed';
  } else if (pending === 0 && inProgress === 0 && total > 0) {
    // Caso 2: No quedan pendientes ni en progreso (todos procesados)
    if (cancelled > 0) {
      // Si hay cancelados, sesión cancelada
      status = 'cancelled';
    } else if (skipped > 0 && completed > 0) {
      // Si hay saltados pero también completados, sesión parcial
      status = 'partial';
    } else if (skipped === total) {
      // Si todos fueron saltados, sesión saltada
      status = 'skipped';
    } else {
      // Edge case: sesión parcial por defecto
      status = 'partial';
    }
  } else if (inProgress > 0 || (completed > 0 && pending > 0)) {
    // Caso 3: Hay ejercicios en progreso o algunos completados con pendientes
    status = 'in_progress';
  } else {
    // Caso 4: Sesión nueva (todos pending)
    status = 'scheduled';
  }

  return {
    status,
    completionRate,
    metrics: {
      total,
      completed,
      skipped,
      cancelled,
      pending,
      inProgress
    }
  };
}

/**
 * Determina si una sesión debe mostrar advertencia de bajo rendimiento
 * @param {number} completionRate - Porcentaje de completitud (0-100)
 * @param {number} threshold - Umbral mínimo (default: 70)
 * @returns {boolean}
 */
export function shouldShowLowCompletionWarning(completionRate, threshold = 70) {
  return completionRate > 0 && completionRate < threshold;
}

/**
 * Calcula el promedio de completion_rate de las últimas N sesiones
 * @param {Array} sessions - Lista de sesiones con completion_rate
 * @param {number} limit - Número de sesiones a considerar (default: 3)
 * @returns {number} Promedio de completion_rate
 */
export function calculateAverageCompletion(sessions, limit = 3) {
  if (!sessions || sessions.length === 0) return 0;

  const recentSessions = sessions
    .filter(s => s.completion_rate != null)
    .slice(0, limit);

  if (recentSessions.length === 0) return 0;

  const sum = recentSessions.reduce((acc, s) => acc + parseFloat(s.completion_rate), 0);
  return parseFloat((sum / recentSessions.length).toFixed(2));
}

/**
 * Determina si se debe enviar alerta de bajo rendimiento consistente
 * @param {Array} sessions - Lista de sesiones recientes
 * @param {number} threshold - Umbral mínimo (default: 70)
 * @param {number} consecutiveCount - Número de sesiones consecutivas (default: 3)
 * @returns {Object} { shouldAlert, averageCompletion, sessionsAnalyzed }
 */
export function checkLowPerformancePattern(sessions, threshold = 70, consecutiveCount = 3) {
  const avgCompletion = calculateAverageCompletion(sessions, consecutiveCount);
  const shouldAlert = avgCompletion > 0 && avgCompletion < threshold;

  return {
    shouldAlert,
    averageCompletion: avgCompletion,
    sessionsAnalyzed: Math.min(sessions.length, consecutiveCount),
    threshold
  };
}

