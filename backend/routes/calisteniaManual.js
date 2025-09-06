import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
import { getPrompt } from '../lib/promptRegistry.js';
import { AI_MODULES } from '../config/aiConfigs.js';

const router = express.Router();

// Helper function to get user profile (sin equipamiento por ahora)
async function getUserProfileWithEquipment(userId) {
  // Obtener perfil del usuario desde la tabla users
  const userQuery = await pool.query(`
    SELECT * FROM app.users WHERE id = $1
  `, [userId]);
  
  if (userQuery.rowCount === 0) {
    return {};
  }
  
  const userProfile = userQuery.rows[0];
  
  // Por ahora, asumir equipamiento básico de calistenia (peso corporal + barra)
  return {
    ...userProfile,
    equipamiento_disponible: ['peso_corporal', 'barra_dominadas', 'suelo']
  };
}

// Helper function to get available calistenia exercises by level
async function getCalisteniaExercisesByLevel(level) {
  const exercisesQuery = await pool.query(`
    SELECT exercise_id, nombre, categoria, patron, equipamiento, 
           series_reps_objetivo, criterio_de_progreso, progresion_desde, 
           progresion_hacia, notas
    FROM app.calistenia_exercises
    WHERE nivel = $1
    ORDER BY categoria, nombre
  `, [level]);
  
  return exercisesQuery.rows;
}

// Helper function to get user's calistenia history
async function getUserCalisteniaHistory(userId) {
  const historyQuery = await pool.query(`
    SELECT DISTINCT exercise_name, feedback_rating, MAX(completed_at) as last_completed
    FROM app.methodology_exercise_history_complete 
    WHERE user_id = $1 
      AND methodology_type IN ('Calistenia', 'Calistenia Manual')
    GROUP BY exercise_name, feedback_rating
    ORDER BY last_completed DESC
    LIMIT 50
  `, [userId]);
  
  return historyQuery.rows;
}

// Generate calistenia manual plan
router.post('/generate', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { level, goals, levelInfo } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Get user profile and equipment
    const userProfile = await getUserProfileWithEquipment(userId);
    console.log('✅ User profile retrieved for calistenia manual');
    
    // 2. Get exercises for the selected level
    const levelCapitalized = level.charAt(0).toUpperCase() + level.slice(1);
    const availableExercises = await getCalisteniaExercisesByLevel(levelCapitalized);
    console.log(`✅ Found ${availableExercises.length} exercises for level: ${levelCapitalized}`);
    
    // 3. Get user's calistenia history
    const userHistory = await getUserCalisteniaHistory(userId);
    console.log(`✅ Retrieved ${userHistory.length} historical exercises`);
    
    // 4. Get current day for starting the routine
    const activationDate = new Date();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const activationDay = daysOfWeek[activationDate.getDay()];
    
    console.log(`🗓️ CALISTENIA MANUAL: Plan comenzará desde ${activationDay} (${activationDate.toLocaleDateString('es-ES')})`);
    console.log(`🎯 NO desde Lunes, sino desde el día actual: ${activationDay}`);
    
    // 4. Build AI prompt context
    const promptContext = `
🎯 INFORMACIÓN CRÍTICA DE INICIO:
- El usuario está activando la calistenia HOY: ${activationDay} (${activationDate.toLocaleDateString('es-ES')})  
- El plan debe comenzar INMEDIATAMENTE desde HOY (${activationDay})
- La primera sesión debe ser para ${activationDay}, NO para Lunes
- Estructura las semanas empezando desde ${activationDay}

PERFIL DEL USUARIO:
- Edad: ${userProfile.edad || 'No especificada'}
- Peso: ${userProfile.peso_kg || 'No especificado'} kg
- Altura: ${userProfile.altura_cm || 'No especificada'} cm
- Experiencia: ${userProfile.experiencia_ejercicio || 'Principiante'}
- Nivel de actividad: ${userProfile.nivel_actividad || 'Moderado'}
- Objetivo: ${userProfile.objetivo_fitness || 'General'}
- Lesiones previas: ${userProfile.lesiones_previas || 'Ninguna'}
- Equipamiento disponible: ${userProfile.equipamiento_disponible?.join(', ') || 'Peso corporal únicamente'}

NIVEL SELECCIONADO: ${levelCapitalized}
FRECUENCIA: ${levelInfo.frequency}
HITOS DEL NIVEL: ${levelInfo.hitos.join(', ')}

OBJETIVOS ESPECÍFICOS: ${goals || 'Progresión general en calistenia'}

EJERCICIOS DISPONIBLES PARA ESTE NIVEL:
${availableExercises.map(ex => 
  `- ${ex.nombre} (${ex.categoria}): ${ex.series_reps_objetivo} | Equipamiento: ${ex.equipamiento} | Progresión: ${ex.progresion_desde} → ${ex.progresion_hacia} | Criterio: ${ex.criterio_de_progreso}`
).join('\n')}

HISTORIAL DE EJERCICIOS PREVIOS (para evitar repetición):
${userHistory.length > 0 ? 
  userHistory.map(h => `- ${h.exercise_name} (${h.feedback_rating || 'sin feedback'}, último: ${h.last_completed})`).join('\n')
  : 'Sin historial previo'
}

INSTRUCCIONES:
1. Genera un plan de 4 semanas de calistenia manual
2. USA SOLO ejercicios de la lista disponible arriba
3. Respeta las progresiones naturales (progresion_desde → progresion_hacia)
4. Adapta el volumen al nivel seleccionado
5. Considera el equipamiento disponible del usuario
6. Incluye sempre los campos: progresion_info y criterio_progreso
7. Balancea las categorías de movimiento en cada sesión
8. Evita ejercicios que el usuario haya hecho recientemente si es posible
9. **CRÍTICO**: El plan debe comenzar INMEDIATAMENTE desde HOY (${activationDay}), NO desde Lunes
10. **CRÍTICO**: La primera sesión debe ser para ${activationDay}, estructura las semanas empezando desde ${activationDay}
    `;
    
    // 5. Get AI configuration and prompt
    const aiConfig = AI_MODULES.METHODOLOGIE_MANUAL;
    const prompt = await getPrompt('calistenia_manual');
    
    if (!prompt) {
      throw new Error('Calistenia manual prompt not found');
    }
    
    const fullPrompt = prompt + '\n\n' + promptContext;
    
    // 6. Call OpenAI API
    const openaiApiKey = process.env[aiConfig.envKey];
    if (!openaiApiKey) {
      throw new Error(`OpenAI API key not found for ${aiConfig.envKey}`);
    }
    
    console.log('🤖 Calling OpenAI for calistenia manual generation...');
    
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
            content: 'Eres un experto entrenador de calistenia que genera planes personalizados basándose en criterios científicos de progresión.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData}`);
    }
    
    const aiResponse = await response.json();
    const generatedPlan = aiResponse.choices[0].message.content;
    
    console.log('✅ AI response received, processing...');
    
    // 7. Parse AI response to JSON
    let parsedPlan;
    try {
      // Try to extract JSON from the response
      const jsonMatch = generatedPlan.match(/```json\\s*([\\s\\S]*?)\\s*```/) || 
                       generatedPlan.match(/{[\\s\\S]*}/);
      
      if (jsonMatch) {
        parsedPlan = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI JSON:', parseError);
      console.log('Raw AI response:', generatedPlan);
      throw new Error('Error parsing AI-generated plan');
    }
    
    // 8. Save to database
    const insertResult = await client.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, status, created_at
      ) VALUES ($1, $2, $3, $4, NOW()) 
      RETURNING id
    `, [userId, 'Calistenia Manual', JSON.stringify(parsedPlan), 'draft']);
    
    const planId = insertResult.rows[0].id;
    
    // 9. Create corresponding routine plan
    const routinePlanResult = await client.query(`
      INSERT INTO app.routine_plans (
        user_id, methodology_type, plan_data, status, source_methodology_plan_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW()) 
      RETURNING id
    `, [userId, 'Calistenia Manual', JSON.stringify(parsedPlan), 'draft', planId]);
    
    const routinePlanId = routinePlanResult.rows[0].id;
    
    await client.query('COMMIT');
    
    console.log('✅ Calistenia manual plan generated successfully');
    
    res.json({
      success: true,
      planId,
      routinePlanId,
      plan: parsedPlan,
      message: 'Plan de calistenia manual generado exitosamente'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error generating calistenia manual plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando plan de calistenia manual',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Get user's calistenia level assessment
router.get('/level-assessment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's recent calistenia performances
    const assessmentQuery = await pool.query(`
      SELECT exercise_name, feedback_rating, notes,
             AVG(CASE WHEN feedback_rating = 'like' THEN 5
                      WHEN feedback_rating = 'normal' THEN 3  
                      WHEN feedback_rating = 'hard' THEN 1
                      ELSE 3 END) as avg_difficulty,
             COUNT(*) as times_performed
      FROM app.methodology_exercise_history_complete 
      WHERE user_id = $1 
        AND methodology_type IN ('Calistenia', 'Calistenia Manual')
        AND completed_at > NOW() - INTERVAL '3 months'
      GROUP BY exercise_name, feedback_rating, notes
      ORDER BY times_performed DESC, avg_difficulty DESC
    `, [userId]);
    
    const performances = assessmentQuery.rows;
    
    // Simple level assessment based on exercises performed
    let suggestedLevel = 'basico';
    
    const advancedExercises = performances.filter(p => 
      p.exercise_name.includes('muscle-up') || 
      p.exercise_name.includes('one-arm') ||
      p.exercise_name.includes('planche') ||
      p.exercise_name.includes('lever')
    );
    
    const intermediateExercises = performances.filter(p => 
      p.exercise_name.includes('pistol') ||
      p.exercise_name.includes('handstand') ||
      (p.exercise_name.includes('dominada') && p.avg_difficulty >= 3)
    );
    
    if (advancedExercises.length >= 2) {
      suggestedLevel = 'avanzado';
    } else if (intermediateExercises.length >= 3) {
      suggestedLevel = 'intermedio';
    }
    
    res.json({
      success: true,
      suggestedLevel,
      performances: performances.slice(0, 10), // Top 10 recent exercises
      assessment: {
        totalExercises: performances.length,
        advancedCount: advancedExercises.length,
        intermediateCount: intermediateExercises.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in level assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Error evaluando nivel de calistenia',
      details: error.message
    });
  }
});

// Get available exercises for a level
router.get('/exercises/:level', authenticateToken, async (req, res) => {
  try {
    const { level } = req.params;
    const levelCapitalized = level.charAt(0).toUpperCase() + level.slice(1);
    
    const exercises = await getCalisteniaExercisesByLevel(levelCapitalized);
    
    res.json({
      success: true,
      level: levelCapitalized,
      exercises
    });
    
  } catch (error) {
    console.error('❌ Error fetching exercises:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo ejercicios',
      details: error.message
    });
  }
});

export default router;