-- ===============================================
-- SISTEMA DE CALISTENIA MANUAL - EJERCICIOS
-- ===============================================
-- Script para insertar los ejercicios de calistenia específicos
-- basados en el Excel con niveles Básico, Intermedio y Avanzado

-- 1) Crear tabla específica para ejercicios de calistenia
CREATE TABLE IF NOT EXISTS app.calistenia_exercises (
  id SERIAL PRIMARY KEY,
  exercise_id TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  nivel TEXT NOT NULL CHECK (nivel IN ('Básico', 'Intermedio', 'Avanzado')),
  categoria TEXT NOT NULL,
  patron TEXT,
  equipamiento TEXT,
  series_reps_objetivo TEXT,
  criterio_de_progreso TEXT,
  progresion_desde TEXT,
  progresion_hacia TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Función para auto-update de updated_at
CREATE OR REPLACE FUNCTION app.tg_set_updated_at_calistenia() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upd_calistenia_exercises ON app.calistenia_exercises;
CREATE TRIGGER trg_upd_calistenia_exercises
BEFORE UPDATE ON app.calistenia_exercises
FOR EACH ROW EXECUTE FUNCTION app.tg_set_updated_at_calistenia();

-- 3) Limpiar datos previos para reinserción
DELETE FROM app.calistenia_exercises;

-- ===============================================
-- EJERCICIOS BÁSICO
-- ===============================================
INSERT INTO app.calistenia_exercises (exercise_id, nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, criterio_de_progreso, progresion_desde, progresion_hacia, notas) VALUES
('flexion-contra-pared', 'Flexión contra pared', 'Básico', 'Empuje', 'Empuje horizontal', 'Pared', '3-5x8-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Flexión inclinada (manos altas)', 'Codos 30–45° respecto al torso.'),
('flexion-inclinada-manos-altas', 'Flexión inclinada (manos altas)', 'Básico', 'Empuje', 'Empuje horizontal', 'Banco/Barra', '3-5x8-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión contra pared', 'Flexión en rodillas', 'Cuerpo en línea.'),
('flexion-en-rodillas', 'Flexión en rodillas', 'Básico', 'Empuje', 'Empuje horizontal', 'Suelo', '3-5x8-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión inclinada (manos altas)', 'Flexión estándar', 'Glúteo y core activos.'),
('flexion-escapular-en-apoyo', 'Flexión escapular (en apoyo)', 'Básico', 'Empuje', 'Control escapular', 'Suelo', '3-4x10-15', 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Flexión estándar', 'Mueve solo escápulas.'),
('plancha-frontal', 'Plancha frontal', 'Básico', 'Core', 'Anti-extensión', 'Suelo', '3-4x20-40s', 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Plancha frontal avanzada', 'Costillas abajo.'),
('plancha-lateral', 'Plancha lateral', 'Básico', 'Core', 'Anti-inclinación', 'Suelo', '3-4x15-30s/lado', 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Plancha lateral con pierna elevada', 'Cadera alta.'),
('hollow-body-tuck-recogido', 'Hollow body tuck (recogido)', 'Básico', 'Core', 'Anti-extensión', 'Suelo', '3-5x20-40s', 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dead bug', 'Hollow body', 'Zona lumbar pegada al suelo.'),
('dead-bug', 'Dead bug', 'Básico', 'Core', 'Control lumbo-pélvico', 'Suelo', '3-4x8-12/lado', 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Hollow body tuck', 'Respira y controla.'),
('puente-de-gluteo', 'Puente de glúteo', 'Básico', 'Piernas', 'Extensión de cadera', 'Suelo', '3-5x10-15', 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Puente de glúteo a 1 pierna', 'Empuja con talones.'),
('sentadilla-a-caja-banco', 'Sentadilla a caja/banco', 'Básico', 'Piernas', 'Sentadilla', 'Banco', '3-5x8-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Sentadilla libre', 'Rodillas siguen puntas.'),
('sentadilla-aire-rango-comodo', 'Sentadilla aire (rango cómodo)', 'Básico', 'Piernas', 'Sentadilla', 'Suelo', '3-5x8-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Sentadilla a caja/banco', 'Sentadilla libre profunda', 'Controla la profundidad.'),
('zancada-asistida-apoyo-en-pared', 'Zancada asistida (apoyo en pared)', 'Básico', 'Piernas', 'Zancada', 'Suelo', '3-4x8-12/lado', 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Zancada libre', 'Paso largo, torso erguido.'),
('step-up-bajo', 'Step-up bajo', 'Básico', 'Piernas', 'Subida a caja', 'Banco bajo', '3-4x8-12/lado', 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Step-up medio/alto', 'Apoya toda la planta.'),
('elevacion-de-gemelos-bilateral', 'Elevación de gemelos bilateral', 'Básico', 'Piernas', 'Pantorrilla', 'Suelo/Escalón', '3-5x12-20', 'Completa 20 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Elevación de gemelos a 1 pierna', 'Pausa arriba 1s.'),
('remo-invertido-rodillas-flexionadas', 'Remo invertido rodillas flexionadas', 'Básico', 'Tracción', 'Tracción horizontal', 'Barra baja/Mesa', '3-5x6-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Remo invertido piernas estiradas', 'Cuerpo en bloque.'),
('dead-hang-colgado-pasivo', 'Dead hang (colgado pasivo)', 'Básico', 'Tracción', 'Agarre/colgado', 'Barra', '3-5x20-40s', 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Scap pull / colgado activo', 'Agarre cómodo.'),
('scap-pull-retraccion-escapular', 'Scap pull (retracción escapular)', 'Básico', 'Tracción', 'Control escapular', 'Barra', '3-4x6-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dead hang (colgado pasivo)', 'Dominadas negativas', 'Brazos estirados.'),
('pike-hold-basico', 'Pike hold básico', 'Básico', 'Empuje', 'Empuje vertical (progresión)', 'Suelo', '3-4x20-30s', 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Pike push-up', 'Cadera alta sobre manos.'),
('soporte-en-paralelas-con-pies-apoyados', 'Soporte en paralelas con pies apoyados', 'Básico', 'Equilibrio/Soporte', 'Soporte', 'Paralelas', '3-4x15-30s', 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Soporte en paralelas', 'Hombros deprimidos.'),
('superman-hold-suave', 'Superman hold suave', 'Básico', 'Core', 'Extensión', 'Suelo', '3-4x15-30s', 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Arch hold', 'Glúteos activados.');

-- ===============================================
-- EJERCICIOS INTERMEDIO
-- ===============================================
INSERT INTO app.calistenia_exercises (exercise_id, nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, criterio_de_progreso, progresion_desde, progresion_hacia, notas) VALUES
('flexion-estandar', 'Flexión estándar', 'Intermedio', 'Empuje', 'Empuje horizontal', 'Suelo', '3-5x8-15', 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión en rodillas', 'Flexión declinada', 'Codos 30–45°.'),
('flexion-diamante', 'Flexión diamante', 'Intermedio', 'Empuje', 'Empuje horizontal', 'Suelo', '3-5x6-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión estándar', 'Flexión archer', 'Énfasis tríceps.'),
('flexion-declinada', 'Flexión declinada', 'Intermedio', 'Empuje', 'Empuje horizontal', 'Suelo', '3-5x6-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión estándar', 'Flexión archer/PSP', 'Pies elevados.'),
('flexion-archer', 'Flexión archer', 'Intermedio', 'Empuje', 'Empuje horizontal unilateral', 'Suelo', '3-5x4-8/lado', 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión declinada', 'Flexión a una mano (prog.)', 'Mantén caderas cuadradas.'),
('pseudo-planche-push-up-psp', 'Pseudo planche push-up (PSP)', 'Intermedio', 'Empuje', 'Empuje horizontal adelantado', 'Suelo', '3-5x4-8', 'Completa 8 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión declinada', 'Planche lean avanzada', 'Peso hacia las manos.'),
('pike-push-up', 'Pike push-up', 'Intermedio', 'Empuje', 'Empuje vertical (progresión)', 'Suelo', '3-5x6-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Pike hold', 'Handstand push-up asistido', 'Cadera sobre hombros.'),
('fondos-en-paralelas-strict', 'Fondos en paralelas (strict)', 'Intermedio', 'Empuje', 'Empuje vertical inferior', 'Paralelas', '3-5x5-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Fondos negativos', 'Fondos lastrados', 'Hombros deprimidos.'),
('remo-invertido-piernas-estiradas', 'Remo invertido piernas estiradas', 'Intermedio', 'Tracción', 'Tracción horizontal', 'Barra baja', '3-5x6-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Remo flexionado', 'Remo pies elevados', 'Línea oreja-cadera-tobillo.'),
('remo-invertido-pies-elevados', 'Remo invertido pies elevados', 'Intermedio', 'Tracción', 'Tracción horizontal', 'Barra baja/Banco', '3-5x4-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Remo estirado', 'Remo anillas difícil', 'Eleva pies.'),
('dominada-pronacion-strict', 'Dominada pronación (strict)', 'Intermedio', 'Tracción', 'Tracción vertical', 'Barra', '3-5x3-8', 'Completa 8 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dominadas negativas', 'Dominada lastrada/archer', 'Evita kipping.'),
('chin-up-supinacion-strict', 'Chin-up (supinación strict)', 'Intermedio', 'Tracción', 'Tracción vertical', 'Barra', '3-5x4-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dominadas negativas', 'Chin-up lastrado', 'Pecho a la barra.'),
('dominadas-negativas-controladas', 'Dominadas negativas controladas', 'Intermedio', 'Tracción', 'Control excéntrico', 'Barra', '3-5x3-6 (3-5s bajada)', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Scap pull', 'Dominada strict', 'Evita rebotes.'),
('hanging-knee-raises', 'Hanging knee raises', 'Intermedio', 'Core', 'Flexión de cadera', 'Barra', '3-5x6-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Tuck raises', 'Toes-to-bar parcial', 'Cuelga sin balanceo.'),
('hanging-leg-raises-tuck', 'Hanging leg raises (tuck)', 'Intermedio', 'Core', 'Flexión de cadera', 'Barra', '3-5x4-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Knee raises', 'Leg raises', 'Retroversión pélvica.'),
('l-sit-tuck-en-paralelas', 'L-sit tuck en paralelas', 'Intermedio', 'Core', 'Compresión', 'Paralelas', '3-5x10-20s', 'Sostén 20s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Soporte en paralelas', 'L-sit', 'Piernas juntas.'),
('hollow-body-30-45s', 'Hollow body 30-45s', 'Intermedio', 'Core', 'Anti-extensión', 'Suelo', '3-4x30-45s', 'Sostén 45s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Hollow tuck', 'Hollow rocks', 'Respira bajo control.'),
('sentadilla-libre-profunda', 'Sentadilla libre profunda', 'Intermedio', 'Piernas', 'Sentadilla', 'Suelo', '3-5x8-15', 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Sentadilla aire', 'Pistol a caja', 'Talones apoyados.'),
('bulgarian-split-squat', 'Bulgarian split squat', 'Intermedio', 'Piernas', 'Sentadilla unilateral', 'Banco', '3-5x6-12/lado', 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Zancada libre', 'Shrimp squat', 'Torso ligeramente inclinado.'),
('pistol-squat-a-caja', 'Pistol squat a caja', 'Intermedio', 'Piernas', 'Sentadilla unilateral', 'Banco', '3-5x3-8/lado', 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Sentadilla libre', 'Pistol squat completo', 'Controla rodilla.'),
('nordic-curl-excentrico', 'Nordic curl excéntrico', 'Intermedio', 'Piernas', 'Isquios (excéntrico)', 'Anclaje pies', '3-5x3-6 (bajada 3-5s)', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Curl femoral isométrico', 'Nordic parcial concéntrico', 'Cadera extendida.'),
('elevacion-de-gemelos-a-1-pierna', 'Elevación de gemelos a 1 pierna', 'Intermedio', 'Piernas', 'Pantorrilla', 'Escalón', '3-5x10-20/lado', 'Completa 20/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Gemelos bilaterales', 'Gemelos 1P con pausa', 'Pausa arriba 1-2s.'),
('handstand-asistido-a-pared-hold', 'Handstand asistido a pared (hold)', 'Intermedio', 'Equilibrio/Soporte', 'Equilibrio invertido', 'Pared', '3-5x20-40s', 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Pike push-up', 'Handstand libre', 'Empuja el suelo.'),
('crow-pose-equilibrio-brazos', 'Crow pose (equilibrio brazos)', 'Intermedio', 'Equilibrio/Soporte', 'Equilibrio sobre manos', 'Suelo', '3-5x10-30s', 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', '-', 'Variantes crow', 'Mirada al frente.');

-- ===============================================
-- EJERCICIOS AVANZADO
-- ===============================================
INSERT INTO app.calistenia_exercises (exercise_id, nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, criterio_de_progreso, progresion_desde, progresion_hacia, notas) VALUES
('flexion-a-una-mano', 'Flexión a una mano', 'Avanzado', 'Empuje', 'Empuje horizontal unilateral', 'Suelo', '4-6x3-6/lado', 'Completa 6/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión archer', 'Flexión 1M pies elevados', 'Mantén cadera cuadrada.'),
('flexion-pliometrica-con-palmada', 'Flexión pliométrica (con palmada)', 'Avanzado', 'Empuje', 'Empuje horizontal explosivo', 'Suelo', '5-8x3-6', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Flexión estándar', 'Flexión pliométrica avanzada', 'Codos suaves al aterrizar.'),
('handstand-push-up-pared', 'Handstand push-up (pared)', 'Avanzado', 'Empuje', 'Empuje vertical', 'Pared', '4-6x2-6', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Pike push-up', 'HSPU libre/deficit', 'ROM completo.'),
('handstand-libre-30-60s', 'Handstand libre 30-60s', 'Avanzado', 'Equilibrio/Soporte', 'Equilibrio invertido', 'Suelo', '3-5x30-60s', 'Sostén 60s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'HS asistido pared', 'Press to handstand', 'Cuerpo en línea.'),
('planche-lean-avanzada', 'Planche lean avanzada', 'Avanzado', 'Empuje', 'Estático adelantado', 'Paralelas', '5-8x10-20s', 'Sostén 20s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'PSP', 'Tuck planche', 'Proyección hombros.'),
('tuck-planche-5-10s', 'Tuck planche 5-10s', 'Avanzado', 'Empuje', 'Estático', 'Paralelas/Anillas', '6-10x5-10s', 'Sostén 10s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Planche lean', 'Straddle planche', 'Codos bloqueados.'),
('dominada-explosiva-al-pecho', 'Dominada explosiva (al pecho)', 'Avanzado', 'Tracción', 'Tracción vertical explosiva', 'Barra', '5-8x3-6', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dominada strict', 'Muscle-up barra', 'Toca pecho en barra.'),
('archer-pull-up-typewriter', 'Archer pull-up / Typewriter', 'Avanzado', 'Tracción', 'Tracción vertical unilateral', 'Barra', '4-6x3-6/lado', 'Completa 6/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dominada strict', '1-arm chin-up (asist.)', 'Controla la bajada.'),
('one-arm-chin-up-asistneg', 'One-arm chin-up (asist./neg.)', 'Avanzado', 'Tracción', 'Tracción unilateral', 'Barra', '6-10x1-3/lado', 'Completa 3/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Archer pull-up', 'One-arm chin-up strict', 'Usa banda/asistencia.'),
('muscle-up-en-barra-strict', 'Muscle-up en barra (strict)', 'Avanzado', 'Tracción', 'Tracción + Empuje', 'Barra', '4-6x1-5', 'Completa 5 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Dominada explosiva', 'Muscle-up lastrado', 'Transición limpia, sin kipping.'),
('muscle-up-en-anillas-strict', 'Muscle-up en anillas (strict)', 'Avanzado', 'Tracción', 'Tracción + Empuje', 'Anillas', '4-6x1-5', 'Completa 5 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Transición en anillas bajas', 'Muscle-up lastrado', 'False grip sólido.'),
('front-lever-advanced-tuckstraddle', 'Front lever – advanced tuck/straddle', 'Avanzado', 'Tracción', 'Estático', 'Barra/Anillas', '6-10x5-15s', 'Sostén 15s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Front lever tuck', 'Front lever full', 'Depresión escapular.'),
('back-lever-advanced-tuckstraddle', 'Back lever – advanced tuck/straddle', 'Avanzado', 'Empuje', 'Estático', 'Anillas/Barra', '6-10x5-15s', 'Sostén 15s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Back lever tuck', 'Back lever full', 'Codos bloqueados.'),
('human-flag-tuck', 'Human flag (tuck)', 'Avanzado', 'Tracción', 'Estático lateral', 'Barra vertical', '6-10x3-8s', 'Sostén 8s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Band-assisted flag', 'Human flag straddle', 'Hombro inferior fuerte.'),
('dragon-flag-3-8-reps', 'Dragon flag 3-8 reps', 'Avanzado', 'Core', 'Anti-extensión dinámica', 'Banco/Barra', '4-6x3-8', 'Completa 8 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Hollow rocks / elevaciones', 'Dragon flag avanzado', 'Cuerpo rígido.'),
('l-sit-20-30s', 'L-sit 20-30s', 'Avanzado', 'Core', 'Compresión', 'Paralelas/Anillas', '5-8x20-30s', 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'L-sit tuck', 'V-sit', 'Rodillas extendidas.'),
('v-sit-5-10s', 'V-sit 5-10s', 'Avanzado', 'Core', 'Compresión avanzada', 'Paralelas/Suelo', '6-10x5-10s', 'Sostén 10s con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'L-sit', 'Manna (progresión)', 'Caderas en anteversión.'),
('pistol-squat-completo', 'Pistol squat completo', 'Avanzado', 'Piernas', 'Sentadilla unilateral', 'Suelo', '4-6x3-8/lado', 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Pistol a caja', 'Pistol lastrado', 'Talón apoyado.'),
('shrimp-squat-avanzado', 'Shrimp squat avanzado', 'Avanzado', 'Piernas', 'Sentadilla unilateral', 'Suelo', '4-6x3-8/lado', 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Bulgarian split squat', 'Shrimp squat profundo', 'Controla la rodilla.'),
('nordic-curl-concentrico', 'Nordic curl concéntrico', 'Avanzado', 'Piernas', 'Isquios (fuerza)', 'Anclaje pies', '4-6x3-6', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Nordic excéntrico', 'Nordic con lastre', 'Cadera extendida.'),
('toes-to-bar-estricto', 'Toes-to-bar (estricto)', 'Avanzado', 'Core', 'Flexión de cadera', 'Barra', '4-6x5-10', 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Hanging leg raises', 'Windshield wipers (prog.)', 'Evita balanceo.'),
('explosive-dips-dips-en-anillas', 'Explosive dips / Dips en anillas', 'Avanzado', 'Empuje', 'Empuje vertical inferior explosivo', 'Paralelas/Anillas', '5-8x3-6', 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Fondos strict', 'Dips lastrados', 'Bloquea codos arriba.');

-- ===============================================
-- FUNCIONES AUXILIARES
-- ===============================================

-- Función para obtener ejercicios por nivel
CREATE OR REPLACE FUNCTION app.get_calistenia_exercises_by_level(p_nivel TEXT)
RETURNS TABLE(
  exercise_id TEXT,
  nombre TEXT,
  categoria TEXT,
  patron TEXT,
  equipamiento TEXT,
  series_reps_objetivo TEXT,
  notas TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.exercise_id,
    ce.nombre,
    ce.categoria,
    ce.patron,
    ce.equipamiento,
    ce.series_reps_objetivo,
    ce.notas
  FROM app.calistenia_exercises ce
  WHERE ce.nivel = p_nivel
  ORDER BY ce.categoria, ce.nombre;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener progresiones de un ejercicio
CREATE OR REPLACE FUNCTION app.get_exercise_progression(p_exercise_id TEXT)
RETURNS TABLE(
  previous_exercise TEXT,
  current_exercise TEXT,
  next_exercise TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.progresion_desde,
    ce.nombre,
    ce.progresion_hacia
  FROM app.calistenia_exercises ce
  WHERE ce.exercise_id = p_exercise_id;
END;
$$ LANGUAGE plpgsql;

-- Verificar inserción
SELECT nivel, COUNT(*) as total_ejercicios 
FROM app.calistenia_exercises 
GROUP BY nivel 
ORDER BY 
  CASE nivel 
    WHEN 'Básico' THEN 1 
    WHEN 'Intermedio' THEN 2 
    WHEN 'Avanzado' THEN 3 
  END;

-- Log final
SELECT 'Calistenia exercises migration completed successfully. Total exercises: ' || COUNT(*)
FROM app.calistenia_exercises;