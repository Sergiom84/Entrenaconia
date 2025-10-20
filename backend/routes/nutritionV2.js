/**
 * Rutas para el sistema de nutrición V2 (Determinista + Normalizado)
 * Sistema híbrido que coexiste con nutrition.js (JSON-based)
 */

import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  calculateBMR,
  calculateTDEE,
  adjustCaloriesForGoal,
  calculateMacros,
  generateNutritionPlan,
  validateMacros
} from '../services/nutritionCalculator.js';
import { nutritionMenuGeneratorPrompt } from '../prompts/nutrition-menu-generator.js';
import OpenAI from 'openai';

const router = express.Router();

// Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================================================
// PERFIL NUTRICIONAL
// ================================================

/**
 * GET /api/nutrition-v2/profile
 * Obtener perfil nutricional del usuario
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM app.nutrition_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil nutricional no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener perfil nutricional:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

/**
 * POST /api/nutrition-v2/profile
 * Crear o actualizar perfil nutricional
 */
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sexo,
      edad,
      altura_cm,
      peso_kg,
      objetivo,
      actividad,
      comidas_dia = 4,
      preferencias = {},
      alergias = []
    } = req.body;

    // Validar campos requeridos
    if (!sexo || !edad || !altura_cm || !peso_kg || !objetivo || !actividad) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Insertar o actualizar perfil
    const query = `
      INSERT INTO app.nutrition_profiles (
        user_id, sexo, edad, altura_cm, peso_kg, objetivo, actividad, comidas_dia, preferencias, alergias
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id)
      DO UPDATE SET
        sexo = EXCLUDED.sexo,
        edad = EXCLUDED.edad,
        altura_cm = EXCLUDED.altura_cm,
        peso_kg = EXCLUDED.peso_kg,
        objetivo = EXCLUDED.objetivo,
        actividad = EXCLUDED.actividad,
        comidas_dia = EXCLUDED.comidas_dia,
        preferencias = EXCLUDED.preferencias,
        alergias = EXCLUDED.alergias,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await pool.query(query, [
      userId,
      sexo,
      edad,
      altura_cm,
      peso_kg,
      objetivo,
      actividad,
      comidas_dia,
      JSON.stringify(preferencias),
      JSON.stringify(alergias)
    ]);

    // Calcular estimaciones
    const profile = result.rows[0];
    const bmr = calculateBMR(profile);
    const tdee = calculateTDEE(bmr, actividad);
    const kcalObjetivo = adjustCaloriesForGoal(tdee, objetivo);

    res.json({
      profile: profile,
      estimaciones: {
        bmr,
        tdee,
        kcal_objetivo: kcalObjetivo
      }
    });
  } catch (error) {
    console.error('Error al guardar perfil nutricional:', error);
    res.status(500).json({ error: 'Error al guardar perfil' });
  }
});

// ================================================
// GENERACIÓN DE PLANES DETERMINISTAS
// ================================================

/**
 * POST /api/nutrition-v2/generate-plan
 * Generar plan nutricional usando cálculo determinista
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      duracion_dias = 7,
      training_type = 'general',
      training_schedule = [] // Array de booleanos: [true, false, true, ...]
    } = req.body;

    // Validar duración
    if (duracion_dias < 3 || duracion_dias > 31) {
      return res.status(400).json({ error: 'La duración debe estar entre 3 y 31 días' });
    }

    // Obtener perfil del usuario
    const profileResult = await pool.query(
      'SELECT * FROM app.nutrition_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Debes crear un perfil nutricional primero',
        hint: 'POST /api/nutrition-v2/profile'
      });
    }

    const profile = profileResult.rows[0];

    // Generar plan usando cálculo determinista
    const planData = generateNutritionPlan(
      { ...profile, training_type },
      duracion_dias,
      training_schedule
    );

    console.log('✅ Plan determinista generado:', {
      bmr: planData.bmr,
      tdee: planData.tdee,
      kcal_objetivo: planData.kcal_objetivo,
      dias: planData.days.length
    });

    // Guardar plan en la base de datos
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Crear plan maestro
      const planQuery = `
        INSERT INTO app.nutrition_plans_v2 (
          user_id, plan_name, tipo, bmr, tdee, kcal_objetivo, macros_objetivo,
          meta, duracion_dias, training_type, comidas_por_dia, fuente, version_reglas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id;
      `;

      const planResult = await client.query(planQuery, [
        userId,
        `Plan ${profile.objetivo} - ${duracion_dias} días`,
        'activo',
        planData.bmr,
        planData.tdee,
        planData.kcal_objetivo,
        JSON.stringify(planData.macros_objetivo),
        planData.meta,
        planData.duracion_dias,
        planData.training_type,
        planData.comidas_por_dia,
        planData.fuente,
        planData.version_reglas
      ]);

      const planId = planResult.rows[0].id;

      // 2. Crear días del plan
      for (const day of planData.days) {
        const dayQuery = `
          INSERT INTO app.nutrition_plan_days (
            plan_id, day_index, tipo_dia, kcal, macros
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id;
        `;

        const dayResult = await client.query(dayQuery, [
          planId,
          day.day_index,
          day.tipo_dia,
          day.kcal,
          JSON.stringify(day.macros)
        ]);

        const dayId = dayResult.rows[0].id;

        // 3. Crear comidas del día
        for (const meal of day.meals) {
          const mealQuery = `
            INSERT INTO app.nutrition_meals (
              plan_day_id, orden, nombre, kcal, macros, timing_note
            ) VALUES ($1, $2, $3, $4, $5, $6);
          `;

          await client.query(mealQuery, [
            dayId,
            meal.orden,
            meal.nombre,
            meal.kcal,
            JSON.stringify(meal.macros),
            meal.timing_note
          ]);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Plan nutricional generado exitosamente',
        plan_id: planId,
        plan: {
          bmr: planData.bmr,
          tdee: planData.tdee,
          kcal_objetivo: planData.kcal_objetivo,
          macros_objetivo: planData.macros_objetivo,
          duracion_dias: planData.duracion_dias,
          comidas_por_dia: planData.comidas_por_dia
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al generar plan determinista:', error);
    res.status(500).json({ error: 'Error al generar plan nutricional' });
  }
});

/**
 * GET /api/nutrition-v2/active-plan
 * Obtener plan nutricional activo del usuario
 */
router.get('/active-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        p.*,
        (
          SELECT json_agg(
            json_build_object(
              'day_index', d.day_index,
              'tipo_dia', d.tipo_dia,
              'kcal', d.kcal,
              'macros', d.macros,
              'meals', (
                SELECT json_agg(
                  json_build_object(
                    'orden', m.orden,
                    'nombre', m.nombre,
                    'kcal', m.kcal,
                    'macros', m.macros,
                    'timing_note', m.timing_note
                  ) ORDER BY m.orden
                )
                FROM app.nutrition_meals m
                WHERE m.plan_day_id = d.id
              )
            ) ORDER BY d.day_index
          )
          FROM app.nutrition_plan_days d
          WHERE d.plan_id = p.id
        ) as days
      FROM app.nutrition_plans_v2 p
      WHERE p.user_id = $1 AND p.tipo = 'activo'
      ORDER BY p.created_at DESC
      LIMIT 1;
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No tienes un plan activo' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener plan activo:', error);
    res.status(500).json({ error: 'Error al obtener plan' });
  }
});

// ================================================
// CATÁLOGO DE ALIMENTOS
// ================================================

/**
 * GET /api/nutrition-v2/foods
 * Buscar alimentos en el catálogo
 */
router.get('/foods', authenticateToken, async (req, res) => {
  try {
    const { search, categoria, limit = 50 } = req.query;

    let query = 'SELECT * FROM app.foods WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND LOWER(nombre) LIKE LOWER($${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (categoria) {
      query += ` AND categoria = $${paramCount}`;
      params.push(categoria);
      paramCount++;
    }

    query += ` ORDER BY nombre LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al buscar alimentos:', error);
    res.status(500).json({ error: 'Error al buscar alimentos' });
  }
});

/**
 * GET /api/nutrition-v2/foods/categories
 * Obtener categorías de alimentos disponibles
 */
router.get('/foods/categories', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT categoria, COUNT(*) as count
      FROM app.foods
      GROUP BY categoria
      ORDER BY categoria;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// ================================================
// GENERACIÓN DE MENÚS CON IA
// ================================================

/**
 * POST /api/nutrition-v2/generate-menu
 * Generar menú específico para una comida usando IA
 */
router.post('/generate-menu', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meal, dayInfo } = req.body;

    // Validar datos requeridos
    if (!meal || !dayInfo) {
      return res.status(400).json({ error: 'Faltan datos de comida o día' });
    }

    // Obtener perfil del usuario
    const profileResult = await pool.query(
      'SELECT preferencias, alergias FROM app.nutrition_profiles WHERE user_id = $1',
      [userId]
    );

    const userPreferences = profileResult.rows[0] || {
      preferencias: {},
      alergias: []
    };

    // Obtener catálogo de alimentos (filtrado por preferencias)
    const foodsQuery = `
      SELECT id, nombre, categoria, macros_100g, tags
      FROM app.foods
      WHERE is_verified = true
      ORDER BY nombre
      LIMIT 50;
    `;

    const foodsResult = await pool.query(foodsQuery);
    const availableFoods = foodsResult.rows;

    // Generar prompt
    const prompt = nutritionMenuGeneratorPrompt({
      meal,
      dayInfo,
      userPreferences,
      availableFoods
    });

    console.log('🤖 Generando menú con IA para:', meal.nombre);

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Eres un nutricionista deportivo experto especializado en generar menús precisos que cumplan objetivos de macronutrientes. Respondes SOLO con JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const responseText = completion.choices[0].message.content.trim();

    // Extraer JSON de la respuesta (por si viene con markdown)
    let menuData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        menuData = JSON.parse(jsonMatch[0]);
      } else {
        menuData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Error parseando respuesta de IA:', responseText);
      throw new Error('La IA no generó un JSON válido');
    }

    // Validar que los macros estén dentro del margen
    const validation = menuData.validacion;
    const maxError = Math.max(
      validation.error_kcal_porcentaje,
      validation.error_protein_porcentaje,
      validation.error_carbs_porcentaje,
      validation.error_fat_porcentaje
    );

    if (maxError > 2) {
      console.warn('⚠️  Menú generado excede margen de error del 2%:', validation);
    }

    console.log('✅ Menú generado exitosamente:', {
      items: menuData.items.length,
      kcal_total: validation.kcal_total,
      max_error: maxError
    });

    res.json({
      success: true,
      menu: menuData,
      metadata: {
        model: completion.model,
        tokens_used: completion.usage.total_tokens
      }
    });
  } catch (error) {
    console.error('Error generando menú con IA:', error);
    res.status(500).json({
      error: 'Error al generar menú',
      details: error.message
    });
  }
});

/**
 * POST /api/nutrition-v2/generate-full-day-menus
 * Generar todos los menús de un día completo
 */
router.post('/generate-full-day-menus', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { dayId } = req.body;

    if (!dayId) {
      return res.status(400).json({ error: 'Falta ID del día' });
    }

    // Obtener día completo con comidas
    const dayQuery = `
      SELECT
        d.*,
        (
          SELECT json_agg(m ORDER BY m.orden)
          FROM app.nutrition_meals m
          WHERE m.plan_day_id = d.id
        ) as meals
      FROM app.nutrition_plan_days d
      JOIN app.nutrition_plans_v2 p ON p.id = d.plan_id
      WHERE d.id = $1 AND p.user_id = $2;
    `;

    const dayResult = await pool.query(dayQuery, [dayId, userId]);

    if (dayResult.rows.length === 0) {
      return res.status(404).json({ error: 'Día no encontrado' });
    }

    const day = dayResult.rows[0];
    const generatedMenus = [];

    // Generar menú para cada comida
    for (const meal of day.meals) {
      try {
        const menuResponse = await router.post('/generate-menu', {
          body: {
            meal,
            dayInfo: {
              tipo_dia: day.tipo_dia,
              day_index: day.day_index
            }
          },
          user: { id: userId }
        });

        generatedMenus.push({
          meal_id: meal.id,
          menu: menuResponse.body.menu
        });

        // Pequeña pausa entre peticiones para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error generando menú para ${meal.nombre}:`, error);
        generatedMenus.push({
          meal_id: meal.id,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      day_id: dayId,
      menus_generated: generatedMenus.filter(m => !m.error).length,
      total_meals: day.meals.length,
      menus: generatedMenus
    });
  } catch (error) {
    console.error('Error generando menús del día:', error);
    res.status(500).json({ error: 'Error al generar menús del día' });
  }
});

export default router;
