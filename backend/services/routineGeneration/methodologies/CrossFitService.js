/**
 * Servicio especializado de CrossFit
 * @module routineGeneration/methodologies/CrossFitService
 */

import { AI_MODULES } from '../../../config/aiConfigs.js';
import { getModuleOpenAI } from '../../../lib/openaiClient.js';
import { logger } from '../logger.js';
import { parseAIResponse } from '../ai/aiResponseParser.js';
import { getUserFullProfile } from '../database/userRepository.js';
import { normalizeUserProfile } from '../validators.js';
import {
  logSeparator,
  logAPICall,
  logUserProfile,
  logAIPayload,
  logAIResponse,
  logTokens,
  logError
} from '../../../utils/aiLogger.js';

/**
 * Evaluar perfil de usuario para determinar nivel de CrossFit
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Evaluación con nivel recomendado
 */
export async function evaluateCrossFitLevel(userId) {
  try {
    logSeparator('CROSSFIT PROFILE EVALUATION');
    logAPICall('/specialist/crossfit/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.CROSSFIT_SPECIALIST);
    const config = AI_MODULES.CROSSFIT_SPECIALIST;

    const aiPayload = {
      user_profile: normalizedProfile,
      evaluation_type: 'crossfit_level',
      task: 'Determinar nivel de CrossFit (principiante/intermedio/avanzado/elite) basado en las 10 habilidades físicas generales y experiencia en los 3 dominios metabólicos'
    };

    logAIPayload('CROSSFIT_EVALUATION', aiPayload);

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un evaluador especializado en CrossFit Level-2. Analiza el perfil del usuario y determina su nivel de CrossFit.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

Niveles válidos: principiante, intermedio, avanzado, elite

Criterios basados en las 10 habilidades físicas y experiencia:
- Principiante (Scaled): 0-12 meses de CrossFit, aprendiendo movimientos base, necesita scaling
- Intermedio (RX): 1-3 años, completa WODs RX, pull-ups, double-unders, cargas estándar (95/65 thrusters)
- Avanzado (RX+): 3-5 años, muscle-ups, HSPUs, cargas pesadas, tiempos competitivos
- Elite: 5+ años competitivo, Open/Quarterfinals, domina movimientos avanzados, levantamientos élite

FORMATO EXACTO:
{
  "recommended_level": "principiante|intermedio|avanzado|elite",
  "confidence": 0.75,
  "reasoning": "Explicación detallada basada en las 10 habilidades",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Gymnastic", "Weightlifting", "Monostructural"],
  "safety_considerations": ["Advertencia 1", "Advertencia 2"],
  "benchmark_targets": {
    "fran": "Sub-8 min",
    "helen": "Sub-12 min",
    "back_squat": "1.5x BW"
  }
}`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear respuesta
    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      logger.error('Error parseando respuesta IA:', parseError);
      throw new Error('Respuesta de IA inválida');
    }

    // Validar respuesta
    const normalizedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return {
      success: true,
      evaluation: {
        recommended_level: normalizedLevel,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        key_indicators: evaluation.key_indicators || [],
        suggested_focus_areas: evaluation.suggested_focus_areas || [],
        safety_considerations: evaluation.safety_considerations || [],
        benchmark_targets: evaluation.benchmark_targets || {}
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Error en evaluación de CrossFit:', error);
    logError('CROSSFIT_SPECIALIST', error);
    throw error;
  }
}

/**
 * Generar plan de entrenamiento de CrossFit
 * @param {string} userId - ID del usuario
 * @param {object} planData - Datos del plan
 * @returns {Promise<object>} Plan generado
 */
export async function generateCrossFitPlan(userId, planData) {
  // Esta función será implementada en la siguiente fase
  // Por ahora retornamos un placeholder
  logger.info('Generando plan de CrossFit para usuario:', userId);
  return {
    success: true,
    message: 'Generación de plan de CrossFit - Pendiente de implementación completa',
    planData
  };
}

/**
 * Obtener niveles disponibles de CrossFit
 * @returns {object} Niveles con descripciones
 */
export function getCrossFitLevels() {
  return {
    principiante: {
      name: 'Principiante (Scaled)',
      description: '0-12 meses de CrossFit. Aprendiendo movimientos base, necesita scaling.',
      duration_weeks: 8,
      sessions_per_week: 3,
      benchmark_targets: {
        fran: 'Scaled',
        helen: 'Scaled',
        back_squat: '1x BW'
      }
    },
    intermedio: {
      name: 'Intermedio (RX)',
      description: '1-3 años. Completa WODs RX, pull-ups, double-unders, cargas estándar.',
      duration_weeks: 10,
      sessions_per_week: 4,
      benchmark_targets: {
        fran: 'Sub-8 min',
        helen: 'Sub-12 min',
        back_squat: '1.5x BW'
      }
    },
    avanzado: {
      name: 'Avanzado (RX+)',
      description: '3-5 años. Muscle-ups, HSPUs, cargas pesadas, tiempos competitivos.',
      duration_weeks: 12,
      sessions_per_week: 5,
      benchmark_targets: {
        fran: 'Sub-5 min',
        helen: 'Sub-9 min',
        back_squat: '2x BW'
      }
    },
    elite: {
      name: 'Elite',
      description: '5+ años competitivo. Open/Quarterfinals, movimientos avanzados.',
      duration_weeks: 12,
      sessions_per_week: 6,
      benchmark_targets: {
        fran: 'Sub-3 min',
        helen: 'Sub-7 min',
        back_squat: '2.5x BW'
      }
    }
  };
}
