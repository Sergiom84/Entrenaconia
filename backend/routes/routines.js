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
  
  // Obtener la metodología real del plan JSON
  const realMethodology = planDataJson?.selected_style || planDataJson?.metodologia || 'Adaptada';
  
  // Crear la nueva sesión en la BD
  const newSession = await client.query(
    `INSERT INTO app.methodology_exercise_sessions 
     (user_id, methodology_plan_id, methodology_type, session_name, week_number, day_name, total_exercises, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
     RETURNING id`,
    [
      userId, 
      methodologyPlanId, 
      realMethodology,
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
           methodology_session_id, user_id, exercise_order, exercise_name,
           series_total, repeticiones, descanso_seg, series_completed, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'pending')`,
        [sessionId, userId, exerciseOrder, 'Ejercicio', 3, '—', 60]
      );
    }

    // Actualizar progreso
    const upd = await client.query(
      `UPDATE app.methodology_exercise_progress
         SET series_completed = $1::int,
             status = $2::varchar(20),
             time_spent_seconds = COALESCE($3, time_spent_seconds),
             completed_at = CASE WHEN $2::varchar(20) = 'completed' THEN NOW() ELSE completed_at END
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
             completed_at = CASE WHEN $2 = $3 AND $3 > 0 THEN NOW() ELSE completed_at END
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
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;

    const ses = await client.query(
      'SELECT * FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (ses.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }

    const session = ses.rows[0];

    // Actualizar estado de la sesión
    await client.query(
      `UPDATE app.methodology_exercise_sessions
         SET session_status = 'completed', completed_at = NOW(),
             total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $1`,
      [sessionId]
    );

    // Obtener todos los ejercicios de la sesión para mover al historial
    const exercisesQuery = await client.query(
      `SELECT mep.*, mes.methodology_type, mes.methodology_plan_id, mes.week_number, mes.day_name
       FROM app.methodology_exercise_progress mep
       JOIN app.methodology_exercise_sessions mes ON mep.methodology_session_id = mes.id
       WHERE mep.methodology_session_id = $1`,
      [sessionId]
    );

    // Mover cada ejercicio al historial completo
    for (const exercise of exercisesQuery.rows) {
      // Solo mover ejercicios que fueron completados o saltados (no pendientes)
      if (exercise.status !== 'pending') {
        await client.query(
          `INSERT INTO app.methodology_exercise_history_complete (
            user_id, methodology_plan_id, methodology_session_id,
            exercise_name, exercise_order, methodology_type,
            series_total, series_completed, repeticiones, intensidad,
            tiempo_dedicado_segundos, week_number, day_name, 
            session_date, completed_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          ON CONFLICT DO NOTHING`,
          [
            userId,
            exercise.methodology_plan_id,
            sessionId,
            exercise.exercise_name,
            exercise.exercise_order,
            exercise.methodology_type,
            exercise.series_total,
            exercise.series_completed || 0,
            exercise.repeticiones,
            exercise.intensidad,
            exercise.time_spent_seconds,
            exercise.week_number,
            exercise.day_name,
            session.started_at ? new Date(session.started_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            session.completed_at || new Date()
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Sesión finalizada y datos guardados en historial' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error finishing routine session:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

// GET /api/routines/sessions/today-status
// Obtiene el estado de la sesión del día actual (si existe)
router.get('/sessions/today-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, week_number, day_name } = req.query;

    if (!methodology_plan_id || !week_number || !day_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parámetros requeridos: methodology_plan_id, week_number, day_name' 
      });
    }

    const normalizedDay = normalizeDayAbbrev(day_name);

    // Buscar la sesión del día
    const sessionQuery = await pool.query(
      `SELECT * FROM app.methodology_exercise_sessions
       WHERE user_id = $1 AND methodology_plan_id = $2 
         AND week_number = $3 AND day_name = $4
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, methodology_plan_id, week_number, normalizedDay]
    );

    if (sessionQuery.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No hay sesión para este día' 
      });
    }

    const session = sessionQuery.rows[0];

    // Obtener progreso de ejercicios con feedback
    const exercisesQuery = await pool.query(
      `SELECT 
        p.exercise_order, p.exercise_name, p.series_total, p.series_completed, 
        p.repeticiones, p.descanso_seg, p.intensidad, p.tempo, p.status, 
        p.time_spent_seconds, p.notas,
        f.sentiment, f.comment
       FROM app.methodology_exercise_progress p
       LEFT JOIN app.methodology_exercise_feedback f 
         ON p.methodology_session_id = f.methodology_session_id 
         AND p.exercise_order = f.exercise_order
       WHERE p.methodology_session_id = $1
       ORDER BY p.exercise_order ASC`,
      [session.id]
    );

    // Calcular resumen
    const totalExercises = exercisesQuery.rowCount;
    const completedExercises = exercisesQuery.rows.filter(ex => ex.status === 'completed').length;
    const skippedExercises = exercisesQuery.rows.filter(ex => ex.status === 'skipped').length;

    res.json({
      success: true,
      session: {
        ...session,
        canResume: session.session_status === 'in_progress' || (session.session_status === 'pending' && exercisesQuery.rowCount > 0)
      },
      exercises: exercisesQuery.rows,
      summary: {
        total: totalExercises,
        completed: completedExercises,
        skipped: skippedExercises,
        pending: totalExercises - completedExercises - skippedExercises,
        isComplete: session.session_status === 'completed'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estado de sesión del día:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
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
      `SELECT 
        mep.exercise_order, mep.exercise_name, mep.series_total, mep.series_completed, 
        mep.repeticiones, mep.descanso_seg, mep.intensidad, mep.tempo, mep.status, 
        mep.time_spent_seconds, mep.notas,
        mef.sentiment, mef.comment
       FROM app.methodology_exercise_progress mep
       LEFT JOIN app.methodology_exercise_feedback mef 
         ON mep.methodology_session_id = mef.methodology_session_id 
         AND mep.exercise_order = mef.exercise_order
       WHERE mep.methodology_session_id = $1
       ORDER BY mep.exercise_order ASC`,
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

// POST /api/routines/confirm-plan
// Confirma una rutina cambiando su estado de 'draft' a 'active'
router.post('/confirm-plan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, routine_plan_id } = req.body;

    if (!methodology_plan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'methodology_plan_id es requerido' 
      });
    }

    // Verificar que el plan pertenece al usuario y está en estado draft
    const planCheck = await client.query(
      `SELECT id, status, methodology_type, plan_data 
       FROM app.methodology_plans 
       WHERE id = $1 AND user_id = $2`,
      [methodology_plan_id, userId]
    );

    if (planCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Plan no encontrado' 
      });
    }

    const plan = planCheck.rows[0];

    // Usar la función de la base de datos para confirmar
    const confirmResult = await client.query(
      'SELECT app.confirm_routine_plan($1, $2, $3) as confirmed',
      [userId, methodology_plan_id, routine_plan_id || null]
    );

    const confirmed = confirmResult.rows[0]?.confirmed;

    if (!confirmed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'No se pudo confirmar el plan. Puede que ya esté confirmado o no esté en estado draft.' 
      });
    }

    // Asegurar que las sesiones metodológicas estén creadas
    try {
      await client.query(
        'SELECT app.create_methodology_exercise_sessions($1, $2, $3::jsonb)',
        [userId, methodology_plan_id, JSON.stringify(plan.plan_data)]
      );
      console.log('✅ Sesiones metodológicas creadas tras confirmación');
    } catch (sessionError) {
      console.warn('⚠️ Error creando sesiones tras confirmación:', sessionError.message);
      // No fallar la confirmación por esto, las sesiones se pueden crear después
    }

    await client.query('COMMIT');

    console.log(`✅ Rutina confirmada: methodology_plan(${methodology_plan_id}) routine_plan(${routine_plan_id || 'N/A'})`);

    res.json({
      success: true,
      message: 'Rutina confirmada exitosamente',
      confirmed_at: new Date().toISOString(),
      methodology_plan_id: methodology_plan_id,
      routine_plan_id: routine_plan_id,
      status: 'active'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirmando rutina:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// GET /api/routines/progress-data
// Obtiene datos de progreso histórico para el ProgressTab
router.get('/progress-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id } = req.query;

    if (!methodology_plan_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'methodology_plan_id es requerido' 
      });
    }

    // Obtener información del plan
    const planQuery = await pool.query(
      'SELECT methodology_type, plan_data FROM app.methodology_plans WHERE id = $1 AND user_id = $2',
      [methodology_plan_id, userId]
    );

    if (planQuery.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Plan de metodología no encontrado' 
      });
    }

    const plan = planQuery.rows[0];
    const planData = typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data;

    // Obtener resumen general de progreso (CORRECCIÓN: usar tabla de progreso actual)
    const generalStatsQuery = await pool.query(
      `SELECT 
         COUNT(DISTINCT mep.methodology_session_id) as total_sessions_completed,
         COUNT(*) as total_exercises_completed,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_completed,
         SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) as total_time_seconds,
         MIN(mes.started_at) as first_session_date,
         MAX(mes.completed_at) as last_session_date
       FROM app.methodology_exercise_progress mep
       JOIN app.methodology_exercise_sessions mes ON mes.id = mep.methodology_session_id
       WHERE mep.user_id = $1 AND mes.methodology_plan_id = $2`,
      [userId, methodology_plan_id]
    );

    // Obtener progreso por semanas (CORRECCIÓN: usar tabla de progreso actual)
    const weeklyProgressQuery = await pool.query(
      `SELECT 
         mes.week_number,
         COUNT(DISTINCT mep.methodology_session_id) as sessions_completed,
         COUNT(*) as exercises_completed,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as series_completed,
         SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) as time_spent_seconds
       FROM app.methodology_exercise_progress mep
       JOIN app.methodology_exercise_sessions mes ON mes.id = mep.methodology_session_id
       WHERE mep.user_id = $1 AND mes.methodology_plan_id = $2
       GROUP BY mes.week_number
       ORDER BY mes.week_number ASC`,
      [userId, methodology_plan_id]
    );

    // Obtener actividad reciente (CORRECCIÓN: usar tabla de progreso actual)
    const recentActivityQuery = await pool.query(
      `SELECT DISTINCT
         mep.methodology_session_id,
         mes.started_at as session_date,
         mes.week_number,
         mes.day_name,
         COUNT(*) as exercises_count,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series,
         SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) as session_duration_seconds
       FROM app.methodology_exercise_progress mep
       JOIN app.methodology_exercise_sessions mes ON mes.id = mep.methodology_session_id
       WHERE mep.user_id = $1 AND mes.methodology_plan_id = $2
       GROUP BY mep.methodology_session_id, mes.started_at, mes.week_number, mes.day_name
       ORDER BY mes.started_at DESC, mep.methodology_session_id DESC
       LIMIT 10`,
      [userId, methodology_plan_id]
    );

    // Calcular totales del plan (desde el JSON)
    const totalWeeks = planData?.semanas?.length || 0;
    const totalSessionsInPlan = planData?.semanas?.reduce((acc, semana) => 
      acc + (semana.sesiones?.length || 0), 0) || 0;
    const totalExercisesInPlan = planData?.semanas?.reduce((acc, semana) => 
      acc + semana.sesiones?.reduce((sessAcc, sesion) => 
        sessAcc + (sesion.ejercicios?.length || 0), 0) || 0, 0) || 0;

    // Construir respuesta
    const generalStats = generalStatsQuery.rows[0];
    const weeklyProgress = weeklyProgressQuery.rows;
    const recentActivity = recentActivityQuery.rows;

    // Calcular semana actual (basado en sesiones completadas)
    const currentWeek = Math.max(1, ...weeklyProgress.map(w => w.week_number), 1);

    // Construir progreso por semanas con datos reales
    const weeklyProgressData = [];
    for (let week = 1; week <= totalWeeks; week++) {
      const weekData = weeklyProgress.find(w => w.week_number === week);
      const weekSessions = planData?.semanas?.find(s => s.semana === week)?.sesiones?.length || 0;
      const weekExercises = planData?.semanas?.find(s => s.semana === week)?.sesiones?.reduce(
        (acc, ses) => acc + (ses.ejercicios?.length || 0), 0) || 0;

      weeklyProgressData.push({
        week,
        sessions: weekSessions,
        completed: weekData?.sessions_completed || 0,
        exercises: weekExercises,
        exercisesCompleted: weekData?.exercises_completed || 0,
        seriesCompleted: weekData?.series_completed || 0,
        timeSpentSeconds: weekData?.time_spent_seconds || 0
      });
    }

    const responseData = {
      totalWeeks,
      currentWeek,
      totalSessions: totalSessionsInPlan,
      completedSessions: parseInt(generalStats.total_sessions_completed) || 0,
      totalExercises: totalExercisesInPlan,
      completedExercises: parseInt(generalStats.total_exercises_completed) || 0,
      totalSeriesCompleted: parseInt(generalStats.total_series_completed) || 0,
      totalTimeSpentSeconds: parseInt(generalStats.total_time_seconds) || 0,
      firstSessionDate: generalStats.first_session_date,
      lastSessionDate: generalStats.last_session_date,
      weeklyProgress: weeklyProgressData,
      recentActivity: recentActivity.map(activity => ({
        sessionId: activity.methodology_session_id,
        date: activity.session_date,
        weekNumber: activity.week_number,
        dayName: activity.day_name,
        exercisesCount: parseInt(activity.exercises_count),
        totalSeries: parseInt(activity.total_series),
        durationSeconds: parseInt(activity.session_duration_seconds) || 0,
        formattedDate: new Date(activity.session_date).toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }))
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Error obteniendo datos de progreso:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// POST /api/routines/sessions/:sessionId/exercise/:exerciseOrder/feedback
// Guardar feedback del usuario sobre un ejercicio específico
router.post('/sessions/:sessionId/exercise/:exerciseOrder/feedback', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { sessionId, exerciseOrder } = req.params;
    const { sentiment, comment, exerciseName } = req.body;

    // Validar parámetros
    if (!sentiment || !['like', 'dislike', 'hard'].includes(sentiment)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'sentiment es requerido y debe ser: like, dislike, hard'
      });
    }

    // Verificar que la sesión pertenece al usuario
    const sessionCheck = await client.query(
      'SELECT id FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Sesión no encontrada' 
      });
    }

    // Insertar o actualizar feedback (usando UPSERT)
    const upsertResult = await client.query(
      `INSERT INTO app.methodology_exercise_feedback (
        methodology_session_id, user_id, exercise_name, exercise_order, sentiment, comment, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (methodology_session_id, exercise_order) 
      DO UPDATE SET 
        sentiment = EXCLUDED.sentiment,
        comment = EXCLUDED.comment,
        updated_at = NOW()
      RETURNING id, sentiment, comment`,
      [sessionId, userId, exerciseName, parseInt(exerciseOrder), sentiment, comment || null]
    );

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      feedback: upsertResult.rows[0],
      message: 'Feedback guardado correctamente' 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error guardando feedback de ejercicio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  } finally {
    client.release();
  }
});

// GET /api/routines/plan-status/:methodologyPlanId
// Verificar si un plan de metodología ya está confirmado (activo)
router.get('/plan-status/:methodologyPlanId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodologyPlanId } = req.params;

    // Verificar el estado del plan de metodología
    const planQuery = await pool.query(
      'SELECT status, confirmed_at FROM app.methodology_plans WHERE id = $1 AND user_id = $2',
      [methodologyPlanId, userId]
    );

    if (planQuery.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Plan no encontrado' 
      });
    }

    const plan = planQuery.rows[0];
    const isConfirmed = plan.status === 'active';

    res.json({ 
      success: true, 
      isConfirmed,
      status: plan.status,
      confirmedAt: plan.confirmed_at
    });

  } catch (error) {
    console.error('Error verificando estado del plan:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// GET /api/routines/sessions/:sessionId/feedback
// Obtener todo el feedback de una sesión
router.get('/sessions/:sessionId/feedback', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;

    // Verificar que la sesión pertenece al usuario
    const sessionCheck = await pool.query(
      'SELECT id FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Sesión no encontrada' 
      });
    }

    // Obtener feedback de todos los ejercicios de la sesión
    const feedbackQuery = await pool.query(
      `SELECT 
        exercise_order,
        exercise_name,
        sentiment,
        comment,
        created_at,
        updated_at
       FROM app.methodology_exercise_feedback
       WHERE methodology_session_id = $1
       ORDER BY exercise_order ASC`,
      [sessionId]
    );

    res.json({ 
      success: true, 
      feedback: feedbackQuery.rows 
    });

  } catch (error) {
    console.error('Error obteniendo feedback de sesión:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// GET /api/routines/active-plan  
// Obtiene la rutina activa del usuario para restaurar después del login
// SOLUCIÓN HÍBRIDA: Busca en methodology_plans activos, con fallback a routine_plans
router.get('/active-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // ESTRATEGIA 1: Buscar plan de metodología activo (ideal)
    const activeMethodologyQuery = await pool.query(
      `SELECT mp.id as methodology_plan_id, mp.methodology_type, mp.plan_data, mp.confirmed_at,
              rp.id as routine_plan_id, 'methodology' as source
       FROM app.methodology_plans mp
       LEFT JOIN app.routine_plans rp ON rp.user_id = mp.user_id 
         AND rp.methodology_type = mp.methodology_type
         AND rp.status = 'active'
       WHERE mp.user_id = $1 AND mp.status = 'active'
       ORDER BY mp.confirmed_at DESC
       LIMIT 1`,
      [userId]
    );

    // ESTRATEGIA 2: Si no hay methodology activo, buscar routine_plans activos (fallback)
    let activePlan = null;
    let planSource = 'methodology';
    
    if (activeMethodologyQuery.rowCount > 0) {
      activePlan = activeMethodologyQuery.rows[0];
    } else {
      console.log(`⚠️ No methodology_plans activos para user ${userId}, buscando en routine_plans...`);
      
      const activeRoutineQuery = await pool.query(
        `SELECT rp.id as routine_plan_id, rp.methodology_type, rp.plan_data, 
                rp.confirmed_at, rp.id as methodology_plan_id, 'routine_fallback' as source
         FROM app.routine_plans rp
         WHERE rp.user_id = $1 AND rp.status = 'active' AND rp.is_active = true
         ORDER BY rp.confirmed_at DESC
         LIMIT 1`,
        [userId]
      );
      
      if (activeRoutineQuery.rowCount > 0) {
        activePlan = activeRoutineQuery.rows[0];
        planSource = 'routine_fallback';
        console.log(`✅ Encontrado plan activo en routine_plans ID ${activePlan.routine_plan_id}`);
      }
    }

    if (!activePlan) {
      return res.json({ 
        success: true, 
        hasActivePlan: false,
        message: 'No hay rutina activa' 
      });
    }

    const planData = typeof activePlan.plan_data === 'string' 
      ? JSON.parse(activePlan.plan_data) 
      : activePlan.plan_data;

    console.log(`✅ Recuperando plan activo desde ${planSource} para user ${userId}`);

    res.json({
      success: true,
      hasActivePlan: true,
      routinePlan: planData,
      planSource: { label: planSource === 'routine_fallback' ? 'Recuperado' : 'IA' },
      planId: activePlan.routine_plan_id,
      methodology_plan_id: activePlan.methodology_plan_id,
      planType: activePlan.methodology_type,
      confirmedAt: activePlan.confirmed_at,
      recoverySource: planSource  // Para debugging
    });

  } catch (error) {
    console.error('Error obteniendo rutina activa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// POST /api/routines/confirm-and-activate
// NUEVO ENDPOINT UNIFICADO: Confirma plan y lo deja listo para usar
router.post('/confirm-and-activate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🚀 FLUJO UNIFICADO: confirm-and-activate iniciado');
    await client.query('BEGIN');
    
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, plan_data } = req.body;
    
    if (!methodology_plan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'methodology_plan_id es requerido' 
      });
    }
    
    console.log(`📋 Confirmando y activando plan ${methodology_plan_id} para user ${userId}`);
    
    // 1. VERIFICAR que el plan existe y pertenece al usuario
    const planCheck = await client.query(
      `SELECT id, status, methodology_type, plan_data 
       FROM app.methodology_plans 
       WHERE id = $1 AND user_id = $2`,
      [methodology_plan_id, userId]
    );
    
    if (planCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Plan no encontrado' 
      });
    }
    
    const plan = planCheck.rows[0];
    const finalPlanData = plan_data || plan.plan_data;
    
    // 2. CANCELAR planes activos anteriores para evitar conflictos
    console.log('🧹 Cancelando planes anteriores...');
    await client.query(
      `UPDATE app.methodology_plans 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE user_id = $1 AND status = 'active' AND id != $2`,
      [userId, methodology_plan_id]
    );
    
    await client.query(
      `UPDATE app.routine_plans 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    
    // 3. ACTIVAR el plan de metodología
    console.log('✅ Activando methodology_plan...');
    await client.query(
      `UPDATE app.methodology_plans 
       SET status = 'active', confirmed_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [methodology_plan_id, userId]
    );
    
    // 4. CREAR routine_plan correspondiente
    console.log('✅ Creando routine_plan...');
    const routinePlanResult = await client.query(
      `INSERT INTO app.routine_plans (
        user_id, methodology_type, plan_data, status, is_active,
        confirmed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'active', true, NOW(), NOW(), NOW())
       RETURNING id`,
      [userId, plan.methodology_type, finalPlanData]
    );
    
    const routinePlanId = routinePlanResult.rows[0].id;
    console.log(`✅ routine_plan creado con ID ${routinePlanId}`);
    
    // 5. GENERAR sesiones de entrenamiento automáticamente
    console.log('🏋️ Generando sesiones de entrenamiento...');
    await ensureMethodologySessions(client, userId, methodology_plan_id, finalPlanData);
    
    await client.query('COMMIT');
    
    console.log('🎯 FLUJO UNIFICADO COMPLETADO exitosamente');
    
    // 6. RETORNAR todo listo para usar
    res.json({
      success: true,
      message: '¡Tu rutina está lista!',
      data: {
        methodology_plan_id: methodology_plan_id,
        routine_plan_id: routinePlanId,
        methodology_type: plan.methodology_type,
        plan_data: finalPlanData,
        status: 'active',
        ready_for_training: true
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en confirm-and-activate:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// POST /api/routines/cancel-routine
// Cancela una rutina activa cambiando su estado de 'active' a 'cancelled'
router.post('/cancel-routine', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, routine_plan_id } = req.body;

    if (!methodology_plan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'methodology_plan_id es requerido' 
      });
    }

    console.log('🚫 Cancelando rutina:', { methodology_plan_id, routine_plan_id, userId });

    // Verificar que el plan pertenece al usuario y está activo
    const planCheck = await client.query(
      `SELECT id, status, methodology_type 
       FROM app.methodology_plans 
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [methodology_plan_id, userId]
    );

    if (planCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Plan no encontrado o ya está cancelado' 
      });
    }

    // Actualizar estado del plan de metodología a 'cancelled'
    const methodologyUpdate = await client.query(
      `UPDATE app.methodology_plans 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING methodology_type`,
      [methodology_plan_id, userId]
    );

    // MEJORA: Buscar automáticamente routine_plans asociados para cancelar
    // Esto previene inconsistencias si el frontend no envía routine_plan_id
    const routineUpdateQuery = `
      UPDATE app.routine_plans 
      SET status = 'cancelled', updated_at = NOW() 
      WHERE user_id = $1 AND status = 'active'
        AND (id = $2 OR methodology_type = $3)
      RETURNING id`;
    
    const routineUpdate = await client.query(
      routineUpdateQuery,
      [userId, routine_plan_id || -1, methodologyUpdate.rows[0]?.methodology_type]
    );
    
    console.log(`✅ Cancelados: methodology_plan ${methodology_plan_id}, routine_plans [${routineUpdate.rows.map(r => r.id).join(', ')}]`);

    // También cancelar las sesiones activas/pendientes
    await client.query(
      `UPDATE app.methodology_exercise_sessions 
       SET session_status = 'cancelled', updated_at = NOW() 
       WHERE methodology_plan_id = $1 AND user_id = $2 
         AND session_status IN ('active', 'pending', 'in_progress')`,
      [methodology_plan_id, userId]
    );

    await client.query('COMMIT');

    console.log('✅ Rutina cancelada exitosamente');
    res.json({ 
      success: true, 
      message: 'Rutina cancelada correctamente' 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error cancelando rutina:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  } finally {
    client.release();
  }
});

// GET /api/routines/historical-data
// Obtiene datos históricos completos del usuario (todas las rutinas completadas)
router.get('/historical-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Obtener estadísticas generales históricas (todas las rutinas del usuario)
    const totalStatsQuery = await pool.query(
      `SELECT 
         COUNT(DISTINCT mp.id) as total_routines_completed,
         COUNT(DISTINCT mes.id) as total_sessions_ever,
         COUNT(DISTINCT mep.id) as total_exercises_ever,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_ever,
         SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) as total_time_spent_ever,
         MIN(mes.started_at) as first_workout_date,
         MAX(mes.completed_at) as last_workout_date
       FROM app.methodology_plans mp
       LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       WHERE mp.user_id = $1 AND mp.status = 'active'`,
      [userId]
    );

    // Obtener historial de rutinas completadas
    const routineHistoryQuery = await pool.query(
      `SELECT 
         mp.id as routine_id,
         mp.methodology_type,
         mp.confirmed_at as completed_at,
         COUNT(DISTINCT mes.id) as sessions,
         COUNT(DISTINCT mep.id) as exercises,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as series,
         SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) as time_spent
       FROM app.methodology_plans mp
       LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       WHERE mp.user_id = $1 AND mp.status = 'active'
       GROUP BY mp.id, mp.methodology_type, mp.confirmed_at
       HAVING mp.confirmed_at IS NOT NULL
       ORDER BY mp.confirmed_at DESC`,
      [userId]
    );

    // Obtener estadísticas mensuales
    const monthlyStatsQuery = await pool.query(
      `SELECT 
         TO_CHAR(mes.started_at, 'YYYY-MM') as month_key,
         TO_CHAR(mes.started_at, 'Month YYYY') as month_label,
         COUNT(DISTINCT mes.id) as sessions,
         COUNT(DISTINCT mep.id) as exercises,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as series
       FROM app.methodology_exercise_sessions mes
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       JOIN app.methodology_plans mp ON mp.id = mes.methodology_plan_id
       WHERE mp.user_id = $1 AND mes.started_at IS NOT NULL
       GROUP BY TO_CHAR(mes.started_at, 'YYYY-MM'), TO_CHAR(mes.started_at, 'Month YYYY'), mes.started_at
       ORDER BY TO_CHAR(mes.started_at, 'YYYY-MM') DESC
       LIMIT 12`,
      [userId]
    );

    const totalStats = totalStatsQuery.rows[0] || {};
    const routineHistory = routineHistoryQuery.rows || [];
    const monthlyStats = monthlyStatsQuery.rows || [];

    // Formatear respuesta
    const responseData = {
      totalRoutinesCompleted: parseInt(totalStats.total_routines_completed) || 0,
      totalSessionsEver: parseInt(totalStats.total_sessions_ever) || 0,
      totalExercisesEver: parseInt(totalStats.total_exercises_ever) || 0,
      totalSeriesEver: parseInt(totalStats.total_series_ever) || 0,
      totalTimeSpentEver: parseInt(totalStats.total_time_spent_ever) || 0,
      firstWorkoutDate: totalStats.first_workout_date,
      lastWorkoutDate: totalStats.last_workout_date,
      routineHistory: routineHistory.map(routine => ({
        id: routine.routine_id,
        methodologyType: routine.methodology_type,
        completedAt: routine.completed_at,
        sessions: parseInt(routine.sessions) || 0,
        exercises: parseInt(routine.exercises) || 0,
        series: parseInt(routine.series) || 0,
        timeSpent: parseInt(routine.time_spent) || 0
      })),
      monthlyStats: monthlyStats.map(month => ({
        month: month.month_label?.trim(),
        sessions: parseInt(month.sessions) || 0,
        exercises: parseInt(month.exercises) || 0,
        series: parseInt(month.series) || 0
      }))
    };

    console.log('✅ Datos históricos obtenidos:', {
      totalRoutines: responseData.totalRoutinesCompleted,
      totalSessions: responseData.totalSessionsEver,
      totalExercises: responseData.totalExercisesEver
    });

    res.json({ success: true, data: responseData });

  } catch (error) {
    console.error('❌ Error obteniendo datos históricos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Endpoint para obtener ejercicios pendientes de días anteriores
router.get('/pending-exercises', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id } = req.query;

    if (!methodology_plan_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'methodology_plan_id es requerido' 
      });
    }

    console.log('🔍 Buscando ejercicios pendientes para:', { userId, methodology_plan_id });

    // Buscar sesiones con ejercicios pendientes o saltados de los últimos 7 días
    const pendingQuery = await pool.query(`
      SELECT 
        mes.id as session_id,
        mes.day_name,
        mes.week_number,
        mes.started_at,
        COUNT(mep.id) as total_exercises,
        SUM(CASE WHEN mep.status = 'pending' THEN 1 ELSE 0 END) as pending_exercises,
        SUM(CASE WHEN mep.status = 'skipped' THEN 1 ELSE 0 END) as skipped_exercises,
        array_agg(
          json_build_object(
            'exercise_order', mep.exercise_order,
            'exercise_name', mep.exercise_name,
            'status', mep.status,
            'series_total', mep.series_total,
            'repeticiones', mep.repeticiones,
            'descanso_seg', mep.descanso_seg,
            'intensidad', mep.intensidad,
            'tempo', mep.tempo,
            'notas', mep.notas
          ) ORDER BY mep.exercise_order
        ) as exercises
      FROM app.methodology_exercise_sessions mes
      LEFT JOIN app.methodology_exercise_progress mep ON mes.id = mep.methodology_session_id
      WHERE mes.user_id = $1 
        AND mes.methodology_plan_id = $2
        AND mes.started_at IS NOT NULL
        AND mes.started_at >= NOW() - INTERVAL '7 days'
        AND mes.started_at < CURRENT_DATE
      GROUP BY mes.id, mes.day_name, mes.week_number, mes.started_at
      HAVING SUM(CASE WHEN mep.status IN ('pending', 'skipped') THEN 1 ELSE 0 END) > 0
      ORDER BY mes.started_at DESC
      LIMIT 1
    `, [userId, methodology_plan_id]);

    if (pendingQuery.rowCount === 0) {
      console.log('✅ No se encontraron ejercicios pendientes');
      return res.json({ 
        success: true, 
        hasPendingExercises: false 
      });
    }

    const pendingData = pendingQuery.rows[0];
    
    // Calcular total de ejercicios pendientes
    const totalPendingCount = parseInt(pendingData.pending_exercises) + parseInt(pendingData.skipped_exercises);

    console.log('📋 Ejercicios pendientes encontrados:', {
      sessionId: pendingData.session_id,
      dayName: pendingData.day_name,
      totalPending: totalPendingCount,
      pending: pendingData.pending_exercises,
      skipped: pendingData.skipped_exercises
    });

    const responseData = {
      success: true,
      hasPendingExercises: true,
      sessionId: pendingData.session_id,
      pendingDay: pendingData.day_name,
      weekNumber: pendingData.week_number,
      totalPending: totalPendingCount,
      exercises: pendingData.exercises || []
    };

    console.log('✅ Datos de ejercicios pendientes preparados');
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error obteniendo ejercicios pendientes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

export default router;

