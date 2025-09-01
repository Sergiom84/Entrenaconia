import { useState, useMemo } from 'react';
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
  Play,
  CheckCircle
} from 'lucide-react';

export default function CalendarTab({ plan, planStartDate, methodologyPlanId, ensureMethodologyPlan }) {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);

  // Días de la semana (empezando por lunes)
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const weekDaysFull = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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

  const formatDate = (date) => {
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  };

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
      if (day.isToday) {
        baseClasses += " bg-gradient-to-b from-yellow-400/60 to-yellow-500/40 border-l-4 border-l-yellow-400 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-400/20";
      } else if (day.isPast) {
        baseClasses += " bg-green-900/20 hover:bg-green-900/30";
      } else if (day.isFuture) {
        baseClasses += " bg-blue-900/20 hover:bg-blue-900/30";
      } else {
        baseClasses += " bg-gray-800 hover:bg-gray-700";
      }
    } else {
      if (day.isToday) {
        baseClasses += " bg-gradient-to-b from-yellow-400/50 to-yellow-500/30 border-l-4 border-l-yellow-400 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-400/20";
      } else {
        baseClasses += " bg-gray-900/50 cursor-default";
      }
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
              {day.isPast && day.session && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
              )}
              
              {/* Indicador especial para día actual */}
              {day.isToday && (
                <>
                  {/* Círculo pulsante */}
                  <div className="absolute top-2 right-2">
                    <div className="relative">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                    </div>
                  </div>
                  
                  {/* Badge "HOY" en la esquina superior izquierda */}
                  <div className="absolute top-1 left-1 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                    HOY
                  </div>
                </>
              )}

              {/* Lista de ejercicios ocupando todo el espacio disponible */}
              {day.session ? (
                <div className="space-y-2 flex-1 py-2">
                  {day.session.ejercicios?.map((ejercicio, exIndex) => (
                    <div key={exIndex} className={`text-xs pb-2 last:border-b-0 ${
                      day.isToday ? 'border-b border-yellow-600/40' : 'border-b border-gray-600/30'
                    }`}>
                      <div className={`font-medium mb-1 ${
                        day.isToday ? 'text-black font-semibold' : 
                        day.isPast ? 'text-green-100' :
                        day.isFuture ? 'text-blue-100' : 'text-white'
                      }`}>
                        {ejercicio.nombre}
                      </div>
                      <div className={`flex items-center justify-between text-xs ${
                        day.isToday ? 'text-gray-800' : 'text-gray-400'
                      }`}>
                        <span>{ejercicio.series} × {ejercicio.repeticiones}</span>
                        {ejercicio.descanso_seg && (
                          <span>{Math.round(ejercicio.descanso_seg / 60)}'</span>
                        )}
                      </div>
                    </div>
                  ))}
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
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <span className="text-gray-300">Hoy</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full" />
            <span className="text-gray-300">Próximo</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-600 rounded-full" />
            <span className="text-gray-300">Descanso</span>
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
                {selectedDay.session.ejercicios?.map((ejercicio, index) => (
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
                    </div>
                  </div>
                ))}
              </div>

              {selectedDay.isToday && (
                <Button className="w-full bg-yellow-400 text-black hover:bg-yellow-300">
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Entrenamiento
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}