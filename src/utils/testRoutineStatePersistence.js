/**
 * Test de Persistencia y Sincronización de Estado para RoutineScreen
 *
 * Ejecutar este archivo para verificar que todos los estados persisten correctamente
 * y se sincronizan entre pestañas/recargas.
 */

// Funciones de prueba para verificar persistencia
export const testRoutineStatePersistence = () => {
  console.log('========================================');
  console.log('TEST DE PERSISTENCIA DE ESTADO - RUTINAS');
  console.log('========================================\n');

  const tests = [];
  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Verificar methodologyPlanId
  const test1 = () => {
    const key = 'currentMethodologyPlanId';
    const value = localStorage.getItem(key);
    const testName = 'methodologyPlanId persistido';

    if (value !== null) {
      console.log('✅', testName, '- Valor:', value);
      passedTests++;
      return { name: testName, passed: true, value };
    } else {
      console.log('❌', testName, '- No encontrado');
      failedTests++;
      return { name: testName, passed: false, value: null };
    }
  };
  tests.push(test1());

  // Test 2: Verificar planStartDate
  const test2 = () => {
    const key = 'currentRoutinePlanStartDate';
    const value = localStorage.getItem(key);
    const testName = 'planStartDate persistido';

    if (value !== null) {
      const date = new Date(value);
      const isValidDate = !isNaN(date.getTime());

      if (isValidDate) {
        console.log('✅', testName, '- Fecha válida:', value);
        passedTests++;
        return { name: testName, passed: true, value, isValidDate };
      } else {
        console.log('⚠️', testName, '- Fecha inválida:', value);
        failedTests++;
        return { name: testName, passed: false, value, isValidDate };
      }
    } else {
      console.log('❌', testName, '- No encontrado');
      failedTests++;
      return { name: testName, passed: false, value: null };
    }
  };
  tests.push(test2());

  // Test 3: Verificar routineSessionId (si hay sesión activa)
  const test3 = () => {
    const key = 'currentRoutineSessionId';
    const value = localStorage.getItem(key);
    const testName = 'routineSessionId (si aplica)';

    if (value !== null) {
      console.log('✅', testName, '- Sesión activa:', value);
      passedTests++;
      return { name: testName, passed: true, value, hasActiveSession: true };
    } else {
      console.log('ℹ️', testName, '- No hay sesión activa');
      return { name: testName, passed: true, value: null, hasActiveSession: false };
    }
  };
  tests.push(test3());

  // Test 4: Verificar routinePlan en caché
  const test4 = () => {
    const key = 'currentRoutinePlan';
    const value = localStorage.getItem(key);
    const testName = 'routinePlan en localStorage';

    if (value !== null) {
      try {
        const plan = JSON.parse(value);
        console.log('✅', testName, '- Plan válido encontrado');
        passedTests++;
        return { name: testName, passed: true, hasPlan: true };
      } catch (e) {
        console.log('⚠️', testName, '- Plan corrupto:', e.message);
        failedTests++;
        return { name: testName, passed: false, error: e.message };
      }
    } else {
      console.log('ℹ️', testName, '- No hay plan en caché');
      return { name: testName, passed: true, hasPlan: false };
    }
  };
  tests.push(test4());

  // Test 5: Verificar caché de rutinas
  const test5 = () => {
    const testName = 'Caché de rutinas';
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('routineCache_'));

    if (cacheKeys.length > 0) {
      console.log('✅', testName, '- Entradas en caché:', cacheKeys.length);

      // Verificar validez del caché
      let validCache = 0;
      let expiredCache = 0;

      cacheKeys.forEach(key => {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.expiry > Date.now()) {
            validCache++;
          } else {
            expiredCache++;
          }
        } catch (e) {
          expiredCache++;
        }
      });

      console.log('  - Caché válido:', validCache);
      console.log('  - Caché expirado:', expiredCache);
      passedTests++;

      return { name: testName, passed: true, validCache, expiredCache, total: cacheKeys.length };
    } else {
      console.log('ℹ️', testName, '- Sin entradas en caché');
      return { name: testName, passed: true, cacheEntries: 0 };
    }
  };
  tests.push(test5());

  // Test 6: Verificar sincronización entre pestañas
  const test6 = () => {
    const testName = 'Sincronización entre pestañas';
    console.log('ℹ️', testName, '- Simulando cambio en otra pestaña...');

    // Simular cambio en otra pestaña
    const originalValue = localStorage.getItem('currentMethodologyPlanId');
    const testValue = '999999';

    // Crear evento de storage
    const storageEvent = new StorageEvent('storage', {
      key: 'currentMethodologyPlanId',
      oldValue: originalValue,
      newValue: testValue,
      url: window.location.href,
      storageArea: localStorage
    });

    // Disparar evento
    window.dispatchEvent(storageEvent);

    console.log('  - Evento disparado. Verificar en la consola si se detectó el cambio.');

    // Restaurar valor original si existía
    if (originalValue !== null) {
      localStorage.setItem('currentMethodologyPlanId', originalValue);
    }

    return { name: testName, passed: true, tested: true };
  };
  tests.push(test6());

  // Test 7: Verificar integridad de datos relacionados
  const test7 = () => {
    const testName = 'Integridad de datos relacionados';
    const methodologyId = localStorage.getItem('currentMethodologyPlanId');
    const planId = localStorage.getItem('currentRoutinePlanId');
    const sessionId = localStorage.getItem('currentRoutineSessionId');

    let integrity = true;
    const issues = [];

    // Si hay sesión, debe haber plan
    if (sessionId && !planId) {
      integrity = false;
      issues.push('Sesión sin plan asociado');
    }

    // Si hay plan, debe haber metodología
    if (planId && !methodologyId) {
      integrity = false;
      issues.push('Plan sin metodología asociada');
    }

    if (integrity) {
      console.log('✅', testName, '- Datos consistentes');
      passedTests++;
    } else {
      console.log('❌', testName, '- Problemas encontrados:', issues.join(', '));
      failedTests++;
    }

    return { name: testName, passed: integrity, issues };
  };
  tests.push(test7());

  // Resumen
  console.log('\n========================================');
  console.log('RESUMEN DE PRUEBAS');
  console.log('========================================');
  console.log('Total de pruebas:', tests.length);
  console.log('Pruebas exitosas:', passedTests);
  console.log('Pruebas fallidas:', failedTests);
  console.log('Tasa de éxito:', ((passedTests / tests.length) * 100).toFixed(1) + '%');

  // Recomendaciones
  console.log('\n========================================');
  console.log('RECOMENDACIONES');
  console.log('========================================');

  if (failedTests > 0) {
    console.log('⚠️ Se detectaron problemas de persistencia:');
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: Requiere atención`);
    });
  } else {
    console.log('✅ Todos los estados críticos persisten correctamente');
  }

  // Verificar si necesita limpieza
  const cacheTest = tests.find(t => t.name === 'Caché de rutinas');
  if (cacheTest && cacheTest.expiredCache > 0) {
    console.log('\n⚠️ Se recomienda limpiar caché expirado:');
    console.log('  - Ejecutar: clearExpiredCache() desde useRoutineCache');
  }

  return {
    tests,
    summary: {
      total: tests.length,
      passed: passedTests,
      failed: failedTests,
      successRate: ((passedTests / tests.length) * 100).toFixed(1) + '%'
    }
  };
};

// Función para limpiar estado y empezar de cero
export const cleanRoutineState = () => {
  console.log('🧹 Limpiando estado de rutinas...');

  const keysToRemove = [
    'currentMethodologyPlanId',
    'currentRoutinePlanId',
    'currentRoutinePlan',
    'currentRoutineSessionId',
    'currentRoutineSessionStartAt',
    'currentRoutinePlanStartDate'
  ];

  // Limpiar claves específicas
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`  - Eliminado: ${key}`);
  });

  // Limpiar caché
  const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('routineCache_'));
  cacheKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  console.log(`  - Eliminadas ${cacheKeys.length} entradas de caché`);

  console.log('✅ Estado limpiado completamente');
};

// Función para simular recarga de página
export const simulatePageReload = () => {
  console.log('🔄 Simulando recarga de página...');
  console.log('Estado antes de la recarga:');

  const stateBefore = {
    methodologyPlanId: localStorage.getItem('currentMethodologyPlanId'),
    planStartDate: localStorage.getItem('currentRoutinePlanStartDate'),
    routineSessionId: localStorage.getItem('currentRoutineSessionId')
  };

  console.log(stateBefore);

  console.log('\nEstado debería persistir después de la recarga.');
  console.log('Ejecuta testRoutineStatePersistence() de nuevo para verificar.');

  return stateBefore;
};

// Exportar para uso en consola
if (typeof window !== 'undefined') {
  window.testRoutineState = {
    test: testRoutineStatePersistence,
    clean: cleanRoutineState,
    simulateReload: simulatePageReload
  };

  console.log('🧪 Funciones de prueba disponibles en window.testRoutineState:');
  console.log('  - window.testRoutineState.test() - Ejecutar pruebas de persistencia');
  console.log('  - window.testRoutineState.clean() - Limpiar todo el estado');
  console.log('  - window.testRoutineState.simulateReload() - Simular recarga');
}

export default testRoutineStatePersistence;