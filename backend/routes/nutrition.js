import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
import { AI_MODULES } from '../config/aiConfigs.js';
import { getModuleOpenAI } from '../lib/openaiClient.js';
import { getPrompt } from '../lib/promptRegistry.js';

const router = express.Router();

// ========================================
// CONFIGURACIÓN DE IA NUTRICIONAL
// ========================================

// Obtener cliente OpenAI para nutrición
const getNutritionClient = () => {
  const config = AI_MODULES.NUTRITION;
  if (!config) {
    throw new Error('Configuración NUTRITION no encontrada');
  }
  
  return getModuleOpenAI(config);
};

const NUTRITION_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 8000,
  promptVersion: '1.0'
};

// ========================================
// RUTAS PRINCIPALES
// ========================================

/**
 * GET /api/nutrition/profile
 * Obtiene el perfil nutricional del usuario
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Obtener plan nutricional actual
    const planQuery = `
      SELECT * FROM app.nutrition_plans 
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const planResult = await pool.query(planQuery, [userId]);

    // Obtener estadísticas nutricionales
    const statsQuery = `
      SELECT 
        COUNT(*) as total_days_tracked,
        AVG(calories) as avg_calories,
        AVG(protein) as avg_protein,
        AVG(carbs) as avg_carbs,
        AVG(fat) as avg_fat
      FROM app.daily_nutrition_log 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `;
    const statsResult = await pool.query(statsQuery, [userId]);

    res.json({
      success: true,
      currentPlan: planResult.rows[0] || null,
      stats: statsResult.rows[0] || null
    });

  } catch (error) {
    console.error('Error obteniendo perfil nutricional:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/nutrition/generate-plan
 * Genera un plan nutricional personalizado usando IA
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { userData, currentRoutine, userMacros, options, customRequirements } = req.body;

    console.log('================================================================================');
    console.log('🥗 GENERACIÓN DE PLAN NUTRICIONAL CON IA');
    console.log('================================================================================');
    console.log(`🌐 POST /api/nutrition/generate-plan - Usuario: ${userId}`);

    // Validar datos mínimos
    if (!userData || !userMacros) {
      return res.status(400).json({
        success: false,
        error: 'Datos del usuario o macros objetivo requeridos'
      });
    }

    // Obtener historial de ejercicios recientes para mejor contextualización
    const exerciseHistoryQuery = `
      SELECT exercise_name, COUNT(*) as frequency
      FROM app.exercise_history 
      WHERE user_id = $1 AND used_at >= NOW() - INTERVAL '30 days'
      GROUP BY exercise_name
      ORDER BY frequency DESC
      LIMIT 10
    `;
    const exerciseHistory = await pool.query(exerciseHistoryQuery, [userId]);

    // Crear cliente OpenAI para nutrición
    console.log('🆕 Creando cliente OpenAI para feature: nutrition');
    const client = getNutritionClient();
    
    // Obtener prompt del sistema
    const systemPrompt = await getPrompt('nutrition');
    if (!systemPrompt) {
      throw new Error('Prompt de nutrición no encontrado');
    }
    console.log('📋 Prompt cache HIT para feature: nutrition');

    // Preparar mensaje detallado para la IA
    const userMessage = `
GENERAR PLAN NUTRICIONAL PERSONALIZADO

PERFIL COMPLETO DEL USUARIO:
${JSON.stringify({
  datos_basicos: {
    edad: userData.edad,
    sexo: userData.sexo,
    peso: userData.peso,
    altura: userData.altura,
    nivel_actividad: userData.nivel_actividad,
    objetivo_principal: userData.objetivo_principal
  },
  entrenamiento: {
    metodologia_actual: currentRoutine?.metodologia || userData.metodologia_preferida || 'No especificada',
    rutina_actual: currentRoutine ? 'Activa' : 'No activa',
    nivel_entrenamiento: userData.nivel_entrenamiento || 'intermedio',
    anos_entrenando: userData.anos_entrenando || 0,
    frecuencia_semanal: userData.frecuencia_semanal || 3
  },
  restricciones_salud: {
    alergias: userData.alergias || [],
    medicamentos: userData.medicamentos || [],
    limitaciones_fisicas: userData.limitaciones_fisicas,
    historial_medico: userData.historial_medico
  },
  macros_objetivo: userMacros,
  ejercicios_recientes: exerciseHistory.rows.map(ex => ex.exercise_name),
  configuracion_plan: {
    duracion_dias: options.duration || 7,
    comidas_por_dia: options.mealCount || 4,
    estilo_alimentario: options.dietary || 'none',
    presupuesto: options.budget || 'medium',
    incluir_suplementos: options.includeSupplements || true,
    requisitos_personalizados: customRequirements || ''
  }
}, null, 2)}

INSTRUCCIONES ESPECÍFICAS:
1. Crea un plan de ${options.duration || 7} días completamente personalizado
2. ${options.mealCount || 4} comidas por día optimizadas para ${userData.objetivo_principal || 'mantenimiento'}
3. Integra perfectamente con metodología de entrenamiento: ${currentRoutine?.metodologia || userData.metodologia_preferida || 'general'}
4. Respeta ESTRICTAMENTE las alergias y restricciones médicas
5. Adapta al presupuesto: ${options.budget || 'medium'}
6. Estilo alimentario: ${options.dietary === 'none' ? 'Sin restricciones' : options.dietary}
7. ${options.includeSupplements ? 'INCLUIR recomendaciones de suplementos personalizadas' : 'NO incluir suplementos'}

REQUISITOS ADICIONALES DEL USUARIO:
${customRequirements || 'Ninguno especificado'}

Genera el plan completo en JSON siguiendo exactamente la estructura especificada en el prompt del sistema.`;

    console.log(`🔹 PAYLOAD COMPLETO ENVIADO A LA IA`);
    console.log(`🎯 Duración solicitada: ${options.duration} días`);
    console.log(`🍽️ Comidas por día: ${options.mealCount}`);
    console.log(`🥗 Estilo alimentario: ${options.dietary}`);
    console.log(`💰 Presupuesto: ${options.budget}`);
    console.log(`💊 Incluir suplementos: ${options.includeSupplements}`);

    // Llamada a OpenAI
    const completion = await client.chat.completions.create({
      model: NUTRITION_CONFIG.model,
      temperature: NUTRITION_CONFIG.temperature,
      max_tokens: NUTRITION_CONFIG.max_tokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    console.log(`🔹 CONSUMO DE TOKENS`);
    console.log(`📊 Tokens prompt: ${completion.usage?.prompt_tokens || 'N/A'}`);
    console.log(`📊 Tokens completión: ${completion.usage?.completion_tokens || 'N/A'}`);
    console.log(`📊 Tokens totales: ${completion.usage?.total_tokens || 'N/A'}`);

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No se recibió respuesta de la IA');
    }

    console.log(`🔹 RESPUESTA DE LA IA`);
    console.log(aiResponse.substring(0, 500) + '...');

    // Parsear respuesta JSON
    let nutritionPlan;
    try {
      // Limpiar la respuesta por si tiene markdown
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      nutritionPlan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Error parseando JSON de la IA:', parseError);
      throw new Error('La IA generó una respuesta inválida');
    }

    // Validar estructura básica del plan
    if (!nutritionPlan.plan_summary || !nutritionPlan.daily_plans) {
      throw new Error('Plan nutricional con estructura inválida');
    }

    console.log('✅ Plan nutricional generado exitosamente');
    console.log(`📅 Duración: ${nutritionPlan.plan_summary.duration_days} días`);
    console.log(`🎯 Calorías objetivo: ${nutritionPlan.plan_summary.target_calories} kcal/día`);
    console.log(`🍽️ Comidas por día: ${nutritionPlan.plan_summary.meals_per_day}`);
    console.log(`💪 Enfoque: ${nutritionPlan.plan_summary.methodology_focus}`);

    // Guardar plan en base de datos
    try {
      const insertQuery = `
        INSERT INTO app.nutrition_plans (
          user_id, plan_data, duration_days, target_calories, 
          target_protein, target_carbs, target_fat, meals_per_day,
          methodology_focus, dietary_style, generation_mode, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ai_generated', NOW())
        RETURNING id
      `;
      
      const insertResult = await pool.query(insertQuery, [
        userId,
        JSON.stringify(nutritionPlan),
        nutritionPlan.plan_summary.duration_days,
        nutritionPlan.plan_summary.target_calories,
        nutritionPlan.plan_summary.target_macros.protein,
        nutritionPlan.plan_summary.target_macros.carbs,
        nutritionPlan.plan_summary.target_macros.fat,
        nutritionPlan.plan_summary.meals_per_day,
        nutritionPlan.plan_summary.methodology_focus,
        nutritionPlan.plan_summary.dietary_style
      ]);

      const planId = insertResult.rows[0].id;
      console.log('✅ Plan nutricional guardado en base de datos con ID:', planId);

      // Respuesta exitosa
      res.json({
        success: true,
        plan: nutritionPlan,
        planId: planId,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: NUTRITION_CONFIG.model,
          promptVersion: NUTRITION_CONFIG.promptVersion,
          tokensUsed: completion.usage?.total_tokens || 0
        }
      });

    } catch (dbError) {
      console.error('⚠️ Error guardando en base de datos:', dbError);
      
      // Respuesta exitosa sin planId si falla el guardado
      res.json({
        success: true,
        plan: nutritionPlan,
        planId: null,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: NUTRITION_CONFIG.model,
          promptVersion: NUTRITION_CONFIG.promptVersion,
          tokensUsed: completion.usage?.total_tokens || 0
        }
      });
    }

  } catch (error) {
    console.error('❌ Error en generación de plan nutricional:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET/POST /api/nutrition/daily/:date
 * Obtener/guardar registro nutricional diario
 */
router.get('/daily/:date', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { date } = req.params;

    const query = `
      SELECT daily_log FROM app.daily_nutrition_log
      WHERE user_id = $1 AND log_date = $2
    `;
    
    const result = await pool.query(query, [userId, date]);
    
    res.json({
      success: true,
      dailyLog: result.rows[0]?.daily_log || { calories: 0, protein: 0, carbs: 0, fat: 0, meals: [] }
    });

  } catch (error) {
    console.error('Error obteniendo registro diario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

router.post('/daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { date, dailyLog } = req.body;

    const query = `
      INSERT INTO app.daily_nutrition_log (user_id, log_date, daily_log, calories, protein, carbs, fat)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, log_date)
      DO UPDATE SET 
        daily_log = EXCLUDED.daily_log,
        calories = EXCLUDED.calories,
        protein = EXCLUDED.protein,
        carbs = EXCLUDED.carbs,
        fat = EXCLUDED.fat,
        updated_at = NOW()
    `;

    await pool.query(query, [
      userId,
      date,
      JSON.stringify(dailyLog),
      dailyLog.calories || 0,
      dailyLog.protein || 0,
      dailyLog.carbs || 0,
      dailyLog.fat || 0
    ]);

    res.json({
      success: true,
      message: 'Registro guardado exitosamente'
    });

  } catch (error) {
    console.error('Error guardando registro diario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/nutrition/week-stats
 * Obtiene estadísticas de la semana
 */
router.get('/week-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    const query = `
      SELECT 
        COUNT(*) as days_completed,
        AVG(calories) as avg_calories,
        ROUND(AVG(CASE 
          WHEN calories > 0 THEN 100 
          ELSE 0 
        END)) as consistency
      FROM app.daily_nutrition_log 
      WHERE user_id = $1 
      AND log_date >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      weekStats: {
        daysCompleted: parseInt(result.rows[0].days_completed) || 0,
        avgCalories: parseInt(result.rows[0].avg_calories) || 0,
        consistency: parseInt(result.rows[0].consistency) || 0
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas semanales:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/nutrition/health
 * Health check para el módulo de nutrición
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    module: 'Nutrition AI',
    timestamp: new Date().toISOString(),
    config: {
      model: NUTRITION_CONFIG.model,
      temperature: NUTRITION_CONFIG.temperature,
      max_tokens: NUTRITION_CONFIG.max_tokens,
      promptVersion: NUTRITION_CONFIG.promptVersion
    }
  });
});

export default router;