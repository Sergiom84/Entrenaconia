import express from 'express';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getPrompt, FeatureKey } from '../lib/promptRegistry.js';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// Modelo para Home Training
const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-nano';

// Utilidad para calcular IMC con datos en kg/cm
const calcIMC = (peso, alturaCm) => {
  const p = Number(peso);
  const a = Number(alturaCm);
  if (!p || !a) return null;
  const m = a / 100;
  return Number((p / (m * m)).toFixed(1));
};

// Duración y descansos
const SECONDS_PER_REP_DEFAULT = 2.5;
const DEFAULT_WORK_SECONDS = 45; // si no hay datos para reps
const clampRest = (sec) => {
  const n = Number(sec);
  const val = Number.isFinite(n) && n > 0 ? n : 45;
  return Math.min(60, Math.max(45, val));
};

const computeEstimatedDurationMinutes = (plan) => {
  try {
    const ejercicios = plan?.ejercicios || [];
    if (!Array.isArray(ejercicios) || ejercicios.length === 0) return null;
    let totalSeconds = 0;
    for (const ej of ejercicios) {
      const series = Number(ej?.series) || 0;
      if (series <= 0) continue;
      const descanso = clampRest(ej?.descanso_seg);
      let trabajo = 0;
      if (Number(ej?.duracion_seg)) {
        trabajo = Number(ej.duracion_seg);
      } else if (Number(ej?.repeticiones)) {
        trabajo = Math.round(Number(ej.repeticiones) * SECONDS_PER_REP_DEFAULT);
      } else {
        trabajo = DEFAULT_WORK_SECONDS;
      }
      totalSeconds += series * (trabajo + descanso);
    }
    if (totalSeconds <= 0) return null;
    return Math.max(1, Math.round(totalSeconds / 60));
  } catch {
    return null;
  }
};


// POST /api/ia-home-training/generate
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { equipment_type, training_type } = req.body || {};
    const userId = req.user?.userId || req.user?.id;

    // Obtener cliente específico para home training
    const client = getOpenAIClient("home");
    const systemPrompt = await getPrompt(FeatureKey.HOME);

    const allowedEq = new Set(['minimo', 'basico', 'avanzado', 'personalizado', 'usar_este_equipamiento']);
    const allowedTr = new Set(['funcional', 'hiit', 'fuerza']);
    if (!allowedEq.has(equipment_type) || !allowedTr.has(training_type)) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }

    // Cargar perfil del usuario desde la vista normalizada
    const { rows } = await pool.query(
      `SELECT * FROM app.v_user_profile_normalized WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const u = rows[0];

    // Cargar equipamiento del usuario (curado + personalizado)
    const curatedEqRes = await pool.query(
      `SELECT COALESCE(ue.equipment_key, ei.key) AS equipment_key
       FROM app.user_equipment ue
       LEFT JOIN app.equipment_items ei ON ei.key = ue.equipment_id::text
       WHERE ue.user_id = $1`,
      [userId]
    );
    const customEqRes = await pool.query(
      `SELECT name FROM app.user_custom_equipment WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    const userCuratedEquipment = curatedEqRes.rows.map(r => r.equipment_key);
    const userCustomEquipment = customEqRes.rows.map(r => r.name);
    const curatedKeysStr = userCuratedEquipment.length ? userCuratedEquipment.join(', ') : 'Ninguno';
    const customNamesStr = userCustomEquipment.length ? userCustomEquipment.join(', ') : 'Ninguno';

    // Cargar historial mezclado (prioriza completados) para el prompt
    const mixRes = await pool.query(
      `WITH base AS (
         SELECT exercise_key, exercise_name, created_at, 2 AS weight
         FROM app.v_hist_real WHERE user_id = $1
         UNION ALL
         SELECT exercise_key, exercise_name, created_at, 1 AS weight
         FROM app.v_hist_propuesto WHERE user_id = $1
       ),
       ranked AS (
         SELECT exercise_key,
                (array_agg(exercise_name ORDER BY created_at DESC))[1] AS exercise_name,
                MAX(created_at) AS last_seen_at,
                MAX(weight) AS max_weight
         FROM base GROUP BY exercise_key
       )
       SELECT exercise_name
       FROM ranked
       ORDER BY max_weight DESC, last_seen_at DESC
       LIMIT 15`,
      [userId]
    );
    const recentExercises = (mixRes.rows.map(r => r.exercise_name).join(', ')) || 'Ninguno';
    const imc = calcIMC(u.peso, u.altura);

    // Inventario de equipamiento permitido según selección (guardarraíl del prompt)
    const equipmentInventories = {
      minimo: {
        label: 'Equipamiento Mínimo',
        implements: ['peso_corporal','toallas','silla_sofa','pared']
      },
      basico: {
        label: 'Equipamiento Básico',
        implements: ['mancuernas','bandas_elasticas','esterilla','banco_step']
      },
      avanzado: {
        label: 'Equipamiento Avanzado',
        implements: ['barra_dominadas','kettlebells','trx','discos_olimpicos']
      },
      personalizado: {
        label: 'Mi equipamiento',
        // El guardarraíl para "personalizado" será el equipamiento real del usuario (curated + custom)
        implements: []
      }
    };
    let inventory = equipmentInventories[equipment_type];
    if (equipment_type === 'personalizado' || equipment_type === 'usar_este_equipamiento') {
      // Usa el equipamiento real del usuario como guardarraíl
      const eqSet = new Set(userCuratedEquipment);
      // También añadimos hints de custom como implementos libres
      for (const name of userCustomEquipment) {
        if (typeof name === 'string' && name.trim()) {
          eqSet.add(name.trim().toLowerCase().replace(/\s+/g, '_'));
        }
      }
      inventory = { label: 'Mi equipamiento', implements: Array.from(eqSet) };
    }

    // Construir system message dinámico con datos del usuario
    const systemMessage = systemPrompt
      .replace(/\$\{u\.id\}/g, u.id || '')
      .replace(/\$\{u\.edad \|\| ''\}/g, u.edad || '')
      .replace(/\$\{u\.sexo \|\| ''\}/g, u.sexo || '')
      .replace(/\$\{u\.peso \|\| ''\}/g, u.peso || '')
      .replace(/\$\{u\.altura \|\| ''\}/g, u.altura || '')
      .replace(/\$\{imc \|\| ''\}/g, imc || '')
      .replace(/\$\{u\.nivel_actividad \|\| ''\}/g, u.nivel || '')
      .replace(/\$\{u\.anos_entrenando \|\| ''\}/g, u.anos_entrenando || '')
      .replace(/\$\{u\.años_entrenando \|\| ''\}/g, u.anos_entrenando || '')
      .replace(/\$\{u\.objetivo_principal \|\| ''\}/g, u.objetivo_principal || '')
      .replace(/\$\{u\.limitaciones_fisicas\?\.join\(', '\) \|\| 'Ninguna'\}/g, u.limitaciones_fisicas?.join(', ') || 'Ninguna')
      .replace(/\$\{equipment_type\}/g, equipment_type)
      .replace(/\$\{training_type\}/g, training_type)
      .replace(/\$\{recentExercises\}/g, recentExercises);

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: `Genera un plan de entrenamiento para el usuario con equipamiento "${equipment_type}" y tipo "${training_type}". Responde SOLO con JSON.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 1.0,
      top_p: 1.0
    });

    const content = completion?.choices?.[0]?.message?.content || '{}';
    let aiJson;
    try {
      aiJson = JSON.parse(content);
    } catch (error) {
      console.error('IAHomeTraining error:', error);
      aiJson = { error: 'Formato no JSON' };
    }

    const equipmentNames = { minimo: 'Equipamiento Mínimo', basico: 'Equipamiento Básico', avanzado: 'Equipamiento Avanzado' };
    const trainingNames = { funcional: 'Funcional', hiit: 'HIIT', fuerza: 'Fuerza' };
    const plan_source = { type: 'openai', label: 'OpenAI', detail: MODEL };

    // Normalización de descansos y duración estimada
    const aiPlan = aiJson?.plan_entrenamiento || {};
    const sanitizedExercises = Array.isArray(aiPlan?.ejercicios)
      ? aiPlan.ejercicios.map(ej => ({ ...ej, descanso_seg: clampRest(ej?.descanso_seg ?? 45) }))
      : [];
    const computedDuration = computeEstimatedDurationMinutes({ ejercicios: sanitizedExercises });
    const durationOk = Number.isFinite(Number(aiPlan?.duracion_estimada_min)) && Number(aiPlan?.duracion_estimada_min) > 0;

    const enriched = {
      plan_source,
      ...aiJson,
      plan_entrenamiento: {
        ...aiPlan,
        ejercicios: sanitizedExercises,
        duracion_estimada_min: durationOk ? Number(aiPlan.duracion_estimada_min) : computedDuration,
        equipamiento: equipment_type,
        tipoEntrenamiento: training_type,
        equipamiento_nombre: equipmentNames[equipment_type],
        tipo_nombre: trainingNames[training_type],
        fecha_formateada: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        perfil_usuario: `${u.nombre || 'Usuario'} — Edad: ${u.edad ?? ''}, Peso: ${u.peso ?? ''} kg, Altura: ${u.altura ?? ''} cm, Nivel: ${u.nivel ?? ''}, IMC: ${imc ?? ''}`
      }
    };

    return res.json({ success: true, plan: enriched });
  } catch (error) {
    console.error('Error IAHomeTraining.generate:', error);
    return res.status(500).json({ success: false, error: 'Error generando plan', details: error.message });
  }
});

export default router;