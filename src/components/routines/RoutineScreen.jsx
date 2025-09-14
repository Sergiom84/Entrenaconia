import { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Calendar, Dumbbell, BarChart3, History } from 'lucide-react';
import RoutinePlanModal from './RoutinePlanModal';
import TodayTrainingTab from './tabs/TodayTrainingTab';
import CalendarTab from './tabs/CalendarTab';
import ProgressTab from './tabs/ProgressTab';
import HistoricalTab from './tabs/HistoricalTab';
import { bootstrapPlan, confirmRoutinePlan, getPlanStatus, getActivePlan } from './api';
import { useRoutineCache, CACHE_KEYS } from '@/hooks/useRoutineCache';
import { validateRoutineState, cleanOrphanedState, migrateOldState, setupStateSyncListener } from '@/utils/stateValidator';

// Pantalla de Rutinas con sistema de pestañas
const RoutineScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { getOrLoad, invalidateCache } = useRoutineCache();

  // State recibido desde MethodologiesScreen.navigate('/routines', { state })
  const incomingState = location.state || {};
  // Buscar el plan en diferentes propiedades posibles (routinePlan o plan)
  const incomingPlan = incomingState?.routinePlan || incomingState?.plan || null;
  const planId = incomingState?.planId || null; // routinePlanId preferido

  // Si viene desde una sesión, no mostrar modal y activar pestaña 'today'
  const [showPlanModal, setShowPlanModal] = useState(
    incomingState?.fromSession ? false : (incomingState?.showModal || false)
  );
  // Recuperar methodologyPlanId desde múltiples fuentes
  const [methodologyPlanId, setMethodologyPlanId] = useState(() => {
    // Prioridad: 1) Navigation state, 2) localStorage, 3) null
    const fromNavigation = incomingState?.methodology_plan_id;
    if (fromNavigation) {
      localStorage.setItem('currentMethodologyPlanId', String(fromNavigation));
      return fromNavigation;
    }
    const fromStorage = localStorage.getItem('currentMethodologyPlanId');
    return fromStorage ? Number(fromStorage) : null;
  });
  // Si viene con activeTab especificado o desde sesión, usarlo
  const [activeTab, setActiveTab] = useState(
    incomingState?.activeTab || (incomingState?.fromSession ? 'today' : 'today')
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCheckingPlanStatus, setIsCheckingPlanStatus] = useState(true);

  // State para rutina recuperada
  const [recoveredPlan, setRecoveredPlan] = useState(null);
  const [recoveredPlanId, setRecoveredPlanId] = useState(null);
  const [isRecoveringPlan, setIsRecoveringPlan] = useState(false);
  const [progressUpdatedAt, setProgressUpdatedAt] = useState(Date.now());

  // Fecha de inicio del plan (persiste entre sesiones)
  const [planStartDate, setPlanStartDate] = useState(() => {
    const stored = localStorage.getItem('currentRoutinePlanStartDate');
    if (stored) {
      // Verificar que la fecha almacenada sea válida
      const storedDate = new Date(stored);
      if (!isNaN(storedDate.getTime())) {
        return stored;
      }
    }
    // Si no hay fecha válida almacenada, usar hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    localStorage.setItem('currentRoutinePlanStartDate', todayISO);
    return todayISO;
  });

  useEffect(() => {
    if (incomingPlan) {
      // Cuando llega un nuevo plan, usar la fecha de confirmación si está disponible
      // o la fecha de creación como fallback, no siempre "hoy"
      let planDate;
      
      // Si el plan tiene confirmed_at, usarla (es más precisa)
      if (incomingState?.confirmed_at) {
        planDate = new Date(incomingState.confirmed_at);
      } else if (incomingState?.created_at) {
        planDate = new Date(incomingState.created_at);
      } else {
        // Solo si no hay información de fechas, usar hoy
        planDate = new Date();
      }
      
      planDate.setHours(0, 0, 0, 0);
      const planDateISO = planDate.toISOString();
      setPlanStartDate(planDateISO);
      localStorage.setItem('currentRoutinePlanStartDate', planDateISO);
      console.log('📅 Plan iniciado en fecha:', planDateISO, 'usando:', 
        incomingState?.confirmed_at ? 'confirmed_at' : 
        incomingState?.created_at ? 'created_at' : 'hoy');
    }
  }, [incomingPlan, incomingState]);

  // Día actual (el día que el usuario activó la IA)
  const todayName = useMemo(() => {
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return dias[new Date().getDay()];
  }, []);

  // Plan efectivo a usar (entrante o recuperado)
  const effectivePlan = incomingPlan || recoveredPlan;
  const effectivePlanSource = incomingState?.planSource || { label: 'IA' };
  const effectivePlanId = incomingState?.planId || recoveredPlanId || null;

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

  useEffect(() => {
    // Si no hay plan entrante, intentar recuperar rutina activa
    if (!incomingPlan) {
      // Si viene desde una sesión pero sin plan, intentar recuperar
      if (incomingState?.fromSession) {
        console.log('🔄 Coming from session, trying to recover active routine...', {
          methodology_plan_id: incomingState?.methodology_plan_id,
          methodologyPlanId,
          planStartDate: incomingState?.planStartDate,
          activeTab: incomingState?.activeTab
        });
      } else {
        console.log('No incoming plan. Trying to recover active routine...');
      }
      setIsRecoveringPlan(true);

      // Si viene de una sesión, no usar caché para evitar datos obsoletos
      const shouldUseCache = !incomingState?.fromSession;
      console.log('📋 Llamando a getActivePlan...', { shouldUseCache, fromSession: incomingState?.fromSession });

      const loadActivePlan = shouldUseCache
        ? getOrLoad(CACHE_KEYS.ACTIVE_PLAN, getActivePlan)
        : getActivePlan();

      loadActivePlan.then(activeData => {
          console.log('📦 Respuesta de getActivePlan:', activeData);
          if (activeData.hasActivePlan) {
            console.log('✅ Rutina activa recuperada:', activeData);
            setRecoveredPlan(activeData.routinePlan);
            setMethodologyPlanId(activeData.methodology_plan_id);
            setRecoveredPlanId(activeData.planId || null);
            // Persistir el methodologyPlanId recuperado
            localStorage.setItem('currentMethodologyPlanId', String(activeData.methodology_plan_id));

            // Establecer fecha de inicio basada en la fecha de confirmación del plan recuperado
            if (activeData.confirmedAt || activeData.createdAt) {
              const planDate = new Date(activeData.confirmedAt || activeData.createdAt);
              planDate.setHours(0, 0, 0, 0);
              const planDateISO = planDate.toISOString();
              setPlanStartDate(planDateISO);
              localStorage.setItem('currentRoutinePlanStartDate', planDateISO);
              console.log('📅 Plan recuperado con fecha de inicio:', planDateISO,
                'usando:', activeData.confirmedAt ? 'confirmedAt' : 'createdAt');
            }
          } else {
            console.log('⚠️ No se encontró plan activo, analizando contexto...', {
              hasActivePlan: activeData.hasActivePlan,
              fromSession: incomingState?.fromSession,
              methodologyPlanId,
              incomingMethodologyPlanId: incomingState?.methodology_plan_id
            });

            // Si viene desde una sesión, SIEMPRE intentar cargar con el methodologyPlanId
            if (incomingState?.fromSession) {
              const planIdToUse = incomingState?.methodology_plan_id || methodologyPlanId || localStorage.getItem('currentMethodologyPlanId');

              if (planIdToUse) {
                console.log('🔄 Recuperando desde sesión con methodology_plan_id:', planIdToUse);
                console.log('📊 Intentando forzar recuperación del plan activo...');

                // Establecer el methodology_plan_id para intentar cargar
                setMethodologyPlanId(planIdToUse);
                localStorage.setItem('currentMethodologyPlanId', String(planIdToUse));

                // Intentar recuperar el plan directamente sin caché
                getActivePlan()
                  .then(freshData => {
                    console.log('🔄 Datos frescos obtenidos:', freshData);
                    if (freshData.hasActivePlan) {
                      setRecoveredPlan(freshData.routinePlan);
                      setMethodologyPlanId(freshData.methodology_plan_id);
                      setRecoveredPlanId(freshData.planId || null);
                    }
                  })
                  .catch(err => {
                    console.error('Error recuperando plan fresco:', err);
                  })
                  .finally(() => {
                    setIsCheckingPlanStatus(false);
                  });
              } else {
                console.log('⚠️ Viene de sesión pero sin methodology_plan_id');
                setIsCheckingPlanStatus(false);
              }
            } else if (methodologyPlanId) {
              // Si no viene de sesión pero tenemos methodologyPlanId, intentar cargar
              console.log('🔄 Intentando recuperar con methodology_plan_id guardado:', methodologyPlanId);
              setIsCheckingPlanStatus(false);
            } else {
              console.log('🚫 No hay rutina activa. Redirecting to Methodologies.');
              navigate('/methodologies', { replace: true });
            }
          }
        })
        .catch(error => {
          console.error('Error recovering active plan:', error);
          // Si viene desde sesión, no redirigir inmediatamente
          if (!incomingState?.fromSession) {
            navigate('/methodologies', { replace: true });
          }
        })
        .finally(() => {
          setIsRecoveringPlan(false);
          setIsCheckingPlanStatus(false);
        });
      return;
    }

    // Verificar si la rutina ya está confirmada
    const checkPlanStatus = async () => {
      try {
        setIsCheckingPlanStatus(true);
        const methodologyId = methodologyPlanId || incomingState?.methodology_plan_id;
        
        if (methodologyId) {
          console.log('🔍 Verificando estado del plan:', methodologyId);
          const statusData = await getPlanStatus({ methodologyPlanId: methodologyId });
          
          if (statusData.isConfirmed) {
            console.log('✅ Plan ya confirmado, saltando modal');
            setShowPlanModal(false); // No mostrar modal, ir directo a entrenamientos
          } else {
            console.log('⏳ Plan no confirmado, mostrando modal');
            setShowPlanModal(true); // Mostrar modal de confirmación
          }
        } else {
          // Si no hay methodology_plan_id, mostrar modal para generar
          setShowPlanModal(true);
        }
      } catch (error) {
        console.error('Error verificando estado del plan:', error);
        // En caso de error, mostrar modal para estar seguros
        setShowPlanModal(true);
      } finally {
        setIsCheckingPlanStatus(false);
      }
    };

    checkPlanStatus();
  }, [incomingPlan, methodologyPlanId, incomingState?.methodology_plan_id, navigate]);

  const handleStart = useCallback(async () => {
    // 🔒 PREVENCIÓN DE DOBLE CLIC
    if (isConfirming) {
      console.log('⚠️ Confirmación ya en proceso, ignorando click adicional');
      return;
    }
    
    setIsConfirming(true);
    try {
      // Obtener los IDs necesarios para la confirmación
      const methodologyId = methodologyPlanId || incomingState?.methodology_plan_id;
      const routineId = planId; // routinePlanId
      
      console.log('🔄 Confirmando rutina en la base de datos...', {
        methodology_plan_id: methodologyId,
        routine_plan_id: routineId
      });

      // Confirmar la rutina en la base de datos
      if (methodologyId) {
        await confirmRoutinePlan({ 
          methodology_plan_id: methodologyId, 
          routine_plan_id: routineId 
        });
        console.log('✅ Rutina confirmada exitosamente');
      }

      setShowPlanModal(false);
      // El plan está confirmado, ir directamente a la pestaña de entrenamiento de hoy
      setActiveTab('today');
    } catch (e) {
      console.error('❌ Error confirmando rutina:', e);
      alert(e.message || 'No se pudo confirmar la rutina');
      setShowPlanModal(true);
    } finally {
      setIsConfirming(false);
    }
  }, [isConfirming, methodologyPlanId, incomingState?.methodology_plan_id, planId]);

  const handleGenerateAnother = useCallback(() => {
    // Descartar plan y limpiar todo el estado de rutinas
    localStorage.removeItem('currentRoutinePlanStartDate');
    localStorage.removeItem('currentMethodologyPlanId');
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
    // Invalidar caché del plan activo
    invalidateCache(CACHE_KEYS.ACTIVE_PLAN);
    navigate('/methodologies', { replace: true });
  }, [invalidateCache, navigate]);

  const ensureMethodologyPlan = async () => {
    // Si tenemos un methodologyPlanId, validarlo primero
    if (methodologyPlanId) {
      try {
        const status = await getPlanStatus({ methodologyPlanId: methodologyPlanId });
        if (status?.success) return methodologyPlanId; // válido
      } catch (_) {
        // inválido: continuamos para bootstrap
      }
    }

    // Si vino por navegación con id válido
    if (incomingState?.methodology_plan_id) return incomingState.methodology_plan_id;

    // Bootstrap a partir de un routine_plan_id conocido
    const candidatePlanId = incomingState?.planId || recoveredPlanId || planId;
    if (candidatePlanId) {
      const mId = await bootstrapPlan(candidatePlanId);
      setMethodologyPlanId(mId);
      return mId;
    }
    throw new Error('No se pudo determinar el plan. Vuelve a Metodologías y genera uno nuevo.');
  };

  // Mostrar loading mientras se verifica el estado del plan o se recupera la rutina
  if (isCheckingPlanStatus || isRecoveringPlan) {
    return (
      <div className="p-6 bg-black min-h-screen text-white pt-20">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">Rutinas</h1>
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isRecoveringPlan ? 'Recuperando rutina activa...' : 'Verificando estado del plan...'}
          </p>
        </div>
      </div>
    );
  }

  // Si no hay plan efectivo y no está el modal, mostrar estado vacío
  if (!effectivePlan && !showPlanModal) {
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

      {/* Modal de resumen del plan (aparece al generar nueva rutina) */}
      {showPlanModal && effectivePlan && (
        <RoutinePlanModal
          plan={effectivePlan}
          planSource={effectivePlanSource}
          onStart={handleStart}
          onGenerateAnother={handleGenerateAnother}
          onClose={handleGenerateAnother}
          isConfirming={isConfirming}
        />
      )}

      {/* Sistema de pestañas - Solo se muestra cuando hay plan y no hay modal */}
      {effectivePlan && !showPlanModal && (
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