/**
 * 🔔 Confirmation Modals - Modales de confirmación para rutinas
 * 
 * RAZONAMIENTO:
 * - Extraído de TodayTrainingTab.jsx para reducir complejidad
 * - Agrupa todos los modales de confirmación en un solo lugar
 * - Componente reutilizable y mantenible
 */

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader } from '../../ui/card';
import SafeComponent from '../../ui/SafeComponent';

/**
 * Modal de confirmación para cancelar rutina
 */
export const CancelConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <SafeComponent context="CancelConfirmModal" showMinimalError>
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <Card className="w-full max-w-sm mx-4 bg-gray-800 border-red-500/30">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              ¿Cancelar rutina?
            </h3>
            <p className="text-sm text-gray-400 mt-2">
              Se perderá todo el progreso de la sesión actual.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <Button 
              onClick={onConfirm}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, cancelar rutina
            </Button>
            <Button 
              onClick={onCancel}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              No, continuar
            </Button>
          </CardContent>
        </Card>
      </div>
    </SafeComponent>
  );
};

/**
 * Modal para mostrar ejercicios pendientes de días anteriores
 */
export const PendingExercisesModal = ({ 
  isOpen, 
  exercises, 
  onClose, 
  onStartSession,
  formatExerciseName 
}) => {
  if (!isOpen || !exercises) return null;

  return (
    <SafeComponent context="PendingExercisesModal" showMinimalError>
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4 bg-gray-800 border-yellow-500/30 max-h-[90vh] overflow-y-auto">
          <CardHeader className="border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-yellow-400">
                  Ejercicios Pendientes
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Tienes ejercicios sin completar de días anteriores
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-4">
            <div className="space-y-3 mb-6">
              {exercises.slice(0, 5).map((exercise, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {formatExerciseName ? formatExerciseName(exercise.exercise_name) : exercise.exercise_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {exercise.session_date ? 
                        new Date(exercise.session_date).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short'
                        }) : 'Fecha no disponible'
                      }
                    </div>
                  </div>
                </div>
              ))}
              
              {exercises.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  ... y {exercises.length - 5} ejercicios más
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button 
                onClick={onStartSession}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
              >
                Completar ejercicios pendientes
              </Button>
              <Button 
                onClick={onClose}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Continuar con hoy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SafeComponent>
  );
};

/**
 * Modal de confirmación genérico
 */
export const GenericConfirmModal = ({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm, 
  onCancel,
  variant = 'warning' // 'warning' | 'danger' | 'info'
}) => {
  if (!isOpen) return null;

  const variants = {
    warning: {
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/30',
      buttonColor: 'bg-yellow-500 hover:bg-yellow-600'
    },
    danger: {
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      borderColor: 'border-red-500/30',
      buttonColor: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/30',
      buttonColor: 'bg-blue-600 hover:bg-blue-700'
    }
  };

  const currentVariant = variants[variant];

  return (
    <SafeComponent context="GenericConfirmModal" showMinimalError>
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <Card className={`w-full max-w-sm mx-4 bg-gray-800 ${currentVariant.borderColor}`}>
          <CardHeader className="text-center pb-4">
            <div className={`mx-auto w-12 h-12 ${currentVariant.iconBg} rounded-full flex items-center justify-center mb-3`}>
              <AlertTriangle className={`w-6 h-6 ${currentVariant.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {title}
            </h3>
            {message && (
              <p className="text-sm text-gray-400 mt-2">
                {message}
              </p>
            )}
          </CardHeader>
          
          <CardContent className="space-y-3">
            <Button 
              onClick={onConfirm}
              className={`w-full ${currentVariant.buttonColor} text-white`}
            >
              {confirmText}
            </Button>
            <Button 
              onClick={onCancel}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              {cancelText}
            </Button>
          </CardContent>
        </Card>
      </div>
    </SafeComponent>
  );
};

