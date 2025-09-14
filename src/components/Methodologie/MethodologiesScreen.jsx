import React, { useState } from 'react';
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
import MethodologyCard from './MethodologyCard.jsx';
import MethodologyDetailsDialog from './shared/MethodologyDetailsDialog.jsx';
import TrainingPlanConfirmationModal from './TrainingPlanConfirmationModal.jsx';
import RoutineSessionModal from '../routines/RoutineSessionModal.jsx';
import WarmupModal from '../routines/WarmupModal.jsx';
import { startSession, updateExercise } from '../routines/api.js';
import { useRoutineCache, CACHE_KEYS } from '../../hooks/useRoutineCache.js';
import MethodologyVersionSelectionModal from './shared/MethodologyVersionSelectionModal.jsx';
import CalisteniaManualCard from './methodologies/CalisteniaManual/CalisteniaManualCard.jsx';

export default function MethodologiesScreen() {
  const navigate = useNavigate();
  const { invalidateCache } = useRoutineCache();
  const { currentUser, user } = useAuth();
  const { userData } = useUserContext();
  const [selectionMode, setSelectionMode] = useState('automatico');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingMethodology, setPendingMethodology] = useState(null); // Necesario para MethodologyVersionSelectionModal
  const [showDetails, setShowDetails] = useState(false);
  const [detailsMethod, setDetailsMethod] = useState(null);
  const [showPersonalizedMessage, setShowPersonalizedMessage] = useState(false);
  const [personalizedMessage, setPersonalizedMessage] = useState('');
  const [generatedRoutinePlan, setGeneratedRoutinePlan] = useState(null);
  const [showVersionSelection, setShowVersionSelection] = useState(false);
  const [versionSelectionData, setVersionSelectionData] = useState(null);
  const [showActiveTrainingWarning, setShowActiveTrainingWarning] = useState(false);
  const [activeTrainingInfo, setActiveTrainingInfo] = useState(null);
  const [showCalisteniaManual, setShowCalisteniaManual] = useState(false);

  // Estados para el nuevo flujo unificado
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showRoutineSessionModal, setShowRoutineSessionModal] = useState(false);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentMethodologyPlanId, setCurrentMethodologyPlanId] = useState(null);
  const [selectedMethodology, setSelectedMethodology] = useState('');
  const [pendingWarmupData, setPendingWarmupData] = useState(null);

  // Función para verificar si hay entrenamiento activo
  const checkActiveTraining = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/routines/active-plan', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.hasActivePlan ? data : null;
      }
      return null;
    } catch (error) {
      console.error('Error checking active training:', error);
      return null;
    }
  };

  const handleActivateIA = async (forcedMethodology = null) => {
    if (!currentUser && !user) return;
    
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setActiveTrainingInfo(activeTraining);
      setShowActiveTrainingWarning(true);
      return;
    }
    
    // Mostrar modal de selección de versión
    setVersionSelectionData({
      isAutomatic: true,
      forcedMethodology
    });
    setShowVersionSelection(true);
  };

  const handleVersionSelectionConfirm = async (versionConfig) => {
    setShowVersionSelection(false);
    setIsLoading(true);
    setError(null);

    // Construir perfil completo con mapeo mejorado
    const rawProfile = { ...userData, ...user, ...currentUser };
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
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/methodologie/generate-plan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          perfil: fullProfile,
          metodologia_forzada: versionSelectionData?.forcedMethodology,
          versionConfig: versionConfig
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'No se pudo generar el plan de entrenamiento.');
      }
      
      console.log('✅ Plan generado exitosamente:', result.plan);
      
      // Guardar plan y mostrar mensaje personalizado (como en HomeTraining)
      const newGeneratedPlan = {
        plan: result.plan,
        planSource: 'automatic',
        planId: result.planId, // ID original de methodology_plans
        routinePlanId: result.routinePlanId, // ID para routine_plans
        metadata: result.metadata,
        metodologia: result.plan.selected_style
      };
      setGeneratedRoutinePlan(newGeneratedPlan);

      console.log('🛤️ Plan automático generado:', {
        methodologyPlanId: result.planId,
        routinePlanId: result.routinePlanId,
        migrationInfo: result.metadata?.migrationInfo
      });
      
      // Construir mensaje personalizado para mostrar directamente en el modal del plan
      const baseMessage = result.plan.rationale ||
                          `La IA ha seleccionado ${result.plan.selected_style} como la metodología ideal para ti. ` +
                          `Plan de ${result.plan.duracion_total_semanas} semanas con ${result.plan.frecuencia_por_semana} entrenamientos por semana.`;
      
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
      setPersonalizedMessage(enhancedMessage);
      
      // NUEVO FLUJO AUTOMÁTICO: Mostrar modal de confirmación
      console.log('🚀 Plan generado automáticamente, mostrando modal de confirmación...');
      
      // Guardar datos para el modal de confirmación
      setGeneratedRoutinePlan(newGeneratedPlan.plan);
      setCurrentMethodologyPlanId(newGeneratedPlan.planId);
      setSelectedMethodology(newGeneratedPlan.metodologia || 'Automático');
      setPersonalizedMessage(newGeneratedPlan.justification || 'Plan generado automáticamente basado en tu perfil.');
      
      setTimeout(() => {
        setShowConfirmationModal(true);
      }, 1500);

    } catch (err) {
      console.error('❌ Error generando plan:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCardClick = (methodology) => {
    if (selectionMode === 'manual') {
      // Si es Calistenia, mostrar el modal específico
      if (methodology.name === 'Calistenia') {
        setShowCalisteniaManual(true);
        return;
      }
      
      setPendingMethodology(methodology);
      // Mostrar modal de selección de versión para manual también
      setVersionSelectionData({
        isAutomatic: false,
        selectedMethodology: methodology.name
      });
      setShowVersionSelection(true);
    }
  };

  const confirmManualSelection = async (versionConfig) => {
    if (!pendingMethodology) return;
    
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setActiveTrainingInfo(activeTraining);
      setShowActiveTrainingWarning(true);
      return;
    }
    
    setShowVersionSelection(false);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🎯 Generando plan manual para metodología: ${pendingMethodology.name}`);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/methodology-manual/generate-manual', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          metodologia_solicitada: pendingMethodology.name,
          versionConfig: versionConfig
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar el plan');
      }
      
      console.log('✅ Plan de metodología manual generado exitosamente');
      
      // Guardar plan y mostrar mensaje personalizado (como en HomeTraining)
      setGeneratedRoutinePlan({
        plan: result.plan,
        planSource: 'manual_methodology', 
        planId: result.planId, // ID original de methodology_plans
        routinePlanId: result.routinePlanId, // ID para routine_plans
        metodologia: pendingMethodology.name
      });
      
      console.log('🛤️ Plan manual generado:', {
        methodologyPlanId: result.planId,
        routinePlanId: result.routinePlanId,
        migrationInfo: result.migrationInfo
      });
      
      // Mostrar mensaje personalizado con tips incluidos
      const baseMessage = result.plan.consideraciones || 
                          `Tu rutina de ${pendingMethodology.name} ha sido generada exitosamente. ` +
                          `Plan de ${result.plan.duracion_total_semanas} semanas con ` + 
                          `${result.plan.frecuencia_por_semana} entrenamientos por semana.`;
      
      // Obtener objetivo principal para personalizar los tips
      const rawProfile = { ...userData, ...user, ...currentUser };
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
      setPersonalizedMessage(enhancedMessage);

    } catch (error) {
      console.error('❌ Error generando plan manual:', error);
      setError(error.message || 'Error al generar el plan de entrenamiento');
    } finally {
      setIsLoading(false);
      // Limpiar estado de metodología pendiente
      setPendingMethodology(null);
    }
  };

  const handleOpenDetails = (m) => {
    setDetailsMethod(m);
    setShowDetails(true);
  };

  // Función para manejar generación de calistenia manual Y especialista IA
  const handleCalisteniaManualGenerate = async (calisteniaData) => {
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setActiveTrainingInfo(activeTraining);
      setShowActiveTrainingWarning(true);
      return;
    }

    // NO cerrar el modal hasta estar seguros de que todo salió bien
    setIsLoading(true);
    setError(null);

    try {
      // Detectar si es generación con IA Specialist o selección manual
      const isAISpecialist = calisteniaData.source === 'ai_evaluation';
      const endpoint = isAISpecialist ? '/api/calistenia-specialist/generate-plan' : '/api/calistenia-manual/generate';

      console.log(`🤸‍♀️ Generando plan de calistenia (${isAISpecialist ? 'IA Specialist' : 'Manual'})...`, calisteniaData);

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

      console.log('📥 Respuesta del servidor:', {
        ok: response.ok,
        status: response.status,
        success: result?.success,
        hasplan: !!result?.plan,
        planId: result?.planId
      });

      if (!response.ok || !result.success) {
        // Mejorar el mensaje de error con más detalles
        const errorMessage = result.message || result.error ||
                           `Error ${response.status}: ${response.statusText || 'Error al generar el plan de calistenia'}`;
        console.error('❌ Error del servidor:', errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log(`✅ Plan de calistenia ${isAISpecialist ? 'IA Specialist' : 'Manual'} generado exitosamente`);

      // AHORA SÍ cerrar el modal ya que todo salió bien
      setShowCalisteniaManual(false);

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
      setPersonalizedMessage(enhancedMessage);
      
      // NUEVO FLUJO: Mostrar modal de confirmación en lugar de navegar
      console.log('🚀 Plan de calistenia generado, mostrando modal de confirmación...');

      // Validar que tengamos un plan antes de continuar
      if (!result.plan) {
        throw new Error('El servidor no devolvió un plan válido');
      }

      // Guardar datos para el modal de confirmación
      setGeneratedRoutinePlan(result.plan);
      setCurrentMethodologyPlanId(result.planId);
      setSelectedMethodology(metodologia);

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
        setShowConfirmationModal(true);
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
      setIsLoading(false);
    }
  };


  // NUEVA FUNCIÓN: Proceder al modal de confirmación
  const proceedToRoutinePlan = () => {
    setShowPersonalizedMessage(false);
    // Mostrar modal de confirmación en lugar de navegar
    console.log('🚀 Mostrando modal de confirmación con plan generado');
    setTimeout(() => {
      setShowConfirmationModal(true);
    }, 1000);
  };

  // NUEVA FUNCIÓN: Iniciar sesión de entrenamiento directamente
  const handleStartTraining = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 Iniciando sesión de entrenamiento directamente...');

      if (!generatedRoutinePlan || !currentMethodologyPlanId) {
        throw new Error('No hay plan generado para iniciar');
      }

      // PASO 1: ACTIVAR EL PLAN ANTES DE INICIAR LA SESIÓN
      console.log('🔄 Activando plan de entrenamiento...');
      const token = localStorage.getItem('token');
      const activationResponse = await fetch('/api/routines/confirm-and-activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          methodology_plan_id: currentMethodologyPlanId,
          plan_data: generatedRoutinePlan
        })
      });

      if (!activationResponse.ok) {
        const errorData = await activationResponse.json();
        throw new Error(errorData.error || 'Error al activar el plan');
      }

      const activationResult = await activationResponse.json();
      console.log('✅ Plan activado exitosamente:', activationResult);

      // PASO 2: AHORA SÍ INICIAR LA SESIÓN DE ENTRENAMIENTO
      // Obtener día actual para empezar HOY, no el primer día del plan
      const today = new Date();
      const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const todayName = diasSemana[today.getDay()];

      // Buscar la sesión del día actual en la primera semana
      const firstWeek = generatedRoutinePlan.semanas?.[0];
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
        methodology_plan_id: currentMethodologyPlanId,
        week_number: 1,
        day_name: todayName // Usar día actual, no firstSession.dia
      });

      // Preparar datos para RoutineSessionModal usando la sesión encontrada
      setCurrentSession(sessionToUse);
      setCurrentSessionId(sessionResult.session_id);
      
      // Cerrar modal de confirmación y mostrar calentamiento PRIMERO
      setShowConfirmationModal(false);

      // Guardar datos para después del calentamiento
      setPendingWarmupData({
        session: sessionToUse,
        sessionId: sessionResult.session_id
      });

      // Mostrar modal de calentamiento
      setShowWarmupModal(true);
      console.log('🔥 Iniciando calentamiento antes del entrenamiento...');
      
    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      setError(error.message || 'Error al iniciar el entrenamiento');
    } finally {
      setIsLoading(false);
    }
  };

  // FUNCIONES PARA MANEJAR WARMUP MODAL
  const handleWarmupComplete = () => {
    console.log('✅ Calentamiento completado, iniciando entrenamiento principal');
    setShowWarmupModal(false);

    if (pendingWarmupData) {
      setCurrentSession(pendingWarmupData.session);
      setCurrentSessionId(pendingWarmupData.sessionId);
      setShowRoutineSessionModal(true);
      setPendingWarmupData(null);
    }
  };

  const handleSkipWarmup = () => {
    console.log('⏭️ Calentamiento saltado, yendo directo al entrenamiento');
    setShowWarmupModal(false);

    if (pendingWarmupData) {
      setCurrentSession(pendingWarmupData.session);
      setCurrentSessionId(pendingWarmupData.sessionId);
      setShowRoutineSessionModal(true);
      setPendingWarmupData(null);
    }
  };

  const handleCloseWarmup = () => {
    console.log('❌ Calentamiento cancelado');
    setShowWarmupModal(false);
    setPendingWarmupData(null);
    // TODO: Cancelar la sesión creada si es necesario
  };

  // NUEVA FUNCIÓN: Al terminar RoutineSessionModal
  const handleEndSession = async () => {
    console.log('🏁 Sesión terminada, navegando a TodayTrainingTab');
    console.log('📋 Estado actual:', {
      currentMethodologyPlanId,
      sessionId: routineSessionData?.sessionId,
      localStorage: {
        methodology_plan_id: localStorage.getItem('currentMethodologyPlanId'),
        planStartDate: localStorage.getItem('currentRoutinePlanStartDate')
      }
    });

    setShowRoutineSessionModal(false);

    // IMPORTANTE: Guardar estado en localStorage para persistencia
    localStorage.setItem('currentMethodologyPlanId', String(currentMethodologyPlanId));
    localStorage.setItem('currentRoutinePlanStartDate', new Date().toISOString().split('T')[0]);

    // Invalidar el caché del plan activo para forzar una nueva consulta
    console.log('🗑️ Invalidando caché de plan activo');
    invalidateCache(CACHE_KEYS.ACTIVE_PLAN);

    try {
      // Primero, obtener el plan activo actual para navegación correcta
      const token = localStorage.getItem('token');
      console.log('🔍 Buscando plan activo después de sesión...');
      const response = await fetch('/api/routines/active-plan', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const activeData = await response.json();
      console.log('📦 Respuesta de active-plan:', activeData);

      // SIEMPRE navegar con el plan actual, independientemente de la respuesta de active-plan
      // Esto es necesario porque el plan sigue activo después de completar una sesión
      if (activeData.success && activeData.hasActivePlan) {
        console.log('✅ Plan activo encontrado, navegando con datos completos:', {
          hasActivePlan: activeData.hasActivePlan,
          methodology_plan_id: activeData.methodology_plan_id,
          planStartDate: activeData.planStartDate
        });

        // Navegar con el plan completo para que RoutineScreen lo reconozca
        navigate('/routines', {
          state: {
            plan: activeData.routinePlan,
            methodology_plan_id: activeData.methodology_plan_id || currentMethodologyPlanId,
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
        console.log('📋 Usando metodología actual:', currentMethodologyPlanId);
        console.log('📦 Plan de rutina actual:', currentRoutinePlan ? 'Disponible' : 'No disponible');

        // Si tenemos el plan de rutina actual, usarlo
        navigate('/routines', {
          state: {
            plan: currentRoutinePlan || null,
            methodology_plan_id: currentMethodologyPlanId,
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
          methodology_plan_id: currentMethodologyPlanId,
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
    const planContainer = overridePlan || generatedRoutinePlan;

    if (!planContainer || !planContainer.plan) {
      console.error('❌ No hay plan de rutina disponible para navegar', { overridePlan, generatedRoutinePlan });
      setError('No se pudo preparar la rutina. Vuelve a intentar generar el plan.');
      return;
    }

    // NUEVO FLUJO UNIFICADO: Confirmar y activar plan de una vez
    try {
      setIsLoading(true);
      console.log('🚀 FLUJO MEJORADO: Confirmando y activando plan...');
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/routines/confirm-and-activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          methodology_plan_id: planContainer?.planId,
          plan_data: planContainer.plan
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error confirmando el plan');
      }

      console.log('✅ Plan confirmado y activado exitosamente:', result);

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
      setGeneratedRoutinePlan(null);
      setShowPersonalizedMessage(false);
      
    } catch (error) {
      console.error('❌ Error en flujo unificado:', error);
      setError(`Error activando tu rutina: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-black text-white min-h-screen pt-20">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Metodologías de Entrenamiento</h1>
      <p className="text-gray-400 mb-6">
        Automático (IA) o Manual (IA pero eligiendo que metodología realizar)
      </p>
      {error && (
        <Alert className="mb-6 bg-red-900/30 border-red-400/40">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <AlertDescription className="text-red-200">{error}</AlertDescription>
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
              onClick={() => setSelectionMode('automatico')}
              className={`p-4 rounded-lg transition-all bg-black/80 cursor-pointer
                ${selectionMode === 'automatico'
                  ? 'border border-yellow-400 ring-2 ring-yellow-400/30'
                  : 'border border-yellow-400/20 hover:border-yellow-400/40'}`}
            >
              <div className="flex items-start gap-3">
                <RadioGroup value={selectionMode} onValueChange={setSelectionMode}>
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
              {selectionMode === 'automatico' && (
                <div className="mt-4">
                  <Button
                    onClick={() => handleActivateIA(null)}
                    disabled={isLoading}
                    className="bg-yellow-400 text-black hover:bg-yellow-300"
                  >
                    <Zap className={`w-4 h-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                    {isLoading ? 'Procesando…' : 'Activar IA'}
                  </Button>
                </div>
              )}
            </div>
            <div
              onClick={() => setSelectionMode('manual')}
              className={`p-4 rounded-lg transition-all cursor-pointer bg-black/80
                ${selectionMode === 'manual'
                  ? 'border border-yellow-400 ring-2 ring-yellow-400/30'
                  : 'border border-yellow-400/20 hover:border-yellow-400/40'}`}
              title="Pulsa para activar el modo manual y luego elige una metodología"
            >
              <div className="flex items-start gap-3">
                <RadioGroup value={selectionMode} onValueChange={setSelectionMode}>
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
            manualActive={selectionMode === 'manual'}
            onDetails={handleOpenDetails}
            onSelect={handleManualCardClick}
          />
        ))}
      </div>
      {isLoading && (
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
        open={showDetails}
        onOpenChange={setShowDetails}
        detailsMethod={detailsMethod}
        selectionMode={selectionMode}
        onClose={() => setShowDetails(false)}
        onSelect={handleManualCardClick}
      />

      {/* Modal de selección de versión */}
      <MethodologyVersionSelectionModal
        isOpen={showVersionSelection}
        onClose={() => {
          setShowVersionSelection(false);
          setVersionSelectionData(null);
        }}
        onConfirm={versionSelectionData?.isAutomatic ? handleVersionSelectionConfirm : confirmManualSelection}
        userProfile={{...userData, ...user, ...currentUser}}
        isAutomatic={versionSelectionData?.isAutomatic}
        selectedMethodology={versionSelectionData?.selectedMethodology}
      />


      {/* Modal de advertencia de entrenamiento activo */}
      {showActiveTrainingWarning && (
        <Dialog open={showActiveTrainingWarning} onOpenChange={setShowActiveTrainingWarning}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <DialogTitle>Entrenamiento en Marcha</DialogTitle>
              </div>
              <DialogDescription>
                Tienes un entrenamiento activo de <strong>{activeTrainingInfo?.routinePlan?.selected_style}</strong>.
                Si generas un nuevo entrenamiento, perderás el progreso actual.
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-orange-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Plan Activo: {activeTrainingInfo?.routinePlan?.selected_style}
                  </p>
                  <p className="text-orange-600 dark:text-orange-300 mt-1">
                    Fuente: {activeTrainingInfo?.planSource?.label || 'Automático'}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowActiveTrainingWarning(false);
                  navigate('/routines');
                }}
              >
                Continuar Entrenamiento
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowActiveTrainingWarning(false);
                  // Continuar con la generación original
                  if (versionSelectionData?.isAutomatic) {
                    setShowVersionSelection(true);
                  } else {
                    setShowVersionSelection(true);
                  }
                }}
              >
                Crear Nuevo Entrenamiento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Calistenia Manual */}
      {showCalisteniaManual && (
        <Dialog open={showCalisteniaManual} onOpenChange={setShowCalisteniaManual}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Calistenia Manual</DialogTitle>
            </DialogHeader>
            <CalisteniaManualCard
              onGenerate={handleCalisteniaManualGenerate}
              isLoading={isLoading}
              error={error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* NUEVO: Modal de Confirmación Unificado */}
      <TrainingPlanConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onStartTraining={handleStartTraining}
        plan={generatedRoutinePlan}
        methodology={selectedMethodology}
        aiJustification={personalizedMessage}
        isLoading={isLoading}
      />

      {/* NUEVO: Modal de Calentamiento */}
      {showWarmupModal && (
        <WarmupModal
          level={generatedRoutinePlan?.level || 'básico'}
          onComplete={handleWarmupComplete}
          onSkip={handleSkipWarmup}
          onClose={handleCloseWarmup}
        />
      )}

      {/* NUEVO: Modal de Sesión de Entrenamiento */}
      {showRoutineSessionModal && currentSession && (
        <RoutineSessionModal
          session={currentSession}
          sessionId={currentSessionId}
          onClose={() => setShowRoutineSessionModal(false)}
          onFinishExercise={async (exerciseIndex, seriesCompleted, timeSpent) => {
            console.log('✅ Ejercicio completado:', { exerciseIndex, seriesCompleted, timeSpent });
            try {
              // Actualizar progreso en backend
              await updateExercise({
                sessionId: currentSessionId,
                exerciseOrder: exerciseIndex + 1, // API usa 1-based indexing
                series_completed: seriesCompleted,
                status: 'completado',
                time_spent_seconds: timeSpent
              });
            } catch (error) {
              console.error('❌ Error actualizando ejercicio:', error);
            }
          }}
          onSkipExercise={async (exerciseIndex) => {
            console.log('⏭️ Ejercicio saltado:', exerciseIndex);
            try {
              await updateExercise({
                sessionId: currentSessionId,
                exerciseOrder: exerciseIndex + 1,
                series_completed: 0,
                status: 'saltado',
                time_spent_seconds: 0
              });
            } catch (error) {
              console.error('❌ Error actualizando ejercicio saltado:', error);
            }
          }}
          onCancelExercise={async (exerciseIndex) => {
            console.log('❌ Ejercicio cancelado:', exerciseIndex);
            try {
              await updateExercise({
                sessionId: currentSessionId,
                exerciseOrder: exerciseIndex + 1,
                series_completed: 0,
                status: 'cancelado',
                time_spent_seconds: 0
              });
            } catch (error) {
              console.error('❌ Error actualizando ejercicio cancelado:', error);
            }
          }}
          onEndSession={handleEndSession}
          navigateToRoutines={() => navigate('/routines')}
        />
      )}
    </div>
  );
}
