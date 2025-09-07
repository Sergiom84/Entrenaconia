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
        p.edad, p.sexo, p.peso, p.altura, 
        p.anos_entrenando, p.nivel_entrenamiento, p.objetivo_principal,
        p.nivel_actividad, p.grasa_corporal, p.masa_muscular, 
        p.pecho, p.brazos, p.alergias, p.medicamentos, 
        p.suplementacion, p.limitaciones_fisicas
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
    
    // Obtener ejercicios disponibles de calistenia
    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento, 
             series_reps_objetivo, criterio_de_progreso, notas
      FROM app."Ejercicios_Calistenia"
      ORDER BY 
        CASE 
          WHEN LOWER(nivel) = 'básico' THEN 1
          WHEN LOWER(nivel) = 'intermedio' THEN 2
          WHEN LOWER(nivel) = 'avanzado' THEN 3
          ELSE 4
        END, categoria, nombre
    `);
    
    const availableExercises = exercisesResult.rows;
    if (availableExercises.length === 0) {
      throw new Error('No se encontraron ejercicios de calistenia en la base de datos');
    }
    console.log(`📋 ${availableExercises.length} ejercicios de calistenia disponibles`);
    
    // Obtener historial de ejercicios recientes del usuario
    const recentExercisesResult = await pool.query(`
      SELECT DISTINCT exercise_name, used_at
      FROM app.exercise_history
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT 20
    `, [userId]);
    
    const recentExercises = recentExercisesResult.rows.map(row => row.exercise_name);
    
    // Preparar payload para IA
    const aiPayload = {
      task: 'evaluate_calistenia_level',
      user_profile: {
        ...normalizedProfile,
        recent_exercises: recentExercises
      },
      available_exercises: availableExercises,
      evaluation_criteria: [
        'Años de entrenamiento en calistenia o peso corporal',
        'Nivel actual de fuerza relativa',
        'Capacidad de realizar movimientos básicos',
        'Experiencia con ejercicios avanzados',
        'Objetivos específicos de calistenia',
        'Limitaciones físicas o lesiones'
      ],
      expected_output: {
        recommended_level: 'basico|intermedio|avanzado',
        confidence: 0.0, // 0.0 - 1.0
        reasoning: 'Explicación del nivel recomendado',
        key_indicators: ['Factores que determinan el nivel'],
        suggested_focus_areas: ['Áreas específicas a trabajar'],
        exercise_recommendations: ['Ejercicios iniciales recomendados'],
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
          content: `${config.systemPrompt}

Tu tarea es evaluar el perfil del usuario y recomendar un nivel apropiado de calistenia.

NIVELES DISPONIBLES:
- básico: 0-6 meses, movimientos fundamentales
- intermedio: 6-24 meses, progresiones complejas
- avanzado: 24+ meses, habilidades especializadas

RESPONDE EN JSON CON ESTA ESTRUCTURA EXACTA:
{
  "recommended_level": "basico|intermedio|avanzado",
  "confidence": 0.85,
  "reasoning": "Explicación clara del porqué de este nivel",
  "key_indicators": ["Factor 1", "Factor 2", "Factor 3"],
  "suggested_focus_areas": ["Área 1", "Área 2"],
  "exercise_recommendations": ["ejercicio_1", "ejercicio_2", "ejercicio_3"],
  "progression_timeline": "Estimación de tiempo para siguiente nivel",
  "safety_considerations": ["Consideración 1", "Consideración 2"]
}

Analiza el perfil considerando experiencia, fuerza actual, objetivos y limitaciones.`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      top_p: config.top_p
    });
    
    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);
    
    // Parsear respuesta IA (limpiar markdown si existe)
    let cleanResponse = aiResponse.trim();
    
    // Función robusta para limpiar respuestas de IA
    if (cleanResponse.includes('```')) {
      // Intentar extraer JSON de diferentes formatos de markdown
      let jsonMatch;
      
      // Formato: ```json\n{...}\n```
      jsonMatch = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        // Formato: ```\n{...}\n```
        jsonMatch = cleanResponse.match(/```\s*([\s\S]*?)\s*```/);
      }
      if (!jsonMatch) {
        // Formato: ` ``` ` con posibles espacios
        jsonMatch = cleanResponse.match(/`{3,}\s*(?:json)?\s*([\s\S]*?)\s*`{3,}/);
      }
      
      if (jsonMatch) {
        cleanResponse = jsonMatch[1].trim();
      } else {
        console.warn('⚠️ No se pudo extraer JSON de markdown en evaluación, intentando parsing directo');
      }
    }
    
    // Limpiar caracteres adicionales que podrían causar problemas
    cleanResponse = cleanResponse
      .replace(/^[`\s]*/, '')  // Quitar backticks y espacios al inicio
      .replace(/[`\s]*$/, '')  // Quitar backticks y espacios al final
      .trim();
    
    let evaluation;
    try {
      evaluation = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('❌ Error parseando respuesta IA:', parseError.message);
      console.error('📄 Respuesta raw:', aiResponse.substring(0, 200) + '...');
      console.error('🔧 Respuesta limpia:', cleanResponse.substring(0, 200) + '...');
      throw new Error('Respuesta de IA inválida: ' + parseError.message);
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
        exercises_analyzed: availableExercises.length,
        recent_exercises_count: recentExercises.length
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
    
    // Obtener ejercicios disponibles filtrados por nivel
    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento, 
             series_reps_objetivo, criterio_de_progreso, progresion_desde, 
             progresion_hacia, notas
      FROM app."Ejercicios_Calistenia"
      WHERE LOWER(nivel) <= 
        CASE 
          WHEN LOWER($1) = 'avanzado' THEN 'avanzado'
          WHEN LOWER($1) = 'intermedio' THEN 'intermedio'
          ELSE 'básico'
        END
      ORDER BY 
        CASE 
          WHEN LOWER(nivel) = 'básico' THEN 1
          WHEN LOWER(nivel) = 'intermedio' THEN 2
          WHEN LOWER(nivel) = 'avanzado' THEN 3
          ELSE 4
        END, categoria, nombre
    `, [selectedLevel]);
    
    const availableExercises = exercisesResult.rows;
    if (availableExercises.length === 0) {
      throw new Error(`No se encontraron ejercicios de calistenia para el nivel ${selectedLevel} en la base de datos`);
    }
    console.log(`📋 ${availableExercises.length} ejercicios disponibles para nivel ${selectedLevel}`);
    
    // Obtener historial reciente
    const recentExercisesResult = await pool.query(`
      SELECT DISTINCT exercise_name, used_at
      FROM app.exercise_history
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT 15
    `, [userId]);
    
    const recentExercises = recentExercisesResult.rows.map(row => row.exercise_name);
    
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
        sessions_per_week: selectedLevel === 'basico' ? 3 : selectedLevel === 'intermedio' ? 4 : 5,
        session_duration_min: selectedLevel === 'basico' ? 30 : selectedLevel === 'intermedio' ? 45 : 60,
        progression_type: 'gradual',
        focus_areas: exercisePreferences || ['empuje', 'traccion', 'piernas', 'core']
      }
    };
    
    logAIPayload('CALISTENIA_PLAN', planPayload);
    
    // Llamada a IA
    const client = getCalisteniaSpecialistClient();
    const config = AI_MODULES.CALISTENIA_SPECIALIST;
    
    logAPICall('CALISTENIA_SPECIALIST', 'plan-generation', userId);
    
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `${config.systemPrompt}

Genera un plan completo de calistenia usando ÚNICAMENTE los ejercicios proporcionados en available_exercises.

ESTRUCTURA REQUERIDA DEL PLAN JSON:
{
  "selected_style": "Calistenia",
  "nivel_usuario": "${selectedLevel}",
  "duracion_total_semanas": 4,
  "frecuencia_por_semana": number,
  "rationale": "Explicación del plan generado",
  "semanas": [
    {
      "semana": 1,
      "sesiones": [
        {
          "dia": "Lunes|Miércoles|Viernes...",
          "duracion_sesion_min": number,
          "objetivo_sesion": "Descripción del enfoque",
          "ejercicios": [
            {
              "nombre": "USAR EXACTAMENTE exercise_id de available_exercises",
              "series": number,
              "repeticiones": "rango o número",
              "descanso_seg": number,
              "intensidad": "descripción RPE o criterio",
              "notas": "instrucciones específicas",
              "progresion": "cómo progresar este ejercicio"
            }
          ]
        }
      ]
    }
  ],
  "principios_clave": ["principio1", "principio2"],
  "tips_progresion": ["tip1", "tip2"],
  "equipamiento_necesario": ["item1", "item2"]
}

REGLAS CRÍTICAS:
- USA SOLO ejercicios de available_exercises (campo exercise_id como nombre)
- EVITA ejercicios de recent_exercises cuando sea posible
- PROGRESIÓN gradual semanal
- Respeta el nivel seleccionado
- Considera objetivos específicos del usuario`
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