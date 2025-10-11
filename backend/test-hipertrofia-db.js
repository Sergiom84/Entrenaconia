import { pool } from './db.js';

(async () => {
  try {
    console.log('🧪 Test 3: Verificando Ejercicios Hipertrofia en BD...\n');

    // Contar por nivel
    const result = await pool.query(`
      SELECT COUNT(*) as total, nivel
      FROM app."Ejercicios_Hipertrofia"
      GROUP BY nivel
      ORDER BY nivel
    `);

    console.log('📊 Ejercicios por Nivel:');
    result.rows.forEach(row => {
      console.log(`  ${row.nivel}: ${row.total} ejercicios`);
    });

    // Total
    const total = await pool.query(`SELECT COUNT(*) as total FROM app."Ejercicios_Hipertrofia"`);
    console.log(`\n✅ Total: ${total.rows[0].total} ejercicios`);

    // Verificar categorías
    const categorias = await pool.query(`
      SELECT DISTINCT categoria
      FROM app."Ejercicios_Hipertrofia"
      ORDER BY categoria
    `);

    console.log('\n💪 Categorías (Grupos Musculares):');
    categorias.rows.forEach(row => console.log(`  - ${row.categoria}`));

    // Muestra de ejercicios por nivel
    console.log('\n🏋️ Muestra de Ejercicios:');
    const muestra = await pool.query(`
      SELECT nombre, nivel, categoria, equipamiento
      FROM app."Ejercicios_Hipertrofia"
      ORDER BY nivel, categoria
      LIMIT 6
    `);

    muestra.rows.forEach(row => {
      console.log(`  [${row.nivel}] ${row.nombre} (${row.categoria}) - ${row.equipamiento}`);
    });

    console.log('\n✅ Test 3 completado exitosamente!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en Test 3:', error.message);
    process.exit(1);
  }
})();
