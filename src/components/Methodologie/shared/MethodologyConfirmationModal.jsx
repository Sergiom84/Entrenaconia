import React, { useState } from 'react';
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
  AlertCircle,
  Loader2
} from 'lucide-react';

const methodologyDescriptions = {
  'Heavy Duty': {
    description: 'Alta intensidad, bajo volumen. Entrenamientos breves pero muy intensos.',
    characteristics: ['Baja frecuencia', 'Al fallo muscular', 'Recuperación larga', 'Máximo esfuerzo'],
    duration: '3-4 días/semana',
    intensity: 'Muy Alta',
    target: 'Fuerza y masa muscular'
  },
  'Powerlifting': {
    description: 'Enfoque en fuerza máxima en los tres ejercicios básicos.',
    characteristics: ['Ejercicios básicos generados por IA', 'Cargas altas', 'Técnica específica', 'Competición'],
    duration: '4-5 días/semana',
    intensity: 'Alta',
    target: 'Fuerza máxima'
  },
  'Hipertrofia': {
    description: 'Maximizar el crecimiento muscular a través del volumen y intensidad.',
    characteristics: ['Alto volumen', 'Rango de repeticiones variado', 'Tiempo bajo tensión', 'División muscular'],
    duration: '4-6 días/semana',
    intensity: 'Media-Alta',
    target: 'Crecimiento muscular'
  },
  'Funcional': {
    description: 'Movimientos naturales y patrones de movimiento del día a día.',
    characteristics: ['Movimientos compuestos', 'Estabilidad y movilidad', 'Transferencia real', 'Variedad'],
    duration: '3-5 días/semana',
    intensity: 'Media',
    target: 'Funcionalidad general'
  },
  'Oposiciones': {
    description: 'Preparación específica para pruebas físicas de oposiciones.',
    characteristics: ['Tests específicos', 'Carrera y resistencia', 'Fuerza funcional', 'Progresión medible'],
    duration: '5-6 días/semana',
    intensity: 'Alta',
    target: 'Rendimiento en pruebas'
  },
  'Crossfit': {
    description: 'Entrenamiento variado e intenso que combina múltiples disciplinas.',
    characteristics: ['WODs variados', 'Cardio y fuerza', 'Movimientos olímpicos', 'Competitivo'],
    duration: '4-6 días/semana',
    intensity: 'Muy Alta',
    target: 'Condición física general'
  },
  'Calistenia': {
    description: 'Entrenamiento con peso corporal enfocado en progresiones.',
    characteristics: ['Solo peso corporal', 'Progresiones técnicas', 'Control corporal', 'Skills avanzados'],
    duration: '4-5 días/semana',
    intensity: 'Media-Alta',
    target: 'Fuerza relativa y control'
  },
  'Entrenamiento en casa': {
    description: 'Rutinas adaptadas para entrenar en casa con mínimo equipamiento.',
    characteristics: ['Equipamiento mínimo', 'Espacios reducidos', 'Adaptable', 'Accesible'],
    duration: '3-5 días/semana',
    intensity: 'Media',
    target: 'Condición física general'
  }
};

export default function MethodologyConfirmationModal({ 
  methodology, 
  onConfirm, 
  onCancel, 
  isGenerating = false 
}) {
  if (!methodology) return null;

  const methodologyData = methodologyDescriptions[methodology] || {
    description: 'Metodología de entrenamiento especializada',
    characteristics: ['Entrenamiento estructurado', 'Progresión sistemática'],
    duration: '3-5 días/semana',
    intensity: 'Media',
    target: 'Mejora general'
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-6xl bg-gray-800 border border-gray-600 rounded-2xl text-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl text-white flex items-center">
                <Target className="w-6 h-6 mr-2 text-yellow-400" />
                Confirmar Metodología
              </DialogTitle>
              <DialogDescription className="text-gray-400 mt-2">
                Vas a generar un plan personalizado basado en:
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-gray-400 hover:text-white"
              disabled={isGenerating}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metodología seleccionada */}
          <div className="p-6 rounded-2xl bg-gray-700/50 border border-gray-600">
            <h3 className="text-2xl font-bold text-yellow-400 mb-4">
              {methodology}
            </h3>
            <p className="text-gray-300 text-base leading-relaxed">
              {methodologyData.description}
            </p>
          </div>

          {/* Características principales */}
          <div className="p-4 rounded-lg bg-gray-700/30">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
              Características Principales
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {methodologyData.characteristics.map((char, index) => (
                <div key={index} className="flex items-center text-sm text-gray-300">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 mr-3"></div>
                  {char}
                </div>
              ))}
            </div>
          </div>

          {/* Información del plan */}
          <div className="grid grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-gray-700/40 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Frecuencia</span>
              </div>
              <div className="text-lg font-bold text-white">{methodologyData.duration}</div>
            </div>

            <div className="p-4 rounded-lg bg-gray-700/40 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-red-400" />
                <span className="text-sm font-medium text-red-400">Intensidad</span>
              </div>
              <div className="text-lg font-bold text-white">{methodologyData.intensity}</div>
            </div>

            <div className="p-4 rounded-lg bg-gray-700/40 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Target className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">Objetivo</span>
              </div>
              <div className="text-lg font-bold text-white">{methodologyData.target}</div>
            </div>
          </div>

          {/* Información importante */}
          <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600">
            <div className="flex items-start mb-2">
              <AlertCircle className="w-5 h-5 text-amber-400 mr-2 mt-0.5" />
              <h4 className="text-amber-200 font-semibold text-sm">Información Importante</h4>
            </div>
            <p className="text-amber-200 text-sm leading-relaxed">
              El plan se generará basándose en tu perfil personal (edad, peso, nivel de entrenamiento, objetivos, etc.) 
              y seguirá estrictamente la metodología <strong>{methodology}</strong>. 
              Tendrás un plan de 4-5 semanas con progresión automática.
            </p>
          </div>

          <Separator className="bg-yellow-400/20" />

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-400">
              {isGenerating ? 'Generando tu plan personalizado...' : '¿Proceder con la generación del plan?'}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                className="border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white"
                disabled={isGenerating}
              >
                Cancelar
              </Button>
              <Button
                onClick={onConfirm}
                className="bg-yellow-400 text-black hover:bg-yellow-300 min-w-[120px]"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Preparando tu rutina...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ¡Acepto! Quiero esta rutina
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
