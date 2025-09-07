/**
 * Script para crear tabla de calistenia e insertar 65 ejercicios con nombres correctos en español
 */

import { pool } from '../db.js';

// Datos completos de ejercicios con caracteres especiales corregidos
const ejerciciosData = [
  // BÁSICO (20 ejercicios)
  {id: 1, exercise_id: 'flexion-contra-pared', nombre: 'Flexión contra pared', nivel: 'Básico', categoria: 'Empuje', patron: 'Empuje horizontal', equipamiento: 'Pared', series_reps_objetivo: '3-5x8-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Flexión inclinada (manos altas)', notas: 'Codos 30–45° respecto al torso.'},
  {id: 2, exercise_id: 'flexion-inclinada-manos-altas', nombre: 'Flexión inclinada (manos altas)', nivel: 'Básico', categoria: 'Empuje', patron: 'Empuje horizontal', equipamiento: 'Banco/Barra', series_reps_objetivo: '3-5x8-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión contra pared', progresion_hacia: 'Flexión en rodillas', notas: 'Cuerpo en línea.'},
  {id: 3, exercise_id: 'flexion-en-rodillas', nombre: 'Flexión en rodillas', nivel: 'Básico', categoria: 'Empuje', patron: 'Empuje horizontal', equipamiento: 'Suelo', series_reps_objetivo: '3-5x8-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión inclinada (manos altas)', progresion_hacia: 'Flexión estándar', notas: 'Glúteo y core activos.'},
  {id: 4, exercise_id: 'flexion-escapular-en-apoyo', nombre: 'Flexión escapular (en apoyo)', nivel: 'Básico', categoria: 'Empuje', patron: 'Control escapular', equipamiento: 'Suelo', series_reps_objetivo: '3-4x10-15', criterio_de_progreso: 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Flexión estándar', notas: 'Mueve solo escápulas.'},
  {id: 5, exercise_id: 'plancha-frontal', nombre: 'Plancha frontal', nivel: 'Básico', categoria: 'Core', patron: 'Anti-extensión', equipamiento: 'Suelo', series_reps_objetivo: '3-4x20-40s', criterio_de_progreso: 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Plancha frontal avanzada', notas: 'Costillas abajo.'},
  {id: 6, exercise_id: 'plancha-lateral', nombre: 'Plancha lateral', nivel: 'Básico', categoria: 'Core', patron: 'Anti-inclinación', equipamiento: 'Suelo', series_reps_objetivo: '3-4x15-30s/lado', criterio_de_progreso: 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Plancha lateral con pierna elevada', notas: 'Cadera alta.'},
  {id: 7, exercise_id: 'hollow-body-tuck-recogido', nombre: 'Hollow body tuck (recogido)', nivel: 'Básico', categoria: 'Core', patron: 'Anti-extensión', equipamiento: 'Suelo', series_reps_objetivo: '3-5x20-40s', criterio_de_progreso: 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dead bug', progresion_hacia: 'Hollow body', notas: 'Zona lumbar pegada al suelo.'},
  {id: 8, exercise_id: 'dead-bug', nombre: 'Dead bug', nivel: 'Básico', categoria: 'Core', patron: 'Control lumbo-pélvico', equipamiento: 'Suelo', series_reps_objetivo: '3-4x8-12/lado', criterio_de_progreso: 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Hollow body tuck', notas: 'Respira y controla.'},
  {id: 9, exercise_id: 'puente-de-gluteo', nombre: 'Puente de glúteo', nivel: 'Básico', categoria: 'Piernas', patron: 'Extensión de cadera', equipamiento: 'Suelo', series_reps_objetivo: '3-5x10-15', criterio_de_progreso: 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Puente de glúteo a 1 pierna', notas: 'Empuja con talones.'},
  {id: 10, exercise_id: 'sentadilla-a-caja-banco', nombre: 'Sentadilla a caja/banco', nivel: 'Básico', categoria: 'Piernas', patron: 'Sentadilla', equipamiento: 'Banco', series_reps_objetivo: '3-5x8-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Sentadilla libre', notas: 'Rodillas siguen puntas.'},
  {id: 11, exercise_id: 'sentadilla-aire-rango-comodo', nombre: 'Sentadilla aire (rango cómodo)', nivel: 'Básico', categoria: 'Piernas', patron: 'Sentadilla', equipamiento: 'Suelo', series_reps_objetivo: '3-5x8-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Sentadilla a caja/banco', progresion_hacia: 'Sentadilla libre profunda', notas: 'Controla la profundidad.'},
  {id: 12, exercise_id: 'zancada-asistida-apoyo-en-pared', nombre: 'Zancada asistida (apoyo en pared)', nivel: 'Básico', categoria: 'Piernas', patron: 'Zancada', equipamiento: 'Suelo', series_reps_objetivo: '3-4x8-12/lado', criterio_de_progreso: 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Zancada libre', notas: 'Paso largo, torso erguido.'},
  {id: 13, exercise_id: 'step-up-bajo', nombre: 'Step-up bajo', nivel: 'Básico', categoria: 'Piernas', patron: 'Subida a caja', equipamiento: 'Banco bajo', series_reps_objetivo: '3-4x8-12/lado', criterio_de_progreso: 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Step-up medio/alto', notas: 'Apoya toda la planta.'},
  {id: 14, exercise_id: 'elevacion-de-gemelos-bilateral', nombre: 'Elevación de gemelos bilateral', nivel: 'Básico', categoria: 'Piernas', patron: 'Pantorrilla', equipamiento: 'Suelo/Escalón', series_reps_objetivo: '3-5x12-20', criterio_de_progreso: 'Completa 20 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Elevación de gemelos a 1 pierna', notas: 'Pausa arriba 1s.'},
  {id: 15, exercise_id: 'remo-invertido-rodillas-flexionadas', nombre: 'Remo invertido rodillas flexionadas', nivel: 'Básico', categoria: 'Tracción', patron: 'Tracción horizontal', equipamiento: 'Barra baja/Mesa', series_reps_objetivo: '3-5x6-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Remo invertido piernas estiradas', notas: 'Cuerpo en bloque.'},
  {id: 16, exercise_id: 'dead-hang-colgado-pasivo', nombre: 'Dead hang (colgado pasivo)', nivel: 'Básico', categoria: 'Tracción', patron: 'Agarre/colgado', equipamiento: 'Barra', series_reps_objetivo: '3-5x20-40s', criterio_de_progreso: 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Scap pull / colgado activo', notas: 'Agarre cómodo.'},
  {id: 17, exercise_id: 'scap-pull-retraccion-escapular', nombre: 'Scap pull (retracción escapular)', nivel: 'Básico', categoria: 'Tracción', patron: 'Control escapular', equipamiento: 'Barra', series_reps_objetivo: '3-4x6-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dead hang (colgado pasivo)', progresion_hacia: 'Dominadas negativas', notas: 'Brazos estirados.'},
  {id: 18, exercise_id: 'pike-hold-basico', nombre: 'Pike hold básico', nivel: 'Básico', categoria: 'Empuje', patron: 'Empuje vertical (progresión)', equipamiento: 'Suelo', series_reps_objetivo: '3-4x20-30s', criterio_de_progreso: 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Pike push-up', notas: 'Cadera alta sobre manos.'},
  {id: 19, exercise_id: 'soporte-en-paralelas-con-pies-apoyados', nombre: 'Soporte en paralelas con pies apoyados', nivel: 'Básico', categoria: 'Equilibrio/Soporte', patron: 'Soporte', equipamiento: 'Paralelas', series_reps_objetivo: '3-4x15-30s', criterio_de_progreso: 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Soporte en paralelas', notas: 'Hombros deprimidos.'},
  {id: 20, exercise_id: 'superman-hold-suave', nombre: 'Superman hold suave', nivel: 'Básico', categoria: 'Core', patron: 'Extensión', equipamiento: 'Suelo', series_reps_objetivo: '3-4x15-30s', criterio_de_progreso: 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Arch hold', notas: 'Glúteos activados.'},

  // INTERMEDIO (24 ejercicios)
  {id: 21, exercise_id: 'flexion-estandar', nombre: 'Flexión estándar', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje horizontal', equipamiento: 'Suelo', series_reps_objetivo: '3-5x8-15', criterio_de_progreso: 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión en rodillas', progresion_hacia: 'Flexión declinada', notas: 'Codos 30–45°.'},
  {id: 22, exercise_id: 'flexion-diamante', nombre: 'Flexión diamante', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje horizontal', equipamiento: 'Suelo', series_reps_objetivo: '3-5x6-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión estándar', progresion_hacia: 'Flexión archer', notas: 'Énfasis tríceps.'},
  {id: 23, exercise_id: 'flexion-declinada', nombre: 'Flexión declinada', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje horizontal', equipamiento: 'Suelo', series_reps_objetivo: '3-5x6-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión estándar', progresion_hacia: 'Flexión archer/PSP', notas: 'Pies elevados.'},
  {id: 24, exercise_id: 'flexion-archer', nombre: 'Flexión archer', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje horizontal unilateral', equipamiento: 'Suelo', series_reps_objetivo: '3-5x4-8/lado', criterio_de_progreso: 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión declinada', progresion_hacia: 'Flexión a una mano (prog.)', notas: 'Mantén caderas cuadradas.'},
  {id: 25, exercise_id: 'pseudo-planche-push-up-psp', nombre: 'Pseudo planche push-up (PSP)', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje horizontal adelantado', equipamiento: 'Suelo', series_reps_objetivo: '3-5x4-8', criterio_de_progreso: 'Completa 8 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión declinada', progresion_hacia: 'Planche lean avanzada', notas: 'Peso hacia las manos.'},
  {id: 26, exercise_id: 'pike-push-up', nombre: 'Pike push-up', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje vertical (progresión)', equipamiento: 'Suelo', series_reps_objetivo: '3-5x6-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Pike hold', progresion_hacia: 'Handstand push-up asistido', notas: 'Cadera sobre hombros.'},
  {id: 27, exercise_id: 'fondos-en-paralelas-strict', nombre: 'Fondos en paralelas (strict)', nivel: 'Intermedio', categoria: 'Empuje', patron: 'Empuje vertical inferior', equipamiento: 'Paralelas', series_reps_objetivo: '3-5x5-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Fondos negativos', progresion_hacia: 'Fondos lastrados', notas: 'Hombros deprimidos.'},
  {id: 28, exercise_id: 'remo-invertido-piernas-estiradas', nombre: 'Remo invertido piernas estiradas', nivel: 'Intermedio', categoria: 'Tracción', patron: 'Tracción horizontal', equipamiento: 'Barra baja', series_reps_objetivo: '3-5x6-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Remo flexionado', progresion_hacia: 'Remo pies elevados', notas: 'Línea oreja-cadera-tobillo.'},
  {id: 29, exercise_id: 'remo-invertido-pies-elevados', nombre: 'Remo invertido pies elevados', nivel: 'Intermedio', categoria: 'Tracción', patron: 'Tracción horizontal', equipamiento: 'Barra baja/Banco', series_reps_objetivo: '3-5x4-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Remo estirado', progresion_hacia: 'Remo anillas difícil', notas: 'Eleva pies.'},
  {id: 30, exercise_id: 'dominada-pronacion-strict', nombre: 'Dominada pronación (strict)', nivel: 'Intermedio', categoria: 'Tracción', patron: 'Tracción vertical', equipamiento: 'Barra', series_reps_objetivo: '3-5x3-8', criterio_de_progreso: 'Completa 8 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dominadas negativas', progresion_hacia: 'Dominada lastrada/archer', notas: 'Evita kipping.'},
  {id: 31, exercise_id: 'chin-up-supinacion-strict', nombre: 'Chin-up (supinación strict)', nivel: 'Intermedio', categoria: 'Tracción', patron: 'Tracción vertical', equipamiento: 'Barra', series_reps_objetivo: '3-5x4-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dominadas negativas', progresion_hacia: 'Chin-up lastrado', notas: 'Pecho a la barra.'},
  {id: 32, exercise_id: 'dominadas-negativas-controladas', nombre: 'Dominadas negativas controladas', nivel: 'Intermedio', categoria: 'Tracción', patron: 'Control excéntrico', equipamiento: 'Barra', series_reps_objetivo: '3-5x3-6 (3-5s bajada)', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Scap pull', progresion_hacia: 'Dominada strict', notas: 'Evita rebotes.'},
  {id: 33, exercise_id: 'hanging-knee-raises', nombre: 'Hanging knee raises', nivel: 'Intermedio', categoria: 'Core', patron: 'Flexión de cadera', equipamiento: 'Barra', series_reps_objetivo: '3-5x6-12', criterio_de_progreso: 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Tuck raises', progresion_hacia: 'Toes-to-bar parcial', notas: 'Cuelga sin balanceo.'},
  {id: 34, exercise_id: 'hanging-leg-raises-tuck', nombre: 'Hanging leg raises (tuck)', nivel: 'Intermedio', categoria: 'Core', patron: 'Flexión de cadera', equipamiento: 'Barra', series_reps_objetivo: '3-5x4-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Knee raises', progresion_hacia: 'Leg raises', notas: 'Retroversión pélvica.'},
  {id: 35, exercise_id: 'l-sit-tuck-en-paralelas', nombre: 'L-sit tuck en paralelas', nivel: 'Intermedio', categoria: 'Core', patron: 'Compresión', equipamiento: 'Paralelas', series_reps_objetivo: '3-5x10-20s', criterio_de_progreso: 'Sostén 20s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Soporte en paralelas', progresion_hacia: 'L-sit', notas: 'Piernas juntas.'},
  {id: 36, exercise_id: 'hollow-body-30-45s', nombre: 'Hollow body 30-45s', nivel: 'Intermedio', categoria: 'Core', patron: 'Anti-extensión', equipamiento: 'Suelo', series_reps_objetivo: '3-4x30-45s', criterio_de_progreso: 'Sostén 45s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Hollow tuck', progresion_hacia: 'Hollow rocks', notas: 'Respira bajo control.'},
  {id: 37, exercise_id: 'sentadilla-libre-profunda', nombre: 'Sentadilla libre profunda', nivel: 'Intermedio', categoria: 'Piernas', patron: 'Sentadilla', equipamiento: 'Suelo', series_reps_objetivo: '3-5x8-15', criterio_de_progreso: 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Sentadilla aire', progresion_hacia: 'Pistol a caja', notas: 'Talones apoyados.'},
  {id: 38, exercise_id: 'bulgarian-split-squat', nombre: 'Bulgarian split squat', nivel: 'Intermedio', categoria: 'Piernas', patron: 'Sentadilla unilateral', equipamiento: 'Banco', series_reps_objetivo: '3-5x6-12/lado', criterio_de_progreso: 'Completa 12/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Zancada libre', progresion_hacia: 'Shrimp squat', notas: 'Torso ligeramente inclinado.'},
  {id: 39, exercise_id: 'pistol-squat-a-caja', nombre: 'Pistol squat a caja', nivel: 'Intermedio', categoria: 'Piernas', patron: 'Sentadilla unilateral', equipamiento: 'Banco', series_reps_objetivo: '3-5x3-8/lado', criterio_de_progreso: 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Sentadilla libre', progresion_hacia: 'Pistol squat completo', notas: 'Controla rodilla.'},
  {id: 40, exercise_id: 'nordic-curl-excentrico', nombre: 'Nordic curl excéntrico', nivel: 'Intermedio', categoria: 'Piernas', patron: 'Isquios (excéntrico)', equipamiento: 'Anclaje pies', series_reps_objetivo: '3-5x3-6 (bajada 3-5s)', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Curl femoral isométrico', progresion_hacia: 'Nordic parcial concéntrico', notas: 'Cadera extendida.'},
  {id: 41, exercise_id: 'elevacion-de-gemelos-a-1-pierna', nombre: 'Elevación de gemelos a 1 pierna', nivel: 'Intermedio', categoria: 'Piernas', patron: 'Pantorrilla', equipamiento: 'Escalón', series_reps_objetivo: '3-5x10-20/lado', criterio_de_progreso: 'Completa 20/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Gemelos bilaterales', progresion_hacia: 'Gemelos 1P con pausa', notas: 'Pausa arriba 1-2s.'},
  {id: 42, exercise_id: 'handstand-asistido-a-pared-hold', nombre: 'Handstand asistido a pared (hold)', nivel: 'Intermedio', categoria: 'Equilibrio/Soporte', patron: 'Equilibrio invertido', equipamiento: 'Pared', series_reps_objetivo: '3-5x20-40s', criterio_de_progreso: 'Sostén 40s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Pike push-up', progresion_hacia: 'Handstand libre', notas: 'Empuja el suelo.'},
  {id: 43, exercise_id: 'crow-pose-equilibrio-brazos', nombre: 'Crow pose (equilibrio brazos)', nivel: 'Intermedio', categoria: 'Equilibrio/Soporte', patron: 'Equilibrio sobre manos', equipamiento: 'Suelo', series_reps_objetivo: '3-5x10-30s', criterio_de_progreso: 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: null, progresion_hacia: 'Variantes crow', notas: 'Mirada al frente.'},

  // AVANZADO (22 ejercicios)
  {id: 44, exercise_id: 'flexion-a-una-mano', nombre: 'Flexión a una mano', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Empuje horizontal unilateral', equipamiento: 'Suelo', series_reps_objetivo: '4-6x3-6/lado', criterio_de_progreso: 'Completa 6/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión archer', progresion_hacia: 'Flexión 1M pies elevados', notas: 'Mantén cadera cuadrada.'},
  {id: 45, exercise_id: 'flexion-pliometrica-con-palmada', nombre: 'Flexión pliométrica (con palmada)', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Empuje horizontal explosivo', equipamiento: 'Suelo', series_reps_objetivo: '5-8x3-6', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Flexión estándar', progresion_hacia: 'Flexión pliométrica avanzada', notas: 'Codos suaves al aterrizar.'},
  {id: 46, exercise_id: 'handstand-push-up-pared', nombre: 'Handstand push-up (pared)', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Empuje vertical', equipamiento: 'Pared', series_reps_objetivo: '4-6x2-6', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Pike push-up', progresion_hacia: 'HSPU libre/deficit', notas: 'ROM completo.'},
  {id: 47, exercise_id: 'handstand-libre-30-60s', nombre: 'Handstand libre 30-60s', nivel: 'Avanzado', categoria: 'Equilibrio/Soporte', patron: 'Equilibrio invertido', equipamiento: 'Suelo', series_reps_objetivo: '3-5x30-60s', criterio_de_progreso: 'Sostén 60s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'HS asistido pared', progresion_hacia: 'Press to handstand', notas: 'Cuerpo en línea.'},
  {id: 48, exercise_id: 'planche-lean-avanzada', nombre: 'Planche lean avanzada', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Estático adelantado', equipamiento: 'Paralelas', series_reps_objetivo: '5-8x10-20s', criterio_de_progreso: 'Sostén 20s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'PSP', progresion_hacia: 'Tuck planche', notas: 'Proyección hombros.'},
  {id: 49, exercise_id: 'tuck-planche-5-10s', nombre: 'Tuck planche 5-10s', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Estático', equipamiento: 'Paralelas/Anillas', series_reps_objetivo: '6-10x5-10s', criterio_de_progreso: 'Sostén 10s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Planche lean', progresion_hacia: 'Straddle planche', notas: 'Codos bloqueados.'},
  {id: 50, exercise_id: 'dominada-explosiva-al-pecho', nombre: 'Dominada explosiva (al pecho)', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Tracción vertical explosiva', equipamiento: 'Barra', series_reps_objetivo: '5-8x3-6', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dominada strict', progresion_hacia: 'Muscle-up barra', notas: 'Toca pecho en barra.'},
  {id: 51, exercise_id: 'archer-pull-up-typewriter', nombre: 'Archer pull-up / Typewriter', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Tracción vertical unilateral', equipamiento: 'Barra', series_reps_objetivo: '4-6x3-6/lado', criterio_de_progreso: 'Completa 6/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dominada strict', progresion_hacia: '1-arm chin-up (asist.)', notas: 'Controla la bajada.'},
  {id: 52, exercise_id: 'one-arm-chin-up-asist-neg', nombre: 'One-arm chin-up (asist./neg.)', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Tracción unilateral', equipamiento: 'Barra', series_reps_objetivo: '6-10x1-3/lado', criterio_de_progreso: 'Completa 3/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Archer pull-up', progresion_hacia: 'One-arm chin-up strict', notas: 'Usa banda/asistencia.'},
  {id: 53, exercise_id: 'muscle-up-en-barra-strict', nombre: 'Muscle-up en barra (strict)', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Tracción + Empuje', equipamiento: 'Barra', series_reps_objetivo: '4-6x1-5', criterio_de_progreso: 'Completa 5 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Dominada explosiva', progresion_hacia: 'Muscle-up lastrado', notas: 'Transición limpia, sin kipping.'},
  {id: 54, exercise_id: 'muscle-up-en-anillas-strict', nombre: 'Muscle-up en anillas (strict)', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Tracción + Empuje', equipamiento: 'Anillas', series_reps_objetivo: '4-6x1-5', criterio_de_progreso: 'Completa 5 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Transición en anillas bajas', progresion_hacia: 'Muscle-up lastrado', notas: 'False grip sólido.'},
  {id: 55, exercise_id: 'front-lever-advanced-tuck-straddle', nombre: 'Front lever – advanced tuck/straddle', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Estático', equipamiento: 'Barra/Anillas', series_reps_objetivo: '6-10x5-15s', criterio_de_progreso: 'Sostén 15s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Front lever tuck', progresion_hacia: 'Front lever full', notas: 'Depresión escapular.'},
  {id: 56, exercise_id: 'back-lever-advanced-tuck-straddle', nombre: 'Back lever – advanced tuck/straddle', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Estático', equipamiento: 'Anillas/Barra', series_reps_objetivo: '6-10x5-15s', criterio_de_progreso: 'Sostén 15s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Back lever tuck', progresion_hacia: 'Back lever full', notas: 'Codos bloqueados.'},
  {id: 57, exercise_id: 'human-flag-tuck', nombre: 'Human flag (tuck)', nivel: 'Avanzado', categoria: 'Tracción', patron: 'Estático lateral', equipamiento: 'Barra vertical', series_reps_objetivo: '6-10x3-8s', criterio_de_progreso: 'Sostén 8s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Band-assisted flag', progresion_hacia: 'Human flag straddle', notas: 'Hombro inferior fuerte.'},
  {id: 58, exercise_id: 'dragon-flag-3-8-reps', nombre: 'Dragon flag 3-8 reps', nivel: 'Avanzado', categoria: 'Core', patron: 'Anti-extensión dinámica', equipamiento: 'Banco/Barra', series_reps_objetivo: '4-6x3-8', criterio_de_progreso: 'Completa 8 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Hollow rocks / elevaciones', progresion_hacia: 'Dragon flag avanzado', notas: 'Cuerpo rígido.'},
  {id: 59, exercise_id: 'l-sit-20-30s', nombre: 'L-sit 20-30s', nivel: 'Avanzado', categoria: 'Core', patron: 'Compresión', equipamiento: 'Paralelas/Anillas', series_reps_objetivo: '5-8x20-30s', criterio_de_progreso: 'Sostén 30s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'L-sit tuck', progresion_hacia: 'V-sit', notas: 'Rodillas extendidas.'},
  {id: 60, exercise_id: 'v-sit-5-10s', nombre: 'V-sit 5-10s', nivel: 'Avanzado', categoria: 'Core', patron: 'Compresión avanzada', equipamiento: 'Paralelas/Suelo', series_reps_objetivo: '6-10x5-10s', criterio_de_progreso: 'Sostén 10s con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'L-sit', progresion_hacia: 'Manna (progresión)', notas: 'Caderas en anteversión.'},
  {id: 61, exercise_id: 'pistol-squat-completo', nombre: 'Pistol squat completo', nivel: 'Avanzado', categoria: 'Piernas', patron: 'Sentadilla unilateral', equipamiento: 'Suelo', series_reps_objetivo: '4-6x3-8/lado', criterio_de_progreso: 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Pistol a caja', progresion_hacia: 'Pistol lastrado', notas: 'Talón apoyado.'},
  {id: 62, exercise_id: 'shrimp-squat-avanzado', nombre: 'Shrimp squat avanzado', nivel: 'Avanzado', categoria: 'Piernas', patron: 'Sentadilla unilateral', equipamiento: 'Suelo', series_reps_objetivo: '4-6x3-8/lado', criterio_de_progreso: 'Completa 8/lado con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Bulgarian split squat', progresion_hacia: 'Shrimp squat profundo', notas: 'Controla la rodilla.'},
  {id: 63, exercise_id: 'nordic-curl-concentrico', nombre: 'Nordic curl concéntrico', nivel: 'Avanzado', categoria: 'Piernas', patron: 'Isquios (fuerza)', equipamiento: 'Anclaje pies', series_reps_objetivo: '4-6x3-6', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Nordic excéntrico', progresion_hacia: 'Nordic con lastre', notas: 'Cadera extendida.'},
  {id: 64, exercise_id: 'toes-to-bar-estricto', nombre: 'Toes-to-bar (estricto)', nivel: 'Avanzado', categoria: 'Core', patron: 'Flexión de cadera', equipamiento: 'Barra', series_reps_objetivo: '4-6x5-10', criterio_de_progreso: 'Completa 10 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Hanging leg raises', progresion_hacia: 'Windshield wipers (prog.)', notas: 'Evita balanceo.'},
  {id: 65, exercise_id: 'explosive-dips-dips-en-anillas', nombre: 'Explosive dips / Dips en anillas', nivel: 'Avanzado', categoria: 'Empuje', patron: 'Empuje vertical inferior explosivo', equipamiento: 'Paralelas/Anillas', series_reps_objetivo: '5-8x3-6', criterio_de_progreso: 'Completa 6 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', progresion_desde: 'Fondos strict', progresion_hacia: 'Dips lastrados', notas: 'Bloquea codos arriba.'}
];

async function createAndPopulateCalistenia() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando creación de tabla y población con', ejerciciosData.length, 'ejercicios...');
    
    await client.query('BEGIN');
    
    // Crear tabla si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS app."Ejercicios_Calistenia" (
        id SERIAL PRIMARY KEY,
        exercise_id TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        nivel TEXT NOT NULL,
        categoria TEXT NOT NULL,
        patron TEXT NOT NULL,
        equipamiento TEXT NOT NULL,
        series_reps_objetivo TEXT NOT NULL,
        criterio_de_progreso TEXT,
        progresion_desde TEXT,
        progresion_hacia TEXT,
        notas TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        CONSTRAINT ck_nivel CHECK (nivel IN ('Básico', 'Intermedio', 'Avanzado'))
      )
    `);
    
    console.log('✅ Tabla creada exitosamente');
    
    // Limpiar datos existentes
    await client.query('DELETE FROM app."Ejercicios_Calistenia"');
    await client.query('ALTER SEQUENCE app."Ejercicios_Calistenia_id_seq" RESTART WITH 1');
    console.log('🗑️ Datos anteriores eliminados');
    
    // Insertar todos los ejercicios
    let inserted = 0;
    for (const ejercicio of ejerciciosData) {
      const insertQuery = `
        INSERT INTO app."Ejercicios_Calistenia" (
          exercise_id, nombre, nivel, categoria, patron, equipamiento, 
          series_reps_objetivo, criterio_de_progreso, progresion_desde, 
          progresion_hacia, notas, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `;
      
      await client.query(insertQuery, [
        ejercicio.exercise_id,
        ejercicio.nombre,
        ejercicio.nivel,
        ejercicio.categoria,
        ejercicio.patron,
        ejercicio.equipamiento,
        ejercicio.series_reps_objetivo,
        ejercicio.criterio_de_progreso,
        ejercicio.progresion_desde,
        ejercicio.progresion_hacia,
        ejercicio.notas
      ]);
      
      inserted++;
      if (inserted % 15 === 0) {
        console.log(`✅ Insertados ${inserted}/${ejerciciosData.length} ejercicios...`);
      }
    }
    
    await client.query('COMMIT');
    
    // Verificar datos insertados
    const countResult = await client.query('SELECT COUNT(*) as total FROM app."Ejercicios_Calistenia"');
    const byLevel = await client.query(`
      SELECT nivel, COUNT(*) as count 
      FROM app."Ejercicios_Calistenia" 
      GROUP BY nivel 
      ORDER BY CASE nivel 
        WHEN 'Básico' THEN 1 
        WHEN 'Intermedio' THEN 2 
        WHEN 'Avanzado' THEN 3 
      END
    `);
    
    // Mostrar muestra de ejercicios con nombres correctos
    const sample = await client.query(`
      SELECT exercise_id, nombre, nivel, categoria 
      FROM app."Ejercicios_Calistenia" 
      WHERE nombre LIKE '%ó%' OR nombre LIKE '%í%' OR nombre LIKE '%é%'
      LIMIT 5
    `);
    
    console.log('\\n🎉 ¡TABLA CREADA Y POBLADA EXITOSAMENTE!');
    console.log('📊 Total ejercicios:', countResult.rows[0].total);
    console.log('📋 Por nivel:');
    byLevel.rows.forEach(row => {
      console.log(`  ${row.nivel}: ${row.count} ejercicios`);
    });
    
    console.log('\\n📝 Muestra de ejercicios con acentos correctos:');
    sample.rows.forEach(row => {
      console.log(`  ${row.nivel} - ${row.categoria}: ${row.nombre}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la creación/población:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar el script
createAndPopulateCalistenia()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script falló:', error.message);
    process.exit(1);
  });