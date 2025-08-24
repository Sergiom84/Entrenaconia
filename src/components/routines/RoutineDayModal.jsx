import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { X, Clock, Target, Dumbbell, RotateCcw, PlayCircle, TrendingUp, Timer, Zap, Calendar } from 'lucide-react';

export default function RoutineDayModal({ dayData, onClose, onStartTraining }) {
  if (!dayData) return null;
  const handleStartTraining = () => { onStartTraining(dayData); };
  const getRPEColor = (rpe) => { if (rpe >= 8) return 'bg-red-500'; if (rpe >= 6) return 'bg-yellow-500'; return 'bg-green-500'; };
  const formatTempo = (tempo) => (!tempo ? null : <div className="text-xs text-gray-400"><span>Tempo: {tempo}</span></div>);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-black border-yellow-400/40 text-white overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl text-white flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-yellow-400" />
                {dayData.dia} - Semana {dayData.weekNumber}
              </DialogTitle>
              <DialogDescription className="text-gray-400 mt-2">
                {dayData.objetivo_de_la_sesion}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-400" /><span className="text-xs uppercase tracking-wide text-yellow-400">Duración</span></div>
              <div className="text-lg font-semibold text-white">{dayData.duracion_sesion_min} min</div>
            </div>
            <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/30">
              <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-green-400" /><span className="text-xs uppercase tracking-wide text-green-400">Intensidad</span></div>
              <div className="text-lg font-semibold text-white">{dayData.intensidad_guia}</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-400/10 border border-blue-400/30">
              <div className="flex items-center gap-2 mb-1"><Dumbbell className="w-4 h-4 text-blue-400" /><span className="text-xs uppercase tracking-wide text-blue-400">Ejercicios</span></div>
              <div className="text-lg font-semibold text-white">{dayData.ejercicios?.length || 0}</div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center"><Dumbbell className="w-5 h-5 mr-2 text-yellow-400" />Ejercicios del Día</h3>
            <div className="space-y-4">
              {dayData.ejercicios?.map((ejercicio, index) => (
                <div key={index} className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-lg font-medium text-white mb-1">{ejercicio.nombre}</h4>
                      {ejercicio.notas && (<p className="text-sm text-gray-400">{ejercicio.notas}</p>)}
                    </div>
                    <div className="flex items-center gap-2">
                      {ejercicio.intensidad && (<Badge variant="outline" className="border-yellow-400 text-yellow-400">{ejercicio.intensidad}</Badge>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" /><div><div className="text-gray-400">Series</div><div className="text-white font-medium">{ejercicio.series}</div></div></div>
                    <div className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-blue-400" /><div><div className="text-gray-400">Repeticiones</div><div className="text-white font-medium">{ejercicio.repeticiones}</div></div></div>
                    <div className="flex items-center gap-2"><Timer className="w-4 h-4 text-purple-400" /><div><div className="text-gray-400">Descanso</div><div className="text-white font-medium">{ejercicio.descanso_seg}s</div></div></div>
                    {ejercicio.tempo && (<div className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /><div><div className="text-gray-400">Tempo</div><div className="text-white font-medium">{ejercicio.tempo}</div></div></div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-yellow-400/20" />

          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-gray-400">¿Listo para comenzar tu entrenamiento?</div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white">Cerrar</Button>
              <Button onClick={handleStartTraining} className="bg-yellow-400 text-black hover:bg-yellow-300"><PlayCircle className="w-4 h-4 mr-2" />Comenzar Entrenamiento</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

