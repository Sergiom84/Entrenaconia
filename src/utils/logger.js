/**
 * 🔧 Sistema de Logging Centralizado - Entrena con IA
 * 
 * RAZONAMIENTO:
 * - Niveles de log diferentes según importancia
 * - Desactivación automática en producción (performance)
 * - Formato consistente con emojis para fácil identificación
 * - Contexto adicional para debugging efectivo
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isDebugMode = import.meta.env.VITE_DEBUG_LOGS === 'true';

/**
 * Logger centralizado con diferentes niveles
 */
export const logger = {
  /**
   * ERROR: Errores críticos que siempre deben mostrarse
   * Se muestra tanto en development como production
   */
  error: (message, data = null, context = '') => {
    const prefix = context ? `[${context}] ` : '';
    console.error(`❌ ${prefix}${message}`, data || '');
  },

  /**
   * WARN: Advertencias importantes para el desarrollador
   * Solo se muestra en development
   */
  warn: (message, data = null, context = '') => {
    if (isDevelopment) {
      const prefix = context ? `[${context}] ` : '';
      console.warn(`⚠️ ${prefix}${message}`, data || '');
    }
  },

  /**
   * INFO: Información útil para seguimiento de flujo
   * Solo se muestra en development
   */
  info: (message, data = null, context = '') => {
    if (isDevelopment) {
      const prefix = context ? `[${context}] ` : '';
      console.log(`ℹ️ ${prefix}${message}`, data || '');
    }
  },

  /**
   * DEBUG: Información detallada solo cuando se necesite debugging profundo
   * Solo se muestra si VITE_DEBUG_LOGS=true está activado
   */
  debug: (message, data = null, context = '') => {
    if (isDevelopment && isDebugMode) {
      const prefix = context ? `[${context}] ` : '';
      console.log(`🔧 ${prefix}${message}`, data || '');
    }
  },

  /**
   * API: Logs específicos para peticiones API
   * Útil para debugging de comunicación frontend-backend
   */
  api: {
    request: (method, url, data = null) => {
      if (isDevelopment) {
        console.log(`🔗 API ${method.toUpperCase()}: ${url}`, data || '');
      }
    },
    response: (method, url, status, data = null) => {
      if (isDevelopment) {
        const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '🔄' : '✅';
        console.log(`${statusEmoji} API ${method.toUpperCase()} ${status}: ${url}`, data || '');
      }
    },
    error: (method, url, error) => {
      const prefix = `[API-${method.toUpperCase()}] `;
      console.error(`❌ ${prefix}${url} failed:`, error);
    }
  },

  /**
   * PERFORMANCE: Logs para medir tiempos de ejecución
   */
  performance: {
    start: (label) => {
      if (isDevelopment && isDebugMode) {
        console.time(`⏱️ [PERF] ${label}`);
      }
    },
    end: (label) => {
      if (isDevelopment && isDebugMode) {
        console.timeEnd(`⏱️ [PERF] ${label}`);
      }
    }
  },

  /**
   * STATE: Logs para cambios de estado importantes
   */
  state: {
    update: (component, state, newValue) => {
      if (isDevelopment && isDebugMode) {
        console.log(`🔄 [${component}] ${state}:`, newValue);
      }
    },
    load: (component, data) => {
      if (isDevelopment) {
        console.log(`📥 [${component}] Data loaded:`, data);
      }
    },
    save: (component, data) => {
      if (isDevelopment) {
        console.log(`📤 [${component}] Data saved:`, data);
      }
    }
  }
};

/**
 * Hook para logging de re-renders (debugging de performance)
 */
export const useRenderLogger = (componentName) => {
  if (isDevelopment && isDebugMode) {
    console.log(`🔄 Re-render: ${componentName}`);
  }
};

/**
 * Wrapper para errores de APIs con logging automático
 */
export const withApiLogging = async (apiCall, method, url) => {
  try {
    logger.api.request(method, url);
    const response = await apiCall();
    logger.api.response(method, url, response.status || 200, response.data);
    return response;
  } catch (error) {
    logger.api.error(method, url, error);
    throw error;
  }
};

/**
 * Utilidad para logging condicional basado en contexto
 */
export const createContextLogger = (context) => ({
  error: (message, data) => logger.error(message, data, context),
  warn: (message, data) => logger.warn(message, data, context),
  info: (message, data) => logger.info(message, data, context),
  debug: (message, data) => logger.debug(message, data, context)
});

export default logger;