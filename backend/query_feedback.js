import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL',
  ssl: { rejectUnauthorized: false }
});

async function queryFeedback() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO app,public');
    
    // Buscar feedback para session 106, exercise 3
    const feedbackResult = await client.query(`
      SELECT 
        f.methodology_session_id,
        f.exercise_order,
        f.exercise_name,
        f.sentiment,
        f.comment,
        f.created_at,
        f.updated_at
      FROM methodology_exercise_feedback f
      WHERE f.methodology_session_id = 106
        AND f.exercise_order = 3
      ORDER BY f.created_at DESC
    `);
    
    console.log('📊 Feedback encontrado para session 106, exercise 3:', feedbackResult.rows.length);
    
    if (feedbackResult.rows.length === 0) {
      console.log('❌ No se encontró feedback para session 106, exercise 3');
      
      // Buscar todos los feedback de la session 106
      const allFeedbackResult = await client.query(`
        SELECT 
          f.exercise_order,
          f.exercise_name,
          f.sentiment,
          f.comment,
          f.created_at
        FROM methodology_exercise_feedback f
        WHERE f.methodology_session_id = 106
        ORDER BY f.exercise_order ASC
      `);
      
      console.log('📊 Todos los feedback de session 106:', allFeedbackResult.rows.length);
      allFeedbackResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. Ejercicio ${row.exercise_order}: ${row.exercise_name} - ${row.sentiment} - "${row.comment}" (${row.created_at})`);
      });
      
    } else {
      feedbackResult.rows.forEach((row, index) => {
        console.log('='.repeat(50));
        console.log('🎯 Feedback', index + 1);
        console.log('📝 Ejercicio:', row.exercise_name);
        console.log('📊 Orden:', row.exercise_order);
        console.log('💭 Sentimiento:', row.sentiment);
        console.log('💬 Comentario:', row.comment || '(vacío)');
        console.log('🕐 Creado:', row.created_at);
        console.log('🕐 Actualizado:', row.updated_at);
      });
    }
    
  } finally {
    client.release();
    pool.end();
  }
}

queryFeedback().catch(console.error);