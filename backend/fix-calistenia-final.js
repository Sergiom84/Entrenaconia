import { pool } from './db.js';

(async () => {
  try {
    console.log('🔄 Actualizando niveles en Ejercicios_Calistenia...\n');

    // Paso 1: Eliminar constraint
    console.log('📋 Paso 1: Eliminando constraint antiguo...');

    const constraint = await pool.query(`
      SELECT conname as constraint_name
      FROM pg_constraint
      WHERE conrelid = 'app."Ejercicios_Calistenia"'::regclass
        AND contype = 'c'
        AND conname LIKE '%nivel%'
    `);

    if (constraint.rows.length > 0) {
      const constraintName = constraint.rows[0].constraint_name;
      await pool.query(`
        ALTER TABLE app."Ejercicios_Calistenia"
        DROP CONSTRAINT "${constraintName}"
      `);
      console.log(`✅ Constraint eliminado: ${constraintName}`);
    }

    // Paso 2: Actualizar datos
    console.log('\n📋 Paso 2: Actualizando "Básico" → "Principiante"...');

    const updateResult = await pool.query(`
      UPDATE app."Ejercicios_Calistenia"
      SET nivel = 'Principiante'
      WHERE nivel = 'Básico'
    `);

    console.log(`✅ Registros actualizados: ${updateResult.rowCount}`);

    // Paso 3: Crear nuevo constraint
    console.log('\n📋 Paso 3: Creando nuevo constraint...');

    await pool.query(`
      ALTER TABLE app."Ejercicios_Calistenia"
      ADD CONSTRAINT "Ejercicios_Calistenia_nivel_check"
      CHECK (nivel IN ('Principiante', 'Intermedio', 'Avanzado'))
    `);

    console.log('✅ Nuevo constraint creado');

    // Verificación final
    console.log('\n📊 Verificación final:');
    const final = await pool.query(`
      SELECT DISTINCT nivel, COUNT(*) as cantidad
      FROM app."Ejercicios_Calistenia"
      GROUP BY nivel
      ORDER BY nivel
    `);

    final.rows.forEach(row => {
      console.log(`  ${row.nivel}: ${row.cantidad} ejercicios`);
    });

    const total = await pool.query(`SELECT COUNT(*) as total FROM app."Ejercicios_Calistenia"`);
    console.log(`\n✅ Total: ${total.rows[0].total} ejercicios`);

    await pool.end();
    console.log('\n🎉 Actualización completada exitosamente!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
