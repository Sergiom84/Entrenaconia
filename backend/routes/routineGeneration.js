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

    // Primero, verificar cuántos drafts existen
    const checkResult = await dbClient.query(`
      SELECT id, created_at, methodology_type
      FROM app.methodology_plans
      WHERE user_id = $1 AND status = 'draft'
      ORDER BY created_at DESC
    `, [userId]);

    if (checkResult.rowCount > 0) {
      console.log(`📊 Encontrados ${checkResult.rowCount} drafts:`,
        checkResult.rows.map(r => ({
          id: r.id,
          type: r.methodology_type,
          age: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 1000 / 60) + ' mins'
        }))
      );
    }

    // Eliminar todos los drafts
    const result = await dbClient.query(`
      DELETE FROM app.methodology_plans
      WHERE user_id = $1 AND status = 'draft'
      RETURNING id
    `, [userId]);

    const deletedCount = result.rowCount;
    if (deletedCount > 0) {
      console.log(`✅ Eliminados ${deletedCount} drafts fallidos: IDs [${result.rows.map(r => r.id).join(', ')}]`);
    } else {
      console.log(`ℹ️ No había drafts que limpiar para usuario ${userId}`);
    }

    return deletedCount;
  } catch (error) {
    console.error('❌ Error limpiando drafts:', error.message);
    // No lanzar error - la limpieza es opcional pero loguear detalles
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
      p.limitaciones_fisicas, p.objetivo_principal, p.metodologia_preferida,
      p.usar_preferencias_ia, p.dias_preferidos_entrenamiento,
      p.ejercicios_por_dia_preferido, p.semanas_entrenamiento
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
    limitaciones_fisicas: profile.limitaciones_fisicas || null,
    // Preferencias de entrenamiento
    usar_preferencias_ia: profile.usar_preferencias_ia || false,
    dias_preferidos_entrenamiento: profile.dias_preferidos_entrenamiento || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    ejercicios_por_dia_preferido: profile.ejercicios_por_dia_preferido || 8,
    semanas_entrenamiento: profile.semanas_entrenamiento || 4
  };
}

/**
 * Parsear respuesta JSON de IA con manejo robusto
 */
function parseAIResponse(response) {
  if (!response || typeof response !== 'string') {
    console.error('❌ Respuesta de IA inválida: no es string');
    throw new Error('Respuesta de IA inválida');
  }

  let cleanResponse = response.trim();

  // Log para debug
  console.log(`📝 Parseando respuesta IA (${cleanResponse.length} caracteres)`);

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
        console.log('✅ Extraído contenido de code block markdown');
        break;
      }
    }
  }

  // Limpiar caracteres problemáticos
  cleanResponse = cleanResponse
    .replace(/^[`\s]*/, '')
    .replace(/[`\s]*$/, '')
    .replace(/^\s*json\s*/i, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Eliminar caracteres de control
    .trim();

  // Validar estructura JSON
  if (!cleanResponse.startsWith('{') || !cleanResponse.endsWith('}')) {
    const firstBrace = cleanResponse.indexOf('{');
    const lastBrace = cleanResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
      console.log('⚠️ Estructura JSON reparada (recortada a llaves)');
    } else {
      console.error('❌ No se pudo encontrar estructura JSON válida');
      throw new Error('Respuesta no contiene JSON válido');
    }
  }

  // Intento de validación temprana
  try {
    JSON.parse(cleanResponse);
    console.log('✅ Respuesta parseada exitosamente');
  } catch (e) {
    console.error('❌ Error parseando JSON:', e.message);
    console.error('Primeros 200 caracteres:', cleanResponse.substring(0, 200));
    throw new Error(`Respuesta JSON mal formateada: ${e.message}`);
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
  // Usar UTC para consistencia entre servidor y cliente
  const today = new Date();
  const utcDate = new Date(today.toISOString());
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Obtener día de la semana en zona horaria local del servidor
  const localDay = today.getDay();

  return {
    date: today,
    dayName: daysOfWeek[localDay],
    dateString: today.toLocaleDateString('es-ES'),
    isoDate: today.toISOString().split('T')[0],
    utcTimestamp: today.toISOString(), // Añadir timestamp UTC completo
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Zona horaria del servidor
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
    const startTime = Date.now();
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
    console.log('🎯 [CALISTENIA] Iniciando generación de plan:', {
      timestamp: new Date().toISOString(),
      userId,
      selectedLevel,
      isRegeneration,
      goals: goals?.substring(0, 50),
      dayOfWeek: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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

    // Retry logic para resiliencia
    let attempts = 0;
    let completion = null;
    let lastError = null;

    while (attempts < 3) {
      try {
        console.log(`🤖 [CALISTENIA] Intento ${attempts + 1}/3 de llamada a OpenAI...`);

        completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(planPayload) }
          ],
          temperature: config.temperature,
          max_tokens: config.max_output_tokens
        });

        console.log('✅ [CALISTENIA] Respuesta recibida de OpenAI');
        break; // Éxito, salir del loop

      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`❌ [CALISTENIA] Error en intento ${attempts}:`, error.message);

        if (attempts < 3) {
          const waitTime = 1000 * attempts; // 1s, 2s, 3s
          console.log(`⏳ [CALISTENIA] Esperando ${waitTime}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!completion) {
      throw new Error(`Fallo después de 3 intentos: ${lastError?.message || 'Error desconocido'}`);
    }

    const aiResponse = completion.choices[0].message.content;
    logAIResponse(aiResponse);
    logTokens(completion.usage);

    // Parsear con manejo robusto
    const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

    // Validación estricta del plan de Calistenia
    console.log('🔍 [CALISTENIA] Validando estructura del plan...');

    const requiredFields = ['semanas', 'nivel_usuario', 'duracion_total_semanas', 'frecuencia_por_semana'];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!generatedPlan[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.error('❌ [CALISTENIA] Plan incompleto, campos faltantes:', missingFields);
      throw new Error(`Plan incompleto: faltan campos [${missingFields.join(', ')}]`);
    }

    if (!Array.isArray(generatedPlan.semanas) || generatedPlan.semanas.length === 0) {
      throw new Error('Plan debe contener array de semanas con contenido');
    }

    // Validar estructura de semanas
    let totalSessions = 0;
    let totalExercises = 0;

    for (const [index, semana] of generatedPlan.semanas.entries()) {
      if (!semana.sesiones || !Array.isArray(semana.sesiones)) {
        throw new Error(`Semana ${index + 1} no tiene sesiones válidas`);
      }

      totalSessions += semana.sesiones.length;

      for (const sesion of semana.sesiones) {
        const ejercicios = sesion.ejercicios || [];
        totalExercises += ejercicios.length;

        if (ejercicios.length < 4) {
          console.warn(`⚠️ [CALISTENIA] Sesión "${sesion.dia}" tiene solo ${ejercicios.length} ejercicios (mínimo recomendado: 4)`);
        }
      }
    }

    console.log(`✅ [CALISTENIA] Plan validado: ${generatedPlan.semanas.length} semanas, ${totalSessions} sesiones, ${totalExercises} ejercicios total`);

    // 🎯 VALIDACIÓN CRÍTICA: Número correcto de sesiones por semana
    const expectedSessions = sessionsPerWeek * generatedPlan.duracion_total_semanas;

    if (totalSessions !== expectedSessions) {
      console.error(`❌ [CALISTENIA] Plan inválido: ${totalSessions} sesiones generadas, esperadas ${expectedSessions}`);
      console.error(`   📊 Desglose: ${sessionsPerWeek} sesiones/semana × ${generatedPlan.duracion_total_semanas} semanas = ${expectedSessions} esperadas`);
      throw new Error(`Plan incompleto: esperadas ${expectedSessions} sesiones (${sessionsPerWeek} por semana × ${generatedPlan.duracion_total_semanas} semanas), pero se generaron ${totalSessions}. El plan debe ser regenerado.`);
    }

    console.log(`✅ [CALISTENIA] Número de sesiones validado: ${totalSessions} sesiones (${sessionsPerWeek}/semana × ${generatedPlan.duracion_total_semanas} semanas)`);

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

      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;

      console.log(`✅ [CALISTENIA] Plan generado exitosamente:`, {
        methodologyPlanId,
        processingTime: `${processingTime}s`,
        planStartDay: generatedPlan.semanas[0]?.sesiones[0]?.dia || 'N/A',
        totalWeeks: generatedPlan.semanas.length,
        totalSessions: totalSessions,
        totalExercises: totalExercises
      });

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
          generation_timestamp: new Date().toISOString(),
          processing_time_seconds: processingTime,
          plan_start_date: getCurrentDayInfo().isoDate
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

    // 🔄 CAMBIO CRÍTICO: Cargar prompt desde archivo (como Calistenia, Powerlifting, Hipertrofia)
    clearPromptCache(FeatureKey.HEAVY_DUTY_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.HEAVY_DUTY_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Heavy Duty Specialist');
    }

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.HEAVY_DUTY_SPECIALIST);
    const config = AI_MODULES.HEAVY_DUTY_SPECIALIST;

    // Calcular frecuencia según nivel (Heavy Duty usa baja frecuencia)
    const frecuenciaObligatoria = dbLevel === 'Intermedio' ? 3 : 2; // Intermedio: 3 días, Principiante/Avanzado: 2 días

    // Obtener día actual
    const today = new Date();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = daysOfWeek[today.getDay()];
    const todayNormalized = normalizeDayName(todayName);

    // Crear payload estructurado (como Calistenia, Powerlifting, Hipertrofia)
    const planPayload = {
      task: isRegeneration ? 'regenerate_heavy_duty_plan' : 'generate_heavy_duty_plan',
      user_profile: fullUserProfile,
      selected_level: actualLevel,
      goals: goals || 'Maximizar intensidad con mínimo volumen (Mike Mentzer)',
      selected_muscle_groups: selectedMuscleGroups || ['Todos'],
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: 4,
        sessions_per_week: frecuenciaObligatoria,
        session_duration_min: 30, // Heavy Duty son sesiones cortas
        start_day: todayNormalized,
        start_date: new Date().toISOString().split('T')[0],
        training_days_only: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
        forbidden_days: ['Sabado', 'Domingo']
      },
      methodology_specifics: {
        max_series_per_exercise: dbLevel === 'Principiante' ? 2 : 1,
        max_exercises_per_session: 6,
        rest_between_sets: '240-360 segundos',
        intensity: 'RPE 10 - Fallo absoluto',
        tempo: '4-1-2 (énfasis negativas)'
      },
      ...(isRegeneration && {
        previous_plan: previousPlan,
        user_feedback: {
          reasons: regenerationReason || [],
          additional_instructions: additionalInstructions || null
        }
      })
    };

    // Log del payload estructurado
    logAIPayload('HEAVY_DUTY_PLAN', planPayload);

    let attempts = 0;
    let generatedPlan = null;
    let lastError = null;

    while (attempts < 3) {
      try {
        console.log(`🤖 [HEAVY DUTY] Intento ${attempts + 1}/3 de generar plan válido...`);

        const completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },  // ✅ USA PROMPT DEL ARCHIVO
            { role: 'user', content: JSON.stringify(planPayload) }  // ✅ PAYLOAD ESTRUCTURADO
          ],
          temperature: config.temperature || 0.7,  // Usa config del módulo (más alto que 0.4)
          max_tokens: config.max_output_tokens  // 16384 tokens para planes completos
        });

        const aiResponse = completion.choices[0].message.content;
        logAIResponse(aiResponse);
        logTokens(completion.usage);

        // Parsear respuesta
        let parsedPlan;
        try {
          parsedPlan = JSON.parse(parseAIResponse(aiResponse));
        } catch (parseError) {
          console.error('❌ Error parseando plan:', parseError);
          throw new Error('Plan generado con formato inválido');
        }

        // Validar estructura del plan
        if (!parsedPlan.semanas || !Array.isArray(parsedPlan.semanas)) {
          throw new Error('Plan sin semanas válidas');
        }

        // 🔥 VALIDACIÓN 1: Número de semanas
        if (parsedPlan.semanas.length !== 4) {
          throw new Error(`Plan debe tener exactamente 4 semanas, pero tiene ${parsedPlan.semanas.length}`);
        }

        // 🔥 VALIDACIÓN 2: Número de sesiones según nivel
        const expectedSessionsPerWeek = frecuenciaObligatoria;
        const expectedTotalSessions = expectedSessionsPerWeek * 4;

        let totalSessions = 0;
        parsedPlan.semanas.forEach(semana => {
          if (semana.sesiones && Array.isArray(semana.sesiones)) {
            totalSessions += semana.sesiones.length;
          }
        });

        if (totalSessions !== expectedTotalSessions) {
          // Analizar distribución de sesiones por semana para más detalle
          const sessionsByWeek = parsedPlan.semanas.map((semana, idx) => ({
            semana: idx + 1,
            sesiones: semana.sesiones?.length || 0,
            dias: semana.sesiones?.map(s => s.dia).join(', ') || 'Ninguno'
          }));

          console.error(`❌ [HEAVY DUTY] Error de validación de sesiones:`);
          console.error(`   Nivel: ${dbLevel} (${actualLevel})`);
          console.error(`   Esperadas: ${expectedTotalSessions} sesiones (${expectedSessionsPerWeek} días/semana × 4 semanas)`);
          console.error(`   Generadas: ${totalSessions} sesiones`);
          console.error(`   Distribución por semana:`, sessionsByWeek);

          throw new Error(
            `Plan incompleto para nivel ${dbLevel}: esperadas ${expectedTotalSessions} sesiones ` +
            `(${expectedSessionsPerWeek} días/semana × 4 semanas), pero se generaron ${totalSessions}. ` +
            `La IA debe generar EXACTAMENTE ${expectedSessionsPerWeek} sesiones por semana.`
          );
        }

        console.log(`✅ Validación sesiones: ${totalSessions}/${expectedTotalSessions} sesiones correctas`);

        // 🔥 VALIDACIÓN 2.5: Campo frecuencia_por_semana debe coincidir
        if (parsedPlan.frecuencia_por_semana !== expectedSessionsPerWeek) {
          console.warn(`⚠️ [HEAVY DUTY] Campo frecuencia_por_semana incorrecto:`);
          console.warn(`   Esperado: ${expectedSessionsPerWeek}`);
          console.warn(`   Recibido: ${parsedPlan.frecuencia_por_semana || 'undefined'}`);
          // Corregir automáticamente si es posible
          parsedPlan.frecuencia_por_semana = expectedSessionsPerWeek;
        }

        // 🔥 VALIDACIÓN 3: Solo días laborables (NO sábado/domingo)
        const weekendDays = [];
        const diasLaborables = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

        parsedPlan.semanas.forEach((semana, sIdx) => {
          semana.sesiones.forEach((sesion, dIdx) => {
            const diaName = sesion.dia;
            if (!diasLaborables.includes(diaName)) {
              weekendDays.push({
                semana: semana.numero || (sIdx + 1),
                dia: diaName
              });
            }
          });
        });

        if (weekendDays.length > 0) {
          const errorDetails = weekendDays.map(d =>
            `Semana ${d.semana}: ${d.dia}`
          ).join('; ');

          throw new Error(
            `Plan Heavy Duty inválido: ${weekendDays.length} sesiones en fin de semana (solo Lun-Vie permitidos). ` +
            `Detalles: ${errorDetails}`
          );
        }

        console.log(`✅ Validación días laborables: Todas las sesiones están en Lun-Vie`);

        // ✅ TODAS LAS VALIDACIONES PASARON
        generatedPlan = parsedPlan;
        console.log(`✅ [HEAVY DUTY] Plan válido generado en intento ${attempts + 1}/3`);
        break; // Salir del loop

      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`❌ [HEAVY DUTY] Intento ${attempts}/3 falló:`, error.message);

        // Si el error es por días de fin de semana, modificar el mensaje para el siguiente intento
        if (error.message.includes('fin de semana') && attempts < 3) {
          console.warn(`⚠️ [HEAVY DUTY] Reintentando sin días de fin de semana...`);
          await new Promise(resolve => setTimeout(resolve, attempts * 1000)); // Esperar 1s, 2s, 3s
        } else if (attempts < 3) {
          await new Promise(resolve => setTimeout(resolve, attempts * 1000)); // Backoff exponencial
        }
      }
    }

    // Si después de 3 intentos no hay plan válido, lanzar error
    if (!generatedPlan) {
      throw new Error(
        `No se pudo generar un plan válido después de 3 intentos. ` +
        `Último error: ${lastError?.message || 'Desconocido'}`
      );
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
             notas, "Cómo_hacerlo" as ejecucion, "Consejos" as consejos, "Errores_comunes" as errores_evitar
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

    // Obtener día actual para incluirlo en la generación
    const today = new Date();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = daysOfWeek[today.getDay()];
    const todayNormalized = normalizeDayName(todayName);

    // 🔄 CAMBIO CRÍTICO: Cargar prompt desde archivo (como Calistenia y Powerlifting)
    clearPromptCache(FeatureKey.HIPERTROFIA_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.HIPERTROFIA_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Hipertrofia Specialist');
    }

    // Calcular frecuencia correcta según nivel (Avanzado = 5 días)
    const frecuenciaObligatoria = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 5 : 4);

    // Crear payload estructurado (como Calistenia y Powerlifting)
    const planPayload = {
      task: isRegeneration ? 'regenerate_hipertrofia_plan' : 'generate_hipertrofia_plan',
      user_profile: fullUserProfile,
      selected_level: actualLevel,
      goals: goals || 'Hipertrofia muscular general',
      selected_muscle_groups: selectedMuscleGroups || ['Todos'],
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: 4,
        sessions_per_week: frecuenciaObligatoria,
        session_duration_min: 60,
        start_day: todayNormalized,
        start_date: new Date().toISOString().split('T')[0],
        training_days_only: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
        forbidden_days: ['Sabado', 'Domingo']
      },
      ...(isRegeneration && {
        previous_plan: previousPlan,
        user_feedback: {
          reasons: regenerationReason || [],
          additional_instructions: additionalInstructions || null
        }
      })
    };

    // Log del payload estructurado
    logAIPayload('HIPERTROFIA_PLAN', planPayload);

    let attempts = 0;
    let generatedPlan = null;
    let lastError = null;

    while (attempts < 3) {
      try {
        console.log(`🤖 [HIPERTROFIA] Intento ${attempts + 1}/3 de generar plan válido...`);

        const completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },  // ✅ USA PROMPT DEL ARCHIVO
            { role: 'user', content: JSON.stringify(planPayload) }  // ✅ PAYLOAD ESTRUCTURADO
          ],
          temperature: config.temperature || 0.8,  // Usa config del módulo (0.8)
          max_tokens: config.max_output_tokens  // 16384 tokens para planes completos
        });

        const aiResponse = completion.choices[0].message.content;
        logAIResponse(aiResponse);
        logTokens(completion.usage);

        // Parsear respuesta
        let parsedPlan;
        try {
          parsedPlan = JSON.parse(parseAIResponse(aiResponse));
        } catch (parseError) {
          console.error('❌ Error parseando plan:', parseError);
          throw new Error('Plan generado con formato inválido');
        }

        // Validar estructura del plan
        if (!parsedPlan.semanas || !Array.isArray(parsedPlan.semanas)) {
          throw new Error('Plan sin semanas válidas');
        }

        // 🔥 VALIDACIÓN 1: Número de semanas
        if (parsedPlan.semanas.length !== 4) {
          throw new Error(`Plan debe tener exactamente 4 semanas, pero tiene ${parsedPlan.semanas.length}`);
        }

        // 🔥 VALIDACIÓN 2: Número de sesiones según nivel
        const expectedSessionsPerWeek = frecuenciaObligatoria;
        const expectedTotalSessions = expectedSessionsPerWeek * 4;

        let totalSessions = 0;
        parsedPlan.semanas.forEach(semana => {
          if (semana.sesiones && Array.isArray(semana.sesiones)) {
            totalSessions += semana.sesiones.length;
          }
        });

        if (totalSessions !== expectedTotalSessions) {
          // Analizar distribución de sesiones por semana para más detalle
          const sessionsByWeek = parsedPlan.semanas.map((semana, idx) => ({
            semana: idx + 1,
            sesiones: semana.sesiones?.length || 0,
            dias: semana.sesiones?.map(s => s.dia).join(', ') || 'Ninguno'
          }));

          console.error(`❌ [HIPERTROFIA] Error de validación de sesiones:`);
          console.error(`   Nivel: ${dbLevel} (${actualLevel})`);
          console.error(`   Esperadas: ${expectedTotalSessions} sesiones (${expectedSessionsPerWeek} días/semana × 4 semanas)`);
          console.error(`   Generadas: ${totalSessions} sesiones`);
          console.error(`   Distribución por semana:`, sessionsByWeek);

          throw new Error(
            `Plan incompleto para nivel ${dbLevel}: esperadas ${expectedTotalSessions} sesiones ` +
            `(${expectedSessionsPerWeek} días/semana × 4 semanas), pero se generaron ${totalSessions}. ` +
            `La IA debe generar EXACTAMENTE ${expectedSessionsPerWeek} sesiones por semana.`
          );
        }

        console.log(`✅ Validación sesiones: ${totalSessions}/${expectedTotalSessions} sesiones correctas`);

        // 🔥 VALIDACIÓN 2.5: Campo frecuencia_por_semana debe coincidir
        if (parsedPlan.frecuencia_por_semana !== expectedSessionsPerWeek) {
          console.warn(`⚠️ [HIPERTROFIA] Campo frecuencia_por_semana incorrecto:`);
          console.warn(`   Esperado: ${expectedSessionsPerWeek}`);
          console.warn(`   Recibido: ${parsedPlan.frecuencia_por_semana || 'undefined'}`);
          // Corregir automáticamente si es posible
          parsedPlan.frecuencia_por_semana = expectedSessionsPerWeek;
        }

        // 🔥 VALIDACIÓN 3: Solo días laborables (NO sábado/domingo)
        const weekendDays = [];
        const diasLaborables = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

        parsedPlan.semanas.forEach((semana, sIdx) => {
          semana.sesiones.forEach((sesion, dIdx) => {
            const diaName = sesion.dia;
            if (!diasLaborables.includes(diaName)) {
              weekendDays.push({
                semana: semana.numero || (sIdx + 1),
                dia: diaName
              });
            }
          });
        });

        if (weekendDays.length > 0) {
          const errorDetails = weekendDays.map(d =>
            `Semana ${d.semana}: ${d.dia}`
          ).join('; ');

          throw new Error(
            `Plan Hipertrofia inválido: ${weekendDays.length} sesiones en fin de semana (solo Lun-Vie permitidos). ` +
            `Detalles: ${errorDetails}`
          );
        }

        console.log(`✅ Validación días laborables: Todas las sesiones están en Lun-Vie`);

        // ✅ TODAS LAS VALIDACIONES PASARON
        generatedPlan = parsedPlan;
        console.log(`✅ [HIPERTROFIA] Plan válido generado en intento ${attempts + 1}/3`);
        break; // Salir del loop

      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`❌ [HIPERTROFIA] Intento ${attempts}/3 falló:`, error.message);

        // Si el error es por días de fin de semana, modificar el mensaje para el siguiente intento
        if (error.message.includes('fin de semana') && attempts < 3) {
          console.warn(`⚠️ [HIPERTROFIA] Reintentando sin días de fin de semana...`);
          await new Promise(resolve => setTimeout(resolve, attempts * 1000)); // Esperar 1s, 2s, 3s
        } else if (attempts < 3) {
          await new Promise(resolve => setTimeout(resolve, attempts * 1000)); // Backoff exponencial
        }
      }
    }

    // Si después de 3 intentos no hay plan válido, lanzar error
    if (!generatedPlan) {
      throw new Error(
        `No se pudo generar un plan válido después de 3 intentos. ` +
        `Último error: ${lastError?.message || 'Desconocido'}`
      );
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

    logAIPayload('POWERLIFTING_EVALUATION', aiPayload);

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

    // 🔥 VALIDACIÓN: Verificar datos de fuerza para niveles avanzados
    const hasStrengthData =
      userProfile.squat_1rm ||
      userProfile.bench_press_1rm ||
      userProfile.deadlift_1rm ||
      userProfile.sentadilla_1rm ||
      userProfile.press_banca_1rm ||
      userProfile.peso_muerto_1rm;

    const recommendedLevel = evaluation.recommended_level.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Si el nivel es Elite o Avanzado pero NO hay datos de fuerza, downgrade a Intermedio
    if ((recommendedLevel === 'elite' || recommendedLevel === 'avanzado') && !hasStrengthData) {
      console.log(`⚠️ [POWERLIFTING] Downgrade de nivel: ${recommendedLevel} → intermedio (sin datos de fuerza verificados)`);
      console.log('📊 Datos de fuerza disponibles:', {
        squat_1rm: userProfile.squat_1rm || 'null',
        bench_press_1rm: userProfile.bench_press_1rm || 'null',
        deadlift_1rm: userProfile.deadlift_1rm || 'null'
      });

      evaluation.recommended_level = 'intermedio';
      evaluation.confidence = Math.max(0.5, evaluation.confidence * 0.65); // Reducir confianza
      evaluation.reasoning += '\n\n⚠️ [Ajustado a Intermedio]: Se requieren datos verificados de 1RM en los 3 levantamientos principales (Sentadilla, Press Banca, Peso Muerto) para niveles Avanzado o Elite. Por favor, registra tus marcas personales en el perfil para obtener una evaluación más precisa.';

      if (!evaluation.safety_considerations) {
        evaluation.safety_considerations = [];
      }
      evaluation.safety_considerations.unshift('Registra tus 1RM actuales en el perfil para obtener programación optimizada');
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

    // Obtener día actual para incluirlo en la generación
    const today = new Date();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = daysOfWeek[today.getDay()];
    const todayNormalized = normalizeDayName(todayName);
    // Convertir a abreviatura para Powerlifting
    const dayAbbrevMap = { 'Lunes': 'Lun', 'Martes': 'Mar', 'Miercoles': 'Mie', 'Jueves': 'Jue', 'Viernes': 'Vie', 'Sabado': 'Sab', 'Domingo': 'Dom' };
    const todayAbbrev = dayAbbrevMap[todayNormalized] || todayNormalized;

    // Determinar frecuencia según nivel
    const frecuenciaObligatoria = dbLevel === 'Elite' ? 6 : (dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 4 : 3));
    const sesionesTotales = frecuenciaObligatoria * 4;

    // userMessage YA NO SE USA - Ahora usamos planPayload estructurado
    // El mensaje anterior se mantiene comentado por referencia histórica
    /*
    const userMessage = `GENERACIÓN DE PLAN POWERLIFTING
    DÍA DE GENERACIÓN: ${todayAbbrev} (HOY)
    NIVEL: ${actualLevel}
    FRECUENCIA OBLIGATORIA: ${frecuenciaObligatoria} días por semana (${sesionesTotales} sesiones en total)
    LEVANTAMIENTOS PRIORITARIOS: ${selectedMuscleGroups?.join(', ') || 'Sentadilla, Press Banca, Peso Muerto'}
    OBJETIVOS: ${goals || 'Maximizar fuerza en los 3 levantamientos'}

⚠️ REQUISITOS CRÍTICOS PARA NIVEL ${actualLevel.toUpperCase()}:
- DEBES generar EXACTAMENTE ${frecuenciaObligatoria} días de entrenamiento por semana
- DEBES generar un total de ${sesionesTotales} sesiones (${frecuenciaObligatoria} días × 4 semanas)
- El campo "frecuencia_por_semana" en tu JSON DEBE ser ${frecuenciaObligatoria}
- NUNCA generes menos o más sesiones, el sistema rechazará el plan

🚫 RESTRICCIÓN ABSOLUTA DE DÍAS:
- SOLO puedes usar: Lun, Mar, Mie, Jue, Vie (Lunes a Viernes)
- NUNCA uses: Sab o Dom (Sábado o Domingo)
- Si incluyes Sábado o Domingo, el plan será RECHAZADO AUTOMÁTICAMENTE
- Para ${frecuenciaObligatoria} días/semana, distribuye las sesiones SOLO entre Lun-Vie

⚠️ EJERCICIOS DISPONIBLES DE SUPABASE (${availableExercises.length}):
**REGLA CRÍTICA:** SOLO usa ejercicios de esta lista. Los ejercicios provienen de la tabla app."Ejercicios_Powerlifting" filtrados por nivel:
- ${actualLevel === 'principiante' ? 'Solo ejercicios de nivel Principiante' : ''}
- ${actualLevel === 'intermedio' ? 'Ejercicios de nivel Principiante + Intermedio' : ''}
- ${actualLevel === 'avanzado' ? 'Ejercicios de nivel Principiante + Intermedio + Avanzado' : ''}
- ${actualLevel === 'elite' ? 'TODOS los ejercicios (Principiante + Intermedio + Avanzado + Elite)' : ''}

${availableExercises.map(ex =>
  `- ${ex.nombre} (${ex.categoria}) - Nivel: ${ex.nivel}, Equipamiento: ${ex.equipamiento}, Intensidad: ${ex.intensidad}`
).join('\n')}

⚠️ NUNCA inventes ejercicios que no estén en la lista anterior. Usa los nombres EXACTAMENTE como aparecen.

DURACIÓN: ${versionConfig?.customWeeks || 4} semanas

PRINCIPIOS POWERLIFTING OBLIGATORIOS:
1. Fuerza máxima: 75-95% 1RM en levantamientos principales
2. Bajo volumen: 3-8 series por ejercicio principal
3. Descansos largos: 3-7 minutos entre series pesadas
4. Especificidad: Sentadilla, Press Banca y Peso Muerto son prioritarios
5. Periodización: ${actualLevel === 'novato' ? 'Linear' : actualLevel === 'intermedio' ? 'Ondulante' : actualLevel === 'avanzado' ? 'Bloques' : 'Conjugate'}

🚨 RECORDATORIO FINAL CRÍTICO:
- Nivel ${actualLevel.toUpperCase()} = ${frecuenciaObligatoria} días/semana
- Total de sesiones OBLIGATORIO = ${sesionesTotales} sesiones
- Cada semana DEBE tener ${frecuenciaObligatoria} sesiones
- Campo JSON "frecuencia_por_semana": ${frecuenciaObligatoria}
- SOLO usa días Lun, Mar, Mie, Jue, Vie (NUNCA Sab/Dom)

${actualLevel === 'intermedio' ? `
EJEMPLO DE DISTRIBUCIÓN VÁLIDA PARA INTERMEDIO (4 días):
✅ Semana 1: Lun, Mar, Jue, Vie
✅ Semana 2: Lun, Mie, Jue, Vie
✅ Semana 3: Mar, Mie, Jue, Vie
✅ Semana 4: Lun, Mar, Mie, Vie

❌ NUNCA: Vie, Sab, Lun, Mar (incluye Sábado = RECHAZADO)
❌ NUNCA: Jue, Vie, Sab, Dom (incluye fin de semana = RECHAZADO)
` : ''}

GENERA un plan completo siguiendo el formato JSON de metodología con EXACTAMENTE ${sesionesTotales} sesiones usando SOLO días laborables.`;
    */

    // Loggear el payload antes de enviar a IA
    logAIPayload('POWERLIFTING_PLAN', {
      selected_level: actualLevel,
      available_exercises_count: availableExercises.length,
      muscle_groups: selectedMuscleGroups || ['Sentadilla', 'Press Banca', 'Peso Muerto'],
      goals: goals,
      is_regeneration: isRegeneration,
      plan_duration_weeks: versionConfig?.customWeeks || 4,
      user_profile: fullUserProfile
    });

    // 🔥 RETRY LOGIC: 3 intentos con validaciones completas
    const expectedSessionsPerWeek = dbLevel === 'Elite' ? 6 : (dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 4 : 3));
    const expectedTotalSessions = expectedSessionsPerWeek * 4;

    // 🔄 CAMBIO CRÍTICO: Cargar prompt desde archivo (como Calistenia)
    clearPromptCache(FeatureKey.POWERLIFTING_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.POWERLIFTING_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Powerlifting Specialist');
    }

    // Crear payload estructurado (como Calistenia)
    const planPayload = {
      task: isRegeneration ? 'regenerate_powerlifting_plan' : 'generate_powerlifting_plan',
      user_profile: fullUserProfile,
      selected_level: actualLevel,
      goals: goals || 'Maximizar fuerza en Sentadilla, Press Banca y Peso Muerto',
      selected_muscle_groups: selectedMuscleGroups || ['Sentadilla', 'Press Banca', 'Peso Muerto'],
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: 4,
        sessions_per_week: frecuenciaObligatoria,
        session_duration_min: 90,
        start_day: todayAbbrev,
        start_date: new Date().toISOString().split('T')[0],
        training_days_only: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'],
        forbidden_days: ['Sab', 'Dom']
      },
      ...(isRegeneration && {
        previous_plan: previousPlan,
        user_feedback: {
          reasons: regenerationReason || [],
          additional_instructions: additionalInstructions || null
        }
      })
    };

    // Log del payload estructurado
    logAIPayload('POWERLIFTING_PLAN', planPayload);

    let attempts = 0;
    let generatedPlan = null;
    let lastError = null;

    while (attempts < 3) {
      try {
        console.log(`🤖 [POWERLIFTING] Intento ${attempts + 1}/3 de generar plan válido...`);

        const completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },  // ✅ USA PROMPT DEL ARCHIVO
            { role: 'user', content: JSON.stringify(planPayload) }  // ✅ PAYLOAD ESTRUCTURADO
          ],
          temperature: config.temperature || 0.7,  // Usa config del módulo
          max_tokens: config.max_output_tokens  // 16384 tokens para planes completos
        });

        const aiResponse = completion.choices[0].message.content;
        logAIResponse(aiResponse);
        logTokens(completion.usage);

        // Parsear respuesta
        let parsedPlan;
        try {
          parsedPlan = JSON.parse(parseAIResponse(aiResponse));
        } catch (parseError) {
          console.error('❌ Error parseando plan:', parseError);
          throw new Error('Plan generado con formato inválido');
        }

        // Validar estructura del plan
        if (!parsedPlan.semanas || !Array.isArray(parsedPlan.semanas)) {
          throw new Error('Plan sin semanas válidas');
        }

        // 🔥 VALIDACIÓN 1: Número de semanas
        if (parsedPlan.semanas.length !== 4) {
          throw new Error(`Plan debe tener exactamente 4 semanas, pero tiene ${parsedPlan.semanas.length}`);
        }

        // 🔥 VALIDACIÓN 2: Número de sesiones según nivel
        let totalSessions = 0;
        parsedPlan.semanas.forEach(semana => {
          if (semana.sesiones && Array.isArray(semana.sesiones)) {
            totalSessions += semana.sesiones.length;
          }
        });

        if (totalSessions !== expectedTotalSessions) {
          // Analizar distribución de sesiones por semana para más detalle
          const sessionsByWeek = parsedPlan.semanas.map((semana, idx) => ({
            semana: idx + 1,
            sesiones: semana.sesiones?.length || 0,
            dias: semana.sesiones?.map(s => s.dia).join(', ') || 'Ninguno'
          }));

          console.error(`❌ [POWERLIFTING] Error de validación de sesiones:`);
          console.error(`   Nivel: ${dbLevel} (${actualLevel})`);
          console.error(`   Esperadas: ${expectedTotalSessions} sesiones (${expectedSessionsPerWeek} días/semana × 4 semanas)`);
          console.error(`   Generadas: ${totalSessions} sesiones`);
          console.error(`   Distribución por semana:`, sessionsByWeek);

          throw new Error(
            `Plan incompleto para nivel ${dbLevel}: esperadas ${expectedTotalSessions} sesiones ` +
            `(${expectedSessionsPerWeek} días/semana × 4 semanas), pero se generaron ${totalSessions}. ` +
            `La IA debe generar EXACTAMENTE ${expectedSessionsPerWeek} sesiones por semana.`
          );
        }

        console.log(`✅ Validación sesiones: ${totalSessions}/${expectedTotalSessions} sesiones correctas`);

        // 🔥 VALIDACIÓN 2.5: Campo frecuencia_por_semana debe coincidir
        if (parsedPlan.frecuencia_por_semana !== expectedSessionsPerWeek) {
          console.warn(`⚠️ [POWERLIFTING] Campo frecuencia_por_semana incorrecto:`);
          console.warn(`   Esperado: ${expectedSessionsPerWeek}`);
          console.warn(`   Recibido: ${parsedPlan.frecuencia_por_semana || 'undefined'}`);
          // Corregir automáticamente si es posible
          parsedPlan.frecuencia_por_semana = expectedSessionsPerWeek;
        }

        // 🔥 VALIDACIÓN 3: Solo días laborables (NO sábado/domingo)
        // Powerlifting usa abreviaturas: Lun, Mar, Mie, Jue, Vie
        const weekendDays = [];
        const diasLaborablesAbrev = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
        const diasLaborablesCompletos = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

        parsedPlan.semanas.forEach((semana, sIdx) => {
          semana.sesiones.forEach((sesion, dIdx) => {
            const diaName = sesion.dia;
            // Verificar tanto abreviaturas como nombres completos
            const isWeekday = diasLaborablesAbrev.includes(diaName) || diasLaborablesCompletos.includes(diaName);

            if (!isWeekday) {
              weekendDays.push({
                semana: semana.semana || (sIdx + 1),
                dia: diaName
              });
            }
          });
        });

        if (weekendDays.length > 0) {
          const errorDetails = weekendDays.map(d =>
            `Semana ${d.semana}: ${d.dia}`
          ).join('; ');

          throw new Error(
            `Plan Powerlifting inválido: ${weekendDays.length} sesiones en fin de semana (solo Lun-Vie permitidos). ` +
            `Detalles: ${errorDetails}`
          );
        }

        console.log(`✅ Validación días laborables: Todas las sesiones están en Lun-Vie`);

        // ✅ TODAS LAS VALIDACIONES PASARON
        generatedPlan = parsedPlan;
        console.log(`✅ [POWERLIFTING] Plan válido generado en intento ${attempts + 1}/3`);
        break; // Salir del loop

      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`❌ [POWERLIFTING] Intento ${attempts}/3 falló:`, error.message);

        // Si el error es por días de fin de semana, modificar el mensaje para el siguiente intento
        if (error.message.includes('fin de semana') && attempts < 3) {
          // Agregar advertencia adicional al mensaje
          const warningPrefix = `
⚠️ ERROR EN INTENTO ANTERIOR: Incluiste Sábado o Domingo, lo cual está PROHIBIDO.

🚫 RECORDATORIO CRÍTICO:
- NUNCA uses Sab o Dom en ninguna sesión
- SOLO puedes usar: Lun, Mar, Mie, Jue, Vie
- Para ${frecuenciaObligatoria} días/semana, distribúyelos SOLO entre Lun-Vie

Ejemplos válidos para ${frecuenciaObligatoria} días:
- Lun, Mar, Jue, Vie ✅
- Lun, Mie, Jue, Vie ✅
- Mar, Mie, Jue, Vie ✅
NUNCA: Vie, Sab, Lun, Mar ❌ (incluye Sábado)

`;
          userMessage = warningPrefix + userMessage;
        }

        if (attempts < 3) {
          const waitTime = 1000 * attempts; // Exponential backoff: 1s, 2s
          console.log(`⏳ Esperando ${waitTime}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Verificar si logramos generar un plan válido
    if (!generatedPlan) {
      console.error('❌ [POWERLIFTING] No se pudo generar plan válido después de 3 intentos');
      throw new Error(
        `No se pudo generar un plan válido de Powerlifting después de 3 intentos. ` +
        `Último error: ${lastError?.message || 'Desconocido'}`
      );
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

    logAIPayload('CROSSFIT_EVALUATION', aiPayload);

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

DURACIÓN: 4 semanas

PRINCIPIOS CROSSFIT OBLIGATORIOS:
1. Variedad constante: WODs constantemente variados (AMRAP, EMOM, For Time, Tabata, Chipper, Strength)
2. Alta intensidad: Mantener intensidad > 75% capacidad máxima
3. Movimientos funcionales: Multiarticulares, replican patrones naturales
4. Balance de dominios: G/W/M equilibrados semanalmente (Gymnastic, Weightlifting, Monostructural)
5. Scalability: Cada WOD debe incluir scaling options
6. Benchmarks: Incluir WODs benchmark (Fran, Helen, Cindy, Murph, etc.) cada 4 semanas
7. Descansos: ${actualLevel === 'principiante' ? '60-90s' : actualLevel === 'intermedio' ? '30-60s' : '30s o menos'} según capacidad metabólica

⚠️⚠️⚠️ REGLA CRÍTICA OBLIGATORIA ⚠️⚠️⚠️
CADA DÍA DE ENTRENAMIENTO DEBE TENER ENTRE 3 Y 8 MOVIMIENTOS EN EL ARRAY "movimientos[]".
NO PUEDES GENERAR DÍAS CON SOLO 1 O 2 MOVIMIENTOS. ESTO ES ABSOLUTAMENTE OBLIGATORIO.
Verifica ANTES de responder que TODOS los días tengan al menos 3 movimientos.

GENERA un plan completo siguiendo el formato JSON de metodología.`;

    // Retry logic con 3 intentos (incluye generación + validación)
    let attempts = 0;
    let normalizedPlan = null;
    let lastError = null;

    const MIN_EXERCISES = 3; // Por defecto (AMRAP/EMOM/Chipper/Tabata)
    const MAX_EXERCISES = 8;

    // Mínimo dinámico por tipo de WOD
    const getMinExercisesForType = (tipo) => {
      const t = String(tipo || '').toLowerCase();
      if (t.includes('for time') || t.includes('strength')) return 2; // Fran/Strength
      return MIN_EXERCISES;
    };

    while (attempts < 3) {
      try {
        console.log(`🤖 [CROSSFIT] Intento ${attempts + 1}/3 de generación de plan...`);

        const completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: `Eres un CrossFit Level-2 Trainer certificado. Generas planes de entrenamiento (WODs) basados en la metodología CrossFit oficial: variedad constante, movimientos funcionales, alta intensidad.

RESPONDE SOLO EN JSON PURO, SIN MARKDOWN.

⚠️ REGLA OBLIGATORIA CRÍTICA - MÍNIMO DE EJERCICIOS:
CADA DÍA DE ENTRENAMIENTO DEBE TENER MÍNIMO 3 MOVIMIENTOS Y MÁXIMO 8 MOVIMIENTOS.
Esta regla es ABSOLUTA y NO puede violarse bajo ninguna circunstancia.

El plan DEBE incluir:
- calendario: array de semanas con días de entrenamiento
- cada día tiene un WOD con tipo (AMRAP, EMOM, For Time, Tabata, Chipper, Strength)
- ⚠️ OBLIGATORIO: CADA WOD debe contener entre 3-8 movimientos en el array "movimientos[]"
- WODs tipo AMRAP/EMOM: 3-5 movimientos, WODs For Time: 4-6 movimientos
- cada ejercicio tiene: nombre, reps/tiempo, carga, scaling options
- balance de dominios G/W/M
- benchmarks cada 4 semanas

VALIDACIÓN FINAL: Antes de responder, verifica que TODOS los días tengan al menos 3 movimientos en el array "movimientos[]".

FORMATO EXACTO:
{
  "metodologia": "CrossFit",
  "nivel_crossfit": "${actualLevel}",
  "duracion_semanas": 4,
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
          temperature: 0.7,  // Balance entre variedad y consistencia (alineado con Calistenia)
          max_tokens: config.max_output_tokens  // 16384 tokens (igual que Calistenia)
        });

        const aiResponse = completion.choices[0].message.content;
        logAIResponse(aiResponse);
        logTokens(completion.usage);

        // Parsear respuesta
        const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

        // Validar estructura del plan
        if (!generatedPlan.calendario || !Array.isArray(generatedPlan.calendario)) {
          throw new Error('Plan sin calendario válido');
        }

        // 🔥 NORMALIZAR PLAN: Convertir formato calendario → semanas
        console.log('🔄 Normalizando plan CrossFit (calendario → semanas)...');
        normalizedPlan = normalizeCrossFitPlan(generatedPlan);

        // Validar plan normalizado
        if (!normalizedPlan?.semanas || !Array.isArray(normalizedPlan.semanas) || normalizedPlan.semanas.length === 0) {
          throw new Error('Plan normalizado sin semanas válidas');
        }

        console.log(`✅ Plan normalizado: ${normalizedPlan.semanas.length} semanas, ${normalizedPlan.frecuencia_semanal} días/semana`);

        // Validar número total de sesiones
        const sessionsPerWeek = normalizedPlan.frecuencia_semanal;
        const totalWeeks = normalizedPlan.semanas.length;
        const expectedSessions = sessionsPerWeek * totalWeeks;

        let totalSessions = 0;
        normalizedPlan.semanas.forEach(semana => {
          if (semana.sesiones && Array.isArray(semana.sesiones)) {
            totalSessions += semana.sesiones.length;
          }
        });

        if (totalSessions !== expectedSessions) {
          throw new Error(`Plan incompleto: esperadas ${expectedSessions} sesiones (${sessionsPerWeek} sesiones/semana × ${totalWeeks} semanas), pero se generaron ${totalSessions} sesiones`);
        }

        console.log(`✅ Validación sesiones: ${totalSessions}/${expectedSessions} sesiones correctas`);

        // Validar MÍNIMO de ejercicios por sesión (CrossFit requiere 3-8 movimientos por WOD)
        const invalidDays = [];

        normalizedPlan.semanas.forEach((semana, sIdx) => {
          semana.sesiones.forEach((sesion, dIdx) => {
            const numExercises = Array.isArray(sesion.ejercicios) ? sesion.ejercicios.length : 0;
            const minForType = getMinExercisesForType(sesion.tipo);

            if (numExercises < minForType) {
              invalidDays.push({
                semana: semana.semana,
                dia: sesion.dia,
                tipo: sesion.tipo || 'WOD',
                ejercicios: numExercises,
                minimo: minForType
              });
            }

            if (numExercises > MAX_EXERCISES) {
              console.warn(`⚠️ Semana ${semana.semana}, ${sesion.dia}: ${numExercises} ejercicios excede el máximo recomendado (${MAX_EXERCISES})`);
            }
          });
        });

        if (invalidDays.length > 0) {
          const errorDetails = invalidDays.map(d =>
            `Semana ${d.semana}, ${d.dia}: ${d.ejercicios} ejercicios (mínimo: ${d.minimo})`
          ).join('; ');

          throw new Error(`Plan CrossFit inválido: ${invalidDays.length} días con menos de ${MIN_EXERCISES} ejercicios. Detalles: ${errorDetails}`);
        }

        console.log(`✅ Validación ejercicios: Todos los días tienen entre ${MIN_EXERCISES}-${MAX_EXERCISES} movimientos`);
        console.log(`✅ [CROSSFIT] Plan generado y validado exitosamente en intento ${attempts + 1}`);
        break; // Plan válido, salir del loop

      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`❌ [CROSSFIT] Error en intento ${attempts}/3:`, error.message);

        if (attempts < 3) {
          const waitTime = 1000 * attempts; // Backoff exponencial: 1s, 2s, 3s
          console.log(`⏳ Esperando ${waitTime}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Si no se logró generar un plan válido después de 3 intentos
    if (!normalizedPlan) {
      throw new Error(`No se pudo generar un plan CrossFit válido después de 3 intentos. Último error: ${lastError?.message || 'Desconocido'}`);
    }

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

    // 🔄 CAMBIO CRÍTICO: Cargar prompt desde archivo (como Calistenia, Powerlifting, Hipertrofia, Heavy Duty, Halterofilia)
    clearPromptCache(FeatureKey.FUNCIONAL_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.FUNCIONAL_SPECIALIST);
    console.log(`✅ System prompt cargado (${systemPrompt.length} caracteres)`);

    // 🔢 Calcular frecuencia según nivel (Funcional)
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 4 : 3);
    console.log(`📅 Frecuencia calculada: ${sessionsPerWeek} días/semana para nivel ${dbLevel}`);

    // 📦 Crear payload estructurado (como Calistenia, Powerlifting, Hipertrofia, Heavy Duty, Halterofilia)
    const planPayload = {
      task: isRegeneration ? 'regenerate_funcional_plan' : 'generate_funcional_plan',
      user_profile: fullUserProfile,
      selected_level: actualLevel,
      goals: goals || 'Desarrollar fuerza funcional y movilidad',
      selected_patterns: selectedMuscleGroups || ['Squat', 'Hinge', 'Push', 'Pull', 'Core'],
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: versionConfig?.customWeeks || 4,
        sessions_per_week: sessionsPerWeek,
        training_days_only: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
        forbidden_days: ['Sabado', 'Domingo']
      },
      methodology_specifics: {
        main_patterns: ['Squat', 'Hinge', 'Push', 'Pull', 'Rotation', 'Anti-rotation', 'Locomotion', 'Carry'],
        progression_model: 'Bilateral → Unilateral, Estable → Inestable',
        rest_between_sets: actualLevel === 'principiante' ? '60-75s' : actualLevel === 'intermedio' ? '45-60s' : '45s',
        intensity_guide: 'RPE 6-8'
      },
      previous_plan: previousPlan,
      regeneration_reason: regenerationReason,
      additional_instructions: additionalInstructions
    };

    console.log('📦 Payload estructurado creado');

    // 🔄 Retry logic con 3 intentos (como Calistenia, Powerlifting, Hipertrofia, Heavy Duty, Halterofilia)
    const client = getModuleOpenAI(AI_MODULES.FUNCIONAL_SPECIALIST);
    const config = AI_MODULES.FUNCIONAL_SPECIALIST;

    let generatedPlan = null;
    let lastError = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🤖 [Intento ${attempt}/${MAX_RETRIES}] Llamando a OpenAI para generación Funcional...`);
        const startTime = Date.now();

        const completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(planPayload) }
          ],
          temperature: config.temperature,
          max_tokens: config.max_output_tokens,
          response_format: { type: 'json_object' }
        });

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  OpenAI respondió en ${elapsedTime}s (intento ${attempt})`);

        const rawContent = completion.choices[0].message.content;
        const cleanedResponse = parseAIResponse(rawContent);
        generatedPlan = JSON.parse(cleanedResponse);

        // ✅ Validación de estructura básica
        if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
          throw new Error('Plan no tiene estructura válida (falta semanas)');
        }

        // ✅ Validación de semanas
        const expectedWeeks = versionConfig?.customWeeks || 4;
        if (generatedPlan.semanas.length !== expectedWeeks) {
          throw new Error(`Plan tiene ${generatedPlan.semanas.length} semanas, esperadas ${expectedWeeks}`);
        }

        // ✅ Validación de sesiones totales
        const totalSessions = generatedPlan.semanas.reduce((sum, week) =>
          sum + (week.sesiones?.length || 0), 0
        );
        const expectedSessions = sessionsPerWeek * expectedWeeks;

        if (totalSessions !== expectedSessions) {
          throw new Error(
            `Plan tiene ${totalSessions} sesiones totales, esperadas ${expectedSessions} ` +
            `(${sessionsPerWeek} días × ${expectedWeeks} semanas)`
          );
        }

        // ✅ Validación de días de fin de semana
        const weekendDays = ['Sabado', 'Sábado', 'Domingo'];
        const hasWeekendSessions = generatedPlan.semanas.some(week =>
          week.sesiones?.some(session =>
            weekendDays.some(day => session.dia?.includes(day))
          )
        );

        if (hasWeekendSessions) {
          throw new Error('❌ Plan contiene sesiones en fin de semana (Sábado/Domingo) - PROHIBIDO');
        }

        console.log(`✅ Plan Funcional validado correctamente (intento ${attempt})`);
        console.log(`   - ${expectedWeeks} semanas`);
        console.log(`   - ${totalSessions} sesiones totales`);
        console.log(`   - Solo días laborables`);
        break; // Éxito, salir del loop

      } catch (error) {
        lastError = error;
        console.error(`❌ Error en intento ${attempt}/${MAX_RETRIES}:`, error.message);

        if (attempt < MAX_RETRIES) {
          const waitTime = attempt * 1000;
          console.log(`⏳ Reintentando en ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Si después de todos los intentos no se generó un plan válido, lanzar error
    if (!generatedPlan) {
      throw new Error(
        `No se pudo generar un plan válido después de ${MAX_RETRIES} intentos. ` +
        `Último error: ${lastError?.message || 'Desconocido'}`
      );
    }

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
 * Helper: Normaliza nombres de días eliminando tildes para compatibilidad con workout_schedule
 * @param {string} dayName - Nombre del día con tildes: "Lunes", "Miércoles", "Sábado"
 * @returns {string} Nombre sin tildes: "Lunes", "Miercoles", "Sabado"
 */
function normalizeDayName(dayName) {
  if (!dayName || typeof dayName !== 'string') return dayName;

  const normalizationMap = {
    'Lunes': 'Lunes',
    'Martes': 'Martes',
    'Miércoles': 'Miercoles',   // ← Sin tilde (compatibilidad BD)
    'Mié': 'Miercoles',          // ← Abreviatura
    'Miercoles': 'Miercoles',    // ← Ya normalizado
    'Jueves': 'Jueves',
    'Jue': 'Jueves',             // ← Abreviatura
    'Viernes': 'Viernes',
    'Vie': 'Viernes',            // ← Abreviatura
    'Sábado': 'Sabado',          // ← Sin tilde
    'Sab': 'Sabado',             // ← Abreviatura
    'Sabado': 'Sabado',          // ← Ya normalizado
    'Domingo': 'Domingo',
    'Dom': 'Domingo'             // ← Abreviatura
  };

  return normalizationMap[dayName] || dayName;
}

/**
 * Helper: Parsea repeticiones desde string de series (ej: "3x10" → "10", "5 x 3" → "3")
 * @param {string} seriesString - String tipo "3x10", "5 x 3 @ 70%", "3 x 8 con PVC"
 * @returns {string} Número de repeticiones o string original
 */
function parseRepsFromSeries(seriesString) {
  if (!seriesString || typeof seriesString !== 'string') return '';

  // Buscar patrón: número x número (con o sin espacios)
  const match = seriesString.match(/(\d+)\s*x\s*(\d+)/i);
  if (match) {
    return match[2]; // Segundo número es las repeticiones
  }

  // Si no hay patrón, devolver el string original
  return seriesString;
}

/**
 * Normaliza plan de Halterofilia para compatibilidad con ensureWorkoutScheduleV2
 *
 * Problema: Halterofilia genera estructura con bloques[] que no es reconocida
 * Solución: Aplanar bloques a ejercicios[] directos en sesión
 *
 * @param {Object} generatedPlan - Plan generado por OpenAI
 * @returns {Object} Plan normalizado compatible con workout_schedule
 */
function normalizeHalterofiliaPlan(generatedPlan) {
  console.log('🔄 Normalizando plan de Halterofilia (bloques → ejercicios directos)...');

  if (!generatedPlan || !generatedPlan.semanas) {
    throw new Error('Plan inválido para normalizar');
  }

  // Copiar estructura
  const normalized = {
    ...generatedPlan,
    semanas: []
  };

  // Detectar sessions_per_week si no está
  let inferredSessionsPerWeek = 0;
  if (generatedPlan.semanas.length > 0 && generatedPlan.semanas[0].sesiones) {
    inferredSessionsPerWeek = generatedPlan.semanas[0].sesiones.length;
  }

  // Procesar cada semana
  for (const semana of generatedPlan.semanas) {
    const normalizedSemana = {
      numero: semana.numero || semana.semana,
      enfoque: semana.enfoque || '',
      sesiones: []
    };

    if (!semana.sesiones || !Array.isArray(semana.sesiones)) {
      console.warn(`⚠️ Semana ${semana.numero} sin sesiones, saltando...`);
      continue;
    }

    // Procesar cada sesión
    for (const sesion of semana.sesiones) {
      const rawDayName = sesion.dia || sesion.dia_semana;
      const normalizedSesion = {
        dia: normalizeDayName(rawDayName),  // ⚠️ Normalizar nombre (eliminar tildes, expandir abreviaturas)
        tipo: sesion.tipo || 'Entrenamiento',
        duracion_min: sesion.duracion_min || 60,
        ejercicios: []
      };

      // 🔥 ESTRATEGIA: Prioridad ejercicios directos > bloques (evita duplicados)
      const hasDirectExercises = sesion.ejercicios && Array.isArray(sesion.ejercicios) && sesion.ejercicios.length > 0;

      if (hasDirectExercises) {
        // Si ya tiene ejercicios directos, usarlos ÚNICAMENTE
        normalizedSesion.ejercicios = [...sesion.ejercicios];
      } else if (sesion.bloques && Array.isArray(sesion.bloques)) {
        // Si NO tiene ejercicios directos, extraer desde bloques
        for (const bloque of sesion.bloques) {
          if (bloque.ejercicios && Array.isArray(bloque.ejercicios)) {
            normalizedSesion.ejercicios.push(...bloque.ejercicios);
          }
        }
      }

      // 🔥 DEDUPLICACIÓN: Eliminar ejercicios duplicados por nombre + series
      const uniqueExercises = [];
      const seen = new Set();

      normalizedSesion.ejercicios.forEach(ejercicio => {
        // Crear clave única: nombre + series_reps (o series_reps_objetivo)
        const key = `${ejercicio.nombre}-${ejercicio.series_reps || ejercicio.series_reps_objetivo || ''}`;

        if (!seen.has(key)) {
          seen.add(key);
          // Asegurar campos esperados por el frontend
          const normalizedExercise = {
            ...ejercicio,
            // Mapear series_reps si falta
            series_reps: ejercicio.series_reps || ejercicio.series_reps_objetivo || '',
            // Asegurar que repeticiones exista (parsear de series_reps si es necesario)
            repeticiones: ejercicio.repeticiones || parseRepsFromSeries(ejercicio.series_reps || ejercicio.series_reps_objetivo || '')
          };
          uniqueExercises.push(normalizedExercise);
        }
      });

      normalizedSesion.ejercicios = uniqueExercises;

      // Guardar bloques originales para visualización (opcional)
      if (sesion.bloques) {
        normalizedSesion.bloques = sesion.bloques;
      }

      normalizedSemana.sesiones.push(normalizedSesion);
    }

    normalized.semanas.push(normalizedSemana);
  }

  // Añadir campos requeridos si faltan
  if (!normalized.duracion_total_semanas) {
    normalized.duracion_total_semanas = normalized.semanas.length;
  }

  if (!normalized.frecuencia_por_semana && inferredSessionsPerWeek > 0) {
    normalized.frecuencia_por_semana = inferredSessionsPerWeek;
  }

  // 🔥 MAPEAR nivel_halterofilia_detectado → nivel_usuario (requerido por validación)
  if (!normalized.nivel_usuario) {
    normalized.nivel_usuario = generatedPlan.nivel_halterofilia_detectado ||
                                generatedPlan.nivel ||
                                'intermedio';
  }

  // 🔥 ASEGURAR CAMPOS OBLIGATORIOS PARA VISUALIZACIÓN EN FRONTEND
  // Estos campos son necesarios para que getMethodologyName() funcione correctamente
  if (!normalized.selected_style) {
    normalized.selected_style = 'Halterofilia';
  }

  if (!normalized.metodologia_solicitada) {
    normalized.metodologia_solicitada = 'Halterofilia';
  }

  console.log(`✅ Plan normalizado: ${normalized.semanas.length} semanas, ${normalized.frecuencia_por_semana || 'N/A'} sesiones/semana`);

  return normalized;
}

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

    // 🔄 Limpiar cache y cargar prompt actualizado
    clearPromptCache(FeatureKey.HALTEROFILIA_SPECIALIST);
    const systemPrompt = await getPrompt(FeatureKey.HALTEROFILIA_SPECIALIST);

    if (!systemPrompt) {
      throw new Error('Prompt no disponible para Halterofilia Specialist');
    }

    // Obtener día actual para incluirlo en la generación
    const today = new Date();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = daysOfWeek[today.getDay()];
    const todayNormalized = normalizeDayName(todayName);

    // 🔄 Definir parámetros de validación según nivel (ajustado para evitar fines de semana)
    // Halterofilia necesita alta frecuencia pero mantenemos 5 días máximo
    const sessionsPerWeek = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 4 : 3);
    const MIN_EXERCISES = dbLevel === 'Avanzado' ? 5 : (dbLevel === 'Intermedio' ? 4 : 3);
    const MAX_EXERCISES = 8;

    // Crear payload estructurado (como las otras metodologías)
    const planPayload = {
      task: isRegeneration ? 'regenerate_halterofilia_plan' : 'generate_halterofilia_plan',
      user_profile: fullUserProfile,
      selected_level: actualLevel,
      goals: goals || 'Desarrollar técnica olímpica y potencia explosiva',
      selected_focus: selectedMuscleGroups || ['Snatch', 'Clean & Jerk', 'Fuerza Base'],
      available_exercises: availableExercises,
      plan_requirements: {
        duration_weeks: 4,
        sessions_per_week: sessionsPerWeek,
        session_duration_min: dbLevel === 'Avanzado' ? 90 : (dbLevel === 'Intermedio' ? 75 : 60),
        start_day: todayNormalized,
        start_date: new Date().toISOString().split('T')[0],
        training_days_only: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
        forbidden_days: ['Sabado', 'Domingo']
      },
      methodology_specifics: {
        main_lifts: ['Snatch', 'Clean & Jerk'],
        progression_model: 'Hang → Bloques → Suelo',
        overload_work: 'Pulls 100-120% del lift',
        strength_base: ['Front Squat', 'Back Squat', 'Overhead Squat'],
        rest_between_sets: actualLevel === 'principiante' ? '2-3 min' : actualLevel === 'intermedio' ? '3-4 min' : '4-5 min',
        periodization: 'Semana 1-2 volume, Semana 3 intensity, Semana 4 deload',
        min_exercises_per_session: MIN_EXERCISES,
        max_exercises_per_session: MAX_EXERCISES
      },
      ...(isRegeneration && {
        previous_plan: previousPlan,
        user_feedback: {
          reasons: regenerationReason || [],
          additional_instructions: additionalInstructions || null
        }
      })
    };

    // Log del payload estructurado
    logAIPayload('HALTEROFILIA_PLAN', planPayload);

    // 🔥 RETRY LOGIC CON VALIDACIONES COMPLETAS
    let attempts = 0;
    let completion = null;
    let lastError = null;
    let normalizedPlan = null;

    while (attempts < 3) {
      try {
        console.log(`🤖 [HALTEROFILIA] Intento ${attempts + 1}/3 de generación de plan...`);

        completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(planPayload) }  // ✅ PAYLOAD ESTRUCTURADO
          ],
          temperature: config.temperature,
          max_tokens: config.max_output_tokens,
          response_format: { type: 'json_object' }
        });

        const aiResponse = completion.choices[0].message.content;
        logAIResponse(aiResponse);
        logTokens(completion.usage);

        // Parsear respuesta
        const generatedPlan = JSON.parse(parseAIResponse(aiResponse));

        // Validar estructura básica
        if (!generatedPlan.semanas || !Array.isArray(generatedPlan.semanas)) {
          throw new Error('Plan generado no tiene estructura válida (falta semanas)');
        }

        // 🔥 NORMALIZAR PLAN
        console.log('🔄 Normalizando plan Halterofilia (bloques → ejercicios)...');
        normalizedPlan = normalizeHalterofiliaPlan(generatedPlan);

        // Validar plan normalizado
        if (!normalizedPlan?.semanas || !Array.isArray(normalizedPlan.semanas) || normalizedPlan.semanas.length === 0) {
          throw new Error('Plan normalizado sin semanas válidas');
        }

        console.log(`✅ Plan normalizado: ${normalizedPlan.semanas.length} semanas, ${normalizedPlan.frecuencia_por_semana || 'N/A'} sesiones/semana`);

        // 🔥 VALIDACIÓN 1: Campos requeridos
        const requiredFields = [
          'semanas',
          'duracion_total_semanas',
          'frecuencia_por_semana',
          'nivel_usuario'
        ];

        const missingFields = [];
        for (const field of requiredFields) {
          if (!normalizedPlan[field]) {
            missingFields.push(field);
          }
        }

        if (missingFields.length > 0) {
          throw new Error(`Plan incompleto: faltan campos [${missingFields.join(', ')}]`);
        }

        console.log(`✅ Validación campos: Todos los campos requeridos presentes`);

        // 🔥 VALIDACIÓN 2: Número total de sesiones
        const totalWeeks = normalizedPlan.duracion_total_semanas || 4;
        const expectedSessions = sessionsPerWeek * totalWeeks;

        let totalSessions = 0;
        normalizedPlan.semanas.forEach(semana => {
          if (semana.sesiones && Array.isArray(semana.sesiones)) {
            totalSessions += semana.sesiones.length;
          }
        });

        if (totalSessions !== expectedSessions) {
          throw new Error(
            `Plan incompleto: esperadas ${expectedSessions} sesiones ` +
            `(${sessionsPerWeek} sesiones/semana × ${totalWeeks} semanas), ` +
            `pero se generaron ${totalSessions} sesiones. El plan debe ser regenerado.`
          );
        }

        console.log(`✅ Validación sesiones: ${totalSessions}/${expectedSessions} sesiones correctas`);

        // 🔥 VALIDACIÓN 3: Mínimo de ejercicios por sesión
        const invalidDays = [];

        normalizedPlan.semanas.forEach((semana, sIdx) => {
          semana.sesiones.forEach((sesion, dIdx) => {
            const numExercises = sesion.ejercicios ? sesion.ejercicios.length : 0;

            if (numExercises < MIN_EXERCISES) {
              invalidDays.push({
                semana: semana.numero,
                dia: sesion.dia,
                ejercicios: numExercises,
                minimo: MIN_EXERCISES
              });
            }

            if (numExercises > MAX_EXERCISES) {
              console.warn(`⚠️ Semana ${semana.numero}, ${sesion.dia}: ${numExercises} ejercicios excede el máximo recomendado (${MAX_EXERCISES})`);
            }
          });
        });

        if (invalidDays.length > 0) {
          const errorDetails = invalidDays.map(d =>
            `Semana ${d.semana}, ${d.dia}: ${d.ejercicios} ejercicios (mínimo: ${d.minimo})`
          ).join('; ');

          throw new Error(
            `Plan Halterofilia inválido: ${invalidDays.length} días con menos de ${MIN_EXERCISES} ejercicios. ` +
            `Detalles: ${errorDetails}`
          );
        }

        console.log(`✅ Validación ejercicios: Todos los días tienen entre ${MIN_EXERCISES}-${MAX_EXERCISES} ejercicios`);

        // 🔥 VALIDACIÓN 4: Solo días laborables (NO sábado/domingo)
        const weekendDays = [];
        const diasLaborables = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

        normalizedPlan.semanas.forEach((semana, sIdx) => {
          semana.sesiones.forEach((sesion, dIdx) => {
            const diaName = sesion.dia;
            if (!diasLaborables.includes(diaName)) {
              weekendDays.push({
                semana: semana.numero,
                dia: diaName
              });
            }
          });
        });

        if (weekendDays.length > 0) {
          const errorDetails = weekendDays.map(d =>
            `Semana ${d.semana}: ${d.dia}`
          ).join('; ');

          throw new Error(
            `Plan Halterofilia inválido: ${weekendDays.length} sesiones en fin de semana (solo Lun-Vie permitidos). ` +
            `Detalles: ${errorDetails}`
          );
        }

        console.log(`✅ Validación días laborables: Todas las sesiones están en Lun-Vie`);
        console.log(`✅ [HALTEROFILIA] Plan generado y validado exitosamente en intento ${attempts + 1}`);
        break; // Plan válido, salir del loop

      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`❌ [HALTEROFILIA] Error en intento ${attempts}/3:`, error.message);

        if (attempts < 3) {
          const waitTime = 1000 * attempts; // Backoff exponencial: 1s, 2s, 3s
          console.log(`⏳ Esperando ${waitTime}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Si no se logró generar un plan válido después de 3 intentos
    if (!normalizedPlan) {
      throw new Error(`No se pudo generar un plan Halterofilia válido después de 3 intentos. Último error: ${lastError?.message || 'Desconocido'}`);
    }

    console.log(`✅ Plan Halterofilia generado por IA`)

    // Guardar en BD con transacción
    const client_db = await pool.connect();

    try {
      await client_db.query('BEGIN');

      // Limpiar drafts previos
      await cleanUserDrafts(userId, client_db);

      // Insertar plan NORMALIZADO
      const planResult = await client_db.query(`
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [userId, 'Halterofilia', JSON.stringify(normalizedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan Halterofilia guardado con ID: ${methodologyPlanId}`);

      res.json({
        success: true,
        plan: normalizedPlan,
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

${fullUserProfile.usar_preferencias_ia ? `
🎯 PREFERENCIAS PERSONALIZADAS ACTIVADAS:
- Días preferidos de entrenamiento: ${fullUserProfile.dias_preferidos_entrenamiento.join(', ')}
- Semanas de entrenamiento: ${fullUserProfile.semanas_entrenamiento} semanas
- Ejercicios por sesión: ${fullUserProfile.ejercicios_por_dia_preferido} ejercicios (solo en bloque de trabajo principal)

⚠️ IMPORTANTE: Reemplaza [DIAS_PREFERIDOS], [SEMANAS_ENTRENAMIENTO], [EJERCICIOS_POR_DIA] en el prompt con estos valores.
` : '🔓 Preferencias personalizadas DESACTIVADAS: Usa valores estándar (4 semanas, 4 días/semana, 8 ejercicios/sesión).\n'}

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
5. Genera un plan progresivo de ${fullUserProfile.usar_preferencias_ia ? fullUserProfile.semanas_entrenamiento : 4} semanas
6. ${fullUserProfile.usar_preferencias_ia ? `Distribuye sesiones SOLO en estos días: ${fullUserProfile.dias_preferidos_entrenamiento.join(', ')}` : 'Distribuye sesiones en 4 días por semana'}
7. ${fullUserProfile.usar_preferencias_ia ? `Incluye aproximadamente ${fullUserProfile.ejercicios_por_dia_preferido} ejercicios` : 'Incluye aproximadamente 6 ejercicios'} en el bloque de "Trabajo Principal" (calentamiento y enfriamiento NO cuentan)
8. Incluye calentamiento, trabajo principal y enfriamiento en cada sesión
9. Usa creatividad para adaptar objetos domésticos según equipamiento
10. Especifica claramente qué objetos usar (silla, toalla, pared, etc.)

Devuelve un JSON siguiendo EXACTAMENTE la estructura del prompt especialista Casa.`;

    // Log de preferencias para debugging
    console.log('\n🎯 PREFERENCIAS DE ENTRENAMIENTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (fullUserProfile.usar_preferencias_ia) {
      console.log('✅ Switch de preferencias: ACTIVADO');
      console.log(`📅 Días preferidos: ${fullUserProfile.dias_preferidos_entrenamiento.join(', ')}`);
      console.log(`🏋️ Ejercicios por sesión: ${fullUserProfile.ejercicios_por_dia_preferido}`);
      console.log(`📆 Semanas del plan: ${fullUserProfile.semanas_entrenamiento}`);
      console.log('➡️  Estas preferencias SE ENVIARÁN a OpenAI');
    } else {
      console.log('⏸️  Switch de preferencias: DESACTIVADO');
      console.log('➡️  Se usarán valores estándar (4 semanas, 4 días/semana, 8 ejercicios)');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
