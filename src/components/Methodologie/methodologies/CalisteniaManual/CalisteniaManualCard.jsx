/**
 * Calistenia Manual Card - Refactorizado con Nueva Arquitectura
 * Integra con base de datos de ejercicios y configuraciones modulares
 * 
 * @author Claude Code - Arquitectura Modular
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { User, Target, Clock, Zap, CheckCircle, AlertTriangle, Database, Activity, Loader } from 'lucide-react';

// Importar configuraciones modulares
import { CALISTENIA_LEVELS, getLevelConfig, getLevelRecommendations } from './CalisteniaLevels.js';
import { getMuscleGroupInfo, getRecommendedGroupsByLevel, generateBalancedSplit } from './CalisteniaMuscleGroups.js';

// Importar sistema de base de datos de ejercicios
import { CalisteniaExerciseDatabase, CalisteniaExerciseUtils } from '../../exercises/ExerciseDatabase.js';

export default function CalisteniaManualCard({ onGenerate, isLoading }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [userGoals, setUserGoals] = useState('');
  const [showExercisePreview, setShowExercisePreview] = useState(false);
  const [exercisePreview, setExercisePreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  /**
   * Cargar preview de ejercicios cuando se selecciona un nivel
   */
  useEffect(() => {
    if (selectedLevel && showExercisePreview) {
      loadExercisePreview(selectedLevel);
    }
  }, [selectedLevel, showExercisePreview]);

  /**
   * Cargar ejercicios de preview desde la base de datos
   */
  const loadExercisePreview = async (level) => {
    setLoadingPreview(true);
    try {
      const exercises = await CalisteniaExerciseDatabase.getRecommendedExercises(
        level,
        selectedMuscleGroups,
        'minimal' // Para mostrar ejercicios que no requieren mucho equipamiento
      );
      
      setExercisePreview(exercises.slice(0, 6)); // Mostrar solo los primeros 6 como preview
    } catch (error) {
      console.error('Error cargando preview de ejercicios:', error);
      setExercisePreview([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  /**
   * Manejar selección de nivel
   */
  const handleLevelSelection = (levelKey) => {
    setSelectedLevel(levelKey);
    
    // Auto-seleccionar grupos musculares recomendados para el nivel
    const recommendedGroups = getRecommendedGroupsByLevel(levelKey);
    setSelectedMuscleGroups(recommendedGroups.map(group => group.id));
  };

  /**
   * Manejar generación del plan
   */
  const handleGenerate = () => {
    if (!selectedLevel) return;
    
    const levelConfig = getLevelConfig(selectedLevel);
    const recommendations = getLevelRecommendations(selectedLevel);
    const muscleGroupSplit = generateBalancedSplit(selectedLevel, recommendations.maxTrainingDaysPerWeek);
    
    const calisteniaData = {
      methodology: 'Calistenia Manual',
      level: selectedLevel,
      levelConfig: levelConfig,
      goals: userGoals,
      selectedMuscleGroups: selectedMuscleGroups,
      trainingPlan: muscleGroupSplit,
      recommendations: recommendations,
      exercisePreview: exercisePreview,
      version: '2.0'
    };
    
    onGenerate(calisteniaData);
  };

  /**
   * Renderizar preview de ejercicios
   */
  const renderExercisePreview = () => {
    if (!showExercisePreview) return null;

    return (
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Preview de Ejercicios Disponibles
          </h4>
          <button
            onClick={() => setShowExercisePreview(false)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Ocultar
          </button>
        </div>
        
        {loadingPreview ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Cargando ejercicios desde base de datos...</span>
          </div>
        ) : exercisePreview.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exercisePreview.map((exercise, index) => {
              const seriesReps = CalisteniaExerciseUtils.parseSeriesReps(exercise.series_reps_objetivo);
              const difficulty = CalisteniaExerciseUtils.getDifficultyInfo(exercise);
              
              return (
                <div key={exercise.exercise_id} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-sm text-gray-800">{exercise.nombre}</h5>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                      {difficulty.icon}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><span className="font-medium">Categoría:</span> {exercise.categoria}</p>
                    <p><span className="font-medium">Equipamiento:</span> {exercise.equipamiento}</p>
                    {seriesReps && (
                      <p><span className="font-medium">Series/Reps:</span> {exercise.series_reps_objetivo}</p>
                    )}
                  </div>
                  
                  {exercise.notas && (
                    <p className="text-xs text-blue-600 mt-2 italic">{exercise.notas}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No se encontraron ejercicios para este nivel.</p>
            <p className="text-xs mt-1">Verifica que haya ejercicios en la base de datos.</p>
          </div>
        )}
      </div>
    );
  };

  /**
   * Renderizar opciones avanzadas
   */
  const renderAdvancedOptions = () => {
    if (!showAdvancedOptions || !selectedLevel) return null;

    const recommendedGroups = getRecommendedGroupsByLevel(selectedLevel);

    return (
      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Opciones Avanzadas
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grupos Musculares a Enfocar:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {recommendedGroups.map(group => (
                <label key={group.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedMuscleGroups.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMuscleGroups([...selectedMuscleGroups, group.id]);
                      } else {
                        setSelectedMuscleGroups(selectedMuscleGroups.filter(id => id !== group.id));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{group.name} {group.icon}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center items-center gap-3 mb-4">
          <User className="w-8 h-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">Calistenia Manual</h2>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">v2.0</span>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Sistema avanzado de entrenamiento con peso corporal integrado con base de datos de ejercicios
        </p>
      </div>

      {/* Selección de Nivel */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Selecciona tu nivel actual
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(CALISTENIA_LEVELS).map(([key, level]) => (
            <div
              key={key}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                selectedLevel === key
                  ? `${level.color} border-opacity-100 shadow-lg scale-105`
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleLevelSelection(key)}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  {level.icon} {level.name}
                </h4>
                {selectedLevel === key && <CheckCircle className="w-5 h-5 text-green-600" />}
              </div>
              <p className="text-sm mb-2 opacity-75">{level.description}</p>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                {level.frequency}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hitos del nivel seleccionado */}
      {selectedLevel && (
        <div className="mb-8 p-6 bg-white rounded-xl shadow-md">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Hitos para nivel {CALISTENIA_LEVELS[selectedLevel].name}
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {CALISTENIA_LEVELS[selectedLevel].hitos.map((hito, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{hito}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Importante</p>
                <p className="text-sm text-yellow-700">
                  Los criterios se evalúan con los ejercicios de tu base de datos personal. 
                  El sistema adapta automáticamente las progresiones según tu rendimiento real.
                </p>
              </div>
            </div>
          </div>

          {/* Controles de Preview y Opciones Avanzadas */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setShowExercisePreview(!showExercisePreview)}
              className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              {showExercisePreview ? 'Ocultar' : 'Ver'} Ejercicios Disponibles
            </button>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Opciones Avanzadas
            </button>
          </div>
        </div>
      )}

      {/* Preview de ejercicios */}
      {renderExercisePreview()}

      {/* Opciones avanzadas */}
      {renderAdvancedOptions()}

      {/* Objetivos específicos */}
      {selectedLevel && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">
            Objetivos específicos (opcional)
          </h3>
          <textarea
            value={userGoals}
            onChange={(e) => setUserGoals(e.target.value)}
            placeholder="Ej: Enfocar en dominadas, mejorar handstand, tengo limitaciones en muñecas, busco desarrollar muscle-up..."
            className="w-full p-4 border border-gray-300 rounded-lg resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Información del sistema */}
      <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">
          🔬 Sistema Integrado v2.0
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <p className="font-medium mb-2">Base de Datos Real:</p>
            <ul className="space-y-1 text-xs">
              <li>• Ejercicios específicos de calistenia</li>
              <li>• Progresiones científicamente validadas</li>
              <li>• Criterios objetivos de avance</li>
              <li>• Adaptación a equipamiento disponible</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-2">Funcionalidades Avanzadas:</p>
            <ul className="space-y-1 text-xs">
              <li>• Sistema modular y escalable</li>
              <li>• Preview en tiempo real</li>
              <li>• Configuraciones personalizables</li>
              <li>• Integración con progreso histórico</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Botón de generación */}
      <div className="text-center">
        <button
          onClick={handleGenerate}
          disabled={!selectedLevel || isLoading}
          className={`px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 ${
            !selectedLevel || isLoading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 shadow-lg'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Generando rutina personalizada...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Generar Plan de Calistenia Avanzado
            </div>
          )}
        </button>
      </div>

      {/* Detalles técnicos */}
      <div className="mt-8 text-center">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 text-sm underline"
        >
          {showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
        </button>
        
        {showDetails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
            <h4 className="font-semibold mb-2">Arquitectura del Sistema v2.0:</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <p className="font-medium mb-1">Backend:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>API REST para ejercicios (/api/exercises/calistenia)</li>
                  <li>Base de datos PostgreSQL con ejercicios reales</li>
                  <li>Sistema de progresiones automáticas</li>
                  <li>Filtrado inteligente por nivel y equipamiento</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">Frontend:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>Arquitectura modular con configuraciones separadas</li>
                  <li>Preview en tiempo real de ejercicios</li>
                  <li>Validación de criterios de progreso</li>
                  <li>Sistema de hooks personalizados</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}