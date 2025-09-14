import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL'
});

async function analyzeCleanup() {
  try {
    console.log('🔍 ANÁLISIS DE LIMPIEZA - QUÉ TABLAS SE ELIMINARÍAN');
    console.log('==================================================');

    // Tablas que queremos mantener
    const tablasAMantener = [
      'Ejercicios_Calistenia',
      'Ejercicios_Hipertrofia',
      'user_profiles',
      'music_playlists',
      'historico_ejercicios',
      'progreso_usuario',
      'methodology_plans_new', // La nueva tabla
      'hometraining_complete',
      'users', // Tabla de usuarios
      'auth_logs' // Logs de autenticación
    ];

    // Obtener todas las tablas actuales
    const todasLasTablas = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      ORDER BY table_name
    `);

    console.log(`📊 Total de tablas actuales: ${todasLasTablas.rows.length}`);

    // Filtrar tablas a eliminar
    const tablasAEliminar = todasLasTablas.rows.filter(row =>
      !tablasAMantener.includes(row.table_name) &&
      !row.table_name.includes('_backup')
    );

    console.log('\n✅ TABLAS QUE SE MANTENDRÁN:');
    tablasAMantener.forEach(tabla => {
      const existe = todasLasTablas.rows.find(row => row.table_name === tabla);
      console.log(`   ${existe ? '✅' : '❌'} ${tabla}`);
    });

    console.log(`\n❌ TABLAS QUE SE ELIMINARÍAN (${tablasAEliminar.length}):`);
    tablasAEliminar.forEach(tabla => {
      console.log(`   🗑️ ${tabla.table_name}`);
    });

    console.log(`\n📈 RESUMEN:`);
    console.log(`   📊 Tablas actuales: ${todasLasTablas.rows.length}`);
    console.log(`   ✅ Tablas a mantener: ${tablasAMantener.length}`);
    console.log(`   ❌ Tablas a eliminar: ${tablasAEliminar.length}`);
    console.log(`   📉 Reducción: ${Math.round((tablasAEliminar.length / todasLasTablas.rows.length) * 100)}%`);

    // Verificar datos en tablas importantes
    console.log('\n🔍 VERIFICACIÓN DE DATOS EN TABLAS IMPORTANTES:');

    for (const tabla of ['Ejercicios_Calistenia', 'user_profiles', 'methodology_plans_new']) {
      try {
        const count = await pool.query(`SELECT COUNT(*) as count FROM app."${tabla}"`);
        console.log(`   📋 ${tabla}: ${count.rows[0].count} registros`);
      } catch (error) {
        console.log(`   ⚠️ ${tabla}: Error - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeCleanup();