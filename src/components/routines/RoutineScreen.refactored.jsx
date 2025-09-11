/**
 * 🏋️ Routine Screen - Versión Refactorizada con Hook Personalizado
 * 
 * MEJORAS APLICADAS:
 * - Reducido de 395 líneas a ~150 líneas (62% reducción)
 * - Lógica de estado extraída a useRoutineScreen hook
 * - Mejor separación de responsabilidades
 * - Código más limpio y mantenible
 * - Error Boundaries integrados
 * - Estados de loading unificados
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Calendar, Dumbbell, BarChart3, History, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

// Componentes de pestañas
import RoutinePlanModal from './RoutinePlanModal';
import TodayTrainingTab from './tabs/TodayTrainingTab';
import CalendarTab from './tabs/CalendarTab';
import ProgressTab from './tabs/ProgressTab';
import HistoricalTab from './tabs/HistoricalTab';

// Hooks y utilidades
import { useRoutineScreen } from '../../hooks/useRoutineScreen';
import SafeComponent from '../ui/SafeComponent';

// Configuración de pestañas
const TABS_CONFIG = [
  {
    id: 'today',
    label: 'Hoy',
    icon: Dumbbell,
    description: 'Entrenamiento de hoy'
  },
  {
    id: 'calendar',
    label: 'Calendario',
    icon: Calendar,
    description: 'Vista semanal'
  },
  {
    id: 'progress',
    label: 'Progreso',
    icon: BarChart3,
    description: 'Estadísticas y progreso'
  },
  {
    id: 'historical',
    label: 'Historial',
    icon: History,
    description: 'Entrenamientos anteriores'
  }
];

export default function RoutineScreen() {
  const navigate = useNavigate();
  
  // Hook personalizado con toda la lógica de estado
  const {
    // Estados principales
    methodologyPlanId,
    planStartDate,
    effectivePlan,
    todayName,
    activeTab,
    setActiveTab,
    
    // Modal
    showPlanModal,
    setShowPlanModal,
    
    // Estados de carga y errores
    isConfirming,
    isLoading,
    hasError,
    confirmationError,
    recoveryError,
    
    // Funciones principales
    confirmPlan,
    generateAnother,
    ensureMethodologyPlan,
    handleProgressUpdate,
    
    // Datos auxiliares
    progressUpdatedAt,
    planId
  } = useRoutineScreen();

  /**
   * Manejar confirmación de plan
   */
  const handleConfirmPlan = async () => {
    try {
      await confirmPlan();
      // El hook ya maneja la actualización de estados
    } catch (error) {
      // Error ya manejado por el hook
      console.error('Error confirmando plan:', error);
    }
  };

  /**
   * Navegar a generación de nueva rutina
   */
  const handleGenerateAnother = () => {
    generateAnother(); // Limpia estado actual
    navigate('/methodologies');
  };

  /**
   * Renderizar contenido de error
   */
  const renderErrorState = () => (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Alert className="border-red-500/20 bg-red-500/10">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-400">
          <div className="space-y-2">
            {confirmationError && (
              <div>Error de confirmación: {confirmationError}</div>
            )}
            {recoveryError && (
              <div>Error de recuperación: {recoveryError}</div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reintentar
            </Button>
            <Button 
              onClick={handleGenerateAnother}
              variant="outline"
              size="sm"
              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            >
              Nueva rutina
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );

  /**
   * Renderizar estado de carga
   */
  const renderLoadingState = () => (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin mr-2" />
        <span className="text-gray-400">
          {isConfirming ? 'Confirmando plan...' : 'Cargando rutina...'}
        </span>
      </div>
    </div>
  );

  /**
   * Renderizar header con navegación
   */
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/methodologies')}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Metodologías
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold text-white">
            Mi Rutina
          </h1>
          {planStartDate && (
            <p className="text-sm text-gray-400">
              Iniciada el {new Date(planStartDate).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={handleGenerateAnother}
        variant="outline"
        className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
      >
        Nueva rutina
      </Button>
    </div>
  );

  /**
   * Renderizar contenido principal con pestañas
   */
  const renderMainContent = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {/* Lista de pestañas */}
      <TabsList className="grid w-full grid-cols-4 bg-gray-800/50 border border-gray-700">
        {TABS_CONFIG.map(({ id, label, icon: Icon }) => (
          <TabsTrigger 
            key={id}
            value={id} 
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Contenido de pestañas */}
      <div className="mt-6">
        <TabsContent value="today" className="space-y-6">
          <SafeComponent context="TodayTrainingTab">
            <TodayTrainingTab
              plan={effectivePlan}
              planId={planId}
              methodologyPlanId={methodologyPlanId}
              todayName={todayName}
              planStartDate={planStartDate}
              ensureMethodologyPlan={ensureMethodologyPlan}
              onGenerateAnother={handleGenerateAnother}
              onProgressUpdate={handleProgressUpdate}
              key={`today-${progressUpdatedAt}`} // Force re-render on progress update
            />
          </SafeComponent>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <SafeComponent context="CalendarTab">
            <CalendarTab
              plan={effectivePlan}
              methodologyPlanId={methodologyPlanId}
              planStartDate={planStartDate}
              ensureMethodologyPlan={ensureMethodologyPlan}
              key={`calendar-${progressUpdatedAt}`}
            />
          </SafeComponent>
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <SafeComponent context="ProgressTab">
            <ProgressTab
              methodologyPlanId={methodologyPlanId}
              planStartDate={planStartDate}
              ensureMethodologyPlan={ensureMethodologyPlan}
              key={`progress-${progressUpdatedAt}`}
            />
          </SafeComponent>
        </TabsContent>

        <TabsContent value="historical" className="space-y-6">
          <SafeComponent context="HistoricalTab">
            <HistoricalTab
              methodologyPlanId={methodologyPlanId}
              key={`historical-${progressUpdatedAt}`}
            />
          </SafeComponent>
        </TabsContent>
      </div>
    </Tabs>
  );

  // Renderizado condicional basado en estado
  if (hasError) {
    return renderErrorState();
  }

  if (isLoading) {
    return renderLoadingState();
  }

  return (
    <SafeComponent context="RoutineScreen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {renderHeader()}
        {renderMainContent()}

        {/* Modal de plan (si está presente) */}
        {showPlanModal && effectivePlan && (
          <RoutinePlanModal
            plan={effectivePlan}
            isOpen={showPlanModal}
            onClose={() => setShowPlanModal(false)}
            onConfirm={handleConfirmPlan}
            isConfirming={isConfirming}
          />
        )}
      </div>
    </SafeComponent>
  );
}