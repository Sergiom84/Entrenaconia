/**
 * Servicio especializado de Calistenia
 * @module routineGeneration/methodologies/CalisteniaService
 */

import { pool } from '../../../db.js';
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
 * Evaluar perfil de usuario para determinar nivel de calistenia
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Evaluación con nivel recomendado
 */
export async function evaluateCalisteniaLevel(userId) {
  try {
    logSeparator('CALISTENIA PROFILE EVALUATION');
    logAPICall('/specialist/calistenia/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Verificar ejercicios disponibles
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Calistenia"
      WHERE LOWER(nivel) = 'principiante'
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de calistenia en la base de datos');
    }

    // Obtener historial de ejercicios
    const recentExercisesResult = await pool.query(`
      SELECT DISTINCT exercise_name, used_at
      FROM app.exercise_history
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT 20
    `, [userId]);

    const recentExercises = recentExercisesResult.rows.map(row => row.exercise_name);

    // Preparar payload para IA
    const aiPayload = {
      task: 'evaluate_calistenia_level',
      user_profile: {
        ...normalizedProfile,
        recent_exercises: recentExercises
      },
      evaluation_criteria: [
        'Años de entrenamiento en calistenia o peso corporal',
        'Nivel actual de fuerza relativa (IMC, experiencia)',
        'Capacidad de realizar movimientos básicos',
        'Experiencia con ejercicios avanzados',
        'Objetivos específicos de calistenia',
        'Limitaciones físicas o lesiones',
        'Edad y condición física general'
      ],
      level_descriptions: {
        principiante: 'Principiantes: 0-1 años experiencia, enfoque en técnica básica',
        intermedio: 'Experiencia: 1-3 años, domina movimientos básicos',
        avanzado: 'Expertos: +3 años, ejecuta ejercicios complejos'
      }
    };

    logAIPayload('CALISTENIA_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST);
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en calistenia que evalúa perfiles de usuarios.

INSTRUCCIONES:
- Evalúa objetivamente la experiencia y condición física
- Sé realista con la confianza (no siempre 100%)
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "principiante|intermedio|avanzado",
  "confidence": 0.75,
  "reasoning": "Explicación detallada",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Área 1", "Área 2"],
  "progression_timeline": "Tiempo estimado"
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
        progression_timeline: evaluation.progression_timeline || 'No especificado'
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Error en evaluación de calistenia:', error);
    logError('CALISTENIA_SPECIALIST', error);
    throw error;
  }
}

/**
 * Generar plan de entrenamiento de calistenia
 * @param {string} userId - ID del usuario
 * @param {object} planData - Datos del plan
 * @returns {Promise<object>} Plan generado
 */
export async function generateCalisteniaPlan(userId, planData) {
  // Esta función será implementada en la siguiente fase
  // Por ahora retornamos un placeholder
  logger.info('Generando plan de calistenia para usuario:', userId);
  return {
    success: true,
    message: 'Generación de plan de calistenia - Pendiente de implementación completa',
    planData
  };
}

/**
 * Obtener niveles disponibles de calistenia
 * @returns {object} Niveles con descripciones
 */
export function getCalisteniaLevels() {
  return {
    principiante: {
      name: 'Principiante',
      description: '0-1 años de experiencia. Enfoque en técnica básica y fundamentos.',
      duration_weeks: 8,
      sessions_per_week: 3
    },
    intermedio: {
      name: 'Intermedio',
      description: '1-3 años de experiencia. Domina movimientos básicos, progresiones avanzadas.',
      duration_weeks: 10,
      sessions_per_week: 4
    },
    avanzado: {
      name: 'Avanzado',
      description: '+3 años de experiencia. Ejecuta ejercicios complejos, skills avanzados.',
      duration_weeks: 12,
      sessions_per_week: 5
    }
  };
}
