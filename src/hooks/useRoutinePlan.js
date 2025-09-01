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
    // Las rutinas ahora se generan fresh, no se cargan de la BD
    setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Rutinas.');
    setIsLoading(false);
    setHasTriedLoadingPlan(true);
    setInitialLoad(false);
    return false;
  }, []);

  const checkForActivePlans = useCallback(async () => {
    // Las rutinas ahora se generan fresh, no se recuperan de la BD
    setError('No hay rutinas activas. Genera una nueva rutina desde el apartado de Rutinas.');
    setHasTriedLoadingPlan(true);
    setInitialLoad(false);
    return false;
  }, []);

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

