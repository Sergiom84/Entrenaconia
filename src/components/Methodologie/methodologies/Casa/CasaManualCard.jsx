import React, { useReducer } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import tokenManager from '../../../../utils/tokenManager';
import { CASA_LEVELS, getLevelConfig, getTrainingConstants } from './CasaLevels';
import { CASA_TRAINING_CATEGORIES, generateBalancedSplit } from './CasaMuscleGroups';
import { Loader2, Home, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

// Estado inicial del componente
const initialState = {
  mode: null, // 'ai' | 'manual'
  selectedLevel: null,
  selectedCategories: [],
  customGoals: '',
  equipmentLevel: 'basico', // 'minimo' | 'basico' | 'avanzado'
  spaceAvailable: 'medio', // 'reducido' | 'medio' | 'amplio'
  aiEvaluation: null,
  showAdvancedOptions: false,
  errorMessage: null,
  isEvaluating: false
};

// Reducer para gestión de estado
function casaCardReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...initialState, mode: action.payload };

    case 'SET_LEVEL':
      return { ...state, selectedLevel: action.payload };

    case 'TOGGLE_CATEGORY': {
      const category = action.payload;
      const isSelected = state.selectedCategories.includes(category);
      return {
        ...state,
        selectedCategories: isSelected
          ? state.selectedCategories.filter(c => c !== category)
          : [...state.selectedCategories, category]
      };
    }

    case 'SET_EQUIPMENT_LEVEL':
      return { ...state, equipmentLevel: action.payload };

    case 'SET_SPACE_AVAILABLE':
      return { ...state, spaceAvailable: action.payload };

    case 'SET_CUSTOM_GOALS':
      return { ...state, customGoals: action.payload };

    case 'TOGGLE_ADVANCED_OPTIONS':
      return { ...state, showAdvancedOptions: !state.showAdvancedOptions };

    case 'SET_AI_EVALUATION':
      return { ...state, aiEvaluation: action.payload, isEvaluating: false };

    case 'SET_EVALUATING':
      return { ...state, isEvaluating: action.payload };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload, isEvaluating: false };

    case 'CLEAR_ERROR':
      return { ...state, errorMessage: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export default function CasaManualCard({ onGenerate, isLoading, error }) {
  const [state, dispatch] = useReducer(casaCardReducer, initialState);
  const { user } = useAuth();

  // Evaluación AI del perfil del usuario
  const evaluateUserProfile = async () => {
    if (!user) {
      dispatch({ type: 'SET_ERROR', payload: 'No hay usuario autenticado' });
      return;
    }

    dispatch({ type: 'SET_EVALUATING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const token = tokenManager.getToken();
      const response = await fetch('/api/casa-specialist/evaluate-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          source: 'manual_card',
          context: 'entrenamiento_casa'
        })
      });

      if (!response.ok) {
        throw new Error('Error en la evaluación del perfil');
      }

      const data = await response.json();

      if (data.success && data.evaluation) {
        dispatch({ type: 'SET_AI_EVALUATION', payload: data.evaluation });
      } else {
        throw new Error(data.error || 'No se pudo evaluar el perfil');
      }
    } catch (error) {
      console.error('Error evaluando perfil:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Error al evaluar perfil' });
    }
  };

  // Generar plan con datos seleccionados
  const handleGeneratePlan = async () => {
    // Validaciones
    if (state.mode === 'manual' && !state.selectedLevel) {
      dispatch({ type: 'SET_ERROR', payload: 'Debes seleccionar un nivel' });
      return;
    }

    if (state.mode === 'manual' && state.selectedCategories.length === 0) {
      dispatch({ type: 'SET_ERROR', payload: 'Debes seleccionar al menos una categoría de entrenamiento' });
      return;
    }

    // Preparar datos para el backend
    const casaData = {
      mode: state.mode,
      selectedLevel: state.mode === 'ai' ? state.aiEvaluation?.nivel_recomendado : state.selectedLevel,
      selectedCategories: state.selectedCategories.length > 0 ? state.selectedCategories : ['funcional', 'fuerza', 'cardio'],
      equipmentLevel: state.equipmentLevel,
      spaceAvailable: state.spaceAvailable,
      customGoals: state.customGoals,
      aiEvaluation: state.mode === 'ai' ? state.aiEvaluation : null
    };

    try {
      await onGenerate(casaData);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Error al generar el plan' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Home className="w-8 h-8 text-yellow-400" />
          <h2 className="text-2xl font-bold text-white">Entrenamiento en Casa</h2>
        </div>
        <p className="text-gray-300 text-sm">
          Maximiza resultados con equipamiento mínimo y espacio disponible
        </p>
      </div>

      {/* Error Display */}
      {(error || state.errorMessage) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-medium">Error</p>
            <p className="text-red-300 text-sm">{error || state.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {!state.mode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'ai' })}
            className="p-6 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border-2 border-yellow-400/30 rounded-xl hover:border-yellow-400 transition-all group"
          >
            <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-white mb-2">Evaluación con IA</h3>
            <p className="text-gray-300 text-sm">
              Dejanos evaluar tu perfil y recomendarte el mejor plan personalizado
            </p>
          </button>

          <button
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'manual' })}
            className="p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-400/30 rounded-xl hover:border-blue-400 transition-all group"
          >
            <Home className="w-12 h-12 text-blue-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-white mb-2">Selección Manual</h3>
            <p className="text-gray-300 text-sm">
              Elige tu nivel y categorías de entrenamiento que prefieras
            </p>
          </button>
        </div>
      )}

      {/* AI Evaluation Section */}
      {state.mode === 'ai' && !state.aiEvaluation && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Evaluación Inteligente
            </h3>
            <p className="text-gray-300 text-sm">
              Analizaremos tu perfil, experiencia y objetivos para recomendarte el plan de entrenamiento en casa más adecuado.
            </p>
            <button
              onClick={evaluateUserProfile}
              disabled={state.isEvaluating}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state.isEvaluating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Evaluando perfil...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Evaluar mi perfil
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* AI Evaluation Results */}
      {state.mode === 'ai' && state.aiEvaluation && (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-bold text-white">Evaluación Completada</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Nivel Recomendado</p>
                <p className="text-white font-bold text-lg capitalize">{state.aiEvaluation.nivel_recomendado}</p>
              </div>

              {state.aiEvaluation.razonamiento && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-2">Análisis</p>
                  <p className="text-gray-200 text-sm">{state.aiEvaluation.razonamiento}</p>
                </div>
              )}

              {state.aiEvaluation.categorias_recomendadas && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-2">Categorías Recomendadas</p>
                  <div className="flex flex-wrap gap-2">
                    {state.aiEvaluation.categorias_recomendadas.map((cat) => (
                      <span key={cat} className="px-3 py-1 bg-yellow-400/20 text-yellow-400 rounded-full text-xs font-medium capitalize">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={isLoading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generando plan...
                </>
              ) : (
                <>
                  Generar Plan Personalizado
                </>
              )}
            </button>

            <button
              onClick={() => dispatch({ type: 'RESET' })}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Volver a evaluar
            </button>
          </div>
        </div>
      )}

      {/* Manual Selection Section */}
      {state.mode === 'manual' && (
        <div className="space-y-6">
          {/* Level Selection */}
          <div className="space-y-3">
            <label className="text-white font-bold text-sm">Selecciona tu nivel</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(CASA_LEVELS).map(([key, level]) => (
                <button
                  key={key}
                  onClick={() => dispatch({ type: 'SET_LEVEL', payload: key })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    state.selectedLevel === key
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{level.icon}</div>
                  <h4 className="text-white font-bold text-sm mb-1">{level.name}</h4>
                  <p className="text-gray-400 text-xs">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-white font-bold text-sm">Categorías de Entrenamiento</label>
            <p className="text-gray-400 text-xs">Selecciona una o más categorías (mínimo 1)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(CASA_TRAINING_CATEGORIES).map(([key, category]) => {
                const isSelected = state.selectedCategories.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => dispatch({ type: 'TOGGLE_CATEGORY', payload: key })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-2">{category.icon}</div>
                    <h4 className="text-white font-bold text-xs mb-1">{category.name}</h4>
                    <p className="text-gray-400 text-xs line-clamp-2">{category.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Equipment Level */}
          <div className="space-y-3">
            <label className="text-white font-bold text-sm">Equipamiento Disponible</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'minimo', label: 'Mínimo', desc: 'Peso corporal, silla, toalla' },
                { value: 'basico', label: 'Básico', desc: 'Bandas, mancuernas ajustables' },
                { value: 'avanzado', label: 'Avanzado', desc: 'TRX, kettlebells, barra' }
              ].map((eq) => (
                <button
                  key={eq.value}
                  onClick={() => dispatch({ type: 'SET_EQUIPMENT_LEVEL', payload: eq.value })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    state.equipmentLevel === eq.value
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <h4 className="text-white font-bold text-sm mb-1">{eq.label}</h4>
                  <p className="text-gray-400 text-xs">{eq.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Space Available */}
          <div className="space-y-3">
            <label className="text-white font-bold text-sm">Espacio Disponible</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'reducido', label: 'Reducido', desc: '~2x2 metros' },
                { value: 'medio', label: 'Medio', desc: '~3x3 metros' },
                { value: 'amplio', label: 'Amplio', desc: '4+ metros' }
              ].map((sp) => (
                <button
                  key={sp.value}
                  onClick={() => dispatch({ type: 'SET_SPACE_AVAILABLE', payload: sp.value })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    state.spaceAvailable === sp.value
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <h4 className="text-white font-bold text-sm mb-1">{sp.label}</h4>
                  <p className="text-gray-400 text-xs">{sp.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Goals */}
          <div className="space-y-3">
            <label className="text-white font-bold text-sm">Objetivos Específicos (Opcional)</label>
            <textarea
              value={state.customGoals}
              onChange={(e) => dispatch({ type: 'SET_CUSTOM_GOALS', payload: e.target.value })}
              placeholder="Ej: Quiero mejorar mi resistencia cardiovascular, necesito ejercicios de bajo impacto por lesión de rodilla, prefiero entrenamientos cortos..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm resize-none focus:border-yellow-400 focus:outline-none"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGeneratePlan}
            disabled={isLoading || !state.selectedLevel || state.selectedCategories.length === 0}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generando plan...
              </>
            ) : (
              <>
                Generar Plan de Entrenamiento en Casa
              </>
            )}
          </button>

          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Reiniciar Selección
          </button>
        </div>
      )}

      {/* Back to Mode Selection */}
      {state.mode && !state.aiEvaluation && state.mode !== 'manual' && (
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Volver atrás
        </button>
      )}
    </div>
  );
}
