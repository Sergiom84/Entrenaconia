import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoutinePlanModal from './RoutinePlanModal';
import RoutineSessionModal from './RoutineSessionModal';
import CalendarView from './CalendarView';
import { bootstrapPlan, startSession, updateExercise, finishSession } from './api';

// Pantalla de Rutinas: recibe el plan vía navigation state desde Metodologías
// y muestra el modal de resumen, luego el modal de sesión del día actual.
export default function RoutineScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  // State recibido desde MethodologiesScreen.navigate('/routines', { state })
  const incomingState = location.state || {};
  const incomingPlan = incomingState?.routinePlan || null;
  const planSource = incomingState?.planSource || { label: 'OpenAI' };
  const planId = incomingState?.planId || null; // routinePlanId preferido

  const [showPlanModal, setShowPlanModal] = useState(!!incomingPlan);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [methodologyPlanId, setMethodologyPlanId] = useState(incomingState?.methodology_plan_id || null);
  const [routineSessionId, setRoutineSessionId] = useState(null);
  const [planStartDate] = useState(new Date().toISOString());

  // Elegimos la sesión inicial en base al día actual (según tu requerimiento)
  const todayName = useMemo(() => {
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return dias[new Date().getDay()];
  }, []);

  const firstSessionForToday = useMemo(() => {
    const weeks = Array.isArray(incomingPlan?.semanas) ? incomingPlan.semanas : [];
    if (weeks.length === 0) return null;
    // Usamos la semana 1 como referencia del patrón y forzamos que empiece HOY
    const week1 = weeks[0];
    const sesiones = Array.isArray(week1?.sesiones) ? week1.sesiones : [];
    
    // Si hay sesiones disponibles, tomamos la primera y la forzamos para hoy
    if (sesiones.length > 0) {
      return {
        ...sesiones[0],
        dia: todayName // Forzar que la sesión sea para el día actual
      };
    }
    
    return null;
  }, [incomingPlan, todayName]);

  useEffect(() => {
    // Si no hay plan entrante, podríamos fetch por planId o redirigir a metodologías
    if (!incomingPlan) {
      console.warn('No incoming plan. Redirecting to Methodologies.');
      navigate('/methodologies', { replace: true });
    }
  }, [incomingPlan, navigate]);

  const handleStart = async () => {
    try {
      setShowPlanModal(false);
      // Conseguir un methodology_plan_id válido de forma segura
      const mId = await ensureMethodologyPlan();

      const ses = firstSessionForToday;
      if (!ses) throw new Error('No hay sesión para hoy');

      console.log('▶️ startSession payload', { methodology_plan_id: mId, week_number: 1, day_name: ses.dia });
      const resp = await startSession({ methodology_plan_id: mId, week_number: 1, day_name: ses.dia });
      setRoutineSessionId(resp.session_id);
      setSelectedSession(ses);
      setShowSessionModal(true);
    } catch (e) {
      console.error(e);
      alert(e.message || 'No se pudo iniciar la sesión');
      setShowPlanModal(true);
    }
  };

  const handleGenerateAnother = () => {
    // Descartar plan y volver a metodologías
    navigate('/methodologies', { replace: true });
  };

  const handleFinishExercise = async (exerciseIndex, seriesCompleted, timeSpent) => {
    if (!routineSessionId) return;
    try {
      await updateExercise({ sessionId: routineSessionId, exerciseOrder: exerciseIndex, series_completed: seriesCompleted, status: 'completed', time_spent_seconds: timeSpent });
    } catch (e) {
      console.error('No se pudo guardar el progreso del ejercicio', e);
    }
  };

  const handleEndSession = async () => {
    try {
      if (routineSessionId) await finishSession(routineSessionId);
    } catch (e) {
      console.error('No se pudo finalizar la sesión', e);
    } finally {
      setShowSessionModal(false);
      setRoutineSessionId(null);
    }
  };

  const handleSkipExercise = async (exerciseIndex) => {
    if (!routineSessionId) return;
    try {
      await updateExercise({ sessionId: routineSessionId, exerciseOrder: exerciseIndex, series_completed: 0, status: 'skipped', time_spent_seconds: 0 });
    } catch (e) {
      console.error('No se pudo marcar como saltado', e);
    }
  };

  const ensureMethodologyPlan = async () => {
    if (methodologyPlanId) return methodologyPlanId;
    if (incomingState?.methodology_plan_id) return incomingState.methodology_plan_id;
    if (planId) {
      const mId = await bootstrapPlan(planId);
      setMethodologyPlanId(mId);
      return mId;
    }
    throw new Error('No se pudo determinar el plan. Vuelve a Metodologías y genera uno nuevo.');
  };

  const startForSession = async (ses, weekNumber = 1) => {
    const mId = await ensureMethodologyPlan();
    const resp = await startSession({ methodology_plan_id: mId, week_number: weekNumber, day_name: ses.dia });
    setRoutineSessionId(resp.session_id);
    setSelectedSession(ses);
    setShowSessionModal(true);
  };

  const handleSelectDayFromCalendar = async (ses) => {
    try {
      await startForSession(ses, ses.weekNumber || 1);
    } catch (e) {
      console.error(e);
      alert(e.message || 'No se pudo iniciar la sesión para ese día');
    }
  };

  return (
    <div className="p-6 bg-black min-h-screen text-white pt-20">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Rutinas</h1>
      <p className="text-gray-400 mb-6">Gestiona tus sesiones generadas por IA.</p>

      {Array.isArray(incomingPlan?.semanas) && incomingPlan.semanas.length > 2 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Calendario</h2>
          <CalendarView plan={incomingPlan} startDateISO={planStartDate} onSelectDay={handleSelectDayFromCalendar} />
        </div>
      )}

      {showPlanModal && incomingPlan && (
        <RoutinePlanModal
          plan={incomingPlan}
          planSource={planSource}
          onStart={handleStart}
          onGenerateAnother={handleGenerateAnother}
          onClose={handleGenerateAnother}
        />
      )}

      {showSessionModal && selectedSession && (
        <RoutineSessionModal
          session={selectedSession}
          onClose={() => setShowSessionModal(false)}
          onFinishExercise={handleFinishExercise}
          onSkipExercise={handleSkipExercise}
          onEndSession={handleEndSession}
        />
      )}
    </div>
  );
}

