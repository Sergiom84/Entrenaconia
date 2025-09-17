// Configuración central de módulos IA
// NUEVA CONFIGURACIÓN: Una sola API key maestra para todos los módulos
// Añade en .env (no comprometer claves en código):
// OPENAI_API_KEY=sk-proj-...

export const AI_MODULES = {
  VIDEO_CORRECTION: {
    key: 'VIDEO_CORRECTION',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4.1-nano',
    temperature: 0.43,
    max_output_tokens: 2048,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68a83503ca28819693a81b0651dd52e00901a6ecf8a21eef',
    promptVersion: "3",
    systemPrompt: 'correction_video_ia' // Se carga desde el archivo MD
  },
  HOME_TRAINING: {
    key: 'HOME_TRAINING',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4.1-nano',
    temperature: 1.0,
    max_output_tokens: 2048,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_688fd23d27448193b5bfbb2c4ef9548103c68f1f6b84e824',
    promptVersion: "10",
    systemPrompt: 'home_training' // Se carga desde el archivo MD
  },
  PHOTO_CORRECTION: {
    key: 'PHOTO_CORRECTION',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_output_tokens: 1500,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68a89775a9e08190a95a5e3d484fd09a055e214db81a6fd0',
    promptVersion: "1",
    systemPrompt: 'correction_photo_ia' // Se carga desde el archivo MD
  },
  METHODOLOGIE_MANUAL: {
    key: 'METHODOLOGIE_MANUAL',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_output_tokens: 16000,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68a9a18bdfc08197965d75cd064eeb1f0a109ccbc248c9ca',
    promptVersion: "8",
    systemPrompt: 'methodologie_manual' // Se carga desde prompts/methodologie_manual.md
  },
  METHODOLOGIE: {
    key: 'METHODOLOGIE',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.9,
    max_output_tokens: 16000,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68a9a05d7ee0819493fd342673a05b210a99044d2c5e3055',
    promptVersion: "9",
    systemPrompt: 'methodologie' // Se cargará desde el archivo MD
  },
  NUTRITION: {
    key: 'NUTRITION',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_output_tokens: 8000,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68ae0d8c52908196a4d207ac1292fcff0eb39487cfc552fc',
    promptVersion: "1.0",
    systemPrompt: 'nutrition' // Se cargará desde el archivo MD
  },
  CALISTENIA_SPECIALIST: {
    key: 'CALISTENIA_SPECIALIST',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_output_tokens: 16384,  // 🔧 Aumentado de 12000 a 16384 (máximo del modelo)
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68bbf7d87c948194b0b82e000b5274f30663795f5e3b2843',
    promptVersion: "1.0",
    systemPrompt: 'calistenia_specialist' // Se cargará desde el archivo MD
  }
};

export function getModuleConfig(moduleKey) {
  return AI_MODULES[moduleKey];
}
