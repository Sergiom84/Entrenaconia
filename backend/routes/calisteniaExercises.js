/**
 * API Routes para Ejercicios de Calistenia
 * Conecta con la tabla calistenia_exercises
 * 
 * @author Claude Code - Arquitectura Modular
 * @version 1.0.0
 */

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

/**
 * GET /api/exercises/calistenia
 * Obtener todos los ejercicios de calistenia
 */
router.get('/calistenia', authenticateToken, async (req, res) => {
  try {
    console.log('🤸‍♀️ Obteniendo ejercicios de calistenia...');
    
    const { nivel, categoria, equipamiento, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        id,
        exercise_id,
        nombre,
        nivel,
        categoria,
        patron,
        equipamiento,
        series_reps_objetivo,
        criterio_de_progreso,
        progresion_desde,
        progresion_hacia,
        notas,
        created_at,
        updated_at
      FROM app.calistenia_exercises
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Filtros opcionales
    if (nivel) {
      paramCount++;
      query += ` AND LOWER(nivel) = LOWER($${paramCount})`;
      params.push(nivel);
    }
    
    if (categoria) {
      paramCount++;
      query += ` AND LOWER(categoria) LIKE LOWER($${paramCount})`;
      params.push(`%${categoria}%`);
    }
    
    if (equipamiento) {
      paramCount++;
      query += ` AND LOWER(equipamiento) LIKE LOWER($${paramCount})`;
      params.push(`%${equipamiento}%`);
    }
    
    // Ordenar por nivel y categoría
    query += ` 
      ORDER BY 
        CASE 
          WHEN LOWER(nivel) = 'básico' THEN 1
          WHEN LOWER(nivel) = 'intermedio' THEN 2
          WHEN LOWER(nivel) = 'avanzado' THEN 3
          ELSE 4
        END,
        categoria,
        nombre
    `;
    
    // Aplicar límite
    if (limit && parseInt(limit) > 0) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));
    }
    
    const result = await pool.query(query, params);
    
    console.log(`✅ ${result.rows.length} ejercicios de calistenia encontrados`);
    
    res.json({
      success: true,
      total: result.rows.length,
      exercises: result.rows,
      metadata: {
        filters: {
          nivel: nivel || null,
          categoria: categoria || null,
          equipamiento: equipamiento || null,
          limit: parseInt(limit)
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo ejercicios de calistenia:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/exercises/calistenia/:exerciseId
 * Obtener ejercicio específico de calistenia
 */
router.get('/calistenia/:exerciseId', authenticateToken, async (req, res) => {
  try {
    const { exerciseId } = req.params;
    
    console.log(`🎯 Buscando ejercicio de calistenia: ${exerciseId}`);
    
    const result = await pool.query(`
      SELECT 
        id,
        exercise_id,
        nombre,
        nivel,
        categoria,
        patron,
        equipamiento,
        series_reps_objetivo,
        criterio_de_progreso,
        progresion_desde,
        progresion_hacia,
        notas,
        created_at,
        updated_at
      FROM app.calistenia_exercises
      WHERE exercise_id = $1 OR LOWER(nombre) = LOWER($1)
    `, [exerciseId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ejercicio no encontrado',
        exerciseId
      });
    }
    
    const exercise = result.rows[0];
    console.log(`✅ Ejercicio encontrado: ${exercise.nombre}`);
    
    // Obtener progresiones si existen
    let progressions = null;
    if (exercise.progresion_desde || exercise.progresion_hacia) {
      const progressionQuery = await pool.query(`
        SELECT exercise_id, nombre, nivel 
        FROM app.calistenia_exercises 
        WHERE exercise_id IN ($1, $2) AND exercise_id != $3
      `, [
        exercise.progresion_desde || '', 
        exercise.progresion_hacia || '', 
        exercise.exercise_id
      ]);
      
      progressions = {
        previous: progressionQuery.rows.find(p => p.exercise_id === exercise.progresion_desde) || null,
        next: progressionQuery.rows.find(p => p.exercise_id === exercise.progresion_hacia) || null
      };
    }
    
    res.json({
      success: true,
      exercise,
      progressions,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo ejercicio específico:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/exercises/calistenia/level/:nivel
 * Obtener ejercicios por nivel específico
 */
router.get('/calistenia/level/:nivel', authenticateToken, async (req, res) => {
  try {
    const { nivel } = req.params;
    const validLevels = ['básico', 'intermedio', 'avanzado'];
    
    if (!validLevels.includes(nivel.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Nivel inválido',
        validLevels
      });
    }
    
    console.log(`📊 Obteniendo ejercicios de calistenia nivel: ${nivel}`);
    
    const result = await pool.query(`
      SELECT 
        exercise_id,
        nombre,
        categoria,
        patron,
        equipamiento,
        series_reps_objetivo,
        criterio_de_progreso,
        notas
      FROM app.calistenia_exercises
      WHERE LOWER(nivel) = LOWER($1)
      ORDER BY categoria, nombre
    `, [nivel]);
    
    console.log(`✅ ${result.rows.length} ejercicios nivel ${nivel} encontrados`);
    
    res.json({
      success: true,
      nivel,
      total: result.rows.length,
      exercises: result.rows,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Error obteniendo ejercicios nivel ${req.params.nivel}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/exercises/calistenia/categories
 * Obtener categorías disponibles de calistenia
 */
router.get('/calistenia/categories', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Obteniendo categorías de ejercicios de calistenia...');
    
    const result = await pool.query(`
      SELECT 
        categoria,
        COUNT(*) as total_ejercicios,
        array_agg(DISTINCT nivel ORDER BY 
          CASE 
            WHEN nivel = 'Básico' THEN 1
            WHEN nivel = 'Intermedio' THEN 2
            WHEN nivel = 'Avanzado' THEN 3
            ELSE 4
          END
        ) as niveles_disponibles
      FROM app.calistenia_exercises
      GROUP BY categoria
      ORDER BY categoria
    `);
    
    console.log(`✅ ${result.rows.length} categorías encontradas`);
    
    res.json({
      success: true,
      total: result.rows.length,
      categories: result.rows,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo categorías de calistenia:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/exercises/calistenia/progression/:exerciseId
 * Obtener cadena de progresión para un ejercicio específico
 */
router.get('/calistenia/progression/:exerciseId', authenticateToken, async (req, res) => {
  try {
    const { exerciseId } = req.params;
    
    console.log(`🔗 Obteniendo cadena de progresión para: ${exerciseId}`);
    
    // Obtener el ejercicio base
    const exerciseResult = await pool.query(`
      SELECT exercise_id, nombre, nivel, progresion_desde, progresion_hacia
      FROM app.calistenia_exercises
      WHERE exercise_id = $1
    `, [exerciseId]);
    
    if (exerciseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ejercicio no encontrado'
      });
    }
    
    const exercise = exerciseResult.rows[0];
    
    // Construir cadena de progresión completa
    
    // Agregar ejercicios anteriores (recursivamente hacia atrás)
    let currentPrevious = exercise.progresion_desde;
    const previousExercises = [];
    
    while (currentPrevious) {
      const prevResult = await pool.query(`
        SELECT exercise_id, nombre, nivel, progresion_desde
        FROM app.calistenia_exercises
        WHERE exercise_id = $1
      `, [currentPrevious]);
      
      if (prevResult.rows.length > 0) {
        previousExercises.unshift(prevResult.rows[0]);
        currentPrevious = prevResult.rows[0].progresion_desde;
      } else {
        break;
      }
    }
    
    // Agregar ejercicios siguientes (recursivamente hacia adelante)
    let currentNext = exercise.progresion_hacia;
    const nextExercises = [];
    
    while (currentNext) {
      const nextResult = await pool.query(`
        SELECT exercise_id, nombre, nivel, progresion_hacia
        FROM app.calistenia_exercises
        WHERE exercise_id = $1
      `, [currentNext]);
      
      if (nextResult.rows.length > 0) {
        nextExercises.push(nextResult.rows[0]);
        currentNext = nextResult.rows[0].progresion_hacia;
      } else {
        break;
      }
    }
    
    // Construir cadena completa
    const fullChain = [...previousExercises, exercise, ...nextExercises];
    
    console.log(`✅ Cadena de progresión construida: ${fullChain.length} ejercicios`);
    
    res.json({
      success: true,
      exerciseId,
      totalProgression: fullChain.length,
      currentPosition: previousExercises.length,
      progressionChain: fullChain,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Error obteniendo progresión para ${req.params.exerciseId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

export default router;