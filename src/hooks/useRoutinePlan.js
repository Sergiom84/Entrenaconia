import { useState, useEffect, useCallback } from 'react';
import { getActivePlan, getPlanStatus } from '@/components/routines/api';

// Hook para gestionar el plan de rutina (carga inicial, estado vacío, navegación/localStorage, verificación de activos)
export default function useRoutinePlan(location) {
  const [routinePlan, setRoutinePlan] = useState(null);
  const [routinePlanId, setRoutinePlanId] = useState(null);
  const [methodologyPlanId, setMethodologyPlanId] = useState(() => {
    // Recuperar desde localStorage al inicializar
    const stored = localStorage.getItem('currentMethodologyPlanId');
    return stored ? Number(stored) : null;
  });
  const [planStartDate, setPlanStartDate] = useState(() => {
    const stored = localStorage.getItem('currentRoutinePlanStartDate');
    if (stored) {
      const storedDate = new Date(stored);
      if (!isNaN(storedDate.getTime())) {
        return stored;
      }
    }
    // Si no hay fecha válida almacenada, usar hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasTriedLoadingPlan, setHasTriedLoadingPlan] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [uiState, setUIState] = useState('LOADING');
  const [isRecoveringPlan, setIsRecoveringPlan] = useState(false);

  const clearLocalSessionState = useCallback(() => {
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
    localStorage.removeItem('currentRoutinePlanStartDate');
    localStorage.removeItem('currentMethodologyPlanId');
  }, []);

  // Persistir methodologyPlanId cuando cambie
  useEffect(() => {
    if (methodologyPlanId !== null) {
      localStorage.setItem('currentMethodologyPlanId', String(methodologyPlanId));
    }
  }, [methodologyPlanId]);

  // Persistir planStartDate cuando cambie
  useEffect(() => {
    if (planStartDate) {
      localStorage.setItem('currentRoutinePlanStartDate', planStartDate);
    }
  }, [planStartDate]);

  const loadLatestRoutinePlan = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRecoveringPlan(true);
      const activeData = await getActivePlan();

      if (activeData.hasActivePlan) {
        setRoutinePlan(activeData.routinePlan);
        setRoutinePlanId(activeData.planId || null);
        setMethodologyPlanId(activeData.methodology_plan_id);

        // Establecer fecha de inicio basada en la fecha de confirmación
        if (activeData.confirmedAt || activeData.createdAt) {
          const planDate = new Date(activeData.confirmedAt || activeData.createdAt);
          planDate.setHours(0, 0, 0, 0);
          setPlanStartDate(planDate.toISOString());
        }

        return true;
      }

      setError('No hay plan de rutina activo.');
      return false;
    } catch (error) {
      console.error('Error loading routine plan:', error);
      setError('Error cargando el plan de rutina.');
      return false;
    } finally {
      setIsLoading(false);
      setIsRecoveringPlan(false);
      setHasTriedLoadingPlan(true);
      setInitialLoad(false);
    }
  }, []);

  const checkForActivePlans = useCallback(async () => {
    try {
      if (methodologyPlanId) {
        const statusData = await getPlanStatus({ methodologyPlanId });
        if (statusData.success) {
          // Plan existe, intentar recuperarlo
          return await loadLatestRoutinePlan();
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking for active plans:', error);
      return false;
    }
  }, [methodologyPlanId, loadLatestRoutinePlan]);

  // Manejo de entrada por navegación o localStorage
  useEffect(() => {
    const incomingState = location?.state || {};
    const planFromNavigation = incomingState.routinePlan || incomingState.plan;
    const planIdFromNavigation = incomingState.planId;
    const methodologyIdFromNavigation = incomingState.methodology_plan_id;
    const planMetadataFromNavigation = incomingState.planMetadata;
    const planFromStorage = localStorage.getItem('currentRoutinePlan');
    const planIdFromStorage = localStorage.getItem('currentRoutinePlanId');

    // Actualizar methodologyPlanId si viene por navegación
    if (methodologyIdFromNavigation) {
      setMethodologyPlanId(methodologyIdFromNavigation);
    }

    if (planFromNavigation) {
      // Limpiar sesión anterior si no viene desde una sesión
      if (!incomingState.fromSession) {
        clearLocalSessionState();
      }

      const enhancedPlan = planMetadataFromNavigation
        ? { plan: planFromNavigation, metadata: planMetadataFromNavigation }
        : planFromNavigation;

      setRoutinePlan(enhancedPlan);
      localStorage.setItem('currentRoutinePlan', JSON.stringify(enhancedPlan));
      setHasTriedLoadingPlan(true);
      setInitialLoad(false);

      // Establecer fecha de inicio si viene con información de fechas
      if (incomingState.confirmed_at || incomingState.created_at) {
        const planDate = new Date(incomingState.confirmed_at || incomingState.created_at);
        planDate.setHours(0, 0, 0, 0);
        setPlanStartDate(planDate.toISOString());
      }
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
    } else if (!incomingState.fromSession) {
      // Solo limpiar si no viene desde una sesión
      clearLocalSessionState();
      setTimeout(() => setInitialLoad(false), 100);
    } else {
      // Viene desde sesión, intentar recuperar plan activo
      loadLatestRoutinePlan();
    }

    if (planIdFromNavigation) {
      setRoutinePlanId(planIdFromNavigation);
      localStorage.setItem('currentRoutinePlanId', String(planIdFromNavigation));
    } else if (planIdFromStorage) {
      setRoutinePlanId(Number(planIdFromStorage));
    }
  }, [location, clearLocalSessionState, loadLatestRoutinePlan]);

  // Sincronización entre pestañas
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'currentMethodologyPlanId' && e.newValue) {
        setMethodologyPlanId(Number(e.newValue));
      }
      if (e.key === 'currentRoutinePlanStartDate' && e.newValue) {
        setPlanStartDate(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // API del hook
  return {
    routinePlan,
    routinePlanId,
    methodologyPlanId,
    planStartDate,
    setRoutinePlan,
    setRoutinePlanId,
    setMethodologyPlanId,
    setPlanStartDate,
    uiState,
    setUIState,
    isLoading,
    isRecoveringPlan,
    error,
    hasTriedLoadingPlan,
    initialLoad,
    setHasTriedLoadingPlan,
    setInitialLoad,
    setError,
    checkForActivePlans,
    loadLatestRoutinePlan,
    clearLocalSessionState,
  };
}

