import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Calendar, Clock, Dumbbell, PlayCircle, Moon } from 'lucide-react';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const getWeekDates = (weekNumber) => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + ((weekNumber - 1) * 7));
  const dayOfWeek = startDate.getDay();
  let mondayOffset;
  if (dayOfWeek === 0) mondayOffset = 1; else if (dayOfWeek === 1) mondayOffset = 0; else mondayOffset = -(dayOfWeek - 1);
  startDate.setDate(startDate.getDate() + mondayOffset);
  const weekDates = [];
  for (let i = 0; i < 7; i++) { const d = new Date(startDate); d.setDate(startDate.getDate() + i); weekDates.push(d); }
  return weekDates;
};

export default function RoutineCalendar({ plan, currentWeek, onDayClick }) {
  if (!plan || !plan.semanas || plan.semanas.length === 0) {
    return (
      <Card className="bg-black/80 border-yellow-400/20 p-8">
        <div className="text-center text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay datos de entrenamiento disponibles</p>
        </div>
      </Card>
    );
  }

  const weekData = plan.semanas.find(semana => semana.semana === currentWeek);
  if (!weekData) {
    return (
      <Card className="bg-black/80 border-yellow-400/20 p-8">
        <div className="text-center text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay datos para la semana {currentWeek}</p>
        </div>
      </Card>
    );
  }

  const sesionesMap = {}; (weekData.sesiones||[]).forEach(s => { sesionesMap[s.dia] = s; });

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentWeek);
    const today = new Date(); today.setHours(0,0,0,0);
    return DIAS_SEMANA.map((dia, idx) => {
      const sesion = sesionesMap[dia];
      const hasTraining = !!sesion;
      const dayDate = weekDates[idx];
      const isToday = dayDate.getTime() === today.getTime();
      const dayNumber = dayDate.getDate();
      const month = dayDate.toLocaleDateString('es-ES', { month: 'short' });
      return (
        <div key={dia} className="flex flex-col">
          <div className={`text-center p-2 border-b border-yellow-400/20 ${isToday ? 'bg-yellow-400/20' : ''}`}>
            <div className={`text-sm font-medium ${isToday ? 'text-yellow-300' : 'text-yellow-400'}`}>{dia}</div>
            <div className={`text-xs ${isToday ? 'text-yellow-200' : 'text-gray-400'}`}>{dayNumber} {month}</div>
            {isToday && <div className="text-xs text-yellow-300 font-medium">HOY</div>}
          </div>
          <div className="flex-1 p-2">
            {hasTraining ? (
              <Button variant="ghost" className="w-full h-full min-h-[120px] p-3 border border-yellow-400/30 hover:border-yellow-400/60 hover:bg-yellow-400/10 transition-all duration-200 flex flex-col items-center justify-center gap-2" onClick={() => onDayClick(sesion, currentWeek)}>
                <PlayCircle className="w-8 h-8 text-yellow-400" />
                <div className="text-center">
                  <div className="text-sm font-medium text-white mb-1">{sesion.objetivo_de_la_sesion || 'Entrenamiento'}</div>
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{sesion.duracion_sesion_min}min</div>
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-400"><Dumbbell className="w-3 h-3" />{sesion.ejercicios?.length || 0} ejercicios</div>
                  <div className="text-xs text-yellow-400 mt-1">{sesion.intensidad_guia}</div>
                </div>
              </Button>
            ) : (
              <div className="w-full h-[120px] flex flex-col items-center justify-center border border-gray-700/30 rounded-md">
                <Moon className="w-6 h-6 text-gray-600 mb-2" />
                <span className="text-xs text-gray-500">Descanso</span>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <Card className="bg-black/80 border-yellow-400/40">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-yellow-400" />
            Semana {currentWeek}
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <PlayCircle className="w-4 h-4 text-yellow-400" />
              <span>{weekData.sesiones?.length || 0} entrenamientos</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 border border-yellow-400/20 rounded-lg overflow-hidden">
          {renderWeekView()}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400">
          <div className="flex items-center gap-1"><PlayCircle className="w-3 h-3 text-yellow-400" /><span>Día de entrenamiento</span></div>
          <div className="flex items-center gap-1"><Moon className="w-3 h-3 text-gray-600" /><span>Día de descanso</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

