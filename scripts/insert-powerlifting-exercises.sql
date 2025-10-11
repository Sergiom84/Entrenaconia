-- ===========================================================================
-- POBLAR TABLA DE EJERCICIOS DE POWERLIFTING
-- ===========================================================================
-- Descripción: Inserta ejercicios de Powerlifting organizados por niveles
-- Total esperado: ~100 ejercicios
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- Version: 1.0.0
-- ===========================================================================

-- ===========================================================================
-- NIVEL: NOVATO (0-6 meses)
-- ===========================================================================

-- SENTADILLA - NOVATO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Back Squat (barra alta)', 'Novato', 'Sentadilla', 'Compuesto', 'Barra olímpica, Rack', '3-5 x 5-8', '60-75% 1RM', 180, 'Enfoque en técnica perfecta, profundidad completa'),
('Goblet Squat', 'Novato', 'Sentadilla', 'Compuesto', 'Mancuerna o Kettlebell', '3-4 x 8-12', 'RPE 7-8', 90, 'Excelente para aprender patrón de sentadilla'),
('Box Squat', 'Novato', 'Sentadilla', 'Variante', 'Barra, Rack, Box', '3-5 x 5-8', '60-70% 1RM', 180, 'Enseña explosividad desde posición sentada'),
('Front Squat (introducción)', 'Novato', 'Sentadilla', 'Compuesto', 'Barra olímpica, Rack', '3-4 x 6-10', '60-70% 1RM', 120, 'Movilidad de muñecas y torso erguido');

-- PRESS DE BANCA - NOVATO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Bench Press plano', 'Novato', 'Press Banca', 'Compuesto', 'Barra olímpica, Banco', '3-5 x 5-8', '60-75% 1RM', 180, 'Retracción escapular, arco torácico, leg drive'),
('Incline Bench Press', 'Novato', 'Press Banca', 'Variante', 'Barra, Banco inclinado', '3-4 x 6-10', '60-70% 1RM', 120, 'Desarrollo de pecho superior y hombros'),
('Close Grip Bench Press', 'Novato', 'Press Banca', 'Variante', 'Barra, Banco', '3-4 x 6-10', '60-70% 1RM', 120, 'Énfasis en tríceps para lock-out'),
('Dumbbell Bench Press', 'Novato', 'Press Banca', 'Compuesto', 'Mancuernas, Banco', '3-4 x 8-12', 'RPE 7-8', 90, 'Desarrollo unilateral y estabilización');

-- PESO MUERTO - NOVATO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Conventional Deadlift', 'Novato', 'Peso Muerto', 'Compuesto', 'Barra olímpica, Discos', '3-5 x 3-6', '65-75% 1RM', 240, 'Técnica perfecta, espalda neutral, tensión antes del pull'),
('Romanian Deadlift', 'Novato', 'Peso Muerto', 'Variante', 'Barra olímpica', '3-4 x 8-12', '60-70% 1RM', 120, 'Desarrollo de isquios y glúteos, patrón de bisagra'),
('Rack Pulls (altura rodilla)', 'Novato', 'Peso Muerto', 'Variante', 'Barra, Rack, Pines', '3-4 x 5-8', '70-80% 1RM', 180, 'Enfoque en lock-out superior'),
('Sumo Deadlift (introducción)', 'Novato', 'Peso Muerto', 'Compuesto', 'Barra olímpica', '3-4 x 5-8', '60-70% 1RM', 180, 'Variante para atletas con movilidad de cadera');

-- ASISTENCIA INFERIOR - NOVATO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Leg Press', 'Novato', 'Asistencia Inferior', 'Compuesto', 'Máquina Leg Press', '3-4 x 10-15', 'RPE 7-8', 90, 'Volumen de cuádriceps sin fatiga del SNC'),
('Walking Lunges', 'Novato', 'Asistencia Inferior', 'Unilateral', 'Mancuernas', '3 x 10-12/pierna', 'RPE 7', 60, 'Desarrollo unilateral y balance'),
('Leg Curls', 'Novato', 'Asistencia Inferior', 'Aislamiento', 'Máquina', '3-4 x 10-15', 'RPE 7-8', 60, 'Desarrollo de isquios'),
('Calf Raises', 'Novato', 'Asistencia Inferior', 'Aislamiento', 'Máquina o Smith', '3-4 x 12-20', 'RPE 8', 60, 'Desarrollo de gemelos');

-- ASISTENCIA SUPERIOR - NOVATO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Dips (tríceps)', 'Novato', 'Asistencia Superior', 'Compuesto', 'Paralelas', '3-4 x 6-10', 'RPE 7-8', 90, 'Asistencia clave para lock-out de press'),
('Barbell Row', 'Novato', 'Asistencia Superior', 'Compuesto', 'Barra olímpica', '3-4 x 8-12', 'RPE 7-8', 90, 'Desarrollo de dorsales y estabilidad'),
('Overhead Press', 'Novato', 'Asistencia Superior', 'Compuesto', 'Barra olímpica', '3-4 x 6-10', 'RPE 7-8', 120, 'Fuerza de hombros y core'),
('Pull-Ups', 'Novato', 'Asistencia Superior', 'Compuesto', 'Barra fija', '3-4 x 5-10', 'RPE 7-8', 90, 'Dorsales y bíceps');

-- ===========================================================================
-- NIVEL: INTERMEDIO (6 meses - 2 años)
-- ===========================================================================

-- SENTADILLA - INTERMEDIO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Back Squat (barra baja)', 'Intermedio', 'Sentadilla', 'Compuesto', 'Barra olímpica, Rack', '4-6 x 3-6', '70-85% 1RM', 240, 'Estilo competitivo con mayor carga'),
('Pause Squat (2 segundos)', 'Intermedio', 'Sentadilla', 'Variante', 'Barra, Rack', '4-5 x 3-5', '70-80% 1RM', 240, 'Elimina rebote, fortalece bottom position'),
('Tempo Squat (3-0-1-0)', 'Intermedio', 'Sentadilla', 'Variante', 'Barra, Rack', '4-5 x 4-6', '65-75% 1RM', 180, 'Control excéntrico, tiempo bajo tensión'),
('Safety Bar Squat', 'Intermedio', 'Sentadilla', 'Variante', 'Safety Squat Bar, Rack', '4-5 x 5-8', '70-80% 1RM', 180, 'Menos estrés en hombros, más cuádriceps'),
('Front Squat', 'Intermedio', 'Sentadilla', 'Compuesto', 'Barra olímpica, Rack', '4-5 x 4-6', '70-80% 1RM', 180, 'Desarrollo de cuádriceps y torso erguido');

-- PRESS DE BANCA - INTERMEDIO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Competition Bench Press', 'Intermedio', 'Press Banca', 'Compuesto', 'Barra, Banco', '4-6 x 3-6', '75-85% 1RM', 240, 'Técnica competitiva con pausa'),
('Paused Bench Press (2 seg)', 'Intermedio', 'Press Banca', 'Variante', 'Barra, Banco', '4-5 x 3-5', '70-80% 1RM', 240, 'Elimina momentum, fortalece off-chest'),
('Tempo Bench (3-1-1-0)', 'Intermedio', 'Press Banca', 'Variante', 'Barra, Banco', '4-5 x 4-6', '65-75% 1RM', 180, 'Control excéntrico, pausa isométrica'),
('Floor Press', 'Intermedio', 'Press Banca', 'Variante', 'Barra, Banco en piso', '4-5 x 5-8', '70-80% 1RM', 180, 'Lock-out de tríceps, menor rango'),
('Board Press (2-3 boards)', 'Intermedio', 'Press Banca', 'Variante', 'Barra, Banco, Boards', '4-5 x 3-5', '80-90% 1RM', 240, 'Overload parcial, lock-out');

-- PESO MUERTO - INTERMEDIO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Sumo Deadlift', 'Intermedio', 'Peso Muerto', 'Compuesto', 'Barra olímpica', '4-6 x 2-5', '75-85% 1RM', 300, 'Técnica competitiva sumo'),
('Paused Deadlift (rodilla)', 'Intermedio', 'Peso Muerto', 'Variante', 'Barra olímpica', '4-5 x 3-5', '70-80% 1RM', 240, 'Fortalece sticking point mid-range'),
('Deficit Deadlift (2-3")', 'Intermedio', 'Peso Muerto', 'Variante', 'Barra, Plataforma elevada', '4-5 x 3-5', '70-80% 1RM', 240, 'Mayor rango, off-floor'),
('Block Pulls (altura rodilla)', 'Intermedio', 'Peso Muerto', 'Variante', 'Barra, Bloques', '4-5 x 3-5', '80-90% 1RM', 240, 'Overload lock-out superior');

-- ASISTENCIA INFERIOR - INTERMEDIO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Bulgarian Split Squat', 'Intermedio', 'Asistencia Inferior', 'Unilateral', 'Mancuernas, Banco', '3-4 x 8-12/pierna', 'RPE 7-8', 90, 'Unilateral con énfasis en cuádriceps'),
('Good Mornings', 'Intermedio', 'Asistencia Inferior', 'Compuesto', 'Barra', '3-4 x 8-12', 'RPE 7-8', 120, 'Cadena posterior, patrón de bisagra'),
('Hip Thrusts', 'Intermedio', 'Asistencia Inferior', 'Compuesto', 'Barra, Banco', '3-4 x 10-15', 'RPE 8-9', 90, 'Glúteos para lockout de sentadilla/peso muerto'),
('Glute-Ham Raise', 'Intermedio', 'Asistencia Inferior', 'Compuesto', 'Máquina GHR', '3-4 x 6-10', 'RPE 8-9', 90, 'Isquios excéntricos ultra-específicos');

-- ASISTENCIA SUPERIOR - INTERMEDIO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('JM Press', 'Intermedio', 'Asistencia Superior', 'Compuesto', 'Barra, Banco', '3-4 x 6-10', 'RPE 8', 120, 'Tríceps específico para lock-out'),
('Tricep Extensions (overhead)', 'Intermedio', 'Asistencia Superior', 'Aislamiento', 'Barra EZ o Mancuerna', '3-4 x 10-15', 'RPE 7-8', 60, 'Cabeza larga de tríceps'),
('Face Pulls', 'Intermedio', 'Asistencia Superior', 'Aislamiento', 'Polea', '3-4 x 15-20', 'RPE 7', 60, 'Salud de hombros, manguito rotador'),
('Pendlay Row', 'Intermedio', 'Asistencia Superior', 'Compuesto', 'Barra olímpica', '3-4 x 6-10', 'RPE 8', 120, 'Explosividad desde suelo, dorsales');

-- ===========================================================================
-- NIVEL: AVANZADO (2-5 años)
-- ===========================================================================

-- SENTADILLA - AVANZADO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Competition Squat (max)', 'Avanzado', 'Sentadilla', 'Compuesto', 'Barra, Rack, Wraps/Sleeves', '5-8 x 1-5', '80-95% 1RM', 300, 'Técnica competitiva, peaking'),
('Wide Stance Squat', 'Avanzado', 'Sentadilla', 'Variante', 'Barra, Rack', '5-6 x 3-5', '75-85% 1RM', 240, 'Mayor activación glúteos/aductores'),
('Pause Squat (3 segundos)', 'Avanzado', 'Sentadilla', 'Variante', 'Barra, Rack', '5-6 x 2-4', '75-85% 1RM', 300, 'Fortaleza extrema en hole'),
('Pin Squats', 'Avanzado', 'Sentadilla', 'Variante', 'Barra, Rack, Pines', '5-6 x 3-5', '80-90% 1RM', 240, 'Concéntrico puro, bottom strength'),
('Anderson Squats', 'Avanzado', 'Sentadilla', 'Variante', 'Barra, Rack, Pines', '5-6 x 2-4', '80-90% 1RM', 300, 'Concéntrico desde pines, sticking point'),
('Squat con Bandas', 'Avanzado', 'Sentadilla', 'Variante', 'Barra, Rack, Bandas', '5-6 x 3-5', '70-80% + bandas', 240, 'Acomodating resistance, speed'),
('Squat con Cadenas', 'Avanzado', 'Sentadilla', 'Variante', 'Barra, Rack, Cadenas', '5-6 x 3-5', '70-80% + cadenas', 240, 'Variable resistance, lock-out');

-- PRESS DE BANCA - AVANZADO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Competition Bench (arco)', 'Avanzado', 'Press Banca', 'Compuesto', 'Barra, Banco, Wraps', '5-8 x 1-5', '80-95% 1RM', 300, 'Max arco legal, técnica competitiva'),
('Wide Grip Bench', 'Avanzado', 'Press Banca', 'Variante', 'Barra, Banco', '5-6 x 3-5', '75-85% 1RM', 240, 'Mayor activación pecho, menor rango'),
('Narrow Grip Bench', 'Avanzado', 'Press Banca', 'Variante', 'Barra, Banco', '5-6 x 4-6', '75-85% 1RM', 180, 'Tríceps dominante, lock-out'),
('Bench con Bandas', 'Avanzado', 'Press Banca', 'Variante', 'Barra, Banco, Bandas', '5-6 x 3-5', '70-80% + bandas', 240, 'Speed work, lock-out explosivo'),
('Bench con Cadenas', 'Avanzado', 'Press Banca', 'Variante', 'Barra, Banco, Cadenas', '5-6 x 3-5', '70-80% + cadenas', 240, 'Variable resistance'),
('Slingshot Press', 'Avanzado', 'Press Banca', 'Variante', 'Barra, Banco, Slingshot', '5-6 x 3-5', '100-110% 1RM', 300, 'Overload supramáximo, CNS'),
('Pin Press', 'Avanzado', 'Press Banca', 'Variante', 'Barra, Rack, Pines', '5-6 x 3-5', '80-90% 1RM', 240, 'Concéntrico puro, mid-range');

-- PESO MUERTO - AVANZADO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Competition Deadlift (conv/sumo)', 'Avanzado', 'Peso Muerto', 'Compuesto', 'Barra, Discos, Straps', '5-8 x 1-5', '80-95% 1RM', 360, 'Técnica competitiva, peaking'),
('Deficit Deadlift (4")', 'Avanzado', 'Peso Muerto', 'Variante', 'Barra, Plataforma alta', '5-6 x 2-4', '75-85% 1RM', 300, 'Rango extendido, off-floor'),
('Paused Deadlift (múltiples posiciones)', 'Avanzado', 'Peso Muerto', 'Variante', 'Barra', '5-6 x 2-4', '75-85% 1RM', 300, 'Pausa en rodilla y mid-shin'),
('Snatch Grip Deadlift', 'Avanzado', 'Peso Muerto', 'Variante', 'Barra olímpica', '5-6 x 3-5', '70-80% 1RM', 240, 'Mayor rango, desarrollo de traps'),
('Deadlift con Bandas', 'Avanzado', 'Peso Muerto', 'Variante', 'Barra, Bandas', '5-6 x 3-5', '70-80% + bandas', 300, 'Lock-out explosivo'),
('Speed Deadlifts', 'Avanzado', 'Peso Muerto', 'Variante', 'Barra', '6-10 x 1-3', '60-70% 1RM', 120, 'Dynamic effort, velocidad');

-- ASISTENCIA INFERIOR - AVANZADO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Belt Squats', 'Avanzado', 'Asistencia Inferior', 'Compuesto', 'Belt Squat Machine', '3-5 x 10-15', 'RPE 8-9', 90, 'Volumen sin estrés lumbar'),
('Nordic Hamstring Curls', 'Avanzado', 'Asistencia Inferior', 'Compuesto', 'Partner o GHR', '3-4 x 5-8', 'RPE 9-10', 120, 'Excéntricos extremos de isquios'),
('Step-Ups (carga pesada)', 'Avanzado', 'Asistencia Inferior', 'Unilateral', 'Mancuernas o Barra', '3-4 x 6-8/pierna', 'RPE 8', 120, 'Unilateral con carga');

-- ASISTENCIA SUPERIOR - AVANZADO
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Bradford Press', 'Avanzado', 'Asistencia Superior', 'Compuesto', 'Barra', '3-4 x 8-12', 'RPE 8', 90, 'Hombros anterior + medial, movilidad'),
('Seal Row', 'Avanzado', 'Asistencia Superior', 'Compuesto', 'Barra, Banco elevado', '3-4 x 8-12', 'RPE 8', 90, 'Aislamiento de dorsales, sin cheating'),
('Band Pull-Aparts', 'Avanzado', 'Asistencia Superior', 'Aislamiento', 'Banda', '3-5 x 20-30', 'RPE 7', 30, 'Manguito, retracción escapular');

-- ===========================================================================
-- NIVEL: ELITE (+5 años competitivo)
-- ===========================================================================

-- SENTADILLA - ELITE
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Max Effort Squat (comp)', 'Elite', 'Sentadilla', 'Compuesto', 'Barra, Rack, Gear', '6-10 x 1-3', '85-100% 1RM', 360, 'Peaking para competencia'),
('Dynamic Effort Squat', 'Elite', 'Sentadilla', 'Variante', 'Barra, Rack, Bandas', '8-12 x 2-3', '50-60% + bandas', 60, 'Speed work, conjugate'),
('Accommodating Resistance Squat', 'Elite', 'Sentadilla', 'Variante', 'Barra, Bandas/Cadenas', '6-8 x 2-4', '70-80% + resistance', 240, 'Conjugate method');

-- PRESS DE BANCA - ELITE
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Max Effort Bench (comp)', 'Elite', 'Press Banca', 'Compuesto', 'Barra, Banco, Gear', '6-10 x 1-3', '85-100% 1RM', 360, 'Peaking para competencia'),
('Dynamic Effort Bench', 'Elite', 'Press Banca', 'Variante', 'Barra, Banco, Bandas', '8-12 x 3', '50-60% + bandas', 60, 'Speed work, explosive'),
('Shirt Work (equipped)', 'Elite', 'Press Banca', 'Variante', 'Barra, Bench Shirt', '5-8 x 1-3', '100-120% 1RM', 420, 'Solo para equipped powerlifters');

-- PESO MUERTO - ELITE
INSERT INTO app."Ejercicios_Powerlifting" (nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, intensidad, descanso_seg, notas) VALUES
('Max Effort Deadlift (comp)', 'Elite', 'Peso Muerto', 'Compuesto', 'Barra, Suit (opcional)', '6-10 x 1-3', '85-100% 1RM', 420, 'Peaking para competencia'),
('Dynamic Effort Deadlift', 'Elite', 'Peso Muerto', 'Variante', 'Barra, Bandas', '8-12 x 1-2', '60-70% + bandas', 90, 'Speed pulls, explosividad'),
('Overload Deadlift (straps)', 'Elite', 'Peso Muerto', 'Variante', 'Barra, Straps', '5-6 x 1-3', '100-110% 1RM', 420, 'CNS overload, lock-out');

-- ===========================================================================
-- VERIFICACIÓN FINAL
-- ===========================================================================

-- Contar ejercicios por nivel
SELECT nivel, COUNT(*) as total_ejercicios
FROM app."Ejercicios_Powerlifting"
GROUP BY nivel
ORDER BY
  CASE nivel
    WHEN 'Novato' THEN 1
    WHEN 'Intermedio' THEN 2
    WHEN 'Avanzado' THEN 3
    WHEN 'Elite' THEN 4
  END;

-- Contar por categoría
SELECT categoria, COUNT(*) as total
FROM app."Ejercicios_Powerlifting"
GROUP BY categoria
ORDER BY total DESC;

-- Total general
SELECT COUNT(*) as total_ejercicios_powerlifting
FROM app."Ejercicios_Powerlifting";

-- ===========================================================================
-- RESULTADO ESPERADO: ~100 ejercicios
-- ===========================================================================
