/**
 * Calistenia Manual Card - Nueva UX con Evaluación IA y Selección Inteligente
 * Integra evaluación automática de nivel con IA especializada
 * 
 * @author Claude Code - Sistema IA Avanzado
 * @version 3.0.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  User, 
  Target, 
  Clock, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Database, 
  Activity, 
  Loader,
  Sparkles,
  Settings,
  TrendingUp,
  Shield
} from 'lucide-react';

// Importar configuraciones modulares
import { CALISTENIA_LEVELS, getLevelConfig, getLevelRecommendations } from './CalisteniaLevels.js';
import { getMuscleGroupInfo, getRecommendedGroupsByLevel, generateBalancedSplit } from './CalisteniaMuscleGroups.js';
import { CalisteniaExerciseDatabase, CalisteniaExerciseUtils } from '../../exercises/ExerciseDatabase.js';

// Importar contextos
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';

export default function CalisteniaManualCard({ onGenerate, isLoading }) {
  const { currentUser, user } = useAuth();
  const { userData } = useUserContext();
  
  // Estados principales
  const [currentStep, setCurrentStep] = useState('evaluation'); // 'evaluation' | 'manual_selection' | 'final'
  const [aiEvaluation, setAiEvaluation] = useState(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState(null);
  
  // Estados para selección manual
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [userGoals, setUserGoals] = useState('');
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Estados para preview
  const [showExercisePreview, setShowExercisePreview] = useState(false);
  const [exercisePreview, setExercisePreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  /**
   * Ejecutar evaluación IA al cargar el componente
   */
  useEffect(() => {
    if (!aiEvaluation && !loadingEvaluation) {
      evaluateUserProfile();
    }
  }, []); // Empty dependency array - run only once on mount

  /**
   * Evaluación automática del perfil con IA especializada
   */
  const evaluateUserProfile = async () => {
    setLoadingEvaluation(true);
    setEvaluationError(null);
    
    try {
      console.log('🤖 Iniciando evaluación automática de perfil...');
      
      // El backend ahora obtiene el perfil real directamente de la base de datos
      // No necesitamos enviar datos del frontend, solo el token de autenticación
      const fullProfile = {
        // Solo enviamos el ID para referencia, el backend obtendrá los datos reales
        id: userData?.id || user?.id || currentUser?.id
      };
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calistenia-specialist/evaluate-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userProfile: fullProfile
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error en evaluación');
      }
      
      console.log('✅ Evaluación completada:', result.evaluation);
      setAiEvaluation(result.evaluation);
      
      // Pre-seleccionar grupos musculares recomendados
      const recommendedGroups = getRecommendedGroupsByLevel(result.evaluation.recommended_level);
      setSelectedMuscleGroups(recommendedGroups.map(group => group.id));
      
    } catch (error) {
      console.error('❌ Error en evaluación IA:', error);
      setEvaluationError(error.message);
    } finally {
      setLoadingEvaluation(false);
    }
  };

  /**
   * Generar plan directamente con IA especializada
   */
  const generateWithAI = async () => {
    if (!aiEvaluation) return;
    
    try {
      console.log('🚀 Generando plan con IA especializada...');
      
      // El backend obtiene los datos reales de la base de datos
      const fullProfile = {
        id: userData?.id || user?.id || currentUser?.id
      };
      
      const calisteniaData = {
        methodology: 'Calistenia Specialist',
        source: 'ai_evaluation',
        level: aiEvaluation.recommended_level,
        confidence: aiEvaluation.confidence,
        goals: userGoals || aiEvaluation.suggested_focus_areas?.join(', ') || '',
        selectedMuscleGroups: selectedMuscleGroups,
        aiEvaluation: aiEvaluation,
        userProfile: fullProfile,
        version: '3.0'
      };
      
      onGenerate(calisteniaData);
      
    } catch (error) {
      console.error('❌ Error generando con IA:', error);
      setEvaluationError(error.message);
    }
  };

  /**
   * Ir a selección manual
   */
  const goToManualSelection = () => {
    setCurrentStep('manual_selection');
  };

  /**
   * Manejar selección manual de nivel
   */
  const handleManualLevelSelection = (levelKey) => {
    setSelectedLevel(levelKey);
    const recommendedGroups = getRecommendedGroupsByLevel(levelKey);
    setSelectedMuscleGroups(recommendedGroups.map(group => group.id));
  };

  /**
   * Generar con selección manual
   */
  const generateManually = () => {
    if (!selectedLevel) return;
    
    const levelConfig = getLevelConfig(selectedLevel);
    const recommendations = getLevelRecommendations(selectedLevel);
    const muscleGroupSplit = generateBalancedSplit(selectedLevel, recommendations.maxTrainingDaysPerWeek);
    
    const calisteniaData = {
      methodology: 'Calistenia Manual',
      source: 'manual_selection',
      level: selectedLevel,
      levelConfig: levelConfig,
      goals: userGoals,
      selectedMuscleGroups: selectedMuscleGroups,
      trainingPlan: muscleGroupSplit,
      recommendations: recommendations,
      exercisePreview: exercisePreview,
      version: '3.0'
    };
    
    onGenerate(calisteniaData);
  };

  /**
   * Renderizar pantalla de evaluación IA
   */
  const renderEvaluationStep = () => (
    <div className="max-w-4xl mx-auto">
      {/* Header con colores armonizados */}
      <div className="text-center mb-8">
        <div className="flex justify-center items-center gap-3 mb-4">
          <div className="p-3 bg-yellow-400/10 rounded-full">
            <Brain className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-3xl font-bold text-white">Evaluación IA Calistenia</h2>
          <span className="text-xs px-2 py-1 bg-yellow-400/20 text-yellow-400 rounded-full border border-yellow-400/30">
            v3.0
          </span>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Nuestro sistema IA especializado evalúa tu perfil para recomendarte el nivel óptimo de calistenia
        </p>
      </div>

      {/* Estado de evaluación */}
      <div className="bg-black/40 border border-yellow-400/20 rounded-xl p-6 mb-6">
        {loadingEvaluation ? (
          <div className="text-center py-8">
            <Loader className="w-12 h-12 animate-spin text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Analizando tu perfil...</h3>
            <p className="text-gray-400">
              La IA está evaluando tu experiencia, objetivos y capacidades actuales
            </p>
          </div>
        ) : evaluationError ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-400 mb-2">Error en Evaluación</h3>
            <p className="text-gray-400 mb-4">{evaluationError}</p>
            <button
              onClick={evaluateUserProfile}
              className="px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition-colors"
            >
              Reintentar Evaluación
            </button>
          </div>
        ) : aiEvaluation ? (
          <div>
            {/* Resultado de evaluación */}
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Nivel Recomendado: <span className="text-yellow-400">{aiEvaluation.recommended_level.charAt(0).toUpperCase() + aiEvaluation.recommended_level.slice(1)}</span>
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full" 
                      style={{ width: `${Math.round(aiEvaluation.confidence * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-400">{Math.round(aiEvaluation.confidence * 100)}% confianza</span>
                </div>
                <p className="text-gray-300 text-sm">{aiEvaluation.reasoning}</p>
              </div>
            </div>

            {/* Indicadores clave */}
            {aiEvaluation.key_indicators && aiEvaluation.key_indicators.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-yellow-400" />
                  Factores Clave Detectados
                </h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {aiEvaluation.key_indicators.map((indicator, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {indicator}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Áreas de enfoque sugeridas */}
            {aiEvaluation.suggested_focus_areas && aiEvaluation.suggested_focus_areas.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-yellow-400" />
                  Áreas de Enfoque Recomendadas
                </h4>
                <div className="flex flex-wrap gap-2">
                  {aiEvaluation.suggested_focus_areas.map((area, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 rounded-full text-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Consideraciones de seguridad */}
            {aiEvaluation.safety_considerations && aiEvaluation.safety_considerations.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-400" />
                  Consideraciones de Seguridad
                </h4>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  {aiEvaluation.safety_considerations.map((consideration, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-orange-300">
                      <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                      {consideration}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-600">
              <button
                onClick={generateWithAI}
                disabled={isLoading}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                  isLoading
                    ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                    : 'bg-yellow-400 text-black hover:bg-yellow-300 transform hover:scale-[1.02]'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  {isLoading ? 'Generando...' : 'Generar Plan con IA'}
                </div>
              </button>
              
              <button
                onClick={goToManualSelection}
                disabled={isLoading}
                className="flex-1 px-6 py-3 rounded-xl font-semibold bg-black/40 border border-yellow-400/30 text-yellow-400 hover:bg-black/60 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <Settings className="w-5 h-5" />
                  Elegir Nivel Manualmente
                </div>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  /**
   * Renderizar selección manual
   */
  const renderManualSelection = () => (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center items-center gap-3 mb-4">
          <div className="p-3 bg-yellow-400/10 rounded-full">
            <User className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-3xl font-bold text-white">Selección Manual</h2>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Elige tu nivel basándote en tu experiencia actual en calistenia
        </p>
      </div>

      {/* Selección de Nivel */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-yellow-400" />
          Selecciona tu nivel actual
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(CALISTENIA_LEVELS).map(([key, level]) => (
            <div
              key={key}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                selectedLevel === key
                  ? 'bg-yellow-400/10 border-yellow-400/60 shadow-lg scale-105'
                  : 'bg-black/40 border-yellow-400/20 hover:border-yellow-400/40'
              }`}
              onClick={() => handleManualLevelSelection(key)}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg flex items-center gap-2 text-white">
                  {level.icon} {level.name}
                </h4>
                {selectedLevel === key && <CheckCircle className="w-5 h-5 text-green-400" />}
              </div>
              <p className="text-sm mb-2 text-gray-400">{level.description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Clock className="w-4 h-4 text-yellow-400" />
                {level.frequency}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hitos del nivel seleccionado */}
      {selectedLevel && (
        <div className="mb-8 p-6 bg-black/40 border border-yellow-400/20 rounded-xl">
          <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Hitos para nivel {CALISTENIA_LEVELS[selectedLevel].name}
          </h3>
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {CALISTENIA_LEVELS[selectedLevel].hitos.map((hito, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-black/60 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">{hito}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objetivos específicos */}
      {selectedLevel && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-white">
            Objetivos específicos (opcional)
          </h3>
          <textarea
            value={userGoals}
            onChange={(e) => setUserGoals(e.target.value)}
            placeholder="Ej: Enfocar en dominadas, mejorar handstand, tengo limitaciones en muñecas, busco desarrollar muscle-up..."
            className="w-full p-4 bg-black/40 border border-yellow-400/30 text-white placeholder-gray-500 rounded-lg resize-none h-24 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>
      )}

      {/* Botones de acción */}
      {selectedLevel && (
        <div className="text-center flex gap-3">
          <button
            onClick={() => setCurrentStep('evaluation')}
            className="px-6 py-3 bg-black/40 border border-yellow-400/30 text-yellow-400 rounded-xl hover:bg-black/60 transition-colors"
          >
            ← Volver a Evaluación IA
          </button>
          <button
            onClick={generateManually}
            disabled={isLoading}
            className={`flex-1 px-8 py-3 rounded-xl text-black font-semibold transition-all ${
              isLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-yellow-400 hover:bg-yellow-300 transform hover:scale-[1.02]'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader className="w-5 h-5 animate-spin" />
                Generando plan...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                Generar Plan Manual
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 bg-black text-white min-h-[80vh]">
      {currentStep === 'evaluation' ? renderEvaluationStep() : renderManualSelection()}
    </div>
  );
}