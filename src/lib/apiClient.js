/**
 * 🌐 API Client - Cliente centralizado para todas las peticiones API
 * 
 * RAZONAMIENTO:
 * - Centraliza 94 fetch calls duplicados en la aplicación
 * - Manejo consistente de autenticación, errores y logging
 * - Interceptors para requests/responses
 * - Retry automático y timeout configurable
 * - Integración con sistema de logging
 */

import logger from '../utils/logger';

class ApiClient {
  constructor(baseURL = '', options = {}) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      timeout: 10000,
      retries: 2,
      retryDelay: 1000,
      ...options
    };

    // Interceptors
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  /**
   * Obtener token de autenticación
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
  }

  /**
   * Obtener headers por defecto
   */
  getDefaultHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Ejecutar interceptors de request
   */
  async executeRequestInterceptors(url, options) {
    let processedOptions = { ...options };
    
    for (const interceptor of this.requestInterceptors) {
      try {
        const result = await interceptor(url, processedOptions);
        if (result) {
          processedOptions = result;
        }
      } catch (error) {
        logger.error('Error en request interceptor', error, 'ApiClient');
      }
    }

    return processedOptions;
  }

  /**
   * Ejecutar interceptors de response
   */
  async executeResponseInterceptors(response, requestUrl) {
    let processedResponse = response;
    
    for (const interceptor of this.responseInterceptors) {
      try {
        const result = await interceptor(processedResponse, requestUrl);
        if (result) {
          processedResponse = result;
        }
      } catch (error) {
        logger.error('Error en response interceptor', error, 'ApiClient');
      }
    }

    return processedResponse;
  }

  /**
   * Ejecutar interceptors de error
   */
  async executeErrorInterceptors(error, requestUrl) {
    for (const interceptor of this.errorInterceptors) {
      try {
        const result = await interceptor(error, requestUrl);
        if (result) {
          return result; // Interceptor manejó el error
        }
      } catch (interceptorError) {
        logger.error('Error en error interceptor', interceptorError, 'ApiClient');
      }
    }
    
    throw error; // Re-lanzar si ningún interceptor manejó el error
  }

  /**
   * Petición básica con retry y timeout
   */
  async request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const requestOptions = {
      ...this.defaultOptions,
      ...options,
      headers: {
        ...this.getDefaultHeaders(),
        ...options.headers
      }
    };

    // Aplicar interceptors de request
    const processedOptions = await this.executeRequestInterceptors(fullUrl, requestOptions);

    logger.api.request(processedOptions.method || 'GET', fullUrl, processedOptions.body);

    let lastError = null;
    const maxRetries = processedOptions.retries || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Configurar timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), processedOptions.timeout);

        const fetchOptions = {
          ...processedOptions,
          signal: controller.signal
        };
        delete fetchOptions.timeout;
        delete fetchOptions.retries;
        delete fetchOptions.retryDelay;

        const response = await fetch(fullUrl, fetchOptions);
        clearTimeout(timeoutId);

        // Aplicar interceptors de response
        const processedResponse = await this.executeResponseInterceptors(response, fullUrl);

        logger.api.response(
          processedOptions.method || 'GET',
          fullUrl,
          processedResponse.status
        );

        // Manejar errores HTTP
        if (!processedResponse.ok) {
          const errorText = await processedResponse.text();
          let errorData;
          
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }

          const error = new Error(errorData.message || `HTTP ${processedResponse.status}: ${processedResponse.statusText}`);
          error.status = processedResponse.status;
          error.data = errorData;
          
          throw error;
        }

        // Parsear respuesta
        const contentType = processedResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await processedResponse.json();
        }
        
        return processedResponse;

      } catch (error) {
        lastError = error;

        // No reintentar para ciertos errores
        if (error.status === 401 || error.status === 403 || error.name === 'AbortError') {
          break;
        }

        // Si no es el último intento, esperar antes del retry
        if (attempt < maxRetries) {
          logger.warn(`Reintentando petición (${attempt + 1}/${maxRetries + 1})`, { url: fullUrl }, 'ApiClient');
          await new Promise(resolve => setTimeout(resolve, processedOptions.retryDelay * (attempt + 1)));
        }
      }
    }

    // Aplicar interceptors de error
    return await this.executeErrorInterceptors(lastError, fullUrl);
  }

  // Métodos HTTP principales
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url, data = null, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put(url, data = null, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch(url, data = null, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  // Métodos para gestionar interceptors
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor) {
    this.errorInterceptors.push(interceptor);
  }

  removeRequestInterceptor(interceptor) {
    const index = this.requestInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.requestInterceptors.splice(index, 1);
    }
  }

  removeResponseInterceptor(interceptor) {
    const index = this.responseInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.responseInterceptors.splice(index, 1);
    }
  }

  removeErrorInterceptor(interceptor) {
    const index = this.errorInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.errorInterceptors.splice(index, 1);
    }
  }
}

// Instancia principal del cliente API
const apiClient = new ApiClient('/api');

// Interceptor de error para manejo de autenticación
apiClient.addErrorInterceptor((error, url) => {
  if (error.status === 401) {
    // Token expirado o inválido
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    
    // Solo redirigir si no estamos ya en login
    if (!window.location.pathname.includes('/login')) {
      logger.warn('Token expirado, redirigiendo a login', null, 'ApiClient');
      window.location.href = '/login';
    }
  }
  
  return null; // No manejar el error, dejarlo pasar
});

// Interceptor de response para logging automático
apiClient.addResponseInterceptor((response, url) => {
  if (!response.ok) {
    logger.api.error(response.status >= 500 ? 'Server Error' : 'Client Error', url, {
      status: response.status,
      statusText: response.statusText
    });
  }
  
  return response; // No modificar la response
});

export default apiClient;
export { ApiClient };