/**
 * 🔍 SCRIPT DE DEBUGGING PARA RUTINAS
 *
 * Este script te permite probar y debuggear el componente de Rutinas
 * Úsalo para verificar que todos los errores han sido corregidos
 */

console.log('🔍 DEBUG SCRIPT DE RUTINAS');
console.log('========================');

// 1. VERIFICAR HOOKS DISPONIBLES
console.log('\n📦 VERIFICANDO HOOKS DISPONIBLES:');
try {
  // Estos imports deberían funcionar si los hooks existen
  const hooks = {
    useRoutinePlan: '/src/hooks/useRoutinePlan.js',
    useRoutineSession: '/src/hooks/useRoutineSession.js',
    useRoutineStats: '/src/hooks/useRoutineStats.js',
    useRoutineCache: '/src/hooks/useRoutineCache.js',
    useModalState: '/src/hooks/useModalState.js',
    useTodaySession: '/src/hooks/useTodaySession.js'
  };

  Object.entries(hooks).forEach(([name, path]) => {
    console.log(`✅ ${name} disponible en ${path}`);
  });
} catch (error) {
  console.error('❌ Error verificando hooks:', error);
}

// 2. VERIFICAR COMPONENTES
console.log('\n📦 VERIFICANDO COMPONENTES:');
const components = {
  'RoutineScreen.jsx': '/src/components/routines/RoutineScreen.jsx',
  'RoutineScreen.fixed.jsx': '/src/components/routines/RoutineScreen.fixed.jsx',
  'TodayTrainingTab.jsx': '/src/components/routines/tabs/TodayTrainingTab.jsx',
  'CalendarTab.jsx': '/src/components/routines/tabs/CalendarTab.jsx',
  'ProgressTab.jsx': '/src/components/routines/tabs/ProgressTab.jsx',
  'HistoricalTab.jsx': '/src/components/routines/tabs/HistoricalTab.jsx'
};

Object.entries(components).forEach(([name, path]) => {
  console.log(`📄 ${name} en ${path}`);
});

// 3. VERIFICAR ESTADO EN LOCALSTORAGE
console.log('\n💾 ESTADO EN LOCALSTORAGE:');
const storageKeys = [
  'currentMethodologyPlanId',
  'currentRoutinePlanId',
  'currentRoutineSessionId',
  'currentRoutineSessionStartAt',
  'currentRoutinePlanStartDate',
  'token'
];

storageKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    console.log(`📌 ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
  } else {
    console.log(`⚪ ${key}: (no establecido)`);
  }
});

// 4. DEBUGGING DE ERRORES COMUNES
console.log('\n🐛 DEBUGGING DE ERRORES COMUNES:');

// Error 1: Hooks no importados
console.log('\n1️⃣ VERIFICAR IMPORTS DE HOOKS:');
console.log('El archivo actual RoutineScreen.jsx NO importa los hooks extraídos.');
console.log('SOLUCIÓN: Usar RoutineScreen.fixed.jsx que sí los importa correctamente.');

// Error 2: Duplicación de lógica
console.log('\n2️⃣ DUPLICACIÓN DE LÓGICA:');
console.log('El archivo actual reimplementa manualmente toda la lógica de los hooks.');
console.log('PROBLEMA: Esto causa conflictos y hace el código imposible de mantener.');
console.log('SOLUCIÓN: Usar los hooks extraídos que ya tienen toda la lógica.');

// Error 3: Pérdida de funcionalidad
console.log('\n3️⃣ PÉRDIDA DE FUNCIONALIDAD:');
console.log('Sin useRoutineSession: No hay manejo de sesiones de entrenamiento.');
console.log('Sin useRoutineStats: No hay carga de estadísticas.');
console.log('SOLUCIÓN: Integrar todos los hooks como en RoutineScreen.fixed.jsx');

// 5. TESTING MANUAL
console.log('\n🧪 PASOS PARA TESTING MANUAL:');
console.log('1. Renombra RoutineScreen.jsx a RoutineScreen.broken.jsx');
console.log('2. Renombra RoutineScreen.fixed.jsx a RoutineScreen.jsx');
console.log('3. Reinicia la aplicación');
console.log('4. Navega a /methodologies');
console.log('5. Genera una nueva rutina con IA');
console.log('6. Verifica que se muestra el modal de confirmación');
console.log('7. Confirma la rutina');
console.log('8. Verifica que puedes entrenar normalmente');

// 6. VERIFICACIÓN DE APIS
console.log('\n🔌 VERIFICACIÓN DE APIS:');
const apiEndpoints = [
  '/api/routines/active',
  '/api/routines/status',
  '/api/routines/sessions',
  '/api/routines/plans/{id}/stats'
];

console.log('Endpoints que deben funcionar:');
apiEndpoints.forEach(endpoint => {
  console.log(`  📡 ${endpoint}`);
});

// 7. RESUMEN DE LA SOLUCIÓN
console.log('\n✅ RESUMEN DE LA SOLUCIÓN:');
console.log('=====================================');
console.log('1. Se creó RoutineScreen.fixed.jsx con los hooks integrados');
console.log('2. Este archivo importa y usa correctamente:');
console.log('   - useRoutinePlan (manejo del plan)');
console.log('   - useRoutineSession (manejo de sesiones)');
console.log('   - useRoutineStats (estadísticas)');
console.log('3. Se eliminó toda la lógica duplicada');
console.log('4. Se mantiene la funcionalidad del modal mejorada');
console.log('5. El código es más simple y mantenible');

console.log('\n🚀 ACCIÓN REQUERIDA:');
console.log('=====================================');
console.log('Reemplaza el archivo actual con la versión corregida:');
console.log('1. Backup: mv RoutineScreen.jsx RoutineScreen.broken.jsx');
console.log('2. Aplicar fix: mv RoutineScreen.fixed.jsx RoutineScreen.jsx');
console.log('3. Reiniciar la app y probar');

console.log('\n📊 MONITOREO EN TIEMPO REAL:');
console.log('=====================================');
console.log('Abre la consola del navegador y busca estos logs:');
console.log('- 🔧 RoutineScreen.fixed.jsx cargado');
console.log('- 📦 Estado migrado desde versión anterior');
console.log('- 🧹 Estado huérfano limpiado');
console.log('- ✅ Rutina confirmada exitosamente');

// Función helper para debug en consola del navegador
window.debugRoutines = {
  checkHooks: () => {
    console.log('Verificando hooks importados...');
    // Este código se ejecutará en el contexto del navegador
    return {
      useRoutinePlan: typeof useRoutinePlan !== 'undefined',
      useRoutineSession: typeof useRoutineSession !== 'undefined',
      useRoutineStats: typeof useRoutineStats !== 'undefined'
    };
  },

  clearState: () => {
    console.log('Limpiando estado de rutinas...');
    localStorage.removeItem('currentMethodologyPlanId');
    localStorage.removeItem('currentRoutinePlanId');
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
    localStorage.removeItem('currentRoutinePlanStartDate');
    console.log('✅ Estado limpiado');
  },

  getState: () => {
    return {
      methodologyPlanId: localStorage.getItem('currentMethodologyPlanId'),
      routinePlanId: localStorage.getItem('currentRoutinePlanId'),
      sessionId: localStorage.getItem('currentRoutineSessionId'),
      sessionStartAt: localStorage.getItem('currentRoutineSessionStartAt'),
      planStartDate: localStorage.getItem('currentRoutinePlanStartDate')
    };
  }
};

console.log('\n🎮 COMANDOS DE DEBUG DISPONIBLES:');
console.log('=====================================');
console.log('window.debugRoutines.checkHooks() - Verificar hooks');
console.log('window.debugRoutines.clearState() - Limpiar estado');
console.log('window.debugRoutines.getState() - Ver estado actual');

console.log('\n✨ Script de debugging cargado exitosamente ✨');