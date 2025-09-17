// GET /api/routines/historical-data (VERSIÓN OPTIMIZADA)
// Obtiene datos históricos completos del usuario (filtrable por methodology_plan_id)
router.get('/historical-data', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodology_plan_id } = req.query;

    // Construir filtros condicionales
    let planFilter = 'mp.user_id = $1';
    let queryParams = [userId];

    if (methodology_plan_id) {
      planFilter += ' AND mp.id = $2';
      queryParams.push(methodology_plan_id);
    }

    // 1. ESTADÍSTICAS GENERALES OPTIMIZADAS
    const totalStatsQuery = await client.query(
      `SELECT
         COUNT(DISTINCT mp.id) FILTER (WHERE mp.confirmed_at IS NOT NULL) as total_routines_completed,
         COUNT(DISTINCT mes.id) as total_sessions_ever,
         COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as total_exercises_ever,
         COALESCE(SUM(mep.series_completed) FILTER (WHERE mep.status = 'completed'), 0) as total_series_ever,
         COALESCE(SUM(mep.time_spent_seconds) FILTER (WHERE mep.status = 'completed'), 0) as total_time_spent_ever,
         MIN(mes.started_at) as first_workout_date,
         MAX(mes.completed_at) as last_workout_date
       FROM app.methodology_plans mp
       LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       WHERE ${planFilter}`,
      queryParams
    );

    // 2. HISTORIAL DE RUTINAS COMPLETADAS OPTIMIZADO
    const routineHistoryQuery = await client.query(
      `SELECT
         mp.id as routine_id,
         mp.methodology_type,
         mp.confirmed_at as completed_at,
         COUNT(DISTINCT mes.id) as sessions,
         COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as exercises,
         COALESCE(SUM(mep.series_completed), 0) as series,
         COALESCE(SUM(mep.time_spent_seconds), 0) as time_spent
       FROM app.methodology_plans mp
       LEFT JOIN app.methodology_exercise_sessions mes ON mes.methodology_plan_id = mp.id
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       WHERE ${planFilter} AND mp.confirmed_at IS NOT NULL
       GROUP BY mp.id, mp.methodology_type, mp.confirmed_at
       ORDER BY mp.confirmed_at DESC
       LIMIT 50`,
      queryParams
    );

    // 3. ESTADÍSTICAS MENSUALES OPTIMIZADAS (últimos 12 meses)
    const monthlyStatsQuery = await client.query(
      `SELECT
         DATE_TRUNC('month', mes.started_at) as month_date,
         TO_CHAR(mes.started_at, 'Month YYYY') as month_label,
         COUNT(DISTINCT mes.id) as sessions,
         COUNT(DISTINCT mep.id) FILTER (WHERE mep.status = 'completed') as exercises,
         COALESCE(SUM(mep.series_completed), 0) as series,
         COALESCE(SUM(mep.time_spent_seconds), 0) as time_spent
       FROM app.methodology_exercise_sessions mes
       LEFT JOIN app.methodology_exercise_progress mep ON mep.methodology_session_id = mes.id
       JOIN app.methodology_plans mp ON mp.id = mes.methodology_plan_id
       WHERE ${planFilter}
         AND mes.started_at IS NOT NULL
         AND mes.started_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', mes.started_at), TO_CHAR(mes.started_at, 'Month YYYY')
       ORDER BY DATE_TRUNC('month', mes.started_at) DESC
       LIMIT 12`,
      queryParams
    );

    const totalStats = totalStatsQuery.rows[0] || {};
    const routineHistory = routineHistoryQuery.rows || [];
    const monthlyStats = monthlyStatsQuery.rows || [];

    // 4. FORMATEAR RESPUESTA CON VALIDACIÓN
    const responseData = {
      totalRoutinesCompleted: Math.max(0, parseInt(totalStats.total_routines_completed) || 0),
      totalSessionsEver: Math.max(0, parseInt(totalStats.total_sessions_ever) || 0),
      totalExercisesEver: Math.max(0, parseInt(totalStats.total_exercises_ever) || 0),
      totalSeriesEver: Math.max(0, parseInt(totalStats.total_series_ever) || 0),
      totalTimeSpentEver: Math.max(0, parseInt(totalStats.total_time_spent_ever) || 0),
      firstWorkoutDate: totalStats.first_workout_date || null,
      lastWorkoutDate: totalStats.last_workout_date || null,
      routineHistory: routineHistory.map(routine => ({
        id: routine.routine_id,
        methodologyType: routine.methodology_type || 'Sin definir',
        completedAt: routine.completed_at,
        sessions: Math.max(0, parseInt(routine.sessions) || 0),
        exercises: Math.max(0, parseInt(routine.exercises) || 0),
        series: Math.max(0, parseInt(routine.series) || 0),
        timeSpent: Math.max(0, parseInt(routine.time_spent) || 0)
      })),
      monthlyStats: monthlyStats.map(month => ({
        month: month.month_label?.trim() || 'Sin fecha',
        sessions: Math.max(0, parseInt(month.sessions) || 0),
        exercises: Math.max(0, parseInt(month.exercises) || 0),
        series: Math.max(0, parseInt(month.series) || 0),
        timeSpent: Math.max(0, parseInt(month.time_spent) || 0)
      }))
    };

    // 5. LOG OPTIMIZADO (sin console.log en producción)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Datos históricos obtenidos:', {
        userId,
        methodologyPlanId: methodology_plan_id || 'todos',
        totalRoutines: responseData.totalRoutinesCompleted,
        totalSessions: responseData.totalSessionsEver,
        totalExercises: responseData.totalExercisesEver
      });
    }

    res.json({ success: true, data: responseData });

  } catch (error) {
    console.error('❌ Error obteniendo datos históricos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener datos históricos'
    });
  } finally {
    client.release();
  }
});