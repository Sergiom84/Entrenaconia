import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { useWorkout } from '@/contexts/WorkoutContext';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Settings, Brain, User as UserIcon, AlertCircle, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { METHODOLOGIES, sanitizeProfile } from './methodologiesData.js';
import MethodologyDetailsDialog from './shared/MethodologyDetailsDialog.jsx';
import TrainingPlanConfirmationModal from '../routines/TrainingPlanConfirmationModal.jsx';
import RoutineSessionModal from '../routines/RoutineSessionModal.jsx';
import WarmupModal from '../routines/WarmupModal.jsx';
import MethodologyVersionSelectionModal from './shared/MethodologyVersionSelectionModal.jsx';
import CalisteniaManualCard from './methodologies/CalisteniaManual/CalisteniaManualCard.jsx';
import HeavyDutyManualCard from './methodologies/HeavyDuty/HeavyDutyManualCard.jsx';
import HipertrofiaManualCard from './methodologies/Hipertrofia/HipertrofiaManualCard.jsx';
import PowerliftingManualCard from './methodologies/Powerlifting/PowerliftingManualCard.jsx';
import CrossFitManualCard from './methodologies/CrossFit/CrossFitManualCard.jsx';
import FuncionalManualCard from './methodologies/Funcional/FuncionalManualCard.jsx';
import HalterofíliaManualCard from './methodologies/Halterofilia/HalterofíliaManualCard.jsx';
import CasaManualCard from './methodologies/Casa/CasaManualCard.jsx';
import { useTrace } from '@/contexts/TraceContext';
import { useNavigate } from 'react-router-dom';

// ===============================================
// 🎯 ESTADO LOCAL MÍNIMO PARA ESTA PANTALLA
// ===============================================

const LOCAL_STATE_INITIAL = {
  selectionMode: 'auto', // Cambiar de 'automatico' a 'auto' para coincidir con validación
  pendingMethodology: null,
  detailsMethod: {}, // Cambiar de null a objeto vacío para evitar warnings
  activeTrainingInfo: null,
  versionSelectionData: null
};

export default function MethodologiesScreen() {
  const { user } = useAuth();
  const { userData } = useUserContext();
  const navigate = useNavigate();

  // ===============================================
  // 🛡️ FUNCIONES DE VALIDACIÓN
  // ===============================================

  /**
   * Valida que un plan tenga datos completos antes de mostrar el modal
   * Previene mostrar planes corruptos o incompletos
   */
  const validatePlanData = (planData) => {
    console.log('🛡️ Validando datos del plan...', planData);

    if (!planData) {
      console.log('❌ Plan es null o undefined');
      return { isValid: false, error: 'Plan no generado' };
    }

    if (typeof planData !== 'object' || Object.keys(planData).length === 0) {
      console.log('❌ Plan está vacío o no es un objeto');
      return { isValid: false, error: 'Plan vacío o corrupto' };
    }

    if (!planData.semanas || !Array.isArray(planData.semanas) || planData.semanas.length === 0) {
      console.log('❌ Plan no tiene semanas válidas');
      return { isValid: false, error: 'Plan sin semanas de entrenamiento' };
    }

    // Verificar que al menos una semana tenga sesiones
    const hasValidSessions = planData.semanas.some(semana =>
      semana.sesiones && Array.isArray(semana.sesiones) && semana.sesiones.length > 0
    );

    if (!hasValidSessions) {
      console.log('❌ Plan no tiene sesiones válidas');
      return { isValid: false, error: 'Plan sin sesiones de entrenamiento' };
    }

    // Verificar que al menos una sesión tenga ejercicios
    // Soportar dos estructuras:
    // 1. sesion.ejercicios[] (directo)
    // 2. sesion.bloques[].ejercicios[] (con bloques intermedios, como en Halterofilia)
    const hasValidExercises = planData.semanas.some(semana =>
      semana.sesiones && semana.sesiones.some(sesion => {
        // Estructura directa: sesion.ejercicios
        if (sesion.ejercicios && Array.isArray(sesion.ejercicios) && sesion.ejercicios.length > 0) {
          return true;
        }

        // Estructura con bloques: sesion.bloques[].ejercicios
        if (sesion.bloques && Array.isArray(sesion.bloques)) {
          return sesion.bloques.some(bloque =>
            bloque.ejercicios && Array.isArray(bloque.ejercicios) && bloque.ejercicios.length > 0
          );
        }

        return false;
      })
    );

    if (!hasValidExercises) {
      console.log('❌ Plan no tiene ejercicios válidos');
      return { isValid: false, error: 'Plan sin ejercicios' };
    }

    console.log('✅ Plan válido - puede mostrar modal');
    return { isValid: true };
  };

  // ===============================================
  // 🚀 INTEGRACIÓN CON WorkoutContext
  // ===============================================

  const {
    // Estado unificado
    plan,
    session,
    ui,

    // Acciones de plan
    generatePlan,
    activatePlan,
    cancelPlan,

    // Acciones de sesión
    startSession,
    updateExercise,

    // Navegación
    goToTraining,

    // Utilidades
    hasActivePlan,

    // 🚀 NEW: Supabase Integration
    hasActivePlanFromDB,
    syncWithDatabase
  } = useWorkout();
  const { track } = useTrace();


  // Estado local mínimo para datos específicos de esta pantalla
  const [localState, setLocalState] = useState(LOCAL_STATE_INITIAL);
  const [sessionData, setSessionData] = useState(null); // 🔥 Datos de la sesión con ejercicios

  const updateLocalState = useCallback((updates) => {
    setLocalState(prev => ({ ...prev, ...updates }));
  }, []);
  // Trace: cambios de estado de modales relevantes
  const modalPrevRef = useRef({});
  useEffect(() => {
    try {
      const current = {
        methodologyDetails: ui.showMethodologyDetails,
        versionSelection: ui.showVersionSelection,
        activeTrainingWarning: ui.showActiveTrainingWarning,
        planConfirmation: ui.showPlanConfirmation,
        warmup: ui.showWarmup,
        routineSession: ui.showRoutineSession,
      };
      const prev = modalPrevRef.current || {};
      Object.entries(current).forEach(([key, val]) => {
        if (prev[key] !== val) {
          track(val ? 'MODAL_OPEN' : 'MODAL_CLOSE', { name: key }, { component: 'MethodologiesScreen' });
        }
      });
      modalPrevRef.current = current;
    } catch (e) { console.warn('Track error:', e); }
  }, [ui.showMethodologyDetails, ui.showVersionSelection, ui.showActiveTrainingWarning, ui.showPlanConfirmation, ui.showWarmup, ui.showRoutineSession]);


  // ===============================================
  // 🎨 COMPONENTE INLINE: MethodologyCard
  // ===============================================

  const MethodologyCard = ({ methodology, manualActive, onDetails, onSelect }) => (
    <Card
      className={`bg-black/80 border-gray-700 transition-all duration-300 ${
        manualActive ? 'hover:border-yellow-400/60 hover:scale-[1.01]' : 'hover:border-gray-600'
      }`}
      aria-label={`Tarjeta de metodología ${methodology.name}`}
    >
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {methodology.icon && <methodology.icon className="w-7 h-7 text-yellow-400" />}
            <h3 className="text-white text-xl font-semibold">{methodology.name}</h3>
          </div>
          <span className="text-xs px-2 py-1 border border-gray-600 text-gray-300 rounded">
            {methodology.level}
          </span>
        </div>
        <p className="text-gray-400 mt-2 text-sm">{methodology.description}</p>
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div className="space-y-2">
          {[
            { label: 'Frecuencia', value: methodology.frequency },
            { label: 'Volumen', value: methodology.volume },
            { label: 'Intensidad', value: methodology.intensity }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}:</span>
              <span className="text-white">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onDetails(methodology);
            }}
            aria-label={`Ver detalles de ${methodology.name}`}
          >
            Ver Detalles
          </Button>
          <Button
            className={`flex-1 ${manualActive
              ? 'bg-yellow-400 text-black hover:bg-yellow-300'
              : 'bg-yellow-400/60 text-black hover:bg-yellow-400'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              // Si no está en modo manual, activarlo Y seleccionar metodología en un solo clic
              if (!manualActive) {
                updateLocalState({ selectionMode: 'manual' });
              }
              // Seleccionar metodología inmediatamente
              onSelect(methodology);
            }}
            aria-label={`Seleccionar metodología ${methodology.name}`}
          >
            Seleccionar
          </Button>
        </div>
      </div>
    </Card>
  );

  // ===============================================
  // 🎛️ HANDLERS SIMPLIFICADOS
  // ===============================================

  const handleActivateIA = async (forcedMethodology = null) => {
    try { track('BUTTON_CLICK', { id: 'activar_ia' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    if (!user) return;

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST: Usuario quiere activar IA
    // Si hay plan → limpiar y generar nuevo con IA
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo con IA...');
      await cancelPlan(); // Limpiar plan anterior
      await syncWithDatabase(); // Sincronizar estado
    }

    // Configurar datos de selección de versión
    updateLocalState({
      versionSelectionData: {
        isAutomatic: true,
        forcedMethodology
      }
    });
    ui.showModal('versionSelection');
  };

  const handleVersionSelectionConfirm = async (versionConfig) => {
    try { track('ACTION', { id: 'version_confirm', mode: 'automatic', version: versionConfig?.version }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    ui.hideModal('versionSelection');

    // Construir perfil completo
    const rawProfile = { ...userData, ...user };
    const fullProfile = sanitizeProfile({
      ...rawProfile,
      peso_kg: rawProfile.peso || rawProfile.peso_kg,
      altura_cm: rawProfile.altura || rawProfile.altura_cm,
      años_entrenando: rawProfile.años_entrenando || rawProfile.anos_entrenando,
      nivel_entrenamiento: rawProfile.nivel || rawProfile.nivel_entrenamiento,
      objetivo_principal: rawProfile.objetivo_principal || rawProfile.objetivoPrincipal
    });

    try {
      console.log('🤖 Generando plan automático con WorkoutContext...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'automatic',
        versionConfig: versionConfig || { version: 'adapted', customWeeks: 4 },
        userProfile: fullProfile
      });

      if (result.success) {
        console.log('✅ Plan automático generado exitosamente');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL (usar result.plan en lugar de plan.currentPlan)
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error generando plan automático');
      }

    } catch (err) {
      console.error('❌ Error generando plan:', err);
      ui.setError(err.message);
    }
  };

  const handleManualCardClick = (methodology, forceManual = false) => {
    try { track('CARD_CLICK', { id: methodology?.name, group: 'methodology', mode: 'manual' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // Permitir ejecución si está en modo manual O si se fuerza (clic en botón Seleccionar)
    if (localState.selectionMode === 'manual' || forceManual) {
      // Si es Calistenia, mostrar el modal específico
      if (methodology.name === 'Calistenia') {
        ui.showModal('calisteniaManual');
        return;
      }

      // Si es Heavy Duty, mostrar el modal específico
      if (methodology.name === 'Heavy Duty') {
        ui.showModal('heavyDutyManual');
        return;
      }

      // Si es Hipertrofia, mostrar el modal específico
      if (methodology.name === 'Hipertrofia') {
        ui.showModal('hipertrofiaManual');
        return;
      }

      // Si es Powerlifting, mostrar el modal específico
      if (methodology.name === 'Powerlifting') {
        ui.showModal('powerliftingManual');
        return;
      }

      // Si es CrossFit, mostrar el modal específico
      if (methodology.name === 'CrossFit') {
        ui.showModal('crossfitManual');
        return;
      }

      // Si es Funcional, mostrar el modal específico
      if (methodology.name === 'Funcional') {
        ui.showModal('funcionalManual');
        return;
      }

      // Si es Halterofilia, mostrar el modal específico
      if (methodology.name === 'Halterofilia') {
        ui.showModal('halterofíliaManual');
        return;
      }

      // Si es Entrenamiento en Casa, mostrar el modal específico
      if (methodology.name === 'Entrenamiento en Casa') {
        ui.showModal('casaManual');
        return;
      }

      updateLocalState({
        pendingMethodology: methodology,
        versionSelectionData: {
          isAutomatic: false,
          selectedMethodology: methodology.name
        }
      });
      ui.showModal('versionSelection');
    }
  };

  const confirmManualSelection = async (versionConfig) => {
    try { track('ACTION', { id: 'manual_version_confirm', methodology: localState.pendingMethodology?.name, version: versionConfig?.version }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    if (!localState.pendingMethodology) return;

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST: Usuario eligió metodología manual
    // Si hay plan → limpiar y generar nuevo con metodología elegida
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log(`🔄 Plan activo detectado en BD, limpiando para generar nuevo (${localState.pendingMethodology?.name})...`);
      await cancelPlan(); // Limpiar plan anterior
      await syncWithDatabase(); // Sincronizar estado
    }

    ui.hideModal('versionSelection');

    try {
      console.log(`🎯 Generando plan manual para metodología: ${localState.pendingMethodology.name}`);

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: (localState.pendingMethodology.name || '').toLowerCase(),
        versionConfig: versionConfig || { version: 'adapted', customWeeks: 4 }
      });

      if (result.success) {
        console.log('✅ Plan manual generado exitosamente');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL (usar result.plan en lugar de plan.currentPlan)
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan');
      }

    } catch (error) {
      console.error('❌ Error generando plan manual:', error);
      ui.setError(error.message || 'Error al generar el plan de entrenamiento');
    } finally {
      updateLocalState({ pendingMethodology: null });
    }
  };

  const handleOpenDetails = (methodology) => {
    try { track('BUTTON_CLICK', { id: 'ver_detalles', methodology: methodology?.name }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    updateLocalState({ detailsMethod: methodology });
    ui.showModal('methodologyDetails');
  };

  const handleCalisteniaManualGenerate = async (calisteniaData) => {
    try { track('ACTION', { id: 'generate_calistenia' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    console.log('🎯 [METHODOLOGIES] Iniciando generación de Calistenia Manual:', {
      timestamp: new Date().toISOString(),
      level: calisteniaData.level || calisteniaData.selectedLevel,
      hasGoals: !!calisteniaData.goals,
      dayOfWeek: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
    });

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST:
    // - Sin plan → generar
    // - Con plan → usuario quiere NUEVO plan, limpiar anterior y generar
    // - Para continuar plan existente → usar botón "Ir a Entrenamientos"

    // 🚀 Verificar desde BD (no localStorage)
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 [METHODOLOGIES] Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan(); // Limpiar plan anterior
      await syncWithDatabase(); // Sincronizar estado
    }

    try {
      console.log('🤸‍♀️ [METHODOLOGIES] Llamando a generatePlan...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'calistenia',
        calisteniaData
      });

      if (result.success) {
        console.log('✅ Plan de calistenia generado exitosamente');
        ui.hideModal('calisteniaManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL (usar result.plan en lugar de plan.currentPlan)
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de calistenia');
      }

    } catch (error) {
      console.error('❌ Error generando plan de calistenia:', error);
      ui.setError(error.message || 'Error al generar el plan de calistenia');
    }
  };

  const handleHeavyDutyManualGenerate = async (heavyDutyData) => {
    try { track('ACTION', { id: 'generate_heavy_duty' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('💪 Generando plan de Heavy Duty...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'heavy-duty',
        heavyDutyData
      });

      if (result.success) {
        console.log('✅ Plan de Heavy Duty generado exitosamente');
        ui.hideModal('heavyDutyManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de Heavy Duty');
      }

    } catch (error) {
      console.error('❌ Error generando plan de Heavy Duty:', error);
      ui.setError(error.message || 'Error al generar el plan de Heavy Duty');
    }
  };

  const handleHipertrofiaManualGenerate = async (hipertrofiaData) => {
    try { track('ACTION', { id: 'generate_hipertrofia' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('🏋️ Generando plan de Hipertrofia...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'hipertrofia',
        hipertrofiaData
      });

      if (result.success) {
        console.log('✅ Plan de Hipertrofia generado exitosamente');
        ui.hideModal('hipertrofiaManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de Hipertrofia');
      }

    } catch (error) {
      console.error('❌ Error generando plan de Hipertrofia:', error);
      ui.setError(error.message || 'Error al generar el plan de Hipertrofia');
    }
  };

  const handlePowerliftingManualGenerate = async (powerliftingData) => {
    try { track('ACTION', { id: 'generate_powerlifting' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('🏋️ Generando plan de Powerlifting...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'powerlifting',
        powerliftingData
      });

      if (result.success) {
        console.log('✅ Plan de Powerlifting generado exitosamente');
        ui.hideModal('powerliftingManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de Powerlifting');
      }

    } catch (error) {
      console.error('❌ Error generando plan de Powerlifting:', error);
      ui.setError(error.message || 'Error al generar el plan de Powerlifting');
    }
  };

  const handleCrossFitManualGenerate = async (crossfitData) => {
    try { track('ACTION', { id: 'generate_crossfit' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('🏋️‍♀️ Generando plan de CrossFit...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'crossfit',
        crossfitData
      });

      if (result.success) {
        console.log('✅ Plan de CrossFit generado exitosamente');
        ui.hideModal('crossfitManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de CrossFit');
      }

    } catch (error) {
      console.error('❌ Error generando plan de CrossFit:', error);
      ui.setError(error.message || 'Error al generar el plan de CrossFit');
    }
  };

  const handleFuncionalManualGenerate = async (funcionalData) => {
    try { track('ACTION', { id: 'generate_funcional' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('⚙️ Generando plan de Entrenamiento Funcional...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'funcional',
        funcionalData
      });

      if (result.success) {
        console.log('✅ Plan de Funcional generado exitosamente');
        ui.hideModal('funcionalManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de Funcional');
      }

    } catch (error) {
      console.error('❌ Error generando plan de Funcional:', error);
      ui.setError(error.message || 'Error al generar el plan de Funcional');
    }
  };

  const handleHalterofíliaManualGenerate = async (halterofíliaData) => {
    try { track('ACTION', { id: 'generate_halterofilia' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('🏋️ Generando plan de Halterofilia...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'halterofilia',
        halterofíliaData
      });

      if (result.success) {
        console.log('✅ Plan de Halterofilia generado exitosamente');
        console.log('🔍 Datos del plan generado:', {
          hasPlan: !!result.plan,
          methodologyPlanId: result.methodologyPlanId || result.planId,
          planId: result.planId,
          hasMetadata: !!result.metadata
        });

        ui.hideModal('halterofíliaManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de Halterofilia');
      }

    } catch (error) {
      console.error('❌ Error generando plan de Halterofilia:', error);
      ui.setError(error.message || 'Error al generar el plan de Halterofilia');
    }
  };

  const handleCasaManualGenerate = async (casaData) => {
    try { track('ACTION', { id: 'generate_casa' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }

    // 🎯 FLUJO SIMPLIFICADO - SUPABASE FIRST
    const hasActivePlanInDB = await hasActivePlanFromDB();
    if (hasActivePlanInDB) {
      console.log('🔄 Plan activo detectado en BD, limpiando para generar nuevo...');
      await cancelPlan();
      await syncWithDatabase();
    }

    try {
      console.log('🏠 Generando plan de Entrenamiento en Casa...');

      // Usar generatePlan del WorkoutContext
      const result = await generatePlan({
        mode: 'manual',
        methodology: 'entrenamiento-casa',
        casaData
      });

      if (result.success) {
        console.log('✅ Plan de Entrenamiento en Casa generado exitosamente');
        ui.hideModal('casaManual');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar el plan de Entrenamiento en Casa');
      }

    } catch (error) {
      console.error('❌ Error generando plan de Casa:', error);
      ui.setError(error.message || 'Error al generar el plan de Entrenamiento en Casa');
    }
  };

  const handleStartTraining = async () => {
    try {
      try { track('BUTTON_CLICK', { id: 'start_training' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
      console.log('🚀 Iniciando sesión de entrenamiento...');

      console.log('🔍 Estado del plan antes de confirmar:', {
        hasPlan: !!plan.currentPlan,
        methodologyPlanId: plan.methodologyPlanId,
        planType: plan.planType,
        methodology: plan.methodology,
        status: plan.status
      });

      if (!plan.currentPlan || !plan.methodologyPlanId) {
        throw new Error('No hay plan generado para iniciar');
      }

      console.log('🎯 PASO 1: Confirmando plan con ID:', plan.methodologyPlanId);

      // 🎯 NUEVO: Confirmar el plan ANTES de iniciar sesión (draft → active)
      const confirmResponse = await fetch('/api/routines/confirm-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          methodology_plan_id: plan.methodologyPlanId
        })
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Error al confirmar el plan');
      }

      const confirmData = await confirmResponse.json();
      console.log('✅ Plan confirmado exitosamente:', confirmData);

      console.log('🎯 PASO 2: Iniciando sesión...');

      // Usar startSession del WorkoutContext (DESPUÉS de confirmar)
      // Enviar el nombre real del día en español (e.g., 'Viernes') para evitar fallback 'today'
      const _todayName = new Date().toLocaleDateString('es-ES', { weekday: 'long' });
      const dayNameEs = _todayName.charAt(0).toUpperCase() + _todayName.slice(1);
      const result = await startSession({
        methodologyPlanId: plan.methodologyPlanId,
        dayName: dayNameEs
      });

      if (result.success) {
        console.log('✅ Sesión iniciada, session_id:', result.session_id);

        // 🔥 CRÍTICO: Cargar los ejercicios de la sesión INMEDIATAMENTE después de iniciarla
        try {
          const { getSessionProgress } = await import('../routines/api');
          const progressData = await getSessionProgress(result.session_id);
          console.log('✅ Ejercicios cargados para la sesión:', progressData);

          // Verificar que los ejercicios se cargaron correctamente
          if (!progressData.exercises || progressData.exercises.length === 0) {
            throw new Error('La sesión no tiene ejercicios disponibles');
          }

          console.log('✅ Ejercicios disponibles:', progressData.exercises.length);

          // 🔥 Guardar los datos de la sesión en el estado local
          // 🎯 MAPEAR exercise_name → nombre para compatibilidad con el modal
          const mappedExercises = progressData.exercises.map(ex => ({
            ...ex,
            nombre: ex.exercise_name || ex.nombre, // Priorizar exercise_name del backend
            series: ex.series_total || ex.series,
            repeticiones: ex.repeticiones,
            descanso_seg: ex.descanso_seg,
            intensidad: ex.intensidad,
            tempo: ex.tempo,
            notas: ex.notas,
            status: ex.status,
            series_completed: ex.series_completed || 0,
            time_spent_seconds: ex.time_spent_seconds || 0
          }));

          setSessionData({
            ejercicios: mappedExercises,
            session_id: result.session_id,
            sessionId: result.session_id,
            currentExerciseIndex: 0
          });

        } catch (exerciseError) {
          console.error('❌ Error cargando ejercicios:', exerciseError);
          ui.setError('Error cargando ejercicios de la sesión');
          return;
        }

        ui.hideModal('planConfirmation');
        ui.showModal('warmup');
        console.log('🔥 Iniciando calentamiento...');
      } else {
        throw new Error(result.error || 'Error al iniciar el entrenamiento');
      }

    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      ui.setError(error.message || 'Error al iniciar el entrenamiento');
    }
  };

  const handleWarmupComplete = async () => {
    try { track('BUTTON_CLICK', { id: 'warmup_complete' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    console.log('✅ Calentamiento completado');

    ui.hideModal('warmup');
    ui.showModal('routineSession');

    console.log('🔍 Estado después de warmup:', {
      showRoutineSession: ui.showRoutineSession,
      sessionId: session.sessionId,
      hasSessionData: !!sessionData,
      hasExercises: !!sessionData?.ejercicios
    });
  };

  const handleSkipWarmup = () => {
    try { track('BUTTON_CLICK', { id: 'warmup_skip' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    console.log('⭕ Calentamiento saltado');
    ui.hideModal('warmup');
    ui.showModal('routineSession');
  };

  const handleCloseWarmup = () => {
    try { track('BUTTON_CLICK', { id: 'warmup_close' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    console.log('❌ Calentamiento cerrado → abrir RoutineSessionModal');
    ui.hideModal('warmup');
    ui.showModal('routineSession');
  };

  const handleEndSession = () => {
    try { track('BUTTON_CLICK', { id: 'end_session' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    console.log('🏁 Sesión terminada, navegando con WorkoutContext');
    ui.hideModal('routineSession');
    goToTraining();
  };

  const handleGenerateAnother = async (feedbackData) => {
    try { track('BUTTON_CLICK', { id: 'generate_another' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); }
    try {
      console.log('🔄 Generando nuevo plan con feedback:', feedbackData);

      // Usar generatePlan del WorkoutContext con feedback
      const result = await generatePlan({
        mode: 'regenerate',
        feedback: feedbackData,
        previousPlan: plan.currentPlan
      });

      if (result.success) {
        console.log('✅ Nuevo plan generado con feedback');

        // 🛡️ VALIDAR DATOS ANTES DE MOSTRAR MODAL (usar result.plan en lugar de plan.currentPlan)
        const validation = validatePlanData(result.plan);
        if (validation.isValid) {
          ui.showModal('planConfirmation');
        } else {
          console.error('❌ Plan inválido:', validation.error);
          ui.setError(`Plan generado incorrectamente: ${validation.error}`);
        }
      } else {
        throw new Error(result.error || 'Error al generar nuevo plan');
      }

    } catch (error) {
      console.error('❌ Error al generar nuevo plan:', error);
      ui.setError(error.message || 'Error al generar nuevo plan');
    }
  };

  // ===============================================
  // 🎨 RENDER
  // ===============================================

  return (
    <div className="p-6 bg-black text-white min-h-screen pt-20">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Metodologías de Entrenamiento</h1>
      <p className="text-gray-400 mb-6">
        Automático (IA) o Manual (IA pero eligiendo que metodología realizar)
      </p>

      {ui.error && (
        <Alert className="mb-6 bg-red-900/30 border-red-400/40">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <AlertDescription className="text-red-200">{ui.error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-black/90 border-yellow-400/20 mb-8">
        <div className="p-4">
          <div className="flex items-center">
            <Settings className="mr-2 text-yellow-400" />
            <span className="text-white font-semibold">Modo de selección</span>
          </div>
          <div className="text-gray-400 mb-2">
            Automático (IA) o Manual (IA pero eligiendo que metodología realizar)
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div
              onClick={() => { updateLocalState({ selectionMode: 'auto' }); try { track('CARD_CLICK', { id: 'selection-mode', value: 'auto' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); } }}
              className={`p-4 rounded-lg transition-all bg-black/80 cursor-pointer
                ${localState.selectionMode === 'auto'
                  ? 'border border-yellow-400 ring-2 ring-yellow-400/30'
                  : 'border border-yellow-400/20 hover:border-yellow-400/40'}`}
            >
              <div className="flex items-start gap-3">
                <RadioGroup
                  value={localState.selectionMode}
                  onValueChange={(mode) => updateLocalState({ selectionMode: mode })}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="auto" id="auto" />
                    <Label htmlFor="auto" className="text-white font-semibold flex items-center gap-2">
                      <Brain className="w-4 h-4 text-yellow-400" />
                      Automático (Recomendado)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <p className="text-gray-400 text-sm mt-2">La IA elige la mejor metodología para tu perfil.</p>
              {localState.selectionMode === 'auto' && (
                <div className="mt-4">
                  <Button
                    onClick={() => handleActivateIA(null)}
                    disabled={ui.isLoading}
                    className="bg-yellow-400 text-black hover:bg-yellow-300"
                  >
                    <Zap className={`w-4 h-4 mr-2 ${ui.isLoading ? 'animate-pulse' : ''}`} />
                    {ui.isLoading ? 'Procesando…' : 'Activar IA'}
                  </Button>
                </div>
              )}
            </div>

            <div
              onClick={() => { updateLocalState({ selectionMode: 'manual' }); try { track('CARD_CLICK', { id: 'selection-mode', value: 'manual' }, { component: 'MethodologiesScreen' }); } catch (e) { console.warn('Track error:', e); } }}
              className={`p-4 rounded-lg transition-all cursor-pointer bg-black/80
                ${localState.selectionMode === 'manual'
                  ? 'border border-yellow-400 ring-2 ring-yellow-400/30'
                  : 'border border-yellow-400/20 hover:border-yellow-400/40'}`}
              title="Pulsa para activar el modo manual y luego elige una metodología"
            >
              <div className="flex items-start gap-3">
                <RadioGroup
                  value={localState.selectionMode}
                  onValueChange={(mode) => updateLocalState({ selectionMode: mode })}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual" className="text-white font-semibold flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-yellow-400" />
                      Manual (tú eliges)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Selecciona una metodología y la IA creará tu plan con esa base.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {METHODOLOGIES.map((methodology) => (
          <MethodologyCard
            key={methodology.name}
            methodology={methodology}
            manualActive={localState.selectionMode === 'manual'}
            onDetails={handleOpenDetails}
            onSelect={handleManualCardClick}
          />
        ))}
      </div>

      {/* Loading Overlay */}
      {ui.isLoading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-black/90 border border-yellow-400/30 rounded-lg p-8 text-center shadow-xl">
            <svg className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <p className="text-white font-semibold text-lg">La IA está generando tu entrenamiento</p>
            <p className="text-gray-400 text-sm mt-2">Analizando tu perfil para crear la rutina idónea…</p>
          </div>
        </div>
      )}

      {/* =============================================== */}
      {/* 🎭 MODALES */}
      {/* =============================================== */}

      {/* Modal de detalles de metodología */}
      <MethodologyDetailsDialog
        open={ui.showMethodologyDetails}
        onOpenChange={(show) => show ? ui.showModal('methodologyDetails') : ui.hideModal('methodologyDetails')}
        detailsMethod={localState.detailsMethod}
        selectionMode={localState.selectionMode}
        onClose={() => ui.hideModal('methodologyDetails')}
        onSelect={handleManualCardClick}
      />

      {/* Modal de selección de versión */}
      <MethodologyVersionSelectionModal
        isOpen={ui.showVersionSelection}
        onClose={() => {
          ui.hideModal('versionSelection');
          updateLocalState({ versionSelectionData: null });
        }}
        onConfirm={localState.versionSelectionData?.isAutomatic ? handleVersionSelectionConfirm : confirmManualSelection}
        userProfile={{...userData, ...user}}
        isAutomatic={localState.versionSelectionData?.isAutomatic}
        selectedMethodology={localState.versionSelectionData?.selectedMethodology}
      />

      {/* Modal de advertencia de entrenamiento activo */}
      {ui.showActiveTrainingWarning && (
        <Dialog open={ui.showActiveTrainingWarning} onOpenChange={() => ui.hideModal('activeTrainingWarning')}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <DialogTitle>Entrenamiento en Marcha</DialogTitle>
              </div>
              <DialogDescription>
                Tienes un entrenamiento activo. Si generas un nuevo entrenamiento, perderás el progreso actual.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  ui.hideModal('activeTrainingWarning');
                  goToTraining();
                }}
              >
                Continuar Entrenamiento
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  ui.hideModal('activeTrainingWarning');
                  ui.showModal('versionSelection');
                }}
              >
                Crear Nuevo Entrenamiento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Calistenia Manual */}
      {ui.showCalisteniaManual && (
        <Dialog open={ui.showCalisteniaManual} onOpenChange={() => ui.hideModal('calisteniaManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Calistenia Manual</DialogTitle>
            </DialogHeader>
            <CalisteniaManualCard
              onGenerate={handleCalisteniaManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Heavy Duty Manual */}
      {ui.showHeavyDutyManual && (
        <Dialog open={ui.showHeavyDutyManual} onOpenChange={() => ui.hideModal('heavyDutyManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Heavy Duty Manual</DialogTitle>
            </DialogHeader>
            <HeavyDutyManualCard
              onGenerate={handleHeavyDutyManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Hipertrofia Manual */}
      {ui.showHipertrofiaManual && (
        <Dialog open={ui.showHipertrofiaManual} onOpenChange={() => ui.hideModal('hipertrofiaManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Hipertrofia Manual</DialogTitle>
            </DialogHeader>
            <HipertrofiaManualCard
              onGenerate={handleHipertrofiaManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Powerlifting Manual */}
      {ui.showPowerliftingManual && (
        <Dialog open={ui.showPowerliftingManual} onOpenChange={() => ui.hideModal('powerliftingManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Powerlifting Manual</DialogTitle>
            </DialogHeader>
            <PowerliftingManualCard
              onGenerate={handlePowerliftingManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de CrossFit Manual */}
      {ui.showCrossFitManual && (
        <Dialog open={ui.showCrossFitManual} onOpenChange={() => ui.hideModal('crossfitManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>CrossFit Manual</DialogTitle>
            </DialogHeader>
            <CrossFitManualCard
              onGenerate={handleCrossFitManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Funcional Manual */}
      {ui.showFuncionalManual && (
        <Dialog open={ui.showFuncionalManual} onOpenChange={() => ui.hideModal('funcionalManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Entrenamiento Funcional Manual</DialogTitle>
            </DialogHeader>
            <FuncionalManualCard
              onGenerate={handleFuncionalManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Halterofilia Manual */}
      {ui.showHalterofíliaManual && (
        <Dialog open={ui.showHalterofíliaManual} onOpenChange={() => ui.hideModal('halterofíliaManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Halterofilia Manual</DialogTitle>
            </DialogHeader>
            <HalterofíliaManualCard
              onGenerate={handleHalterofíliaManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Entrenamiento en Casa Manual */}
      {ui.showCasaManual && (
        <Dialog open={ui.showCasaManual} onOpenChange={() => ui.hideModal('casaManual')}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Entrenamiento en Casa Manual</DialogTitle>
            </DialogHeader>
            <CasaManualCard
              onGenerate={handleCasaManualGenerate}
              isLoading={ui.isLoading}
              error={ui.error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de confirmación del plan */}
      <TrainingPlanConfirmationModal
        isOpen={ui.showPlanConfirmation}
        onClose={() => ui.hideModal('planConfirmation')}
        onStartTraining={handleStartTraining}
        onGenerateAnother={handleGenerateAnother}
        plan={plan.currentPlan}
        methodology={plan.methodology}
        isLoading={ui.isLoading}
        error={ui.error}
        isConfirming={ui.isLoading}
      />

      {/* Modal de calentamiento */}
      {ui.showWarmup && session.sessionId && (
        <WarmupModal
          sessionId={session.sessionId}
          level={plan.currentPlan?.level || 'básico'}
          onComplete={handleWarmupComplete}
          onSkip={handleSkipWarmup}
          onClose={handleCloseWarmup}
        />
      )}

      {/* Modal de sesión de rutina (render condicional estricto) */}
      {ui.showRoutineSession && session.sessionId && sessionData && sessionData.ejercicios && (
        <RoutineSessionModal
          isOpen={ui.showRoutineSession}
          session={sessionData}
          sessionId={session.sessionId}
          onClose={() => {
            ui.hideModal('routineSession');
            setSessionData(null); // Limpiar datos de sesión al cerrar
          }}
          onFinishExercise={(exerciseIndex, progressData) =>
            updateExercise(exerciseIndex, progressData)
          }
          onSkipExercise={(exerciseIndex, progressData) =>
            updateExercise(exerciseIndex, progressData)
          }
          onCancelExercise={(exerciseIndex, progressData) =>
            updateExercise(exerciseIndex, progressData)
          }
          onEndSession={handleEndSession}
          navigateToRoutines={() => navigate('/routines')}
        />
      )}
    </div>
  );
}
