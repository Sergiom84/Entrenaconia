const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const DAY_ABBREVS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function stripDiacritics(str = '') {
  try {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return str;
  }
}

export function normalizeDayAbbrev(dayName) {
  if (!dayName) return dayName;

  const raw = stripDiacritics(String(dayName).trim());
  const lower = raw.toLowerCase().replace(/\.$/, '');
  const cleaned = lower.replace(/[^a-z]/g, '');

  if (cleaned.startsWith('lun')) return 'Lun';
  if (cleaned.startsWith('mar')) return 'Mar';
  if (cleaned.startsWith('mie') || cleaned.startsWith('mir') || cleaned.startsWith('mia')) return 'Mie';
  if (cleaned.startsWith('jue')) return 'Jue';
  if (cleaned.startsWith('vie')) return 'Vie';
  if (cleaned.startsWith('sab')) return 'Sab';
  if (cleaned.startsWith('dom')) return 'Dom';

  return dayName;
}


function normalizePlanDays(planDataJson) {
  try {
    if (!planDataJson || !Array.isArray(planDataJson.semanas)) return planDataJson;
    return {
      ...planDataJson,
      semanas: planDataJson.semanas.map(sem => ({
        ...sem,
        sesiones: Array.isArray(sem.sesiones)
          ? sem.sesiones.map(ses => ({
              ...ses,
              dia: normalizeDayAbbrev(ses.dia)
            }))
          : sem.sesiones
      }))
    };
  } catch (error) {
    console.error('normalizePlanDays error:', error);
    return planDataJson;
  }
}

/**
 * Genera workout_schedule y methodology_plan_days respetando preferencias del usuario.
 */
export async function ensureWorkoutScheduleV3(client, userId, methodologyPlanId, planDataJson, startDate = new Date()) {
  try {
    console.log('[ensureWorkoutScheduleV3] Iniciando', { planId: methodologyPlanId, userId });

    const planData = typeof planDataJson === 'string' ? JSON.parse(planDataJson) : planDataJson;
    if (!planData || !Array.isArray(planData.semanas) || planData.semanas.length === 0) {
      console.warn('[ensureWorkoutScheduleV3] Plan vacio o sin semanas', { planId: methodologyPlanId });
      return;
    }

    const normalizedPlan = normalizePlanDays(planData);

    await client.query(
      'DELETE FROM app.workout_schedule WHERE methodology_plan_id = $1 AND user_id = $2',
      [methodologyPlanId, userId]
    );
    await client.query(
      'DELETE FROM app.methodology_plan_days WHERE plan_id = $1',
      [methodologyPlanId]
    );
    console.log('[ensureWorkoutScheduleV3] Tablas limpiadas', { planId: methodologyPlanId });

    const planStartDate = new Date(startDate);

    let userPrefs = null;
    try {
      const prefsQ = await client.query(
        'SELECT usar_preferencias_ia, dias_preferidos_entrenamiento, ejercicios_por_dia_preferido FROM app.user_profiles WHERE user_id = $1',
        [userId]
      );
      userPrefs = prefsQ.rows?.[0] || null;
    } catch (prefsError) {
      console.warn('[ensureWorkoutScheduleV3] No se pudieron leer preferencias', prefsError?.message || prefsError);
    }

    const preferredAbbrevs = Array.isArray(userPrefs?.dias_preferidos_entrenamiento)
      ? userPrefs.dias_preferidos_entrenamiento.map(d => normalizeDayAbbrev(d)).filter(Boolean)
      : null;
    const usePreferences = Boolean(userPrefs?.usar_preferencias_ia && preferredAbbrevs && preferredAbbrevs.length > 0);
    const limitPerSession = usePreferences && Number(userPrefs?.ejercicios_por_dia_preferido)
      ? Number(userPrefs.ejercicios_por_dia_preferido)
      : null;
    if (limitPerSession) {
      console.log('[ensureWorkoutScheduleV3] Limite ejercicios por sesion', { planId: methodologyPlanId, limitPerSession });
    }

    let dayId = 1;
    let globalSessionOrder = 1;

    for (let weekIndex = 0; weekIndex < normalizedPlan.semanas.length; weekIndex++) {
      const semana = normalizedPlan.semanas[weekIndex];
      const weekNumber = weekIndex + 1;
      const baseSessions = Array.isArray(semana?.sesiones) ? semana.sesiones.filter(Boolean) : [];
      if (baseSessions.length === 0) {
        continue;
      }

      let sessionsToSchedule;
      if (usePreferences) {
        const targetCount = preferredAbbrevs.length;
        sessionsToSchedule = [];
        for (let i = 0; i < targetCount; i++) {
          const source = baseSessions[i % baseSessions.length];
          const assignedDay = preferredAbbrevs[i];
          sessionsToSchedule.push({ ...source, dia: assignedDay, __cloned: i >= baseSessions.length });
        }
        if (baseSessions.length < preferredAbbrevs.length) {
          console.log('[ensureWorkoutScheduleV3] Replicando sesiones para cubrir preferencias', {
            planId: methodologyPlanId,
            weekNumber,
            baseSessions: baseSessions.length,
            preferredDays: preferredAbbrevs
          });
        }
      } else {
        sessionsToSchedule = baseSessions.map(session => ({ ...session }));
      }

      const sessionsByDay = new Map();
      for (const session of sessionsToSchedule) {
        const key = normalizeDayAbbrev(session.dia);
        if (!key) continue;
        if (!sessionsByDay.has(key)) {
          sessionsByDay.set(key, []);
        }
        sessionsByDay.get(key).push(session);
      }

      let weekSessionOrder = 1;

      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        const dayOffset = (weekIndex * 7) + dayInWeek;
        const currentDate = new Date(planStartDate);
        currentDate.setDate(currentDate.getDate() + dayOffset);

        const dow = currentDate.getDay();
        const dayName = DAY_NAMES[dow];
        const dayAbbrev = DAY_ABBREVS[dow];

        const queue = sessionsByDay.get(dayAbbrev);
        const sesion = queue && queue.length > 0 ? queue.shift() : null;
        if (queue && queue.length === 0) {
          sessionsByDay.delete(dayAbbrev);
        }

        if (!sesion) {
          await client.query(
            'INSERT INTO app.methodology_plan_days (plan_id, day_id, week_number, day_name, date_local, is_rest) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (plan_id, day_id) DO NOTHING',
            [methodologyPlanId, dayId, weekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], true]
          );
          dayId++;
          continue;
        }

        const sessionTitle = sesion?.titulo || sesion?.title || `Sesion ${globalSessionOrder}`;
        let sessionExercises = [];

        if (Array.isArray(sesion.ejercicios)) {
          sessionExercises = sesion.ejercicios;
        } else if (Array.isArray(sesion.bloques)) {
          const mainBlock = sesion.bloques.find(b => {
            const name = stripDiacritics(String(b?.nombre || b?.name || b?.titulo || '').toLowerCase());
            const tipo = stripDiacritics(String(b?.tipo || '').toLowerCase());
            return tipo === 'principal' || tipo === 'main' || name.includes('principal') || name.includes('trabajo');
          });
          const sourceBlocks = mainBlock ? [mainBlock] : sesion.bloques;
          sessionExercises = sourceBlocks.flatMap(b => Array.isArray(b?.ejercicios) ? b.ejercicios : []);
        }

        if (limitPerSession && Array.isArray(sessionExercises) && sessionExercises.length > limitPerSession) {
          console.log('[ensureWorkoutScheduleV3] Recortando ejercicios', {
            planId: methodologyPlanId,
            weekNumber,
            dayAbbrev,
            before: sessionExercises.length,
            limit: limitPerSession
          });
          sessionExercises = sessionExercises.slice(0, limitPerSession);
        }

        await client.query(
          'INSERT INTO app.workout_schedule (methodology_plan_id, user_id, week_number, session_order, week_session_order, scheduled_date, day_name, day_abbrev, session_title, exercises, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [
            methodologyPlanId,
            userId,
            weekNumber,
            globalSessionOrder,
            weekSessionOrder,
            currentDate.toISOString().split('T')[0],
            dayName,
            dayAbbrev,
            sessionTitle,
            JSON.stringify(sessionExercises),
            'scheduled'
          ]
        );

        await client.query(
          'INSERT INTO app.methodology_plan_days (plan_id, day_id, week_number, day_name, date_local, is_rest, planned_exercises_count) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (plan_id, day_id) DO NOTHING',
          [methodologyPlanId, dayId, weekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], false, Array.isArray(sessionExercises) ? sessionExercises.length : 0]
        );

        dayId++;
        globalSessionOrder++;
        weekSessionOrder++;
      }

      if (sessionsByDay.size > 0) {
        console.warn('[ensureWorkoutScheduleV3] Sesiones sin asignar despues de iterar dias', {
          planId: methodologyPlanId,
          weekNumber,
          remainingKeys: Array.from(sessionsByDay.keys())
        });
      }
    }

    const totalSessions = globalSessionOrder - 1;
    const totalDays = dayId - 1;
    const restDays = totalDays - totalSessions;

    console.log('[ensureWorkoutScheduleV3] Programacion generada', {
      planId: methodologyPlanId,
      totalDays,
      trainingDays: totalSessions,
      restDays,
      startDate: startDate instanceof Date ? startDate.toISOString().split('T')[0] : String(startDate)
    });
  } catch (error) {
    console.error('Error en ensureWorkoutScheduleV3:', error?.message || error);
  }
}
