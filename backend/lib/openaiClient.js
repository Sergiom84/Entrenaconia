import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

let clients = {};

/**
 * Devuelve una instancia reutilizable del cliente de OpenAI.
 * Si se pasa apiKey, la usa; si no, usa process.env.OPENAI_API_KEY.
 * Si falta la API key, devuelve null.
 * @param {string} [apiKey] - API key específica (opcional)
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
