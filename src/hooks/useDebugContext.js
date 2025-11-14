/**
 * 🔍 useDebugContext - Debug Hook para Context API
 *
 * PROPÓSITO: Integrar contextos con React DevTools para ver cambios en tiempo real
 *
 * USO:
 * const workoutState = useDebugContext(useWorkout(), 'WorkoutContext');
 * const authState = useDebugContext(useAuth(), 'AuthContext');
 */

import { useEffect, useRef } from 'react';

export const useDebugContext = (contextValue, contextName = 'Context') => {
  const prevValueRef = useRef(contextValue);

  useEffect(() => {
    const currentValue = contextValue;
    const prevValue = prevValueRef.current;

    // 🎯 Detectar qué cambió exactamente
    const getChangedKeys = (prev, curr, path = '') => {
      const changed = {};

      // Iterar sobre todas las claves del contexto actual
      Object.keys(curr).forEach((key) => {
        const fullPath = path ? `${path}.${key}` : key;
        const prevVal = prev?.[key];
        const currVal = curr[key];

        // Si el valor cambió
        if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
          changed[fullPath] = {
            before: prevVal,
            after: currVal,
          };
        }
      });

      return changed;
    };

    const changes = getChangedKeys(prevValue, currentValue);

    if (Object.keys(changes).length > 0) {
      // 📊 Log bonito en la consola
      console.group(`🔄 ${contextName} Update`);
      console.table(changes);
      console.log(`📸 Full state:`, currentValue);
      console.groupEnd();

      // 🚨 Si hay errores en el estado, alertar
      if (currentValue.error) {
        console.error(`❌ ERROR in ${contextName}:`, currentValue.error);
      }

      // ⏳ Si hay loading
      if (currentValue.loading) {
        console.info(`⏳ ${contextName} is loading...`);
      }
    }

    prevValueRef.current = currentValue;
  }, [contextValue, contextName]);

  return contextValue;
};

/**
 * 🎯 useDebugContextDetailed - Versión con tracking detallado de acciones
 *
 * USO:
 * const { state, logAction } = useDebugContextDetailed(useWorkout(), 'WorkoutContext');
 *
 * // Luego en tus acciones:
 * logAction('SET_PLAN', { planId: 123, type: 'calistenia' });
 */

export const useDebugContextDetailed = (contextValue, contextName = 'Context') => {
  const actionLogRef = useRef([]);
  const stateHistoryRef = useRef([]);

  useDebugContext(contextValue, contextName);

  const logAction = (actionType, payload = {}, result = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const actionLog = {
      timestamp,
      type: actionType,
      payload,
      result,
      stateAfter: contextValue,
    };

    actionLogRef.current.push(actionLog);

    // Mantener solo los últimos 50 logs
    if (actionLogRef.current.length > 50) {
      actionLogRef.current.shift();
    }

    console.group(`🎬 ${contextName} Action: ${actionType}`);
    console.log('📤 Payload:', payload);
    if (result) console.log('📥 Result:', result);
    console.log('📊 State After:', contextValue);
    console.groupEnd();
  };

  const getActionHistory = () => actionLogRef.current;
  const clearActionHistory = () => {
    actionLogRef.current = [];
    console.log(`✨ Action history cleared for ${contextName}`);
  };

  // 🌐 Exponer en ventana global para acceso desde consola
  useEffect(() => {
    window[`debug_${contextName}`] = {
      getHistory: getActionHistory,
      clearHistory: clearActionHistory,
      currentState: contextValue,
    };

    return () => {
      delete window[`debug_${contextName}`];
    };
  }, [contextValue, contextName]);

  return {
    state: contextValue,
    logAction,
    getHistory: getActionHistory,
    clearHistory: clearActionHistory,
  };
};
