import { readFile } from "fs/promises";
import path from "path";

export const FeatureKey = {
  PHOTO: "photo",
  VIDEO: "video", 
  HOME: "home",
  METHODOLOGIE: "methodologie",
  NUTRITION: "nutrition"
};

const FILE_BY_FEATURE = {
  [FeatureKey.VIDEO]: "correction_video_ia.md",
  [FeatureKey.PHOTO]: "correction_photo_ia.md",
  [FeatureKey.HOME]: "home_training.md",
  [FeatureKey.METHODOLOGIE]: "Methodologie_(Auto).md",
  [FeatureKey.NUTRITION]: "Nutrition_AI.md"
};

const cache = new Map();

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
  if (cache.has(feature)) {
    console.log(`📋 Prompt cache HIT para feature: ${feature}`);
    const cachedContent = cache.get(feature);
    // Debug: Verificar contenido del cache
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
      throw new Error(`El archivo de prompt ${fileName} está vacío`);
    }

    // Debug: Verificar contenido del archivo
    const preview = content.substring(0, 100).toLowerCase();
    if (preview.includes('entrenamiento en casa')) {
      console.warn(`⚠️ DETECTADO "entrenamiento en casa" en archivo para feature ${feature}!`);
      console.log(`Archivo: ${fileName}`);
      console.log(`Preview: ${preview}...`);
    } else {
      console.log(`✅ Prompt correcto para ${feature} - NO contiene "entrenamiento en casa"`);
    }

    cache.set(feature, content);
    console.log(`✅ Prompt cargado y cacheado para feature: ${feature} (${content.length} caracteres)`);
    
    return content;
  } catch (error) {
    console.error(`❌ Error leyendo prompt para feature '${feature}':`, error.message);
    throw new Error(`No se pudo cargar el prompt para '${feature}': ${error.message}`);
  }
}


/**
 * Obtiene el estado actual de la caché
 * @returns {Object} Estado de la caché con información de debug
 */
export function getCacheStatus() {
  const status = {
    size: cache.size,
    cachedFeatures: Array.from(cache.keys()),
    availableFeatures: Object.keys(FILE_BY_FEATURE)
  };
  
  console.log(`📊 Cache Status:`, status);
  return status;
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
