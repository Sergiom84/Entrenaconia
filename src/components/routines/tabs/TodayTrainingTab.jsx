import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  Play, 
  Clock, 
  Target, 
  Zap, 
  RefreshCw, 
  CheckCircle, 
  Calendar,
  Timer,
  Dumbbell,
  X,
  AlertTriangle
} from 'lucide-react';
import RoutineSessionModal from '../RoutineSessionModal';
import RoutineSessionSummaryCard from '../RoutineSessionSummaryCard';
import { startSession, updateExercise, finishSession, getTodaySessionStatus } from '../api';

export default function TodayTrainingTab({ 
  plan, 
  methodologyPlanId, 
  todayName, 
  planStartDate,
  ensureMethodologyPlan,
  onGenerateAnother 
}) {
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [routineSessionId, setRoutineSessionId] = useState(null);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [todaySessionStatus, setTodaySessionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Obtener la sesión del día actual (el día que se activó la IA)
  const todaySession = useMemo(() => {
    if (!plan?.semanas?.length) return null;
    
    // Buscar en todas las semanas la primera sesión disponible
    for (const semana of plan.semanas) {
      if (semana.sesiones?.length) {
        // Tomar la primera sesión y ajustarla para el día actual
        const firstSession = semana.sesiones[0];
        return {
          ...firstSession,
          dia: todayName, // Forzar que sea para hoy
          semana: semana.semana,
          weekNumber: semana.semana
        };
      }
    }
    return null;
  }, [plan, todayName]);

  // Cargar el estado de la sesión del día actual cuando el componente se monta
  useEffect(() => {
    const loadTodaySessionStatus = async () => {
      if (!todaySession || !methodologyPlanId) {
        setLoadingStatus(false);
        return;
      }

      try {
        setLoadingStatus(true);
        const mId = await ensureMethodologyPlan();
        
        const sessionStatus = await getTodaySessionStatus({
          methodology_plan_id: mId,
          week_number: todaySession.weekNumber || 1,
          day_name: todaySession.dia
        });

        setTodaySessionStatus(sessionStatus);
        
        // Si hay una sesión existente, configurar el ID para poder reanudar
        if (sessionStatus?.session?.id) {
          setRoutineSessionId(sessionStatus.session.id);
        }

        console.log('📊 Estado de sesión cargado:', sessionStatus);
        
      } catch (error) {
        // Es normal que no haya sesión si es la primera vez
        if (error.message !== 'No hay sesión para este día') {
          console.error('Error cargando estado de sesión:', error);
        }
        setTodaySessionStatus(null);
      } finally {
        setLoadingStatus(false);
      }
    };

    loadTodaySessionStatus();
  }, [todaySession, methodologyPlanId, ensureMethodologyPlan]);

  const handleStartTraining = async () => {
    if (!todaySession) {
      setError('No hay sesión de entrenamiento para hoy');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const mId = await ensureMethodologyPlan();
      console.log('▶️ Iniciando sesión para hoy:', { 
        methodology_plan_id: mId, 
        week_number: todaySession.weekNumber || 1, 
        day_name: todaySession.dia 
      });

      const resp = await startSession({ 
        methodology_plan_id: mId, 
        week_number: todaySession.weekNumber || 1, 
        day_name: todaySession.dia 
      });

      setRoutineSessionId(resp.session_id);
      setSelectedSession(todaySession);
      setShowSessionModal(true);
      
      // Recargar estado después de iniciar
      setTodaySessionStatus(null);
    } catch (e) {
      console.error('Error iniciando sesión:', e);
      setError(e.message || 'No se pudo iniciar el entrenamiento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeTraining = () => {
    if (!todaySessionStatus?.session?.id) {
      setError('No hay sesión para reanudar');
      return;
    }

    setRoutineSessionId(todaySessionStatus.session.id);
    setSelectedSession({
      ...todaySession,
      // Agregar información del progreso existente
      exerciseProgress: todaySessionStatus.exercises
    });
    setShowSessionModal(true);
  };

  const handleFinishExercise = async (exerciseIndex, seriesCompleted, timeSpent) => {
    if (!routineSessionId) return;
    try {
      await updateExercise({ 
        sessionId: routineSessionId, 
        exerciseOrder: exerciseIndex, 
        series_completed: seriesCompleted, 
        status: 'completed', 
        time_spent_seconds: timeSpent 
      });
    } catch (e) {
      console.error('No se pudo guardar el progreso del ejercicio', e);
    }
  };

  const handleSkipExercise = async (exerciseIndex) => {
    if (!routineSessionId) return;
    try {
      await updateExercise({ 
        sessionId: routineSessionId, 
        exerciseOrder: exerciseIndex, 
        series_completed: 0, 
        status: 'skipped', 
        time_spent_seconds: 0 
      });
    } catch (e) {
      console.error('No se pudo marcar como saltado', e);
    }
  };

  const handleEndSession = async () => {
    try {
      if (routineSessionId) {
        await finishSession(routineSessionId);
        setLastSessionId(routineSessionId);
        
        // Recargar el estado después de finalizar para mostrar como completado
        setTimeout(async () => {
          try {
            const mId = await ensureMethodologyPlan();
            const updatedStatus = await getTodaySessionStatus({
              methodology_plan_id: mId,
              week_number: todaySession.weekNumber || 1,
              day_name: todaySession.dia
            });
            setTodaySessionStatus(updatedStatus);
          } catch (error) {
            console.log('Error recargando estado tras finalización:', error);
          }
        }, 1000);
      }
    } catch (e) {
      console.error('No se pudo finalizar la sesión', e);
    } finally {
      setShowSessionModal(false);
      setRoutineSessionId(null);
      setSelectedSession(null);
    }
  };

  // Función para cancelar entrenamiento
  const handleCancelTraining = async () => {
    try {
      setShowCancelConfirm(false);
      
      // Si hay una sesión activa, finalizarla
      if (routineSessionId) {
        await finishSession(routineSessionId);
        setRoutineSessionId(null);
        setSelectedSession(null);
        setShowSessionModal(false);
      }
      
      // Limpiar estado local
      setTodaySessionStatus(null);
      setLastSessionId(null);
      
      // Llamar a la función para generar otro entrenamiento
      if (onGenerateAnother) {
        onGenerateAnother();
      }
      
    } catch (error) {
      console.error('Error cancelando entrenamiento:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Mostrar resumen de sesión completada
  if (lastSessionId) {
    return (
      <div className="space-y-6">
        <RoutineSessionSummaryCard
          sessionId={lastSessionId}
          plan={plan}
          planSource={{ label: 'IA' }}
          selectedSession={selectedSession}
          onGenerateAnother={onGenerateAnother}
          onContinueTraining={() => {
            setLastSessionId(null);
            setSelectedSession(null);
          }}
        />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <Dumbbell className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No hay plan de entrenamiento disponible</p>
        <Button 
          onClick={onGenerateAnother}
          className="mt-4 bg-yellow-400 text-black hover:bg-yellow-300"
        >
          Generar Nueva Rutina
        </Button>
      </div>
    );
  }

  if (!todaySession) {
    return (
      <div className="space-y-6">
        <Alert className="bg-orange-900/30 border-orange-400/40">
          <Calendar className="w-4 h-4 text-orange-400" />
          <AlertDescription className="text-orange-200">
            No hay sesión programada para hoy ({todayName}). Puedes revisar el calendario para ver otros días de entrenamiento.
          </AlertDescription>
        </Alert>
        
        <Card className="bg-gray-900/50 border-gray-700 p-6 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Día de Descanso</h3>
          <p className="text-gray-400 mb-4">
            Hoy no hay entrenamiento programado según tu rutina
          </p>
          <Button 
            onClick={onGenerateAnother}
            variant="outline"
            className="border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generar Nueva Rutina
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="bg-red-900/30 border-red-400/40">
          <AlertDescription className="text-red-200">{error}</AlertDescription>
        </Alert>
      )}

      {/* Header de la sesión de hoy */}
      <Card className={`bg-gradient-to-r p-6 ${
        todaySessionStatus?.summary?.isComplete 
          ? 'from-green-400/10 to-green-600/10 border-green-400/30'
          : todaySessionStatus?.session?.canResume
          ? 'from-blue-400/10 to-blue-600/10 border-blue-400/30'
          : 'from-yellow-400/10 to-yellow-600/10 border-yellow-400/30'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className={`text-2xl font-bold mb-2 ${
              todaySessionStatus?.summary?.isComplete 
                ? 'text-green-400'
                : todaySessionStatus?.session?.canResume
                ? 'text-blue-400'
                : 'text-yellow-400'
            }`}>
              Entrenamiento de Hoy
            </h2>
            <p className="text-gray-300 text-lg">
              {formatDate(planStartDate)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-300">
                {plan.selected_style}
              </Badge>
              
              {loadingStatus ? (
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Cargando...
                </Badge>
              ) : todaySessionStatus?.summary?.isComplete ? (
                <Badge variant="outline" className="border-green-500 text-green-400">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completado
                </Badge>
              ) : todaySessionStatus?.session?.canResume ? (
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  En progreso ({todaySessionStatus.summary.completed}/{todaySessionStatus.summary.total})
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                  Pendiente
                </Badge>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center text-sm text-gray-400 mb-1">
              <Timer className="w-4 h-4 mr-1" />
              Semana {todaySession.weekNumber || 1}
            </div>
            <div className="flex items-center text-sm text-gray-400">
              <Target className="w-4 h-4 mr-1" />
              {todaySession.ejercicios?.length || 0} ejercicios
            </div>
            
            {/* Mostrar progreso si existe */}
            {todaySessionStatus?.summary && !loadingStatus && (
              <div className="text-xs text-gray-500 mt-1">
                {todaySessionStatus.summary.completed} completados, {todaySessionStatus.summary.skipped} saltados
              </div>
            )}
          </div>
        </div>

        {/* Botones según el estado */}
        {loadingStatus ? (
          <Button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-3">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Cargando estado...
          </Button>
        ) : todaySessionStatus?.summary?.isComplete ? (
          <div className="space-y-2">
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center">
              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-semibold">¡Entrenamiento completado!</p>
              <p className="text-green-400/80 text-sm">
                {todaySessionStatus.summary.completed} ejercicios completados
              </p>
            </div>
          </div>
        ) : todaySessionStatus?.session?.canResume ? (
          <Button
            onClick={handleResumeTraining}
            className="w-full bg-blue-500 text-white hover:bg-blue-600 font-semibold py-3"
          >
            <Play className="w-4 h-4 mr-2" />
            Reanudar Entrenamiento ({todaySessionStatus.summary.completed}/{todaySessionStatus.summary.total})
          </Button>
        ) : (
          <Button
            onClick={handleStartTraining}
            disabled={isLoading}
            className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-semibold py-3"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Preparando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Comenzar Entrenamiento
              </>
            )}
          </Button>
        )}
      </Card>

      {/* Preview de ejercicios de hoy */}
      {todaySession.ejercicios && (
        <Card className="bg-gray-900/50 border-gray-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Dumbbell className="w-5 h-5 mr-2 text-yellow-400" />
              Ejercicios de Hoy
            </h3>
            
            <div className="space-y-3">
              {todaySession.ejercicios.map((ejercicio, index) => {
                // Buscar el estado de este ejercicio en el progreso existente
                const exerciseProgress = todaySessionStatus?.exercises?.find(ex => ex.exercise_order === index);
                const isCompleted = exerciseProgress?.status === 'completed';
                const isSkipped = exerciseProgress?.status === 'skipped';
                
                return (
                  <div 
                    key={index}
                    className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${
                      isCompleted ? 'bg-green-900/30 border-green-500/30' :
                      isSkipped ? 'bg-orange-900/30 border-orange-500/30' :
                      'bg-black/40 border-transparent'
                    }`}
                  >
                    <div className="flex items-center">
                      {isCompleted && <CheckCircle className="w-4 h-4 text-green-400 mr-3" />}
                      {isSkipped && <div className="w-4 h-4 bg-orange-400 rounded-full mr-3 flex items-center justify-center">
                        <span className="text-xs text-black font-bold">!</span>
                      </div>}
                      
                      <div>
                        <p className={`font-medium ${
                          isCompleted ? 'text-green-300' : 
                          isSkipped ? 'text-orange-300' :
                          'text-white'
                        }`}>
                          {ejercicio.nombre}
                        </p>
                        <p className="text-sm text-gray-400">
                          {exerciseProgress?.series_completed || 0}/{ejercicio.series} series × {ejercicio.repeticiones} reps
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-gray-400">
                      {isCompleted && (
                        <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                          Completado
                        </Badge>
                      )}
                      {isSkipped && (
                        <Badge variant="outline" className="border-orange-500 text-orange-400 text-xs">
                          Saltado
                        </Badge>
                      )}
                      
                      {ejercicio.intensidad && (
                        <span className="flex items-center">
                          <Zap className="w-3 h-3 mr-1" />
                          {ejercicio.intensidad}
                        </span>
                      )}
                      {ejercicio.descanso_seg && (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {Math.round(ejercicio.descanso_seg / 60)}min
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Botón Cancelar Entrenamiento */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar Entrenamiento
            </button>
          </div>
        </Card>
      )}

      {/* Modal de confirmación para cancelar entrenamiento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-semibold text-white">
                ¿Cancelar Entrenamiento?
              </h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              Esta acción cancelará tu entrenamiento actual y perderás todo el progreso. 
              ¿Estás seguro de que quieres continuar?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                No, continuar
              </button>
              <button
                onClick={handleCancelTraining}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de sesión activa */}
      {showSessionModal && selectedSession && (
        <RoutineSessionModal
          session={selectedSession}
          sessionId={routineSessionId}
          onClose={() => setShowSessionModal(false)}
          onFinishExercise={handleFinishExercise}
          onSkipExercise={handleSkipExercise}
          onEndSession={handleEndSession}
        />
      )}
    </div>
  );
}