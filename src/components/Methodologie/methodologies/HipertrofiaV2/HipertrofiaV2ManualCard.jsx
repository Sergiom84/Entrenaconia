/**
 * HipertrofiaV2 Manual Card - Sistema de Tracking con RIR
 * Full Body con variedad de ejercicios y autorregulación
 *
 * @version 2.0.0 - Sistema de Tracking RIR
 */

import React, { useState } from 'react';
import {
  Dumbbell,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Loader,
  Target,
  Calendar
} from 'lucide-react';
import { useWorkout } from '../../../../contexts/WorkoutContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { getLevelConfig } from './config/progressionRules';
import {
  calculateFullBodySchedule,
  generateWeeksWithDates,
  BEGINNER_FULL_BODY_PATTERNS
} from './config/fullBodyPatterns';

export default function HipertrofiaV2ManualCard({ onGenerate, isLoading, error }) {
  const { user } = useAuth();

  const [step, setStep] = useState('evaluation'); // 'evaluation' | 'confirmed'
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [generating, setGenerating] = useState(false); // Estado local de generación

  // Evaluar perfil del usuario
  const handleEvaluate = async () => {
    setEvaluating(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/hipertrofia-specialist/evaluate-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          userId: user.id
        })
      });

      if (!response.ok) {
        throw new Error('Error al evaluar perfil');
      }

      const data = await response.json();

      setEvaluation({
        level: data.nivel_hipertrofia || 'Principiante',
        experience: data.experiencia || 'Sin experiencia',
        recommendation: data.recomendacion || 'Full Body 3x/semana'
      });

      setStep('confirmed');
    } catch (error) {
      console.error('Error evaluando perfil:', error);
      // Fallback: Asignar principiante por defecto
      setEvaluation({
        level: 'Principiante',
        experience: 'Sin evaluación',
        recommendation: 'Full Body 3x/semana - Recomendado para comenzar'
      });
      setStep('confirmed');
    } finally {
      setEvaluating(false);
    }
  };

  // NUEVO: Generar plan D1-D5 usando Motor MindFeed
  const handleGenerate = async () => {
    setGenerating(true); // Activar loading local

    try {
      const userLevel = evaluation?.level || 'Principiante';

      console.log('🏋️ [MINDFEED] Generando plan D1-D5 para nivel:', userLevel);

      // Llamar al nuevo endpoint de generación D1-D5
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/hipertrofiav2/generate-d1d5`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            nivel: userLevel,
            totalWeeks: 8,  // 8 semanas para 40 sesiones (5 sesiones/semana × 8 semanas = 40)
            startConfig: {
              startDate: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
              distributionOption: 'consecutive' // Distribución consecutiva desde hoy
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar plan D1-D5');
      }

      const data = await response.json();

      console.log('✅ [MINDFEED] Plan D1-D5 generado:', data);

      // 🔧 TRANSFORMAR ESTRUCTURA: sessions[] → semanas[] para compatibilidad con validatePlanData
      // El plan D1-D5 se repite durante totalWeeks semanas
      const totalWeeks = data.plan.total_weeks || 6;
      const baseSessions = data.plan.sessions.map((session, idx) => ({
        id: session.id || idx,
        dia: session.session_name || session.nombre_sesion || `D${idx + 1}`,
        dia_semana: session.session_name || session.nombre_sesion || `D${idx + 1}`,
        ejercicios: session.ejercicios || session.exercises || []
      }));

      const transformedPlan = {
        ...data.plan,
        methodologyPlanId: data.methodologyPlanId,
        fecha_inicio: new Date().toISOString(),
        // Generar 6 semanas con las mismas 5 sesiones D1-D5 en cada una
        semanas: Array.from({ length: totalWeeks }, (_, weekIdx) => ({
          numero: weekIdx + 1,
          semana: weekIdx + 1,
          sesiones: baseSessions.map((session, sessionIdx) => ({
            ...session,
            // Asegurar IDs únicos por semana
            id: `${session.id}-w${weekIdx + 1}`
          }))
        }))
      };

      // Transformar estructura para compatibilidad con onGenerate
      const hipertrofiaV2Data = {
        metodologia: 'HipertrofiaV2_MindFeed',
        mode: 'manual',
        nivel: userLevel,
        ciclo_type: 'D1-D5',
        semanas_totales: data.plan.total_weeks,
        sessions: data.plan.sessions,  // Array de 5 sesiones D1-D5
        methodologyPlanId: data.methodologyPlanId,
        system_info: data.system_info,

        // Estructura compatible con el callback (ahora con semanas[])
        planData: transformedPlan
      };

      console.log('✅ [MINDFEED] Datos transformados, llamando a onGenerate callback');

      // Llamar al callback de MethodologiesScreen
      onGenerate(hipertrofiaV2Data);

    } catch (error) {
      console.error('❌ [MINDFEED] Error generando plan D1-D5:', error);
      alert(`Error al generar plan: ${error.message}`);
    } finally {
      setGenerating(false); // Desactivar loading
    }
  };

  // Función auxiliar: Seleccionar ejercicios variados
  async function selectVariedExercises(userLevel) {
    const templates = BEGINNER_FULL_BODY_PATTERNS;
    const allExercises = {};

    // Para cada template (A, B, C)
    for (const [templateKey, template] of Object.entries(templates)) {
      const exercises = [];

      // Para cada patrón muscular
      for (const pattern of template.patterns) {
        try {
          // Llamar al backend para obtener ejercicios aleatorios
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/api/hipertrofiav2/select-exercises`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              },
              body: JSON.stringify({
                categoria: pattern.categoria,
                nivel: userLevel,
                cantidad: pattern.cantidad
              })
            }
          );

          if (response.ok) {
            const data = await response.json();
            exercises.push(...data.exercises);
          }
        } catch (error) {
          console.error(`Error seleccionando ejercicios para ${pattern.categoria}:`, error);
        }
      }

      allExercises[templateKey] = exercises;
    }

    return allExercises;
  }

  return (
    <div className="bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-8 h-8 text-white" />
          <div>
            <h2 className="text-2xl font-bold text-white">
              Hipertrofia V2 - MindFeed
            </h2>
            <p className="text-blue-100 text-sm">
              Sistema de Periodización Inteligente D1-D5
            </p>
          </div>
        </div>
      </div>

      <div>
          {/* PASO 1: Evaluación */}
          {step === 'evaluation' && (
            <div className="space-y-6">
              <div className="text-center">
                <Target className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  Evaluación de Perfil
                </h3>
                <p className="text-gray-400">
                  Analizaremos tu perfil para determinar el nivel adecuado
                </p>
              </div>

              <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-3">
                  🎯 Características del Sistema MindFeed:
                </h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Ciclo D1-D5:</strong> 5 sesiones rotativas (entrena cuando quieras)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Progresión por Microciclo:</strong> +2.5% al completar D1-D5 completo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Tracking RIR:</strong> Registra peso, reps y RIR por serie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Deload Automático:</strong> Cada 6 microciclos completados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Motor de Ciclo:</strong> Avanza solo cuando completas sesiones reales</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Ejercicios Clasificados:</strong> Multiarticulares, unilaterales y analíticos</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleEvaluate}
                disabled={evaluating}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {evaluating ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Evaluando...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Evaluar Perfil
                  </>
                )}
              </button>
            </div>
          )}

          {/* PASO 2: Confirmación y Generación */}
          {step === 'confirmed' && evaluation && (
            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-white mb-2">
                      ✅ Evaluación Completada
                    </h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <p><strong>Nivel:</strong> {evaluation.level}</p>
                      <p><strong>Experiencia:</strong> {evaluation.experience}</p>
                      <p><strong>Recomendación:</strong> {evaluation.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <Calendar className="w-6 h-6 text-blue-400" />
                  <h4 className="font-semibold text-white">
                    🔄 Motor de Ciclo Inteligente
                  </h4>
                </div>
                <p className="text-gray-400 text-sm">
                  El ciclo D1-D5 avanza SOLO cuando completas sesiones reales.
                  Entrena en los días que prefieras - el sistema se adapta a tu calendario y progresa cuando TÚ entrenas.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('evaluation')}
                  disabled={isLoading || generating}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || generating}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(isLoading || generating) ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    'Generar Plan'
                  )}
                </button>
              </div>

              {/* Mensaje de carga visible */}
              {generating && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-400 mb-1">
                        La IA está generando tu entrenamiento
                      </h4>
                      <p className="text-sm text-blue-300">
                        Analizando tu perfil para crear la rutina idónea…
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mostrar error si existe */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400 mb-1">Error</h4>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
