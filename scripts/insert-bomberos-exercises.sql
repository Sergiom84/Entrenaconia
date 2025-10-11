-- ===========================================================================
-- INSERCIÓN DE EJERCICIOS PARA OPOSICIONES DE BOMBEROS
-- ===========================================================================
-- Descripción: Ejercicios oficiales y preparatorios para oposiciones de Bombero
-- Basado en: Investigación de pruebas oficiales España 2025
-- Autor: Claude Code
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- PRUEBAS OFICIALES DE NATACIÓN
INSERT INTO app."Ejercicios_Bomberos" (nombre, nivel, categoria, tipo_prueba, baremo_hombres, baremo_mujeres, series_reps_objetivo, intensidad, descanso_seg, equipamiento, notas) VALUES
('Natación 50m libre - Oficial', 'Intermedio', 'Natación', 'Oficial', '< 55 seg', '< 65 seg', '1 intento', 'Máxima', 600, 'Piscina 25m', 'Prueba oficial. Salida desde fuera del agua. No tocar corcheras excepto viraje.'),
('Natación 100m libre - Oficial', 'Avanzado', 'Natación', 'Oficial', '< 2:00 min', '< 2:20 min', '1 intento', 'Máxima', 600, 'Piscina 50m', 'Prueba oficial convocatorias específicas. Técnica crol eficiente.'),
('Buceo/Apnea 25m - Oficial', 'Intermedio', 'Natación', 'Oficial', '< 35 seg', '< 45 seg', '1 intento', 'Máxima', 900, 'Piscina 25m', 'Nadar bajo agua sin respirar. Tocar pared final. Tiempo mínimo exigido.'),
-- PREPARATORIAS NATACIÓN
('Técnica de crol - 400m', 'Novato', 'Natación', 'Preparatoria', 'Completar', 'Completar', '4-6 series de 100m', 'Moderada', 60, 'Piscina', 'Enfocarse en brazada eficiente y respiración bilateral.'),
('Series 50m sprint', 'Intermedio', 'Natación', 'Preparatoria', '8-10 series', '8-10 series', '8-10 x 50m', 'Alta', 45, 'Piscina', 'Simular intensidad del examen. Salidas desde fuera del agua.'),
('Apnea estática', 'Novato', 'Natación', 'Técnica', '60-90 seg', '60-90 seg', '3-5 series', 'Baja', 120, 'Piscina/Agua', 'Aumentar capacidad pulmonar. Progresión gradual.'),
('Buceo dinámico 50m', 'Avanzado', 'Natación', 'Preparatoria', '2-4 series', '2-4 series', '2-4 x 50m', 'Alta', 180, 'Piscina', 'Entrenamiento para prueba de buceo. Técnica de patada eficiente.'),

-- PRUEBAS OFICIALES DE TREPA
('Trepa de cuerda 6m - Oficial (H)', 'Avanzado', 'Fuerza', 'Oficial', '< 10 seg', 'N/A', '1 intento', 'Máxima', 900, 'Cuerda 6-7m', 'Solo brazos, sin ayuda de piernas. Técnica española. Tiempo límite estricto.'),
('Trepa de cuerda 5.5m - Oficial (M)', 'Avanzado', 'Fuerza', 'Oficial', 'N/A', '< 15 seg', '1 intento', 'Máxima', 900, 'Cuerda 5.5m', 'Solo brazos, sin ayuda de piernas. Técnica española. Tiempo límite estricto.'),
-- PREPARATORIAS TREPA
('Dominadas agarre prono', 'Intermedio', 'Fuerza', 'Preparatoria', '5-10 reps', '3-8 reps', '3-5 series', 'Alta', 180, 'Barra fija', 'Desarrollo de fuerza para trepa. Rango completo de movimiento.'),
('Trepa con piernas', 'Novato', 'Fuerza', 'Técnica', 'Completar 6m', 'Completar 6m', '3-5 ascensos', 'Moderada', 120, 'Cuerda', 'Aprender técnica antes de intentar solo brazos.'),
('Trepa sin piernas parcial (3m)', 'Intermedio', 'Fuerza', 'Preparatoria', '3-5 ascensos', '3-5 ascensos', '3-5 series', 'Alta', 150, 'Cuerda', 'Progresión hacia trepa completa. Aumentar distancia gradualmente.'),
('Isométrico en cuerda', 'Intermedio', 'Fuerza', 'Preparatoria', '20-40 seg', '15-30 seg', '3-4 series', 'Alta', 120, 'Cuerda', 'Mantener posición en cuerda. Desarrolla resistencia de agarre.'),

-- PRUEBAS OFICIALES DE DOMINADAS
('Dominadas máximas 30 seg - Oficial', 'Avanzado', 'Fuerza', 'Oficial', '> 10 reps', '> 7 reps', 'Máx en 30 seg', 'Máxima', 900, 'Barra fija', 'Barbilla por encima de barra. Rango completo. No balanceo.'),
-- PREPARATORIAS DOMINADAS
('Dominadas asistidas banda', 'Novato', 'Fuerza', 'Preparatoria', '8-12 reps', '8-12 reps', '3-4 series', 'Moderada', 90, 'Barra + banda elástica', 'Progresión para principiantes. Reducir asistencia gradualmente.'),
('Negativas de dominada', 'Novato', 'Fuerza', 'Técnica', '5-8 reps lentas', '5-8 reps lentas', '3-5 series', 'Moderada', 120, 'Barra fija', 'Fase excéntrica controlada 5 segundos. Desarrolla fuerza.'),
('Dominadas explosivas', 'Avanzado', 'Fuerza', 'Preparatoria', '5-8 reps', '5-8 reps', '4-6 series', 'Muy alta', 180, 'Barra fija', 'Subida explosiva. Simula ritmo rápido del examen.'),
('Series máximas de dominadas', 'Avanzado', 'Fuerza', 'Preparatoria', '3-5 series al fallo', '3-5 series al fallo', '3-5 series', 'Máxima', 240, 'Barra fija', 'Desarrollar resistencia muscular. Descansos amplios.'),

-- PRUEBAS OFICIALES DE CARRERA VELOCIDAD
('Carrera 100m - Oficial', 'Intermedio', 'Carrera', 'Oficial', '< 14 seg', '< 16 seg', '1 intento', 'Máxima', 600, 'Pista atletismo', 'Salida de pie. Sprint máximo. Técnica de carrera eficiente.'),
('Carrera 200m - Oficial', 'Avanzado', 'Carrera', 'Oficial', '< 28 seg', '< 32 seg', '1 intento', 'Máxima', 600, 'Pista atletismo', 'Gestión de velocidad. Técnica en curva.'),
-- PREPARATORIAS VELOCIDAD
('Sprints 60m', 'Intermedio', 'Carrera', 'Preparatoria', '6-8 series', '6-8 series', '6-8 x 60m', 'Alta', 120, 'Pista', 'Desarrollo de velocidad máxima. Técnica de aceleración.'),
('Técnica de salida', 'Novato', 'Carrera', 'Técnica', '10-15 salidas', '10-15 salidas', '10-15 reps', 'Moderada', 60, 'Pista', 'Perfeccionar salida de pie. Primeros 20m críticos.'),
('Series HIIT 400m', 'Avanzado', 'Carrera', 'Preparatoria', '4-6 series', '4-6 series', '4-6 x 400m', 'Muy alta', 180, 'Pista', 'Resistencia a velocidad. Mantener ritmo constante.'),

-- PRUEBAS OFICIALES DE RESISTENCIA
('Carrera 2800m - Oficial', 'Avanzado', 'Resistencia', 'Oficial', '< 12:00 min', '< 14:00 min', '1 intento', 'Alta', 0, 'Pista atletismo', 'Prueba oficial resistencia. Gestión de ritmo. Respiración controlada.'),
('Carrera 3000m - Oficial', 'Avanzado', 'Resistencia', 'Oficial', '< 12:30 min', '< 15:00 min', '1 intento', 'Alta', 0, 'Pista/Circuito', 'Variante convocatorias específicas. Ritmo sostenido.'),
-- PREPARATORIAS RESISTENCIA
('Carrera continua 5km', 'Intermedio', 'Resistencia', 'Preparatoria', 'Completar', 'Completar', '2-3 veces/semana', 'Moderada', 0, 'Cualquier terreno', 'Base aeróbica. Ritmo conversacional.'),
('Intervalos 1000m', 'Avanzado', 'Resistencia', 'Preparatoria', '5-6 series', '5-6 series', '5-6 x 1000m', 'Alta', 120, 'Pista', 'Entrenamiento específico ritmo examen. 90% esfuerzo.'),
('Fartlek 30 minutos', 'Intermedio', 'Resistencia', 'Preparatoria', '30 min variado', '30 min variado', '1-2 sesiones/semana', 'Moderada-Alta', 0, 'Parque/Calle', 'Cambios de ritmo. Mejora capacidad aeróbica-anaeróbica.'),

-- PRUEBAS OFICIALES DE PRESS BANCA
('Press Banca 40kg - Oficial (H)', 'Intermedio', 'Fuerza', 'Oficial', 'Máx en 30 seg', 'N/A', 'Máx reps 30 seg', 'Máxima', 0, 'Barra + discos', 'Prueba oficial hombres. Rango completo. Pecho a barra. Sin rebote.'),
('Press Banca 30kg - Oficial (M)', 'Intermedio', 'Fuerza', 'Oficial', 'N/A', 'Máx en 30 seg', 'Máx reps 30 seg', 'Máxima', 0, 'Barra + discos', 'Prueba oficial mujeres. Rango completo. Pecho a barra. Sin rebote.'),
-- PREPARATORIAS PRESS BANCA
('Press banca fuerza', 'Intermedio', 'Fuerza', 'Preparatoria', '5-8 reps', '5-8 reps', '4-5 series', 'Alta', 180, 'Banco + barra', 'Desarrollar fuerza máxima. Progresión de peso gradual.'),
('Press banca resistencia', 'Intermedio', 'Fuerza', 'Preparatoria', '15-20 reps', '15-20 reps', '3-4 series', 'Moderada', 120, 'Banco + barra', 'Peso del examen. Entrenamiento de resistencia muscular.'),

-- PRUEBAS OFICIALES DE FLEXIONES
('Flexiones máximas - Oficial', 'Intermedio', 'Fuerza', 'Oficial', '> 17 reps', '> 17 reps', 'Mínimo 17', 'Alta', 0, 'Suelo', 'Pecho a 6cm del suelo. Extensión completa. Cuerpo alineado.'),
-- PREPARATORIAS FLEXIONES
('Flexiones estándar', 'Novato', 'Fuerza', 'Preparatoria', '10-15 reps', '10-15 reps', '3-5 series', 'Moderada', 90, 'Suelo', 'Técnica perfecta. Cuerpo recto. Codos 45 grados.'),
('Flexiones explosivas', 'Avanzado', 'Fuerza', 'Preparatoria', '8-12 reps', '8-12 reps', '4-5 series', 'Alta', 120, 'Suelo', 'Fase concéntrica explosiva. Desarrolla potencia.'),
('Series máximas flexiones', 'Intermedio', 'Fuerza', 'Preparatoria', '3-4 series al fallo', '3-4 series al fallo', '3-4 series', 'Alta', 180, 'Suelo', 'Entrenamiento de resistencia. Superar mínimo examen.'),

-- PRUEBAS OFICIALES LANZAMIENTO BALÓN
('Lanzamiento balón medicinal 5kg (H) - Oficial', 'Intermedio', 'Fuerza', 'Oficial', '> 7m', 'N/A', '2 intentos', 'Máxima', 300, 'Balón 5kg', 'Lanzamiento desde detrás de cabeza. Pies fijos. Técnica correcta.'),
('Lanzamiento balón medicinal 3kg (M) - Oficial', 'Intermedio', 'Fuerza', 'Oficial', 'N/A', '> 7m', '2 intentos', 'Máxima', 300, 'Balón 3kg', 'Lanzamiento desde detrás de cabeza. Pies fijos. Técnica correcta.'),
-- PREPARATORIAS LANZAMIENTO
('Técnica de lanzamiento', 'Novato', 'Fuerza', 'Técnica', '10-15 lanzamientos', '10-15 lanzamientos', '3-4 series', 'Moderada', 120, 'Balón medicinal', 'Aprender secuencia de movimiento. Transferencia de peso.'),
('Lanzamientos potencia', 'Intermedio', 'Fuerza', 'Preparatoria', '5-8 lanzamientos', '5-8 lanzamientos', '4-5 series', 'Alta', 180, 'Balón medicinal', 'Máxima distancia. Peso oficial. Técnica competitiva.'),

-- EJERCICIOS COMPLEMENTARIOS
('Plancha abdominal', 'Novato', 'Agilidad', 'Preparatoria', '60-120 seg', '45-90 seg', '3-4 series', 'Moderada', 90, 'Suelo', 'Core fuerte esencial para todas pruebas. Cuerpo alineado.'),
('Burpees', 'Intermedio', 'Agilidad', 'Preparatoria', '15-20 reps', '12-18 reps', '3-4 series', 'Alta', 90, 'Suelo', 'Acondicionamiento general. Simula exigencia del examen.'),
('Sentadillas peso corporal', 'Novato', 'Fuerza', 'Preparatoria', '20-30 reps', '20-30 reps', '3-4 series', 'Moderada', 90, 'Suelo', 'Fuerza de piernas fundamental para carrera y pruebas físicas.');

-- ===========================================================================
-- VERIFICACIÓN DE INSERCIÓN
-- ===========================================================================

SELECT 'Ejercicios de Bomberos insertados exitosamente' AS status;
SELECT COUNT(*) as total_ejercicios, categoria, tipo_prueba
FROM app."Ejercicios_Bomberos"
GROUP BY categoria, tipo_prueba
ORDER BY categoria, tipo_prueba;
