import { readFile } from "fs/promises";
import path from "path";

export const FeatureKey = {
  PHOTO: "photo",
  VIDEO: "video", 
  HOME: "home",
  METHODOLOGIE: "methodologie",
  NUTRITION: "nutrition",
  CALISTENIA_SPECIALIST: "calistenia_specialist"
};

const FILE_BY_FEATURE = {
  [FeatureKey.VIDEO]: "correction_video_ia.md",
  [FeatureKey.PHOTO]: "correction_photo_ia.md",
  [FeatureKey.HOME]: "home_training.md",
  [FeatureKey.METHODOLOGIE]: "Methodologie_(Auto).md",
  [FeatureKey.NUTRITION]: "Nutrition_AI.md",
  [FeatureKey.CALISTENIA_SPECIALIST]: "calistenia.md"
};

const cache = new Map();

// =============================================================================
// 📊 MÉTRICAS Y MONITOREO - Low-Risk Performance Tracking
// =============================================================================

const promptMetrics = {
  hits: new Map(),           // Cache hits por feature
  misses: new Map(),         // Cache misses por feature
  errors: new Map(),         // Errores por feature
  loadTimes: new Map(),      // Tiempo de carga por feature
  lastAccess: new Map(),     // Último acceso por feature
  totalRequests: 0,          // Total de requests
  startTime: Date.now()      // Tiempo de inicio del sistema
};

/**
 * Registra métricas de uso de prompts
 * @param {string} feature - Feature específico
 * @param {boolean} isHit - Si fue cache hit o miss
 * @param {number} loadTime - Tiempo de carga en ms (0 para hits)
 */
function trackPromptUsage(feature, isHit, loadTime = 0) {
  promptMetrics.totalRequests++;

  if (isHit) {
    promptMetrics.hits.set(feature, (promptMetrics.hits.get(feature) || 0) + 1);
  } else {
    promptMetrics.misses.set(feature, (promptMetrics.misses.get(feature) || 0) + 1);
    if (loadTime > 0) {
      promptMetrics.loadTimes.set(feature, loadTime);
    }
  }

  promptMetrics.lastAccess.set(feature, Date.now());
}

/**
 * Registra errores de prompts
 * @param {string} feature - Feature específico
 * @param {string} errorType - Tipo de error
 */
function trackPromptError(feature, errorType) {
  const key = `${feature}:${errorType}`;
  promptMetrics.errors.set(key, (promptMetrics.errors.get(key) || 0) + 1);
}

/**
 * Validación básica de contenido de prompts
 * @param {string} content - Contenido del prompt
 * @param {string} feature - Feature específico
 * @returns {Object} Resultado de validación
 */
function validatePromptContent(content, feature) {
  const validation = {
    isValid: true,
    warnings: [],
    metrics: {
      length: content.length,
      lines: content.split('\n').length,
      words: content.split(/\s+/).length
    }
  };

  // Validaciones básicas de integridad
  if (content.length < 50) {
    validation.warnings.push('Prompt muy corto (< 50 caracteres)');
  }

  if (content.length > 100000) {
    validation.warnings.push('Prompt muy largo (> 100k caracteres)');
  }

  // Validación específica existente
  const preview = content.substring(0, 100).toLowerCase();
  if (preview.includes('entrenamiento en casa') && feature !== 'home') {
    validation.warnings.push(`Contiene "entrenamiento en casa" en feature ${feature}`);
  }

  // Validaciones de formato
  if (!content.includes('#') && content.length > 500) {
    validation.warnings.push('Prompt largo sin estructura markdown');
  }

  return validation;
}

/**
 * Limpia el cache de prompts
 * @param {string} feature - Feature específico a limpiar, o undefined para limpiar todo
 */
export function clearPromptCache(feature = undefined) {
  if (feature) {
    cache.delete(feature);
    console.log(`🧹 Cache limpiado para feature: ${feature}`);
  } else {
    cache.clear();
    console.log(`🧹 Cache de prompts completamente limpiado`);
  }
}

/**
 * Obtiene el prompt de un feature específico desde archivos markdown
 * Los prompts se cachean en memoria para mejorar el rendimiento
 * @param {string} feature - Clave del feature ("photo", "video", "home")
 * @returns {Promise<string>} Contenido del prompt
 */
export async function getPrompt(feature) {
  const startTime = Date.now();

  if (cache.has(feature)) {
    const hitCount = (promptMetrics.hits.get(feature) || 0) + 1;
    trackPromptUsage(feature, true, 0);

    console.log(`📋 Cache HIT para ${feature} (hit #${hitCount})`);
    const cachedContent = cache.get(feature);

    // Debug: Verificar contenido del cache (mantenido para compatibilidad)
    const preview = cachedContent.substring(0, 100).toLowerCase();
    if (preview.includes('entrenamiento en casa')) {
      console.warn(`⚠️ DETECTADO "entrenamiento en casa" en cache para feature ${feature}!`);
      console.log(`Cache preview: ${preview}...`);
    }

    return cachedContent;
  }

  const fileName = FILE_BY_FEATURE[feature];
  if (!fileName) {
    throw new Error(`Feature '${feature}' no encontrado. Features disponibles: ${Object.keys(FILE_BY_FEATURE).join(', ')}`);
  }

  try {
    // Como server.js está en backend/, la ruta debe ser relativa desde ahí
    const fullPath = path.join(process.cwd(), "prompts", fileName);
    console.log(`📁 Leyendo prompt desde: ${fullPath}`);

    const content = await readFile(fullPath, "utf8");

    if (!content.trim()) {
      trackPromptError(feature, 'empty_file');
      throw new Error(`El archivo de prompt ${fileName} está vacío`);
    }

    // Validación mejorada de contenido
    const validation = validatePromptContent(content, feature);

    if (validation.warnings.length > 0) {
      console.warn(`⚠️ Validación de prompt ${feature}:`, validation.warnings);
    }

    // Debug: Verificar contenido del archivo (mantenido para compatibilidad)
    const preview = content.substring(0, 100).toLowerCase();
    if (preview.includes('entrenamiento en casa')) {
      console.warn(`⚠️ DETECTADO "entrenamiento en casa" en archivo para feature ${feature}!`);
      console.log(`Archivo: ${fileName}`);
      console.log(`Preview: ${preview}...`);
    } else {
      console.log(`✅ Prompt correcto para ${feature} - NO contiene "entrenamiento en casa"`);
    }

    const loadTime = Date.now() - startTime;
    trackPromptUsage(feature, false, loadTime);

    cache.set(feature, content);
    console.log(`✅ Prompt cargado y cacheado para ${feature} (${content.length} chars, ${loadTime}ms)`);
    console.log(`📊 Métricas: ${validation.metrics.lines} líneas, ${validation.metrics.words} palabras`);

    return content;
  } catch (error) {
    trackPromptError(feature, 'read_error');
    console.error(`❌ Error leyendo prompt para feature '${feature}':`, error.message);
    throw new Error(`No se pudo cargar el prompt para '${feature}': ${error.message}`);
  }
}


/**
 * Obtiene el estado actual de la caché con métricas avanzadas
 * @returns {Object} Estado de la caché con información de debug y métricas
 */
export function getCacheStatus() {
  const uptime = Date.now() - promptMetrics.startTime;

  const status = {
    size: cache.size,
    cachedFeatures: Array.from(cache.keys()),
    availableFeatures: Object.keys(FILE_BY_FEATURE),
    metrics: {
      totalRequests: promptMetrics.totalRequests,
      cacheHitRate: calculateHitRate(),
      uptime: formatUptime(uptime),
      features: generateFeatureStats()
    }
  };

  console.log(`📊 Enhanced Cache Status:`, status);
  return status;
}

/**
 * Calcula la tasa de acierto del cache
 * @returns {number} Porcentaje de cache hits
 */
function calculateHitRate() {
  const totalHits = Array.from(promptMetrics.hits.values()).reduce((a, b) => a + b, 0);
  const totalMisses = Array.from(promptMetrics.misses.values()).reduce((a, b) => a + b, 0);
  const total = totalHits + totalMisses;

  return total > 0 ? Math.round((totalHits / total) * 100) : 0;
}

/**
 * Formatea tiempo de uptime
 * @param {number} uptime - Tiempo en ms
 * @returns {string} Tiempo formateado
 */
function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Genera estadísticas por feature
 * @returns {Object} Stats por feature
 */
function generateFeatureStats() {
  const stats = {};

  Object.keys(FILE_BY_FEATURE).forEach(feature => {
    stats[feature] = {
      hits: promptMetrics.hits.get(feature) || 0,
      misses: promptMetrics.misses.get(feature) || 0,
      errors: Array.from(promptMetrics.errors.keys())
        .filter(key => key.startsWith(feature))
        .reduce((sum, key) => sum + promptMetrics.errors.get(key), 0),
      lastAccess: promptMetrics.lastAccess.get(feature) || null,
      loadTime: promptMetrics.loadTimes.get(feature) || null,
      isCached: cache.has(feature)
    };
  });

  return stats;
}

/**
 * Obtiene métricas detalladas del sistema
 * @returns {Object} Métricas completas
 */
export function getDetailedMetrics() {
  return {
    cache: {
      size: cache.size,
      hitRate: calculateHitRate(),
      uptime: formatUptime(Date.now() - promptMetrics.startTime)
    },
    requests: {
      total: promptMetrics.totalRequests,
      hits: Array.from(promptMetrics.hits.values()).reduce((a, b) => a + b, 0),
      misses: Array.from(promptMetrics.misses.values()).reduce((a, b) => a + b, 0),
      errors: Array.from(promptMetrics.errors.values()).reduce((a, b) => a + b, 0)
    },
    features: generateFeatureStats()
  };
}

/**
 * Precarga todos los prompts en la caché (útil al iniciar el servidor)
 * @returns {Promise<void>}
 */
export async function preloadAllPrompts() {
  console.log(`🚀 Precargando todos los prompts...`);
  const features = Object.keys(FILE_BY_FEATURE);
  
  const results = await Promise.allSettled(
    features.map(async (feature) => {
      try {
        await getPrompt(feature);
        return { feature, status: 'success' };
      } catch (error) {
        console.error(`❌ Error precargando prompt '${feature}':`, error.message);
        return { feature, status: 'error', error: error.message };
      }
    })
  );

  const successful = results.filter(r => r.value?.status === 'success').length;
  const failed = results.filter(r => r.value?.status === 'error').length;

  console.log(`✅ Precarga completada: ${successful} exitosos, ${failed} fallidos`);
  
  if (failed > 0) {
    const failedFeatures = results
      .filter(r => r.value?.status === 'error')
      .map(r => r.value.feature);
    console.warn(`⚠️ Features fallidos: ${failedFeatures.join(', ')}`);
  }

  return { successful, failed, total: features.length };
}
