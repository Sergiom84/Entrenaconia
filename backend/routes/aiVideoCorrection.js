import express from 'express';
import multer from 'multer';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt, FeatureKey } from '../lib/promptRegistry.js';
import { AI_MODULES } from '../config/aiConfigs.js';

const router = express.Router();

// Config módulo Video Correction
const VC_CONFIG = AI_MODULES.VIDEO_CORRECTION;
const MODEL = VC_CONFIG.model;

// Función helper para parsear JSON de manera segura
function safeJSON(v) { 
  try { 
    return v ? JSON.parse(v) : null; 
  } catch { 
    return null; 
  } 
}



const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'), false);
  },
});

// Endpoint principal de Corrección IA Avanzada
router.post(
  '/advanced-correction',
  upload.fields([
    { name: 'frame', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  async (req, res) => {
    try {


      const { exerciseId, userId, perfilUsuario: perfilStr } = req.body || {};
      
      if (!userId) {
        return res.status(400).json({ error: 'userId requerido' });
      }

      const perfil = safeJSON(perfilStr) || {};
      const allFiles = [...(req.files?.frame || []), ...(req.files?.images || [])];

      if (!allFiles.length) {
        return res.status(400).json({ error: 'Se requiere al menos una imagen' });
      }

      // Construir mensajes para Chat Completions con imágenes
      const imageContents = allFiles.map(file => ({
        type: 'image_url',
        image_url: {
          url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          detail: 'high'
        }
      }));

      const perfilText = Object.keys(perfil).length
        ? `Perfil del usuario: ${JSON.stringify(perfil, null, 2)}`
        : 'Sin datos de perfil específicos.';

      const messages = [
        { role: 'system', content: await getPrompt(FeatureKey.VIDEO) },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Ejercicio objetivo: ${exerciseId || 'No especificado'}\n\n${perfilText}\n\nAnaliza las imágenes proporcionadas y proporciona feedback técnico específico siguiendo el formato JSON solicitado.` },
            ...imageContents
          ]
        }
      ];

      console.log('🎯 Enviando a OpenAI (video)...');

      // Cliente OpenAI específico para video
      const client = getOpenAIClient('video');

      const completion = await client.chat.completions.create({
        model: MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        messages,
        response_format: { type: 'json_object' },
        temperature: VC_CONFIG.temperature,
        max_tokens: VC_CONFIG.max_output_tokens,
        top_p: VC_CONFIG.top_p
      });

      console.log('🤖 Respuesta de OpenAI recibida');

      const content = completion?.choices?.[0]?.message?.content || '{}';
      console.log('📝 Texto extraído:', content.substring(0, 500) + '...');

      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.warn('⚠️ Error parseando JSON, usando respuesta raw:', parseError.message);
        analysis = {
          ejercicio: exerciseId || 'No identificado',
          confianza_global: 'media',
          correcciones_priorizadas: [
            {
              prioridad: 'media',
              accion: 'Revisar técnica general',
              fundamento: 'Error en el análisis automático'
            }
          ],
          raw_response: content
        };
      }

      // Añadir metadata de la respuesta
      analysis.metadata = {
        timestamp: new Date().toISOString(),
        model: MODEL,
        promptId: VC_CONFIG.promptId,
        promptVersion: VC_CONFIG.promptVersion,
        imageCount: allFiles.length,
        userId,
        exerciseId,
        confidence: analysis.confianza_global || 'unknown'
      };

      console.log('✅ Análisis completado exitosamente');
      res.json(analysis);

    } catch (error) {
      console.error('❌ Error en Corrección IA Avanzada:', error);
      
      let errorResponse = { 
        error: 'Error procesando solicitud IA', 
        code: 'PROCESSING_ERROR',
        timestamp: new Date().toISOString()
      };

      if (error.message?.includes('API key')) {
        errorResponse = { ...errorResponse, error: 'API key inválida', code: 'INVALID_API_KEY' };
        return res.status(401).json(errorResponse);
      } else if (error.message?.includes('quota')) {
        errorResponse = { ...errorResponse, error: 'Cuota excedida', code: 'QUOTA_EXCEEDED' };
        return res.status(429).json(errorResponse);
      } else if (error.message?.includes('safety')) {
        errorResponse = { ...errorResponse, error: 'Contenido rechazado por políticas de seguridad', code: 'SAFETY_ERROR' };
        return res.status(400).json(errorResponse);
      }

      res.status(500).json(errorResponse);
    }
  }
);

export default router;
