import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Calendar, Dumbbell, BarChart3, History } from 'lucide-react';
import { useWorkout } from '@/contexts/WorkoutContext';
import TrainingPlanConfirmationModal from './TrainingPlanConfirmationModal.jsx';
import TodayTrainingTab from './tabs/TodayTrainingTab.jsx';
import CalendarTab from './tabs/CalendarTab.jsx';
import ProgressTab from './tabs/ProgressTab.jsx';
import HistoricalTab from './tabs/HistoricalTab.jsx';

// ===============================================
// 🚀 RoutineScreen - Versión Integrada con WorkoutContext
// ===============================================

const RoutineScreen = () => {
  console.log('🔧 RoutineScreen.jsx cargado - Versión con WorkoutContext integrado');

  const location = useLocation();

  // ===============================================
  // 🎯 INTEGRACIÓN CON WorkoutContext
  // ===============================================

  const {
    // Estado unificado
    plan,
    session,
    ui,

    // Acciones de plan
    activatePlan,
    loadActivePlan,

    // Acciones de sesión
    startSession,
    updateExercise,
    completeSession,

    // Navegación
    goToMethodologies,

    // Utilidades
    isTraining,
    hasActivePlan,
    hasActiveSession
  } = useWorkout();

  // ===============================================
  // 🎛️ ESTADO LOCAL MÍNIMO
  // ===============================================

  // State recibido desde MethodologiesScreen.navigate('/routines', { state })
  const incomingState = location.state || {};

  // Estado local mínimo para datos específicos de esta pantalla
  const [localState, setLocalState] = useState({
    activeTab: incomingState?.activeTab || (incomingState?.fromSession ? 'today' : 'today'),
    progressUpdatedAt: Date.now(),
    showConfirmationModal: false
  });

  const updateLocalState = useCallback((updates) => {
    setLocalState(prev => ({ ...prev, ...updates }));
  }, []);

  // ===============================================
  // 📅 UTILIDADES DE FECHA
  // ===============================================

  // Día actual
  const todayName = useMemo(() => {
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return dias[new Date().getDay()];
  }, []);

  // ===============================================
  // 📋 DATOS EFECTIVOS DEL PLAN
  // ===============================================

  // Plan efectivo a usar (prioridad: contexto > location.state)
  const effectivePlan = plan.currentPlan || incomingState?.routinePlan || incomingState?.plan;
  const effectivePlanSource = incomingState?.planSource || { label: 'IA' };
  const effectivePlanId = plan.planId || incomingState?.planId;
  const effectiveMethodologyPlanId = plan.planId || incomingState?.methodology_plan_id;

  // ===============================================
  // 🔄 INICIALIZACIÓN Y RECUPERACIÓN DE ESTADO
  // ===============================================

  useEffect(() => {
    const initializeRoutineScreen = async () => {
      console.log('🚀 Inicializando RoutineScreen con WorkoutContext...');

      try {
        // Si viene un plan desde location.state, activarlo en el contexto
        if (incomingState?.plan && incomingState?.planJustActivated) {
          console.log('✅ Plan recién activado desde MethodologiesScreen');
          // El plan ya está activado, no hacer nada más
          return;
        }

        // Si viene un planId específico, cargarlo
        if (incomingState?.methodology_plan_id && !hasActivePlan) {
          console.log('🔍 Cargando plan específico:', incomingState.methodology_plan_id);
          await loadActivePlan(incomingState.methodology_plan_id);
          return;
        }

        // Si no hay plan activo, intentar recuperar uno
        if (!hasActivePlan) {
          console.log('🔄 No hay plan activo, intentando recuperar...');
          await loadActivePlan();
        }

      } catch (error) {
        console.error('❌ Error inicializando RoutineScreen:', error);
        ui.setError(error.message || 'Error cargando el plan de entrenamiento');
      }
    };

    initializeRoutineScreen();
  }, [incomingState, hasActivePlan, loadActivePlan, setError]);

  // ===============================================
  // 🎭 GESTIÓN DE MODALES
  // ===============================================

  // Mostrar modal de confirmación si es necesario
  useEffect(() => {
    if (incomingState?.showModal === true && effectivePlan && !localState.showConfirmationModal) {
      console.log('🎭 Mostrando modal de confirmación por location.state');
      updateLocalState({ showConfirmationModal: true });
    }
  }, [incomingState?.showModal, effectivePlan, localState.showConfirmationModal]);

  // ===============================================
  // 🎯 HANDLERS DE ACCIONES
  // ===============================================

  const handleConfirmPlan = async () => {
    try {
      console.log('✅ Confirmando plan de entrenamiento...');

      if (!effectivePlan || !effectiveMethodologyPlanId) {
        throw new Error('No hay plan para confirmar');
      }

      // Usar la función activatePlan del WorkoutContext
      const result = await activatePlan(effectiveMethodologyPlanId);

      if (result.success) {
        console.log('✅ Plan confirmado exitosamente');
        updateLocalState({ showConfirmationModal: false });
        ui.showSuccess('Plan de entrenamiento confirmado');
      } else {
        throw new Error(result.error || 'Error confirmando el plan');
      }

    } catch (error) {
      console.error('❌ Error confirmando plan:', error);
      ui.setError(error.message || 'Error confirmando el plan de entrenamiento');
    }
  };

  const handleStartTraining = async () => {
    try {
      console.log('🚀 Iniciando entrenamiento del día...');

      if (!effectivePlan || !effectiveMethodologyPlanId) {
        throw new Error('No hay plan activo para entrenar');
      }

      // Usar startSession del WorkoutContext
      const result = await startSession({
        planId: effectiveMethodologyPlanId,
        dayName: todayName
      });

      if (result.success) {
        console.log('✅ Sesión de entrenamiento iniciada');
        updateLocalState({ activeTab: 'today' });
      } else {
        throw new Error(result.error || 'Error iniciando el entrenamiento');
      }

    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      ui.setError(error.message || 'Error iniciando el entrenamiento');
    }
  };

  const handleGenerateAnother = async () => {
    console.log('🔄 Redirigiendo para generar otro plan...');
    updateLocalState({ showConfirmationModal: false });
    goToMethodologies();
  };

  const handleTabChange = useCallback((newTab) => {
    console.log(`🏷️ Cambiando a pestaña: ${newTab}`);
    updateLocalState({ activeTab: newTab });
  }, []);

  const handleProgressUpdate = useCallback(() => {
    console.log('📊 Progreso actualizado, refrescando datos...');
    updateLocalState({ progressUpdatedAt: Date.now() });
  }, []);

  // ===============================================
  // 🚨 VALIDACIONES Y REDIRECTS
  // ===============================================

  // Si no hay plan efectivo después de intentar cargar, redirigir
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ui.isLoading && !effectivePlan && !incomingState?.plan) {
        console.log('⚠️ No hay plan disponible, redirigiendo a metodologías...');
        goToMethodologies();
      }
    }, 3000); // Dar tiempo para cargar

    return () => clearTimeout(timer);
  }, [ui.isLoading, effectivePlan, incomingState?.plan, goToMethodologies]);

  // ===============================================
  // 🎨 RENDER CONDICIONAL PARA LOADING
  // ===============================================

  if (ui.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-yellow-400/50 rounded-full animate-pulse mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-white font-medium">Cargando plan de entrenamiento...</p>
            <p className="text-gray-400 text-sm">Preparando tu rutina personalizada</p>
          </div>
        </div>
      </div>
    );
  }

  // ===============================================
  // 🎨 RENDER PRINCIPAL
  // ===============================================

  return (
    <div className="container mx-auto p-6 bg-gray-900 min-h-screen">
      {/* Header con información del plan */}
      {effectivePlan && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-yellow-400">
                {effectivePlan.selected_style || effectivePlan.nombre || 'Plan de Entrenamiento'}
              </h1>
              <p className="text-gray-400">
                Fuente: {effectivePlanSource?.label || 'IA'} {effectivePlanSource?.detail && `${effectivePlanSource.detail}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">
                Duración: {effectivePlan.duracion_total_semanas || effectivePlan.duration || 4} semanas
              </p>
              <p className="text-sm text-gray-400">
                Frecuencia: {effectivePlan.frecuencia_por_semana || effectivePlan.frequency || 3}x/semana
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pestañas principales */}
      <Tabs value={localState.activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 border border-gray-700">
          <TabsTrigger
            value="today"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <Dumbbell className="w-4 h-4 mr-2" />
            Hoy
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendario
          </TabsTrigger>
          <TabsTrigger
            value="progress"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Progreso
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <History className="w-4 h-4 mr-2" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Contenido de las pestañas */}
        <TabsContent value="today" className="mt-6">
          <TodayTrainingTab
            routinePlan={effectivePlan}
            routinePlanId={effectivePlanId}
            methodologyPlanId={effectiveMethodologyPlanId}
            planStartDate={plan.planStartDate || incomingState?.planStartDate}
            todayName={todayName}
            onProgressUpdate={handleProgressUpdate}
            onStartTraining={handleStartTraining}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarTab
            routinePlan={effectivePlan}
            planStartDate={plan.planStartDate || incomingState?.planStartDate}
            onProgressUpdate={handleProgressUpdate}
          />
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <ProgressTab
            routinePlanId={effectivePlanId}
            methodologyPlanId={effectiveMethodologyPlanId}
            routinePlan={effectivePlan}
            progressUpdatedAt={localState.progressUpdatedAt}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoricalTab
            routinePlanId={effectivePlanId}
            methodologyPlanId={effectiveMethodologyPlanId}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de confirmación del plan */}
      <TrainingPlanConfirmationModal
        isOpen={localState.showConfirmationModal}
        onClose={() => updateLocalState({ showConfirmationModal: false })}
        onConfirm={handleConfirmPlan}
        onStartTraining={handleStartTraining}
        onGenerateAnother={handleGenerateAnother}
        plan={effectivePlan}
        methodology={effectivePlan?.selected_style || effectivePlan?.nombre}
        planSource={effectivePlanSource}
        successMessage={incomingState?.successMessage}
        isLoading={ui.isLoading}
        error={ui.error}
      />
    </div>
  );
};

export default RoutineScreen;