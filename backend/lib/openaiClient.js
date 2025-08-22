import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const clients = {};

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
