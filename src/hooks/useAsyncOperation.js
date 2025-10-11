/**
 * 🔄 useAsyncOperation - Hook para operaciones asíncronas 
 * 
 * RAZONAMIENTO:
 * - Patrón repetido: loading state + error state + async operation
 * - Centraliza manejo de estados de carga, error y datos
 * - Reduce código boilerplate en componentes
 * - Mejor manejo de errores consistente
 */

import { useState, useCallback } from 'react';
import logger from '../utils/logger';

/**
 * Hook para manejar operaciones asíncronas con estados de loading, error y data
 */
export const useAsyncOperation = (initialData = null, context = 'AsyncOperation') => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Ejecutar operación asíncrona
   * @param {Function} asyncFn - Función asíncrona a ejecutar
   * @param {Object} options - Opciones adicionales
   */
  const execute = useCallback(async (asyncFn, options = {}) => {
    const { 
      loadingMessage = 'Cargando...',
      errorMessage = 'Error en la operación',
      successMessage = null,
      onSuccess = null,
      onError = null,
      resetErrorOnStart = true
    } = options;

    try {
      setLoading(true);
      
      if (resetErrorOnStart) {
        setError(null);
      }

      logger.debug(loadingMessage, null, context);
      
      const result = await asyncFn();
      
      setData(result);
      
      if (successMessage) {
        logger.info(successMessage, result, context);
      }
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
      
    } catch (err) {
      const errorMsg = err.message || errorMessage;
      setError(errorMsg);
      
      logger.error(errorMessage, err, context);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
      
    } finally {
      setLoading(false);
    }
  }, [context]);

  /**
   * Resetear estados
   */
  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  /**
   * Limpiar solo error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Actualizar datos directamente
   */
  const updateData = useCallback((newData) => {
    setData(newData);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    clearError,
    updateData,
    // Helpers para estados específicos
    isLoading: loading,
    hasError: Boolean(error),
    hasData: Boolean(data),
    isEmpty: !loading && !error && !data
  };
};

/**
 * Hook especializado para peticiones a APIs
 */
export const useApiRequest = (initialData = null, context = 'API') => {
  const asyncOp = useAsyncOperation(initialData, context);
  
  /**
   * Realizar petición GET
   */
  const get = useCallback(async (url, options = {}) => {
    return asyncOp.execute(async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, {
      loadingMessage: `Cargando datos de ${url}`,
      errorMessage: `Error cargando desde ${url}`,
      ...options
    });
  }, [asyncOp]);

  /**
   * Realizar petición POST
   */
  const post = useCallback(async (url, body = {}, options = {}) => {
    return asyncOp.execute(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          ...options.headers
        },
        body: JSON.stringify(body),
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, {
      loadingMessage: `Enviando datos a ${url}`,
      errorMessage: `Error enviando a ${url}`,
      successMessage: `Datos enviados exitosamente a ${url}`,
      ...options
    });
  }, [asyncOp]);

  /**
   * Realizar petición PUT
   */
  const put = useCallback(async (url, body = {}, options = {}) => {
    return asyncOp.execute(async () => {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          ...options.headers
        },
        body: JSON.stringify(body),
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, {
      loadingMessage: `Actualizando ${url}`,
      errorMessage: `Error actualizando ${url}`,
      successMessage: `Actualización exitosa en ${url}`,
      ...options
    });
  }, [asyncOp]);

  return {
    ...asyncOp,
    get,
    post,
    put
  };
};

/**
 * Hook para manejar formularios con validación async
 */
export const useAsyncForm = (initialValues = {}, context = 'Form') => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const asyncOp = useAsyncOperation(null, context);

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    // Limpiar error del campo cuando se cambia
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const setError = useCallback((name, error) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const submit = useCallback(async (submitFn, options = {}) => {
    clearErrors();
    
    return asyncOp.execute(async () => {
      const result = await submitFn(values);
      
      // Reset form en éxito si se especifica
      if (options.resetOnSuccess) {
        setValues(initialValues);
      }
      
      return result;
    }, options);
  }, [values, initialValues, asyncOp, clearErrors]);

  return {
    values,
    errors,
    setValue,
    setError,
    clearErrors,
    submit,
    ...asyncOp
  };
};

export default useAsyncOperation;