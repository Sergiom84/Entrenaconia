// Hook personalizado para gestionar caché de rutinas
import { useState, useEffect, useCallback } from 'react';

const CACHE_PREFIX = 'routineCache_';
const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutos

export const useRoutineCache = () => {
  const [cache, setCache] = useState({});

  // Cargar caché desde localStorage al montar
  useEffect(() => {
    const loadCache = () => {
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
      const loadedCache = {};
      
      cacheKeys.forEach(key => {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.expiry > Date.now()) {
            const actualKey = key.replace(CACHE_PREFIX, '');
            loadedCache[actualKey] = item.data;
          } else {
            // Limpiar items expirados
            localStorage.removeItem(key);
          }
        } catch (e) {
          console.warn('Error loading cache item:', key, e);
          localStorage.removeItem(key);
        }
      });
      
      setCache(loadedCache);
    };
    
    loadCache();
  }, []);

  // Obtener valor del caché
  const getCached = useCallback((key) => {
    // Primero intentar desde memoria
    if (cache[key]) {
      return cache[key];
    }
    
    // Luego intentar desde localStorage
    const storageKey = CACHE_PREFIX + key;
    try {
      const item = JSON.parse(localStorage.getItem(storageKey));
      if (item && item.expiry > Date.now()) {
        setCache(prev => ({ ...prev, [key]: item.data }));
        return item.data;
      } else if (item) {
        // Limpiar si está expirado
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn('Error reading cache:', key, e);
    }
    
    return null;
  }, [cache]);

  // Guardar en caché
  const setCached = useCallback((key, data, customExpiry = CACHE_EXPIRY) => {
    const expiry = Date.now() + customExpiry;
    const item = { data, expiry };
    
    // Guardar en memoria
    setCache(prev => ({ ...prev, [key]: data }));
    
    // Guardar en localStorage
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
      console.warn('Error saving to cache:', key, e);
      // Si falla (ej: cuota excedida), limpiar caché antiguo
      clearExpiredCache();
    }
  }, []);

  // Invalidar entrada específica del caché
  const invalidateCache = useCallback((key) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[key];
      return newCache;
    });
    localStorage.removeItem(CACHE_PREFIX + key);
  }, []);

  // Limpiar todo el caché de rutinas
  const clearCache = useCallback(() => {
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
    cacheKeys.forEach(key => localStorage.removeItem(key));
    setCache({});
  }, []);

  // Limpiar solo items expirados
  const clearExpiredCache = useCallback(() => {
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
    
    cacheKeys.forEach(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (!item || item.expiry <= Date.now()) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // Obtener o cargar con fallback a API
  const getOrLoad = useCallback(async (key, loader, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCached(key);
      if (cached) {
        console.log(`📦 Cache hit for: ${key}`);
        return cached;
      }
    }
    
    console.log(`🔄 Cache miss for: ${key}, loading from API...`);
    try {
      const data = await loader();
      if (data) {
        setCached(key, data);
      }
      return data;
    } catch (error) {
      console.error(`Error loading data for cache key ${key}:`, error);
      // Si falla la carga, intentar devolver caché expirado si existe
      const expiredCache = localStorage.getItem(CACHE_PREFIX + key);
      if (expiredCache) {
        try {
          const item = JSON.parse(expiredCache);
          console.log(`⚠️ Using expired cache for: ${key}`);
          return item.data;
        } catch (e) {
          // Nada que hacer
        }
      }
      throw error;
    }
  }, [getCached, setCached]);

  return {
    getCached,
    setCached,
    invalidateCache,
    clearCache,
    clearExpiredCache,
    getOrLoad
  };
};

// Keys predefinidos para caché consistente
export const CACHE_KEYS = {
  ACTIVE_PLAN: 'activePlan',
  METHODOLOGY_PLAN: (id) => `methodologyPlan_${id}`,
  ROUTINE_PLAN: (id) => `routinePlan_${id}`,
  SESSION_PROGRESS: (sessionId) => `sessionProgress_${sessionId}`,
  TODAY_STATUS: (methodologyId, week, day) => `todayStatus_${methodologyId}_${week}_${day}`,
  PENDING_EXERCISES: (methodologyId) => `pendingExercises_${methodologyId}`
};