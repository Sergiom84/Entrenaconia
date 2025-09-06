import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Lock, Unlock, AlertTriangle, CheckCircle, Brain, Target, Shield, Zap, Calendar } from 'lucide-react';

export default function MethodologyVersionSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  userProfile,
  isAutomatic = false,
  selectedMethodology = null
}) {
  const [selectionMode, setSelectionMode] = useState('automatic'); // 'automatic' or 'manual'
  const [selectedVersion, setSelectedVersion] = useState('adapted'); // 'adapted' or 'strict'
  const [showWarning, setShowWarning] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [customWeeks, setCustomWeeks] = useState(4); // Default 4 weeks

  // Determinar el nivel del usuario basado en datos reales de BD - MEMOIZADO para evitar bucles
  const userLevel = useMemo(() => {
    if (!userProfile) return 'principiante';
    
    // Manejar tanto estructura plana como estructura anidada
    const profile = userProfile.user || userProfile;
    
    // Leer de diferentes campos posibles en la BD
    const yearsTraining = profile.años_entrenando || 
                         profile.anos_entrenando || 
                         profile.years_training || 
                         profile.experiencia_anos ||
                         userProfile.años_entrenando || 
                         userProfile.anos_entrenando || 
                         0;
    
    const currentLevel = profile.nivel_entrenamiento || 
                        profile.nivel_actual_entreno || 
                        profile.nivel_ent ||
                        profile.training_userLevel ||
                        userProfile.nivel_entrenamiento || 
                        userProfile.nivel_actual_entreno ||
                        'principiante';
    
    // Lógica más precisa basada en años y nivel declarado
    if (yearsTraining >= 5 || currentLevel === 'avanzado' || currentLevel === 'competicion') return 'avanzado';
    if (yearsTraining >= 2 || currentLevel === 'intermedio') return 'intermedio';
    return 'principiante';
  }, [userProfile]);

  // Obtener años de entrenamiento reales
  const getTrainingYears = () => {
    if (!userProfile) return 0;
    
    // Manejar tanto estructura plana como estructura anidada
    const profile = userProfile.user || userProfile;
    
    return profile.años_entrenando || 
           profile.anos_entrenando || 
           profile.years_training || 
           profile.experiencia_anos ||
           userProfile.años_entrenando || 
           userProfile.anos_entrenando || 
           0;
  };

  // Obtener recomendación automática basada en el nivel - MEMOIZADO
  const autoRecommendation = useMemo(() => {
    return userLevel === 'principiante' ? 'adapted' : 'strict';
  }, [userLevel]);

  useEffect(() => {
    
    // Si está en modo automático, usar la recomendación
    if (selectionMode === 'automatic') {
      setSelectedVersion(autoRecommendation);
      setShowWarning(false);
      setRequiresConfirmation(false);
    } else {
      // En modo manual, verificar si la selección es apropiada
      const isInappropriate = (userLevel === 'principiante' && selectedVersion === 'strict');
      setShowWarning(isInappropriate);
      setRequiresConfirmation(isInappropriate);
    }
  }, [selectionMode, selectedVersion, userProfile]);

  const handleConfirm = () => {
    onConfirm({
      selectionMode,
      version: selectedVersion,
      userLevel: userLevel,
      isRecommended: selectedVersion === getAutomaticRecommendation(),
      customWeeks: customWeeks
    });
  };

  // userLevel y autoRecommendation ya están definidos con useMemo arriba

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[85vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-yellow-400" />
            {isAutomatic ? 'Configurar Generación Automática' : 'Configurar Metodología'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del usuario */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-blue-400" />
              <span className="text-white font-medium">Tu Perfil de Entrenamiento</span>
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              <p><span className="text-gray-400">Nivel:</span> <span className="text-white capitalize">{userLevel}</span></p>
              <p><span className="text-gray-400">Años entrenando:</span> <span className="text-white">{getTrainingYears()} años</span></p>
              <p><span className="text-gray-400">Nivel declarado:</span> <span className="text-blue-400 capitalize">{(userProfile?.user || userProfile)?.nivel_entrenamiento || (userProfile?.user || userProfile)?.nivel_actual_entreno || 'No especificado'}</span></p>
              {selectedMethodology && (
                <p><span className="text-gray-400">Metodología:</span> <span className="text-yellow-400">{selectedMethodology}</span></p>
              )}
            </div>
          </div>

          {/* Selector de modo */}
          <div>
            <h3 className="text-white font-medium mb-4">Selecciona cómo quieres proceder:</h3>
            <RadioGroup value={selectionMode} onValueChange={setSelectionMode}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="automatic" id="automatic" className="mt-1" />
                  <Label htmlFor="automatic" className="flex-1">
                    <Card className="p-4 bg-gray-800 border-gray-700 hover:border-yellow-500/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                          <Lock className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">🔒 Selección Automática (Recomendado)</h4>
                          <p className="text-sm text-gray-300 mb-2">
                            La IA asigna automáticamente la versión más apropiada según tu nivel y experiencia.
                          </p>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-green-400">Recomendado para la mayoría de usuarios</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="manual" id="manual" className="mt-1" />
                  <Label htmlFor="manual" className="flex-1">
                    <Card className="p-4 bg-gray-800 border-gray-700 hover:border-blue-500/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Unlock className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">🔓 Selección Manual</h4>
                          <p className="text-sm text-gray-300 mb-2">
                            Tú eliges manualmente entre versión adaptada o estricta.
                          </p>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <span className="text-sm text-amber-400">Requiere experiencia en la metodología</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Selector de versión */}
          {selectionMode === 'manual' && (
            <div>
              <h3 className="text-white font-medium mb-4">Selecciona la versión:</h3>
              <RadioGroup value={selectedVersion} onValueChange={setSelectedVersion}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="adapted" id="adapted" className="mt-1" />
                    <Label htmlFor="adapted" className="flex-1">
                      <Card className="p-4 bg-gray-800 border-gray-700 hover:border-green-500/50 transition-colors cursor-pointer">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <Shield className="h-5 w-5 text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-2">Versión Adaptada</h4>
                            <div className="space-y-2 text-sm text-gray-300">
                              <p>• Intensidad inicial moderada</p>
                              <p>• Volumen bajo a medio</p>
                              <p>• Descanso personalizado</p>
                              <p>• Bajo riesgo de sobreentrenamiento</p>
                              <p>• Adaptable y progresiva</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="strict" id="strict" className="mt-1" />
                    <Label htmlFor="strict" className="flex-1">
                      <Card className="p-4 bg-gray-800 border-gray-700 hover:border-red-500/50 transition-colors cursor-pointer">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-red-500/20 rounded-lg">
                            <Zap className="h-5 w-5 text-red-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-2">Versión Estricta</h4>
                            <div className="space-y-2 text-sm text-gray-300">
                              <p>• Intensidad inicial alta</p>
                              <p>• Volumen medio a alto</p>
                              <p>• Descanso estándar</p>
                              <p>• Mayor frecuencia por grupo muscular</p>
                              <p>• Riesgo alto si no se regula</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Selector de duración personalizada */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-purple-400" />
              <h3 className="text-white font-medium">Duración del Plan</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              La IA se encarga de prepararte el entrenamiento, pero si prefieres modificar las semanas, házlo aquí:
            </p>
            <div className="flex items-center gap-4">
              <Label htmlFor="weeks" className="text-gray-300 text-sm">
                Número de semanas:
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="weeks"
                  type="number"
                  min="1"
                  max="7"
                  value={customWeeks}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(7, parseInt(e.target.value) || 4));
                    setCustomWeeks(value);
                  }}
                  className="w-20 bg-gray-700 border-gray-600 text-white text-center"
                />
                <span className="text-gray-400 text-sm">semanas (1-7)</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              💡 Recomendación: 4-5 semanas para principiantes, 5-6 para intermedios, 6-7 para avanzados
            </div>
          </div>

          {/* Recomendación de la IA */}
          <div className="bg-blue-900/30 border border-blue-700/50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-blue-400 font-medium mb-2">Recomendación de la IA</h4>
                <p className="text-sm text-gray-300">
                  Basándome en tu perfil ({userLevel}, {getTrainingYears()} años de experiencia), 
                  recomiendo la <span className="text-white font-medium">
                    versión {autoRecommendation === 'adapted' ? 'adaptada' : 'estricta'}
                  </span> durante <span className="text-purple-400 font-medium">{customWeeks} semanas</span>.
                </p>
                {userLevel === 'principiante' && (
                  <p className="text-sm text-blue-300 mt-2">
                    💡 Para usuarios principiantes recomiendo usar la versión adaptada durante mínimo 4-6 semanas.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Advertencia */}
          {showWarning && (
            <Alert className="border-amber-700 bg-amber-900/30">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200">
                <strong>Advertencia:</strong> Has seleccionado la versión estricta siendo principiante. 
                Esto puede resultar en sobreentrenamiento, lesiones o abandono del programa. 
                Se requiere doble confirmación para proceder.
              </AlertDescription>
            </Alert>
          )}

          {/* Comparativa */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-3">Comparativa de Versiones</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-300 py-2">Característica</th>
                    <th className="text-center text-green-400 py-2">Adaptada</th>
                    <th className="text-center text-red-400 py-2">Estricta</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-700/50">
                    <td className="py-2">Intensidad inicial</td>
                    <td className="text-center text-green-400">Moderada</td>
                    <td className="text-center text-red-400">Alta</td>
                  </tr>
                  <tr className="border-b border-gray-700/50">
                    <td className="py-2">Volumen semanal</td>
                    <td className="text-center text-green-400">Bajo a medio</td>
                    <td className="text-center text-red-400">Medio a alto</td>
                  </tr>
                  <tr className="border-b border-gray-700/50">
                    <td className="py-2">Riesgo sobreentrenamiento</td>
                    <td className="text-center text-green-400">Bajo</td>
                    <td className="text-center text-red-400">Alto</td>
                  </tr>
                  <tr className="border-b border-gray-700/50">
                    <td className="py-2">Nivel requerido</td>
                    <td className="text-center text-green-400">Principiante+</td>
                    <td className="text-center text-red-400">Intermedio+</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-800">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
            disabled={requiresConfirmation && selectionMode === 'manual' && selectedVersion === 'strict'}
          >
            {requiresConfirmation && selectionMode === 'manual' && selectedVersion === 'strict' 
              ? 'Confirmar Advertencia Primero' 
              : 'Continuar'
            }
          </Button>
        </div>

        {/* Confirmación doble para casos riesgosos */}
        {requiresConfirmation && selectionMode === 'manual' && selectedVersion === 'strict' && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <h4 className="text-red-400 font-medium mb-2">Confirmación Requerida</h4>
            <p className="text-sm text-gray-300 mb-3">
              Confirmo que entiendo los riesgos y quiero proceder con la versión estricta a pesar de mi nivel principiante.
            </p>
            <Button 
              onClick={() => setRequiresConfirmation(false)}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmo y Asumo los Riesgos
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}