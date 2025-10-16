/**
 * 🎯 ReEvaluationModal - Modal Universal de Re-evaluación
 *
 * PROPÓSITO: Modal genérico para re-evaluaciones periódicas de progreso
 * ARQUITECTURA: Carga formularios específicos según metodología
 * ESCALABILIDAD: Añadir nueva metodología = crear nuevo formulario
 *
 * @version 1.0.0 - Sistema de Re-evaluación Progresiva
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, X, TrendingUp, Clock, Target, AlertCircle } from 'lucide-react';

// Import de formularios específicos por metodología
import CalisteniaReEvalForm from './forms/CalisteniaReEvalForm';
// import HipertrofiaReEvalForm from './forms/HipertrofiaReEvalForm';
// import CrossFitReEvalForm from './forms/CrossFitReEvalForm';
// ... más metodologías

// =============================================================================
// 📋 REGISTRY DE FORMULARIOS POR METODOLOGÍA
// =============================================================================

const FORMS_REGISTRY = {
  'calistenia': CalisteniaReEvalForm,
  // 'hipertrofia': HipertrofiaReEvalForm,
  // 'crossfit': CrossFitReEvalForm,
  // 'powerlifting': PowerliftingReEvalForm,
  // 'oposicion': OposicionReEvalForm,
  // 'funcional': FuncionalReEvalForm,
};

/**
 * Obtener componente de formulario según metodología
 * Si no existe formulario específico, retorna formulario genérico
 */
const getFormComponentForMethodology = (methodology) => {
  const normalizedMethodology = methodology?.toLowerCase();
  return FORMS_REGISTRY[normalizedMethodology] || GenericReEvalForm;
};

// =============================================================================
// 🔧 FORMULARIO GENÉRICO (Fallback)
// =============================================================================

const GenericReEvalForm = ({ planId, currentWeek, methodology, onSubmit, onCancel }) => {
  const [comment, setComment] = useState('');
  const [sentiment, setSentiment] = useState(null);

  const handleSubmit = () => {
    onSubmit({
      sentiment,
      overall_comment: comment,
      exercises: [] // Formulario genérico sin ejercicios específicos
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4">
        <p className="text-sm text-yellow-200">
          ⚠️ Formulario genérico para <strong>{methodology}</strong>.
          Formulario específico pendiente de implementación.
        </p>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-white mb-3">
          ¿Cómo te has sentido estas semanas?
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {['excelente', 'bien', 'regular', 'difícil'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setSentiment(opt)}
              className={`p-3 rounded-lg border transition-all ${
                sentiment === opt
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Comentarios</h3>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Comparte tu experiencia general..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:border-yellow-400 focus:outline-none"
          rows={4}
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-1">{comment.length}/500 caracteres</p>
      </section>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!sentiment && !comment.trim()}
          className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar Evaluación
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// 🎨 COMPONENTE PRINCIPAL: ReEvaluationModal
// =============================================================================

const ReEvaluationModal = ({
  show,
  onClose,
  methodology,
  methodologyPlanId,
  currentWeek,
  weeksSinceLastEval,
  onSubmitSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Obtener componente de formulario según metodología
  const FormComponent = getFormComponentForMethodology(methodology);

  // Prevenir scroll del body cuando modal está abierto
  useEffect(() => {
    if (show) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [show]);

  // Manejo de tecla Escape
  useEffect(() => {
    if (!show) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show]);

  // Reset states cuando se cierra el modal
  useEffect(() => {
    if (!show) {
      setError(null);
      setSuccessMessage(null);
      setIsSubmitting(false);
    }
  }, [show]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose?.();
    }
  }, [isSubmitting, onClose]);

  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      handleClose();
    }
  }, [isSubmitting, handleClose]);

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('📊 Enviando re-evaluación:', {
        methodology,
        methodologyPlanId,
        currentWeek,
        formData
      });

      // Llamar al API para guardar re-evaluación
      const response = await fetch('/api/progress/re-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          methodology,
          methodology_plan_id: methodologyPlanId,
          week: currentWeek,
          ...formData
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar la re-evaluación');
      }

      console.log('✅ Re-evaluación guardada:', data);

      // Mostrar mensaje de éxito
      setSuccessMessage('¡Re-evaluación completada! La IA está analizando tu progreso...');

      // Esperar 2 segundos y cerrar
      setTimeout(() => {
        onSubmitSuccess?.(data);
        handleClose();
      }, 2000);

    } catch (err) {
      console.error('❌ Error al enviar re-evaluación:', err);
      setError(err.message || 'Error al procesar la re-evaluación');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Modal Container */}
      <div className="relative bg-gray-900 border border-yellow-400/20 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-200 scale-100 opacity-100">

        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 border-b border-yellow-400/20 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="bg-yellow-400/20 p-3 rounded-lg">
                <Trophy className="text-yellow-400 w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  Re-evaluación de Progreso
                </h2>
                <p className="text-gray-400 text-sm">
                  Comparte tu experiencia y obtén ajustes personalizados con IA
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Target size={14} />
                <span>Metodología</span>
              </div>
              <p className="text-white font-semibold capitalize">{methodology}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <TrendingUp size={14} />
                <span>Semana Actual</span>
              </div>
              <p className="text-white font-semibold">Semana {currentWeek}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Clock size={14} />
                <span>Última Evaluación</span>
              </div>
              <p className="text-white font-semibold">
                {weeksSinceLastEval === 0 ? 'Primera vez' : `Hace ${weeksSinceLastEval} semanas`}
              </p>
            </div>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-red-400 font-semibold mb-1">Error al enviar</h4>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
              <Trophy className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-green-400 font-semibold mb-1">¡Éxito!</h4>
                <p className="text-green-300 text-sm">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Formulario Específico de Metodología */}
          {!successMessage && (
            <FormComponent
              planId={methodologyPlanId}
              currentWeek={currentWeek}
              methodology={methodology}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isSubmitting={isSubmitting}
            />
          )}
        </div>

        {/* Loading Overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-400 border-t-transparent mx-auto mb-3"></div>
              <p className="text-white font-semibold">Enviando re-evaluación...</p>
              <p className="text-gray-400 text-sm mt-1">La IA está procesando tu progreso</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReEvaluationModal;
