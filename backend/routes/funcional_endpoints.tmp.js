
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

    const evaluation = parseAIResponse(completion.choices[0].message.content);

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

    const exercisesResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, categoria, patron, equipamiento,
             series_reps_objetivo, descanso_seg, tempo, notas, progresion_hacia
      FROM app."Ejercicios_Funcional"
      WHERE ${levelCondition}
      ORDER BY RANDOM()
    `);

    const availableExercises = exercisesResult.rows;

    if (availableExercises.length === 0) {
      throw new Error(`No hay ejercicios disponibles para el nivel ${dbLevel}`);
    }

    console.log(`✅ Ejercicios Funcionales cargados: ${availableExercises.length} para nivel ${dbLevel}`);

    // Llamar a IA con prompt especializado
    const client = getModuleOpenAI(AI_MODULES.FUNCIONAL_SPECIALIST);
    const config = AI_MODULES.FUNCIONAL_SPECIALIST;
    const systemPrompt = await getPrompt(FeatureKey.FUNCIONAL_SPECIALIST);

    // Construir mensaje para IA
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

    const generatedPlan = parseAIResponse(completion.choices[0].message.content);

    console.log(`✅ Plan Funcional generado por IA`);

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
      `, [userId, 'Funcional', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

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
    console.error('Error generando plan de Entrenamiento Funcional:', error);
    logError('FUNCIONAL_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});
