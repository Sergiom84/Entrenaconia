import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { AI_MODULES } from '../config/aiConfigs.js';
import { getModuleOpenAI } from '../lib/openaiClient.js';
import db from '../db.js';
import { 
  logSeparator, 
  logUserProfile, 
  logRecentExercises, 
  logAIPayload, 
  logAIResponse, 
  logError, 
  logAPICall, 
  logTokens 
} from '../utils/aiLogger.js';

const router = express.Router();

// Obtener cliente OpenAI para metodologías manuales
const getMethodologieManualClient = () => {
  const config = AI_MODULES.METHODOLOGIE_MANUAL;
  if (!config) {
    throw new Error('Configuración METHODOLOGIE_MANUAL no encontrada');
  }
  
  return getModuleOpenAI(config);
};

// Generar plan de metodología manual
router.post('/generate-manual', authenticateToken, async (req, res) => {
  try {
    const { metodologia_solicitada, versionConfig } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Configuración de versión por defecto si no se proporciona
    const version = versionConfig || {
      selectionMode: 'automatic',
      version: 'adapted',
      userLevel: 'intermedio'
    };

    // Normalizar metodología (tolerante a mayúsculas/acentos/espacios)
    const normalize = (s = '') => s
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .toLowerCase();

    const CANONICAL = {
      'heavy duty': 'Heavy Duty',
      'powerlifting': 'Powerlifting',
      'hipertrofia': 'Hipertrofia',
      'funcional': 'Funcional',
      'oposiciones': 'Oposiciones',
      'crossfit': 'Crossfit',
      'calistenia': 'Calistenia',
      'entrenamiento en casa': 'Entrenamiento en casa',
      'entrenamiento en  casa': 'Entrenamiento en casa',
      'entrenamiento en el hogar': 'Entrenamiento en casa',
      'entrenamiento en hogar': 'Entrenamiento en casa'
    };

    const metodologiasPermitidas = Object.values(CANONICAL);
    const canonical = CANONICAL[normalize(metodologia_solicitada)];

    if (!canonical) {
      return res.status(400).json({
        success: false,
        error: 'metodologia_no_permitida',
        permitidas: metodologiasPermitidas
      });
    }

    // ====== INICIO DEL LOGGING DETALLADO ======
    logSeparator(`Generación de Plan Manual - ${canonical}`, 'blue');
    logAPICall('/api/methodology-manual/generate-manual', 'POST', userId);

    // Obtener perfil del usuario y ejercicios recientes
    const userQuery = `
      SELECT 
        edad, peso, altura, sexo, nivel_actividad, suplementacion,
        grasa_corporal, masa_muscular, pecho, brazos, nivel_entrenamiento,
        anos_entrenando, objetivo_principal, medicamentos
      FROM app.users 
      WHERE id = $1
    `;
    
    const recentExercisesQuery = `
      SELECT * FROM app.get_recent_exercises($1, $2, 60)
    `;
    
    const userResult = await db.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      logError(new Error('Usuario no encontrado'), 'BASE DE DATOS');
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Log del perfil del usuario
    logUserProfile(user, userId);

    // Obtener ejercicios recientes para evitar repeticiones
    let recentExercises = [];
    try {
      const recentExercisesResult = await db.query(recentExercisesQuery, [userId, canonical]);
      recentExercises = recentExercisesResult.rows;
    } catch (exerciseError) {
      console.log('⚠️ No se pudieron obtener ejercicios recientes (tabla puede no existir):', exerciseError.message);
    }

    // Log de ejercicios recientes
    logRecentExercises(recentExercises);

    // Preparar datos para la IA
    const userData = {
      metodologia_solicitada: canonical,
      versionConfig: {
        selectionMode: version.selectionMode,
        version: version.version,
        userLevel: version.userLevel,
        isRecommended: version.isRecommended || true,
        customWeeks: version.customWeeks || 4
      },
      edad: user.edad,
      peso: user.peso,
      estatura: user.altura, // mapear altura→estatura
      sexo: user.sexo,
      nivel_actividad: user.nivel_actividad,
      suplementacion: user.suplementacion,
      grasa_corporal: user.grasa_corporal,
      masa_muscular: user.masa_muscular,
      pecho: user.pecho,
      brazos: user.brazos,
      nivel_actual_entreno: user.nivel_entrenamiento,
      anos_entrenando: user.anos_entrenando,
      "años_entrenando": user.anos_entrenando,
      objetivo_principal: user.objetivo_principal,
      medicamentos: user.medicamentos,
      ejercicios_recientes: recentExercises.length > 0 ? recentExercises.map(ex => ({
        nombre: ex.exercise_name,
        veces_usado: ex.usage_count,
        ultimo_uso: ex.last_used
      })) : []
    };

    // Log del payload completo enviado a la IA
    logAIPayload(canonical, userData);

    // Llamar a la IA
    const client = getMethodologieManualClient();
    const config = AI_MODULES.METHODOLOGIE_MANUAL;
    
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: config.systemPrompt
        },
        {
          role: 'user',
          content: JSON.stringify(userData)
        }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      top_p: config.top_p,
      response_format: { type: 'json_object' }
    });

    const aiResponse = response.choices[0].message.content;
    
    // Log de tokens consumidos
    logTokens(response);
    
    // Log de la respuesta completa de la IA
    logAIResponse(aiResponse, canonical);

    let planData;
    try {
      planData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Error parseando respuesta de IA:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Error parseando respuesta de IA',
        details: parseError.message
      });
    }

    // Validar que la metodología coincida
    if (planData.selected_style !== canonical) {
      console.error('❌ La IA no usó la metodología solicitada');
      return res.status(500).json({
        success: false,
        error: 'La IA no generó la metodología solicitada'
      });
    }

    // Guardar en base de datos (opcional, para historial)
    const insertQuery = `
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, created_at
      ) VALUES ($1, $2, $3, 'manual', NOW())
      RETURNING id
    `;
    
    const insertResult = await db.query(insertQuery, [
      userId,
      canonical,
      JSON.stringify(planData)
    ]);

    // Registrar ejercicios del plan en el historial para evitar repeticiones futuras
    try {
      const registerExercisesQuery = `SELECT app.register_plan_exercises($1, $2, $3, $4)`;
      await db.query(registerExercisesQuery, [
        userId,
        canonical,
        JSON.stringify(planData),
        insertResult.rows[0].id
      ]);
      console.log('✅ Ejercicios registrados en historial para evitar repeticiones');
    } catch (registerError) {
      console.log('⚠️ No se pudieron registrar ejercicios en historial:', registerError.message);
    }

    console.log(`✅ Plan de ${metodologia_solicitada} generado exitosamente`);

    res.json({
      success: true,
      plan: planData,
      planId: insertResult.rows[0].id,
      message: `Plan de ${metodologia_solicitada} generado exitosamente`
    });

  } catch (error) {
    console.error('❌ Error en generate-manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener metodologías disponibles
router.get('/available-methodologies', (req, res) => {
  const metodologias = [
    { id: 'heavy_duty', name: 'Heavy Duty', description: 'Alta intensidad, bajo volumen' },
    { id: 'powerlifting', name: 'Powerlifting', description: 'Fuerza máxima en básicos' },
    { id: 'hipertrofia', name: 'Hipertrofia', description: 'Crecimiento muscular' },
    { id: 'funcional', name: 'Funcional', description: 'Movimientos naturales' },
    { id: 'oposiciones', name: 'Oposiciones', description: 'Preparación física específica' },
    { id: 'crossfit', name: 'Crossfit', description: 'Entrenamiento variado e intenso' },
    { id: 'calistenia', name: 'Calistenia', description: 'Peso corporal y progresiones' },
    { id: 'entrenamiento_casa', name: 'Entrenamiento en casa', description: 'Mínimo equipamiento' }
  ];

  res.json({
    success: true,
    metodologias
  });
});

export default router;
