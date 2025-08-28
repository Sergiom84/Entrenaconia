import express from 'express';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt, FeatureKey } from '../lib/promptRegistry.js';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
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

// Obtener configuraciones de IA
const aiConfigs = {
  HOME_TRAINING: {
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-nano',
    temperature: 1.0,
    maxTokens: 2048
  }
};

// Cliente de OpenAI
const openaiClient = {
  HOME_TRAINING: getOpenAIClient('home')
};

// Modelo para Home Training
const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-nano';

// Utilidad para calcular IMC con datos en kg/cm
const calcIMC = (peso, alturaCm) => {
  const p = Number(peso);
  const a = Number(alturaCm);
  if (!p || !a) return null;
  const m = a / 100;
  return Number((p / (m * m)).toFixed(1));
};

// Duración y descansos
const SECONDS_PER_REP_DEFAULT = 2.5;
const DEFAULT_WORK_SECONDS = 45; // si no hay datos para reps
const clampRest = (sec) => {
  const n = Number(sec);
  const val = Number.isFinite(n) && n > 0 ? n : 45;
  return Math.min(60, Math.max(45, val));
};

const computeEstimatedDurationMinutes = (plan) => {
  try {
    const ejercicios = plan?.ejercicios || [];
    if (!Array.isArray(ejercicios) || ejercicios.length === 0) return null;
    let totalSeconds = 0;
    for (const ej of ejercicios) {
      const series = Number(ej?.series) || 0;
      if (series <= 0) continue;
      const descanso = clampRest(ej?.descanso_seg);
      let trabajo = 0;
      if (Number(ej?.duracion_seg)) {
        trabajo = Number(ej.duracion_seg);
      } else if (Number(ej?.repeticiones)) {
        trabajo = Math.round(Number(ej.repeticiones) * SECONDS_PER_REP_DEFAULT);
      } else {
        trabajo = DEFAULT_WORK_SECONDS;
      }
      totalSeconds += series * (trabajo + descanso);
    }
    if (totalSeconds <= 0) return null;
    return Math.max(1, Math.round(totalSeconds / 60));
  } catch {
    return null;
  }
};


// POST /api/ia-home-training/generate
// Ruta para obtener información detallada de un ejercicio (BD + IA)
router.post('/exercise-info', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [IA Home Training] Solicitud de información de ejercicio');
    
    const { exerciseName } = req.body;
    const userId = req.user?.userId || req.user?.id;
    
    if (!exerciseName) {
      return res.status(400).json({ error: 'Se requiere el nombre del ejercicio' });
    }

    console.log(`🏃‍♂️ [IA Home Training] Buscando información para ejercicio: ${exerciseName}`);

    // 1. PRIMERO: Buscar en la base de datos
    const existingInfoQuery = `
      SELECT id, exercise_name, ejecucion, consejos, errores_evitar, 
             request_count, created_at
      FROM app.exercise_ai_info 
      WHERE exercise_name = $1 
         OR exercise_name_normalized = app.normalize_exercise_name($1)
      LIMIT 1
    `;

    const existingResult = await pool.query(existingInfoQuery, [exerciseName]);

    if (existingResult.rows.length > 0) {
      // ✅ ENCONTRADO EN BD - Sin costo
      const existingInfo = existingResult.rows[0];
      console.log(`💾 [IA Home Training] Información encontrada en BD (usado ${existingInfo.request_count} veces)`);
      
      // Incrementar contador de uso
      await pool.query('SELECT app.increment_exercise_request_count($1)', [exerciseName]);
      
      return res.json({
        success: true,
        exerciseInfo: {
          ejecucion: existingInfo.ejecucion,
          consejos: existingInfo.consejos,
          errores_evitar: existingInfo.errores_evitar
        },
        exerciseName: existingInfo.exercise_name,
        fromDatabase: true,
        usageCount: existingInfo.request_count + 1
      });
    }

    // 2. NO ENCONTRADO: Generar con IA y guardar
    console.log('🤖 [IA Home Training] No encontrado en BD. Generando con IA...');

    const exerciseInfoPrompt = `
Proporciona información detallada del ejercicio: "${exerciseName}"

FORMATO DE RESPUESTA REQUERIDO (JSON):
{
  "ejecucion": "Descripción detallada paso a paso de cómo ejecutar correctamente el ejercicio",
  "consejos": "Consejos importantes para maximizar la efectividad y realizar el ejercicio de forma segura",
  "errores_evitar": "Errores comunes que se deben evitar al realizar este ejercicio"
}

INSTRUCCIONES:
- Responde ÚNICAMENTE con el JSON, sin texto adicional
- Cada campo debe tener información específica y útil
- La información debe ser clara y fácil de entender
- Enfócate en aspectos técnicos y de seguridad
- Si no conoces el ejercicio específico, proporciona información genérica sobre ejercicios similares
`;

    const aiRequest = {
      model: aiConfigs.HOME_TRAINING.model,
      messages: [{ role: "user", content: exerciseInfoPrompt }],
      temperature: 0.3,
      max_tokens: 1000
    };

    console.log('🤖 [IA Home Training] Enviando solicitud a OpenAI...');
    const completion = await openaiClient.HOME_TRAINING.chat.completions.create(aiRequest);
    
    let aiResponse = completion.choices[0]?.message?.content?.trim();
    if (!aiResponse) {
      throw new Error('Respuesta vacía de OpenAI');
    }

    console.log('📝 [IA Home Training] Respuesta de IA recibida');

    // Limpiar y parsear respuesta
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();
    
    let exerciseInfo;
    try {
      exerciseInfo = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ [IA Home Training] Error parseando JSON:', parseError);
      exerciseInfo = {
        ejecucion: `Información de ejecución para ${exerciseName} generada por IA no disponible temporalmente.`,
        consejos: `Consejos para ${exerciseName} no disponibles temporalmente.`,
        errores_evitar: `Errores comunes de ${exerciseName} no disponibles temporalmente.`
      };
    }

    // 3. GUARDAR EN BASE DE DATOS para futuros usos (con manejo de duplicados)
    try {
      const insertQuery = `
        INSERT INTO app.exercise_ai_info 
        (exercise_name, ejecucion, consejos, errores_evitar, first_requested_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (exercise_name) DO NOTHING
        RETURNING id, request_count
      `;
      
      const insertResult = await pool.query(insertQuery, [
        exerciseName,
        exerciseInfo.ejecucion,
        exerciseInfo.consejos,
        exerciseInfo.errores_evitar,
        userId
      ]);

      if (insertResult.rows.length > 0) {
        console.log(`💾 [IA Home Training] Information saved to DB with ID: ${insertResult.rows[0].id}`);
        console.log('✅ [IA Home Training] ¡Información generada y guardada para futuros usuarios!');
      } else {
        console.log('📝 [IA Home Training] Exercise info already existed, using generated response');
      }

    } catch (dbError) {
      console.error('❌ [IA Home Training] Error guardando en BD:', dbError);
      // No fallar la respuesta si no se puede guardar
    }

    res.json({
      success: true,
      exerciseInfo,
      exerciseName,
      fromDatabase: false,
      usageCount: 1,
      newlyGenerated: true
    });

  } catch (error) {
    console.error('❌ [IA Home Training] Error obteniendo información de ejercicio:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { equipment_type, training_type } = req.body || {};
    const userId = req.user?.userId || req.user?.id;

    // ====== INICIO DEL LOGGING DETALLADO ======
    logSeparator(`Generación Home Training - ${training_type} (${equipment_type})`, 'blue');
    logAPICall('/api/ia-home-training/generate', 'POST', userId);

    const allowedEq = new Set(['minimo', 'basico', 'avanzado', 'personalizado', 'usar_este_equipamiento']);
    const allowedTr = new Set(['funcional', 'hiit', 'fuerza']);
    if (!allowedEq.has(equipment_type) || !allowedTr.has(training_type)) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }

    // 🤖 SIEMPRE GENERAR CON IA basándose en perfil del usuario
    
    // Obtener cliente específico para home training
    const client = getOpenAIClient("home");
    const systemPrompt = await getPrompt(FeatureKey.HOME);

    // Cargar perfil del usuario completo (no usar la vista que tiene problemas de mapeo)
    const { rows } = await pool.query(
      `SELECT 
        id, nombre, apellido, email, edad, sexo, peso, altura,
        nivel_actividad, nivel_entrenamiento, anos_entrenando, "años_entrenando",
        objetivo_principal, alergias, medicamentos, suplementacion,
        alimentos_excluidos, alimentos_evitar, lesiones, limitaciones_fisicas,
        grasa_corporal, masa_muscular, pecho, brazos, created_at, updated_at
      FROM app.users 
      WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      logError(new Error('Usuario no encontrado'), 'BASE DE DATOS');
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const u = rows[0];

    // Log del perfil del usuario
    logUserProfile(u, userId);

    // Para entrenamiento en casa, el equipamiento se define por el tipo seleccionado, NO por el perfil del usuario
    // Esto evita que aparezca equipamiento de gimnasio en entrenamientos caseros
    let actualEquipment = [];
    let customEquipmentForLog = [];
    
    if (equipment_type === 'personalizado' || equipment_type === 'usar_este_equipamiento') {
      // Solo para modo personalizado cargamos el equipamiento del usuario
      const curatedEqRes = await pool.query(
        `SELECT COALESCE(ue.equipment_key, ei.key) AS equipment_key
         FROM app.user_equipment ue
         LEFT JOIN app.equipment_items ei ON ei.key = ue.equipment_id::text
         WHERE ue.user_id = $1`,
        [userId]
      );
      const customEqRes = await pool.query(
        `SELECT name FROM app.user_custom_equipment WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      actualEquipment = curatedEqRes.rows.map(r => r.equipment_key);
      customEquipmentForLog = customEqRes.rows.map(r => r.name);
    } else {
      // Para tipos predefinidos (mínimo/básico/avanzado) usar solo el equipamiento específico
      const equipmentByType = {
        minimo: ['peso_corporal', 'toallas', 'silla_sofa', 'pared'],
        basico: ['mancuernas', 'bandas_elasticas', 'esterilla', 'banco_step'],
        avanzado: ['barra_dominadas', 'kettlebells', 'trx', 'discos_olimpicos']
      };
      actualEquipment = equipmentByType[equipment_type] || [];
    }
    
    const curatedKeysStr = actualEquipment.length ? actualEquipment.join(', ') : 'Ninguno';
    const customNamesStr = customEquipmentForLog.length ? customEquipmentForLog.join(', ') : 'Ninguno';

    // Cargar ejercicios usados ESPECÍFICAMENTE para esta combinación (equipamiento + tipo)
    const combinationHistoryRes = await pool.query(
      `SELECT exercise_name, times_used, last_used_at, user_rating, combination_code
       FROM app.get_exercises_for_combination($1, $2, $3, 20)`,
      [userId, equipment_type, training_type]
    );
    
    const exercisesUsedForCombination = combinationHistoryRes.rows.length > 0
      ? combinationHistoryRes.rows.map(r => {
          const rating = r.user_rating ? ` [${r.user_rating === 'love' ? '❤️' : r.user_rating === 'hard' ? '💪' : '👎'}]` : '';
          return `${r.exercise_name} (x${r.times_used})${rating}`;
        }).join(', ')
      : `Ningún ejercicio previo para ${equipment_type} + ${training_type}`;
    
    // También cargar historial general de entrenamiento en casa (contexto adicional)
    const generalHomeHistoryRes = await pool.query(
      `SELECT exercise_name, last_used_at, times_used 
       FROM app.get_home_training_history($1, 10)`,
      [userId]
    );
    const generalHomeExercises = generalHomeHistoryRes.rows.map(r => r.exercise_name).join(', ') || 'Ninguno';
    
    // Log de ejercicios específicos para esta combinación
    logRecentExercises(combinationHistoryRes.rows.map(r => ({
      nombre: r.exercise_name,
      veces_usado: r.times_used || 1,
      ultimo_uso: r.last_used_at || new Date()
    })));

    const imc = calcIMC(u.peso, u.altura);

    // Inventario de equipamiento permitido según selección (guardarraíl del prompt)
    const equipmentInventories = {
      minimo: {
        label: 'Equipamiento Mínimo',
        implements: ['peso_corporal','toallas','silla_sofa','pared']
      },
      basico: {
        label: 'Equipamiento Básico',
        implements: ['mancuernas','bandas_elasticas','esterilla','banco_step']
      },
      avanzado: {
        label: 'Equipamiento Avanzado',
        implements: ['barra_dominadas','kettlebells','trx','discos_olimpicos']
      },
      personalizado: {
        label: 'Mi equipamiento',
        // El guardarraíl para "personalizado" será el equipamiento real del usuario (curated + custom)
        implements: []
      }
    };
    let inventory = equipmentInventories[equipment_type];
    if (equipment_type === 'personalizado' || equipment_type === 'usar_este_equipamiento') {
      // Usa el equipamiento real del usuario como guardarraíl
      const eqSet = new Set(actualEquipment);
      // También añadimos hints de custom como implementos libres
      for (const name of customEquipmentForLog) {
        if (typeof name === 'string' && name.trim()) {
          eqSet.add(name.trim().toLowerCase().replace(/\s+/g, '_'));
        }
      }
      inventory = { label: 'Mi equipamiento', implements: Array.from(eqSet) };
    }

    // Construir system message dinámico con datos del usuario
    const systemMessage = systemPrompt
      .replace(/\$\{u\.id\}/g, u.id || '')
      .replace(/\$\{u\.edad \|\| ''\}/g, u.edad || '')
      .replace(/\$\{u\.sexo \|\| ''\}/g, u.sexo || '')
      .replace(/\$\{u\.peso \|\| ''\}/g, u.peso || '')
      .replace(/\$\{u\.altura \|\| ''\}/g, u.altura || '')
      .replace(/\$\{imc \|\| ''\}/g, imc || '')
      .replace(/\$\{u\.nivel_actividad \|\| ''\}/g, u.nivel_actividad || u.nivel_entrenamiento || '')
      .replace(/\$\{u\.anos_entrenando \|\| ''\}/g, u.anos_entrenando || '')
      .replace(/\$\{u\.años_entrenando \|\| ''\}/g, u.anos_entrenando || '')
      .replace(/\$\{u\.objetivo_principal \|\| ''\}/g, u.objetivo_principal || '')
      .replace(/\$\{u\.limitaciones_fisicas\?\.join\(', '\) \|\| 'Ninguna'\}/g, u.limitaciones_fisicas?.join(', ') || 'Ninguna')
      .replace(/\$\{equipment_type\}/g, equipment_type)
      .replace(/\$\{training_type\}/g, training_type)
      .replace(/\$\{exercisesUsedForCombination\}/g, exercisesUsedForCombination)
      .replace(/\$\{recentExercises\}/g, generalHomeExercises);

    // Preparar payload para logging
    const aiPayload = {
      equipment_type,
      training_type,
      user_profile: {
        id: u.id,
        edad: u.edad,
        peso: u.peso,
        altura: u.altura,
        sexo: u.sexo,
        nivel_actividad: u.nivel_actividad || u.nivel_entrenamiento,
        anos_entrenando: u.anos_entrenando || u["años_entrenando"],
        objetivo_principal: u.objetivo_principal,
        imc: imc
      },
      equipamiento_curado: curatedKeysStr,
      equipamiento_personalizado: customNamesStr,
      ejercicios_usados_en_combinacion: exercisesUsedForCombination,
      ejercicios_generales_casa: generalHomeExercises,
      system_message_length: systemMessage.length
    };

    // Log del payload completo enviado a la IA
    logAIPayload(`${training_type} (${equipment_type})`, aiPayload);

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: `Genera un plan de entrenamiento para el usuario con equipamiento "${equipment_type}" y tipo "${training_type}". Responde SOLO con JSON.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 1.0,
      top_p: 1.0
    });

    const content = completion?.choices?.[0]?.message?.content || '{}';
    
    // Log de tokens consumidos
    logTokens(completion);
    
    // Log de la respuesta completa de la IA
    logAIResponse(content, `${training_type} (${equipment_type})`);

    let aiJson;
    try {
      aiJson = JSON.parse(content);
    } catch (error) {
      console.error('IAHomeTraining error:', error);
      aiJson = { error: 'Formato no JSON' };
    }

    const equipmentNames = { minimo: 'Equipamiento Mínimo', basico: 'Equipamiento Básico', avanzado: 'Equipamiento Avanzado' };
    const trainingNames = { funcional: 'Funcional', hiit: 'HIIT', fuerza: 'Fuerza' };
    const plan_source = { type: 'openai', label: 'OpenAI', detail: MODEL };

    // Normalización de descansos y duración estimada
    const aiPlan = aiJson?.plan_entrenamiento || {};
    const sanitizedExercises = Array.isArray(aiPlan?.ejercicios)
      ? aiPlan.ejercicios.map(ej => ({ ...ej, descanso_seg: clampRest(ej?.descanso_seg ?? 45) }))
      : [];
    const computedDuration = computeEstimatedDurationMinutes({ ejercicios: sanitizedExercises });
    const durationOk = Number.isFinite(Number(aiPlan?.duracion_estimada_min)) && Number(aiPlan?.duracion_estimada_min) > 0;

    const enriched = {
      plan_source,
      ...aiJson,
      plan_entrenamiento: {
        ...aiPlan,
        ejercicios: sanitizedExercises,
        duracion_estimada_min: durationOk ? Number(aiPlan.duracion_estimada_min) : computedDuration,
        equipamiento: equipment_type,
        tipoEntrenamiento: training_type,
        equipamiento_nombre: equipmentNames[equipment_type],
        tipo_nombre: trainingNames[training_type],
        fecha_formateada: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        perfil_usuario: `${u.nombre || 'Usuario'} — Edad: ${u.edad ?? ''}, Peso: ${u.peso ?? ''} kg, Altura: ${u.altura ?? ''} cm, Nivel: ${u.nivel ?? ''}, IMC: ${imc ?? ''}`
      }
    };

    console.log(`✅ Plan de entrenamiento en casa generado exitosamente`);
    
    return res.json({ success: true, plan: enriched });
  } catch (error) {
    console.error('Error IAHomeTraining.generate:', error);
    return res.status(500).json({ success: false, error: 'Error generando plan', details: error.message });
  }
});

export default router;