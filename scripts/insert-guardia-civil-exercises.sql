-- ===========================================================================
-- INSERCIÓN DE EJERCICIOS PARA OPOSICIONES DE GUARDIA CIVIL
-- ===========================================================================
-- Descripción: Ejercicios oficiales y preparatorios para oposiciones de Guardia Civil
-- Basado en: BOE y convocatorias oficiales 2025
-- Autor: Claude Code
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- PRUEBAS OFICIALES CIRCUITO DE COORDINACIÓN
INSERT INTO app."Ejercicios_Guardia_Civil" (nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres, series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas) VALUES
('Circuito de Coordinación - Oficial', 'Avanzado', 'Circuito', 'Oficial', 'Tiempo variable por edad', 'Tiempo variable por edad', '2 intentos máximo', 'Máxima', 600, 'Obstáculos, banderines, vallas', 'Prueba eliminatoria. No derribar obstáculos. Penalización por error de recorrido. Tiempo exacto según baremo edad.'),
-- PREPARATORIAS CIRCUITO
('Slalom con banderines', 'Intermedio', 'Circuito', 'Preparatoria', '8-10 series', '8-10 series', '8-10 x circuito', 'Alta', 90, 'Conos/banderines', 'Simulación parcial. Agilidad lateral. Cambios de dirección rápidos.'),
('Saltos de vallas', 'Intermedio', 'Circuito', 'Técnica', '6-8 series de 5 vallas', '6-8 series de 5 vallas', '6-8 series', 'Alta', 120, 'Vallas 50-60cm', 'Técnica de salto eficiente. Fluidez sin pérdida de velocidad.'),
('Circuito completo simulado', 'Avanzado', 'Circuito', 'Preparatoria', '4-6 intentos', '4-6 intentos', '4-6 x completo', 'Máxima', 180, 'Setup completo', 'Réplica exacta del oficial. Cronometrar. Objetivo: batir baremo.'),
('Coordinación con escalera', 'Novato', 'Circuito', 'Técnica', '5-8 series', '5-8 series', '5-8 x 10m', 'Moderada', 60, 'Escalera agilidad', 'Desarrollo de coordinación pies. Patrones variados.'),

-- PRUEBAS OFICIALES CARRERA 2000M
('Carrera 2000m - Oficial', 'Avanzado', 'Carrera', 'Oficial', 'Tiempo variable por edad', 'Tiempo variable por edad', '1 intento', 'Alta', 0, 'Pista atletismo', 'Prueba eliminatoria. Superficie dura. Gestión de ritmo esencial. Baremo estricto por edad y sexo.'),
-- PREPARATORIAS CARRERA 2000M
('Carrera continua 5km', 'Intermedio', 'Carrera', 'Preparatoria', 'Completar', 'Completar', '2-3 veces/semana', 'Moderada', 0, 'Cualquier terreno', 'Base aeróbica fundamental. Ritmo cómodo conversacional.'),
('Intervalos 800m', 'Avanzado', 'Carrera', 'Preparatoria', '6-8 series', '6-8 series', '6-8 x 800m', 'Alta', 120, 'Pista', 'Ritmo objetivo examen. Mejora velocidad sostenida.'),
('Tempo run 3km', 'Intermedio', 'Carrera', 'Preparatoria', '85-90% esfuerzo', '85-90% esfuerzo', '1-2 veces/semana', 'Alta', 0, 'Pista/circuito', 'Ritmo controlado alto. Simula exigencia del examen.'),
('Test 2000m mensual', 'Avanzado', 'Carrera', 'Preparatoria', 'Máximo esfuerzo', 'Máximo esfuerzo', '1 vez/mes', 'Máxima', 0, 'Pista', 'Evaluación progreso. Condiciones oficiales.'),

-- PRUEBAS OFICIALES EXTENSIONES DE BRAZOS (FLEXIONES)
('Extensiones de brazos - Oficial (H)', 'Intermedio', 'Fuerza', 'Oficial', 'Mínimo 16 reps', 'N/A', 'Mínimo 16', 'Alta', 0, 'Suelo + almohadilla 6cm', 'Barbilla toca almohadilla a 6cm del suelo. Extensión completa arriba. 2 intentos.'),
('Extensiones de brazos - Oficial (M)', 'Intermedio', 'Fuerza', 'Oficial', 'N/A', 'Mínimo 11 reps', 'Mínimo 11', 'Alta', 0, 'Suelo + almohadilla 6cm', 'Barbilla toca almohadilla a 6cm del suelo. Extensión completa arriba. 2 intentos.'),
-- PREPARATORIAS EXTENSIONES
('Flexiones técnica perfecta', 'Novato', 'Fuerza', 'Técnica', '10-15 reps', '8-12 reps', '3-5 series', 'Moderada', 90, 'Suelo', 'Cuerpo alineado. Descenso controlado. Extensión completa.'),
('Flexiones con almohadilla', 'Intermedio', 'Fuerza', 'Preparatoria', '15-20 reps', '12-15 reps', '4-5 series', 'Alta', 120, 'Suelo + almohadilla', 'Simulación exacta oficial. Barbilla a almohadilla cada repetición.'),
('Series máximas flexiones', 'Avanzado', 'Fuerza', 'Preparatoria', '3-4 series al fallo', '3-4 series al fallo', '3-4 series', 'Máxima', 180, 'Suelo', 'Desarrollar resistencia. Superar ampliamente mínimo.'),
('Flexiones diamante', 'Avanzado', 'Fuerza', 'Preparatoria', '10-15 reps', '8-12 reps', '3-4 series', 'Alta', 120, 'Suelo', 'Fortalecimiento tríceps. Complementario a estándar.'),

-- PRUEBAS OFICIALES NATACIÓN 50M
('Natación 50m libre - Oficial', 'Intermedio', 'Natación', 'Oficial', 'Tiempo variable por edad', 'Tiempo variable por edad', '1 intento', 'Máxima', 0, 'Piscina 25m', 'Estilo libre. No tocar corcheras salvo viraje. Tiempo según baremo edad/sexo.'),
-- PREPARATORIAS NATACIÓN
('Técnica de crol 400m', 'Novato', 'Natación', 'Técnica', 'Completar', 'Completar', '4-6 x 100m', 'Moderada', 60, 'Piscina', 'Brazada eficiente. Respiración bilateral. Patada constante.'),
('Series 50m sprint', 'Intermedio', 'Natación', 'Preparatoria', '8-10 series', '8-10 series', '8-10 x 50m', 'Alta', 45, 'Piscina', 'Ritmo máximo sostenido. Salidas desde fuera. Virajes rápidos.'),
('Técnica de viraje', 'Intermedio', 'Natación', 'Técnica', '10-15 virajes', '10-15 virajes', '3-4 series', 'Moderada', 90, 'Piscina 25m', 'Viraje eficiente crucial en 50m. Volteo rápido.'),
('Test 50m mensual', 'Avanzado', 'Natación', 'Preparatoria', 'Máximo esfuerzo', 'Máximo esfuerzo', '1-2 intentos', 'Máxima', 300, 'Piscina', 'Evaluación progreso. Condiciones oficiales.'),

-- EJERCICIOS COMPLEMENTARIOS GENERALES
('Dominadas agarre prono', 'Intermedio', 'Fuerza', 'Preparatoria', '8-12 reps', '5-10 reps', '3-5 series', 'Alta', 180, 'Barra fija', 'Fuerza de tracción. Espalda fuerte. Apoyo para todas pruebas.'),
('Plancha abdominal', 'Novato', 'Fuerza', 'Preparatoria', '60-120 seg', '45-90 seg', '3-4 series', 'Moderada', 90, 'Suelo', 'Core estable esencial. Cuerpo alineado. Progresión gradual.'),
('Burpees', 'Intermedio', 'Circuito', 'Preparatoria', '15-20 reps', '12-18 reps', '3-5 series', 'Alta', 90, 'Suelo', 'Acondicionamiento general. Alta intensidad. Resistencia muscular.'),
('Sentadillas peso corporal', 'Novato', 'Fuerza', 'Preparatoria', '20-30 reps', '20-30 reps', '3-4 series', 'Moderada', 90, 'Suelo', 'Fuerza piernas. Base para carrera y agilidad.'),
('Mountain climbers', 'Intermedio', 'Circuito', 'Preparatoria', '30-40 seg', '25-35 seg', '4-5 series', 'Alta', 60, 'Suelo', 'Coordinación + cardio. Simula exigencia del circuito.'),

-- ENTRENAMIENTO ESPECÍFICO PARA BAREMOS POR EDAD
('Protocolo de adaptación por edad', 'Avanzado', 'Carrera', 'Preparatoria', 'Según objetivos individuales', 'Según objetivos individuales', 'Personalizado', 'Variable', 0, 'N/A', 'Ajustar entrenamiento a baremo específico de edad. Consultar BOE oficial para marcas exactas.');

-- ===========================================================================
-- VERIFICACIÓN DE INSERCIÓN
-- ===========================================================================

SELECT 'Ejercicios de Guardia Civil insertados exitosamente' AS status;
SELECT COUNT(*) as total_ejercicios, categoria, tipo_prueba
FROM app."Ejercicios_Guardia_Civil"
GROUP BY categoria, tipo_prueba
ORDER BY categoria, tipo_prueba;
