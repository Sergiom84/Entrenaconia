/**
 * Generador de sesiones Half Body para la fase de adaptación
 * Implementa la lógica de división A/B y selección de ejercicios
 */

import { selectExercises } from '../exerciseSelector.js';

/**
 * Genera las sesiones para el bloque Half Body
 * @param {object} dbClient - Cliente de BD
 * @param {number} durationWeeks - Duración en semanas
 * @returns {Promise<Array>} Array de sesiones generadas
 */
export async function generateHalfBodySessions(dbClient, durationWeeks) {
    const sessions = [];
    const nivel = 'Principiante';

    // Configuración base según documento
    const config = {
        intensity: '75-80%',
        rir: '2-3',
        rest: '45-75s',
        sets: 3,
        reps: '10-12'
    };

    // Selección de ejercicios A (Empuje + Extensión)
    // Pecho, Hombros, Tríceps, Cuádriceps
    const exercisesA = [
        ...(await selectExercises(dbClient, { nivel, categoria: 'Pecho', tipo_ejercicio: 'multiarticular', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Hombro', tipo_ejercicio: 'multiarticular', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Piernas', tipo_ejercicio: 'multiarticular', cantidad: 1 })), // Sentadilla
        ...(await selectExercises(dbClient, { nivel, categoria: 'Tríceps', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Pecho', tipo_ejercicio: 'unilateral', cantidad: 1 })), // Complemento
        ...(await selectExercises(dbClient, { nivel, categoria: 'Piernas', tipo_ejercicio: 'analitico', cantidad: 1 })) // Extensión
    ];

    // Selección de ejercicios B (Tirón + Flexión)
    // Espalda, Bíceps, Femoral, Glúteo/Core
    const exercisesB = [
        ...(await selectExercises(dbClient, { nivel, categoria: 'Espalda', tipo_ejercicio: 'multiarticular', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Piernas', cantidad: 1 })), // Femoral/Peso muerto
        ...(await selectExercises(dbClient, { nivel, categoria: 'Bíceps', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Glúteos', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Espalda', tipo_ejercicio: 'unilateral', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Abdominales', cantidad: 1 }))
    ];

    // Generar sesiones
    // Frecuencia: 5 días/semana (Lunes a Viernes)
    // Rotación A/B/A/B/A...

    const daysPerWeek = 5;
    let totalSessionCounter = 0;

    for (let week = 1; week <= durationWeeks; week++) {
        for (let day = 1; day <= daysPerWeek; day++) {
            totalSessionCounter++;
            const sessionNumber = totalSessionCounter;

            // Rotación A/B
            // Sesión 1 (Lun): A
            // Sesión 2 (Mar): B
            // Sesión 3 (Mie): A
            // Sesión 4 (Jue): B
            // Sesión 5 (Vie): A
            // Semana siguiente sigue la rotación? El doc dice "A/B/A/B/A" para la semana.
            // Asumiremos que reinicia o sigue patrón. "Half Body A = Empuje + Extensión".
            // Si es 5 días, suele ser A B A B A.

            const isSessionA = sessionNumber % 2 !== 0; // Impar = A, Par = B
            const sessionType = isSessionA ? 'A' : 'B';
            const sessionExercises = isSessionA ? exercisesA : exercisesB;

            // Días de la semana: Lunes (1) a Viernes (5)
            const dayOfWeek = day;
            const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
            const dayName = dayNames[day - 1];

            sessions.push({
                week,
                dayOfWeek,
                dayName,
                sessionNumber,
                name: `Half Body ${sessionType} - Sesión ${sessionNumber}`,
                description: isSessionA ? 'Enfoque: Empuje + Extensión' : 'Enfoque: Tirón + Flexión',
                exercises: sessionExercises.map((ex, idx) => ({
                    ...ex,
                    orden: idx + 1,
                    series: config.sets,
                    reps: config.reps,
                    rir_target: config.rir,
                    descanso_seg: 75, // Promedio 45-75s
                    notas: `Adaptación: ${config.intensity} intensidad. Control técnico.`
                }))
            });
        }
    }

    return sessions;
}
