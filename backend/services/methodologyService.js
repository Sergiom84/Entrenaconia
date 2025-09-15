/**
 * Servicio unificado de metodologías
 * Centraliza toda la lógica de generación de planes de entrenamiento
 */

import { pool } from '../db.js';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt } from '../lib/promptRegistry.js';
import {
  getMethodologyConfig,
  getRecommendedMethodologies,
  validateMethodologyForUser,
  METHODOLOGIES
} from '../config/methodologies/index.js';
import {
  logSeparator,
  logUserProfile,
  logRecentExercises,
  logAIPayload,
  logAIResponse,
  logError,
  logTokens
} from '../utils/aiLogger.js';

/**
 * Clase principal del servicio de metodologías
 */
export class MethodologyService {
  constructor() {
    this.openai = null;
    this.modelConfig = {
      model: 'gpt-4o-mini',
      temperature: 0.8,
      max_output_tokens: 16000,
      top_p: 1.0
    };
  }

  /**
   * Genera un plan de entrenamiento unificado
   * @param {Object} params - Parámetros de generación
   * @param {string} params.userId - ID del usuario
   * @param {string} params.mode - 'automatic' o 'manual'
   * @param {string} params.methodology - Metodología específica (solo para modo manual)
   * @param {Object} params.versionConfig - Configuración de versión (adapted/strict)
   * @returns {Promise<Object>} Plan generado
   */
  async generatePlan({ userId, mode = 'automatic', methodology = null, versionConfig = {} }) {
    try {
      logSeparator(`Generación Plan ${mode === 'automatic' ? 'Automático' : 'Manual'}`, 'blue');

      // 1. Obtener perfil completo del usuario
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        throw new Error('Usuario no encontrado');
      }

      logUserProfile(userProfile, userId);

      // 2. Obtener ejercicios recientes y feedback
      const exerciseHistory = await this.getUserExerciseHistory(userId);
      logRecentExercises(exerciseHistory.recent);

      // 3. Determinar la metodología a usar
      let selectedMethodology;
      if (mode === 'manual' && methodology) {
        // Modo manual: validar la metodología seleccionada
        const validation = validateMethodologyForUser(methodology, userProfile);
        if (!validation.valid) {
          throw new Error(`Metodología no válida: ${validation.reason}`);
        }
        selectedMethodology = getMethodologyConfig(methodology);
      } else {
        // Modo automático: la IA decide la mejor metodología
        selectedMethodology = await this.selectBestMethodology(userProfile, exerciseHistory);
      }

      if (!selectedMethodology) {
        throw new Error('No se pudo determinar una metodología apropiada');
      }

      console.log(`✅ Metodología seleccionada: ${selectedMethodology.name}`);

      // 4. Obtener ejercicios específicos de la metodología
      const methodologyExercises = await this.getMethodologyExercises(
        selectedMethodology.dataSource,
        userProfile.nivel_actual_entreno
      );

      // 5. Preparar el contexto para la IA
      const aiContext = this.prepareAIContext({
        userProfile,
        selectedMethodology,
        exerciseHistory,
        methodologyExercises,
        versionConfig,
        mode
      });

      // 6. Generar el plan con IA
      const plan = await this.generateWithAI(aiContext, selectedMethodology);

      // 7. Validar y post-procesar el plan
      const validatedPlan = this.validateAndEnrichPlan(plan, selectedMethodology);

      // 8. Guardar el plan en la base de datos
      const planId = await this.savePlan({
        userId,
        methodology: selectedMethodology.name,
        plan: validatedPlan,
        mode
      });

      return {
        success: true,
        plan: validatedPlan,
        planId,
        metadata: {
          methodology: selectedMethodology.name,
          mode,
          generatedAt: new Date().toISOString(),
          version: versionConfig.version || 'adapted'
        }
      };

    } catch (error) {
      logError(error, 'MethodologyService.generatePlan');
      throw error;
    }
  }

  /**
   * Obtiene el perfil completo del usuario desde la BD
   */
  async getUserProfile(userId) {
    const query = `
      SELECT
        u.id, u.nombre, u.apellido, u.email,
        u.edad, u.sexo, u.peso, u.altura,
        u.nivel_entrenamiento, u.anos_entrenando,
        u.grasa_corporal, u.masa_muscular,
        u.pecho, u.brazos, u.cintura, u.cadera,
        u.medicamentos, u.nivel_actividad,
        u.suplementacion, u.alergias,
        p.objetivo_principal, p.limitaciones_fisicas,
        p.metodologia_preferida, p.equipamiento_disponible
      FROM app.users u
      LEFT JOIN app.user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [userId]);
    if (!result.rows.length) return null;

    // Normalizar datos del perfil
    const profile = result.rows[0];
    return {
      ...profile,
      nivel_actual_entreno: profile.nivel_entrenamiento || 'intermediate',
      años_entrenando: profile.anos_entrenando || 0,
      estatura: profile.altura || 170,
      peso: profile.peso || 70
    };
  }

  /**
   * Obtiene el historial de ejercicios del usuario
   */
  async getUserExerciseHistory(userId) {
    // Ejercicios recientes de metodologías
    const recentQuery = `
      SELECT
        exercise_name,
        methodology_type,
        COUNT(*) as usage_count,
        MAX(completed_at) as last_used
      FROM app.methodology_exercise_history_complete
      WHERE user_id = $1
        AND completed_at >= NOW() - INTERVAL '60 days'
      GROUP BY exercise_name, methodology_type
      ORDER BY MAX(completed_at) DESC, COUNT(*) DESC
      LIMIT 30
    `;

    // Feedback de ejercicios
    const feedbackQuery = `
      SELECT
        exercise_name,
        sentiment,
        COUNT(*) as count,
        ARRAY_AGG(comment) FILTER (WHERE comment IS NOT NULL) as comments
      FROM app.methodology_exercise_feedback
      WHERE user_id = $1
      GROUP BY exercise_name, sentiment
    `;

    const [recentResult, feedbackResult] = await Promise.all([
      pool.query(recentQuery, [userId]),
      pool.query(feedbackQuery, [userId])
    ]);

    // Organizar feedback por ejercicio
    const feedbackMap = {};
    feedbackResult.rows.forEach(row => {
      if (!feedbackMap[row.exercise_name]) {
        feedbackMap[row.exercise_name] = {};
      }
      feedbackMap[row.exercise_name][row.sentiment] = {
        count: row.count,
        comments: row.comments
      };
    });

    return {
      recent: recentResult.rows,
      feedback: feedbackMap
    };
  }

  /**
   * Selecciona automáticamente la mejor metodología para el usuario
   */
  async selectBestMethodology(userProfile, exerciseHistory) {
    // Obtener metodologías usadas recientemente
    const recentMethodologies = [...new Set(
      exerciseHistory.recent.map(e => e.methodology_type).filter(Boolean)
    )];

    // Obtener metodologías recomendadas
    const recommended = getRecommendedMethodologies(userProfile);

    // Filtrar las que no se han usado recientemente
    const available = recommended.filter(
      m => !recentMethodologies.includes(m.name)
    );

    // Si no hay disponibles, usar cualquier recomendada
    const candidates = available.length > 0 ? available : recommended;

    // Seleccionar la mejor según el perfil
    return this.rankMethodologies(candidates, userProfile)[0];
  }

  /**
   * Rankea metodologías según qué tan apropiadas son para el usuario
   */
  rankMethodologies(methodologies, userProfile) {
    return methodologies.sort((a, b) => {
      let scoreA = 0, scoreB = 0;

      // Puntaje por objetivo
      if (a.suitableFor.objectives.includes(userProfile.objetivo_principal)) scoreA += 3;
      if (b.suitableFor.objectives.includes(userProfile.objetivo_principal)) scoreB += 3;

      // Puntaje por nivel
      if (a.suitableFor.experience.includes(userProfile.nivel_actual_entreno)) scoreA += 2;
      if (b.suitableFor.experience.includes(userProfile.nivel_actual_entreno)) scoreB += 2;

      // Penalización por dificultad
      if (userProfile.edad > 50) {
        if (a.difficulty === 'advanced') scoreA -= 1;
        if (b.difficulty === 'advanced') scoreB -= 1;
      }

      return scoreB - scoreA;
    });
  }

  /**
   * Obtiene ejercicios específicos para una metodología
   */
  async getMethodologyExercises(dataSource, userLevel) {
    const query = `
      SELECT
        name as exercise_name,
        key as exercise_key,
        category,
        muscle_groups,
        equipment_required,
        difficulty_level,
        description
      FROM app.exercises_catalog
      WHERE is_active = true
        AND data_source = $1
        AND (difficulty_level = $2 OR difficulty_level = 'all')
      ORDER BY priority DESC, RANDOM()
      LIMIT 50
    `;

    const result = await pool.query(query, [dataSource, userLevel]);

    // Si no hay ejercicios específicos, usar ejercicios generales
    if (result.rows.length === 0) {
      const fallbackQuery = `
        SELECT
          name as exercise_name,
          key as exercise_key,
          category,
          muscle_groups,
          equipment_required,
          difficulty_level,
          description
        FROM app.exercises_catalog
        WHERE is_active = true
        ORDER BY priority DESC, RANDOM()
        LIMIT 30
      `;
      const fallbackResult = await pool.query(fallbackQuery);
      return fallbackResult.rows;
    }

    return result.rows;
  }

  /**
   * Prepara el contexto para enviar a la IA
   */
  prepareAIContext({
    userProfile,
    selectedMethodology,
    exerciseHistory,
    methodologyExercises,
    versionConfig,
    mode
  }) {
    const currentDate = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const startDay = dayNames[currentDate.getDay()];

    // Crear lista de ejercicios a evitar (usados frecuentemente)
    const exercisesToAvoid = exerciseHistory.recent
      .filter(e => e.usage_count > 3)
      .map(e => e.exercise_name);

    // Crear lista de ejercicios favoritos
    const favoriteExercises = Object.entries(exerciseHistory.feedback)
      .filter(([_, feedback]) => feedback.like?.count > feedback.hard?.count)
      .map(([exerciseName]) => exerciseName);

    return {
      userProfile: {
        edad: userProfile.edad,
        peso: userProfile.peso,
        estatura: userProfile.estatura,
        sexo: userProfile.sexo,
        nivel_actividad: userProfile.nivel_actividad,
        nivel_entrenamiento: userProfile.nivel_actual_entreno,
        años_entrenando: userProfile.años_entrenando,
        objetivo: userProfile.objetivo_principal,
        medicamentos: userProfile.medicamentos,
        limitaciones: userProfile.limitaciones_fisicas
      },
      methodology: {
        name: selectedMethodology.name,
        characteristics: selectedMethodology.characteristics,
        mode: mode
      },
      exercises: {
        available: methodologyExercises,
        toAvoid: exercisesToAvoid,
        favorites: favoriteExercises
      },
      configuration: {
        version: versionConfig.version || 'adapted',
        weeks: versionConfig.customWeeks || 4,
        startDay: startDay,
        startDate: currentDate.toISOString()
      }
    };
  }

  /**
   * Genera el plan usando IA
   */
  async generateWithAI(context, methodology) {
    // Obtener el cliente OpenAI
    this.openai = getOpenAIClient('methodology_unified');

    // Cargar el prompt específico de la metodología
    const promptKey = `methodology_${methodology.id}`;
    let systemPrompt;

    try {
      systemPrompt = await getPrompt(promptKey);
    } catch (error) {
      // Si no hay prompt específico, usar el genérico
      console.log(`⚠️ No hay prompt específico para ${methodology.id}, usando genérico`);
      systemPrompt = await getPrompt('methodologie');
    }

    // Construir el mensaje del usuario
    const userMessage = this.buildUserMessage(context);

    logAIPayload('Metodología Unificada', {
      methodology: methodology.name,
      context_keys: Object.keys(context)
    });

    // Llamar a OpenAI
    const response = await this.openai.chat.completions.create({
      model: this.modelConfig.model,
      temperature: this.modelConfig.temperature,
      max_tokens: this.modelConfig.max_output_tokens,
      top_p: this.modelConfig.top_p,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    logTokens(response);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Respuesta vacía de la IA');
    }

    logAIResponse(content, 'Metodología Unificada');

    // Parsear la respuesta JSON
    return this.parseAIResponse(content);
  }

  /**
   * Construye el mensaje del usuario para la IA
   */
  buildUserMessage(context) {
    const { userProfile, methodology, exercises, configuration } = context;

    return `
SOLICITUD DE PLAN DE ENTRENAMIENTO
=====================================

METODOLOGÍA SELECCIONADA: ${methodology.name}
MODO: ${methodology.mode === 'manual' ? 'MANUAL (Usuario eligió)' : 'AUTOMÁTICO (IA recomienda)'}

CONFIGURACIÓN DEL PLAN:
- Duración: ${configuration.weeks} semanas
- Versión: ${configuration.version === 'adapted' ? 'ADAPTADA (progresiva)' : 'ESTRICTA (intensiva)'}
- Inicio: ${configuration.startDay} (${configuration.startDate})

PERFIL DEL USUARIO:
- Edad: ${userProfile.edad} años
- Peso: ${userProfile.peso} kg
- Estatura: ${userProfile.estatura} cm
- Sexo: ${userProfile.sexo}
- Nivel: ${userProfile.nivel_entrenamiento}
- Experiencia: ${userProfile.años_entrenando} años
- Objetivo: ${userProfile.objetivo}
- Medicamentos: ${userProfile.medicamentos || 'Ninguno'}
- Limitaciones: ${userProfile.limitaciones || 'Ninguna'}

CARACTERÍSTICAS DE LA METODOLOGÍA:
- Sesiones por semana: ${methodology.characteristics.minSessions}-${methodology.characteristics.maxSessions}
- Ejercicios por sesión: ${methodology.characteristics.minExercisesPerSession}-${methodology.characteristics.maxExercisesPerSession}
- Descanso entre series: ${methodology.characteristics.restBetweenSets.min}-${methodology.characteristics.restBetweenSets.max} segundos
- Rango de repeticiones: ${methodology.characteristics.repRange.min}-${methodology.characteristics.repRange.max}
- Intensidad (RPE): ${methodology.characteristics.intensityRange.min}-${methodology.characteristics.intensityRange.max}

EJERCICIOS DISPONIBLES:
${exercises.available.slice(0, 20).map(e => `- ${e.exercise_name} (${e.category})`).join('\n')}

EJERCICIOS A EVITAR (muy usados recientemente):
${exercises.toAvoid.join(', ') || 'Ninguno'}

EJERCICIOS FAVORITOS DEL USUARIO:
${exercises.favorites.join(', ') || 'No especificados'}

Por favor, genera un plan de entrenamiento completo en formato JSON siguiendo las especificaciones de la metodología ${methodology.name}.
`;
  }

  /**
   * Parsea la respuesta de la IA
   */
  parseAIResponse(content) {
    try {
      // Limpiar markdown si existe
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.split('```json')[1].split('```')[0];
      } else if (content.includes('```')) {
        cleanContent = content.split('```')[1].split('```')[0];
      }

      return JSON.parse(cleanContent.trim());
    } catch (error) {
      console.error('Error parseando respuesta IA:', error);
      throw new Error('La IA no devolvió un JSON válido');
    }
  }

  /**
   * Valida y enriquece el plan generado
   */
  validateAndEnrichPlan(plan, methodology) {
    // Validaciones básicas
    if (!plan.semanas || !Array.isArray(plan.semanas)) {
      throw new Error('Plan inválido: falta estructura de semanas');
    }

    // Enriquecer con metadatos
    plan.metadata = {
      methodology_id: methodology.id,
      methodology_name: methodology.name,
      characteristics: methodology.characteristics,
      generated_at: new Date().toISOString()
    };

    // Validar que cada sesión tenga el mínimo de ejercicios
    plan.semanas.forEach(semana => {
      semana.sesiones?.forEach(sesion => {
        const minExercises = methodology.characteristics.minExercisesPerSession;
        if (!sesion.ejercicios || sesion.ejercicios.length < minExercises) {
          console.warn(`⚠️ Sesión con pocos ejercicios: ${sesion.ejercicios?.length || 0} < ${minExercises}`);
        }
      });
    });

    return plan;
  }

  /**
   * Guarda el plan en la base de datos
   */
  async savePlan({ userId, methodology, plan, mode }) {
    const query = `
      INSERT INTO app.methodology_plans (
        user_id,
        methodology_type,
        plan_data,
        generation_mode,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, 'active', NOW())
      RETURNING id
    `;

    // Cancelar planes anteriores
    await pool.query(
      `UPDATE app.methodology_plans
       SET status = 'cancelled', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const result = await pool.query(query, [
      userId,
      methodology,
      JSON.stringify(plan),
      mode
    ]);

    return result.rows[0].id;
  }
}

// Exportar instancia singleton
export const methodologyService = new MethodologyService();