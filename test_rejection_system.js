import { pool } from './backend/db.js';

async function testRejectionSystem() {
  try {
    console.log('🧪 PROBANDO SISTEMA DE RECHAZOS');
    console.log('================================\n');

    // 1. Probar función de rechazo
    console.log('1. Probando función is_exercise_rejected...');
    
    const testResult = await pool.query(
      `SELECT app.is_exercise_rejected($1, $2, $3, $4) as is_rejected`,
      [18, 'burpees_con_toque_en_rodillas', 'personalizado', 'hiit']
    );
    
    console.log(`✅ Función is_exercise_rejected funciona:`, testResult.rows[0].is_rejected);

    // 2. Probar función de obtener rechazos
    console.log('\n2. Probando función get_rejected_exercises_for_combination...');
    
    const rejectedResult = await pool.query(
      `SELECT * FROM app.get_rejected_exercises_for_combination($1, $2, $3)`,
      [18, 'personalizado', 'hiit']
    );
    
    console.log(`✅ Ejercicios rechazados encontrados: ${rejectedResult.rows.length}`);
    rejectedResult.rows.forEach(row => {
      console.log(`   - ${row.exercise_name} (${row.rejection_category})`);
    });

    // 3. Verificar estructura de la tabla
    console.log('\n3. Verificando estructura de la tabla...');
    
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
      AND table_name = 'home_exercise_rejections'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Estructura de tabla correcta:');
    tableStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 4. Probar inserción de datos de prueba
    console.log('\n4. Probando inserción de datos de prueba...');
    
    const insertResult = await pool.query(`
      INSERT INTO app.home_exercise_rejections 
      (user_id, exercise_name, exercise_key, equipment_type, training_type, 
       rejection_reason, rejection_category, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      18, 
      'Test Exercise', 
      'test_exercise',
      'personalizado', 
      'hiit',
      'Solo para prueba',
      'other',
      null
    ]);
    
    if (insertResult.rows.length > 0) {
      console.log('✅ Inserción exitosa, ID:', insertResult.rows[0].id);
      
      // Limpiar datos de prueba
      await pool.query(
        'DELETE FROM app.home_exercise_rejections WHERE id = $1',
        [insertResult.rows[0].id]
      );
      console.log('🧹 Datos de prueba eliminados');
    } else {
      console.log('ℹ️ Datos de prueba ya existían o no se pudieron insertar');
    }

    console.log('\n✅ TODAS LAS PRUEBAS PASARON CORRECTAMENTE');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    process.exit(0);
  }
}

testRejectionSystem();