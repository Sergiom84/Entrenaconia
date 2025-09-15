import OpenAI from 'openai';
import { pool } from '../../db.js';
import { getModuleConfig } from '../../config/aiConfigs.js';
import {
  getMethodologyConfig,
  getCompatibleMethodologies,
  getRecommendedMethodology,
  METHODOLOGY_CONFIGS
} from '../../config/methodologies/index.js';
import fs from 'fs/promises';
import path from 'path';

class MethodologyService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generatePlan(userId, options = {}) {
    const {
      mode = 'automatic', // 'automatic' | 'manual'
      methodology = null, // Requerido para modo manual
      versionConfig = { version: 'adapted', customWeeks: 4 },
      evaluationResult = null // Para calistenia manual
    } = options;

    try {
      // 1. Obtener perfil del usuario
      const userProfile = await this.getUserProfile(userId);

      // 2. Determinar metodología
      const selectedMethodology = mode === 'manual'
        ? methodology
        : await this.selectAutomaticMethodology(userProfile);

      // 3. Obtener configuración de la metodología
      const methodologyConfig = getMethodologyConfig(selectedMethodology);

      // 4. Obtener ejercicios recientes para evitar repetición
      const recentExercises = await this.getRecentExercises(userId);

      // 5. Preparar contexto para IA
      const aiContext = {
        userProfile,
        methodologyConfig,
        selectedMethodology,
        recentExercises,
        versionConfig,
        evaluationResult,
        mode
      };

      // 6. Generar plan con IA
      const generatedPlan = await this.callAI(aiContext);

      // 7. Guardar en base de datos
      const planId = await this.savePlan(userId, generatedPlan, selectedMethodology);

      // 8. Retornar resultado unificado
      return {
        success: true,
        planId,
        methodology: selectedMethodology,
        plan: generatedPlan,
        mode,
        metadata: {
          userProfile: this.sanitizeProfile(userProfile),
          methodologyConfig: methodologyConfig,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error generating methodology plan:', error);
      throw new Error(`Error generando plan: ${error.message}`);
    }
  }

  async getUserProfile(userId) {
    const query = `
      SELECT
        u.id, u.email, u.gender, u.birth_date,
        EXTRACT(YEAR FROM AGE(NOW(), u.birth_date)) as edad,
        p.weight as peso,
        p.height as estatura,
        p.gender as sexo,
        p.activity_level as nivel_actividad,
        p.supplements as suplementacion,
        p.body_fat_percentage as grasa_corporal,
        p.muscle_mass as masa_muscular,
        p.chest_measurement as pecho,
        p.arm_measurement as brazos,
        p.training_level as nivel_actual_entreno,
        p.training_years as anos_entrenando,
        p.primary_goal as objetivo_principal,
        p.medications as medicamentos,
        p.available_equipment as equipamiento_disponible,
        p.available_time as tiempo_disponible
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const profile = result.rows[0];

    // Validar datos esenciales
    if (!profile.objetivo_principal || !profile.nivel_actual_entreno) {
      throw new Error('Perfil de usuario incompleto. Se requiere objetivo principal y nivel de entrenamiento.');
    }

    return profile;
  }

  async selectAutomaticMethodology(userProfile) {
    // En modo automático, usar lógica de recomendación inteligente
    const recommended = getRecommendedMethodology(userProfile);
    return recommended.name;
  }

  async getRecentExercises(userId, days = 14) {
    const query = `
      SELECT DISTINCT exercise_name
      FROM routine_session_exercises rse
      JOIN routine_sessions rs ON rse.session_id = rs.id
      WHERE rs.user_id = $1
        AND rs.created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY rs.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [userId]);
    return result.rows.map(row => row.exercise_name);
  }

  async callAI(context) {
    const { selectedMethodology, versionConfig } = context;

    // Determinar qué módulo de IA usar
    let moduleKey;
    if (context.mode === 'manual' && selectedMethodology === 'Calistenia') {
      moduleKey = 'CALISTENIA_SPECIALIST';
    } else {
      moduleKey = 'METHODOLOGIE_MANUAL';
    }

    const aiConfig = getModuleConfig(moduleKey);

    // Cargar prompt específico
    const systemPrompt = await this.loadPrompt(moduleKey);

    // Preparar el payload
    const userMessage = this.buildUserMessage(context);

    const completion = await this.openai.chat.completions.create({
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      max_tokens: aiConfig.max_output_tokens,
      top_p: aiConfig.top_p,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    const response = completion.choices[0].message.content;

    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response:', response);
      throw new Error('Respuesta de IA inválida');
    }
  }

  async loadPrompt(moduleKey) {
    try {
      const promptPath = path.join(process.cwd(), 'prompts', `${moduleKey.toLowerCase()}.md`);
      const promptContent = await fs.readFile(promptPath, 'utf-8');
      return promptContent;
    } catch (error) {
      // Fallback al prompt embebido en aiConfigs
      const aiConfig = getModuleConfig(moduleKey);
      return aiConfig.systemPrompt;
    }
  }

  buildUserMessage(context) {
    const {
      userProfile,
      selectedMethodology,
      recentExercises,
      versionConfig,
      evaluationResult,
      mode
    } = context;

    const baseMessage = {
      metodologia_solicitada: selectedMethodology,
      perfil_usuario: {
        edad: userProfile.edad,
        peso: userProfile.peso,
        estatura: userProfile.estatura,
        sexo: userProfile.sexo,
        nivel_actividad: userProfile.nivel_actividad,
        suplementacion: userProfile.suplementacion || '',
        grasa_corporal: userProfile.grasa_corporal || '',
        masa_muscular: userProfile.masa_muscular || '',
        pecho: userProfile.pecho || '',
        brazos: userProfile.brazos || '',
        nivel_actual_entreno: userProfile.nivel_actual_entreno,
        anos_entrenando: userProfile.anos_entrenando || 0,
        objetivo_principal: userProfile.objetivo_principal,
        medicamentos: userProfile.medicamentos || 'ninguno',
        equipamiento_disponible: userProfile.equipamiento_disponible || 'completo',
        tiempo_disponible: userProfile.tiempo_disponible || 60
      },
      ejercicios_recientes: recentExercises,
      versionConfig: versionConfig
    };

    // Agregar evaluación si es modo manual de calistenia
    if (mode === 'manual' && selectedMethodology === 'Calistenia' && evaluationResult) {
      baseMessage.evaluacion_calistenia = evaluationResult;
    }

    return JSON.stringify(baseMessage, null, 2);
  }

  async savePlan(userId, generatedPlan, methodology) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Crear entrada en methodology_plans
      const planQuery = `
        INSERT INTO methodology_plans (
          user_id, methodology, plan_data, weeks_total,
          frequency_per_week, created_at, status
        ) VALUES ($1, $2, $3, $4, $5, NOW(), 'active')
        RETURNING id
      `;

      const planResult = await client.query(planQuery, [
        userId,
        methodology,
        JSON.stringify(generatedPlan),
        generatedPlan.duracion_total_semanas || 4,
        generatedPlan.frecuencia_por_semana || 4
      ]);

      const planId = planResult.rows[0].id;

      // Desactivar planes anteriores
      await client.query(
        'UPDATE methodology_plans SET status = $1 WHERE user_id = $2 AND id != $3',
        ['inactive', userId, planId]
      );

      await client.query('COMMIT');
      return planId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAvailableMethodologies(userId = null) {
    if (userId) {
      const userProfile = await this.getUserProfile(userId);
      return getCompatibleMethodologies(userProfile);
    }

    return Object.entries(METHODOLOGY_CONFIGS).map(([name, config]) => ({
      name,
      ...config
    }));
  }

  async getRecommendedMethodologies(userId) {
    const userProfile = await this.getUserProfile(userId);
    const recommended = getRecommendedMethodology(userProfile);
    const compatible = getCompatibleMethodologies(userProfile);

    return {
      recommended,
      alternatives: compatible.filter(m => m.name !== recommended.name).slice(0, 3)
    };
  }

  async getCurrentPlan(userId) {
    const query = `
      SELECT id, methodology, plan_data, created_at, weeks_total,
             frequency_per_week, status
      FROM methodology_plans
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const plan = result.rows[0];
    return {
      id: plan.id,
      methodology: plan.methodology,
      plan: plan.plan_data,
      createdAt: plan.created_at,
      weeksTotal: plan.weeks_total,
      frequencyPerWeek: plan.frequency_per_week,
      status: plan.status
    };
  }

  async recordFeedback(userId, planId, exerciseName, feedback) {
    const query = `
      INSERT INTO exercise_feedback (
        user_id, plan_id, exercise_name, feedback_data, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `;

    await pool.query(query, [
      userId,
      planId,
      exerciseName,
      JSON.stringify(feedback)
    ]);
  }

  async completeSession(userId, sessionData) {
    const query = `
      INSERT INTO routine_sessions (
        user_id, session_data, completed_at, duration_minutes
      ) VALUES ($1, $2, NOW(), $3)
      RETURNING id
    `;

    const result = await pool.query(query, [
      userId,
      JSON.stringify(sessionData),
      sessionData.duration || 0
    ]);

    return result.rows[0].id;
  }

  async getUserStats(userId) {
    const queries = {
      totalSessions: `
        SELECT COUNT(*) as count
        FROM routine_sessions
        WHERE user_id = $1
      `,
      totalPlans: `
        SELECT COUNT(*) as count
        FROM methodology_plans
        WHERE user_id = $1
      `,
      favoriteMethodology: `
        SELECT methodology, COUNT(*) as count
        FROM methodology_plans
        WHERE user_id = $1
        GROUP BY methodology
        ORDER BY count DESC
        LIMIT 1
      `,
      recentActivity: `
        SELECT completed_at::date as date, COUNT(*) as sessions
        FROM routine_sessions
        WHERE user_id = $1
          AND completed_at >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date DESC
      `
    };

    const results = await Promise.all([
      pool.query(queries.totalSessions, [userId]),
      pool.query(queries.totalPlans, [userId]),
      pool.query(queries.favoriteMethodology, [userId]),
      pool.query(queries.recentActivity, [userId])
    ]);

    return {
      totalSessions: parseInt(results[0].rows[0]?.count || 0),
      totalPlans: parseInt(results[1].rows[0]?.count || 0),
      favoriteMethodology: results[2].rows[0]?.methodology || null,
      recentActivity: results[3].rows
    };
  }

  sanitizeProfile(profile) {
    // Remover campos sensibles para envío al frontend
    const { id, email, medicamentos, ...sanitized } = profile;
    return sanitized;
  }
}

export default new MethodologyService();