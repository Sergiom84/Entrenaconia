/**
 * 🕐 Session Cleanup Job
 * Trabajo automático para limpiar sesiones en limbo y estados inconsistentes
 */

import { systemWideCleanup } from '../utils/sessionCleanup.js';

/**
 * Ejecuta la limpieza automática del sistema
 */
async function runCleanupJob() {
  try {
    console.log(`🕐 [${new Date().toISOString()}] Iniciando trabajo de limpieza automática...`);

    const result = await systemWideCleanup();

    console.log(`✅ [${new Date().toISOString()}] Trabajo de limpieza completado:`);
    console.log(`   - Sesiones en limbo canceladas: ${result.totalCleaned}`);
    console.log(`   - Estados inconsistentes corregidos: ${result.totalFixed}`);

    return result;
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Error en trabajo de limpieza:`, error);
    return { totalCleaned: 0, totalFixed: 0 };
  }
}

/**
 * Inicia el trabajo de limpieza periódica
 * @param {number} intervalMinutes - Intervalo en minutos (default: 60)
 */
export function startCleanupScheduler(intervalMinutes = 60) {
  console.log(`🕐 Iniciando programador de limpieza (cada ${intervalMinutes} minutos)`);

  // Ejecutar inmediatamente al iniciar
  runCleanupJob();

  // Programar ejecuciones periódicas
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervalId = setInterval(runCleanupJob, intervalMs);

  return intervalId;
}

/**
 * Detiene el programador de limpieza
 * @param {NodeJS.Timer} intervalId - ID del intervalo a detener
 */
export function stopCleanupScheduler(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('🛑 Programador de limpieza detenido');
  }
}

// Si este archivo se ejecuta directamente, ejecutar la limpieza una vez
if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanupJob().then(() => {
    console.log('🏁 Limpieza manual completada');
    process.exit(0);
  });
}