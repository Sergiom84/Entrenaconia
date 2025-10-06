/**
 * Routine Generation Unified Routes
 * Consolidación de todos los endpoints de generación de rutinas (IA y manual)
 *
 * @module routineGeneration
 * @version 2.0.0
 * @description Centraliza toda la funcionalidad de generación de rutinas:
 *   - Calistenia (especialista y manual)
 *   - Metodologías (automática y manual)
 *   - Gimnasio (rutinas IA)
 *   - Sistema unificado
 *
 * Categorías de endpoints:
 *   - /api/routine-generation/ai/*      -> Generación automática con IA
 *   - /api/routine-generation/manual/*  -> Creación manual
 *   - /api/routine-generation/specialist/* -> Especialistas (calistenia, gym)
 */

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
import { AI_MODULES } from '../config/aiConfigs.js';
import { getModuleOpenAI, getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt, FeatureKey, clearPromptCache } from '../lib/promptRegistry.js';
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

// =========================================
// FUNCIONES HELPER COMPARTIDAS
// =========================================

/**
 * Limpiar drafts fallidos del usuario antes de crear un plan nuevo
 * Esta función previene la acumulación de planes draft corruptos
 */
async function cleanUserDrafts(userId, client = null) {
  const dbClient = client || pool;

  try {
    console.log(`🧹 Limpiando drafts fallidos para usuario ${userId}...`);

    const result = await dbClient.query(`
      DELETE FROM app.methodology_plans
      WHERE user_id = $1 AND status = 'draft'
    `, [userId]);

    const deletedCount = result.rowCount;
    if (deletedCount > 0) {
      console.log(`✅ Eliminados ${deletedCount} drafts fallidos del usuario ${userId}`);
    }

    return deletedCount;
  } catch (error) {
    console.error('❌ Error limpiando drafts:', error);
    // No lanzar error - la limpieza es opcional
    return 0;
  }
}

/**
 * Obtener perfil completo del usuario desde la BD
 */
async function getUserFullProfile(userId) {
  const userQuery = await pool.query(`
    SELECT
      u.id, u.nombre, u.apellido, u.email,
      u.edad, u.sexo, u.peso, u.altura,
      u.anos_entrenando, u.nivel_entrenamiento,
      u.nivel_actividad, u.grasa_corporal, u.masa_muscular,
      u.pecho, u.brazos, u.alergias, u.medicamentos,
      u.suplementacion, u.frecuencia_semanal,
      u.agua_corporal, u.metabolismo_basal,
      u.cintura, u.muslos, u.cuello, u.antebrazos, u.cadera,
      u.comidas_por_dia, u.alimentos_excluidos, u.meta_peso,
      u.meta_grasa_corporal, u.enfoque_entrenamiento, u.historial_medico,
      p.limitaciones_fisicas, p.objetivo_principal, p.metodologia_preferida
    FROM app.users u
    LEFT JOIN app.user_profiles p ON u.id = p.user_id
    WHERE u.id = $1
  `, [userId]);

  if (userQuery.rowCount === 0) {
    throw new Error('Usuario no encontrado');
  }

  return userQuery.rows[0];
}

/**
 * Normalizar perfil de usuario para IA
 */
function normalizeUserProfile(profile) {
  return {
    id: profile.id,
    nombre: profile.nombre,
    apellido: profile.apellido,
    email: profile.email,
    edad: profile.edad != null ? Number(profile.edad) : null,
    sexo: profile.sexo,
    peso_kg: parseFloat(profile.peso) || null,
    altura_cm: parseFloat(profile.altura) || null,
    años_entrenando: profile.anos_entrenando || 0,
    nivel_entrenamiento: profile.nivel_entrenamiento || 'principiante',
    objetivo_principal: profile.objetivo_principal || 'general',
    nivel_actividad: profile.nivel_actividad || 'moderado',
    grasa_corporal: parseFloat(profile.grasa_corporal) || null,
    masa_muscular: parseFloat(profile.masa_muscular) || null,
    pecho: parseFloat(profile.pecho) || null,
    brazos: parseFloat(profile.brazos) || null,
    alergias: profile.alergias || [],
    medicamentos: profile.medicamentos || [],
    suplementacion: profile.suplementacion || [],
    limitaciones_fisicas: profile.limitaciones_fisicas || null
  };
}

/**
 * Parsear respuesta JSON de IA con manejo robusto
 */
function parseAIResponse(response) {
  let cleanResponse = response.trim();

  // Manejar markdown code blocks
  if (cleanResponse.includes('```')) {
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/i,
      /```\s*([\s\S]*?)\s*```/,
      /`{3,}\s*(?:json)?\s*([\s\S]*?)\s*`{3,}/i
    ];

    for (const pattern of patterns) {
      const match = cleanResponse.match(pattern);
      if (match && match[1]) {
        cleanResponse = match[1].trim();
        break;
      }
    }
  }

  // Limpiar caracteres problemáticos
  cleanResponse = cleanResponse
    .replace(/^[`\s]*/, '')
    .replace(/[`\s]*$/, '')
    .replace(/^\s*json\s*/i, '')
    .trim();

  // Validar estructura JSON
  if (!cleanResponse.startsWith('{') || !cleanResponse.endsWith('}')) {
    const firstBrace = cleanResponse.indexOf('{');
    const lastBrace = cleanResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
    }
  }

  return cleanResponse;
}

/**
 * Obtener día actual para inicio de rutina
 */
function getCurrentDayInfo() {
  const today = new Date();
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return {
    date: today,
    dayName: daysOfWeek[today.getDay()],
    dateString: today.toLocaleDateString('es-ES'),
    isoDate: today.toISOString().split('T')[0]
  };
}

// =========================================
// CALISTENIA SPECIALIST (IA)
// =========================================

/**
 * POST /api/routine-generation/specialist/calistenia/evaluate
 * Evaluación automática del perfil para calistenia
 */
router.post('/specialist/calistenia/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('CALISTENIA PROFILE EVALUATION');
    logAPICall('/specialist/calistenia/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Verificar ejercicios disponibles
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Calistenia"
      WHERE LOWER(nivel) = 'básico'
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de calistenia en la base de datos');
    }

    // Obtener historial de ejercicios
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
      }
    };

    logAIPayload('CALISTENIA_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST);
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en calistenia que evalúa perfiles de usuarios.

INSTRUCCIONES:
- Evalúa objetivamente la experiencia y condición física
- Sé realista con la confianza (no siempre 100%)
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "basico|intermedio|avanzado",
  "confidence": 0.75,
  "reasoning": "Explicación detallada",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Área 1", "Área 2"],
  "progression_timeline": "Tiempo estimado"
}`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear respuesta
    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando respuesta IA:', parseError);
      throw new Error('Respuesta de IA inválida');
    }

    // Validar respuesta
    const normalizedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    res.json({
      success: true,
      evaluation: {
        recommended_level: normalizedLevel,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        key_indicators: evaluation.key_indicators || [],
        suggested_focus_areas: evaluation.suggested_focus_areas || [],
        progression_timeline: evaluation.progression_timeline || 'No especificado'
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en evaluación de calistenia:', error);
    logError('CALISTENIA_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/calistenia/generate
 * Generación de plan especializado de calistenia con IA
 */
router.post('/specialist/calistenia/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      userProfile,
      selectedLevel,
      goals,
      previousPlan,
      regenerationReason,
      additionalInstructions
    } = req.body;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('CALISTENIA PLAN GENERATION');
    console.log('Generando plan de calistenia...', {
      selectedLevel,
      isRegeneration,
      goals: goals?.substring(0, 50)
    });

    // Obtener perfil completo si solo se envió ID
    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    // Mapear nivel
    const levelMapping = {
      'basico': 'Básico',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[selectedLevel.toLowerCase()] || 'Básico';

    // Obtener ejercicios disponibles
    let levelCondition;
    if (dbLevel === 'Avanzado') {
      levelCondition = "nivel IN ('Básico', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      levelCondition = "nivel IN ('Básico', 'Intermedio')";
    } else {
      levelCondition = "nivel = 'Básico'";
    }

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, criterio_de_progreso, progresion_desde,
             progresion_hacia, notas
      FROM app."Ejercicios_Calistenia"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;
    console.log(`Ejercicios disponibles: ${availableExercises.length}`);

    // Configuración del plan
    const dayInfo = getCurrentDayInfo();
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 4 : 3);
    const sessionDuration = dbLevel === 'Avanzado' ? 60 : (dbLevel === 'Intermedio' ? 45 : 30);

    const planPayload = {
      task: isRegeneration ? 'regenerate_calistenia_plan' : 'generate_calistenia_plan',
      user_profile: fullUserProfile,
      selected_level: selectedLevel,
      goals: goals || '',
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: 4,
        sessions_per_week: sessionsPerWeek,
        session_duration_min: sessionDuration,
        start_day: dayInfo.dayName,
        start_date: dayInfo.isoDate
      },
      ...(isRegeneration && {
        previous_plan: previousPlan,
        user_feedback: {
          reasons: regenerationReason || [],
          additional_instructions: additionalInstructions || null
        }
      })
    };

    logAIPayload('CALISTENIA_PLAN', planPayload);

    // Obtener prompt y generar
    clearPromptCache(FeatureKey.CALISTENIA_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.CALISTENIA_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Calistenia Specialist');
    }

    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST);
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(planPayload) }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear y guardar plan
    const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan debe contener array de semanas');
    }

    // Guardar en BD
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // 🧹 LIMPIAR DRAFTS FALLIDOS ANTES DE CREAR PLAN NUEVO
      await cleanUserDrafts(userId, dbClient);

      const methodologyResult = await dbClient.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Calistenia', JSON.stringify(generatedPlan), 'automatic', 'draft']);

      const methodologyPlanId = methodologyResult.rows[0].id;

      await dbClient.query('COMMIT');

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId,
        planId: methodologyPlanId,
        justification: isRegeneration
          ? `Plan mejorado basado en tu feedback`
          : generatedPlan.justification || 'Plan personalizado generado',
        metadata: {
          model_used: config.model,
          generation_timestamp: new Date().toISOString()
        }
      });

    } catch (dbError) {
      await dbClient.query('ROLLBACK');
      throw dbError;
    } finally {
      dbClient.release();
    }

  } catch (error) {
    console.error('Error generando plan de calistenia:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// SPECIALIST: HEAVY DUTY
// =========================================

/**
 * POST /api/routine-generation/specialist/heavy-duty/evaluate
 * Evaluación de perfil para Heavy Duty con IA
 */
router.post('/specialist/heavy-duty/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('HEAVY DUTY PROFILE EVALUATION');
    logAPICall('/specialist/heavy-duty/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Verificar ejercicios disponibles en tabla Heavy Duty
    // Niveles reales en BD: Principiante (11), Básico (38), Intermedio (14) = 63 total
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Heavy_Duty"
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de Heavy Duty en la base de datos');
    }

    // Obtener historial de ejercicios
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
      task: 'evaluate_heavy_duty_level',
      user_profile: {
        ...normalizedProfile,
        recent_exercises: recentExercises
      },
      evaluation_criteria: [
        'Años de entrenamiento con pesas',
        'Experiencia con fallo muscular absoluto',
        'Nivel de intensidad y tolerancia al dolor',
        'Capacidad de recuperación (edad, descanso)',
        'Experiencia con ejercicios compuestos pesados',
        'Limitaciones físicas o lesiones',
        'Mentalidad de entrenamiento (intensidad vs volumen)'
      ],
      level_descriptions: {
        novato: 'Principiantes: 0-1 años con pesas, introducción al fallo muscular',
        intermedio: 'Experiencia: 1-3 años, domina fallo muscular controlado',
        avanzado: 'Expertos: +3 años, maestría del fallo absoluto y descansos prolongados'
      },
      heavy_duty_principles: [
        'Máxima intensidad: 1-2 series al fallo absoluto',
        'Mínimo volumen: Menos es más',
        'Descansos prolongados: 4-7 días entre grupos musculares',
        'Alta carga: 80-95% 1RM según nivel'
      ]
    };

    logAIPayload('HEAVY_DUTY_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.HEAVY_DUTY_SPECIALIST);
    const config = AI_MODULES.HEAVY_DUTY_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en Heavy Duty (Mike Mentzer) que evalúa perfiles de usuarios.

INSTRUCCIONES:
- Evalúa objetivamente la experiencia con fallo muscular y alta intensidad
- Sé conservador con niveles avanzados (requieren años de experiencia)
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "novato|intermedio|avanzado",
  "confidence": 0.75,
  "reasoning": "Explicación detallada",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Press de banca", "Sentadilla"],
  "safety_considerations": ["Advertencia 1", "Advertencia 2"]
}`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear respuesta
    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando respuesta IA:', parseError);
      throw new Error('Respuesta de IA inválida');
    }

    // Validar respuesta
    const normalizedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    res.json({
      success: true,
      evaluation: {
        recommended_level: normalizedLevel,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        key_indicators: evaluation.key_indicators || [],
        suggested_focus_areas: evaluation.suggested_focus_areas || [],
        safety_considerations: evaluation.safety_considerations || []
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en evaluación de Heavy Duty:', error);
    logError('HEAVY_DUTY_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/heavy-duty/generate
 * Generación de plan especializado de Heavy Duty con IA
 */
router.post('/specialist/heavy-duty/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // ✅ EXTRACCIÓN FLEXIBLE: Soporte para heavyDutyData (anidado) o datos en root
    const heavyDutyData = req.body.heavyDutyData || req.body;
    const {
      userProfile,
      level,              // Heavy Duty envía "level"
      selectedLevel,      // Fallback por si viene selectedLevel
      goals,
      selectedMuscleGroups,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = heavyDutyData;

    // Mapear level → selectedLevel (Heavy Duty usa "level" en lugar de "selectedLevel")
    const actualLevel = selectedLevel || level;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('HEAVY DUTY PLAN GENERATION');
    console.log('Generando plan de Heavy Duty...', {
      selectedLevel: actualLevel,
      selectedMuscleGroups,
      isRegeneration,
      goals: goals?.substring(0, 50)
    });

    // Obtener perfil completo si solo se envió ID
    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    // Validar que tenemos nivel
    if (!actualLevel) {
      return res.status(400).json({
        success: false,
        error: 'Nivel no especificado (level o selectedLevel requerido)'
      });
    }

    // Mapear nivel - Corregido según niveles reales en BD
    const levelMapping = {
      'novato': 'Principiante',      // 11 ejercicios
      'principiante': 'Principiante', // Alias
      'intermedio': 'Intermedio',     // 14 ejercicios
      'avanzado': 'Intermedio'        // Avanzados usan ejercicios Intermedios + Básicos
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles - Corregido según niveles reales en BD
    // Niveles en BD: Principiante (11), Básico (38), Intermedio (14) = 63 total
    let levelCondition;
    if (dbLevel === 'Intermedio') {
      // Intermedio y Avanzado: Acceso a TODOS los ejercicios (63)
      levelCondition = "nivel IN ('Principiante', 'Básico', 'Intermedio')";
    } else if (dbLevel === 'Principiante') {
      // Principiantes: Solo Principiante + Básico (11 + 38 = 49 ejercicios)
      levelCondition = "nivel IN ('Principiante', 'Básico')";
    } else {
      // Fallback: Principiante
      levelCondition = "nivel IN ('Principiante', 'Básico')";
    }

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, criterio_de_progreso, progresion_desde,
             progresion_hacia, notas
      FROM app."Ejercicios_Heavy_Duty"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios Heavy Duty cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.HEAVY_DUTY_SPECIALIST);
    const config = AI_MODULES.HEAVY_DUTY_SPECIALIST;

    // Construir mensaje para IA
    const userMessage = `GENERACIÓN DE PLAN HEAVY DUTY (Mike Mentzer)

NIVEL: ${actualLevel}
GRUPOS MUSCULARES: ${selectedMuscleGroups?.join(', ') || 'No especificado'}
OBJETIVOS: ${goals || 'No especificado'}

EJERCICIOS DISPONIBLES (${availableExercises.length}):
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.categoria}) - Nivel: ${ex.nivel}, Equipamiento: ${ex.equipamiento}`
).join('\n')}

VERSIÓN: ${versionConfig?.version === 'strict' ? 'ESTRICTA (Mike Mentzer puro)' : 'ADAPTADA (4 semanas)'}
DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS HEAVY DUTY OBLIGATORIOS:
1. Máxima intensidad: 1-2 series al fallo absoluto por ejercicio
2. Mínimo volumen: NO más de 4-6 ejercicios por sesión
3. Descansos prolongados: 4-7 días entre mismo grupo muscular
4. RPE 10/10: Cada serie es al límite absoluto
5. Tempo lento: Énfasis en negativas (4-6 segundos)

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en Heavy Duty de Mike Mentzer. Generas planes de entrenamiento de alta intensidad y bajo volumen.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

El plan DEBE incluir:
- semanas: array de semanas
- cada semana tiene sesiones (días de entrenamiento)
- cada sesión tiene ejercicios con: nombre, series (1-2), repeticiones, intensidad (RPE 10), descanso_seg (180-300), tempo, notas

FORMATO EXACTO:
{
  "metodologia": "Heavy Duty",
  "nivel": "${selectedLevel}",
  "semanas": [
    {
      "numero": 1,
      "sesiones": [
        {
          "dia": "Lunes",
          "grupos_musculares": ["Pecho", "Tríceps"],
          "ejercicios": [
            {
              "nombre": "Press de banca",
              "series": 1,
              "repeticiones": "6-10",
              "intensidad": "RPE 10 - Fallo absoluto",
              "descanso_seg": 300,
              "tempo": "4-1-2",
              "notas": "Serie única al fallo absoluto"
            }
          ]
        }
      ]
    }
  ]
}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.4,
      max_tokens: 4000
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear respuesta
    let generatedPlan;
    try {
      generatedPlan = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando plan:', parseError);
      throw new Error('Plan generado con formato inválido');
    }

    // Validar estructura del plan
    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan sin semanas válidas');
    }

    // Guardar plan en BD
    const client_db = await pool.connect();
    try {
      await client_db.query('BEGIN');

      // Limpiar drafts anteriores
      await cleanUserDrafts(userId, client_db);

      // Insertar plan - Estructura corregida igual que Calistenia
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Heavy Duty', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan Heavy Duty guardado con ID: ${methodologyPlanId}`);

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId,
        planId: methodologyPlanId,
        metadata: {
          model_used: config.model,
          generation_timestamp: new Date().toISOString()
        }
      });

    } catch (dbError) {
      await client_db.query('ROLLBACK');
      throw dbError;
    } finally {
      client_db.release();
    }

  } catch (error) {
    console.error('Error generando plan de Heavy Duty:', error);
    logError('HEAVY_DUTY_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// METODOLOGÍAS AUTOMÁTICAS (IA)
// =========================================

/**
 * POST /api/routine-generation/ai/methodology
 * Generar plan de metodología con IA (gimnasio)
 */
router.post('/ai/methodology', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { versionConfig } = req.body;

    logSeparator('Generación de Plan Metodológico Automático', 'blue');
    logAPICall('/ai/methodology', 'POST', userId);

    // Obtener perfil del usuario
    const perfil = await getUserFullProfile(userId);
    logUserProfile(perfil, userId);

    // Obtener ejercicios recientes
    let exercisesFromDB = [];
    try {
      const recentExercisesResult = await pool.query(
        `SELECT
          exercise_name,
          methodology_type,
          COUNT(*) as usage_count,
          MAX(completed_at) as last_used
        FROM app.methodology_exercise_history_complete
        WHERE user_id = $1
          AND completed_at >= NOW() - INTERVAL '60 days'
        GROUP BY exercise_name, methodology_type
        ORDER BY MAX(completed_at) DESC, COUNT(*) DESC
        LIMIT 30`,
        [userId]
      );

      exercisesFromDB = recentExercisesResult.rows;
      console.log(`Ejercicios recientes encontrados: ${exercisesFromDB.length}`);
    } catch (error) {
      console.error('Error consultando ejercicios:', error);
    }

    logRecentExercises(exercisesFromDB);

    // Obtener cliente OpenAI
    const openai = getOpenAIClient('methodologie');
    if (!openai) {
      throw new Error('Cliente OpenAI no disponible para metodologías');
    }

    // Obtener prompt
    clearPromptCache('methodologie');
    const systemPrompt = await getPrompt('methodologie');
    if (!systemPrompt) {
      throw new Error('Prompt no disponible para metodologías');
    }

    // Preparar contexto de ejercicios
    let exercisesContext = '';
    if (exercisesFromDB.length > 0) {
      exercisesContext = `\n\nHISTORIAL DE EJERCICIOS (últimos 60 días):
${exercisesFromDB.map(ex =>
  `- ${ex.exercise_name}: ${ex.usage_count} veces en ${ex.methodology_type}`
).join('\n')}

REGLAS DE VARIACIÓN:
- PROHIBIDO repetir ejercicios usados más de 4 veces
- EVITAR ejercicios usados 3-4 veces
- PRIORIZAR ejercicios nuevos o poco usados`;
    }

    // Configuración de versión
    const version = versionConfig || {
      selectionMode: 'automatic',
      version: 'adapted',
      userLevel: 'intermedio',
      customWeeks: 4
    };

    const dayInfo = getCurrentDayInfo();

    // Mensaje para IA
    const userMessage = `SISTEMA DE METODOLOGÍAS DE GIMNASIO. Genera plan para GIMNASIO con equipamiento.

Fecha de inicio: ${dayInfo.dayName} (${dayInfo.dateString})
El plan debe comenzar HOY (${dayInfo.dayName}), NO desde Lunes.

CONFIGURACIÓN:
- Versión: ${version.version === 'adapted' ? 'ADAPTADA' : 'ESTRICTA'}
- Duración: ${version.customWeeks || 4} SEMANAS
- Nivel: ${version.userLevel}

PERFIL DEL USUARIO:
- Edad: ${perfil.edad} años
- Peso: ${perfil.peso} kg
- Altura: ${perfil.altura} cm
- Sexo: ${perfil.sexo}
- Nivel: ${perfil.nivel_entrenamiento}
- Objetivo: ${perfil.objetivo_principal}${exercisesContext}

Responde únicamente con el JSON solicitado.`;

    logAIPayload('Metodología Automática', {
      profile: normalizeUserProfile(perfil),
      version_config: version
    });

    // Llamar a OpenAI
    const response = await openai.chat.completions.create({
      model: AI_MODULES.METHODOLOGIE.model,
      temperature: AI_MODULES.METHODOLOGIE.temperature,
      max_tokens: AI_MODULES.METHODOLOGIE.max_output_tokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    const aiContent = response.choices[0].message.content.trim();
    logTokens(response);
    logAIResponse(aiContent, 'Metodología Automática');

    // Parsear respuesta
    const parsedPlan = JSON.parse(parseAIResponse(aiContent));

    if (!parsedPlan.selected_style || !parsedPlan.semanas) {
      throw new Error('Plan inválido: estructura incorrecta');
    }

    // 🧹 LIMPIAR DRAFTS FALLIDOS ANTES DE CREAR PLAN NUEVO
    await cleanUserDrafts(userId);

    // Guardar en BD
    const insertResult = await pool.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      ) VALUES ($1, $2, $3, 'automatic', 'draft', NOW())
      RETURNING id
    `, [userId, parsedPlan.selected_style, JSON.stringify(parsedPlan)]);

    const methodologyPlanId = insertResult.rows[0].id;

    res.json({
      success: true,
      plan: parsedPlan,
      planId: methodologyPlanId,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: AI_MODULES.METHODOLOGIE.model
      }
    });

  } catch (error) {
    console.error('Error en generación de metodología:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// METODOLOGÍAS MANUALES
// =========================================

/**
 * POST /api/routine-generation/manual/methodology
 * Generar plan manual de metodología
 */
router.post('/manual/methodology', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { metodologia_solicitada, versionConfig } = req.body;

    // Validar metodología
    const CANONICAL = {
      'heavy duty': 'Heavy Duty',
      'powerlifting': 'Powerlifting',
      'hipertrofia': 'Hipertrofia',
      'funcional': 'Funcional',
      'oposiciones': 'Oposiciones',
      'crossfit': 'Crossfit',
      'calistenia': 'Calistenia',
      'entrenamiento en casa': 'Entrenamiento en casa'
    };

    const normalize = (s = '') => s
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const canonical = CANONICAL[normalize(metodologia_solicitada)];
    if (!canonical) {
      return res.status(400).json({
        success: false,
        error: 'metodologia_no_permitida',
        permitidas: Object.values(CANONICAL)
      });
    }

    logSeparator(`Generación Manual - ${canonical}`, 'blue');
    logAPICall('/manual/methodology', 'POST', userId);

    // Obtener perfil del usuario
    const user = await getUserFullProfile(userId);
    logUserProfile(user, userId);

    // Obtener ejercicios recientes manuales
    let recentExercises = [];
    try {
      const recentResult = await pool.query(
        `SELECT * FROM app.get_recent_manual_exercises($1, $2, 60)`,
        [userId, canonical]
      );
      recentExercises = recentResult.rows;
    } catch (error) {
      console.log('No se pudieron obtener ejercicios recientes:', error.message);
    }

    logRecentExercises(recentExercises);

    // Preparar datos para IA
    const userData = {
      metodologia_solicitada: canonical,
      versionConfig: versionConfig || {
        selectionMode: 'automatic',
        version: 'adapted',
        userLevel: 'intermedio',
        customWeeks: 4
      },
      edad: user.edad,
      peso: user.peso,
      estatura: user.altura,
      sexo: user.sexo,
      nivel_actividad: user.nivel_actividad,
      suplementacion: user.suplementacion,
      grasa_corporal: user.grasa_corporal,
      masa_muscular: user.masa_muscular,
      nivel_actual_entreno: user.nivel_entrenamiento,
      anos_entrenando: user.anos_entrenando,
      objetivo_principal: user.objetivo_principal,
      ejercicios_recientes: recentExercises.map(ex => ({
        nombre: ex.exercise_name,
        veces_usado: ex.usage_count,
        ultimo_uso: ex.last_used
      }))
    };

    logAIPayload(canonical, userData);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.METHODOLOGIE_MANUAL);
    const config = AI_MODULES.METHODOLOGIE_MANUAL;

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: JSON.stringify(userData) }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      response_format: { type: 'json_object' }
    });

    const aiResponse = response.choices[0].message.content;
    logTokens(response);
    logAIResponse(aiResponse, canonical);

    const planData = JSON.parse(aiResponse);

    if (planData.selected_style !== canonical) {
      throw new Error('La IA no generó la metodología solicitada');
    }

    // 🧹 LIMPIAR DRAFTS FALLIDOS ANTES DE CREAR PLAN NUEVO
    await cleanUserDrafts(userId);

    // Guardar en BD como activo
    const insertResult = await pool.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, confirmed_at, created_at
      ) VALUES ($1, $2, $3, 'manual', 'active', NOW(), NOW())
      RETURNING id
    `, [userId, canonical, JSON.stringify(planData)]);

    const methodologyPlanId = insertResult.rows[0].id;

    // Registrar ejercicios en historial manual
    try {
      await pool.query(
        'SELECT app.register_manual_plan_exercises($1, $2, $3, $4)',
        [userId, canonical, JSON.stringify(planData), methodologyPlanId]
      );
    } catch (error) {
      console.log('Error registrando ejercicios:', error.message);
    }

    res.json({
      success: true,
      plan: planData,
      planId: methodologyPlanId,
      message: `Plan de ${metodologia_solicitada} generado exitosamente`
    });

  } catch (error) {
    console.error('Error en generación manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/manual/calistenia
 * Generar plan manual de calistenia
 */
router.post('/manual/calistenia', authenticateToken, async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { level, goals } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener perfil del usuario
    const userProfile = await getUserFullProfile(userId);
    console.log('Generando plan manual de calistenia');

    // Obtener ejercicios del nivel
    const levelCapitalized = level.charAt(0).toUpperCase() + level.slice(1);
    const exercisesQuery = await client.query(`
      SELECT exercise_id, nombre, categoria, patron, equipamiento,
             series_reps_objetivo, criterio_de_progreso, progresion_desde,
             progresion_hacia, notas
      FROM app."Ejercicios_Calistenia"
      WHERE nivel = $1
      ORDER BY RANDOM()
    `, [levelCapitalized]);

    const availableExercises = exercisesQuery.rows;
    console.log(`Ejercicios encontrados: ${availableExercises.length}`);

    // Obtener historial
    const historyQuery = await client.query(`
      SELECT DISTINCT exercise_name, MAX(completed_at) as last_completed
      FROM app.methodology_exercise_history_complete
      WHERE user_id = $1
        AND methodology_type IN ('Calistenia', 'Calistenia Manual')
      GROUP BY exercise_name
      ORDER BY last_completed DESC
      LIMIT 50
    `, [userId]);

    const userHistory = historyQuery.rows;

    // Configurar inicio de rutina
    const dayInfo = getCurrentDayInfo();

    const promptContext = `
INICIO DE RUTINA: ${dayInfo.dayName} (${dayInfo.dateString})
El plan debe comenzar HOY (${dayInfo.dayName}), NO desde Lunes.

PERFIL DEL USUARIO:
- Edad: ${userProfile.edad}
- Peso: ${userProfile.peso} kg
- Altura: ${userProfile.altura} cm
- Nivel: ${levelCapitalized}
- Objetivo: ${goals || 'Progresión general'}

EJERCICIOS DISPONIBLES:
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.categoria}): ${ex.series_reps_objetivo}`
).join('\n')}

HISTORIAL:
${userHistory.length > 0 ?
  userHistory.map(h => `- ${h.exercise_name}`).join('\n')
  : 'Sin historial'
}

INSTRUCCIONES:
1. Genera plan de 4 semanas
2. USA SOLO ejercicios disponibles
3. Comienza desde ${dayInfo.dayName}
4. Formato JSON estructurado`;

    // Obtener configuración y prompt
    const aiConfig = AI_MODULES.METHODOLOGIE_MANUAL;
    const systemPrompt = await getPrompt('calistenia_manual') ||
      'Eres un entrenador experto en calistenia. Genera planes personalizados.';

    // Llamar a OpenAI
    const openaiApiKey = process.env[aiConfig.envKey];
    if (!openaiApiKey) {
      throw new Error('API key no configurada');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptContext }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    const aiResponse = await response.json();
    const generatedPlan = aiResponse.choices[0].message.content;

    // Parsear JSON
    let parsedPlan;
    const jsonMatch = generatedPlan.match(/```json\s*([\s\S]*?)\s*```/) ||
                     generatedPlan.match(/{[\s\S]*}/);

    if (jsonMatch) {
      parsedPlan = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } else {
      throw new Error('No se pudo parsear el plan generado');
    }

    // 🧹 LIMPIAR DRAFTS FALLIDOS ANTES DE CREAR PLAN NUEVO
    await cleanUserDrafts(userId, client);

    // Guardar en BD
    const insertResult = await client.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `, [userId, 'Calistenia Manual', JSON.stringify(parsedPlan), 'manual', 'draft']);

    const planId = insertResult.rows[0].id;

    await client.query('COMMIT');

    res.json({
      success: true,
      planId,
      plan: parsedPlan,
      message: 'Plan de calistenia manual generado'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generando plan manual de calistenia:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// =========================================
// RUTINAS DE GIMNASIO (IA)
// =========================================

/**
 * POST /api/routine-generation/ai/gym-routine
 * Generar rutina de gimnasio con IA (sin guardar en BD)
 */
router.post('/ai/gym-routine', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      methodology,
      duration_weeks = 4,
      frequency_per_week = 3,
      focus_areas = [],
      experience_level = 'intermedio'
    } = req.body;

    if (!methodology) {
      return res.status(400).json({
        success: false,
        error: 'Metodología requerida'
      });
    }

    console.log(`Generando rutina de gimnasio: ${methodology}`);

    // Obtener perfil del usuario
    const userProfile = await getUserFullProfile(userId);

    // Obtener historial de ejercicios
    const historyResult = await pool.query(`
      SELECT DISTINCT exercise_name, COUNT(*) as frequency
      FROM app.exercise_history
      WHERE user_id = $1
        AND used_at >= NOW() - INTERVAL '30 days'
      GROUP BY exercise_name
      ORDER BY frequency DESC
      LIMIT 20
    `, [userId]);

    const recentExercises = historyResult.rows;

    // Preparar prompt
    const systemPrompt = `Eres un entrenador experto en rutinas de gimnasio.

GENERA una rutina de ${duration_weeks} semanas, ${frequency_per_week}x/semana.
Metodología: ${methodology}
Nivel: ${experience_level}

FORMATO JSON:
{
  "routine_name": "Nombre",
  "methodology": "${methodology}",
  "duration_weeks": ${duration_weeks},
  "frequency_per_week": ${frequency_per_week},
  "weeks": [
    {
      "week_number": 1,
      "days": [
        {
          "day_number": 1,
          "exercises": [
            {
              "name": "Ejercicio",
              "sets": 4,
              "reps": "8-10",
              "weight": "75% 1RM",
              "rest": "2-3 min"
            }
          ]
        }
      ]
    }
  ]
}`;

    const userMessage = `Genera rutina para:
- Edad: ${userProfile.edad}
- Peso: ${userProfile.peso}kg
- Objetivo: ${userProfile.objetivo_principal}
- Áreas enfoque: ${focus_areas.join(', ')}

Evitar ejercicios recientes:
${recentExercises.map(ex => `- ${ex.exercise_name}`).join('\n')}`;

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.METHODOLOGIE);
    const completion = await client.chat.completions.create({
      model: AI_MODULES.METHODOLOGIE.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 4000
    });

    const routinePlan = JSON.parse(completion.choices[0].message.content);

    res.json({
      success: true,
      routine: routinePlan,
      metadata: {
        generated_at: new Date().toISOString(),
        methodology,
        ai_model: AI_MODULES.METHODOLOGIE.model
      }
    });

  } catch (error) {
    console.error('Error generando rutina de gimnasio:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando rutina',
      message: error.message
    });
  }
});

// =========================================
// ENDPOINTS AUXILIARES
// =========================================

/**
 * GET /api/routine-generation/methodologies
 * Obtener metodologías disponibles
 */
router.get('/methodologies', (req, res) => {
  const methodologies = [
    { id: 'heavy_duty', name: 'Heavy Duty', description: 'Alta intensidad, bajo volumen', category: 'strength' },
    { id: 'powerlifting', name: 'Powerlifting', description: 'Fuerza máxima en básicos', category: 'strength' },
    { id: 'hipertrofia', name: 'Hipertrofia', description: 'Crecimiento muscular', category: 'muscle' },
    { id: 'funcional', name: 'Funcional', description: 'Movimientos naturales', category: 'functional' },
    { id: 'oposiciones', name: 'Oposiciones', description: 'Preparación física específica', category: 'specific' },
    { id: 'crossfit', name: 'CrossFit', description: 'Entrenamiento variado e intenso', category: 'mixed' },
    { id: 'calistenia', name: 'Calistenia', description: 'Peso corporal y progresiones', category: 'bodyweight' },
    { id: 'entrenamiento_casa', name: 'Entrenamiento en casa', description: 'Mínimo equipamiento', category: 'home' },
    { id: 'push_pull_legs', name: 'Push/Pull/Legs', description: 'División por movimientos', category: 'split' },
    { id: 'upper_lower', name: 'Upper/Lower', description: 'División tren superior/inferior', category: 'split' },
    { id: 'full_body', name: 'Full Body', description: 'Cuerpo completo', category: 'full' },
    { id: 'weider', name: 'Weider', description: 'División por músculos', category: 'split' }
  ];

  res.json({
    success: true,
    methodologies,
    total: methodologies.length,
    categories: [...new Set(methodologies.map(m => m.category))]
  });
});

/**
 * GET /api/routine-generation/calistenia/levels
 * Obtener niveles disponibles de calistenia
 */
router.get('/calistenia/levels', (req, res) => {
  const levels = [
    {
      id: 'basico',
      name: 'Básico',
      description: 'Principiantes: 0-1 años experiencia',
      frequency: '3 días/semana',
      duration: '30 minutos/sesión',
      hitos: [
        '10 flexiones correctas',
        '5 dominadas',
        '30 segundos plancha',
        'Sentadillas con buena forma'
      ]
    },
    {
      id: 'intermedio',
      name: 'Intermedio',
      description: 'Experiencia: 1-3 años',
      frequency: '4 días/semana',
      duration: '45 minutos/sesión',
      hitos: [
        '20 flexiones seguidas',
        '10 dominadas',
        '60 segundos plancha',
        'Pistol squats asistidas'
      ]
    },
    {
      id: 'avanzado',
      name: 'Avanzado',
      description: 'Expertos: +3 años',
      frequency: '5 días/semana',
      duration: '60 minutos/sesión',
      hitos: [
        'Muscle-ups',
        'Handstand push-ups',
        'Front/Back lever',
        'Pistol squats libres'
      ]
    }
  ];

  res.json({
    success: true,
    levels,
    total: levels.length
  });
});

/**
 * GET /api/routine-generation/user/current-plan
 * Obtener plan activo actual del usuario
 */
router.get('/user/current-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    const query = `
      SELECT id, user_id, methodology_type, plan_data, generation_mode, status, created_at
      FROM app.methodology_plans
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasPlan: false,
        message: 'No hay plan activo'
      });
    }

    const plan = result.rows[0];

    res.json({
      success: true,
      hasPlan: true,
      plan: {
        id: plan.id,
        methodology_type: plan.methodology_type,
        plan_data: plan.plan_data,
        generation_mode: plan.generation_mode,
        created_at: plan.created_at
      }
    });

  } catch (error) {
    console.error('Error obteniendo plan actual:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo plan',
      message: error.message
    });
  }
});

/**
 * GET /api/routine-generation/health
 * Health check del servicio consolidado
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Routine Generation Unified',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      ai: [
        'POST /api/routine-generation/ai/methodology',
        'POST /api/routine-generation/ai/gym-routine'
      ],
      manual: [
        'POST /api/routine-generation/manual/methodology',
        'POST /api/routine-generation/manual/calistenia'
      ],
      specialist: [
        'POST /api/routine-generation/specialist/calistenia/evaluate',
        'POST /api/routine-generation/specialist/calistenia/generate'
      ],
      auxiliary: [
        'GET /api/routine-generation/methodologies',
        'GET /api/routine-generation/calistenia/levels',
        'GET /api/routine-generation/user/current-plan'
      ]
    }
  });
});

export default router;