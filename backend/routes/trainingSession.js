/**
 * TRAINING SESSION MANAGEMENT SYSTEM
 * Archivo consolidado para gestión unificada de sesiones de entrenamiento
 *
 * Integra funcionalidad de:
 * - Rutinas de metodología (calistenia, hipertrofia, etc.)
 * - Entrenamiento en casa (home training)
 * - Gestión de progreso y estadísticas
 *
 * Compatible con WorkoutContext del frontend
 */

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';
import { finalizePlanIfCompleted } from '../services/methodologyPlansService.js';
import { calculateSessionStatus } from '../services/sessionStatusService.js';

const router = express.Router();

// ===============================================
// UTILIDADES Y HELPERS
// ===============================================

/**
 * Normalizar nombres de días a abreviaturas válidas
 */
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
  return map[lower] || dayName;
}

/**
 * Helper para buscar una semana en el array de semanas del plan
 * Funciona con TODAS las metodologías (Calistenia, Heavy Duty, etc.)
 * Soporta diferentes formatos: semana, numero, week, week_number
 * @param {Array} semanas - Array de semanas del plan
 * @param {Number} weekNumber - Número de semana a buscar
 * @returns {Object|undefined} - Semana encontrada o undefined
 */
function findWeekInPlan(semanas, weekNumber) {
  if (!Array.isArray(semanas) || !weekNumber) return undefined;

  const targetWeek = Number(weekNumber);
  if (isNaN(targetWeek)) return undefined;

  return semanas.find(s => {
    // Intentar múltiples campos para máxima compatibilidad
    const weekValue = s.semana || s.numero || s.week || s.week_number;
    return Number(weekValue) === targetWeek;
  });
}

/**
 * Normalizar días en estructura de plan
 */
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

/**
 * 🎯 FASE 3: Función DESHABILITADA - Las sesiones se crean bajo demanda
 * Esta función llamaba al stored procedure create_methodology_exercise_sessions
 * que ha sido reemplazado por ensureWorkoutSchedule() + creación bajo demanda
 */
async function ensureMethodologySessions(client, userId, methodologyPlanId, planDataJson) {
  console.log(`📋 [ensureMethodologySessions] DESHABILITADA (FASE 3) - sesiones se crean bajo demanda`);
  // Las sesiones en methodology_exercise_sessions se crean cuando el usuario
  // inicia un entrenamiento (endpoint /sessions/start)
  return;
}

/**
 * Crear sesión para día faltante usando template
 */
async function createMissingDaySession(client, userId, methodologyPlanId, planDataJson, requestedDay, weekNumber = 1) {
  const normalizedPlan = normalizePlanDays(planDataJson);
  const normalizedRequestedDay = normalizeDayAbbrev(requestedDay);

  const existingSession = await client.query(
    'SELECT id FROM app.methodology_exercise_sessions WHERE user_id = $1 AND methodology_plan_id = $2 AND week_number = $3 AND day_name = $4',
    [userId, methodologyPlanId, weekNumber, normalizedRequestedDay]
  );

  if (existingSession.rowCount > 0) {
    return existingSession.rows[0].id;
  }

  const semanas = normalizedPlan?.semanas || [];
  const firstWeek = findWeekInPlan(semanas, weekNumber) || semanas[0];
  const sesiones = firstWeek?.sesiones || [];

  if (sesiones.length === 0) {
    throw new Error('No hay sesiones disponibles en el plan para crear una sesión de reemplazo');
  }

  const templateSession = sesiones[0];
  const realMethodology = planDataJson?.selected_style || planDataJson?.metodologia || 'Adaptada';

  const newSession = await client.query(
    `INSERT INTO app.methodology_exercise_sessions
     (user_id, methodology_plan_id, methodology_type, session_name, week_number, day_name, total_exercises, session_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamp, NOW()), NOW(), NOW())
     RETURNING id`,
    [
      userId,
      methodologyPlanId,
      realMethodology,
      `Sesión ${normalizedRequestedDay}`,
      weekNumber,
      normalizedRequestedDay,
      templateSession.ejercicios?.length || 0,
      planDataJson?.planStartDate ? new Date(planDataJson.planStartDate) : null
    ]
  );

  console.log(`✅ Sesión creada para día faltante: ${normalizedRequestedDay}`);
  return newSession.rows[0].id;
}

// ===============================================
// SESIÓN GENERAL - INICIO Y CONFIGURACIÓN
// ===============================================

/**
 * POST /api/training-session/start/methodology
 * Iniciar sesión de metodología (calistenia, hipertrofia, etc.)
 */
router.post('/start/methodology', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, week_number, day_name } = req.body;

    if (!methodology_plan_id || !week_number || !day_name) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros: methodology_plan_id, week_number, day_name'
      });
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
      // Intentar crear sesión para día faltante
      console.log(`⚠️ Sesión no encontrada para ${normalizedDay}, creando sesión adaptada...`);
      try {
        const sessionId = await createMissingDaySession(client, userId, methodology_plan_id, planData, day_name, week_number);
        ses = await client.query(
          `SELECT * FROM app.methodology_exercise_sessions WHERE id = $1`,
          [sessionId]
        );
      } catch (createError) {
        console.error('Error creando sesión para día faltante:', createError);
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Sesión no encontrada para esa semana/día'
        });
      }
    }

    const session = ses.rows[0];

    // Precrear progreso por ejercicio
    const semana = findWeekInPlan(planData.semanas || [], week_number);
    let sesionDef = semana ? (semana.sesiones || []).find(s => normalizeDayAbbrev(s.dia) === normalizedDay) : null;

    if (!sesionDef && semana && semana.sesiones && semana.sesiones.length > 0) {
      sesionDef = semana.sesiones[0];
      console.log(`📋 Usando template de ${sesionDef.dia} para día faltante ${normalizedDay}`);
    }

    const ejercicios = Array.isArray(sesionDef?.ejercicios) ? sesionDef.ejercicios : [];

    for (let i = 0; i < ejercicios.length; i++) {
      const ej = ejercicios[i] || {};
      const order = i;

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
         String(ej.series || '3'), String(ej.repeticiones || '0'), Number(ej.descanso_seg) || 60,
         ej.intensidad || null, ej.tempo || null, ej.notas || null]
      );
    }

    // Marcar sesión iniciada
    await client.query(
      `UPDATE app.methodology_exercise_sessions
       SET session_status = 'in_progress',
           started_at = COALESCE(started_at, NOW()),
           session_date = COALESCE(session_date, CURRENT_DATE),
           total_exercises = $2
       WHERE id = $1`,
      [session.id, ejercicios.length]
    );

    console.log(`✅ Sesión marcada como iniciada - ID: ${session.id}`);

    await client.query('COMMIT');

    res.json({
      success: true,
      session_id: session.id,
      total_exercises: ejercicios.length,
      session_type: 'methodology'
    });

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error starting methodology session:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/training-session/start/home
 * Iniciar sesión de entrenamiento en casa
 */
router.post('/start/home', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { home_training_plan_id } = req.body;
    const user_id = req.user.userId || req.user.id;

    // Verificar que el plan pertenece al usuario
    const planResult = await client.query(
      'SELECT * FROM app.home_training_plans WHERE id = $1 AND user_id = $2',
      [home_training_plan_id, user_id]
    );

    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Plan de entrenamiento no encontrado'
      });
    }

    const plan = planResult.rows[0];
    const exercises = plan.plan_data.plan_entrenamiento?.ejercicios || [];

    // Crear nueva sesión
    const sessionResult = await client.query(
      `INSERT INTO app.home_training_sessions
       (user_id, home_training_plan_id, total_exercises, session_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, home_training_plan_id, exercises.length, JSON.stringify({ exercises })]
    );

    const session = sessionResult.rows[0];
    const sessionId = session.id;

    // Crear registros de progreso para cada ejercicio
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i] || {};
      const totalSeries = Number(ex.series ?? ex.total_series ?? ex.totalSeries) || 4;

      await client.query(
        `INSERT INTO app.home_exercise_progress
         (home_training_session_id, exercise_order, exercise_name, total_series,
          series_completed, status, duration_seconds, started_at, exercise_data)
         VALUES ($1, $2, $3, $4, 0, 'pending', NULL, NOW(), $5)`,
        [sessionId, i, ex.nombre, totalSeries, JSON.stringify(ex)]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      session,
      session_type: 'home'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error starting home training session:', err);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar la sesión de entrenamiento'
    });
  } finally {
    client.release();
  }
});

// ===============================================
// PROGRESO DE EJERCICIOS
// ===============================================

/**
 * PUT /api/training-session/progress/methodology/:sessionId/:exerciseOrder
 * Actualizar progreso de ejercicio en metodología
 */
router.put('/progress/methodology/:sessionId/:exerciseOrder', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { sessionId, exerciseOrder} = req.params;
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

    const sessionType = ses.rows[0].session_type;
    const isWeekendExtra = sessionType === 'weekend-extra';

    console.log(`📝 Actualizando ejercicio orden ${exerciseOrder} | Sesión ${sessionId} | Tipo: ${sessionType} | Weekend: ${isWeekendExtra}`);

    // 🎯 Para sesiones de fin de semana, usar exercise_session_tracking
    if (isWeekendExtra) {
      // Buscar ejercicio en exercise_session_tracking
      const trackingSel = await client.query(
        `SELECT * FROM app.exercise_session_tracking
         WHERE methodology_session_id = $1 AND exercise_order = $2`,
        [sessionId, exerciseOrder]
      );

      if (trackingSel.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Ejercicio no encontrado en tracking' });
      }

      // Actualizar exercise_session_tracking
      const finalSeriesCompleted = (status === 'skipped' || status === 'cancelled') ? 0 : (series_completed ?? 0);

      const upd = await client.query(
        `UPDATE app.exercise_session_tracking
         SET actual_sets = $1::int,
             status = $2::varchar,
             actual_duration_seconds = COALESCE($3::int, actual_duration_seconds),
             completed_at = CASE WHEN $2::varchar = 'completed' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE methodology_session_id = $4 AND exercise_order = $5
         RETURNING *`,
        [finalSeriesCompleted, status, time_spent_seconds ?? null, sessionId, exerciseOrder]
      );

      // Contar ejercicios por estado
      const counters = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
           COUNT(*) AS total
         FROM app.exercise_session_tracking
         WHERE methodology_session_id = $1`,
        [sessionId]
      );

      const { completed, skipped, cancelled, total } = counters.rows[0];

      // Actualizar sesión
      await client.query(
        `UPDATE app.methodology_exercise_sessions
         SET exercises_completed = $2::int,
             exercises_skipped = $3::int,
             exercises_cancelled = $4::int,
             total_exercises = $5::int,
             session_status = CASE WHEN ($2::int + $3::int + $4::int) = $5::int AND $5::int > 0 THEN 'completed' ELSE 'in_progress' END,
             completed_at = CASE WHEN ($2::int + $3::int + $4::int) = $5::int AND $5::int > 0 THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId, Number(completed), Number(skipped), Number(cancelled), Number(total)]
      );

      await client.query('COMMIT');

      console.log(`✅ Ejercicio de fin de semana actualizado: ${status} | Completados: ${completed}/${total}`);

      return res.json({
        success: true,
        exercise: upd.rows[0],
        progress: {
          completed: Number(completed),
          skipped: Number(skipped),
          cancelled: Number(cancelled),
          total: Number(total)
        }
      });
    }

    // 🎯 Para sesiones normales, usar methodology_exercise_progress
    // Asegurar fila de progreso existente
    const progSel = await client.query(
      `SELECT * FROM app.methodology_exercise_progress
       WHERE methodology_session_id = $1 AND exercise_order = $2`,
      [sessionId, exerciseOrder]
    );

    if (progSel.rowCount === 0) {
      // Crear fila mínima si faltase
      await client.query(
        `INSERT INTO app.methodology_exercise_progress (
           methodology_session_id, user_id, exercise_order, exercise_name,
           series_total, repeticiones, descanso_seg, series_completed, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'pending')`,
        [sessionId, userId, exerciseOrder, 'Ejercicio', 3, '—', 60]
      );
    }

    // Actualizar progreso
    const finalSeriesCompleted = (status === 'skipped' || status === 'cancelled') ? 0 : (series_completed ?? 0);

    const upd = await client.query(
      `UPDATE app.methodology_exercise_progress
       SET series_completed = $1::int,
           status = $2::varchar(20),
           time_spent_seconds = COALESCE($3, time_spent_seconds),
           completed_at = CASE WHEN $2::varchar(20) = 'completed' THEN NOW() ELSE completed_at END
       WHERE methodology_session_id = $4 AND exercise_order = $5
       RETURNING *`,
      [finalSeriesCompleted, status, time_spent_seconds ?? null, sessionId, exerciseOrder]
    );

    // Actualizar contadores de sesión
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

    res.json({
      success: true,
      exercise: upd.rows[0],
      progress: {
        completed: Number(completed),
        total: Number(total)
      }
    });

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating methodology exercise:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/training-session/progress/home/:sessionId/:exerciseOrder
 * Actualizar progreso de ejercicio en entrenamiento en casa
 */
router.put('/progress/home/:sessionId/:exerciseOrder', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { sessionId, exerciseOrder } = req.params;
    const { series_completed, duration_seconds, status } = req.body;
    const user_id = req.user.userId || req.user.id;

    console.log(`🔍 PUT /progress/home/${sessionId}/${exerciseOrder} - Usuario: ${user_id}`);
    console.log(`📦 Body:`, { series_completed, duration_seconds, status });

    // Verificar que la sesión pertenece al usuario
    const sessionResult = await client.query(
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }

    // Determinar si es una actualización de solo duración
    const isDurationOnlyUpdate = !series_completed && !status && duration_seconds;

    let updateSql, updateParams;

    if (isDurationOnlyUpdate) {
      // Solo actualizar duración sin cambiar status ni series
      console.log(`⏰ Actualizando solo duración para ejercicio ${exerciseOrder}: ${duration_seconds}s`);
      updateSql = `
        UPDATE app.home_exercise_progress
        SET duration_seconds = $1
        WHERE home_training_session_id = $2
          AND exercise_order = $3
        RETURNING *;
      `;
      updateParams = [duration_seconds, sessionId, exerciseOrder];
    } else {
      // Actualización completa
      console.log(`📊 Actualizando progreso completo para ejercicio ${exerciseOrder}: ${series_completed} series, ${status}`);
      updateSql = `
        UPDATE app.home_exercise_progress
        SET
          series_completed  = COALESCE($1, series_completed),
          status            = COALESCE($2::text, status),
          duration_seconds  = COALESCE($3, duration_seconds),
          completed_at      = CASE WHEN COALESCE($2::text, status) = 'completed' THEN now() ELSE completed_at END
        WHERE home_training_session_id = $4
          AND exercise_order = $5
        RETURNING *;
      `;
      updateParams = [
        series_completed !== undefined ? series_completed : null,
        status !== undefined ? status : null,
        duration_seconds !== undefined ? duration_seconds : null,
        sessionId,
        exerciseOrder
      ];
    }

    const updateResult = await client.query(updateSql, updateParams);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ejercicio no encontrado' });
    }

    // Calcular progreso total de la sesión
    const progressResult = await client.query(
      `SELECT
         COUNT(*)::int as total_exercises,
         COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_exercises,
         SUM(CASE WHEN status = 'completed' THEN COALESCE(duration_seconds, 0) ELSE 0 END)::int as total_duration
       FROM app.home_exercise_progress
       WHERE home_training_session_id = $1`,
      [sessionId]
    );

    const progress = progressResult.rows[0];
    const progressPercentage = progress.total_exercises > 0
      ? Math.round((progress.completed_exercises / progress.total_exercises) * 100)
      : 0;

    // Actualizar la sesión
    await client.query(`
      UPDATE app.home_training_sessions
      SET
        exercises_completed    = (SELECT COUNT(*) FROM app.home_exercise_progress
                                  WHERE home_training_session_id = $1 AND status = 'completed'),
        progress_percentage    = ROUND(100.0 * (SELECT COUNT(*) FROM app.home_exercise_progress
                                  WHERE home_training_session_id = $1 AND status = 'completed')
                                  / NULLIF(total_exercises,0), 1),
        completed_at           = CASE
                                  WHEN (SELECT COUNT(*) FROM app.home_exercise_progress
                                        WHERE home_training_session_id = $1 AND status <> 'completed') = 0
                                  THEN COALESCE(completed_at, NOW())
                                  ELSE NULL
                                END,
        status                 = CASE
                                  WHEN (SELECT COUNT(*) FROM app.home_exercise_progress
                                        WHERE home_training_session_id = $1 AND status <> 'completed') = 0
                                  THEN 'completed'
                                  ELSE 'in_progress'
                                END
      WHERE id = $1
    `, [sessionId]);
    // Si el ejercicio se complet�, actualizar estad�sticas e historial
    if (status === 'completed') {
      if (progressPercentage >= 100) {
        await client.query(
          `UPDATE app.user_home_training_stats
           SET total_sessions = total_sessions + 1,
               last_training_date = CURRENT_DATE,
               updated_at = NOW()
           WHERE user_id = $1`,
          [user_id]
        );
      }

      const exRow = updateResult.rows[0];
      const sessRow = sessionResult.rows[0];
      const planId = sessRow.home_training_plan_id;

      const exName = exRow.exercise_name || (exRow.exercise_data && exRow.exercise_data.nombre) || 'Ejercicio';
      const exKey = (exName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

      await client.query(
        `INSERT INTO app.home_exercise_history
           (user_id, exercise_name, exercise_key, reps, series, duration_seconds, session_id, plan_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, exercise_name, session_id) DO NOTHING`,
        [user_id, exName, exKey, null, series_completed, (duration_seconds ?? null), sessionId, planId]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      exercise: updateResult.rows[0],
      session_progress: {
        completed_exercises: progress.completed_exercises,
        total_exercises: progress.total_exercises,
        percentage: progressPercentage,
        total_duration: progress.total_duration
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating home exercise progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el progreso del ejercicio'
    });
  } finally {
    client.release();
  }
});

// ===============================================
// FINALIZACIÓN DE SESIONES
// ===============================================

/**
 * POST /api/training-session/complete/methodology/:sessionId
 * Finalizar sesión de metodología
 */
router.post('/complete/methodology/:sessionId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;
    const {
      outcome = 'auto',
      feedback = []
    } = req.body || {};

    const ses = await client.query(
      'SELECT * FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (ses.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }

    // Actualizar ejercicios pendientes según outcome seleccionado
    if (outcome === 'skip_remaining') {
      await client.query(
        `UPDATE app.methodology_exercise_progress
         SET status = 'skipped', completed_at = NOW()
         WHERE methodology_session_id = $1
           AND status NOT IN ('completed','skipped')`,
        [sessionId]
      );
    } else if (outcome === 'cancel_remaining') {
      await client.query(
        `UPDATE app.methodology_exercise_progress
         SET status = 'cancelled', completed_at = NOW()
         WHERE methodology_session_id = $1
           AND status NOT IN ('completed','cancelled')`,
        [sessionId]
      );
    }

    // Obtener todos los ejercicios para calcular estado
    const exercisesQuery = await client.query(
      `SELECT exercise_order, status, series_completed, series_total
       FROM app.methodology_exercise_progress
       WHERE methodology_session_id = $1
       ORDER BY exercise_order`,
      [sessionId]
    );

    // Calcular estado de sesión usando el servicio
    const { status: sessionStatus, completionRate, metrics } = calculateSessionStatus(exercisesQuery.rows);

    const totalExercises = metrics.total;
    const completedExercises = metrics.completed;
    const skippedExercises = metrics.skipped;
    const cancelledExercises = metrics.cancelled;

    await client.query(
      `UPDATE app.methodology_exercise_sessions
       SET session_status = $2,
           exercises_completed = $3,
           exercises_skipped = $4,
           exercises_cancelled = $5,
           total_exercises = $6,
           completion_rate = $7,
           completed_at = NOW(),
           total_duration_seconds = CASE
             WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
             ELSE total_duration_seconds
           END
       WHERE id = $1`,
      [sessionId, sessionStatus, completedExercises, skippedExercises, cancelledExercises, totalExercises, completionRate]
    );

    // Obtener todos los ejercicios de la sesión para mover al historial
    const exercisesForHistory = await client.query(
      `SELECT mep.*, mes.methodology_type, mes.methodology_plan_id, mes.week_number, mes.day_name,
              mes.warmup_time_seconds, mes.started_at, mes.completed_at
       FROM app.methodology_exercise_progress mep
       JOIN app.methodology_exercise_sessions mes ON mep.methodology_session_id = mes.id
       WHERE mep.methodology_session_id = $1`,
      [sessionId]
    );

    // Mover cada ejercicio al historial completo
    for (const exercise of exercisesForHistory.rows) {
      if (exercise.status !== 'pending') {
        await client.query(
          `INSERT INTO app.methodology_exercise_history_complete (
            user_id, methodology_plan_id, methodology_session_id,
            exercise_name, exercise_order, methodology_type,
            series_total, series_completed, repeticiones, intensidad,
            tiempo_dedicado_segundos, warmup_time_seconds, week_number, day_name,
            session_date, completed_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
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
            exercise.warmup_time_seconds || 0,
            exercise.week_number,
            exercise.day_name,
            exercise.started_at ? new Date(exercise.started_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            exercise.completed_at || new Date()
          ]
        );
      }
    }

    // Registrar feedback opcional
    if (Array.isArray(feedback) && feedback.length > 0) {
      for (const entry of feedback) {
        if (!entry) continue;
        const allowedTypes = ['skipped','cancelled','missed'];
        const allowedReasons = ['dificil','no_se_ejecutar','lesion','equipamiento','cansancio','tiempo','motivacion','auto_missed','otros'];
        const feedbackType = allowedTypes.includes(entry.feedback_type) ? entry.feedback_type : 'cancelled';
        const reasonCode = allowedReasons.includes(entry.reason_code) ? entry.reason_code : 'otros';

        await client.query(
          `INSERT INTO app.methodology_session_feedback (
            user_id, methodology_plan_id, methodology_session_id,
            exercise_order, exercise_name, feedback_type, reason_code, reason_text,
            difficulty_rating, would_retry, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT DO NOTHING`,
          [
            userId,
            ses.rows[0].methodology_plan_id,
            sessionId,
            entry.exercise_order ?? null,
            entry.exercise_name ?? null,
            feedbackType,
            reasonCode,
            entry.reason_text || null,
            entry.difficulty_rating ?? null,
            entry.would_retry ?? false
          ]
        );
      }
    }

    await finalizePlanIfCompleted(ses.rows[0].methodology_plan_id, client);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Sesión finalizada y datos guardados en historial',
      summary: {
        status: sessionStatus,
        completionRate,
        totalExercises,
        completedExercises,
        skippedExercises,
        cancelledExercises
      }
    });

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error finishing methodology session:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/training-session/complete/home/:sessionId
 * Finalizar sesión de entrenamiento en casa
 */
router.post('/complete/home/:sessionId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { sessionId } = req.params;
    const user_id = req.user.userId || req.user.id;

    // Verificar que la sesión existe y pertenece al usuario
    const sessionCheck = await client.query(
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    // Actualizar estado de la sesión a completada
    await client.query(
      `UPDATE app.home_training_sessions
       SET status = 'completed',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    // Obtener resumen de la sesión
    const summaryResult = await client.query(
      `SELECT
         COUNT(*) as total_exercises,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_exercises,
         SUM(COALESCE(duration_seconds, 0)) as total_duration
       FROM app.home_exercise_progress
       WHERE home_training_session_id = $1`,
      [sessionId]
    );

    const summary = summaryResult.rows[0];

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Sesión completada exitosamente',
      summary: {
        total_exercises: parseInt(summary.total_exercises),
        completed_exercises: parseInt(summary.completed_exercises),
        total_duration_seconds: parseInt(summary.total_duration)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing home training session:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar la sesión'
    });
  } finally {
    client.release();
  }
});

// ===============================================
// OBTENCIÓN DE PROGRESO Y ESTADO
// ===============================================

/**
 * GET /api/training-session/progress/methodology/:sessionId
 * Obtener progreso de sesión de metodología
 */
router.get('/progress/methodology/:sessionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;

    const ses = await pool.query(
      'SELECT * FROM app.methodology_exercise_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (ses.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }

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

    res.json({
      success: true,
      session: ses.rows[0],
      exercises: progress.rows,
      summary: counters.rows[0]
    });

  } catch (e) {
    console.error('Error fetching methodology session progress:', e);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

/**
 * GET /api/training-session/progress/home/:sessionId
 * Obtener progreso de sesión de entrenamiento en casa
 */
router.get('/progress/home/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user_id = req.user.userId || req.user.id;

    // Verificar que la sesión pertenece al usuario
    const sessionResult = await pool.query(
      'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    // Obtener progreso de todos los ejercicios + feedback
    const progressResult = await pool.query(
      `SELECT p.*, fb.sentiment AS feedback_sentiment, fb.comment AS feedback_comment
       FROM app.home_exercise_progress p
       LEFT JOIN LATERAL (
         SELECT sentiment, comment
         FROM app.user_exercise_feedback uf
         WHERE uf.user_id = $2
           AND uf.session_id = $1
           AND uf.exercise_order = p.exercise_order
         ORDER BY created_at DESC
         LIMIT 1
       ) fb ON true
       WHERE p.home_training_session_id = $1
       ORDER BY p.exercise_order`,
      [sessionId, user_id]
    );

    const session = sessionResult.rows[0];
    const exercises = progressResult.rows;

    // Calcular siguiente ejercicio a realizar
    const nextExerciseIndex = exercises.findIndex(ex => ex.status !== 'completed');
    const completedExercises = exercises
      .filter(ex => ex.status === 'completed')
      .map(ex => ex.exercise_order);

    let safeCurrentExercise;
    if (nextExerciseIndex >= 0) {
      safeCurrentExercise = nextExerciseIndex;
    } else if (exercises.length > 0) {
      safeCurrentExercise = Math.max(0, exercises.length - 1);
    } else {
      safeCurrentExercise = 0;
    }

    const allCompleted = exercises.length > 0 && exercises.every(ex => ex.status === 'completed');

    res.json({
      success: true,
      session: session,
      exercises: exercises,
      progress: {
        currentExercise: safeCurrentExercise,
        completedExercises: completedExercises,
        percentage: session.progress_percentage || 0,
        allCompleted
      }
    });

  } catch (error) {
    console.error('Error getting home session progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el progreso de la sesión'
    });
  }
});

/**
 * GET /api/training-session/today-status
 * Obtener estado de la sesión del día actual
 */
router.get('/today-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, week_number, day_name, session_date } = req.query;

    // Validar parámetros según el tipo de entrenamiento
    if (methodology_plan_id) {
      // Sesión de metodología
      if (!week_number || !day_name) {
        return res.status(400).json({
          success: false,
          error: 'Parámetros requeridos para metodología: week_number, day_name'
        });
      }

      const normalizedDay = normalizeDayAbbrev(day_name);

      let sessionQuery;
      if (session_date) {
        // Si se proporciona fecha específica, buscar por fecha exacta
        sessionQuery = await pool.query(
          `SELECT * FROM app.methodology_exercise_sessions
           WHERE user_id = $1 AND methodology_plan_id = $2
             AND session_date::date = $3::date
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, methodology_plan_id, session_date]
        );
      } else {
        // Buscar por week_number y day_name
        sessionQuery = await pool.query(
          `SELECT * FROM app.methodology_exercise_sessions
           WHERE user_id = $1 AND methodology_plan_id = $2
             AND week_number = $3 AND day_name = $4
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, methodology_plan_id, week_number, normalizedDay]
        );
      }

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
          p.time_spent_seconds, p.notas, p.exercise_id,
          f.sentiment, f.comment
         FROM app.methodology_exercise_progress p
         LEFT JOIN app.methodology_exercise_feedback f
           ON p.methodology_session_id = f.methodology_session_id
           AND p.exercise_order = f.exercise_order
         WHERE p.methodology_session_id = $1
         ORDER BY p.exercise_order ASC`,
        [session.id]
      );

      // 🆕 Obtener datos de series (peso, reps, RIR) de hypertrophy_set_logs
      const setLogsQuery = await pool.query(
        `SELECT
          exercise_id,
          exercise_name,
          set_number,
          weight_used,
          reps_completed,
          rir_reported,
          estimated_1rm,
          rpe_calculated,
          volume_load,
          is_effective
         FROM app.hypertrophy_set_logs
         WHERE session_id = $1
         ORDER BY exercise_id, set_number ASC`,
        [session.id]
      );

      // Agrupar series por exercise_id
      const setLogsByExercise = {};
      setLogsQuery.rows.forEach(set => {
        if (!setLogsByExercise[set.exercise_id]) {
          setLogsByExercise[set.exercise_id] = [];
        }
        setLogsByExercise[set.exercise_id].push(set);
      });

      // Combinar datos de ejercicios con sus series
      const exercisesWithSets = exercisesQuery.rows.map(ex => ({
        ...ex,
        sets: setLogsByExercise[ex.exercise_id] || []
      }));

      // Calcular resumen
      const totalExercises = exercisesQuery.rowCount;
      const completedExercises = exercisesQuery.rows.filter(ex => ex.status === 'completed').length;
      const skippedExercises = exercisesQuery.rows.filter(ex => ex.status === 'skipped').length;

      // 🎯 LÓGICA INTELIGENTE: Misma que routines.js - Detectar progreso REAL
      const hasRealProgress = exercisesQuery.rows.some(ex => ex.status !== 'pending');

      let canResume;
      if (session.session_status === 'completed') {
        // Caso 1: Sesión completada → Mostrar resumen, no botones de inicio
        canResume = false;
      } else if (hasRealProgress) {
        // Caso 2: Usuario realmente empezó ejercicios → Reanudar
        canResume = true;
      } else {
        // Caso 3: Sesión creada pero sin progreso real → Comenzar
        canResume = false;
      }

      console.log(`🎯 trainingSession NUEVA LÓGICA INTELIGENTE:`, {
        session_status: session.session_status,
        hasRealProgress,
        canResume,
        decision: canResume ? 'REANUDAR ⚠️' : 'COMENZAR ✅'
      });

      // Calcular si puede reintentar ejercicios (skipped/cancelled)
      const cancelledExercises = exercisesQuery.rows.filter(ex => ex.status === 'cancelled').length;
      const canRetry = (skippedExercises > 0 || cancelledExercises > 0) && session.session_status === 'completed';

      res.json({
        success: true,
        session_type: 'methodology',
        session: {
          ...session,
          canResume
        },
        exercises: exercisesWithSets, // 🆕 Ahora incluye datos de series
        summary: {
          total: totalExercises,
          completed: completedExercises,
          skipped: skippedExercises,
          cancelled: cancelledExercises,
          pending: totalExercises - completedExercises - skippedExercises - cancelledExercises,
          isComplete: session.session_status === 'completed',
          canRetry  // ✅ NUEVO: Permite reintentar skipped/cancelled
        }
      });

    } else {
      // Para entrenamiento en casa, buscar la sesión activa más reciente
      const homeSessionQuery = await pool.query(
        `SELECT * FROM app.home_training_sessions
         WHERE user_id = $1 AND status = 'in_progress'
         ORDER BY started_at DESC
         LIMIT 1`,
        [userId]
      );

      if (homeSessionQuery.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'No hay sesión activa de entrenamiento en casa'
        });
      }

      const session = homeSessionQuery.rows[0];

      // Obtener progreso
      const progressQuery = await pool.query(
        `SELECT * FROM app.home_exercise_progress
         WHERE home_training_session_id = $1
         ORDER BY exercise_order`,
        [session.id]
      );

      const exercises = progressQuery.rows;
      const statusCounts = exercises.reduce((acc, ex) => {
        const s = String(ex.status || 'pending').toLowerCase();
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      const total = exercises.length;
      const completed = statusCounts['completed'] || 0;
      const skipped = statusCounts['skipped'] || 0;
      const cancelled = statusCounts['cancelled'] || 0;
      const in_progress = statusCounts['in_progress'] || 0;
      const pending = statusCounts['pending'] || 0;

      const isFinished = total > 0 && pending === 0 && in_progress === 0;
      const isComplete = total > 0 && completed === total;
      const allSkipped = total > 0 && skipped === total;
      const allCancelled = total > 0 && cancelled === total;
      const hasAnyProgress = (in_progress > 0) || ((completed + skipped + cancelled) > 0);
      const canResume = !isFinished && hasAnyProgress;
      const canRetry = (allSkipped || allCancelled);

      res.json({
        success: true,
        session_type: 'home',
        session: {
          ...session,
          canResume
        },
        exercises,
        summary: {
          total,
          completed,
          skipped,
          cancelled,
          in_progress,
          pending,
          isFinished,
          isComplete,
          canRetry
        }
      });
    }

  } catch (error) {
    console.error('Error obteniendo estado de sesión del día:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================================
// ESTADÍSTICAS Y DATOS HISTÓRICOS
// ===============================================

/**
 * GET /api/training-session/stats/progress-data
 * Obtener datos de progreso histórico para el ProgressTab
 */
router.get('/stats/progress-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id, home_training_plan_id } = req.query;

    if (!methodology_plan_id && !home_training_plan_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere methodology_plan_id o home_training_plan_id'
      });
    }

    if (methodology_plan_id) {
      // Datos de progreso para metodología
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

      // Obtener información del plan para calcular semana actual
      const planInfoQuery = await pool.query(
        'SELECT created_at, confirmed_at FROM app.methodology_plans WHERE id = $1 AND user_id = $2',
        [methodology_plan_id, userId]
      );
      const planInfo = planInfoQuery.rows[0];
      const planStartDate = planInfo?.confirmed_at || planInfo?.created_at;

      // Calcular semana actual basada en fecha de inicio del plan
      let currentWeek = 1;
      if (planStartDate) {
        const daysSinceStart = Math.floor((new Date() - new Date(planStartDate)) / (1000 * 60 * 60 * 24));
        currentWeek = Math.max(1, Math.floor(daysSinceStart / 7) + 1);
      }

      // Obtener resumen general de progreso
      const generalStatsQuery = await pool.query(
        `SELECT
           COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as total_sessions_completed,
           COUNT(DISTINCT mes.id) as total_sessions_started,
           COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as total_exercises_completed,
           COUNT(DISTINCT mep.id) as total_exercises_attempted,
           SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_completed,
           SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) +
           SUM(CASE WHEN mes.status = 'completed' THEN COALESCE(mes.warmup_time_seconds, 0) ELSE 0 END) as total_time_seconds,
           MIN(mes.started_at) as first_session_date,
           MAX(mes.completed_at) as last_session_date
         FROM app.methodology_exercise_sessions mes
         LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
         WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2`,
        [userId, methodology_plan_id]
      );

      // Obtener progreso por semanas
      const weeklyProgressQuery = await pool.query(
        `SELECT
           mes.week_number,
           COUNT(DISTINCT mes.id) FILTER (WHERE mes.session_status = 'completed') as sessions_completed,
           COUNT(DISTINCT mes.id) as total_sessions,
           COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as exercises_completed,
           COUNT(DISTINCT mep.id) as total_exercises,
           SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as series_completed,
           SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) +
           COALESCE(mes.warmup_time_seconds, 0) as time_spent_seconds
         FROM app.methodology_exercise_sessions mes
         LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
         WHERE mes.user_id = $1 AND mes.methodology_plan_id = $2
         GROUP BY mes.week_number
         ORDER BY mes.week_number ASC`,
        [userId, methodology_plan_id]
      );

      // Calcular totales del plan
      const totalWeeks = planData?.semanas?.length || 0;
      const totalSessionsInPlan = planData?.semanas?.reduce((acc, semana) =>
        acc + (semana.sesiones?.length || 0), 0) || 0;
      const totalExercisesInPlan = planData?.semanas?.reduce((acc, semana) =>
        acc + semana.sesiones?.reduce((sessAcc, sesion) =>
          sessAcc + (sesion.ejercicios?.length || 0), 0) || 0, 0) || 0;

      const generalStats = generalStatsQuery.rows[0];
      const weeklyProgress = weeklyProgressQuery.rows;

      // Construir progreso por semanas con datos reales
      const weeklyProgressData = [];
      for (let week = 1; week <= totalWeeks; week++) {
        const weekData = weeklyProgress.find(w => w.week_number === week);
        const weekInPlan = findWeekInPlan(planData?.semanas, week);
        const weekSessions = weekInPlan?.sesiones?.length || 0;
        const weekExercises = weekInPlan?.sesiones?.reduce(
          (acc, ses) => acc + (ses.ejercicios?.length || 0), 0) || 0;

        weeklyProgressData.push({
          week,
          sessions: Math.max(weekSessions, weekData?.total_sessions || 0),
          completed: weekData?.sessions_completed || 0,
          exercises: Math.max(weekExercises, weekData?.total_exercises || 0),
          exercisesCompleted: weekData?.exercises_completed || 0,
          seriesCompleted: weekData?.series_completed || 0,
          timeSpentSeconds: weekData?.time_spent_seconds || 0
        });
      }

      const responseData = {
        totalWeeks,
        currentWeek,
        totalSessions: Math.max(totalSessionsInPlan, parseInt(generalStats.total_sessions_started) || 0),
        completedSessions: parseInt(generalStats.total_sessions_completed) || 0,
        totalExercises: Math.max(totalExercisesInPlan, parseInt(generalStats.total_exercises_attempted) || 0),
        completedExercises: parseInt(generalStats.total_exercises_completed) || 0,
        totalSeriesCompleted: parseInt(generalStats.total_series_completed) || 0,
        totalTimeSpentSeconds: parseInt(generalStats.total_time_seconds) || 0,
        firstSessionDate: generalStats.first_session_date,
        lastSessionDate: generalStats.last_session_date,
        weeklyProgress: weeklyProgressData
      };

      res.json({ success: true, data: responseData });

    } else {
      // Datos de progreso para entrenamiento en casa
      const statsResult = await pool.query(
        'SELECT * FROM app.user_home_training_stats WHERE user_id = $1',
        [userId]
      );

      let stats = statsResult.rows[0];

      if (!stats) {
        // Crear estadísticas iniciales si no existen
        const createResult = await pool.query(
          `INSERT INTO app.user_home_training_stats (user_id)
           VALUES ($1)
           RETURNING *`,
          [userId]
        );
        stats = createResult.rows[0];
      }

      // Agregar métricas basadas en ejercicios completados
      const exAgg = await pool.query(
        `SELECT COUNT(*)::int AS total_exercises_completed,
                COALESCE(SUM(duration_seconds), 0)::int AS total_exercise_duration_seconds
         FROM app.home_exercise_history
         WHERE user_id = $1`,
        [userId]
      );
      const ex = exAgg.rows[0] || { total_exercises_completed: 0, total_exercise_duration_seconds: 0 };

      res.json({
        success: true,
        data: {
          ...stats,
          total_exercises_completed: ex.total_exercises_completed,
          total_exercise_duration_seconds: ex.total_exercise_duration_seconds,
        }
      });
    }

  } catch (error) {
    console.error('Error obteniendo datos de progreso:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/training-session/stats/historical
 * Obtener datos históricos completos del usuario
 */
router.get('/stats/historical', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    // Obtener estadísticas generales históricas (todas las rutinas del usuario)
    const totalStatsQuery = await pool.query(
      `SELECT
         COUNT(DISTINCT mp.id) as total_routines_completed,
         COUNT(DISTINCT mes.id) as total_sessions_ever,
         COUNT(DISTINCT mep.id) as total_exercises_ever,
         SUM(CASE WHEN mep.status = 'completed' THEN mep.series_completed ELSE 0 END) as total_series_ever,
         SUM(CASE WHEN mep.status = 'completed' THEN COALESCE(mep.time_spent_seconds, 0) ELSE 0 END) +
         SUM(CASE WHEN mes.status = 'completed' THEN COALESCE(mes.warmup_time_seconds, 0) ELSE 0 END) as total_time_spent_ever,
         MIN(mes.started_at) as first_workout_date,
         MAX(mes.completed_at) as last_workout_date
       FROM app.methodology_plans mp
       LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       WHERE mp.user_id = $1 AND mp.status = 'active'`,
      [userId]
    );

    // Agregar estadísticas de entrenamiento en casa
    const homeStatsQuery = await pool.query(
      `SELECT
         COUNT(DISTINCT hts.id) as home_sessions,
         COUNT(DISTINCT hep.id) as home_exercises,
         SUM(CASE WHEN hep.status = 'completed' THEN hep.series_completed ELSE 0 END) as home_series,
         SUM(CASE WHEN hep.status = 'completed' THEN COALESCE(hep.duration_seconds, 0) ELSE 0 END) as home_time
       FROM app.home_training_sessions hts
       LEFT JOIN app.home_exercise_progress hep ON hep.home_training_session_id = hts.id
       WHERE hts.user_id = $1 AND hts.status = 'completed'`,
      [userId]
    );

    const methodologyStats = totalStatsQuery.rows[0] || {};
    const homeStats = homeStatsQuery.rows[0] || {};

    // Combinar estadísticas
    const responseData = {
      totalRoutinesCompleted: parseInt(methodologyStats.total_routines_completed) || 0,
      totalSessionsEver: (parseInt(methodologyStats.total_sessions_ever) || 0) + (parseInt(homeStats.home_sessions) || 0),
      totalExercisesEver: (parseInt(methodologyStats.total_exercises_ever) || 0) + (parseInt(homeStats.home_exercises) || 0),
      totalSeriesEver: (parseInt(methodologyStats.total_series_ever) || 0) + (parseInt(homeStats.home_series) || 0),
      totalTimeSpentEver: (parseInt(methodologyStats.total_time_spent_ever) || 0) + (parseInt(homeStats.home_time) || 0),
      firstWorkoutDate: methodologyStats.first_workout_date,
      lastWorkoutDate: methodologyStats.last_workout_date,
      breakdown: {
        methodology: {
          sessions: parseInt(methodologyStats.total_sessions_ever) || 0,
          exercises: parseInt(methodologyStats.total_exercises_ever) || 0,
          series: parseInt(methodologyStats.total_series_ever) || 0,
          time: parseInt(methodologyStats.total_time_spent_ever) || 0
        },
        home: {
          sessions: parseInt(homeStats.home_sessions) || 0,
          exercises: parseInt(homeStats.home_exercises) || 0,
          series: parseInt(homeStats.home_series) || 0,
          time: parseInt(homeStats.home_time) || 0
        }
      }
    };

    console.log('✅ Datos históricos obtenidos:', {
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

// ===============================================
// GESTIÓN DE FEEDBACK
// ===============================================

/**
 * POST /api/training-session/feedback/exercise
 * Guardar feedback del usuario sobre un ejercicio
 */
router.post('/feedback/exercise', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const {
      sessionId,
      exerciseOrder,
      sentiment,
      comment,
      exerciseName,
      sessionType = 'methodology' // 'methodology' o 'home'
    } = req.body;

    // Validar parámetros
    if (!sessionId || exerciseOrder === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'sessionId y exerciseOrder son requeridos'
      });
    }

    if (!sentiment || !['like', 'dislike', 'hard'].includes(sentiment)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'sentiment es requerido y debe ser: like, dislike, hard'
      });
    }

    if (sessionType === 'methodology') {
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

      // Insertar o actualizar feedback
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

    } else if (sessionType === 'home') {
      // Buscar nombre del ejercicio si no llega por body
      let exName = exerciseName;
      let exKey = null;

      if (!exName) {
        const q = await client.query(
          `SELECT exercise_name, exercise_data
           FROM app.home_exercise_progress
           WHERE home_training_session_id = $1 AND exercise_order = $2
           LIMIT 1`,
          [sessionId, exerciseOrder]
        );
        if (q.rows.length) {
          exName = q.rows[0].exercise_name || q.rows[0].exercise_data?.nombre || 'Ejercicio';
        } else {
          exName = 'Ejercicio';
        }
      }

      exKey = (exName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

      await client.query(
        `INSERT INTO app.user_exercise_feedback
         (user_id, session_id, exercise_order, exercise_name, exercise_key, sentiment, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, sessionId, exerciseOrder, exName, exKey, sentiment, comment || null]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Feedback guardado correctamente'
      });
    }

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

// ===============================================
// GESTIÓN DE TIEMPO DE CALENTAMIENTO
// ===============================================

/**
 * PUT /api/training-session/warmup-time/:sessionId
 * Actualizar tiempo de calentamiento de una sesión
 */
router.put('/warmup-time/:sessionId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;
    const { warmup_time_seconds, session_type = 'methodology' } = req.body;

    // Validar entrada
    if (!sessionId || warmup_time_seconds === undefined) {
      return res.status(400).json({
        success: false,
        error: 'sessionId y warmup_time_seconds son requeridos'
      });
    }

    if (session_type === 'methodology') {
      // Verificar que la sesión existe y pertenece al usuario
      const sessionCheck = await client.query(`
        SELECT id, methodology_plan_id, user_id, status, warmup_time_seconds
        FROM app.methodology_exercise_sessions
        WHERE id = $1 AND user_id = $2
      `, [sessionId, userId]);

      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Sesión no encontrada o no autorizada'
        });
      }

      const session = sessionCheck.rows[0];

      // Solo permitir actualizar sesiones activas
      if (session.status === 'completed') {
        return res.status(400).json({
          success: false,
          error: 'No se puede actualizar tiempo de warmup en sesión completada'
        });
      }

      // Actualizar tiempo de calentamiento
      const updateResult = await client.query(`
        UPDATE app.methodology_exercise_sessions
        SET
          warmup_time_seconds = $1,
          updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING warmup_time_seconds, total_duration_seconds
      `, [warmup_time_seconds, sessionId, userId]);

      if (updateResult.rows.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'No se pudo actualizar el tiempo de calentamiento'
        });
      }

      const updated = updateResult.rows[0];

      console.log(`✅ Tiempo de calentamiento actualizado para sesión ${sessionId}: ${warmup_time_seconds}s`);

      res.json({
        success: true,
        message: 'Tiempo de calentamiento actualizado correctamente',
        data: {
          sessionId: parseInt(sessionId),
          warmup_time_seconds: updated.warmup_time_seconds,
          total_duration_seconds: updated.total_duration_seconds
        }
      });

    } else {
      // Para entrenamiento en casa, podríamos agregar un campo similar si es necesario
      return res.status(400).json({
        success: false,
        error: 'Tiempo de calentamiento no disponible para sesiones de entrenamiento en casa'
      });
    }

  } catch (error) {
    console.error('Error actualizando tiempo de calentamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

// ===============================================
// GESTIÓN DE SESIONES ABANDONADAS
// ===============================================

/**
 * POST /api/training-session/handle-abandon/:sessionId
 * Manejar abandono de sesión (guardar progreso parcial)
 */
router.post('/handle-abandon/:sessionId', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const { currentProgress, reason, session_type = 'home' } = req.body;
  const user_id = req.user.userId || req.user.id;

  console.log(`🚪 Usuario ${user_id} abandonando sesión ${sessionId}, motivo: ${reason}`);

  try {
    if (session_type === 'home') {
      // Verificar que la sesión pertenece al usuario
      const sessionCheck = await pool.query(
        'SELECT * FROM app.home_training_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, user_id]
      );

      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
      }

      // Guardar progreso actual si se proporciona
      if (currentProgress) {
        console.log(`💾 Guardando progreso antes de abandono:`, currentProgress);

        for (const [exerciseIndex, progress] of Object.entries(currentProgress)) {
          if (progress.series_completed > 0) {
            await pool.query(`
              UPDATE app.home_exercise_progress
              SET
                series_completed = $1,
                status = $2,
                duration_seconds = COALESCE($3, duration_seconds)
              WHERE home_training_session_id = $4
                AND exercise_order = $5
            `, [
              progress.series_completed,
              progress.status || 'in_progress',
              progress.duration_seconds,
              sessionId,
              parseInt(exerciseIndex)
            ]);
          }
        }
      }

      // Verificar progreso para determinar el status final
      const progressCheck = await pool.query(`
        SELECT
          COUNT(*) as total_exercises,
          COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as finished_exercises,
          COUNT(*) FILTER (WHERE series_completed > 0 OR status IN ('completed', 'skipped', 'in_progress')) as exercises_with_progress
        FROM app.home_exercise_progress
        WHERE home_training_session_id = $1
      `, [sessionId]);

      const { total_exercises, finished_exercises, exercises_with_progress } = progressCheck.rows[0];
      const allFinished = parseInt(finished_exercises) === parseInt(total_exercises) && parseInt(total_exercises) > 0;
      const hasProgress = parseInt(exercises_with_progress) > 0;

      // Determinar status final:
      // - Todos finalizados → 'completed'
      // - Hay progreso pero no todos finalizados → 'in_progress' (permitir reanudar)
      // - Sin progreso → 'cancelled'
      let finalStatus;
      if (allFinished) {
        finalStatus = 'completed';
      } else if (hasProgress) {
        finalStatus = 'in_progress';
      } else {
        finalStatus = 'cancelled';
      }

      // Marcar abandono y actualizar status
      await pool.query(`
        UPDATE app.home_training_sessions
        SET
          abandoned_at = NOW(),
          abandon_reason = $2,
          status = $3,
          completed_at = CASE
            WHEN $3 = 'completed' THEN NOW()
            ELSE completed_at
          END
        WHERE id = $1
      `, [sessionId, reason, finalStatus]);

      console.log(`✅ Sesión ${sessionId} marcada como abandonada (${reason})`);
      console.log(`   Status final: ${finalStatus} (${finished_exercises}/${total_exercises} ejercicios finalizados)`);

      return res.json({
        success: true,
        message: 'Progreso guardado antes de abandono',
        finalStatus: finalStatus,
        progress: {
          total: parseInt(total_exercises),
          finished: parseInt(finished_exercises),
          canResume: finalStatus === 'in_progress'
        }
      });
    }

    res.json({ success: true, message: 'Progreso guardado antes de abandono' });

  } catch (error) {
    console.error('❌ Error manejando abandono:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/training-session/close-active
 * Cerrar sesiones activas del usuario
 */
router.put('/close-active', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId || req.user.id;
    const { session_type = 'all' } = req.body;

    let totalClosed = 0;

    if (session_type === 'home' || session_type === 'all') {
      // Cerrar sesiones de entrenamiento en casa
      const homeResult = await pool.query(
        `UPDATE app.home_training_sessions
         SET status = 'cancelled',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1 AND status = 'in_progress'
         RETURNING id`,
        [user_id]
      );
      totalClosed += homeResult.rows.length;
    }

    if (session_type === 'methodology' || session_type === 'all') {
      // Cerrar sesiones de metodología
      const methodologyResult = await pool.query(
        `UPDATE app.methodology_exercise_sessions
         SET session_status = 'cancelled',
             updated_at = NOW()
         WHERE user_id = $1 AND session_status = 'in_progress'
         RETURNING id`,
        [user_id]
      );
      totalClosed += methodologyResult.rows.length;
    }

    res.json({
      success: true,
      message: `${totalClosed} sesión${totalClosed !== 1 ? 'es' : ''} cerrada${totalClosed !== 1 ? 's' : ''}`,
      closedSessions: totalClosed
    });

  } catch (error) {
    console.error('Error closing active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesiones activas'
    });
  }
});

/**
 * GET /api/training-session/weekend-status
 * Obtiene el estado de sesión de fin de semana del día actual
 */
router.get('/weekend-status', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.userId || req.user?.id;

    // Buscar sesiones de fin de semana del día actual
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sessionQuery = `
      SELECT
        mes.id,
        mes.methodology_plan_id,
        mes.session_status,
        mes.session_type,
        mes.exercises_completed,
        mes.exercises_skipped,
        mes.exercises_cancelled,
        mes.total_exercises,
        mes.exercises_data,
        mes.session_metadata,
        mes.started_at,
        mes.completed_at
      FROM app.methodology_exercise_sessions mes
      WHERE mes.user_id = $1
        AND mes.session_type = 'weekend-extra'
        AND mes.session_date >= $2
        AND mes.session_date < $3
      ORDER BY mes.id DESC
      LIMIT 1
    `;

    const sessionResult = await client.query(sessionQuery, [userId, today, tomorrow]);

    if (sessionResult.rows.length === 0) {
      return res.json({
        success: true,
        hasWeekendSession: false,
        message: 'No hay sesión de fin de semana para hoy'
      });
    }

    const session = sessionResult.rows[0];

    // Obtener el detalle de los ejercicios CON FEEDBACK
    const exercisesQuery = `
      SELECT
        est.exercise_order,
        est.exercise_name,
        est.status,
        est.exercise_data,
        est.actual_sets,
        est.planned_sets,
        est.actual_reps,
        est.planned_reps,
        est.completed_at,
        f.sentiment,
        f.comment
      FROM app.exercise_session_tracking est
      LEFT JOIN app.methodology_exercise_feedback f
        ON est.methodology_session_id = f.methodology_session_id
        AND est.exercise_order = f.exercise_order
      WHERE est.methodology_session_id = $1
      ORDER BY est.exercise_order
    `;

    const exercisesResult = await client.query(exercisesQuery, [session.id]);

    // 🎯 CORRECCIÓN: Calcular resumen directamente desde los ejercicios para evitar datos cacheados desactualizados
    const total = exercisesResult.rows.length;
    const completed = exercisesResult.rows.filter(ex => String(ex.status).toLowerCase() === 'completed').length;
    const skipped = exercisesResult.rows.filter(ex => String(ex.status).toLowerCase() === 'skipped').length;
    const cancelled = exercisesResult.rows.filter(ex => String(ex.status).toLowerCase() === 'cancelled').length;
    // 🎯 CORRECCIÓN: El progreso debe ser solo basado en ejercicios COMPLETADOS
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log('📊 Weekend Status - Contadores calculados:', {
      sessionId: session.id,
      total,
      completed,
      skipped,
      cancelled,
      exercises: exercisesResult.rows.map(ex => ({
        order: ex.exercise_order,
        name: ex.exercise_name,
        status: ex.status
      }))
    });

    res.json({
      success: true,
      hasWeekendSession: true,
      session: {
        id: session.id,
        methodology_plan_id: session.methodology_plan_id,
        session_status: session.session_status,
        session_type: session.session_type,
        started_at: session.started_at,
        completed_at: session.completed_at,
        exercises_data: session.exercises_data
      },
      exercises: exercisesResult.rows,
      summary: {
        completed,
        skipped,
        cancelled,
        total,
        pending: total - (completed + skipped + cancelled),
        progress,
        // 🎯 CORRECCIÓN: canRetry debe ser true si hay ejercicios pendientes (no completados)
        // Permite reanudar incluso si algunos fueron saltados/cancelados
        canRetry: completed < total && total > 0,
        isCompleted: session.session_status === 'completed'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estado de sesión de fin de semana:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de sesión'
    });
  } finally {
    client.release();
  }
});

// DELETE /api/training-session/cancel/methodology/:sessionId
// Cancelar sesión de metodología (incluyendo sesiones weekend)
router.delete('/cancel/methodology/:sessionId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user?.userId || req.user?.id;
    const { sessionId } = req.params;

    console.log(`🗑️ Cancelando sesión metodología ${sessionId} para usuario ${userId}`);

    // Verificar que la sesión pertenece al usuario
    const sessionCheck = await client.query(
      `SELECT id, session_type, methodology_plan_id
       FROM app.methodology_exercise_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    if (sessionCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada o no pertenece al usuario'
      });
    }

    const session = sessionCheck.rows[0];
    const isWeekend = session.session_type === 'weekend-extra';

    // 🗑️ ELIMINAR ejercicios de la sesión
    const deleteExercisesResult = await client.query(
      `DELETE FROM app.exercise_session_tracking
       WHERE methodology_session_id = $1`,
      [sessionId]
    );
    console.log(`🗑️ ${deleteExercisesResult.rowCount} ejercicios eliminados de sesión ${sessionId}`);

    // 🗑️ ELIMINAR la sesión
    const deleteSessionResult = await client.query(
      `DELETE FROM app.methodology_exercise_sessions
       WHERE id = $1`,
      [sessionId]
    );
    console.log(`🗑️ Sesión ${sessionId} eliminada`);

    // 🗑️ Si es sesión weekend, también ELIMINAR el plan
    if (isWeekend && session.methodology_plan_id) {
      const deletePlanResult = await client.query(
        `DELETE FROM app.methodology_plans
         WHERE id = $1`,
        [session.methodology_plan_id]
      );
      console.log(`🗑️ Plan weekend ${session.methodology_plan_id} eliminado (${deletePlanResult.rowCount} filas)`);
    }

    await client.query('COMMIT');

    console.log(`✅ Sesión ${sessionId} cancelada exitosamente`);

    res.json({
      success: true,
      message: isWeekend
        ? 'Entrenamiento de fin de semana cancelado'
        : 'Sesión de entrenamiento cancelada'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error cancelando sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la sesión'
    });
  } finally {
    client.release();
  }
});

export default router;
