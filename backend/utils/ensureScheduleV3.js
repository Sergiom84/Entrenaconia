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

    // Calcular total esperado de sesiones para compensación en última semana
    const firstWeekSessions = normalizedPlan.semanas[0]?.sesiones?.length || 0;
    const totalWeeks = normalizedPlan.semanas.length;
    const totalExpectedSessions = firstWeekSessions * totalWeeks;
    // Ajuste del objetivo: usar frecuencia_por_semana si está disponible
    const __expectedPerWeek = Number(planData?.frecuencia_por_semana) || Math.max(
      ...normalizedPlan.semanas.map(sem => Array.isArray(sem?.sesiones) ? sem.sesiones.length : 0)
    );
    const __fixedTotalExpectedSessions = __expectedPerWeek * totalWeeks;

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

      // 🔧 LÓGICA PARA PRIMERA SEMANA Y ÚLTIMA SEMANA
      const isFirstWeek = weekIndex === 0;
      const isLastWeek = weekIndex === normalizedPlan.semanas.length - 1;
      const startDayOfWeek = planStartDate.getDay(); // 0 = Domingo, 1 = Lun, ..., 5 = Vie, 6 = Sáb

      // PRIMERA SEMANA: Usar días consecutivos desde hoy (solo lun-vie)
      if (isFirstWeek && startDayOfWeek > 0 && startDayOfWeek < 6) {
        // Calcular días consecutivos disponibles desde hoy hasta viernes
        const consecutiveDaysAvailable = [];
        for (let d = startDayOfWeek; d <= 5; d++) { // 1=Lun ... 5=Vie
          consecutiveDaysAvailable.push(DAY_ABBREVS[d]);
        }

        const sessionsNeeded = Math.min(sessionsToSchedule.length, consecutiveDaysAvailable.length);

        if (sessionsNeeded > 0) {
          console.log(`[ensureWorkoutScheduleV3] Primera semana: asignando ${sessionsNeeded} sesiones a días consecutivos`, {
            planId: methodologyPlanId,
            díasDisponibles: consecutiveDaysAvailable,
            startDayOfWeek
          });

          // Tomar las primeras N sesiones y asignarlas a días consecutivos
          const redistributedSessions = [];
          for (let i = 0; i < sessionsNeeded; i++) {
            const session = sessionsToSchedule[i];
            const targetDay = consecutiveDaysAvailable[i];
            redistributedSessions.push({ ...session, dia: targetDay });
          }

          sessionsToSchedule = redistributedSessions;

          console.log('[ensureWorkoutScheduleV3] Sesiones asignadas en primera semana:', {
            planId: methodologyPlanId,
            sesionesAsignadas: sessionsToSchedule.map(s => s.dia)
          });
        }
      }

      // ÚLTIMA SEMANA: Compensar déficit de sesiones
      if (isLastWeek && !usePreferences) {
        // Extraer días fijos del nivel desde las sesiones del plan
        const levelFixedDays = [...new Set(
          normalizedPlan.semanas
            .slice(1)
            .flatMap(sem => sem.sesiones || [])
            .map(ses => normalizeDayAbbrev(ses.dia))
            .filter(Boolean)
        )];

        // Calcular cuántas sesiones llevamos programadas hasta ahora (antes de esta semana)
        const sessionsProgrammedSoFar = globalSessionOrder - 1;

        // El déficit es lo que falta para llegar al total esperado
        const deficit = Math.max(0, __fixedTotalExpectedSessions - sessionsProgrammedSoFar);
        const sessionsInLastWeek = deficit;

        console.log('[ensureWorkoutScheduleV3] Calculando compensación para última semana:', {
          planId: methodologyPlanId,
          totalExpectedSessions: __fixedTotalExpectedSessions,
          sessionsProgrammedSoFar,
          deficit,
          sessionsInLastWeek,
          levelFixedDays
        });

        if (sessionsInLastWeek > baseSessions.length) {
          // Necesitamos más sesiones de las que hay en el plan base
          const extendedSessions = [...baseSessions];
          const additionalNeeded = sessionsInLastWeek - baseSessions.length;

          console.log('[ensureWorkoutScheduleV3] Extendiendo última semana:', {
            planId: methodologyPlanId,
            baseSessions: baseSessions.length,
            additionalNeeded
          });

          // Añadir sesiones adicionales usando días fijos en orden cíclico
          for (let i = 0; i < additionalNeeded; i++) {
            const sourceSession = baseSessions[i % baseSessions.length];
            const targetDay = levelFixedDays[extendedSessions.length % levelFixedDays.length];
            extendedSessions.push({
              ...sourceSession,
              dia: targetDay,
              __compensatory: true
            });
          }

          sessionsToSchedule = extendedSessions.map(session => ({ ...session }));

          console.log('[ensureWorkoutScheduleV3] Última semana extendida:', {
            planId: methodologyPlanId,
            totalSessions: sessionsToSchedule.length,
            días: sessionsToSchedule.map(s => s.dia)
          });
        }
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

      if (weekIndex === 0) {
        console.log('[ensureWorkoutScheduleV3] sessionsByDay construido:', {
          planId: methodologyPlanId,
          keys: Array.from(sessionsByDay.keys()),
          sessionsPerKey: Array.from(sessionsByDay.entries()).map(([k, v]) => ({
            dia: k,
            count: v.length
          }))
        });
      }

      let weekSessionOrder = 1;

      // 🗓️ CALENDARIO: Las semanas siempre son Lunes→Domingo
      // Calcular el lunes de la semana en que empieza el plan
      const mondayOfStartWeek = new Date(planStartDate);
      // startDayOfWeek ya fue declarado arriba (línea 141)
      const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek; // Si es domingo, retroceder 6 días
      mondayOfStartWeek.setDate(planStartDate.getDate() + daysToMonday);
      mondayOfStartWeek.setHours(0, 0, 0, 0);

      // 🐛 FIX CRÍTICO: Normalizar planStartDate para comparaciones
      // Sin esto, planStartDate tiene hora (ej: 21:19:07) y currentDate es 00:00:00
      // Causaba que el día de inicio se marcara como descanso y se saltara
      const planStartDateNormalized = new Date(planStartDate);
      planStartDateNormalized.setHours(0, 0, 0, 0);

      if (weekIndex === 0) {
        console.log('[ensureWorkoutScheduleV3] Calendario semana 1:', {
          planId: methodologyPlanId,
          planStartDate: planStartDate.toISOString().split('T')[0],
          planStartDateNormalized: planStartDateNormalized.toISOString().split('T')[0],
          startDayOfWeek: DAY_NAMES[startDayOfWeek],
          mondayOfWeek: mondayOfStartWeek.toISOString().split('T')[0],
          sessionDays: Array.from(sessionsByDay.keys())
        });
      }

      for (let dayInWeek = 0; dayInWeek < 7 || (isLastWeek && sessionsByDay.size > 0); dayInWeek++) {
        // Calcular fecha actual: lunes de la primera semana + offset de semana + día de la semana
        const currentDate = new Date(mondayOfStartWeek);
        currentDate.setDate(mondayOfStartWeek.getDate() + (weekIndex * 7) + dayInWeek);
        currentDate.setHours(0, 0, 0, 0);

        const dow = currentDate.getDay();
        const dayName = DAY_NAMES[dow];
        const dayAbbrev = DAY_ABBREVS[dow];
        const effectiveWeekNumber = weekNumber + Math.floor(dayInWeek / 7);

        // ⏳ PRIMERA SEMANA: Solo programar sesiones desde el día de inicio en adelante
        if (isFirstWeek && currentDate < planStartDateNormalized) {
          await client.query(
            'INSERT INTO app.methodology_plan_days (plan_id, day_id, week_number, day_name, date_local, is_rest) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (plan_id, day_id) DO NOTHING',
            [methodologyPlanId, dayId, effectiveWeekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], true]
          );
          dayId++;
          continue;
        }

        const queue = sessionsByDay.get(dayAbbrev);
        const sesion = queue && queue.length > 0 ? queue.shift() : null;

        if (weekIndex === 0 && dayInWeek >= 2) { // Solo loggear desde miércoles en adelante en semana 1
          console.log(`[ensureWorkoutScheduleV3] Día ${dayInWeek} (${dayAbbrev}):`, {
            planId: methodologyPlanId,
            currentDate: currentDate.toISOString().split('T')[0],
            dayAbbrev,
            queueExists: !!queue,
            queueLength: queue?.length || 0,
            sesionFound: !!sesion,
            sessionsByDayKeys: Array.from(sessionsByDay.keys())
          });
        }

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
            effectiveWeekNumber,
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
          [methodologyPlanId, dayId, effectiveWeekNumber, dayAbbrev, currentDate.toISOString().split('T')[0], false, Array.isArray(sessionExercises) ? sessionExercises.length : 0]
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
