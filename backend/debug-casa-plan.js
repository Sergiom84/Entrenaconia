import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  options: `-c search_path=${process.env.DB_SEARCH_PATH || 'app,public'}`
});

async function debugCasaPlan() {
  try {
    console.log('🔍 Consultando plan Casa ID 48...\n');

    const result = await pool.query(`
      SELECT
        id,
        methodology_type,
        plan_data->'semanas' as semanas
      FROM app.methodology_plans
      WHERE id = 48
    `);

    if (result.rows.length === 0) {
      console.log('❌ No se encontró el plan ID 48');
      return;
    }

    const plan = result.rows[0];
    console.log('📋 Plan encontrado:');
    console.log('ID:', plan.id);
    console.log('Tipo:', plan.methodology_type);
    console.log('\n');

    const semanas = plan.semanas;

    if (Array.isArray(semanas) && semanas.length > 0) {
      console.log(`✅ El plan tiene ${semanas.length} semanas\n`);

      // Mostrar estructura de la semana 1
      console.log('📅 SEMANA 1 - Estructura de sesiones:');
      const semana1 = semanas[0];

      if (semana1.sesiones && Array.isArray(semana1.sesiones)) {
        console.log(`   Total de sesiones: ${semana1.sesiones.length}\n`);

        semana1.sesiones.forEach((sesion, idx) => {
          console.log(`   Sesión ${idx + 1}:`);
          console.log(`   - dia: "${sesion.dia}" (tipo: ${typeof sesion.dia})`);
          console.log(`   - ejercicios: ${sesion.ejercicios?.length || 0}`);
          if (sesion.ejercicios && sesion.ejercicios.length > 0) {
            console.log(`   - primer ejercicio: ${sesion.ejercicios[0].nombre || 'Sin nombre'}`);
          }
          console.log('');
        });

        // Verificar qué día es hoy
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const todayName = days[new Date().getDay()];
        console.log(`🗓️  Hoy es: "${todayName}"\n`);

        // Buscar sesión de hoy
        const todaySession = semana1.sesiones.find(s => s.dia?.toLowerCase() === todayName?.toLowerCase());

        if (todaySession) {
          console.log('✅ ENCONTRADA sesión de hoy:');
          console.log(`   - Día: ${todaySession.dia}`);
          console.log(`   - Ejercicios: ${todaySession.ejercicios?.length || 0}`);
        } else {
          console.log('❌ NO SE ENCONTRÓ sesión para hoy');
          console.log('   Días disponibles en el plan:');
          semana1.sesiones.forEach(s => {
            console.log(`   - "${s.dia}" (lowercase: "${s.dia?.toLowerCase()}")`);
          });
        }
      } else {
        console.log('   ❌ La semana 1 no tiene sesiones');
      }
    } else {
      console.log('❌ El plan no tiene semanas');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

debugCasaPlan();
