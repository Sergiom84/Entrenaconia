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

  // Preparar datos y pasar al callback onGenerate
  const handleGenerate = async () => {
    try {
      const userLevel = evaluation?.level || 'Principiante';
      const levelConfig = getLevelConfig(userLevel);

      // Calcular calendario inteligente
      const today = new Date();
      const scheduleConfig = calculateFullBodySchedule(today);
      const weeks = generateWeeksWithDates(today, scheduleConfig);

      // Seleccionar ejercicios variados desde Supabase
      const selectedExercises = await selectVariedExercises(userLevel);

      // Asignar ejercicios a cada sesión según su template
      const weeksWithExercises = weeks.map(week => ({
        ...week,
        sesiones: week.sesiones.map(session => {
          // Mapear template a la clave correcta
          const templateMap = {
            'A': 'templateA',
            'B': 'templateB',
            'C': 'templateC',
            'templateA': 'templateA',
            'templateB': 'templateB',
            'templateC': 'templateC'
          };

          const templateKey = templateMap[session.template] || 'templateA';
          const ejercicios = selectedExercises[templateKey] || [];

          return {
            ...session,
            nombre: `Full Body ${session.template}`,
            ejercicios: ejercicios.map(ex => ({
              ...ex,
              series: levelConfig.setsPerExercise,
              repeticiones: levelConfig.repsRange,
              descanso_segundos: levelConfig.restSeconds,
              rir_objetivo: levelConfig.rirTarget
            }))
          };
        })
      }));

      // Preparar datos para pasar al callback
      const hipertrofiaV2Data = {
        metodologia: 'HipertrofiaV2',
        mode: 'manual',
        nivel: userLevel,
        frecuencia_semanal: levelConfig.frequency,
        semanas_totales: scheduleConfig.totalWeeks,
        split_type: 'full_body',
        semanas: weeksWithExercises,
        ejercicios_seleccionados: selectedExercises,
        configuracion: {
          sets: levelConfig.setsPerExercise,
          reps: levelConfig.repsRange,
          rir_target: levelConfig.rirTarget,
          rest_seconds: levelConfig.restSeconds,
          tracking_enabled: true
        },
        planData: {
          metodologia: 'HipertrofiaV2',
          nivel: userLevel,
          frecuencia_semanal: levelConfig.frequency,
          semanas_totales: scheduleConfig.totalWeeks,
          split_type: 'full_body',
          semanas: weeksWithExercises,
          ejercicios_seleccionados: selectedExercises,
          configuracion: {
            sets: levelConfig.setsPerExercise,
            reps: levelConfig.repsRange,
            rir_target: levelConfig.rirTarget,
            rest_seconds: levelConfig.restSeconds,
            tracking_enabled: true
          }
        }
      };

      console.log('✅ Datos preparados para HipertrofiaV2, llamando a onGenerate callback');

      // Llamar al callback de MethodologiesScreen
      onGenerate(hipertrofiaV2Data);

    } catch (error) {
      console.error('❌ Error preparando datos HipertrofiaV2:', error);
      alert('Error al preparar el plan. Por favor, intenta de nuevo.');
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
              Hipertrofia V2
            </h2>
            <p className="text-blue-100 text-sm">
              Sistema de Tracking con RIR - Full Body
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
                  🎯 Características del Sistema V2:
                </h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Full Body 3x/semana:</strong> Lunes, Miércoles, Viernes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Ejercicios Variados:</strong> Selección aleatoria cada generación</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Tracking RIR:</strong> Registra peso, reps y RIR por serie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Autorregulación:</strong> Ajustes automáticos basados en RIR</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Calendario Inteligente:</strong> Se adapta al día de inicio</span>
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
                    📅 Calendario Adaptativo
                  </h4>
                </div>
                <p className="text-gray-400 text-sm">
                  El sistema calculará automáticamente las sesiones según el día de hoy.
                  Si empiezas a mitad de semana, recuperarás las sesiones al final del bloque.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('evaluation')}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    'Generar Plan'
                  )}
                </button>
              </div>
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
