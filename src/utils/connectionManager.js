/**
 * 🌐 Connection Manager - Gestión de Estado Online/Offline
 *
 * FUNCIONALIDADES:
 * - Detección automática de estado de conexión
 * - Queue de requests offline
 * - Retry automático cuando vuelve conexión
 * - Sincronización diferida
 * - Notificaciones de cambio de estado
 */

import { TIMEOUT_CONFIG, RETRY_CONFIG, STORAGE_KEYS } from '../config/authConfig';

// =============================================================================
// 🔗 GESTIÓN DE CONEXIÓN Y QUEUE OFFLINE
// =============================================================================

class ConnectionManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.offlineQueue = [];
    this.retryTimers = new Map();
    this.connectionCheckInterval = null;

    // Callbacks
    this.onConnectionChange = null;
    this.onOfflineRequestQueued = null;
    this.onQueueProcessed = null;

    // Bind methods
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.checkConnection = this.checkConnection.bind(this);
  }

  /**
   * Inicializa el connection manager
   */
  initialize() {
    try {
      // Cargar queue offline desde localStorage
      this.loadOfflineQueue();

      // Configurar listeners de conexión
      window.addEventListener('online', this.handleOnline, { passive: true });
      window.addEventListener('offline', this.handleOffline, { passive: true });

      // Verificar conexión real (no solo navigator.onLine)
      this.startConnectionCheck();

      // Si estamos online, procesar queue pendiente
      if (this.isOnline && this.offlineQueue.length > 0) {
        this.processOfflineQueue();
      }

      console.log('Connection manager initialized');
      return true;
    } catch (error) {
      console.error('Error initializing connection manager:', error);
      return false;
    }
  }

  /**
   * Carga la queue offline desde localStorage
   */
  loadOfflineQueue() {
    try {
      const savedQueue = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (savedQueue) {
        this.offlineQueue = JSON.parse(savedQueue);
        console.log(`Loaded ${this.offlineQueue.length} requests from offline queue`);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Guarda la queue offline en localStorage
   */
  saveOfflineQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  /**
   * Maneja cambio a estado online
   */
  handleOnline() {
    console.log('Connection restored');
    this.isOnline = true;

    // Procesar queue offline
    if (this.offlineQueue.length > 0) {
      this.processOfflineQueue();
    }

    // Notificar cambio
    this.notifyConnectionChange('online');

    // Emitir evento global
    window.dispatchEvent(new CustomEvent('connectionOnline'));
  }

  /**
   * Maneja cambio a estado offline
   */
  handleOffline() {
    console.log('Connection lost');
    this.isOnline = false;

    // Notificar cambio
    this.notifyConnectionChange('offline');

    // Emitir evento global
    window.dispatchEvent(new CustomEvent('connectionOffline'));
  }

  /**
   * Verifica conexión real mediante ping
   */
  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const RAW_API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '';
      const HEALTH_URL = RAW_API_URL ? `${RAW_API_URL.replace(/\/$/, '')}/api/health` : '/api/health';
      const response = await fetch(HEALTH_URL, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      const wasOnline = this.isOnline;
      this.isOnline = response.ok;

      // Si cambió el estado, notificar
      if (wasOnline !== this.isOnline) {
        if (this.isOnline) {
          this.handleOnline();
        } else {
          this.handleOffline();
        }
      }

      return this.isOnline;
    } catch (error) {
      // Si falla el ping, asumir offline
      if (this.isOnline) {
        this.handleOffline();
      }
      return false;
    }
  }

  /**
   * Inicia verificación periódica de conexión
   */
  startConnectionCheck() {
    this.stopConnectionCheck();

    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, TIMEOUT_CONFIG.CONNECTION_CHECK_INTERVAL);
  }

  /**
   * Detiene verificación de conexión
   */
  stopConnectionCheck() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  /**
   * Agrega request a la queue offline
   */
  queueRequest(url, options, metadata = {}) {
    // Verificar límite de queue
    if (this.offlineQueue.length >= TIMEOUT_CONFIG.OFFLINE_QUEUE_MAX) {
      console.warn('Offline queue is full, removing oldest request');
      this.offlineQueue.shift();
    }

    const queueItem = {
      id: Date.now() + Math.random(),
      url,
      options,
      metadata,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: RETRY_CONFIG.RETRYABLE_STATUS_CODES.includes(metadata.expectedStatus) ?
        TIMEOUT_CONFIG.RETRY_ATTEMPTS : 1
    };

    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();

    console.log(`Request queued for offline processing: ${url}`);

    // Notificar
    if (this.onOfflineRequestQueued) {
      this.onOfflineRequestQueued(queueItem);
    }

    // Emitir evento
    window.dispatchEvent(new CustomEvent('offlineRequestQueued', {
      detail: { request: queueItem, queueSize: this.offlineQueue.length }
    }));

    return queueItem.id;
  }

  /**
   * Procesa la queue offline cuando vuelve conexión
   */
  async processOfflineQueue() {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.offlineQueue.length} offline requests`);

    const results = {
      successful: 0,
      failed: 0,
      retries: 0
    };

    // Procesar requests uno por uno
    const queueCopy = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queueCopy) {
      try {
        const success = await this.retryRequest(item);
        if (success) {
          results.successful++;
        } else {
          results.failed++;
          // Re-agregar a queue si no se pudo procesar
          this.offlineQueue.push(item);
        }
      } catch (error) {
        console.error('Error processing offline request:', error);
        results.failed++;

        // Re-agregar si no ha excedido intentos
        if (item.attempts < item.maxAttempts) {
          this.offlineQueue.push(item);
        }
      }
    }

    // Guardar queue actualizada
    this.saveOfflineQueue();

    console.log('Offline queue processed:', results);

    // Notificar
    if (this.onQueueProcessed) {
      this.onQueueProcessed(results);
    }

    // Emitir evento
    window.dispatchEvent(new CustomEvent('offlineQueueProcessed', {
      detail: { results, remainingQueue: this.offlineQueue.length }
    }));
  }

  /**
   * Intenta ejecutar un request con retry logic
   */
  async retryRequest(item) {
    item.attempts++;

    try {
      console.log(`Retrying request (attempt ${item.attempts}): ${item.url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(item.url, {
        ...item.options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`Request successful: ${item.url}`);
        return true;
      } else if (RETRY_CONFIG.RETRYABLE_STATUS_CODES.includes(response.status)) {
        console.log(`Request failed with retryable status ${response.status}: ${item.url}`);

        if (item.attempts < item.maxAttempts) {
          // Programar retry con backoff exponencial
          this.scheduleRetry(item);
        }
        return false;
      } else {
        console.error(`Request failed permanently with status ${response.status}: ${item.url}`);
        return false;
      }
    } catch (error) {
      console.error(`Request error: ${item.url}`, error);

      if (RETRY_CONFIG.RETRYABLE_ERRORS.some(retryableError =>
        error.name.includes(retryableError) || error.message.includes(retryableError))) {

        if (item.attempts < item.maxAttempts) {
          this.scheduleRetry(item);
        }
      }

      return false;
    }
  }

  /**
   * Programa retry con backoff exponencial
   */
  scheduleRetry(item) {
    const delay = this.calculateRetryDelay(item.attempts);

    console.log(`Scheduling retry for ${item.url} in ${delay}ms`);

    const timerId = setTimeout(() => {
      this.retryTimers.delete(item.id);

      if (this.isOnline) {
        this.retryRequest(item);
      } else {
        // Si perdimos conexión, re-agregar a queue
        this.offlineQueue.push(item);
        this.saveOfflineQueue();
      }
    }, delay);

    this.retryTimers.set(item.id, timerId);
  }

  /**
   * Calcula delay para retry con exponential backoff
   */
  calculateRetryDelay(attempt) {
    const baseDelay = RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
    const cappedDelay = Math.min(baseDelay, RETRY_CONFIG.MAX_DELAY);

    // Agregar jitter si está habilitado
    if (RETRY_CONFIG.JITTER) {
      const jitter = cappedDelay * RETRY_CONFIG.JITTER_MAX * Math.random();
      return cappedDelay + jitter;
    }

    return cappedDelay;
  }

  /**
   * Executa request con manejo automático offline/online
   */
  async executeRequest(url, options, metadata = {}) {
    // Si estamos offline, agregar a queue y lanzar error específico
    if (!this.isOnline) {
      const queueId = this.queueRequest(url, options, metadata);
      const error = new Error(`Request queued for offline processing (Queue ID: ${queueId})`);
      error.name = 'OfflineQueuedError';
      error.queueId = queueId;
      error.isQueued = true;
      throw error;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      // Si es error de red, agregar a queue offline y lanzar error específico
      if (error.name === 'NetworkError' || error.name === 'AbortError') {
        console.log('Network error, queuing request for offline processing');
        const queueId = this.queueRequest(url, options, metadata);
        const queuedError = new Error(`Request queued for offline processing (Queue ID: ${queueId})`);
        queuedError.name = 'OfflineQueuedError';
        queuedError.queueId = queueId;
        queuedError.isQueued = true;
        queuedError.originalError = error;
        throw queuedError;
      }

      throw error;
    }
  }

  /**
   * Obtiene estado de la conexión
   */
  getConnectionState() {
    return {
      isOnline: this.isOnline,
      queueSize: this.offlineQueue.length,
      retryingRequests: this.retryTimers.size,
      navigatorOnline: navigator.onLine
    };
  }

  /**
   * Limpia la queue offline
   */
  clearOfflineQueue() {
    this.offlineQueue = [];
    this.saveOfflineQueue();

    // Cancelar retries pendientes
    this.retryTimers.forEach(timerId => clearTimeout(timerId));
    this.retryTimers.clear();

    console.log('Offline queue cleared');
  }

  /**
   * Configura callbacks
   */
  setCallbacks({ onConnectionChange, onOfflineRequestQueued, onQueueProcessed }) {
    this.onConnectionChange = onConnectionChange;
    this.onOfflineRequestQueued = onOfflineRequestQueued;
    this.onQueueProcessed = onQueueProcessed;
  }

  /**
   * Notifica cambio de conexión
   */
  notifyConnectionChange(state) {
    if (this.onConnectionChange) {
      this.onConnectionChange({
        isOnline: this.isOnline,
        state,
        queueSize: this.offlineQueue.length,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Limpia recursos
   */
  cleanup() {
    // Remover listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    // Detener verificación de conexión
    this.stopConnectionCheck();

    // Cancelar retries pendientes
    this.retryTimers.forEach(timerId => clearTimeout(timerId));
    this.retryTimers.clear();

    console.log('Connection manager cleaned up');
  }

  /**
   * Destructor
   */
  destroy() {
    this.cleanup();
  }
}

// =============================================================================
// 📤 SINGLETON INSTANCE
// =============================================================================

const connectionManager = new ConnectionManager();

export default connectionManager;
export { ConnectionManager };