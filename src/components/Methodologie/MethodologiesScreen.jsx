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
import MethodologyDetailsDialog from './MethodologyDetailsDialog.jsx';
import MethodologyConfirmationModal from './MethodologyConfirmationModal.jsx';

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
  const [successData, setSuccessData] = useState(null);

  const handleActivateIA = async (forcedMethodology = null) => {
    if (!currentUser && !user) return;
    setIsLoading(true);
    setError(null);
    const fullProfile = sanitizeProfile({ ...userData, ...user, ...currentUser });
    
    try {
      console.log('🤖 Activando IA para generar plan metodológico...');
      
      const response = await fetch('/api/methodologie/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfil: fullProfile,
          metodologia_forzada: forcedMethodology
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'No se pudo generar el plan de entrenamiento.');
      }
      
      console.log('✅ Plan generado exitosamente:', result.plan);
      setSuccessData({
        plan: result.plan,
        metadata: result.metadata
      });
      
    } catch (err) {
      console.error('❌ Error generando plan:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCardClick = (methodology) => {
    if (selectionMode === 'manual') {
      setPendingMethodology(methodology);
      setShowManualSelectionModal(true);
    }
  };

  const confirmManualSelection = async () => {
    if (!pendingMethodology) return;
    
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
          metodologia_solicitada: pendingMethodology.name
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar el plan');
      }
      
      console.log('✅ Plan de metodología manual generado exitosamente');
      
      // Navegar directamente a rutinas con el plan generado
      navigate('/routines', {
        state: {
          routinePlan: result.plan,
          planSource: 'manual_methodology',
          planId: result.planId
        }
      });
      
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

  const handleCloseSuccessDialog = () => {
    // Pasar los datos del plan generado a la pantalla de rutinas
    navigate('/routines', { 
      state: { 
        routinePlan: successData 
      } 
    });
    setSuccessData(null);
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
      <Dialog open={!!successData} onOpenChange={(open) => { if (!open) handleCloseSuccessDialog(); }}>
        <DialogContent className="max-w-2xl bg-black/95 border-yellow-400/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center">
              <Brain className="w-5 h-5 mr-2 text-yellow-400" />
              ¡Plan de Entrenamiento Generado!
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              La IA ha creado un plan personalizado basado en tu perfil.
            </DialogDescription>
          </DialogHeader>
          
          {successData?.plan && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Información del plan */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Metodología:</span>{' '}
                  <span className="text-yellow-400 font-semibold">{successData.plan.selected_style}</span>
                </div>
                <div>
                  <span className="text-gray-400">Duración:</span>{' '}
                  <span className="text-white font-semibold">{successData.plan.duracion_total_semanas} semanas</span>
                </div>
                <div>
                  <span className="text-gray-400">Frecuencia:</span>{' '}
                  <span className="text-white font-semibold">{successData.plan.frecuencia_por_semana} sesiones/semana</span>
                </div>
                <div>
                  <span className="text-gray-400">Progresión:</span>{' '}
                  <span className="text-white font-semibold">{successData.plan.progresion?.metodo}</span>
                </div>
              </div>

              {/* Razón de la selección */}
              {successData.plan.rationale && (
                <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
                  <h4 className="text-yellow-400 font-semibold text-sm mb-1">¿Por qué esta metodología?</h4>
                  <p className="text-gray-300 text-sm">{successData.plan.rationale}</p>
                </div>
              )}

              {/* Vista previa del plan */}
              <div>
                <h4 className="text-white font-semibold mb-2">Vista previa del plan:</h4>
                <div className="space-y-2 text-sm">
                  {successData.plan.semanas?.slice(0, 2).map((semana, idx) => (
                    <div key={idx} className="p-2 bg-gray-800/50 rounded border border-gray-700">
                      <div className="text-yellow-400 font-medium">Semana {semana.semana}</div>
                      <div className="text-gray-400 text-xs">
                        {semana.sesiones?.length || 0} sesiones programadas
                      </div>
                    </div>
                  ))}
                  {successData.plan.semanas?.length > 2 && (
                    <div className="text-center text-gray-400 text-xs">
                      ... y {successData.plan.semanas.length - 2} semanas más
                    </div>
                  )}
                </div>
              </div>

              {/* Consideraciones de seguridad */}
              {successData.plan.safety_notes && (
                <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg">
                  <h4 className="text-red-400 font-semibold text-sm mb-1">⚠️ Consideraciones importantes:</h4>
                  <p className="text-gray-300 text-sm">{successData.plan.safety_notes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button className="bg-yellow-400 text-black hover:bg-yellow-300" onClick={handleCloseSuccessDialog}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Ir a Rutinas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
