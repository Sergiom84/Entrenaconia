import React, { useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, User, Zap, Target, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { HALTEROFILIA_LEVELS, getAllLevels, getLevelConfig } from './HalterofíliaLevels';
import { HALTEROFILIA_MUSCLE_GROUPS, getAllMuscleGroups } from './HalterofiliaMuscleGroups';

// ===============================================
// REDUCER Y ESTADO INICIAL
// ===============================================

const initialState = {
  mode: null, // 'ai' o 'manual'
  selectedLevel: null,
  selectedGroups: [],
  customGoals: '',
  aiEvaluation: null,
  showAdvancedOptions: false,
  errorMessage: null
};

function cardReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...initialState, mode: action.payload };
    case 'SET_LEVEL':
      return { ...state, selectedLevel: action.payload, errorMessage: null };
    case 'TOGGLE_GROUP':
      const groupId = action.payload;
      const isSelected = state.selectedGroups.includes(groupId);
      return {
        ...state,
        selectedGroups: isSelected
          ? state.selectedGroups.filter(g => g !== groupId)
          : [...state.selectedGroups, groupId],
        errorMessage: null
      };
    case 'SET_GOALS':
      return { ...state, customGoals: action.payload };
    case 'SET_AI_EVALUATION':
      return {
        ...state,
        aiEvaluation: action.payload,
        selectedLevel: action.payload?.recommended_level || state.selectedLevel,
        errorMessage: null
      };
    case 'TOGGLE_ADVANCED':
      return { ...state, showAdvancedOptions: !state.showAdvancedOptions };
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ===============================================
// COMPONENTE PRINCIPAL
// ===============================================

export default function HalterofíliaManualCard({ onGenerate, isLoading, error }) {
  const [state, dispatch] = useReducer(cardReducer, initialState);
  const [evaluating, setEvaluating] = useState(false);

  // ===============================================
  // HANDLERS
  // ===============================================

  const handleModeSelection = (mode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  };

  const evaluateUserProfile = async () => {
    setEvaluating(true);
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/halterofilia-specialist/evaluate-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ source: 'manual_card' })
      });

      if (!response.ok) {
        throw new Error('Error al evaluar perfil');
      }

      const data = await response.json();
      dispatch({ type: 'SET_AI_EVALUATION', payload: data.evaluation });
    } catch (err) {
      console.error('Error en evaluación:', err);
      dispatch({ type: 'SET_ERROR', payload: 'No se pudo evaluar tu perfil. Selecciona el nivel manualmente.' });
    } finally {
      setEvaluating(false);
    }
  };

  const generateWithAI = () => {
    if (!state.aiEvaluation) return;

    const halterofíliaData = {
      methodology: 'Halterofilia Specialist',
      level: state.aiEvaluation.recommended_level,
      evaluationResult: state.aiEvaluation,
      selectedMuscleGroups: state.selectedGroups.length > 0
        ? state.selectedGroups
        : ['snatch', 'clean_jerk', 'fuerza_base'],
      goals: state.customGoals || 'Desarrollar técnica olímpica y fuerza aplicada',
      userProfile: { id: 'current_user' }
    };

    onGenerate(halterofíliaData);
  };

  const generateManual = () => {
    if (!state.selectedLevel) {
      dispatch({ type: 'SET_ERROR', payload: 'Selecciona un nivel antes de generar' });
      return;
    }

    const halterofíliaData = {
      methodology: 'Halterofilia Specialist',
      level: state.selectedLevel,
      selectedLevel: state.selectedLevel,
      selectedMuscleGroups: state.selectedGroups.length > 0
        ? state.selectedGroups
        : ['snatch', 'clean_jerk', 'fuerza_base'],
      goals: state.customGoals || 'Desarrollar técnica de snatch y clean & jerk',
      userProfile: { id: 'current_user' }
    };

    onGenerate(halterofíliaData);
  };

  // ===============================================
  // RENDER PRINCIPAL
  // ===============================================

  if (!state.mode) {
    return (
      <div className="space-y-6 p-6">
        <Header />
        <ModeSelection onSelect={handleModeSelection} />
      </div>
    );
  }

  if (state.mode === 'ai') {
    if (!state.aiEvaluation) {
      return (
        <div className="space-y-6 p-6">
          <Header />
          <AIEvaluationSection
            onEvaluate={evaluateUserProfile}
            evaluating={evaluating}
            onBack={() => dispatch({ type: 'RESET' })}
          />
          {state.errorMessage && <ErrorAlert message={state.errorMessage} />}
        </div>
      );
    }

    return (
      <div className="space-y-6 p-6">
        <Header />
        <AIResultsSection
          evaluation={state.aiEvaluation}
          onContinue={generateWithAI}
          onBack={() => dispatch({ type: 'RESET' })}
          isLoading={isLoading}
        />
        <MuscleGroupSelection
          selectedGroups={state.selectedGroups}
          onToggle={(groupId) => dispatch({ type: 'TOGGLE_GROUP', payload: groupId })}
        />
        <CustomGoalsInput
          value={state.customGoals}
          onChange={(e) => dispatch({ type: 'SET_GOALS', payload: e.target.value })}
        />
        {(state.errorMessage || error) && <ErrorAlert message={state.errorMessage || error} />}
      </div>
    );
  }

  // Modo manual
  return (
    <div className="space-y-6 p-6">
      <Header />
      <LevelSelection
        selectedLevel={state.selectedLevel}
        onSelect={(level) => dispatch({ type: 'SET_LEVEL', payload: level })}
      />
      <MuscleGroupSelection
        selectedGroups={state.selectedGroups}
        onToggle={(groupId) => dispatch({ type: 'TOGGLE_GROUP', payload: groupId })}
      />
      <CustomGoalsInput
        value={state.customGoals}
        onChange={(e) => dispatch({ type: 'SET_GOALS', payload: e.target.value })}
      />
      <div className="flex gap-3">
        <Button
          onClick={() => dispatch({ type: 'RESET' })}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          Volver
        </Button>
        <Button
          onClick={generateManual}
          className="flex-1 bg-red-500 hover:bg-red-600"
          disabled={!state.selectedLevel || isLoading}
        >
          {isLoading ? 'Generando...' : 'Generar Plan'}
        </Button>
      </div>
      {(state.errorMessage || error) && <ErrorAlert message={state.errorMessage || error} />}
    </div>
  );
}

// ===============================================
// COMPONENTES AUXILIARES
// ===============================================

function Header() {
  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Target className="w-8 h-8 text-red-500" />
        <h2 className="text-2xl font-bold text-white">Halterofilia Olímpica</h2>
      </div>
      <p className="text-gray-400">Snatch y Clean & Jerk - Levantamiento Técnico</p>
    </div>
  );
}

function ModeSelection({ onSelect }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button
        onClick={() => onSelect('ai')}
        className="p-6 bg-gray-800 rounded-xl border-2 border-gray-700 hover:border-red-500 transition-all group"
      >
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-12 h-12 text-red-500 group-hover:scale-110 transition-transform" />
          <h3 className="text-xl font-bold text-white">Evaluación con IA</h3>
          <p className="text-sm text-gray-400 text-center">
            Analiza tu técnica y te recomienda el nivel óptimo
          </p>
        </div>
      </button>

      <button
        onClick={() => onSelect('manual')}
        className="p-6 bg-gray-800 rounded-xl border-2 border-gray-700 hover:border-blue-500 transition-all group"
      >
        <div className="flex flex-col items-center gap-3">
          <User className="w-12 h-12 text-blue-500 group-hover:scale-110 transition-transform" />
          <h3 className="text-xl font-bold text-white">Selección Manual</h3>
          <p className="text-sm text-gray-400 text-center">
            Tú eliges tu nivel y enfoque de entrenamiento
          </p>
        </div>
      </button>
    </div>
  );
}

function AIEvaluationSection({ onEvaluate, evaluating, onBack }) {
  return (
    <div className="space-y-4">
      <Alert className="bg-blue-900/20 border-blue-400/30">
        <Brain className="w-5 h-5 text-blue-400" />
        <AlertDescription className="text-blue-200">
          La IA evaluará tu técnica en snatch, clean & jerk, movilidad overhead y fuerza base.
        </AlertDescription>
      </Alert>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1" disabled={evaluating}>
          Volver
        </Button>
        <Button
          onClick={onEvaluate}
          className="flex-1 bg-red-500 hover:bg-red-600"
          disabled={evaluating}
        >
          {evaluating ? 'Evaluando...' : 'Evaluar mi Nivel'}
        </Button>
      </div>
    </div>
  );
}

function AIResultsSection({ evaluation, onContinue, onBack, isLoading }) {
  const levelConfig = getLevelConfig(evaluation.recommended_level);

  return (
    <div className="space-y-4">
      <Alert className="bg-green-900/20 border-green-400/30">
        <CheckCircle2 className="w-5 h-5 text-green-400" />
        <AlertDescription className="text-green-200">
          <div className="space-y-2">
            <p className="font-bold">Nivel Recomendado: {levelConfig?.name || 'Intermedio'}</p>
            <p className="text-sm">{evaluation.reasoning}</p>
            {evaluation.key_indicators && (
              <div className="mt-2">
                <p className="text-xs font-semibold">Indicadores clave:</p>
                <ul className="text-xs list-disc list-inside">
                  {evaluation.key_indicators.map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1" disabled={isLoading}>
          Nueva Evaluación
        </Button>
        <Button
          onClick={onContinue}
          className="flex-1 bg-red-500 hover:bg-red-600"
          disabled={isLoading}
        >
          {isLoading ? 'Generando...' : 'Generar Plan'}
        </Button>
      </div>
    </div>
  );
}

function LevelSelection({ selectedLevel, onSelect }) {
  const levels = getAllLevels();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">Selecciona tu nivel</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {levels.map((level) => {
          const isSelected = selectedLevel === level.id;
          return (
            <button
              key={level.id}
              onClick={() => onSelect(level.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-red-500 bg-red-900/20'
                  : 'border-gray-700 bg-gray-800 hover:border-red-400'
              }`}
            >
              <div className="text-center space-y-2">
                <span className="text-2xl">{level.icon}</span>
                <p className="font-bold text-white">{level.name}</p>
                <p className="text-xs text-gray-400">{level.frequency}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MuscleGroupSelection({ selectedGroups, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const groups = getAllMuscleGroups();

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-lg font-semibold text-white">
          Enfoque de Entrenamiento {selectedGroups.length > 0 && `(${selectedGroups.length})`}
        </h3>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((group) => {
            const isSelected = selectedGroups.includes(group.id);
            return (
              <button
                key={group.id}
                onClick={() => onToggle(group.id)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-red-500 bg-red-900/20'
                    : 'border-gray-700 bg-gray-800 hover:border-red-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{group.icon}</span>
                  <div>
                    <p className="font-bold text-white text-sm">{group.shortName}</p>
                    <p className="text-xs text-gray-400">{group.category}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!expanded && selectedGroups.length === 0 && (
        <p className="text-sm text-gray-500">Por defecto: Snatch, Clean & Jerk, Fuerza Base</p>
      )}
    </div>
  );
}

function CustomGoalsInput({ value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-white">Objetivos específicos (opcional)</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder="Ej: Mejorar timing de jerk, aumentar overhead squat, trabajar first pull..."
        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:outline-none resize-none"
        rows={3}
      />
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <Alert className="bg-red-900/20 border-red-400/30">
      <AlertCircle className="w-5 h-5 text-red-400" />
      <AlertDescription className="text-red-200">{message}</AlertDescription>
    </Alert>
  );
}
