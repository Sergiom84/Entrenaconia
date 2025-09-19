import { pool } from './backend/db.js';
import { readFileSync } from 'fs';

async function applyDatabaseImprovements() {
  const client = await pool.connect();

  try {
    console.log('🚀 Aplicando mejoras a la base de datos...');

    // Leer el archivo SQL
    const sqlContent = readFileSync('./database_improvements.sql', 'utf8');

    // Dividir por declaraciones (separadas por ; seguido de salto de línea)
    const statements = sqlContent
      .split(/;\s*\n/)
      .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'))
      .map(stmt => stmt.trim() + ';');

    console.log(`📝 Ejecutando ${statements.length} declaraciones SQL...`);

    await client.query('BEGIN');

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Ejecutando:`, statement.substring(0, 60) + '...');

      try {
        await client.query(statement);
        console.log('✅ Ejecutado exitosamente');
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('ℹ️ Ya existe, continuando...');
        } else {
          console.error('❌ Error:', error.message);
          throw error;
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 Todas las mejoras aplicadas exitosamente!');

    // Verificar que las tablas nuevas existen
    console.log('\n🔍 Verificando nuevas estructuras...');

    const verifyQueries = [
      { name: 'user_training_state', query: 'SELECT COUNT(*) FROM user_training_state' },
      { name: 'exercise_session_tracking', query: 'SELECT COUNT(*) FROM exercise_session_tracking' },
      { name: 'get_user_active_plan function', query: 'SELECT get_user_active_plan(1) LIMIT 0' }
    ];

    for (const verify of verifyQueries) {
      try {
        await client.query(verify.query);
        console.log(`✅ ${verify.name} - OK`);
      } catch (error) {
        console.error(`❌ ${verify.name} - Error:`, error.message);
      }
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 Error aplicando mejoras:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

applyDatabaseImprovements();