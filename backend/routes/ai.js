import express from 'express';
import multer from 'multer';
import { getModuleOpenAI } from '../lib/openaiClient.js';
import { AI_MODULES } from '../config/aiConfigs.js';

const router = express.Router();

// Config módulo Video Correction
const VC_CONFIG = AI_MODULES.VIDEO_CORRECTION;
const MODEL = VC_CONFIG.model;

// Cliente OpenAI (multi-clave)
const openai = getModuleOpenAI(VC_CONFIG);
const SYSTEM_PROMPT = VC_CONFIG.systemPrompt;

// Función helper para parsear JSON de manera segura
function safeJSON(v) { 
  try { 
    return v ? JSON.parse(v) : null; 
  } catch { 
    return null; 
  } 
}

function extractResponseText(resp) {
  // Intenta múltiples ubicaciones posibles según versiones del SDK
  if (!resp) return '{}';
  const direct = resp.output_text || resp.text || resp.outputText;
  if (direct) return direct;
  // output puede ser array con content
  if (Array.isArray(resp.output)) {
    for (const item of resp.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.text) return c.text;
        }
      }
    }
  }
  return '{}';
}

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Permitir solo imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

/**
 * GET /api/ai/test
 * Endpoint de prueba para verificar conectividad
 */
router.get('/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API de IA funcionando correctamente',
    timestamp: new Date().toISOString(),
    model: MODEL,
  hasApiKey: !!openai,
  apiKeyPreview: openai ? 'configured' : 'missing'
  });
});

/**
 * POST /api/ai/advanced-correction
 * Análisis avanzado de técnica de ejercicio usando IA
 * Acepta 1 'frame' y múltiples 'images'
 */
router.post('/advanced-correction', 
  upload.fields([
    { name: 'frame', maxCount: 1 }, 
    { name: 'images', maxCount: 8 }
  ]), 
  async (req, res) => {
    try {
      const exerciseId = (req.body.exerciseId || 'desconocido').toString();
      const userId = (req.body.userId || 'me').toString();

      const perfilUsuario = safeJSON(req.body.perfilUsuario);
      const contextoSesion = safeJSON(req.body.contextoSesion);
      const landmarks = safeJSON(req.body.landmarks);

      // Recopilar todos los buffers de imagen
      const buffers = [
        ...(req.files?.frame || []).map(f => f.buffer),
        ...(req.files?.images || []).map(f => f.buffer)
      ];

      if (buffers.length === 0) {
        return res.status(400).json({ 
          error: 'Falta al menos una imagen (frame o images[])',
          code: 'NO_IMAGE'
        });
      }

      // Convertir todas las imágenes a base64
      const b64List = buffers.map(b => b.toString('base64'));
      
      // Preparar payload del usuario
      const userPayload = {
        ejercicio: exerciseId,
        perfil_usuario: perfilUsuario ?? null,
        contexto_sesion: contextoSesion ?? null,
        landmarks: landmarks ?? null,
        imagenes: b64List.map((_, i) => `frame_${i + 1}.jpg`)
      };

      // Preparar contenido para OpenAI (tipos válidos: input_text, input_image)
      const userContent = [
        { type: 'input_text', text: JSON.stringify(userPayload) },
        ...b64List.map(b64 => ({
          type: 'input_image',
          image_url: `data:image/jpeg;base64,${b64}`
        }))
      ];

      // Log para debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('🤖 Iniciando análisis IA:', {
          exerciseId,
          userId,
          imageCount: buffers.length,
          hasProfile: !!perfilUsuario,
          hasContext: !!contextoSesion,
          hasLandmarks: !!landmarks
        });
      }

      if (!openai) {
        return res.status(503).json({ error: 'Servicio IA no configurado (API key faltante)', code: 'AI_UNAVAILABLE' });
      }

      // Nuevo esquema de salida deseado
      const outputSchema = {
        ejercicio: 'string',
        confianza_global: 'high|medium|low',
        errores_detectados: [
          {
            tipo: 'postural|tecnico|rango|timing',
            descripcion: 'string',
            severidad: 'leve|moderada|severa',
            zona: 'string',
            impacto: 'string'
          }
        ],
        metricas: {
          angulo_rodilla: 'number|null',
          angulo_cadera: 'number|null',
          alineacion_columna: 'string|null',
          profundidad: 'string|number|null'
        },
        correcciones_priorizadas: [
          {
            prioridad: 'alta|media|baja',
            accion: 'string',
            cue: 'string',
            fundamento: 'string'
          }
        ],
        puntos_clave: ['string'],
        riesgos_potenciales: ['string'],
        feedback_voz: ['string'],
        overlay_recomendado: ['string'],
        siguiente_paso: 'string'
      };

      // Construimos prompt reforzando formato JSON
      const instruction = `Devuelve SOLO JSON válido y estricto (sin explicaciones fuera del JSON) siguiendo claves y estructura EXACTA. Si algún dato no se ve, usa null o [] según corresponda. Limite total <= 500 palabras.`;

      const response = await openai.responses.create({
        model: MODEL,
        reasoning: { effort: 'low' },
        temperature: VC_CONFIG.temperature,
        max_output_tokens: VC_CONFIG.max_output_tokens,
        top_p: VC_CONFIG.top_p,
        store: VC_CONFIG.store,
        // Uso actualizado del formato JSON
        text: { format: 'json_object' },
        metadata: { module: 'video_correction', exerciseId, userId, promptId: VC_CONFIG.promptId, promptVersion: VC_CONFIG.promptVersion },
        input: [
          {
            role: 'system',
            content: [ { type: 'input_text', text: SYSTEM_PROMPT } ]
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: instruction },
              { type: 'input_text', text: 'Estructura esperada:' },
              { type: 'input_text', text: JSON.stringify(outputSchema) },
              { type: 'input_text', text: 'Datos del usuario:' },
              ...userContent
            ]
          }
        ]
      });

      // Extraer texto (json) del response
  const text = extractResponseText(response);
      const json = safeJSON(text) ?? { raw: text };

      // Enriquecer respuesta con metadatos
      const enrichedResult = {
        ...json,
        metadata: {
          exerciseId,
          userId,
          timestamp: new Date().toISOString(),
          model: MODEL,
          imageCount: buffers.length,
          totalSize: buffers.reduce((sum, buf) => sum + buf.length, 0),
          confidence: json.confianza_global || json.confidence || 'medium'
        }
      };

      // Log del resultado
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Análisis IA completado:', {
          exerciseId,
          confidence: enrichedResult.metadata.confidence,
          errores: json.errores_detectados?.length || 0,
          correcciones: json.correcciones_priorizadas?.length || 0
        });
      }

      res.json(enrichedResult);

    } catch (err) {
      console.error('Error en análisis avanzado IA:', err);
      
      // Manejo específico de errores de OpenAI
      if (err.code === 'invalid_api_key') {
        return res.status(401).json({
          error: 'Clave de API de OpenAI inválida',
          code: 'INVALID_API_KEY'
        });
      }

      if (err.code === 'insufficient_quota') {
        return res.status(429).json({
          error: 'Cuota de OpenAI agotada',
          code: 'QUOTA_EXCEEDED'
        });
      }

      res.status(500).json({ 
        error: err?.message || 'Error interno',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;

// ================= Home Training Plan Generation (beta) =================
// Podría ir en un archivo separado (ej: routes/aiHomeTraining.js) pero se incluye aquí provisionalmente.
const HT_CONFIG = AI_MODULES.HOME_TRAINING;
const homeTrainingClient = getModuleOpenAI(HT_CONFIG);

router.post('/home-training/generate', async (req, res) => {
  try {
    if (!homeTrainingClient) {
      return res.status(503).json({ error: 'IA Home Training no configurada (API key faltante)', code: 'AI_UNAVAILABLE' });
    }

    const {
      userProfile = {},
      objetivos = [],
      nivel = 'principiante',
      dias_por_semana = 3,
      duracion_semanas = 4,
      equipamiento = [],
    } = req.body || {};

    const planSchema = {
      plan_entrenamiento: {
        meta: {
          semanas: 'number',
          dias_por_semana: 'number',
          nivel: 'string',
          enfoque: ['fuerza','hipertrofia','resistencia','movilidad','mixto'],
        },
        semanas: [
          {
            semana: 'number',
            resumen_semana: 'string',
            dias: [
              {
                dia: 'number',
                foco: 'string',
                ejercicios: [
                  {
                    nombre: 'string',
                    series: 'number',
                    repeticiones: 'string|number',
                    tempo: 'string|null',
                    descanso_segundos: 'number|null',
                    variante: 'string|null',
                    nota_tecnica: 'string|null'
                  }
                ]
              }
            ]
          }
        ],
        recomendaciones_generales: ['string'],
        seguimiento: {
          metricas_clave: ['string'],
          recomendaciones_progresion: ['string']
        }
      }
    };

    const system = HT_CONFIG.systemPrompt || 'Eres un generador experto de planes de entrenamiento en casa.';
    const instruction = 'Devuelve SOLO JSON válido siguiendo exactamente la estructura; usa null cuando falte info. Evita texto fuera del JSON.';

    const response = await homeTrainingClient.responses.create({
      model: HT_CONFIG.model,
      temperature: HT_CONFIG.temperature,
      max_output_tokens: HT_CONFIG.max_output_tokens,
      top_p: HT_CONFIG.top_p,
      store: HT_CONFIG.store,
      text: { format: 'json_object' },
      metadata: { module: 'home_training_plan', promptId: HT_CONFIG.promptId, promptVersion: HT_CONFIG.promptVersion },
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }]},
        { role: 'user', content: [
          { type: 'input_text', text: instruction },
          { type: 'input_text', text: 'Estructura esperada:' },
          { type: 'input_text', text: JSON.stringify(planSchema) },
          { type: 'input_text', text: 'Datos usuario:' },
          { type: 'input_text', text: JSON.stringify({ userProfile, objetivos, nivel, dias_por_semana, duracion_semanas, equipamiento }) }
        ]}
      ]
    });

  const raw = extractResponseText(response);
    let json;
    try { json = JSON.parse(raw); } catch { json = { raw }; }

    return res.json({
      success: true,
      plan: json.plan_entrenamiento || json,
      metadata: {
        model: HT_CONFIG.model,
        promptId: HT_CONFIG.promptId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generando plan home training IA:', error);
    if (error.code === 'invalid_api_key') return res.status(401).json({ error: 'API key inválida', code: 'INVALID_API_KEY' });
    res.status(500).json({ error: 'Error generando plan', code: 'INTERNAL_ERROR' });
  }
});
