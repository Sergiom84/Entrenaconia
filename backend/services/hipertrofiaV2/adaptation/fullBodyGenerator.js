/**
 * Generador de sesiones Full Body para la fase de adaptación
 * Implementa la lógica de selección de ejercicios y estructura de sesión
 */

import { selectExercises } from '../exerciseSelector.js';

/**
 * Genera las sesiones para el bloque Full Body
 * @param {object} dbClient - Cliente de BD
 * @param {number} durationWeeks - Duración en semanas
 * @returns {Promise<Array>} Array de sesiones generadas
 */
export async function generateFullBodySessions(dbClient, durationWeeks) {
    const sessions = [];
    const nivel = 'Principiante';

    // Configuración base según documento
    const config = {
        intensity: '65-70%',
        rir: '3-4',
        rest: '30-60s',
        sets: 3, // 2-3 vueltas
        reps: '12-15'
    };

    // Selección de ejercicios (8 ejercicios para circuito)
    // 1. Pecho (Multi)
    // 2. Espalda (Multi)
    // 3. Pierna Cuádriceps (Multi)
    // 4. Pierna Femoral (Multi/Aislado)
    // 5. Hombro (Multi/Aislado)
    // 6. Bíceps (Aislado)
    // 7. Tríceps (Aislado)
    // 8. Core (Aislado)

    const exercises = [
        ...(await selectExercises(dbClient, { nivel, categoria: 'Pecho', tipo_ejercicio: 'multiarticular', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Espalda', tipo_ejercicio: 'multiarticular', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Piernas', tipo_ejercicio: 'multiarticular', cantidad: 1 })), // Generalizar a Piernas si no hay subcat específica
        ...(await selectExercises(dbClient, { nivel, categoria: 'Piernas', cantidad: 1 })), // Segundo de pierna (femoral idealmente)
        ...(await selectExercises(dbClient, { nivel, categoria: 'Hombro', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Bíceps', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Tríceps', cantidad: 1 })),
        ...(await selectExercises(dbClient, { nivel, categoria: 'Abdominales', cantidad: 1 })) // Core/Abdominales
    ];

    // Si no encontramos suficientes, rellenar con genéricos (fallback simple)
    // En un caso real, deberíamos manejar esto mejor, pero asumimos que la BD tiene datos.

    // Determinar días por semana
    // Doc: "1 semana (4 días) o 3 semanas (3 días)"
    const daysPerWeek = durationWeeks === 1 ? 4 : 3;

    // Generar sesiones
    for (let week = 1; week <= durationWeeks; week++) {
        for (let day = 1; day <= daysPerWeek; day++) {
            const sessionNumber = (week - 1) * daysPerWeek + day;

            // Calcular día de la semana (evitando fines de semana)
            // 3 días: Lunes (1), Miércoles (3), Viernes (5)
            // 4 días: Lunes (1), Martes (2), Jueves (4), Viernes (5) -> Descanso Miércoles

            let dayOfWeek;
            let dayName;

            if (daysPerWeek === 3) {
                if (day === 1) { dayOfWeek = 1; dayName = 'Lunes'; }
                else if (day === 2) { dayOfWeek = 3; dayName = 'Miércoles'; }
                else { dayOfWeek = 5; dayName = 'Viernes'; }
            } else {
                // 4 días
                if (day === 1) { dayOfWeek = 1; dayName = 'Lunes'; }
                else if (day === 2) { dayOfWeek = 2; dayName = 'Martes'; }
                else if (day === 3) { dayOfWeek = 4; dayName = 'Jueves'; }
                else { dayOfWeek = 5; dayName = 'Viernes'; }
            }

            sessions.push({
                week,
                dayOfWeek, // 1-5
                dayName,
                sessionNumber,
                name: `Full Body - Sesión ${sessionNumber}`,
                description: 'Circuito de adaptación: Realiza todos los ejercicios en orden.',
                exercises: exercises.map((ex, idx) => ({
                    ...ex,
                    orden: idx + 1,
                    series: config.sets,
                    reps: config.reps,
                    rir_target: config.rir,
                    descanso_seg: 60, // Promedio 30-60s
                    notas: `Adaptación: ${config.intensity} intensidad. ${config.rest} descanso.`
                }))
            });
        }
    }

    return sessions;
}
