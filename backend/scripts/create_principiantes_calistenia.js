/**
 * Script para crear tabla de ejercicios de calistenia específicamente para principiantes
 * Basado en los nuevos patrones: 4-6 ejercicios por sesión, 2-3 veces por semana
 * 6 patrones fundamentales: Empuje, Tracción, Dominante rodilla, Bisagra cadera, Core, Acondicionamiento
 */

import { pool } from '../db.js';

// Ejercicios específicos para principiantes (patrón-based)
const ejerciciosPrincipiantes = [
  // ==== PATRÓN 1: EMPUJE (Pecho/Hombro) ====
  {
    id: 1,
    exercise_id: 'flexion-pared-principiante',
    nombre: 'Flexiones contra pared',
    patron_movimiento: 'Empuje horizontal',
    categoria: 'Empuje',
    nivel: 'Principiante',
    equipamiento: 'Pared',
    series_objetivo: '2-3',
    reps_objetivo: '8-12',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Colócate a un brazo de distancia de la pared. Apoya las manos a la altura del pecho. Mantén el cuerpo recto y empuja suavemente.',
    progresion: 'Cuando puedas hacer 12 repeticiones fácilmente, aléjate más de la pared o prueba flexiones inclinadas.',
    enfoque_tecnica: 'Codos cerca del cuerpo (45°), core activado, movimiento controlado.',
    frecuencia_semanal: '2-3 días'
  },
  {
    id: 2,
    exercise_id: 'flexion-inclinada-principiante',
    nombre: 'Flexiones inclinadas (banco/escalón)',
    patron_movimiento: 'Empuje horizontal',
    categoria: 'Empuje',
    nivel: 'Principiante',
    equipamiento: 'Banco o escalón',
    series_objetivo: '2-3',
    reps_objetivo: '6-10',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Manos en el banco, cuerpo en línea recta desde pies hasta cabeza. Baja el pecho hacia el banco y empuja.',
    progresion: 'Reduce la altura del banco gradualmente hasta llegar al suelo.',
    enfoque_tecnica: 'Core tenso, glúteos activados, respiración controlada.',
    frecuencia_semanal: '2-3 días'
  },

  // ==== PATRÓN 2: TRACCIÓN (Espalda) ====
  {
    id: 3,
    exercise_id: 'remo-invertido-rodillas',
    nombre: 'Remo invertido con rodillas flexionadas',
    patron_movimiento: 'Tracción horizontal',
    categoria: 'Tracción',
    nivel: 'Principiante',
    equipamiento: 'Mesa resistente o barra baja',
    series_objetivo: '2-3',
    reps_objetivo: '5-8',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Túmbate bajo una mesa resistente. Agarra el borde y tira del cuerpo hacia arriba, manteniendo rodillas flexionadas.',
    progresion: 'Incrementa repeticiones o extiende las piernas gradualmente.',
    enfoque_tecnica: 'Escápulas juntas, pecho hacia fuera, core estable.',
    frecuencia_semanal: '2-3 días'
  },
  {
    id: 4,
    exercise_id: 'jalon-banda-elastica',
    nombre: 'Jalón con banda elástica',
    patron_movimiento: 'Tracción vertical',
    categoria: 'Tracción',
    nivel: 'Principiante',
    equipamiento: 'Banda elástica',
    series_objetivo: '2-3',
    reps_objetivo: '8-12',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Ancla la banda arriba. Tira hacia el pecho con control, apretando las escápulas.',
    progresion: 'Usa banda de mayor resistencia o aumenta repeticiones.',
    enfoque_tecnica: 'Hombros hacia abajo, pecho alto, movimiento controlado.',
    frecuencia_semanal: '2-3 días'
  },

  // ==== PATRÓN 3: DOMINANTE DE RODILLA (Sentadilla) ====
  {
    id: 5,
    exercise_id: 'sentadilla-silla',
    nombre: 'Sentadilla a silla',
    patron_movimiento: 'Dominante rodilla',
    categoria: 'Piernas',
    nivel: 'Principiante',
    equipamiento: 'Silla',
    series_objetivo: '2-3',
    reps_objetivo: '8-12',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Siéntate y levántate de una silla sin usar las manos. Controla ambos movimientos.',
    progresion: 'Reduce uso de brazos, luego prueba sin silla con rango cómodo.',
    enfoque_tecnica: 'Peso en talones, rodillas alineadas con pies, pecho erguido.',
    frecuencia_semanal: '2-3 días'
  },
  {
    id: 6,
    exercise_id: 'sentadilla-rango-comodo',
    nombre: 'Sentadilla rango cómodo',
    patron_movimiento: 'Dominante rodilla',
    categoria: 'Piernas',
    nivel: 'Principiante',
    equipamiento: 'Peso corporal',
    series_objetivo: '2-3',
    reps_objetivo: '10-15',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Baja hasta donde te sientas cómodo, no fuerces el rango. Enfoque en técnica perfecta.',
    progresion: 'Incrementa rango gradualmente y añade repeticiones.',
    enfoque_tecnica: 'Core activo, respiración natural, movimiento fluido.',
    frecuencia_semanal: '2-3 días'
  },

  // ==== PATRÓN 4: BISAGRA DE CADERA ====
  {
    id: 7,
    exercise_id: 'puente-gluteo-basico',
    nombre: 'Puente de glúteo básico',
    patron_movimiento: 'Bisagra cadera',
    categoria: 'Piernas',
    nivel: 'Principiante',
    equipamiento: 'Suelo',
    series_objetivo: '2-3',
    reps_objetivo: '10-15',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Tumbado boca arriba, pies apoyados. Eleva la cadera apretando los glúteos. Pausa arriba.',
    progresion: 'Mantén la posición 2-3 segundos arriba, luego prueba a una pierna.',
    enfoque_tecnica: 'Glúteos activos, core tenso, evita arquear la espalda.',
    frecuencia_semanal: '2-3 días'
  },
  {
    id: 8,
    exercise_id: 'peso-muerto-piernas-rigidas-corporal',
    nombre: 'Peso muerto a piernas rígidas (peso corporal)',
    patron_movimiento: 'Bisagra cadera',
    categoria: 'Piernas',
    nivel: 'Principiante',
    equipamiento: 'Peso corporal',
    series_objetivo: '1-2',
    reps_objetivo: '8-10',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'De pie, inclínate hacia adelante desde la cadera manteniendo espalda recta. Siente estiramiento en isquiotibiales.',
    progresion: 'Incrementa rango de movimiento gradualmente.',
    enfoque_tecnica: 'Espalda neutra, peso en talones, movimiento desde cadera.',
    frecuencia_semanal: '2-3 días'
  },

  // ==== PATRÓN 5: CORE (Anti-extensión) ====
  {
    id: 9,
    exercise_id: 'plancha-rodillas',
    nombre: 'Plancha en rodillas',
    patron_movimiento: 'Anti-extensión',
    categoria: 'Core',
    nivel: 'Principiante',
    equipamiento: 'Suelo',
    series_objetivo: '2-3',
    reps_objetivo: null,
    tiempo_isometrico: '20-30s',
    descanso_seg: '60-90',
    instrucciones: 'En rodillas, antebrazos apoyados. Mantén línea recta desde rodillas hasta cabeza.',
    progresion: 'Aumenta tiempo hasta 45s, luego progresa a plancha completa.',
    enfoque_tecnica: 'Core activo, respiración controlada, evita hundir cadera.',
    frecuencia_semanal: '2-3 días'
  },
  {
    id: 10,
    exercise_id: 'plancha-pared',
    nombre: 'Plancha contra pared',
    patron_movimiento: 'Anti-extensión',
    categoria: 'Core',
    nivel: 'Principiante',
    equipamiento: 'Pared',
    series_objetivo: '2-3',
    reps_objetivo: null,
    tiempo_isometrico: '15-25s',
    descanso_seg: '60-90',
    instrucciones: 'De pie frente a la pared, antebrazos apoyados. Mantén cuerpo recto en ángulo.',
    progresion: 'Aléjate de la pared gradualmente.',
    enfoque_tecnica: 'Core tenso, cuerpo en línea, respiración natural.',
    frecuencia_semanal: '2-3 días'
  },

  // ==== PATRÓN 6: ACONDICIONAMIENTO LIGERO ====
  {
    id: 11,
    exercise_id: 'marcha-en-sitio',
    nombre: 'Marcha en sitio',
    patron_movimiento: 'Acondicionamiento',
    categoria: 'Cardio',
    nivel: 'Principiante',
    equipamiento: 'Peso corporal',
    series_objetivo: '2-3',
    reps_objetivo: null,
    tiempo_isometrico: '30-60s',
    descanso_seg: '60-90',
    instrucciones: 'Marcha elevando las rodillas al nivel cómodo. Mantén ritmo constante.',
    progresion: 'Aumenta tiempo o intensidad gradualmente.',
    enfoque_tecnica: 'Postura erguida, brazos naturales, respiración controlada.',
    frecuencia_semanal: '2-3 días'
  },
  {
    id: 12,
    exercise_id: 'step-touch-lateral',
    nombre: 'Step touch lateral',
    patron_movimiento: 'Acondicionamiento',
    categoria: 'Cardio',
    nivel: 'Principiante',
    equipamiento: 'Peso corporal',
    series_objetivo: '2-3',
    reps_objetivo: '20-30',
    tiempo_isometrico: null,
    descanso_seg: '60-90',
    instrucciones: 'Paso lateral y junta pies. Alterna lados con ritmo controlado.',
    progresion: 'Aumenta velocidad o añade movimiento de brazos.',
    enfoque_tecnica: 'Movimientos controlados, core estable, ritmo constante.',
    frecuencia_semanal: '2-3 días'
  }
];

async function createPrincipiantesTable() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creando tabla específica para principiantes de calistenia...');
    
    await client.query('BEGIN');
    
    // Crear tabla específica para principiantes
    await client.query(`
      CREATE TABLE IF NOT EXISTS app."Ejercicios_Calistenia_Principiantes" (
        id SERIAL PRIMARY KEY,
        exercise_id TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        patron_movimiento TEXT NOT NULL,
        categoria TEXT NOT NULL CHECK (categoria IN ('Empuje', 'Tracción', 'Piernas', 'Core', 'Cardio')),
        nivel TEXT NOT NULL DEFAULT 'Principiante',
        equipamiento TEXT NOT NULL,
        series_objetivo TEXT NOT NULL,
        reps_objetivo TEXT,
        tiempo_isometrico TEXT,
        descanso_seg TEXT NOT NULL,
        instrucciones TEXT NOT NULL,
        progresion TEXT NOT NULL,
        enfoque_tecnica TEXT NOT NULL,
        frecuencia_semanal TEXT NOT NULL DEFAULT '2-3 días',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabla creada exitosamente');
    
    // Limpiar datos existentes
    await client.query('DELETE FROM app."Ejercicios_Calistenia_Principiantes"');
    await client.query('ALTER SEQUENCE app."Ejercicios_Calistenia_Principiantes_id_seq" RESTART WITH 1');
    console.log('🗑️ Datos anteriores eliminados');
    
    // Insertar ejercicios para principiantes
    let inserted = 0;
    for (const ejercicio of ejerciciosPrincipiantes) {
      const insertQuery = `
        INSERT INTO app."Ejercicios_Calistenia_Principiantes" (
          exercise_id, nombre, patron_movimiento, categoria, nivel, equipamiento,
          series_objetivo, reps_objetivo, tiempo_isometrico, descanso_seg,
          instrucciones, progresion, enfoque_tecnica, frecuencia_semanal,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      `;
      
      await client.query(insertQuery, [
        ejercicio.exercise_id,
        ejercicio.nombre,
        ejercicio.patron_movimiento,
        ejercicio.categoria,
        ejercicio.nivel,
        ejercicio.equipamiento,
        ejercicio.series_objetivo,
        ejercicio.reps_objetivo,
        ejercicio.tiempo_isometrico,
        ejercicio.descanso_seg,
        ejercicio.instrucciones,
        ejercicio.progresion,
        ejercicio.enfoque_tecnica,
        ejercicio.frecuencia_semanal
      ]);
      
      inserted++;
      console.log(`✅ Insertado ${inserted}/${ejerciciosPrincipiantes.length}: ${ejercicio.nombre}`);
    }
    
    await client.query('COMMIT');
    
    // Verificar datos insertados
    const countResult = await client.query('SELECT COUNT(*) as total FROM app."Ejercicios_Calistenia_Principiantes"');
    const byPatron = await client.query(`
      SELECT patron_movimiento, COUNT(*) as count 
      FROM app."Ejercicios_Calistenia_Principiantes"
      GROUP BY patron_movimiento 
      ORDER BY patron_movimiento
    `);
    
    console.log('\\n🎉 ¡TABLA PARA PRINCIPIANTES CREADA EXITOSAMENTE!');
    console.log('📊 Total ejercicios:', countResult.rows[0].total);
    console.log('📋 Por patrón de movimiento:');
    byPatron.rows.forEach(row => {
      console.log(`  ${row.patron_movimiento}: ${row.count} ejercicios`);
    });
    
    console.log('\\n🎯 CARACTERÍSTICAS DEL NUEVO SISTEMA:');
    console.log('• Frecuencia: 2-3 días por semana (no consecutivos)');
    console.log('• Ejercicios: 4-6 por sesión cubriendo los 6 patrones');
    console.log('• Series: 1-3 series de 8-12 reps o 20-30s isométricos');
    console.log('• Descanso: 60-90 segundos entre series');
    console.log('• Enfoque: Técnica perfecta y progresión gradual');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la creación:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar el script
if (import.meta.url === `file://${process.argv[1]}`) {
  createPrincipiantesTable()
    .then(() => {
      console.log('\\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script falló:', error.message);
      process.exit(1);
    });
}

export { createPrincipiantesTable };