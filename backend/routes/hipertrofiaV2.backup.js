/**
 * Rutas de HipertrofiaV2 - Sistema de Tracking con RIR
 * Endpoints para evaluación, selección de ejercicios y tracking
 */

import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Función helper: Limpiar drafts del usuario
 */
async function cleanUserDrafts(userId, client = null) {
  const dbClient = client || pool;
  try {
    await dbClient.query(
      `DELETE FROM app.methodology_plans
       WHERE user_id = $1 AND status = 'draft'`,
      [userId]
    );
  } catch (error) {
    console.error('Error limpiando drafts:', error.message);
  }
}

/**
 * POST /api/hipertrofiav2/generate
 * Genera plan de HipertrofiaV2 con ejercicios pre-seleccionados desde el frontend
 */
router.post('/generate', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { planData } = req.body;

    if (!planData) {
      return res.status(400).json({
        success: false,
        error: 'planData es requerido'
      });
    }

    console.log('🏋️ Generando plan HipertrofiaV2 para usuario:', userId);

    await dbClient.query('BEGIN');

    // Limpiar drafts previos
    await cleanUserDrafts(userId, dbClient);

    // Insertar plan en methodology_plans
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `, [userId, 'HipertrofiaV2', JSON.stringify(planData), 'manual', 'draft']);

    const methodologyPlanId = planResult.rows[0].id;

    await dbClient.query('COMMIT');

    console.log(`✅ Plan HipertrofiaV2 guardado con ID: ${methodologyPlanId}`);

    res.json({
      success: true,
      plan: planData,
      methodologyPlanId,
      planId: methodologyPlanId,
      message: 'Plan de HipertrofiaV2 generado exitosamente'
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error generando plan HipertrofiaV2:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar plan de HipertrofiaV2',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

/**
 * POST /api/hipertrofiav2/generate-d1d5
 * Genera plan completo D1-D5 (Motor MindFeed)
 * Este es el NUEVO sistema de generación que reemplaza A/B/C
 */
router.post('/generate-d1d5', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    // Ajustar duración según teoría: 10 semanas principiante, 12 intermedio/avanzado
    const { nivel: nivelRaw = 'Principiante', totalWeeks: totalWeeksRaw, startConfig, includeWeek0 = true } = req.body;
    const nivel = nivelRaw;
    const defaultWeeks = nivel === 'Principiante' ? 10 : 12;
    const totalWeeks = totalWeeksRaw ?? defaultWeeks;

    console.log('🏋️ [MINDFEED] Generando plan D1-D5 para usuario:', userId, 'Nivel:', nivel);
    console.log('📅 Duración total:', totalWeeks, 'semanas + Semana 0:', includeWeek0);
    
    // Obtener información del usuario incluyendo sexo
    const userResult = await dbClient.query(
      `SELECT sexo FROM app.users WHERE id = $1`,
      [userId]
    );
    const userSex = userResult.rows[0]?.sexo || 'male'; // Default a male si no especificado
    const isFemale = userSex === 'female' || userSex === 'f' || userSex === 'mujer' || userSex === 'femenino';

    console.log('👤 Sexo del usuario:', userSex, 'Aplicar ajuste femenino:', isFemale);

    // 🎯 Obtener estado de priorización muscular activa
    const priorityResult = await dbClient.query(
      `SELECT priority_muscle FROM app.hipertrofia_v2_state WHERE user_id = $1`,
      [userId]
    );
    const priorityMuscle = priorityResult.rows[0]?.priority_muscle || null;

    if (priorityMuscle) {
      console.log(`🎯 [PRIORIDAD] Músculo prioritario detectado: ${priorityMuscle}`);
    }

    // 🆕 Log de configuración de inicio si existe
    if (startConfig) {
      console.log('🗓️ Configuración de inicio recibida:', startConfig);
    }

    // 🆕 Calcular calendario cíclico D1–D5: D1 es el día real de inicio, rota como “rueda de tanque”
    // Reglas:
    // - Entrenamos Lun–Vie por defecto.
    // - Si includeSaturday es true Y el startDay es jueves, se permite usar SOLO el primer sábado del ciclo inicial.
    let dynamicDayMapping = {};
    let trainingDays = null;
    const includeSaturday = startConfig?.distributionOption === 'saturdays' || startConfig?.includeSaturdays;

    const cycleLength = 5; // HipertrofiaV2 siempre D1–D5
    const sessionsNeeded = (totalWeeks || defaultWeeks) * cycleLength;

    if (startConfig?.startDate) {
      const startDate = new Date(startConfig.startDate);
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const startDay = startDate.getDay();
      const allowOneSaturday = includeSaturday && startDay === 4; // solo si empieza en jueves

      trainingDays = [];
      let currentDate = new Date(startDate);
      let usedSaturday = false;

      while (trainingDays.length < sessionsNeeded) {
        const dayOfWeek = currentDate.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const canUseFirstSaturday = allowOneSaturday && !usedSaturday && dayOfWeek === 6;

        const isValidTrainingDay = isWeekday || canUseFirstSaturday;

        if (isValidTrainingDay) {
          trainingDays.push({
            date: new Date(currentDate),
            dayName: dayNames[dayOfWeek],
            sessionNumber: trainingDays.length + 1,
            cycleDay: ((trainingDays.length) % cycleLength) + 1 // rota D1..D5
          });

          if (canUseFirstSaturday) {
            usedSaturday = true;
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Mapear D1-D5 con los primeros 5 días válidos del calendario real
      for (let i = 0; i < cycleLength; i++) {
        if (trainingDays[i]) {
          dynamicDayMapping[`D${i + 1}`] = trainingDays[i].dayName;
        }
      }

      console.log('🔄 [MINDFEED] Mapeo dinámico D1-D5:', dynamicDayMapping);
      console.log(`📅 Total sesiones generadas: ${trainingDays.length}`);
      console.log(`📅 Primeras sesiones:`, trainingDays.slice(0, 10).map(d => `${d.sessionNumber}: ${d.dayName} (${d.date.toISOString().split('T')[0]})`));
      console.log(`📅 Últimas sesiones:`, trainingDays.slice(-5).map(d => `${d.sessionNumber}: ${d.dayName} (${d.date.toISOString().split('T')[0]})`));
    } else {
      dynamicDayMapping = {
        'D1': 'Lunes',
        'D2': 'Martes',
        'D3': 'Miércoles',
        'D4': 'Jueves',
        'D5': 'Viernes'
      };
      console.log('⚠️ [MINDFEED] Sin fecha de inicio, usando mapeo por defecto');
    }

    await dbClient.query('BEGIN');

    // Limpiar drafts previos
    await cleanUserDrafts(userId, dbClient);

    // 1. Obtener configuración de sesiones D1-D5
    const sessionsConfigResult = await dbClient.query(`
      SELECT * FROM app.hipertrofia_v2_session_config
      ORDER BY cycle_day
    `);

    if (sessionsConfigResult.rows.length === 0) {
      throw new Error('No se encontró configuración de sesiones D1-D5. Ejecuta el script SQL de migración.');
    }

    const sessionsConfig = sessionsConfigResult.rows;
    console.log(`📋 Configuraciones D1-D5 cargadas: ${sessionsConfig.length} sesiones`);

    // Deduplicar por cycle_day en caso de que la migración se ejecutara dos veces
    const seenDays = new Set();
    const uniqueConfigs = [];
    for (const row of sessionsConfig) {
      if (!seenDays.has(row.cycle_day)) {
        uniqueConfigs.push(row);
        seenDays.add(row.cycle_day);
      }
    }
    if (uniqueConfigs.length !== sessionsConfig.length) {
      console.log(`⚠️ [MINDFEED] Duplicados detectados en session_config. Usando únicos por cycle_day: ${uniqueConfigs.length}`);
    }

    // 2. Generar ejercicios para cada sesión del ciclo
    const sessionsWithExercises = [];

    for (const sessionConfig of uniqueConfigs) {
      let muscleGroupsRaw = sessionConfig.muscle_groups;
      let muscleGroups = [];

      try {
        if (Array.isArray(muscleGroupsRaw)) {
          muscleGroups = muscleGroupsRaw;
        } else if (typeof muscleGroupsRaw === 'string') {
          muscleGroups = JSON.parse(muscleGroupsRaw);
        } else if (muscleGroupsRaw && typeof muscleGroupsRaw === 'object') {
          muscleGroups = Object.values(muscleGroupsRaw);
        }
      } catch {
        console.warn('⚠️ [MINDFEED] muscle_groups en formato CSV, aplicando fallback:', muscleGroupsRaw);
        muscleGroups = String(muscleGroupsRaw)
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
      }

      if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        console.warn('⚠️ [MINDFEED] Sesión sin grupos musculares válidos, usando fallback genérico para D', sessionConfig.cycle_day);
        muscleGroups = ['Pecho'];
      }

      const cycleDay = sessionConfig.cycle_day;

      console.log(`🎯 Generando D${cycleDay}: ${sessionConfig.session_name}`);

      const sessionExercises = [];

      // Mapeo de grupos musculares a categorías de BD
      const muscleToCategoryMap = {
        'Pecho': 'Pecho',
        'Tríceps': 'Tríceps',
        'Triceps': 'Tríceps',
        'Espalda': 'Espalda',
        'Bíceps': 'Bíceps',
        'Biceps': 'Bíceps',
        'Cuádriceps': 'Piernas (cuádriceps)',
        'Cuadriceps': 'Piernas (cuádriceps)',
        'Femoral': 'Piernas (femoral)',
        'Glúteos': 'Glúteos',
        'Gluteos': 'Glúteos',
        'Hombro': 'Hombro',
        'Core': 'Core'
      };

      // Para cada grupo muscular de la sesión
      for (const muscleGroup of muscleGroups) {
        const categoria = muscleToCategoryMap[muscleGroup] || muscleGroup;

        // Seleccionar ejercicios por tipo
        // Multiarticulares
        for (let i = 0; i < sessionConfig.multiarticular_count; i++) {
          const multiResult = await dbClient.query(`
            SELECT
              exercise_id,
              nombre,
              categoria,
              tipo_ejercicio,
              patron_movimiento,
              orden_recomendado,
              series_reps_objetivo,
              descanso_seg,
              notas
            FROM app."Ejercicios_Hipertrofia"
            WHERE nivel = $1
              AND categoria = $2
              AND tipo_ejercicio = 'multiarticular'
            ORDER BY RANDOM()
            LIMIT 1
          `, [nivel, categoria]);

          if (multiResult.rows.length > 0) {
            sessionExercises.push({
              ...multiResult.rows[0],
              cycle_day: cycleDay,
              muscle_group: muscleGroup,
              tipo: 'multiarticular'
            });
          }
        }

        // Unilaterales
        for (let i = 0; i < sessionConfig.unilateral_count; i++) {
          const uniResult = await dbClient.query(`
            SELECT
              exercise_id,
              nombre,
              categoria,
              tipo_ejercicio,
              patron_movimiento,
              orden_recomendado,
              series_reps_objetivo,
              descanso_seg,
              notas
            FROM app."Ejercicios_Hipertrofia"
            WHERE nivel = $1
              AND categoria = $2
              AND tipo_ejercicio = 'unilateral'
            ORDER BY RANDOM()
            LIMIT 1
          `, [nivel, categoria]);

          if (uniResult.rows.length > 0) {
            sessionExercises.push({
              ...uniResult.rows[0],
              cycle_day: cycleDay,
              muscle_group: muscleGroup,
              tipo: 'unilateral'
            });
          }
        }

        // Analíticos
        for (let i = 0; i < sessionConfig.analitico_count; i++) {
          const analyticResult = await dbClient.query(`
            SELECT
              exercise_id,
              nombre,
              categoria,
              tipo_ejercicio,
              patron_movimiento,
              orden_recomendado,
              series_reps_objetivo,
              descanso_seg,
              notas
            FROM app."Ejercicios_Hipertrofia"
            WHERE nivel = $1
              AND categoria = $2
              AND tipo_ejercicio = 'analitico'
            ORDER BY RANDOM()
            LIMIT 1
          `, [nivel, categoria]);

          if (analyticResult.rows.length > 0) {
            sessionExercises.push({
              ...analyticResult.rows[0],
              cycle_day: cycleDay,
              muscle_group: muscleGroup,
              tipo: 'analitico'
            });
          }
        }
      }

      // Ordenar ejercicios ESTRICTAMENTE por tipo: Multi → Uni → Ana (teoría MindFeed)
      const tipoOrden = { 'multiarticular': 1, 'unilateral': 2, 'analitico': 3 };
      sessionExercises.sort((a, b) => {
        const ordenA = tipoOrden[a.tipo_ejercicio] || 99;
        const ordenB = tipoOrden[b.tipo_ejercicio] || 99;
        if (ordenA !== ordenB) return ordenA - ordenB;
        // Si mismo tipo, usar orden_recomendado de BD
        return (a.orden_recomendado || 0) - (b.orden_recomendado || 0);
      });

      // Log de verificación de orden
      console.log(`  📋 D${cycleDay} - Orden final: ${sessionExercises.map(e => e.tipo_ejercicio[0].toUpperCase()).join(' → ')}`);

      // Mapear ejercicios con parámetros base
      let exercisesWithParams = sessionExercises.map((ex, idx) => ({
          orden: idx + 1,
          id: ex.exercise_id,
          exercise_id: ex.exercise_id,
          nombre: ex.nombre,
          categoria: ex.categoria,
          tipo_ejercicio: ex.tipo_ejercicio,
          patron_movimiento: ex.patron_movimiento,
          // VOLUMEN FIJO: Series nunca cambian durante el bloque (solo carga progresa)
          series: sessionConfig.default_sets, // Fijo en 3 series (teoría MindFeed)
          reps_objetivo: sessionConfig.default_reps_range,
          rir_target: sessionConfig.default_rir_target,
          // Ajuste de descanso por sexo según teoría (-15% para mujeres en uni/analítico)
          descanso_seg: (() => {
            const baseRest = ex.descanso_seg || 90;
            if (isFemale && (ex.tipo_ejercicio === 'unilateral' || ex.tipo_ejercicio === 'analitico')) {
              return Math.round(baseRest * 0.85); // -15% para mujeres
            }
            return baseRest;
          })(),
          notas: ex.notas,
          intensidad_porcentaje: sessionConfig.intensity_percentage,
          ajuste_sexo: isFemale && (ex.tipo_ejercicio === 'unilateral' || ex.tipo_ejercicio === 'analitico')
            ? '-15% descanso (ajuste femenino)'
            : null
        }));

      // 🎯 Aplicar ajustes de priorización muscular (si está activa)
      exercisesWithParams = applyPriorityIntensityAdjustments(
        exercisesWithParams,
        priorityMuscle,
        sessionConfig.is_heavy_day
      );

      if (priorityMuscle && sessionConfig.is_heavy_day) {
        console.log(`  🎯 [PRIORIDAD] Ajustes aplicados para ${priorityMuscle} en D${cycleDay}`);
      }

      sessionsWithExercises.push({
        cycle_day: cycleDay,
        session_name: sessionConfig.session_name,
        description: sessionConfig.description,
        coach_tip: sessionConfig.coach_tip,
        intensity_percentage: sessionConfig.intensity_percentage,
        is_heavy_day: sessionConfig.is_heavy_day,
        muscle_groups: muscleGroups,
        exercises: exercisesWithParams
      });

      console.log(`  ✅ D${cycleDay}: ${sessionExercises.length} ejercicios seleccionados`);
    }

    // 3. Crear estructura del plan con Semana 0 de calibración
    // Plantilla de sesiones por ciclo (lookup por D1..D5)
    const templateByCycleDay = new Map(
      sessionsWithExercises
        .sort((a, b) => a.cycle_day - b.cycle_day)
        .map((session) => [
          session.cycle_day,
          {
            nombre: session.session_name,
            ciclo_dia: session.cycle_day,
            descripcion: session.description,
            coach_tip: session.coach_tip,
            intensidad_porcentaje: session.intensity_percentage,
            es_dia_pesado: session.is_heavy_day,
            grupos_musculares: session.muscle_groups,
            ejercicios: session.exercises.map((exercise) => ({ ...exercise }))
          }
        ])
    );

    // Generar semanas de entrenamiento usando el calendario real calculado
    const semanas = [];
    
    // Añadir Semana 0 de calibración si está habilitada
    if (includeWeek0) {
      const semana0Sessions = Array.from({ length: cycleLength }, (_, idx) => {
        const cycleDay = idx + 1;
        const template = templateByCycleDay.get(cycleDay);
        const actualDayName = trainingDays?.[idx]?.dayName || dynamicDayMapping[`D${cycleDay}`] || `D${cycleDay}`;

        return {
          ...JSON.parse(JSON.stringify(template)),
          dia: actualDayName,
          fecha: trainingDays?.[idx]?.date ? trainingDays[idx].date.toISOString().split('T')[0] : null, // ✅ Añadir fecha real
          orden: idx + 1,
          id: `W0-D${cycleDay}`,
          intensidad_porcentaje: 70, // Semana 0 siempre al 70% según teoría
          es_calibracion: true,
          coach_tip: 'Semana de calibración: Enfócate en la técnica correcta y el control del movimiento. No busques fatiga.',
          ejercicios: template.ejercicios.map((ex) => ({
            ...ex,
            intensidad_porcentaje: 70,
            rir_target: '4-5', // RIR más alto para calibración
            notas: `${ex.notas || ''} - SEMANA DE CALIBRACIÓN: Prioriza técnica sobre carga`
          }))
        };
      });

      semanas.push({
        numero: 0,
        tipo: 'calibracion',
        descripcion: 'Semana de calibración técnica y ajuste de cargas',
        sesiones: semana0Sessions,
        // Metadata para el sistema
        is_week_zero: true,
        no_progression: true, // NO aplicar progresión de carga en esta semana
        objetivo: 'Establecer técnica base y calibrar cargas iniciales (70% 1RM)'
      });

      console.log('✅ [WEEK 0] Semana de calibración añadida (70% intensidad, RIR 4-5, sin progresión)');
    }

    // Añadir semanas regulares de entrenamiento (cíclico)
    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
      const weekSessions = Array.from({ length: cycleLength }, (_, idx) => {
        const sessionNumber = weekIndex * cycleLength + idx; // 0-based
        const cycleDay = (sessionNumber % cycleLength) + 1;
        const template = templateByCycleDay.get(cycleDay);
        const calendarDay =
          startConfig?.startDate && trainingDays
            ? trainingDays[sessionNumber]
            : null;

        const actualDayName =
          calendarDay?.dayName ||
          dynamicDayMapping[`D${cycleDay}`] ||
          `D${cycleDay}`;

        return {
          ...JSON.parse(JSON.stringify(template)),
          dia: actualDayName,
          fecha: calendarDay?.date ? calendarDay.date.toISOString().split('T')[0] : null, // ✅ Añadir fecha real
          orden: idx + 1,
          id: `W${weekIndex + 1}-D${cycleDay}`
        };
      });

      semanas.push({
        numero: weekIndex + 1,
        tipo: 'entrenamiento',
        sesiones: weekSessions
      });
    }

    const planData = {
      metodologia: 'HipertrofiaV2_MindFeed',
      version: 'MindFeed_v2.0', // Actualizado con semana 0
      nivel,
      ciclo_type: 'D1-D5',
      total_weeks: totalWeeks,
      has_week_0: includeWeek0,
      duracion_total_semanas: includeWeek0 ? totalWeeks + 1 : totalWeeks,
      frecuencia_semanal: cycleLength,
      fecha_inicio: new Date().toISOString(),
      sessions: sessionsWithExercises,
      semanas,
      configuracion: {
        progression_type: 'microcycle',
        progression_increment: 2.5,
        deload_trigger: 6,
        rir_target: '2-3',
        tracking_enabled: true,
        week_0_intensity: 70, // Intensidad de semana 0
        duration_weeks: nivel === 'Principiante' ? 10 : 12, // Duración según teoría
        sex_adjusted: isFemale, // Indica si se aplicaron ajustes por sexo
        rest_adjustment_factor: isFemale ? 0.85 : 1.0 // Factor de ajuste de descanso
      }
    };

    // 4. Guardar plan en methodology_plans
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id, methodology_type, plan_data, generation_mode, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `, [userId, 'HipertrofiaV2_MindFeed', JSON.stringify(planData), 'manual', 'draft']);

    const methodologyPlanId = planResult.rows[0].id;

    // 5. Crear estado inicial del usuario en hipertrofia_v2_state
    await dbClient.query(`
      INSERT INTO app.hipertrofia_v2_state (
        user_id,
        methodology_plan_id,
        cycle_day,
        microcycles_completed,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        methodology_plan_id = EXCLUDED.methodology_plan_id,
        cycle_day = 1,
        microcycles_completed = 0,
        deload_active = false,
        updated_at = NOW()
    `, [userId, methodologyPlanId, 1, 0]);

    // 🆕 6. Guardar configuración de inicio si existe
    if (startConfig) {
      console.log('💾 Guardando configuración de inicio en plan_start_config...');

      const startDate = startConfig.startDate === 'today'
        ? new Date()
        : startConfig.startDate === 'next_monday'
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
            return d;
          })()
        : new Date();

      // 🎯 Forzar patrón D1-D5 (5 días) para HipertrofiaV2
      const includeSaturdays = startConfig.includeSaturdays || false;
      const firstWeekPattern = (trainingDays && trainingDays.length >= cycleLength)
        ? trainingDays.slice(0, cycleLength).map((d) => d.dayName).join('-')
        : 'Lun-Mar-Mie-Jue-Vie';

      await dbClient.query(`
        INSERT INTO app.plan_start_config (
          methodology_plan_id,
          user_id,
          start_day_of_week,
          start_date,
          first_week_pattern,
          include_saturdays,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (methodology_plan_id) DO UPDATE SET
          start_day_of_week = EXCLUDED.start_day_of_week,
          start_date = EXCLUDED.start_date,
          first_week_pattern = EXCLUDED.first_week_pattern,
          include_saturdays = EXCLUDED.include_saturdays,
          updated_at = NOW()
      `, [
        methodologyPlanId,
        userId,
        startDate.getDay(),
        startDate.toISOString().split('T')[0],
        firstWeekPattern,
        includeSaturdays
      ]);

      console.log('✅ Configuración de inicio guardada:', {
        firstWeekPattern,
        includeSaturdays,
        startDay: startDate.toISOString().split('T')[0]
      });
    }

    await dbClient.query('COMMIT');

    console.log(`✅ [MINDFEED] Plan D1-D5 generado con ID: ${methodologyPlanId}`);

    res.json({
      success: true,
      plan: planData,
      methodologyPlanId,
      planId: methodologyPlanId,
      message: 'Plan MindFeed D1-D5 generado exitosamente',
      system_info: {
        motor: 'MindFeed v1.0',
        ciclo: 'D1-D5',
        progresion: 'Por microciclo (+2.5%)',
        deload: 'Automático cada 6 ciclos'
      }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ [MINDFEED] Error generando plan D1-D5:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar plan MindFeed D1-D5',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

/**
 * POST /api/hipertrofiav2/select-exercises
 * Selecciona ejercicios aleatorios desde Ejercicios_Hipertrofia
 */
router.post('/select-exercises', async (req, res) => {
  try {
    const { categoria, nivel, cantidad = 1 } = req.body;

    console.log(`🎲 Seleccionando ${cantidad} ejercicio(s) de ${categoria} para ${nivel}`);

    // Query con ORDER BY RANDOM() para variedad
    const result = await pool.query(`
      SELECT
        exercise_id,
        nombre,
        nivel,
        categoria,
        patron,
        equipamiento,
        series_reps_objetivo,
        descanso_seg,
        notas,
        "Cómo_hacerlo" as como_hacerlo,
        "Consejos" as consejos,
        "Errores_comunes" as errores_comunes
      FROM app."Ejercicios_Hipertrofia"
      WHERE nivel = $1
        AND categoria = $2
      ORDER BY RANDOM()
      LIMIT $3
    `, [nivel, categoria, cantidad]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontraron ejercicios de ${categoria} para nivel ${nivel}`
      });
    }

    res.json({
      success: true,
      exercises: result.rows.map(ex => ({
        ...ex,
        series: 3, // Principiantes: 3 series
        reps: '8-12',
        rir_target: '2-3'
      }))
    });

  } catch (error) {
    console.error('Error seleccionando ejercicios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al seleccionar ejercicios'
    });
  }
});

/**
 * POST /api/hipertrofiav2/save-set
 * Guarda los datos de una serie (peso, reps, RIR)
 * ACTUALIZADO: Soporta flag is_warmup para series de calentamiento
 */
router.post('/save-set', async (req, res) => {
  try {
    console.log('🔍 DEBUG Backend - Body recibido:', req.body);

    const {
      userId,
      methodologyPlanId,
      sessionId,
      exerciseId,
      exercise_id, // También intentar con snake_case
      exerciseName,
      exercise_name, // También intentar con snake_case
      setNumber,
      set_number, // También intentar con snake_case
      weight,
      weight_used, // También intentar con snake_case
      reps,
      reps_completed, // También intentar con snake_case
      rir,
      rir_reported, // También intentar con snake_case
      isWarmup,
      is_warmup // También intentar con snake_case
    } = req.body;

    // Normalizar datos (aceptar ambos formatos)
    const normalizedExerciseId = exerciseId || exercise_id;
    const normalizedExerciseName = exerciseName || exercise_name;
    const normalizedSetNumber = setNumber || set_number;
    const normalizedWeight = weight || weight_used;
    const normalizedReps = reps || reps_completed;
    const normalizedRir = rir !== undefined ? rir : rir_reported;
    const normalizedIsWarmup = isWarmup !== undefined ? isWarmup : (is_warmup || false);

    console.log(`💾 Guardando serie ${normalizedSetNumber} de ${normalizedExerciseName}`);
    if (normalizedIsWarmup) {
      console.log('🔥 Serie de CALENTAMIENTO - No cuenta como volumen efectivo');
    }

    // Calcular valores derivados
    const isEffective = !normalizedIsWarmup && normalizedRir <= 4;
    const volumeLoad = !normalizedIsWarmup ? normalizedWeight * normalizedReps : 0;
    const estimated1RM = !normalizedIsWarmup && normalizedReps > 0
      ? normalizedWeight * (1 + normalizedReps * 0.0333)
      : null;

    const result = await pool.query(`
      INSERT INTO app.hypertrophy_set_logs (
        user_id,
        methodology_plan_id,
        session_id,
        exercise_id,
        exercise_name,
        set_number,
        weight_used,
        reps_completed,
        rir_reported,
        is_warmup,
        is_effective,
        volume_load,
        estimated_1rm
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      userId,
      methodologyPlanId,
      sessionId,
      normalizedExerciseId,
      normalizedExerciseName,
      normalizedSetNumber,
      normalizedWeight,
      normalizedReps,
      normalizedRir,
      normalizedIsWarmup,
      isEffective,
      volumeLoad,
      estimated1RM
    ]);

    res.json({
      success: true,
      setData: result.rows[0],
      isWarmup: normalizedIsWarmup,
      isEffective: isEffective
    });

  } catch (error) {
    console.error('Error guardando serie:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar serie'
    });
  }
});

/**
 * GET /api/hipertrofiav2/progression/:userId/:exerciseId
 * Obtiene la progresión de un ejercicio específico
 */
router.get('/progression/:userId/:exerciseId', async (req, res) => {
  try {
    const { userId, exerciseId } = req.params;

    const result = await pool.query(`
      SELECT * FROM app.hypertrophy_progression
      WHERE user_id = $1 AND exercise_id = $2
    `, [userId, exerciseId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        progression: null,
        message: 'No hay progresión registrada aún'
      });
    }

    res.json({
      success: true,
      progression: result.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo progresión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener progresión'
    });
  }
});

/**
 * POST /api/hipertrofiav2/update-progression
 * Actualiza la progresión de un ejercicio después de una sesión
 */
router.post('/update-progression', async (req, res) => {
  try {
    const { userId, exerciseId, exerciseName } = req.body;

    console.log(`📊 Actualizando progresión de ${exerciseName} para usuario ${userId}`);

    // Llamar a la función SQL que calcula progresión
    await pool.query(`
      SELECT app.update_exercise_progression($1, $2, $3)
    `, [userId, exerciseId, exerciseName]);

    // Obtener progresión actualizada
    const result = await pool.query(`
      SELECT * FROM app.hypertrophy_progression
      WHERE user_id = $1 AND exercise_id = $2
    `, [userId, exerciseId]);

    res.json({
      success: true,
      progression: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando progresión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar progresión'
    });
  }
});

/**
 * GET /api/hipertrofiav2/session-summary/:sessionId
 * Obtiene el resumen de una sesión de entrenamiento
 */
router.get('/session-summary/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(`
      SELECT
        exercise_name,
        COUNT(*) as total_sets,
        SUM(volume_load) as total_volume,
        AVG(rir_reported) as avg_rir,
        MAX(estimated_1rm) as best_pr,
        AVG(CASE WHEN is_effective THEN 1.0 ELSE 0.0 END) * 100 as effective_percentage
      FROM app.hypertrophy_set_logs
      WHERE session_id = $1
      GROUP BY exercise_name
      ORDER BY exercise_name
    `, [sessionId]);

    res.json({
      success: true,
      summary: result.rows
    });

  } catch (error) {
    console.error('Error obteniendo resumen de sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen'
    });
  }
});

/**
 * POST /api/hipertrofiav2/generate-fullbody
 * Genera una rutina Full Body para entrenamientos de fin de semana
 */
router.post('/generate-fullbody', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { nivel = 'Principiante' } = req.body;

    console.log('💪 Generando rutina Full Body para usuario:', userId, 'Nivel:', nivel);

    await dbClient.query('BEGIN');

    // Limpiar drafts previos
    await cleanUserDrafts(userId, dbClient);

    // Seleccionar ejercicios para Full Body (uno por grupo muscular principal)
    const fullBodyExercises = [];

    // Categorías principales para Full Body y el número de ejercicios por categoría
    const categoriesConfig = [
      { category: 'Pecho', count: 1, priority: 1 },
      { category: 'Espalda', count: 1, priority: 1 },
      { category: 'Piernas (cuádriceps)', count: 1, priority: 1 },
      { category: 'Hombro', count: 1, priority: 2 },
      { category: 'Core', count: 1, priority: 3 },
      { category: nivel === 'Avanzado' ? 'Bíceps' : null, count: 1, priority: 4 },
      { category: nivel === 'Avanzado' ? 'Tríceps' : null, count: 1, priority: 4 }
    ].filter(c => c.category !== null);

    // Obtener ejercicios para cada categoría
    for (const config of categoriesConfig) {
      const exerciseQuery = await dbClient.query(`
        SELECT
          exercise_id as id,
          nombre,
          categoria,
          patron,
          series_reps_objetivo,
          descanso_seg,
          notas
        FROM app."Ejercicios_Hipertrofia"
        WHERE categoria = $1
        AND nivel = $2
        AND (patron LIKE '%Compuesto%' OR patron LIKE '%horizontal%' OR patron LIKE '%vertical%')
        ORDER BY RANDOM()
        LIMIT $3
      `, [config.category, nivel, config.count]);

      if (exerciseQuery.rows.length > 0) {
        fullBodyExercises.push(...exerciseQuery.rows.map(ex => ({
          ...ex,
          // Ajustar series para Full Body (menos volumen por ejercicio)
          series_reps_objetivo: nivel === 'Principiante' ? '2-3x10-12' : '3x8-10',
          descanso_seg: nivel === 'Principiante' ? 60 : 75,
          notas_fullbody: 'Ejercicio adaptado para rutina Full Body de fin de semana'
        })));
      }
    }

    console.log(`📊 Seleccionados ${fullBodyExercises.length} ejercicios para Full Body`);

    // Crear plan de metodología Full Body
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id,
        methodology_type,
        plan_name,
        training_days_per_week,
        total_weeks,
        status,
        created_at,
        updated_at,
        plan_data,
        plan_description
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8)
      RETURNING id, methodology_type, plan_name
    `, [
      userId,
      'full-body',
      `Full Body ${nivel} - Fin de Semana`,
      1, // Un día de entrenamiento
      1, // Una semana (sesión única)
      'active',
      JSON.stringify({
        exercises: fullBodyExercises,
        nivel: nivel,
        type: 'weekend_fullbody',
        generated_for: 'weekend_training',
        notes: 'Rutina Full Body diseñada para entrenamientos de fin de semana cuando no se puede seguir el plan regular'
      }),
      'Rutina Full Body completa para entrenar todo el cuerpo en una sesión. Ideal para días de fin de semana o cuando no puedes seguir tu rutina regular.'
    ]);

    const methodologyPlanId = planResult.rows[0].id;

    // Crear una única sesión de entrenamiento
    const sessionData = {
      dia: 1,
      sesion_numero: 1,
      ejercicios: fullBodyExercises.map((exercise, index) => ({
        orden: index + 1,
        id: exercise.id, // Para compatibilidad con frontend
        exercise_id: exercise.id, // Para tracking RIR
        nombre: exercise.nombre,
        categoria: exercise.categoria,
        series: parseInt(exercise.series_reps_objetivo.split('x')[0].split('-')[0]),
        reps_objetivo: exercise.series_reps_objetivo.split('x')[1] || '10-12',
        descanso_seg: exercise.descanso_seg,
        notas: exercise.notas_fullbody || exercise.notas,
        patron: exercise.patron
      }))
    };

    // Insertar la sesión en methodology_exercise_sessions
    await dbClient.query(`
      INSERT INTO app.methodology_exercise_sessions (
        methodology_plan_id,
        session_number,
        session_name,
        exercises,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [
      methodologyPlanId,
      1,
      'Full Body - Sesión Completa',
      JSON.stringify(sessionData.ejercicios)
    ]);

    // Crear entrada en workout_schedule para hoy
    await dbClient.query(`
      INSERT INTO app.workout_schedule (
        user_id,
        methodology_plan_id,
        scheduled_date,
        week_number,
        day_in_week,
        session_number,
        completed,
        created_at
      ) VALUES ($1, $2, CURRENT_DATE, 1, 1, 1, false, NOW())
    `, [userId, methodologyPlanId]);

    // Guardar configuración especial para Full Body
    const currentDayOfWeek = new Date().getDay(); // 0 = Domingo, 6 = Sábado

    await dbClient.query(`
      INSERT INTO app.plan_start_config (
        methodology_plan_id,
        start_day_of_week,
        is_consecutive_days,
        intensity_adjusted,
        first_week_pattern,
        regular_pattern,
        day_mappings,
        warnings,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (methodology_plan_id)
      DO UPDATE SET
        warnings = $8,
        first_week_pattern = $5
    `, [
      methodologyPlanId,
      currentDayOfWeek,
      false,
      false,
      'Full Body',
      'Full Body',
      JSON.stringify({ 'Hoy': 'sesion_completa' }),
      JSON.stringify([
        {
          type: 'info',
          icon: '💪',
          title: 'Rutina Full Body',
          message: 'Esta es una rutina especial de cuerpo completo para el fin de semana. Trabajarás todos los grupos musculares en una sesión.'
        },
        {
          type: 'warning',
          icon: '⚠️',
          title: 'Volumen Reducido',
          message: 'El volumen por grupo muscular es menor que en tu rutina regular. Esto es intencional para permitir la recuperación.'
        },
        {
          type: 'important',
          icon: '📅',
          title: 'Sesión Única',
          message: 'Esta rutina está diseñada para una sola sesión. Si necesitas entrenar múltiples días, considera generar un plan regular.'
        }
      ])
    ]);

    await dbClient.query('COMMIT');

    console.log('✅ Rutina Full Body generada exitosamente');

    res.json({
      success: true,
      message: 'Rutina Full Body generada exitosamente',
      methodology_plan_id: methodologyPlanId,
      plan: {
        id: methodologyPlanId,
        name: planResult.rows[0].plan_name,
        type: 'full-body',
        exercises_count: fullBodyExercises.length,
        nivel: nivel,
        exercises: fullBodyExercises
      },
      warnings: [
        'Esta es una rutina especial para el fin de semana',
        'Trabaja todos los grupos musculares en una sesión',
        'El volumen está ajustado para permitir recuperación'
      ]
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error generando Full Body:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar rutina Full Body',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

/**
 * POST /api/hipertrofiav2/generate-single-day
 * Genera un entrenamiento de día único (para fines de semana o días extra)
 * NO genera un plan completo, solo una sesión independiente
 */
router.post('/generate-single-day', authenticateToken, async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const userId = req.user?.userId || req.user?.id;
    const { nivel = 'Principiante', isWeekendExtra = false } = req.body;

    console.log('🏋️ Generando entrenamiento de día único para usuario:', userId);
    console.log('📊 Nivel:', nivel, '| Fin de semana extra:', isWeekendExtra);

    // Mapear nivel a formato de BD (basico/intermedio/avanzado)
    const nivelMapping = {
      'Principiante': 'basico',
      'Intermedio': 'intermedio',
      'Avanzado': 'avanzado',
      'basico': 'basico',
      'intermedio': 'intermedio',
      'avanzado': 'avanzado'
    };
    const nivelNormalized = nivelMapping[nivel] || 'basico';
    console.log('📝 Nivel normalizado:', nivelNormalized);

    await dbClient.query('BEGIN');

    // Obtener ejercicios según nivel
    const exercisesQuery = `
      SELECT
        exercise_id,
        nombre,
        categoria,
        patron,
        equipamiento,
        nivel,
        series_reps_objetivo,
        descanso_seg,
        notas,
        "Tipo base",
        "Ejecución"
      FROM app."Ejercicios_Hipertrofia"
      WHERE nivel = $1
        AND "Tipo base" IS NOT NULL
      ORDER BY
        CASE
          WHEN "Tipo base" = 'Multiarticular' THEN 1
          ELSE 2
        END,
        RANDOM()
    `;

    const exercisesResult = await dbClient.query(exercisesQuery, [nivel]);

    // Seleccionar ejercicios para Full Body (6-8 ejercicios)
    const fullBodyExercises = [];
    const targetGroups = [
      { categoria: 'Pecho', count: 1 },
      { categoria: 'Espalda', count: 1 },
      { categoria: 'Piernas', count: 2 },
      { categoria: 'Hombros', count: 1 },
      { categoria: 'Core', count: 1 }
    ];

    for (const group of targetGroups) {
      const groupExercises = exercisesResult.rows
        .filter(ex => ex.categoria === group.categoria)
        .slice(0, group.count);

      fullBodyExercises.push(...groupExercises.map((ex, idx) => ({
        ...ex,
        orden: fullBodyExercises.length + idx + 1,
        series: nivel === 'Principiante' ? 3 : nivel === 'Intermedio' ? 3 : 4,
        isWeekendExtra
      })));
    }

    // Crear plan temporal para fin de semana
    const currentDate = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Crear plan temporal en methodology_plans
    const planResult = await dbClient.query(`
      INSERT INTO app.methodology_plans (
        user_id,
        methodology_type,
        nivel,
        plan_name,
        plan_start_date,
        status,
        total_days,
        generation_mode,
        version_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id`,
      [
        userId,
        'hipertrofia',
        nivelNormalized,  // Usar nivel normalizado (basico/intermedio/avanzado)
        'Entrenamiento Extra Fin de Semana',
        currentDate,
        'completed', // Marcado como completado para no interferir con planes activos
        1,
        'manual',
        'weekend-extra'
      ]
    );

    const planId = planResult.rows[0].id;
    console.log(`📋 Plan temporal creado: ID ${planId}`);

    // Crear sesión de metodología para fin de semana
    const sessionResult = await dbClient.query(`
      INSERT INTO app.methodology_exercise_sessions (
        user_id,
        methodology_plan_id,
        methodology_type,
        methodology_level,
        session_name,
        day_name,
        session_date,
        session_type,
        total_exercises,
        exercises_completed,
        exercises_skipped,
        exercises_cancelled,
        exercises_in_progress,
        session_status,
        started_at,
        day_of_month,
        month_name,
        month_number,
        year_number,
        exercises_data,
        session_metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING id`,
      [
        userId,
        planId,                                         // methodology_plan_id (ahora con ID real)
        'hipertrofia',                                  // methodology_type
        nivel,                                          // methodology_level
        'Full Body Extra - Fin de Semana',             // session_name
        dayNames[currentDate.getDay()],                // day_name
        currentDate,                                    // session_date
        'weekend-extra',                                // session_type
        fullBodyExercises.length,                       // total_exercises
        0,                                              // exercises_completed
        0,                                              // exercises_skipped
        0,                                              // exercises_cancelled
        0,                                              // exercises_in_progress
        'pending',                                      // session_status
        currentDate,                                    // started_at
        currentDate.getDate(),                          // day_of_month
        monthNames[currentDate.getMonth()],             // month_name
        currentDate.getMonth() + 1,                     // month_number
        currentDate.getFullYear(),                      // year_number
        JSON.stringify(fullBodyExercises),              // exercises_data
        JSON.stringify({
          nivel,
          generated_at: currentDate,
          type: 'single-day-workout',
          weekend_extra: isWeekendExtra,
          note: 'Entrenamiento extra de fin de semana - no afecta plan semanal'
        })
      ]
    );

    const sessionId = sessionResult.rows[0].id;

    // Crear tracking para cada ejercicio
    for (const exercise of fullBodyExercises) {
      await dbClient.query(`
        INSERT INTO app.exercise_session_tracking (
          methodology_session_id,
          user_id,
          exercise_name,
          exercise_order,
          exercise_data,
          status,
          planned_sets,
          planned_reps,
          planned_rest_seconds,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )`,
        [
          sessionId,
          userId,
          exercise.nombre,
          exercise.orden,
          JSON.stringify(exercise),
          'pending',
          exercise.series,
          exercise.series_reps_objetivo || '8-12',
          exercise.descanso_seg || 90,
          currentDate
        ]
      );
    }

    await dbClient.query('COMMIT');

    console.log('✅ Entrenamiento de día único generado exitosamente');

    res.json({
      success: true,
      message: 'Entrenamiento del día generado exitosamente',
      sessionId,
      workout: {
        id: sessionId,
        type: 'full-body-single',
        nivel,
        exercises_count: fullBodyExercises.length,
        duration_estimate: nivel === 'Principiante' ? '45-50 min' : '50-60 min',
        exercises: fullBodyExercises.map(ex => ({
          exercise_id: ex.exercise_id,
          nombre: ex.nombre,
          categoria: ex.categoria,
          series: ex.series,
          reps: ex.series_reps_objetivo,
          series_reps_objetivo: ex.series_reps_objetivo,  // Agregar también en este formato
          repeticiones: ex.series_reps_objetivo,           // Y en este formato para compatibilidad
          descanso_seg: ex.descanso_seg,
          tipo_base: ex["Tipo base"],
          ejecucion: ex["Ejecución"],
          notas: ex.notas,
          patron: ex.patron,
          equipamiento: ex.equipamiento,
          nivel: ex.nivel
        }))
      },
      notes: [
        'Este entrenamiento es independiente y no afecta tu plan semanal',
        'Se guardará en tu histórico como entrenamiento extra',
        'Ajusta los pesos según tu capacidad actual'
      ]
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error generando entrenamiento de día único:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar entrenamiento',
      details: error.message
    });
  } finally {
    dbClient.release();
  }
});

// ============================================================
// MOTOR MINDFEED - FASE 1
// ============================================================

/**
 * GET /api/hipertrofiav2/cycle-status/:userId
 * Obtiene el estado actual del ciclo del usuario
 */
router.get('/cycle-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`📊 Obteniendo estado del ciclo para usuario ${userId}`);

    const result = await pool.query(`
      SELECT * FROM app.hipertrofia_v2_user_status
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Usuario nuevo, no tiene estado aún
      return res.json({
        success: true,
        cycleState: null,
        message: 'Usuario sin estado de ciclo (comenzará en D1)'
      });
    }

    res.json({
      success: true,
      cycleState: result.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo estado del ciclo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado del ciclo'
    });
  }
});

/**
 * POST /api/hipertrofiav2/advance-cycle
 * Avanza el día del ciclo (D1→D2→...→D5→D1)
 * Se llama al finalizar una sesión de entrenamiento
 */
router.post('/advance-cycle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionDayName, sessionPatterns = [] } = req.body; // 'D1', 'D2', etc.

    if (!sessionDayName) {
      return res.status(400).json({
        success: false,
        error: 'sessionDayName es requerido'
      });
    }

    const normalizedPatterns = Array.isArray(sessionPatterns)
      ? sessionPatterns
          .filter(value => typeof value === 'string' && value.trim().length > 0)
          .map(value => value.toLowerCase().trim())
      : [];

    console.log(`🔄 Avanzando ciclo para usuario ${userId} desde ${sessionDayName} (patrones: ${normalizedPatterns.length})`);

    const result = await pool.query(`
      SELECT app.advance_cycle_day($1, $2, $3::jsonb) as result
    `, [userId, sessionDayName, JSON.stringify(normalizedPatterns)]);

    const cycleResult = result.rows[0].result;

    console.log(`✅ Ciclo avanzado:`, cycleResult);

    // Si completó microciclo, aplicar progresión automáticamente
    if (cycleResult.microcycle_completed) {
      console.log(`🎯 Microciclo completado! Aplicando progresión...`);

      // Obtener methodology_plan_id del usuario
      const planResult = await pool.query(`
        SELECT methodology_plan_id
        FROM app.hipertrofia_v2_state
        WHERE user_id = $1
      `, [userId]);

      if (planResult.rows.length > 0) {
        const methodologyPlanId = planResult.rows[0].methodology_plan_id;

        // Aplicar progresión
        const progressionResult = await pool.query(`
          SELECT app.apply_microcycle_progression($1, $2) as result
        `, [userId, methodologyPlanId]);

        cycleResult.progression = progressionResult.rows[0].result;
      }
    }

    res.json({
      success: true,
      cycleAdvanced: true,
      ...cycleResult
    });

  } catch (error) {
    console.error('Error avanzando ciclo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al avanzar ciclo',
      details: error.message
    });
  }
});

// ============================================================
// 🚀 FASE 2 - MÓDULO 2: SOLAPAMIENTO NEURAL
// ============================================================

/**
 * GET /api/hipertrofiav2/current-session-with-adjustments/:userId/:cycleDay
 * Obtiene la sesión del día actual CON ajustes de solapamiento neural aplicados
 * AUTOMÁTICO para principiantes
 */
router.get('/current-session-with-adjustments/:userId/:cycleDay', authenticateToken, async (req, res) => {
  try {
    const { userId, cycleDay } = req.params;
    console.log(`🔍 [SESSION+OVERLAP] Obteniendo D${cycleDay} con ajustes automáticos para usuario ${userId}`);

    // 1. Obtener nivel del usuario
    const userQuery = await pool.query(
      `SELECT nivel_entrenamiento FROM app.users WHERE id = $1`,
      [userId]
    );
    const nivel = userQuery.rows[0]?.nivel_entrenamiento || 'Principiante';

    // 2. Obtener configuración de sesión del plan activo
    const planQuery = await pool.query(
      `SELECT plan_data FROM app.methodology_plans
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (planQuery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No hay plan activo' });
    }

    const planData = planQuery.rows[0].plan_data;
    // Buscar sesión del cicleDay en el plan
    let currentSession = null;

    for (const semana of (planData.semanas || [])) {
      for (const sesion of (semana.sesiones || [])) {
        if (sesion.ciclo_dia == cycleDay || sesion.cycle_day == cycleDay) {
          currentSession = sesion;
          break;
        }
      }
      if (currentSession) break;
    }

    if (!currentSession) {
      return res.status(404).json({ success: false, error: `Sesión D${cycleDay} no encontrada` });
    }

    // 3. Detectar solapamiento neural AUTOMÁTICAMENTE (solo principiantes)
    let adjustedSession = { ...currentSession };
    let overlapInfo = null;

    if (nivel === 'Principiante' && currentSession.ejercicios) {
      const currentPatterns = currentSession.ejercicios.map(ex => ex.patron_movimiento).filter(Boolean);

      const overlapResult = await pool.query(
        `SELECT app.detect_neural_overlap($1, $2::jsonb) as result`,
        [userId, JSON.stringify(currentPatterns)]
      );

      overlapInfo = overlapResult.rows[0]?.result || {};

      if (overlapInfo.overlap !== 'none' && overlapInfo.adjustment < 0) {
        console.log(`⚠️ [OVERLAP] ${overlapInfo.overlap} detectado, ajustando -10% intensidad`);

        // Aplicar -10% a ejercicios multiarticulares
        adjustedSession.ejercicios = currentSession.ejercicios.map(ex => {
          if (ex.tipo_ejercicio === 'multiarticular') {
            return {
              ...ex,
              intensidad_porcentaje: Math.round(ex.intensidad_porcentaje * 0.9 * 10) / 10,
              notas: (ex.notas || '') + ' [⚠️ -10% por solapamiento neural]'
            };
          }
          return ex;
        });
      }
    }

    res.json({
      success: true,
      session: adjustedSession,
      overlap_detected: overlapInfo?.overlap !== 'none',
      overlap_info: overlapInfo,
      nivel
    });

  } catch (error) {
    console.error('❌ [SESSION+OVERLAP] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hipertrofiav2/check-neural-overlap
 * Detecta solapamiento neural entre la última sesión y la actual
 */
router.post('/check-neural-overlap', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { sessionPatterns = [] } = req.body || {};

    if (!Array.isArray(sessionPatterns)) {
      return res.status(400).json({
        success: false,
        error: 'sessionPatterns debe ser un arreglo'
      });
    }

    const normalizedPatterns = sessionPatterns
      .filter(value => typeof value === 'string' && value.trim().length > 0)
      .map(value => value.toLowerCase().trim());

    console.log(`🧠 [OVERLAP] Detectando solapamiento neural para usuario ${userId} (patrones: ${normalizedPatterns.join(', ')})`);

    const result = await pool.query(`
      SELECT app.detect_neural_overlap($1, $2::jsonb) as result
    `, [userId, JSON.stringify(normalizedPatterns)]);

    const overlap = result.rows[0].result || {};

    res.json({
      success: true,
      ...overlap
    });

  } catch (error) {
    console.error('❌ [OVERLAP] Error detectando solapamiento neural:', error);
    res.status(500).json({
      success: false,
      error: 'Error al detectar solapamiento neural',
      details: error.message
    });
  }
});

/**
 * POST /api/hipertrofiav2/apply-progression
 * Aplica progresión +2.5% al completar microciclo
 */
router.post('/apply-progression', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodologyPlanId } = req.body;

    console.log(`📈 Aplicando progresión para usuario ${userId}`);

    const result = await pool.query(`
      SELECT app.apply_microcycle_progression($1, $2) as result
    `, [userId, methodologyPlanId]);

    const progressionResult = result.rows[0].result;

    res.json({
      success: true,
      ...progressionResult
    });

  } catch (error) {
    console.error('Error aplicando progresión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aplicar progresión',
      details: error.message
    });
  }
});

/**
 * GET /api/hipertrofiav2/check-deload/:userId
 * Verifica si el usuario necesita deload
 */
router.get('/check-deload/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🔍 Verificando deload para usuario ${userId}`);

    const result = await pool.query(`
      SELECT app.check_deload_trigger($1) as result
    `, [userId]);

    const deloadCheck = result.rows[0].result;

    res.json({
      success: true,
      ...deloadCheck
    });

  } catch (error) {
    console.error('Error verificando deload:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar deload'
    });
  }
});

/**
 * POST /api/hipertrofiav2/activate-deload
 * Activa deload (reduce cargas -30%, volumen -50%)
 */
router.post('/activate-deload', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { methodologyPlanId, reason = 'planificado' } = req.body;

    console.log(`⚠️ Activando deload para usuario ${userId} (${reason})`);

    const result = await pool.query(`
      SELECT app.activate_deload($1, $2, $3) as result
    `, [userId, methodologyPlanId, reason]);

    const deloadResult = result.rows[0].result;

    res.json({
      success: true,
      ...deloadResult
    });

  } catch (error) {
    console.error('Error activando deload:', error);
    res.status(500).json({
      success: false,
      error: 'Error al activar deload',
      details: error.message
    });
  }
});

/**
 * POST /api/hipertrofiav2/deactivate-deload
 * Desactiva deload tras completarlo
 */
router.post('/deactivate-deload', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    console.log(`✅ Desactivando deload para usuario ${userId}`);

    const result = await pool.query(`
      SELECT app.deactivate_deload($1) as result
    `, [userId]);

    const deloadResult = result.rows[0].result;

    res.json({
      success: true,
      ...deloadResult
    });

  } catch (error) {
    console.error('Error desactivando deload:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desactivar deload',
      details: error.message
    });
  }
});

// ============================================================
// 🚀 FASE 2 - MÓDULO 4: PRIORIDAD MUSCULAR
// ============================================================

/**
 * Detecta y aplica ajustes por solapamiento neural (Principiantes)
 * Reduce carga -10% si se detectan patrones de movimiento repetidos en <72h
 */
async function applyNeuralOverlapAdjustments(dbClient, userId, exercises, nivel) {
  // Solo aplicar a principiantes según teoría MindFeed
  if (nivel !== 'Principiante') {
    return { exercises, overlapDetected: false };
  }

  try {
    // Extraer patrones de movimiento de los ejercicios actuales
    const currentPatterns = exercises
      .map(ex => ex.patron_movimiento)
      .filter(Boolean);

    // Llamar a función SQL de detección
    const overlapResult = await dbClient.query(
      `SELECT app.detect_neural_overlap($1, $2) AS result`,
      [userId, JSON.stringify(currentPatterns)]
    );

    const overlap = overlapResult.rows[0]?.result || { overlap: 'none', adjustment: 0 };
    const shouldReduce = overlap.overlap !== 'none' && overlap.adjustment < 0;

    if (shouldReduce) {
      console.log(`⚠️ [NEURAL OVERLAP] Detectado: ${overlap.overlap}, ajuste: ${overlap.adjustment * 100}%`);

      // Aplicar reducción del 10% en intensidad para multiarticulares
      const adjustedExercises = exercises.map(ex => {
        if (ex.tipo_ejercicio === 'multiarticular') {
          return {
            ...ex,
            intensidad_porcentaje: Math.round(ex.intensidad_porcentaje * 0.9 * 10) / 10,
            notas: ex.notas + ' [Ajuste -10% por solapamiento neural]'
          };
        }
        return ex;
      });

      return { exercises: adjustedExercises, overlapDetected: true, overlapInfo: overlap };
    }

    return { exercises, overlapDetected: false };
  } catch (error) {
    console.error('❌ [NEURAL OVERLAP] Error detectando solapamiento:', error);
    return { exercises, overlapDetected: false };
  }
}

/**
 * Aplica ajustes de intensidad según módulo de priorización MindFeed
 * - Músculo prioritario (P): top set a 82.5% en días pesados (D1-D3)
 * - No prioritarios (NP): reducir a 75-77.5% en días pesados
 */
function applyPriorityIntensityAdjustments(exercises, priorityMuscle, isHeavyDay) {
  if (!priorityMuscle || !isHeavyDay) return exercises;

  return exercises.map(exercise => {
    const isPriority = exercise.categoria?.toLowerCase().includes(priorityMuscle.toLowerCase());

    if (isPriority) {
      // Músculo prioritario: incrementar intensidad a 82.5%
      return {
        ...exercise,
        intensidad_porcentaje: 82.5,
        notas: exercise.notas + ' [PRIORIDAD: Top set a 82.5%]'
      };
    } else if (exercise.tipo_ejercicio === 'multiarticular') {
      // No prioritarios en días pesados: reducir a 75-77.5%
      return {
        ...exercise,
        intensidad_porcentaje: 76,
        notas: exercise.notas + ' [Intensidad reducida por priorización]'
      };
    }

    return exercise;
  });
}

/**
 * POST /api/hipertrofiav2/activate-priority
 */
router.post('/activate-priority', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { muscleGroup } = req.body || {};

    if (!muscleGroup) {
      return res.status(400).json({ success: false, error: 'muscleGroup es requerido' });
    }

    console.log(`🎯 [PRIORITY] Activando prioridad para ${muscleGroup} en usuario ${userId}`);
    const result = await pool.query(
      `SELECT app.activate_muscle_priority($1, $2) AS result`,
      [userId, muscleGroup]
    );

    res.json(result.rows[0].result);
  } catch (error) {
    console.error('❌ [PRIORITY] Error activando prioridad:', error);
    res.status(500).json({ success: false, error: 'Error al activar prioridad', details: error.message });
  }
});

/**
 * POST /api/hipertrofiav2/deactivate-priority
 */
router.post('/deactivate-priority', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    console.log(`🛑 [PRIORITY] Desactivando prioridad para usuario ${userId}`);
    const result = await pool.query(
      `SELECT app.deactivate_muscle_priority($1) AS result`,
      [userId]
    );
    res.json(result.rows[0].result);
  } catch (error) {
    console.error('❌ [PRIORITY] Error desactivando prioridad:', error);
    res.status(500).json({ success: false, error: 'Error al desactivar prioridad', details: error.message });
  }
});

/**
 * GET /api/hipertrofiav2/priority-status/:userId
 */
router.get('/priority-status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔎 [PRIORITY] Consultando estado de prioridad para usuario ${userId}`);

    const state = await pool.query(
      `SELECT priority_muscle, priority_started_at, priority_microcycles_completed, priority_top_sets_this_week
       FROM app.hipertrofia_v2_state WHERE user_id = $1`,
      [userId]
    );

    const timeoutCheck = await pool.query(
      `SELECT app.check_priority_timeout($1) AS result`,
      [userId]
    );

    res.json({ success: true, priority: state.rows[0] || null, timeout_check: timeoutCheck.rows[0].result });
  } catch (error) {
    console.error('❌ [PRIORITY] Error obteniendo estado:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estado de prioridad', details: error.message });
  }
});

/**
 * POST /api/hipertrofiav2/select-exercises-by-type
 * Selecciona ejercicios por tipo (multiarticular/unilateral/analitico)
 * NUEVO: Para generación D1-D5
 */
router.post('/select-exercises-by-type', async (req, res) => {
  try {
    const {
      tipo_ejercicio,  // 'multiarticular', 'unilateral', 'analitico'
      categoria,       // 'Pecho', 'Espalda', etc.
      nivel = 'Principiante',
      cantidad = 1
    } = req.body;

    console.log(`🎯 Seleccionando ${cantidad} ejercicio(s) ${tipo_ejercicio} de ${categoria} (${nivel})`);

    // Query con clasificación MindFeed
    const result = await pool.query(`
      SELECT
        exercise_id,
        nombre,
        nivel,
        categoria,
        tipo_ejercicio,
        patron_movimiento,
        orden_recomendado,
        patron,
        equipamiento,
        series_reps_objetivo,
        descanso_seg,
        notas,
        "Cómo_hacerlo" as como_hacerlo,
        "Consejos" as consejos,
        "Errores_comunes" as errores_comunes
      FROM app."Ejercicios_Hipertrofia"
      WHERE nivel = $1
        AND categoria = $2
        AND tipo_ejercicio = $3
      ORDER BY orden_recomendado, RANDOM()
      LIMIT $4
    `, [nivel, categoria, tipo_ejercicio, cantidad]);

    if (result.rows.length === 0) {
      // Fallback: intentar sin filtro de tipo
      const fallbackResult = await pool.query(`
        SELECT
          exercise_id,
          nombre,
          nivel,
          categoria,
          tipo_ejercicio,
          patron_movimiento,
          orden_recomendado,
          patron,
          equipamiento,
          series_reps_objetivo,
          descanso_seg,
          notas,
          "Cómo_hacerlo" as como_hacerlo,
          "Consejos" as consejos,
          "Errores_comunes" as errores_comunes
        FROM app."Ejercicios_Hipertrofia"
        WHERE nivel = $1
          AND categoria = $2
        ORDER BY RANDOM()
        LIMIT $3
      `, [nivel, categoria, cantidad]);

      if (fallbackResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No se encontraron ejercicios de ${categoria} para nivel ${nivel}`
        });
      }

      return res.json({
        success: true,
        exercises: fallbackResult.rows,
        fallback: true,
        message: `No se encontraron ejercicios ${tipo_ejercicio}, usando cualquier tipo disponible`
      });
    }

    res.json({
      success: true,
      exercises: result.rows
    });

  } catch (error) {
    console.error('Error seleccionando ejercicios por tipo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al seleccionar ejercicios',
      details: error.message
    });
  }
});

/**
 * GET /api/hipertrofiav2/session-config/:cycleDay
 * Obtiene la configuración de una sesión del ciclo (D1-D5)
 */
router.get('/session-config/:cycleDay', async (req, res) => {
  try {
    const { cycleDay } = req.params;

    console.log(`📋 Obteniendo configuración de sesión D${cycleDay}`);

    const result = await pool.query(`
      SELECT * FROM app.hipertrofia_v2_session_config
      WHERE cycle_day = $1
    `, [cycleDay]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontró configuración para D${cycleDay}`
      });
    }

    res.json({
      success: true,
      sessionConfig: result.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo configuración de sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración'
    });
  }
});

/**
 * GET /api/hipertrofiav2/session-config-all
 * Obtiene todas las configuraciones D1-D5
 */
router.get('/session-config-all', async (req, res) => {
  try {
    console.log(`📋 Obteniendo todas las configuraciones de sesiones`);

    const result = await pool.query(`
      SELECT * FROM app.hipertrofia_v2_session_config
      ORDER BY cycle_day
    `);

    res.json({
      success: true,
      sessions: result.rows
    });

  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuraciones'
    });
  }
});

// ============================================================
// 🚨 FASE 2 - MÓDULO 1: FLAGS DE FATIGA
// ============================================================

/**
 * POST /api/hipertrofiav2/submit-fatigue-report
 * Usuario reporta subjetivamente su estado de fatiga
 *
 * Body: {
 *   sleep_quality: 1-10,
 *   energy_level: 1-10,
 *   doms_level: 0-10,
 *   joint_pain_level: 0-10,
 *   focus_level: 1-10,
 *   motivation_level: 1-10,
 *   notes: "texto opcional"
 * }
 */
router.post('/submit-fatigue-report', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sleep_quality,
      energy_level,
      doms_level = 0,
      joint_pain_level = 0,
      focus_level,
      motivation_level,
      notes = null
    } = req.body;

    console.log(`🩺 [FATIGUE] Usuario ${userId} reporta estado de fatiga`);

    // Determinar tipo de flag basado en umbrales (según doc)
    let flag_type = null;

    // CRÍTICO: dolor articular ≥6, sueño ≤3, energía ≤3
    if (joint_pain_level >= 6 || sleep_quality <= 3 || energy_level <= 3) {
      flag_type = 'critical';
    }
    // LEVE: sueño 4-5, energía 4-5, DOMS 6-7
    else if (
      (sleep_quality >= 4 && sleep_quality <= 5) ||
      (energy_level >= 4 && energy_level <= 5) ||
      doms_level >= 6
    ) {
      flag_type = 'light';
    }
    // COGNITIVO: baja concentración o motivación
    else if (focus_level <= 4 || motivation_level <= 4) {
      flag_type = 'cognitive';
    }

    // Insertar flag si corresponde
    if (flag_type) {
      const result = await pool.query(`
        INSERT INTO app.fatigue_flags (
          user_id,
          flag_type,
          sleep_quality,
          energy_level,
          doms_level,
          joint_pain_level,
          focus_level,
          motivation_level,
          notes,
          auto_detected
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
        RETURNING id, flag_type, flag_date
      `, [
        userId,
        flag_type,
        sleep_quality,
        energy_level,
        doms_level,
        joint_pain_level,
        focus_level,
        motivation_level,
        notes
      ]);

      console.log(`🚨 [FATIGUE] Flag reportado: tipo=${flag_type}, id=${result.rows[0].id}`);

      res.json({
        success: true,
        flag_created: true,
        flag: result.rows[0]
      });
    } else {
      console.log(`✅ [FATIGUE] Sin flag detectado, usuario en buen estado`);

      res.json({
        success: true,
        flag_created: false,
        message: 'Estado registrado, sin flag de fatiga'
      });
    }

  } catch (error) {
    console.error('❌ [FATIGUE] Error reportando fatiga:', error);
    res.status(500).json({
      success: false,
      error: 'Error al reportar estado de fatiga',
      details: error.message
    });
  }
});

/**
 * GET /api/hipertrofiav2/fatigue-status/:userId
 * Obtener resumen de flags recientes y acción recomendada
 */
router.get('/fatigue-status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🔍 [FATIGUE] Obteniendo estado de fatiga para usuario ${userId}`);

    // Contar flags recientes (últimos 10 días)
    const flagsResult = await pool.query(`
      SELECT app.count_recent_flags($1, 10) as flags
    `, [userId]);

    const flags = flagsResult.rows[0].flags;

    // Evaluar acción recomendada
    const actionResult = await pool.query(`
      SELECT app.evaluate_fatigue_action($1) as evaluation
    `, [userId]);

    const evaluation = actionResult.rows[0].evaluation;

    console.log(`📊 [FATIGUE] Estado: ${JSON.stringify(flags)}, Acción: ${evaluation.action}`);

    res.json({
      success: true,
      flags,
      evaluation
    });

  } catch (error) {
    console.error('❌ [FATIGUE] Error obteniendo estado:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de fatiga',
      details: error.message
    });
  }
});

/**
 * POST /api/hipertrofiav2/apply-fatigue-adjustments
 * Aplicar ajustes de carga según flags de fatiga
 */
router.post('/apply-fatigue-adjustments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { methodologyPlanId } = req.body;

    console.log(`⚙️ [FATIGUE] Aplicando ajustes de fatiga para usuario ${userId}`);

    const result = await pool.query(`
      SELECT app.apply_fatigue_adjustments($1, $2) as result
    `, [userId, methodologyPlanId]);

    const adjustments = result.rows[0].result;

    console.log(`✅ [FATIGUE] Ajustes aplicados:`, adjustments);

    res.json({
      success: true,
      ...adjustments
    });

  } catch (error) {
    console.error('❌ [FATIGUE] Error aplicando ajustes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aplicar ajustes de fatiga',
      details: error.message
    });
  }
});

/**
 * POST /api/hipertrofiav2/detect-auto-fatigue
 * Detectar automáticamente flags desde RIR de sesión
 * (Se llama al finalizar sesión)
 */
router.post('/detect-auto-fatigue', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.body;

    console.log(`🤖 [FATIGUE] Detectando fatiga automática en sesión ${sessionId}`);

    const result = await pool.query(`
      SELECT app.detect_automatic_fatigue_flags($1, $2) as result
    `, [userId, sessionId]);

    const detection = result.rows[0].result;

    if (detection.flag_detected) {
      console.log(`🚨 [FATIGUE] Flag AUTO-DETECTADO: tipo=${detection.flag_type}, mean_RIR=${detection.mean_rir}`);
    } else {
      console.log(`✅ [FATIGUE] Sin fatiga automática detectada`);
    }

    res.json({
      success: true,
      ...detection
    });

  } catch (error) {
    console.error('❌ [FATIGUE] Error detectando fatiga:', error);
    res.status(500).json({
      success: false,
      error: 'Error al detectar fatiga automática',
      details: error.message
    });
  }
});

/**
 * GET /api/hipertrofiav2/fatigue-history/:userId
 * Historial de flags de fatiga del usuario
 */
router.get('/fatigue-history/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    console.log(`📜 [FATIGUE] Obteniendo historial de fatiga para usuario ${userId}`);

    const result = await pool.query(`
      SELECT
        id,
        flag_date,
        flag_type,
        sleep_quality,
        energy_level,
        doms_level,
        joint_pain_level,
        mean_rir_session,
        underperformed_sets,
        auto_detected,
        notes
      FROM app.fatigue_flags
      WHERE user_id = $1
      ORDER BY flag_date DESC
      LIMIT $2
    `, [userId, limit]);

    res.json({
      success: true,
      history: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('❌ [FATIGUE] Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de fatiga',
      details: error.message
    });
  }
});

/**
 * POST /api/hipertrofiav2/save-warmup-completion
 * Registra cuando un usuario completa las series de calentamiento
 */
router.post('/save-warmup-completion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const {
      methodologyPlanId,
      sessionId,
      exerciseId,
      exerciseName,
      warmupConfig,
      setsCompleted,
      setsPlanned,
      userLevel,
      targetWeight
    } = req.body;
    
    console.log(`🔥 [WARMUP] Registrando calentamiento completado para ${exerciseName}`);
    
    const result = await pool.query(`
      INSERT INTO app.warmup_sets_tracking (
        user_id,
        methodology_plan_id,
        session_id,
        exercise_id,
        exercise_name,
        warmup_config,
        sets_completed,
        sets_planned,
        completion_time,
        user_level,
        target_weight
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
      RETURNING *
    `, [
      userId,
      methodologyPlanId,
      sessionId,
      exerciseId,
      exerciseName,
      JSON.stringify(warmupConfig),
      setsCompleted,
      setsPlanned,
      userLevel,
      targetWeight
    ]);
    
    res.json({
      success: true,
      tracking: result.rows[0],
      message: 'Calentamiento registrado correctamente'
    });
    
  } catch (error) {
    console.error('❌ [WARMUP] Error registrando calentamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar calentamiento'
    });
  }
});

/**
 * GET /api/hipertrofiav2/check-warmup-reminder/:userId/:exerciseId/:sessionId
 * Verifica si el usuario necesita recordatorio de calentamiento
 */
router.get('/check-warmup-reminder/:userId/:exerciseId/:sessionId', async (req, res) => {
  try {
    const { userId, exerciseId, sessionId } = req.params;
    
    console.log(`🔍 [WARMUP] Verificando recordatorio para usuario ${userId}, ejercicio ${exerciseId}`);
    
    const result = await pool.query(
      `SELECT app.needs_warmup_reminder($1, $2, $3) as reminder`,
      [userId, exerciseId, sessionId]
    );
    
    res.json({
      success: true,
      ...result.rows[0].reminder
    });
    
  } catch (error) {
    console.error('❌ [WARMUP] Error verificando recordatorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar recordatorio'
    });
  }
});

/**
 * GET /api/hipertrofiav2/check-reevaluation/:userId
 * Verifica si el usuario necesita re-evaluación de nivel
 */
router.get('/check-reevaluation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🔍 [REEVALUATION] Verificando necesidad de re-evaluación para usuario ${userId}`);
    
    // Evaluar necesidad de cambio de nivel
    const evaluationResult = await pool.query(
      `SELECT app.evaluate_level_change($1) as evaluation`,
      [userId]
    );
    
    const evaluation = evaluationResult.rows[0].evaluation;
    
    // Verificar si ya hay una re-evaluación pendiente
    const pendingResult = await pool.query(
      `SELECT id, new_level, reason, created_at
       FROM app.level_reevaluations
       WHERE user_id = $1 AND accepted IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    const hasPending = pendingResult.rows.length > 0;
    
    res.json({
      success: true,
      evaluation,
      hasPendingReevaluation: hasPending,
      pendingReevaluation: hasPending ? pendingResult.rows[0] : null,
      shouldShowNotification: !evaluation.no_change && !hasPending
    });
    
  } catch (error) {
    console.error('❌ [REEVALUATION] Error verificando re-evaluación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar re-evaluación'
    });
  }
});

/**
 * POST /api/hipertrofiav2/accept-reevaluation
 * Acepta o rechaza una re-evaluación de nivel
 */
router.post('/accept-reevaluation', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { reevaluationId, accept = true } = req.body;
    
    console.log(`📝 [REEVALUATION] Usuario ${userId} ${accept ? 'acepta' : 'rechaza'} re-evaluación ${reevaluationId}`);
    
    // Actualizar estado de la re-evaluación
    const updateResult = await pool.query(
      `UPDATE app.level_reevaluations
       SET accepted = $1, accepted_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [accept, reevaluationId, userId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Re-evaluación no encontrada'
      });
    }
    
    const reevaluation = updateResult.rows[0];
    
    // Si acepta, actualizar el nivel en las próximas sesiones
    if (accept) {
      console.log(`✅ [REEVALUATION] Cambiando nivel de ${reevaluation.previous_level} a ${reevaluation.new_level}`);
      
      // Aquí podrías actualizar el nivel en las tablas necesarias
      // Por ejemplo, en la próxima generación de plan se usará el nuevo nivel
    }
    
    res.json({
      success: true,
      message: accept ? 'Nivel actualizado exitosamente' : 'Cambio de nivel rechazado',
      newLevel: accept ? reevaluation.new_level : reevaluation.previous_level
    });
    
  } catch (error) {
    console.error('❌ [REEVALUATION] Error procesando respuesta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar respuesta'
    });
  }
});

/**
 * POST /api/hipertrofiav2/trigger-reevaluation
 * Trigger manual de re-evaluación (para testing o casos especiales)
 */
router.post('/trigger-reevaluation', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    console.log(`🔄 [REEVALUATION] Trigger manual de re-evaluación para usuario ${userId}`);
    
    // Evaluar y registrar si es necesario
    const evaluationResult = await pool.query(
      `SELECT app.evaluate_level_change($1) as evaluation`,
      [userId]
    );
    
    const evaluation = evaluationResult.rows[0].evaluation;
    
    if (!evaluation.no_change) {
      const registerResult = await pool.query(
        `SELECT app.register_reevaluation($1, $2::jsonb) as result`,
        [userId, JSON.stringify(evaluation)]
      );
      
      res.json({
        success: true,
        evaluation,
        registration: registerResult.rows[0].result,
        message: 'Re-evaluación registrada, revisa tu panel de notificaciones'
      });
    } else {
      res.json({
        success: true,
        evaluation,
        message: 'No se requiere cambio de nivel en este momento'
      });
    }
    
  } catch (error) {
    console.error('❌ [REEVALUATION] Error en trigger manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error al trigger re-evaluación'
    });
  }
});

export default router;
