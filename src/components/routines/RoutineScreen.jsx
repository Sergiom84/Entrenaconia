import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ArrowLeft, Calendar, Target, Clock, Dumbbell, TrendingUp, CheckCircle, PlayCircle, Users, Zap, X, Trash2, RefreshCw } from 'lucide-react';
import RoutineCalendar from './RoutineCalendar.jsx';
import RoutineDayModal from './RoutineDayModal.jsx';
import RoutineExerciseModal from './RoutineExerciseModal.jsx';
import RoutineSessionSummary from './RoutineSessionSummary.jsx';
import SessionProgress from './SessionProgress.jsx';
import RoutineStatsCard from './RoutineStatsCard.jsx';

export default function RoutineScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, user } = useAuth();
  const { userData } = useUserContext();

  const [routinePlan, setRoutinePlan] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Persistencia y progreso
  const [routinePlanId, setRoutinePlanId] = useState(null);
  const [routineSessionId, setRoutineSessionId] = useState(null);
  const [sessionStartAtMs, setSessionStartAtMs] = useState(null);

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [completedExercises, setCompletedExercises] = useState([]);
  const [sessionExerciseStatuses, setSessionExerciseStatuses] = useState([]);
  const [routineStats, setRoutineStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [lastStatsUpdate, setLastStatsUpdate] = useState(0);
  const [hasTriedLoadingPlan, setHasTriedLoadingPlan] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hydrated, setHydrated] = useState(null);
  const [uiState, setUIState] = useState('LOADING'); // 'LOADING', 'READY', 'ARCHIVED', 'ERROR'
  const didInit = useRef(false);

  // Función para cargar el plan más reciente desde la BD
  const loadLatestRoutinePlan = async () => {
    try {
      setIsLoading(true);
      setError(null); // Limpiar errores previos
      console.log('🔍 Intentando cargar plan más reciente desde BD...');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No hay sesión activa. Por favor, inicia sesión.');
        return;
      }

      // Crear una sesión temporal para activar la lógica de migración del backend
      console.log('🔄 Activando migración de plan desde metodología...');
      
      // Buscar el plan más reciente del usuario
      const plansResponse = await fetch('/api/routines/history?limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!plansResponse.ok) {
        setError('No se pudo cargar el historial de rutinas.');
        return;
      }
      
      const plansData = await plansResponse.json();
      if (!plansData.success || !plansData.routines || plansData.routines.length === 0) {
        setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Metodologías.');
        return;
      }
      
      const latestPlan = plansData.routines[0];
      
      // El backend tiene lógica que automáticamente migra desde methodology_plans si no encuentra en routine_plans
      const response = await fetch('/api/routines/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          routinePlanId: latestPlan.id,
          weekNumber: 1,
          dayName: 'Lun',
          totalExpected: 0
        })
      });

      if (response.ok) {
        const sessionData = await response.json();
        console.log('✅ Sesión creada, plan migrado automáticamente');
        
        // Ahora intentar obtener las estadísticas que nos darán acceso al plan
        const statsResponse = await fetch(`/api/routines/plans/${latestPlan.id}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (statsResponse.ok) {
          console.log('❌ No se puede crear un plan hardcodeado. Todos los planes deben generarse por IA basándose en el perfil del usuario.');
          setError('No hay plan de rutina válido disponible. Por favor, genere un nuevo plan desde Metodologías usando IA.');
          return;
        }
      }
      
      // Si no se pudo cargar, mostrar error
      setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Metodologías.');
    } catch (error) {
      console.error('❌ Error cargando plan más reciente:', error);
      setError('No hay plan de rutina disponible. Por favor, genere un nuevo plan desde Metodologías.');
    } finally {
      setIsLoading(false);
      setHasTriedLoadingPlan(true);
      setInitialLoad(false);
    }
  };

  // Limpiar localStorage al entrar o si no hay usuario
  useEffect(() => {
    if (!currentUser) {
      localStorage.removeItem('routinePlan');
      localStorage.removeItem('routineSessionId');
      localStorage.removeItem('routineState');
      localStorage.removeItem('currentRoutinePlan');
      localStorage.removeItem('currentRoutinePlanId');
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
    }
  }, [currentUser]);

  useEffect(() => {
    const planFromNavigation = location.state?.routinePlan;
    const planIdFromNavigation = location.state?.planId;
    const planMetadataFromNavigation = location.state?.planMetadata;
    const planFromStorage = localStorage.getItem('currentRoutinePlan');
    const planIdFromStorage = localStorage.getItem('currentRoutinePlanId');
    const sessionIdFromStorage = localStorage.getItem('currentRoutineSessionId');
    const sessionStartFromStorage = localStorage.getItem('currentRoutineSessionStartAt');

    if (planFromNavigation) {
      console.log('🆕 Nuevo plan desde navegación, limpiando sesión anterior...');
      
      // Limpiar sesión anterior cuando llega un nuevo plan
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
      setRoutineSessionId(null);
      setCurrentSessionData(null);
      setTrainingInProgress(false);
      setCompletedExercises([]);
      setSessionExerciseStatuses([]);
      setCurrentExerciseIndex(0);
      
      const enhancedPlan = { plan: planFromNavigation, metadata: planMetadataFromNavigation };
      setRoutinePlan(enhancedPlan);
      localStorage.setItem('currentRoutinePlan', JSON.stringify(enhancedPlan));
      setHasTriedLoadingPlan(true); // Plan cargado desde navegación
      setInitialLoad(false);
      
      console.log('✅ Estado de sesión limpiado para nuevo plan');
    } else if (planFromStorage) {
      try { 
        setRoutinePlan(JSON.parse(planFromStorage)); 
        setHasTriedLoadingPlan(true); // Plan cargado desde localStorage
        setInitialLoad(false);
      } catch (error) { 
        console.error('Error parsing routine plan from storage:', error); 
        setError('Error cargando el plan de rutina guardado');
        setHasTriedLoadingPlan(true);
        setInitialLoad(false);
      }
    } else {
      // Limpiar localStorage huérfano antes de cargar desde BD
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
      setRoutineSessionId(null);
      setCurrentSessionData(null);
      setTrainingInProgress(false);
      
      // Intentar cargar el plan más reciente desde BD (asíncrono)
      loadLatestRoutinePlan().catch(console.error);
    }
    
    // Marcar que ya no estamos en carga inicial después de un breve delay
    setTimeout(() => setInitialLoad(false), 100);

    if (planIdFromNavigation) {
      setRoutinePlanId(planIdFromNavigation);
      localStorage.setItem('currentRoutinePlanId', String(planIdFromNavigation));
    } else if (planIdFromStorage) {
      setRoutinePlanId(Number(planIdFromStorage));
    }

    // Solo hidratar sesión si NO hay un plan nuevo desde navegación Y si el plan viene del storage o navegación
    if (!planFromNavigation && sessionIdFromStorage && (planFromStorage || planFromNavigation)) {
      console.log('🔄 Hidratando sesión existente...');
      setRoutineSessionId(Number(sessionIdFromStorage));
      if (sessionStartFromStorage) setSessionStartAtMs(Number(sessionStartFromStorage));
      hydrateSession(Number(sessionIdFromStorage)).catch(error => {
        console.warn('⚠️ Error hidratando sesión antigua, limpiando localStorage:', error.message);
        // Si la sesión no existe, limpiar localStorage
        localStorage.removeItem('currentRoutineSessionId');
        localStorage.removeItem('currentRoutineSessionStartAt');
        setRoutineSessionId(null);
        setCurrentSessionData(null);
        setTrainingInProgress(false);
      });
    } else if (sessionIdFromStorage && !planFromStorage && !planFromNavigation) {
      // Si hay sessionId pero no plan, limpiar datos huérfanos
      console.log('🧹 Limpiando datos de sesión huérfanos...');
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
    }
  }, [location.state]);

  // Un solo POST con useRef para evitar doble POST
  useEffect(() => {
    if (!currentUser || didInit.current || !routinePlanId) return;
    didInit.current = true;

    // Solo hacer POST si tenemos los datos necesarios
    const selectedWeek = currentWeek || 1;
    const selectedDayName = selectedDay?.dia || 'Lun'; // Default day
    const dayExercises = selectedDay?.ejercicios || [];

    console.log('[RoutineScreen] Iniciando POST de sesión:', { routinePlanId, selectedWeek, selectedDayName });

    const payload = {
      routinePlanId: routinePlanId,
      weekNumber: selectedWeek,
      dayName: selectedDayName,
      totalExpected: Array.isArray(dayExercises) ? dayExercises.length : 0
    };

    const token = localStorage.getItem('token');
    if (!token) {
      setUIState('ERROR');
      return;
    }

    fetch('/api/routines/sessions', { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }, 
      body: JSON.stringify(payload) 
    })
    .then(async r => {
      console.log('[RoutineScreen] POST response status:', r.status);
      if (r.status === 204) {
        setHydrated(null);
        setUIState('ARCHIVED');
        return null;
      }
      if (r.status === 409) {
        setUIState('ARCHIVED');
        throw new Error('PLAN_ARCHIVED');
      }
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(`UpsertFailed: ${r.status} - ${errorData.error || r.statusText}`);
      }
      return r.json();
    })
    .then(data => {
      if (!data) { 
        setHydrated(null); 
        setUIState('ARCHIVED');
        return; 
      }
      console.log('[RoutineScreen] Session upsert success:', data);
      setHydrated(data);
      setUIState('READY');
      localStorage.setItem('routineSessionId', data.id);
    })
    .catch(err => {
      console.error('[RoutineScreen] POST session error:', err);
      if (err.message === 'PLAN_ARCHIVED') { 
        setUIState('ARCHIVED'); 
        return; 
      }
      console.error('hydrate session error', err); 
      setUIState('ERROR');
    });
  }, [currentUser, routinePlanId, currentWeek, selectedDay]);

  // Efecto separado para cargar estadísticas cuando routinePlanId esté disponible
  useEffect(() => {
    if (routinePlanId && uiState === 'READY') {
      fetchRoutineStats();
    }
  }, [routinePlanId, uiState]);

  // Función para limpiar rutina cancelada/inválida
  const handleInvalidRoutine = (errorCode) => {
    console.log('🧹 Limpiando rutina inválida...', errorCode);
    
    // Limpiar localStorage
    localStorage.removeItem('currentRoutinePlan');
    localStorage.removeItem('currentRoutinePlanId');
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
    localStorage.removeItem('routinePlan');
    localStorage.removeItem('routineSessionId');
    localStorage.removeItem('routineState');
    
    // Limpiar estado
    setRoutinePlan(null);
    setRoutinePlanId(null);
    setRoutineSessionId(null);
    setCurrentSessionData(null);
    setTrainingInProgress(false);
    setCompletedExercises([]);
    setSessionExerciseStatuses([]);
    setCurrentExerciseIndex(0);
    setRoutineStats(null);
    setHydrated(null);
    
    if (errorCode === 'ROUTINE_CANCELLED') {
      setError('La rutina ha sido cancelada. No hay rutinas disponibles.');
      setUIState('ARCHIVED');
    } else {
      setError('No hay rutinas disponibles. Por favor, genere una nueva rutina desde Metodologías.');
      setUIState('ERROR');
    }
  };

  const fetchRoutineStats = async (force = false) => {
    // Evitar llamadas múltiples con caché de 30 segundos
    const now = Date.now();
    if (!force && isLoadingStats) return;
    if (!force && lastStatsUpdate > 0 && (now - lastStatsUpdate) < 30000) return;

    try {
      setIsLoadingStats(true);
      const token = localStorage.getItem('token');
      if (!token || !routinePlanId) return;

      console.log('📊 Cargando estadísticas de rutina...');
      const response = await fetch(`/api/routines/plans/${routinePlanId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRoutineStats(data.stats);
        setLastStatsUpdate(now);
        console.log('✅ Estadísticas actualizadas');
      } else if (response.status === 409) {
        // Plan archivado
        console.warn('Plan archivado detectado');
        handleInvalidRoutine('PLAN_ARCHIVED');
        return;
      } else if (response.status === 410) {
        // Rutina cancelada
        const data = await response.json();
        console.warn('Rutina cancelada detectada:', data);
        handleInvalidRoutine(data.code);
        return;
      } else if (response.status === 404) {
        // Rutina no encontrada
        console.warn('Rutina no encontrada');
        handleInvalidRoutine('ROUTINE_NOT_FOUND');
        return;
      } else {
        console.error('Error fetching routine stats:', response.statusText);
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas de rutina:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleBackToMethodologies = () => { navigate('/methodologies'); };

  const handleCancelRoutine = async () => {
    const confirmed = window.confirm('¿Estás seguro de que quieres cancelar esta rutina?\n\nSe eliminará tu plan actual y tendrás que generar uno nuevo desde Metodologías.');
    if (confirmed) {
      try {
        setIsLoading(true);
        
        // Obtener planId actual
        const currentRoutinePlanId = routinePlanId || Number(localStorage.getItem('currentRoutinePlanId'));
        if (!currentRoutinePlanId) {
          throw new Error('No se encontró el ID del plan a cancelar');
        }
        
        console.log('🗑️ Cancelando rutina con planId:', currentRoutinePlanId);
        
        // Llamar al backend para cancelar la rutina
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/routines/plans/${currentRoutinePlanId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error cancelando rutina');
        }
        
        const result = await response.json();
        console.log('✅ Rutina cancelada exitosamente:', result);
        
        // Limpiar estado local después del éxito en backend
        localStorage.removeItem('currentRoutinePlan');
        localStorage.removeItem('currentRoutinePlanId');
        setRoutinePlan(null);
        setRoutinePlanId(null);
        setSelectedDay(null);
        setShowDayModal(false);
        setCurrentWeek(1);
        setCurrentSessionData(null);
        setRoutineSessionId(null);
        setSessionStartAtMs(null);
        setTrainingInProgress(false);
        setCompletedExercises([]);
        setSessionExerciseStatuses([]);
        setRoutineStats(null);
        setShowExerciseModal(false);
        setCurrentExerciseIndex(0);
        setHydrated(null);
        setUIState('READY');
        setError('Rutina cancelada exitosamente. Puedes generar una nueva desde Metodologías.');
        
      } catch (error) {
        console.error('❌ Error cancelando rutina:', error);
        setError(`Error cancelando rutina: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDayClick = (dayData, weekNumber) => { setSelectedDay({ ...dayData, weekNumber }); setShowDayModal(true); };
  const handleCloseDayModal = () => { setShowDayModal(false); setSelectedDay(null); };

  const hydrateSession = async (sessId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay token de autenticación disponible');
      }

      console.log('🔄 Hidratando sesión:', sessId);

      const resp = await fetch(`/api/routines/sessions/${sessId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📡 Respuesta hidratación sesión:', resp.status, resp.statusText);

      const data = await resp.json();
      console.log('📦 Datos de sesión recibidos:', data);

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
        } else if (resp.status === 204) {
          // Sin contenido - sesión vacía o plan archivado
          throw new Error('La sesión no está disponible o el plan ha sido archivado');
        } else if (resp.status === 404) {
          throw new Error('Sesión de entrenamiento no encontrada');
        } else {
          throw new Error(data.error || `Error del servidor (${resp.status})`);
        }
      }

      if (!data.success) {
        throw new Error(data.error || 'No se pudo obtener la sesión');
      }

      const s = data.session;
      if (!s) {
        throw new Error('Datos de sesión inválidos');
      }

      const exercises = Array.isArray(s.exercises_data) ? s.exercises_data : [];
      const progressArray = Array.isArray(s.exercises) ? s.exercises : [];
      const completedIdxs = progressArray.filter(e => e.status === 'completed').map(e => e.exercise_order);
      const currentIdx = progressArray.findIndex(e => e.status === 'pending' || e.status === 'in_progress');
      
      // Normalizar estados por índice
      const normalizedStatuses = exercises.map((_, idx) => {
        const p = progressArray.find(pe => pe.exercise_order === idx);
        return p ? { 
          status: p.status, 
          series_completed: p.series_completed, 
          series_total: p.series_total, 
          comment: p.feedback_comment || null
        } : { 
          status: 'pending',
          series_completed: 0,
          series_total: 0,
          comment: null
        };
      });

      const sessionData = {
        metodologia: routinePlan?.selected_style || 'Rutina',
        sesion: { dia: s.day_name, weekNumber: s.week_number },
        weekNumber: s.week_number,
        dayName: s.day_name,
        exercises: exercises.map((ej, idx) => {
          const p = progressArray.find(pe => pe.exercise_order === idx) || {};
          const initialSeries = Math.max(1, Math.min((p.series_completed || 0) + 1, Number(ej.series) || 1));
          return {
            nombre: ej.nombre,
            series: ej.series,
            repeticiones: ej.repeticiones,
            descanso_seg: ej.descanso_seg,
            intensidad: ej.intensidad,
            tempo: ej.tempo || '',
            notas: ej.notas || '',
            initialSeries
          };
        })
      };

      console.log('✅ Sesión hidratada exitosamente:', {
        exercises: sessionData.exercises.length,
        completed: completedIdxs.length,
        currentIndex: currentIdx,
        statuses: normalizedStatuses
      });

      setCurrentSessionData(sessionData);
      setCompletedExercises(completedIdxs);
      setSessionExerciseStatuses(normalizedStatuses);
      setCurrentExerciseIndex(currentIdx >= 0 ? currentIdx : 0);
      setTrainingInProgress(true);
      
      // Actualizar estadísticas después de hidratar (sin forzar para evitar llamadas excesivas)
      if (routinePlanId) {
        await fetchRoutineStats();
      }
      
    } catch (e) {
      console.error('❌ Error hidratando sesión:', e);
      alert(`Error cargando la sesión de entrenamiento: ${e.message}`);
      throw e; // Re-lanzar para que el caller pueda manejarlo
    }
  };

  const handleStartTraining = async (dayData) => {
    try {
      setIsLoading(true);
      
      // Validar datos requeridos
      if (!dayData || !dayData.dia) {
        throw new Error('Datos del día de entrenamiento no válidos');
      }

      // Obtener o validar routinePlanId
      const currentRoutinePlanId = routinePlanId || Number(localStorage.getItem('currentRoutinePlanId'));
      if (!currentRoutinePlanId) {
        throw new Error('No se encontró el ID del plan de rutina. Genera un nuevo plan desde Metodologías.');
      }
      
      if (!routinePlanId) {
        setRoutinePlanId(currentRoutinePlanId);
      }

      // Validar token de autenticación
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión de nuevo.');
      }

      const requestData = {
        routinePlanId: currentRoutinePlanId,
        weekNumber: dayData.weekNumber || currentWeek,
        dayName: dayData.dia
      };

      console.log('🏋️ Iniciando entrenamiento con datos:', requestData);

      // Crear/obtener la sesión en BD
      const resp = await fetch('/api/routines/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(requestData)
      });

      console.log('📡 Respuesta del servidor:', resp.status, resp.statusText);

      const data = await resp.json();
      console.log('📦 Datos recibidos:', data);

      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
        } else if (resp.status === 403) {
          throw new Error('Token inválido. Por favor, inicia sesión de nuevo.');
        } else if (resp.status === 204) {
          throw new Error('La sesión no está disponible o el plan ha sido archivado');
        } else if (resp.status === 409) {
          throw new Error('El plan ha sido archivado. Genera un nuevo plan desde Metodologías.');
        } else if (resp.status === 404) {
          throw new Error(`Plan de rutina no encontrado (ID: ${currentRoutinePlanId}). Genera un nuevo plan desde Metodologías.`);
        } else {
          throw new Error(data.error || `Error del servidor (${resp.status}): ${resp.statusText}`);
        }
      }

      if (!data.success) {
        throw new Error(data.error || 'No se pudo crear la sesión');
      }

      const sess = data.session;
      if (!sess || !sess.id) {
        throw new Error('Respuesta del servidor inválida - sesión no creada');
      }

      console.log('✅ Sesión creada exitosamente:', sess.id);

      setRoutineSessionId(sess.id);
      localStorage.setItem('currentRoutineSessionId', String(sess.id));
      const startMs = Date.now();
      setSessionStartAtMs(startMs);
      localStorage.setItem('currentRoutineSessionStartAt', String(startMs));

      // Hidratar ejercicios/progreso desde la sesión
      await hydrateSession(sess.id);
      setShowExerciseModal(true);
      // Cerrar modal del día solo en éxito
      handleCloseDayModal();
      
    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      const errorMessage = error?.message || 'Error desconocido al iniciar el entrenamiento';
      alert(`Error: ${errorMessage}\n\nSi el problema persiste, intenta generar un nuevo plan desde Metodologías.`);
    } finally {
      setIsLoading(false);
    }
  };

  const persistExerciseProgress = async ({ exerciseIndex, seriesCompleted, status, timeSpent }) => {
    try {
      if (!routineSessionId) {
        console.warn('⚠️ No hay sessionId para persistir progreso');
        return false;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/routines/sessions/${routineSessionId}/exercise/${exerciseIndex}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ seriesCompleted, status, timeSpent })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ Progreso persistido: ejercicio ${exerciseIndex}, series ${seriesCompleted}, status ${status}`);
      return true;
    } catch (e) {
      console.error('❌ Error guardando progreso de ejercicio:', e);
      return false;
    }
  };

  const handleUpdateProgress = async (exerciseIndex, seriesCompleted, seriesTotal) => {
    const status = seriesCompleted >= seriesTotal ? 'completed' : 'in_progress';
    const success = await persistExerciseProgress({ exerciseIndex, seriesCompleted, status });
    
    if (success) {
      // Actualizar estado local solo si se persistió correctamente
      setSessionExerciseStatuses(prev => {
        const next = [...prev];
        const existing = next[exerciseIndex] || {};
        next[exerciseIndex] = { 
          ...existing, 
          status, 
          series_completed: seriesCompleted, 
          series_total: seriesTotal 
        };
        return next;
      });
      
      if (status === 'completed') {
        setCompletedExercises(prev => prev.includes(exerciseIndex) ? prev : [...prev, exerciseIndex]);
        // Actualizar estadísticas cuando se completa un ejercicio
        setTimeout(() => fetchRoutineStats(true), 1000);
      }
    } else {
      console.warn('⚠️ No se pudo actualizar el progreso en la BD');
    }
  };

  const handleExerciseComplete = async (timeSpent) => {
    console.log(`Ejercicio ${currentExerciseIndex + 1} completado en ${timeSpent}s`);
    const sc = (currentSessionData?.exercises?.[currentExerciseIndex]?.series) || 0;
    await persistExerciseProgress({ exerciseIndex: currentExerciseIndex, seriesCompleted: sc, status: 'completed', timeSpent });
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      next[currentExerciseIndex] = { ...(next[currentExerciseIndex] || {}), status: 'completed', series_completed: sc, series_total: sc };
      return next;
    });
    setCompletedExercises(prev => Array.from(new Set([...prev, currentExerciseIndex])));
    if (currentExerciseIndex < currentSessionData.exercises.length - 1) { setCurrentExerciseIndex(prev => prev + 1); } else { handleFinishTraining(); }
  };

  const handleExerciseSkip = async () => {
    console.log(`Ejercicio ${currentExerciseIndex + 1} saltado`);
    await persistExerciseProgress({ exerciseIndex: currentExerciseIndex, seriesCompleted: 0, status: 'skipped' });
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      next[currentExerciseIndex] = { ...(next[currentExerciseIndex] || {}), status: 'skipped', series_completed: 0 };
      return next;
    });
    if (currentExerciseIndex < currentSessionData.exercises.length - 1) { setCurrentExerciseIndex(prev => prev + 1); } else { handleFinishTraining(); }
  };

  const handleExerciseCancel = async () => {
    console.log('Entrenamiento cancelado por el usuario');
    await persistExerciseProgress({ exerciseIndex: currentExerciseIndex, seriesCompleted: 0, status: 'cancelled' });
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      next[currentExerciseIndex] = { ...(next[currentExerciseIndex] || {}), status: 'cancelled', series_completed: 0 };
      return next;
    });
    setShowExerciseModal(false); setTrainingInProgress(false); setCurrentSessionData(null); setCurrentExerciseIndex(0);
  };

  const handleCloseExerciseModal = () => { setShowExerciseModal(false); setTrainingInProgress(false); setCurrentSessionData(null); setCurrentExerciseIndex(0); setCompletedExercises([]); };

  const handleFinishTraining = async () => {
    try {
      console.log('🎉 Entrenamiento finalizado!');
      if (routineSessionId) {
        const token = localStorage.getItem('token');
        const totalDuration = sessionStartAtMs ? Math.floor((Date.now() - sessionStartAtMs) / 1000) : 0;
        await fetch(`/api/routines/sessions/${routineSessionId}/complete`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ totalDuration })
        });
        
        // Actualizar estadísticas después de completar entrenamiento
        await fetchRoutineStats(true); // Forzar actualización
      }
    } catch (e) {
      console.error('Error completando sesión:', e);
    } finally {
      setShowExerciseModal(false); setTrainingInProgress(false); setCurrentSessionData(null); setCurrentExerciseIndex(0); setCompletedExercises([]);
      localStorage.removeItem('currentRoutineSessionId');
      localStorage.removeItem('currentRoutineSessionStartAt');
      alert('¡Felicidades! Has completado tu entrenamiento.');
    }
  };

  const handleFeedbackSubmitted = (exerciseIndex, comment) => {
    setSessionExerciseStatuses(prev => {
      const next = [...prev];
      const existing = next[exerciseIndex] || {};
      next[exerciseIndex] = { 
        ...existing, 
        comment: comment 
      };
      return next;
    });
    console.log(`✅ Comentario actualizado para ejercicio ${exerciseIndex}:`, comment);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">Cargando rutina...</p>
        </div>
      </div>
    );
  }

  // Manejar estados especiales de UI
  if (uiState === 'ARCHIVED') {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <Button onClick={handleBackToMethodologies} variant="outline" className="mb-6 border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Metodologías
          </Button>
          <div className="text-center py-16">
            <Calendar className="w-20 h-20 mx-auto mb-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-white mb-4">Plan Archivado</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">Este plan de rutina ha sido archivado. Genera un nuevo plan para continuar entrenando.</p>
            <Button onClick={handleBackToMethodologies} className="bg-yellow-400 text-black hover:bg-yellow-300">
              <Zap className="w-4 h-4 mr-2" />
              Crear nuevo plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (hydrated === null && uiState !== 'LOADING') {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <Button onClick={handleBackToMethodologies} variant="outline" className="mb-6 border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Metodologías
          </Button>
          <div className="text-center py-16">
            <Calendar className="w-20 h-20 mx-auto mb-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-white mb-4">No hay sesión disponible</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">No se pudo crear una sesión de entrenamiento. Genera una nueva sesión.</p>
            <Button onClick={handleBackToMethodologies} className="bg-yellow-400 text-black hover:bg-yellow-300">
              <Zap className="w-4 h-4 mr-2" />
              Generar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !routinePlan && hasTriedLoadingPlan) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <Button onClick={handleBackToMethodologies} variant="outline" className="mb-6 border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Metodologías
          </Button>
          <div className="text-center py-16">
            <Calendar className="w-20 h-20 mx-auto mb-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-white mb-4">No hay rutina disponible</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">{error || "Para ver tu rutina personalizada, primero necesitas generar una desde la sección de Metodologías usando el botón 'Activar IA'."}</p>
            <Button onClick={handleBackToMethodologies} className="bg-yellow-400 text-black hover:bg-yellow-300">
              <Zap className="w-4 h-4 mr-2" />
              Generar Nueva Rutina
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Soporta dos formatos:
  // - Automático: routinePlan = { plan, metadata }
  // - Manual: routinePlan = plan
  const plan = routinePlan?.plan ?? routinePlan;

  // Si aún no hay plan y se está cargando, mostrar loading
  if (!plan && isLoading) {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">Cargando rutina...</p>
        </div>
      </div>
    );
  }

  // Si no hay plan y no se está cargando, pero tampoco se ha intentado cargar, esperar
  if (!plan && (initialLoad || (!hasTriedLoadingPlan && !isLoading))) {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">Inicializando...</p>
        </div>
      </div>
    );
  }

  // Ejercicios para el resumen (si no hay sesión, usar día seleccionado o primer día con ejercicios de la semana actual)
  const weekIdxForSummary = (currentWeek || 1) - 1;
  const firstDayWithExercises = plan?.semanas?.[weekIdxForSummary]?.sesiones?.find(s => Array.isArray(s?.ejercicios) && s.ejercicios.length > 0);
  const normalizeDayExercises = (day) => (day?.ejercicios || []).map(ej => ({
    nombre: ej.nombre,
    series: ej.series,
    repeticiones: ej.repeticiones,
    descanso_seg: ej.descanso_seg,
    intensidad: ej.intensidad,
    tempo: ej.tempo || '',
    notas: ej.notas || ''
  }));
  const summaryExercises = (currentSessionData?.exercises?.length ? currentSessionData.exercises : (
    selectedDay?.ejercicios?.length ? normalizeDayExercises(selectedDay) : normalizeDayExercises(firstDayWithExercises)
  ));

  // Calcular progreso total de la rutina
  const calculateTotalProgress = () => {
    if (!plan?.semanas || !routineStats) return 0;
    
    const totalSessions = plan?.semanas?.reduce((total, semana) => {
      return total + (semana.sesiones?.length || 0);
    }, 0);
    
    if (totalSessions === 0) return 0;
    
    const completedSessions = routineStats.completed_sessions || 0;
    return Math.min(100, (completedSessions / totalSessions) * 100);
  };

  const totalProgress = calculateTotalProgress();

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={handleBackToMethodologies} variant="outline" className="border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Metodologías
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Mi Rutina Personalizada</h1>
            <p className="text-gray-400">Plan generado con IA</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleBackToMethodologies} variant="outline" className="border-green-500/50 text-green-400 hover:border-green-500 hover:bg-green-500/10" title="Generar nueva rutina">
              <RefreshCw className="w-4 h-4 mr-2" />
              Nueva Rutina
            </Button>
            <Button onClick={handleCancelRoutine} variant="outline" className="border-red-500/50 text-red-400 hover:border-red-500 hover:bg-red-500/10" title="Cancelar rutina actual">
              <Trash2 className="w-4 h-4 mr-2" />
              Cancelar Rutina
            </Button>
          </div>
        </div>

        <Card className="bg-black/80 border-yellow-400/40 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center"><Target className="w-5 h-5 mr-2 text-yellow-400" />Resumen del Plan</CardTitle>
            <CardDescription className="text-gray-400">{plan?.rationale || 'Rutina generada por IA basada en tu perfil'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <div className="flex items-center gap-2 mb-2"><Dumbbell className="w-4 h-4 text-yellow-400" /><span className="text-xs uppercase tracking-wide text-yellow-400">Metodología</span></div>
                <div className="text-lg font-semibold text-white">{plan?.selected_style || 'Personalizada'}</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/30">
                <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-blue-400" /><span className="text-xs uppercase tracking-wide text-blue-400">Duración</span></div>
                <div className="text-lg font-semibold text-white">{plan?.duracion_total_semanas || 4} semanas</div>
              </div>
              <div className="p-4 rounded-lg bg-green-400/10 border border-green-400/30">
                <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-green-400" /><span className="text-xs uppercase tracking-wide text-green-400">Frecuencia</span></div>
                <div className="text-lg font-semibold text-white">{plan?.frecuencia_por_semana || 3}x por semana</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-400/10 border border-purple-400/30">
                <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs uppercase tracking-wide text-purple-400">Progresión</span></div>
                <div className="text-lg font-semibold text-white">{plan?.progresion?.metodo || 'Progresiva'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center mb-6">
          <div className="flex bg-black/50 rounded-lg border border-yellow-400/30 p-1">
            {Array.from({ length: plan?.duracion_total_semanas || 4 }, (_, i) => i + 1).map(weekNum => (
              <Button key={weekNum} variant={currentWeek === weekNum ? 'default' : 'ghost'} size="sm" onClick={() => setCurrentWeek(weekNum)} className={currentWeek === weekNum ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'text-gray-400 hover:text-white hover:bg-yellow-400/10'}>
                Semana {weekNum}
              </Button>
            ))}
          </div>
        </div>

        {trainingInProgress && currentSessionData && (
          <SessionProgress 
            total={currentSessionData.exercises.length} 
            completed={completedExercises.length}
            session={hydrated}
          />
        )}

        {/* Dashboard de estadísticas */}
        <RoutineStatsCard 
          routineStats={routineStats}
          plan={plan}
          totalProgress={totalProgress}
          session={hydrated}
        />

        <RoutineCalendar plan={plan} currentWeek={currentWeek} onDayClick={handleDayClick} />

        {/* Resumen fijo de la sesión actual - siempre visible */}
        <RoutineSessionSummary
          currentRoutine={{
            methodology_type: plan?.selected_style || 'Personalizada',
            exercises: summaryExercises || [],
            estimated_duration: plan?.estimated_duration || 45,
            planSource: location.state?.planSource || { label: 'OpenAI', detail: '' },
            perfil: (() => {
              // Debug: Revisar datos disponibles
              console.log('🔍 DEBUG Perfil - routinePlan:', routinePlan);
              console.log('🔍 DEBUG Perfil - userData:', userData);
              console.log('🔍 DEBUG Perfil - user:', user);
              console.log('🔍 DEBUG Perfil - currentUser:', currentUser);
              
              // Priorizar datos del plan si existen
              const p = (routinePlan?.metadata?.perfil) || (routinePlan?.perfil) || null;
              if (p && (p.nombre || p.edad || p.peso)) return p;
              
              // Usar datos del UserContext
              if (userData) {
                const nombre = userData.nombre || userData.full_name || user?.displayName || currentUser?.displayName || null;
                const edad = userData.edad || userData.age || null;
                const peso = userData.peso || userData.weight || null;
                const altura = userData.altura || userData.height || null;
                const nivel = userData.nivel_actividad || userData.fitness_level || userData.nivel || null;
                
                // Calcular IMC si tenemos peso y altura
                let imc = userData.imc || userData.bmi || null;
                if ((imc == null || isNaN(imc)) && peso != null && altura != null) {
                  const alturaM = Number(altura) > 3 ? Number(altura) / 100 : Number(altura);
                  const bmi = Number(peso) / (alturaM * alturaM);
                  imc = Math.round(bmi * 10) / 10;
                }
                
                return { nombre, edad, peso, altura, nivel, imc };
              }
              
              return null; // No mostrar datos de ejemplo - requiere perfil real
            })()
          }}
          sessionExercises={sessionExerciseStatuses}
          progress={{
            percentage: (() => {
              const ex = (summaryExercises || []);
              if (ex.length === 0) return 0;
              const completedCount = sessionExerciseStatuses.filter(e => e?.status === 'completed').length;
              return Math.round((completedCount / ex.length) * 100);
            })(),
            completedExercises: sessionExerciseStatuses.reduce((arr, e, idx) => (e?.status === 'completed' ? [...arr, idx] : arr), []),
            currentExercise: currentExerciseIndex
          }}
          onContinueTraining={async () => {
            // Registrar actividad diaria cuando se hace clic en "Continuar Entrenamiento"
            if (routinePlanId) {
              try {
                const token = localStorage.getItem('token');
                await fetch(`/api/routines/plans/${routinePlanId}/activity`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                  },
                  body: JSON.stringify({ activityType: 'continue_training' })
                });
                console.log('✅ Actividad diaria registrada');
              } catch (error) {
                console.warn('⚠️ No se pudo registrar la actividad diaria:', error);
              }
            }
            
            // Si ya hay entrenamiento en curso, solo reabrimos el modal
            if (trainingInProgress && currentSessionData?.exercises?.[currentExerciseIndex]) {
              setShowExerciseModal(true);
              return;
            }
            // Reanudar sesión en progreso guardada
            if (routineSessionId) {
              await hydrateSession(routineSessionId);
              setShowExerciseModal(true);
              return;
            }
            // Si hay un día seleccionado, usamos ese
            if (selectedDay) {
              await handleStartTraining(selectedDay);
              return;
            }
            // Buscar el primer día con ejercicios de la semana actual
            const weekIdx = (currentWeek || 1) - 1;
            const candidateDay = plan?.semanas?.[weekIdx]?.sesiones?.find(s => Array.isArray(s?.ejercicios) && s.ejercicios.length > 0);
            if (candidateDay) {
              await handleStartTraining({ ...candidateDay, weekNumber: currentWeek });
            } else {
              alert('Selecciona un día de entrenamiento en el calendario para comenzar.');
            }
          }}
          onGenerateNewPlan={() => navigate('/methodologies')}
        />

        {showDayModal && selectedDay && (
          <RoutineDayModal dayData={selectedDay} onClose={handleCloseDayModal} onStartTraining={handleStartTraining} />
        )}

        {showExerciseModal && currentSessionData && currentSessionData.exercises[currentExerciseIndex] && (
          <RoutineExerciseModal
            exercise={currentSessionData.exercises[currentExerciseIndex]}
            exerciseIndex={currentExerciseIndex}
            totalExercises={currentSessionData.exercises.length}
            onComplete={handleExerciseComplete}
            onSkip={handleExerciseSkip}
            onCancel={handleExerciseCancel}
            onClose={handleCloseExerciseModal}
            sessionData={currentSessionData}
            routineSessionId={routineSessionId}
            onUpdateProgress={handleUpdateProgress}
            onFeedbackSubmitted={handleFeedbackSubmitted}
          />
        )}
      </div>
    </div>
  );
}

