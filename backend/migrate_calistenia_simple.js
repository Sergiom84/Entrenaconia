// Script simple para migrar ejercicios de calistenia
import { pool } from './db.js';

async function migrateCalisteniaSimple() {
  const client = await pool.connect();
  
  try {
    console.log('🤸‍♀️ Iniciando migración simple de calistenia...');
    
    // 1. Crear tabla si no existe
    await client.query(`
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
    `);
    console.log('✅ Tabla app.calistenia_exercises creada');

    // 2. Verificar si ya hay datos
    const existingData = await client.query(`SELECT COUNT(*) as count FROM app.calistenia_exercises`);
    const hasData = existingData.rows[0].count > 0;
    
    if (hasData) {
      console.log('ℹ️ La tabla ya tiene datos, saltando inserción');
    } else {
      // 3. Insertar algunos ejercicios de prueba para verificar
      await client.query(`
        INSERT INTO app.calistenia_exercises (exercise_id, nombre, nivel, categoria, patron, equipamiento, series_reps_objetivo, criterio_de_progreso, notas) VALUES
        ('flexion-contra-pared', 'Flexión contra pared', 'Básico', 'Empuje', 'Empuje horizontal', 'Pared', '3-5x8-12', 'Completa 12 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Codos 30–45° respecto al torso.'),
        ('flexion-estandar', 'Flexión estándar', 'Intermedio', 'Empuje', 'Empuje horizontal', 'Suelo', '3-5x8-15', 'Completa 15 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Codos 30–45°.'),
        ('muscle-up-en-barra-strict', 'Muscle-up en barra (strict)', 'Avanzado', 'Tracción', 'Tracción + Empuje', 'Barra', '4-6x1-5', 'Completa 5 reps con técnica perfecta en 2 sesiones seguidas antes de progresar.', 'Transición limpia, sin kipping.')
        ON CONFLICT (exercise_id) DO NOTHING;
      `);
      console.log('✅ Ejercicios de prueba insertados');
    }

    // 4. Verificar inserción
    const verificationQuery = await client.query(`
      SELECT nivel, COUNT(*) as total_ejercicios 
      FROM app.calistenia_exercises 
      GROUP BY nivel 
      ORDER BY 
        CASE nivel 
          WHEN 'Básico' THEN 1 
          WHEN 'Intermedio' THEN 2 
          WHEN 'Avanzado' THEN 3 
        END
    `);
    
    console.log('📊 Ejercicios de calistenia por nivel:');
    verificationQuery.rows.forEach(row => {
      console.log(`   ${row.nivel}: ${row.total_ejercicios} ejercicios`);
    });
    
    console.log('✅ Migración simple completada');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar migración
migrateCalisteniaSimple().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});