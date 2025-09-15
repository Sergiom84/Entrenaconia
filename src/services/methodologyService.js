/**
 * Methodology Service - API Layer con Manejo Robusto
 * Centraliza todas las llamadas API relacionadas con metodologías
 * Incluye retry logic, timeouts, manejo de errores y validación
 *
 * @author Claude Code - Modernización Técnica
 * @version 1.0.0 - Service Layer Robusto
 */

// ===============================================
// CONFIGURACIÓN DE SERVICIO
// ===============================================

const SERVICE_CONFIG = {
  // Configuración de reintentos
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    BACKOFF_MULTIPLIER: 2,
    MAX_DELAY: 10000
  },

  // Timeouts por tipo de operación
  TIMEOUTS: {
    QUICK_CHECK: 5000,      // Para verificaciones rápidas
    EVALUATION: 15000,      // Para evaluación de perfil
    GENERATION: 30000,      // Para generación de planes (IA tarda)
    SESSION_START: 10000    // Para iniciar sesiones
  },

  // Códigos de respuesta HTTP
  HTTP_STATUS: {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },

  // Headers por defecto
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// ===============================================
// UTILIDADES HELPER
// ===============================================

/**
 * Crear delay para retry con backoff exponencial
 */
const createDelay = (attempt, baseDelay = SERVICE_CONFIG.RETRY.INITIAL_DELAY) => {
  const delay = Math.min(
    baseDelay * Math.pow(SERVICE_CONFIG.RETRY.BACKOFF_MULTIPLIER, attempt),
    SERVICE_CONFIG.RETRY.MAX_DELAY
  );
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Verificar si el error es retryable
 */
const isRetryableError = (error) => {
  if (!error.status) return true; // Errores de red

  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.status);
};

/**
 * Crear instancia de AbortController con timeout
 */
const createAbortController = (timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Limpiar timeout si se completa antes
  const originalAbort = controller.abort.bind(controller);
  controller.abort = () => {
    clearTimeout(timeoutId);
    originalAbort();
  };

  return controller;
};

/**
 * Validar estructura de respuesta
 */
const validateResponse = (response, schema) => {
  const errors = [];

  for (const [field, config] of Object.entries(schema)) {
    const { required = false, type = 'any', validator = null } =
      typeof config === 'string' ? { type: config } : config;

    // Verificar campo requerido
    if (required && !(field in response)) {
      errors.push(`Campo requerido faltante: ${field}`);
      continue;
    }

    // Verificar tipo si existe el campo
    if (field in response && type !== 'any') {
      const actualType = typeof response[field];
      if (actualType !== type) {
        errors.push(`Tipo inválido para ${field}: esperado ${type}, recibido ${actualType}`);
      }
    }

    // Validador personalizado
    if (field in response && validator) {
      const validationResult = validator(response[field]);
      if (validationResult !== true) {
        errors.push(`Validación fallida para ${field}: ${validationResult}`);
      }
    }
  }

  return errors;
};

// ===============================================
// CLASE PRINCIPAL DEL SERVICIO
// ===============================================

class MethodologyService {
  constructor() {
    this.baseURL = '/api';
    this.activeRequests = new Map(); // Para deduplicación
  }

  /**
   * Realizar request HTTP con retry y timeout
   */
  async makeRequest(endpoint, options = {}, config = {}) {
    const {
      timeout = SERVICE_CONFIG.TIMEOUTS.GENERATION,
      retries = SERVICE_CONFIG.RETRY.MAX_ATTEMPTS,
      validateSchema = null,
      deduplicationKey = null
    } = config;

    // Deduplicación de requests
    if (deduplicationKey && this.activeRequests.has(deduplicationKey)) {
      console.log(`🔄 Request duplicado detectado: ${deduplicationKey}`);
      return this.activeRequests.get(deduplicationKey);
    }

    const controller = createAbortController(timeout);
    const url = `${this.baseURL}${endpoint}`;

    // Configurar headers
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const headers = {
      ...SERVICE_CONFIG.HEADERS,
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    const requestConfig = {
      ...options,
      headers,
      signal: controller.signal
    };

    let lastError = null;
    let attempt = 0;

    const requestPromise = async () => {
      while (attempt < retries) {
        try {
          console.log(`📡 Request attempt ${attempt + 1}/${retries}: ${options.method || 'GET'} ${endpoint}`);

          const response = await fetch(url, requestConfig);

          // Parsear JSON si es posible
          let data;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              data = await response.json();
            } catch (jsonError) {
              throw new Error(`Respuesta JSON inválida: ${jsonError.message}`);
            }
          } else {
            data = await response.text();
          }

          // Verificar estado HTTP
          if (!response.ok) {
            const error = new Error(data?.message || `HTTP ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
          }

          // Validar esquema si se proporciona
          if (validateSchema && typeof data === 'object') {
            const validationErrors = validateResponse(data, validateSchema);
            if (validationErrors.length > 0) {
              throw new Error(`Validación fallida: ${validationErrors.join(', ')}`);
            }
          }

          console.log(`✅ Request exitoso: ${endpoint}`);
          return { success: true, data, response };

        } catch (error) {
          lastError = error;
          attempt++;

          // Si es el último intento o no es retryable, fallar
          if (attempt >= retries || !isRetryableError(error)) {
            break;
          }

          // Delay antes del siguiente intento
          console.warn(`⚠️ Intento ${attempt}/${retries} fallido: ${error.message}. Reintentando...`);
          await createDelay(attempt - 1);
        }
      }

      // Si llegamos aquí, todos los intentos fallaron
      console.error(`❌ Request fallido después de ${attempt} intentos: ${endpoint}`, lastError);

      return {
        success: false,
        error: this.categorizeError(lastError),
        message: lastError.message,
        retryable: isRetryableError(lastError),
        attempts: attempt
      };
    };

    // Agregar a mapa de requests activos
    if (deduplicationKey) {
      this.activeRequests.set(deduplicationKey, requestPromise());

      // Limpiar después de completar
      requestPromise().finally(() => {
        this.activeRequests.delete(deduplicationKey);
      });
    }

    return deduplicationKey ? this.activeRequests.get(deduplicationKey) : requestPromise();
  }

  /**
   * Categorizar errores para mejor handling
   */
  categorizeError(error) {
    if (error.name === 'AbortError') return 'timeout';
    if (!error.status) return 'network';

    const { HTTP_STATUS } = SERVICE_CONFIG;

    switch (error.status) {
      case HTTP_STATUS.UNAUTHORIZED:
        return 'authentication';
      case HTTP_STATUS.FORBIDDEN:
        return 'authorization';
      case HTTP_STATUS.NOT_FOUND:
        return 'not_found';
      case HTTP_STATUS.VALIDATION_ERROR:
        return 'validation';
      case HTTP_STATUS.SERVER_ERROR:
        return 'server';
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return 'service_unavailable';
      default:
        return 'unknown';
    }
  }

  // ===============================================
  // MÉTODOS DE API ESPECÍFICOS
  // ===============================================

  /**
   * Verificar entrenamiento activo
   */
  async checkActiveTraining() {
    return this.makeRequest('/routines/active-plan', {
      method: 'GET'
    }, {
      timeout: SERVICE_CONFIG.TIMEOUTS.QUICK_CHECK,
      retries: 2,
      deduplicationKey: 'check_active_training',
      validateSchema: {
        hasActivePlan: { type: 'boolean', required: true }
      }
    });
  }

  /**
   * Evaluar perfil de usuario con IA
   */
  async evaluateProfile(profileData) {
    return this.makeRequest('/calistenia-specialist/evaluate-profile', {
      method: 'POST',
      body: JSON.stringify(profileData)
    }, {
      timeout: SERVICE_CONFIG.TIMEOUTS.EVALUATION,
      validateSchema: {
        success: { type: 'boolean', required: true },
        evaluation: { type: 'object', required: true }
      }
    });
  }

  /**
   * Generar plan con IA
   */
  async generatePlan(planRequest, options = {}) {
    const { includeFeedback = false, previousPlan = null } = options;

    const payload = {
      ...planRequest,
      ...(includeFeedback && previousPlan && {
        previousPlan,
        regeneration: true
      })
    };

    return this.makeRequest('/calistenia-specialist/generate-plan', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, {
      timeout: SERVICE_CONFIG.TIMEOUTS.GENERATION,
      validateSchema: {
        success: { type: 'boolean', required: true },
        plan: { type: 'object', required: true },
        methodologyPlanId: { type: 'number', required: true }
      }
    });
  }

  /**
   * Confirmar y activar plan
   */
  async confirmAndActivatePlan(planId, planData) {
    return this.makeRequest('/routines/confirm-and-activate', {
      method: 'POST',
      body: JSON.stringify({
        methodology_plan_id: planId,
        plan_data: planData
      })
    }, {
      timeout: SERVICE_CONFIG.TIMEOUTS.SESSION_START,
      validateSchema: {
        routinePlanId: { type: 'number', required: true }
      }
    });
  }

  /**
   * Iniciar sesión de entrenamiento
   */
  async startTrainingSession(sessionData) {
    return this.makeRequest('/routines/sessions/start', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    }, {
      timeout: SERVICE_CONFIG.TIMEOUTS.SESSION_START,
      validateSchema: {
        sessionId: { type: 'number', required: true },
        session: { type: 'object', required: true }
      }
    });
  }

  /**
   * Limpiar requests activos (para cleanup)
   */
  cleanup() {
    this.activeRequests.clear();
  }
}

// ===============================================
// INSTANCIA SINGLETON
// ===============================================

const methodologyService = new MethodologyService();

export default methodologyService;

// ===============================================
// EXPORTS ADICIONALES
// ===============================================

export {
  SERVICE_CONFIG,
  MethodologyService
};