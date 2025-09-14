/**
 * 🎯 useTodaySession - Hook para gestionar la sesión del día actual
 * 
 * RAZONAMIENTO:
 * - Extraído de TodayTrainingTab.jsx para reducir complejidad
 * - Centraliza toda la lógica de sesión actual
 * - Reutilizable en otros componentes que necesiten sesión de hoy
 */

import { useState, useEffect, useMemo } from 'react';
import { getTodaySessionStatus } from '../components/routines/api';
import { computeSessionSummary } from '../utils/exerciseUtils';
import logger from '../utils/logger';

export const useTodaySession = ({ plan, todayName, methodologyPlanId }) => {
  // Estados principales
  const [todaySessionStatus, setTodaySessionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
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

  // Cargar estado de la sesión actual (solo día de hoy)
  const loadTodaySessionStatus = async () => {
    if (!methodologyPlanId) {
      setLoadingStatus(false);
      return;
    }
    
    setLoadingStatus(true);
    setError(null);
    
    try {
      // Solo cargar la sesión del día actual si existe
      if (todaySession) {
        const params = {
          methodology_plan_id: methodologyPlanId,
          week_number: todaySession.weekNumber || 1,
          day_name: todayName
        };
        
        logger.debug('Cargando estado de sesión del día', params, 'Routines');
        
        const data = await getTodaySessionStatus(params);
        if (data) {
          setTodaySessionStatus(computeSessionSummary(data));
        } else {
          setTodaySessionStatus(null);
        }
      } else {
        // Si no hay sesión para hoy, establecer como null
        setTodaySessionStatus(null);
      }
      
    } catch (error) {
      logger.error('Error cargando estado de sesión', error, 'Routines');
      setError(error.message);
      setTodaySessionStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };


  // Efectos
  useEffect(() => {
    loadTodaySessionStatus();
  }, [methodologyPlanId, todayName]);


  // ELIMINADO: useEffect complejo de yesterday-pending

  // Funciones de actualización
  const refreshSessionStatus = () => {
    loadTodaySessionStatus();
  };


  // ELIMINADO: función compleja de resolución

  return {
    // Estados
    todaySession,
    todaySessionStatus,
    loadingStatus,
    error,
    
    // Funciones
    loadTodaySessionStatus,
    refreshSessionStatus,
    
    // Setters
    setTodaySessionStatus
  };
};