import process from 'node:process';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', (client) => {
  client.query("SET search_path TO app, public");
});

async function checkCrossFitLevels() {
  try {
    console.log('📊 VERIFICANDO TABLA EJERCICIOS_CROSSFIT\n');

    // 1. Verificar niveles existentes
    const levelResult = await pool.query(`
      SELECT nivel, COUNT(*) as count
      FROM app."Ejercicios_CrossFit"
      GROUP BY nivel
      ORDER BY nivel
    `);

    console.log('✅ Niveles encontrados en Ejercicios_CrossFit:');
    levelResult.rows.forEach(row => {
      console.log(`   - ${row.nivel}: ${row.count} ejercicios`);
    });

    // 2. Total de ejercicios
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total FROM app."Ejercicios_CrossFit"
    `);
    console.log(`\n📈 Total de ejercicios: ${totalResult.rows[0].total}\n`);

    // 3. Verificar si existen ejercicios Elite
    const eliteResult = await pool.query(`
      SELECT COUNT(*) as count FROM app."Ejercicios_CrossFit" WHERE nivel = 'Elite'
    `);
    console.log(`🔍 Ejercicios con nivel 'Elite': ${eliteResult.rows[0].count}`);

    // 4. Mostrar sample de ejercicios por nivel
    console.log('\n📋 SAMPLE DE EJERCICIOS POR NIVEL:\n');
    for (const levelRow of levelResult.rows) {
      const sampleResult = await pool.query(`
        SELECT exercise_id, nombre, nivel, dominio, categoria
        FROM app."Ejercicios_CrossFit"
        WHERE nivel = $1
        LIMIT 3
      `, [levelRow.nivel]);

      console.log(`--- ${levelRow.nivel} (${levelRow.count} total) ---`);
      sampleResult.rows.forEach(ex => {
        console.log(`   ${ex.nombre} (${ex.dominio}/${ex.categoria})`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCrossFitLevels();
