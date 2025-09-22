import { useState, useCallback, useMemo } from 'react';

/**
 * Hook personalizado para manejar el progreso de ejercicios y navegación
 *
 * Extraído de RoutineSessionModal.jsx para mejor organización
 * Maneja estados: completed, skipped, cancelled, in_progress
 * Y navegación entre ejercicios
 */
export const useExerciseProgress = (session, exercises) => {
  // Estados del progreso
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Calcular índice inicial basado en progreso existente
    if (!session?.exerciseProgress) return 0;

    // Buscar el primer ejercicio que NO esté completado (permitimos skipped/cancelled aparecer)
    for (let i = 0; i < exercises.length; i++) {
      const progress = session.exerciseProgress.find(p => p.exercise_order === i);
      if (!progress || String(progress.status).toLowerCase() !== 'completed') {
        return i;
      }
    }

    // Si todos están completados, empezar desde el último
    return Math.max(0, exercises.length - 1);
  });

  const [exerciseStates, setExerciseStates] = useState({}); // { exerciseIndex: 'completed' | 'skipped' | 'cancelled' }

  // Ejercicio actual
  const currentExercise = useMemo(() => exercises[currentIndex] || null, [exercises, currentIndex]);
  const total = exercises.length;
  const seriesTotal = Number(currentExercise?.series) || 3;

  // Encontrar el siguiente ejercicio NO completado (permitimos skipped/cancelled)
  const findNextIncompleteExercise = useCallback((fromIndex = currentIndex + 1) => {
    for (let i = fromIndex; i < exercises.length; i++) {
      // Estado efectivo: preferir local (recién marcado), si no, estado de BD
      const localState = exerciseStates[i];
      const dbState = session?.exerciseProgress?.find(p => p.exercise_order === i)?.status;
      const status = (localState ?? dbState ?? '').toLowerCase();

      if (status !== 'completed') {
        return i;
      }
    }
    return exercises.length; // No hay más ejercicios incompletos
  }, [currentIndex, session, exercises, exerciseStates]);

  // Generar mensaje final basado en estados
  const generateEndMessage = useCallback(() => {
    const states = Object.values(exerciseStates);
    const totalExercises = exercises.length;
    const completed = states.filter(state => state === 'completed').length;
    const skipped = states.filter(state => state === 'skipped').length;
    const cancelled = states.filter(state => state === 'cancelled').length;
    const remaining = totalExercises - completed - skipped - cancelled;

    // Todos completados
    if (completed === totalExercises) {
      return {
        title: '¡Felicidades!',
        message: '¡Has completado todo el entrenamiento! Excelente trabajo.'
      };
    }

    // Todos saltados
    if (skipped === totalExercises) {
      return {
        title: 'Entrenamiento saltado',
        message: 'Has saltado todos los ejercicios. ¡La próxima vez puedes hacerlo mejor!'
      };
    }

    // Todos cancelados
    if (cancelled === totalExercises) {
      return {
        title: 'Entrenamiento cancelado',
        message: 'Has cancelado todos los ejercicios. No te preocupes, siempre puedes volver a intentarlo.'
      };
    }

    // Ningún ejercicio iniciado
    if (remaining === totalExercises) {
      return {
        title: 'Sin entrenar',
        message: 'No has iniciado ningún ejercicio. ¡Anímate a comenzar tu rutina!'
      };
    }

    // Estados mixtos
    if (completed > 0) {
      const parts = [`Has completado ${completed} ejercicio${completed > 1 ? 's' : ''}`];
      if (skipped > 0) parts.push(`saltado ${skipped}`);
      if (cancelled > 0) parts.push(`cancelado ${cancelled}`);
      if (remaining > 0) parts.push(`${remaining} pendiente${remaining > 1 ? 's' : ''}`);

      return {
        title: 'Entrenamiento parcial',
        message: `${parts.join(', ')}. Aún tienes ejercicios por hacer.`
      };
    }

    // Sin ejercicios completados
    return {
      title: 'Entrenamiento incompleto',
      message: 'No has completado ningún ejercicio. Aún tienes ejercicios por hacer.'
    };
  }, [exerciseStates, exercises.length]);

  // Completar ejercicio actual
  const completeCurrentExercise = useCallback((seriesCompleted, timeSpent, onFinishExercise) => {
    // Llamar callback del parent
    onFinishExercise?.(currentIndex, seriesCompleted, timeSpent);

    // Actualizar estado local
    setExerciseStates(prev => ({ ...prev, [currentIndex]: 'completed' }));

    // Buscar siguiente ejercicio no completado
    const nextIncompleteIndex = findNextIncompleteExercise();

    if (nextIncompleteIndex < total) {
      setCurrentIndex(nextIncompleteIndex);
      return { hasNext: true, nextIndex: nextIncompleteIndex };
    } else {
      return { hasNext: false, isComplete: true };
    }
  }, [currentIndex, findNextIncompleteExercise, total]);

  // Saltar ejercicio actual
  const skipCurrentExercise = useCallback((onSkipExercise) => {
    // Llamar callback del parent
    onSkipExercise?.(currentIndex);

    // Actualizar estado local
    setExerciseStates(prev => ({ ...prev, [currentIndex]: 'skipped' }));

    // Buscar siguiente ejercicio no completado
    const nextIncompleteIndex = findNextIncompleteExercise();

    if (nextIncompleteIndex < total) {
      setCurrentIndex(nextIncompleteIndex);
      return { hasNext: true, nextIndex: nextIncompleteIndex };
    } else {
      return { hasNext: false, isComplete: true };
    }
  }, [currentIndex, findNextIncompleteExercise, total]);

  // Cancelar ejercicio actual
  const cancelCurrentExercise = useCallback((onCancelExercise) => {
    // Llamar callback del parent
    onCancelExercise?.(currentIndex);

    // Actualizar estado local
    setExerciseStates(prev => ({ ...prev, [currentIndex]: 'cancelled' }));

    // Buscar siguiente ejercicio no completado
    const nextIncompleteIndex = findNextIncompleteExercise();

    if (nextIncompleteIndex < total) {
      setCurrentIndex(nextIncompleteIndex);
      return { hasNext: true, nextIndex: nextIncompleteIndex };
    } else {
      return { hasNext: false, isComplete: true };
    }
  }, [currentIndex, findNextIncompleteExercise, total]);

  // Navegar manualmente a ejercicio específico
  const navigateToExercise = useCallback((index) => {
    if (index >= 0 && index < exercises.length) {
      setCurrentIndex(index);
      return true;
    }
    return false;
  }, [exercises.length]);

  // Marcar ejercicio con estado específico (para salida por X)
  const markExerciseAs = useCallback((index, state) => {
    setExerciseStates(prev => ({ ...prev, [index]: state }));
  }, []);

  // Estado computed
  const progressState = {
    currentIndex,
    currentExercise,
    exerciseStates,
    total,
    seriesTotal,

    // Progress counters
    completed: Object.values(exerciseStates).filter(state => state === 'completed').length,
    skipped: Object.values(exerciseStates).filter(state => state === 'skipped').length,
    cancelled: Object.values(exerciseStates).filter(state => state === 'cancelled').length,
    remaining: total - Object.keys(exerciseStates).length,

    // Status helpers
    isFirstExercise: currentIndex === 0,
    isLastExercise: currentIndex >= total - 1,
    hasNextIncomplete: findNextIncompleteExercise() < total,
    currentExerciseState: exerciseStates[currentIndex] || null,

    // Display helpers
    exerciseNumber: currentIndex + 1,
    progressText: `Ejercicio ${currentIndex + 1} de ${total}`,

    // Summary data for end modal
    endMessage: generateEndMessage()
  };

  // Acciones disponibles
  const progressActions = {
    complete: completeCurrentExercise,
    skip: skipCurrentExercise,
    cancel: cancelCurrentExercise,
    navigateTo: navigateToExercise,
    markAs: markExerciseAs,

    // Control interno
    _setCurrentIndex: setCurrentIndex,
    _setExerciseStates: setExerciseStates
  };

  return {
    ...progressState,
    actions: progressActions
  };
};

export default useExerciseProgress;