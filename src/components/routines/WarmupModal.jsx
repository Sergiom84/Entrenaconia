import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, X, Clock, Thermometer, CheckCircle } from 'lucide-react';
import { getLevelRecommendations } from '../Methodologie/methodologies/CalisteniaManual/CalisteniaLevels';

/**
 * Modal de Calentamiento - Se muestra antes del entrenamiento principal
 * Incluye ejercicios de calentamiento específicos por nivel y timer
 *
 * Props:
 * - level: Nivel del usuario (básico, intermedio, avanzado)
 * - onComplete: Función llamada al completar calentamiento
 * - onSkip: Función llamada al saltar calentamiento
 * - onClose: Función llamada al cerrar modal
 */
export default function WarmupModal({
  level = 'básico',
  onComplete,
  onSkip,
  onClose
}) {
  // Estados del modal
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30s por ejercicio por defecto
  const [phase, setPhase] = useState('ready'); // 'ready', 'exercise', 'rest', 'completed'
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);

  const intervalRef = useRef(null);

  // Configuración por nivel
  const levelConfig = getLevelRecommendations(level) || {};
  const warmupDuration = levelConfig.warmupDuration || 10; // minutos

  // Ejercicios de calentamiento por nivel
  const warmupExercises = {
    básico: [
      { name: 'Movimientos de brazos', duration: 30, description: 'Círculos lentos hacia adelante y atrás' },
      { name: 'Rotaciones de hombros', duration: 30, description: 'Movimientos suaves y controlados' },
      { name: 'Giros de cuello', duration: 20, description: 'Laterales suaves, evitar movimientos bruscos' },
      { name: 'Flexiones de rodilla', duration: 40, description: 'Alternar piernas, elevación controlada' },
      { name: 'Jumping jacks suaves', duration: 45, description: 'Movimientos lentos y controlados' },
      { name: 'Estiramientos de brazos', duration: 30, description: 'Brazos cruzados y estiramientos laterales' }
    ],
    intermedio: [
      { name: 'Activación articular completa', duration: 45, description: 'Círculos de brazos, piernas y torso' },
      { name: 'Sentadillas lentas', duration: 60, description: '10-15 repeticiones controladas' },
      { name: 'Flexiones inclinadas', duration: 45, description: 'Contra pared o superficie elevada' },
      { name: 'Plancha dinámica', duration: 30, description: 'Mantener posición y pequeños ajustes' },
      { name: 'Burpees modificados', duration: 60, description: 'Sin salto, movimiento controlado' },
      { name: 'Caminata del oso', duration: 45, description: 'Cuadrupedia dinámica' },
      { name: 'Movilidad de cadera', duration: 40, description: 'Círculos y balanceos suaves' }
    ],
    avanzado: [
      { name: 'Calentamiento articular dinámico', duration: 60, description: 'Secuencia completa de articulaciones' },
      { name: 'Activación del core', duration: 45, description: 'Hollow holds y arch holds' },
      { name: 'Flexiones dinámicas', duration: 60, description: '15-20 repeticiones con variaciones' },
      { name: 'Sentadillas jump suaves', duration: 45, description: 'Aterrizaje controlado' },
      { name: 'Bear crawl avanzado', duration: 60, description: 'Con cambios de dirección' },
      { name: 'Handstand prep', duration: 45, description: 'Kicks y holds contra pared' },
      { name: 'Movimientos balísticos', duration: 60, description: 'Preparación para movimientos explosivos' },
      { name: 'Activación específica', duration: 45, description: 'Según objetivos del entrenamiento' }
    ]
  };

  const exercises = warmupExercises[level] || warmupExercises.básico;
  const currentExercise = exercises[currentExerciseIndex] || {};

  // Timer effect
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => t - 1);
        setTotalTimeSpent(total => total + 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      // Auto avanzar al siguiente ejercicio
      handleNextExercise();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleNextExercise = useCallback(() => {
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setTimeLeft(exercises[currentExerciseIndex + 1]?.duration || 30);
      setIsRunning(false);
      setPhase('ready');
    } else {
      // Calentamiento completado
      setPhase('completed');
      setIsRunning(false);
    }
  }, [currentExerciseIndex, exercises]);

  const handleStart = () => {
    setIsRunning(true);
    setPhase('exercise');
    if (timeLeft === 0) {
      setTimeLeft(currentExercise.duration || 30);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleSkip = () => {
    setIsRunning(false);
    onSkip?.();
  };

  const handleComplete = () => {
    console.log(`✅ Calentamiento completado - Tiempo total: ${Math.floor(totalTimeSpent / 60)}:${(totalTimeSpent % 60).toString().padStart(2, '0')}`);
    onComplete?.();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'ready': return 'text-blue-400';
      case 'exercise': return 'text-green-400';
      case 'completed': return 'text-purple-400';
      default: return 'text-white';
    }
  };

  const getProgressPercent = () => {
    return ((currentExerciseIndex + (isRunning ? 0.5 : 0)) / exercises.length) * 100;
  };

  if (phase === 'completed') {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-md p-6 text-center">
          <div className="mb-4">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-white mb-2">¡Calentamiento Completado!</h2>
            <p className="text-gray-300">
              Tiempo total: {formatTime(totalTimeSpent)}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleComplete}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-medium py-3 px-4 rounded-xl transition-colors"
            >
              Comenzar Entrenamiento Principal
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              Salir sin entrenar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl text-white font-bold flex items-center">
              <Thermometer className="w-5 h-5 mr-2 text-orange-400" />
              Calentamiento
            </h2>
            <p className="text-sm text-gray-400">
              Ejercicio {currentExerciseIndex + 1} de {exercises.length} • Nivel {level}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="p-4">
          <div className="bg-gray-700 rounded-full h-2 mb-2">
            <div
              className="bg-orange-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Progreso del calentamiento</span>
            <span>{Math.round(getProgressPercent())}%</span>
          </div>
        </div>

        {/* Exercise Content */}
        <div className="p-6 text-center">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">
              {currentExercise.name || 'Ejercicio de calentamiento'}
            </h3>
            <p className="text-gray-300 text-lg mb-4">
              {currentExercise.description || 'Descripción del ejercicio'}
            </p>
          </div>

          {/* Timer */}
          <div className="mb-8">
            <div className={`text-6xl font-mono font-bold mb-2 ${getPhaseColor()}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="flex items-center justify-center text-gray-400 text-sm">
              <Clock className="w-4 h-4 mr-1" />
              Tiempo total: {formatTime(totalTimeSpent)}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-4 mb-4">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center"
              >
                <Play className="w-5 h-5 mr-2" />
                {phase === 'ready' ? 'Comenzar' : 'Continuar'}
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="bg-orange-500 hover:bg-orange-400 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pausar
              </button>
            )}

            <button
              onClick={handleNextExercise}
              className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center"
            >
              <SkipForward className="w-5 h-5 mr-2" />
              Siguiente
            </button>
          </div>

          {/* Skip Option */}
          <div className="border-t border-gray-700 pt-4">
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Saltar calentamiento e ir directo al entrenamiento
            </button>
          </div>
        </div>

        {/* Info Footer */}
        <div className="p-4 bg-gray-900/50 border-t border-gray-700">
          <div className="flex items-center justify-center text-sm text-gray-400">
            <Thermometer className="w-4 h-4 mr-2" />
            <span>
              El calentamiento reduce el riesgo de lesiones y mejora el rendimiento
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}