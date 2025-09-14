import express from 'express';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt } from '../lib/promptRegistry.js';
import { AI_MODULES } from '../config/aiConfigs.js';
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

// Config módulo Methodologie
const METHODOLOGIE_CONFIG = AI_MODULES.METHODOLOGIE;

/**
 * Función para validar y sanitizar datos del perfil de usuario
 */
function validateProfileData(profile) {
  // Debug: mostrar qué datos llegan realmente
  console.log('🔍 Raw profile data from DB:', JSON.stringify(profile, null, 2));

  // Mapeo mejorado considerando todos los posibles nombres de campos
  const mappedProfile = {
    edad: profile.edad != null ? Number(profile.edad) : null,
    peso: profile.peso != null ? Number(profile.peso) : (profile.peso_kg != null ? Number(profile.peso_kg) : null),
    estatura: profile.altura != null ? Number(profile.altura) : (profile.altura_cm != null ? Number(profile.altura_cm) : (profile.estatura != null ? Number(profile.estatura) : null)),
    sexo: profile.sexo ?? null,
    nivel_actividad: profile.nivel_actividad ?? null,
    suplementación: profile.suplementacion ?? profile.suplementación ?? (Array.isArray(profile.suplementacion) ? profile.suplementacion : []),
    grasa_corporal: profile.grasa_corporal != null ? Number(profile.grasa_corporal) : null,
    masa_muscular: profile.masa_muscular != null ? Number(profile.masa_muscular) : null,
    pecho: profile.pecho != null ? Number(profile.pecho) : null,
    brazos: profile.brazos != null ? Number(profile.brazos) : null,
    nivel_actual_entreno: profile.nivel_entrenamiento ?? profile.nivel ?? profile.nivel_actual_entreno ?? null,
    años_entrenando: profile.anos_entrenando != null ? Number(profile.anos_entrenando) : (profile["años_entrenando"] != null ? Number(profile["años_entrenando"]) : null),
    objetivo_principal: profile.objetivo_principal ?? null,
    medicamentos: profile.medicamentos ?? (Array.isArray(profile.medicamentos) ? profile.medicamentos.join(', ') : null)
  };

  // Log del perfil procesado para debugging
  console.log('✅ Processed profile data:', JSON.stringify(mappedProfile, null, 2));

  return mappedProfile;
}

/**
 * POST /api/methodologie/generate-plan
 * Genera un plan de entrenamiento personalizado usando IA
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'TOKEN_SIN_ID' });
    }

    // ====== INICIO DEL LOGGING DETALLADO ======
    logSeparator('Generación de Plan Metodológico Automático', 'blue');
    logAPICall('/api/methodologie/generate-plan', 'POST', userId);

    // Leer perfil completo desde BD (incluye composición corporal)
    const { rows } = await (await import('../db.js')).pool.query(
      `SELECT 
        u.id, u.nombre, u.apellido, u.email,
        u.edad, u.sexo, u.peso, u.altura,
        u.nivel_entrenamiento, u.anos_entrenando, u.frecuencia_semanal,
        u.grasa_corporal, u.masa_muscular, u.agua_corporal, u.metabolismo_basal,
        u.cintura, u.pecho, u.brazos, u.muslos, u.cuello, u.antebrazos, u.cadera,
        u.alergias, u.medicamentos, u.nivel_actividad, u.horario_preferido,
        u.comidas_por_dia, u.suplementacion, u.alimentos_excluidos, u.meta_peso,
        u.meta_grasa_corporal, u.enfoque_entrenamiento, u.historial_medico,
        p.objetivo_principal, p.limitaciones_fisicas, p.metodologia_preferida
      FROM app.users u 
      LEFT JOIN app.user_profiles p ON u.id = p.user_id
      WHERE u.id = $1`,
      [userId]
    );
    if (!rows.length) {
      logError(new Error('Usuario no encontrado'), 'BASE DE DATOS');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const perfil = rows[0];

    // Log del perfil del usuario
    logUserProfile(perfil, userId);

    // Validar y sanitizar datos del perfil
    const profileData = validateProfileData(perfil);

    // ===== OBTENER EJERCICIOS RECIENTES DE RUTINAS/METODOLOGÍAS =====
    let exercisesFromDB = [];
    let exerciseFeedback = [];
    try {
      // Consultar directamente methodology_exercise_history_complete (rutinas/metodologías reales)
      const recentExercisesResult = await pool.query(
        `SELECT 
          exercise_name,
          methodology_type,
          COUNT(*) as usage_count,
          MAX(completed_at) as last_used,
          methodology_type as methodologies_used
        FROM app.methodology_exercise_history_complete 
        WHERE user_id = $1 
          AND completed_at >= NOW() - INTERVAL '60 days'
        GROUP BY exercise_name, methodology_type
        ORDER BY MAX(completed_at) DESC, COUNT(*) DESC
        LIMIT 30`,
        [userId]
      );
      
      exercisesFromDB = recentExercisesResult.rows;
      console.log(`📊 Ejercicios recientes encontrados (SOLO de rutinas/metodologías): ${exercisesFromDB.length}`);

      // Obtener feedback de ejercicios para que la IA evite ejercicios que no gustan
      const feedbackResult = await pool.query(
        `SELECT 
          exercise_name,
          sentiment,
          COUNT(*) as frecuencia,
          ARRAY_AGG(comment) FILTER (WHERE comment IS NOT NULL) as comentarios
        FROM app.methodology_exercise_feedback
        WHERE user_id = $1
        GROUP BY exercise_name, sentiment
        ORDER BY exercise_name, frecuencia DESC`,
        [userId]
      );
      
      exerciseFeedback = feedbackResult.rows;
      console.log(`💭 Feedback de ejercicios encontrado: ${exerciseFeedback.length}`);
      
      // Si no hay ejercicios recientes, intentar obtener ejercicios de gimnasio que el usuario no haya hecho en metodologías
      if (exercisesFromDB.length === 0) {
        const catalogResult = await pool.query(
          `SELECT 
            ec.name as exercise_name,
            ec.key as exercise_key,
            ec.category,
            ec.muscle_groups,
            ec.equipment_required,
            ec.difficulty_level,
            ec.description
          FROM app.exercises_catalog ec
          WHERE ec.is_active = true
            AND ec.equipment_required != 'Ninguno'  -- Solo ejercicios que requieren equipamiento (gimnasio)
            AND NOT EXISTS (
              SELECT 1 FROM app.methodology_exercise_history_complete eh
              WHERE eh.user_id = $1 AND eh.exercise_name = ec.name
            )
          ORDER BY ec.difficulty_level ASC, RANDOM()
          LIMIT 15`,
          [userId]
        );
        exercisesFromDB = catalogResult.rows;
        console.log(`📚 Ejercicios de gimnasio del catálogo obtenidos: ${exercisesFromDB.length}`);
      }
    } catch (error) {
      console.error('❌ Error consultando ejercicios de BD:', error);
      exercisesFromDB = [];
    }

    // Log de ejercicios recientes
    logRecentExercises(exercisesFromDB);

    // Obtener cliente OpenAI específico para metodologías
    const openai = getOpenAIClient('methodologie');
    if (!openai) {
      throw new Error('Cliente OpenAI no disponible para metodologías');
    }

    // FORZAR RECARGA DEL PROMPT (para debugging variabilidad)
    const { clearPromptCache } = await import('../lib/promptRegistry.js');
    clearPromptCache('methodologie');

    // Obtener prompt específico para metodologías (recargado)
    const systemPrompt = await getPrompt('methodologie');
    if (!systemPrompt) {
      throw new Error('Prompt no disponible para metodologías');
    }

    // Preparar información de ejercicios recientes para la IA
    let exercisesContext = '';
    if (exercisesFromDB.length > 0) {
      // Verificar si son ejercicios recientes o del catálogo
      const isRecentHistory = exercisesFromDB.some(ex => ex.usage_count && ex.last_used);
      
      if (isRecentHistory) {
        // Crear mapa de feedback por ejercicio
        const feedbackMap = {};
        exerciseFeedback.forEach(fb => {
          if (!feedbackMap[fb.exercise_name]) {
            feedbackMap[fb.exercise_name] = [];
          }
          feedbackMap[fb.exercise_name].push(fb);
        });

        exercisesContext = `\n\nHISTORIAL DE EJERCICIOS EN METODOLOGÍAS (últimos 60 días):
${exercisesFromDB.map(ex => {
  const usageCount = ex.usage_count || 1;
  const lastUsed = ex.last_used ? new Date(ex.last_used).toISOString().split('T')[0] : 'reciente';
  const methodologyType = ex.methodology_type || 'Metodología desconocida';
  
  // Añadir información de feedback del usuario
  let feedbackInfo = '';
  const feedback = feedbackMap[ex.exercise_name];
  if (feedback && feedback.length > 0) {
    const sentimentCounts = feedback.reduce((acc, fb) => {
      acc[fb.sentiment] = (acc[fb.sentiment] || 0) + parseInt(fb.frecuencia);
      return acc;
    }, {});
    
    const sentimentMap = {
      'like': '❤️ Le encanta',
      'normal': '👍 Normal',
      'hard': '😓 Difícil'
    };
    
    // Determinar el sentiment predominante
    const mostFrequent = Object.entries(sentimentCounts).reduce((a, b) => a[1] > b[1] ? a : b);
    feedbackInfo = ` [${sentimentMap[mostFrequent[0]] || mostFrequent[0]}]`;
    
    // Agregar comentarios si existen
    const commentsForExercise = feedback.find(fb => fb.comentarios && fb.comentarios.length > 0);
    if (commentsForExercise) {
      feedbackInfo += ` (Comentario: "${commentsForExercise.comentarios[0]}")`;
    }
  }
  
  return `- ${ex.exercise_name}: ${usageCount} veces en ${methodologyType} (último: ${lastUsed})${feedbackInfo}`;
}).join('\n')}

🚨 REGLAS CRÍTICAS DE VARIACIÓN:
1. ❌ TOTALMENTE PROHIBIDO repetir ejercicios usados más de 4 veces
2. ⚠️ EVITAR ejercicios usados 3-4 veces, solo si es absolutamente necesario
3. ✅ PRIORIZAR ejercicios nuevos o usados menos de 3 veces
4. 💡 Si DEBES usar ejercicio similar, usa VARIACIONES ESPECÍFICAS:
   • Sentadilla → Sentadilla sumo, Sentadilla hack, Sentadilla búlgara, Sentadilla frontal
   • Press banca → Press inclinado, Press declinado, Press con mancuernas, Press con agarre cerrado
   • Peso muerto → Peso muerto sumo, Peso muerto rumano, Peso muerto con déficit, Peso muerto trap bar
5. 🎯 CONSIDERA FEEDBACK: Evita ejercicios marcados como "Difícil", prioriza los que "Le encantan"

⛔ EJERCICIOS TOTALMENTE PROHIBIDOS (usados >4 veces):
${exercisesFromDB.filter(ex => ex.usage_count > 4).map(ex => `• ${ex.exercise_name} (${ex.usage_count} veces)`).join('\n')}

⚠️ EJERCICIOS A EVITAR (usados 3-4 veces):
${exercisesFromDB.filter(ex => ex.usage_count >= 3 && ex.usage_count <= 4).map(ex => `• ${ex.exercise_name} (${ex.usage_count} veces)`).join('\n')}

✅ EJERCICIOS FAVORITOS DEL USUARIO (priorizar si es posible):
${exercisesFromDB.filter(ex => ex.last_sentiment === 'like').map(ex => `• ${ex.exercise_name} (Le encanta)`).join('\n')}`;
      } else {
        exercisesContext = `\n\nEJERCICIOS DE GIMNASIO SUGERIDOS DEL CATÁLOGO (usuario sin historial en metodologías):
${exercisesFromDB.map(ex => `- ${ex.exercise_name} (${ex.category || 'General'}) - ${ex.difficulty_level || 'Nivel estándar'}`).join('\n')}

NOTA: El usuario no tiene historial en metodologías. Estos son ejercicios de gimnasio apropiados que puede realizar.`;
      }
    } else {
      exercisesContext = `\n\nEjercicios recientes en metodologías: No hay ejercicios registrados.
La IA tendrá libertad total para seleccionar ejercicios de gimnasio apropiados según el perfil y metodología elegida.`;
    }

    // Obtener configuración de versión desde el request
    const versionConfig = req.body.versionConfig || {
      selectionMode: 'automatic',
      version: 'adapted',
      userLevel: 'intermedio'
    };

    // Crear el mensaje del usuario con los datos del perfil
    const currentTimestamp = new Date().toISOString();
    const randomSeed = Math.floor(Math.random() * 10000);
    
    // Obtener día actual de activación
    const activationDate = new Date();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const activationDay = daysOfWeek[activationDate.getDay()];
    
    const userMessage = `IMPORTANTE: Este es el sistema de METODOLOGÍAS DE GIMNASIO. Los ejercicios deben ser para GIMNASIO con equipamiento. NO generar planes de "Entrenamiento en casa".

SOLICITUD ÚNICA: Timestamp=${currentTimestamp}, Seed=${randomSeed} (usa esto para generar variación en cada petición)

🎯 INFORMACIÓN CRÍTICA DE INICIO:
- El usuario está activando la IA HOY: ${activationDay} (${activationDate.toLocaleDateString('es-ES')})  
- El plan debe comenzar INMEDIATAMENTE desde HOY (${activationDay})
- La primera sesión debe ser para ${activationDay}, NO para Lunes
- Estructura las semanas empezando desde ${activationDay}

Genera un plan de entrenamiento basado en el siguiente perfil:
    
CONFIGURACIÓN DE VERSIÓN SOLICITADA:
- Modo de selección: ${versionConfig.selectionMode}
- Versión: ${versionConfig.version === 'adapted' ? 'ADAPTADA' : 'ESTRICTA'}  
- Nivel del usuario: ${versionConfig.userLevel}
- Recomendada para usuario: ${versionConfig.isRecommended ? 'SÍ' : 'NO'}
- DURACIÓN PERSONALIZADA: ${versionConfig.customWeeks || 4} SEMANAS (el usuario ha elegido específicamente esta duración)

IMPORTANTE - AJUSTA EL PLAN SEGÚN LA VERSIÓN:

${versionConfig.version === 'adapted' ? `
VERSIÓN ADAPTADA (Usar estos parámetros):
- Intensidad inicial: MODERADA (RPE 6-7, no al fallo)
- Volumen: BAJO a MEDIO (menos series por ejercicio)
- Descanso entre series: PERSONALIZADO (90-120 segundos mínimo)
- Frecuencia por grupo muscular: MENOR (más días de descanso)
- Progresión: MUY GRADUAL semana a semana
- Ejercicios: BÁSICOS y seguros, evita ejercicios complejos
- Duración sesión: 45-60 minutos máximo
- DURACIÓN PLAN: EXACTAMENTE ${versionConfig.customWeeks || 4} SEMANAS (no más, no menos)
` : `
VERSIÓN ESTRICTA (Usar estos parámetros):
- Intensidad inicial: ALTA (RPE 8-9, cerca del fallo)
- Volumen: MEDIO a ALTO (más series por ejercicio)  
- Descanso entre series: ESTÁNDAR de la metodología (60-90 segundos)
- Frecuencia por grupo muscular: MAYOR (menos descanso entre sesiones)
- Progresión: AGRESIVA semana a semana
- Ejercicios: Incluye ejercicios avanzados y técnicas intensas
- Duración sesión: 60-75 minutos
- DURACIÓN PLAN: EXACTAMENTE ${versionConfig.customWeeks || 4} SEMANAS (no más, no menos)
`}

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
- Medicamentos: ${profileData.medicamentos}${exercisesContext}

Por favor, responde únicamente con el JSON solicitado según las especificaciones del prompt.`;

    // Log del payload completo enviado a la IA
    logAIPayload('Metodología Automática', {
      profile_data: profileData,
      system_prompt_length: systemPrompt.length,
      user_message_length: userMessage.length
    });
    
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
    
    // Limpiar backticks markdown si existen
    if (aiContent.startsWith('```json')) {
      aiContent = aiContent.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      console.log('🧹 Removidos backticks markdown de la respuesta IA');
    } else if (aiContent.startsWith('```')) {
      aiContent = aiContent.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();  
      console.log('🧹 Removidos backticks genéricos de la respuesta IA');
    }
    
    // Log de tokens consumidos
    logTokens(response);
    
    // Log de la respuesta completa de la IA
    logAIResponse(aiContent, 'Metodología Automática');

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
        
        let fixedContent = aiContent;
        
        // Si termina con una estructura incompleta, intentar repararla
        if (fixedContent.endsWith('"tempo":')) {
          // Caso específico: campo tempo incompleto
          fixedContent = fixedContent.replace(/"tempo":$/, '"tempo": "2-0-2"');
          console.log('🔧 Reparando campo tempo incompleto...');
        } else if (fixedContent.endsWith('"tempo":]')) {
          // Caso específico: campo tempo con array mal cerrado
          fixedContent = fixedContent.replace(/"tempo":\]$/, '"tempo": "2-0-2"');
          console.log('🔧 Reparando campo tempo con array...');
        } else if (fixedContent.match(/"tempo":\].*\}\}\}\}$/)) {
          // Caso específico: campo tempo con múltiples estructuras mal cerradas
          fixedContent = fixedContent.replace(/"tempo":\].*/g, '"tempo": "2-0-2"');
          console.log('🔧 Reparando campo tempo con múltiples estructuras...');
        }
        
        // Contar y cerrar estructuras abiertas
        const openBraces = (fixedContent.match(/\{/g) || []).length;
        const closeBraces = (fixedContent.match(/\}/g) || []).length;
        const openBrackets = (fixedContent.match(/\[/g) || []).length;
        const closeBrackets = (fixedContent.match(/\]/g) || []).length;
        
        console.log(`🔍 Estructuras: {${openBraces} vs ${closeBraces}} [${openBrackets} vs ${closeBrackets}]`);
        
        // Cerrar arrays abiertos
        for (let i = 0; i < (openBrackets - closeBrackets); i++) {
          fixedContent += ']';
          console.log(`🔧 Cerrando array ${i + 1}`);
        }
        
        // Cerrar objetos abiertos
        for (let i = 0; i < (openBraces - closeBraces); i++) {
          fixedContent += '}';
          console.log(`🔧 Cerrando objeto ${i + 1}`);
        }
        
        console.log('🔧 JSON reparado, intentando parsear...');
        aiContent = fixedContent;
      }
      
      parsedPlan = JSON.parse(aiContent);
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError.message);
      console.log('📄 Longitud del contenido:', aiContent.length);
      console.log('📄 Contenido que falló (primeros 1000 chars):', aiContent.substring(0, 1000));
      console.log('📄 Final del contenido (últimos 500 chars):', aiContent.substring(Math.max(0, aiContent.length - 500)));
      console.log('🔍 Termina con:', aiContent.slice(-50));
      
      // Intentar una reparación más agresiva para casos extremos
      if (parseError.message.includes('tempo') || aiContent.includes('"tempo":')) {
        console.log('🔧 Intentando reparación agresiva para problema de tempo...');
        try {
          // Buscar la última posición válida antes del error de tempo
          const lastValidIndex = aiContent.lastIndexOf('},');
          if (lastValidIndex > 0) {
            let repairedContent = aiContent.substring(0, lastValidIndex + 1);
            
            // Contar estructuras abiertas desde esta posición
            const openBraces = (repairedContent.match(/\{/g) || []).length;
            const closeBraces = (repairedContent.match(/\}/g) || []).length;
            const openBrackets = (repairedContent.match(/\[/g) || []).length;
            const closeBrackets = (repairedContent.match(/\]/g) || []).length;
            
            // Cerrar estructuras
            for (let i = 0; i < (openBrackets - closeBrackets); i++) {
              repairedContent += ']';
            }
            for (let i = 0; i < (openBraces - closeBraces); i++) {
              repairedContent += '}';
            }
            
            console.log('🔧 Contenido reparado agresivamente, longitud:', repairedContent.length);
            parsedPlan = JSON.parse(repairedContent);
            console.log('✅ Reparación agresiva exitosa');
            
          } else {
            throw new Error('No se pudo reparar el JSON');
          }
        } catch (repairError) {
          console.error('❌ Reparación agresiva falló:', repairError.message);
          return res.status(500).json({
            error: 'Error procesando respuesta de IA',
            message: 'La IA no devolvió un JSON válido - posible truncamiento severo',
            details: {
              parseError: parseError.message,
              repairError: repairError.message,
              contentLength: aiContent.length,
              contentPreview: aiContent.substring(0, 200) + '...',
              contentEnd: '...' + aiContent.substring(Math.max(0, aiContent.length - 200))
            }
          });
        }
      } else {
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
    }

    // Validar estructura básica del plan
    if (!parsedPlan.selected_style || !parsedPlan.semanas || !Array.isArray(parsedPlan.semanas)) {
      return res.status(500).json({
        error: 'Plan inválido',
        message: 'El plan generado no tiene la estructura esperada',
        plan: parsedPlan
      });
    }

    console.log('✅ Plan de metodología automática generado exitosamente');

    // Guardar en base de datos (como en metodología manual)
    try {
      const insertQuery = `
        INSERT INTO app.methodology_plans (
          user_id, methodology_type, plan_data, generation_mode, created_at
        ) VALUES ($1, $2, $3, 'automatic', NOW())
        RETURNING id
      `;
      
      const insertResult = await pool.query(insertQuery, [
        userId,
        parsedPlan.selected_style,
        JSON.stringify(parsedPlan)
      ]);

      console.log('✅ Plan automático guardado en methodology_plans');
      
      const methodologyPlanId = insertResult.rows[0].id;
      
      // Cancelar planes anteriores del usuario
      await pool.query(
        `UPDATE app.methodology_plans
         SET status = 'cancelled', updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      console.log(`✅ Plan creado exitosamente: methodology_plans(${methodologyPlanId})`);

      // Respuesta exitosa
      res.json({
        success: true,
        plan: parsedPlan,
        planId: methodologyPlanId,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: METHODOLOGIE_CONFIG.model,
          promptVersion: METHODOLOGIE_CONFIG.promptVersion,
          profileProcessed: profileData
        }
      });

    } catch (saveError) {
      console.error('⚠️ Error guardando plan automático en BD:', saveError.message);
      
      // Respuesta exitosa sin planId si falla el guardado
      res.json({
        success: true,
        plan: parsedPlan,
        planId: null,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: METHODOLOGIE_CONFIG.model,
          promptVersion: METHODOLOGIE_CONFIG.promptVersion,
          profileProcessed: profileData
        }
      });
    }

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
