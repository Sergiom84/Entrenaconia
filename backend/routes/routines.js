import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// Helpers para normalizar los nombres de días a abreviaturas válidas por la BD
function stripDiacritics(str = '') {
  try { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return str; }
}
function normalizeDayAbbrev(dayName) {
  if (!dayName) return dayName;
  const raw = stripDiacritics(String(dayName).trim());
  const lower = raw.toLowerCase().replace(/\.$/, '');
  const map = {
    'lunes': 'Lun', 'lun': 'Lun',
    'martes': 'Mar', 'mar': 'Mar',
    'miercoles': 'Mie', 'mie': 'Mie', 'miércoles': 'Mie',
    'jueves': 'Jue', 'jue': 'Jue',
    'viernes': 'Vie', 'vie': 'Vie',
    'sabado': 'Sab', 'sab': 'Sab', 'sábado': 'Sab',
    'domingo': 'Dom', 'dom': 'Dom',
  };
  return map[lower] || dayName; // si ya viene correcto, lo dejamos
}
function normalizePlanDays(planDataJson) {
  try {
    if (!planDataJson || !Array.isArray(planDataJson.semanas)) return planDataJson;
    return {
      ...planDataJson,
      semanas: planDataJson.semanas.map((sem) => ({
        ...sem,
        sesiones: Array.isArray(sem.sesiones)
          ? sem.sesiones.map((ses) => ({
              ...ses,
              dia: normalizeDayAbbrev(ses.dia),
            }))
          : sem.sesiones,
      })),
    };
  } catch (e) {
    console.error('No se pudo normalizar días del plan', e);
    return planDataJson;
  }
}

// Utilidad: asegurar sesiones creadas a partir del plan JSON (metodología)
async function ensureMethodologySessions(client, userId, methodologyPlanId, planDataJson) {
  // ¿Existen sesiones ya?
  const exists = await client.query(
    'SELECT 1 FROM app.methodology_exercise_sessions WHERE user_id = $1 AND methodology_plan_id = $2 LIMIT 1',
    [userId, methodologyPlanId]
  );
  if (exists.rowCount > 0) return;

  const normalizedPlan = normalizePlanDays(planDataJson);

  await client.query(
    'SELECT app.create_methodology_exercise_sessions($1, $2, $3::jsonb)',
    [userId, methodologyPlanId, JSON.stringify(normalizedPlan)]
  );
}

// Utilidad: crear una sesión específica para un día que no existe en el plan
async function createMissingDaySession(client, userId, methodologyPlanId, planDataJson, requestedDay, weekNumber = 1) {
  const normalizedPlan = normalizePlanDays(planDataJson);
  const normalizedRequestedDay = normalizeDayAbbrev(requestedDay);
  
  // Buscar si ya existe la sesión para este día
  const existingSession = await client.query(
    'SELECT id FROM app.methodology_exercise_sessions WHERE user_id = $1 AND methodology_plan_id = $2 AND week_number = $3 AND day_name = $4',
    [userId, methodologyPlanId, weekNumber, normalizedRequestedDay]
  );
  
  if (existingSession.rowCount > 0) {
    return existingSession.rows[0].id;
  }
  
  // Si el plan no contiene una sesión para el día solicitado, usar la primera sesión disponible
  const semanas = normalizedPlan?.semanas || [];
  const firstWeek = semanas.find(s => Number(s.semana) === weekNumber) || semanas[0];
  const sesiones = firstWeek?.sesiones || [];
  
  if (sesiones.length === 0) {
    throw new Error('No hay sesiones disponibles en el plan para crear una sesión de reemplazo');
  }
  
  // Tomar la primera sesión como template
  const templateSession = sesiones[0];
  
  // Crear la nueva sesión en la BD
  const newSession = await client.query(
    `INSERT INTO app.methodology_exercise_sessions 
     (user_id, methodology_plan_id, methodology_type, session_name, week_number, day_name, total_exercises, created_at, updated_at)
     VALUES ($1, $2, 'Adaptada', $3, $4, $5, $6, NOW(), NOW()) 
     RETURNING id`,
    [
      userId, 
      methodologyPlanId, 
      `Sesión ${normalizedRequestedDay}`, 
      weekNumber, 
      normalizedRequestedDay, 
      templateSession.ejercicios?.length || 0
    ]
  );
  
  console.log(`✅ Sesión creada para día faltante: ${normalizedRequestedDay} (usando template de ${templateSession.dia})`);
  return newSession.rows[0].id;
}

// GET /api/routines/plan?id=...&type=routine|methodology
router.get('/plan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id, type } = req.query;
    if (!id || !type) {
      return res.status(400).json({ success: false, error: 'Parámetros requeridos: id y type (routine|methodology)' });
    }

    if (type === 'routine') {
      const r = await client.query(
        'SELECT id, methodology_type, plan_data, generation_mode, frequency_per_week, total_weeks, is_active FROM app.routine_plans WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (r.rowCount === 0) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      return res.json({ success: true, plan: r.rows[0] });
    }

    if (type === 'methodology') {
      const r = await client.query(
        'SELECT id, methodology_type, plan_data, generation_mode FROM app.methodology_plans WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (r.rowCount === 0) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      return res.json({ success: true, plan: r.rows[0] });
    }

    return res.status(400).json({ success: false, error: 'type inválido' });
  } catch (e) {
    console.error('Error fetching routine plan:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

// POST /api/routines/bootstrap-plan
// Si solo se tiene routine_plan_id, crea un registro en methodology_plans y devuelve methodology_plan_id
router.post('/bootstrap-plan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { routine_plan_id } = req.body;
    if (!routine_plan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'routine_plan_id requerido' });
    }

    const r = await client.query(
      'SELECT id, methodology_type, plan_data, generation_mode FROM app.routine_plans WHERE id = $1 AND user_id = $2',
      [routine_plan_id, userId]
    );
    if (r.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Routine plan no encontrado' });
    }

    const { methodology_type, plan_data, generation_mode } = r.rows[0];

    // Crear methodology_plans
    const ins = await client.query(
      `INSERT INTO app.methodology_plans (user_id, methodology_type, plan_data, generation_mode, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [userId, methodology_type, plan_data, generation_mode || 'automatic']
    );

    const methodologyPlanId = ins.rows[0].id;

    // Crear sesiones derivadas del plan JSON
    await ensureMethodologySessions(client, userId, methodologyPlanId, plan_data);

    await client.query('COMMIT');
    res.json({ success: true, methodology_plan_id: methodologyPlanId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error bootstrap plan:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

// POST /api/routines/sessions/start
// Body: { methodology_plan_id, week_number, day_name }
router.post('/sessions/start', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, week_number, day_name } = req.body;
    if (!methodology_plan_id || !week_number || !day_name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Faltan parámetros: methodology_plan_id, week_number, day_name' });
    }

    // Verificar plan y obtener plan_data
    const planQ = await client.query(
      'SELECT plan_data, methodology_type FROM app.methodology_plans WHERE id = $1 AND user_id = $2',
      [methodology_plan_id, userId]
    );
    if (planQ.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    }
    const planData = planQ.rows[0].plan_data;

    // Asegurar sesiones creadas
    await ensureMethodologySessions(client, userId, methodology_plan_id, planData);

    const normalizedDay = normalizeDayAbbrev(day_name);

    // Buscar la sesión específica
    let ses = await client.query(
      `SELECT * FROM app.methodology_exercise_sessions
         WHERE user_id = $1 AND methodology_plan_id = $2 AND week_number = $3 AND day_name = $4
         LIMIT 1`,
      [userId, methodology_plan_id, week_number, normalizedDay]
    );

    if (ses.rowCount === 0) {
      // Crear de nuevo las sesiones por si acaso y reintentar
      await ensureMethodologySessions(client, userId, methodology_plan_id, planData);
      ses = await client.query(
        `SELECT * FROM app.methodology_exercise_sessions
           WHERE user_id = $1 AND methodology_plan_id = $2 AND week_number = $3 AND day_name = $4
           LIMIT 1`,
        [userId, methodology_plan_id, week_number, normalizedDay]
      );
    }

    if (ses.rowCount === 0) {
      // Si no existe la sesión, crearla usando la función de día faltante
      console.log(`⚠️ Sesión no encontrada para ${normalizedDay}, creando sesión adaptada...`);
      try {
        const sessionId = await createMissingDaySession(client, userId, methodology_plan_id, planData, day_name, week_number);
        // Obtener la sesión recién creada
        ses = await client.query(
          `SELECT * FROM app.methodology_exercise_sessions WHERE id = $1`,
          [sessionId]
        );
      } catch (createError) {
        console.error('Error creando sesión para día faltante:', createError);
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Sesión no encontrada para esa semana/día y no se pudo crear una adaptada' });
      }
    }

    const session = ses.rows[0];

    // Precrear progreso por ejercicio (si no existe)
    // Encontrar la definición de ejercicios en el JSON del plan
    const semana = (planData.semanas || []).find(s => Number(s.semana) === Number(week_number));
    let sesionDef = semana ? (semana.sesiones || []).find(s => normalizeDayAbbrev(s.dia) === normalizedDay) : null;
    
    // Si no existe sesión para este día, usar la primera sesión disponible como template
    if (!sesionDef && semana && semana.sesiones && semana.sesiones.length > 0) {
      sesionDef = semana.sesiones[0];
      console.log(`📋 Usando template de ${sesionDef.dia} para día faltante ${normalizedDay}`);
    }
    
    const ejercicios = Array.isArray(sesionDef?.ejercicios) ? sesionDef.ejercicios : [];

    for (let i = 0; i < ejercicios.length; i++) {
      const ej = ejercicios[i] || {};
      const order = i; // 0-based
      // Insertar si no existe
      await client.query(
        `INSERT INTO app.methodology_exercise_progress (
           methodology_session_id, user_id, exercise_order, exercise_name,
           series_total, repeticiones, descanso_seg, intensidad, tempo, notas,
           series_completed, status
         )
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'pending'
         WHERE NOT EXISTS (
           SELECT 1 FROM app.methodology_exercise_progress 
            WHERE methodology_session_id = $1 AND exercise_order = $3
         )`,
        [session.id, userId, order, ej.nombre || `Ejercicio ${i + 1}`,
         Number(ej.series) || 3, String(ej.repeticiones || ''), Number(ej.descanso_seg) || 60,
         ej.intensidad || null, ej.tempo || null, ej.notas || null]
      );
    }

    // Marcar sesión iniciada
    await client.query(
      `UPDATE app.methodology_exercise_sessions
         SET session_status = 'in_progress', started_at = COALESCE(started_at, NOW()), total_exercises = $2
       WHERE id = $1`,
      [session.id, ejercicios.length]
    );

    await client.query('COMMIT');
    res.json({ success: true, session_id: session.id, total_exercises: ejercicios.length });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error starting routine session:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

// PUT /api/routines/sessions/:sessionId/exercise/:exerciseOrder
// Body: { series_completed, status, time_spent_seconds }
router.put('/sessions/:sessionId/exercise/:exerciseOrder', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { sessionId, exerciseOrder } = req.params;
    const { series_completed, status, time_spent_seconds } = req.body;

    // Verificar sesión del usuario
    const ses = await client.query(
      'SELECT * FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (ses.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }

    // Asegurar fila de progreso existente
    const progSel = await client.query(
      `SELECT * FROM app.methodology_exercise_progress 
        WHERE methodology_session_id = $1 AND exercise_order = $2`,
      [sessionId, exerciseOrder]
    );

    if (progSel.rowCount === 0) {
      // Crear fila mínima (sin info completa) si faltase
      await client.query(
        `INSERT INTO app.methodology_exercise_progress (
           methodology_session_id, exercise_order, exercise_name,
           series_total, repeticiones, descanso_seg, series_completed, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 0, 'pending')`,
        [sessionId, exerciseOrder, 'Ejercicio', 3, '—', 60]
      );
    }

    // Actualizar progreso
    const upd = await client.query(
      `UPDATE app.methodology_exercise_progress
         SET series_completed = $1,
             status = $2,
             time_spent_seconds = COALESCE($3, time_spent_seconds),
             completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END
       WHERE methodology_session_id = $4 AND exercise_order = $5
       RETURNING *`,
      [series_completed, status, time_spent_seconds ?? null, sessionId, exerciseOrder]
    );

    // Actualizar sesión (contadores y estado)
    const counters = await client.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) AS total
       FROM app.methodology_exercise_progress
       WHERE methodology_session_id = $1`,
      [sessionId]
    );
    const { completed, total } = counters.rows[0];

    await client.query(
      `UPDATE app.methodology_exercise_sessions
         SET exercises_completed = $2,
             total_exercises = GREATEST($3, COALESCE(total_exercises, 0)),
             total_duration_seconds = COALESCE(total_duration_seconds, 0) + COALESCE($4, 0),
             session_status = CASE WHEN $2 = $3 AND $3 > 0 THEN 'completed' ELSE 'in_progress' END,
             ended_at = CASE WHEN $2 = $3 AND $3 > 0 THEN NOW() ELSE ended_at END
       WHERE id = $1`,
      [sessionId, Number(completed), Number(total), time_spent_seconds ?? 0]
    );

    await client.query('COMMIT');
    res.json({ success: true, exercise: upd.rows[0], progress: { completed: Number(completed), total: Number(total) } });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating routine exercise:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

// POST /api/routines/sessions/:sessionId/finish
router.post('/sessions/:sessionId/finish', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;

    const ses = await client.query(
      'SELECT * FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (ses.rowCount === 0) return res.status(404).json({ success: false, error: 'Sesión no encontrada' });

    await client.query(
      `UPDATE app.methodology_exercise_sessions
         SET session_status = 'completed', ended_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    res.json({ success: true });
  } catch (e) {
    console.error('Error finishing routine session:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

// GET /api/routines/sessions/:sessionId/progress
router.get('/sessions/:sessionId/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;

    const ses = await pool.query(
      'SELECT * FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (ses.rowCount === 0) return res.status(404).json({ success: false, error: 'Sesión no encontrada' });

    const progress = await pool.query(
      `SELECT exercise_order, exercise_name, series_total, series_completed, repeticiones, descanso_seg, intensidad, tempo, status, time_spent_seconds
         FROM app.methodology_exercise_progress
        WHERE methodology_session_id = $1
        ORDER BY exercise_order ASC`,
      [sessionId]
    );

    const counters = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COUNT(*)::int AS total
         FROM app.methodology_exercise_progress
        WHERE methodology_session_id = $1`,
      [sessionId]
    );

    res.json({ success: true, session: ses.rows[0], exercises: progress.rows, summary: counters.rows[0] });
  } catch (e) {
    console.error('Error fetching session progress:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;

