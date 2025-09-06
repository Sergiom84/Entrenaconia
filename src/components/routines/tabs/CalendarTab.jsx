import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Target,
  Dumbbell,
  CheckCircle,
  AlertTriangle,
  Heart,
  Frown,
  AlertOctagon
} from 'lucide-react';
import { getTodaySessionStatus } from '../api';

export default function CalendarTab({ plan, planStartDate, methodologyPlanId, ensureMethodologyPlan }) {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [weekStatuses, setWeekStatuses] = useState({});

  // Días de la semana (empezando por lunes) - used for display reference
  // const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  // const weekDaysFull = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Procesar el plan para crear estructura de calendario
  const calendarData = useMemo(() => {
    if (!plan?.semanas?.length) return [];

    const startDate = new Date(planStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return plan.semanas.map((semana, weekIndex) => {
      // Calcular fecha base para esta semana
      const weekStartDate = new Date(startDate);
      weekStartDate.setDate(startDate.getDate() + (weekIndex * 7));

      // Crear array de 7 días para la semana (empezando por lunes)
      const weekDays = [];
      
      // Ajustar para que la semana empiece el lunes
      const mondayDate = new Date(weekStartDate);
      const currentDay = mondayDate.getDay(); // 0 = domingo, 1 = lunes, etc.
      const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay; // Si es domingo, retroceder 6 días
      mondayDate.setDate(mondayDate.getDate() + daysToMonday);
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDate = new Date(mondayDate);
        dayDate.setDate(mondayDate.getDate() + dayIndex);
        // Normalizar hora para comparar correctamente con "hoy"
        dayDate.setHours(0, 0, 0, 0);

        const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][dayDate.getDay()];
        const dayNameShort = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][dayDate.getDay()];
        
        // Buscar si hay sesión para este día
        const session = semana.sesiones?.find(ses => {
          const sessionDay = ses.dia?.toLowerCase();
          const currentDayLower = dayName.toLowerCase();
          return sessionDay === currentDayLower || 
                 sessionDay === dayNameShort.toLowerCase() ||
                 sessionDay === dayNameShort.toLowerCase().replace('é', 'e') ||
                 sessionDay === 'mie' && currentDayLower === 'miércoles';
        });

        const isPast = dayDate < today;
        const isToday = dayDate.getTime() === today.getTime();
        const isFuture = dayDate > today;

        weekDays.push({
          date: dayDate,
          dayName,
          dayNameShort,
          session: session || null,
          isPast,
          isToday,
          isFuture,
          weekNumber: semana.semana
        });
      }

      return {
        weekNumber: semana.semana,
        weekStartDate,
        days: weekDays
      };
    });
  }, [plan, planStartDate]);

  const currentWeekData = calendarData[currentWeek] || null;

  // Clave estable para mapear estado de la semana
  const getDayKey = (weekNumber, day) =>
    `${weekNumber}-${(day.dayNameShort || day.dayName).toLowerCase()}`;

  // Igual que en TodayTrainingTab: mapea sentimiento a icono/colores
  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'like':
        return { Icon: Heart, color: 'text-pink-400', bg: 'bg-pink-900/30', border: 'border-pink-500/30', label: 'Me gusta' };
      case 'hard':
        return { Icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-500/30', label: 'Es difícil' };
      case 'dislike':
        return { Icon: Frown, color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-500/30', label: 'No me gusta' };
      default:
        return null;
    }
  };

  // Sincronización: cargar estado para los 7 días visibles
  useEffect(() => {
    let cancelled = false;

    const loadWeekStatuses = async () => {
      if (!currentWeekData) return;
      try {
        const mId = await (ensureMethodologyPlan ? ensureMethodologyPlan() : methodologyPlanId);
        const entries = await Promise.all(
          currentWeekData.days.map(async (day) => {
            const key = getDayKey(currentWeekData.weekNumber || 1, day);
            if (!day.session) return [key, null];
            try {
              const data = await getTodaySessionStatus({
                methodology_plan_id: mId,
                week_number: currentWeekData.weekNumber || 1,
                day_name: day.dayNameShort || day.dayName,
              });
              return [key, data];
            } catch {
              return [key, null];
            }
          })
        );
        if (cancelled) return;
        setWeekStatuses((prev) => {
          const next = { ...prev };
          entries.forEach(([k, v]) => { next[k] = v; });
          return next;
        });
      } catch (e) {
        // ignorar errores para días sin sesión
      }
    };

    // carga inicial
    loadWeekStatuses();

    // auto-refresco ligero cada 8s mientras esta semana esté visible
    const id = setInterval(loadWeekStatuses, 8000);

    return () => { cancelled = true; clearInterval(id); };
  }, [currentWeekData, methodologyPlanId, ensureMethodologyPlan]);

  const handlePrevWeek = () => {
    setCurrentWeek(Math.max(0, currentWeek - 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(Math.min(calendarData.length - 1, currentWeek + 1));
  };

  const handleDayClick = (day) => {
    if (!day.session) return;
    setSelectedDay(day);
    setShowDayModal(true);
  };

  // Utility function removed - was unused
  // const formatDate = (date) => {
  //   return date.toLocaleDateString('es-ES', {
  //     day: 'numeric',
  //     month: 'short'
  //   });
  // };

  const formatFullDate = (date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDayClassName = (day) => {
    let baseClasses = "min-h-48 p-3 border-r border-gray-700 last:border-r-0 transition-all cursor-pointer relative flex flex-col";

    if (day.session) {
      // sin tratamiento amarillo para hoy
      if (day.isPast) {
        baseClasses += " bg-green-900/20 hover:bg-green-900/30";
      } else if (day.isFuture) {
        baseClasses += " bg-blue-900/20 hover:bg-blue-900/30";
      } else {
        baseClasses += " bg-gray-800 hover:bg-gray-700";
      }
    } else {
      baseClasses += " bg-gray-900/50 cursor-default";
    }

    return baseClasses;
  };

  if (!plan) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No hay plan de entrenamiento disponible</p>
      </div>
    );
  }

  if (!calendarData.length) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No se pudo cargar el calendario</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header del calendario */}
      <Card className="bg-gray-900/50 border-gray-700 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Calendario de Entrenamiento</h2>
            <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-300">
              {plan.selected_style}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-300 font-medium">
              Semana {currentWeekData?.weekNumber || 1} de {calendarData.length}
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevWeek}
                disabled={currentWeek === 0}
                className="border-gray-600 hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
                disabled={currentWeek === calendarData.length - 1}
                className="border-gray-600 hover:bg-gray-800"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid del calendario estilo Google Calendar */}
      <Card className="bg-gray-900/50 border-gray-700 overflow-hidden">
        {/* Header de días de la semana */}
        <div className="grid grid-cols-7 bg-gray-800 border-b border-gray-700">
          {currentWeekData?.days.map((day, index) => (
            <div key={index} className={`p-4 text-center font-semibold border-r border-gray-700 last:border-r-0 ${
              day.isToday ? 'bg-yellow-500 text-black' : 'text-gray-300'
            }`}>
              {day.dayNameShort} {day.date.getDate()}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        <div className="grid grid-cols-7">
          {currentWeekData?.days.map((day, index) => (
            <div
              key={index}
              className={getDayClassName(day)}
              onClick={() => handleDayClick(day)}
            >
              {/* Indicadores de estado en la esquina */}
              {day.isPast && day.session && (() => {
                const key = getDayKey(day.weekNumber || currentWeekData.weekNumber, day);
                const progressList = weekStatuses[key]?.exercises || [];
                const totalExercises = day.session.ejercicios?.length || 0;
                const completedExercises = progressList.filter(ex => ex.status === 'completed').length;
                
                // Solo verde si TODOS los ejercicios están completados
                const allCompleted = totalExercises > 0 && completedExercises === totalExercises;
                // Triángulo amarillo si hay algunos completados pero no todos
                const hasIncompleteExercises = completedExercises > 0 && completedExercises < totalExercises;
                
                return (
                  <div className="absolute top-2 right-2">
                    {allCompleted ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : hasIncompleteExercises ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    ) : null}
                  </div>
                );
              })()}



              {/* Lista de ejercicios ocupando todo el espacio disponible */}
              {day.session ? (
                <div className="space-y-2 flex-1 py-2">
{(() => {
  const key = getDayKey(day.weekNumber || currentWeekData.weekNumber, day);
  const progressList = weekStatuses[key]?.exercises || [];
  const statusByOrder = new Map(progressList.map(ex => [ex.exercise_order, ex.status]));
  const progressByOrder = new Map(progressList.map(ex => [ex.exercise_order, ex])); // para comment/sentiment/series

  return day.session.ejercicios?.map((ejercicio, exIndex) => {
    const status = statusByOrder.get(exIndex);
    const progress = progressByOrder.get(exIndex);
    const sentimentData = getSentimentIcon(progress?.sentiment);
    const hasComment = !!(progress?.comment && progress.comment.trim());
    const seriesCompleted = progress?.series_completed ?? 0;

    // Colores suaves por estado (se mantienen)
    const rowClass =
      status === 'completed' ? 'bg-green-900/20 border-green-500/30' :
      status === 'skipped'   ? 'bg-gray-800/50 border-gray-600/40 opacity-90' :
      status === 'cancelled' ? 'bg-red-900/20 border-red-500/30' :
                               'border-gray-600/30';

    const nameClass =
      status === 'completed' ? 'text-green-300' :
      status === 'skipped'   ? 'text-gray-300' :
      status === 'cancelled' ? 'text-red-300'  :
                               'text-white';

    return (
      <div
        key={exIndex}
        className={`text-xs pb-2 last:border-b-0 border rounded-md px-2 py-2 ${rowClass}`}
      >
        {/* fila superior: nombre + descanso (SIN badge de estado) */}
        <div className="flex items-start justify-between">
          <div className={`font-medium ${nameClass}`}>
            {ejercicio.nombre}
          </div>
          {ejercicio.descanso_seg && (
            <span className="text-gray-400">{Math.round(ejercicio.descanso_seg / 60)}'</span>
          )}
        </div>

        {/* fila media: series x repeticiones + progreso de series */}
        <div className="flex items-center justify-between text-xs text-gray-400 mt-0.5">
          <span>{ejercicio.series} × {ejercicio.repeticiones}</span>
          {status && <span className="text-[11px]">{seriesCompleted}/{ejercicio.series} series</span>}
        </div>

        {/* fila inferior: chip de sentimiento + comentario (se mantiene) */}
        {(sentimentData || hasComment) && (
          <div className="flex items-center gap-2 mt-1">
            {sentimentData && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border ${sentimentData.bg} ${sentimentData.border}`}>
                <sentimentData.Icon className={`w-3 h-3 mr-1 ${sentimentData.color}`} />
                <span className={`text-[10px] ${sentimentData.color}`}>{sentimentData.label}</span>
              </span>
            )}
            {hasComment && (
              <span className="text-[11px] text-gray-400 italic truncate">"{progress.comment}"</span>
            )}
          </div>
        )}
      </div>
    );
  });
})()}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className={`text-xs text-center ${
                    day.isToday ? 'text-black font-semibold' : 'text-gray-500'
                  }`}>
                    Día de descanso
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Leyenda */}
      <Card className="bg-gray-900/50 border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-600 rounded-full" />
            <span className="text-gray-300">Completado</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full" />
            <span className="text-gray-300">Saltado</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-gray-300">Cancelado</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <span className="text-gray-300">Hoy</span>
          </div>
        </div>
      </Card>

      {/* Modal de detalles del día */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-yellow-400" />
              {selectedDay && formatFullDate(selectedDay.date)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay?.session && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-300">
                  Semana {selectedDay.weekNumber}
                </Badge>
                <div className="text-sm text-gray-400">
                  {selectedDay.session.ejercicios?.length || 0} ejercicios
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(() => {
                  const key = getDayKey(selectedDay.weekNumber, selectedDay);
                  const statusMap = new Map((weekStatuses[key]?.exercises || []).map(ex => [ex.exercise_order, ex.status]));
                  return selectedDay.session.ejercicios?.map((ejercicio, index) => {
                    const status = statusMap.get(index);
                    const badge = status === 'completed' ? (
                      <Badge variant="outline" className="border-green-500 text-green-400 text-xs">Completado</Badge>
                    ) : status === 'skipped' ? (
                      <Badge variant="outline" className="border-gray-500 text-gray-400 text-xs">Saltado</Badge>
                    ) : status === 'cancelled' ? (
                      <Badge variant="outline" className="border-red-500 text-red-400 text-xs">Cancelado</Badge>
                    ) : null;
                    return (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-black/40 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white">{ejercicio.nombre}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                            <span className="flex items-center">
                              <Target className="w-3 h-3 mr-1" />
                              {ejercicio.series} × {ejercicio.repeticiones}
                            </span>
                            {ejercicio.descanso_seg && (
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {Math.round(ejercicio.descanso_seg / 60)}min
                              </span>
                            )}
                          </div>
                          {(() => {
                            const key = getDayKey(selectedDay.weekNumber, selectedDay);
                            const p = (weekStatuses[key]?.exercises || []).find(ex => ex.exercise_order === index);
                            const sd = getSentimentIcon(p?.sentiment);
                            const hasC = !!(p?.comment && p.comment.trim());
                            return (sd || hasC) ? (
                              <div className="flex items-center gap-2 mt-2">
                                {sd && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border ${sd.bg} ${sd.border}`}>
                                    <sd.Icon className={`w-3 h-3 mr-1 ${sd.color}`} />
                                    <span className={`text-xs ${sd.color}`}>{sd.label}</span>
                                  </span>
                                )}
                                {hasC && <span className="text-xs text-gray-400 italic">"{p.comment}"</span>}
                              </div>
                            ) : null;
                          })()}
                        </div>
                        {badge}
                      </div>
                    );
                  });
                })()}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}