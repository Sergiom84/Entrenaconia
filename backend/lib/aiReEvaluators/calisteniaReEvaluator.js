/**
 * 🤖 CALISTENIA RE-EVALUATOR
 * Análisis con IA del progreso del usuario en Calistenia
 *
 * PROPÓSITO: Evaluar progreso y sugerir ajustes adaptativos
 * MODELO: OpenAI GPT-4
 *
 * @version 1.0.0 - Sistema de Re-evaluación Progresiva
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analizar progreso de usuario en Calistenia y sugerir ajustes
 *
 * @param {Object} params
 * @param {Object} params.currentPlan - Plan actual completo
 * @param {Object} params.userData - Perfil del usuario
 * @param {Object} params.reEvaluationData - Datos de la re-evaluación
 * @returns {Promise<Object>} Análisis y sugerencias de IA
 */
export async function analyze({ currentPlan, userData, reEvaluationData }) {
  try {
    console.log('🤖 [CALISTENIA RE-EVAL] Iniciando análisis de IA');

    const { week, exercises, sentiment, comment } = reEvaluationData;

    // Construir contexto del plan actual
    const planContext = buildPlanContext(currentPlan, week);

    // Construir contexto del usuario
    const userContext = buildUserContext(userData);

    // Construir contexto de progreso
    const progressContext = buildProgressContext(exercises, sentiment, comment);

    // Prompt optimizado para re-evaluación de Calistenia
    const systemPrompt = `Eres un entrenador experto en Calistenia certificado. Tu rol es analizar el progreso del usuario y sugerir ajustes adaptativos basados en datos reales.

PRINCIPIOS CLAVE DE CALISTENIA:
- Progresión gradual: Incrementos pequeños y sostenibles
- Calidad sobre cantidad: Técnica perfecta antes de aumentar dificultad
- Balance: Equilibrio entre push/pull y upper/lower body
- Progresiones: Usar variantes más difíciles cuando se supera 3x12
- Regresiones: Volver a variantes más fáciles si la técnica se deteriora
- Descanso: Crucial para prevenir lesiones

RESPONDE SOLO EN JSON VÁLIDO, SIN MARKDOWN.`;

    const userPrompt = `
PLAN ACTUAL:
${planContext}

USUARIO:
${userContext}

RE-EVALUACIÓN SEMANA ${week}:
${progressContext}

ANALIZA:
1. ¿El usuario está progresando adecuadamente según su nivel?
2. ¿Hay ejercicios donde está estancado o superando expectativas?
3. ¿Debemos aumentar/disminuir intensidad o volumen?
4. ¿Sugerir progresiones (variantes más difíciles) o regresiones (más fáciles)?
5. ¿Hay señales de sobreentrenamiento o riesgo de lesión?

FORMATO EXACTO:
{
  "progress_assessment": "progressing|stalled|regressing|excellent",
  "suggested_adjustments": {
    "intensity_change": "+10%|-10%|maintain",
    "volume_change": "+5%|-5%|maintain",
    "rest_modifications": "increase|decrease|maintain",
    "exercise_progressions": [
      {
        "exercise": "Pull-ups",
        "current_level": "8-10 reps",
        "suggested_progression": "Weighted Pull-ups (+2.5kg)",
        "reasoning": "Usuario supera consistentemente 3x10 con buena técnica"
      }
    ]
  },
  "motivational_feedback": "Mensaje personalizado motivacional",
  "warnings": ["Advertencia 1 si aplica", "Advertencia 2 si aplica"],
  "reasoning": "Explicación detallada del análisis en español"
}

IMPORTANTE:
- Sé específico con las progresiones (indica pesos, variantes exactas)
- Si sentiment es "muy_dificil", sugiere regresiones y descanso
- Si sentiment es "excelente" y supera reps, sugiere progresiones
- Warnings solo si hay riesgo real (sobreentrenamiento, técnica, lesión)
- motivational_feedback debe ser genuino y personalizado
`;

    console.log('📤 [CALISTENIA RE-EVAL] Enviando prompt a OpenAI');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('📥 [CALISTENIA RE-EVAL] Respuesta de OpenAI recibida');

    const parsedResponse = JSON.parse(aiResponse);

    // Validar estructura de respuesta
    if (!parsedResponse.progress_assessment || !parsedResponse.suggested_adjustments) {
      throw new Error('Respuesta de IA con estructura inválida');
    }

    console.log('✅ [CALISTENIA RE-EVAL] Análisis completado exitosamente');

    return parsedResponse;

  } catch (error) {
    console.error('❌ [CALISTENIA RE-EVAL] Error:', error);

    // Fallback: respuesta genérica si falla la IA
    return {
      progress_assessment: 'stalled',
      suggested_adjustments: {
        intensity_change: 'maintain',
        volume_change: 'maintain',
        rest_modifications: 'maintain',
        exercise_progressions: []
      },
      motivational_feedback: '¡Sigue así! Cada entrenamiento cuenta.',
      warnings: ['Error al analizar con IA. Consulta con un entrenador.'],
      reasoning: `Error en análisis de IA: ${error.message}`
    };
  }
}

/**
 * Construir contexto del plan actual
 */
function buildPlanContext(plan, currentWeek) {
  if (!plan) return 'Plan no disponible';

  const metodologia = plan.metodologia || 'Calistenia';
  const nivel = plan.nivel || plan.nivel_usuario || 'Intermedio';
  const duracion = plan.duracion_total_semanas || plan.duracion_semanas || 'N/A';
  const frecuencia = plan.frecuencia_semanal || 'N/A';

  let weekInfo = '';
  if (Array.isArray(plan.semanas)) {
    const week = plan.semanas.find(w => w.semana === currentWeek || w.week === currentWeek);
    if (week) {
      const sesiones = week.sesiones?.length || 0;
      const ejerciciosPorSesion = week.sesiones?.[0]?.ejercicios?.length || 0;
      weekInfo = `\nSemana ${currentWeek}: ${sesiones} sesiones, ~${ejerciciosPorSesion} ejercicios/sesión`;
    }
  }

  return `Metodología: ${metodologia}
Nivel: ${nivel}
Duración total: ${duracion} semanas
Frecuencia: ${frecuencia} días/semana${weekInfo}`;
}

/**
 * Construir contexto del usuario
 */
function buildUserContext(userData) {
  if (!userData || Object.keys(userData).length === 0) {
    return 'Perfil de usuario no disponible';
  }

  const edad = userData.edad || userData.age || 'N/A';
  const peso = userData.peso || userData.weight || 'N/A';
  const altura = userData.altura || userData.height || 'N/A';
  const nivel = userData.nivel || userData.nivel_calistenia || 'Intermedio';
  const objetivos = userData.objetivos || userData.goals || 'Progreso general';
  const experiencia = userData.experiencia || userData.experiencia_previa || 'N/A';

  return `Edad: ${edad}
Peso: ${peso} kg
Altura: ${altura} cm
Nivel: ${nivel}
Experiencia previa: ${experiencia}
Objetivos: ${objetivos}`;
}

/**
 * Construir contexto de progreso desde re-evaluación
 */
function buildProgressContext(exercises, sentiment, comment) {
  let context = `Sensación general: ${sentiment || 'No especificada'}\n`;

  if (comment && comment.trim()) {
    context += `Comentarios del usuario: "${comment.trim()}"\n`;
  }

  if (Array.isArray(exercises) && exercises.length > 0) {
    context += '\nProgreso por ejercicio:\n';
    exercises.forEach(ex => {
      if (ex.exercise_name) {
        const series = ex.series_achieved || 'N/A';
        const reps = ex.reps_achieved || 'N/A';
        const difficulty = ex.difficulty_rating || 'No especificada';
        const notes = ex.notes ? ` (${ex.notes})` : '';

        context += `- ${ex.exercise_name}: ${series} series x ${reps} reps - Dificultad: ${difficulty}${notes}\n`;
      }
    });
  } else {
    context += '\nNo se proporcionaron datos de ejercicios específicos.';
  }

  return context;
}

export default { analyze };
