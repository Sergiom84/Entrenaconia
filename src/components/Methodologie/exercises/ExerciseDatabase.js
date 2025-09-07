/**
 * Sistema de Base de Datos de Ejercicios para Calistenia
 * Integra con la tabla Ejercicios_Calistenia de PostgreSQL
 * 
 * @author Claude Code - Arquitectura Modular para Metodologías
 * @version 1.0.0
 */

import React from 'react';

// Configuración de la API
const API_BASE = '/api/exercises';

/**
 * Cliente para obtener ejercicios de calistenia desde la base de datos
 */
export class CalisteniaExerciseDatabase {
  
  /**
   * Obtener todos los ejercicios de calistenia
   * @returns {Promise<Array>} Lista de ejercicios
   */
  static async getAllExercises() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/calistenia`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching exercises: ${response.status}`);
      }
      
      const data = await response.json();
      return data.exercises || [];
    } catch (error) {
      console.error('❌ Error cargando ejercicios de calistenia:', error);
      return [];
    }
  }
  
  /**
   * Filtrar ejercicios por nivel
   * @param {string} nivel - 'Básico', 'Intermedio', 'Avanzado'
   * @returns {Promise<Array>} Ejercicios filtrados por nivel
   */
  static async getExercisesByLevel(nivel) {
    const exercises = await this.getAllExercises();
    return exercises.filter(ex => ex.nivel.toLowerCase() === nivel.toLowerCase());
  }
  
  /**
   * Filtrar ejercicios por categoría
   * @param {string} categoria - 'Empuje', 'Tracción', 'Piernas', 'Core'
   * @returns {Promise<Array>} Ejercicios filtrados por categoría
   */
  static async getExercisesByCategory(categoria) {
    const exercises = await this.getAllExercises();
    return exercises.filter(ex => ex.categoria.toLowerCase() === categoria.toLowerCase());
  }
  
  /**
   * Obtener ejercicio específico por ID
   * @param {string} exerciseId - ID único del ejercicio
   * @returns {Promise<Object|null>} Ejercicio encontrado o null
   */
  static async getExerciseById(exerciseId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/calistenia/${exerciseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.exercise || null;
    } catch (error) {
      console.error(`❌ Error obteniendo ejercicio ${exerciseId}:`, error);
      return null;
    }
  }
  
  /**
   * Obtener cadena de progresión para un ejercicio
   * @param {string} exerciseId - ID del ejercicio
   * @returns {Promise<Object>} Objeto con ejercicios anteriores y siguientes
   */
  static async getProgressionChain(exerciseId) {
    const exercises = await this.getAllExercises();
    const currentExercise = exercises.find(ex => ex.exercise_id === exerciseId);
    
    if (!currentExercise) {
      return { previous: null, current: null, next: null };
    }
    
    const previous = currentExercise.progresion_desde ? 
      exercises.find(ex => ex.exercise_id === currentExercise.progresion_desde) : null;
    
    const next = currentExercise.progresion_hacia ? 
      exercises.find(ex => ex.exercise_id === currentExercise.progresion_hacia) : null;
    
    return {
      previous,
      current: currentExercise,
      next
    };
  }
  
  /**
   * Obtener ejercicios recomendados para un nivel y objetivos específicos
   * @param {string} nivel - Nivel del usuario
   * @param {string[]} categorias - Categorías de interés ['Empuje', 'Tracción']
   * @param {string} equipamiento - Equipamiento disponible
   * @returns {Promise<Array>} Ejercicios recomendados
   */
  static async getRecommendedExercises(nivel, categorias = [], equipamiento = '') {
    const exercises = await this.getAllExercises();
    
    return exercises.filter(ex => {
      // Filtro por nivel (incluir niveles inferiores también)
      const levelOrder = { 'básico': 1, 'intermedio': 2, 'avanzado': 3 };
      const userLevel = levelOrder[nivel.toLowerCase()] || 2;
      const exerciseLevel = levelOrder[ex.nivel.toLowerCase()] || 2;
      
      // Permitir ejercicios del mismo nivel o inferiores
      const levelMatch = exerciseLevel <= userLevel;
      
      // Filtro por categorías si se especifica
      const categoryMatch = categorias.length === 0 || 
        categorias.some(cat => ex.categoria.toLowerCase().includes(cat.toLowerCase()));
      
      // Filtro por equipamiento si se especifica
      const equipmentMatch = !equipamiento || 
        ex.equipamiento.toLowerCase().includes(equipamiento.toLowerCase()) ||
        ex.equipamiento.toLowerCase() === 'suelo' ||
        ex.equipamiento.toLowerCase() === 'pared';
      
      return levelMatch && categoryMatch && equipmentMatch;
    }).sort((a, b) => {
      // Ordenar por nivel y luego por categoría
      const levelOrder = { 'básico': 1, 'intermedio': 2, 'avanzado': 3 };
      const aLevel = levelOrder[a.nivel.toLowerCase()] || 2;
      const bLevel = levelOrder[b.nivel.toLowerCase()] || 2;
      
      if (aLevel !== bLevel) return aLevel - bLevel;
      return a.categoria.localeCompare(b.categoria);
    });
  }
}

/**
 * Utilidades para trabajar con ejercicios de calistenia
 */
export class CalisteniaExerciseUtils {
  
  /**
   * Parsear series y repeticiones objetivo
   * @param {string} seriesRepsObjectivo - Formato "3-5x8-12"
   * @returns {Object} Objeto con series min/max y reps min/max
   */
  static parseSeriesReps(seriesRepsObjectivo) {
    if (!seriesRepsObjectivo) return null;
    
    try {
      // Formato esperado: "3-5x8-12" o "4x10" o "3-4x15-20"
      const match = seriesRepsObjectivo.match(/(\d+)(?:-(\d+))?x(\d+)(?:-(\d+))?/);
      
      if (!match) return null;
      
      const [, seriesMin, seriesMax, repsMin, repsMax] = match;
      
      return {
        series: {
          min: parseInt(seriesMin),
          max: parseInt(seriesMax) || parseInt(seriesMin)
        },
        reps: {
          min: parseInt(repsMin),
          max: parseInt(repsMax) || parseInt(repsMin)
        }
      };
    } catch (error) {
      console.error('Error parseando series/reps:', error);
      return null;
    }
  }
  
  /**
   * Validar si un usuario cumple criterios de progreso
   * @param {Object} exercise - Ejercicio
   * @param {number} userReps - Repeticiones del usuario
   * @param {number} userSessions - Sesiones consecutivas con esas reps
   * @returns {boolean} True si puede progresar
   */
  static canProgress(exercise, userReps, userSessions = 1) {
    if (!exercise.criterio_de_progreso) return false;
    
    // Extraer número de reps requeridas del criterio
    const repsMatch = exercise.criterio_de_progreso.match(/(\d+) reps/);
    const sessionsMatch = exercise.criterio_de_progreso.match(/(\d+) sesiones/);
    
    const requiredReps = repsMatch ? parseInt(repsMatch[1]) : 0;
    const requiredSessions = sessionsMatch ? parseInt(sessionsMatch[1]) : 1;
    
    return userReps >= requiredReps && userSessions >= requiredSessions;
  }
  
  /**
   * Generar descripción de dificultad basada en el ejercicio
   * @param {Object} exercise - Ejercicio
   * @returns {Object} Información de dificultad
   */
  static getDifficultyInfo(exercise) {
    const difficultyMap = {
      'básico': {
        color: 'green',
        icon: '🟢',
        description: 'Nivel principiante - Fundamentos'
      },
      'intermedio': {
        color: 'yellow',
        icon: '🟡',
        description: 'Nivel intermedio - Progresión'
      },
      'avanzado': {
        color: 'red',
        icon: '🔴',
        description: 'Nivel avanzado - Habilidades complejas'
      }
    };
    
    const nivel = exercise.nivel.toLowerCase();
    return difficultyMap[nivel] || difficultyMap['intermedio'];
  }
  
  /**
   * Generar recomendación de entrenamiento semanal
   * @param {string} nivel - Nivel del usuario
   * @param {Array} exercises - Ejercicios seleccionados
   * @returns {Object} Plan de entrenamiento semanal
   */
  static generateWeeklyPlan(nivel, exercises) {
    const frequencyByLevel = {
      'básico': 3,      // 3 días por semana
      'intermedio': 4,  // 4 días por semana  
      'avanzado': 5     // 5 días por semana
    };
    
    const frequency = frequencyByLevel[nivel.toLowerCase()] || 3;
    
    // Agrupar ejercicios por categoría
    const empuje = exercises.filter(ex => ex.categoria.includes('Empuje'));
    const traccion = exercises.filter(ex => ex.categoria.includes('Tracción'));
    const others = exercises.filter(ex => !ex.categoria.includes('Empuje') && !ex.categoria.includes('Tracción'));
    
    return {
      frequency,
      structure: {
        empuje: empuje.length,
        traccion: traccion.length,
        others: others.length
      },
      recommendation: `Entrenar ${frequency} días por semana, alternando entre empuje y tracción`
    };
  }
}

/**
 * Hook personalizado para usar la base de datos de ejercicios de calistenia
 */
export function useCalisteniaExercises() {
  const [exercises, setExercises] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  const loadExercises = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await CalisteniaExerciseDatabase.getAllExercises();
      setExercises(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading calistenia exercises:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  React.useEffect(() => {
    loadExercises();
  }, [loadExercises]);
  
  return {
    exercises,
    loading,
    error,
    reload: loadExercises
  };
}

// Export por defecto
export default CalisteniaExerciseDatabase;