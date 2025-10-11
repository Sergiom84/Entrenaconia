-- =====================================================================
-- TABLA DE EJERCICIOS: ENTRENAMIENTO EN CASA
-- =====================================================================
-- Metodología centrada en maximizar resultados con equipamiento mínimo
-- Adaptado a cualquier espacio y horario del hogar
-- Total: 65 ejercicios (20 Principiante + 22 Intermedio + 23 Avanzado)
-- =====================================================================

BEGIN;

-- Eliminar tabla si existe (para desarrollo/testing)
DROP TABLE IF EXISTS app."Ejercicios_Casa" CASCADE;

-- Crear tabla con estructura estandarizada
CREATE TABLE app."Ejercicios_Casa" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('Principiante', 'Intermedio', 'Avanzado')),
  categoria VARCHAR(100) NOT NULL CHECK (categoria IN ('Funcional', 'HIIT', 'Fuerza', 'Cardio', 'Movilidad')),
  patron VARCHAR(255) NOT NULL,
  equipamiento TEXT[] NOT NULL,
  series_reps_objetivo VARCHAR(100),
  descanso_seg INTEGER,
  tempo VARCHAR(50),
  criterio_de_progreso TEXT,
  progresion_desde VARCHAR(255),
  progresion_hacia VARCHAR(255),
  notas TEXT,
  gif_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Función trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_ejercicios_casa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ejercicios_casa_timestamp
BEFORE UPDATE ON app."Ejercicios_Casa"
FOR EACH ROW
EXECUTE FUNCTION update_ejercicios_casa_timestamp();

-- =====================================================================
-- EJERCICIOS NIVEL PRINCIPIANTE (20 ejercicios)
-- Énfasis: Movimientos básicos con peso corporal y objetos domésticos
-- =====================================================================

INSERT INTO app."Ejercicios_Casa" (nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, notas) VALUES
-- FUNCIONAL - PRINCIPIANTE (4)
('Sentadillas Asistidas con Silla', 'sentadillas-asistidas-silla', 'Principiante', 'Funcional', 'Sentadilla', ARRAY['Silla', 'Peso corporal'], '3 x 10-12', 60, '2-0-2-0', 'Usa la silla como apoyo ligero para mantener el equilibrio. Enfócate en la técnica correcta.'),
('Flexiones Inclinadas en Silla', 'flexiones-inclinadas-silla', 'Principiante', 'Funcional', 'Empuje horizontal', ARRAY['Silla', 'Peso corporal'], '3 x 8-10', 60, '2-0-2-0', 'Manos en el asiento de la silla, cuerpo recto. Controla el descenso y empuja explosivamente.'),
('Elevaciones de Pantorrilla en Escalón', 'elevaciones-pantorrilla-escalon', 'Principiante', 'Funcional', 'Extensión tobillo', ARRAY['Escalón', 'Pared'], '3 x 15-20', 45, '2-1-2-0', 'Usa la pared para equilibrio. Sube completamente en puntillas y baja con control.'),
('Zancadas Estáticas', 'zancadas-estaticas', 'Principiante', 'Funcional', 'Zancada', ARRAY['Peso corporal'], '3 x 8-10/pierna', 60, '2-0-2-0', 'Mantén el torso erguido, rodilla delantera alineada con el tobillo. No permitas que la rodilla trasera toque el suelo bruscamente.'),

-- FUERZA - PRINCIPIANTE (5)
('Plancha sobre Rodillas', 'plancha-rodillas', 'Principiante', 'Fuerza', 'Core isométrico', ARRAY['Esterilla', 'Peso corporal'], '3 x 20-30s', 45, 'Isométrico', 'Codos bajo los hombros, cuerpo recto desde rodillas hasta cabeza. Contrae el core activamente.'),
('Puente de Glúteo', 'puente-gluteo', 'Principiante', 'Fuerza', 'Extensión cadera', ARRAY['Esterilla', 'Peso corporal'], '3 x 12-15', 45, '2-1-2-0', 'Aprieta glúteos en la parte superior del movimiento. No arquees excesivamente la espalda baja.'),
('Superman Hold', 'superman-hold', 'Principiante', 'Fuerza', 'Extensión espalda', ARRAY['Esterilla', 'Peso corporal'], '3 x 15-20s', 30, 'Isométrico', 'Eleva simultáneamente brazos y piernas. Mantén el cuello neutro mirando al suelo.'),
('Bird Dog', 'bird-dog', 'Principiante', 'Fuerza', 'Estabilización core', ARRAY['Esterilla', 'Peso corporal'], '3 x 8-10/lado', 30, '2-1-2-0', 'Extiende brazo y pierna opuestos manteniendo la espalda estable. Enfócate en no rotar la cadera.'),
('Curl de Bíceps con Toalla', 'curl-biceps-toalla', 'Principiante', 'Fuerza', 'Flexión codo', ARRAY['Toalla', 'Peso corporal'], '3 x 10-12', 45, '2-0-2-0', 'Pisa el centro de la toalla y tira de los extremos hacia arriba. Controla el movimiento.'),

-- CARDIO - PRINCIPIANTE (4)
('Marcha en el Sitio', 'marcha-sitio', 'Principiante', 'Cardio', 'Cardio bajo impacto', ARRAY['Peso corporal'], '3 x 30-45s', 30, 'Rítmico', 'Eleva las rodillas a 90 grados. Balancea los brazos de forma coordinada.'),
('Jumping Jacks Modificados', 'jumping-jacks-modificados', 'Principiante', 'Cardio', 'Cardio coordinación', ARRAY['Peso corporal'], '3 x 20-30s', 30, 'Rítmico', 'Versión sin salto: abre una pierna lateralmente alternando. Brazos arriba y abajo coordinados.'),
('Escaladores Lentos', 'escaladores-lentos', 'Principiante', 'Cardio', 'Cardio + Core', ARRAY['Peso corporal'], '3 x 20-30s', 30, 'Controlado', 'Desde posición de plancha, lleva rodilla hacia el pecho alternando. Mantén caderas bajas.'),
('High Knees Moderados', 'high-knees-moderados', 'Principiante', 'Cardio', 'Cardio alta rodilla', ARRAY['Peso corporal'], '3 x 20-30s', 30, 'Rítmico', 'Eleva rodillas alternadamente lo más alto posible. Mantén el torso erguido.'),

-- HIIT - PRINCIPIANTE (4)
('Sentadilla + Elevación de Brazos', 'sentadilla-elevacion-brazos', 'Principiante', 'HIIT', 'Combinado inferior+hombros', ARRAY['Peso corporal'], '4 x 30s trabajo / 30s descanso', 30, 'Explosivo', 'Sentadilla profunda y al subir eleva brazos por encima de la cabeza. Ritmo constante.'),
('Plancha con Toque de Hombro', 'plancha-toque-hombro', 'Principiante', 'HIIT', 'Core dinámico', ARRAY['Peso corporal'], '4 x 20s trabajo / 40s descanso', 40, 'Controlado', 'Desde plancha alta, toca hombro opuesto alternando. Minimiza la rotación de cadera.'),
('Desplazamientos Laterales', 'desplazamientos-laterales', 'Principiante', 'HIIT', 'Agilidad lateral', ARRAY['Peso corporal'], '4 x 30s trabajo / 30s descanso', 30, 'Rápido', 'Deslízate lateralmente 3-4 pasos en cada dirección. Mantén postura atlética baja.'),
('Inchworm Simplificado', 'inchworm-simplificado', 'Principiante', 'HIIT', 'Movilidad + Core', ARRAY['Peso corporal'], '4 x 20s trabajo / 40s descanso', 40, 'Controlado', 'De pie, baja manos al suelo y camina con ellas hacia plancha. Camina de vuelta y levántate.'),

-- MOVILIDAD - PRINCIPIANTE (3)
('Estiramiento de Isquiotibiales Sentado', 'estiramiento-isquios-sentado', 'Principiante', 'Movilidad', 'Flexión cadera', ARRAY['Esterilla'], '3 x 30s/pierna', 15, 'Suave', 'Sentado con una pierna extendida, inclínate hacia adelante manteniendo la espalda recta.'),
('Cat-Cow (Gato-Vaca)', 'cat-cow', 'Principiante', 'Movilidad', 'Movilidad columna', ARRAY['Esterilla'], '3 x 8-10', 15, '2-1-2-1', 'Alterna entre arquear y redondear la espalda de forma controlada. Respira profundamente.'),
('Rotaciones de Cadera en Suelo', 'rotaciones-cadera-suelo', 'Principiante', 'Movilidad', 'Rotación cadera', ARRAY['Esterilla'], '3 x 6-8/lado', 15, 'Suave', 'Tumbado boca arriba, rodillas flexionadas, deja caer ambas rodillas a un lado suavemente.');

-- =====================================================================
-- EJERCICIOS NIVEL INTERMEDIO (22 ejercicios)
-- Énfasis: Bandas elásticas, mancuernas ligeras, mayor complejidad
-- =====================================================================

INSERT INTO app."Ejercicios_Casa" (nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, notas) VALUES
-- FUNCIONAL - INTERMEDIO (5)
('Sentadillas Búlgaras con Silla', 'sentadillas-bulgaras-silla', 'Intermedio', 'Funcional', 'Sentadilla unilateral', ARRAY['Silla'], '4 x 8-10/pierna', 60, '2-0-2-0', 'Pie trasero elevado en silla, baja hasta que la rodilla delantera forme 90 grados.'),
('Flexiones Completas', 'flexiones-completas', 'Intermedio', 'Funcional', 'Empuje horizontal', ARRAY['Peso corporal'], '4 x 10-15', 60, '2-0-2-0', 'Cuerpo completamente recto, baja hasta el pecho casi toque el suelo. Codos a 45 grados.'),
('Remo Invertido con Toalla/Mesa', 'remo-invertido-toalla', 'Intermedio', 'Funcional', 'Tracción horizontal', ARRAY['Toalla', 'Mesa'], '4 x 8-12', 60, '2-0-2-0', 'Túmbate bajo una mesa robusta, agarra el borde y tira tu cuerpo hacia arriba manteniendo el cuerpo recto.'),
('Lunges Caminando', 'lunges-caminando', 'Intermedio', 'Funcional', 'Zancada dinámica', ARRAY['Peso corporal'], '4 x 10-12/pierna', 60, '2-0-2-0', 'Zancadas alternadas avanzando. Torso erguido, rodilla trasera cerca del suelo sin tocar.'),
('Press de Hombros con Banda', 'press-hombros-banda', 'Intermedio', 'Funcional', 'Empuje vertical', ARRAY['Banda elástica'], '4 x 10-12', 60, '2-0-2-0', 'Pisa la banda y empuja hacia arriba por encima de la cabeza. Control total del movimiento.'),

-- FUERZA - INTERMEDIO (5)
('Plancha Completa', 'plancha-completa', 'Intermedio', 'Fuerza', 'Core isométrico', ARRAY['Peso corporal'], '4 x 30-45s', 45, 'Isométrico', 'Codos bajo los hombros, piernas extendidas. Cuerpo recto como una tabla, core contraído.'),
('Hip Thrust con Banda', 'hip-thrust-banda', 'Intermedio', 'Fuerza', 'Extensión cadera', ARRAY['Banda elástica', 'Silla'], '4 x 12-15', 60, '2-1-2-0', 'Espalda apoyada en silla, banda sobre las caderas. Empuja cadera hacia arriba apretando glúteos.'),
('Curl de Bíceps con Mancuernas', 'curl-biceps-mancuernas', 'Intermedio', 'Fuerza', 'Flexión codo', ARRAY['Mancuernas'], '4 x 10-12', 45, '2-0-2-0', 'Codos pegados al cuerpo, sube las mancuernas con control completo.'),
('Press de Pecho con Mancuernas en Suelo', 'press-pecho-mancuernas-suelo', 'Intermedio', 'Fuerza', 'Empuje horizontal', ARRAY['Mancuernas', 'Esterilla'], '4 x 10-12', 60, '2-0-2-0', 'Tumbado, baja las mancuernas hasta que los codos toquen el suelo. Empuja hacia arriba.'),
('Abdominales Bicicleta', 'abdominales-bicicleta', 'Intermedio', 'Fuerza', 'Core dinámico', ARRAY['Esterilla'], '4 x 15-20/lado', 30, 'Controlado', 'Alterna codo con rodilla opuesta. Enfoque en la rotación del torso, no en velocidad.'),

-- CARDIO - INTERMEDIO (4)
('Burpees Modificados (sin salto)', 'burpees-modificados', 'Intermedio', 'Cardio', 'Full body cardio', ARRAY['Peso corporal'], '4 x 40s trabajo / 20s descanso', 20, 'Rápido', 'Baja a plancha, flexión, lleva pies hacia manos y levántate. Omite el salto final.'),
('Jumping Jacks', 'jumping-jacks', 'Intermedio', 'Cardio', 'Cardio coordinación', ARRAY['Peso corporal'], '4 x 45s trabajo / 15s descanso', 15, 'Rítmico', 'Salta abriendo piernas y brazos arriba simultáneamente. Ritmo constante y sostenido.'),
('Mountain Climbers', 'mountain-climbers', 'Intermedio', 'Cardio', 'Cardio + Core', ARRAY['Peso corporal'], '4 x 30s trabajo / 30s descanso', 30, 'Rápido', 'Desde plancha, alterna rodillas hacia el pecho rápidamente. Mantén caderas estables.'),
('Skaters (Patinador)', 'skaters', 'Intermedio', 'Cardio', 'Agilidad lateral', ARRAY['Peso corporal'], '4 x 40s trabajo / 20s descanso', 20, 'Explosivo', 'Salta lateralmente de una pierna a otra, llevando la pierna trasera detrás. Aterriza suave.'),

-- HIIT - INTERMEDIO (5)
('Sentadilla con Salto', 'sentadilla-salto', 'Intermedio', 'HIIT', 'Potencia inferior', ARRAY['Peso corporal'], '5 x 30s trabajo / 30s descanso', 30, 'Explosivo', 'Sentadilla profunda y explota hacia arriba con salto. Aterriza suave y absorbe el impacto.'),
('Fondos en Silla', 'fondos-silla', 'Intermedio', 'HIIT', 'Empuje tríceps', ARRAY['Silla'], '5 x 20s trabajo / 40s descanso', 40, '2-0-2-0', 'Manos en el borde de la silla detrás de ti, baja flexionando codos. Empuja hacia arriba.'),
('Plancha con Salto de Pies (Plank Jacks)', 'plancha-salto-pies', 'Intermedio', 'HIIT', 'Core cardio', ARRAY['Peso corporal'], '5 x 30s trabajo / 30s descanso', 30, 'Rápido', 'Desde plancha, salta abriendo y cerrando las piernas. Mantén core estable.'),
('Reverse Lunge con Rodilla Alta', 'reverse-lunge-rodilla-alta', 'Intermedio', 'HIIT', 'Piernas dinámico', ARRAY['Peso corporal'], '5 x 30s trabajo / 30s descanso', 30, 'Controlado-explosivo', 'Zancada hacia atrás y al subir eleva rodilla delantera explosivamente. Alterna piernas.'),
('Push-up to T (Flexión + Rotación)', 'pushup-to-t', 'Intermedio', 'HIIT', 'Empuje + Core', ARRAY['Peso corporal'], '5 x 20s trabajo / 40s descanso', 40, 'Controlado', 'Flexión completa y al subir rota el cuerpo abriendo un brazo hacia el techo. Alterna lados.'),

-- MOVILIDAD - INTERMEDIO (3)
('World''s Greatest Stretch', 'worlds-greatest-stretch', 'Intermedio', 'Movilidad', 'Movilidad completa', ARRAY['Peso corporal'], '3 x 5/lado', 20, 'Suave', 'Zancada profunda, rota torso hacia pierna delantera, brazo al techo. Combina múltiples articulaciones.'),
('Hip Circles (90/90)', 'hip-circles-90-90', 'Intermedio', 'Movilidad', 'Rotación cadera', ARRAY['Esterilla'], '3 x 8-10/lado', 15, 'Suave', 'Sentado con ambas piernas a 90 grados, rota las caderas cambiando de lado. Movilidad avanzada.'),
('Cossack Squats', 'cossack-squats', 'Intermedio', 'Movilidad', 'Sentadilla lateral', ARRAY['Peso corporal'], '3 x 6-8/lado', 20, '2-1-2-0', 'Desplazamiento lateral con una pierna extendida y otra en sentadilla profunda. Movilidad de aductores.');

-- =====================================================================
-- EJERCICIOS NIVEL AVANZADO (23 ejercicios)
-- Énfasis: TRX, kettlebells, movimientos complejos y explosivos
-- =====================================================================

INSERT INTO app."Ejercicios_Casa" (nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, notas) VALUES
-- FUNCIONAL - AVANZADO (5)
('Pistol Squats (Sentadilla a Una Pierna)', 'pistol-squats', 'Avanzado', 'Funcional', 'Sentadilla unilateral', ARRAY['Peso corporal'], '4 x 5-8/pierna', 90, '3-0-2-0', 'Sentadilla completa en una pierna con la otra extendida al frente. Requiere fuerza y equilibrio excepcionales.'),
('Flexiones Diamante', 'flexiones-diamante', 'Avanzado', 'Funcional', 'Empuje triceps', ARRAY['Peso corporal'], '4 x 8-12', 60, '2-0-2-0', 'Manos juntas formando un diamante. Baja el pecho entre las manos. Gran énfasis en tríceps.'),
('Dominadas en Barra Portátil', 'dominadas-barra-portatil', 'Avanzado', 'Funcional', 'Tracción vertical', ARRAY['Barra dominadas'], '4 x 6-10', 90, '2-0-2-0', 'Agarre prono o supino, tira hasta que la barbilla supere la barra. Control completo.'),
('Turkish Get-Up con Kettlebell', 'turkish-getup-kettlebell', 'Avanzado', 'Funcional', 'Levantamiento completo', ARRAY['Kettlebell'], '3 x 3-5/lado', 90, 'Controlado', 'De tumbado a de pie con kettlebell en alto. Movimiento complejo que requiere estabilidad total.'),
('Remo Renegade con Mancuernas', 'remo-renegade-mancuernas', 'Avanzado', 'Funcional', 'Tracción + Core', ARRAY['Mancuernas'], '4 x 8-10/lado', 60, '2-0-2-0', 'Plancha sobre mancuernas, rema alternando brazos. Mantén caderas estables sin rotar.'),

-- FUERZA - AVANZADO (6)
('Dragon Flag', 'dragon-flag', 'Avanzado', 'Fuerza', 'Core avanzado', ARRAY['Banco', 'Silla robusta'], '4 x 4-6', 90, '3-0-3-0', 'Sujétate de un banco, eleva cuerpo recto manteniendo hombros fijos. Baja con control extremo.'),
('L-Sit Hold', 'l-sit-hold', 'Avanzado', 'Fuerza', 'Core isométrico', ARRAY['Paralelas', 'Sillas'], '4 x 15-30s', 60, 'Isométrico', 'Piernas extendidas paralelas al suelo, sostén el peso con los brazos. Core y flexores de cadera trabajando.'),
('Handstand Push-ups Asistidas', 'handstand-pushups-asistidas', 'Avanzado', 'Fuerza', 'Empuje vertical invertido', ARRAY['Pared'], '4 x 5-8', 90, '2-0-2-0', 'Posición invertida contra la pared, baja la cabeza hacia el suelo flexionando codos. Empuja hacia arriba.'),
('Kettlebell Swing', 'kettlebell-swing', 'Avanzado', 'Fuerza', 'Potencia cadera', ARRAY['Kettlebell'], '4 x 15-20', 60, 'Explosivo', 'Bisagra de cadera explosiva balanceando kettlebell hasta la altura de los ojos. Glúteos e isquios.'),
('Pistol Squat con Kettlebell', 'pistol-squat-kettlebell', 'Avanzado', 'Fuerza', 'Sentadilla unilateral con carga', ARRAY['Kettlebell'], '4 x 5-6/pierna', 90, '3-0-2-0', 'Pistol squat sosteniendo kettlebell al pecho. Requiere fuerza y equilibrio extremos.'),
('Muscle-up Adaptado con Toalla', 'muscle-up-toalla', 'Avanzado', 'Fuerza', 'Tracción + Empuje', ARRAY['Toalla', 'Barra'], '4 x 3-5', 120, 'Explosivo-controlado', 'Dominada explosiva transitando a fondos sobre la barra. Movimiento técnico avanzado.'),

-- CARDIO - AVANZADO (4)
('Burpees Completos con Salto', 'burpees-completos-salto', 'Avanzado', 'Cardio', 'Full body explosivo', ARRAY['Peso corporal'], '5 x 45s trabajo / 15s descanso', 15, 'Máximo', 'Plancha, flexión, salto de pies, salto vertical con palmada arriba. Intensidad máxima.'),
('Box Jumps con Silla Robusta', 'box-jumps-silla', 'Avanzado', 'Cardio', 'Potencia inferior', ARRAY['Silla robusta'], '5 x 8-10', 60, 'Explosivo', 'Salta desde el suelo sobre la silla con ambos pies. Aterriza suave y baja controlado.'),
('Sprints en el Sitio (High Intensity)', 'sprints-sitio-high', 'Avanzado', 'Cardio', 'Cardio máximo', ARRAY['Peso corporal'], '6 x 20s trabajo / 40s descanso', 40, 'Máximo', 'Corre en el sitio a velocidad máxima elevando rodillas al máximo. Brazos coordinados.'),
('Battle Rope Simulado con Toallas', 'battle-rope-toallas', 'Avanzado', 'Cardio', 'Cardio brazos + Core', ARRAY['Toallas'], '5 x 30s trabajo / 30s descanso', 30, 'Rápido', 'Agarra toallas pesadas y muévelas en ondas alternadas rápidamente. Simula battle ropes.'),

-- HIIT - AVANZADO (5)
('Burpee Broad Jump', 'burpee-broad-jump', 'Avanzado', 'HIIT', 'Potencia horizontal', ARRAY['Peso corporal'], '6 x 30s trabajo / 30s descanso', 30, 'Explosivo', 'Burpee completo y al levantarte salta hacia adelante lo más lejos posible. Exige potencia.'),
('Tuck Jumps', 'tuck-jumps', 'Avanzado', 'HIIT', 'Potencia vertical', ARRAY['Peso corporal'], '6 x 20s trabajo / 40s descanso', 40, 'Explosivo', 'Salta y lleva rodillas al pecho. Aterriza suave y repite inmediatamente. Alta demanda neuromuscular.'),
('Clapping Push-ups', 'clapping-pushups', 'Avanzado', 'HIIT', 'Empuje explosivo', ARRAY['Peso corporal'], '5 x 5-8', 90, 'Explosivo', 'Flexión explosiva con palmada en el aire. Requiere gran potencia de empuje.'),
('Single Leg Burpees', 'single-leg-burpees', 'Avanzado', 'HIIT', 'Unilateral explosivo', ARRAY['Peso corporal'], '5 x 20s trabajo / 40s descanso', 40, 'Explosivo', 'Burpee completo usando solo una pierna. Cambia de pierna cada repetición. Equilibrio y potencia.'),
('180 Degree Jump Squat', '180-jump-squat', 'Avanzado', 'HIIT', 'Rotación explosiva', ARRAY['Peso corporal'], '6 x 30s trabajo / 30s descanso', 30, 'Explosivo', 'Sentadilla con salto rotando 180 grados en el aire. Aterriza suave y absorbe el impacto.'),

-- MOVILIDAD - AVANZADO (3)
('Jefferson Curl', 'jefferson-curl', 'Avanzado', 'Movilidad', 'Flexión columna', ARRAY['Peso ligero'], '3 x 6-8', 30, 'Muy suave', 'De pie, enrolla la columna vértebra por vértebra bajando controladamente. Movilidad espinal avanzada.'),
('Pancake Stretch Dinámico', 'pancake-stretch-dinamico', 'Avanzado', 'Movilidad', 'Flexión cadera sentado', ARRAY['Esterilla'], '3 x 8-10', 20, 'Suave-pulsante', 'Sentado con piernas abiertas, inclínate hacia adelante con pulsos suaves. Movilidad de isquios y aductores.'),
('Lizard Pose con Rotación', 'lizard-pose-rotacion', 'Avanzado', 'Movilidad', 'Apertura cadera + rotación', ARRAY['Esterilla'], '3 x 5/lado', 20, 'Suave', 'Zancada profunda con codos al suelo, luego rota torso abriendo un brazo hacia el techo. Movilidad completa.');

-- =====================================================================
-- INDICES Y OPTIMIZACIONES
-- =====================================================================

CREATE INDEX idx_ejercicios_casa_nivel ON app."Ejercicios_Casa"(nivel);
CREATE INDEX idx_ejercicios_casa_categoria ON app."Ejercicios_Casa"(categoria);
CREATE INDEX idx_ejercicios_casa_equipamiento ON app."Ejercicios_Casa" USING GIN(equipamiento);
CREATE INDEX idx_ejercicios_casa_slug ON app."Ejercicios_Casa"(slug);

-- =====================================================================
-- VERIFICACIONES
-- =====================================================================

-- Total de ejercicios
SELECT COUNT(*) as total_ejercicios FROM app."Ejercicios_Casa";

-- Distribución por nivel
SELECT nivel, COUNT(*) as cantidad
FROM app."Ejercicios_Casa"
GROUP BY nivel
ORDER BY
  CASE nivel
    WHEN 'Principiante' THEN 1
    WHEN 'Intermedio' THEN 2
    WHEN 'Avanzado' THEN 3
  END;

-- Distribución por categoría
SELECT categoria, COUNT(*) as cantidad
FROM app."Ejercicios_Casa"
GROUP BY categoria
ORDER BY cantidad DESC;

-- Verificar equipamiento más común
SELECT UNNEST(equipamiento) as equipo, COUNT(*) as veces_usado
FROM app."Ejercicios_Casa"
GROUP BY equipo
ORDER BY veces_usado DESC;

COMMIT;

-- =====================================================================
-- FIN DEL SCRIPT
-- Total generado: 65 ejercicios (20 + 22 + 23)
-- Listo para integrarse con CASA_SPECIALIST
-- =====================================================================
