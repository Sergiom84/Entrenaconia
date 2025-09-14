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

