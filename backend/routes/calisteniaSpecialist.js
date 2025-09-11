/**
 * Calistenia Specialist AI Routes
 * API para evaluación automática de nivel y generación de planes especializados
 * 
 * @author Claude Code - Sistema IA Especializado
 * @version 1.0.0
 */

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { AI_MODULES } from '../config/aiConfigs.js';
import { getModuleOpenAI } from '../lib/openaiClient.js';
import { pool } from '../db.js';
import { getPrompt, FeatureKey, clearPromptCache } from '../lib/promptRegistry.js';
import { 
  logSeparator, 
  logUserProfile, 
  logAIPayload, 
  logAIResponse, 
  logError, 
  logAPICall, 
  logTokens 
} from '../utils/aiLogger.js';

const router = express.Router();

// ===============================================
// FUNCIONES HELPER PARA PARSING JSON ROBUSTO
// ===============================================

/**
 * Función mejorada de parsing JSON que maneja múltiples formatos y errores
 */
function parseAIResponse(response) {
  let cleanResponse = response.trim();
  
  console.log(`📝 Respuesta raw (primeros 200 chars): ${cleanResponse.substring(0, 200)}...`);
  
  // Si contiene markdown code blocks
  if (cleanResponse.includes('```')) {
    console.log('🔧 Detectado markdown, extrayendo JSON...');
    // Intentar diferentes patrones de extracción
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/i,  // ```json ... ```
      /```\s*([\s\S]*?)\s*```/,       // ``` ... ```
      /`{3,}\s*(?:json)?\s*([\s\S]*?)\s*`{3,}/i  // ``` con variaciones
    ];
    
    for (const pattern of patterns) {
      const match = cleanResponse.match(pattern);
      if (match && match[1]) {
        cleanResponse = match[1].trim();
        console.log('✅ JSON extraído exitosamente del markdown');
        break;
      }
    }
  }
  
  // Limpiar caracteres problemáticos
  cleanResponse = cleanResponse
    .replace(/^[`\s]*/, '')  
    .replace(/[`\s]*$/, '')
    .replace(/^\s*json\s*/i, '') // Remover palabra 'json' al inicio
    .trim();
  
  // Validar que empiece y termine con llaves
  if (!cleanResponse.startsWith('{') || !cleanResponse.endsWith('}')) {
    console.warn('⚠️ Respuesta no parece ser JSON válido, intentando extracción manual...');
    const firstBrace = cleanResponse.indexOf('{');
    const lastBrace = cleanResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
      console.log('🔧 JSON extraído manualmente');
    }
  }
  
  console.log(`🔍 JSON limpiado (primeros 200 chars): ${cleanResponse.substring(0, 200)}...`);
  
  return cleanResponse;
}

/**
 * Función súper robusta de último recurso
 */
function parseAIResponseRobust(response) {
  let text = response.trim();
  
  // Buscar el primer { y el último }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }
  
  // Limpiar completamente cualquier markdown residual
  text = text
    .replace(/^.*?```.*?\n?/g, '')  // Quitar líneas con ```
    .replace(/```.*$/g, '')         // Quitar ``` al final
    .replace(/^[`\s]*/, '')         // Quitar backticks iniciales
    .replace(/[`\s]*$/, '')         // Quitar backticks finales
    .trim();
    
  return text;
}

/**
 * Obtener cliente OpenAI para Calistenia Specialist
 */
const getCalisteniaSpecialistClient = () => {
  const config = AI_MODULES.CALISTENIA_SPECIALIST;
  if (!config) {
    throw new Error('Configuración CALISTENIA_SPECIALIST no encontrada');
  }
  
  return getModuleOpenAI(config);
};

/**
 * POST /api/calistenia-specialist/evaluate-profile
 * Evaluación automática del perfil del usuario para determinar nivel de calistenia
 */
router.post('/evaluate-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    console.log('🤸‍♀️ Iniciando evaluación de perfil para calistenia...');
    
    // Obtener perfil completo del usuario desde la base de datos
    const userQuery = await pool.query(`
      SELECT 
        u.id, u.nombre, u.apellido, u.email,
        u.edad, u.sexo, u.peso, u.altura, 
        u.anos_entrenando, u.nivel_entrenamiento, 
        u.nivel_actividad, u.grasa_corporal, u.masa_muscular, 
        u.pecho, u.brazos, u.alergias, u.medicamentos, 
        u.suplementacion,
        p.limitaciones_fisicas, p.objetivo_principal, p.metodologia_preferida
      FROM app.users u
      LEFT JOIN app.user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);
    
    if (userQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    const realUserProfile = userQuery.rows[0];
    
    // Construir perfil normalizado con datos reales de la DB
    const normalizedProfile = {
      id: realUserProfile.id,
      nombre: realUserProfile.nombre,
      apellido: realUserProfile.apellido,
      email: realUserProfile.email,
      edad: realUserProfile.edad,
      sexo: realUserProfile.sexo,
      peso_kg: parseFloat(realUserProfile.peso),
      altura_cm: parseFloat(realUserProfile.altura),
      años_entrenando: realUserProfile.anos_entrenando || realUserProfile.años_entrenando,
      nivel_entrenamiento: realUserProfile.nivel_entrenamiento || 'principiante',
      objetivo_principal: realUserProfile.objetivo_principal || 'general',
      nivel_actividad: realUserProfile.nivel_actividad,
      grasa_corporal: parseFloat(realUserProfile.grasa_corporal) || null,
      masa_muscular: parseFloat(realUserProfile.masa_muscular) || null,
      pecho: parseFloat(realUserProfile.pecho) || null,
      brazos: parseFloat(realUserProfile.brazos) || null,
      alergias: realUserProfile.alergias || [],
      medicamentos: realUserProfile.medicamentos || [],
      suplementacion: realUserProfile.suplementacion || [],
      limitaciones_fisicas: realUserProfile.limitaciones_fisicas || null
    };
    
    logSeparator('CALISTENIA PROFILE EVALUATION');
    logUserProfile(normalizedProfile, userId);
    
    // OPTIMIZACIÓN: No cargar ejercicios para evaluación de perfil
    // Solo verificamos que existen ejercicios en la base de datos
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Calistenia"
      WHERE LOWER(nivel) = 'básico'
        AND categoria IN ('Empuje', 'Tracción', 'Core', 'Piernas', 'Equilibrio/Soporte')
    `);
    
    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de calistenia en la base de datos');
    }
    console.log(`📋 ${exerciseCount} ejercicios básicos disponibles (no cargados para optimizar tokens)`);
    
    // Obtener historial de ejercicios recientes del usuario
    const recentExercisesResult = await pool.query(`
      SELECT DISTINCT exercise_name, used_at
      FROM app.exercise_history
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT 20
    `, [userId]);
    
    const recentExercises = recentExercisesResult.rows.map(row => row.exercise_name);
    
    // PAYLOAD OPTIMIZADO: Solo perfil del usuario y criterios de evaluación
    const aiPayload = {
      task: 'evaluate_calistenia_level',
      user_profile: {
        ...normalizedProfile,
        recent_exercises: recentExercises
      },
      // REMOVIDO: available_exercises (ahorro de ~7000 caracteres)
      evaluation_criteria: [
        'Años de entrenamiento en calistenia o peso corporal',
        'Nivel actual de fuerza relativa (IMC, experiencia)',
        'Capacidad de realizar movimientos básicos',
        'Experiencia con ejercicios avanzados',
        'Objetivos específicos de calistenia',
        'Limitaciones físicas o lesiones',
        'Edad y condición física general'
      ],
      level_descriptions: {
        basico: 'Principiantes: 0-1 años experiencia, enfoque en técnica básica',
        intermedio: 'Experiencia: 1-3 años, domina movimientos básicos',
        avanzado: 'Expertos: +3 años, ejecuta ejercicios complejos'
      },
      expected_output: {
        recommended_level: 'basico|intermedio|avanzado',
        confidence: 'float 0.0-1.0 (ser realista, no siempre 1.0)',
        reasoning: 'Explicación detallada del nivel recomendado',
        key_indicators: ['Factores específicos que determinan el nivel'],
        suggested_focus_areas: ['Áreas específicas a trabajar'],
        progression_timeline: 'Tiempo estimado para avanzar al siguiente nivel'
      }
    };
    
    logAIPayload('CALISTENIA_EVALUATION', aiPayload);
    
    // Llamada a IA especializada
    const client = getCalisteniaSpecialistClient();
    const config = AI_MODULES.CALISTENIA_SPECIALIST;
    
    logAPICall('CALISTENIA_SPECIALIST', 'profile-evaluation', userId);
    
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en calistenia que evalúa perfiles de usuarios para determinar su nivel de entrenamiento apropiado.

ANÁLISIS REALISTA:
- Evalúa objetivamente la experiencia, fuerza y condición física del usuario
- No siempre asignes 100% de confianza - sé realista con las incertidumbres
- Considera edad, peso, experiencia previa, limitaciones y objetivos

NIVELES DE CALISTENIA:
- BÁSICO: 0-1 años experiencia, aprendiendo movimientos fundamentales
- INTERMEDIO: 1-3 años, domina básicos, progresa a variaciones
- AVANZADO: +3 años, ejecuta movimientos complejos y skills

FACTORES CLAVE A EVALUAR:
1. Años de entrenamiento específico en calistenia o peso corporal
2. Capacidad actual (flexiones, dominadas, sentadillas, planchas)
3. IMC y condición física general
4. Edad y posibles limitaciones
5. Objetivos específicos del usuario
6. Historial de lesiones o limitaciones

INSTRUCCIONES CRÍTICAS:
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN
- NO uses backticks (\`\`\`) ni texto adicional
- Evalúa con criterio realista, no siempre básico ni siempre 100% confianza
- Para principiantes reales (0 experiencia), sí recomienda básico con alta confianza
- Para usuarios con experiencia, evalúa apropiadamente

FORMATO DE RESPUESTA (JSON puro):
{
  "recommended_level": "basico|intermedio|avanzado",
  "confidence": 0.75,
  "reasoning": "Análisis detallado del por qué este nivel es apropiado",
  "key_indicators": ["Factor 1 específico", "Factor 2 específico", "Factor 3 específico"],
  "suggested_focus_areas": ["Área 1", "Área 2", "Área 3"],
  "progression_timeline": "Tiempo estimado realista"
}`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: 0.3, // Temperatura más baja para respuestas consistentes
      max_tokens: 800,   // Suficiente para respuesta completa pero controlado
      top_p: 0.9
    });
    
    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);
    
    // Parsear respuesta IA con lógica robusta mejorada
    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('❌ Error parseando respuesta IA:', parseError.message);
      console.error('📄 Respuesta raw:', aiResponse.substring(0, 300) + '...');
      
      // Función de parsing super robusta como último recurso
      const lastResort = parseAIResponseRobust(aiResponse);
      try {
        evaluation = JSON.parse(lastResort);
        console.log('✅ Parsing exitoso con método robusto de último recurso');
      } catch (finalError) {
        console.error('🔧 Respuesta limpia final:', lastResort.substring(0, 300) + '...');
        throw new Error('Respuesta de IA inválida después de todos los intentos: ' + finalError.message);
      }
    }
    
    // Validar respuesta
    const requiredFields = ['recommended_level', 'confidence', 'reasoning'];
    for (const field of requiredFields) {
      if (!evaluation[field]) {
        throw new Error(`Campo requerido faltante en respuesta IA: ${field}`);
      }
    }
    
    // Validar nivel
    const validLevels = ['basico', 'intermedio', 'avanzado'];
    const normalizedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove accents
    if (!validLevels.includes(normalizedLevel)) {
      throw new Error(`Nivel inválido recomendado: ${evaluation.recommended_level}`);
    }
    
    console.log(`✅ Evaluación completada - Nivel recomendado: ${evaluation.recommended_level} (${Math.round(evaluation.confidence * 100)}% confianza)`);
    
    res.json({
      success: true,
      evaluation: {
        recommended_level: normalizedLevel,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        key_indicators: evaluation.key_indicators || [],
        suggested_focus_areas: evaluation.suggested_focus_areas || [],
        exercise_recommendations: evaluation.exercise_recommendations || [],
        progression_timeline: evaluation.progression_timeline || 'No especificado',
        safety_considerations: evaluation.safety_considerations || []
      },
      metadata: {
        model_used: config.model,
        prompt_id: config.promptId,
        evaluation_timestamp: new Date().toISOString(),
        exercises_available_count: exerciseCount, // Solo cantidad, no ejercicios completos
        recent_exercises_count: recentExercises.length,
        optimization: 'v4.0 - Eliminados ejercicios innecesarios del payload',
        tokens_saved: '~7000 characters'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en evaluación de perfil:', error);
    logError('CALISTENIA_SPECIALIST', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/calistenia-specialist/generate-plan
 * Generación de plan especializado usando IA de calistenia
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { userProfile, selectedLevel, goals, exercisePreferences } = req.body;
    
    console.log('🤸‍♀️ Generando plan especializado de calistenia...');
    
    if (!userProfile || !selectedLevel) {
      return res.status(400).json({
        success: false,
        error: 'Perfil de usuario y nivel seleccionado requeridos'
      });
    }
    
    logSeparator('CALISTENIA PLAN GENERATION');
    logUserProfile(userProfile, userId);
    
    // Para principiantes solo usamos ejercicios básicos
    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento, 
             series_reps_objetivo, criterio_de_progreso, progresion_desde, 
             progresion_hacia, notas
      FROM app."Ejercicios_Calistenia"
      WHERE LOWER(nivel) = 'básico'
        AND categoria IN ('Empuje', 'Tracción', 'Core', 'Piernas', 'Equilibrio/Soporte')
      ORDER BY categoria, nombre
    `);
    
    const availableExercises = exercisesResult.rows;
    if (availableExercises.length === 0) {
      throw new Error(`No se encontraron ejercicios de calistenia básicos en la base de datos`);
    }
    console.log(`📋 ${availableExercises.length} ejercicios básicos disponibles`);
    
    // Obtener historial reciente
    const recentExercisesResult = await pool.query(`
      SELECT DISTINCT exercise_name, used_at
      FROM app.exercise_history
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT 15
    `, [userId]);
    
    const recentExercises = recentExercisesResult.rows.map(row => row.exercise_name);
    
    // Obtener el día actual en español para que la IA comience desde hoy
    const today = new Date();
    const daysOfWeek = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const currentDay = daysOfWeek[today.getDay()];
    
    // Preparar payload para generación de plan
    const planPayload = {
      task: 'generate_calistenia_plan',
      user_profile: userProfile,
      selected_level: selectedLevel,
      goals: goals || '',
      exercise_preferences: exercisePreferences || [],
      available_exercises: availableExercises,
      recent_exercises: recentExercises,
      plan_requirements: {
        duration_weeks: 4,
        sessions_per_week: 3, // Siempre 3 para principiantes
        session_duration_min: 30, // Siempre 30min para principiantes
        progression_type: 'gradual',
        focus_areas: ['empuje', 'traccion', 'piernas', 'core'], // Patrones básicos fijos
        start_day: currentDay,
        start_date: today.toISOString().split('T')[0] // Formato YYYY-MM-DD
      }
    };
    
    console.log(`📅 Plan comenzará desde: ${currentDay} (${today.toISOString().split('T')[0]})`);
    logAIPayload('CALISTENIA_PLAN', planPayload);
    
    // Limpiar caché para asegurar que obtenga la versión más reciente
    clearPromptCache(FeatureKey.CALISTENIA_SPECIALIST);
    
    // Obtener prompt desde el registry
    const systemPrompt = await getPrompt(FeatureKey.CALISTENIA_SPECIALIST);
    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Calistenia Specialist');
    }
    
    console.log('📋 Usando prompt desde registry para generar plan de calistenia');
    console.log(`📝 Prompt preview (100 chars): ${systemPrompt.substring(0, 100)}...`);
    
    // Llamada a IA
    const client = getCalisteniaSpecialistClient();
    const config = AI_MODULES.CALISTENIA_SPECIALIST;
    
    logAPICall('CALISTENIA_SPECIALIST', 'plan-generation', userId);
    
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: JSON.stringify(planPayload)
        }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      top_p: config.top_p
    });
    
    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);
    
    // Parsear y validar plan (limpiar markdown si existe)
    let cleanPlanResponse = aiResponse.trim();
    
    // Función robusta para limpiar respuestas de IA
    if (cleanPlanResponse.includes('```')) {
      // Intentar extraer JSON de diferentes formatos de markdown
      let jsonMatch;
      
      // Formato: ```json\n{...}\n```
      jsonMatch = cleanPlanResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        // Formato: ```\n{...}\n```
        jsonMatch = cleanPlanResponse.match(/```\s*([\s\S]*?)\s*```/);
      }
      if (!jsonMatch) {
        // Formato: ` ``` ` con posibles espacios
        jsonMatch = cleanPlanResponse.match(/`{3,}\s*(?:json)?\s*([\s\S]*?)\s*`{3,}/);
      }
      
      if (jsonMatch) {
        cleanPlanResponse = jsonMatch[1].trim();
      } else {
        console.warn('⚠️ No se pudo extraer JSON de markdown, intentando parsing directo');
      }
    }
    
    // Limpiar caracteres adicionales que podrían causar problemas
    cleanPlanResponse = cleanPlanResponse
      .replace(/^[`\s]*/, '')  // Quitar backticks y espacios al inicio
      .replace(/[`\s]*$/, '')  // Quitar backticks y espacios al final
      .trim();
    
    let generatedPlan;
    try {
      generatedPlan = JSON.parse(cleanPlanResponse);
    } catch (parseError) {
      console.error('❌ Error parseando plan generado:', parseError.message);
      console.error('📄 Respuesta raw:', aiResponse.substring(0, 200) + '...');
      console.error('🔧 Respuesta limpia:', cleanPlanResponse.substring(0, 200) + '...');
      throw new Error('Plan generado inválido: ' + parseError.message);
    }
    
    // Validar estructura básica del plan
    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan debe contener array de semanas');
    }
    
    // Guardar plan en base de datos
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      
      // Insertar en methodology_plans
      const methodologyResult = await dbClient.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, status, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
      `, [userId, 'Calistenia', JSON.stringify(generatedPlan), 'draft']);
      
      const methodologyPlanId = methodologyResult.rows[0].id;
      
      // Insertar en routine_plans para compatibilidad
      const routineResult = await dbClient.query(`
        INSERT INTO app.routine_plans (
          user_id, methodology_type, plan_data, status, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
      `, [userId, 'Calistenia', JSON.stringify(generatedPlan), 'draft']);
      
      const routinePlanId = routineResult.rows[0].id;
      
      await dbClient.query('COMMIT');
      
      console.log(`✅ Plan de calistenia guardado - Methodology ID: ${methodologyPlanId}, Routine ID: ${routinePlanId}`);
      
      res.json({
        success: true,
        plan: generatedPlan,
        planId: methodologyPlanId,
        routinePlanId: routinePlanId,
        metadata: {
          model_used: config.model,
          prompt_id: config.promptId,
          generation_timestamp: new Date().toISOString(),
          exercises_available: availableExercises.length,
          level_used: selectedLevel,
          ai_tokens_used: completion.usage
        }
      });
      
    } catch (dbError) {
      await dbClient.query('ROLLBACK');
      throw dbError;
    } finally {
      dbClient.release();
    }
    
  } catch (error) {
    console.error('❌ Error generando plan especializado:', error);
    logError('CALISTENIA_SPECIALIST', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;