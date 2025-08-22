import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

const router = express.Router();

// API Key específica para Video Corrección IA
const OPENAI_API_KEY = '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';
const MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';

// Cliente OpenAI específico para este módulo
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Prompt del sistema para análisis biomecánico
const SYSTEM_PROMPT = `Eres un analista biomecánico experto y entrenador personal certificado con más de 15 años de experiencia. Tu especialidad es el análisis de técnica de ejercicios y corrección postural.

INSTRUCCIONES:
1. Analiza la(s) imagen(es) proporcionada(s) con enfoque en biomecánica y técnica
2. Identifica errores técnicos, desviaciones posturales y compensaciones
3. Proporciona correcciones específicas y progresivas
4. Adapta tus recomendaciones al perfil del usuario (nivel, lesiones, objetivos)
5. Mantén un tono profesional pero accesible

RESPONDE SIEMPRE EN FORMATO JSON CON ESTA ESTRUCTURA EXACTA:
{
  "ejercicio_detectado": "nombre del ejercicio identificado",
  "fase_movimiento": "excéntrica/concéntrica/isométrica/posición inicial/transición",
  "puntuacion_general": 85,
  "confidence": "high/medium/low",
  "errores": [
    {
      "categoria": "postural/técnico/rango_movimiento/timing",
      "descripcion": "descripción específica del error",
      "severidad": "leve/moderada/severa",
      "zona_afectada": "parte del cuerpo específica",
      "impacto": "consecuencias potenciales"
    }
  ],
  "aspectos_correctos": [
    "lista de aspectos que se ejecutan correctamente"
  ],
  "correcciones": [
    {
      "prioridad": "alta/media/baja",
      "accion": "corrección específica paso a paso",
      "explicacion": "fundamento biomecánico",
      "cue_verbal": "instrucción concisa para el usuario"
    }
  ],
  "adaptaciones_perfil": {
    "para_nivel": "sugerencias específicas según nivel del usuario",
    "consideraciones_lesiones": "adaptaciones por lesiones/limitaciones",
    "progresion": "siguiente paso en la progresión del ejercicio"
  },
  "observaciones_adicionales": "comentarios generales y contexto"
}

CRITERIOS DE EVALUACIÓN:
- Alineación corporal y postura
- Rango de movimiento y control
- Activación muscular aparente
- Estabilidad y equilibrio
- Técnica respiratoria (si es visible)
- Progresión y regresión apropiada`;

// Función helper para parsear JSON de manera segura
function safeJSON(v) { 
  try { 
    return v ? JSON.parse(v) : null; 
  } catch { 
    return null; 
  } 
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
    hasApiKey: !!OPENAI_API_KEY,
    apiKeyPreview: OPENAI_API_KEY ? `${OPENAI_API_KEY.slice(0, 10)}...` : 'No configurada'
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

      // Preparar contenido para OpenAI
      const userContent = [
        { type: 'text', text: JSON.stringify(userPayload) },
        ...b64List.map(b64 => ({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${b64}` }
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

      // Llamada a OpenAI Vision con JSON mode
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.3
      });

      const text = completion.choices?.[0]?.message?.content || '{}';
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
          confidence: json.confidence || 'medium'
        }
      };

      // Log del resultado
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Análisis IA completado:', {
          exerciseId,
          confidence: enrichedResult.metadata.confidence,
          errorsDetected: json.errores?.length || 0,
          correctionsCount: json.correcciones?.length || 0
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
