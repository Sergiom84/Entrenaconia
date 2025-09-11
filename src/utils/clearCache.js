// Utility para limpiar todo el caché de la aplicación

export function clearApplicationCache() {
  console.log('🧹 Limpiando caché de la aplicación...');
  
  // Limpiar localStorage
  const localStorageKeys = Object.keys(localStorage);
  console.log('📦 Limpiando localStorage keys:', localStorageKeys);
  localStorage.clear();
  
  // Limpiar sessionStorage
  const sessionStorageKeys = Object.keys(sessionStorage);
  console.log('📦 Limpiando sessionStorage keys:', sessionStorageKeys);
  sessionStorage.clear();
  
  // Limpiar caché de service workers si existen
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
    });
  }
  
  // Forzar reload
  console.log('🔄 Recargando aplicación...');
  window.location.reload(true);
}

// Función para limpiar solo caché específico de rutinas
export function clearRoutineCache() {
  console.log('🧹 Limpiando caché de rutinas...');
  
  const keysToRemove = [
    'currentRoutinePlanStartDate',
    'currentMethodologyPlanId',
    'userProfile',
    'activeRoutineSession'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`❌ Removed: ${key}`);
  });
}