import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
import { AI_MODULES } from '../config/aiConfigs.js';
import { getModuleOpenAI } from '../lib/openaiClient.js';

const router = express.Router();

// ========================================
// CONFIGURACIÓN DE IA PARA RUTINAS DE GYM
// ========================================

// Obtener cliente OpenAI para rutinas de gym
const getGymRoutineClient = () => {
  const config = AI_MODULES.METHODOLOGIE; // Reutilizamos la config de metodologías
  if (!config) {
    throw new Error('Configuración METHODOLOGIE no encontrada');
  }
  
  return getModuleOpenAI(config);
};

/**
 * POST /api/gym-routine/generate
 * Generar una rutina de gimnasio fresh con IA
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { 
      methodology, 
      duration_weeks = 4, 
      frequency_per_week = 3,
      focus_areas = [],
      experience_level = 'intermedio'
    } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      });
    }

    if (!methodology) {
      return res.status(400).json({
        success: false,
        error: 'Metodología requerida'
      });
    }

    console.log(`🏋️ Generando rutina de gimnasio para usuario ${userId}`);
    console.log(`📋 Metodología: ${methodology}, Duración: ${duration_weeks} semanas, Frecuencia: ${frequency_per_week}x/semana`);

    // Obtener perfil completo del usuario
    const userProfileQuery = `
      SELECT 
        u.id, u.nombre, u.apellido, u.email,
        u.edad, u.sexo, u.peso, u.altura,
        u.nivel_entrenamiento, u.anos_entrenando, u.frecuencia_semanal,
        u.grasa_corporal, u.masa_muscular, u.agua_corporal, u.metabolismo_basal,
        u.cintura, u.pecho, u.brazos, u.muslos, u.cuello, u.antebrazos, u.cadera,
        u.alergias, u.medicamentos, u.nivel_actividad, u.horario_preferido,
        u.enfoque_entrenamiento, u.historial_medico,
        p.objetivo_principal, p.limitaciones_fisicas, p.metodologia_preferida
      FROM app.users u 
      LEFT JOIN app.user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `;

    const userResult = await pool.query(userProfileQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const userProfile = userResult.rows[0];

    // Obtener historial de ejercicios recientes para evitar repetición
    const exerciseHistoryQuery = `
      SELECT DISTINCT exercise_name, COUNT(*) as frequency
      FROM app.exercise_history 
      WHERE user_id = $1 
        AND used_at >= NOW() - INTERVAL '30 days'
      GROUP BY exercise_name
      ORDER BY frequency DESC, MAX(used_at) DESC
      LIMIT 20
    `;

    const historyResult = await pool.query(exerciseHistoryQuery, [userId]);
    const recentExercises = historyResult.rows.map(row => ({
      name: row.exercise_name,
      frequency: row.frequency
    }));

    // Obtener cliente OpenAI
    const client = getGymRoutineClient();

    // Construir prompt para la IA
    const systemPrompt = `Eres un entrenador personal experto especializado en rutinas de gimnasio.

INSTRUCCIONES:
1. Genera una rutina de gimnasio COMPLETA y DETALLADA
2. La rutina debe ser para ${duration_weeks} semanas con ${frequency_per_week} entrenamientos por semana
3. Metodología solicitada: ${methodology}
4. Nivel de experiencia: ${experience_level}
5. EVITA repetir ejercicios que el usuario ha hecho recientemente
6. Incluye ejercicios variados y progresión semanal
7. Cada ejercicio debe tener series, repeticiones, peso/intensidad y descanso

FORMATO DE RESPUESTA (JSON):
{
  "routine_name": "Nombre descriptivo de la rutina",
  "methodology": "${methodology}",
  "duration_weeks": ${duration_weeks},
  "frequency_per_week": ${frequency_per_week},
  "description": "Descripción breve de la rutina y sus objetivos",
  "weeks": [
    {
      "week_number": 1,
      "focus": "Enfoque de esta semana",
      "days": [
        {
          "day_number": 1,
          "day_name": "Día 1",
          "muscle_groups": ["Pecho", "Tríceps"],
          "exercises": [
            {
              "name": "Press de banca",
              "sets": 4,
              "reps": "8-10",
              "weight": "75-80% 1RM",
              "rest": "2-3 min",
              "notes": "Controlar la bajada, explosivo en la subida"
            }
          ]
        }
      ]
    }
  ],
  "progression_notes": "Notas sobre cómo progresar semana a semana",
  "equipment_needed": ["Barra", "Mancuernas", "Banco"],
  "estimated_duration": "60-75 minutos por sesión"
}`;

    const userMessage = `Genera una rutina de gimnasio personalizada para:

PERFIL DEL USUARIO:
- Nombre: ${userProfile.nombre} ${userProfile.apellido}
- Edad: ${userProfile.edad} años
- Sexo: ${userProfile.sexo}
- Peso: ${userProfile.peso} kg
- Altura: ${userProfile.altura} cm
- Nivel de entrenamiento: ${userProfile.nivel_entrenamiento}
- Años entrenando: ${userProfile.anos_entrenando}
- Objetivo principal: ${userProfile.objetivo_principal}
- Limitaciones físicas: ${userProfile.limitaciones_fisicas || 'Ninguna'}
- Enfoque de entrenamiento: ${userProfile.enfoque_entrenamiento}

EJERCICIOS RECIENTES A EVITAR:
${recentExercises.length > 0 ? recentExercises.map(ex => `- ${ex.name} (usado ${ex.frequency} veces)`).join('\n') : 'Ninguno registrado'}

ÁREAS DE ENFOQUE SOLICITADAS:
${focus_areas.length > 0 ? focus_areas.join(', ') : 'Desarrollo general'}

Genera la rutina completa siguiendo el formato JSON especificado.`;

    console.log('🤖 Enviando solicitud a OpenAI para generar rutina...');

    const completion = await client.chat.completions.create({
      model: AI_MODULES.METHODOLOGIE.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 4000
    });

    let aiResponse = completion.choices[0]?.message?.content?.trim();
    
    if (!aiResponse) {
      throw new Error('Respuesta vacía de OpenAI');
    }

    console.log('📝 Respuesta de IA recibida, parseando...');

    // Parsear respuesta JSON
    let routinePlan;
    try {
      routinePlan = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Error parseando JSON de rutina:', parseError);
      throw new Error('Error procesando la respuesta de la IA');
    }

    // Validar estructura básica
    if (!routinePlan.weeks || !Array.isArray(routinePlan.weeks)) {
      throw new Error('Estructura de rutina inválida');
    }

    console.log(`✅ Rutina generada exitosamente: ${routinePlan.routine_name}`);

    // Responder con la rutina generada (NO guardar en BD)
    res.json({
      success: true,
      routine: routinePlan,
      metadata: {
        generated_at: new Date().toISOString(),
        user_id: userId,
        methodology: methodology,
        ai_model: AI_MODULES.METHODOLOGIE.model,
        duration_weeks: duration_weeks,
        frequency_per_week: frequency_per_week
      }
    });

  } catch (error) {
    console.error('❌ Error generando rutina de gimnasio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * GET /api/gym-routine/methodologies
 * Obtener metodologías disponibles para rutinas de gimnasio
 */
router.get('/methodologies', (req, res) => {
  const methodologies = [
    { id: 'push_pull_legs', name: 'Push/Pull/Legs', description: 'División por patrones de movimiento' },
    { id: 'upper_lower', name: 'Upper/Lower', description: 'División tren superior/inferior' },
    { id: 'full_body', name: 'Full Body', description: 'Cuerpo completo cada sesión' },
    { id: 'weider', name: 'Weider', description: 'División por grupos musculares' },
    { id: 'powerlifting', name: 'Powerlifting', description: 'Enfoque en fuerza máxima' },
    { id: 'hipertrofia', name: 'Hipertrofia', description: 'Enfoque en crecimiento muscular' },
    { id: 'funcional', name: 'Funcional', description: 'Movimientos funcionales' },
    { id: 'crossfit', name: 'CrossFit', description: 'Entrenamiento variado e intenso' }
  ];

  res.json({
    success: true,
    methodologies,
    total: methodologies.length
  });
});

/**
 * GET /api/gym-routine/health
 * Health check para el módulo de rutinas de gimnasio
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    module: 'Gym Routine AI',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/gym-routine/generate',
      'GET /api/gym-routine/methodologies'
    ]
  });
});

export default router;
