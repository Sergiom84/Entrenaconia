import OpenAI from 'openai';
import dotenv from 'dotenv';

// Solo cargar dotenv en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const clients = {};

// Mapeo de features a variables de entorno (ACTUALIZADO: API Key Unificada 2025-01-09)
const ENV_BY_FEATURE = {
  photo: "OPENAI_API_KEY",
  video: "OPENAI_API_KEY", 
  home: "OPENAI_API_KEY",
  methodologie: "OPENAI_API_KEY",
  nutrition: "OPENAI_API_KEY",
};

/**
 * Obtiene (y cachea) un cliente OpenAI por apiKey.
 * @param {string} [apiKey]
 * @returns {OpenAI|null}
 */
export function getOpenAI(apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '') {
    console.warn('⚠️ OPENAI_API_KEY no está configurada; funciones de IA desactivadas.');
    return null;
  }
  if (clients[key]) return clients[key];
  clients[key] = new OpenAI({ apiKey: key });
  return clients[key];
}

/**
 * Obtiene cliente OpenAI específico por feature
 * NOTA: Todas las features ahora usan la misma OPENAI_API_KEY unificada (2025-01-09)
 * @param {"photo"|"video"|"home"|"methodologie"|"nutrition"} feature - Feature específico
 * @returns {OpenAI} Cliente OpenAI configurado
 */
export function getOpenAIClient(feature) {
  const envKey = ENV_BY_FEATURE[feature];
  if (!envKey) {
    throw new Error(`Feature '${feature}' no reconocido. Features disponibles: ${Object.keys(ENV_BY_FEATURE).join(', ')}`);
  }

  const key = process.env[envKey];
  if (!key || key.trim() === '') {
    throw new Error(`Falta ${envKey} en variables de entorno`);
  }

  // Usar caché para evitar crear múltiples instancias
  if (clients[key]) {
    console.log(`🔄 Cliente OpenAI reutilizado para feature: ${feature}`);
    return clients[key];
  }

  console.log(`🆕 Creando cliente OpenAI para feature: ${feature} (${envKey})`);
  clients[key] = new OpenAI({ apiKey: key });
  return clients[key];
}

/**
 * Devuelve cliente OpenAI para un módulo definido en config/aiConfigs.
 * Lee su propia variable de entorno (envKey). Si no existe, fallback a OPENAI_API_KEY.
 * @param {object} moduleConfig { envKey }
 */
export function getModuleOpenAI(moduleConfig) {
  if (!moduleConfig) return getOpenAI();
  const { envKey } = moduleConfig;
  const specificKey = envKey ? process.env[envKey] : undefined;
  return getOpenAI(specificKey);
}

export function hasAPIKeyForModule(moduleConfig) {
  if (!moduleConfig) return !!process.env.OPENAI_API_KEY;
  const specificKey = process.env[moduleConfig.envKey];
  return !!(specificKey || process.env.OPENAI_API_KEY);
}

/**
 * Verifica que la API key unificada esté configurada
 * ACTUALIZADO: Una sola API key para todos los módulos (2025-01-09)
 * @returns {Object} Estado de configuración de API key unificada
 */
export function validateAPIKeys() {
  const key = process.env.OPENAI_API_KEY;
  const isConfigured = !!(key && key.trim());
  
  const status = {};
  const allFeatures = Object.keys(ENV_BY_FEATURE);
  
  // Todas las features usan la misma key ahora
  allFeatures.forEach(feature => {
    status[feature] = {
      configured: isConfigured,
      envKey: 'OPENAI_API_KEY',
      keyLength: key ? key.length : 0
    };
  });

  return {
    allConfigured: isConfigured,
    missing: isConfigured ? [] : ['OPENAI_API_KEY'],
    features: status
  };
}
