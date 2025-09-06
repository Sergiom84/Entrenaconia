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
import MethodologyCard from './shared/MethodologyCard.jsx';
import MethodologyDetailsDialog from './shared/MethodologyDetailsDialog.jsx';
import MethodologyConfirmationModal from './shared/MethodologyConfirmationModal.jsx';
import MethodologyVersionSelectionModal from './shared/MethodologyVersionSelectionModal.jsx';
import CalisteniaManualCard from './methodologies/CalisteniaManual/CalisteniaManualCard.jsx';

export default function MethodologiesScreen() {
  const navigate = useNavigate();
  const { currentUser, user } = useAuth();
  const { userData } = useUserContext();
  const [selectionMode, setSelectionMode] = useState('automatico');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showManualSelectionModal, setShowManualSelectionModal] = useState(false);
  const [pendingMethodology, setPendingMethodology] = useState(null);
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
      
      // Navegar automáticamente a rutinas después de generar el plan
      console.log('🚀 Plan generado, navegando a rutinas automáticamente...');
      setTimeout(() => {
        navigateToRoutines(newGeneratedPlan);
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
      setShowManualSelectionModal(false);
      setPendingMethodology(null);
    }
  };

  const handleOpenDetails = (m) => {
    setDetailsMethod(m);
    setShowDetails(true);
  };

  // Función para manejar generación de calistenia manual
  const handleCalisteniaManualGenerate = async (calisteniaData) => {
    // Verificar si hay entrenamiento activo
    const activeTraining = await checkActiveTraining();
    if (activeTraining) {
      setActiveTrainingInfo(activeTraining);
      setShowActiveTrainingWarning(true);
      return;
    }
    
    setShowCalisteniaManual(false);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🤸‍♀️ Generando plan de calistenia manual...', calisteniaData);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calistenia-manual/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(calisteniaData)
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar el plan de calistenia');
      }
      
      console.log('✅ Plan de calistenia manual generado exitosamente');
      
      // Guardar plan y preparar navegación
      setGeneratedRoutinePlan({
        plan: result.plan,
        planSource: 'calistenia_manual', 
        planId: result.planId,
        routinePlanId: result.routinePlanId,
        metodologia: 'Calistenia Manual'
      });
      
      console.log('🛤️ Plan de calistenia generado:', {
        methodologyPlanId: result.planId,
        routinePlanId: result.routinePlanId
      });
      
      // Mensaje personalizado
      const baseMessage = `Tu plan de Calistenia Manual nivel ${calisteniaData.levelInfo.name} ha sido generado exitosamente. ` +
                          `Entrenarás ${calisteniaData.levelInfo.frequency} con ejercicios específicos de calistenia.`;
      
      let tip = '';
      if (calisteniaData.level === 'basico') {
        tip = 'Comenzarás con movimientos fundamentales para construir una base sólida de fuerza y técnica.';
      } else if (calisteniaData.level === 'intermedio') {
        tip = 'Trabajarás en movimientos más complejos como dominadas, fondos y progresiones hacia habilidades avanzadas.';
      } else {
        tip = 'Te enfocarás en habilidades avanzadas como muscle-ups, handstands y movimientos estáticos de alto nivel.';
      }
      
      const enhancedMessage = `${baseMessage}\n\n💡 ${tip}`;
      setPersonalizedMessage(enhancedMessage);
      
      // Navegar automáticamente a rutinas
      console.log('🚀 Plan de calistenia generado, navegando a rutinas...');
      setTimeout(() => {
        navigateToRoutines({
          plan: result.plan,
          planSource: 'calistenia_manual', 
          planId: result.planId,
          routinePlanId: result.routinePlanId,
          metodologia: 'Calistenia Manual'
        });
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error generando plan de calistenia:', error);
      setError(error.message || 'Error al generar el plan de calistenia');
    } finally {
      setIsLoading(false);
    }
  };


  // Función para proceder del mensaje personalizado al modal del plan (como en HomeTraining)
  const proceedToRoutinePlan = () => {
    setShowPersonalizedMessage(false);
    // Navegar automáticamente a rutinas
    console.log('🚀 Auto-navigating to routines with generated plan');
    setTimeout(() => {
      navigateToRoutines(generatedRoutinePlan);
    }, 1000);
  };

  // Función para navegar a rutinas con el plan
  const navigateToRoutines = (overridePlan = null) => {
    const planContainer = overridePlan || generatedRoutinePlan;

    if (!planContainer || !planContainer.plan) {
      console.error('❌ No hay plan de rutina disponible para navegar', { overridePlan, generatedRoutinePlan });
      setError('No se pudo preparar la rutina. Vuelve a intentar generar el plan.');
      return;
    }

    const model = planContainer?.metadata?.model;
    // Usar routinePlanId para Rutinas, fallback a planId si no existe
    const correctPlanId = planContainer?.routinePlanId || planContainer?.planId;

    console.log('🛤️ Navegando a Rutinas:', {
      methodologyPlanId: planContainer?.planId,
      routinePlanId: planContainer?.routinePlanId,
      usingPlanId: correctPlanId
    });

    console.log('📦 Full generatedRoutinePlan object:', planContainer);
    console.log('📋 Routine plan structure:', planContainer.plan);

    const navigationState = {
      routinePlan: planContainer.plan,
      planSource: { label: 'OpenAI', detail: model ? `(${model})` : '' },
      planMetadata: planContainer.metadata,
      planId: correctPlanId,
      methodology_plan_id: planContainer?.planId // ⭐ Crítico: ID del plan de metodología
    };

    console.log('🚀 About to navigate with state:', navigationState);

    navigate('/routines', {
      state: navigationState
    });

    // Limpiar estado después de un delay para asegurar que la navegación se complete
    setTimeout(() => {
      console.log('🧹 Clearing methodology state after navigation');
      setGeneratedRoutinePlan(null);
      setShowPersonalizedMessage(false);
    }, 100);
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
      
      {/* Modal de confirmación para selección manual */}
      {showManualSelectionModal && pendingMethodology && (
        <MethodologyConfirmationModal
          methodology={pendingMethodology.name}
          onConfirm={confirmManualSelection}
          onCancel={() => {
            setShowManualSelectionModal(false);
            setPendingMethodology(null);
          }}
          isGenerating={isLoading}
        />
      )}
      
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
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Auto-navigate to routines - no modal needed */}
    </div>
  );
}
