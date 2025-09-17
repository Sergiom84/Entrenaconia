/**
 * 🏋️ WorkoutContext - Contexto Unificado de Entrenamiento
 *
 * PROPÓSITO: Centralizar TODO el estado relacionado con entrenamientos
 * REEMPLAZA: useMethodologyAPI, useRoutinePlan, useRoutineSession, useTodaySession, etc.
 *
 * ARQUITECTURA:
 * - Estado unificado para planes y sesiones
 * - Acciones que abstraen la complejidad de APIs
 * - Navegación fluida entre MethodologiesScreen ↔ RoutineScreen
 * - Persistencia automática en localStorage
 *
 * @version 1.0.0 - Refactorización Arquitectural Completa
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

// =============================================================================
// 🎯 TIPOS Y CONSTANTES
// =============================================================================

const WORKOUT_ACTIONS = {
  // Plan actions
  SET_PLAN: 'SET_PLAN',
  UPDATE_PLAN: 'UPDATE_PLAN',
  ACTIVATE_PLAN: 'ACTIVATE_PLAN',
  ARCHIVE_PLAN: 'ARCHIVE_PLAN',
  CLEAR_PLAN: 'CLEAR_PLAN',

  // Session actions
  START_SESSION: 'START_SESSION',
  UPDATE_SESSION: 'UPDATE_SESSION',
  UPDATE_EXERCISE: 'UPDATE_EXERCISE',
  COMPLETE_SESSION: 'COMPLETE_SESSION',
  PAUSE_SESSION: 'PAUSE_SESSION',
  END_SESSION: 'END_SESSION',

  // State management
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET_WORKOUT: 'RESET_WORKOUT',

  // Navigation
  SET_VIEW: 'SET_VIEW'
};

const WORKOUT_VIEWS = {
  METHODOLOGIES: 'methodologies',
  ROUTINE_OVERVIEW: 'routine_overview',
  TODAY_TRAINING: 'today_training',
  CALENDAR: 'calendar',
  PROGRESS: 'progress',
  HISTORICAL: 'historical'
};

const SESSION_STATUS = {
  IDLE: 'idle',
  STARTING: 'starting',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const PLAN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

// =============================================================================
// 📊 ESTADO INICIAL
// =============================================================================

const initialState = {
  // ===============================
  // 📋 PLAN STATE
  // ===============================
  plan: {
    currentPlan: null,              // Plan completo desde la API
    planId: null,                   // methodology_plan_id
    planStartDate: null,            // Fecha de inicio del plan
    planType: null,                 // 'automatic' | 'manual'
    methodology: null,              // 'calistenia' | 'hipertrofia' | etc.
    generatedAt: null,              // Timestamp de generación
    status: PLAN_STATUS.DRAFT,      // Estado del plan
    weekTotal: 0,                   // Número total de semanas
    currentWeek: 1,                 // Semana actual
    exerciseDatabase: null          // Base de datos de ejercicios
  },

  // ===============================
  // 🏃 SESSION STATE
  // ===============================
  session: {
    currentSession: null,           // Sesión actual completa
    sessionId: null,                // session_id de la BD
    status: SESSION_STATUS.IDLE,    // Estado de la sesión
    currentExercise: null,          // Ejercicio siendo ejecutado
    exerciseIndex: 0,               // Índice del ejercicio actual
    exerciseProgress: {},           // Progreso por ejercicio {exerciseId: data}
    sessionStarted: null,           // Timestamp inicio de sesión
    sessionPaused: null,            // Timestamp pausa
    sessionCompleted: null,         // Timestamp finalización
    weekNumber: 1,                  // Semana de la sesión
    dayName: null,                  // 'lunes' | 'martes' | etc.
    dayInfo: null,                  // Información completa del día
    totalExercises: 0,              // Total de ejercicios del día
    completedExercises: 0           // Ejercicios completados
  },

  // ===============================
  // 🎯 UI STATE
  // ===============================
  ui: {
    currentView: WORKOUT_VIEWS.METHODOLOGIES, // Vista actual
    isLoading: false,               // Estado de carga global
    error: null,                    // Error actual
    showWarmup: false,              // Mostrar modal de calentamiento
    showSession: false,             // Mostrar modal de sesión
    showFeedback: false,            // Mostrar modal de feedback
    showConfirmation: false         // Mostrar modal de confirmación
  },

  // ===============================
  // 📈 STATS STATE
  // ===============================
  stats: {
    totalSessions: 0,
    completedSessions: 0,
    totalExercisesCompleted: 0,
    averageSessionDuration: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastWorkout: null
  }
};

// =============================================================================
// 🔄 REDUCER
// =============================================================================

function workoutReducer(state, action) {
  switch (action.type) {
    // ===============================
    // 📋 PLAN ACTIONS
    // ===============================
    case WORKOUT_ACTIONS.SET_PLAN:
      return {
        ...state,
        plan: {
          ...state.plan,
          ...action.payload,
          status: PLAN_STATUS.ACTIVE
        },
        ui: { ...state.ui, isLoading: false, error: null }
      };

    case WORKOUT_ACTIONS.UPDATE_PLAN:
      return {
        ...state,
        plan: { ...state.plan, ...action.payload }
      };

    case WORKOUT_ACTIONS.ACTIVATE_PLAN:
      return {
        ...state,
        plan: { ...state.plan, status: PLAN_STATUS.ACTIVE },
        ui: { ...state.ui, currentView: WORKOUT_VIEWS.TODAY_TRAINING }
      };

    case WORKOUT_ACTIONS.CLEAR_PLAN:
      return {
        ...state,
        plan: { ...initialState.plan },
        session: { ...initialState.session },
        ui: { ...state.ui, currentView: WORKOUT_VIEWS.METHODOLOGIES }
      };

    // ===============================
    // 🏃 SESSION ACTIONS
    // ===============================
    case WORKOUT_ACTIONS.START_SESSION:
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload,
          status: SESSION_STATUS.IN_PROGRESS,
          sessionStarted: new Date().toISOString(),
          exerciseIndex: 0,
          completedExercises: 0
        },
        ui: { ...state.ui, showSession: true }
      };

    case WORKOUT_ACTIONS.UPDATE_SESSION:
      return {
        ...state,
        session: { ...state.session, ...action.payload }
      };

    case WORKOUT_ACTIONS.UPDATE_EXERCISE: {
      const { exerciseId, progress } = action.payload;
      return {
        ...state,
        session: {
          ...state.session,
          exerciseProgress: {
            ...state.session.exerciseProgress,
            [exerciseId]: progress
          }
        }
      };
    }

    case WORKOUT_ACTIONS.COMPLETE_SESSION:
      return {
        ...state,
        session: {
          ...state.session,
          status: SESSION_STATUS.COMPLETED,
          sessionCompleted: new Date().toISOString()
        },
        ui: { ...state.ui, showSession: false, showFeedback: true }
      };

    case WORKOUT_ACTIONS.PAUSE_SESSION:
      return {
        ...state,
        session: {
          ...state.session,
          status: SESSION_STATUS.PAUSED,
          sessionPaused: new Date().toISOString()
        }
      };

    case WORKOUT_ACTIONS.END_SESSION:
      return {
        ...state,
        session: { ...initialState.session },
        ui: {
          ...state.ui,
          showSession: false,
          showFeedback: false,
          currentView: WORKOUT_VIEWS.TODAY_TRAINING
        }
      };

    // ===============================
    // 🎯 UI ACTIONS
    // ===============================
    case WORKOUT_ACTIONS.SET_VIEW:
      return {
        ...state,
        ui: { ...state.ui, currentView: action.payload }
      };

    case WORKOUT_ACTIONS.SET_LOADING:
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload }
      };

    case WORKOUT_ACTIONS.SET_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: action.payload, isLoading: false }
      };

    case WORKOUT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: null }
      };

    case WORKOUT_ACTIONS.RESET_WORKOUT:
      return { ...initialState };

    default:
      return state;
  }
}

// =============================================================================
// 🎯 CONTEXTO
// =============================================================================

const WorkoutContext = createContext();

export function WorkoutProvider({ children }) {
  const [state, dispatch] = useReducer(workoutReducer, initialState);
  const { user } = useAuth();

  // =============================================================================
  // 🔄 PERSISTENCIA EN LOCALSTORAGE
  // =============================================================================

  // Cargar estado desde localStorage al inicializar
  useEffect(() => {
    if (!user) return;

    try {
      const savedState = localStorage.getItem(`workout_state_${user.id}`);
      if (savedState) {
        const parsed = JSON.parse(savedState);

        // Restaurar plan si existe
        if (parsed.plan && parsed.plan.planId) {
          dispatch({ type: WORKOUT_ACTIONS.SET_PLAN, payload: parsed.plan });
        }

        // Restaurar sesión activa si existe
        if (parsed.session && parsed.session.status === SESSION_STATUS.IN_PROGRESS) {
          dispatch({ type: WORKOUT_ACTIONS.UPDATE_SESSION, payload: parsed.session });
        }
      }
    } catch (error) {
      console.warn('Error cargando estado del workout desde localStorage:', error);
    }
  }, [user]);

  // Guardar estado en localStorage cuando cambie
  useEffect(() => {
    if (!user) return;

    const stateToSave = {
      plan: state.plan,
      session: state.session,
      stats: state.stats
    };

    try {
      localStorage.setItem(`workout_state_${user.id}`, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Error guardando estado del workout en localStorage:', error);
    }
  }, [state.plan, state.session, state.stats, user]);

  // =============================================================================
  // 📡 PLAN ACTIONS
  // =============================================================================

  const loadActivePlan = useCallback(async () => {
    if (!user) throw new Error('Usuario no autenticado');

    dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: WORKOUT_ACTIONS.CLEAR_ERROR });

    try {
      // Import the API function
      const { getActivePlan } = await import('@/components/routines/api');
      const data = await getActivePlan();

      if (data.hasActivePlan) {
        const planData = {
          currentPlan: data.routinePlan,
          planId: data.methodology_plan_id,
          planStartDate: data.confirmedAt || data.createdAt || new Date().toISOString(),
          planType: data.planSource?.type || 'automatic',
          methodology: data.routinePlan?.selected_style || data.routinePlan?.nombre,
          status: PLAN_STATUS.ACTIVE,
          weekTotal: data.routinePlan?.weeks?.length || 0,
          currentWeek: 1
        };

        dispatch({ type: WORKOUT_ACTIONS.SET_PLAN, payload: planData });
        return { success: true, plan: planData };
      }

      dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: false });
      return { success: false, error: 'No hay plan activo' };
    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [user]);

  const generatePlan = useCallback(async (config) => {
    if (!user) throw new Error('Usuario no autenticado');

    dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: WORKOUT_ACTIONS.CLEAR_ERROR });

    try {
      const response = await fetch('/api/methodology/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Activar plan automáticamente
      const planData = {
        currentPlan: result.plan,
        planId: result.planId,
        planStartDate: new Date().toISOString(),
        planType: config.mode || 'automatic',
        methodology: result.methodology,
        generatedAt: result.metadata?.generatedAt || new Date().toISOString(),
        weekTotal: result.plan?.weeks?.length || 0,
        currentWeek: 1
      };

      dispatch({ type: WORKOUT_ACTIONS.SET_PLAN, payload: planData });

      return result;
    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, [user]);

  const activatePlan = useCallback(async (planId) => {
    if (!planId) throw new Error('Plan ID requerido');

    dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

    try {
      // Import the API function
      const { confirmRoutinePlan } = await import('@/components/routines/api');
      const result = await confirmRoutinePlan({
        methodology_plan_id: planId,
        routine_plan_id: state.plan.currentPlan?.id || planId
      });

      if (result.success) {
        dispatch({ type: WORKOUT_ACTIONS.ACTIVATE_PLAN });
        dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.TODAY_TRAINING });
        return { success: true };
      }

      throw new Error(result.error || 'Error activando el plan');
    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [state.plan.currentPlan]);

  const archivePlan = useCallback(async () => {
    dispatch({ type: WORKOUT_ACTIONS.CLEAR_PLAN });
  }, []);

  // Función específica para cancelar un plan completamente
  const cancelPlan = useCallback(async (methodologyPlanId) => {
    try {
      // Primero hacer la llamada al backend
      const { cancelRoutine } = await import('@/components/routines/api');
      await cancelRoutine({
        methodology_plan_id: methodologyPlanId || state.plan.planId,
        routine_plan_id: state.plan.currentPlan?.id || null
      });

      // Limpiar el estado del contexto
      dispatch({ type: WORKOUT_ACTIONS.CLEAR_PLAN });

      // Limpiar el localStorage
      if (user) {
        localStorage.removeItem(`workout_state_${user.id}`);
      }

      return { success: true };
    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [state.plan.planId, state.plan.currentPlan, user]);

  // =============================================================================
  // 🏃 SESSION ACTIONS
  // =============================================================================

  const startSession = useCallback(async (config) => {
    if (!state.plan.planId) {
      throw new Error('No hay plan activo para iniciar sesión');
    }

    dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

    try {
      // Import the API function
      const { startSession: startSessionAPI } = await import('@/components/routines/api');

      const sessionData = await startSessionAPI({
        methodology_plan_id: config.planId || state.plan.planId,
        week_number: state.plan.currentWeek,
        day_name: config.dayName
      });

      dispatch({
        type: WORKOUT_ACTIONS.START_SESSION,
        payload: {
          currentSession: sessionData,
          sessionId: sessionData.session_id || sessionData.id,
          dayName: config.dayName,
          dayInfo: config.dayInfo || null,
          weekNumber: state.plan.currentWeek,
          totalExercises: sessionData.total_exercises || 0
        }
      });

      dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: false });
      return { success: true, ...sessionData };
    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [state.plan.planId, state.plan.currentWeek]);

  const updateExercise = useCallback(async (exerciseId, progressData) => {
    dispatch({
      type: WORKOUT_ACTIONS.UPDATE_EXERCISE,
      payload: { exerciseId, progress: progressData }
    });

    // Actualizar en backend si hay sesión activa
    if (state.session.sessionId) {
      try {
        await fetch(`/api/routines/sessions/${state.session.sessionId}/progress`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            exerciseId,
            progress: progressData
          })
        });
      } catch (error) {
        console.warn('Error guardando progreso en backend:', error);
      }
    }
  }, [state.session.sessionId]);

  const completeSession = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      await fetch(`/api/routines/sessions/${state.session.sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          completedAt: new Date().toISOString(),
          exerciseProgress: state.session.exerciseProgress
        })
      });

      dispatch({ type: WORKOUT_ACTIONS.COMPLETE_SESSION });
    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, [state.session.sessionId, state.session.exerciseProgress]);

  const pauseSession = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.PAUSE_SESSION });
  }, []);

  const endSession = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.END_SESSION });
  }, []);

  // =============================================================================
  // 🧭 NAVIGATION ACTIONS
  // =============================================================================

  const goToMethodologies = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.METHODOLOGIES });
  }, []);

  const goToTraining = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.TODAY_TRAINING });
  }, []);

  const goToCalendar = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.CALENDAR });
  }, []);

  const goToProgress = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.PROGRESS });
  }, []);

  const resetWorkout = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.RESET_WORKOUT });
    // Limpiar localStorage
    if (user) {
      localStorage.removeItem(`workout_state_${user.id}`);
    }
  }, [user]);

  // =============================================================================
  // 🎯 CONTEXT VALUE
  // =============================================================================

  const contextValue = {
    // Estado
    ...state,

    // Plan actions
    loadActivePlan,
    generatePlan,
    activatePlan,
    archivePlan,
    cancelPlan,

    // Session actions
    startSession,
    updateExercise,
    completeSession,
    pauseSession,
    endSession,

    // Navigation
    goToMethodologies,
    goToTraining,
    goToCalendar,
    goToProgress,
    resetWorkout,

    // Utilities
    isTraining: state.session.status === SESSION_STATUS.IN_PROGRESS,
    isPaused: state.session.status === SESSION_STATUS.PAUSED,
    hasActivePlan: Boolean(state.plan.planId && state.plan.status === PLAN_STATUS.ACTIVE),
    hasActiveSession: Boolean(state.session.sessionId &&
      [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.PAUSED].includes(state.session.status)),

    // UI helpers
    setError: (error) => dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error }),
    showSuccess: (message) => console.log('✅', message), // Temporary success handler
    setLoading: (loading) => dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: loading }),

    // Constants
    WORKOUT_VIEWS,
    SESSION_STATUS,
    PLAN_STATUS
  };

  return (
    <WorkoutContext.Provider value={contextValue}>
      {children}
    </WorkoutContext.Provider>
  );
}

// =============================================================================
// 🪝 HOOK PERSONALIZADO
// =============================================================================

export function useWorkout() {
  const context = useContext(WorkoutContext);

  if (!context) {
    throw new Error('useWorkout debe ser usado dentro de un WorkoutProvider');
  }

  return context;
}