/**
 * Orquestador de metodologías de entrenamiento
 * Coordina la generación de planes según la metodología seleccionada
 * @module routineGeneration/methodologies/MethodologyOrchestrator
 */

import { logger } from '../logger.js';
import { METODOLOGIAS } from '../constants.js';
import * as CalisteniaService from './CalisteniaService.js';
import * as CrossFitService from './CrossFitService.js';
import * as GymRoutineService from './GymRoutineService.js';

/**
 * Evaluar nivel del usuario según la metodología
 * @param {string} methodology - Tipo de metodología
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Evaluación del nivel
 */
export async function evaluateUserLevel(methodology, userId) {
  logger.info(`Evaluando nivel de usuario para metodología: ${methodology}`);

  const normalizedMethodology = methodology.toLowerCase();

  switch (normalizedMethodology) {
    case METODOLOGIAS.CALISTENIA:
      return await CalisteniaService.evaluateCalisteniaLevel(userId);

    case METODOLOGIAS.CROSSFIT:
      return await CrossFitService.evaluateCrossFitLevel(userId);

    case METODOLOGIAS.HIPERTROFIA:
    case METODOLOGIAS.GIMNASIO:
    case METODOLOGIAS.FUNCIONAL:
      // Por ahora, estas metodologías no tienen evaluación automática
      logger.info(`Metodología ${methodology} no tiene evaluación automática`);
      return {
        success: true,
        evaluation: {
          recommended_level: 'intermedio',
          confidence: 0.5,
          reasoning: 'Nivel por defecto - evaluación manual requerida',
          key_indicators: [],
          suggested_focus_areas: []
        }
      };

    default:
      throw new Error(`Metodología no soportada: ${methodology}`);
  }
}

/**
 * Generar plan de entrenamiento según la metodología
 * @param {string} methodology - Tipo de metodología
 * @param {string} userId - ID del usuario
 * @param {object} planData - Datos del plan
 * @returns {Promise<object>} Plan generado
 */
export async function generateMethodologyPlan(methodology, userId, planData) {
  logger.info(`Generando plan para metodología: ${methodology}`);

  const normalizedMethodology = methodology.toLowerCase();

  switch (normalizedMethodology) {
    case METODOLOGIAS.CALISTENIA:
      return await CalisteniaService.generateCalisteniaPlan(userId, planData);

    case METODOLOGIAS.CROSSFIT:
      return await CrossFitService.generateCrossFitPlan(userId, planData);

    case METODOLOGIAS.HIPERTROFIA:
    case METODOLOGIAS.GIMNASIO:
    case METODOLOGIAS.FUNCIONAL:
      return await GymRoutineService.generateGymRoutine(userId, planData);

    default:
      throw new Error(`Metodología no soportada: ${methodology}`);
  }
}

/**
 * Obtener información de niveles disponibles para una metodología
 * @param {string} methodology - Tipo de metodología
 * @returns {object} Niveles disponibles
 */
export function getMethodologyLevels(methodology) {
  const normalizedMethodology = methodology.toLowerCase();

  switch (normalizedMethodology) {
    case METODOLOGIAS.CALISTENIA:
      return CalisteniaService.getCalisteniaLevels();

    case METODOLOGIAS.CROSSFIT:
      return CrossFitService.getCrossFitLevels();

    case METODOLOGIAS.HIPERTROFIA:
    case METODOLOGIAS.GIMNASIO:
    case METODOLOGIAS.FUNCIONAL:
      return GymRoutineService.getGymRoutineTypes();

    default:
      throw new Error(`Metodología no soportada: ${methodology}`);
  }
}

/**
 * Obtener lista de metodologías soportadas
 * @returns {Array<object>} Lista de metodologías
 */
export function getSupportedMethodologies() {
  return [
    {
      id: METODOLOGIAS.CALISTENIA,
      name: 'Calistenia',
      description: 'Entrenamiento con peso corporal',
      hasAutoEvaluation: true,
      levels: ['principiante', 'intermedio', 'avanzado']
    },
    {
      id: METODOLOGIAS.CROSSFIT,
      name: 'CrossFit',
      description: 'Acondicionamiento funcional de alta intensidad',
      hasAutoEvaluation: true,
      levels: ['principiante', 'intermedio', 'avanzado', 'elite']
    },
    {
      id: METODOLOGIAS.HIPERTROFIA,
      name: 'Hipertrofia',
      description: 'Entrenamiento para ganancia de masa muscular',
      hasAutoEvaluation: false,
      levels: ['principiante', 'intermedio', 'avanzado']
    },
    {
      id: METODOLOGIAS.GIMNASIO,
      name: 'Gimnasio General',
      description: 'Rutinas de gimnasio personalizadas',
      hasAutoEvaluation: false,
      levels: ['principiante', 'intermedio', 'avanzado']
    },
    {
      id: METODOLOGIAS.FUNCIONAL,
      name: 'Funcional',
      description: 'Entrenamiento funcional y movimientos naturales',
      hasAutoEvaluation: false,
      levels: ['principiante', 'intermedio', 'avanzado']
    }
  ];
}
