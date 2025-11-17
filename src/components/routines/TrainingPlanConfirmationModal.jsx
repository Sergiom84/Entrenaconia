/**
 * 🎯 Modal Unificado de Confirmación de Plan de Entrenamiento
 *
 * FUNCIONALIDAD:
 * - Modal único para confirmar cualquier plan generado (automático o manual)
 * - Muestra resumen del plan con ejercicios y justificación
 * - Botón "Comenzar Entrenamiento" que abre RoutineSessionModal DIRECTAMENTE
 * - NO navega a /routines - flujo directo
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import ExerciseFeedbackModal from './ExerciseFeedbackModal.jsx';
import DayDetailModal from './modals/DayDetailModal.jsx';
import {
  X,
  CheckCircle,
  Target,
  Clock,
  TrendingUp,
  Zap,
  Dumbbell,
  Calendar,
  Brain
} from 'lucide-react';
import { useTrace } from '@/contexts/TraceContext.jsx';



// 🆕 Mapeo dinámico: el backend ahora proporciona días reales, no necesitamos mapeo estático


export default function TrainingPlanConfirmationModal({
  isOpen,
  onClose,
  onStartTraining, // Función para iniciar directamente
  onGenerateAnother, // NUEVA: Función para generar otro plan
  plan,
  planId, // 🆕 ID del plan draft para eliminar si se cancela
  methodology,
  aiJustification = null,
  planSource = { label: 'IA Avanzada' }, // NUEVO: Fuente del plan
  isLoading = false,
  isConfirming = false, // NUEVO: Estado de confirmación
  error = null // NUEVO: Error del modal
}) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { track } = useTrace();

  // Referencias para evitar loops infinitos en tracking
  const prevOpenRef = React.useRef(isOpen);
  const prevFeedbackModalRef = React.useRef(showFeedbackModal);

  // Tracking del modal principal - CORREGIDO
  React.useEffect(() => {
    if (prevOpenRef.current !== isOpen) {
      track(isOpen ? 'MODAL_OPEN' : 'MODAL_CLOSE', { name: 'TrainingPlanConfirmationModal' }, { component: 'TrainingPlanConfirmationModal' });
      prevOpenRef.current = isOpen;
    }
  }, [isOpen, track]);

  // Tracking del modal de feedback - CORREGIDO
  React.useEffect(() => {
    if (prevFeedbackModalRef.current !== showFeedbackModal) {
      track(showFeedbackModal ? 'MODAL_OPEN' : 'MODAL_CLOSE', { name: 'ExerciseFeedbackModal' }, { component: 'TrainingPlanConfirmationModal' });
      prevFeedbackModalRef.current = showFeedbackModal;
    }
  }, [showFeedbackModal, track]);

  const [isGeneratingAnother, setIsGeneratingAnother] = useState(false);

  // 🗑️ Función para eliminar draft cuando el usuario cancela
  const deleteDraft = async (draftId) => {
    if (!draftId) return;

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';
      const token = localStorage.getItem('token');

      console.log(`🗑️ Eliminando draft ${draftId}...`);

      const response = await fetch(`${API_URL}/api/routine-generation/draft/${draftId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Draft eliminado:', data);
        track('DRAFT_DELETED', { planId: draftId, reason: 'user_cancelled' }, { component: 'TrainingPlanConfirmationModal' });
      } else {
        console.error('❌ Error eliminando draft:', response.status);
      }
    } catch (error) {
      console.error('❌ Error eliminando draft:', error);
      track('ERROR', { where: 'deleteDraft', message: error?.message }, { component: 'TrainingPlanConfirmationModal' });
    }
  };

  // 🚪 Handler para cerrar modal (elimina draft si no fue confirmado)
  const handleClose = async () => {
    // Si hay un planId y el usuario cierra sin confirmar, eliminar el draft
    if (planId && !isConfirming) {
      setIsDeleting(true);
      await deleteDraft(planId);
      setIsDeleting(false);
    }
    track('MODAL_CLOSE', { planId, wasConfirmed: isConfirming }, { component: 'TrainingPlanConfirmationModal' });
    onClose();
  };


  // 👁️ Handler para abrir modal de detalle de día
  const handleDayClick = (session, sessionDate) => {
    const muscleGroups = getMuscleGroupsPreview(session);

    let ejercicios = [];
    if (Array.isArray(session.ejercicios)) {
      ejercicios = session.ejercicios;
    } else if (Array.isArray(session.bloques)) {
      ejercicios = session.bloques.flatMap(bloque =>
        Array.isArray(bloque.ejercicios) ? bloque.ejercicios : []
      );
    }

    setSelectedDay({
      date: sessionDate,
      muscleGroups,
      ejercicios
    });
    setShowDayDetailModal(true);
    track('DAY_DETAIL_OPEN', { date: sessionDate, exerciseCount: ejercicios.length }, { component: 'TrainingPlanConfirmationModal' });
  };

  //  Función para extraer grupos musculares de una sesión
  const getMuscleGroupsPreview = (session) => {
    // HipertrofiaV2 MindFeed: grupos_musculares en JSON
    if (session.grupos_musculares) {
      const groups = Array.isArray(session.grupos_musculares)
        ? session.grupos_musculares
        : JSON.parse(session.grupos_musculares);
      return groups.slice(0, 2); // Máximo 2 grupos
    }

    // Otros planes: inferir de ejercicios
    let ejercicios = [];
    if (Array.isArray(session.ejercicios)) {
      ejercicios = session.ejercicios;
    } else if (Array.isArray(session.bloques)) {
      ejercicios = session.bloques.flatMap(bloque =>
        Array.isArray(bloque.ejercicios) ? bloque.ejercicios : []
      );
    }

    const groups = new Set();
    ejercicios.forEach(ex => {
      if (ex.grupo_muscular) groups.add(ex.grupo_muscular);
      if (ex.categoria) groups.add(ex.categoria);
    });

    return Array.from(groups).slice(0, 2); // Máximo 2 grupos
  };


  if (!isOpen || !plan) return null;

  // Manejar click en "Generar otro"
  const handleGenerateAnotherClick = () => {
    track('BUTTON_CLICK', { id: 'generate_another' }, { component: 'TrainingPlanConfirmationModal' });
    if (onGenerateAnother) {
      setShowFeedbackModal(true);
    }
  };

  // Manejar envío de feedback
  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      setIsGeneratingAnother(true);
      track('FEEDBACK_SUBMIT', { source: 'generate_another', reasons: feedbackData?.reasons?.length || 0 }, { component: 'TrainingPlanConfirmationModal' });

      // 🗑️ Eliminar draft actual antes de generar nuevo
      if (planId) {
        console.log('🗑️ Eliminando draft anterior antes de generar nuevo...');
        await deleteDraft(planId);
      }

      // Llamar la función de generar otro con el feedback
      if (onGenerateAnother) {
        await onGenerateAnother(feedbackData);
      }

      // Cerrar modal de feedback
      setShowFeedbackModal(false);
    } catch (error) {
      track('ERROR', { where: 'handleFeedbackSubmit', message: error?.message }, { component: 'TrainingPlanConfirmationModal' });
    } finally {
      setIsGeneratingAnother(false);
    }
  };

  // Extraer información del plan
  const totalWeeks = plan.semanas?.length || 0;
  const totalSessions = plan.semanas?.reduce((acc, week) => acc + (week.sesiones?.length || 0), 0) || 0;

  // 🔢 CONTEO TOTAL DE EJERCICIOS (no únicos)
  // Soportar dos estructuras: sesion.ejercicios[] o sesion.bloques[].ejercicios[]
  let totalExercises = 0;
  const uniqueExercises = new Set();

  plan.semanas?.forEach(week => {
    week.sesiones?.forEach(session => {
      // Estructura directa: session.ejercicios
      if (Array.isArray(session.ejercicios)) {
        totalExercises += session.ejercicios.length;
        session.ejercicios.forEach(exercise => {
          uniqueExercises.add(exercise.nombre || exercise.name);
        });
      }
      // Estructura con bloques: session.bloques[].ejercicios
      if (Array.isArray(session.bloques)) {
        session.bloques.forEach(bloque => {
          if (Array.isArray(bloque.ejercicios)) {
            totalExercises += bloque.ejercicios.length;
            bloque.ejercicios.forEach(exercise => {
              uniqueExercises.add(exercise.nombre || exercise.name);
            });
          }
        });
      }
    });
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl w-full max-h-[95vh] overflow-y-auto bg-gray-900 border-yellow-500/20 z-50">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <DialogTitle className="text-xl text-white">
                  ¡Plan de Entrenamiento Listo!
                </DialogTitle>
                <DialogDescription className="text-gray-300">
                  {methodology} • {planSource?.label || 'IA Avanzada'}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { track('BUTTON_CLICK', { id: 'close_icon' }, { component: 'TrainingPlanConfirmationModal' }); handleClose(); }}
              className="text-gray-400 hover:text-white"
              disabled={isDeleting}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Justificación de IA */}
          {aiJustification && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-blue-400" />
                <h4 className="font-semibold text-blue-400">Análisis IA</h4>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                {aiJustification}
              </p>
            </div>
          )}

          {/* Estadísticas del plan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <Calendar className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-white">{totalWeeks}</div>
              <div className="text-xs text-gray-400">Semanas</div>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <Zap className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-white">{totalSessions}</div>
              <div className="text-xs text-gray-400">Sesiones</div>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <Dumbbell className="w-5 h-5 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-white">{totalExercises}</div>
              <div className="text-xs text-gray-400">Ejercicios</div>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <Target className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-white">{methodology}</div>
              <div className="text-xs text-gray-400">Metodología</div>
            </div>
          </div>

          {/* Resumen semanal mejorado */}
          <div>
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              Resumen del Plan
            </h4>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {plan.semanas?.length === 0 && (
                <p className="text-gray-400 text-sm">No hay semanas para mostrar.</p>
              )}
              {plan.semanas?.map((semana, weekIndex) => (
                <div key={`week-${weekIndex}`} className="bg-gray-800/60 border border-gray-700 rounded-lg">
                  <div className="px-3 sm:px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-gray-200 font-medium text-sm sm:text-base">
                      Semana {semana.numero || semana.semana}
                    </span>
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 text-xs">
                      {semana.sesiones?.length || 0} sesiones
                    </Badge>
                  </div>
                  <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {(semana.sesiones || []).map((sesion, sessionIndex) => {
                      // Calcular fecha para esta sesión
                      const sessionDate = new Date(plan.fecha_inicio);
                      sessionDate.setDate(sessionDate.getDate() + (weekIndex * 7) + sessionIndex);

                      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                      const dayName = dayNames[sessionDate.getDay()];
                      const dayNumber = sessionDate.getDate();

                      // 🎯 Formato: D1 Lun 17 : Pecho + Tríceps
                      const headerText = `D${sessionIndex + 1} ${dayName} ${dayNumber}`;

                      // 💪 Obtener preview de grupos musculares
                      const muscleGroups = getMuscleGroupsPreview(sesion);

                      return (
                        <div
                          key={sesion.id || `w${weekIndex}-s${sessionIndex}`}
                          onClick={() => handleDayClick(sesion, headerText)}
                          className="bg-black/40 rounded-md p-2 border border-gray-700 transition-all text-center cursor-pointer hover:border-blue-500/50 hover:bg-black/60 min-h-[80px] flex flex-col justify-center"
                        >
                          {/* Formato: D1 Lun 17 : Pecho + Tríceps */}
                          <div className="text-yellow-300 font-semibold text-xs leading-tight break-words">
                            {headerText} : {muscleGroups.length > 0 ? muscleGroups.join(' + ') : 'Sin grupos definidos'}
                          </div>

                          {/* Descripción entre paréntesis si existe */}
                          {sesion.descripcion && (
                            <div className="text-gray-400 text-xs mt-1 leading-tight break-words">
                              ({sesion.descripcion})
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-gray-700" />

          {/* Mostrar error si existe */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">
                ⚠️ {error}
              </p>
            </div>
          )}

          {/* Botones de acción mejorados */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            {/* Botón Generar otro - Solo si hay función disponible */}
            {onGenerateAnother && (
              <Button
                onClick={handleGenerateAnotherClick}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                disabled={isLoading || isConfirming || isGeneratingAnother}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {isGeneratingAnother ? 'Generando...' : 'Generar otro'}
              </Button>
            )}

            <div className="flex gap-3 sm:ml-auto">
              <Button
                onClick={() => { track('BUTTON_CLICK', { id: 'cancel' }, { component: 'TrainingPlanConfirmationModal' }); handleClose(); }}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                disabled={isLoading || isConfirming || isDeleting}
              >
                {isDeleting ? 'Cancelando...' : error ? 'Cerrar' : 'Cancelar'}
              </Button>
              <Button
                onClick={() => { track('BUTTON_CLICK', { id: 'start_training' }, { component: 'TrainingPlanConfirmationModal' }); onStartTraining(); }}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-lg hover:shadow-xl"
                disabled={isLoading || isConfirming}
              >
                {isLoading || isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2" />
                    {isConfirming ? 'Guardando rutina...' : 'Iniciando...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Comenzar Entrenamiento
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Modal de Feedback */}
      <ExerciseFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmitFeedback={handleFeedbackSubmit}
        isSubmitting={isGeneratingAnother}
      />

      {/* Modal de Detalle de Día */}
      <DayDetailModal
        isOpen={showDayDetailModal}
        onClose={() => setShowDayDetailModal(false)}
        day={selectedDay}
      />
      </Dialog>

    </>
  );
}
