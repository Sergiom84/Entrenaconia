// Utilidades para validar y mantener consistencia del estado

/**
 * Valida que todos los IDs críticos estén presentes y sincronizados
 */
export const validateRoutineState = () => {
  const errors = [];
  const warnings = [];
  
  // Verificar methodologyPlanId
  const methodologyPlanId = localStorage.getItem('currentMethodologyPlanId');
  if (!methodologyPlanId) {
    warnings.push('No hay methodologyPlanId en localStorage');
  } else if (isNaN(Number(methodologyPlanId))) {
    errors.push(`methodologyPlanId inválido: ${methodologyPlanId}`);
  }
  
  // Verificar planStartDate
  const planStartDate = localStorage.getItem('currentRoutinePlanStartDate');
  if (planStartDate) {
    const date = new Date(planStartDate);
    if (isNaN(date.getTime())) {
      errors.push(`planStartDate inválida: ${planStartDate}`);
    }
    // Verificar que no sea una fecha futura
    if (date > new Date()) {
      warnings.push('planStartDate está en el futuro');
    }
  }
  
  // Verificar sesión activa
  const sessionId = localStorage.getItem('currentRoutineSessionId');
  const sessionStart = localStorage.getItem('currentRoutineSessionStartAt');
  
  if (sessionId && !sessionStart) {
    warnings.push('Hay sessionId pero no sessionStartAt');
  }
  
  if (sessionStart) {
    const startMs = Number(sessionStart);
    if (isNaN(startMs)) {
      errors.push(`sessionStartAt inválido: ${sessionStart}`);
    } else {
      // Verificar que la sesión no sea muy antigua (más de 24 horas)
      const hoursSinceStart = (Date.now() - startMs) / (1000 * 60 * 60);
      if (hoursSinceStart > 24) {
        warnings.push(`Sesión muy antigua: ${Math.round(hoursSinceStart)} horas`);
      }
    }
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
};

/**
 * Limpia estados huérfanos o corruptos
 */
export const cleanOrphanedState = () => {
  const validation = validateRoutineState();
  let cleaned = false;
  
  // Si hay errores críticos, limpiar todo
  if (validation.errors.length > 0) {
    console.warn('🧹 Limpiando estado corrupto:', validation.errors);
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
    cleaned = true;
  }
  
  // Limpiar sesiones muy antiguas
  const sessionStart = localStorage.getItem('currentRoutineSessionStartAt');
  if (sessionStart) {
    const hoursSinceStart = (Date.now() - Number(sessionStart)) / (1000 * 60 * 60);
    if (hoursSinceStart > 24) {
      console.warn('🧹 Limpiando sesión antigua');
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
      cleaned = true;
    }
  }
  
  return cleaned;
};

/**
 * Sincroniza el estado entre diferentes pestañas del navegador
 */
export const setupStateSyncListener = (callback) => {
  const handleStorageChange = (e) => {
    // Solo reaccionar a cambios relevantes
    const relevantKeys = [
      'currentMethodologyPlanId',
      'currentRoutinePlanStartDate',
      'currentRoutineSessionId',
      'currentRoutineSessionStartAt'
    ];
    
    if (relevantKeys.includes(e.key)) {
      console.log(`📡 Estado sincronizado desde otra pestaña: ${e.key}`);
      callback({
        key: e.key,
        oldValue: e.oldValue,
        newValue: e.newValue
      });
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  
  // Retornar función de limpieza
  return () => {
    window.removeEventListener('storage', handleStorageChange);
  };
};

/**
 * Snapshot del estado actual para debugging
 */
export const getStateSnapshot = () => {
  return {
    timestamp: new Date().toISOString(),
    auth: {
      token: !!localStorage.getItem('token'),
      user: !!localStorage.getItem('user')
    },
    routine: {
      methodologyPlanId: localStorage.getItem('currentMethodologyPlanId'),
      planStartDate: localStorage.getItem('currentRoutinePlanStartDate'),
      sessionId: localStorage.getItem('currentRoutineSessionId'),
      sessionStartAt: localStorage.getItem('currentRoutineSessionStartAt')
    },
    cache: {
      keys: Object.keys(localStorage).filter(k => k.startsWith('routineCache_')).length
    },
    validation: validateRoutineState()
  };
};

/**
 * Migración de datos antiguos si existen
 */
export const migrateOldState = () => {
  let migrated = false;
  
  // Migrar lastMethodologyPlanId si existe y no hay currentMethodologyPlanId
  const lastId = localStorage.getItem('lastMethodologyPlanId');
  const currentId = localStorage.getItem('currentMethodologyPlanId');
  
  if (lastId && !currentId) {
    console.log('📦 Migrando lastMethodologyPlanId a currentMethodologyPlanId');
    localStorage.setItem('currentMethodologyPlanId', lastId);
    localStorage.removeItem('lastMethodologyPlanId');
    migrated = true;
  }
  
  return migrated;
};