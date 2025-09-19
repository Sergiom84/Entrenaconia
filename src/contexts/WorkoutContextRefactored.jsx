/**
 * 🏋️ WorkoutContext REFACTORIZADO - Sin localStorage
 *
 * CAMBIOS CRÍTICOS:
 * ✅ hasActivePlan() consulta BD (no localStorage)
 * ✅ Estado real-time desde Supabase
 * ✅ Zero localStorage para datos críticos
 * ✅ APIs robustas para móvil
 * ✅ Sincronización automática
 *
 * @version 2.0.0 - Refactorización Crítica
 */

import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useTrainingStateSync } from '../hooks/useRealtimeSync';

// =============================================================================
// 🎯 TIPOS Y CONSTANTES
// =============================================================================

const WORKOUT_ACTIONS = {
  // Plan actions
  SET_PLAN_STATE: 'SET_PLAN_STATE',
  UPDATE_PLAN: 'UPDATE_PLAN',
  CLEAR_PLAN: 'CLEAR_PLAN',

  // Session actions
  SET_SESSION_STATE: 'SET_SESSION_STATE',
  UPDATE_SESSION: 'UPDATE_SESSION',
  UPDATE_EXERCISE_PROGRESS: 'UPDATE_EXERCISE_PROGRESS',
  CLEAR_SESSION: 'CLEAR_SESSION',

  // State management
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_TRAINING_STATE: 'SET_TRAINING_STATE',

  // Navigation
  SET_VIEW: 'SET_VIEW',

  // Modal management
  SHOW_MODAL: 'SHOW_MODAL',
  HIDE_MODAL: 'HIDE_MODAL',
  HIDE_ALL_MODALS: 'HIDE_ALL_MODALS'
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
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled'
};

// =============================================================================
// 📊 ESTADO INICIAL
// =============================================================================

const initialState = {
  // ===============================
  // 📋 PLAN STATE - Desde BD
  // ===============================
  plan: {
    hasActivePlan: false,           // DESDE BD, no localStorage
    currentPlan: null,              // Plan completo desde Supabase
    planId: null,                   // methodology_plan_id
    planData: null,                 // JSON data del plan
    methodologyType: null,          // 'calistenia', 'hipertrofia', etc.
    status: PLAN_STATUS.DRAFT,      // Estado del plan
    currentWeek: 1,                 // Semana actual
    currentDay: null,               // Día actual
    startedAt: null,                // Timestamp inicio plan
    weekTotal: 0                    // Total semanas
  },

  // ===============================
  // 🏃 SESSION STATE - Desde BD
  // ===============================
  session: {
    hasActiveSession: false,        // DESDE BD, no localStorage
    sessionId: null,                // ID de sesión activa
    status: SESSION_STATUS.IDLE,    // Estado sesión
    currentExercise: null,          // Ejercicio actual
    currentExerciseIndex: 0,        // Índice ejercicio actual
    exerciseProgress: {},           // Progreso por ejercicio
    sessionStarted: null,           // Timestamp inicio
    sessionPaused: null,            // Timestamp pausa
    weekNumber: 1,                  // Semana de la sesión
    dayName: null,                  // Día de la sesión
    totalExercises: 0,              // Total ejercicios
    completedExercises: 0           // Ejercicios completados
  },

  // ===============================
  // 🎯 UI STATE - Solo temporal
  // ===============================
  ui: {
    currentView: WORKOUT_VIEWS.METHODOLOGIES,
    isLoading: false,
    error: null,

    // Modal states (solo UX, no persistir)
    showWarmup: false,
    showSession: false,
    showFeedback: false,
    showConfirmation: false,
    showPlanConfirmation: false,
    showRoutineSession: false,
    showVersionSelection: false,
    showMethodologyDetails: false,
    showActiveTrainingWarning: false,
    showCalisteniaManual: false
  },

  // ===============================
  // 📈 STATS STATE - Desde BD
  // ===============================
  stats: {
    totalSessions: 0,
    completedSessions: 0,
    inProgressSessions: 0,
    lastTrainingDate: null,
    avgSessionDuration: 0
  },

  // ===============================
  // 🔄 SYNC STATE
  // ===============================
  sync: {
    lastSynced: null,
    isSyncing: false,
    syncError: null
  }
};

// =============================================================================
// 🔄 REDUCER
// =============================================================================

function workoutReducer(state, action) {
  switch (action.type) {
    case WORKOUT_ACTIONS.SET_TRAINING_STATE: {
      const { data } = action.payload;
      return {
        ...state,
        plan: {
          ...state.plan,
          hasActivePlan: data.hasActivePlan,
          currentPlan: data.activePlan?.planData || null,
          planId: data.activePlan?.planId || null,
          methodologyType: data.activePlan?.methodologyType || null,
          status: data.activePlan?.status || PLAN_STATUS.DRAFT,
          currentWeek: data.activePlan?.currentWeek || 1,
          currentDay: data.activePlan?.currentDay || null,
          startedAt: data.activePlan?.startedAt || null
        },
        session: {
          ...state.session,
          hasActiveSession: data.hasActiveSession,
          sessionId: data.activeSessionId,
          status: data.hasActiveSession ? SESSION_STATUS.IN_PROGRESS : SESSION_STATUS.IDLE,
          currentExerciseIndex: data.currentExerciseIndex || 0,
          sessionStarted: data.sessionStartedAt,
          sessionPaused: data.sessionPausedAt
        },
        ui: {
          ...state.ui,
          currentView: data.currentView || WORKOUT_VIEWS.METHODOLOGIES,
          isLoading: false,
          error: null
        },
        stats: data.stats || state.stats,
        sync: {
          ...state.sync,
          lastSynced: new Date().toISOString(),
          isSyncing: false,
          syncError: null
        }
      };
    }

    case WORKOUT_ACTIONS.SET_PLAN_STATE:
      return {
        ...state,
        plan: {
          ...state.plan,
          ...action.payload,
          hasActivePlan: true
        }
      };

    case WORKOUT_ACTIONS.UPDATE_PLAN:
      return {
        ...state,
        plan: { ...state.plan, ...action.payload }
      };

    case WORKOUT_ACTIONS.CLEAR_PLAN:
      return {
        ...state,
        plan: { ...initialState.plan },
        session: { ...initialState.session }
      };

    case WORKOUT_ACTIONS.SET_SESSION_STATE:
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload,
          hasActiveSession: true
        }
      };

    case WORKOUT_ACTIONS.UPDATE_SESSION:
      return {
        ...state,
        session: { ...state.session, ...action.payload }
      };

    case WORKOUT_ACTIONS.UPDATE_EXERCISE_PROGRESS: {
      const { exerciseIndex, progressData } = action.payload;
      return {
        ...state,
        session: {
          ...state.session,
          exerciseProgress: {
            ...state.session.exerciseProgress,
            [exerciseIndex]: progressData
          }
        }
      };
    }

    case WORKOUT_ACTIONS.CLEAR_SESSION:
      return {
        ...state,
        session: { ...initialState.session }
      };

    case WORKOUT_ACTIONS.SET_VIEW:
      return {
        ...state,
        ui: { ...state.ui, currentView: action.payload }
      };

    case WORKOUT_ACTIONS.SET_LOADING:
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload },
        sync: { ...state.sync, isSyncing: action.payload }
      };

    case WORKOUT_ACTIONS.SET_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: action.payload, isLoading: false },
        sync: { ...state.sync, syncError: action.payload, isSyncing: false }
      };

    case WORKOUT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: null },
        sync: { ...state.sync, syncError: null }
      };

    // Modal actions (same as before, but not persisted)
    case WORKOUT_ACTIONS.SHOW_MODAL: {
      const modalKey = `show${action.payload.charAt(0).toUpperCase() + action.payload.slice(1)}`;
      const mappedKey = modalKey.replace('calisteniaManual', 'CalisteniaManual')
                              .replace('planConfirmation', 'PlanConfirmation')
                              .replace('routineSession', 'RoutineSession')
                              .replace('versionSelection', 'VersionSelection')
                              .replace('methodologyDetails', 'MethodologyDetails')
                              .replace('activeTrainingWarning', 'ActiveTrainingWarning');

      return {
        ...state,
        ui: {
          ...state.ui,
          [mappedKey]: true
        }
      };
    }

    case WORKOUT_ACTIONS.HIDE_MODAL: {
      const modalKey = `show${action.payload.charAt(0).toUpperCase() + action.payload.slice(1)}`;
      const mappedKey = modalKey.replace('calisteniaManual', 'CalisteniaManual')
                              .replace('planConfirmation', 'PlanConfirmation')
                              .replace('routineSession', 'RoutineSession')
                              .replace('versionSelection', 'VersionSelection')
                              .replace('methodologyDetails', 'MethodologyDetails')
                              .replace('activeTrainingWarning', 'ActiveTrainingWarning');

      return {
        ...state,
        ui: {
          ...state.ui,
          [mappedKey]: false
        }
      };
    }

    case WORKOUT_ACTIONS.HIDE_ALL_MODALS:
      return {
        ...state,
        ui: {
          ...state.ui,
          showWarmup: false,
          showSession: false,
          showFeedback: false,
          showConfirmation: false,
          showPlanConfirmation: false,
          showRoutineSession: false,
          showVersionSelection: false,
          showMethodologyDetails: false,
          showActiveTrainingWarning: false,
          showCalisteniaManual: false
        }
      };

    default:
      return state;
  }
}

// =============================================================================
// 🎯 CONTEXTO REFACTORIZADO
// =============================================================================

const WorkoutContext = createContext();

export function WorkoutProvider({ children }) {
  const [state, dispatch] = useReducer(workoutReducer, initialState);
  const { user } = useAuth();

  // =============================================================================
  // 🔄 SISTEMA DE SINCRONIZACIÓN REAL-TIME
  // =============================================================================

  // =============================================================================
  // 📡 API HELPERS - NUEVAS APIS ROBUSTAS
  // =============================================================================

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      ...options
    };

    const response = await fetch(`/api${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }, []);

  // =============================================================================
  // 🔄 SINCRONIZACIÓN CON BD - REEMPLAZA localStorage
  // =============================================================================

  const syncTrainingState = useCallback(async () => {
    if (!user?.id) return;

    try {
      dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

      const result = await apiCall('/training/state');

      if (result.success) {
        dispatch({
          type: WORKOUT_ACTIONS.SET_TRAINING_STATE,
          payload: { data: result.data }
        });
      }

    } catch (error) {
      console.error('Error sincronizando estado:', error);
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      throw error; // Re-throw para el sistema de real-time sync
    }
  }, [user?.id, apiCall]);

  // Integrar sistema de real-time sync
  const realtimeSync = useTrainingStateSync(syncTrainingState, {
    enabled: !!user?.id,
    dependencies: [user?.id],
    onError: (error) => {
      console.error('🔄 Real-time sync error:', error);
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: `Sync: ${error.message}` });
    },
    onSync: (result) => {
      console.log('🔄 Real-time sync completed:', result);
      dispatch({ type: WORKOUT_ACTIONS.CLEAR_ERROR });
    }
  });

  // =============================================================================
  // 📋 PLAN ACTIONS - SIN localStorage
  // =============================================================================

  const generatePlan = useCallback(async (config) => {
    if (!user) throw new Error('Usuario no autenticado');

    dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

    try {
      let requestBody;

      if (config.mode === 'calistenia') {
        const { calisteniaData } = config;
        requestBody = {
          userProfile: calisteniaData.userProfile || { id: user.id },
          selectedLevel: calisteniaData.level || 'basico',
          goals: calisteniaData.goals || '',
          selectedMuscleGroups: calisteniaData.selectedMuscleGroups || [],
          aiEvaluation: calisteniaData.aiEvaluation || null,
          methodology: calisteniaData.methodology || 'Calistenia Specialist',
          source: calisteniaData.source || 'manual_selection',
          version: calisteniaData.version || '5.0'
        };
      } else {
        requestBody = config;
      }

      const result = await apiCall('/routine-generation/ai/methodology', {
        method: 'POST',
        body: JSON.stringify({
          ...requestBody,
          mode: config.mode
        })
      });

      // El plan se activa automáticamente en BD, forzar sincronización
      await realtimeSync.forceSync();

      return result;

    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, [user, apiCall, syncTrainingState]);

  const activatePlan = useCallback(async (planId) => {
    if (!planId) throw new Error('Plan ID requerido');

    try {
      dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

      const result = await apiCall('/training/activate-plan', {
        method: 'POST',
        body: JSON.stringify({ methodology_plan_id: planId })
      });

      if (result.success) {
        // Forzar sincronización después de activación
        await realtimeSync.forceSync();
        dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.TODAY_TRAINING });
        return { success: true };
      }

      throw new Error(result.error || 'Error activando el plan');

    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [apiCall, syncTrainingState]);

  const cancelPlan = useCallback(async () => {
    try {
      dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

      const result = await apiCall('/training/cancel-plan', {
        method: 'POST'
      });

      if (result.success) {
        dispatch({ type: WORKOUT_ACTIONS.CLEAR_PLAN });
        dispatch({ type: WORKOUT_ACTIONS.SET_VIEW, payload: WORKOUT_VIEWS.METHODOLOGIES });
        return { success: true };
      }

      throw new Error(result.error || 'Error cancelando el plan');

    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [apiCall]);

  // =============================================================================
  // 🏃 SESSION ACTIONS - SIN localStorage
  // =============================================================================

  const startSession = useCallback(async (config) => {
    if (!state.plan.planId) {
      throw new Error('No hay plan activo para iniciar sesión');
    }

    try {
      dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: true });

      const result = await apiCall('/training/start-session', {
        method: 'POST',
        body: JSON.stringify({
          methodology_plan_id: config.planId || state.plan.planId,
          week_number: state.plan.currentWeek,
          day_name: config.dayName
        })
      });

      if (result.success) {
        dispatch({
          type: WORKOUT_ACTIONS.SET_SESSION_STATE,
          payload: {
            sessionId: result.data.session_id,
            status: SESSION_STATUS.IN_PROGRESS,
            dayName: config.dayName,
            weekNumber: state.plan.currentWeek,
            sessionStarted: result.data.started_at
          }
        });

        // Actualizar estado en BD
        await apiCall('/training/state', {
          method: 'PUT',
          body: JSON.stringify({
            is_training: true,
            session_started_at: result.data.started_at
          })
        });

        return { success: true, ...result.data };
      }

      throw new Error(result.error || 'Error iniciando sesión');

    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, [state.plan.planId, state.plan.currentWeek, apiCall]);

  const updateExerciseProgress = useCallback(async (exerciseIndex, progressData) => {
    dispatch({
      type: WORKOUT_ACTIONS.UPDATE_EXERCISE_PROGRESS,
      payload: { exerciseIndex, progressData }
    });

    // Actualizar progreso en BD
    if (state.session.sessionId) {
      try {
        await apiCall(`/training/session/${state.session.sessionId}/progress`, {
          method: 'PUT',
          body: JSON.stringify({
            exerciseIndex,
            exerciseData: progressData.exerciseData || {},
            progressData
          })
        });
      } catch (error) {
        console.warn('Error guardando progreso en BD:', error);
      }
    }
  }, [state.session.sessionId, apiCall]);

  const completeSession = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      const result = await apiCall(`/training/session/${state.session.sessionId}/complete`, {
        method: 'POST'
      });

      if (result.success) {
        dispatch({ type: WORKOUT_ACTIONS.CLEAR_SESSION });
        // Forzar sincronización después de completar
        await realtimeSync.forceSync();
        return { success: true };
      }

      throw new Error(result.error || 'Error completando sesión');

    } catch (error) {
      dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, [state.session.sessionId, apiCall, syncTrainingState]);

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

  // =============================================================================
  // 🎭 MODAL ACTIONS
  // =============================================================================

  const showModal = useCallback((modalName) => {
    dispatch({ type: WORKOUT_ACTIONS.SHOW_MODAL, payload: modalName });
  }, []);

  const hideModal = useCallback((modalName) => {
    dispatch({ type: WORKOUT_ACTIONS.HIDE_MODAL, payload: modalName });
  }, []);

  const hideAllModals = useCallback(() => {
    dispatch({ type: WORKOUT_ACTIONS.HIDE_ALL_MODALS });
  }, []);

  // =============================================================================
  // 🎯 CONTEXT VALUE
  // =============================================================================

  const contextValue = {
    // Estado completo
    ...state,

    // Plan actions (sin localStorage)
    generatePlan,
    activatePlan,
    cancelPlan,
    syncTrainingState: realtimeSync.forceSync, // Usar sync forzado del sistema real-time

    // Session actions (persistidas en BD)
    startSession,
    updateExerciseProgress,
    completeSession,

    // Navigation
    goToMethodologies,
    goToTraining,
    goToCalendar,
    goToProgress,

    // Modal actions
    showModal,
    hideModal,
    hideAllModals,

    // Utilities (basadas en estado BD)
    isTraining: state.session.status === SESSION_STATUS.IN_PROGRESS,
    isPaused: state.session.status === SESSION_STATUS.PAUSED,
    hasActivePlan: state.plan.hasActivePlan, // DESDE BD, no localStorage
    hasActiveSession: state.session.hasActiveSession, // DESDE BD, no localStorage

    // UI helpers
    ui: {
      ...state.ui,
      showModal,
      hideModal,
      hideAllModals,
      setError: (error) => dispatch({ type: WORKOUT_ACTIONS.SET_ERROR, payload: error }),
      clearError: () => dispatch({ type: WORKOUT_ACTIONS.CLEAR_ERROR }),
      setLoading: (loading) => dispatch({ type: WORKOUT_ACTIONS.SET_LOADING, payload: loading })
    },

    // Real-time sync (exponer para componentes)
    realtimeSync: {
      isActive: realtimeSync.isActive,
      lastSync: realtimeSync.lastSync,
      error: realtimeSync.error,
      stats: realtimeSync.stats,
      forceSync: realtimeSync.forceSync,
      resetSync: realtimeSync.resetSync
    },

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