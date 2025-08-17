import express from 'express';
import OpenAI from 'openai';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();
const MODEL_NAME = 'gpt-4o-mini'; // Modelo definido en una constante

// Utilidad para calcular IMC con datos en kg/cm
const calcIMC = (peso, alturaCm) => {
  const p = Number(peso);
  const a = Number(alturaCm);
  if (!p || !a) return null;
  const m = a / 100;
  return Number((p / (m * m)).toFixed(1));
};

// POST /api/ia-home-training/generate
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { equipment_type, training_type } = req.body || {};
    const userId = req.user?.userId || req.user?.id;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Falta OPENAI_API_KEY en el backend' });
    }

    const allowedEq = new Set(['minimo', 'basico', 'avanzado']);
    const allowedTr = new Set(['funcional', 'hiit', 'fuerza']);
    if (!allowedEq.has(equipment_type) || !allowedTr.has(training_type)) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }

    // Cargar perfil del usuario desde la BD
    const { rows } = await pool.query(
      `SELECT id, nombre, apellido, email, edad, sexo, peso, altura,
              nivel_actividad, anos_entrenando, nivel_entrenamiento,
              objetivo_principal, alergias, medicamentos, limitaciones_fisicas
         FROM users
        WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const u = rows[0];

    // Cargar historial de ejercicios recientes
    const historyRes = await pool.query(
      `SELECT e.nombre
         FROM home_training_plans p
              CROSS JOIN jsonb_to_recordset(p.plan_data->'ejercicios') AS e(nombre TEXT)
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC
        LIMIT 15`,
      [userId]
    );
    const recentExercises = historyRes.rows.map(r => r.nombre).join(', ') || 'Ninguno';
    const imc = calcIMC(u.peso, u.altura);

    const systemMessage = `Eres "MindFit Coach", un experto entrenador personal y biomecánico. Tu misión es diseñar rutinas de entrenamiento en casa excepcionales, seguras y efectivas, respondiendo SIEMPRE con un único objeto JSON válido.

**REGLA DE ORO**: Tu respuesta debe ser exclusivamente un objeto JSON. No incluyas texto, comentarios o markdown fuera del JSON.

La estructura es:
{
  "mensaje_personalizado": "Texto breve, motivador y específico para el usuario.",
  "plan_entrenamiento": { /* Objeto del plan detallado */ }
}

**ANALIZA AL USUARIO Y GENERA EL PLAN SIGUIENDO ESTAS DIRECTIVAS:**

1.  **PERFIL DE USUARIO:**
    -   ID: ${u.id}
    -   Edad: ${u.edad || ''} años, Sexo: ${u.sexo || ''}
    -   Peso: ${u.peso || ''} kg, Altura: ${u.altura || ''} cm, IMC: ${imc || ''}
    -   Nivel: ${u.nivel_actividad || ''}, Años entrenando: ${u.anos_entrenando || ''}
    -   Objetivo: ${u.objetivo_principal || ''}
    -   Limitaciones: ${u.limitaciones_fisicas?.join(', ') || 'Ninguna'}

2.  **PREFERENCIAS DE HOY:**
    -   Equipamiento: "${equipment_type}"
    -   Tipo de Entrenamiento: "${training_type}"

3.  **HISTORIAL RECIENTE (Ejercicios a evitar si es posible):**
    -   ${recentExercises}

4.  **REGLAS DE ORO PARA LA GENERACIÓN:**
    -   **¡SÉ CREATIVO!**: Esta es la regla más importante. Sorprende al usuario. No uses siempre los mismos 5 ejercicios de HIIT. Tienes una base de datos inmensa de movimientos, úsala.
    -   **EVITA LA REPETICIÓN**: El historial de ejercicios recientes es una lista de lo que NO debes usar, o al menos, no en su mayoría. Prioriza la novedad.
    -   **CALIDAD TÉCNICA**: Las 'notas' de cada ejercicio deben ser consejos de experto, enfocados en la forma y la seguridad.
    -   **UTILIZA EL EQUIPAMIENTO**: Si el usuario tiene 'equipo básico', incorpora las mancuernas y las bandas elásticas de forma inteligente en el HIIT, no te limites al peso corporal.

5.  **GUÍA DE ESTILOS (NO REGLAS ESTRICTAS):**
    -   **funcional**: Piensa en movimientos completos y fluidos. Combina fuerza, equilibrio y cardio.
    -   **hiit**: El objetivo es la intensidad. Alterna picos de esfuerzo máximo con descansos cortos. La estructura (ej. 30s trabajo / 30s descanso) es una guía, siéntete libre de proponer otras (ej. 45/15, Tabata, etc.).
    -   **fuerza**: Enfócate en la sobrecarga progresiva. Menos repeticiones, más peso y descansos más largos para permitir la recuperación.

**EJEMPLO DE SALIDA JSON PERFECTA:**
{
  "mensaje_personalizado": "¡Hola Sergio! Para tu objetivo de ganar músculo, y viendo que hoy toca HIIT, he preparado una sesión intensa con tu equipo básico que elevará tu ritmo cardíaco y estimulará tus fibras musculares. ¡Vamos a por ello!",
  "plan_entrenamiento": {
    "titulo": "HIIT para Hipertrofia",
    "subtitulo": "Entrenamiento con equipamiento básico",
    "fecha": "${new Date().toISOString().slice(0, 10)}",
    "equipamiento": "basico",
    "tipoEntrenamiento": "hiit",
    "duracion_estimada_min": 25,
    "ejercicios": [
      {
        "nombre": "Sentadilla Goblet con Mancuerna",
        "tipo": "reps",
        "series": 4,
        "repeticiones": 12,
        "descanso_seg": 60,
        "notas": "Mantén la mancuerna pegada al pecho y el torso erguido durante todo el movimiento.",
        "patron": "sentadilla",
        "implemento": "mancuernas"
      }
    ]
  }
}

Ahora, genera el plan para el usuario.`;

    const apiKey = process.env.OPENAI_API_KEY;
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: `Genera un plan de entrenamiento para el usuario con equipamiento "${equipment_type}" y tipo "${training_type}". Responde SOLO con JSON.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
      top_p: 1.0
    });

    const content = completion?.choices?.[0]?.message?.content || '{}';
    let aiJson;
    try {
      aiJson = JSON.parse(content);
    } catch (_) {
      aiJson = { error: 'Formato no JSON' };
    }

    const equipmentNames = { minimo: 'Equipamiento Mínimo', basico: 'Equipamiento Básico', avanzado: 'Equipamiento Avanzado' };
    const trainingNames = { funcional: 'Funcional', hiit: 'HIIT', fuerza: 'Fuerza' };
    const plan_source = { type: 'openai', label: 'OpenAI', detail: MODEL_NAME };

    const enriched = {
      plan_source,
      ...aiJson,
      plan_entrenamiento: {
        ...(aiJson?.plan_entrenamiento || {}),
        equipamiento: equipment_type,
        tipoEntrenamiento: training_type,
        equipamiento_nombre: equipmentNames[equipment_type],
        tipo_nombre: trainingNames[training_type],
        fecha_formateada: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        perfil_usuario: `${u.nombre || 'Usuario'} — Edad: ${u.edad ?? ''}, Peso: ${u.peso ?? ''} kg, Altura: ${u.altura ?? ''} cm, Nivel: ${u.nivel_actividad ?? ''}, IMC: ${imc ?? ''}`
      }
    };

    return res.json({ success: true, plan: enriched });
  } catch (error) {
    console.error('Error IAHomeTraining.generate:', error);
    return res.status(500).json({ success: false, error: 'Error generando plan', details: error.message });
  }
});

export default router;