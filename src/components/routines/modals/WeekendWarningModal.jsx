/**
 * WeekendWarningModal.jsx
 *
 * Modal de advertencia para generación de planes en fin de semana
 * Ofrece al usuario la opción de generar una rutina Full Body o continuar con el plan regular
 */

import { useState } from 'react';
import { AlertTriangle, Calendar, Zap, ChevronRight } from 'lucide-react';
import apiClient from '@/lib/apiClient';

export function WeekendWarningModal({
  isOpen,
  onClose,
  onConfirm,
  onFullBody,
  nivel = 'Principiante'
}) {
  const [isGeneratingFullBody, setIsGeneratingFullBody] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  if (!isOpen) return null;

  const handleFullBodyGeneration = async () => {
    setIsGeneratingFullBody(true);
    try {
      const response = await apiClient.post('/api/hipertrofiav2/generate-fullbody', {
        nivel: nivel,
        objetivos: []
      });

      if (response.data.success) {
        // Llamar callback con el plan generado
        if (onFullBody) {
          onFullBody(response.data.plan);
        }
        onClose();
      }
    } catch (error) {
      console.error('Error generando Full Body:', error);
      alert('Error al generar rutina Full Body. Por favor, intenta de nuevo.');
    } finally {
      setIsGeneratingFullBody(false);
    }
  };

  const handleContinueRegular = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full p-6 border border-yellow-400/30">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-yellow-400/10 rounded-xl">
            <AlertTriangle className="h-8 w-8 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Generación en Fin de Semana
            </h2>
            <p className="text-gray-400">
              Has elegido comenzar tu plan en fin de semana
            </p>
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-4 mb-6">
          <p className="text-gray-300 mb-2">
            <strong className="text-yellow-400">⚠️ Atención:</strong> Generar un plan regular en fin de semana puede afectar tu progresión:
          </p>
          <ul className="text-sm text-gray-400 space-y-1 ml-4">
            <li>• Las rutinas están optimizadas para días laborales</li>
            <li>• Podrías tener menos tiempo de recuperación</li>
            <li>• El volumen puede ser excesivo para entrenar sábado y domingo</li>
          </ul>
        </div>

        {/* Opciones */}
        <div className="space-y-3 mb-6">
          {/* Opción 1: Full Body */}
          <button
            onClick={() => setSelectedOption('fullbody')}
            className={`w-full p-4 rounded-xl border transition-all text-left ${
              selectedOption === 'fullbody'
                ? 'bg-green-500/10 border-green-500/50'
                : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Zap className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">
                  Rutina Full Body (Recomendado)
                </h3>
                <p className="text-sm text-gray-400">
                  Una sesión completa trabajando todos los grupos musculares.
                  Ideal para entrenar 1-2 veces el fin de semana.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    5-6 ejercicios
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    45-60 minutos
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    Volumen optimizado
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Opción 2: Plan Regular */}
          <button
            onClick={() => setSelectedOption('regular')}
            className={`w-full p-4 rounded-xl border transition-all text-left ${
              selectedOption === 'regular'
                ? 'bg-orange-500/10 border-orange-500/50'
                : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">
                  Continuar con Plan Regular
                </h3>
                <p className="text-sm text-gray-400">
                  Genera el plan estándar de {nivel === 'Principiante' ? '3' : nivel === 'Intermedio' ? '4' : '5-6'} días.
                  El plan se extenderá a 5 semanas para completar todas las sesiones.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
                    Plan extendido
                  </span>
                  <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
                    12 sesiones totales
                  </span>
                  <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
                    5 semanas
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Mensaje adicional según selección */}
        {selectedOption && (
          <div className={`p-3 rounded-lg mb-4 ${
            selectedOption === 'fullbody'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-orange-500/10 border border-orange-500/20'
          }`}>
            <p className="text-sm text-gray-300">
              {selectedOption === 'fullbody'
                ? '💡 La rutina Full Body te permitirá entrenar eficientemente el fin de semana sin comprometer tu recuperación.'
                : '⚠️ Recuerda que entrenar el fin de semana con un plan regular requiere buena gestión del descanso.'
              }
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={() => {
              if (selectedOption === 'fullbody') {
                handleFullBodyGeneration();
              } else if (selectedOption === 'regular') {
                handleContinueRegular();
              }
            }}
            disabled={!selectedOption || isGeneratingFullBody}
            className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
              selectedOption
                ? selectedOption === 'fullbody'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isGeneratingFullBody ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <span>
                  {selectedOption === 'fullbody'
                    ? 'Generar Full Body'
                    : selectedOption === 'regular'
                    ? 'Continuar con Plan Regular'
                    : 'Selecciona una opción'
                  }
                </span>
                {selectedOption && <ChevronRight className="h-5 w-5" />}
              </>
            )}
          </button>
        </div>

        {/* Nota al pie */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Puedes cambiar tu plan en cualquier momento desde la configuración
        </p>
      </div>
    </div>
  );
}

export default WeekendWarningModal;