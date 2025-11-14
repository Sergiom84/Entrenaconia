-- ============================================================
-- CLASIFICACIÓN AUTOMÁTICA DE EJERCICIOS EXISTENTES
-- ============================================================
-- Script para clasificar ejercicios de Ejercicios_Hipertrofia
-- según tipo (multiarticular/unilateral/analitico) y patrón
-- VERSIÓN CORREGIDA: Ejecutar DESPUÉS de fase1_FIXED.sql
-- ============================================================

-- ============================================================
-- 1. CLASIFICACIÓN POR TIPO DE EJERCICIO
-- ============================================================

-- MULTIARTICULARES: Ejercicios compuestos que involucran 2+ articulaciones
UPDATE app."Ejercicios_Hipertrofia"
SET
  tipo_ejercicio = 'multiarticular',
  orden_recomendado = 1
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%press%banca%',
  '%press%inclinado%',
  '%press%declinado%',
  '%press%militar%',
  '%press%hombro%',
  '%sentadilla%',
  '%squat%',
  '%peso%muerto%',
  '%deadlift%',
  '%dominada%',
  '%pull%up%',
  '%remo%barra%',
  '%remo%sentado%',
  '%jalón%',
  '%lat%pulldown%',
  '%dips%',
  '%fondos%',
  '%prensa%',
  '%leg%press%',
  '%thruster%',
  '%clean%',
  '%snatch%'
])
AND tipo_ejercicio IS NULL;

-- UNILATERALES: Ejercicios asimétricos (un lado a la vez)
UPDATE app."Ejercicios_Hipertrofia"
SET
  tipo_ejercicio = 'unilateral',
  orden_recomendado = 2
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%mancuerna%',
  '%dumbbell%',
  '%zancada%',
  '%lunge%',
  '%bulgarian%',
  '%pistol%',
  '%split%squat%',
  '%step%up%',
  '%unilateral%',
  '%single%arm%',
  '%single%leg%',
  '%remo%mancuerna%',
  '%press%mancuerna%'
])
AND tipo_ejercicio IS NULL;

-- ANALÍTICOS: Ejercicios de aislamiento (1 articulación)
UPDATE app."Ejercicios_Hipertrofia"
SET
  tipo_ejercicio = 'analitico',
  orden_recomendado = 3
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%curl%',
  '%extensión%',
  '%extension%',
  '%elevación%lateral%',
  '%lateral%raise%',
  '%fly%',
  '%aperturas%',
  '%contracción%',
  '%face%pull%',
  '%pull%apart%',
  '%leg%curl%',
  '%leg%extension%',
  '%calf%raise%',
  '%gemelo%',
  '%crunch%',
  '%plancha%',
  '%plank%',
  '%abdomen%'
])
AND tipo_ejercicio IS NULL;

-- Casos especiales por categoría
UPDATE app."Ejercicios_Hipertrofia"
SET
  tipo_ejercicio = 'analitico',
  orden_recomendado = 3
WHERE categoria IN ('Bíceps', 'Tríceps', 'Core', 'Antebrazo')
  AND tipo_ejercicio IS NULL;

-- Multiarticulares por categoría si no están clasificados
UPDATE app."Ejercicios_Hipertrofia"
SET
  tipo_ejercicio = 'multiarticular',
  orden_recomendado = 1
WHERE categoria IN ('Pecho', 'Espalda', 'Piernas (cuádriceps)', 'Piernas (femoral)')
  AND tipo_ejercicio IS NULL
  AND LOWER(nombre) NOT LIKE '%curl%'
  AND LOWER(nombre) NOT LIKE '%extensión%'
  AND LOWER(nombre) NOT LIKE '%fly%';

-- ============================================================
-- 2. CLASIFICACIÓN POR PATRÓN DE MOVIMIENTO
-- ============================================================

-- EMPUJE HORIZONTAL (Pecho principalmente)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'empuje_horizontal'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%press%banca%',
  '%bench%press%',
  '%press%plano%',
  '%fondos%',
  '%dips%'
])
AND categoria = 'Pecho';

-- EMPUJE VERTICAL (Hombros principalmente)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'empuje_vertical'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%press%militar%',
  '%press%hombro%',
  '%shoulder%press%',
  '%press%vertical%',
  '%press%inclinado%'
])
OR categoria = 'Hombro';

-- TRACCIÓN VERTICAL (Dominadas, jalones)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'traccion_vertical'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%dominada%',
  '%pull%up%',
  '%jalón%',
  '%pulldown%',
  '%lat%pull%'
]);

-- TRACCIÓN HORIZONTAL (Remos)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'traccion_horizontal'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%remo%',
  '%row%',
  '%pull%apart%',
  '%face%pull%'
])
AND categoria IN ('Espalda', 'Espalda (dorsal)');

-- CADENA POSTERIOR (Peso muerto, RDL, femorales)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'cadena_posterior'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%peso%muerto%',
  '%deadlift%',
  '%rdl%',
  '%rumano%',
  '%good%morning%',
  '%hip%thrust%',
  '%glute%bridge%',
  '%curl%femoral%',
  '%leg%curl%'
])
OR categoria IN ('Piernas (femoral)', 'Glúteos');

-- CUÁDRICEPS DOMINANTE (Sentadillas, prensa, extensiones)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'cuadriceps_dominante'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%sentadilla%',
  '%squat%',
  '%prensa%',
  '%leg%press%',
  '%zancada%',
  '%lunge%',
  '%step%up%',
  '%leg%extension%',
  '%extensión%cuadriceps%'
])
OR categoria = 'Piernas (cuádriceps)';

-- AISLAMIENTO BÍCEPS
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'aislamiento_biceps'
WHERE categoria = 'Bíceps'
   OR LOWER(nombre) LIKE '%curl%bicep%';

-- AISLAMIENTO TRÍCEPS
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'aislamiento_triceps'
WHERE categoria = 'Tríceps'
   OR LOWER(nombre) LIKE '%extensión%tricep%'
   OR LOWER(nombre) LIKE '%pushdown%';

-- AISLAMIENTO PECHO (Flies, aperturas)
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'aislamiento_pecho'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%fly%',
  '%apertura%',
  '%pec%deck%',
  '%cable%cross%'
])
AND categoria = 'Pecho';

-- AISLAMIENTO HOMBRO LATERAL
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'aislamiento_hombro_lateral'
WHERE LOWER(nombre) LIKE '%elevación%lateral%'
   OR LOWER(nombre) LIKE '%lateral%raise%';

-- CORE / ESTABILIZACIÓN
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'core_estabilizacion'
WHERE categoria = 'Core'
   OR LOWER(nombre) LIKE ANY(ARRAY[
     '%plancha%',
     '%plank%',
     '%pallof%',
     '%dead%bug%',
     '%bird%dog%'
   ]);

-- CORE / FLEXIÓN
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = 'core_flexion'
WHERE LOWER(nombre) LIKE ANY(ARRAY[
  '%crunch%',
  '%sit%up%',
  '%leg%raise%',
  '%elevación%piernas%'
])
AND categoria = 'Core';

-- ============================================================
-- 3. CASOS NO CLASIFICADOS (fallback)
-- ============================================================

-- Si aún no tiene tipo, asignar por categoría
UPDATE app."Ejercicios_Hipertrofia"
SET tipo_ejercicio = CASE
  WHEN categoria IN ('Bíceps', 'Tríceps', 'Core', 'Antebrazo') THEN 'analitico'
  WHEN categoria IN ('Hombro') THEN 'multiarticular'
  ELSE 'unilateral'  -- Asumimos unilateral por defecto si no sabemos
END,
orden_recomendado = CASE
  WHEN categoria IN ('Bíceps', 'Tríceps', 'Core', 'Antebrazo') THEN 3
  WHEN categoria IN ('Hombro') THEN 1
  ELSE 2
END
WHERE tipo_ejercicio IS NULL;

-- Si aún no tiene patrón, asignar genérico por categoría
UPDATE app."Ejercicios_Hipertrofia"
SET patron_movimiento = CASE
  WHEN categoria = 'Pecho' THEN 'empuje_horizontal'
  WHEN categoria = 'Espalda' OR categoria = 'Espalda (dorsal)' THEN 'traccion_horizontal'
  WHEN categoria = 'Hombro' THEN 'empuje_vertical'
  WHEN categoria LIKE 'Piernas%' THEN 'cuadriceps_dominante'
  WHEN categoria = 'Bíceps' THEN 'aislamiento_biceps'
  WHEN categoria = 'Tríceps' THEN 'aislamiento_triceps'
  WHEN categoria = 'Core' THEN 'core_estabilizacion'
  ELSE 'general'
END
WHERE patron_movimiento IS NULL;

-- ============================================================
-- 4. VERIFICACIÓN Y REPORTE
-- ============================================================

-- Contar ejercicios por tipo
SELECT
  tipo_ejercicio,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM app."Ejercicios_Hipertrofia"), 1) as porcentaje
FROM app."Ejercicios_Hipertrofia"
WHERE nivel = 'Principiante'  -- Solo principiantes para FASE 1
GROUP BY tipo_ejercicio
ORDER BY tipo_ejercicio;

-- Contar ejercicios por patrón
SELECT
  patron_movimiento,
  COUNT(*) as total
FROM app."Ejercicios_Hipertrofia"
WHERE nivel = 'Principiante'
GROUP BY patron_movimiento
ORDER BY COUNT(*) DESC
LIMIT 15;

-- Ejercicios por categoría y tipo (para validar)
SELECT
  categoria,
  tipo_ejercicio,
  COUNT(*) as total
FROM app."Ejercicios_Hipertrofia"
WHERE nivel = 'Principiante'
GROUP BY categoria, tipo_ejercicio
ORDER BY categoria, tipo_ejercicio;

-- Ejemplos de ejercicios clasificados
SELECT
  nombre,
  categoria,
  tipo_ejercicio,
  patron_movimiento,
  orden_recomendado
FROM app."Ejercicios_Hipertrofia"
WHERE nivel = 'Principiante'
ORDER BY orden_recomendado, categoria, nombre
LIMIT 30;

-- ============================================================
-- FIN DE CLASIFICACIÓN (VERSIÓN CORREGIDA)
-- ============================================================
-- Este script debe ejecutarse DESPUÉS de fase1_FIXED.sql
-- ============================================================
