-- ===========================================================================
-- POBLAR TABLA DE EJERCICIOS DE CROSSFIT
-- ===========================================================================
-- Descripción: Inserta ejercicios de CrossFit organizados por niveles y dominios
-- Total esperado: ~120 ejercicios
-- Niveles: Principiante (Scaled), Intermedio (RX), Avanzado (RX+), Elite
-- Dominios: Gymnastic, Weightlifting, Monostructural, Accesorios
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-01-10
-- Versión: 1.0.0
-- ===========================================================================

-- ===========================================================================
-- NIVEL: PRINCIPIANTE (SCALED) - 30 ejercicios
-- ===========================================================================

-- GYMNASTIC - PRINCIPIANTE (8 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Ring Rows', 'Principiante', 'Gymnastic', 'Pull', 'Anillas', 'AMRAP', 'RPE 7', 30, 60, 'Ajustar ángulo del cuerpo', 'Horizontal pull para desarrollar fuerza de espalda'),
('Push-Ups', 'Principiante', 'Gymnastic', 'Push', 'Ninguno', 'AMRAP', 'RPE 7', 30, 60, 'Rodillas en el suelo', 'Técnica perfecta: core apretado, codos 45°'),
('Air Squats', 'Principiante', 'Gymnastic', 'Squat', 'Ninguno', 'AMRAP', 'RPE 6', 30, 45, 'Reducir profundidad', 'Peso en talones, rodillas tracking con dedos'),
('Plank Hold', 'Principiante', 'Gymnastic', 'Core', 'Ninguno', 'EMOM', 'RPE 8', 60, 90, 'Knees plank', 'Core engagement, neutro espinal'),
('Jumping Jacks', 'Principiante', 'Gymnastic', 'Cardio', 'Ninguno', 'AMRAP', 'RPE 5', 30, 30, 'Marcha en lugar', 'Calentamiento, movilidad de hombros'),
('Box Step-Ups', 'Principiante', 'Gymnastic', 'Legs', 'Box 12-20"', 'For Time', 'RPE 6', 30, 45, 'Box más baja', 'Pie completo en box, empuje con pierna superior'),
('Sit-Ups', 'Principiante', 'Gymnastic', 'Core', 'Ninguno', 'AMRAP', 'RPE 6', 30, 45, 'Assisted sit-ups', 'Control en bajada, manos al suelo'),
('Burpees (scaled)', 'Principiante', 'Gymnastic', 'Full Body', 'Ninguno', 'For Time', 'RPE 7', 30, 60, 'Step-back burpees', 'Movimiento completo, ritmo constante');

-- WEIGHTLIFTING - PRINCIPIANTE (8 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Goblet Squats', 'Principiante', 'Weightlifting', 'Squat', 'Kettlebell/Mancuerna', 'EMOM', '40-50% 1RM', 30, 90, 'Peso más ligero', 'Enseña patrón de sentadilla profunda'),
('Dumbbell Press', 'Principiante', 'Weightlifting', 'Press', 'Mancuernas', 'EMOM', '50-60% 1RM', 30, 90, 'Peso más ligero', 'Press de hombros bilateral'),
('Kettlebell Swings (Russian)', 'Principiante', 'Weightlifting', 'Hip Hinge', 'Kettlebell', 'AMRAP', 'RPE 7', 30, 60, 'KB más ligera', 'Extensión de cadera explosiva, hasta altura de pecho'),
('Romanian Deadlifts', 'Principiante', 'Weightlifting', 'Hip Hinge', 'Barra/Mancuernas', 'Strength', '50-60% 1RM', 30, 120, 'Peso reducido', 'Patrón de bisagra, desarrollo de isquios'),
('Dumbbell Rows', 'Principiante', 'Weightlifting', 'Pull', 'Mancuernas', 'EMOM', 'RPE 7', 30, 60, 'Peso ligero', 'Unilateral, estabilidad core'),
('Front Squats (light)', 'Principiante', 'Weightlifting', 'Squat', 'Barra', 'Strength', '40-50% 1RM', 30, 120, 'PVC/barra vacía', 'Torso erguido, movilidad de muñecas'),
('Wall Balls (light)', 'Principiante', 'Weightlifting', 'Full Body', 'Med Ball 6-10 lbs', 'AMRAP', 'RPE 7', 30, 45, 'Peso reducido, target más bajo', 'Squat completo, lanzamiento coordinado'),
('Push Press (light)', 'Principiante', 'Weightlifting', 'Press', 'Barra', 'EMOM', '50-60% 1RM', 30, 90, 'PVC/barra vacía', 'Dip-drive, extensión overhead');

-- MONOSTRUCTURAL - PRINCIPIANTE (7 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Rowing (slow pace)', 'Principiante', 'Monostructural', 'Cardio', 'Rower', 'For Time', 'RPE 6', 300, 120, 'Reducir distancia', 'Técnica: piernas-core-brazos, ratio 1:2'),
('Assault Bike (moderate)', 'Principiante', 'Monostructural', 'Cardio', 'Assault Bike', 'EMOM', 'RPE 6', 60, 90, 'Reducir calorías', 'Brazos y piernas coordinadas'),
('Running (easy pace)', 'Principiante', 'Monostructural', 'Cardio', 'Ninguno', 'For Time', 'RPE 5-6', 300, 120, 'Caminar', 'Mantener conversación, base aeróbica'),
('Jump Rope (singles)', 'Principiante', 'Monostructural', 'Cardio', 'Jump Rope', 'AMRAP', 'RPE 6', 60, 45, 'Step-overs', 'Saltos pequeños, muñecas relajadas'),
('Ski Erg (moderate)', 'Principiante', 'Monostructural', 'Cardio', 'Ski Erg', 'For Time', 'RPE 6', 300, 120, 'Reducir distancia', 'Patrón de pull, core estable'),
('Walking Lunges', 'Principiante', 'Monostructural', 'Cardio/Legs', 'Ninguno', 'For Time', 'RPE 6', 60, 45, 'Stationary lunges', 'Rodilla trasera casi al suelo'),
('Box Step-Ups (cardio)', 'Principiante', 'Monostructural', 'Cardio', 'Box', 'AMRAP', 'RPE 6', 60, 45, 'Box más baja', 'Ritmo constante, alternando piernas');

-- ACCESORIOS - PRINCIPIANTE (7 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Hollow Hold', 'Principiante', 'Accesorios', 'Core', 'Ninguno', 'EMOM', 'RPE 8', 30, 90, 'Knees bent', 'Posición gimnástica fundamental'),
('Superman Hold', 'Principiante', 'Accesorios', 'Core', 'Ninguno', 'EMOM', 'RPE 7', 30, 90, 'Brazos al lado', 'Fortalece cadena posterior'),
('Glute Bridges', 'Principiante', 'Accesorios', 'Glutes', 'Ninguno', 'EMOM', 'RPE 6', 30, 60, 'Reducir reps', 'Activación de glúteos'),
('Band Pull-Aparts', 'Principiante', 'Accesorios', 'Shoulders', 'Banda', 'EMOM', 'RPE 6', 30, 45, 'Banda más ligera', 'Salud de hombros, retracción escapular'),
('Dead Hang', 'Principiante', 'Accesorios', 'Grip', 'Pull-up Bar', 'EMOM', 'RPE 7', 30, 90, 'Pies en box', 'Desarrollo de grip y movilidad de hombros'),
('Banded Good Mornings', 'Principiante', 'Accesorios', 'Hip Hinge', 'Banda', 'EMOM', 'RPE 6', 30, 60, 'Sin banda', 'Enseña patrón de bisagra'),
('Scapular Pull-Ups', 'Principiante', 'Accesorios', 'Pull', 'Pull-up Bar', 'EMOM', 'RPE 7', 30, 90, 'Band assisted', 'Activación de dorsales y escápula');

-- ===========================================================================
-- NIVEL: INTERMEDIO (RX) - 40 ejercicios
-- ===========================================================================

-- GYMNASTIC - INTERMEDIO (12 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Pull-Ups (strict)', 'Intermedio', 'Gymnastic', 'Pull', 'Pull-up Bar', 'AMRAP', 'RPE 8', 30, 90, 'Band assisted', 'Kipping permitido en WODs, strict para fuerza'),
('Chest-to-Bar Pull-Ups', 'Intermedio', 'Gymnastic', 'Pull', 'Pull-up Bar', 'For Time', 'RPE 8', 30, 90, 'Regular pull-ups', 'Pecho toca barra, explosivo'),
('Hand-Release Push-Ups', 'Intermedio', 'Gymnastic', 'Push', 'Ninguno', 'AMRAP', 'RPE 7', 30, 60, 'Regular push-ups', 'Pecho al suelo, manos despegan'),
('Box Jumps (24"/20")', 'Intermedio', 'Gymnastic', 'Legs', 'Box 24-20"', 'For Time', 'RPE 7', 30, 60, 'Box más baja', 'Extensión completa de cadera arriba'),
('Burpees (RX)', 'Intermedio', 'Gymnastic', 'Full Body', 'Ninguno', 'For Time', 'RPE 8', 30, 45, 'Step-back', 'Pecho al suelo, salto con clap arriba'),
('Toes-to-Bar', 'Intermedio', 'Gymnastic', 'Core', 'Pull-up Bar', 'AMRAP', 'RPE 8', 30, 90, 'Knees-to-elbows', 'Kipping hollow-arch, dedos tocan barra'),
('Dips (ring/paralelas)', 'Intermedio', 'Gymnastic', 'Push', 'Rings/Paralelas', 'EMOM', 'RPE 8', 30, 90, 'Band assisted', 'Shoulders abajo de codos, lockout completo'),
('Pistol Squats', 'Intermedio', 'Gymnastic', 'Legs', 'Ninguno', 'EMOM', 'RPE 8', 30, 90, 'Box pistols', 'Unilateral, balance y fuerza'),
('V-Ups', 'Intermedio', 'Gymnastic', 'Core', 'Ninguno', 'AMRAP', 'RPE 7', 30, 45, 'Sit-ups', 'Manos y pies se juntan arriba'),
('Handstand Hold (wall)', 'Intermedio', 'Gymnastic', 'Press', 'Pared', 'EMOM', 'RPE 8', 60, 120, 'Pike position', 'Desarrollo de fuerza overhead y balance'),
('Knees-to-Elbows', 'Intermedio', 'Gymnastic', 'Core', 'Pull-up Bar', 'AMRAP', 'RPE 7', 30, 60, 'Hanging knee raises', 'Progresión a toes-to-bar'),
('Burpee Box Jump-Overs', 'Intermedio', 'Gymnastic', 'Full Body', 'Box', 'For Time', 'RPE 8', 30, 60, 'Step-overs', 'Saltar sobre box, no subir');

-- WEIGHTLIFTING - INTERMEDIO (14 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Thrusters (95/65 lbs)', 'Intermedio', 'Weightlifting', 'Full Body', 'Barra', 'For Time', '60-70% 1RM', 30, 90, 'Peso reducido', 'Front squat + push press en un movimiento'),
('Power Cleans', 'Intermedio', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '65-75% 1RM', 30, 120, 'Hang power clean', 'Recepción en partial squat, explosivo'),
('Hang Power Snatches', 'Intermedio', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '60-70% 1RM', 30, 120, 'PVC', 'Desde encima de rodillas, ancho de agarre snatch'),
('Deadlifts (225/155 lbs)', 'Intermedio', 'Weightlifting', 'Pull', 'Barra', 'Strength', '70-80% 1RM', 30, 180, 'Peso reducido', 'Setup perfecto, neutral spine'),
('Overhead Squats', 'Intermedio', 'Weightlifting', 'Squat', 'Barra', 'Strength', '50-60% 1RM', 30, 120, 'PVC', 'Movilidad extrema, balance overhead'),
('Sumo Deadlift High Pulls (75/55 lbs)', 'Intermedio', 'Weightlifting', 'Pull', 'Barra', 'AMRAP', '50-60% 1RM', 30, 60, 'Peso reducido', 'Stance ancho, codos altos y afuera'),
('Wall Balls (20/14 lbs)', 'Intermedio', 'Weightlifting', 'Full Body', 'Med Ball', 'AMRAP', 'RPE 8', 30, 45, 'Peso ligero', '10ft target, squat profundo'),
('Kettlebell Swings (American, 53/35 lbs)', 'Intermedio', 'Weightlifting', 'Hip Hinge', 'Kettlebell', 'AMRAP', 'RPE 7', 30, 60, 'Russian swings', 'Overhead completo, explosivo'),
('Dumbbell Snatches', 'Intermedio', 'Weightlifting', 'Olympic', 'Mancuerna', 'For Time', 'RPE 7', 30, 60, 'Peso ligero', 'Unilateral, desde suelo a overhead'),
('Clean & Jerks', 'Intermedio', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '65-75% 1RM', 30, 150, 'Power clean + push press', 'Movimiento completo olímpico'),
('Front Squats (135/95 lbs)', 'Intermedio', 'Weightlifting', 'Squat', 'Barra', 'Strength', '65-75% 1RM', 30, 120, 'Peso reducido', 'Torso vertical, codos altos'),
('Push Jerks', 'Intermedio', 'Weightlifting', 'Press', 'Barra', 'EMOM', '70-80% 1RM', 30, 120, 'Push press', 'Dip-drive-split, lockout overhead'),
('Back Squats (185/135 lbs)', 'Intermedio', 'Weightlifting', 'Squat', 'Barra', 'Strength', '70-80% 1RM', 30, 150, 'Peso reducido', 'Profundidad completa, barra alta o baja'),
('Hang Squat Cleans', 'Intermedio', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '65-75% 1RM', 30, 120, 'Hang power clean', 'Desde rodillas, recepción en squat profundo');

-- MONOSTRUCTURAL - INTERMEDIO (8 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Rowing (moderate pace, 500m)', 'Intermedio', 'Monostructural', 'Cardio', 'Rower', 'For Time', 'RPE 7-8', 120, 90, 'Distancia reducida', 'Split <2:00/500m, técnica consistente'),
('Assault Bike (20/15 cal)', 'Intermedio', 'Monostructural', 'Cardio', 'Assault Bike', 'For Time', 'RPE 8', 60, 90, 'Calorías reducidas', 'All-out effort, brazos y piernas'),
('Running (400m-800m)', 'Intermedio', 'Monostructural', 'Cardio', 'Ninguno', 'For Time', 'RPE 7-8', 180, 120, 'Distancia reducida', 'Pace de 7-9 min/mi'),
('Double-Unders', 'Intermedio', 'Monostructural', 'Cardio', 'Jump Rope', 'AMRAP', 'RPE 7', 60, 45, 'Singles', 'Cuerda pasa 2 veces bajo pies por salto'),
('Ski Erg (500m)', 'Intermedio', 'Monostructural', 'Cardio', 'Ski Erg', 'For Time', 'RPE 7-8', 120, 90, 'Distancia reducida', 'Pull explosivo, core engagement'),
('Burpee Broad Jumps', 'Intermedio', 'Monostructural', 'Cardio', 'Ninguno', 'For Time', 'RPE 8', 30, 60, 'Regular burpees', 'Salto horizontal después de burpee'),
('Box Step-Ups (rapid, 24/20")', 'Intermedio', 'Monostructural', 'Cardio', 'Box', 'AMRAP', 'RPE 7', 45, 45, 'Box más baja', 'Ritmo rápido, volumen alto'),
('Shuttle Runs (25ft)', 'Intermedio', 'Monostructural', 'Cardio', 'Ninguno', 'For Time', 'RPE 7', 30, 45, 'Sprints cortos', 'Cambio de dirección explosivo');

-- ACCESORIOS - INTERMEDIO (6 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('GHD Sit-Ups', 'Intermedio', 'Accesorios', 'Core', 'GHD', 'AMRAP', 'RPE 7', 30, 60, 'AbMat sit-ups', 'Full range, control en bajada'),
('Hollow Rocks', 'Intermedio', 'Accesorios', 'Core', 'Ninguno', 'AMRAP', 'RPE 7', 45, 60, 'Hollow hold', 'Rock manteniendo hollow position'),
('Hip Extensions (GHD)', 'Intermedio', 'Accesorios', 'Posterior', 'GHD', 'EMOM', 'RPE 7', 30, 90, 'Superman', 'Isquios y glúteos, control'),
('Ring Support Hold', 'Intermedio', 'Accesorios', 'Push', 'Rings', 'EMOM', 'RPE 8', 60, 120, 'Paralelas', 'Anillas estables, lockout completo'),
('Farmers Carry (heavy)', 'Intermedio', 'Accesorios', 'Grip', 'KB/DBs', 'For Time', 'RPE 8', 60, 90, 'Peso reducido', 'Postura erguida, grip challenge'),
('Turkish Get-Ups', 'Intermedio', 'Accesorios', 'Full Body', 'KB/DB', 'EMOM', 'RPE 7', 60, 120, 'Peso ligero', 'Movimiento complejo, coordinación');

-- ===========================================================================
-- NIVEL: AVANZADO (RX+) - 30 ejercicios
-- ===========================================================================

-- GYMNASTIC - AVANZADO (10 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Bar Muscle-Ups', 'Avanzado', 'Gymnastic', 'Pull/Push', 'Pull-up Bar', 'For Time', 'RPE 9', 30, 120, 'C2B + dips', 'Transición explosiva, kipping eficiente'),
('Ring Muscle-Ups', 'Avanzado', 'Gymnastic', 'Pull/Push', 'Rings', 'For Time', 'RPE 9', 30, 120, 'Bar muscle-ups', 'Técnica de anillas, false grip'),
('Handstand Push-Ups', 'Avanzado', 'Gymnastic', 'Press', 'Pared', 'AMRAP', 'RPE 8', 30, 90, 'HSPU con abmat', 'Cabeza al suelo, lockout completo'),
('Handstand Walk', 'Avanzado', 'Gymnastic', 'Balance', 'Ninguno', 'For Distance', 'RPE 8', 60, 120, 'Wall walks', 'Balance, control de hombros'),
('Rope Climbs (15ft)', 'Avanzado', 'Gymnastic', 'Pull', 'Rope', 'For Time', 'RPE 8', 30, 90, 'Legless, short rope', 'Técnica J-hook o S-wrap'),
('Deficit HSPU (4")', 'Avanzado', 'Gymnastic', 'Press', 'Paraletas/Abmat', 'EMOM', 'RPE 9', 30, 120, 'Regular HSPU', 'Mayor rango de movimiento'),
('Strict Muscle-Ups', 'Avanzado', 'Gymnastic', 'Pull/Push', 'Rings', 'EMOM', 'RPE 9', 30, 150, 'Strict pull-up + dip', 'Sin kip, fuerza pura'),
('Pistol Squats (weighted)', 'Avanzado', 'Gymnastic', 'Legs', 'KB/DB', 'EMOM', 'RPE 8', 30, 90, 'BW pistols', 'Carga externa, balance'),
('L-Sit (rings/paralelas)', 'Avanzado', 'Gymnastic', 'Core', 'Rings/Paralelas', 'EMOM', 'RPE 9', 60, 120, 'Tuck hold', 'Piernas paralelas al suelo'),
('Burpee Bar Muscle-Ups', 'Avanzado', 'Gymnastic', 'Full Body', 'Pull-up Bar', 'For Time', 'RPE 9', 30, 90, 'Burpee + C2B', 'Combinación ultra-demandante');

-- WEIGHTLIFTING - AVANZADO (12 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Snatches (full, 135/95 lbs)', 'Avanzado', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '75-85% 1RM', 30, 150, 'Hang snatch', 'Desde suelo, recepción profunda en squat'),
('Squat Snatches (heavy)', 'Avanzado', 'Weightlifting', 'Olympic', 'Barra', 'Strength', '80-90% 1RM', 30, 180, 'Power snatch', 'Full depth reception, movilidad total'),
('Squat Cleans (heavy, 185/135 lbs)', 'Avanzado', 'Weightlifting', 'Olympic', 'Barra', 'For Time', '75-85% 1RM', 30, 120, 'Power clean', 'Catch deep, stand up aggressively'),
('Thrusters (heavy, 135/95 lbs)', 'Avanzado', 'Weightlifting', 'Full Body', 'Barra', 'For Time', '75-85% 1RM', 30, 90, 'Peso moderado', 'Sin pausa entre squat y press'),
('Overhead Squats (heavy)', 'Avanzado', 'Weightlifting', 'Squat', 'Barra', 'Strength', '70-80% 1RM', 30, 150, 'Peso moderado', 'Movilidad extrema, fuerza overhead'),
('Clean & Jerks (heavy, 185/135 lbs)', 'Avanzado', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '80-90% 1RM', 30, 180, 'Power clean + push press', 'Movimiento completo competitivo'),
('Devil Press (heavy, 50/35 lbs DBs)', 'Avanzado', 'Weightlifting', 'Full Body', 'Mancuernas', 'For Time', 'RPE 9', 30, 60, 'Peso reducido', 'Burpee + dual DB snatch overhead'),
('Cluster (135/95 lbs)', 'Avanzado', 'Weightlifting', 'Full Body', 'Barra', 'For Time', '70-80% 1RM', 30, 90, 'Thruster', 'Squat clean + thruster en un movimiento'),
('Overhead Walking Lunges (heavy)', 'Avanzado', 'Weightlifting', 'Legs', 'Barra/Plato', 'For Distance', 'RPE 8', 60, 90, 'Peso reducido', 'Overhead stability, unilateral strength'),
('Deadlifts (heavy, 315/225 lbs)', 'Avanzado', 'Weightlifting', 'Pull', 'Barra', 'Strength', '85-95% 1RM', 30, 240, 'Peso moderado', 'Max effort, técnica perfecta'),
('Hang Squat Snatches', 'Avanzado', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '70-80% 1RM', 30, 120, 'Hang power snatch', 'Desde rodillas, catch profundo'),
('Split Jerks (heavy)', 'Avanzado', 'Weightlifting', 'Press', 'Barra', 'EMOM', '80-90% 1RM', 30, 150, 'Push jerk', 'Split footwork, lockout overhead');

-- MONOSTRUCTURAL - AVANZADO (5 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Rowing (fast pace, 1000m)', 'Avanzado', 'Monostructural', 'Cardio', 'Rower', 'For Time', 'RPE 8-9', 240, 120, 'Distancia reducida', 'Split <1:50/500m, max effort'),
('Assault Bike (50/35 cal)', 'Avanzado', 'Monostructural', 'Cardio', 'Assault Bike', 'For Time', 'RPE 9', 180, 120, 'Calorías reducidas', 'All-out intensity'),
('Running (1 mile)', 'Avanzado', 'Monostructural', 'Cardio', 'Ninguno', 'For Time', 'RPE 8', 420, 180, '800m', 'Sub-7 min mile pace'),
('Triple-Unders', 'Avanzado', 'Monostructural', 'Cardio', 'Jump Rope', 'AMRAP', 'RPE 8', 60, 60, 'Double-unders', 'Cuerda pasa 3 veces por salto'),
('Ski Erg (1000m)', 'Avanzado', 'Monostructural', 'Cardio', 'Ski Erg', 'For Time', 'RPE 8-9', 240, 120, 'Distancia reducida', 'Max pull, explosive');

-- ACCESORIOS - AVANZADO (3 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Strict Toes-to-Bar', 'Avanzado', 'Accesorios', 'Core', 'Pull-up Bar', 'EMOM', 'RPE 9', 30, 120, 'Toes-to-bar kipping', 'Sin swing, core strength puro'),
('Weighted Pistol Squats (heavy)', 'Avanzado', 'Accesorios', 'Legs', 'KB/DB heavy', 'EMOM', 'RPE 9', 30, 120, 'BW pistols', 'Carga significativa, balance'),
('Ring Dips (weighted)', 'Avanzado', 'Accesorios', 'Push', 'Rings + Weight', 'EMOM', 'RPE 9', 30, 120, 'BW ring dips', 'Estabilidad extrema');

-- ===========================================================================
-- NIVEL: ELITE (COMPETITIVO) - 20 ejercicios
-- ===========================================================================

-- GYMNASTIC - ELITE (7 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Freestanding HSPU', 'Elite', 'Gymnastic', 'Press', 'Ninguno', 'EMOM', 'RPE 10', 30, 150, 'Wall HSPU', 'Sin soporte de pared, balance total'),
('Legless Rope Climbs', 'Elite', 'Gymnastic', 'Pull', 'Rope', 'For Time', 'RPE 9', 30, 120, 'Regular rope climbs', 'Solo brazos, fuerza grip extrema'),
('Ring Handstand Push-Ups', 'Elite', 'Gymnastic', 'Press', 'Rings', 'EMOM', 'RPE 10', 30, 180, 'Strict HSPU', 'Anillas inestables, control total'),
('Pegboard Climb', 'Elite', 'Gymnastic', 'Pull', 'Pegboard', 'For Time', 'RPE 9', 30, 120, 'Rope climb', 'Movimiento vertical con clavijas'),
('Bar Muscle-Ups (strict)', 'Elite', 'Gymnastic', 'Pull/Push', 'Pull-up Bar', 'EMOM', 'RPE 10', 30, 150, 'Kipping muscle-ups', 'Sin momentum, fuerza pura'),
('Handstand Walk (50ft unbroken)', 'Elite', 'Gymnastic', 'Balance', 'Ninguno', 'For Time', 'RPE 9', 60, 120, 'Distancia reducida', 'Velocidad + control'),
('Bar Muscle-Up to L-Sit', 'Elite', 'Gymnastic', 'Full Body', 'Pull-up Bar', 'EMOM', 'RPE 10', 30, 180, 'Bar muscle-up', 'Combinación élite');

-- WEIGHTLIFTING - ELITE (8 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Snatches (competition, 185/135 lbs)', 'Elite', 'Weightlifting', 'Olympic', 'Barra', 'For Time', '85-95% 1RM', 30, 180, 'Peso reducido', 'Peso competitivo, técnica perfecta'),
('Clean & Jerks (competition, 245/185 lbs)', 'Elite', 'Weightlifting', 'Olympic', 'Barra', 'For Time', '85-95% 1RM', 30, 240, 'Peso reducido', 'Peso competitivo CrossFit Games'),
('Overhead Squats (heavy, 185/135 lbs)', 'Elite', 'Weightlifting', 'Squat', 'Barra', 'For Time', '80-90% 1RM', 30, 120, 'Peso moderado', 'Alta carga, movilidad élite'),
('Thrusters (competition, 185/135 lbs)', 'Elite', 'Weightlifting', 'Full Body', 'Barra', 'For Time', '85-95% 1RM', 30, 90, 'Peso moderado', 'Fran weight, Games standard'),
('Deadlifts (max effort, 400+/300+ lbs)', 'Elite', 'Weightlifting', 'Pull', 'Barra', 'Strength', '95-100% 1RM', 30, 300, 'Peso reducido', 'Max lift, competitivo'),
('Snatch Balance (heavy)', 'Elite', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '80-90% Snatch', 30, 150, 'Peso moderado', 'Speed under bar, confidence'),
('Complex: Squat Clean + Front Squat + Jerk', 'Elite', 'Weightlifting', 'Olympic', 'Barra', 'EMOM', '75-85% 1RM', 60, 180, 'Simplificar complejo', 'Secuencia sin soltar barra'),
('Power Snatches (touch-and-go, 135/95 lbs)', 'Elite', 'Weightlifting', 'Olympic', 'Barra', 'AMRAP', '70-80% 1RM', 30, 90, 'Singles', 'Sin soltar barra, cycling rápido');

-- MONOSTRUCTURAL - ELITE (3 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Rowing (elite pace, 2000m)', 'Elite', 'Monostructural', 'Cardio', 'Rower', 'For Time', 'RPE 10', 480, 240, 'Distancia reducida', 'Sub-7:00 para hombres, sub-8:00 mujeres'),
('Running (5K)', 'Elite', 'Monostructural', 'Cardio', 'Ninguno', 'For Time', 'RPE 9', 1500, 300, '1 mile', 'Sub-20 min 5K, endurance élite'),
('Assault Bike (100 cal)', 'Elite', 'Monostructural', 'Cardio', 'Assault Bike', 'For Time', 'RPE 10', 420, 180, 'Calorías reducidas', 'Max output, Games standard');

-- ACCESORIOS - ELITE (2 ejercicios)
INSERT INTO app."Ejercicios_CrossFit" (nombre, nivel, dominio, categoria, equipamiento, tipo_wod, intensidad, duracion_seg, descanso_seg, escalamiento, notas) VALUES
('Worm (team lift)', 'Elite', 'Accesorios', 'Team', 'Worm', 'For Time', 'RPE 10', 60, 180, 'Team log', 'Implemento Games, coordinación equipo'),
('Pig Flips', 'Elite', 'Accesorios', 'Strength', 'Pig', 'For Distance', 'RPE 10', 60, 120, 'Tire flips', 'Implemento pesado, explosivo');

-- ===========================================================================
-- VERIFICACIÓN FINAL
-- ===========================================================================

-- Contar ejercicios por nivel
SELECT nivel, COUNT(*) as total_ejercicios
FROM app."Ejercicios_CrossFit"
GROUP BY nivel
ORDER BY
  CASE nivel
    WHEN 'Principiante' THEN 1
    WHEN 'Intermedio' THEN 2
    WHEN 'Avanzado' THEN 3
    WHEN 'Elite' THEN 4
  END;

-- Contar por dominio
SELECT dominio, COUNT(*) as total
FROM app."Ejercicios_CrossFit"
GROUP BY dominio
ORDER BY total DESC;

-- Contar por tipo de WOD
SELECT tipo_wod, COUNT(*) as total
FROM app."Ejercicios_CrossFit"
GROUP BY tipo_wod
ORDER BY total DESC;

-- Total general
SELECT COUNT(*) as total_ejercicios_crossfit
FROM app."Ejercicios_CrossFit";

-- ===========================================================================
-- RESULTADO ESPERADO: ~120 ejercicios
-- Principiante (Scaled): 30
-- Intermedio (RX): 40
-- Avanzado (RX+): 30
-- Elite: 20
-- ===========================================================================
