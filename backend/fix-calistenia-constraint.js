import { pool } from './db.js';

(async () => {
  try {
    console.log('🔍 Verificando constraints en Ejercicios_Calistenia...\n');

    // Ver el constraint actual
    const constraint = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'app."Ejercicios_Calistenia"'::regclass
        AND contype = 'c'
    `);

    console.log('📋 Constraints CHECK encontrados:');
    constraint.rows.forEach(row => {
      console.log(`  ${row.constraint_name}:`);
      console.log(`    ${row.definition}`);
    });

    // Buscar el constraint de nivel específicamente
    const nivelConstraint = constraint.rows.find(r => r.constraint_name.includes('nivel'));

    if (nivelConstraint) {
      console.log('\n🔧 Eliminando constraint antiguo...');

      await pool.query(`
        ALTER TABLE app."Ejercicios_Calistenia"
        DROP CONSTRAINT "${nivelConstraint.constraint_name}"
      `);

      console.log(`✅ Constraint eliminado: ${nivelConstraint.constraint_name}`);

      console.log('\n🔧 Creando nuevo constraint con niveles estandarizados...');

      await pool.query(`
        ALTER TABLE app."Ejercicios_Calistenia"
        ADD CONSTRAINT "Ejercicios_Calistenia_nivel_check"
        CHECK (nivel IN ('Principiante', 'Intermedio', 'Avanzado'))
      `);

      console.log('✅ Nuevo constraint creado');

      console.log('\n🔄 Actualizando valores "Básico" → "Principiante"...');

      const updateResult = await pool.query(`
        UPDATE app."Ejercicios_Calistenia"
        SET nivel = 'Principiante'
        WHERE nivel = 'Básico'
      `);

      console.log(`✅ Actualizados: ${updateResult.rowCount} registros`);

      // Verificar resultado final
      const final = await pool.query(`
        SELECT DISTINCT nivel, COUNT(*) as cantidad
        FROM app."Ejercicios_Calistenia"
        GROUP BY nivel
        ORDER BY nivel
      `);

      console.log('\n📊 Niveles finales:');
      final.rows.forEach(row => {
        console.log(`  ${row.nivel}: ${row.cantidad} ejercicios`);
      });

      console.log('\n✅ Proceso completado exitosamente!');
    } else {
      console.log('\n⚠️ No se encontró constraint de nivel');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
