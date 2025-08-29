import { useState, useEffect, useRef, useCallback } from 'react';

// Hook para gestionar el plan de rutina (carga inicial, estado vacío, navegación/localStorage, verificación de activos)
export default function useRoutinePlan(location) {
  const [routinePlan, setRoutinePlan] = useState(null);
  const [routinePlanId, setRoutinePlanId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasTriedLoadingPlan, setHasTriedLoadingPlan] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [uiState, setUIState] = useState('LOADING');
  const didInit = useRef(false);

  const clearLocalSessionState = useCallback(() => {
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
  }, []);

  const loadLatestRoutinePlan = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const plansResponse = await fetch('/api/routines/history?limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!plansResponse.ok) {
        setError('No se pudo cargar el historial de rutinas.');
        return false;
      }
      const plansData = await plansResponse.json();
      if (!plansData.success || !plansData.routines || plansData.routines.length === 0) {
        setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Metodologías.');
        return false;
      }
      const latestPlan = plansData.routines[0];
      setRoutinePlanId(latestPlan.id);
      // Guardar id para uso futuro aunque no traemos el JSON del plan aquí
      localStorage.setItem('currentRoutinePlanId', String(latestPlan.id));
      return true;
    } catch (e) {
      console.error('❌ Error cargando plan más reciente:', e);
      setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Metodologías.');
      return false;
    } finally {
      setIsLoading(false);
      setHasTriedLoadingPlan(true);
      setInitialLoad(false);
    }
  }, []);

  const checkForActivePlans = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No hay rutinas programadas. Inicia sesión y genera tu primera rutina desde Metodologías.');
        setHasTriedLoadingPlan(true);
        setInitialLoad(false);
        return false;
      }
      const plansResponse = await fetch('/api/routines/history?limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!plansResponse.ok) {
        setHasTriedLoadingPlan(true);
        setInitialLoad(false);
        return false;
      }
      const plansData = await plansResponse.json();
      const hasActivePlans = plansData.success && plansData.routines && plansData.routines.length > 0;
      if (hasActivePlans) {
        return await loadLatestRoutinePlan();
      } else {
        setError('No hay rutinas programadas. Genera una desde Metodologías (botón "Activar IA" o configuración manual).');
        setHasTriedLoadingPlan(true);
        setInitialLoad(false);
        return false;
      }
    } catch (error) {
      console.error('Error verificando planes activos:', error);
      setHasTriedLoadingPlan(true);
      setInitialLoad(false);
      return false;
    }
  }, [loadLatestRoutinePlan]);

  // Manejo de entrada por navegación o localStorage
  useEffect(() => {
    const planFromNavigation = location.state?.routinePlan;
    const planIdFromNavigation = location.state?.planId;
    const planMetadataFromNavigation = location.state?.planMetadata;
    const planFromStorage = localStorage.getItem('currentRoutinePlan');
    const planIdFromStorage = localStorage.getItem('currentRoutinePlanId');
    const sessionIdFromStorage = localStorage.getItem('currentRoutineSessionId');
    const sessionStartFromStorage = localStorage.getItem('currentRoutineSessionStartAt');

    if (planFromNavigation) {
      // Limpiar sesión anterior
      clearLocalSessionState();
      const enhancedPlan = { plan: planFromNavigation, metadata: planMetadataFromNavigation };
      setRoutinePlan(enhancedPlan);
      localStorage.setItem('currentRoutinePlan', JSON.stringify(enhancedPlan));
      setHasTriedLoadingPlan(true);
      setInitialLoad(false);
    } else if (planFromStorage) {
      try {
        setRoutinePlan(JSON.parse(planFromStorage));
        setHasTriedLoadingPlan(true);
        setInitialLoad(false);
      } catch (e) {
        console.error('Error parsing routine plan from storage:', e);
        setError('Error cargando el plan de rutina guardado');
        setHasTriedLoadingPlan(true);
        setInitialLoad(false);
      }
    } else {
      clearLocalSessionState();
      // Si estamos en /routines intentar verificar activos
      setTimeout(() => setInitialLoad(false), 100);
    }

    if (planIdFromNavigation) {
      setRoutinePlanId(planIdFromNavigation);
      localStorage.setItem('currentRoutinePlanId', String(planIdFromNavigation));
    } else if (planIdFromStorage) {
      setRoutinePlanId(Number(planIdFromStorage));
    }
  }, [location, clearLocalSessionState]);

  // API del hook
  return {
    routinePlan,
    routinePlanId,
    setRoutinePlan,
    setRoutinePlanId,
    uiState,
    setUIState,
    isLoading,
    error,
    hasTriedLoadingPlan,
    initialLoad,
    setHasTriedLoadingPlan,
    setInitialLoad,
    setError,
    checkForActivePlans,
    loadLatestRoutinePlan,
  };
}

