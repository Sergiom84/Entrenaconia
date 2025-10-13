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

import process from 'node:process';
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
 * Normaliza planes de entrenamiento en casa para mantener compatibilidad con componentes existentes.
 */
function normalizeCasaPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return plan;
  }

  if (Array.isArray(plan.semanas)) {
    plan.semanas = plan.semanas.map((semana) => {
      const sesiones = Array.isArray(semana.sesiones) ? semana.sesiones : [];
      const normalizedSesiones = sesiones.map((sesion) => {
        const bloques = Array.isArray(sesion.bloques) ? sesion.bloques : [];
        let ejercicios = Array.isArray(sesion.ejercicios) ? sesion.ejercicios : [];

        if ((Array.isArray(ejercicios) ? ejercicios.length : 0) === 0 && bloques.length > 0) {
          ejercicios = bloques.reduce((acc, bloque) => {
            if (Array.isArray(bloque.ejercicios)) {
              return acc.concat(bloque.ejercicios);
            }
            return acc;
          }, []);
        }

        if (!Array.isArray(ejercicios)) {
          ejercicios = [];
        }

        return {
          ...sesion,
          bloques,
          ejercicios
        };
      });

      return {
        ...semana,
        sesiones: normalizedSesiones
      };
    });
  }

  return plan;
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
// CROSSFIT HELPER FUNCTIONS
// =========================================

/**
 * Parse duration to minutes (CrossFit)
 */
const parseDurationToMinutes = (value) => {
  if (!value) return 45;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value);
  const minuteMatch = text.match(/(\d+)\s*(?:min|mins|minutes)/i);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const numeric = parseInt(text, 10);
  return Number.isNaN(numeric) ? 45 : numeric;
};

/**
 * Parse rest to seconds (CrossFit)
 */
const parseRestToSeconds = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value);
  const secondMatch = text.match(/(\d+)\s*(?:seg|sec(?:s)?|s)/i);
  if (secondMatch) {
    return Number(secondMatch[1]);
  }

  const minuteMatch = text.match(/(\d+)\s*(?:min)/i);
  if (minuteMatch) {
    return Number(minuteMatch[1]) * 60;
  }

  const numeric = parseInt(text, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

/**
 * Extract series and reps from CrossFit movement (CrossFit)
 */
const extractSeriesAndReps = (movement = {}) => {
  let series = movement.series;
  let reps = movement.repeticiones;

  if (!series || !reps) {
    const job = movement.trabajo || movement.work || "";
    const setRepMatch = job.match(/(\d+)\s*[xX×]\s*(\d+)/i);

    if (setRepMatch) {
      if (!series) series = Number(setRepMatch[1]);
      if (!reps) reps = Number(setRepMatch[2]);
    }

    if (!reps) {
      const repsMatch = job.match(/(\d+)\s*(?:reps?|repeticiones)/i);
      if (repsMatch) reps = Number(repsMatch[1]);
    }

    if (!series) {
      const roundsMatch = job.match(/(\d+)\s*(?:rounds?)/i);
      if (roundsMatch) series = Number(roundsMatch[1]);
    }
  }

  return {
    series: series || 1,
    repeticiones: reps || movement.trabajo || movement.work || "Ver descripcion"
  };
};

/**
 * Normalize CrossFit plan from calendario format to semanas format
 * Converts CrossFit-specific structure (calendario with WODs) to standard methodology format
 */
const normalizeCrossFitPlan = (plan) => {
  // If plan already has semanas or doesn't have calendario, return as-is
  if (!plan || plan.semanas || !Array.isArray(plan.calendario)) {
    return plan;
  }

  const semanas = plan.calendario.map((week, weekIndex) => {
    const dias = Array.isArray(week?.dias) ? week.dias : [];
    const sesiones = dias.map((day, dayIndex) => {
      const wod = day?.wod || {};
      const movimientos = Array.isArray(wod.movimientos) ? wod.movimientos : [];
      const ejercicios = movimientos.map((movement, movementIndex) => {
        const { series, repeticiones } = extractSeriesAndReps(movement);
        return {
          id: `cf-${weekIndex + 1}-${dayIndex + 1}-${movementIndex + 1}`,
          nombre: movement.nombre || `Movimiento ${movementIndex + 1}`,
          series,
          repeticiones,
          descanso_seg: parseRestToSeconds(movement.descanso_seg ?? movement.descanso),
          descripcion: movement.descripcion || movement.trabajo || movement.work || "",
          carga: movement.carga || movement.peso || null,
          intensidad: movement.intensidad || null,
          equipamiento: movement.equipamiento || null,
          notas: movement.notas || "",
          tempo: movement.tempo || null,
          variante: movement.variante || null
        };
      });

      const variantes = wod.scaling && typeof wod.scaling === "object"
        ? Object.entries(wod.scaling).map(([nivel, descripcion]) => ({
          nivel,
          descripcion
        }))
        : [];

      return {
        id: `cf-${weekIndex + 1}-${dayIndex + 1}`,
        dia: day?.dia || `Dia ${dayIndex + 1}`,
        titulo: wod.tipo ? `${wod.tipo}${day?.enfoque ? ` - ${day.enfoque}` : ""}` : (day?.enfoque || `Sesion ${dayIndex + 1}`),
        tipo: wod.tipo || day?.tipo || "WOD",
        enfoque: day?.enfoque || null,
        descripcion: wod.descripcion || "",
        objetivo_de_la_sesion: wod.objetivo_rounds || wod.objetivo || day?.objetivo || "",
        estrategia: wod.estrategia || "",
        duracion_sesion_min: parseDurationToMinutes(wod.duracion || day?.duracion),
        intensidad: wod.intensidad || null,
        variantes,
        ejercicios
      };
    });

    return {
      semana: week?.semana || weekIndex + 1,
      fase: week?.fase || null,
      sesiones
    };
  });

  return {
    ...plan,
    metodologia: plan.metodologia || "CrossFit",
    semanas,
    duracion_total_semanas: plan.duracion_total_semanas || plan.duracion_semanas || semanas.length,
    frecuencia_semanal: plan.frecuencia_semanal || (semanas[0]?.sesiones?.length || 0)
  };
};

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
      WHERE LOWER(nivel) = 'principiante'
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
        principiante: 'Principiantes: 0-1 años experiencia, enfoque en técnica básica',
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
  "recommended_level": "principiante|intermedio|avanzado",
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
      'principiante': 'Principiante',
      'basico': 'Principiante', // Alias para compatibilidad
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[selectedLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles
    let levelCondition;
    if (dbLevel === 'Avanzado') {
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      levelCondition = "nivel = 'Principiante'";
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
             series_reps_objetivo, descanso_seg, criterio_de_progreso,
             progresion_desde, progresion_hacia, notas
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
  `- ${ex.nombre} (${ex.categoria}) - Nivel: ${ex.nivel}, Equipamiento: ${ex.equipamiento}, Descanso: ${ex.descanso_seg}s`
).join('\n')}

VERSIÓN: ${versionConfig?.version === 'strict' ? 'ESTRICTA (Mike Mentzer puro)' : 'ADAPTADA (4 semanas)'}
DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS HEAVY DUTY OBLIGATORIOS:
1. Máxima intensidad: 1-2 series al fallo absoluto por ejercicio
2. Mínimo volumen: NO más de 4-6 ejercicios por sesión
3. Descansos prolongados: 4-7 días entre mismo grupo muscular
4. RPE 10/10: Cada serie es al límite absoluto
5. Tempo lento: Énfasis en negativas (4-6 segundos)
6. IMPORTANTE: Usa los valores de descanso_seg especificados para cada ejercicio (240-360s según nivel)

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
      max_tokens: config.max_output_tokens  // 16384 tokens para planes completos
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
// 🏋️ HIPERTROFIA SPECIALIST
// =========================================

/**
 * POST /api/routine-generation/specialist/hipertrofia/evaluate
 * Evaluación de perfil para Hipertrofia con IA
 */
router.post('/specialist/hipertrofia/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('HIPERTROFIA PROFILE EVALUATION');
    logAPICall('/specialist/hipertrofia/evaluate', 'POST', userId);

    // 🔄 PATRÓN ESTANDARIZADO: Obtener perfil siempre desde BD (igual que Calistenia)
    const userProfile = await getUserFullProfile(userId);
    const fullUserProfile = normalizeUserProfile(userProfile);

    logUserProfile(fullUserProfile, userId);

    // Preparar payload para IA (patrón estandarizado igual a Calistenia)
    const aiPayload = {
      task: 'evaluate_hipertrofia_level',
      user_profile: {
        ...fullUserProfile
      },
      evaluation_criteria: [
        'Años de entrenamiento con pesas (años_entrenando)',
        'Nivel de entrenamiento actual (nivel_entrenamiento)',
        'Objetivo principal de hipertrofia muscular',
        'Tolerancia al volumen de entrenamiento',
        'Capacidad de recuperación (edad, nivel_actividad)',
        'Limitaciones físicas o lesiones',
        'Composición corporal actual (grasa_corporal, masa_muscular)'
      ],
      level_descriptions: {
        principiante: 'Principiantes: 0-1 años con pesas, volumen moderado (10-15 series/músculo/semana)',
        intermedio: 'Intermedio: 1-3 años, tolerancia media-alta al volumen (15-20 series/músculo/semana)',
        avanzado: 'Avanzado: +3 años, periodización avanzada, alto volumen (20-25 series/músculo/semana)'
      }
    };

    logAIPayload('HIPERTROFIA_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.HIPERTROFIA_SPECIALIST);
    const config = AI_MODULES.HIPERTROFIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en entrenamiento de hipertrofia muscular que evalúa perfiles de usuarios.

INSTRUCCIONES:
- Evalúa objetivamente la experiencia y condición física
- Sé realista con la confianza (escala 0.0-1.0, no siempre 1.0)
- Presta especial atención a años_entrenando y nivel_entrenamiento del perfil
- Proporciona razonamiento detallado y factores clave
- Sugiere áreas de enfoque específicas (grupos musculares)
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA (OBLIGATORIO):
{
  "recommended_level": "principiante|intermedio|avanzado",
  "confidence": 0.75,
  "reasoning": "Explicación detallada del nivel recomendado basada en datos del perfil",
  "key_indicators": ["Factor 1 detectado en perfil", "Factor 2", "Factor 3"],
  "suggested_focus_areas": ["Pecho", "Espalda", "Piernas", etc.],
  "split_suggestion": "full_body|upper_lower|push_pull_legs",
  "weekly_frequency": 3-6,
  "volume_tolerance": "baja|media|alta"
}`
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload)
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear respuesta
    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando evaluación:', parseError);
      throw new Error('Evaluación con formato inválido');
    }

    // 🔄 NORMALIZAR RESPUESTA (formato estandarizado igual a Calistenia)
    const normalizedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    res.json({
      success: true,
      evaluation: {
        recommended_level: normalizedLevel,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning || 'No especificado',
        key_indicators: evaluation.key_indicators || [],
        suggested_focus_areas: evaluation.suggested_focus_areas || [],
        split_suggestion: evaluation.split_suggestion || 'full_body',
        weekly_frequency: evaluation.weekly_frequency || 3,
        volume_tolerance: evaluation.volume_tolerance || 'media'
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en evaluación de Hipertrofia:', error);
    logError('HIPERTROFIA_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/hipertrofia/generate
 * Generación de plan especializado de Hipertrofia con IA
 */
router.post('/specialist/hipertrofia/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Extracción flexible: Soporte para hipertrofiaData (anidado) o datos en root
    const hipertrofiaData = req.body.hipertrofiaData || req.body;
    const {
      userProfile,
      level,
      selectedLevel,
      goals,
      selectedMuscleGroups,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = hipertrofiaData;

    // Mapear level → selectedLevel
    const actualLevel = selectedLevel || level;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('HIPERTROFIA PLAN GENERATION');
    console.log('Generando plan de Hipertrofia...', {
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

    // Mapear nivel - Niveles estandarizados
    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles
    // Sistema de acceso progresivo: cada nivel accede a ejercicios de niveles inferiores también
    let levelCondition;
    if (dbLevel === 'Avanzado') {
      // Avanzado: Acceso a TODOS los ejercicios
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      // Intermedio: Principiante + Intermedio
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      // Principiante: Solo Principiante
      levelCondition = "nivel = 'Principiante'";
    }

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria as grupo_muscular, patron,
             equipamiento, series_reps_objetivo, descanso_seg,
             criterio_de_progreso, progresion_desde, progresion_hacia,
             notas, ejecucion, consejos, errores_evitar
      FROM app."Ejercicios_Hipertrofia"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios Hipertrofia cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.HIPERTROFIA_SPECIALIST);
    const config = AI_MODULES.HIPERTROFIA_SPECIALIST;

    // Construir mensaje para IA
    const userMessage = `GENERACIÓN DE PLAN DE HIPERTROFIA

NIVEL: ${actualLevel}
GRUPOS MUSCULARES: ${selectedMuscleGroups?.join(', ') || 'Todos'}
OBJETIVOS: ${goals || 'Hipertrofia muscular general'}

EJERCICIOS DISPONIBLES (${availableExercises.length}):
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.grupo_muscular}) - Nivel: ${ex.nivel}, Equipamiento: ${ex.equipamiento}, Series/Reps: ${ex.series_reps_objetivo}, Descanso: ${ex.descanso_seg}s`
).join('\n')}

DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS DE HIPERTROFIA OBLIGATORIOS:
1. Volumen óptimo: ${actualLevel === 'principiante' ? '10-15' : actualLevel === 'intermedio' ? '15-20' : '20-25'} series por grupo muscular/semana
2. Intensidad: ${actualLevel === 'principiante' ? '60-75% 1RM' : actualLevel === 'intermedio' ? '70-85% 1RM' : '75-90% 1RM'}
3. Rangos de repeticiones: ${actualLevel === 'principiante' ? '8-12 reps' : actualLevel === 'intermedio' ? '6-15 reps' : '4-20 reps'}
4. Frecuencia: ${actualLevel === 'principiante' ? '3-4' : actualLevel === 'intermedio' ? '4-5' : '5-6'} días/semana
5. Descanso entre series: Usa los valores de descanso_seg especificados para cada ejercicio (60-90s según patrón)
6. Progresión: Sobrecarga progresiva en peso y/o volumen

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en hipertrofia muscular. Generas planes de entrenamiento basados en principios científicos de volumen, intensidad y frecuencia óptima.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

El plan DEBE incluir:
- semanas: array de semanas
- cada semana tiene sesiones (días de entrenamiento)
- cada sesión tiene ejercicios con: nombre, series, repeticiones, intensidad (% 1RM o RPE), descanso_seg, tempo, notas

FORMATO EXACTO:
{
  "metodologia": "Hipertrofia",
  "nivel": "${actualLevel}",
  "duracion_semanas": 4,
  "frecuencia_semanal": 4,
  "tipo_split": "upper_lower",
  "semanas": [
    {
      "numero": 1,
      "sesiones": [
        {
          "dia": "Lunes",
          "tipo": "Upper",
          "grupos_musculares": ["Pecho", "Espalda", "Hombros"],
          "ejercicios": [
            {
              "nombre": "Press banca plano",
              "series": 4,
              "repeticiones": "8-12",
              "intensidad": "75% 1RM",
              "descanso_seg": 90,
              "tempo": "3-0-1-0",
              "notas": "Enfoque en contracción del pecho"
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
      max_tokens: config.max_output_tokens  // 16384 tokens para planes completos
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

      // Insertar plan
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Hipertrofia', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan Hipertrofia guardado con ID: ${methodologyPlanId}`);

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
    console.error('Error generando plan de Hipertrofia:', error);
    logError('HIPERTROFIA_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// POWERLIFTING SPECIALIST (IA)
// =========================================

/**
 * POST /api/routine-generation/specialist/powerlifting/evaluate
 * Evaluación automática del perfil para powerlifting
 */
router.post('/specialist/powerlifting/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('POWERLIFTING PROFILE EVALUATION');
    logAPICall('/specialist/powerlifting/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.POWERLIFTING_SPECIALIST);
    const config = AI_MODULES.POWERLIFTING_SPECIALIST;

    const aiPayload = {
      user_profile: normalizedProfile,
      evaluation_type: 'powerlifting_level',
      task: 'Determinar nivel de powerlifting (novato, intermedio, avanzado, elite) basado en experiencia, fuerza relativa y objetivos competitivos'
    };

    logAIPayload(aiPayload);

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un evaluador especializado en Powerlifting. Analiza el perfil del usuario y determina su nivel de powerlifting.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

Niveles válidos: novato, intermedio, avanzado, elite

Criterios:
- Novato: 0-6 meses, ratios fuerza 1.0-1.25x (squat), 0.6-0.75x (bench), 1.25-1.5x (deadlift)
- Intermedio: 6m-2 años, ratios 1.5-2.0x, 1.0-1.25x, 1.75-2.25x
- Avanzado: 2-5 años, ratios 2.0-2.5x, 1.25-1.5x, 2.25-2.75x
- Elite: +5 años competitivo, ratios 2.5x+, 1.5x+, 2.75x+

FORMATO EXACTO:
{
  "recommended_level": "novato|intermedio|avanzado|elite",
  "confidence": 0.75,
  "reasoning": "Explicación detallada",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Sentadilla", "Press Banca", "Peso Muerto"],
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
    console.error('Error en evaluación de Powerlifting:', error);
    logError('POWERLIFTING_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/powerlifting/generate
 * Generación de plan especializado de Powerlifting con IA
 */
router.post('/specialist/powerlifting/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Extracción flexible de datos
    const powerliftingData = req.body.powerliftingData || req.body;
    const {
      userProfile,
      level,
      selectedLevel,
      goals,
      selectedMuscleGroups,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = powerliftingData;

    // Mapear level → selectedLevel
    const actualLevel = selectedLevel || level;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('POWERLIFTING PLAN GENERATION');
    console.log('Generando plan de Powerlifting...', {
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

    // Mapear nivel - Normalizado después de estandarización de BD
    const levelMapping = {
      'novato': 'Principiante',       // Normalizado: Novato → Principiante
      'principiante': 'Principiante', // Alias
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado',
      'elite': 'Elite'
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles - Powerlifting tiene niveles progresivos
    let levelCondition;
    if (dbLevel === 'Elite') {
      // Elite: Acceso a TODOS los ejercicios
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado', 'Elite')";
    } else if (dbLevel === 'Avanzado') {
      // Avanzado: Principiante + Intermedio + Avanzado
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      // Intermedio: Principiante + Intermedio
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      // Principiante: Solo ejercicios básicos
      levelCondition = "nivel = 'Principiante'";
    }

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, intensidad, descanso_seg, notas
      FROM app."Ejercicios_Powerlifting"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios Powerlifting cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.POWERLIFTING_SPECIALIST);
    const config = AI_MODULES.POWERLIFTING_SPECIALIST;

    // Construir mensaje para IA
    const userMessage = `GENERACIÓN DE PLAN POWERLIFTING

NIVEL: ${actualLevel}
LEVANTAMIENTOS PRIORITARIOS: ${selectedMuscleGroups?.join(', ') || 'Sentadilla, Press Banca, Peso Muerto'}
OBJETIVOS: ${goals || 'Maximizar fuerza en los 3 levantamientos'}

EJERCICIOS DISPONIBLES (${availableExercises.length}):
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.categoria}) - Nivel: ${ex.nivel}, Equipamiento: ${ex.equipamiento}, Intensidad: ${ex.intensidad}`
).join('\n')}

DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS POWERLIFTING OBLIGATORIOS:
1. Fuerza máxima: 75-95% 1RM en levantamientos principales
2. Bajo volumen: 3-8 series por ejercicio principal
3. Descansos largos: 3-7 minutos entre series pesadas
4. Especificidad: Sentadilla, Press Banca y Peso Muerto son prioritarios
5. Periodización: ${actualLevel === 'novato' ? 'Linear' : actualLevel === 'intermedio' ? 'Ondulante' : actualLevel === 'avanzado' ? 'Bloques' : 'Conjugate'}

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en Powerlifting. Generas planes de entrenamiento para maximizar fuerza en Sentadilla, Press Banca y Peso Muerto.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

El plan DEBE incluir:
- semanas: array de semanas
- cada semana tiene sesiones (días de entrenamiento)
- cada sesión tiene ejercicios con: nombre, series (3-10), repeticiones (1-10), intensidad (% 1RM), descanso_seg (180-420), tempo, notas

FORMATO EXACTO:
{
  "metodologia": "Powerlifting",
  "nivel_powerlifting": "${actualLevel}",
  "periodizacion_tipo": "${actualLevel === 'novato' ? 'linear' : actualLevel === 'intermedio' ? 'ondulante' : actualLevel === 'avanzado' ? 'bloques' : 'conjugate'}",
  "objetivos_fuerza": {
    "sentadilla_objetivo_kg": <número>,
    "press_banca_objetivo_kg": <número>,
    "peso_muerto_objetivo_kg": <número>
  },
  "semanas": [
    {
      "semana": 1,
      "fase": "Adaptación|Acumulación|Intensificación",
      "sesiones": [
        {
          "dia": "Lunes",
          "enfoque_principal": "Sentadilla|Press Banca|Peso Muerto",
          "ejercicios": [
            {
              "nombre": "<nombre exacto de BD>",
              "tipo": "principal|variante|asistencia",
              "series": <número>,
              "repeticiones": "<rango>",
              "intensidad": "<%% 1RM>",
              "descanso_seg": <180-420>,
              "tempo": "X-0-X-0",
              "notas": "<cues técnicos>"
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
      max_tokens: config.max_output_tokens  // 16384 tokens para planes completos
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

      // Insertar plan
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Powerlifting', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan Powerlifting guardado con ID: ${methodologyPlanId}`);

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
    console.error('Error generando plan de Powerlifting:', error);
    logError('POWERLIFTING_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// CROSSFIT SPECIALIST (IA)
// =========================================

/**
 * POST /api/routine-generation/specialist/crossfit/evaluate
 * Evaluación automática del perfil para CrossFit
 */
router.post('/specialist/crossfit/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('CROSSFIT PROFILE EVALUATION');
    logAPICall('/specialist/crossfit/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.CROSSFIT_SPECIALIST);
    const config = AI_MODULES.CROSSFIT_SPECIALIST;

    const aiPayload = {
      user_profile: normalizedProfile,
      evaluation_type: 'crossfit_level',
      task: 'Determinar nivel de CrossFit (principiante/intermedio/avanzado/elite) basado en las 10 habilidades físicas generales y experiencia en los 3 dominios metabólicos'
    };

    logAIPayload(aiPayload);

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un evaluador especializado en CrossFit Level-2. Analiza el perfil del usuario y determina su nivel de CrossFit.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

Niveles válidos: principiante, intermedio, avanzado, elite

Criterios basados en las 10 habilidades físicas y experiencia:
- Principiante (Scaled): 0-12 meses de CrossFit, aprendiendo movimientos base, necesita scaling
- Intermedio (RX): 1-3 años, completa WODs RX, pull-ups, double-unders, cargas estándar (95/65 thrusters)
- Avanzado (RX+): 3-5 años, muscle-ups, HSPUs, cargas pesadas, tiempos competitivos
- Elite: 5+ años competitivo, Open/Quarterfinals, domina movimientos avanzados, levantamientos élite

FORMATO EXACTO:
{
  "recommended_level": "principiante|intermedio|avanzado|elite",
  "confidence": 0.75,
  "reasoning": "Explicación detallada basada en las 10 habilidades",
  "key_indicators": ["Factor 1", "Factor 2"],
  "suggested_focus_areas": ["Gymnastic", "Weightlifting", "Monostructural"],
  "safety_considerations": ["Advertencia 1", "Advertencia 2"],
  "benchmark_targets": {
    "fran": "Sub-8 min",
    "helen": "Sub-12 min",
    "back_squat": "1.5x BW"
  }
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
        safety_considerations: evaluation.safety_considerations || [],
        benchmark_targets: evaluation.benchmark_targets || {}
      },
      metadata: {
        model_used: config.model,
        evaluation_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en evaluación de CrossFit:', error);
    logError('CROSSFIT_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/crossfit/generate
 * Generación de plan especializado de CrossFit con IA
 */
router.post('/specialist/crossfit/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Extracción flexible de datos
    const crossfitData = req.body.crossfitData || req.body;
    const {
      userProfile,
      level,
      selectedLevel,
      goals,
      selectedDomains,  // CrossFit usa dominios en lugar de muscle groups
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = crossfitData;

    // Mapear level → selectedLevel
    const actualLevel = selectedLevel || level;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('CROSSFIT PLAN GENERATION');
    console.log('Generando plan de CrossFit...', {
      selectedLevel: actualLevel,
      selectedDomains,
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

    // Mapear nivel - Normalizado con nomenclatura CrossFit
    const levelMapping = {
      'principiante': 'Principiante',  // Scaled
      'scaled': 'Principiante',        // Alias CrossFit
      'intermedio': 'Intermedio',      // RX
      'rx': 'Intermedio',              // Alias CrossFit
      'avanzado': 'Avanzado',          // RX+
      'rx+': 'Avanzado',               // Alias CrossFit
      'elite': 'Elite'
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles - CrossFit tiene niveles progresivos
    let levelCondition;
    if (dbLevel === 'Elite') {
      // Elite: Acceso a TODOS los ejercicios (~120)
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado', 'Elite')";
    } else if (dbLevel === 'Avanzado') {
      // Avanzado (RX+): Principiante + Intermedio + Avanzado
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      // Intermedio (RX): Principiante + Intermedio
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      // Principiante (Scaled): Solo ejercicios básicos
      levelCondition = "nivel = 'Principiante'";
    }

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, dominio, categoria, equipamiento,
             tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas
      FROM app."Ejercicios_CrossFit"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios CrossFit cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.CROSSFIT_SPECIALIST);
    const config = AI_MODULES.CROSSFIT_SPECIALIST;

    // Construir mensaje para IA
    const userMessage = `GENERACIÓN DE PLAN CROSSFIT

NIVEL: ${actualLevel} (${dbLevel === 'Principiante' ? 'Scaled' : dbLevel === 'Intermedio' ? 'RX' : dbLevel === 'Avanzado' ? 'RX+' : 'Elite'})
DOMINIOS PRIORITARIOS: ${selectedDomains?.join(', ') || 'Gymnastic, Weightlifting, Monostructural'}
OBJETIVOS: ${goals || 'Desarrollar GPP (General Physical Preparedness)'}

EJERCICIOS DISPONIBLES (${availableExercises.length}):
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.dominio}/${ex.categoria}) - Nivel: ${ex.nivel}, WOD: ${ex.tipo_wod}, Equipamiento: ${ex.equipamiento}, Intensidad: ${ex.intensidad}`
).join('\n')}

DURACIÓN: ${versionConfig?.customWeeks || 12} semanas

PRINCIPIOS CROSSFIT OBLIGATORIOS:
1. Variedad constante: WODs constantemente variados (AMRAP, EMOM, For Time, Tabata, Chipper, Strength)
2. Alta intensidad: Mantener intensidad > 75% capacidad máxima
3. Movimientos funcionales: Multiarticulares, replican patrones naturales
4. Balance de dominios: G/W/M equilibrados semanalmente (Gymnastic, Weightlifting, Monostructural)
5. Scalability: Cada WOD debe incluir scaling options
6. Benchmarks: Incluir WODs benchmark (Fran, Helen, Cindy, Murph, etc.) cada 4 semanas
7. Descansos: ${actualLevel === 'principiante' ? '60-90s' : actualLevel === 'intermedio' ? '30-60s' : '30s o menos'} según capacidad metabólica

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un CrossFit Level-2 Trainer certificado. Generas planes de entrenamiento (WODs) basados en la metodología CrossFit oficial: variedad constante, movimientos funcionales, alta intensidad.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

El plan DEBE incluir:
- calendario: array de semanas con días de entrenamiento
- cada día tiene un WOD con tipo (AMRAP, EMOM, For Time, Tabata, Chipper, Strength)
- cada ejercicio tiene: nombre, reps/tiempo, carga, scaling options
- balance de dominios G/W/M
- benchmarks cada 4 semanas

FORMATO EXACTO:
{
  "metodologia": "CrossFit",
  "nivel_crossfit": "${actualLevel}",
  "duracion_semanas": 12,
  "frecuencia_semanal": ${actualLevel === 'principiante' ? 3 : actualLevel === 'intermedio' ? 4 : actualLevel === 'avanzado' ? 5 : 6},
  "filosofia": "Constantly varied functional movements at high intensity",
  "calendario": [
    {
      "semana": 1,
      "fase": "Base|Build|Peak",
      "dias": [
        {
          "dia": "Lunes",
          "enfoque": "Gymnastic Heavy|Weightlifting Focus|Mixed Modal",
          "wod": {
            "tipo": "AMRAP|EMOM|For Time|Tabata|Chipper|Strength",
            "duracion": "12 min",
            "descripcion": "AMRAP 12 min:\\n- 5 Pull-Ups\\n- 10 Push-Ups\\n- 15 Air Squats",
            "objetivo_rounds": "8-10 rounds RX",
            "scaling": {
              "scaled": "Band Pull-Ups, Box Push-Ups, Air Squats",
              "rx": "Kipping Pull-Ups, Push-Ups, Air Squats",
              "rx_plus": "Chest-to-Bar, Deficit HSPU, Pistol Squats"
            },
            "estrategia": "Pace sostenible, breaks estratégicos en pull-ups",
            "movimientos": [
              {
                "nombre": "<nombre exacto de BD>",
                "trabajo": "5 reps|15 cal|400m",
                "carga": "20/14 lbs|95/65 lbs|BW",
                "notas": "Mantener técnica bajo fatiga"
              }
            ]
          }
        }
      ]
    }
  ],
  "benchmarks": [
    {
      "semana": 4,
      "nombre": "Fran",
      "descripcion": "21-15-9 Thrusters (95/65) + Pull-Ups",
      "objetivo_tiempo": "Sub-8 min ${actualLevel}"
    }
  ]
}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.9,  // Alta variedad para WODs constantemente variados
      max_tokens: config.max_output_tokens  // 16384 tokens (igual que Calistenia)
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
    if (!generatedPlan.calendario || !Array.isArray(generatedPlan.calendario)) {
      throw new Error('Plan sin calendario válido');
    }

    // 🔥 NORMALIZAR PLAN: Convertir formato calendario → semanas
    console.log('🔄 Normalizando plan CrossFit (calendario → semanas)...');
    const normalizedPlan = normalizeCrossFitPlan(generatedPlan);

    // Validar plan normalizado
    if (!normalizedPlan?.semanas || !Array.isArray(normalizedPlan.semanas) || normalizedPlan.semanas.length === 0) {
      throw new Error('Plan normalizado sin semanas válidas');
    }

    console.log(`✅ Plan normalizado: ${normalizedPlan.semanas.length} semanas, ${normalizedPlan.frecuencia_semanal} días/semana`);

    const planToPersist = normalizedPlan;

    // Guardar plan en BD
    const client_db = await pool.connect();
    try {
      await client_db.query('BEGIN');

      // Limpiar drafts anteriores
      await cleanUserDrafts(userId, client_db);

      // Insertar plan normalizado
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'CrossFit', JSON.stringify(planToPersist), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan CrossFit guardado con ID: ${methodologyPlanId}`);

      res.json({
        success: true,
        plan: planToPersist,
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
    console.error('Error generando plan de CrossFit:', error);
    logError('CROSSFIT_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// FUNCIONAL SPECIALIST ENDPOINTS
// =========================================

/**
 * POST /api/routine-generation/specialist/funcional/evaluate
 * Evaluación automática del perfil para Entrenamiento Funcional
 */
router.post('/specialist/funcional/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { source } = req.body;

    logSeparator('FUNCIONAL EVALUATE');
    console.log(`🎯 Evaluando usuario ${userId} para Entrenamiento Funcional (source: ${source})`);

    // Obtener perfil completo
    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.FUNCIONAL_SPECIALIST);
    const config = AI_MODULES.FUNCIONAL_SPECIALIST;
    const systemPrompt = await getPrompt(FeatureKey.FUNCIONAL_SPECIALIST);

    const userMessage = `EVALUACIÓN DE USUARIO PARA ENTRENAMIENTO FUNCIONAL

PERFIL:
- Años entrenando: ${normalizedProfile.años_entrenando || 0}
- Nivel: ${normalizedProfile.nivel_entrenamiento || 'principiante'}
- Objetivo: ${normalizedProfile.objetivo_principal || 'general'}
- Limitaciones: ${normalizedProfile.limitaciones_fisicas || 'ninguna'}

EVALÚA el nivel apropiado (principiante/intermedio/avanzado) para entrenamiento funcional basándote en:
1. Capacidad en patrones básicos (squat, hinge, push, pull)
2. Experiencia con movimientos multiarticulares
3. Movilidad y estabilidad general
4. Capacidad de control motor

RESPONDE SOLO EN JSON PURO:
{
  "recommended_level": "principiante|intermedio|avanzado",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación",
  "key_indicators": ["factor1", "factor2"],
  "suggested_focus_areas": ["área1", "área2"],
  "safety_considerations": ["consideración1"]
}`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: config.temperature,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const evaluation = JSON.parse(parseAIResponse(completion.choices[0].message.content));

    console.log(`✅ Evaluación Funcional completada:`, {
      level: evaluation.recommended_level,
      confidence: evaluation.confidence
    });

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('❌ Error en evaluación Funcional:', error);
    logError('FUNCIONAL_EVALUATE', error);

    res.status(500).json({
      success: false,
      error: 'Error en evaluación',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/funcional/generate
 * Generación de plan especializado de Entrenamiento Funcional con IA
 */
router.post('/specialist/funcional/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Extracción flexible de datos
    const funcionalData = req.body.funcionalData || req.body;
    const {
      userProfile,
      level,
      selectedLevel,
      goals,
      selectedMuscleGroups,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = funcionalData;

    // Mapear level → selectedLevel
    const actualLevel = selectedLevel || level;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('FUNCIONAL PLAN GENERATION');
    console.log('Generando plan de Entrenamiento Funcional...', {
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

    // Mapear nivel - Normalizado
    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles - Funcional tiene niveles progresivos
    let levelCondition;
    if (dbLevel === 'Avanzado') {
      // Avanzado: Acceso a TODOS los ejercicios
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      // Intermedio: Principiante + Intermedio
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      // Principiante: Solo ejercicios básicos
      levelCondition = "nivel = 'Principiante'";
    }

    console.log(`🔍 Consultando ejercicios con condición: ${levelCondition}`);

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, descanso_seg, tempo, notas, progresion_hacia
      FROM app."Ejercicios_Funcional"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;
    console.log(`📊 Query completado: ${availableExercises.length} ejercicios encontrados`);

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios Funcionales cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    console.log('🔧 Inicializando cliente OpenAI...');
    const client = getModuleOpenAI(AI_MODULES.FUNCIONAL_SPECIALIST);
    const config = AI_MODULES.FUNCIONAL_SPECIALIST;

    console.log('📄 Cargando system prompt...');
    const systemPrompt = await getPrompt(FeatureKey.FUNCIONAL_SPECIALIST);
    console.log(`✅ System prompt cargado (${systemPrompt.length} caracteres)`);

    // Construir mensaje para IA
    console.log('📝 Construyendo mensaje para IA...');
    const userMessage = `GENERACIÓN DE PLAN ENTRENAMIENTO FUNCIONAL

NIVEL: ${actualLevel} (${dbLevel})
GRUPOS MUSCULARES PRIORITARIOS: ${selectedMuscleGroups?.join(', ') || 'Empuje, Tracción, Piernas, Core'}
OBJETIVOS: ${goals || 'Desarrollar fuerza funcional y movilidad'}

EJERCICIOS DISPONIBLES (${availableExercises.length}):
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.patron}/${ex.categoria}) - Nivel: ${ex.nivel}, Series/Reps: ${ex.series_reps_objetivo}, Equipamiento: ${Array.isArray(ex.equipamiento) ? ex.equipamiento.join(', ') : ex.equipamiento}, Tempo: ${ex.tempo || 'Controlado'}`
).join('\n')}

DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS FUNCIONALES OBLIGATORIOS:
1. Patrones de movimiento: Squat, Hinge, Push, Pull, Rotation, Anti-rotation, Locomotion, Carry
2. Multiarticular: Integración de múltiples grupos musculares
3. Transferencia real: Aplicación a vida diaria
4. Movilidad y estabilidad: Core activo en todos los ejercicios
5. Progresión gradual: De bilateral a unilateral, de estable a inestable
6. Descansos: ${actualLevel === 'principiante' ? '60-75s' : actualLevel === 'intermedio' ? '45-60s' : '45s'} según nivel
7. Calentamiento específico: Movilidad articular + activación de patrones

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    console.log(`📏 Mensaje construido (${userMessage.length} caracteres)`);

    const startTime = Date.now();
    console.log('🤖 Iniciando llamada a OpenAI para generación Funcional...');
    console.log(`📊 Config: model=${config.model}, max_tokens=${config.max_output_tokens}, temp=${config.temperature}`);

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      response_format: { type: 'json_object' }
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  OpenAI respondió en ${elapsedTime}s`);

    console.log('🔄 Parseando respuesta de IA...');
    const rawContent = completion.choices[0].message.content;
    console.log(`📦 Contenido recibido (${rawContent.length} caracteres)`);

    const cleanedResponse = parseAIResponse(rawContent);
    console.log(`🧹 Respuesta limpiada (${cleanedResponse.length} caracteres)`);

    const generatedPlan = JSON.parse(cleanedResponse);
    console.log(`✅ JSON parseado correctamente`);

    console.log(`✅ Plan Funcional generado por IA (${elapsedTime}s total)`);

    // Validar estructura del plan
    console.log('🔍 Validando estructura del plan...');
    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan generado no tiene estructura válida (falta semanas)');
    }
    console.log(`✅ Estructura válida: ${generatedPlan.semanas.length} semanas`);

    // Guardar en BD con transacción
    console.log('💾 Conectando a base de datos...');
    const client_db = await pool.connect();

    try {
      console.log('🔄 Iniciando transacción...');
      await client_db.query('BEGIN');

      // Limpiar drafts previos
      console.log('🧹 Limpiando drafts previos...');
      await cleanUserDrafts(userId, client_db);

      // Insertar plan
      console.log('📝 Insertando plan en BD...');
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Funcional', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      console.log('✅ Commit de transacción...');
      await client_db.query('COMMIT');

      console.log(`✅ Plan Funcional guardado con ID: ${methodologyPlanId}`);

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
    console.error('❌ Error generando plan de Entrenamiento Funcional:', error);
    console.error('📍 Stack trace:', error.stack);
    logError('FUNCIONAL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// =========================================
// HALTEROFILIA SPECIALIST ENDPOINTS
// =========================================

/**
 * POST /api/routine-generation/specialist/halterofilia/evaluate
 * Evaluación automática del perfil para Halterofilia (Olympic Weightlifting)
 */
router.post('/specialist/halterofilia/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { source } = req.body;

    logSeparator('HALTEROFILIA EVALUATE');
    console.log(`🎯 Evaluando usuario ${userId} para Halterofilia (source: ${source})`);

    // Obtener perfil completo
    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.HALTEROFILIA_SPECIALIST);
    const config = AI_MODULES.HALTEROFILIA_SPECIALIST;
    const systemPrompt = await getPrompt(FeatureKey.HALTEROFILIA_SPECIALIST);

    const userMessage = `EVALUACIÓN DE USUARIO PARA HALTEROFILIA (OLYMPIC WEIGHTLIFTING)

PERFIL:
- Años entrenando: ${normalizedProfile.años_entrenando || 0}
- Nivel: ${normalizedProfile.nivel_entrenamiento || 'principiante'}
- Objetivo: ${normalizedProfile.objetivo_principal || 'general'}
- Limitaciones: ${normalizedProfile.limitaciones_fisicas || 'ninguna'}

EVALÚA el nivel apropiado (principiante/intermedio/avanzado) para halterofilia basándote en:
1. Técnica de snatch (hang, power, full)
2. Técnica de clean & jerk
3. Movilidad overhead (overhead squat profundo)
4. Fuerza base (squats, pulls)
5. Experiencia con levantamientos explosivos

RESPONDE SOLO EN JSON PURO:
{
  "recommended_level": "principiante|intermedio|avanzado",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación",
  "key_indicators": ["factor1", "factor2"],
  "suggested_focus_areas": ["área1", "área2"],
  "safety_considerations": ["consideración1"]
}`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: config.temperature,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const evaluation = JSON.parse(parseAIResponse(completion.choices[0].message.content));

    console.log(`✅ Evaluación Halterofilia completada:`, {
      level: evaluation.recommended_level,
      confidence: evaluation.confidence
    });

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('❌ Error en evaluación Halterofilia:', error);
    logError('HALTEROFILIA_EVALUATE', error);

    res.status(500).json({
      success: false,
      error: 'Error en evaluación',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/halterofilia/generate
 * Generación de plan especializado de Halterofilia con IA
 */
router.post('/specialist/halterofilia/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Extracción flexible de datos
    const halterofíliaData = req.body.halterofíliaData || req.body;
    const {
      userProfile,
      level,
      selectedLevel,
      goals,
      selectedMuscleGroups,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = halterofíliaData;

    // Mapear level → selectedLevel
    const actualLevel = selectedLevel || level;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('HALTEROFILIA PLAN GENERATION');
    console.log('Generando plan de Halterofilia...', {
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

    // Mapear nivel - Normalizado
    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles - Halterofilia tiene progresión técnica
    let levelCondition;
    if (dbLevel === 'Avanzado') {
      // Avanzado: Acceso a TODOS los ejercicios (full lifts, complejos, etc.)
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      // Intermedio: Principiante + Intermedio (power lifts, hang work)
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      // Principiante: Solo ejercicios básicos (hang, muscle, técnica)
      levelCondition = "nivel = 'Principiante'";
    }

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, descanso_seg, tempo, notas, progresion_hacia
      FROM app."Ejercicios_Halterofilia"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios Halterofilia cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.HALTEROFILIA_SPECIALIST);
    const config = AI_MODULES.HALTEROFILIA_SPECIALIST;
    const systemPrompt = await getPrompt(FeatureKey.HALTEROFILIA_SPECIALIST);

    // Construir mensaje para IA
    const userMessage = `GENERACIÓN DE PLAN HALTEROFILIA (OLYMPIC WEIGHTLIFTING)

NIVEL: ${actualLevel} (${dbLevel})
ENFOQUE PRIORITARIO: ${selectedMuscleGroups?.join(', ') || 'Snatch, Clean & Jerk, Fuerza Base'}
OBJETIVOS: ${goals || 'Desarrollar técnica olímpica y potencia explosiva'}

EJERCICIOS DISPONIBLES (${availableExercises.length}):
${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.categoria}) - Nivel: ${ex.nivel}, Series/Reps: ${ex.series_reps_objetivo}, Descanso: ${ex.descanso_seg}s, Tempo: ${ex.tempo || 'Explosivo'}`
).join('\n')}

DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS OLÍMPICOS OBLIGATORIOS:
1. Técnica sobre carga SIEMPRE
2. Snatch y Clean & Jerk como lifts principales
3. Progresión: Hang → Bloques → Suelo
4. Trabajo de potencia: Pulls overload (100-120% del lift)
5. Fuerza base: Squats (front, back, overhead)
6. Movilidad específica: Overhead squat, front rack
7. Descansos adecuados: ${actualLevel === 'principiante' ? '2-3 min' : actualLevel === 'intermedio' ? '3-4 min' : '4-5 min'} en lifts principales
8. Periodización: Semana 1-2 volume, Semana 3 intensity, Semana 4 deload

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      response_format: { type: 'json_object' }
    });

    const generatedPlan = JSON.parse(parseAIResponse(completion.choices[0].message.content));

    console.log(`✅ Plan Halterofilia generado por IA`);

    // Validar estructura del plan
    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan generado no tiene estructura válida (falta semanas)');
    }

    // Guardar en BD con transacción
    const client_db = await pool.connect();

    try {
      await client_db.query('BEGIN');

      // Limpiar drafts previos
      await cleanUserDrafts(userId, client_db);

      // Insertar plan
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Halterofilia', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan Halterofilia guardado con ID: ${methodologyPlanId}`);

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
    console.error('Error generando plan de Halterofilia:', error);
    logError('HALTEROFILIA_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});

// =========================================
// ENTRENAMIENTO EN CASA (Casa Specialist)
// =========================================

/**
 * POST /api/routine-generation/specialist/casa/evaluate
 * Evaluación de perfil para entrenamiento en casa
 */
router.post('/specialist/casa/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('CASA EVALUATION');
    logAPICall('/specialist/casa/evaluate', 'POST', userId);

    // Obtener perfil completo del usuario
    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Obtener configuración y cliente de IA
    const client = getModuleOpenAI(AI_MODULES.CASA_SPECIALIST);
    const config = AI_MODULES.CASA_SPECIALIST;
    const systemPrompt = await getPrompt(FeatureKey.CASA_SPECIALIST);

    // Construcción del mensaje para evaluación
    const userMessage = `EVALUACIÓN DE USUARIO PARA ENTRENAMIENTO EN CASA

Analiza el siguiente perfil de usuario para determinar su nivel apropiado y recomendaciones específicas para entrenar en casa:

DATOS DEL USUARIO:
- Edad: ${normalizedProfile.edad || 'No especificada'} años
- Sexo: ${normalizedProfile.sexo || 'No especificado'}
- Nivel de entrenamiento: ${normalizedProfile.nivel_entrenamiento || 'principiante'}
- Años entrenando: ${normalizedProfile.anos_entrenando || 0}
- Objetivo principal: ${normalizedProfile.objetivo_principal || 'mejorar condición física'}
- Frecuencia semanal deseada: ${normalizedProfile.frecuencia_semanal || 3} días
- Limitaciones físicas: ${normalizedProfile.limitaciones_fisicas?.join(', ') || 'Ninguna'}

EVALÚA el nivel apropiado (principiante/intermedio/avanzado) basándote en:
1. Experiencia previa con entrenamiento en casa
2. Capacidad para realizar ejercicios con peso corporal
3. Disponibilidad de equipamiento (mínimo/básico/avanzado)
4. Espacio disponible en casa
5. Objetivos personales y limitaciones

Devuelve un JSON con:
{
  "nivel_recomendado": "principiante|intermedio|avanzado",
  "razonamiento": "Explicación breve de por qué este nivel",
  "categorias_recomendadas": ["funcional", "hiit", "fuerza", "cardio", "movilidad"],
  "equipamiento_sugerido": "minimo|basico|avanzado",
  "espacio_minimo": "reducido|medio|amplio",
  "duracion_sesion_recomendada": 30-60,
  "frecuencia_recomendada": 3-6
}`;

    console.log('🤖 Llamando a OpenAI para evaluación Casa...');
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: config.temperature,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const evaluation = JSON.parse(parseAIResponse(completion.choices[0].message.content));
    console.log('✅ Evaluación Casa completada:', evaluation);

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('Error en evaluación Casa:', error);
    logError('CASA_EVALUATE', error);

    res.status(500).json({
      success: false,
      error: 'Error en evaluación',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/casa/generate
 * Generación de plan especializado de entrenamiento en casa con IA
 */
router.post('/specialist/casa/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Extracción flexible de datos
    const casaData = req.body.casaData || req.body;
    const {
      userProfile,
      selectedLevel,
      selectedCategory,
      selectedCategories,
      equipmentLevel,
      spaceAvailable,
      customGoals,
      aiEvaluation
    } = casaData;

    const categoria = selectedCategory || (Array.isArray(selectedCategories) ? selectedCategories[0] : undefined);

    logSeparator('CASA PLAN GENERATION');
    console.log('🏠 Generando plan de entrenamiento en casa...', {
      selectedLevel,
      selectedCategory: categoria,
      equipmentLevel,
      spaceAvailable
    });

    // Obtener perfil completo si solo se envió ID
    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    // Nivel actual del usuario
    const actualLevel = selectedLevel || aiEvaluation?.nivel_recomendado || 'principiante';

    // Mapear nivel frontend a nivel BD
    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[actualLevel.toLowerCase()] || 'Principiante';

    // Sistema de acceso progresivo a ejercicios
    let levelCondition;
    if (dbLevel === 'Avanzado') {
      levelCondition = "nivel IN ('Principiante', 'Intermedio', 'Avanzado')";
    } else if (dbLevel === 'Intermedio') {
      levelCondition = "nivel IN ('Principiante', 'Intermedio')";
    } else {
      levelCondition = "nivel = 'Principiante'";
    }

    // Obtener ejercicios disponibles de la tabla Ejercicios_Casa
    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, descanso_seg, tempo, notas, progresion_hacia
      FROM app."Ejercicios_Casa"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      console.error('No se encontraron ejercicios en app."Ejercicios_Casa"');
      return res.status(503).json({
        success: false,
        error: 'Sin ejercicios disponibles',
        message: 'No hay ejercicios configurados para entrenamiento en casa'
      });
    }

    console.log(`📋 Ejercicios Casa disponibles: ${availableExercises.length}`);

    // Filtrar por categorías si hay seleccionadas
    const categoriasActivas = Array.isArray(selectedCategories) && selectedCategories.length > 0
      ? selectedCategories
      : (categoria ? [categoria] : ['Funcional', 'Fuerza', 'Cardio']);

    const categoriaActiva = categoriasActivas[0];

    const exercisesByCategory = availableExercises.reduce((acc, exercise) => {
      const cat = exercise.categoria;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(exercise);
      return acc;
    }, {});

    console.log('🗂️ Ejercicios por categoría:', Object.keys(exercisesByCategory).map(cat => `${cat}: ${exercisesByCategory[cat].length}`));

    // Configuración y cliente de IA
    const client = getModuleOpenAI(AI_MODULES.CASA_SPECIALIST);
    const config = AI_MODULES.CASA_SPECIALIST;
    const systemPrompt = await getPrompt(FeatureKey.CASA_SPECIALIST);

    // Construcción del mensaje para generación
    const userMessage = `GENERAR PLAN DE ENTRENAMIENTO EN CASA PERSONALIZADO

PERFIL DEL USUARIO:
${JSON.stringify(fullUserProfile, null, 2)}

CONFIGURACIÓN DEL PLAN:
- Nivel seleccionado: ${actualLevel}
- Categoría principal: ${categoriaActiva}
- Categorías complementarias: ${categoriasActivas.slice(1).join(', ') || 'Ninguna'}
- Equipamiento disponible: ${equipmentLevel || 'basico'}
- Espacio disponible: ${spaceAvailable || 'medio'}
- Objetivos personalizados: ${customGoals || 'Ninguno especificado'}

${aiEvaluation ? `EVALUACIÓN PREVIA DE IA:\n${JSON.stringify(aiEvaluation, null, 2)}\n` : ''}

EJERCICIOS DISPONIBLES POR CATEGORÍA:
${Object.entries(exercisesByCategory).map(([cat, exs]) =>
  `\n${cat} (${exs.length} ejercicios):\n${exs.slice(0, 10).map(e => `- ${e.nombre} [${e.nivel}] - ${e.equipamiento?.join(', ')}`).join('\n')}`
).join('\n')}

INSTRUCCIONES ESPECIALES:
1. Usa SOLO los ejercicios proporcionados de la tabla Ejercicios_Casa
2. Enfoca el plan en la categoría principal: ${categoriaActiva}
3. Respeta el equipamiento disponible: ${equipmentLevel}
4. Adapta al espacio: ${spaceAvailable}
5. Genera un plan de 4 semanas progresivo
6. Incluye calentamiento, trabajo principal y enfriamiento en cada sesión
7. Usa creatividad para adaptar objetos domésticos según equipamiento
8. Especifica claramente qué objetos usar (silla, toalla, pared, etc.)

Devuelve un JSON siguiendo EXACTAMENTE la estructura del prompt especialista Casa.`;

    console.log('🤖 Llamando a OpenAI para generación de plan Casa...');
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: config.temperature,
      max_tokens: config.max_output_tokens,
      response_format: { type: 'json_object' }
    });

    const rawPlan = parseAIResponse(completion.choices[0].message.content);
    let generatedPlan;

    try {
      generatedPlan = JSON.parse(rawPlan);
    } catch (parseError) {
      console.error('Error parseando plan de Casa:', parseError);
      console.error('Respuesta recibida:', rawPlan);
      return res.status(422).json({
        success: false,
        error: 'Plan invalido',
        message: 'La respuesta del generador no es un JSON valido'
      });
    }

    generatedPlan = normalizeCasaPlan(generatedPlan);
    console.log('✅ Plan Casa generado exitosamente');

    // Guardar plan en la base de datos
    const client_db = await pool.connect();

    try {
      await client_db.query('BEGIN');

      // Limpiar borradores previos del usuario
      await cleanUserDrafts(userId, client_db);

      // Insertar plan en methodology_plans
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id,
          methodology_type,
          plan_data,
          generation_mode,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [
        userId,
        'Casa',
        JSON.stringify(generatedPlan),
        'manual',
        'draft'
      ]);

      const methodologyPlanId = planResult.rows[0].id;
      console.log(`💾 Plan Casa guardado con ID: ${methodologyPlanId}`);

      await client_db.query('COMMIT');

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId
      });

    } catch (dbError) {
      await client_db.query('ROLLBACK');
      console.error('Error guardando plan en BD:', dbError);
      throw dbError;
    } finally {
      client_db.release();
    }

  } catch (error) {
    console.error('Error generando plan de Casa:', error);
    logError('CASA_SPECIALIST', error);

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
      id: 'principiante',
      name: 'Principiante',
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

// =========================================
// OPOSICIONES - BOMBEROS SPECIALIST
// =========================================

/**
 * POST /api/routine-generation/specialist/bomberos/evaluate
 * Evaluación del nivel del usuario para oposiciones de Bombero
 */
router.post('/specialist/bomberos/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('BOMBEROS OPOSICION EVALUATION');
    logAPICall('/specialist/bomberos/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Verificar ejercicios disponibles
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Bomberos"
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de Bomberos en la base de datos');
    }

    // Preparar payload para IA
    const aiPayload = {
      task: 'evaluate_bomberos_level',
      user_profile: normalizedProfile,
      evaluation_criteria: [
        'Capacidad de natación (50-100m)',
        'Fuerza de tracción (dominadas, trepa)',
        'Resistencia cardiovascular (2800m)',
        'Velocidad (100-200m)',
        'Experiencia previa en preparación física completa',
        'Edad y condición física general'
      ],
      level_descriptions: {
        principiante: 'Principiante: 0-6 meses preparación, necesita desarrollar base aeróbica y técnicas',
        intermedio: 'Intermedio: 6-12 meses, se acerca a baremos mínimos en varias pruebas',
        avanzado: 'Avanzado: 12+ meses, supera baremos mínimos, busca maximizar puntuación'
      }
    };

    logAIPayload('BOMBEROS_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST); // Usar mismo módulo
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en preparación física para oposiciones de Bombero.

INSTRUCCIONES:
- Evalúa la capacidad del usuario para las 9 pruebas oficiales de bombero
- Considera su nivel en natación, fuerza, resistencia, velocidad y agilidad
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "principiante|intermedio|avanzado",
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
    console.error('Error en evaluación de Bomberos:', error);
    logError('BOMBEROS_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/bomberos/generate
 * Generación de plan especializado para oposiciones de Bombero
 */
router.post('/specialist/bomberos/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      userProfile,
      selectedLevel,
      goals,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = req.body;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('BOMBEROS PLAN GENERATION');
    console.log('Generando plan de Bomberos...', {
      selectedLevel,
      isRegeneration,
      customWeeks: versionConfig?.customWeeks
    });

    // Obtener perfil completo
    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    // Mapear nivel
    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[selectedLevel.toLowerCase()] || 'Principiante';

    // Obtener ejercicios disponibles de Bomberos
    const exercisesResult = await pool.query(`
      SELECT nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres,
             series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas
      FROM app."Ejercicios_Bomberos"
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;
    console.log(`Ejercicios de Bomberos disponibles: ${availableExercises.length}`);

    // Configuración del plan
    const dayInfo = getCurrentDayInfo();
    const durationWeeks = versionConfig?.customWeeks || (dbLevel === 'Avanzado' ? 8 : 12);
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 6 : (dbLevel === 'Intermedio' ? 5 : 4);

    const planPayload = {
      task: isRegeneration ? 'regenerate_bomberos_plan' : 'generate_bomberos_plan',
      user_profile: fullUserProfile,
      selected_level: selectedLevel,
      goals: goals || 'Superar todas las pruebas físicas de oposición de Bombero',
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: durationWeeks,
        sessions_per_week: sessionsPerWeek,
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

    logAIPayload('BOMBEROS_PLAN', planPayload);

    // Obtener prompt y generar
    clearPromptCache(FeatureKey.BOMBEROS_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.BOMBEROS_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Bomberos Specialist');
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

      await cleanUserDrafts(userId, dbClient);

      const methodologyResult = await dbClient.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Bomberos', JSON.stringify(generatedPlan), 'automatic', 'draft']);

      const methodologyPlanId = methodologyResult.rows[0].id;

      await dbClient.query('COMMIT');

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId,
        planId: methodologyPlanId,
        justification: isRegeneration
          ? `Plan mejorado para Bomberos basado en tu feedback`
          : generatedPlan.justification || 'Plan personalizado de Bomberos generado',
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
    console.error('Error generando plan de Bomberos:', error);
    logError('BOMBEROS_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan de Bomberos',
      message: error.message
    });
  }
});

// =========================================
// OPOSICIONES - GUARDIA CIVIL SPECIALIST
// =========================================

/**
 * POST /api/routine-generation/specialist/guardia-civil/evaluate
 * Evaluación del nivel del usuario para oposiciones de Guardia Civil
 */
router.post('/specialist/guardia-civil/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('GUARDIA CIVIL OPOSICION EVALUATION');
    logAPICall('/specialist/guardia-civil/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    // Verificar ejercicios disponibles
    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Guardia_Civil"
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de Guardia Civil en la base de datos');
    }

    // Preparar payload para IA
    const aiPayload = {
      task: 'evaluate_guardia_civil_level',
      user_profile: normalizedProfile,
      evaluation_criteria: [
        'Resistencia cardiovascular (2000m)',
        'Fuerza de empuje (flexiones/extensiones)',
        'Capacidad de natación (50m)',
        'Agilidad y coordinación (circuito)',
        'Edad (baremos ajustados por edad)',
        'Experiencia en entrenamiento funcional'
      ],
      level_descriptions: {
        principiante: 'Principiante: 0-6 meses, necesita desarrollar capacidades básicas',
        intermedio: 'Intermedio: 6-12 meses, cerca de alcanzar baremos por edad',
        avanzado: 'Avanzado: 12+ meses, supera baremos con margen de seguridad'
      }
    };

    logAIPayload('GUARDIA_CIVIL_EVALUATION', aiPayload);

    // Llamar a IA
    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST);
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en preparación física para oposiciones de Guardia Civil.

INSTRUCCIONES:
- Evalúa la capacidad del usuario para las 4 pruebas eliminatorias oficiales
- Considera edad para baremos (importante en Guardia Civil)
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "principiante|intermedio|avanzado",
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
    console.error('Error en evaluación de Guardia Civil:', error);
    logError('GUARDIA_CIVIL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/guardia-civil/generate
 * Generación de plan especializado para oposiciones de Guardia Civil
 */
router.post('/specialist/guardia-civil/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      userProfile,
      selectedLevel,
      goals,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = req.body;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('GUARDIA CIVIL PLAN GENERATION');
    console.log('Generando plan de Guardia Civil...', {
      selectedLevel,
      isRegeneration,
      customWeeks: versionConfig?.customWeeks
    });

    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[selectedLevel.toLowerCase()] || 'Principiante';

    const exercisesResult = await pool.query(`
      SELECT nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres,
             series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas
      FROM app."Ejercicios_Guardia_Civil"
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;
    console.log(`Ejercicios de Guardia Civil disponibles: ${availableExercises.length}`);

    const dayInfo = getCurrentDayInfo();
    const durationWeeks = versionConfig?.customWeeks || (dbLevel === 'Avanzado' ? 8 : 12);
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 6 : (dbLevel === 'Intermedio' ? 5 : 4);

    const planPayload = {
      task: isRegeneration ? 'regenerate_guardia_civil_plan' : 'generate_guardia_civil_plan',
      user_profile: fullUserProfile,
      selected_level: selectedLevel,
      goals: goals || 'Superar las 4 pruebas eliminatorias de Guardia Civil según baremos por edad',
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: durationWeeks,
        sessions_per_week: sessionsPerWeek,
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

    logAIPayload('GUARDIA_CIVIL_PLAN', planPayload);

    clearPromptCache(FeatureKey.GUARDIA_CIVIL_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.GUARDIA_CIVIL_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Guardia Civil Specialist');
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

    const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan debe contener array de semanas');
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      await cleanUserDrafts(userId, dbClient);

      const methodologyResult = await dbClient.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Guardia Civil', JSON.stringify(generatedPlan), 'automatic', 'draft']);

      const methodologyPlanId = methodologyResult.rows[0].id;

      await dbClient.query('COMMIT');

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId,
        planId: methodologyPlanId,
        justification: isRegeneration
          ? `Plan mejorado para Guardia Civil basado en tu feedback`
          : generatedPlan.justification || 'Plan personalizado de Guardia Civil generado',
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
    console.error('Error generando plan de Guardia Civil:', error);
    logError('GUARDIA_CIVIL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan de Guardia Civil',
      message: error.message
    });
  }
});

// =========================================
// OPOSICIONES - POLICÍA NACIONAL SPECIALIST
// =========================================

/**
 * POST /api/routine-generation/specialist/policia-nacional/evaluate
 * Evaluación del nivel del usuario para oposiciones de Policía Nacional
 */
router.post('/specialist/policia-nacional/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('POLICIA NACIONAL OPOSICION EVALUATION');
    logAPICall('/specialist/policia-nacional/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Policia_Nacional"
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de Policía Nacional en la base de datos');
    }

    const aiPayload = {
      task: 'evaluate_policia_nacional_level',
      user_profile: normalizedProfile,
      evaluation_criteria: [
        'Fuerza tren superior (dominadas para hombres / suspensión para mujeres)',
        'Resistencia cardiovascular (1000m)',
        'Agilidad y coordinación (circuito con obstáculos)',
        'Experiencia en preparación física',
        'Capacidad para puntuar alto (sistema 0-10 por prueba)'
      ],
      level_descriptions: {
        principiante: 'Principiante: Puntuación < 4 en pruebas, necesita base',
        intermedio: 'Intermedio: Puntuación 4-7, cerca de aprobar',
        avanzado: 'Avanzado: Puntuación 7-10, busca maximizar puntos'
      }
    };

    logAIPayload('POLICIA_NACIONAL_EVALUATION', aiPayload);

    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST);
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en preparación física para oposiciones de Policía Nacional.

INSTRUCCIONES:
- Evalúa la capacidad del usuario para las 3 pruebas oficiales con sistema de puntuación 0-10
- Considera que necesita media ≥ 5 puntos para aprobar
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "principiante|intermedio|avanzado",
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

    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando respuesta IA:', parseError);
      throw new Error('Respuesta de IA inválida');
    }

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
    console.error('Error en evaluación de Policía Nacional:', error);
    logError('POLICIA_NACIONAL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/policia-nacional/generate
 * Generación de plan especializado para oposiciones de Policía Nacional
 */
router.post('/specialist/policia-nacional/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      userProfile,
      selectedLevel,
      goals,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = req.body;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('POLICIA NACIONAL PLAN GENERATION');
    console.log('Generando plan de Policía Nacional...', {
      selectedLevel,
      isRegeneration,
      customWeeks: versionConfig?.customWeeks
    });

    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[selectedLevel.toLowerCase()] || 'Principiante';

    const exercisesResult = await pool.query(`
      SELECT nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres,
             series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas
      FROM app."Ejercicios_Policia_Nacional"
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;
    console.log(`Ejercicios de Policía Nacional disponibles: ${availableExercises.length}`);

    const dayInfo = getCurrentDayInfo();
    const durationWeeks = versionConfig?.customWeeks || (dbLevel === 'Avanzado' ? 8 : 12);
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 5 : 4);

    const planPayload = {
      task: isRegeneration ? 'regenerate_policia_nacional_plan' : 'generate_policia_nacional_plan',
      user_profile: fullUserProfile,
      selected_level: selectedLevel,
      goals: goals || 'Alcanzar media ≥ 5 puntos en las 3 pruebas de Policía Nacional',
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: durationWeeks,
        sessions_per_week: sessionsPerWeek,
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

    logAIPayload('POLICIA_NACIONAL_PLAN', planPayload);

    clearPromptCache(FeatureKey.POLICIA_NACIONAL_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.POLICIA_NACIONAL_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Policía Nacional Specialist');
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

    const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan debe contener array de semanas');
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      await cleanUserDrafts(userId, dbClient);

      const methodologyResult = await dbClient.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Policia Nacional', JSON.stringify(generatedPlan), 'automatic', 'draft']);

      const methodologyPlanId = methodologyResult.rows[0].id;

      await dbClient.query('COMMIT');

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId,
        planId: methodologyPlanId,
        justification: isRegeneration
          ? `Plan mejorado para Policía Nacional basado en tu feedback`
          : generatedPlan.justification || 'Plan personalizado de Policía Nacional generado',
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
    console.error('Error generando plan de Policía Nacional:', error);
    logError('POLICIA_NACIONAL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan de Policía Nacional',
      message: error.message
    });
  }
});

// =========================================
// OPOSICIONES - POLICÍA LOCAL SPECIALIST
// =========================================

/**
 * POST /api/routine-generation/specialist/policia-local/evaluate
 * Evaluación del nivel del usuario para oposiciones de Policía Local
 */
router.post('/specialist/policia-local/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    logSeparator('POLICIA LOCAL OPOSICION EVALUATION');
    logAPICall('/specialist/policia-local/evaluate', 'POST', userId);

    const userProfile = await getUserFullProfile(userId);
    const normalizedProfile = normalizeUserProfile(userProfile);

    logUserProfile(normalizedProfile, userId);

    const exerciseCountResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Policia_Local"
    `);

    const exerciseCount = parseInt(exerciseCountResult.rows[0]?.total) || 0;
    if (exerciseCount === 0) {
      throw new Error('No se encontraron ejercicios de Policía Local en la base de datos');
    }

    const aiPayload = {
      task: 'evaluate_policia_local_level',
      user_profile: normalizedProfile,
      evaluation_criteria: [
        'Velocidad (sprint 50m)',
        'Resistencia (carrera 1000m)',
        'Potencia de salto (salto de longitud)',
        'Fuerza tren superior (dominadas/suspensión)',
        'Agilidad (circuito si aplica)',
        'Nota: Pruebas varían por ayuntamiento'
      ],
      level_descriptions: {
        principiante: 'Principiante: Lejos de baremos mínimos, necesita base',
        intermedio: 'Intermedio: Cerca de alcanzar baremos mínimos',
        avanzado: 'Avanzado: Supera baremos mínimos con margen'
      }
    };

    logAIPayload('POLICIA_LOCAL_EVALUATION', aiPayload);

    const client = getModuleOpenAI(AI_MODULES.CALISTENIA_SPECIALIST);
    const config = AI_MODULES.CALISTENIA_SPECIALIST;

    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Eres un especialista en preparación física para oposiciones de Policía Local.

INSTRUCCIONES:
- Evalúa la capacidad del usuario para las pruebas MÁS COMUNES de Policía Local
- IMPORTANTE: Las pruebas varían por ayuntamiento - preparación polivalente
- RESPONDE SOLO EN JSON PURO, SIN MARKDOWN

FORMATO DE RESPUESTA:
{
  "recommended_level": "principiante|intermedio|avanzado",
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

    let evaluation;
    try {
      evaluation = JSON.parse(parseAIResponse(aiResponse));
    } catch (parseError) {
      console.error('Error parseando respuesta IA:', parseError);
      throw new Error('Respuesta de IA inválida');
    }

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
    console.error('Error en evaluación de Policía Local:', error);
    logError('POLICIA_LOCAL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error evaluando perfil',
      message: error.message
    });
  }
});

/**
 * POST /api/routine-generation/specialist/policia-local/generate
 * Generación de plan especializado para oposiciones de Policía Local
 */
router.post('/specialist/policia-local/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      userProfile,
      selectedLevel,
      goals,
      previousPlan,
      regenerationReason,
      additionalInstructions,
      versionConfig
    } = req.body;

    const isRegeneration = !!(previousPlan || regenerationReason || additionalInstructions);

    logSeparator('POLICIA LOCAL PLAN GENERATION');
    console.log('Generando plan de Policía Local...', {
      selectedLevel,
      isRegeneration,
      customWeeks: versionConfig?.customWeeks
    });

    let fullUserProfile = userProfile;
    if (userProfile && Object.keys(userProfile).length === 1 && userProfile.id) {
      fullUserProfile = await getUserFullProfile(userId);
      fullUserProfile = normalizeUserProfile(fullUserProfile);
    }

    logUserProfile(fullUserProfile, userId);

    const levelMapping = {
      'principiante': 'Principiante',
      'intermedio': 'Intermedio',
      'avanzado': 'Avanzado'
    };
    const dbLevel = levelMapping[selectedLevel.toLowerCase()] || 'Principiante';

    const exercisesResult = await pool.query(`
      SELECT nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres,
             series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas
      FROM app."Ejercicios_Policia_Local"
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;
    console.log(`Ejercicios de Policía Local disponibles: ${availableExercises.length}`);

    const dayInfo = getCurrentDayInfo();
    const durationWeeks = versionConfig?.customWeeks || (dbLevel === 'Avanzado' ? 8 : 12);
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 5 : 4);

    const planPayload = {
      task: isRegeneration ? 'regenerate_policia_local_plan' : 'generate_policia_local_plan',
      user_profile: fullUserProfile,
      selected_level: selectedLevel,
      goals: goals || 'Preparación polivalente para pruebas comunes de Policía Local (CONSULTAR BASES ESPECÍFICAS)',
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: durationWeeks,
        sessions_per_week: sessionsPerWeek,
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

    logAIPayload('POLICIA_LOCAL_PLAN', planPayload);

    clearPromptCache(FeatureKey.POLICIA_LOCAL_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.POLICIA_LOCAL_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Policía Local Specialist');
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

    const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

    if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
      throw new Error('Plan debe contener array de semanas');
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      await cleanUserDrafts(userId, dbClient);

      const methodologyResult = await dbClient.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Policia Local', JSON.stringify(generatedPlan), 'automatic', 'draft']);

      const methodologyPlanId = methodologyResult.rows[0].id;

      await dbClient.query('COMMIT');

      res.json({
        success: true,
        plan: generatedPlan,
        methodologyPlanId,
        planId: methodologyPlanId,
        justification: isRegeneration
          ? `Plan mejorado para Policía Local basado en tu feedback`
          : generatedPlan.justification || 'Plan personalizado de Policía Local generado',
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
    console.error('Error generando plan de Policía Local:', error);
    logError('POLICIA_LOCAL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan de Policía Local',
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
        'POST /api/routine-generation/specialist/calistenia/generate',
        'POST /api/routine-generation/specialist/heavy-duty/evaluate',
        'POST /api/routine-generation/specialist/heavy-duty/generate',
        'POST /api/routine-generation/specialist/hipertrofia/evaluate',
        'POST /api/routine-generation/specialist/hipertrofia/generate',
        'POST /api/routine-generation/specialist/powerlifting/evaluate',
        'POST /api/routine-generation/specialist/powerlifting/generate',
        'POST /api/routine-generation/specialist/crossfit/evaluate',
        'POST /api/routine-generation/specialist/crossfit/generate',
        'POST /api/routine-generation/specialist/bomberos/evaluate',
        'POST /api/routine-generation/specialist/bomberos/generate',
        'POST /api/routine-generation/specialist/guardia-civil/evaluate',
        'POST /api/routine-generation/specialist/guardia-civil/generate',
        'POST /api/routine-generation/specialist/policia-nacional/evaluate',
        'POST /api/routine-generation/specialist/policia-nacional/generate',
        'POST /api/routine-generation/specialist/policia-local/evaluate',
        'POST /api/routine-generation/specialist/policia-local/generate'
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
