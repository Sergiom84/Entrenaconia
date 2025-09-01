import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Calendar, Dumbbell, BarChart3 } from 'lucide-react';
import RoutinePlanModal from './RoutinePlanModal';
import TodayTrainingTab from './tabs/TodayTrainingTab';
import CalendarTab from './tabs/CalendarTab';
import ProgressTab from './tabs/ProgressTab';
import { bootstrapPlan, confirmRoutinePlan, getPlanStatus, getActivePlan } from './api';

// Pantalla de Rutinas con sistema de pestañas
export default function RoutineScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  // State recibido desde MethodologiesScreen.navigate('/routines', { state })
  const incomingState = location.state || {};
  const incomingPlan = incomingState?.routinePlan || null;
  const planSource = incomingState?.planSource || { label: 'OpenAI' };
  const planId = incomingState?.planId || null; // routinePlanId preferido

  const [showPlanModal, setShowPlanModal] = useState(false); // Cambiado: no mostrar por defecto
  const [methodologyPlanId, setMethodologyPlanId] = useState(incomingState?.methodology_plan_id || null);
  const [activeTab, setActiveTab] = useState('today');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCheckingPlanStatus, setIsCheckingPlanStatus] = useState(true);
  
  // State para rutina recuperada
  const [recoveredPlan, setRecoveredPlan] = useState(null);
  const [isRecoveringPlan, setIsRecoveringPlan] = useState(false);

  // Fecha de inicio del plan (día actual cuando se genera)
  const planStartDate = useMemo(() => new Date().toISOString(), []);

  // Día actual (el día que el usuario activó la IA)
  const todayName = useMemo(() => {
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return dias[new Date().getDay()];
  }, []);

  // Plan efectivo a usar (entrante o recuperado)
  const effectivePlan = incomingPlan || recoveredPlan;
  const effectivePlanSource = incomingState?.planSource || { label: 'IA' };
  const effectivePlanId = incomingState?.planId || null;

  useEffect(() => {
    // Si no hay plan entrante, intentar recuperar rutina activa
    if (!incomingPlan) {
      console.log('No incoming plan. Trying to recover active routine...');
      setIsRecoveringPlan(true);
      
      getActivePlan()
        .then(activeData => {
          if (activeData.hasActivePlan) {
            console.log('✅ Rutina activa recuperada:', activeData);
            setRecoveredPlan(activeData.routinePlan);
            setMethodologyPlanId(activeData.methodology_plan_id);
          } else {
            console.log('No hay rutina activa. Redirecting to Methodologies.');
            navigate('/methodologies', { replace: true });
          }
        })
        .catch(error => {
          console.error('Error recovering active plan:', error);
          navigate('/methodologies', { replace: true });
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

  const handleStart = async () => {
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
  };

  const handleGenerateAnother = () => {
    // Descartar plan y volver a metodologías
    navigate('/methodologies', { replace: true });
  };

  const ensureMethodologyPlan = async () => {
    if (methodologyPlanId) return methodologyPlanId;
    if (incomingState?.methodology_plan_id) return incomingState.methodology_plan_id;
    if (planId) {
      const mId = await bootstrapPlan(planId);
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
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 mb-6">
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
            />
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CalendarTab
              plan={effectivePlan}
              planStartDate={planStartDate}
              methodologyPlanId={methodologyPlanId}
              ensureMethodologyPlan={ensureMethodologyPlan}
            />
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            <ProgressTab
              plan={effectivePlan}
              methodologyPlanId={methodologyPlanId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}