/**
 * useMethodologyAPI Hook - React Hook para APIs de Metodología
 * Hook personalizado que proporciona funciones API con estados de loading,
 * manejo de errores y cleanup automático
 *
 * @author Claude Code - Modernización Técnica
 * @version 1.0.0 - Hook API Robusto
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import methodologyService from '../services/methodologyService.js';

// ===============================================
// ESTADOS INICIALES
// ===============================================

const INITIAL_LOADING_STATE = {
  checkingActive: false,
  evaluating: false,
  generating: false,
  activating: false,
  startingSession: false
};

const INITIAL_ERRORS_STATE = {};

// ===============================================
// HOOK PRINCIPAL
// ===============================================

export function useMethodologyAPI() {
  // Estados
  const [loading, setLoading] = useState(INITIAL_LOADING_STATE);
  const [errors, setErrors] = useState(INITIAL_ERRORS_STATE);
  const [lastResults, setLastResults] = useState({});

  // Referencias para cleanup
  const mountedRef = useRef(true);
  const timeoutsRef = useRef([]);

  // ===============================================
  // FUNCIONES HELPER
  // ===============================================

  /**
   * Actualizar estado de loading de manera segura
   */
  const setLoadingState = useCallback((operation, isLoading) => {
    if (!mountedRef.current) return;

    setLoading(prev => ({
      ...prev,
      [operation]: isLoading
    }));
  }, []);

  /**
   * Establecer error de manera segura
   */
  const setError = useCallback((operation, error) => {
    if (!mountedRef.current) return;

    setErrors(prev => ({
      ...prev,
      [operation]: error
    }));
  }, []);

  /**
   * Limpiar error específico
   */
  const clearError = useCallback((operation) => {
    if (!mountedRef.current) return;

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[operation];
      return newErrors;
    });
  }, []);

  /**
   * Wrapper para llamadas API con manejo automático de estados
   */
  const withAPICall = useCallback(async (
    operation,
    apiCall,
    options = {}
  ) => {
    const {
      timeout = 30000,
      onSuccess = null,
      onError = null,
      retryable = true
    } = options;

    if (!mountedRef.current) return { success: false, cancelled: true };

    // Limpiar error previo
    clearError(operation);
    setLoadingState(operation, true);

    try {
      // Configurar timeout
      const timeoutId = setTimeout(() => {
        if (mountedRef.current) {
          setError(operation, {
            type: 'timeout',
            message: 'La operación tardó demasiado tiempo',
            retryable: true
          });
        }
      }, timeout);

      timeoutsRef.current.push(timeoutId);

      // Realizar llamada API
      const result = await apiCall();

      // Limpiar timeout si se completa a tiempo
      clearTimeout(timeoutId);
      timeoutsRef.current = timeoutsRef.current.filter(id => id !== timeoutId);

      if (!mountedRef.current) return { success: false, cancelled: true };

      if (result.success) {
        // Guardar resultado exitoso
        setLastResults(prev => ({ ...prev, [operation]: result.data }));

        // Callback de éxito
        if (onSuccess) {
          try {
            await onSuccess(result.data);
          } catch (callbackError) {
            console.warn(`Warning: onSuccess callback failed for ${operation}:`, callbackError);
          }
        }

        return result;
      } else {
        // Manejar error de API
        const errorInfo = {
          type: result.error || 'api',
          message: result.message || 'Error desconocido',
          retryable: result.retryable && retryable,
          attempts: result.attempts || 1
        };

        setError(operation, errorInfo);

        // Callback de error
        if (onError) {
          try {
            await onError(errorInfo);
          } catch (callbackError) {
            console.warn(`Warning: onError callback failed for ${operation}:`, callbackError);
          }
        }

        return result;
      }

    } catch (error) {
      if (!mountedRef.current) return { success: false, cancelled: true };

      const errorInfo = {
        type: 'unexpected',
        message: error.message || 'Error inesperado',
        retryable: retryable,
        originalError: error
      };

      console.error(`Unexpected error in ${operation}:`, error);
      setError(operation, errorInfo);

      // Callback de error
      if (onError) {
        try {
          await onError(errorInfo);
        } catch (callbackError) {
          console.warn(`Warning: onError callback failed for ${operation}:`, callbackError);
        }
      }

      return { success: false, error: errorInfo };

    } finally {
      if (mountedRef.current) {
        setLoadingState(operation, false);
      }
    }
  }, [clearError, setLoadingState, setError]);

  // ===============================================
  // FUNCIONES API ESPECÍFICAS
  // ===============================================

  /**
   * Verificar entrenamiento activo
   */
  const checkActiveTraining = useCallback(async () => {
    return withAPICall(
      'checkingActive',
      () => methodologyService.checkActiveTraining(),
      {
        timeout: 10000,
        onSuccess: (data) => {
          console.log('✅ Verificación de entrenamiento activo exitosa');
        },
        onError: (error) => {
          console.warn('⚠️ Error verificando entrenamiento activo:', error.message);
        }
      }
    );
  }, [withAPICall]);

  /**
   * Evaluar perfil con IA
   */
  const evaluateProfile = useCallback(async (profileData) => {
    return withAPICall(
      'evaluating',
      () => methodologyService.evaluateProfile(profileData),
      {
        timeout: 20000,
        onSuccess: (data) => {
          console.log('✅ Evaluación de perfil exitosa:', data.evaluation?.recommended_level);
        },
        onError: (error) => {
          console.error('❌ Error en evaluación de perfil:', error.message);
        }
      }
    );
  }, [withAPICall]);

  /**
   * Generar plan con o sin feedback
   */
  const generatePlan = useCallback(async (planRequest, options = {}) => {
    const { withFeedback = false, previousPlan = null } = options;

    return withAPICall(
      'generating',
      () => methodologyService.generatePlan(planRequest, {
        includeFeedback: withFeedback,
        previousPlan
      }),
      {
        timeout: 45000, // Mayor timeout para generación con IA
        onSuccess: (data) => {
          console.log('✅ Plan generado exitosamente:', {
            planId: data.methodologyPlanId,
            withFeedback
          });
        },
        onError: (error) => {
          console.error('❌ Error generando plan:', error.message);
        }
      }
    );
  }, [withAPICall]);

  /**
   * Activar plan y preparar para entrenamiento
   */
  const activatePlan = useCallback(async (planId, planData) => {
    return withAPICall(
      'activating',
      () => methodologyService.confirmAndActivatePlan(planId, planData),
      {
        timeout: 15000,
        onSuccess: (data) => {
          console.log('✅ Plan activado exitosamente:', data.routinePlanId);
        },
        onError: (error) => {
          console.error('❌ Error activando plan:', error.message);
        }
      }
    );
  }, [withAPICall]);

  /**
   * Iniciar sesión de entrenamiento
   */
  const startSession = useCallback(async (sessionData) => {
    return withAPICall(
      'startingSession',
      () => methodologyService.startTrainingSession(sessionData),
      {
        timeout: 15000,
        onSuccess: (data) => {
          console.log('✅ Sesión iniciada exitosamente:', data.sessionId);
        },
        onError: (error) => {
          console.error('❌ Error iniciando sesión:', error.message);
        }
      }
    );
  }, [withAPICall]);

  // ===============================================
  // FUNCIONES DE UTILIDAD
  // ===============================================

  /**
   * Reintentar operación fallida
   */
  const retry = useCallback((operation) => {
    const functions = {
      checkingActive: checkActiveTraining,
      evaluating: () => {
        console.warn('Retry de evaluateProfile requiere parámetros');
        return Promise.resolve({ success: false, error: 'Missing parameters' });
      },
      generating: () => {
        console.warn('Retry de generatePlan requiere parámetros');
        return Promise.resolve({ success: false, error: 'Missing parameters' });
      },
      activating: () => {
        console.warn('Retry de activatePlan requiere parámetros');
        return Promise.resolve({ success: false, error: 'Missing parameters' });
      },
      startingSession: () => {
        console.warn('Retry de startSession requiere parámetros');
        return Promise.resolve({ success: false, error: 'Missing parameters' });
      }
    };

    const retryFunction = functions[operation];
    if (retryFunction) {
      return retryFunction();
    } else {
      console.error(`No retry function available for operation: ${operation}`);
      return Promise.resolve({ success: false, error: 'No retry function' });
    }
  }, [checkActiveTraining]);

  /**
   * Limpiar todos los errores
   */
  const clearAllErrors = useCallback(() => {
    setErrors(INITIAL_ERRORS_STATE);
  }, []);

  /**
   * Obtener último resultado exitoso
   */
  const getLastResult = useCallback((operation) => {
    return lastResults[operation] || null;
  }, [lastResults]);

  /**
   * Verificar si cualquier operación está en loading
   */
  const isAnyLoading = useCallback(() => {
    return Object.values(loading).some(Boolean);
  }, [loading]);

  // ===============================================
  // CLEANUP Y LIFECYCLE
  // ===============================================

  /**
   * Cleanup manual
   */
  const cleanup = useCallback(() => {
    // Limpiar timeouts activos
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // Limpiar servicio
    methodologyService.cleanup();

    // Resetear estados
    setLoading(INITIAL_LOADING_STATE);
    setErrors(INITIAL_ERRORS_STATE);
    setLastResults({});
  }, []);

  // Cleanup automático al desmontar
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // ===============================================
  // RETURN INTERFACE
  // ===============================================

  return {
    // Estados
    loading,
    errors,
    lastResults,

    // Funciones API principales
    checkActiveTraining,
    evaluateProfile,
    generatePlan,
    activatePlan,
    startSession,

    // Funciones de utilidad
    retry,
    clearError,
    clearAllErrors,
    getLastResult,
    isAnyLoading,
    cleanup
  };
}

export default useMethodologyAPI;