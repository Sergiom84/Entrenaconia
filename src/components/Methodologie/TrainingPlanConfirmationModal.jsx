/**
 * 🎯 Modal Unificado de Confirmación de Plan de Entrenamiento
 * 
 * FUNCIONALIDAD:
 * - Modal único para confirmar cualquier plan generado (automático o manual)
 * - Muestra resumen del plan con ejercicios y justificación
 * - Botón "Comenzar Entrenamiento" que abre RoutineSessionModal DIRECTAMENTE
 * - NO navega a /routines - flujo directo
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
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

export default function TrainingPlanConfirmationModal({ 
  isOpen, 
  onClose, 
  onStartTraining, // Nueva función para iniciar directamente
  plan, 
  methodology, 
  aiJustification = null,
  isLoading = false 
}) {
  if (!isOpen || !plan) return null;

  // Extraer información del plan
  const firstWeek = plan.semanas?.[0];
  const firstSession = firstWeek?.sesiones?.[0];
  const totalWeeks = plan.semanas?.length || 0;
  const totalSessions = plan.semanas?.reduce((acc, week) => acc + (week.sesiones?.length || 0), 0) || 0;
  
  // Contar ejercicios únicos
  const uniqueExercises = new Set();
  plan.semanas?.forEach(week => {
    week.sesiones?.forEach(session => {
      session.ejercicios?.forEach(exercise => {
        uniqueExercises.add(exercise.nombre || exercise.name);
      });
    });
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-yellow-500/20">
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
                  {methodology} • Personalizado para tu perfil
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
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
              <div className="text-lg font-semibold text-white">{uniqueExercises.size}</div>
              <div className="text-xs text-gray-400">Ejercicios</div>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <Target className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-white">{methodology}</div>
              <div className="text-xs text-gray-400">Metodología</div>
            </div>
          </div>

          {/* Preview de la primera sesión */}
          {firstSession && (
            <div>
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                Primera Sesión - {firstSession.dia} (Preview)
              </h4>
              <div className="bg-gray-800/30 rounded-lg p-4 max-h-64 overflow-y-auto">
                {firstSession.ejercicios?.slice(0, 5).map((exercise, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                    <div>
                      <div className="text-white font-medium text-sm">
                        {exercise.nombre || exercise.name}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {exercise.series}x{exercise.repeticiones} • {exercise.descanso || '60s descanso'}
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 text-xs">
                      {exercise.categoria || 'Ejercicio'}
                    </Badge>
                  </div>
                ))}
                {firstSession.ejercicios?.length > 5 && (
                  <div className="text-center text-gray-400 text-sm pt-2">
                    +{firstSession.ejercicios.length - 5} ejercicios más...
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator className="bg-gray-700" />

          {/* Botones de acción */}
          <div className="flex gap-3 justify-end">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={onStartTraining}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2" />
                  Iniciando...
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
      </DialogContent>
    </Dialog>
  );
}