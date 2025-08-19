import { ArrowLeft, Home, Dumbbell, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HomeTrainingExerciseModal from './HomeTrainingExerciseModal';
import HomeTrainingProgress from './HomeTrainingProgress';
import HomeTrainingPlanModal from './HomeTrainingPlanModal';

const HomeTrainingSection = () => {
  const navigate = useNavigate();
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [selectedTrainingType, setSelectedTrainingType] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPersonalizedMessage, setShowPersonalizedMessage] = useState(false);
  const [personalizedMessage, setPersonalizedMessage] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [hasShownPersonalizedMessage, setHasShownPersonalizedMessage] = useState(false);


  // Estados para el sistema de entrenamiento
  const [currentSession, setCurrentSession] = useState(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sessionProgress, setSessionProgress] = useState({
    currentExercise: 0,
    completedExercises: [],
    percentage: 0
  });
  const [exercisesProgress, setExercisesProgress] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  // Flags para evitar PUT duplicados
  const [sending, setSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(false);

  // Función para resetear todo al estado inicial
  const resetToInitialState = () => {
    setSelectedEquipment(null);
    setSelectedTrainingType(null);
    setIsGenerating(false);
    setShowPersonalizedMessage(false);
    setPersonalizedMessage('');
    setGeneratedPlan(null);
    setCurrentSession(null);
    setShowExerciseModal(false);
    setCurrentExerciseIndex(0);
    setSessionProgress({
      currentExercise: 0,
      completedExercises: [],
      percentage: 0
    });
    setShowProgress(false);
  };

  // Cargar datos al inicializar el componente
  useEffect(() => {
    loadCurrentPlan();
    loadUserStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Función para cargar el plan actual del usuario
  const loadCurrentPlan = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/home-training/current-plan', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success && data.plan) {
        setGeneratedPlan({
          plan_entrenamiento: data.plan.plan_data.plan_entrenamiento,
          mensaje_personalizado: data.plan.plan_data.mensaje_personalizado,
          plan_source: data.plan.plan_data.plan_source,
          plan_id: data.plan.id
        });
        setSelectedEquipment(data.plan.equipment_type);
        setSelectedTrainingType(data.plan.training_type);
        setShowProgress(true);

        if (data.session) {
          setCurrentSession(data.session);
          await loadSessionProgress(data.session.id);
        }
      }
    } catch (error) {
      console.error('Error loading current plan:', error);
    }
  };

  // Función para cargar estadísticas del usuario
  const loadUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/home-training/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  // Función para cargar el progreso de la sesión
  const loadSessionProgress = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home-training/sessions/${sessionId}/progress`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSessionProgress(data.progress);
        setCurrentExerciseIndex(data.progress.currentExercise);
        setExercisesProgress(data.exercises || []);
      }
    } catch (error) {
      console.error('Error loading session progress:', error);
    }
  };

  // Función para generar entrenamiento con IA
  const generateTraining = async () => {
    if (!selectedEquipment || !selectedTrainingType) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Debes iniciar sesión para generar tu entrenamiento');
        return;
      }

      // ① Mostrar loader ANTES de llamar a la IA
      setIsGenerating(true);
      setShowPersonalizedMessage(false);
      // Reset del flag para un nuevo plan
      setHasShownPersonalizedMessage(false);

      // ② Llamada a la IA
      const resp = await fetch('/api/ia-home-training/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipment_type: selectedEquipment,
          training_type: selectedTrainingType
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success || !data.plan) {
        throw new Error(data.error || 'Error al generar el entrenamiento');
      }

      // ③ Guardar plan y preparar mensaje
      setGeneratedPlan(data.plan);
      const message = data.plan.mensaje_personalizado || 'Tu entrenamiento personalizado ha sido generado.';
      setPersonalizedMessage(message);

      // ④ Ocultar loader y mostrar mensaje personalizado (solo primera vez por plan)
      setIsGenerating(false);
      if (!hasShownPersonalizedMessage) {
        setShowPersonalizedMessage(true);
        setHasShownPersonalizedMessage(true);
      }

      // ⑤ Persistir en BD (opcionalmente puedes hacerlo tras aceptar el plan)
      await savePlanToDatabase(data.plan, selectedEquipment, selectedTrainingType);
    } catch (error) {
      console.error('Error:', error);
      setIsGenerating(false); // asegurar que se apague si falla
      alert('Error al generar el entrenamiento. Por favor, inténtalo de nuevo.');
    }
  };

  // Función para proceder del mensaje personalizado al plan
  const proceedToGenerating = () => {
    // Antes: encendía el loader 2s (comportamiento invertido)
    setShowPersonalizedMessage(false);
    // El modal del plan aparece porque `generatedPlan` ya está seteado y `showProgress` es false.
  };

  // Función para guardar el plan en la base de datos
  const savePlanToDatabase = async (plan, equipment, trainingType) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/home-training/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_data: plan,
          equipment_type: equipment,
          training_type: trainingType
        })
      });
    } catch (error) {
      console.error('Error saving plan to database:', error);
    }
  };

  // Función para comenzar el entrenamiento
  const startTraining = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Debes iniciar sesión para comenzar el entrenamiento');
        return;
      }

      // Obtener el ID del plan actual
      const planResponse = await fetch('/api/home-training/current-plan', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const planData = await planResponse.json();
      if (!planData.success || !planData.plan) {
        alert('No se encontró un plan de entrenamiento');
        return;
      }

      // Iniciar nueva sesión
      const sessionResponse = await fetch('/api/home-training/sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          home_training_plan_id: planData.plan.id
        })
      });

      const sessionData = await sessionResponse.json();
      if (sessionData.success) {
        setCurrentSession(sessionData.session);
        setCurrentExerciseIndex(0);
        setShowProgress(true);
        setShowPersonalizedMessage(false);
        setShowExerciseModal(true);
        // Cargar progreso de la sesión recién creada (para obtener total_series por ejercicio)
        await loadSessionProgress(sessionData.session.id);
      }
    } catch (error) {
      console.error('Error starting training:', error);
      alert('Error al iniciar el entrenamiento');
    }
  };

  // Función para continuar el entrenamiento
  const continueTraining = () => {
    setShowPersonalizedMessage(false);
    setShowExerciseModal(true);
  };

  // Función para completar un ejercicio
  const handleExerciseComplete = async (durationSeconds) => {
    if (sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const exercise = generatedPlan.plan_entrenamiento.ejercicios[currentExerciseIndex];

      await fetch(`/api/home-training/sessions/${currentSession.id}/exercise/${currentExerciseIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ series_completed: exercise.series, status: 'completed', duration_seconds: durationSeconds || null })
      });

      // Actualizar estado local inmediatamente
      const newCompletedExercises = [...sessionProgress.completedExercises, currentExerciseIndex];
      const total = generatedPlan.plan_entrenamiento.ejercicios.length;
      const newPercentage = (newCompletedExercises.length / total) * 100;

      setSessionProgress({
        currentExercise: currentExerciseIndex + 1,
        completedExercises: newCompletedExercises,
        percentage: newPercentage
      });

      if (currentExerciseIndex < generatedPlan.plan_entrenamiento.ejercicios.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
      } else {
        setShowExerciseModal(false);
        setShowPersonalizedMessage(false);
        await loadUserStats();
        setTimeout(() => {
          alert('🎉 ¡Felicitaciones! Has completado todo el entrenamiento. ¡Excelente trabajo!');
        }, 500);
      }
    } catch (error) {
      console.error('Error completing exercise:', error);
      alert('Error al guardar el progreso. Por favor, inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  // Función para saltar un ejercicio
  const handleExerciseSkip = async () => {
    if (sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');

      await fetch(`/api/home-training/sessions/${currentSession.id}/exercise/${currentExerciseIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ series_completed: 0, status: 'skipped' })
      });

      const total = generatedPlan.plan_entrenamiento.ejercicios.length;
      const newPercentage = (sessionProgress.completedExercises.length / total) * 100;

      setSessionProgress({
        ...sessionProgress,
        currentExercise: currentExerciseIndex + 1,
        percentage: newPercentage
      });

      if (currentExerciseIndex < generatedPlan.plan_entrenamiento.ejercicios.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
      } else {
        setShowExerciseModal(false);
        setShowPersonalizedMessage(false);
        alert('Entrenamiento finalizado. Algunos ejercicios fueron saltados.');
      }

      // refrescar progreso para reflejar estado 'skipped'
      await loadSessionProgress(currentSession.id);
      await loadUserStats();
    } catch (error) {
      console.error('Error skipping exercise:', error);
      } finally {
      setSending(false);
    }
  };

  // Función para cancelar un ejercicio
  const handleExerciseCancel = async () => {
    if (sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');

      await fetch(`/api/home-training/sessions/${currentSession.id}/exercise/${currentExerciseIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ series_completed: 0, status: 'cancelled' })
      });

      const total = generatedPlan.plan_entrenamiento.ejercicios.length;
      const newPercentage = (sessionProgress.completedExercises.length / total) * 100;

      setSessionProgress({
        ...sessionProgress,
        currentExercise: currentExerciseIndex + 1,
        percentage: newPercentage
      });

      if (currentExerciseIndex < generatedPlan.plan_entrenamiento.ejercicios.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
      } else {
        setShowExerciseModal(false);
        setShowPersonalizedMessage(false);
        alert('Entrenamiento finalizado. Algunos ejercicios fueron cancelados.');
      }

      // refrescar progreso para reflejar estado 'cancelled'
      await loadSessionProgress(currentSession.id);
      await loadUserStats();
    } catch (error) {
      console.error('Error cancelling exercise:', error);
    } finally {
      setSending(false);
    }
  };

  // Función para actualizar progreso durante el ejercicio
  const handleUpdateProgress = async (exerciseIndex, seriesCompleted, totalSeries) => {
    if (sendingProgress) return;
    setSendingProgress(true);
    try {
      const token = localStorage.getItem('token');
      const status = seriesCompleted === totalSeries ? 'completed' : 'in_progress';

      await fetch(`/api/home-training/sessions/${currentSession.id}/exercise/${exerciseIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ series_completed: seriesCompleted, status })
      });

      // Refrescar stats tras cada ejercicio actualizado
      await loadUserStats();

      if (seriesCompleted === totalSeries && !sessionProgress.completedExercises.includes(exerciseIndex)) {
        const newCompletedExercises = [...sessionProgress.completedExercises, exerciseIndex];
        const total = generatedPlan.plan_entrenamiento.ejercicios.length;
        const newPercentage = (newCompletedExercises.length / total) * 100;

        setSessionProgress({
          ...sessionProgress,
          completedExercises: newCompletedExercises,
          percentage: newPercentage
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    } finally {
      setSendingProgress(false);
    }
  };

  const equipmentTypes = [
    {
      id: 'minimo',
      title: 'Equipamiento Mínimo',
      icon: Home,
      equipment: ['Peso corporal', 'Toallas', 'Silla/Sofá', 'Pared'],
      exercises: ['Flexiones variadas', 'Sentadillas', 'Plancha'],
      borderColor: 'border-green-500'
    },
    {
      id: 'basico',
      title: 'Equipamiento Básico',
      icon: Target,
      equipment: ['Mancuernas ajustables', 'Bandas elásticas', 'Esterilla', 'Banco/Step'],
      exercises: ['Press de pecho', 'Remo con banda', 'Peso muerto'],
      borderColor: 'border-blue-500'
    },
    {
      id: 'avanzado',
      title: 'Equipamiento Avanzado',
      icon: Dumbbell,
      equipment: ['Barra dominadas', 'Kettlebells', 'TRX', 'Discos olímpicos'],
      exercises: ['Dominadas', 'Swing kettlebell', 'Sentadilla goblet'],
      borderColor: 'border-purple-500'
    }
  ];

  const trainingTypes = [
    { id: 'funcional', title: 'Funcional' },
    { id: 'hiit', title: 'HIIT' },
    { id: 'fuerza', title: 'Fuerza' }
  ];

  const trainingGuides = {
    funcional: {
      title: 'Guías para FUNCIONAL',
      points: [
        'Prioriza patrones: sentadilla, bisagra de cadera, zancada, empuje, tracción, rotación/antirrotación.',
        'Incluye varios planos de movimiento y trabajo unilateral/balance.',
        'Formato circuito/EMOM: 4–6 ejercicios, 30–45 s o 8–12 reps, 30–60 s descanso.',
        'Core integrado en la mayoría de ejercicios.'
      ]
    },
    hiit: {
      title: 'Guías para HIIT',
      points: [
        'Incluye calentamiento 5–10 min y vuelta a la calma 5–10 min.',
        'Intervalos de 15 s a 4 min a alta intensidad (~RPE 8–9).',
        'Relación trabajo/descanso: 1:1 a 1:2 según nivel.',
        'Volumen de alta intensidad total 10–20 min en sesión de 20–35 min.',
        'Varía el tipo de intervalos (Tabata, EMOM, bloques 30/30, 40/20…).'
      ]
    },
    fuerza: {
      title: 'Guías para FUERZA',
      points: [
        'Prioriza multiarticulares; luego accesorios.',
        'Rangos para fuerza: ≤6 reps, 2–6 series; descanso 2–5 min.',
        'Sin 1RM, usa RPE 7–9 o cargas que permitan 3–6 reps exigentes.',
        'Accesorios a 6–12 reps, 60–90 s descanso cuando aplique.'
      ]
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header con navegación */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-300 hover:text-white transition-colors duration-200 mr-6"
          >
            <ArrowLeft size={24} className="mr-2" />
            Volver al inicio
          </button>
        </div>

        {/* Título principal */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-yellow-400">
            Entrenamiento en Casa
          </h1>
          <p className="text-lg text-gray-300 max-w-4xl mx-auto">
            Modalidad multifuncional diseñada para maximizar resultados con el equipamiento
            que tengas disponible, adaptándose a tu espacio y nivel.
          </p>
        </div>

        {/* Tarjetas de equipamiento */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          {equipmentTypes.map((equipment) => (
            <div
              key={equipment.id}
              onClick={() => setSelectedEquipment(equipment.id)}
              className={`bg-gray-800/50 backdrop-blur-sm border-2 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:bg-gray-800/70 ${
                selectedEquipment === equipment.id
                  ? `${equipment.borderColor} bg-gray-800/80`
                  : 'border-gray-700'
              }`}
            >
              <div className="flex items-center mb-4">
                <equipment.icon size={24} className="text-white mr-3" />
                <h3 className="text-lg font-semibold text-white">{equipment.title}</h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-300 mb-2">Equipamiento:</p>
                <div className="flex flex-wrap gap-1">
                  {equipment.equipment.map((item, idx) => (
                    <span key={idx} className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-300 mb-2">Ejercicios ejemplo:</p>
                <div className="space-y-1">
                  {equipment.exercises.map((exercise, idx) => (
                    <div key={idx} className="flex items-center text-xs text-gray-400">
                      <span className="w-1 h-1 bg-green-400 rounded-full mr-2"></span>
                      {exercise}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fila de tipos de entrenamiento */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
          {trainingTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedTrainingType(type.id)}
              className={`py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                selectedTrainingType === type.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              {type.title}
            </button>
          ))}
        </div>

        {/* Tarjeta informativa */}
        {selectedTrainingType && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                {trainingGuides[selectedTrainingType].title}
              </h3>
              <ul className="space-y-3">
                {trainingGuides[selectedTrainingType].points.map((point, idx) => (
                  <li key={idx} className="flex items-start text-gray-300">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3 mt-2 flex-shrink-0"></span>
                    <span className="text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tarjeta de generar entrenamiento */}
        {selectedEquipment && selectedTrainingType && !isGenerating && !generatedPlan && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-gray-800/70 backdrop-blur-sm border border-gray-600 rounded-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-white mb-3">
                Generar Entrenamiento Personalizado
              </h3>
              <p className="text-gray-300 mb-6">
                Basado en tu equipamiento: <span className="text-yellow-400 font-semibold">
                  {equipmentTypes.find(eq => eq.id === selectedEquipment)?.title}
                </span> y tipo de entrenamiento: <span className="text-yellow-400 font-semibold">
                  {trainingTypes.find(type => type.id === selectedTrainingType)?.title}
                </span>
              </p>
              <button
                onClick={generateTraining}
                disabled={isGenerating}
                className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center mx-auto"
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-black/60 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Target size={20} className="mr-2" />
                )}
                Generar Mi Entrenamiento
              </button>
            </div>
          </div>
        )}

        {/* Modal de mensaje personalizado (Paso 3) */}
        {showPersonalizedMessage && !showProgress && !showExerciseModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl p-8 max-w-2xl mx-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target size={32} className="text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">
                  ¡Tu Entrenamiento Está Listo!
                </h3>
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4 mb-6">
                  <p className="text-yellow-100 leading-relaxed">{personalizedMessage}</p>
                </div>
                <button
                  onClick={proceedToGenerating}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
                >
                  Ver Mi Plan de Entrenamiento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de carga (Paso 4) */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl p-8 max-w-md mx-4 text-center">
              <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-white mb-2">
                La IA está comprobando tu perfil...
              </h3>
              <p className="text-gray-300">
                Preparando tu mejor entrenamiento para hoy según tu equipamiento y nivel.
              </p>
            </div>
          </div>
        )}

        {/* Mostrar progreso si hay un plan activo */}
        {showProgress && generatedPlan && !showExerciseModal && (
          <HomeTrainingProgress
            currentPlan={{
              ...generatedPlan.plan_entrenamiento,
              equipment_type: selectedEquipment,
              training_type: selectedTrainingType,
              user_profile: generatedPlan.plan_entrenamiento.perfil_usuario,
              estimated_duration: generatedPlan.plan_entrenamiento.duracion_estimada_min,
              exercises: generatedPlan.plan_entrenamiento.ejercicios
            }}
            sessionExercises={exercisesProgress}
            progress={sessionProgress}
            userStats={userStats}
            onContinueTraining={currentSession ? continueTraining : startTraining}
            onGenerateNewPlan={resetToInitialState}
          />
        )}

        {/* Modal de resultado */}
        {generatedPlan && !showProgress && (
          <HomeTrainingPlanModal
            plan={generatedPlan.plan_entrenamiento}
            planSource={generatedPlan.plan_source}
            personalizedMessage={generatedPlan.mensaje_personalizado}
            onStart={startTraining}
            onGenerateAnother={resetToInitialState}
            onClose={resetToInitialState}
          />
        )}

        {/* Modal de ejercicio individual */}
        {showExerciseModal && generatedPlan && generatedPlan.plan_entrenamiento.ejercicios && (
          <HomeTrainingExerciseModal
            exercise={generatedPlan.plan_entrenamiento.ejercicios[currentExerciseIndex]}
            exerciseIndex={currentExerciseIndex}
            totalExercises={generatedPlan.plan_entrenamiento.ejercicios.length}
            onComplete={handleExerciseComplete}
            onSkip={handleExerciseSkip}
            onCancel={handleExerciseCancel}
            onClose={() => setShowExerciseModal(false)}
            onUpdateProgress={handleUpdateProgress}
            overrideSeriesTotal={exercisesProgress?.[currentExerciseIndex]?.total_series}
            sessionId={currentSession?.id}
            onFeedbackSubmitted={() => currentSession?.id && loadSessionProgress(currentSession.id)}
          />
        )}
      </div>
    </div>
  );
};

export default HomeTrainingSection;
