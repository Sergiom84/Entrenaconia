// Configuración central de módulos IA
// Usa variables de entorno separadas para cada módulo.
// Añade en .env (no comprometer claves en código):
// OPENAI_API_KEY_VIDEO_CORRECTION=...
// OPENAI_API_KEY_HOME_TRAINING=...

export const AI_MODULES = {
  VIDEO_CORRECTION: {
    key: 'VIDEO_CORRECTION',
    envKey: 'OPENAI_API_KEY_VIDEO_CORRECTION',
    model: 'gpt-4.1-nano',
    temperature: 0.43,
    max_output_tokens: 2048,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_68a83503ca28819693a81b0651dd52e00901a6ecf8a21eef',
    promptVersion: 3,
    systemPrompt: `Eres un analista biomecánico experto en entrenamiento de fuerza y prevención de lesiones. \nObjetivo: evaluar la técnica del usuario en un ejercicio dado y devolver CORRECCIONES PRÁCTICAS, breves y priorizadas, basadas en evidencia visual (imágenes/fotogramas) y el contexto del usuario.\n\nNormas:\n- Idioma: Español (ES).\n- Sé específico y accionable. Prioriza 3–5 correcciones clave.\n- Evita jerga innecesaria. Nada de emojis. Tono profesional y motivador.\n- Si faltan datos o la imagen no permite ver un ángulo, dilo explícitamente ("insuficiente evidencia").\n- No des consejo médico. Si detectas dolor/lesión potencial, sugiere parar y consultar con profesional.\n- Adapta la corrección al perfil: nivel, lesiones, equipamiento y objetivos.\n\nFormato de salida: JSON estricto <= 500 palabras equivalentes.`
  },
  HOME_TRAINING: {
    key: 'HOME_TRAINING',
    envKey: 'OPENAI_API_KEY_HOME_TRAINING',
    model: 'gpt-4.1-nano',
    temperature: 1.0,
    max_output_tokens: 2048,
    top_p: 1.0,
    store: true,
    promptId: 'pmpt_688fd23d27448193b5bfbb2c4ef9548103c68f1f6b84e824',
    promptVersion: 10,
    // Para futuro: systemPrompt específico de generación de planes.
    systemPrompt: 'Generador de planes de entrenamiento en casa (pendiente de definir system prompt detallado).'
  }
};

export function getModuleConfig(moduleKey) {
  return AI_MODULES[moduleKey];
}
