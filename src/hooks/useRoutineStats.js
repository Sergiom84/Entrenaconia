import { useState, useCallback } from 'react';

// Hook para gestionar estadísticas del plan de rutina
// - Obtiene stats del backend y maneja estados ARCHIVED/CANCELLED/NOT_FOUND
// - Implementa TTL básico para evitar llamadas repetidas
export default function useRoutineStats(routinePlanId, onInvalidRoutine) {
  const [routineStats, setRoutineStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);

  const fetchRoutineStats = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && isLoading) return;
    if (!force && lastUpdate > 0 && (now - lastUpdate) < 30000) return;
    if (!routinePlanId) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`/api/routines/plans/${routinePlanId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRoutineStats(data.stats);
        setLastUpdate(now);
      } else if (response.status === 409) {
        // Plan archivado
        if (typeof onInvalidRoutine === 'function') onInvalidRoutine('PLAN_ARCHIVED');
      } else if (response.status === 410) {
        // Rutina cancelada
        const data = await response.json();
        if (typeof onInvalidRoutine === 'function') onInvalidRoutine(data.code || 'ROUTINE_CANCELLED');
      } else if (response.status === 404) {
        if (typeof onInvalidRoutine === 'function') onInvalidRoutine('ROUTINE_NOT_FOUND');
      } else {
        // No tumbar la UI por otros errores
        console.error('Error fetching routine stats:', response.statusText);
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas de rutina:', error);
    } finally {
      setIsLoading(false);
    }
  }, [routinePlanId, isLoading, lastUpdate, onInvalidRoutine]);

  return { routineStats, isLoading, fetchRoutineStats };
}

