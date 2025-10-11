import { pool } from './db.js';

(async () => {
  try {
    console.log('🔍 Verificando niveles actuales en Ejercicios_Calistenia...\n');

    // Ver niveles actuales
    const current = await pool.query(`
      SELECT DISTINCT nivel, COUNT(*) as cantidad
      FROM app."Ejercicios_Calistenia"
      GROUP BY nivel
      ORDER BY nivel
    `);

    console.log('📊 Niveles actuales:');
    current.rows.forEach(row => {
      console.log(`  ${row.nivel}: ${row.cantidad} ejercicios`);
    });

    // Verificar si existe "Básico" o "basico"
    const basicoCount = await pool.query(`
      SELECT COUNT(*) as total
      FROM app."Ejercicios_Calistenia"
      WHERE nivel ILIKE '%básico%' OR nivel ILIKE '%basico%'
    `);

    console.log(`\n🔍 Ejercicios con "Básico/basico": ${basicoCount.rows[0].total}`);

    if (basicoCount.rows[0].total > 0) {
      console.log('\n🔄 Actualizando "Básico" → "Principiante"...');

      const updateResult = await pool.query(`
        UPDATE app."Ejercicios_Calistenia"
        SET nivel = 'Principiante'
        WHERE nivel ILIKE '%básico%' OR nivel ILIKE '%basico%'
      `);

      console.log(`✅ Actualizados: ${updateResult.rowCount} registros`);

      // Verificar resultado
      const updated = await pool.query(`
        SELECT DISTINCT nivel, COUNT(*) as cantidad
        FROM app."Ejercicios_Calistenia"
        GROUP BY nivel
        ORDER BY nivel
      `);

      console.log('\n📊 Niveles después de actualización:');
      updated.rows.forEach(row => {
        console.log(`  ${row.nivel}: ${row.cantidad} ejercicios`);
      });
    } else {
      console.log('\n✅ No hay ejercicios con "Básico", la BD ya está actualizada');
    }

    await pool.end();
    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
