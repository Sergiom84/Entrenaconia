-- ============================================================================
-- INSERT EJERCICIOS HEAVY DUTY - CORREGIDOS
-- Generado: 2025-10-05 19:23:34
-- Total ejercicios: 44
-- ============================================================================

BEGIN;

-- DESCOMENTAR SI QUIERES LIMPIAR TABLA EXISTENTE:
-- DELETE FROM app."Ejercicios_Heavy_Duty";

-- Ejercicio 1: Press de pecho en máquina
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-de-pecho-en-máquina-plano', 'Press de pecho en máquina', 'Básico', 'Pecho', 'Empuje horizontal', 'Máquina', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Press inclinado con mancuernas', 'Escápulas retraídas, tempo controlado (2-2-4).', 'plano', 'Variante: plano.', 'Básico '
);

-- Ejercicio 2: Press inclinado con mancuernas
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-inclinado-con-mancuernas-banco-30', 'Press inclinado con mancuernas', 'Intermedio', 'Pecho', 'Empuje horizontal (alto)', 'Mancuernas', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Press en máquina', 'Press inclinado con barra', 'Rango completo, sin rebotes.', 'banco 30°', 'Variante: banco 30°.', 'Básico '
);

-- Ejercicio 3: Pec-deck
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'pec-deck-aperturas-en-máquina', 'Pec-deck', 'Básico', 'Pecho', 'Aducción horizontal', 'Máquina', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Superserie con press inclinado (intermedio)', 'Codos semiextendidos, estiramiento controlado.', 'aperturas en máquina', 'Variante: aperturas en máquina.', 'Básico '
);

-- Ejercicio 4: Jalón al pecho en polea
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'jalón-al-pecho-en-polea-agarre-supino', 'Jalón al pecho en polea', 'Básico', 'Espalda', 'Tracción vertical', 'Polea', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Dominadas asistidas / jalón pesado', 'Pecho alto, sin balanceo.', 'agarre supino', 'Variante: agarre supino.', 'Básico '
);

-- Ejercicio 5: Remo en polea baja
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'remo-en-polea-baja-agarre-neutro', 'Remo en polea baja', 'Básico', 'Espalda', 'Tracción horizontal', 'Polea', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Remo con barra 45°', 'Tira con codos, espalda neutra.', 'agarre neutro', 'Variante: agarre neutro.', 'Básico '
);

-- Ejercicio 6: Pullover en máquina o polea
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'pullover-en-máquina-o-polea-recto', 'Pullover en máquina o polea', 'Básico', 'Espalda', 'Extensión de hombro', 'Máquina/Polea', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Superserie con jalón supino (intermedio)', 'Brazos casi rectos, sin flexionar codo.', 'recto', 'Variante: recto.', 'Básico '
);

-- Ejercicio 7: Press militar en máquina
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-militar-en-máquina-sentado', 'Press militar en máquina', 'Básico', 'Hombro', 'Empuje vertical', 'Máquina', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Press militar con mancuernas', 'Evita hiperextender zona lumbar.', 'sentado', 'Variante: sentado.', 'Básico '
);

-- Ejercicio 8: Elevaciones laterales en máquina
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'elevaciones-laterales-en-máquina', 'Elevaciones laterales en máquina', 'Básico', 'Máquina', '1x12-20', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Elevaciones laterales con mancuernas', 'Pausa breve arriba.', NULL, NULL, 'Básico ', 'Hombro (medios)', 'Abducción'
);

-- Ejercicio 9: Extensión de tríceps en polea
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'extensión-de-tríceps-en-polea-barra', 'Extensión de tríceps en polea', 'Básico', 'Tríceps', 'Extensión de codo', 'Polea', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Extensión con cuerda', 'Codos fijos.', 'barra', 'Variante: barra.', 'Básico '
);

-- Ejercicio 10: Curl de bíceps en máquina
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'curl-de-bíceps-en-máquina-predicador', 'Curl de bíceps en máquina', 'Básico', 'Bíceps', 'Flexión de codo', 'Máquina', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Curl con barra Z', 'Evita elevar hombros.', 'predicador', 'Variante: predicador.', 'Básico '
);

-- Ejercicio 11: Prensa 45°
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'prensa-45-moderado', 'Prensa 45°', 'Básico', 'Piernas (cuádriceps)', 'Sentadilla guiada', 'Máquina', '1x10-15', '1 serie efectiva hasta fallo. Si alcanzas 15–20 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Prensa 45° pesada / Hack', 'Lumbar pegada, rango cómodo.', 'moderado', 'Variante: moderado.', 'Básico '
);

-- Ejercicio 12: Extensión de cuádriceps
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'extensión-de-cuádriceps-leg-extension', 'Extensión de cuádriceps', 'Básico', 'Piernas (cuádriceps)', 'Extensión de rodilla', 'Máquina', '1x12-15', '1 serie efectiva hasta fallo. Si alcanzas 15–20 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Superserie con prensa o sentadilla (intermedio)', 'Pausa 1 s en extensión.', 'leg extension', 'Variante: leg extension.', 'Básico '
);

-- Ejercicio 13: Curl femoral tumbado
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'curl-femoral-tumbado', 'Curl femoral tumbado', 'Básico', 'Máquina', '1x10-15', '1 serie efectiva hasta fallo. Si alcanzas 15–20 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Curl femoral sentado/uni', 'Cadera pegada al banco.', NULL, NULL, 'Básico ', 'Piernas (isquios)', 'Flexión de rodilla'
);

-- Ejercicio 14: Hip thrust en máquina/Smith
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'hip-thrust-en-máquinasmith-básico', 'Hip thrust en máquina/Smith', 'Básico', 'Glúteo', 'Extensión de cadera', 'Máquina/Smith', '1x8-12', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Hip thrust con barra', 'Mentón al pecho, pausa arriba.', 'básico', 'Variante: básico.', 'Básico '
);

-- Ejercicio 15: Elevación de talones en prensa
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'elevación-de-talones-en-prensa-gemelos', 'Elevación de talones en prensa', 'Básico', 'Gemelos', 'Flexo-extensión de tobillo', 'Máquina/Prensa', '1x12-20', '1 serie efectiva 12–20 reps hasta fallo; pausa 1–2 s arriba.', '-', 'Gemelos de pie en máquina', 'Recorrido completo, pausa arriba.', 'gemelos', 'Variante: gemelos.', 'Básico '
);

-- Ejercicio 16: Crunch en máquina
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'crunch-en-máquina', 'Crunch en máquina', 'Básico', 'Máquina', '1x10-15', '1 serie efectiva 8–15 reps controladas hasta fallo o casi fallo sin dolor lumbar.', '-', 'Crunch en polea', 'Cierra costillas hacia pelvis.', NULL, NULL, 'Básico ', 'Core', 'Flexión de tronco'
);

-- Ejercicio 17: Pallof press
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'pallof-press-cable', 'Pallof press', 'Básico', 'Core', 'Anti-rotación', 'Polea', '1x12-20/lado', '1 serie efectiva 8–15 reps controladas hasta fallo o casi fallo sin dolor lumbar.', '-', 'Walkouts Pallof', 'Pelvis estable, sin girar.', 'cable', 'Variante: cable.', 'Básico '
);

-- Ejercicio 18: Pec-deck
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'pec-deck-pre-agotamiento', 'Pec-deck', 'Básico', 'Pecho', 'Aducción horizontal', 'Máquina', '1x8-12', '1 serie efectiva 8–12 reps hasta fallo; transición directa al compuesto (pre-agotamiento).', '-', 'Press inclinado con barra', 'Ir directo al Press sin descanso.', 'pre-agotamiento', 'Variante: pre-agotamiento.', 'Intermedio'
);

-- Ejercicio 19: Press inclinado con barra
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-inclinado-con-barra-tras-pec-deck', 'Press inclinado con barra', 'Intermedio', 'Pecho', 'Empuje horizontal (alto)', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Pec-deck', 'Press banca plano / inclinado pesado', 'Fallo en pectoral; triceps asiste.', 'tras pec-deck', 'Variante: tras pec-deck.', 'Intermedio'
);

-- Ejercicio 20: Pullover recto en polea
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'pullover-recto-en-polea', 'Pullover recto en polea', 'Básico', 'Polea', '1x8-12', '1 serie efectiva 8–12 reps hasta fallo; transición directa al compuesto (pre-agotamiento).', '-', 'Jalón al pecho supino', 'Brazos casi rectos.', NULL, NULL, 'Intermedio', 'Espalda', 'Extensión de hombro'
);

-- Ejercicio 21: Jalón al pecho supino
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'jalón-al-pecho-supino-tras-pullover', 'Jalón al pecho supino', 'Básico', 'Espalda', 'Tracción vertical', 'Polea', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Pullover recto', 'Dominadas supinas / Pulldown pesado', 'Agarre supino medio; fallo en dorsales.', 'tras pullover', 'Variante: tras pullover.', 'Intermedio'
);

-- Ejercicio 22: Remo con barra 45°
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'remo-con-barra-45', 'Remo con barra 45°', 'Básico', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Remo polea baja', 'Remo Pendlay / Seal row', 'Core firme, sin impulso.', NULL, NULL, 'Intermedio', 'Espalda', 'Tracción horizontal'
);

-- Ejercicio 23: Elevación lateral con mancuernas
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'elevación-lateral-con-mancuernas', 'Elevación lateral con mancuernas', 'Básico', 'Mancuernas', '1x12-20', '1 serie efectiva 8–12 reps hasta fallo; transición directa al compuesto (pre-agotamiento).', '-', 'Press militar con mancuernas', 'Sube directo al press.', NULL, NULL, 'Intermedio', 'Hombro (medios)', 'Abducción'
);

-- Ejercicio 24: Press militar con mancuernas
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-militar-con-mancuernas-tras-laterales', 'Press militar con mancuernas', 'Intermedio', 'Hombro', 'Empuje vertical', 'Mancuernas', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Elevaciones laterales', 'Press militar con barra', 'Evita hiperextender lumbar.', 'tras laterales', 'Variante: tras laterales.', 'Intermedio'
);

-- Ejercicio 25: Reverse fly en máquina/cable
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'reverse-fly-en-máquinacable', 'Reverse fly en máquina/cable', 'Básico', 'Máquina/Polea', '1x12-20', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Face pull / pájaros DB', 'Escápulas deprimidas.', NULL, NULL, 'Intermedio', 'Hombro (posterior)', 'Apertura horizontal'
);

-- Ejercicio 26: Curl con barra Z
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'curl-con-barra-z', 'Curl con barra Z', 'Básico', 'Barra Z', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Superserie con jalón supino para bíceps', 'Codos pegados.', NULL, NULL, 'Intermedio', 'Bíceps', 'Flexión de codo'
);

-- Ejercicio 27: Jalón supino
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'jalón-supino-bíceps-dominante', 'Jalón supino', 'Básico', 'Bíceps/Espalda', 'Tracción vertical', 'Polea', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Curl Z', 'Chin-up supino pesado', 'Pulldown supino inmediatamente tras curls.', 'bíceps dominante', 'Variante: bíceps dominante.', 'Intermedio'
);

-- Ejercicio 28: Press francés con barra Z
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-francés-con-barra-z-tumbado', 'Press francés con barra Z', 'Intermedio', 'Tríceps', 'Extensión de codo', 'Barra Z', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Dips / extensión en polea', 'Codos apuntan al techo.', 'tumbado', 'Variante: tumbado.', 'Intermedio'
);

-- Ejercicio 29: Dips en paralelas
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'dips-en-paralelas-estrictos', 'Dips en paralelas', 'Básico', 'Tríceps/Pecho', 'Empuje vertical inferior', 'Paralelas', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Press francés', 'Dips lastrados (avanzado)', 'Bloquea codos arriba; rango completo.', 'estrictos', 'Variante: estrictos.', 'Intermedio'
);

-- Ejercicio 30: Extensión de cuádriceps
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'extensión-de-cuádriceps-pre', 'Extensión de cuádriceps', 'Básico', 'Piernas (cuádriceps)', 'Extensión de rodilla', 'Máquina', '1x12-15', '1 serie efectiva 8–12 reps hasta fallo; transición directa al compuesto (pre-agotamiento).', '-', 'Prensa 45° / Sentadilla', 'Pausa 1 s en extensión.', 'pre', 'Variante: pre.', 'Intermedio'
);

-- Ejercicio 31: Prensa 45°
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'prensa-45-tras-extensión', 'Prensa 45°', 'Básico', 'Piernas (cuádriceps)', 'Sentadilla guiada', 'Máquina', '1x8-15', '1 serie efectiva hasta fallo. Si alcanzas 15–20 reps, aumenta la carga 5–10% la próxima sesión.', 'Extensión de cuádriceps', 'Sentadilla trasera / Hack', 'Sube sin bloquear rodillas.', 'tras extensión', 'Variante: tras extensión.', 'Intermedio'
);

-- Ejercicio 32: RDL con barra
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'rdl-con-barra-bisagra', 'RDL con barra', 'Básico', 'Isquios/Glúteo', 'Bisagra de cadera', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'RDL pesado / buenos días ligeros', 'Columna neutra, barra pegada.', 'bisagra', 'Variante: bisagra.', 'Intermedio'
);

-- Ejercicio 33: Curl femoral sentado
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'curl-femoral-sentado-unilateral', 'Curl femoral sentado', 'Básico', 'Isquios', 'Flexión de rodilla', 'Máquina', '1x8-12/lado', '1 serie efectiva hasta fallo. Si alcanzas 15–20 reps, aumenta la carga 5–10% la próxima sesión.', 'Curl bilateral', 'Curl + pausa/tempo', 'Iguala lados.', 'unilateral', 'Variante: unilateral.', 'Intermedio'
);

-- Ejercicio 34: Elevación de talones de pie
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'elevación-de-talones-de-pie-máquina', 'Elevación de talones de pie', 'Básico', 'Gemelos', 'Flexo-extensión de tobillo', 'Máquina', '1x12-20', '1 serie efectiva 12–20 reps hasta fallo; pausa 1–2 s arriba.', '-', 'Gemelos sentado (sóleo)', 'Pausa 1–2 s arriba.', 'máquina', 'Variante: máquina.', 'Intermedio'
);

-- Ejercicio 35: Crunch en polea
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'crunch-en-polea-de-rodillas', 'Crunch en polea', 'Básico', 'Core', 'Flexión de tronco', 'Polea', '1x10-15', '1 serie efectiva 8–15 reps controladas hasta fallo o casi fallo sin dolor lumbar.', 'Crunch máquina', 'Crunch declinado con carga', 'Cierra costillas hacia pelvis.', 'de rodillas', 'Variante: de rodillas.', 'Intermedio'
);

-- Ejercicio 36: Sentadilla trasera
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'sentadilla-trasera-high-bar', 'Sentadilla trasera', 'Intermedio', 'Piernas (cuádriceps)', 'Sentadilla', 'Barra', '1x8-15', '1 serie efectiva hasta fallo. Si alcanzas 15–20 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Prensa/Hack pesada', 'Parte de la Rutina Consolidada — Sesión A.', 'high-bar', 'Variante: high-bar.', 'Avanzado'
);

-- Ejercicio 37: Jalón supino en polea
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'jalón-supino-en-polea-agarre-medio', 'Jalón supino en polea', 'Básico', 'Espalda/Bíceps', 'Tracción vertical', 'Polea', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Dominada supina lastrada', 'Rutina Consolidada — Sesión A.', 'agarre medio', 'Variante: agarre medio.', 'Avanzado'
);

-- Ejercicio 38: Dips en paralelas
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'dips-en-paralelas-lastrables', 'Dips en paralelas', 'Básico', 'Pecho/Tríceps', 'Empuje vertical inferior', 'Paralelas', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Fondos lastrados (progresión)', 'Rutina Consolidada — Sesión A.', 'lastrables', 'Variante: lastrables.', 'Avanzado'
);

-- Ejercicio 39: Peso muerto convencional
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'peso-muerto-convencional', 'Peso muerto convencional', 'Básico', 'Barra', '1x5-8', '1 serie efectiva 5–8 reps hasta fallo técnico; si superas 8 reps, sube 2,5–5%.', '-', 'Peso muerto pesado / Rack pull', 'Rutina Consolidada — Sesión B.', NULL, NULL, 'Avanzado', 'Espalda posterior', 'Bisagra de cadera'
);

-- Ejercicio 40: Press tras nuca / militar con barra
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-tras-nuca-militar-con-barra', 'Press tras nuca / militar con barra', 'Básico', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', '-', 'Press militar pesado', 'Rutina Consolidada — Sesión B. Alternativa: press militar frontal.', NULL, NULL, 'Avanzado', 'Hombro', 'Empuje vertical'
);

-- Ejercicio 41: Elevación de talones de pie
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'elevación-de-talones-de-pie-pesada', 'Elevación de talones de pie', 'Básico', 'Gemelos', 'Flexo-extensión de tobillo', 'Máquina', '1x12-20', '1 serie efectiva 12–20 reps hasta fallo; pausa 1–2 s arriba.', '-', 'Gemelos con pausa larga', 'Rutina Consolidada — Sesión B.', 'pesada', 'Variante: pesada.', 'Avanzado'
);

-- Ejercicio 42: Press de banca con pausa
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'press-de-banca-con-pausa-rest-pause-opcional', 'Press de banca con pausa', 'Intermedio', 'Pecho', 'Empuje horizontal', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Press inclinado', 'Press banca pesado', 'Usar rest-pause/forzadas esporádicamente (no en todas las sesiones).', 'rest-pause opcional', 'Variante: rest-pause opcional.', 'Avanzado'
);

-- Ejercicio 43: Remo Pendlay
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'remo-pendlay-estricto', 'Remo Pendlay', 'Intermedio', 'Espalda', 'Tracción horizontal', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Remo barra 45°', 'Seal row / Pendlay pesado', 'Desde suelo, explosivo y controlado.', 'estricto', 'Variante: estricto.', 'Avanzado'
);

-- Ejercicio 44: Hip thrust con barra
INSERT INTO app."Ejercicios_Heavy_Duty" (
  exercise_id, nombre, nivel, categoria, patron, equipamiento,
  series_reps_objetivo, criterio_de_progreso, progresion_desde,
  progresion_hacia, notas, variante, explicacion_variante, tiempo
) VALUES (
  'hip-thrust-con-barra-pesado-pausa', 'Hip thrust con barra', 'Básico', 'Glúteo', 'Extensión de cadera', 'Barra', '1x6-10', '1 serie efectiva hasta fallo. Si alcanzas 10–12 reps, aumenta la carga 5–10% la próxima sesión.', 'Hip thrust intermedio', 'Hip thrust déficit/ bandas', 'Pausa 1–2 s en isometría.', 'pesado, pausa', 'Variante: pesado, pausa.', 'Avanzado'
);

COMMIT;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT COUNT(*) as total_ejercicios FROM app."Ejercicios_Heavy_Duty";
SELECT nivel, COUNT(*) as cantidad FROM app."Ejercicios_Heavy_Duty" GROUP BY nivel;
