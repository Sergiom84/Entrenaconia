/**
 * Adaptador para migración gradual del sistema de metodologías
 * Permite mantener compatibilidad con el código existente mientras
 * se migra al nuevo sistema unificado
 */

import methodologyService from '../services/methodology/index.js';

/**
 * Adaptador para el endpoint legacy /api/methodologie/generate
 * Convierte la llamada legacy al nuevo formato unificado
 */
export async function adaptLegacyMethodologieGenerate(req, res) {
  try {
    const userId = req.user.id;
    const legacyPayload = req.body;

    console.log('🔄 Legacy adapter: /methodologie/generate called');

    // Convertir payload legacy al nuevo formato
    const unifiedPayload = {
      mode: 'automatic',
      versionConfig: {
        version: legacyPayload.version || 'adapted',
        customWeeks: legacyPayload.customWeeks || 4
      }
    };

    // Llamar al servicio unificado
    const result = await methodologyService.generatePlan(userId, unifiedPayload);

    // Convertir respuesta al formato legacy esperado
    const legacyResponse = {
      success: result.success,
      plan: result.plan,
      planId: result.planId,
      methodology: result.methodology,
      // Mantener campos adicionales para compatibilidad
      generated_at: result.metadata.generatedAt,
      user_profile: result.metadata.userProfile
    };

    console.log('✅ Legacy adapter: converted to unified system');
    res.json(legacyResponse);

  } catch (error) {
    console.error('❌ Legacy adapter error:', error);
    res.status(500).json({
      error: 'generation_failed',
      message: error.message
    });
  }
}

/**
 * Adaptador para endpoints legacy de metodologías manuales
 * Maneja las rutas específicas como /api/calistenia-specialist/*
 */
export async function adaptLegacyManualGenerate(methodology, req, res) {
  try {
    const userId = req.user.id;
    const legacyPayload = req.body;

    console.log(`🔄 Legacy adapter: ${methodology} manual generation called`);

    // Convertir payload legacy al nuevo formato unificado
    const unifiedPayload = {
      mode: 'manual',
      methodology: methodology,
      versionConfig: {
        version: legacyPayload.version || 'adapted',
        customWeeks: legacyPayload.customWeeks || 4
      },
      evaluationResult: legacyPayload.evaluationResult || legacyPayload.evaluation
    };

    // Llamar al servicio unificado
    const result = await methodologyService.generatePlan(userId, unifiedPayload);

    // Convertir respuesta al formato legacy esperado
    const legacyResponse = {
      success: result.success,
      plan: result.plan,
      planId: result.planId,
      methodology: result.methodology,
      mode: 'manual',
      evaluation: unifiedPayload.evaluationResult
    };

    console.log(`✅ Legacy adapter: ${methodology} converted to unified system`);
    res.json(legacyResponse);

  } catch (error) {
    console.error(`❌ Legacy adapter error for ${methodology}:`, error);
    res.status(500).json({
      error: 'generation_failed',
      message: error.message
    });
  }
}

/**
 * Adaptador para rutinas existentes
 * Convierte llamadas del sistema de rutinas al nuevo sistema
 */
export async function adaptRoutineToMethodology(req, res) {
  try {
    const userId = req.user.id;
    const routinePayload = req.body;

    console.log('🔄 Routine adapter: converting routine call to methodology');

    // Determinar si es llamada automática o manual basado en el payload
    const mode = routinePayload.methodology ? 'manual' : 'automatic';

    const unifiedPayload = {
      mode,
      methodology: routinePayload.methodology || null,
      versionConfig: {
        version: routinePayload.difficulty || 'adapted',
        customWeeks: routinePayload.weeks || 4
      }
    };

    const result = await methodologyService.generatePlan(userId, unifiedPayload);

    // Respuesta compatible con el sistema de rutinas
    const routineResponse = {
      success: result.success,
      routine: result.plan, // Mapear 'plan' a 'routine' para compatibilidad
      routineId: result.planId,
      methodology: result.methodology,
      generatedAt: result.metadata.generatedAt
    };

    console.log('✅ Routine adapter: successfully converted');
    res.json(routineResponse);

  } catch (error) {
    console.error('❌ Routine adapter error:', error);
    res.status(500).json({
      error: 'routine_generation_failed',
      message: error.message
    });
  }
}

/**
 * Middleware para logging de llamadas legacy
 * Ayuda a identificar qué endpoints están siendo usados
 */
export function legacyLogger(endpointName) {
  return (req, res, next) => {
    console.log(`📊 Legacy endpoint called: ${endpointName}`, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Agregar header para identificar respuestas legacy
    res.set('X-Legacy-Adapter', 'true');
    res.set('X-Legacy-Endpoint', endpointName);

    next();
  };
}

/**
 * Utilidad para convertir errores del nuevo sistema al formato legacy
 */
export function adaptError(error, legacyFormat = 'methodologie') {
  const errorMap = {
    'methodology_not_found': {
      methodologie: { error: 'invalid_methodology', message: error.message },
      routine: { error: 'routine_type_not_found', message: error.message }
    },
    'incomplete_profile': {
      methodologie: { error: 'profile_incomplete', message: error.message },
      routine: { error: 'user_data_missing', message: error.message }
    },
    'generation_failed': {
      methodologie: { error: 'ai_generation_error', message: error.message },
      routine: { error: 'routine_creation_failed', message: error.message }
    }
  };

  return errorMap[error.code]?.[legacyFormat] || {
    error: 'unknown_error',
    message: error.message || 'Error desconocido'
  };
}

/**
 * Feature flag helper para determinar si usar el sistema nuevo o legacy
 */
export function shouldUseUnifiedSystem() {
  return process.env.USE_NEW_METHODOLOGY_SYSTEM === 'true';
}

/**
 * Middleware de enrutamiento condicional
 * Redirige a legacy o nuevo sistema basado en feature flag
 */
export function conditionalRoute(legacyHandler, unifiedHandler) {
  return (req, res, next) => {
    if (shouldUseUnifiedSystem()) {
      console.log('🆕 Using unified methodology system');
      return unifiedHandler(req, res, next);
    } else {
      console.log('🔄 Using legacy methodology system');
      return legacyHandler(req, res, next);
    }
  };
}

export default {
  adaptLegacyMethodologieGenerate,
  adaptLegacyManualGenerate,
  adaptRoutineToMethodology,
  legacyLogger,
  adaptError,
  shouldUseUnifiedSystem,
  conditionalRoute
};