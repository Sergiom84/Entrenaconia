import { useState } from 'react';
import { Calendar, Dumbbell, Loader2, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const TRAINING_TYPES = [
  { value: 'hipertrofia', label: 'Hipertrofia', desc: 'Ganar masa muscular', icon: '💪' },
  { value: 'fuerza', label: 'Fuerza', desc: 'Aumentar fuerza máxima', icon: '🏋️' },
  { value: 'resistencia', label: 'Resistencia', desc: 'Mejorar capacidad aeróbica', icon: '🏃' },
  { value: 'general', label: 'General', desc: 'Entrenamiento variado', icon: '⚡' }
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Componente generador de planes nutricionales deterministas
 * Permite configurar duración y días de entrenamiento
 */
export default function NutritionPlanGenerator({ onPlanGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  const [config, setConfig] = useState({
    duracion_dias: 7,
    training_type: 'hipertrofia',
    training_schedule: [true, false, true, false, true, false, false] // Patrón por defecto
  });

  const toggleTrainingDay = (index) => {
    const newSchedule = [...config.training_schedule];
    newSchedule[index] = !newSchedule[index];
    setConfig(prev => ({ ...prev, training_schedule: newSchedule }));
  };

  const setPreset = (preset) => {
    const schedules = {
      '3dias': [true, false, true, false, true, false, false],
      '4dias': [true, true, false, true, true, false, false],
      '5dias': [true, true, true, false, true, true, false],
      '6dias': [true, true, true, true, true, true, false]
    };

    if (schedules[preset]) {
      setConfig(prev => ({ ...prev, training_schedule: schedules[preset] }));
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('authToken');

      // Validar que tenga perfil primero
      const profileCheck = await fetch(`${API_URL}/api/nutrition-v2/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!profileCheck.ok) {
        throw new Error('Debes configurar tu perfil nutricional primero');
      }

      // Generar plan
      const response = await fetch(`${API_URL}/api/nutrition-v2/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar plan');
      }

      const data = await response.json();
      setGeneratedPlan(data.plan);
      setSuccess(true);

      // Notificar al componente padre
      if (onPlanGenerated) {
        onPlanGenerated(data);
      }

      console.log('✅ Plan generado:', data);
    } catch (err) {
      setError(err.message);
      console.error('Error generando plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const trainingDaysCount = config.training_schedule.filter(d => d).length;
  const restDaysCount = config.training_schedule.length - trainingDaysCount;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-8 h-8 text-yellow-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Generar Plan Nutricional</h2>
            <p className="text-gray-400 text-sm">Cálculo determinista personalizado</p>
          </div>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <p className="text-green-500">¡Plan generado exitosamente!</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Duración del Plan */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              Duración del Plan
            </h3>

            <div className="flex gap-2">
              {[7, 14, 21, 28].map(dias => (
                <button
                  key={dias}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, duracion_dias: dias }))}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    config.duracion_dias === dias
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {dias} días
                </button>
              ))}
            </div>

            <p className="text-gray-400 text-sm mt-2">
              💡 Recomendamos planes de 7-14 días para mejor ajuste
            </p>
          </div>

          {/* Tipo de Entrenamiento */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-yellow-400" />
              Tipo de Entrenamiento
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TRAINING_TYPES.map(({ value, label, desc, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, training_type: value }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    config.training_type === value
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-white font-semibold text-sm">{label}</div>
                  <div className="text-gray-400 text-xs">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Calendario de Entrenamiento */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Días de Entrenamiento (primera semana)
            </h3>

            {/* Presets rápidos */}
            <div className="flex gap-2 mb-4">
              <span className="text-gray-400 text-sm self-center mr-2">Presets:</span>
              {['3dias', '4dias', '5dias', '6dias'].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPreset(preset)}
                  className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                >
                  {preset.charAt(0)} días
                </button>
              ))}
            </div>

            {/* Selector de días */}
            <div className="grid grid-cols-7 gap-2">
              {DIAS_SEMANA.map((dia, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleTrainingDay(index)}
                  className={`aspect-square rounded-lg font-semibold text-sm transition-all ${
                    config.training_schedule[index]
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  <div>{dia}</div>
                  <div className="text-xs mt-1">
                    {config.training_schedule[index] ? '💪' : '😴'}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-300">{trainingDaysCount} días de entreno</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-700 rounded"></div>
                <span className="text-gray-300">{restDaysCount} días de descanso</span>
              </div>
            </div>

            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500 rounded-lg">
              <p className="text-blue-400 text-sm">
                ℹ️ <strong>Carb Cycling:</strong> Días de entreno tendrán +10% carbohidratos, días de descanso -15%
              </p>
            </div>
          </div>

          {/* Resumen Pre-Generación */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2">📋 Resumen de Configuración:</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Duración: <strong className="text-yellow-400">{config.duracion_dias} días</strong></li>
              <li>• Tipo: <strong className="text-yellow-400">{TRAINING_TYPES.find(t => t.value === config.training_type)?.label}</strong></li>
              <li>• Frecuencia: <strong className="text-yellow-400">{trainingDaysCount} entrenamientos/semana</strong></li>
              <li>• Carb Cycling: <strong className="text-green-400">Activado</strong></li>
            </ul>
          </div>

          {/* Botón Generar */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 py-4 rounded-lg font-bold text-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generando Plan Determinista...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                Generar Plan Nutricional
              </>
            )}
          </button>
        </div>

        {/* Plan Generado - Resumen */}
        {generatedPlan && (
          <div className="mt-6 p-6 bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500 rounded-xl">
            <h4 className="text-green-400 font-bold text-lg mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              ¡Plan Generado Exitosamente!
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">TMB</div>
                <div className="text-2xl font-bold text-yellow-400">{generatedPlan.bmr} kcal</div>
                <div className="text-gray-500 text-xs">Metabolismo basal</div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">TDEE</div>
                <div className="text-2xl font-bold text-yellow-400">{generatedPlan.tdee} kcal</div>
                <div className="text-gray-500 text-xs">Gasto total diario</div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Calorías Objetivo</div>
                <div className="text-2xl font-bold text-green-400">{generatedPlan.kcal_objetivo} kcal</div>
                <div className="text-gray-500 text-xs">Por día</div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Comidas</div>
                <div className="text-2xl font-bold text-blue-400">{generatedPlan.comidas_por_dia}</div>
                <div className="text-gray-500 text-xs">Por día</div>
              </div>
            </div>

            <div className="mt-4 bg-gray-800/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-2">Macronutrientes Objetivo (promedio):</div>
              <div className="flex gap-4 text-white">
                <div>
                  <span className="text-red-400 font-bold">{generatedPlan.macros_objetivo.protein_g}g</span>
                  <span className="text-gray-500 text-sm ml-1">proteína</span>
                </div>
                <div>
                  <span className="text-yellow-400 font-bold">{generatedPlan.macros_objetivo.carbs_g}g</span>
                  <span className="text-gray-500 text-sm ml-1">carbohidratos</span>
                </div>
                <div>
                  <span className="text-blue-400 font-bold">{generatedPlan.macros_objetivo.fat_g}g</span>
                  <span className="text-gray-500 text-sm ml-1">grasas</span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-gray-400 text-sm">
              👉 Ve a la pestaña "Calendario" para ver el plan completo día por día
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
