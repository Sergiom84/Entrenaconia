/**
 * Servicio de parseo de respuestas de IA
 * @module routineGeneration/ai/aiResponseParser
 */

import { logger } from '../logger.js';

/**
 * Parsear respuesta JSON de IA con manejo robusto
 * @param {string} response - Respuesta cruda de IA
 * @returns {string} JSON limpio y validado
 * @throws {Error} Si la respuesta no es JSON válido
 */
export function parseAIResponse(response) {
  if (!response || typeof response !== 'string') {
    logger.error('❌ Respuesta de IA inválida: no es string');
    throw new Error('Respuesta de IA inválida');
  }

  let cleanResponse = response.trim();

  // Log para debug
  logger.debug(`📝 Parseando respuesta IA (${cleanResponse.length} caracteres)`);

  // Manejar markdown code blocks
  if (cleanResponse.includes('```')) {
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/i,
      /```\s*([\s\S]*?)\s*```/,
      /`{3,}\s*(?:json)?\s*([\s\S]*?)\s*`{3,}/i
    ];

    for (const pattern of patterns) {
      const match = cleanResponse.match(pattern);
      if (match && match[1]) {
        cleanResponse = match[1].trim();
        logger.info('✅ Extraído contenido de code block markdown');
        break;
      }
    }
  }

  // Limpiar caracteres problemáticos
  cleanResponse = cleanResponse
    .replace(/^[`\s]*/, '')
    .replace(/[`\s]*$/, '')
    .replace(/^\s*json\s*/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Eliminar caracteres de control
    .trim();

  // Validar estructura JSON
  if (!cleanResponse.startsWith('{') || !cleanResponse.endsWith('}')) {
    const firstBrace = cleanResponse.indexOf('{');
    const lastBrace = cleanResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
      logger.warn('⚠️ Estructura JSON reparada (recortada a llaves)');
    } else {
      logger.error('❌ No se pudo encontrar estructura JSON válida');
      throw new Error('Respuesta no contiene JSON válido');
    }
  }

  // Intento de validación temprana
  try {
    JSON.parse(cleanResponse);
    logger.info('✅ Respuesta parseada exitosamente');
  } catch (e) {
    logger.error('❌ Error parseando JSON:', e.message);
    logger.error('Primeros 200 caracteres:', cleanResponse.substring(0, 200));
    throw new Error(`Respuesta JSON mal formateada: ${e.message}`);
  }

  return cleanResponse;
}

/**
 * Validar que la respuesta parseada tenga estructura de plan válida
 * @param {object} plan - Plan parseado de IA
 * @throws {Error} Si el plan no tiene estructura válida
 */
export function validatePlanStructure(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Plan debe ser un objeto');
  }

  // Validaciones básicas
  if (!Array.isArray(plan.semanas)) {
    throw new Error('Plan debe tener array "semanas"');
  }

  if (plan.semanas.length === 0) {
    throw new Error('Plan debe tener al menos una semana');
  }

  // Validar que cada semana tenga sesiones
  for (const [index, week] of plan.semanas.entries()) {
    if (!Array.isArray(week.sesiones)) {
      throw new Error(`Semana ${index + 1} debe tener array "sesiones"`);
    }
    if (week.sesiones.length === 0) {
      throw new Error(`Semana ${index + 1} debe tener al menos una sesión`);
    }
  }

  return true;
}
