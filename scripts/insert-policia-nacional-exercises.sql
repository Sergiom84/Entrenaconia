-- ===========================================================================
-- INSERCIÓN DE EJERCICIOS PARA OPOSICIONES DE POLICÍA NACIONAL
-- ===========================================================================
-- Descripción: Ejercicios oficiales y preparatorios para oposiciones de Policía Nacional
-- Basado en: Convocatorias oficiales y BOE 2025
-- Autor: Claude Code
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- PRUEBAS OFICIALES CIRCUITO DE AGILIDAD
INSERT INTO app."Ejercicios_Policia_Nacional" (nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres, series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas) VALUES
('Circuito de Agilidad - Oficial', 'Avanzado', 'Circuito Agilidad', 'Oficial', 'Puntuación 0-10', 'Puntuación 0-10', '2 intentos (1 si nulo)', 'Máxima', 600, 'Obstáculos, vallas, banderines', 'Prueba eliminatoria. Derribar obstáculo = intento nulo. Tiempo mínimo para aprobar. Calificación 0-10 según tiempo.'),
-- PREPARATORIAS CIRCUITO
('Slalom con cambios de dirección', 'Intermedio', 'Circuito Agilidad', 'Preparatoria', '8-12 series', '8-12 series', '8-12 x circuito', 'Alta', 90, 'Conos', 'Simulación parcial. Velocidad + coordinación. Pies rápidos.'),
('Saltos de vallas técnica', 'Intermedio', 'Circuito Agilidad', 'Técnica', '6-8 series de 5-6 vallas', '6-8 series de 5-6 vallas', '6-8 series', 'Alta', 120, 'Vallas 60cm', 'Técnica de salto eficiente. Mínima pérdida de velocidad.'),
('Circuito completo simulado', 'Avanzado', 'Circuito Agilidad', 'Preparatoria', '5-8 intentos', '5-8 intentos', '5-8 x completo', 'Máxima', 180, 'Setup completo oficial', 'Réplica exacta del examen. Cronometrar. Objetivo: nota alta (>7).'),
('Escalera de coordinación', 'Novato', 'Circuito Agilidad', 'Técnica', '6-10 series', '6-10 series', '6-10 x 10m', 'Moderada', 60, 'Escalera agilidad', 'Patrones variados. Coordinación pies. Base para circuito.'),
('Sprints con obstáculos', 'Intermedio', 'Circuito Agilidad', 'Preparatoria', '6-8 series de 20m', '6-8 series de 20m', '6-8 series', 'Alta', 90, 'Conos + vallas', 'Velocidad máxima sorteando obstáculos. Aceleración post-obstáculo.'),

-- PRUEBAS OFICIALES DE FUERZA
('Dominadas agarre prono - Oficial (H)', 'Avanzado', 'Fuerza', 'Oficial', 'Puntuación 0-10 según reps', 'N/A', 'Máximas posibles', 'Máxima', 0, 'Barra fija', 'Barbilla por encima de barra. Sin balanceo. Rango completo. Calificación según nº repeticiones.'),
('Suspensión en barra - Oficial (M)', 'Intermedio', 'Fuerza', 'Oficial', 'N/A', 'Puntuación 0-10 según tiempo', 'Máximo tiempo', 'Máxima', 0, 'Barra fija', 'Agarre supino. Brazos flexionados 90°. Barbilla sobre barra. Calificación según segundos.'),
-- PREPARATORIAS FUERZA
('Dominadas progresión', 'Intermedio', 'Fuerza', 'Preparatoria', '5-10 reps', '5-10 reps', '4-6 series', 'Alta', 180, 'Barra fija', 'Hombres: aumentar repeticiones. Rango completo. Técnica correcta.'),
('Dominadas asistidas banda', 'Novato', 'Fuerza', 'Técnica', '8-12 reps', '8-12 reps', '3-5 series', 'Moderada', 120, 'Barra + banda elástica', 'Progresión principiantes. Reducir asistencia gradualmente.'),
('Suspensión isométrica', 'Intermedio', 'Fuerza', 'Preparatoria', '40-90 seg', '40-90 seg', '4-6 series', 'Alta', 180, 'Barra fija', 'Mujeres: aumentar tiempo. Brazos 90°. Barbilla sobre barra.'),
('Negativas de dominada', 'Novato', 'Fuerza', 'Técnica', '5-8 reps lentas', '5-8 reps lentas', '4-5 series', 'Moderada', 120, 'Barra fija', 'Fase excéntrica controlada 5 seg. Desarrollo fuerza.'),
('Remo invertido', 'Intermedio', 'Fuerza', 'Preparatoria', '12-15 reps', '12-15 reps', '3-4 series', 'Moderada', 90, 'Barra baja/TRX', 'Fortalecimiento espalda. Complementario a dominadas/suspensión.'),

-- PRUEBAS OFICIALES CARRERA 1000M
('Carrera 1000m - Oficial', 'Avanzado', 'Resistencia', 'Oficial', 'Puntuación 0-10 según tiempo', 'Puntuación 0-10 según tiempo', '1 intento', 'Alta', 0, 'Pista atletismo', 'Prueba eliminatoria. Calificación según tiempo. Gestión de ritmo crucial. Mínimo para aprobar + nota alta.'),
-- PREPARATORIAS CARRERA 1000M
('Intervalos 400m', 'Avanzado', 'Resistencia', 'Preparatoria', '6-8 series', '6-8 series', '6-8 x 400m', 'Alta', 90, 'Pista', 'Ritmo objetivo examen. Mejora velocidad sostenida.'),
('Tempo run 2km', 'Intermedio', 'Resistencia', 'Preparatoria', '85-90% esfuerzo', '85-90% esfuerzo', '2 veces/semana', 'Alta', 0, 'Pista/circuito', 'Ritmo controlado alto. Simula exigencia del examen.'),
('Test 1000m mensual', 'Avanzado', 'Resistencia', 'Preparatoria', 'Máximo esfuerzo', 'Máximo esfuerzo', '1 vez/mes', 'Máxima', 0, 'Pista', 'Evaluación progreso. Condiciones oficiales. Objetivo: nota >7.'),
('Carrera continua 5km', 'Intermedio', 'Resistencia', 'Preparatoria', 'Completar', 'Completar', '2-3 veces/semana', 'Moderada', 0, 'Cualquier terreno', 'Base aeróbica fundamental. Ritmo cómodo.'),
('Fartlek 20-30 min', 'Intermedio', 'Resistencia', 'Preparatoria', '20-30 min variado', '20-30 min variado', '1-2 veces/semana', 'Moderada-Alta', 0, 'Parque/calle', 'Cambios de ritmo. Mejora capacidad mixta aeróbica-anaeróbica.'),

-- EJERCICIOS COMPLEMENTARIOS
('Flexiones estándar', 'Novato', 'Fuerza', 'Preparatoria', '15-20 reps', '12-18 reps', '3-5 series', 'Moderada', 90, 'Suelo', 'Fuerza de empuje. Complementa dominadas. Técnica correcta.'),
('Plancha abdominal', 'Novato', 'Fuerza', 'Preparatoria', '60-120 seg', '45-90 seg', '3-4 series', 'Moderada', 90, 'Suelo', 'Core fuerte esencial. Estabilidad para todas pruebas.'),
('Burpees', 'Intermedio', 'Circuito Agilidad', 'Preparatoria', '15-20 reps', '12-18 reps', '4-5 series', 'Alta', 90, 'Suelo', 'Acondicionamiento general. Alta intensidad. Simula exigencia examen.'),
('Sentadillas peso corporal', 'Novato', 'Fuerza', 'Preparatoria', '25-35 reps', '20-30 reps', '3-4 series', 'Moderada', 90, 'Suelo', 'Fuerza piernas. Base para circuito y carrera.'),
('Mountain climbers', 'Intermedio', 'Circuito Agilidad', 'Preparatoria', '30-45 seg', '25-40 seg', '4-5 series', 'Alta', 60, 'Suelo', 'Coordinación + cardio. Agilidad de piernas.'),
('Saltos al cajón', 'Intermedio', 'Circuito Agilidad', 'Preparatoria', '10-15 reps', '8-12 reps', '4-5 series', 'Alta', 120, 'Cajón 40-60cm', 'Potencia piernas. Transferencia a saltos de vallas.'),

-- ESTRATEGIA GENERAL DE PREPARACIÓN
('Certificado médico preparación', 'Avanzado', 'Resistencia', 'Preparatoria', 'Obligatorio día pruebas', 'Obligatorio día pruebas', '1 certificado', 'N/A', 0, 'Médico oficial', 'IMPORTANTE: Certificado médico oficial obligatorio el día de las pruebas físicas. Debe acreditar aptitud física para realizar los ejercicios.');

-- ===========================================================================
-- VERIFICACIÓN DE INSERCIÓN
-- ===========================================================================

SELECT 'Ejercicios de Policía Nacional insertados exitosamente' AS status;
SELECT COUNT(*) as total_ejercicios, categoria, tipo_prueba
FROM app."Ejercicios_Policia_Nacional"
GROUP BY categoria, tipo_prueba
ORDER BY categoria, tipo_prueba;
