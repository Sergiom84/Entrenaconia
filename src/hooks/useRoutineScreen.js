/**
 * 🏋️ useRoutineScreen - Hook personalizado para RoutineScreen
 * 
 * RAZONAMIENTO:
 * - Centraliza toda la lógica de estado de RoutineScreen
 * - Gestión de metodología plans, recovery y sincronización
 * - Integración con localStorage y cache
 * - Reduce RoutineScreen.jsx de 395 a ~150 líneas
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useRoutineCache, CACHE_KEYS } from './useRoutineCache';
import { useLocalStorage } from './useLocalStorage';
import { useAsyncOperation } from './useAsyncOperation';
import { validateRoutineState, cleanOrphanedState, migrateOldState, setupStateSyncListener } from '../utils/stateValidator';
import { bootstrapPlan, confirmRoutinePlan, getPlanStatus, getActivePlan } from '../components/routines/api';
import logger from '../utils/logger';

export const useRoutineScreen = () => {
  const location = useLocation();
  const { getOrLoad, invalidateCache } = useRoutineCache();

  // Estado de navegación
  const incomingState = location.state || {};
  const incomingPlan = incomingState?.routinePlan || null;
  const planId = incomingState?.planId || null;

  // Estados con localStorage integrado
  const [methodologyPlanId, setMethodologyPlanId] = useLocalStorage('currentMethodologyPlanId', null, {
    deserialize: (value) => value ? Number(value) : null,
    serialize: (value) => value ? String(value) : null
  });

  const [planStartDate, setPlanStartDate] = useLocalStorage('currentRoutinePlanStartDate', null);

  // Estados locales
  const [showPlanModal, setShowPlanModal] = useState(incomingState?.showModal || false);
  const [activeTab, setActiveTab] = useState('today');
  const [recoveredPlan, setRecoveredPlan] = useState(null);
  const [progressUpdatedAt, setProgressUpdatedAt] = useState(Date.now());

  // Operaciones asíncronas con hooks
  const planConfirmation = useAsyncOperation(null, 'PlanConfirmation');
  const planStatusCheck = useAsyncOperation(null, 'PlanStatusCheck');
  const planRecovery = useAsyncOperation(null, 'PlanRecovery');

  // Procesar estado de navegación al cargar
  useEffect(() => {
    const fromNavigation = incomingState?.methodology_plan_id;
    if (fromNavigation && fromNavigation !== methodologyPlanId) {
      setMethodologyPlanId(fromNavigation);
      logger.info('methodologyPlanId actualizado desde navegación', { fromNavigation }, 'RoutineScreen');
    }
  }, [incomingState, setMethodologyPlanId]);

  // Configurar validación de estado y sincronización
  useEffect(() => {
    // Validar y limpiar estado al cargar
    validateRoutineState();
    cleanOrphanedState();
    migrateOldState();

    // Configurar listener de sincronización entre pestañas
    const cleanup = setupStateSyncListener((changes) => {
      if (changes.methodologyPlanId) {
        setMethodologyPlanId(changes.methodologyPlanId);
        setProgressUpdatedAt(Date.now());
      }
    });

    return cleanup;
  }, []);

  // Recuperar plan activo si no hay methodologyPlanId
  const recoverActivePlan = async () => {
    if (methodologyPlanId || planRecovery.loading) return;

    return planRecovery.execute(async () => {
      const activeData = await getActivePlan();
      
      if (activeData?.hasActivePlan) {
        const recoveredId = activeData.routinePlan?.methodology_plan_id || activeData.methodology_plan_id;
        
        if (recoveredId) {
          setMethodologyPlanId(recoveredId);
          setRecoveredPlan(activeData.routinePlan);
          
          // Configurar fecha si existe confirmed_at
          if (activeData.routinePlan?.confirmed_at) {
            setPlanStartDate(new Date(activeData.routinePlan.confirmed_at).toISOString().split('T')[0]);
          }
          
          return activeData;
        }
      }
      
      return null;
    }, {
      loadingMessage: 'Recuperando plan activo',
      errorMessage: 'Error recuperando plan activo'
    });
  };

  // Auto-recovery al cargar componente
  useEffect(() => {
    recoverActivePlan();
  }, []);

  // Verificar estado del plan
  const checkPlanStatus = async () => {
    if (!methodologyPlanId) return null;

    return planStatusCheck.execute(async () => {
      return await getPlanStatus(methodologyPlanId);
    }, {
      loadingMessage: 'Verificando estado del plan',
      errorMessage: 'Error verificando estado del plan'
    });
  };

  // Confirmar plan de rutina
  const confirmPlan = async () => {
    if (!incomingPlan || !planId) {
      throw new Error('No hay plan para confirmar');
    }

    return planConfirmation.execute(async () => {
      // 1. Confirmar el plan
      const confirmedPlan = await confirmRoutinePlan(incomingPlan, planId);
      
      // 2. Hacer bootstrap para obtener methodology_plan_id
      let finalMethodologyPlanId = confirmedPlan.methodology_plan_id;
      
      if (!finalMethodologyPlanId && confirmedPlan.id) {
        finalMethodologyPlanId = await bootstrapPlan(confirmedPlan.id);
      }
      
      if (!finalMethodologyPlanId) {
        throw new Error('No se pudo obtener methodology_plan_id');
      }
      
      // 3. Actualizar estados
      setMethodologyPlanId(finalMethodologyPlanId);
      setPlanStartDate(new Date().toISOString().split('T')[0]);
      setShowPlanModal(false);
      
      // 4. Invalidar caché
      invalidateCache(CACHE_KEYS.ACTIVE_PLAN);
      invalidateCache(CACHE_KEYS.TODAY_SESSION(finalMethodologyPlanId));
      
      setProgressUpdatedAt(Date.now());
      
      return { 
        methodology_plan_id: finalMethodologyPlanId, 
        plan: confirmedPlan 
      };
    }, {
      loadingMessage: 'Confirmando plan de rutina',
      successMessage: 'Plan confirmado exitosamente',
      errorMessage: 'Error confirmando plan'
    });
  };

  // Generar nueva rutina
  const generateAnother = () => {
    // Limpiar estado actual
    setMethodologyPlanId(null);
    setPlanStartDate(null);
    setRecoveredPlan(null);
    
    // Limpiar caché
    invalidateCache(CACHE_KEYS.ACTIVE_PLAN);
    
    setProgressUpdatedAt(Date.now());
    logger.info('Iniciando generación de nueva rutina', null, 'RoutineScreen');
  };

  // Callback para actualizaciones de progreso
  const handleProgressUpdate = () => {
    setProgressUpdatedAt(Date.now());
    
    // Invalidar cachés relacionados
    if (methodologyPlanId) {
      invalidateCache(CACHE_KEYS.TODAY_SESSION(methodologyPlanId));
      invalidateCache(CACHE_KEYS.PROGRESS_DATA(methodologyPlanId));
    }
  };

  // Funciones para asegurar methodologyPlanId
  const ensureMethodologyPlan = async () => {
    if (methodologyPlanId) return methodologyPlanId;
    
    // Intentar recuperar de plan activo
    const recovered = await recoverActivePlan();
    
    if (recovered?.methodology_plan_id) {
      return recovered.methodology_plan_id;
    }
    
    throw new Error('No se pudo obtener methodology_plan_id');
  };

  // Plan efectivo (incoming o recovered)
  const effectivePlan = useMemo(() => {
    return incomingPlan || recoveredPlan;
  }, [incomingPlan, recoveredPlan]);

  // Nombre del día actual
  const todayName = useMemo(() => {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return days[new Date().getDay()];
  }, []);

  return {
    // Estados principales
    methodologyPlanId,
    planStartDate,
    effectivePlan,
    todayName,
    activeTab,
    setActiveTab,
    
    // Estados de modal
    showPlanModal,
    setShowPlanModal,
    
    // Estados de recovery
    recoveredPlan,
    progressUpdatedAt,
    
    // Estados de carga y errores
    isConfirming: planConfirmation.loading,
    isCheckingPlanStatus: planStatusCheck.loading,
    isRecoveringPlan: planRecovery.loading,
    
    confirmationError: planConfirmation.error,
    recoveryError: planRecovery.error,
    statusCheckError: planStatusCheck.error,
    
    // Funciones principales
    confirmPlan,
    generateAnother,
    ensureMethodologyPlan,
    handleProgressUpdate,
    checkPlanStatus,
    recoverActivePlan,
    
    // Datos de entrada
    incomingState,
    planId,
    
    // Estado loading general
    isLoading: planConfirmation.loading || planStatusCheck.loading || planRecovery.loading,
    hasError: Boolean(planConfirmation.error || planRecovery.error || planStatusCheck.error)
  };
};