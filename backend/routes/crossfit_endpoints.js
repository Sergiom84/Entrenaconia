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
      max_tokens: 6000
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
      `, [userId, 'CrossFit', JSON.stringify(generatedPlan), 'manual', 'draft']);

      const methodologyPlanId = planResult.rows[0].id;

      await client_db.query('COMMIT');

      console.log(`✅ Plan CrossFit guardado con ID: ${methodologyPlanId}`);

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
    console.error('Error generando plan de CrossFit:', error);
    logError('CROSSFIT_SPECIALIST', error);

    res.status(500).json({
      success: false,
      error: 'Error generando plan',
      message: error.message
    });
  }
});
