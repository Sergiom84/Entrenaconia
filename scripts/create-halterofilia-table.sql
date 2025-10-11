-- ===========================================================================
-- TABLA DE EJERCICIOS: HALTEROFILIA (OLYMPIC WEIGHTLIFTING)
-- ===========================================================================
-- Descripción: Base de datos de ejercicios de levantamiento olímpico
-- Enfoque: Snatch (Arrancada) y Clean & Jerk (Dos tiempos) + auxiliares
-- Principios: Potencia, técnica, movilidad, fuerza explosiva
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- ===========================================================================

-- Eliminar tabla si existe (solo para desarrollo)
DROP TABLE IF EXISTS app."Ejercicios_Halterofilia" CASCADE;

-- Crear tabla principal
CREATE TABLE app."Ejercicios_Halterofilia" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  nivel VARCHAR(50) NOT NULL, -- 'Principiante', 'Intermedio', 'Avanzado'
  categoria VARCHAR(100) NOT NULL, -- 'Snatch', 'Clean & Jerk', 'Técnica', 'Fuerza Base', 'Accesorios'
  patron VARCHAR(255) NOT NULL, -- 'Arrancada', 'Dos tiempos', 'Squat', 'Pull', 'Press', 'Overhead'
  equipamiento TEXT[] NOT NULL, -- ['Barra olímpica', 'Discos', 'Plataforma', etc.]
  series_reps_objetivo VARCHAR(100), -- '5 x 3', '3 x 5 @ 70%', '3 x 3 + 3 x 2', etc.
  descanso_seg INTEGER, -- Descanso recomendado en segundos
  tempo VARCHAR(50), -- 'Explosivo', 'Controlado', 'Max velocidad'
  criterio_de_progreso TEXT,
  progresion_desde VARCHAR(255), -- Ejercicio previo en progresión
  progresion_hacia VARCHAR(255), -- Siguiente ejercicio en progresión
  notas TEXT,
  gif_url TEXT, -- URL opcional del GIF demostrativo
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización de queries
CREATE INDEX idx_ejercicios_halterofilia_nivel ON app."Ejercicios_Halterofilia"(nivel);
CREATE INDEX idx_ejercicios_halterofilia_categoria ON app."Ejercicios_Halterofilia"(categoria);
CREATE INDEX idx_ejercicios_halterofilia_patron ON app."Ejercicios_Halterofilia"(patron);
CREATE INDEX idx_ejercicios_halterofilia_equipamiento ON app."Ejercicios_Halterofilia" USING GIN(equipamiento);

-- Comentarios de documentación
COMMENT ON TABLE app."Ejercicios_Halterofilia" IS 'Catálogo de ejercicios de halterofilia clasificados por nivel, categoría y patrón olímpico';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".exercise_id IS 'ID numérico único (PRIMARY KEY)';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".slug IS 'Identificador textual legible (ej: hang-power-clean)';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".nivel IS 'Nivel de dificultad: Principiante, Intermedio, Avanzado';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".categoria IS 'Categoría del ejercicio: Snatch, Clean & Jerk, Técnica, Fuerza Base, Accesorios';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".patron IS 'Patrón de movimiento olímpico primario';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".equipamiento IS 'Array de equipamiento necesario';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".descanso_seg IS 'Descanso recomendado entre series en segundos (120-300 típico)';

-- ===========================================================================
-- INSERCIÓN DE EJERCICIOS POR NIVEL
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- NIVEL PRINCIPIANTE (20 ejercicios) - Fundamentos Técnicos
-- ---------------------------------------------------------------------------

INSERT INTO app."Ejercicios_Halterofilia"
(nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, criterio_de_progreso, progresion_hacia, notas)
VALUES
-- TÉCNICA BÁSICA (6 ejercicios)
('Overhead Squat con PVC', 'overhead-squat-pvc', 'Principiante', 'Técnica', 'Squat', '{"PVC", "Sin peso"}', '3 x 10', 90, 'Controlado', 'Mantener postura perfecta 10 reps', 'Overhead Squat con barra', 'Fundamento para posición de snatch. Enfoque en movilidad y postura.'),
('Front Squat con barra vacía', 'front-squat-vacia', 'Principiante', 'Técnica', 'Squat', '{"Barra olímpica"}', '4 x 8', 120, 'Controlado 3-0-1', 'Profundidad completa sin rebote', 'Front Squat con carga', 'Fundamento para clean. Mantener codos arriba.'),
('Back Squat básico', 'back-squat-basico', 'Principiante', 'Fuerza Base', 'Squat', '{"Barra olímpica", "Rack"}', '4 x 8', 120, 'Controlado 2-0-2', 'Añadir 2.5kg cuando completas series', 'Back Squat intermedio', 'Base de fuerza para todos los lifts.'),
('Muscle Snatch con PVC', 'muscle-snatch-pvc', 'Principiante', 'Técnica', 'Arrancada', '{"PVC"}', '3 x 8', 90, 'Lento y controlado', 'Trayectoria vertical perfecta', 'Muscle Snatch con barra', 'Enseña trayectoria del snatch sin peso.'),
('Muscle Clean con PVC', 'muscle-clean-pvc', 'Principiante', 'Técnica', 'Dos tiempos', '{"PVC"}', '3 x 8', 90, 'Lento y controlado', 'Codos rápidos sin rebote', 'Muscle Clean con barra', 'Fundamento de la recepción del clean.'),
('Snatch Balance sin peso', 'snatch-balance-pvc', 'Principiante', 'Técnica', 'Overhead', '{"PVC"}', '4 x 6', 90, 'Velocidad progresiva', 'Recepción estable en posición baja', 'Snatch Balance con barra', 'Desarrolla velocidad bajo la barra en snatch.'),

-- FUERZA BASE (7 ejercicios)
('Romanian Deadlift', 'romanian-deadlift', 'Principiante', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 8', 120, 'Controlado 3-0-1', 'Mantener espalda neutra todo el rango', 'RDL con carga progresiva', 'Desarrollo de cadena posterior para pulls.'),
('Good Morning con barra', 'good-morning-barra', 'Principiante', 'Fuerza Base', 'Pull', '{"Barra olímpica"}', '3 x 10', 90, 'Controlado', 'Bisagra perfecta sin redondeo', 'Good Morning con carga', 'Fortalece bisagra de cadera esencial en lifts.'),
('Push Press con barra vacía', 'push-press-vacia', 'Principiante', 'Técnica', 'Press', '{"Barra olímpica"}', '4 x 6', 120, 'Explosivo en el drive', 'Coordinación piernas-brazos fluida', 'Push Press con carga', 'Introducción al jerk. Timing de piernas crucial.'),
('Strict Press con barra', 'strict-press-barra', 'Principiante', 'Fuerza Base', 'Press', '{"Barra olímpica"}', '3 x 8', 120, 'Controlado 2-0-1', 'Añadir 1-2kg por semana', 'Strict Press intermedio', 'Fuerza de hombros para jerks y overhead.'),
('Sotts Press preparación', 'sotts-press-prep', 'Principiante', 'Técnica', 'Overhead', '{"PVC", "Barra vacía"}', '3 x 5', 90, 'Muy controlado', 'Mantener equilibrio en posición', 'Sotts Press con carga ligera', 'Movilidad overhead y estabilidad de hombro.'),
('Clean Grip Deadlift', 'clean-grip-deadlift', 'Principiante', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 5', 150, 'Controlado con explosión arriba', 'Setup perfecto, espalda tensa', 'Clean Pull desde suelo', 'Posición inicial correcta para cleans.'),
('Hang Pull (mid-thigh)', 'hang-pull-mid-thigh', 'Principiante', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 5', 120, 'Explosivo', 'Triple extensión completa', 'Hang Power Clean', 'Desarrolla potencia de cadera esencial.'),

-- HANG POSITIONS (4 ejercicios)
('Hang Power Clean (above knee)', 'hang-power-clean-above', 'Principiante', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos"}', '5 x 3', 150, 'Explosivo', 'Recepción sólida en power position', 'Hang Clean', 'Simplifica el clean eliminando el pull del suelo.'),
('Hang Power Snatch (above knee)', 'hang-power-snatch-above', 'Principiante', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos"}', '5 x 3', 150, 'Explosivo', 'Recepciónen overhead estable', 'Hang Snatch', 'Introducción al snatch sin complejidad del suelo.'),
('Hang Clean Pull', 'hang-clean-pull', 'Principiante', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 5', 120, 'Explosivo máximo', 'Barra llega a altura de pecho', 'Clean desde suelo', 'Desarrollo de pull explosivo.'),
('Hang Snatch Pull', 'hang-snatch-pull', 'Principiante', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 5', 120, 'Explosivo máximo', 'Barra sobre la cabeza en extensión', 'Snatch desde suelo', 'Potencia de cadera para snatch.'),

-- ACCESORIOS (3 ejercicios)
('Overhead Walking Lunges ligero', 'overhead-walking-lunges-light', 'Principiante', 'Accesorios', 'Overhead', '{"Disco", "Mancuerna"}', '3 x 8 pasos/pierna', 90, 'Controlado', 'Mantener posición overhead estable', 'OHL con barra', 'Estabilidad y movilidad overhead.'),
('Snatch Grip Behind Neck Press', 'snatch-grip-btn-press', 'Principiante', 'Accesorios', 'Press', '{"Barra olímpica"}', '3 x 8', 90, 'Controlado', 'Rango completo sin dolor', 'SGBTN Press con carga', 'Fuerza y movilidad de hombros para snatch.'),
('Plancha Hollow Hold', 'hollow-hold', 'Principiante', 'Accesorios', 'Core', '{"Sin peso"}', '3 x 30-45 seg', 60, 'Isométrico', 'Incrementar tiempo sostenido', 'Hollow Rock', 'Core esencial para transferencia de potencia.');

-- ---------------------------------------------------------------------------
-- NIVEL INTERMEDIO (22 ejercicios) - Desarrollo Técnico Completo
-- ---------------------------------------------------------------------------

INSERT INTO app."Ejercicios_Halterofilia"
(nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, criterio_de_progreso, progresion_desde, progresion_hacia, notas)
VALUES
-- SNATCH PROGRESSION (6 ejercicios)
('Power Snatch desde suelo', 'power-snatch-floor', 'Intermedio', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x 3', 180, 'Explosivo', 'Técnica fluida a 70-75% 1RM', 'Hang Power Snatch', 'Full Snatch', 'Snatch sin recepción en squat profunda.'),
('Hang Snatch (mid-thigh)', 'hang-snatch-mid', 'Intermedio', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos"}', '5 x 3', 180, 'Explosivo', 'Recepción profunda consistente', 'Hang Power Snatch', 'Snatch completo', 'Snatch con recepción en squat desde hang.'),
('Snatch Balance con barra', 'snatch-balance-barra', 'Intermedio', 'Técnica', 'Overhead', '{"Barra olímpica", "Discos"}', '4 x 4', 120, 'Velocidad máxima abajo', 'Aterrizar en bottom position estable', 'Snatch Balance PVC', 'Snatch Balance pesado', 'Velocidad de recepción bajo la barra.'),
('Snatch Pull desde suelo', 'snatch-pull-floor', 'Intermedio', 'Snatch', 'Pull', '{"Barra olímpica", "Discos", "Plataforma"}', '4 x 4 @ 95-105%', 180, 'Explosivo máximo', 'Potencia superior al lift completo', 'Hang Snatch Pull', 'Snatch Pull 110%+', 'Desarrolla potencia específica para snatch.'),
('Overhead Squat con barra', 'overhead-squat-barra', 'Intermedio', 'Técnica', 'Squat', '{"Barra olímpica", "Discos"}', '4 x 5', 120, 'Controlado 3-0-1', 'Profundidad ATG con control', 'OHS con PVC', 'OHS pesado', 'Fuerza y movilidad para recepción de snatch.'),
('Muscle Snatch con barra cargada', 'muscle-snatch-barra', 'Intermedio', 'Técnica', 'Arrancada', '{"Barra olímpica", "Discos"}', '4 x 5 @ 40-50%', 120, 'Velocidad de codos', 'Trayectoria perfecta con carga', 'Muscle Snatch PVC', 'Complejo de Snatch', 'Refuerza mecánica del pull y turnover.'),

-- CLEAN & JERK PROGRESSION (8 ejercicios)
('Power Clean desde suelo', 'power-clean-floor', 'Intermedio', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x 3', 180, 'Explosivo', 'Técnica sólida a 75-80%', 'Hang Power Clean', 'Full Clean', 'Clean sin recepción profunda en squat.'),
('Hang Clean (knee)', 'hang-clean-knee', 'Intermedio', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos"}', '5 x 3', 180, 'Explosivo', 'Recepción en bottom estable', 'Hang Power Clean', 'Clean completo', 'Clean completo desde hang position.'),
('Clean Pull desde suelo', 'clean-pull-floor', 'Intermedio', 'Clean & Jerk', 'Pull', '{"Barra olímpica", "Discos", "Plataforma"}', '4 x 4 @ 100-110%', 180, 'Explosivo máximo', 'Potencia mayor que clean máximo', 'Hang Clean Pull', 'Clean Pull 120%', 'Sobrecarga para desarrollar potencia de clean.'),
('Front Squat con carga', 'front-squat-cargado', 'Intermedio', 'Fuerza Base', 'Squat', '{"Barra olímpica", "Discos", "Rack"}', '4 x 5 @ 80%', 150, 'Controlado 2-0-1', 'Mantener torso vertical, codos arriba', 'Front Squat básico', 'Front Squat pesado', 'Fuerza específica para recepción de clean.'),
('Push Jerk', 'push-jerk', 'Intermedio', 'Clean & Jerk', 'Press', '{"Barra olímpica", "Discos"}', '5 x 3', 150, 'Explosivo en dip', 'Timing perfecto piernas-brazos', 'Push Press', 'Split Jerk', 'Jerk sin split, pies paralelos.'),
('Power Jerk', 'power-jerk', 'Intermedio', 'Clean & Jerk', 'Press', '{"Barra olímpica", "Discos"}', '4 x 3', 150, 'Velocidad bajo barra', 'Recepción rápida y estable', 'Push Jerk', 'Jerk desde bloques', 'Variante de jerk enfocada en velocidad.'),
('Clean + Front Squat (Complejo)', 'clean-front-squat-complex', 'Intermedio', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x (1+2)', 180, 'Explosivo clean, controlado squat', 'Sin reposar barra entre movimientos', 'Power Clean y Front Squat separados', 'Clean + 3 Front Squats', 'Complejo para fuerza de piernas post-clean.'),
('Tall Clean', 'tall-clean', 'Intermedio', 'Técnica', 'Dos tiempos', '{"Barra olímpica", "Discos"}', '4 x 5 ligero', 90, 'Velocidad máxima bajo barra', 'Recepción profunda sin pull', 'Muscle Clean', 'Complejo de recepción', 'Entrena velocidad de codos y recepción.'),

-- FUERZA BASE INTERMEDIA (4 ejercicios)
('Back Squat @ 80-85%', 'back-squat-intermedio', 'Intermedio', 'Fuerza Base', 'Squat', '{"Barra olímpica", "Discos", "Rack"}', '5 x 5 @ 80%', 180, 'Controlado con aceleración', 'Añadir peso conservadoramente', 'Back Squat básico', 'Back Squat avanzado', 'Fuerza general para todos los levantamientos.'),
('Romanian Deadlift con carga', 'rdl-intermedio', 'Intermedio', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 6 @ 75%', 120, 'Controlado eccéntrico', 'Rango completo sin redondeo', 'RDL básico', 'RDL pesado', 'Fuerza de cadena posterior.'),
('Strict Press intermedio', 'strict-press-intermedio', 'Intermedio', 'Fuerza Base', 'Press', '{"Barra olímpica", "Discos"}', '4 x 6 @ 75%', 120, 'Controlado 2-0-X', 'Sin layback excesivo', 'Strict Press básico', 'Strict Press pesado', 'Fuerza de press para jerks.'),
('Bulgarian Split Squat con barra', 'bulgarian-split-barra', 'Intermedio', 'Accesorios', 'Squat', '{"Barra olímpica", "Banco"}', '3 x 8/pierna', 90, 'Controlado', 'Balance y profundidad consistente', 'Split Squat sin peso', 'BSS pesado', 'Corrige desbalances y fortalece split jerk.'),

-- ACCESORIOS INTERMEDIO (4 ejercicios)
('Overhead Walking Lunges con barra', 'ohl-barra', 'Intermedio', 'Accesorios', 'Overhead', '{"Barra olímpica", "Discos"}', '3 x 10 pasos/pierna', 120, 'Controlado', 'Barra estable arriba todo el recorrido', 'OHL ligero', 'OHL pesado', 'Estabilidad overhead funcional.'),
('Snatch Grip High Pull', 'snatch-grip-high-pull', 'Intermedio', 'Accesorios', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 6', 120, 'Explosivo', 'Codos altos, barra a altura de pecho', 'Snatch Pull', 'Complejo de pull', 'Velocidad de codos en el turnover.'),
('Sotts Press con carga ligera', 'sotts-press-ligero', 'Intermedio', 'Accesorios', 'Press', '{"Barra olímpica", "Discos"}', '3 x 6', 90, 'Muy controlado', 'Mantener posición squat profunda', 'Sotts Press prep', 'Sotts Press moderado', 'Movilidad y fuerza overhead extrema.'),
('Pendlay Row', 'pendlay-row', 'Intermedio', 'Accesorios', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 8', 90, 'Explosivo concéntrico', 'Espalda paralela, barra toca suelo', 'Bent Over Row', 'Pendlay Row pesado', 'Fuerza de espalda para postura en lifts.');

-- ---------------------------------------------------------------------------
-- NIVEL AVANZADO (23 ejercicios) - Competición y Alta Técnica
-- ---------------------------------------------------------------------------

INSERT INTO app."Ejercicios_Halterofilia"
(nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, criterio_de_progreso, progresion_desde, progresion_hacia, notas)
VALUES
-- SNATCH COMPLETO (7 ejercicios)
('Snatch completo desde suelo', 'snatch-full', 'Avanzado', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x 2 @ 80-85%', 240, 'Explosivo', 'Consistencia técnica en porcentajes altos', 'Hang Snatch', 'Snatch en competición', 'Levantamiento olímpico completo. Primera prueba oficial.'),
('Snatch desde bloques (knee)', 'snatch-blocks-knee', 'Avanzado', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos", "Bloques"}', '5 x 3 @ 75-80%', 180, 'Explosivo', 'Reforzar segunda pull', 'Hang Snatch', 'Snatch complejo bloques', 'Overload del segundo pull específico.'),
('Snatch Pull pesado 110-120%', 'snatch-pull-heavy', 'Avanzado', 'Snatch', 'Pull', '{"Barra olímpica", "Discos", "Plataforma"}', '3 x 3 @ 110%+', 240, 'Explosivo máximo', 'Velocidad de barra con sobrecarga', 'Snatch Pull 95-105%', 'Snatch Pull 125%+', 'Sobrecarga extrema para potencia.'),
('Snatch Complejo: 1+1+1', 'snatch-complex-triple', 'Avanzado', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos", "Plataforma"}', '4 x (Power+Hang+Full)', 240, 'Variado', 'Mantener técnica en fatiga', 'Power Snatch + Full Snatch', 'Complejos más largos', 'Complejo de snatch multi-movimiento. Alta demanda.'),
('Drop Snatch pesado', 'drop-snatch-heavy', 'Avanzado', 'Técnica', 'Overhead', '{"Barra olímpica", "Discos"}', '4 x 3 @ 50-60%', 120, 'Velocidad máxima', 'Recepción instantánea en bottom', 'Snatch Balance', 'Drop Snatch + OHS', 'Velocidad extrema bajo la barra.'),
('Overhead Squat pesado', 'overhead-squat-heavy', 'Avanzado', 'Técnica', 'Squat', '{"Barra olímpica", "Discos"}', '5 x 3 @ 85%', 180, 'Controlado con velocidad', 'Profundidad ATG sin perder tensión', 'OHS intermedio', 'OHS máximo', 'Fuerza y movilidad overhead extrema.'),
('Snatch High Pull + Snatch (Complejo)', 'snatch-hp-snatch-complex', 'Avanzado', 'Snatch', 'Arrancada', '{"Barra olímpica", "Discos", "Plataforma"}', '4 x (2+1)', 180, 'Explosivo pull, perfecto snatch', 'Activación de pull antes del lift', 'Snatch Pull y Snatch separados', 'Complejos más avanzados', 'Activa sistema nervioso antes del lift.'),

-- CLEAN & JERK COMPLETO (9 ejercicios)
('Clean completo desde suelo', 'clean-full', 'Avanzado', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x 2 @ 80-85%', 240, 'Explosivo', 'Recepción profunda estable', 'Hang Clean', 'Clean & Jerk', 'Clean completo con recepción en squat profundo.'),
('Clean & Jerk', 'clean-and-jerk', 'Avanzado', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x 1 @ 85-90%', 300, 'Explosivo clean, técnico jerk', 'Consistencia en singles pesados', 'Clean + Jerk separados', 'C&J competición', 'Levantamiento olímpico completo. Segunda prueba oficial.'),
('Split Jerk', 'split-jerk', 'Avanzado', 'Clean & Jerk', 'Press', '{"Barra olímpica", "Discos"}', '5 x 2 @ 85%', 180, 'Velocidad bajo barra', 'Split timing perfecto', 'Push Jerk', 'Split Jerk máximo', 'Jerk de competición con split de piernas.'),
('Clean Pull pesado 110-120%', 'clean-pull-heavy', 'Avanzado', 'Clean & Jerk', 'Pull', '{"Barra olímpica", "Discos", "Plataforma"}', '3 x 3 @ 115%', 240, 'Explosivo máximo', 'Velocidad con sobrecarga significativa', 'Clean Pull 100-110%', 'Clean Pull 125%+', 'Sobrecarga para potencia de clean.'),
('Front Squat pesado', 'front-squat-heavy', 'Avanzado', 'Fuerza Base', 'Squat', '{"Barra olímpica", "Discos", "Rack"}', '5 x 3 @ 90%', 240, 'Controlado con aceleración', 'Torso vertical, codos altos siempre', 'Front Squat intermedio', 'Front Squat máximo', 'Fuerza máxima de piernas para clean.'),
('Clean complejo: Power + Full + Jerk', 'clean-complex-full', 'Avanzado', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos", "Plataforma"}', '4 x (1+1+1)', 270, 'Variado, mantener técnica', 'Sin descanso entre movimientos', 'Clean + Jerk separados', 'Complejos más largos', 'Complejo de clean multi-fase.'),
('Jerk desde bloques (detrás del cuello)', 'jerk-blocks-btn', 'Avanzado', 'Clean & Jerk', 'Press', '{"Barra olímpica", "Discos", "Rack"}', '5 x 3 @ 85%', 180, 'Explosivo máximo', 'Timing del dip perfecto', 'Push Jerk', 'Jerk BTN pesado', 'Overload de jerk sin fatiga de clean.'),
('Tall Jerk', 'tall-jerk', 'Avanzado', 'Técnica', 'Press', '{"Barra olímpica", "Discos"}', '4 x 5 ligero', 90, 'Velocidad máxima split', 'Split explosivo sin dip', 'Push Jerk', 'Jerk complejo técnico', 'Velocidad de split sin impulso de piernas.'),
('Clean + 3 Front Squats', 'clean-3fs-complex', 'Avanzado', 'Clean & Jerk', 'Dos tiempos', '{"Barra olímpica", "Discos", "Plataforma"}', '5 x (1+3)', 240, 'Explosivo clean, controlado squats', 'Mantener postura en fatiga', 'Clean + Front Squat', 'Complejos más pesados', 'Sobrecarga de piernas post-clean.'),

-- FUERZA BASE AVANZADA (4 ejercicios)
('Back Squat pesado', 'back-squat-heavy', 'Avanzado', 'Fuerza Base', 'Squat', '{"Barra olímpica", "Discos", "Rack"}', '5 x 3 @ 90%', 240, 'Controlado con velocidad', 'Profundidad consistente en cargas máximas', 'Back Squat intermedio', 'Back Squat máximo', 'Fuerza máxima de piernas. Base de todo.'),
('Deficit Snatch Pull', 'deficit-snatch-pull', 'Avanzado', 'Snatch', 'Pull', '{"Barra olímpica", "Discos", "Plataforma", "Bloques elevación"}', '4 x 4', 180, 'Explosivo desde posición baja', 'Rango aumentado fortalece first pull', 'Snatch Pull floor', 'Deficit Pull pesado', 'Overload del primer pull desde déficit.'),
('Pause Front Squat', 'pause-front-squat', 'Avanzado', 'Fuerza Base', 'Squat', '{"Barra olímpica", "Discos", "Rack"}', '4 x 3 @ 80% con pausa 3 seg', 180, 'Controlado con pausa', 'Mantener tensión en pausa bottom', 'Front Squat pesado', 'Pause FS máximo', 'Fuerza y control en posición de recepción.'),
('Good Morning pesado', 'good-morning-heavy', 'Avanzado', 'Fuerza Base', 'Pull', '{"Barra olímpica", "Discos", "Rack"}', '4 x 6 @ 70%', 120, 'Controlado 3-0-1', 'Bisagra perfecta con carga', 'Good Morning intermedio', 'Good Morning máximo', 'Fuerza de cadena posterior y core.'),

-- ACCESORIOS AVANZADOS (3 ejercicios)
('Snatch Grip Overhead Lunges pesado', 'sg-ohl-heavy', 'Avanzado', 'Accesorios', 'Overhead', '{"Barra olímpica", "Discos"}', '3 x 8 pasos/pierna', 150, 'Controlado', 'Barra estable con agarre ancho', 'OHL con barra', 'OHL máximo', 'Estabilidad overhead con agarre de snatch.'),
('Sotts Press moderado', 'sotts-press-moderado', 'Avanzado', 'Accesorios', 'Press', '{"Barra olímpica", "Discos"}', '3 x 5 @ 30-40kg', 120, 'Controlado extremo', 'Mantener bottom squat perfecta', 'Sotts Press ligero', 'Sotts Press pesado', 'Movilidad y fuerza overhead extrema.'),
('Snatch Grip RDL pesado', 'snatch-grip-rdl-heavy', 'Avanzado', 'Accesorios', 'Pull', '{"Barra olímpica", "Discos"}', '4 x 6 @ 80%', 120, 'Controlado 3-0-1', 'Rango completo con agarre ancho', 'RDL normal', 'SG RDL máximo', 'Fuerza de cadena posterior específica para snatch.');

-- ===========================================================================
-- TRIGGERS Y FUNCIONES DE ACTUALIZACIÓN
-- ===========================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_ejercicios_halterofilia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp en cada UPDATE
CREATE TRIGGER trigger_update_ejercicios_halterofilia_timestamp
BEFORE UPDATE ON app."Ejercicios_Halterofilia"
FOR EACH ROW
EXECUTE FUNCTION update_ejercicios_halterofilia_updated_at();

-- ===========================================================================
-- VERIFICACIÓN DE DATOS INSERTADOS
-- ===========================================================================

-- Contar ejercicios por nivel
SELECT nivel, COUNT(*) as total_ejercicios
FROM app."Ejercicios_Halterofilia"
GROUP BY nivel
ORDER BY
  CASE nivel
    WHEN 'Principiante' THEN 1
    WHEN 'Intermedio' THEN 2
    WHEN 'Avanzado' THEN 3
  END;

-- Contar ejercicios por categoría
SELECT categoria, COUNT(*) as total
FROM app."Ejercicios_Halterofilia"
GROUP BY categoria
ORDER BY total DESC;

-- Verificar nombres únicos
SELECT COUNT(*) as total_ejercicios,
       COUNT(DISTINCT nombre) as nombres_unicos
FROM app."Ejercicios_Halterofilia";

-- ===========================================================================
-- FIN DEL SCRIPT
-- ===========================================================================
