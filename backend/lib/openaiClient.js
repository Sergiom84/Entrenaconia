import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const clients = {};

// Mapeo de features a variables de entorno
const ENV_BY_FEATURE = {
  photo: "OPENAI_API_KEY_CORRECTION_PHOTO",
  video: "OPENAI_API_KEY_CORRECTION_VIDEO", 
  home: "OPENAI_API_KEY_HOME_TRAINING",
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
 * @param {"photo"|"video"|"home"} feature - Feature específico
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
 * Verifica que todas las API keys estén configuradas
 * @returns {Object} Estado de configuración de API keys
 */
export function validateAPIKeys() {
  const status = {};
  const missing = [];

  for (const [feature, envKey] of Object.entries(ENV_BY_FEATURE)) {
    const key = process.env[envKey];
    status[feature] = {
      configured: !!(key && key.trim()),
      envKey,
      keyLength: key ? key.length : 0
    };

    if (!status[feature].configured) {
      missing.push(envKey);
    }
  }

  return {
    allConfigured: missing.length === 0,
    missing,
    features: status
  };
}
