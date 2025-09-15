/**
 * Configuración refactorizada de módulos IA
 * Los prompts ahora se cargan desde archivos .md separados
 */

export const AI_MODULES = {
  // Corrección de video
  VIDEO_CORRECTION: {
    key: 'VIDEO_CORRECTION',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4.1-nano',
    temperature: 0.43,
    max_output_tokens: 2048,
    top_p: 1.0,
    store: true,
    promptFile: 'correction_video_ia.md'
  },

  // Entrenamiento en casa
  HOME_TRAINING: {
    key: 'HOME_TRAINING',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4.1-nano',
    temperature: 1.0,
    max_output_tokens: 2048,
    top_p: 1.0,
    store: true,
    promptFile: 'home_training.md'
  },

  // Corrección de fotos
  PHOTO_CORRECTION: {
    key: 'PHOTO_CORRECTION',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_output_tokens: 1500,
    top_p: 1.0,
    store: true,
    promptFile: 'correction_photo_ia.md'
  },

  // Sistema unificado de metodologías
  METHODOLOGY_UNIFIED: {
    key: 'METHODOLOGY_UNIFIED',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_output_tokens: 16000,
    top_p: 1.0,
    store: true,
    promptFile: 'methodology_unified.md', // Nuevo prompt unificado
    variants: {
      // Variantes específicas por metodología si se necesitan
      heavy_duty: 'prompts/methodologies/heavy_duty.md',
      powerlifting: 'prompts/methodologies/powerlifting.md',
      hipertrofia: 'prompts/methodologies/hipertrofia.md',
      funcional: 'prompts/methodologies/funcional.md',
      oposiciones: 'prompts/methodologies/oposiciones.md',
      crossfit: 'prompts/methodologies/crossfit.md',
      calistenia: 'prompts/methodologies/calistenia.md'
    }
  },

  // Nutrición
  NUTRITION: {
    key: 'NUTRITION',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_output_tokens: 8000,
    top_p: 1.0,
    store: true,
    promptFile: 'Nutrition_AI.md'
  },

  // Especialista en calistenia (para evaluaciones específicas)
  CALISTENIA_SPECIALIST: {
    key: 'CALISTENIA_SPECIALIST',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_output_tokens: 16384,
    top_p: 1.0,
    store: true,
    promptFile: 'calistenia.md'
  }
};

/**
 * Obtiene la configuración de un módulo
 */
export function getModuleConfig(moduleKey) {
  const config = AI_MODULES[moduleKey];
  if (!config) {
    throw new Error(`Módulo IA no encontrado: ${moduleKey}`);
  }
  return config;
}

/**
 * Obtiene todos los módulos disponibles
 */
export function getAllModules() {
  return Object.keys(AI_MODULES);
}

/**
 * Valida que todos los módulos tengan las claves necesarias
 */
export function validateModules() {
  const requiredKeys = ['key', 'envKey', 'model', 'temperature', 'max_output_tokens'];
  const errors = [];

  Object.entries(AI_MODULES).forEach(([name, config]) => {
    requiredKeys.forEach(key => {
      if (!(key in config)) {
        errors.push(`${name} falta clave requerida: ${key}`);
      }
    });
  });

  if (errors.length > 0) {
    throw new Error(`Errores de configuración:\n${errors.join('\n')}`);
  }

  return true;
}