import React, { useReducer, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Settings, Brain, User as UserIcon, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { METHODOLOGIES, sanitizeProfile } from './methodologiesData.js';
import MethodologyDetailsDialog from './shared/MethodologyDetailsDialog.jsx';
import TrainingPlanConfirmationModal from '../routines/TrainingPlanConfirmationModal.jsx';
import RoutineSessionModal from '../routines/RoutineSessionModal.jsx';
import WarmupModal from '../routines/WarmupModal.jsx';
import { startSession, updateExercise } from '../routines/api.js';
import { useRoutineCache, CACHE_KEYS } from '../../hooks/useRoutineCache.js';
import MethodologyVersionSelectionModal from './shared/MethodologyVersionSelectionModal.jsx';
import CalisteniaManualCard from './methodologies/CalisteniaManual/CalisteniaManualCard.jsx';
import useMethodologyAPI from '../../hooks/useMethodologyAPI.js';

// ===============================================
// MODERNIZACIÓN: Estado Centralizado con useReducer
// ===============================================

const METHODOLOGY_STATE_INITIAL = {
  // Estado de UI general
  ui: {
    isLoading: false,
    error: null,
    selectionMode: 'automatico'
  },

  // Estado de modales
  modals: {
    showDetails: false,
    showPersonalizedMessage: false,
    showVersionSelection: false,
    showActiveTrainingWarning: false,
    showCalisteniaManual: false,
    showConfirmationModal: false,
    showWarmupModal: false,
    showRoutineSessionModal: false
  },

  // Estado del plan generado
  plan: {
    generated: null,
    methodologyPlanId: null,
    methodology: '',
    personalizedMessage: '',
    versionSelectionData: null
  },

  // Estado de sesión de entrenamiento
  session: {
    current: null,
    sessionId: null,
    pendingWarmupData: null
  },

  // Estado de datos temporales
  temp: {
    pendingMethodology: null,
    detailsMethod: null,
    activeTrainingInfo: null
  }
};

const methodologyReducer = (state, action) => {
  switch (action.type) {
    // Acciones de UI
    case 'SET_LOADING':
      return { ...state, ui: { ...state.ui, isLoading: action.payload }};

    case 'SET_ERROR':
      return { ...state, ui: { ...state.ui, error: action.payload }};

    case 'SET_SELECTION_MODE':
      return { ...state, ui: { ...state.ui, selectionMode: action.payload }};

    // Acciones de modales
    case 'OPEN_MODAL':
      return {
        ...state,
        modals: { ...state.modals, [action.modal]: true }
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modals: { ...state.modals, [action.modal]: false }
      };

    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        modals: Object.keys(state.modals).reduce((acc, key) => ({ ...acc, [key]: false }), {})
      };

    // Acciones del plan
    case 'SET_GENERATED_PLAN': {
      // Persistir automáticamente en localStorage
      const planData = {
        plan: action.payload.plan,
        methodologyPlanId: action.payload.methodologyPlanId,
        methodology: action.payload.methodology,
        personalizedMessage: action.payload.personalizedMessage || action.payload.justification,
        timestamp: Date.now()
      };

      localStorage.setItem('methodology_generated_plan', JSON.stringify(planData));

      return {
        ...state,
        plan: {
          generated: action.payload.plan,
          methodologyPlanId: action.payload.methodologyPlanId,
          methodology: action.payload.methodology,
          personalizedMessage: action.payload.personalizedMessage || action.payload.justification,
          versionSelectionData: state.plan.versionSelectionData
        }
      };
    }

    case 'SET_VERSION_SELECTION_DATA':
      return {
        ...state,
        plan: { ...state.plan, versionSelectionData: action.payload }
      };

    // Acciones de sesión
    case 'SET_CURRENT_SESSION':
      return {
        ...state,
        session: {
          ...state.session,
          current: action.payload.session,
          sessionId: action.payload.sessionId
        }
      };

    case 'SET_PENDING_WARMUP':
      return {
        ...state,
        session: { ...state.session, pendingWarmupData: action.payload }
      };

    // Acciones de datos temporales
    case 'SET_TEMP_DATA':
      return {
        ...state,
        temp: { ...state.temp, [action.key]: action.payload }
      };

    // Restaurar estado desde localStorage
    case 'RESTORE_STATE':
      return { ...state, ...action.payload };

    // Reset completo
    case 'RESET_STATE':
      localStorage.removeItem('methodology_generated_plan');
      localStorage.removeItem('methodology_session_state');
      return { ...METHODOLOGY_STATE_INITIAL };

    default:
      console.warn(`Acción no reconocida: ${action.type}`);
      return state;
  }
};

export default function MethodologiesScreen() {
  const navigate = useNavigate();
  const { invalidateCache } = useRoutineCache();
  const { user } = useAuth();
  const { userData } = useUserContext();

  // ===============================================
  // MODERNIZACIÓN: useReducer reemplaza 22 useState
  // ===============================================

  const [state, dispatch] = useReducer(methodologyReducer, METHODOLOGY_STATE_INITIAL);

  // Variables de conveniencia para acceder al estado
  const { ui, modals, plan, session, temp } = state;

  // ===============================================
  // MODERNIZACIÓN: Recuperación automática de sesión
  // ===============================================

  useEffect(() => {
    const recoverSession = () => {
      try {
        // Recuperar plan generado
        const savedPlan = localStorage.getItem('methodology_generated_plan');
        if (savedPlan) {
          const planData = JSON.parse(savedPlan);
          const age = Date.now() - planData.timestamp;

          // Si el plan tiene menos de 30 minutos, recuperarlo
          if (age < 30 * 60 * 1000) {
            console.log('🔄 Recuperando plan generado desde localStorage');
            dispatch({
              type: 'SET_GENERATED_PLAN',
              payload: planData
            });
          } else {
            // Limpiar plan expirado
            localStorage.removeItem('methodology_generated_plan');
          }
        }

        // Recuperar sesión activa
        const savedSession = localStorage.getItem('methodology_session_state');
        if (savedSession) {
          const sessionData = JSON.parse(savedSession);
          const age = Date.now() - sessionData.timestamp;

          // Si la sesión tiene menos de 2 horas
          if (age < 2 * 60 * 60 * 1000) {
            console.log('🔄 Recuperando sesión activa desde localStorage');
            dispatch({
              type: 'SET_CURRENT_SESSION',
              payload: sessionData
            });
          } else {
            localStorage.removeItem('methodology_session_state');
          }
        }
      } catch (error) {
        console.error('❌ Error recuperando sesión:', error);
        // Limpiar datos corruptos
        localStorage.removeItem('methodology_generated_plan');
        localStorage.removeItem('methodology_session_state');
      }
    };

    recoverSession();
  }, []);

  // ===============================================
  // MODERNIZACIÓN: Funciones helper para dispatch
  // ===============================================

  const setLoading = useCallback((isLoading) => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const openModal = useCallback((modalName) => {
    dispatch({ type: 'OPEN_MODAL', modal: modalName });
  }, []);

  const closeModal = useCallback((modalName) => {
    dispatch({ type: 'CLOSE_MODAL', modal: modalName });
  }, []);

  const setGeneratedPlan = useCallback((planData) => {
    dispatch({ type: 'SET_GENERATED_PLAN', payload: planData });
  }, []);

  const setCurrentSession = useCallback((sessionData) => {
    dispatch({ type: 'SET_CURRENT_SESSION', payload: sessionData });

    // Persistir también en localStorage
    const sessionState = {
      ...sessionData,
      timestamp: Date.now()
    };
    localStorage.setItem('methodology_session_state', JSON.stringify(sessionState));
  }, []);

  const setTempData = useCallback((key, value) => {
    dispatch({ type: 'SET_TEMP_DATA', key, payload: value });
  }, []);

  // ===============================================
  // COMPONENTE INLINE: MethodologyCard (eliminado archivo separado)
  // ===============================================

  const MethodologyCard = ({ methodology, manualActive, onDetails, onSelect }) => (
    <Card
      className={`bg-black/80 border-gray-700 transition-all duration-300 ${
        manualActive ? 'cursor-pointer hover:border-yellow-400/60 hover:scale-[1.01]' : 'hover:border-gray-600'
      }`}
      onClick={() => manualActive && onSelect(methodology)}
      role="button"
      tabIndex={manualActive ? 0 : -1}
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
            disabled={!manualActive}
            className={`flex-1 ${manualActive
              ? 'bg-yellow-400 text-black hover:bg-yellow-300'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (manualActive) onSelect(methodology);
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
  // MODERNIZACIÓN: Integración de Service Layer
  // ===============================================

  const methodologyAPI = useMethodologyAPI();

  // Función para verificar si hay entrenamiento activo
  const checkActiveTraining = async () => {
    const result = await methodologyAPI.checkActiveTraining();

    if (result.success) {
      return result.data;
    } else {
      console.error('Error verificando entrenamiento activo:', result.error || result.message || 'Error desconocido');
      return null;
    }
  };

  const handleActivateIA = async (forcedMethodology = null) => {
    if (!user) return;
    
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setTempData('activeTrainingInfo', activeTraining);
      openModal('showActiveTrainingWarning');
      return;
    }

    // Mostrar modal de selección de versión
    dispatch({
      type: 'SET_VERSION_SELECTION_DATA',
      payload: {
        isAutomatic: true,
        forcedMethodology
      }
    });
    openModal('showVersionSelection');
  };

  const handleVersionSelectionConfirm = async (versionConfig) => {
    closeModal('showVersionSelection');
    setLoading(true);
    setError(null);

    // Construir perfil completo con mapeo mejorado
    const rawProfile = { ...userData, ...user };
    const fullProfile = sanitizeProfile({
      ...rawProfile,
      // Asegurar campos críticos con nombres correctos
      peso_kg: rawProfile.peso || rawProfile.peso_kg,
      altura_cm: rawProfile.altura || rawProfile.altura_cm,
      años_entrenando: rawProfile.años_entrenando || rawProfile.anos_entrenando,
      nivel_entrenamiento: rawProfile.nivel || rawProfile.nivel_entrenamiento,
      objetivo_principal: rawProfile.objetivo_principal || rawProfile.objetivoPrincipal
    });
    
    try {
      console.log('🤖 Activando IA para generar plan metodológico...');

      // Usar endpoint unificado para modo automático
      const token = localStorage.getItem('token');
      const response = await fetch('/api/methodology/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: 'automatic',
          versionConfig: versionConfig || { version: 'adapted', customWeeks: 4 }
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'No se pudo generar el plan de entrenamiento.');
      }

      // Convertir respuesta del sistema unificado al formato esperado
      const convertedResult = {
        success: true,
        data: {
          plan: result.plan,
          methodologyPlanId: result.planId,
          routinePlanId: result.planId, // Usar mismo ID para compatibilidad
          metadata: result.metadata,
          justification: result.metadata?.userProfile ?
            `Plan automático generado para ${result.methodology}` :
            'Plan automático personalizado'
        }
      };

      // Usar resultado convertido en lugar de result original
      const finalResult = convertedResult;
      
      console.log('✅ Plan generado exitosamente:', finalResult.data.plan);

      // Guardar plan y mostrar mensaje personalizado (como en HomeTraining)
      const newGeneratedPlan = {
        plan: finalResult.data.plan,
        planSource: 'automatic',
        planId: finalResult.data.methodologyPlanId, // ID original de methodology_plans
        routinePlanId: finalResult.data.routinePlanId, // ID para routine_plans
        metadata: finalResult.data.metadata,
        metodologia: result.methodology || 'Automático'
      };

      setGeneratedPlan({
        plan: newGeneratedPlan.plan,
        methodologyPlanId: newGeneratedPlan.planId,
        methodology: newGeneratedPlan.metodologia || 'Automático',
        personalizedMessage: finalResult.data.justification
      });

      console.log('🛤️ Plan automático generado:', {
        methodologyPlanId: finalResult.data.methodologyPlanId,
        routinePlanId: finalResult.data.routinePlanId,
        migrationInfo: finalResult.data.metadata?.migrationInfo
      });
      
      // Construir mensaje personalizado para mostrar directamente en el modal del plan
      const baseMessage = result.data.plan.rationale ||
                          `La IA ha seleccionado ${result.data.plan.selected_style} como la metodología ideal para ti. ` +
                          `Plan de ${result.data.plan.duracion_total_semanas} semanas con ${result.data.plan.frecuencia_por_semana} entrenamientos por semana.`;
      
      // Obtener objetivo principal para personalizar los tips
      const objetivo = fullProfile?.objetivo_principal || userData?.objetivo_principal || 'general';
      let tip = '';
      
      if (objetivo === 'perder_peso' || objetivo === 'perdida_grasa') {
        tip = 'El objetivo principal es perder peso, lo que sugiere un enfoque en la quema de grasa con ejercicios de alta intensidad combinados con trabajo de fuerza.';
      } else if (objetivo === 'ganar_musculo' || objetivo === 'hipertrofia') {
        tip = 'El objetivo principal es ganar músculo, lo que sugiere un enfoque en la hipertrofia. Dado tu nivel de experiencia, se puede aplicar un plan avanzado y variado.';
      } else if (objetivo === 'fuerza') {
        tip = 'El objetivo principal es mejorar la fuerza, lo que requiere entrenamientos con cargas progresivas y movimientos básicos fundamentales.';
      } else if (objetivo === 'resistencia') {
        tip = 'El objetivo principal es mejorar la resistencia cardiovascular, combinando trabajo aeróbico con entrenamientos funcionales.';
      } else {
        tip = 'Plan equilibrado diseñado para mejorar tu condición física general con ejercicios variados y progresivos.';
      }
      
      const enhancedMessage = `${baseMessage}\n\n💡 ${tip}`;
      setGeneratedPlan({
        plan: newGeneratedPlan.plan,
        methodologyPlanId: newGeneratedPlan.planId,
        methodology: newGeneratedPlan.metodologia || 'Automático',
        personalizedMessage: enhancedMessage
      });
      console.log('🚀 Plan generado automáticamente, mostrando modal de confirmación...');

      setTimeout(() => {
        openModal('showConfirmationModal');
      }, 1500);

    } catch (err) {
      console.error('❌ Error generando plan:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCardClick = (methodology) => {
    if (ui.selectionMode === 'manual') {
      // Si es Calistenia, mostrar el modal específico
      if (methodology.name === 'Calistenia') {
        openModal('showCalisteniaManual');
        return;
      }
      
      setTempData('pendingMethodology', methodology);
      // Mostrar modal de selección de versión para manual también
      dispatch({
        type: 'SET_VERSION_SELECTION_DATA',
        payload: {
          isAutomatic: false,
          selectedMethodology: methodology.name
        }
      });
      openModal('showVersionSelection');
    }
  };

  const confirmManualSelection = async (versionConfig) => {
    if (!temp.pendingMethodology) return;
    
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setTempData('activeTrainingInfo', activeTraining);
      openModal('showActiveTrainingWarning');
      return;
    }
    
    closeModal('showVersionSelection');
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🎯 Generando plan manual para metodología: ${temp.pendingMethodology.name}`);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/methodology/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: 'manual',
          methodology: temp.pendingMethodology.name,
          versionConfig: versionConfig || { version: 'adapted', customWeeks: 4 }
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar el plan');
      }
      
      console.log('✅ Plan de metodología manual generado exitosamente');
      
      // Guardar plan y mostrar mensaje personalizado (como en HomeTraining)
      setGeneratedPlan({
        plan: result.plan,
        planSource: 'manual_methodology', 
        planId: result.planId, // ID original de methodology_plans
        routinePlanId: result.routinePlanId, // ID para routine_plans
        metodologia: temp.pendingMethodology.name
      });
      
      console.log('🛤️ Plan manual generado:', {
        methodologyPlanId: result.planId,
        routinePlanId: result.routinePlanId,
        migrationInfo: result.migrationInfo
      });
      
      // Mostrar mensaje personalizado con tips incluidos
      const baseMessage = result.plan.consideraciones || 
                          `Tu rutina de ${temp.pendingMethodology.name} ha sido generada exitosamente. ` +
                          `Plan de ${result.plan.duracion_total_semanas} semanas con ` + 
                          `${result.plan.frecuencia_por_semana} entrenamientos por semana.`;
      
      // Obtener objetivo principal para personalizar los tips
      const rawProfile = { ...userData, ...user };
      const fullProfile = sanitizeProfile({
        ...rawProfile,
        peso_kg: rawProfile.peso || rawProfile.peso_kg,
        altura_cm: rawProfile.altura || rawProfile.altura_cm,
        años_entrenando: rawProfile.años_entrenando || rawProfile.anos_entrenando,
        nivel_entrenamiento: rawProfile.nivel || rawProfile.nivel_entrenamiento,
        objetivo_principal: rawProfile.objetivo_principal || rawProfile.objetivoPrincipal
      });
      const objetivo = fullProfile?.objetivo_principal || userData?.objetivo_principal || 'general';
      let tip = '';
      
      if (objetivo === 'perder_peso' || objetivo === 'perdida_grasa') {
        tip = 'El objetivo principal es perder peso, lo que sugiere un enfoque en la quema de grasa con ejercicios de alta intensidad combinados con trabajo de fuerza.';
      } else if (objetivo === 'ganar_musculo' || objetivo === 'hipertrofia') {
        tip = 'El objetivo principal es ganar músculo, lo que sugiere un enfoque en la hipertrofia. Dado tu nivel de experiencia, se puede aplicar un plan avanzado y variado.';
      } else if (objetivo === 'fuerza') {
        tip = 'El objetivo principal es mejorar la fuerza, lo que requiere entrenamientos con cargas progresivas y movimientos básicos fundamentales.';
      } else if (objetivo === 'resistencia') {
        tip = 'El objetivo principal es mejorar la resistencia cardiovascular, combinando trabajo aeróbico con entrenamientos funcionales.';
      } else {
        tip = 'Plan equilibrado diseñado para mejorar tu condición física general con ejercicios variados y progresivos.';
      }
      
      const enhancedMessage = `${baseMessage}\n\n💡 ${tip}`;
      setGeneratedPlan({ ...plan, personalizedMessage: enhancedMessage });
      openModal('showPersonalizedMessage');

    } catch (error) {
      console.error('❌ Error generando plan manual:', error);
      setError(error.message || 'Error al generar el plan de entrenamiento');
    } finally {
      setLoading(false);
      // Limpiar estado de metodología pendiente
      setTempData('pendingMethodology', null);
    }
  };

  const handleOpenDetails = (m) => {
    setTempData('detailsMethod', m);
    openModal('showDetails');
  };

  // Función para manejar generación de calistenia manual Y especialista IA
  const handleCalisteniaManualGenerate = async (calisteniaData) => {
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setTempData('activeTrainingInfo', activeTraining);
      openModal('showActiveTrainingWarning');
      return;
    }

    // NO cerrar el modal hasta estar seguros de que todo salió bien
    setLoading(true);
    setError(null);

    try {
      // Detectar si es generación con IA Specialist o selección manual
      const isAISpecialist = calisteniaData.source === 'ai_evaluation';
      const endpoint = isAISpecialist ? '/api/calistenia-specialist/generate-plan' : '/api/calistenia-manual/generate';

      console.log(`🤸‍♀️ Generando plan de calistenia (${isAISpecialist ? 'IA Specialist' : 'Manual'})...`);
      console.log('📥 Datos de entrada:', calisteniaData);

      // Preparar payload según el tipo de generación
      let requestBody;
      if (isAISpecialist) {
        // Payload para IA Specialist
        requestBody = {
          userProfile: calisteniaData.userProfile,
          selectedLevel: calisteniaData.level,
          goals: calisteniaData.goals,
          exercisePreferences: calisteniaData.selectedMuscleGroups || []
        };
      } else {
        // Payload para selección manual (mantener formato original)
        requestBody = calisteniaData;
      }

      console.log('📤 Enviando request a:', endpoint);
      console.log('📤 Payload:', requestBody);

      const token = localStorage.getItem('token');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      // Intentar parsear la respuesta JSON
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('❌ Error parseando respuesta JSON:', jsonError);
        throw new Error(`Error del servidor: respuesta no válida (${response.status})`);
      }

      console.log('🔥 Respuesta del servidor:', {
        ok: response.ok,
        status: response.status,
        success: result?.success,
        hasplan: !!result?.plan,
        planId: result?.planId,
        error: result?.error,
        message: result?.message,
        planStructure: result?.plan ? Object.keys(result.plan) : 'no plan'
      });

      if (!response.ok || !result.success) {
        // Mejorar el mensaje de error con más detalles
        const errorMessage = result.message || result.error ||
                           `Error ${response.status}: ${response.statusText || 'Error al generar el plan de calistenia'}`;
        console.error('❌ Error del servidor:', errorMessage);
        console.error('📊 Respuesta completa del servidor:', result);
        throw new Error(errorMessage);
      }

      // ✅ NUEVA VALIDACIÓN: Verificar estructura del plan
      console.log('📊 Respuesta del servidor:', result);
      console.log('📋 Estructura del plan:', result.plan);

      if (!result.plan) {
        throw new Error('El servidor no devolvió un plan válido');
      }

      if (!result.plan.semanas || !Array.isArray(result.plan.semanas)) {
        console.error('❌ Plan inválido - falta array de semanas:', result.plan);
        throw new Error('El plan generado no tiene la estructura correcta (falta array de semanas)');
      }

      if (result.plan.semanas.length === 0) {
        console.error('❌ Plan inválido - array de semanas vacío');
        throw new Error('El plan generado no contiene semanas');
      }
      
      console.log(`✅ Plan de calistenia ${isAISpecialist ? 'IA Specialist' : 'Manual'} generado exitosamente`);

      // AHORA SÍ cerrar el modal ya que todo salió bien
      closeModal('showCalisteniaManual');

      // Preparar plan source según el tipo
      const planSource = isAISpecialist ? 'calistenia_specialist' : 'calistenia_manual';
      const metodologia = isAISpecialist ? 'Calistenia Specialist' : 'Calistenia Manual';

      console.log('🛤️ Plan de calistenia generado:', {
        type: isAISpecialist ? 'IA Specialist' : 'Manual',
        methodologyPlanId: result.planId,
        routinePlanId: result.routinePlanId,
        planSource: planSource
      });
      
      // Mensaje personalizado según el tipo de generación
      let baseMessage;
      if (isAISpecialist) {
        // Mensaje para IA Specialist
        const duracion = result.plan?.duracion_total_semanas || 4;
        const frecuencia = result.plan?.frecuencia_por_semana || 3;
        baseMessage = `🤖 La IA ha evaluado tu perfil y generado un plan de Calistenia nivel ${calisteniaData.level} optimizado para ti. ` +
                      `Plan de ${duracion} semanas con ${frecuencia} entrenamientos semanales.`;
      } else {
        // Mensaje para selección manual (mantener original)
        const frecuencia = result.plan?.frecuencia_por_semana || 3;
        baseMessage = `Tu plan de Calistenia Manual nivel ${calisteniaData.levelInfo?.name || calisteniaData.level} ha sido generado exitosamente. ` +
                      `Entrenarás ${calisteniaData.levelInfo?.frequency || `${frecuencia}x por semana`} con ejercicios específicos de calistenia.`;
      }
      
      // Tips según nivel (funciona para ambos tipos)
      let tip = '';
      const level = calisteniaData.level?.toLowerCase();
      if (level === 'basico') {
        tip = 'Comenzarás con movimientos fundamentales para construir una base sólida de fuerza y técnica.';
      } else if (level === 'intermedio') {
        tip = 'Trabajarás en movimientos más complejos como dominadas, fondos y progresiones hacia habilidades avanzadas.';
      } else if (level === 'avanzado') {
        tip = 'Te enfocarás en habilidades avanzadas como muscle-ups, handstands y movimientos estáticos de alto nivel.';
      }
      
      const enhancedMessage = `${baseMessage}\n\n💡 ${tip}`;
      setGeneratedPlan({ ...plan, personalizedMessage: enhancedMessage });
      openModal('showPersonalizedMessage');
      
      // NUEVO FLUJO: Mostrar modal de confirmación en lugar de navegar
      console.log('🚀 Plan de calistenia generado, mostrando modal de confirmación...');

      // Validar que tengamos un plan antes de continuar
      if (!result.plan) {
        throw new Error('El servidor no devolvió un plan válido');
      }

      // Guardar datos para el modal de confirmación
      setGeneratedPlan({
        plan: result.plan,
        methodologyPlanId: result.planId,
        methodology: metodologia,
        personalizedMessage: enhancedMessage
      });

      // Log para depuración
      console.log('📦 Datos guardados para confirmación:', {
        plan: result.plan ? 'Disponible' : 'No disponible',
        planId: result.planId,
        metodologia: metodologia,
        personalizedMessage: enhancedMessage
      });

      // Mostrar modal de confirmación (NO navegamos)
      setTimeout(() => {
        console.log('⏰ Abriendo modal de confirmación...');
        openModal('showConfirmationModal');
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error generando plan de calistenia:', error);

      // NO cerrar el modal cuando hay error para que el usuario pueda reintentar
      // El modal permanece abierto mostrando el error
      setError(error.message || 'Error al generar el plan de calistenia');

      // Mostrar una alerta más detallada si es un error de servidor
      if (error.message.includes('500') || error.message.includes('Error interno')) {
        setError('El servidor está temporalmente no disponible. Por favor, intenta de nuevo en unos momentos.');
      }

      // Opcionalmente, podemos mostrar una notificación toast o alert
      console.warn('⚠️ Modal de calistenia permanece abierto debido al error');
    } finally {
      setLoading(false);
    }
  };

  // NUEVA FUNCIÓN: Proceder al modal de confirmación
  const proceedToRoutinePlan = () => {
    closeModal('showPersonalizedMessage');
    // Mostrar modal de confirmación en lugar de navegar
    console.log('🚀 Mostrando modal de confirmación con plan generado');
    setTimeout(() => {
      openModal('showConfirmationModal');
    }, 1000);
  };

  // NUEVA FUNCIÓN: Generar otro plan con feedback
  const handleGenerateAnother = async (feedbackData) => {
    try {
      console.log('🔍 Generando nuevo plan con feedback:', feedbackData);
      setLoading(true);
      setError(null);

      // Preparar el payload con el feedback del usuario
      const token = localStorage.getItem('token');
      const endpoint = '/api/calistenia-specialist/generate-plan';

      // Obtener el plan actual para contexto
      const currentPlan = plan.generated?.plan;

      // Preparar payload mejorado con feedback
      const requestBody = {
        userProfile: plan.versionSelectionData?.userProfile || userData,
        selectedLevel: currentPlan?.level || 'intermedio',
        goals: plan.versionSelectionData?.goals || ['fuerza', 'resistencia'],
        exercisePreferences: plan.versionSelectionData?.selectedMuscleGroups || [],
        // NUEVO: Información de feedback
        previousPlan: {
          plan: currentPlan,
          feedback: feedbackData
        },
        regenerationReason: feedbackData.reasons,
        additionalInstructions: feedbackData.comments
      };

      console.log('🔄 Enviando request con feedback:', requestBody);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('❌ Error parseando respuesta JSON:', jsonError);
        throw new Error('Respuesta inválida del servidor');
      }

      if (!response.ok) {
        console.error('❌ Error en la respuesta:', result);
        throw new Error(result.message || `Error del servidor: ${response.status}`);
      }

      console.log('✅ Nuevo plan generado con feedback:', result);

      // Actualizar el estado con el nuevo plan
      if (result.plan) {
        setGeneratedPlan({
          plan: result.plan,
          methodologyPlanId: result.methodologyPlanId,
          methodology: plan.methodology,
          personalizedMessage: result.justification || 'Plan mejorado basado en tu feedback'
        });
        openModal('showPersonalizedMessage');

        console.log('🎯 Nuevo plan aplicado exitosamente');
      } else {
        throw new Error('Plan no encontrado en la respuesta');
      }

    } catch (error) {
      console.error('❌ Error al generar nuevo plan:', error);
      setError(error.message || 'Error al generar nuevo plan');
    } finally {
      setLoading(false);
    }
  };

  // NUEVA FUNCIÓN: Iniciar sesión de entrenamiento directamente
  const handleStartTraining = async () => {
    try {
      console.log('🚀 handleStartTraining called - Iniciando sesión de entrenamiento directamente...');
      setLoading(true);
      setError(null); // Limpiar errores previos

      if (!plan.generated?.plan || !plan.methodologyPlanId) {
        throw new Error('No hay plan generado para iniciar');
      }

      // PASO 1: ACTIVAR EL PLAN ANTES DE INICIAR LA SESIÓN
      console.log('🔄 Activando plan de entrenamiento...');

      const activationResult = await methodologyAPI.activatePlan(plan.methodologyPlanId, plan.generated.plan);

      if (!activationResult.success) {
        throw new Error(activationResult.message || 'Error al activar el plan');
      }

      console.log('✅ Plan activado exitosamente:', activationResult.data);

      // PASO 2: AHORA SÍ INICIAR LA SESIÓN DE ENTRENAMIENTO
      // Obtener día actual para empezar HOY, no el primer día del plan
      const today = new Date();
      const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const todayName = diasSemana[today.getDay()];

      // Buscar la sesión del día actual en la primera semana
      const firstWeek = plan.generated.plan.semanas?.[0];
      let todaySession = null;

      if (firstWeek?.sesiones) {
        todaySession = firstWeek.sesiones.find(sesion => sesion.dia === todayName);
      }

      // Si no hay sesión para hoy, tomar la primera disponible como fallback
      const sessionToUse = todaySession || firstWeek?.sesiones?.[0];

      if (!sessionToUse) {
        throw new Error('No se encontró sesión de entrenamiento');
      }

      console.log(`🎯 Iniciando rutina desde HOY (${todayName}) en lugar del primer día del plan`);

      // Crear sesión en backend usando el día actual
      const sessionResult = await startSession({
        methodology_plan_id: plan.methodologyPlanId,
        week_number: 1,
        day_name: todayName // Usar día actual, no firstSession.dia
      });

      // Preparar datos para RoutineSessionModal usando la sesión encontrada
      setCurrentSession({
        session: sessionToUse,
        sessionId: sessionResult.session_id
      });
      
      // Cerrar modal de confirmación y mostrar calentamiento PRIMERO
      closeModal('showConfirmationModal');

      // Guardar datos para después del calentamiento
      dispatch({ type: 'SET_PENDING_WARMUP', payload: { session: sessionToUse, sessionId: sessionResult.session_id } });

      // Mostrar modal de calentamiento
      openModal('showWarmupModal');
      console.log('🔥 Iniciando calentamiento antes del entrenamiento...');
      
    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      setError(error.message || 'Error al iniciar el entrenamiento');
    } finally {
      setLoading(false);
    }
  };

  // FUNCIONES PARA MANEJAR WARMUP MODAL
  const handleWarmupComplete = () => {
    console.log('✅ Calentamiento completado, iniciando entrenamiento principal');
    closeModal('showWarmupModal');

    if (session.pendingWarmupData) {
      setCurrentSession({
        session: session.pendingWarmupData.session,
        sessionId: session.pendingWarmupData.sessionId
      });
      openModal('showRoutineSessionModal');
      dispatch({ type: 'SET_PENDING_WARMUP', payload: null });
    }
  };

  const handleSkipWarmup = () => {
    console.log('⭕ Calentamiento saltado, yendo directo al entrenamiento');
    closeModal('showWarmupModal');

    if (session.pendingWarmupData) {
      setCurrentSession({
        session: session.pendingWarmupData.session,
        sessionId: session.pendingWarmupData.sessionId
      });
      openModal('showRoutineSessionModal');
      dispatch({ type: 'SET_PENDING_WARMUP', payload: null });
    }
  };

  const handleCloseWarmup = () => {
    console.log('❌ Calentamiento cancelado');
    closeModal('showWarmupModal');
    dispatch({ type: 'SET_PENDING_WARMUP', payload: null });
    // TODO: Cancelar la sesión creada si es necesario
  };

  // NUEVA FUNCIÓN: Al terminar RoutineSessionModal
  const handleEndSession = async () => {
    console.log('🏁 Sesión terminada, navegando a TodayTrainingTab');
    console.log('📋 Estado actual:', {
      methodologyPlanId: plan.methodologyPlanId,
      sessionId: session?.sessionId,
      localStorage: {
        methodology_plan_id: localStorage.getItem('currentMethodologyPlanId'),
        planStartDate: localStorage.getItem('currentRoutinePlanStartDate')
      }
    });

    closeModal('showRoutineSessionModal');

    // IMPORTANTE: Guardar estado en localStorage para persistencia
    localStorage.setItem('currentMethodologyPlanId', String(plan.methodologyPlanId));
    localStorage.setItem('currentRoutinePlanStartDate', new Date().toISOString().split('T')[0]);

    // Invalidar el caché del plan activo para forzar una nueva consulta
    console.log('🗑️ Invalidando caché de plan activo');
    invalidateCache(CACHE_KEYS.ACTIVE_PLAN);

    try {
      // Primero, obtener el plan activo actual para navegación correcta
      console.log('🔍 Buscando plan activo después de sesión...');

      const activeResult = await methodologyAPI.checkActiveTraining();
      const activeData = activeResult.success ? activeResult.data : null;
      console.log('📦 Respuesta de active-plan:', activeData);

      // SIEMPRE navegar con el plan actual, independientemente de la respuesta de active-plan
      // Esto es necesario porque el plan sigue activo después de completar una sesión
      if (activeData && activeData.hasActivePlan) {
        console.log('✅ Plan activo encontrado, navegando con datos completos:', {
          hasActivePlan: activeData.hasActivePlan,
          methodology_plan_id: activeData.methodology_plan_id,
          planStartDate: activeData.planStartDate
        });

        // Navegar con el plan completo para que RoutineScreen lo reconozca
        navigate('/routines', {
          state: {
            plan: activeData.routinePlan,
            methodology_plan_id: activeData.methodology_plan_id || plan.methodologyPlanId,
            planStartDate: activeData.planStartDate || new Date().toISOString().split('T')[0],
            activeTab: 'today',
            showProgress: true,
            fromSession: true,
            forceReload: true // Forzar recarga de datos
          }
        });
      } else {
        // IMPORTANTE: Si no encuentra plan activo pero tenemos methodology_plan_id,
        // es probable que sea un problema de timing. Navegar de todos modos.
        console.log('⚠️ No se encontró plan activo en API, pero navegando con datos conocidos');
        console.log('📋 Usando metodología actual:', plan.methodologyPlanId);
        console.log('📦 Plan de rutina actual:', plan.generated?.plan ? 'Disponible' : 'No disponible');

        // Si tenemos el plan de rutina actual, usarlo
        navigate('/routines', {
          state: {
            plan: plan.generated?.plan || null,
            methodology_plan_id: plan.methodologyPlanId,
            planStartDate: new Date().toISOString().split('T')[0],
            activeTab: 'today',
            showProgress: true,
            fromSession: true,
            forceReload: true
          }
        });
      }
    } catch (error) {
      console.error('Error obteniendo plan activo:', error);
      // En caso de error, navegar con datos básicos
      navigate('/routines', {
        state: {
          methodology_plan_id: plan.methodologyPlanId,
          planStartDate: new Date().toISOString().split('T')[0],
          activeTab: 'today',
          showProgress: true,
          fromSession: true
        }
      });
    }
  };

  // FUNCIÓN MEJORADA: Confirmar y activar plan de forma unificada
  const navigateToRoutines = async (overridePlan = null) => {
    const planContainer = overridePlan || plan.generated;

    if (!planContainer || !planContainer.plan) {
      console.error('❌ No hay plan de rutina disponible para navegar', { overridePlan, generatedPlan: plan.generated });
      setError('No se pudo preparar la rutina. Vuelve a intentar generar el plan.');
      return;
    }

    // NUEVO FLUJO UNIFICADO: Confirmar y activar plan de una vez
    try {
      setLoading(true);
      console.log('🚀 FLUJO MEJORADO: Confirmando y activando plan...');
      
      const result = await methodologyAPI.activatePlan(planContainer?.planId, planContainer.plan);

      if (!result.success) {
        throw new Error(result.message || 'Error confirmando el plan');
      }

      console.log('✅ Plan confirmado y activado exitosamente:', result.data);

      // Navegar directamente - el plan ya está listo
      navigate('/routines', {
        state: {
          planJustActivated: true,
          planData: result.data,
          successMessage: result.message,
          planSource: { label: 'IA Perfecto', detail: planContainer?.metadata?.model ? `(${planContainer.metadata.model})` : '' }
        }
      });

      // Limpiar estado
      setGeneratedPlan(null);
      closeModal('showPersonalizedMessage');
      
    } catch (error) {
      console.error('❌ Error en flujo unificado:', error);
      setError(`Error activando tu rutina: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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
              onClick={() => dispatch({ type: 'SET_SELECTION_MODE', payload: 'automatico' })}
              className={`p-4 rounded-lg transition-all bg-black/80 cursor-pointer
                ${ui.selectionMode === 'automatico'
                  ? 'border border-yellow-400 ring-2 ring-yellow-400/30'
                  : 'border border-yellow-400/20 hover:border-yellow-400/40'}`}
            >
              <div className="flex items-start gap-3">
                <RadioGroup value={ui.selectionMode} onValueChange={(mode) => dispatch({ type: 'SET_SELECTION_MODE', payload: mode })}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="automatico" id="automatico" />
                    <Label htmlFor="automatico" className="text-white font-semibold flex items-center gap-2">
                      <Brain className="w-4 h-4 text-yellow-400" />
                      Automático (Recomendado)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <p className="text-gray-400 text-sm mt-2">La IA elige la mejor metodología para tu perfil.</p>
              {ui.selectionMode === 'automatico' && (
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
              onClick={() => dispatch({ type: 'SET_SELECTION_MODE', payload: 'manual' })}
              className={`p-4 rounded-lg transition-all cursor-pointer bg-black/80
                ${ui.selectionMode === 'manual'
                  ? 'border border-yellow-400 ring-2 ring-yellow-400/30'
                  : 'border border-yellow-400/20 hover:border-yellow-400/40'}`}
              title="Pulsa para activar el modo manual y luego elige una metodología"
            >
              <div className="flex items-start gap-3">
                <RadioGroup value={ui.selectionMode} onValueChange={(mode) => dispatch({ type: 'SET_SELECTION_MODE', payload: mode })}>
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
        {METHODOLOGIES.map((m) => (
          <MethodologyCard
            key={m.name}
            methodology={m}
            manualActive={ui.selectionMode === 'manual'}
            onDetails={handleOpenDetails}
            onSelect={handleManualCardClick}
          />
        ))}
      </div>
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
      
      {/* Modal de confirmación eliminado - reemplazado por TrainingPlanConfirmationModal */}
      
      <MethodologyDetailsDialog
        open={modals.showDetails}
        onOpenChange={(show) => { if (show) { openModal('showDetails'); } else { closeModal('showDetails'); } }}
        detailsMethod={temp.detailsMethod}
        selectionMode={ui.selectionMode}
        onClose={() => closeModal('showDetails')}
        onSelect={handleManualCardClick}
      />

      {/* Modal de selección de versión */}
      <MethodologyVersionSelectionModal
        isOpen={modals.showVersionSelection}
        onClose={() => {
          closeModal('showVersionSelection');
          dispatch({ type: 'SET_VERSION_SELECTION_DATA', payload: null });
        }}
        onConfirm={plan.versionSelectionData?.isAutomatic ? handleVersionSelectionConfirm : confirmManualSelection}
        userProfile={{...userData, ...user}}
        isAutomatic={plan.versionSelectionData?.isAutomatic}
        selectedMethodology={plan.versionSelectionData?.selectedMethodology}
      />

      {/* Modal de advertencia de entrenamiento activo */}
      {modals.showActiveTrainingWarning && (
        <Dialog open={modals.showActiveTrainingWarning} onOpenChange={() => closeModal('showActiveTrainingWarning')}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <DialogTitle>Entrenamiento en Marcha</DialogTitle>
              </div>
              <DialogDescription>
                Tienes un entrenamiento activo de <strong>{temp.activeTrainingInfo?.routinePlan?.selected_style}</strong>.
                Si generas un nuevo entrenamiento, perderás el progreso actual.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-orange-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Plan Activo: {temp.activeTrainingInfo?.routinePlan?.selected_style}
                  </p>
                  <p className="text-orange-600 dark:text-orange-300 mt-1">
                    Fuente: {temp.activeTrainingInfo?.planSource?.label || 'Automático'}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  closeModal('showActiveTrainingWarning');
                  navigate('/routines');
                }}
              >
                Continuar Entrenamiento
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  closeModal('showActiveTrainingWarning');
                  openModal('showVersionSelection');
                }}
              >
                Crear Nuevo Entrenamiento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Calistenia Manual */}
      {modals.showCalisteniaManual && (
        <Dialog open={modals.showCalisteniaManual} onOpenChange={() => closeModal('showCalisteniaManual')}>
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

      {/* TrainingPlanConfirmationModal */}
      <TrainingPlanConfirmationModal
        isOpen={modals.showConfirmationModal}
        onClose={() => closeModal('showConfirmationModal')}
        onStartTraining={handleStartTraining} // ✅ CORRECCIÓN: Cambiado de onStartNow a onStartTraining
        onGenerateAnother={handleGenerateAnother}
        plan={plan.generated?.plan || plan.generated} // ✅ MEJORADO: Acceso más seguro al plan
        methodology={plan.methodology}
        isLoading={ui.isLoading}
        error={ui.error} // ✅ NUEVO: Pasar errores al modal
        isConfirming={ui.isLoading} // ✅ NUEVO: Estado de confirmación
      />

      {/* WarmupModal */}
      {modals.showWarmupModal && session.pendingWarmupData?.sessionId && (
        <WarmupModal
          sessionId={session.pendingWarmupData.sessionId} // ✅ CORRECCIÓN: Pasar sessionId
          level={generatedPlan?.plan?.level || 'básico'}
          onComplete={handleWarmupComplete}
          onSkip={handleSkipWarmup}
          onClose={handleCloseWarmup}
        />
      )}

      {/* RoutineSessionModal */}
      <RoutineSessionModal
        isOpen={modals.showRoutineSessionModal}
        onClose={handleEndSession}
        sessionData={session.current}
        onUpdateExercise={updateExercise}
      />
    </div>
  );
}