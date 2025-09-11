/**
 * 🎯 useTodaySession - Hook para gestionar la sesión del día actual
 * 
 * RAZONAMIENTO:
 * - Extraído de TodayTrainingTab.jsx para reducir complejidad
 * - Centraliza toda la lógica de sesión actual
 * - Reutilizable en otros componentes que necesiten sesión de hoy
 */

import { useState, useEffect, useMemo } from 'react';
import { getTodaySessionStatus, getPendingExercises, getYesterdayPendingExercises } from '../components/routines/api';
import { computeSessionSummary } from '../utils/exerciseUtils';
import logger from '../utils/logger';

export const useTodaySession = ({ plan, todayName, methodologyPlanId }) => {
  // Estados principales
  const [todaySessionStatus, setTodaySessionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [pendingExercises, setPendingExercises] = useState(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [yesterdayPendingExercises, setYesterdayPendingExercises] = useState(null);
  const [loadingYesterdayPending, setLoadingYesterdayPending] = useState(false);
  const [error, setError] = useState(null);

  // Obtener la sesión del día actual
  const todaySession = useMemo(() => {
    if (!plan?.semanas?.length) return null;
    
    const totalWeeks = plan.duracion_total_semanas || plan.semanas.length;
    const expandedWeeks = Array.from({
      length: totalWeeks
    }, (_, i) => plan.semanas[i] || plan.semanas[0]);

    // Buscar en todas las semanas la sesión correspondiente al día actual
    for (let idx = 0; idx < expandedWeeks.length; idx++) {
      const semana = expandedWeeks[idx];
      if (semana.sesiones?.length) {
        const todaySessionFound = semana.sesiones.find(session => {
          const sessionDay = session.dia?.toLowerCase();
          const currentDay = todayName.toLowerCase();
          return sessionDay === currentDay ||
                 sessionDay === currentDay.replace('é', 'e') ||
                 (sessionDay === 'mie' && currentDay === 'miércoles') ||
                 (sessionDay === 'sab' && currentDay === 'sábado');
        });
        
        if (todaySessionFound) {
          return todaySessionFound;
        }
      }
    }
    return null;
  }, [plan, todayName]);

  // Cargar estado de la sesión del día
  const loadTodaySessionStatus = async () => {
    if (!methodologyPlanId || !todaySession) {
      setLoadingStatus(false);
      return;
    }

    try {
      setLoadingStatus(true);
      setError(null);
      
      // Preparar parámetros correctamente como objeto
      const params = {
        methodology_plan_id: methodologyPlanId,
        week_number: todaySession.weekNumber || 1,
        day_name: todayName
      };
      
      logger.debug('Cargando estado de sesión con parámetros', params, 'Routines');
      
      let statusSource = 'today-status';
      let data = await getTodaySessionStatus(params);
      
      logger.debug('Estado de sesión cargado', { statusSource }, 'Routines');
      
      setTodaySessionStatus(computeSessionSummary(data));
    } catch (error) {
      logger.error('Error cargando estado de sesión', error, 'Routines');
      setError(error.message);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Cargar ejercicios pendientes
  const loadPendingExercises = async () => {
    if (!methodologyPlanId) return;

    try {
      logger.debug('Cargando ejercicios pendientes', { methodologyPlanId }, 'Routines');
      // Pasar como objeto con la clave correcta
      const pendingData = await getPendingExercises({ methodology_plan_id: methodologyPlanId });
      logger.debug('Datos de ejercicios pendientes', pendingData, 'Routines');

      if (pendingData && pendingData.length > 0) {
        logger.info('Hay ejercicios pendientes, mostrando modal', null, 'Routines');
        setPendingExercises(pendingData);
        setShowPendingModal(true);
      } else {
        logger.debug('No hay ejercicios pendientes', null, 'Routines');
      }
    } catch (e) {
      logger.error('Error cargando ejercicios pendientes', e, 'Routines');
    }
  };

  // Cargar ejercicios pendientes del día anterior (solo cuando hoy es día de descanso)
  const loadYesterdayPendingExercises = async () => {
    if (!methodologyPlanId || todaySession) return; // Solo cargar si hoy es día de descanso

    try {
      setLoadingYesterdayPending(true);
      logger.debug('Cargando ejercicios pendientes del día anterior', { methodologyPlanId }, 'Routines');
      
      const yesterdayData = await getYesterdayPendingExercises({ methodology_plan_id: methodologyPlanId });
      logger.debug('Datos de ejercicios pendientes del día anterior', yesterdayData, 'Routines');

      if (yesterdayData && yesterdayData.hasYesterdayPending) {
        logger.info('Hay ejercicios pendientes del día anterior', {
          total: yesterdayData.totalPending,
          sessionId: yesterdayData.sessionId
        }, 'Routines');
        setYesterdayPendingExercises(yesterdayData);
      } else {
        logger.debug('No hay ejercicios pendientes del día anterior', null, 'Routines');
        setYesterdayPendingExercises(null);
      }
    } catch (e) {
      logger.error('Error cargando ejercicios pendientes del día anterior', e, 'Routines');
      setYesterdayPendingExercises(null);
    } finally {
      setLoadingYesterdayPending(false);
    }
  };

  // Efectos
  useEffect(() => {
    loadTodaySessionStatus();
  }, [methodologyPlanId, todayName]);

  useEffect(() => {
    if (methodologyPlanId) {
      loadPendingExercises();
    }
  }, [methodologyPlanId]);

  // Cargar ejercicios pendientes del día anterior cuando es día de descanso
  useEffect(() => {
    if (methodologyPlanId && !todaySession && !loadingStatus) {
      loadYesterdayPendingExercises();
    }
  }, [methodologyPlanId, todaySession, loadingStatus]);

  // Funciones de actualización
  const refreshSessionStatus = () => {
    loadTodaySessionStatus();
  };

  const closePendingModal = () => {
    setShowPendingModal(false);
    setPendingExercises(null);
  };

  return {
    // Estados
    todaySession,
    todaySessionStatus,
    loadingStatus,
    pendingExercises,
    showPendingModal,
    yesterdayPendingExercises,
    loadingYesterdayPending,
    error,
    
    // Funciones
    loadTodaySessionStatus,
    refreshSessionStatus,
    closePendingModal,
    loadYesterdayPendingExercises,
    
    // Setters (para casos específicos)
    setTodaySessionStatus,
    setShowPendingModal,
    setYesterdayPendingExercises
  };
};