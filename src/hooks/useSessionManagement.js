import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const useSessionManagement = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const activityTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  // Configuración de timeouts
  const INACTIVITY_WARNING_TIME = 25 * 60 * 1000; // 25 minutos
  const INACTIVITY_LOGOUT_TIME = 30 * 60 * 1000; // 30 minutos
  const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutos

  // Función para enviar heartbeat al servidor
  const sendHeartbeat = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Sesión expirada detectada por heartbeat');
          logout();
        }
      }
    } catch (error) {
      console.error('Error enviando heartbeat:', error);
      // No hacer logout por errores de red
    }
  }, [isAuthenticated, logout]);

  // Función para mostrar advertencia de inactividad
  const showInactivityWarning = useCallback(() => {
    if (warningShownRef.current || !isAuthenticated) return;

    warningShownRef.current = true;
    
    const shouldLogout = confirm(
      '⚠️ SESIÓN INACTIVA\n\n' +
      'Tu sesión expirará en 5 minutos por inactividad.\n\n' +
      '¿Deseas continuar tu sesión?\n\n' +
      '• OK: Continuar sesión activa\n' +
      '• Cancelar: Cerrar sesión ahora'
    );

    if (shouldLogout) {
      // Usuario quiere continuar - resetear actividad
      resetActivityTimer();
      warningShownRef.current = false;
    } else {
      // Usuario quiere cerrar sesión
      logout();
    }
  }, [isAuthenticated, logout]);

  // Función para resetear el timer de actividad
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;

    // Limpiar timeouts existentes
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Configurar nuevo timeout para advertencia
    warningTimeoutRef.current = setTimeout(() => {
      showInactivityWarning();
    }, INACTIVITY_WARNING_TIME);

    // Configurar nuevo timeout para logout automático
    activityTimeoutRef.current = setTimeout(() => {
      console.warn('Logout automático por inactividad');
      logout();
    }, INACTIVITY_LOGOUT_TIME);
  }, [showInactivityWarning, logout]);

  // Función para manejar eventos de actividad
  const handleActivity = useCallback(() => {
    if (!isAuthenticated) return;
    resetActivityTimer();
  }, [isAuthenticated, resetActivityTimer]);

  // Función para manejar cambios de visibilidad
  const handleVisibilityChange = useCallback(() => {
    if (!isAuthenticated) return;

    if (document.hidden) {
      // Página se ocultó - detener heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    } else {
      // Página se mostró - reanudar heartbeat y verificar sesión
      sendHeartbeat();
      
      // Reanudar heartbeat interval
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      
      // Verificar si la inactividad fue muy larga
      const inactiveTime = Date.now() - lastActivityRef.current;
      if (inactiveTime > INACTIVITY_LOGOUT_TIME) {
        console.warn('Sesión expirada por inactividad prolongada');
        logout();
        return;
      }
      
      // Resetear timer si no expiró
      handleActivity();
    }
  }, [isAuthenticated, sendHeartbeat, handleActivity, logout]);

  // Función para manejar beforeunload
  const handleBeforeUnload = useCallback(() => {
    // No cerrar sesión automáticamente al recargar/cerrar la pestaña.
    // Si se necesita telemetría, enviar un ping ligero a un endpoint no destructivo.
    // Ejemplo (opcional): navigator.sendBeacon('/api/analytics/page-unload');
    return;
  }, []);

  // Configurar event listeners y timers
  useEffect(() => {
    if (!isAuthenticated) {
      // Limpiar todos los timers si no está autenticado
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      return;
    }

    // Eventos de actividad del usuario
    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Agregar listeners de actividad
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Listener para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listener para beforeunload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Inicializar timers
    resetActivityTimer();

    // Inicializar heartbeat
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup
    return () => {
      // Remover event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Limpiar timers
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [
    isAuthenticated,
    handleActivity,
    handleVisibilityChange,
    handleBeforeUnload,
    resetActivityTimer,
    sendHeartbeat
  ]);

  // Función para forzar logout
  const forceLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Función para extender sesión manualmente
  const extendSession = useCallback(() => {
    if (isAuthenticated) {
      resetActivityTimer();
      sendHeartbeat();
    }
  }, [isAuthenticated, resetActivityTimer, sendHeartbeat]);

  // Función para obtener tiempo restante hasta advertencia
  const getTimeUntilWarning = useCallback(() => {
    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
    return Math.max(0, INACTIVITY_WARNING_TIME - timeSinceLastActivity);
  }, []);

  return {
    forceLogout,
    extendSession,
    getTimeUntilWarning,
    sendHeartbeat
  };
};

export default useSessionManagement;