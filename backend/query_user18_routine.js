// Script para investigar rutina activa del usuario ID18
import { pool } from './db.js';

async function checkUser18Routine() {
  const client = await pool.connect();
  
  try {
    const userId = 18;
    console.log(`🔍 INVESTIGANDO RUTINA ACTIVA USUARIO ID: ${userId}`);
    console.log('=' .repeat(60));

    // 1. Verificar metodología activa
    console.log('1️⃣ METODOLOGÍAS ACTIVAS:');
    const methodologies = await client.query(`
      SELECT id, methodology_type, status, confirmed_at, created_at
      FROM app.methodology_plans 
      WHERE user_id = $1 AND status = 'active'
      ORDER BY confirmed_at DESC, created_at DESC
    `, [userId]);
    
    if (methodologies.rows.length === 0) {
      console.log('❌ No hay metodologías activas para el usuario');
      return;
    }

    methodologies.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ID: ${row.id}, Tipo: ${row.methodology_type}, Status: ${row.status}`);
      console.log(`      Confirmada: ${row.confirmed_at || 'No confirmada'}`);
      console.log(`      Creada: ${row.created_at}`);
    });

    const activeMethodology = methodologies.rows[0];
    console.log(`\n✅ Metodología activa seleccionada: ID ${activeMethodology.id} (${activeMethodology.methodology_type})`);

    // 2. Verificar sesión actual (hoy sábado)
    const today = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[today.getDay()];
    const todayAbbrev = todayName.substring(0, 3);
    
    console.log(`\n2️⃣ SESIÓN PARA HOY (${todayName} - ${todayAbbrev}):`);
    
    const todaySession = await client.query(`
      SELECT id, methodology_plan_id, week_number, day_name, created_at,
             (SELECT COUNT(*) FROM app.methodology_exercise_progress 
              WHERE methodology_session_id = mes.id) as total_exercises
      FROM app.methodology_exercise_sessions mes
      WHERE methodology_plan_id = $1 AND day_name IN ($2, $3)
      ORDER BY created_at DESC LIMIT 1
    `, [activeMethodology.id, todayAbbrev, todayName]);

    if (todaySession.rows.length === 0) {
      console.log('❌ No hay sesión creada para hoy');
      console.log('💡 El sistema creará una automáticamente cuando inicie entrenamiento');
    } else {
      const session = todaySession.rows[0];
      console.log(`✅ Sesión encontrada: ID ${session.id}`);
      console.log(`   Semana: ${session.week_number}, Día: ${session.day_name}`);
      console.log(`   Total ejercicios: ${session.total_exercises}`);
      console.log(`   Creada: ${session.created_at}`);

      // 3. Ver ejercicios de la sesión
      console.log(`\n3️⃣ EJERCICIOS DE LA SESIÓN ${session.id}:`);
      const exercises = await client.query(`
        SELECT exercise_order, exercise_name, series_total, repeticiones, 
               descanso_seg, status, series_completed,
               (SELECT sentiment FROM app.methodology_exercise_feedback 
                WHERE methodology_session_id = mep.methodology_session_id 
                  AND exercise_order = mep.exercise_order LIMIT 1) as feedback_sentiment
        FROM app.methodology_exercise_progress mep
        WHERE methodology_session_id = $1
        ORDER BY exercise_order
      `, [session.id]);

      exercises.rows.forEach(ex => {
        const statusIcon = ex.status === 'completed' ? '✅' : 
                          ex.status === 'skipped' ? '⏭️' : '⏳';
        const feedbackIcon = ex.feedback_sentiment === 'like' ? '👍' : 
                           ex.feedback_sentiment === 'hard' ? '😰' : 
                           ex.feedback_sentiment === 'dislike' ? '👎' : '❓';
        
        console.log(`   ${ex.exercise_order + 1}. ${statusIcon} ${ex.exercise_name}`);
        console.log(`      Series: ${ex.series_completed || 0}/${ex.series_total} | Reps: ${ex.repeticiones} | Descanso: ${ex.descanso_seg}s`);
        console.log(`      Estado: ${ex.status || 'pending'} | Feedback: ${feedbackIcon} ${ex.feedback_sentiment || 'none'}`);
      });

      // 4. Progreso general
      const completed = exercises.rows.filter(e => e.status === 'completed').length;
      const total = exercises.rows.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      console.log(`\n📊 PROGRESO GENERAL:`);
      console.log(`   Completados: ${completed}/${total} (${percentage}%)`);
      console.log(`   Pendientes: ${total - completed}`);
    }

    // 5. Verificar ejercicios pendientes de días anteriores
    console.log(`\n4️⃣ EJERCICIOS PENDIENTES DE DÍAS ANTERIORES:`);
    const pendingExercises = await client.query(`
      SELECT mes.day_name, COUNT(mep.exercise_order) as pending_count,
             mes.id as session_id, mes.week_number
      FROM app.methodology_exercise_sessions mes
      JOIN app.methodology_exercise_progress mep ON mes.id = mep.methodology_session_id
      WHERE mes.methodology_plan_id = $1 
        AND (mep.status IS NULL OR mep.status NOT IN ('completed', 'skipped'))
      GROUP BY mes.id, mes.day_name, mes.week_number
      ORDER BY mes.week_number, mes.id
    `, [activeMethodology.id]);

    if (pendingExercises.rows.length === 0) {
      console.log('✅ No hay ejercicios pendientes de días anteriores');
    } else {
      pendingExercises.rows.forEach(pending => {
        console.log(`   📅 ${pending.day_name}: ${pending.pending_count} ejercicios pendientes (Sesión: ${pending.session_id})`);
      });
    }

  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    client.release();
  }
}

checkUser18Routine()
  .then(() => {
    console.log('\n🏁 Investigación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error en investigación:', error);
    process.exit(1);
  });