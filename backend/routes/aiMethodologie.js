import express from 'express';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt } from '../lib/promptRegistry.js';
import { AI_MODULES } from '../config/aiConfigs.js';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// Config módulo Methodologie
const METHODOLOGIE_CONFIG = AI_MODULES.METHODOLOGIE;

/**
 * Función helper para parsear JSON de manera segura
 */
function safeJSON(v) { 
  try { 
    return v ? JSON.parse(v) : null; 
  } catch { 
    return null; 
  } 
}

/**
 * Función para validar y sanitizar datos del perfil de usuario
 */
function validateProfileData(profile) {
  // No inventar valores: pasar tal cual vienen de la BD (o null)
  return {
    edad: profile.edad != null ? Number(profile.edad) : null,
    peso: profile.peso != null ? Number(profile.peso) : null,
    estatura: profile.altura != null ? Number(profile.altura) : (profile.altura_cm != null ? Number(profile.altura_cm) : (profile.estatura != null ? Number(profile.estatura) : null)),
    sexo: profile.sexo ?? null,
    nivel_actividad: profile.nivel_actividad ?? null,
    suplementación: profile.suplementación ?? profile.suplementacion ?? null,
    grasa_corporal: profile.grasa_corporal ?? null,
    masa_muscular: profile.masa_muscular ?? null,
    pecho: profile.pecho ?? null,
    brazos: profile.brazos ?? null,
    nivel_actual_entreno: profile.nivel_entrenamiento ?? profile.nivel_actual_entreno ?? null,
    años_entrenando: profile.años_entrenando != null ? Number(profile.años_entrenando) : (profile.anos_entrenando != null ? Number(profile.anos_entrenando) : null),
    objetivo_principal: profile.objetivo_principal ?? null,
    medicamentos: profile.medicamentos ?? null
  };
}

/**
 * POST /api/methodologie/generate-plan
 * Genera un plan de entrenamiento personalizado usando IA
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Iniciando generación de plan metodológico...');

    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'TOKEN_SIN_ID' });
    }

    // Leer perfil desde BD (vista normalizada)
    const { rows } = await (await import('../db.js')).pool.query(
      `SELECT * FROM app.v_user_profile_normalized WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const perfil = rows[0];

    // Validar y sanitizar datos del perfil
    const profileData = validateProfileData(perfil);

    console.log('👤 Perfil procesado:', {
      edad: profileData.edad,
      peso: profileData.peso,
      objetivo: profileData.objetivo_principal,
      nivel: profileData.nivel_actual_entreno
    });

    // Obtener cliente OpenAI específico para metodologías
    const openai = getOpenAIClient('methodologie');
    if (!openai) {
      throw new Error('Cliente OpenAI no disponible para metodologías');
    }

    // Obtener prompt específico para metodologías
    const systemPrompt = await getPrompt('methodologie');
    if (!systemPrompt) {
      throw new Error('Prompt no disponible para metodologías');
    }

    // Crear el mensaje del usuario con los datos del perfil
    const userMessage = `Genera un plan de entrenamiento basado en el siguiente perfil:

Datos del usuario:
- Edad: ${profileData.edad} años
- Peso: ${profileData.peso} kg
- Estatura: ${profileData.estatura} cm
- Sexo: ${profileData.sexo}
- Nivel de actividad: ${profileData.nivel_actividad}
- Suplementación: ${profileData.suplementación || 'No especificada'}
- Grasa corporal: ${profileData.grasa_corporal || 'No especificada'}%
- Masa muscular: ${profileData.masa_muscular || 'No especificada'} kg
- Perímetro pecho: ${profileData.pecho || 'No especificado'} cm
- Perímetro brazos: ${profileData.brazos || 'No especificado'} cm
- Nivel actual de entrenamiento: ${profileData.nivel_actual_entreno}
- Años entrenando: ${profileData.años_entrenando}
- Objetivo principal: ${profileData.objetivo_principal}
- Medicamentos: ${profileData.medicamentos}

Por favor, responde únicamente con el JSON solicitado según las especificaciones del prompt.`;

    console.log('🤖 Enviando solicitud a OpenAI...');
    
    // Realizar petición a OpenAI
    const response = await openai.chat.completions.create({
      model: METHODOLOGIE_CONFIG.model,
      temperature: METHODOLOGIE_CONFIG.temperature,
      max_tokens: METHODOLOGIE_CONFIG.max_output_tokens,
      top_p: METHODOLOGIE_CONFIG.top_p,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user', 
          content: userMessage
        }
      ]
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Respuesta vacía de OpenAI');
    }

    let aiContent = response.choices[0].message.content.trim();
    console.log('📄 Respuesta recibida, longitud:', aiContent.length);

    // Intentar parsear el JSON de la respuesta
    let parsedPlan;
    try {
      // Limpiar posibles markdown o texto extra
      if (aiContent.includes('```json')) {
        aiContent = aiContent.split('```json')[1].split('```')[0].trim();
      } else if (aiContent.includes('```')) {
        aiContent = aiContent.split('```')[1].split('```')[0].trim();
      }
      
      // Verificar si el JSON está truncado y intentar repararlo
      if (!aiContent.endsWith('}') && !aiContent.endsWith(']}')) {
        console.warn('⚠️ JSON parece truncado, intentando reparar...');
        
        // Intentar cerrar estructuras abiertas
        let fixedContent = aiContent;
        
        // Contar llaves abiertas vs cerradas
        const openBraces = (fixedContent.match(/\{/g) || []).length;
        const closeBraces = (fixedContent.match(/\}/g) || []).length;
        const openBrackets = (fixedContent.match(/\[/g) || []).length;
        const closeBrackets = (fixedContent.match(/\]/g) || []).length;
        
        // Cerrar arrays abiertos
        for (let i = 0; i < (openBrackets - closeBrackets); i++) {
          fixedContent += ']';
        }
        
        // Cerrar objetos abiertos
        for (let i = 0; i < (openBraces - closeBraces); i++) {
          fixedContent += '}';
        }
        
        console.log('🔧 JSON reparado, intentando parsear...');
        aiContent = fixedContent;
      }
      
      parsedPlan = JSON.parse(aiContent);
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError.message);
      console.log('📄 Contenido que falló (primeros 1000 chars):', aiContent.substring(0, 1000));
      console.log('📄 Final del contenido (últimos 500 chars):', aiContent.substring(Math.max(0, aiContent.length - 500)));
      
      return res.status(500).json({
        error: 'Error procesando respuesta de IA',
        message: 'La IA no devolvió un JSON válido - posible truncamiento',
        details: {
          parseError: parseError.message,
          contentLength: aiContent.length,
          contentPreview: aiContent.substring(0, 200) + '...',
          contentEnd: '...' + aiContent.substring(Math.max(0, aiContent.length - 200))
        }
      });
    }

    // Validar estructura básica del plan
    if (!parsedPlan.selected_style || !parsedPlan.semanas || !Array.isArray(parsedPlan.semanas)) {
      return res.status(500).json({
        error: 'Plan inválido',
        message: 'El plan generado no tiene la estructura esperada',
        plan: parsedPlan
      });
    }

    console.log('✅ Plan generado exitosamente:', {
      metodologia: parsedPlan.selected_style,
      duracion: parsedPlan.duracion_total_semanas,
      frecuencia: parsedPlan.frecuencia_por_semana,
      semanas: parsedPlan.semanas?.length
    });

    // Respuesta exitosa
    res.json({
      success: true,
      plan: parsedPlan,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: METHODOLOGIE_CONFIG.model,
        promptVersion: METHODOLOGIE_CONFIG.promptVersion,
        profileProcessed: profileData
      }
    });

  } catch (error) {
    console.error('❌ Error en generación de plan metodológico:', error);
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/methodologie/available-styles
 * Obtiene las metodologías disponibles
 */
router.get('/available-styles', (req, res) => {
  const availableStyles = [
    'Heavy Duty',
    'Powerlifting', 
    'Hipertrofia',
    'Funcional',
    'Oposiciones',
    'Crossfit',
    'Calistenia',
    'Entrenamiento en casa'
  ];

  res.json({
    success: true,
    styles: availableStyles,
    total: availableStyles.length
  });
});

/**
 * GET /api/methodologie/health
 * Health check para el módulo de metodologías
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    module: 'Methodologie IA',
    timestamp: new Date().toISOString(),
    config: {
      model: METHODOLOGIE_CONFIG.model,
      temperature: METHODOLOGIE_CONFIG.temperature,
      promptVersion: METHODOLOGIE_CONFIG.promptVersion
    }
  });
});

export default router;
