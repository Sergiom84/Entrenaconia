-- ===========================================================================
-- INSERCIÓN DE EJERCICIOS PARA OPOSICIONES DE POLICÍA LOCAL
-- ===========================================================================
-- Descripción: Ejercicios oficiales y preparatorios para oposiciones de Policía Local
-- Basado en: Convocatorias municipales y autonómicas 2025
-- Autor: Claude Code
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- NOTA: Las pruebas varían por ayuntamiento. Ejercicios basados en pruebas más comunes.

-- PRUEBAS OFICIALES CARRERA DE VELOCIDAD 50M
INSERT INTO app."Ejercicios_Policia_Local" (nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres, series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas) VALUES
('Carrera 50m velocidad - Oficial', 'Intermedio', 'Velocidad', 'Oficial', 'Variable por convocatoria', 'Variable por convocatoria', '1-2 intentos', 'Máxima', 300, 'Pista atletismo', 'Salida de pie. Sin tacos. Sprint máximo. Tiempo varía por ayuntamiento (típicamente <8-9 seg hombres, <9-10 seg mujeres).'),
-- PREPARATORIAS VELOCIDAD
('Sprints 60m', 'Intermedio', 'Velocidad', 'Preparatoria', '6-8 series', '6-8 series', '6-8 x 60m', 'Alta', 120, 'Pista', 'Desarrollo velocidad máxima. Aceleración explosiva.'),
('Técnica de salida', 'Novato', 'Velocidad', 'Técnica', '10-15 salidas', '10-15 salidas', '10-15 reps', 'Moderada', 60, 'Pista', 'Perfeccionar salida de pie. Primeros 10m críticos.'),
('Sprints 30m máximos', 'Intermedio', 'Velocidad', 'Preparatoria', '8-10 series', '8-10 series', '8-10 x 30m', 'Máxima', 90, 'Pista', 'Velocidad pura. Aceleración máxima.'),
('Carreras progresivas 80m', 'Novato', 'Velocidad', 'Técnica', '5-6 series', '5-6 series', '5-6 x 80m', 'Moderada', 120, 'Pista', 'Aceleración gradual. Técnica de carrera a alta velocidad.'),

-- PRUEBAS OFICIALES CARRERA DE RESISTENCIA 1000M
('Carrera 1000m - Oficial', 'Avanzado', 'Resistencia', 'Oficial', '3:30-4:00 típico', '4:00-4:30 típico', '1 intento', 'Alta', 0, 'Pista atletismo', 'Tiempo varía por convocatoria. Gestión de ritmo. Velocidad sostenida. Consultar bases específicas.'),
-- PREPARATORIAS RESISTENCIA 1000M
('Intervalos 400m', 'Avanzado', 'Resistencia', 'Preparatoria', '5-8 series', '5-8 series', '5-8 x 400m', 'Alta', 90, 'Pista', 'Ritmo objetivo examen. Mejora velocidad sostenida.'),
('Tempo run 2km', 'Intermedio', 'Resistencia', 'Preparatoria', '85% esfuerzo', '85% esfuerzo', '2 veces/semana', 'Alta', 0, 'Pista', 'Ritmo controlado alto. Simula exigencia del examen.'),
('Test 1000m mensual', 'Avanzado', 'Resistencia', 'Preparatoria', 'Máximo esfuerzo', 'Máximo esfuerzo', '1 vez/mes', 'Máxima', 0, 'Pista', 'Evaluación progreso. Condiciones oficiales.'),
('Fartlek 25 minutos', 'Intermedio', 'Resistencia', 'Preparatoria', '25 min variado', '25 min variado', '1-2 veces/semana', 'Moderada-Alta', 0, 'Parque', 'Cambios de ritmo. Mejora capacidad mixta.'),

-- PRUEBAS OFICIALES SALTO DE LONGITUD
('Salto de longitud - Oficial (H)', 'Intermedio', 'Salto', 'Oficial', 'Típico 2.00-2.10m mínimo', 'N/A', '2-3 intentos', 'Máxima', 300, 'Foso de salto', 'Carrerilla completa. Técnica de batida. Caída eficiente. Marca varía por convocatoria.'),
('Salto de longitud - Oficial (M)', 'Intermedio', 'Salto', 'Oficial', 'N/A', 'Típico 1.70-1.80m mínimo', '2-3 intentos', 'Máxima', 300, 'Foso de salto', 'Carrerilla completa. Técnica de batida. Caída eficiente. Marca varía por convocatoria.'),
-- PREPARATORIAS SALTO
('Técnica de carrerilla', 'Novato', 'Salto', 'Técnica', '8-12 carreras', '8-12 carreras', '8-12 reps', 'Moderada', 90, 'Pista + foso', 'Distancia óptima de carrera. Ritmo progresivo. Batida precisa.'),
('Saltos de longitud submáximos', 'Intermedio', 'Salto', 'Preparatoria', '6-10 saltos', '6-10 saltos', '6-10 intentos', 'Alta', 180, 'Foso', 'Técnica completa. 85-90% esfuerzo. Perfeccionar movimientos.'),
('Multisaltos horizontales', 'Intermedio', 'Salto', 'Preparatoria', '5-8 series de 5 saltos', '5-8 series de 5 saltos', '5-8 series', 'Alta', 120, 'Pista', 'Potencia horizontal. Triple, quíntuple salto. Pliometría.'),
('Sentadillas con salto', 'Intermedio', 'Salto', 'Preparatoria', '10-15 reps', '8-12 reps', '4-5 series', 'Alta', 120, 'Suelo', 'Potencia piernas. Transferencia a salto de longitud.'),

-- PRUEBAS OFICIALES SUSPENSIÓN EN BARRA
('Suspensión en barra agarre supino - Oficial (M)', 'Intermedio', 'Fuerza', 'Oficial', 'N/A', 'Típico 52-60 seg mínimo', 'Máximo tiempo', 'Máxima', 0, 'Barra fija', 'Brazos flexionados. Barbilla sobre barra. Sin balanceo. Tiempo varía por convocatoria.'),
('Dominadas - Oficial (H)', 'Intermedio', 'Fuerza', 'Oficial', 'Variable por convocatoria', 'N/A', 'Mínimo requerido', 'Máxima', 0, 'Barra fija', 'Algunas convocatorias requieren dominadas en hombres. Rango completo. Sin balanceo.'),
-- PREPARATORIAS FUERZA SUPERIOR
('Suspensión isométrica progresión', 'Intermedio', 'Fuerza', 'Preparatoria', '50-90 seg', '50-90 seg', '4-6 series', 'Alta', 180, 'Barra fija', 'Mujeres: aumentar tiempo progresivamente. Brazos 90°. Barbilla sobre barra.'),
('Dominadas asistidas', 'Novato', 'Fuerza', 'Técnica', '8-12 reps', '8-12 reps', '3-5 series', 'Moderada', 120, 'Barra + banda', 'Progresión para ambos sexos. Fortalecimiento espalda y brazos.'),
('Remo invertido', 'Intermedio', 'Fuerza', 'Preparatoria', '12-15 reps', '10-12 reps', '4-5 series', 'Moderada', 90, 'Barra baja', 'Fortalecimiento dorsal. Complementario a suspensión/dominadas.'),

-- PRUEBAS OFICIALES CIRCUITO DE AGILIDAD (algunas convocatorias)
('Circuito de agilidad - Oficial', 'Intermedio', 'Agilidad', 'Oficial', 'Variable por convocatoria', 'Variable por convocatoria', '1-2 intentos', 'Máxima', 300, 'Obstáculos, conos', 'Presente en algunas convocatorias. Tiempo límite según bases. Coordinación + velocidad.'),
-- PREPARATORIAS AGILIDAD
('Slalom con conos', 'Intermedio', 'Agilidad', 'Preparatoria', '8-10 series', '8-10 series', '8-10 x circuito', 'Alta', 90, 'Conos', 'Cambios de dirección rápidos. Agilidad lateral.'),
('Escalera de coordinación', 'Novato', 'Agilidad', 'Técnica', '6-10 series', '6-10 series', '6-10 x 10m', 'Moderada', 60, 'Escalera', 'Coordinación pies. Patrones variados. Base para agilidad.'),

-- EJERCICIOS COMPLEMENTARIOS GENERALES
('Flexiones estándar', 'Novato', 'Fuerza', 'Preparatoria', '15-25 reps', '12-20 reps', '3-5 series', 'Moderada', 90, 'Suelo', 'Fuerza general de empuje. Complementa entrenamiento.'),
('Plancha abdominal', 'Novato', 'Fuerza', 'Preparatoria', '60-120 seg', '45-90 seg', '3-4 series', 'Moderada', 90, 'Suelo', 'Core fuerte esencial para todas pruebas.'),
('Burpees', 'Intermedio', 'Agilidad', 'Preparatoria', '15-20 reps', '12-18 reps', '4-5 series', 'Alta', 90, 'Suelo', 'Acondicionamiento general. Alta intensidad.'),
('Sentadillas peso corporal', 'Novato', 'Fuerza', 'Preparatoria', '25-35 reps', '20-30 reps', '3-4 series', 'Moderada', 90, 'Suelo', 'Fuerza piernas. Base para todas pruebas.'),
('Zancadas alternas', 'Intermedio', 'Fuerza', 'Preparatoria', '20-30 reps (10-15/pierna)', '16-24 reps (8-12/pierna)', '3-4 series', 'Moderada', 90, 'Suelo', 'Fuerza unilateral piernas. Equilibrio. Potencia carrera.'),
('Saltos verticales', 'Intermedio', 'Salto', 'Preparatoria', '15-20 reps', '12-18 reps', '4-5 series', 'Alta', 120, 'Suelo', 'Potencia vertical. Pliometría. Complementa salto longitud.'),

-- IMPORTANTE: VARIABILIDAD POR AYUNTAMIENTO
('Consultar bases específicas - IMPORTANTE', 'Avanzado', 'Resistencia', 'Preparatoria', 'OBLIGATORIO', 'OBLIGATORIO', 'Antes de preparar', 'N/A', 0, 'BOE/Web oficial', 'CRÍTICO: Las pruebas físicas varían significativamente entre ayuntamientos. SIEMPRE consultar las bases específicas de la convocatoria objetivo para conocer pruebas exactas, baremos y puntuaciones.');

-- ===========================================================================
-- VERIFICACIÓN DE INSERCIÓN
-- ===========================================================================

SELECT 'Ejercicios de Policía Local insertados exitosamente' AS status;
SELECT COUNT(*) as total_ejercicios, categoria, tipo_prueba
FROM app."Ejercicios_Policia_Local"
GROUP BY categoria, tipo_prueba
ORDER BY categoria, tipo_prueba;
