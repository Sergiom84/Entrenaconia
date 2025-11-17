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
    const { nivel = 'Principiante', totalWeeks = 6, startConfig } = req.body;

    console.log('🏋️ [MINDFEED] Generando plan D1-D5 para usuario:', userId, 'Nivel:', nivel);

    // 🆕 Log de configuración de inicio si existe
    if (startConfig) {
      console.log('🗓️ Configuración de inicio recibida:', startConfig);
    }

    // 🆕 Calcular mapeo dinámico de D1-D5: día de inicio = D1, ciclo secuencial
    let dynamicDayMapping = {};
    const includeSaturday = startConfig?.distributionOption === 'saturdays' || startConfig?.includeSaturdays;

    if (startConfig?.startDate) {
      const startDate = new Date(startConfig.startDate);
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

      // Generar secuencia de días de entrenamiento comenzando desde el día de inicio
      const trainingDays = [];
      let currentDate = new Date(startDate);
      let sessionsNeeded = 40; // Necesitamos exactamente 40 sesiones

      while (trainingDays.length < sessionsNeeded) {
        const dayOfWeek = currentDate.getDay();

        // Determinar si este día es válido para entrenamiento
        const isValidTrainingDay = (() => {
          if (includeSaturday) {
            // Con sábado: Lunes-Sábado
            return dayOfWeek >= 1 && dayOfWeek <= 6;
          } else {
            // Sin sábado: Solo Lunes-Viernes
            return dayOfWeek >= 1 && dayOfWeek <= 5;
          }
        })();

        if (isValidTrainingDay) {
          trainingDays.push({
            date: new Date(currentDate),
            dayName: dayNames[dayOfWeek],
            sessionNumber: trainingDays.length + 1
          });
        }

        // Avanzar al siguiente día
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Crear mapeo D1-D5 basado en la secuencia completa
      // D1 = día de inicio, D2 = siguiente día válido, etc.
      for (let i = 0; i < 5; i++) {
        if (trainingDays[i]) {
          dynamicDayMapping[`D${i + 1}`] = trainingDays[i].dayName;
        }
      }

      console.log('🔄 [MINDFEED] Mapeo dinámico D1-D5:', dynamicDayMapping);
      console.log(`📅 Total sesiones generadas: ${trainingDays.length}`);
      console.log(`📅 Primeras sesiones:`, trainingDays.slice(0, 10).map(d => `${d.sessionNumber}: ${d.dayName} (${d.date.toISOString().split('T')[0]})`));
      console.log(`📅 Últimas sesiones:`, trainingDays.slice(-5).map(d => `${d.sessionNumber}: ${d.dayName} (${d.date.toISOString().split('T')[0]})`));
    } else {
      // Fallback: mapeo por defecto (Lunes-Viernes)
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

      // Ordenar ejercicios por orden_recomendado
      sessionExercises.sort((a, b) => (a.orden_recomendado || 3) - (b.orden_recomendado || 3));

      sessionsWithExercises.push({
        cycle_day: cycleDay,
        session_name: sessionConfig.session_name,
        description: sessionConfig.description,
        coach_tip: sessionConfig.coach_tip,
        intensity_percentage: sessionConfig.intensity_percentage,
        is_heavy_day: sessionConfig.is_heavy_day,
        muscle_groups: muscleGroups,
        exercises: sessionExercises.map((ex, idx) => ({
          orden: idx + 1,
          id: ex.exercise_id,
          exercise_id: ex.exercise_id,
          nombre: ex.nombre,
          categoria: ex.categoria,
          tipo_ejercicio: ex.tipo_ejercicio,
          patron_movimiento: ex.patron_movimiento,
          series: sessionConfig.default_sets,
          reps_objetivo: sessionConfig.default_reps_range,
          rir_target: sessionConfig.default_rir_target,
          descanso_seg: ex.descanso_seg || 90,
          notas: ex.notas,
          intensidad_porcentaje: sessionConfig.intensity_percentage
        }))
      });

      console.log(`  ✅ D${cycleDay}: ${sessionExercises.length} ejercicios seleccionados`);
    }

    // 3. Crear estructura del plan
    const formattedSessions = sessionsWithExercises.map((session, idx) => {
      const cycleDay = `D${session.cycle_day}`;
      const actualDayName = dynamicDayMapping[cycleDay] || cycleDay;

      return {
        nombre: session.session_name,
        dia: actualDayName, // 🆕 Usar día real en lugar de D1-D5
        ciclo_dia: session.cycle_day, // Mantener referencia al ciclo D1-D5
        descripcion: session.description,
        coach_tip: session.coach_tip,
        intensidad_porcentaje: session.intensity_percentage,
        es_dia_pesado: session.is_heavy_day,
        grupos_musculares: session.muscle_groups,
        ejercicios: session.exercises.map((exercise) => ({ ...exercise })),
        id: `S-${session.cycle_day}-${idx}`
      };
    });

    const semanas = Array.from({ length: totalWeeks }, (_, weekIndex) => ({
      numero: weekIndex + 1,
      sesiones: formattedSessions.map((session, index) => ({
        ...JSON.parse(JSON.stringify(session)),
        orden: index + 1,
        id: `W${weekIndex + 1}-D${session.ciclo_dia}`
      }))
    }));

    const planData = {
      metodologia: 'HipertrofiaV2_MindFeed',
      version: 'MindFeed_v1.0',
      nivel,
      ciclo_type: 'D1-D5',
      total_weeks: totalWeeks,
      duracion_total_semanas: totalWeeks,
      frecuencia_semanal: formattedSessions.length,
      fecha_inicio: new Date().toISOString(),
      sessions: sessionsWithExercises,
      semanas,
      configuracion: {
        progression_type: 'microcycle',  // Progresión por microciclo completo
        progression_increment: 2.5,      // +2.5%
        deload_trigger: 6,                // Cada 6 microciclos
        rir_target: '2-3',
        tracking_enabled: true
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
      const firstWeekPattern = includeSaturdays
        ? 'Lun-Mar-Mie-Jue-Vie-Sáb'
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
      rir_reported // También intentar con snake_case
    } = req.body;

    // Normalizar datos (aceptar ambos formatos)
    const normalizedExerciseId = exerciseId || exercise_id;
    const normalizedExerciseName = exerciseName || exercise_name;
    const normalizedSetNumber = setNumber || set_number;
    const normalizedWeight = weight || weight_used;
    const normalizedReps = reps || reps_completed;
    const normalizedRir = rir !== undefined ? rir : rir_reported;

    console.log('🔍 DEBUG - exerciseId (camelCase):', exerciseId);
    console.log('🔍 DEBUG - exercise_id (snake_case):', exercise_id);
    console.log('🔍 DEBUG - normalizedExerciseId:', normalizedExerciseId);

    console.log(`💾 Guardando serie ${normalizedSetNumber} de ${normalizedExerciseName}`);

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
        rir_reported
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      normalizedRir
    ]);

    res.json({
      success: true,
      setData: result.rows[0]
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

export default router;
