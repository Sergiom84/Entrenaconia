import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ArrowLeft, Calendar, Target, Clock, Dumbbell, TrendingUp, CheckCircle, PlayCircle, Users, Zap, X, Trash2, RefreshCw } from 'lucide-react';
import RoutineCalendar from './RoutineCalendar.jsx';
import RoutineDayModal from './RoutineDayModal.jsx';
import RoutineExerciseModal from './RoutineExerciseModal.jsx';
import SessionProgress from './SessionProgress.jsx';

export default function RoutineScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, user } = useAuth();

  const [routinePlan, setRoutinePlan] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [completedExercises, setCompletedExercises] = useState([]);

  useEffect(() => {
    const planFromNavigation = location.state?.routinePlan;
    const planFromStorage = localStorage.getItem('currentRoutinePlan');

    if (planFromNavigation) {
      setRoutinePlan(planFromNavigation);
      localStorage.setItem('currentRoutinePlan', JSON.stringify(planFromNavigation));
    } else if (planFromStorage) {
      try { setRoutinePlan(JSON.parse(planFromStorage)); } catch (error) { console.error('Error parsing routine plan from storage:', error); setError('Error cargando el plan de rutina guardado'); }
    } else {
      setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Metodologías.');
    }
  }, [location.state]);

  const handleBackToMethodologies = () => { navigate('/methodologies'); };

  const handleCancelRoutine = () => {
    const confirmed = window.confirm('¿Estás seguro de que quieres cancelar esta rutina?\n\nSe eliminará tu plan actual y tendrás que generar uno nuevo desde Metodologías.');
    if (confirmed) {
      localStorage.removeItem('currentRoutinePlan');
      setRoutinePlan(null);
      setSelectedDay(null);
      setShowDayModal(false);
      setCurrentWeek(1);
      setError('Rutina cancelada. Puedes generar una nueva desde Metodologías.');
      console.log('✅ Rutina cancelada por el usuario');
    }
  };

  const handleDayClick = (dayData, weekNumber) => { setSelectedDay({ ...dayData, weekNumber }); setShowDayModal(true); };
  const handleCloseDayModal = () => { setShowDayModal(false); setSelectedDay(null); };

  const handleStartTraining = async (dayData) => {
    try {
      setIsLoading(true);
      const sessionData = {
        metodologia: routinePlan.selected_style,
        sesion: dayData,
        weekNumber: dayData.weekNumber || currentWeek,
        dayName: dayData.dia,
        exercises: dayData.ejercicios.map(ejercicio => ({
          nombre: ejercicio.nombre,
          series: ejercicio.series,
          repeticiones: ejercicio.repeticiones,
          descanso_seg: ejercicio.descanso_seg,
          intensidad: ejercicio.intensidad,
          tempo: ejercicio.tempo || '',
          notas: ejercicio.notas || ''
        }))
      };
      setCurrentSessionData(sessionData);
      setCurrentExerciseIndex(0);
      setTrainingInProgress(true);
      setShowExerciseModal(true);
    } catch (error) {
      console.error('Error iniciando entrenamiento:', error);
      setError('Error al iniciar el entrenamiento. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
      handleCloseDayModal();
    }
  };

  const handleExerciseComplete = (timeSpent) => {
    console.log(`Ejercicio ${currentExerciseIndex + 1} completado en ${timeSpent}s`);
    setCompletedExercises(prev => Array.from(new Set([...prev, currentExerciseIndex])));
    if (currentExerciseIndex < currentSessionData.exercises.length - 1) { setCurrentExerciseIndex(prev => prev + 1); } else { handleFinishTraining(); }
  };

  const handleExerciseSkip = () => {
    console.log(`Ejercicio ${currentExerciseIndex + 1} saltado`);
    if (currentExerciseIndex < currentSessionData.exercises.length - 1) { setCurrentExerciseIndex(prev => prev + 1); } else { handleFinishTraining(); }
  };

  const handleExerciseCancel = () => { console.log('Entrenamiento cancelado por el usuario'); setShowExerciseModal(false); setTrainingInProgress(false); setCurrentSessionData(null); setCurrentExerciseIndex(0); };

  const handleCloseExerciseModal = () => { setShowExerciseModal(false); setTrainingInProgress(false); setCurrentSessionData(null); setCurrentExerciseIndex(0); setCompletedExercises([]); };

  const handleFinishTraining = () => { console.log('🎉 Entrenamiento finalizado!'); setShowExerciseModal(false); setTrainingInProgress(false); setCurrentSessionData(null); setCurrentExerciseIndex(0); setCompletedExercises([]); alert('¡Felicidades! Has completado tu entrenamiento.'); };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">Cargando rutina...</p>
        </div>
      </div>
    );
  }

  if (error || !routinePlan) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <Button onClick={handleBackToMethodologies} variant="outline" className="mb-6 border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Metodologías
          </Button>
          <div className="text-center py-16">
            <Calendar className="w-20 h-20 mx-auto mb-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-white mb-4">No hay rutina disponible</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">{error || "Para ver tu rutina personalizada, primero necesitas generar una desde la sección de Metodologías usando el botón 'Activar IA'."}</p>
            <Button onClick={handleBackToMethodologies} className="bg-yellow-400 text-black hover:bg-yellow-300">
              <Zap className="w-4 h-4 mr-2" />
              Generar Nueva Rutina
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Soporta dos formatos:
  // - Automático: routinePlan = { plan, metadata }
  // - Manual: routinePlan = plan
  const plan = routinePlan?.plan ?? routinePlan;

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={handleBackToMethodologies} variant="outline" className="border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Metodologías
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Mi Rutina Personalizada</h1>
            <p className="text-gray-400">Plan generado con IA</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleBackToMethodologies} variant="outline" className="border-green-500/50 text-green-400 hover:border-green-500 hover:bg-green-500/10" title="Generar nueva rutina">
              <RefreshCw className="w-4 h-4 mr-2" />
              Nueva Rutina
            </Button>
            <Button onClick={handleCancelRoutine} variant="outline" className="border-red-500/50 text-red-400 hover:border-red-500 hover:bg-red-500/10" title="Cancelar rutina actual">
              <Trash2 className="w-4 h-4 mr-2" />
              Cancelar Rutina
            </Button>
          </div>
        </div>

        <Card className="bg-black/80 border-yellow-400/40 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center"><Target className="w-5 h-5 mr-2 text-yellow-400" />Resumen del Plan</CardTitle>
            <CardDescription className="text-gray-400">{plan.rationale}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <div className="flex items-center gap-2 mb-2"><Dumbbell className="w-4 h-4 text-yellow-400" /><span className="text-xs uppercase tracking-wide text-yellow-400">Metodología</span></div>
                <div className="text-lg font-semibold text-white">{plan.selected_style}</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/30">
                <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-blue-400" /><span className="text-xs uppercase tracking-wide text-blue-400">Duración</span></div>
                <div className="text-lg font-semibold text-white">{plan.duracion_total_semanas} semanas</div>
              </div>
              <div className="p-4 rounded-lg bg-green-400/10 border border-green-400/30">
                <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-green-400" /><span className="text-xs uppercase tracking-wide text-green-400">Frecuencia</span></div>
                <div className="text-lg font-semibold text-white">{plan.frecuencia_por_semana}x por semana</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-400/10 border border-purple-400/30">
                <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs uppercase tracking-wide text-purple-400">Progresión</span></div>
                <div className="text-lg font-semibold text-white">{plan.progresion?.metodo || 'Progresiva'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center mb-6">
          <div className="flex bg-black/50 rounded-lg border border-yellow-400/30 p-1">
            {Array.from({ length: plan.duracion_total_semanas }, (_, i) => i + 1).map(weekNum => (
              <Button key={weekNum} variant={currentWeek === weekNum ? 'default' : 'ghost'} size="sm" onClick={() => setCurrentWeek(weekNum)} className={currentWeek === weekNum ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'text-gray-400 hover:text-white hover:bg-yellow-400/10'}>
                Semana {weekNum}
              </Button>
            ))}
          </div>
        </div>

        {trainingInProgress && currentSessionData && (
          <SessionProgress total={currentSessionData.exercises.length} completed={completedExercises.length} />
        )}

        <RoutineCalendar plan={plan} currentWeek={currentWeek} onDayClick={handleDayClick} />

        {showDayModal && selectedDay && (
          <RoutineDayModal dayData={selectedDay} onClose={handleCloseDayModal} onStartTraining={handleStartTraining} />
        )}

        {showExerciseModal && currentSessionData && currentSessionData.exercises[currentExerciseIndex] && (
          <RoutineExerciseModal
            exercise={currentSessionData.exercises[currentExerciseIndex]}
            exerciseIndex={currentExerciseIndex}
            totalExercises={currentSessionData.exercises.length}
            onComplete={handleExerciseComplete}
            onSkip={handleExerciseSkip}
            onCancel={handleExerciseCancel}
            onClose={handleCloseExerciseModal}
            sessionData={currentSessionData}
          />
        )}
      </div>
    </div>
  );
}

