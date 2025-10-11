-- ===========================================================================
-- TABLA DE EJERCICIOS: ENTRENAMIENTO FUNCIONAL
-- ===========================================================================
-- Descripción: Base de datos de ejercicios de entrenamiento funcional
-- Enfoque: Movimientos multiarticulares que replican patrones de vida diaria
-- Principios: Coordinación, estabilidad, fuerza aplicada, movilidad
-- Autor: Claude Code - Arquitectura Modular Profesional
-- Fecha: 2025-10-10
-- ===========================================================================

-- Eliminar tabla si existe (solo para desarrollo)
DROP TABLE IF EXISTS app."Ejercicios_Funcional" CASCADE;

-- Crear tabla principal
CREATE TABLE app."Ejercicios_Funcional" (
  exercise_id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  nivel VARCHAR(50) NOT NULL, -- 'Principiante', 'Intermedio', 'Avanzado'
  categoria VARCHAR(100) NOT NULL, -- 'Empuje', 'Tracción', 'Piernas', 'Core', 'Pliométrico', 'Movilidad', 'Carga'
  patron VARCHAR(255) NOT NULL, -- 'Squat', 'Hinge', 'Push', 'Pull', 'Rotation', 'Anti-rotation', 'Locomotion', 'Carry'
  equipamiento TEXT[] NOT NULL, -- ['Peso corporal', 'Kettlebell', 'TRX', 'Medicine Ball', etc.]
  series_reps_objetivo VARCHAR(100), -- '3 x 12', '4 x 8-10', '3 x 20 seg', etc.
  descanso_seg INTEGER, -- Descanso recomendado en segundos
  tempo VARCHAR(50), -- '2-0-2-0', 'Controlado', 'Explosivo'
  criterio_de_progreso TEXT,
  progresion_desde VARCHAR(255), -- Ejercicio previo en progresión
  progresion_hacia VARCHAR(255), -- Siguiente ejercicio en progresión
  notas TEXT,
  gif_url TEXT, -- URL opcional del GIF demostrativo
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización de queries
CREATE INDEX idx_ejercicios_funcional_nivel ON app."Ejercicios_Funcional"(nivel);
CREATE INDEX idx_ejercicios_funcional_categoria ON app."Ejercicios_Funcional"(categoria);
CREATE INDEX idx_ejercicios_funcional_patron ON app."Ejercicios_Funcional"(patron);
CREATE INDEX idx_ejercicios_funcional_equipamiento ON app."Ejercicios_Funcional" USING GIN(equipamiento);

-- Comentarios de documentación
COMMENT ON TABLE app."Ejercicios_Funcional" IS 'Catálogo de ejercicios de entrenamiento funcional clasificados por nivel, categoría y patrón de movimiento';
COMMENT ON COLUMN app."Ejercicios_Funcional".exercise_id IS 'ID numérico único (PRIMARY KEY)';
COMMENT ON COLUMN app."Ejercicios_Funcional".slug IS 'Identificador textual legible (ej: sentadilla-goblet)';
COMMENT ON COLUMN app."Ejercicios_Funcional".nivel IS 'Nivel de dificultad: Principiante, Intermedio, Avanzado';
COMMENT ON COLUMN app."Ejercicios_Funcional".categoria IS 'Categoría del ejercicio: Empuje, Tracción, Piernas, Core, Pliométrico, Movilidad, Carga';
COMMENT ON COLUMN app."Ejercicios_Funcional".patron IS 'Patrón de movimiento funcional primario';
COMMENT ON COLUMN app."Ejercicios_Funcional".equipamiento IS 'Array de equipamiento necesario';
COMMENT ON COLUMN app."Ejercicios_Funcional".descanso_seg IS 'Descanso recomendado entre series en segundos (45-90 típico)';

-- ===========================================================================
-- POBLAR TABLA CON EJERCICIOS FUNCIONALES
-- ===========================================================================

-- Función auxiliar para generar slug
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(
    TRANSLATE(text_input,
      'ÁÉÍÓÚáéíóúÑñ ',
      'AEIOUaeiouNn-'
    ),
    '[^a-zA-Z0-9-]+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- EJERCICIOS FUNCIONALES - PRINCIPIANTE
-- ===========================================================================

-- EMPUJE FUNCIONAL - Principiante
INSERT INTO app."Ejercicios_Funcional"
(nombre, slug, nivel, categoria, patron, equipamiento, series_reps_objetivo, descanso_seg, tempo, criterio_de_progreso, notas)
VALUES
('Flexiones en pared', 'flexiones-en-pared', 'Principiante', 'Empuje', 'Push', ARRAY['Peso corporal', 'Pared'], '3 x 12-15', 45, 'Controlado', 'Completar 3x15 con buena técnica', 'Patrón de empuje vertical básico. Mantener core activado.'),
('Flexiones en rodillas', 'flexiones-en-rodillas', 'Principiante', 'Empuje', 'Push', ARRAY['Peso corporal', 'Colchoneta'], '3 x 8-12', 60, '2-0-2-0', 'Completar 3x12 antes de progresar', 'Versión modificada de flexión. Codos 45° del cuerpo.'),
('Press overhead con mancuerna ligera', 'press-overhead-mancuerna-ligera', 'Principiante', 'Empuje', 'Push', ARRAY['Mancuerna'], '3 x 10-12', 60, 'Controlado', 'Progresar a 2 mancuernas', 'Trabajo unilateral de empuje vertical. Activar core.'),

-- TRACCIÓN FUNCIONAL - Principiante
('Remo TRX asistido', 'remo-trx-asistido', 'Principiante', 'Tracción', 'Pull', ARRAY['TRX', 'Suspension'], '3 x 10-12', 60, '2-1-2-0', 'Disminuir ángulo progresivamente', 'Ajustar altura para facilitar movimiento. Escápulas retraídas.'),
('Dead hang (cuelgue pasivo)', 'dead-hang', 'Principiante', 'Tracción', 'Pull', ARRAY['Barra'], '3 x 15-30 seg', 90, 'Isométrico', 'Aumentar tiempo de suspensión', 'Fortalecer agarre y activar dorsales. Hombros empacados.'),
('Remo invertido con pies en suelo', 'remo-invertido-pies-suelo', 'Principiante', 'Tracción', 'Pull', ARRAY['Barra baja', 'TRX'], '3 x 8-12', 60, 'Controlado', 'Progresar a pies elevados', 'Cuerpo rígido, tirar con dorsales no con brazos.'),

-- PIERNAS FUNCIONALES - Principiante
('Sentadilla al cajón', 'sentadilla-al-cajon', 'Principiante', 'Piernas', 'Squat', ARRAY['Peso corporal', 'Cajón/Banco'], '3 x 12-15', 60, '2-0-2-0', 'Eliminar cajón progresivamente', 'Patrón de sentadilla asistida. Rodillas alineadas con pies.'),
('Sentadilla goblet ligera', 'sentadilla-goblet-ligera', 'Principiante', 'Piernas', 'Squat', ARRAY['Kettlebell', 'Mancuerna'], '3 x 10-12', 60, 'Controlado', 'Aumentar carga gradualmente', 'Sostener peso a pecho. Profundidad completa.'),
('Peso muerto rumano con mancuernas', 'peso-muerto-rumano-mancuernas', 'Principiante', 'Piernas', 'Hinge', ARRAY['Mancuernas'], '3 x 10-12', 60, '2-1-2-0', 'Progresar a barra', 'Bisagra de cadera. Mantener espalda neutral.'),
('Step-ups a cajón bajo', 'step-ups-cajon-bajo', 'Principiante', 'Piernas', 'Locomotion', ARRAY['Cajón/Escalón'], '3 x 10/lado', 45, 'Controlado', 'Aumentar altura de cajón', 'Subir con pierna de trabajo, no empujar con pierna trasera.'),

-- CORE FUNCIONAL - Principiante
('Plancha frontal', 'plancha-frontal', 'Principiante', 'Core', 'Anti-extension', ARRAY['Peso corporal', 'Colchoneta'], '3 x 20-40 seg', 60, 'Isométrico', 'Aumentar tiempo o añadir inestabilidad', 'Cuerpo rígido, glúteos apretados, no hundirse.'),
('Plancha lateral', 'plancha-lateral', 'Principiante', 'Core', 'Anti-flexión lateral', ARRAY['Peso corporal', 'Colchoneta'], '3 x 15-30 seg/lado', 60, 'Isométrico', 'Progresar a variantes dinámicas', 'Cuerpo alineado, core apretado, no rotar.'),
('Dead bug', 'dead-bug', 'Principiante', 'Core', 'Anti-extension', ARRAY['Peso corporal', 'Colchoneta'], '3 x 10-12/lado', 45, 'Controlado', 'Añadir peso o bandas', 'Espalda baja pegada al suelo. Movimiento alternado.'),
('Bird dog', 'bird-dog', 'Principiante', 'Core', 'Anti-rotation', ARRAY['Peso corporal', 'Colchoneta'], '3 x 10/lado', 45, '2-2-2-0', 'Aumentar tiempo de hold', 'Extensión simultánea brazo-pierna opuesta. No rotar cadera.'),

-- MOVILIDAD - Principiante
('Cat-cow (gato-vaca)', 'cat-cow', 'Principiante', 'Movilidad', 'Flexión-extensión', ARRAY['Peso corporal', 'Colchoneta'], '2 x 10-15', 30, 'Fluido', 'Mayor amplitud y control', 'Movilidad de columna torácica. Respiración coordinada.'),
('Rotaciones torácicas en cuadrupedia', 'rotaciones-toracicas-cuadrupedia', 'Principiante', 'Movilidad', 'Rotation', ARRAY['Peso corporal', 'Colchoneta'], '2 x 10/lado', 30, 'Controlado', 'Mayor rotación y estabilidad', 'Mano tras la cabeza, seguir con los ojos. Pelvis estable.'),
('Hip circles (círculos de cadera)', 'hip-circles', 'Principiante', 'Movilidad', 'Movilidad articular', ARRAY['Peso corporal'], '2 x 10/dirección', 30, 'Fluido', 'Mayor amplitud de movimiento', 'Círculos controlados de cadera. Ambas direcciones.'),

-- ===========================================================================
-- EJERCICIOS FUNCIONALES - INTERMEDIO
-- ===========================================================================

-- EMPUJE FUNCIONAL - Intermedio
('Flexiones diamante', 'flexiones-diamante', 'Intermedio', 'Empuje', 'Push', ARRAY['Peso corporal'], '3 x 8-12', 60, '2-0-2-0', 'Progresar a deficit o lastradas', 'Énfasis en tríceps. Codos cerca del cuerpo.'),
('Flexiones arqueras', 'flexiones-arqueras', 'Intermedio', 'Empuje', 'Push', ARRAY['Peso corporal'], '3 x 6-10/lado', 75, 'Controlado', 'Progresar a flexión a una mano', 'Transferencia de peso lateral. Control excéntrico.'),
('Press landmine unilateral', 'press-landmine-unilateral', 'Intermedio', 'Empuje', 'Push', ARRAY['Barra', 'Landmine'], '3 x 8-10/lado', 60, '2-0-2-0', 'Aumentar carga o añadir rotación', 'Empuje angular. Activar core para evitar rotación.'),
('Turkish get-up con kettlebell', 'turkish-get-up', 'Intermedio', 'Empuje', 'Movimiento complejo', ARRAY['Kettlebell'], '3 x 3-5/lado', 90, 'Controlado', 'Aumentar carga o velocidad', 'Movimiento completo de levantarse. Mirar kettlebell todo el tiempo.'),

-- TRACCIÓN FUNCIONAL - Intermedio
('Dominadas asistidas con banda', 'dominadas-asistidas-banda', 'Intermedio', 'Tracción', 'Pull', ARRAY['Barra', 'Banda elástica'], '3 x 6-10', 90, '2-1-2-0', 'Reducir asistencia o eliminar banda', 'Bajar banda de resistencia gradualmente.'),
('Remo invertido a una mano', 'remo-invertido-una-mano', 'Intermedio', 'Tracción', 'Pull', ARRAY['TRX', 'Barra baja'], '3 x 6-8/lado', 75, 'Controlado', 'Disminuir ángulo o añadir peso', 'Gran demanda de core. Evitar rotación de cadera.'),
('Face pulls con rotación externa', 'face-pulls-rotacion-externa', 'Intermedio', 'Tracción', 'Pull', ARRAY['Polea', 'Banda'], '3 x 12-15', 45, '2-1-2-0', 'Aumentar carga o añadir pausa', 'Salud de hombro. Rotadores externos activos.'),

-- PIERNAS FUNCIONALES - Intermedio
('Sentadilla búlgara', 'sentadilla-bulgara', 'Intermedio', 'Piernas', 'Squat', ARRAY['Mancuernas', 'Banco'], '3 x 10-12/lado', 60, '2-0-2-0', 'Aumentar carga o profundidad', 'Pie trasero elevado. Torso vertical.'),
('Peso muerto a una pierna con kettlebell', 'peso-muerto-una-pierna-kettlebell', 'Intermedio', 'Piernas', 'Hinge', ARRAY['Kettlebell'], '3 x 8-10/lado', 60, 'Controlado', 'Aumentar carga o déficit', 'Bisagra unilateral. Cadera y hombros cuadrados.'),
('Zancadas caminando con mancuernas', 'zancadas-caminando-mancuernas', 'Intermedio', 'Piernas', 'Locomotion', ARRAY['Mancuernas'], '3 x 10-12/lado', 60, 'Controlado', 'Aumentar carga o distancia', 'Paso largo, rodilla no pasa punta del pie.'),
('Box jumps (saltos al cajón)', 'box-jumps', 'Intermedio', 'Pliométrico', 'Locomotion', ARRAY['Cajón'], '4 x 8-10', 90, 'Explosivo', 'Aumentar altura o añadir peso', 'Aterrizaje suave. Extensión completa en el aire.'),

-- CORE FUNCIONAL - Intermedio
('Plancha con toque de hombro', 'plancha-toque-hombro', 'Intermedio', 'Core', 'Anti-rotation', ARRAY['Peso corporal'], '3 x 10-12/lado', 60, 'Controlado', 'Añadir peso o aumentar tempo', 'Tocar hombro opuesto sin rotar cadera.'),
('L-sit hold en paralelas', 'l-sit-paralelas', 'Intermedio', 'Core', 'Anti-extension', ARRAY['Paralelas'], '3 x 15-30 seg', 75, 'Isométrico', 'Aumentar tiempo o V-sit', 'Piernas extendidas a 90°. Escápulas deprimidas.'),
('Pallof press', 'pallof-press', 'Intermedio', 'Core', 'Anti-rotation', ARRAY['Polea', 'Banda'], '3 x 10-12/lado', 45, '2-2-2-0', 'Aumentar resistencia o distancia', 'Resistir rotación del tronco. Brazos extendidos.'),
('Russian twist con medicine ball', 'russian-twist-medicine-ball', 'Intermedio', 'Core', 'Rotation', ARRAY['Medicine Ball'], '3 x 20 (10/lado)', 45, 'Controlado', 'Aumentar peso o velocidad', 'Rotación de tronco. Pies pueden estar elevados.'),

-- CARGA Y TRANSPORTE - Intermedio
('Farmer carry (carga de granjero)', 'farmer-carry', 'Intermedio', 'Carga', 'Carry', ARRAY['Mancuernas', 'Kettlebells'], '3 x 20-30 metros', 60, 'Controlado', 'Aumentar carga o distancia', 'Caminar con peso en ambas manos. Postura erguida.'),
('Suitcase carry (carga de maleta)', 'suitcase-carry', 'Intermedio', 'Carga', 'Carry', ARRAY['Mancuerna', 'Kettlebell'], '3 x 20 metros/lado', 60, 'Controlado', 'Aumentar carga', 'Peso en un solo lado. Resistir flexión lateral.'),

-- ===========================================================================
-- EJERCICIOS FUNCIONALES - AVANZADO
-- ===========================================================================

-- EMPUJE FUNCIONAL - Avanzado
('Flexiones a una mano', 'flexiones-una-mano', 'Avanzado', 'Empuje', 'Push', ARRAY['Peso corporal'], '3 x 4-8/lado', 90, 'Controlado', 'Añadir déficit o lastre', 'Pies separados para estabilidad. Core muy activo.'),
('Handstand push-ups en pared', 'handstand-push-ups-pared', 'Avanzado', 'Empuje', 'Push', ARRAY['Peso corporal', 'Pared'], '3 x 5-8', 120, '2-0-2-0', 'Progresar a freestanding', 'Empuje vertical invertido. Cabeza toca suelo.'),
('Planche lean', 'planche-lean', 'Avanzado', 'Empuje', 'Push', ARRAY['Peso corporal'], '3 x 10-20 seg', 90, 'Isométrico', 'Aumentar inclinación o tuck planche', 'Progresión a planche. Hombros protraídos.'),

-- TRACCIÓN FUNCIONAL - Avanzado
('Dominadas con lastre', 'dominadas-con-lastre', 'Avanzado', 'Tracción', 'Pull', ARRAY['Barra', 'Chaleco/Cinturón de lastre'], '3 x 6-10', 120, '2-1-2-0', 'Aumentar carga', 'Añadir peso progresivamente. Técnica estricta.'),
('Muscle-up (subida a barra)', 'muscle-up', 'Avanzado', 'Tracción', 'Movimiento complejo', ARRAY['Barra'], '3 x 3-6', 150, 'Explosivo', 'Muscle-up estricto o en anillas', 'Transición dominada-fondo. Requiere fuerza y técnica.'),
('Front lever hold (estático)', 'front-lever-hold', 'Avanzado', 'Tracción', 'Pull', ARRAY['Barra'], '3 x 5-15 seg', 120, 'Isométrico', 'Aumentar tiempo o progresiones', 'Cuerpo horizontal bajo la barra. Core extremadamente activo.'),

-- PIERNAS FUNCIONALES - Avanzado
('Pistol squat (sentadilla a una pierna)', 'pistol-squat', 'Avanzado', 'Piernas', 'Squat', ARRAY['Peso corporal'], '3 x 5-8/lado', 90, '2-0-2-0', 'Añadir peso o déficit', 'Sentadilla completa unilateral. Pierna extendida al frente.'),
('Peso muerto con barra a una pierna', 'peso-muerto-barra-una-pierna', 'Avanzado', 'Piernas', 'Hinge', ARRAY['Barra'], '3 x 6-8/lado', 90, 'Controlado', 'Aumentar carga', 'Bisagra unilateral con carga significativa.'),
('Box jumps a altura máxima', 'box-jumps-maximos', 'Avanzado', 'Pliométrico', 'Locomotion', ARRAY['Cajón alto'], '4 x 5-8', 120, 'Explosivo', 'Añadir peso o salto de profundidad', 'Máxima potencia. Aterrizaje seguro prioritario.'),
('Broad jumps (saltos de longitud)', 'broad-jumps', 'Avanzado', 'Pliométrico', 'Locomotion', ARRAY['Peso corporal'], '4 x 8-10', 90, 'Explosivo', 'Aumentar distancia o añadir lastre', 'Salto horizontal máximo. Brazos impulsan.'),

-- CORE FUNCIONAL - Avanzado
('Dragon flag', 'dragon-flag', 'Avanzado', 'Core', 'Anti-extension', ARRAY['Banco'], '3 x 5-8', 120, '3-0-3-0', 'Añadir rango o repeticiones', 'Core extremo. Solo hombros tocan banco.'),
('V-sit hold', 'v-sit-hold', 'Avanzado', 'Core', 'Anti-extension', ARRAY['Peso corporal'], '3 x 20-40 seg', 90, 'Isométrico', 'Aumentar tiempo', 'Piernas y tronco a 45°. Balance sobre glúteos.'),
('Windshield wipers en barra', 'windshield-wipers', 'Avanzado', 'Core', 'Rotation', ARRAY['Barra'], '3 x 8-12', 90, 'Controlado', 'Mayor amplitud o peso en tobillos', 'Colgado de barra, rotar piernas lado a lado.'),
('Ab wheel rollout completo', 'ab-wheel-rollout', 'Avanzado', 'Core', 'Anti-extension', ARRAY['Ab wheel'], '3 x 8-12', 75, '2-0-2-0', 'Rollout de pie', 'Desde rodillas o de pie. Extensión completa sin arquear.'),

-- CARGA Y TRANSPORTE - Avanzado
('Waiter carry (carga de camarero)', 'waiter-carry', 'Avanzado', 'Carga', 'Carry', ARRAY['Kettlebell'], '3 x 20 metros/lado', 60, 'Controlado', 'Aumentar carga o distancia', 'Kettlebell overhead. Estabilidad de hombro extrema.'),
('Yoke carry (yugo)', 'yoke-carry', 'Avanzado', 'Carga', 'Carry', ARRAY['Yugo/Barra pesada'], '3 x 15-20 metros', 90, 'Controlado', 'Aumentar carga', 'Carga pesada sobre hombros. Caminar con control.'),
('Sandbag shoulder (saco a hombro)', 'sandbag-shoulder', 'Avanzado', 'Carga', 'Movimiento complejo', ARRAY['Sandbag'], '3 x 6-8/lado', 90, 'Explosivo', 'Aumentar peso del saco', 'Levantar saco del suelo a hombro. Carga inestable.'),

-- MOVIMIENTOS COMPLEJOS - Avanzado
('Burpee con dominada', 'burpee-con-dominada', 'Avanzado', 'Pliométrico', 'Movimiento complejo', ARRAY['Barra'], '4 x 8-10', 90, 'Explosivo', 'Añadir muscle-up o lastre', 'Burpee + salto a barra + dominada. Metabólicamente demandante.'),
('Devil press con mancuernas', 'devil-press', 'Avanzado', 'Pliométrico', 'Movimiento complejo', ARRAY['Mancuernas'], '4 x 8-10', 90, 'Explosivo', 'Aumentar carga', 'Burpee + remo + clean + press overhead. Cuerpo completo.'),
('Man makers', 'man-makers', 'Avanzado', 'Pliométrico', 'Movimiento complejo', ARRAY['Mancuernas'], '3 x 6-8', 120, 'Controlado', 'Aumentar carga o añadir salto', 'Flexión + remo bilateral + thruster. Altamente demandante.');

-- ===========================================================================
-- VERIFICACIÓN FINAL
-- ===========================================================================

-- Contar ejercicios por nivel
SELECT
  nivel,
  COUNT(*) as total_ejercicios
FROM app."Ejercicios_Funcional"
GROUP BY nivel
ORDER BY
  CASE nivel
    WHEN 'Principiante' THEN 1
    WHEN 'Intermedio' THEN 2
    WHEN 'Avanzado' THEN 3
  END;

-- Contar por categoría
SELECT
  categoria,
  COUNT(*) as total_ejercicios
FROM app."Ejercicios_Funcional"
GROUP BY categoria
ORDER BY total_ejercicios DESC;

-- Contar por patrón de movimiento
SELECT
  patron,
  COUNT(*) as total_ejercicios
FROM app."Ejercicios_Funcional"
GROUP BY patron
ORDER BY total_ejercicios DESC;

-- Ver distribución completa
SELECT
  nivel,
  categoria,
  COUNT(*) as total
FROM app."Ejercicios_Funcional"
GROUP BY nivel, categoria
ORDER BY nivel, categoria;

-- ===========================================================================
-- RESULTADO ESPERADO:
-- Total: 65+ ejercicios funcionales
-- Principiante: ~20 ejercicios
-- Intermedio: ~22 ejercicios
-- Avanzado: ~23 ejercicios
-- Categorías: Empuje, Tracción, Piernas, Core, Pliométrico, Movilidad, Carga
-- ===========================================================================
