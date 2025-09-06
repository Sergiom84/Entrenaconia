/**
 * Calistenia Specialist AI Routes
 * API para evaluación automática de nivel y generación de planes especializados
 */

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
import { AI_MODULES } from '../config/aiConfigs.js';

const router = express.Router();

/**
 * GET /api/calistenia-specialist/test
 * Endpoint de prueba
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Calistenia Specialist routes loaded successfully',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/calistenia-specialist/evaluate-profile
 * Evaluación automática del perfil del usuario
 */
router.post('/evaluate-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    console.log('🤸‍♀️ Evaluación de calistenia - Usuario:', userId);

    // 1) Cargar perfil del usuario desde la BD (solo lectura)
    const profileQuery = await pool.query(`
      SELECT
        id AS user_id,
        edad,
        peso,
        altura,
        nivel_entrenamiento,
        anos_entrenando
      FROM app.users
      WHERE id = $1
    `, [userId]);

    const profile = profileQuery.rows[0] || {};
    console.log(`📦 Perfil de usuario cargado desde BD (app.users): ${Object.keys(profile).length ? 'OK' : 'NO ENCONTRADO'}`);

    // 2) Historial reciente (para señales)
    const historyQuery = await pool.query(`
      SELECT exercise_name, COUNT(*) as times_performed, MAX(completed_at) AS last_completed
      FROM app.methodology_exercise_history_complete
      WHERE user_id = $1 AND methodology_type IN ('Calistenia','Calistenia Manual')
      GROUP BY exercise_name
      ORDER BY last_completed DESC
      LIMIT 15
    `, [userId]);
    const history = historyQuery.rows || [];

    // 3) Preparar prompt para OpenAI
    const aiConfig = AI_MODULES.CALISTENIA_SPECIALIST;
    const openaiApiKey = process.env[aiConfig.envKey];

    if (!openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY no configurado. Devolviendo evaluación heurística.');
      const indicators = [];
      if (profile?.peso != null) indicators.push(`Peso: ${profile.peso} kg`);
      if (profile?.altura != null) indicators.push(`Altura: ${profile.altura} cm`);
      if (profile?.anos_entrenando != null) indicators.push(`Años entrenando: ${profile.anos_entrenando}`);
      if (profile?.nivel_entrenamiento) indicators.push(`Nivel actual: ${profile.nivel_entrenamiento}`);
      let recommended_level = 'basico';
      if (typeof profile?.nivel_entrenamiento === 'string') {
        const lev = profile.nivel_entrenamiento.toLowerCase();
        if (lev.includes('avanz')) recommended_level = 'avanzado';
        else if (lev.includes('inter')) recommended_level = 'intermedio';
      }
      if (recommended_level === 'basico' && typeof profile?.anos_entrenando === 'number') {
        if (profile.anos_entrenando >= 5) recommended_level = 'avanzado';
        else if (profile.anos_entrenando >= 3) recommended_level = 'intermedio';
      }
      return res.json({
        success: true,
        evaluation: {
          recommended_level,
          confidence: 0.65,
          reasoning: 'Evaluación heurística basada en peso, altura y años entrenando (sin API Key).',
          key_indicators: indicators.length ? indicators : ['Perfil mínimo disponible'],
          suggested_focus_areas: ['Fortalecer básicos', 'Técnica y movilidad'],
          exercise_recommendations: ['Dominadas', 'Fondos', 'Sentadillas'],
          progression_timeline: '4-8 semanas',
          safety_considerations: ['Calentamiento adecuado', 'Progresión gradual']
        },
        metadata: {
          model_used: 'db-heuristic (no-api-key)',
          evaluation_timestamp: new Date().toISOString(),
          temp_mode: true,
          user_id: userId,
          data_used: { tables: ['app.users','app.methodology_exercise_history_complete'] }
        }
      });
    }

    const profileLines = [
      `Edad: ${profile.edad ?? 'NA'}`,
      `Peso: ${profile.peso ?? 'NA'} kg`,
      `Altura: ${profile.altura ?? 'NA'} cm`,
      `Años entrenando: ${profile.anos_entrenando ?? 'NA'}`,
      `Nivel actual: ${profile.nivel_entrenamiento ?? 'NA'}`
    ].join('\n');

    const historyLines = history.length
      ? history.map(h => `- ${h.exercise_name} (realizado ${h.times_performed} veces) última vez: ${h.last_completed}`).join('\n')
      : 'Sin historial reciente relevante';

    const userPrompt = `
EVALÚA NIVEL DE CALISTENIA DEL SIGUIENTE USUARIO Y DEVUELVE SOLO UN JSON VÁLIDO:

PERFIL (BD):
${profileLines}

HISTORIAL RECIENTE (BD):
${historyLines}

TAREA:
- Recomienda uno de: basico | intermedio | avanzado
- Estima confidence entre 0 y 1
- Resume reasoning (1-2 frases)
- Enumera 3–6 key_indicators observables del perfil/historial
- Sugiere 3–6 suggested_focus_areas
- Lista 2–5 safety_considerations

FORMATO JSON ESTRICTO:
{
  "recommended_level": "basico|intermedio|avanzado",
  "confidence": 0.0,
  "reasoning": "...",
  "key_indicators": ["..."],
  "suggested_focus_areas": ["..."],
  "safety_considerations": ["..."]
}`.trim();

    console.log('🤖 Llamando a OpenAI para evaluación rápida...');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: aiConfig.systemPrompt || 'Eres un evaluador experto en calistenia. Responde SOLO JSON válido.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: aiConfig.temperature ?? 0.7,
        max_tokens: 800
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error('❌ OpenAI error evaluación:', errTxt);
      throw new Error(`OpenAI API Error: ${resp.status}`);
    }

    const ai = await resp.json();
    const content = ai?.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
      parsed = match ? JSON.parse(match[1] || match[0]) : JSON.parse(content);
    } catch (e) {
      console.warn('⚠️ No se pudo parsear JSON de OpenAI. Haciendo fallback.', e.message);
      parsed = {
        recommended_level: 'basico',
        confidence: 0.6,
        reasoning: 'Fallback por error de parseo',
        key_indicators: ['Datos de BD disponibles'],
        suggested_focus_areas: ['Técnica básica','Movilidad'],
        safety_considerations: ['Progresión gradual']
      };
    }

    return res.json({
      success: true,
      evaluation: {
        recommended_level: parsed.recommended_level || 'basico',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
        reasoning: parsed.reasoning || 'Evaluación asistida por IA basada en tu perfil de BD.',
        key_indicators: Array.isArray(parsed.key_indicators) ? parsed.key_indicators : [],
        suggested_focus_areas: Array.isArray(parsed.suggested_focus_areas) ? parsed.suggested_focus_areas : [],
        safety_considerations: Array.isArray(parsed.safety_considerations) ? parsed.safety_considerations : []
      },
      metadata: {
        model_used: aiConfig.model,
        evaluation_timestamp: new Date().toISOString(),
        temp_mode: false,
        user_id: userId,
        data_used: { tables: ['app.users','app.methodology_exercise_history_complete'] }
      }
    });

  } catch (error) {
    console.error('❌ Error en evaluación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/calistenia-specialist/generate-description
 * Genera descripción personalizada de metodología basada en el perfil del usuario
 */
router.post('/generate-description', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    console.log('📝 Generando descripción personalizada - Usuario:', userId);

    // 1) Cargar perfil del usuario desde la BD
    const profileQuery = await pool.query(`
      SELECT
        id AS user_id,
        edad,
        peso,
        altura,
        nivel_entrenamiento,
        anos_entrenando
      FROM app.users
      WHERE id = $1
    `, [userId]);

    const profile = profileQuery.rows[0] || {};
    console.log(`📦 Perfil cargado: ${Object.keys(profile).length ? 'OK' : 'NO ENCONTRADO'}`);

    // 2) Preparar configuración de OpenAI
    const aiConfig = AI_MODULES.CALISTENIA_SPECIALIST;
    const openaiApiKey = process.env[aiConfig.envKey];

    if (!openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY no configurado. Devolviendo descripción por defecto.');
      const fallbackDescription = `Basándome en tu perfil básico, la calistenia es perfecta para ti. 
      Es una disciplina que utiliza el peso corporal para desarrollar fuerza, resistencia y flexibilidad. 
      Independientemente de tu nivel actual, podrás progresar gradualmente desde ejercicios básicos 
      hasta movimientos más avanzados. La calistenia no requiere equipamiento especializado y se adapta 
      perfectamente a entrenamientos en casa o al aire libre.`;
      
      return res.json({
        success: true,
        description: fallbackDescription,
        metadata: {
          model_used: 'fallback-description (no-api-key)',
          generation_timestamp: new Date().toISOString(),
          user_id: userId
        }
      });
    }

    // 3) Construir prompt personalizado con datos del perfil
    const profileLines = [
      `Edad: ${profile.edad ?? 'No especificada'}`,
      `Peso: ${profile.peso ?? 'No especificado'} ${profile.peso ? 'kg' : ''}`,
      `Altura: ${profile.altura ?? 'No especificada'} ${profile.altura ? 'cm' : ''}`,
      `Años entrenando: ${profile.anos_entrenando ?? 'No especificado'}`,
      `Nivel actual: ${profile.nivel_entrenamiento ?? 'No especificado'}`
    ].filter(line => !line.includes('No especificad')).join('\n');

    const userPrompt = `
GENERA UNA DESCRIPCIÓN PERSONALIZADA DE CALISTENIA PARA EL SIGUIENTE USUARIO:

PERFIL DEL USUARIO:
${profileLines || 'Perfil básico disponible'}

TAREA:
- Escribe una descripción motivadora y personalizada (2-3 párrafos)
- Enfócate en cómo la calistenia se adapta específicamente a este perfil
- Menciona beneficios relevantes para su edad, experiencia y nivel
- Incluye una perspectiva motivacional sobre su progreso potencial
- Mantén un tono profesional pero cercano
- NO uses formato JSON, responde solo con el texto de la descripción

EJEMPLO DE TONO:
"Basándome en tu perfil, la calistenia es una excelente opción para ti..."`.trim();

    console.log('🤖 Llamando a OpenAI para generar descripción personalizada...');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { 
            role: 'system', 
            content: aiConfig.systemPrompt || 'Eres un experto en calistenia que crea descripciones personalizadas y motivadoras para usuarios basándote en su perfil físico y experiencia.'
          },
          { role: 'user', content: userPrompt }
        ],
        temperature: aiConfig.temperature ?? 0.8,
        max_tokens: 500
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error('❌ OpenAI error generando descripción:', errTxt);
      throw new Error(`OpenAI API Error: ${resp.status}`);
    }

    const ai = await resp.json();
    const description = ai?.choices?.[0]?.message?.content || '';

    if (!description.trim()) {
      throw new Error('Descripción vacía recibida de OpenAI');
    }

    return res.json({
      success: true,
      description: description.trim(),
      metadata: {
        model_used: aiConfig.model,
        generation_timestamp: new Date().toISOString(),
        user_id: userId,
        prompt_id: aiConfig.promptId
      }
    });

  } catch (error) {
    console.error('❌ Error generando descripción:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      description: 'La calistenia es una disciplina perfecta para desarrollar fuerza y resistencia usando tu propio peso corporal. Te permitirá progresar gradualmente según tu ritmo y capacidades.'
    });
  }
});

/**
 * POST /api/calistenia-specialist/generate-ai-plan
 * Genera plan completo de calistenia usando IA especializada
 */
router.post('/generate-ai-plan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user?.userId || req.user?.id;
    const { level, goals, aiEvaluation, userProfile, version } = req.body;
    
    console.log('🤸‍♀️ Generando plan IA de calistenia - Usuario:', userId);
    console.log('📋 Nivel recomendado:', level, '| Versión:', version);

    // 1) Cargar perfil completo del usuario
    const profileQuery = await client.query(`
      SELECT id AS user_id, edad, peso, altura, nivel_entrenamiento, anos_entrenando,
             objetivo_principal, experiencia_ejercicio
      FROM app.users
      WHERE id = $1
    `, [userId]);

    const profile = profileQuery.rows[0] || {};
    console.log('📦 Perfil usuario cargado:', Object.keys(profile).length ? 'OK' : 'NO ENCONTRADO');

    // 2) Cargar ejercicios disponibles del nivel recomendado
    const levelCapitalized = level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Básico';
    const exercisesQuery = await client.query(`
      SELECT exercise_id, nombre, categoria, patron, equipamiento, 
             series_reps_objetivo, criterio_de_progreso, progresion_desde, 
             progresion_hacia, notas
      FROM app.calistenia_exercises
      WHERE nivel = $1
      ORDER BY categoria, nombre
    `, [levelCapitalized]);

    const availableExercises = exercisesQuery.rows;
    console.log(`✅ Cargados ${availableExercises.length} ejercicios de nivel ${levelCapitalized}`);

    // 3) Historial del usuario para evitar repetición
    const historyQuery = await client.query(`
      SELECT exercise_name, COUNT(*) as times_performed, MAX(completed_at) as last_completed
      FROM app.methodology_exercise_history_complete
      WHERE user_id = $1 AND methodology_type IN ('Calistenia','Calistenia Manual', 'Calistenia Specialist')
        AND completed_at > NOW() - INTERVAL '60 days'
      GROUP BY exercise_name
      ORDER BY times_performed DESC
      LIMIT 20
    `, [userId]);

    const userHistory = historyQuery.rows || [];
    console.log(`📊 Historial cargado: ${userHistory.length} ejercicios recientes`);

    // 4) Preparar prompt para OpenAI
    const aiConfig = AI_MODULES.CALISTENIA_SPECIALIST;
    const openaiApiKey = process.env[aiConfig.envKey];

    if (!openaiApiKey) {
      throw new Error('OpenAI API key no configurada para calistenia specialist');
    }

    const profileLines = [
      `Edad: ${profile.edad ?? 'No especificada'}`,
      `Peso: ${profile.peso ?? 'No especificado'} kg`,
      `Altura: ${profile.altura ?? 'No especificada'} cm`,
      `Años entrenando: ${profile.anos_entrenando ?? 'No especificado'}`,
      `Nivel actual: ${profile.nivel_entrenamiento ?? 'No especificado'}`,
      `Objetivo: ${profile.objetivo_principal ?? 'No especificado'}`,
      `Experiencia: ${profile.experiencia_ejercicio ?? 'Principiante'}`
    ].join('\n');

    const evaluationSummary = aiEvaluation ? `
EVALUACIÓN IA PREVIA:
- Nivel recomendado: ${aiEvaluation.recommended_level}
- Confianza: ${Math.round(aiEvaluation.confidence * 100)}%
- Indicadores clave: ${aiEvaluation.key_indicators?.join(', ') || 'N/A'}
- Áreas de enfoque: ${aiEvaluation.suggested_focus_areas?.join(', ') || 'N/A'}
- Consideraciones de seguridad: ${aiEvaluation.safety_considerations?.join(', ') || 'N/A'}
` : '- Sin evaluación IA previa disponible';

    const exercisesList = availableExercises.map(ex => 
      `- ${ex.nombre} (${ex.categoria}): ${ex.series_reps_objetivo} | Equipo: ${ex.equipamiento || 'Ninguno'} | Progresión: ${ex.progresion_desde || 'Base'} → ${ex.progresion_hacia || 'Avanzado'} | Criterio: ${ex.criterio_de_progreso}`
    ).join('\n');

    const historyLines = userHistory.length > 0 
      ? userHistory.map(h => `- ${h.exercise_name} (realizado ${h.times_performed} veces, último: ${h.last_completed})`).join('\n')
      : 'Sin historial reciente relevante';

    const userPrompt = `
GENERA UN PLAN COMPLETO DE CALISTENIA ESPECIALIZADO USANDO INTELIGENCIA ARTIFICIAL

PERFIL DEL USUARIO:
${profileLines}

${evaluationSummary}

OBJETIVOS ESPECÍFICOS: ${goals || 'Progresión general en calistenia basada en evaluación IA'}

EJERCICIOS DISPONIBLES PARA NIVEL ${levelCapitalized.toUpperCase()}:
${exercisesList}

HISTORIAL RECIENTE (para evitar repetición excesiva):
${historyLines}

INSTRUCCIONES PARA GENERAR EL PLAN:

1. ESTRUCTURA: Crea un plan de 4 semanas con 3-4 sesiones por semana
2. PROGRESIÓN: Aumenta intensidad gradualmente cada semana
3. EQUILIBRIO: Incluye ejercicios de todas las categorías (Empuje, Tracción, Core, Piernas, Equilibrio)
4. PERSONALIZACIÓN: Adapta según la evaluación IA y perfil del usuario
5. SEGURIDAD: Considera las limitaciones y recomendaciones de seguridad de la evaluación IA
6. VARIEDAD: Evita repetir excesivamente ejercicios del historial reciente
7. EQUIPAMIENTO: Solo usa ejercicios compatibles con el equipamiento disponible

FORMATO DE RESPUESTA REQUERIDO (JSON ESTRICTO):
{
  "selected_style": "Calistenia Specialist v3.0",
  "ai_confidence": 0.95,
  "plan_reasoning": "Explicación de por qué este plan es óptimo para el usuario",
  "estimated_duration": "4 semanas",
  "frequency": "3-4 sesiones/semana",
  "progression_notes": "Notas sobre cómo progresar",
  "semanas": [
    {
      "numero": 1,
      "descripcion": "Semana de adaptación y evaluación de capacidades base",
      "sesiones": [
        {
          "dia": "Lunes",
          "descripcion": "Sesión de fuerza de empuje",
          "duracion_estimada": "45-60 minutos",
          "calentamiento": "10 min movilidad articular y activación",
          "ejercicios": [
            {
              "nombre": "Flexión estándar",
              "categoria": "Empuje",
              "series": 3,
              "repeticiones": "8-12",
              "descanso_seg": 90,
              "intensidad": "Moderada",
              "tempo": "2-1-2-1",
              "notas": "Notas específicas basadas en evaluación IA",
              "equipamiento": "Suelo",
              "orden": 1
            }
          ],
          "enfriamiento": "10 min estiramientos estáticos"
        }
      ]
    }
  ]
}

IMPORTANTE: Responde SOLO con el JSON válido, sin texto adicional antes o después.`.trim();

    console.log('🤖 Llamando a OpenAI para generar plan completo de calistenia...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { 
            role: 'system', 
            content: aiConfig.systemPrompt || 'Eres un experto especialista en calistenia que crea planes de entrenamiento personalizados y progresivos basados en evaluaciones de IA. Respondes SOLO con JSON válido.'
          },
          { role: 'user', content: userPrompt }
        ],
        temperature: aiConfig.temperature ?? 0.8,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API Error:', errorText);
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse?.choices?.[0]?.message?.content || '';

    let generatedPlan;
    try {
      // Extraer JSON del contenido
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
      const jsonContent = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      generatedPlan = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI JSON response:', parseError.message);
      console.log('📄 Raw content:', content.substring(0, 500));
      throw new Error('Error al procesar la respuesta de IA. Por favor, intenta nuevamente.');
    }

    // 5) Guardar en methodology_plans
    const insertPlan = await client.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, status, confirmed_at, created_at
      ) VALUES ($1, $2, $3, 'active', NOW(), NOW())
      RETURNING id
    `, [userId, 'Calistenia Specialist', JSON.stringify(generatedPlan)]);

    const methodologyPlanId = insertPlan.rows[0].id;

    // 6) Crear routine_plan correspondiente
    const insertRoutinePlan = await client.query(`
      INSERT INTO app.routine_plans (
        user_id, methodology_type, plan_data, status, confirmed_at, created_at
      ) VALUES ($1, $2, $3, 'active', NOW(), NOW())
      RETURNING id
    `, [userId, 'Calistenia Specialist', JSON.stringify(generatedPlan)]);

    const routinePlanId = insertRoutinePlan.rows[0].id;

    await client.query('COMMIT');

    console.log('✅ Plan de calistenia IA generado exitosamente');
    console.log(`📋 Plan ID: ${methodologyPlanId} | Routine ID: ${routinePlanId}`);

    res.json({
      success: true,
      plan: generatedPlan,
      planId: methodologyPlanId,
      routinePlanId: routinePlanId,
      methodology_plan_id: methodologyPlanId,
      message: 'Plan de calistenia especializado generado con IA',
      metadata: {
        version: version || '3.0',
        ai_model: aiConfig.model,
        level_recommended: level,
        exercises_count: availableExercises.length,
        generation_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error generando plan IA:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
});

export default router;