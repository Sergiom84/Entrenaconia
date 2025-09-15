// Capa ligera de API para Rutinas (metodologías)
import apiClient from '../../lib/apiClient.js';

// Función helper para obtener token
const getToken = () => apiClient.getAuthToken();

export async function getPlan({ id, type }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/plan?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo cargar el plan');
  return data.plan;
}

export async function bootstrapPlan(routine_plan_id) {
  const token = getToken();
  const resp = await fetch('/api/routines/bootstrap-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ routine_plan_id })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo preparar el plan');
  return data.methodology_plan_id;
}

export async function startSession({ methodology_plan_id, week_number, day_name }) {
  const token = getToken();
  const resp = await fetch('/api/routines/sessions/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ methodology_plan_id, week_number, day_name })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo iniciar la sesión');
  return data; // { session_id, total_exercises }
}

export async function updateExercise({ sessionId, exerciseOrder, series_completed, status, time_spent_seconds }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/sessions/${sessionId}/exercise/${exerciseOrder}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ series_completed, status, time_spent_seconds })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar el ejercicio');
  return data;
}

export async function finishSession(sessionId) {
  const token = getToken();
  const resp = await fetch(`/api/routines/sessions/${sessionId}/finish`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo finalizar la sesión');
  return data;
}

export async function getSessionProgress(sessionId) {
  const token = getToken();
  const resp = await fetch(`/api/routines/sessions/${sessionId}/progress`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo cargar el progreso');
  return data; // { session, exercises, summary }
}

export async function confirmRoutinePlan({ methodology_plan_id, routine_plan_id }) {
  const token = getToken();
  const resp = await fetch('/api/routines/confirm-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ methodology_plan_id, routine_plan_id })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo confirmar la rutina');
  return data; // { success, confirmed_at, status, etc }
}

export async function getTodaySessionStatus({ methodology_plan_id, week_number, day_name, session_date }) {
  const token = getToken();
  
  // Construir query parameters
  const params = new URLSearchParams({
    methodology_plan_id,
    week_number,
    day_name
  });
  
  // Agregar session_date si se proporciona
  if (session_date) {
    params.set('session_date', session_date);
  }
  
  const resp = await fetch(`/api/routines/sessions/today-status?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) {
    if (resp.status === 404) return null; // No hay sesión para hoy
    throw new Error(data.error || 'No se pudo obtener el estado de la sesión');
  }
  return data; // { session, exercises, summary }
}

export async function getProgressData({ methodology_plan_id }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/progress-data?methodology_plan_id=${encodeURIComponent(methodology_plan_id)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudieron cargar los datos de progreso');
  return data.data; // Datos de progreso histórico
}

export async function getActivePlan() {
  const token = getToken();
  const resp = await fetch('/api/routines/active-plan', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo obtener la rutina activa');
  return data; // { hasActivePlan, routinePlan, planSource, planId, methodology_plan_id }
}

export async function saveExerciseFeedback({ sessionId, exerciseOrder, sentiment, comment, exerciseName }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/sessions/${sessionId}/exercise/${exerciseOrder}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sentiment, comment, exerciseName })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo guardar el feedback');
  return data.feedback;
}

export async function getSessionFeedback({ sessionId }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/sessions/${sessionId}/feedback`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo cargar el feedback');
  return data.feedback;
}

export async function getPlanStatus({ methodologyPlanId }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/plan-status/${methodologyPlanId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo verificar el estado del plan');
  return data; // { isConfirmed, status, confirmedAt }
}

export async function cancelRoutine({ methodology_plan_id, routine_plan_id }) {
  const token = getToken();
  const resp = await fetch('/api/routines/cancel-routine', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ methodology_plan_id, routine_plan_id })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo cancelar la rutina');
  return data;
}

export async function getHistoricalData({ methodologyPlanId = null } = {}) {
  const token = getToken();
  const queryParams = new URLSearchParams();

  if (methodologyPlanId) {
    queryParams.set('methodology_plan_id', methodologyPlanId);
  }

  const url = `/api/routines/historical-data${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudieron cargar los datos históricos');
  return data.data; // Datos históricos completos del usuario
}



// Nueva función: obtener datos de una sesión específica completada
export async function getSessionById(sessionId) {
  const token = getToken();

  const resp = await fetch(`/api/routines/sessions/${sessionId}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) {
    if (resp.status === 404) return null;
    throw new Error(data.error || 'No se pudo obtener la sesión');
  }
  return data; // { session, exercises, summary }
}

// Nueva función: obtener ejercicios únicos del plan para modales de cancelación
export async function getPlanExercises({ methodologyPlanId }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/plan-exercises?methodology_plan_id=${encodeURIComponent(methodologyPlanId)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) {
    if (resp.status === 404) return [];
    throw new Error(data.error || 'No se pudieron cargar los ejercicios del plan');
  }
  return data.exercises; // Array de ejercicios únicos del plan
}

// Nueva función: actualizar tiempo de calentamiento
export async function updateWarmupTime({ sessionId, warmupTimeSeconds }) {
  const token = getToken();
  const resp = await fetch(`/api/routines/sessions/${sessionId}/warmup-time`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ warmup_time_seconds: warmupTimeSeconds })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar el tiempo de calentamiento');
  return data;
}
