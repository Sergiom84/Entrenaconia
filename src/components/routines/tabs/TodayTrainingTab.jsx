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
  AlertTriangle,
  Heart,
  Frown,
  AlertOctagon
} from 'lucide-react';
import RoutineSessionModal from '../RoutineSessionModal';
import RoutineSessionSummaryCard from '../RoutineSessionSummaryCard';
import { startSession, updateExercise, finishSession, getTodaySessionStatus, cancelRoutine, getPendingExercises, getSessionProgress } from '../api';

export default function TodayTrainingTab({
  plan,
  planId,
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
  const [pendingExercises, setPendingExercises] = useState(null);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Función para obtener icono y color del sentimiento
  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'like':
        return { icon: Heart, color: 'text-pink-400', bg: 'bg-pink-900/30', border: 'border-pink-500/30' };
      case 'dislike':
        return { icon: Frown, color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-500/30' };
      case 'hard':
        return { icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-500/30' };
      default:
        return null;
    }
  };

  // Obtener la sesión del día actual (buscar sesión específica para hoy)
  const todaySession = useMemo(() => {
    if (!plan?.semanas?.length) return null;

    // Buscar en todas las semanas la sesión correspondiente al día actual
    for (const semana of plan.semanas) {
      if (semana.sesiones?.length) {
        // Buscar la sesión que coincida con el día actual
        const todaySessionFound = semana.sesiones.find(session => {
          const sessionDay = session.dia?.toLowerCase();
          const currentDay = todayName.toLowerCase();
          return sessionDay === currentDay ||
                 sessionDay === currentDay.replace('é', 'e') ||
                 (sessionDay === 'mie' && currentDay === 'miércoles') ||
                 (sessionDay === 'sab' && currentDay === 'sábado') ||
                 (sessionDay === 'dom' && currentDay === 'domingo');
        });

        if (todaySessionFound) {
          return {
            ...todaySessionFound,
            semana: semana.semana,
            weekNumber: semana.semana
          };
        }
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

  // Función para reanudar sesión de ejercicios pendientes
  const handleResumePendingSession = async () => {
    console.log('🎯 INICIANDO handleResumePendingSession');
    console.log('📊 pendingExercises:', pendingExercises);

    try {
      console.log('📡 Obteniendo datos de sesión para sessionId:', pendingExercises.sessionId);
      const sessionData = await getSessionProgress(pendingExercises.sessionId);
      console.log('📋 Datos de sesión obtenidos:', sessionData);

      const sessionId = pendingExercises.sessionId;
      console.log('🔧 Configurando routineSessionId:', sessionId);
      setRoutineSessionId(sessionId);

      const sessionConfig = {
        dia: pendingExercises.pendingDay,
        weekNumber: pendingExercises.weekNumber,
        ejercicios: pendingExercises.exercises.map(ex => ({
          nombre: ex.exercise_name,
          series: ex.series_total,
          repeticiones: ex.repeticiones,
          descanso_seg: ex.descanso_seg,
          intensidad: ex.intensidad,
          tempo: ex.tempo,
          notas: ex.notas
        })),
        exerciseProgress: sessionData.exercises || []
      };

      console.log('⚙️ Configuración de sesión preparada:', sessionConfig);
      setSelectedSession(sessionConfig);

      console.log('🔒 Cerrando modal de pendientes');
      setShowPendingModal(false);

      console.log('🚀 Abriendo modal de sesión de ejercicios');
      setShowSessionModal(true);

      console.log('✅ handleResumePendingSession completado exitosamente');

    } catch (e) {
      console.error('❌ Error reanudando ejercicios pendientes:', e);
      setError('No se pudo reanudar la sesión de ejercicios pendientes');
    }
  };

  // Cargar ejercicios pendientes al montar el componente
  useEffect(() => {
    const loadPendingExercises = async () => {
      if (!methodologyPlanId) return;

      try {
        console.log('🔍 Cargando ejercicios pendientes para methodology_plan_id:', methodologyPlanId);
        const pendingData = await getPendingExercises({ methodology_plan_id: methodologyPlanId });
        console.log('📋 Datos de ejercicios pendientes:', pendingData);

        if (pendingData?.hasPendingExercises) {
          console.log('✅ Hay ejercicios pendientes, mostrando modal');
          console.log('📊 Datos completos pendingData:', JSON.stringify(pendingData, null, 2));
          setPendingExercises(pendingData);
          // Mostrar el modal siempre que haya ejercicios pendientes
          setShowPendingModal(true);
          console.log('🎯 Estado del modal actualizado a: true');
        } else {
          console.log('ℹ️ No hay ejercicios pendientes');
        }
      } catch (e) {
        console.error('❌ Error cargando ejercicios pendientes:', e);
      }
    };

    loadPendingExercises();
  }, [methodologyPlanId, todaySession]);

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
      console.log('🚫 Iniciando cancelación de rutina...');

      // 1. Si hay una sesión activa, finalizarla primero
      if (routineSessionId) {
        console.log('⏹️ Finalizando sesión activa:', routineSessionId);
        await finishSession(routineSessionId);
        setRoutineSessionId(null);
        setSelectedSession(null);
        setShowSessionModal(false);
      }

      // 2. Cancelar la rutina en la base de datos
      const methodologyId = await ensureMethodologyPlan();
      console.log('🗂️ Cancelando rutina con:', { methodology_plan_id: methodologyId, routine_plan_id: planId });

      await cancelRoutine({
        methodology_plan_id: methodologyId,
        routine_plan_id: planId
      });

      console.log('✅ Rutina cancelada exitosamente en la base de datos');

      // 3. Limpiar estado local
      setTodaySessionStatus(null);
      setLastSessionId(null);

      // 4. Redirigir a metodologías para generar nueva rutina
      if (onGenerateAnother) {
        onGenerateAnother();
      }

    } catch (error) {
      console.error('❌ Error cancelando entrenamiento:', error);
      alert('Error al cancelar el entrenamiento: ' + (error.message || error));
      setShowCancelConfirm(false);
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
  console.log('🔍 EARLY RETURN CHECK 1 - lastSessionId:', lastSessionId, 'showPendingModal:', showPendingModal);
  if (lastSessionId) {
    console.log('🚪 EARLY RETURN 1: Mostrando resumen de sesión completada');
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

        {/* Modal de ejercicios pendientes - debe mostrarse incluso con resumen de sesión */}
        {console.log('🔍 RENDER CHECK (Session Summary) - showPendingModal:', showPendingModal, 'pendingExercises:', !!pendingExercises)}
        {showPendingModal && pendingExercises && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900/95 border border-yellow-400/30 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">
                    Ejercicios Pendientes
                  </h3>
                  <p className="text-gray-300">
                    Tienes <span className="text-yellow-400 font-semibold">{pendingExercises?.totalPending} ejercicios pendientes</span> del {pendingExercises?.pendingDay}.
                  </p>
                  <p className="text-gray-400 text-sm">
                    ¿Le damos caña?
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowPendingModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800/50 transition-colors"
                  >
                    Más tarde
                  </button>
                  <button
                    onClick={handleResumePendingSession}
                    className="flex-1 px-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
                  >
                    ¡Vamos!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de sesión activa - disponible también en esta rama */}
        {showSessionModal && selectedSession && (
          <RoutineSessionModal
            session={selectedSession}
            sessionId={routineSessionId}
            onClose={() => { console.log('🚪 Cerrando RoutineSessionModal'); setShowSessionModal(false); }}
            onFinishExercise={handleFinishExercise}
            onSkipExercise={handleSkipExercise}
            onEndSession={handleEndSession}
          />
        )}
      </div>
    );
  }

  console.log('🔍 EARLY RETURN CHECK 2 - plan:', !!plan, 'showPendingModal:', showPendingModal);
  if (!plan) {
    console.log('🚪 EARLY RETURN 2: No hay plan disponible');
    return (
      <div className="space-y-6">
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

        {/* Modal de ejercicios pendientes - debe mostrarse incluso sin plan */}
        {console.log('🔍 RENDER CHECK (No Plan) - showPendingModal:', showPendingModal, 'pendingExercises:', !!pendingExercises)}
        {showPendingModal && pendingExercises && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900/95 border border-yellow-400/30 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">
                    Ejercicios Pendientes
                  </h3>
                  <p className="text-gray-300">
                    Tienes <span className="text-yellow-400 font-semibold">{pendingExercises?.totalPending} ejercicios pendientes</span> del {pendingExercises?.pendingDay}.
                  </p>
                  <p className="text-gray-400 text-sm">
                    ¿Le damos caña?
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowPendingModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800/50 transition-colors"
                  >
                    Más tarde
                  </button>
                  <button
                    onClick={handleResumePendingSession}
                    className="flex-1 px-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
                  >
                    ¡Vamos!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de sesión activa - disponible también sin plan */}
        {showSessionModal && selectedSession && (
          <RoutineSessionModal
            session={selectedSession}
            sessionId={routineSessionId}
            onClose={() => { console.log('🚪 Cerrando RoutineSessionModal'); setShowSessionModal(false); }}
            onFinishExercise={handleFinishExercise}
            onSkipExercise={handleSkipExercise}
            onEndSession={handleEndSession}
          />
        )}

      </div>
    );
  }

  console.log('🔍 EARLY RETURN CHECK 3 - todaySession:', !!todaySession, 'showPendingModal:', showPendingModal);
  if (!todaySession) {
    console.log('🚪 EARLY RETURN 3: No hay sesión de hoy');
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

          {/* Botón para cancelar rutina incluso en día de descanso */}
          <Button
            onClick={() => setShowCancelConfirm(true)}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar Rutina
          </Button>
        </Card>

        {/* Modal de ejercicios pendientes - debe mostrarse incluso sin sesión de hoy */}
        {console.log('🔍 RENDER CHECK (No Today Session) - showPendingModal:', showPendingModal, 'pendingExercises:', !!pendingExercises)}
        {showPendingModal && pendingExercises && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900/95 border border-yellow-400/30 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">
                    Ejercicios Pendientes
                  </h3>
                  <p className="text-gray-300">
                    Tienes <span className="text-yellow-400 font-semibold">{pendingExercises?.totalPending} ejercicios pendientes</span> del {pendingExercises?.pendingDay}.
                  </p>
                  <p className="text-gray-400 text-sm">
                    ¿Le damos caña?
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowPendingModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800/50 transition-colors"
                  >


                    Más tarde
                  </button>
                  <button
                    onClick={handleResumePendingSession}
                    className="flex-1 px-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
                  >
                    ¡Vamos!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de sesión activa - disponible también sin sesión de hoy */}
        {showSessionModal && selectedSession && (
          <RoutineSessionModal
            session={selectedSession}
            sessionId={routineSessionId}
            onClose={() => { console.log('🚪 Cerrando RoutineSessionModal'); setShowSessionModal(false); }}
            onFinishExercise={handleFinishExercise}
            onSkipExercise={handleSkipExercise}
            onEndSession={handleEndSession}
          />
        )}

        {/* Modal de confirmación para cancelar entrenamiento (visible también en día de descanso) */}
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
                Esta acción cancelará tu rutina actual pero conservará el histórico de ejercicios.
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

      </div>
    );
  }

  console.log('✅ LLEGANDO AL RENDER PRINCIPAL - showPendingModal:', showPendingModal, 'pendingExercises:', !!pendingExercises);
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

                // Obtener datos del sentimiento
                const sentiment = exerciseProgress?.sentiment;
                const sentimentData = getSentimentIcon(sentiment);
                const hasComment = exerciseProgress?.comment && exerciseProgress.comment.trim();

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

                        {/* Mostrar sentimiento y comentario */}
                        {sentimentData && (
                          <div className="flex items-center mt-2">
                            <div className={`flex items-center px-2 py-1 rounded-md ${sentimentData.bg} ${sentimentData.border} border`}>
                              <sentimentData.icon className={`w-3 h-3 mr-1 ${sentimentData.color}`} />
                              <span className={`text-xs ${sentimentData.color} capitalize`}>
                                {sentiment === 'like' ? 'Me gusta' :
                                 sentiment === 'hard' ? 'Es difícil' :
                                 sentiment === 'dislike' ? 'No me gusta' : sentiment}
                              </span>
                            </div>
                            {hasComment && (
                              <span className="text-xs text-gray-400 ml-2 italic">
                                "{exerciseProgress.comment}"
                              </span>
                            )}
                          </div>
                        )}
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

      {/* Modal de ejercicios pendientes */}
      {console.log('🔍 RENDER CHECK - showPendingModal:', showPendingModal, 'pendingExercises:', !!pendingExercises)}
      {showPendingModal && pendingExercises && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/95 border border-yellow-400/30 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-yellow-400" />
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">
                  Ejercicios Pendientes
                </h3>
                <p className="text-gray-300">
                  Tienes <span className="text-yellow-400 font-semibold">{pendingExercises?.totalPending} ejercicios pendientes</span> del {pendingExercises?.pendingDay}.
                </p>
                <p className="text-gray-400 text-sm">
                  ¿Le damos caña?
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPendingModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800/50 transition-colors"
                >
                  Más tarde
                </button>
                <button
                  onClick={handleResumePendingSession}
                  className="flex-1 px-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
                >
                  ¡Vamos!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de sesión activa */}
      {console.log('🔍 RENDER CHECK RoutineSessionModal - showSessionModal:', showSessionModal, 'selectedSession:', !!selectedSession, 'routineSessionId:', routineSessionId)}
      {showSessionModal && selectedSession && (
        <RoutineSessionModal
          session={selectedSession}
          sessionId={routineSessionId}
          onClose={() => {
            console.log('🚪 Cerrando RoutineSessionModal');
            setShowSessionModal(false);
          }}
          onFinishExercise={handleFinishExercise}
          onSkipExercise={handleSkipExercise}
          onEndSession={handleEndSession}
        />
      )}
    </div>
  );
}