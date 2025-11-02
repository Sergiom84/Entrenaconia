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

  const handleTodayOnlyGeneration = async () => {
    setIsGeneratingFullBody(true);
    try {
      // Endpoint para generar solo entrenamiento del día (sin plan completo)
      const response = await apiClient.post('/hipertrofiav2/generate-single-day', {
        nivel: nivel,
        objetivos: [],
        isWeekendExtra: true  // Flag para indicar que es entrenamiento extra de fin de semana
      });

      console.log('📦 Respuesta completa del servidor:', response);
      console.log('📊 response.data:', response.data);
      console.log('📊 response.success:', response.success);

      // apiClient puede devolver directamente el data, verificar ambos casos
      const data = response.data || response;

      if (data.success) {
        console.log('✅ Entrenamiento generado:', data.workout);
        console.log('📝 SessionId recibido:', data.sessionId);

        // Pasar el workout completo con el sessionId incluido
        const fullWorkoutData = {
          ...data.workout,
          sessionId: data.sessionId  // Asegurar que sessionId esté incluido
        };

        console.log('📦 Datos completos a enviar:', fullWorkoutData);

        // Llamar callback con el entrenamiento del día generado
        if (onFullBody) {
          onFullBody(fullWorkoutData);
        }
        onClose();
      } else {
        console.error('❌ Respuesta sin success:', data);
        alert('No se pudo generar el entrenamiento. Por favor, intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error generando entrenamiento del día:', error);
      alert('Error al generar el entrenamiento. Por favor, intenta de nuevo.');
    } finally {
      setIsGeneratingFullBody(false);
    }
  };

  const handleRest = () => {
    // Si elige descansar, simplemente cerrar el modal
    // El plan se generará cuando vuelva el lunes
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full p-6 border border-yellow-400/30">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Calendar className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              🌟 Hoy es Fin de Semana
            </h2>
            <p className="text-gray-400">
              {new Date().getDay() === 0 ? 'Domingo' : 'Sábado'} - Día de descanso
            </p>
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-6">
          <p className="text-gray-300 mb-3">
            <strong className="text-blue-400">🎯 Es fin de semana, toca descanso.</strong>
          </p>
          <p className="text-gray-400 text-sm mb-3">
            El descanso es parte fundamental del progreso. Tu cuerpo necesita recuperarse para crecer más fuerte.
          </p>
          <p className="text-gray-300 text-sm">
            Pero si aún así quieres entrenar, podemos generar un <span className="text-yellow-400 font-semibold">entrenamiento especial para hoy</span>.
          </p>
        </div>

        {/* Opciones */}
        <div className="space-y-3 mb-6">
          {/* Opción 1: Entrenar Solo Hoy */}
          <button
            onClick={() => setSelectedOption('today-only')}
            className={`w-full p-4 rounded-xl border transition-all text-left ${
              selectedOption === 'today-only'
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
                  Entrenar Solo Hoy
                </h3>
                <p className="text-sm text-gray-400">
                  Genera un entrenamiento Full Body adaptado a tu nivel para hoy.
                  Sin compromisos, sin planes. Solo una buena sesión.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    Solo para hoy
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    45-60 minutos
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    Se guarda en histórico
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Opción 2: Descansar */}
          <button
            onClick={() => setSelectedOption('rest')}
            className={`w-full p-4 rounded-xl border transition-all text-left ${
              selectedOption === 'rest'
                ? 'bg-blue-500/10 border-blue-500/50'
                : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">
                  Descansar (Recomendado)
                </h3>
                <p className="text-sm text-gray-400">
                  Tómate el día libre. Tu plan de {nivel} comenzará el próximo lunes
                  con toda la energía.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    Recuperación óptima
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    Plan desde lunes
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    Mejor progreso
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Mensaje adicional según selección */}
        {selectedOption && (
          <div className={`p-3 rounded-lg mb-4 ${
            selectedOption === 'today-only'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-blue-500/10 border border-blue-500/20'
          }`}>
            <p className="text-sm text-gray-300">
              {selectedOption === 'today-only'
                ? '💪 Perfecto! Vamos a generar un entrenamiento especial para hoy. No afectará tu plan semanal.'
                : '🌟 Excelente decisión. El descanso también es entrenamiento. Nos vemos el lunes.'
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
              if (selectedOption === 'today-only') {
                handleTodayOnlyGeneration();
              } else if (selectedOption === 'rest') {
                handleRest();
              }
            }}
            disabled={!selectedOption || isGeneratingFullBody}
            className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
              selectedOption
                ? selectedOption === 'today-only'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
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
                  {selectedOption === 'today-only'
                    ? 'Generar Entrenamiento'
                    : selectedOption === 'rest'
                    ? 'Descansar Hoy'
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