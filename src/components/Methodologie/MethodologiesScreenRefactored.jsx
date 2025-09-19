/**
 * 🎯 MethodologiesScreen REFACTORIZADO
 *
 * CAMBIOS CRÍTICOS:
 * ✅ hasActivePlan desde BD real-time (no localStorage)
 * ✅ useWorkout refactorizado sin localStorage
 * ✅ Sincronización automática con Supabase
 * ✅ Estado consistente entre dispositivos
 *
 * @version 2.0.0 - Refactorización Crítica
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { useWorkout } from '@/contexts/WorkoutContextRefactored'; // <-- USAR NUEVO CONTEXTO
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Settings, Brain, User as UserIcon, AlertCircle, Zap, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { METHODOLOGIES, sanitizeProfile } from './methodologiesData.js';
import MethodologyDetailsDialog from './shared/MethodologyDetailsDialog.jsx';
import TrainingPlanConfirmationModal from '../routines/TrainingPlanConfirmationModal.jsx';
import RoutineSessionModal from '../routines/RoutineSessionModal.jsx';
import WarmupModal from '../routines/WarmupModal.jsx';
import MethodologyVersionSelectionModal from './shared/MethodologyVersionSelectionModal.jsx';
import CalisteniaManualCard from './methodologies/CalisteniaManual/CalisteniaManualCard.jsx';
import { useTrace } from '@/contexts/TraceContext';

// ===============================================
// 🎯 ESTADO LOCAL MÍNIMO PARA ESTA PANTALLA
// ===============================================

const LOCAL_STATE_INITIAL = {
  selectionMode: 'automatico',
  pendingMethodology: null,
  detailsMethod: null,
  activeTrainingInfo: null,
  versionSelectionData: null
};

export default function MethodologiesScreenRefactored() {
  const { user } = useAuth();
  const { userData } = useUserContext();

  // ===============================================
  // 🚀 INTEGRACIÓN CON WorkoutContext REFACTORIZADO
  // ===============================================

  const {
    // Estado unificado (DESDE BD, NO localStorage)
    plan,
    session,
    ui,
    sync,

    // Acciones de plan (SIN localStorage)
    generatePlan,
    activatePlan,
    cancelPlan,
    syncTrainingState,

    // Acciones de sesión
    startSession,

    // Navegación
    goToTraining,

    // Modales
    showModal,
    hideModal,
    hideAllModals,

    // Utilidades (basadas en BD real)
    hasActivePlan,   // <-- DESDE BD, no localStorage
    hasActiveSession, // <-- DESDE BD, no localStorage
    isTraining,

    // Constantes
    WORKOUT_VIEWS,
    PLAN_STATUS
  } = useWorkout();

  // ===============================================
  // 🎯 ESTADO LOCAL DE LA PANTALLA
  // ===============================================

  const [localState, setLocalState] = useState(LOCAL_STATE_INITIAL);
  const { addTrace } = useTrace();
  const mountedRef = useRef(true);

  // ===============================================
  // 🔄 SINCRONIZACIÓN Y EFFECTS
  // ===============================================

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Sincronización inicial cuando se monta el componente
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 MethodologiesScreen: Sincronizando estado inicial...');
      syncTrainingState().catch(error => {
        console.error('Error sincronizando estado inicial:', error);
      });
    }
  }, [user?.id, syncTrainingState]);

  // Log del estado actual para debugging
  useEffect(() => {
    if (hasActivePlan) {
      console.log('📋 Plan activo detectado:', {
        planId: plan.planId,
        methodologyType: plan.methodologyType,
        status: plan.status,
        currentWeek: plan.currentWeek,
        hasActiveSession,
        isTraining
      });
    } else {
      console.log('❌ No hay plan activo (verificado desde BD)');
    }
  }, [hasActivePlan, hasActiveSession, isTraining, plan]);

  // ===============================================
  // 🎯 MANEJO DE METODOLOGÍAS
  // ===============================================

  const handleMethodologySelect = useCallback(async (methodName) => {
    if (!user || !userData) {
      ui.setError('Usuario no autenticado o datos no disponibles');
      return;
    }

    // ⚠️ VERIFICACIÓN CRÍTICA: hasActivePlan desde BD
    if (hasActivePlan) {
      setLocalState(prev => ({
        ...prev,
        activeTrainingInfo: {
          methodologyType: plan.methodologyType,
          planId: plan.planId,
          status: plan.status
        }
      }));
      showModal('activeTrainingWarning');
      return;
    }

    const methodology = METHODOLOGIES.find(m => m.name === methodName);
    if (!methodology) {
      ui.setError('Metodología no encontrada');
      return;
    }

    addTrace(`methodology_selected: ${methodName}`, {
      methodology: methodName,
      selectionMode: localState.selectionMode,
      hasActivePlan: hasActivePlan
    });

    // Manejar metodologías con versiones
    if (methodology.versions && methodology.versions.length > 1) {
      setLocalState(prev => ({
        ...prev,
        versionSelectionData: { methodology, methodName }
      }));
      showModal('versionSelection');
      return;
    }

    // Procesar selección directamente
    await processMethodologySelection(methodology, methodName, methodology.versions?.[0] || null);

  }, [user, userData, hasActivePlan, plan, localState.selectionMode, ui, showModal, addTrace]);

  const processMethodologySelection = useCallback(async (methodology, methodName, selectedVersion) => {
    try {
      ui.setLoading(true);

      const sanitizedProfile = sanitizeProfile(userData);

      const config = {
        mode: localState.selectionMode,
        metodologia_solicitada: methodName,
        userProfile: sanitizedProfile,
        selectedVersion: selectedVersion?.version || '1.0',
        versionType: selectedVersion?.name || 'standard'
      };

      console.log('🚀 Generando plan con configuración:', config);

      // Generar plan usando nueva API (SIN localStorage)
      const result = await generatePlan(config);

      if (result.success || result.planId) {
        console.log('✅ Plan generado exitosamente:', result);

        setLocalState(prev => ({
          ...prev,
          pendingMethodology: {
            ...result,
            selectedMethodology: methodName,
            selectedVersion: selectedVersion
          }
        }));

        // Mostrar confirmación del plan
        showModal('planConfirmation');

        addTrace('methodology_generated', {
          methodology: methodName,
          planId: result.planId,
          mode: config.mode
        });

      } else {
        throw new Error(result.error || 'Error generando el plan');
      }

    } catch (error) {
      console.error('❌ Error generando metodología:', error);
      ui.setError(error.message);
      addTrace('methodology_generation_error', {
        error: error.message,
        methodology: methodName
      });
    } finally {
      ui.setLoading(false);
    }
  }, [userData, localState.selectionMode, generatePlan, showModal, ui, addTrace]);

  // ===============================================
  // 🔄 CONFIRMACIÓN DE PLAN
  // ===============================================

  const handleConfirmPlan = useCallback(async () => {
    if (!localState.pendingMethodology?.planId) {
      ui.setError('No hay plan para confirmar');
      return;
    }

    try {
      ui.setLoading(true);

      console.log('🔄 Activando plan:', localState.pendingMethodology.planId);

      // Activar plan usando nueva API (actualiza BD automáticamente)
      const result = await activatePlan(localState.pendingMethodology.planId);

      if (result.success) {
        console.log('✅ Plan activado exitosamente');

        // Limpiar estado local
        setLocalState(prev => ({ ...prev, pendingMethodology: null }));

        // Cerrar modales
        hideModal('planConfirmation');
        hideAllModals();

        // Navegar a entrenamiento (el estado ya está sincronizado)
        goToTraining();

        addTrace('plan_activated', {
          planId: localState.pendingMethodology.planId,
          methodology: localState.pendingMethodology.selectedMethodology
        });

      } else {
        throw new Error(result.error || 'Error confirmando el plan');
      }

    } catch (error) {
      console.error('❌ Error confirmando plan:', error);
      ui.setError(error.message);
      addTrace('plan_activation_error', { error: error.message });
    } finally {
      ui.setLoading(false);
    }
  }, [localState.pendingMethodology, activatePlan, goToTraining, hideModal, hideAllModals, ui, addTrace]);

  // ===============================================
  // 🚫 MANEJO DE CANCELACIÓN DE ENTRENAMIENTO ACTIVO
  // ===============================================

  const handleCancelActiveTraining = useCallback(async () => {
    try {
      ui.setLoading(true);

      console.log('🚫 Cancelando entrenamiento activo...');

      // Cancelar usando nueva API (actualiza BD automáticamente)
      const result = await cancelPlan();

      if (result.success) {
        console.log('✅ Entrenamiento cancelado exitosamente');

        // Limpiar estado local
        setLocalState(prev => ({
          ...prev,
          activeTrainingInfo: null,
          pendingMethodology: null
        }));

        hideAllModals();

        addTrace('training_cancelled', {
          reason: 'user_initiated_from_methodologies'
        });

      } else {
        throw new Error(result.error || 'Error cancelando entrenamiento');
      }

    } catch (error) {
      console.error('❌ Error cancelando entrenamiento:', error);
      ui.setError(error.message);
    } finally {
      ui.setLoading(false);
    }
  }, [cancelPlan, hideAllModals, ui, addTrace]);

  // ===============================================
  // 🎯 CALISTENIA MANUAL (COMPONENTE ESPECIALIZADO)
  // ===============================================

  const handleCalisteniaManualResult = useCallback(async (result) => {
    try {
      console.log('🤸 Resultado calistenia manual:', result);

      if (result.success && result.planId) {
        // El plan ya está generado, mostrar confirmación
        setLocalState(prev => ({
          ...prev,
          pendingMethodology: {
            ...result,
            selectedMethodology: 'calistenia'
          }
        }));

        showModal('planConfirmation');
        addTrace('calistenia_manual_generated', { planId: result.planId });
      }

    } catch (error) {
      console.error('❌ Error procesando calistenia manual:', error);
      ui.setError(error.message);
    }
  }, [showModal, ui, addTrace]);

  // ===============================================
  // 🎨 RENDER DEL COMPONENTE
  // ===============================================

  if (!user || !userData) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Cargando datos de usuario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* =============================================== */}
      {/* 🎯 HEADER CON ESTADO DE SINCRONIZACIÓN */}
      {/* =============================================== */}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Metodologías de Entrenamiento
          </h1>
          <p className="text-gray-600">
            Elige la metodología que mejor se adapte a tus objetivos
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Indicador de sincronización */}
          {sync.isSyncing && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700">Sincronizando...</span>
            </div>
          )}

          {/* Botón de sincronización manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncTrainingState()}
            disabled={sync.isSyncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${sync.isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* =============================================== */}
      {/* ⚠️ ALERTA DE PLAN ACTIVO (desde BD) */}
      {/* =============================================== */}

      {hasActivePlan && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Tienes un plan activo: {plan.methodologyType}</strong>
                <p className="text-sm mt-1">
                  Semana {plan.currentWeek} • {plan.status === PLAN_STATUS.ACTIVE ? 'En progreso' : plan.status}
                </p>
              </div>
              <Button
                onClick={goToTraining}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Continuar Entrenamiento
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* =============================================== */}
      {/* 🎯 MODO DE SELECCIÓN */}
      {/* =============================================== */}

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Modo de Selección</h2>
        <RadioGroup
          value={localState.selectionMode}
          onValueChange={(value) => setLocalState(prev => ({ ...prev, selectionMode: value }))}
          className="space-y-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="automatico" id="automatico" />
            <Label htmlFor="automatico" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Automático (IA)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="manual" id="manual" />
            <Label htmlFor="manual" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Manual (Tú eliges)
            </Label>
          </div>
        </RadioGroup>
      </Card>

      {/* =============================================== */}
      {/* 🏋️ METODOLOGÍAS DISPONIBLES */}
      {/* =============================================== */}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {METHODOLOGIES.map((methodology) => (
          <Card
            key={methodology.name}
            className={`p-6 cursor-pointer transition-all hover:shadow-lg border-2 ${
              ui.isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'
            }`}
            onClick={() => !ui.isLoading && handleMethodologySelect(methodology.name)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${methodology.color}`}>
                <methodology.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{methodology.title}</h3>
                <p className="text-sm text-gray-600">{methodology.level}</p>
              </div>
            </div>

            <p className="text-gray-700 text-sm mb-4 line-clamp-3">
              {methodology.description}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {methodology.duration}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocalState(prev => ({ ...prev, detailsMethod: methodology }));
                  showModal('methodologyDetails');
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Ver detalles
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* =============================================== */}
      {/* 🤸 CALISTENIA MANUAL (COMPONENTE ESPECIAL) */}
      {/* =============================================== */}

      {localState.selectionMode === 'manual' && (
        <div className="mt-8">
          <CalisteniaManualCard
            isVisible={!hasActivePlan}
            onResult={handleCalisteniaManualResult}
            isLoading={ui.isLoading}
          />
        </div>
      )}

      {/* =============================================== */}
      {/* 🎭 MODALES */}
      {/* =============================================== */}

      {/* Modal de detalles de metodología */}
      {ui.showMethodologyDetails && localState.detailsMethod && (
        <MethodologyDetailsDialog
          methodology={localState.detailsMethod}
          isOpen={ui.showMethodologyDetails}
          onClose={() => hideModal('methodologyDetails')}
          onSelect={() => {
            hideModal('methodologyDetails');
            handleMethodologySelect(localState.detailsMethod.name);
          }}
        />
      )}

      {/* Modal de selección de versión */}
      {ui.showVersionSelection && localState.versionSelectionData && (
        <MethodologyVersionSelectionModal
          isOpen={ui.showVersionSelection}
          onClose={() => hideModal('versionSelection')}
          data={localState.versionSelectionData}
          onVersionSelect={(selectedVersion) => {
            hideModal('versionSelection');
            processMethodologySelection(
              localState.versionSelectionData.methodology,
              localState.versionSelectionData.methodName,
              selectedVersion
            );
          }}
        />
      )}

      {/* Modal de confirmación de plan */}
      {ui.showPlanConfirmation && localState.pendingMethodology && (
        <TrainingPlanConfirmationModal
          isOpen={ui.showPlanConfirmation}
          onClose={() => hideModal('planConfirmation')}
          planData={localState.pendingMethodology}
          onConfirm={handleConfirmPlan}
          isLoading={ui.isLoading}
        />
      )}

      {/* Modal de advertencia de entrenamiento activo */}
      {ui.showActiveTrainingWarning && localState.activeTrainingInfo && (
        <Dialog open={ui.showActiveTrainingWarning} onOpenChange={() => hideModal('activeTrainingWarning')}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Entrenamiento Activo Detectado</DialogTitle>
              <DialogDescription>
                Ya tienes un entrenamiento activo de <strong>{localState.activeTrainingInfo.methodologyType}</strong>.
                ¿Qué deseas hacer?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => hideModal('activeTrainingWarning')}
              >
                Cancelar
              </Button>
              <Button
                onClick={goToTraining}
                className="bg-green-600 hover:bg-green-700"
              >
                Continuar Entrenamiento
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelActiveTraining}
                disabled={ui.isLoading}
              >
                {ui.isLoading ? 'Cancelando...' : 'Cancelar Entrenamiento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Error de sincronización */}
      {sync.syncError && (
        <Alert className="mt-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error de sincronización:</strong> {sync.syncError}
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncTrainingState()}
              className="ml-2"
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Estado general de error */}
      {ui.error && (
        <Alert className="mt-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {ui.error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => ui.clearError()}
              className="ml-2"
            >
              Cerrar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}