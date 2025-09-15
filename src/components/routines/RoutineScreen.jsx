import { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Calendar, Dumbbell, BarChart3, History } from 'lucide-react';
import TrainingPlanConfirmationModal from './TrainingPlanConfirmationModal.jsx';
import TodayTrainingTab from './tabs/TodayTrainingTab.jsx';
import CalendarTab from './tabs/CalendarTab.jsx';
import ProgressTab from './tabs/ProgressTab.jsx';
import HistoricalTab from './tabs/HistoricalTab.jsx';
import { bootstrapPlan, confirmRoutinePlan, getPlanStatus } from './api.js';
import { useRoutineCache, CACHE_KEYS } from '@/hooks/useRoutineCache';
import { validateRoutineState, cleanOrphanedState, migrateOldState, setupStateSyncListener } from '@/utils/stateValidator';
import { useModalState } from '@/hooks/useModalState';

// ✅ IMPORTAR LOS HOOKS EXTRAÍDOS
import useRoutinePlan from '@/hooks/useRoutinePlan';
import useRoutineSession from '@/hooks/useRoutineSession';
import useRoutineStats from '@/hooks/useRoutineStats';

// Pantalla de Rutinas con sistema de pestañas - VERSIÓN CORREGIDA
const RoutineScreen = () => {
  console.log('🔧 RoutineScreen.fixed.jsx cargado - Versión con hooks integrados');

  const location = useLocation();
  const navigate = useNavigate();
  const { invalidateCache } = useRoutineCache();

  // State recibido desde MethodologiesScreen.navigate('/routines', { state })
  const incomingState = location.state || {};

  // ✅ USAR EL HOOK useRoutinePlan PARA GESTIONAR EL PLAN
  const {
    routinePlan,
    routinePlanId,
    methodologyPlanId,
    planStartDate,
    setRoutinePlan,
    setRoutinePlanId,
    setMethodologyPlanId,
    setPlanStartDate,
    isLoading: isPlanLoading,
    isRecoveringPlan,
    error: planError,
    loadLatestRoutinePlan,
    checkForActivePlans,
    clearLocalSessionState
  } = useRoutinePlan(location);

  // ✅ USAR EL HOOK useRoutineSession PARA GESTIONAR LA SESIÓN
  const {
    routineSessionId,
    sessionStartAtMs,
    showExerciseModal,
    currentExerciseIndex,
    currentSessionData,
    trainingInProgress,
    completedExercises,
    sessionExerciseStatuses,
    setShowExerciseModal,
    setCurrentExerciseIndex,
    hydrateSession,
    startTraining,
    updateProgress,
    completeExercise,
    skipExercise,
    cancelExercise,
    completeSession
  } = useRoutineSession();

  // ✅ USAR EL HOOK useRoutineStats PARA GESTIONAR ESTADÍSTICAS
  const handleInvalidRoutine = useCallback((code) => {
    console.error('❌ Rutina inválida:', code);
    if (code === 'PLAN_ARCHIVED' || code === 'ROUTINE_CANCELLED' || code === 'ROUTINE_NOT_FOUND') {
      // Limpiar estado y redirigir
      clearLocalSessionState();
      navigate('/methodologies', {
        replace: true,
        state: { error: 'La rutina ya no está disponible. Por favor, genera una nueva.' }
      });
    }
  }, [clearLocalSessionState, navigate]);

  const {
    routineStats,
    isLoading: isStatsLoading,
    fetchRoutineStats
  } = useRoutineStats(routinePlanId || methodologyPlanId, handleInvalidRoutine);

  // Estado de la UI
  const [activeTab, setActiveTab] = useState(
    incomingState?.activeTab || (incomingState?.fromSession ? 'today' : 'today')
  );
  const [progressUpdatedAt, setProgressUpdatedAt] = useState(Date.now());
  const [isCheckingPlanStatus, setIsCheckingPlanStatus] = useState(false);

  // Control del modal con el hook mejorado
  const planModal = useModalState(
    !incomingState?.fromSession && incomingState?.showModal === true,
    {
      debugMode: import.meta.env.DEV,
      preventDoubleOpen: true,
      onOpen: () => console.log('🎭 Modal de confirmación abierto'),
      onClose: () => console.log('🎭 Modal de confirmación cerrado')
    }
  );

  // Exponer estado del modal en desarrollo para depuración
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__ROUTINE_MODAL_DEBUG__ = {
        getState: () => planModal.getDebugInfo(),
        open: () => planModal.open(),
        close: () => planModal.close(),
        reset: () => planModal.reset()
      };
      console.log('🔧 Debug del modal disponible en window.__ROUTINE_MODAL_DEBUG__');
    }
    return () => {
      if (window.__ROUTINE_MODAL_DEBUG__) {
        delete window.__ROUTINE_MODAL_DEBUG__;
      }
    };
  }, [planModal]);

  // Día actual
  const todayName = useMemo(() => {
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return dias[new Date().getDay()];
  }, []);

  // Plan efectivo a usar
  const effectivePlan = routinePlan || incomingState?.routinePlan || incomingState?.plan;
  const effectivePlanSource = incomingState?.planSource || { label: 'IA' };
  const effectivePlanId = routinePlanId || incomingState?.planId;

  // Validar y limpiar estado al montar el componente
  useEffect(() => {
    // Migrar datos antiguos si existen
    const migrated = migrateOldState();
    if (migrated) {
      console.log('📦 Estado migrado desde versión anterior');
    }

    // Limpiar estados huérfanos o corruptos
    const cleaned = cleanOrphanedState();
    if (cleaned) {
      console.log('🧹 Estado huérfano limpiado');
    }

    // Validar estado actual
    const validation = validateRoutineState();
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Advertencias de estado:', validation.warnings);
    }
    if (!validation.isValid) {
      console.error('❌ Estado inválido:', validation.errors);
    }

    // Configurar sincronización entre pestañas
    const cleanup = setupStateSyncListener((change) => {
      console.log('📡 Cambio de estado detectado:', change);
      // Recargar si cambia el methodologyPlanId desde otra pestaña
      if (change.key === 'currentMethodologyPlanId' && change.newValue !== change.oldValue) {
        window.location.reload();
      }
    });

    return cleanup;
  }, []);

  // Verificar estado del plan cuando llega uno nuevo
  useEffect(() => {
    const checkPlanStatus = async () => {
      if (!effectivePlan || isCheckingPlanStatus) return;

      try {
        setIsCheckingPlanStatus(true);
        const mId = methodologyPlanId || incomingState?.methodology_plan_id;

        if (mId) {
          console.log('🔍 Verificando estado del plan:', mId);
          const statusData = await getPlanStatus({ methodologyPlanId: mId });

          if (statusData && typeof statusData.isConfirmed === 'boolean') {
            if (statusData.isConfirmed) {
              console.log('✅ Plan ya confirmado, saltando modal');
              planModal.close();
            } else if (incomingState?.showModal === true) {
              console.log('⏳ Plan no confirmado y showModal=true, mostrando modal');
              planModal.open();
            } else {
              console.log('📝 Plan no confirmado pero no se pidió mostrar modal');
              planModal.close();
            }
          }
        } else if (incomingState?.showModal === true) {
          console.log('🆕 Sin methodology_plan_id pero showModal=true');
          planModal.open();
        }
      } catch (error) {
        console.error('Error verificando estado del plan:', error);
        if (incomingState?.showModal === true) {
          planModal.open();
        }
      } finally {
        setIsCheckingPlanStatus(false);
      }
    };

    checkPlanStatus();
  }, [effectivePlan, methodologyPlanId, incomingState, planModal]);

  // Cargar estadísticas cuando haya un plan
  useEffect(() => {
    if (effectivePlanId && !isStatsLoading) {
      fetchRoutineStats();
    }
  }, [effectivePlanId, fetchRoutineStats, isStatsLoading]);

  // Manejadores
  const handleStart = useCallback(async () => {
    const result = await planModal.processAction(async () => {
      const mId = methodologyPlanId || incomingState?.methodology_plan_id;
      const rId = effectivePlanId;

      console.log('🔄 Confirmando rutina en la base de datos...', {
        methodology_plan_id: mId,
        routine_plan_id: rId
      });

      if (!mId) {
        throw new Error('No se encontró el ID del plan de metodología');
      }

      await confirmRoutinePlan({
        methodology_plan_id: mId,
        routine_plan_id: rId
      });

      console.log('✅ Rutina confirmada exitosamente');
      setActiveTab('today');
      invalidateCache(CACHE_KEYS.ACTIVE_PLAN);

      // Recargar estadísticas
      if (fetchRoutineStats) {
        fetchRoutineStats(true);
      }

      return true;
    }, {
      closeOnSuccess: true,
      closeOnError: false,
      resetErrorOnStart: true
    });

    if (!result.success) {
      console.error('❌ Error confirmando rutina:', result.error);
    }
  }, [planModal, methodologyPlanId, incomingState?.methodology_plan_id, effectivePlanId, invalidateCache, fetchRoutineStats]);

  const handleGenerateAnother = useCallback((feedbackData) => {
    if (feedbackData) {
      console.log('📝 Navegando con feedback:', feedbackData);
      navigate('/methodologies', {
        replace: true,
        state: { feedback: feedbackData }
      });
    } else {
      navigate('/methodologies', { replace: true });
    }

    // Limpiar estado local
    setTimeout(() => {
      clearLocalSessionState();
      invalidateCache(CACHE_KEYS.ACTIVE_PLAN);
    }, 100);
  }, [invalidateCache, navigate, clearLocalSessionState]);

  const ensureMethodologyPlan = async () => {
    if (methodologyPlanId) {
      try {
        const status = await getPlanStatus({ methodologyPlanId });
        if (status?.success) return methodologyPlanId;
      } catch (_) {
        // inválido: continuamos para bootstrap
      }
    }

    if (incomingState?.methodology_plan_id) return incomingState.methodology_plan_id;

    const candidatePlanId = effectivePlanId;
    if (candidatePlanId) {
      const mId = await bootstrapPlan(candidatePlanId);
      setMethodologyPlanId(mId);
      return mId;
    }
    throw new Error('No se pudo determinar el plan. Vuelve a Metodologías y genera uno nuevo.');
  };

  // Loading state
  if (isPlanLoading || isRecoveringPlan || isCheckingPlanStatus) {
    return (
      <div className="p-6 bg-black min-h-screen text-white pt-20">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">Rutinas</h1>
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isRecoveringPlan ? 'Recuperando rutina activa...' :
             isPlanLoading ? 'Cargando plan de rutina...' :
             'Verificando estado del plan...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (planError && !effectivePlan) {
    return (
      <div className="p-6 bg-black min-h-screen text-white pt-20">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">Rutinas</h1>
        <div className="text-center mt-20">
          <p className="text-red-500 mb-4">{planError}</p>
          <button
            onClick={() => navigate('/methodologies')}
            className="bg-yellow-400 text-black px-6 py-2 rounded-lg hover:bg-yellow-300"
          >
            Ir a Metodologías
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!effectivePlan && !planModal.isOpen) {
    return (
      <div className="p-6 bg-black min-h-screen text-white pt-20">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">Rutinas</h1>
        <p className="text-gray-400 mb-6">No hay rutinas disponibles.</p>
        <div className="text-center mt-20">
          <p className="text-gray-500 mb-4">Genera una rutina desde el apartado de Metodologías</p>
          <button
            onClick={() => navigate('/methodologies')}
            className="bg-yellow-400 text-black px-6 py-2 rounded-lg hover:bg-yellow-300"
          >
            Ir a Metodologías
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-black min-h-screen text-white pt-20">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Rutinas</h1>
      <p className="text-gray-400 mb-6">Gestiona tus sesiones generadas por IA.</p>

      {/* Modal de confirmación del plan */}
      {planModal.isOpen && (
        <TrainingPlanConfirmationModal
          isOpen={planModal.isOpen && Boolean(effectivePlan)}
          plan={effectivePlan}
          planSource={effectivePlanSource}
          onStartTraining={handleStart}
          onGenerateAnother={handleGenerateAnother}
          onClose={planModal.close}
          isConfirming={planModal.isProcessing}
          error={planModal.error}
        />
      )}

      {/* Sistema de pestañas */}
      {effectivePlan && !planModal.isOpen && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-6">
            <TabsTrigger
              value="today"
              className="flex items-center gap-2 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Dumbbell className="w-4 h-4" />
              Entrenamiento de Hoy
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="flex items-center gap-2 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Calendar className="w-4 h-4" />
              Calendario
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="flex items-center gap-2 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <BarChart3 className="w-4 h-4" />
              Progreso
            </TabsTrigger>
            <TabsTrigger
              value="historical"
              className="flex items-center gap-2 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-0">
            <TodayTrainingTab
              plan={effectivePlan}
              planId={effectivePlanId}
              methodologyPlanId={methodologyPlanId}
              todayName={todayName}
              planStartDate={planStartDate}
              ensureMethodologyPlan={ensureMethodologyPlan}
              onGenerateAnother={handleGenerateAnother}
              onProgressUpdate={() => setProgressUpdatedAt(Date.now())}
              // Pasar funciones del hook de sesión
              routineSession={{
                routineSessionId,
                sessionStartAtMs,
                showExerciseModal,
                currentExerciseIndex,
                currentSessionData,
                trainingInProgress,
                completedExercises,
                sessionExerciseStatuses,
                setShowExerciseModal,
                setCurrentExerciseIndex,
                hydrateSession,
                startTraining,
                updateProgress,
                completeExercise,
                skipExercise,
                cancelExercise,
                completeSession
              }}
              // Pasar estadísticas
              routineStats={routineStats}
              fetchRoutineStats={fetchRoutineStats}
            />
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CalendarTab
              plan={effectivePlan}
              planStartDate={planStartDate}
              methodologyPlanId={methodologyPlanId}
              ensureMethodologyPlan={ensureMethodologyPlan}
              refreshTrigger={progressUpdatedAt}
            />
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            <ProgressTab
              plan={effectivePlan}
              methodologyPlanId={methodologyPlanId}
              routineStats={routineStats}
            />
          </TabsContent>

          <TabsContent value="historical" className="mt-0">
            <HistoricalTab
              methodologyPlanId={methodologyPlanId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default memo(RoutineScreen);