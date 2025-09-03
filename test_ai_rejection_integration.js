import { pool } from './backend/db.js';

async function testAIRejectionIntegration() {
  try {
    const userId = 18; // Tu usuario
    
    console.log('🧪 PROBANDO INTEGRACIÓN IA + RECHAZOS');
    console.log('====================================\n');

    // 1. Verificar rechazos existentes
    console.log('1. RECHAZOS EXISTENTES:');
    const rejections = await pool.query(`
      SELECT exercise_name, rejection_category, rejected_at, expires_at,
             CASE 
               WHEN expires_at IS NULL THEN 'permanente'
               ELSE CONCAT('expira en ', CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400), ' días')
             END as expiry_info
      FROM app.home_exercise_rejections 
      WHERE user_id = $1 AND is_active = true
      ORDER BY rejected_at DESC
    `, [userId]);
    
    if (rejections.rows.length > 0) {
      rejections.rows.forEach(rej => {
        console.log(`   ❌ ${rej.exercise_name} (${rej.rejection_category}) - ${rej.expiry_info}`);
      });
    } else {
      console.log('   ℹ️ No hay ejercicios rechazados activos');
    }

    // 2. Simular la consulta que hace la IA
    console.log('\n2. SIMULANDO CONSULTA DE LA IA:');
    const equipment_type = 'personalizado';
    const training_type = 'hiit';
    
    // Consulta igual que en iaHomeTraining.js
    const rejectedExercisesRes = await pool.query(
      `SELECT * FROM app.get_rejected_exercises_for_combination($1, $2, $3)`,
      [userId, equipment_type, training_type]
    );
    
    console.log(`   📋 Ejercicios rechazados para ${equipment_type}+${training_type}: ${rejectedExercisesRes.rows.length}`);
    
    const exercisesToAvoid = rejectedExercisesRes.rows.map(r => r.exercise_name);
    const rejectedExercises = rejectedExercisesRes.rows.length > 0
      ? rejectedExercisesRes.rows.map(r => {
          const expiry = r.days_until_expires 
            ? ` (expira en ${r.days_until_expires} días)`
            : ' (permanente)';
          const reason = r.rejection_category 
            ? ` - ${r.rejection_category}`
            : '';
          return `${r.exercise_name}${reason}${expiry}`;
        }).join(', ')
      : 'Ninguno';

    console.log(`   🚫 Lista para la IA: ${rejectedExercises}`);
    console.log(`   📝 Array de ejercicios prohibidos:`, exercisesToAvoid);

    // 3. Simular historial de ejercicios usados
    console.log('\n3. SIMULANDO HISTORIAL USADO:');
    const combinationHistoryRes = await pool.query(
      `SELECT exercise_name, times_used, last_used_at, user_rating, combination_code
       FROM app.get_exercises_for_combination($1, $2, $3, 20)`,
      [userId, equipment_type, training_type]
    );
    
    const exercisesUsedForCombination = combinationHistoryRes.rows.length > 0
      ? combinationHistoryRes.rows.map(r => {
          const rating = r.user_rating ? ` [${r.user_rating === 'love' ? '❤️' : r.user_rating === 'hard' ? '💪' : '👎'}]` : '';
          return `${r.exercise_name} (x${r.times_used})${rating}`;
        }).join(', ')
      : `Ningún ejercicio previo para ${equipment_type} + ${training_type}`;

    console.log(`   🔄 Ejercicios usados: ${exercisesUsedForCombination}`);

    // 4. Simular prompt que recibiría la IA
    console.log('\n4. PROMPT QUE RECIBIRÁ LA IA:');
    const userPrompt = `Genera un plan de entrenamiento para el usuario con equipamiento "${equipment_type}" y tipo "${training_type}".
          
EJERCICIOS RECHAZADOS POR EL USUARIO (NO usar):
${exercisesToAvoid.length > 0 ? exercisesToAvoid.map(ex => `- ${ex}`).join('\n') : '- Ninguno'}

EJERCICIOS USADOS RECIENTEMENTE (evitar repetir):
${exercisesUsedForCombination !== 'Ningún ejercicio previo' ? exercisesUsedForCombination : '- Ninguno'}

IMPORTANTE: 
- NO incluyas ningún ejercicio de la lista de ejercicios rechazados
- Prioriza ejercicios nuevos y variados
- Si el usuario rechazó ejercicios por "muy difícil", ajusta la intensidad general

Responde SOLO con JSON.`;

    console.log('   📄 PROMPT COMPLETO:');
    console.log('   ' + '─'.repeat(60));
    console.log(userPrompt.split('\n').map(line => '   ' + line).join('\n'));
    console.log('   ' + '─'.repeat(60));

    console.log('\n✅ INTEGRACIÓN IA + RECHAZOS LISTA PARA PROBAR');
    console.log('\n💡 Para probar:');
    console.log('   1. Ve a Home Training');
    console.log('   2. Genera un plan personalizado/HIIT');
    console.log('   3. Verifica que NO aparezcan los ejercicios rechazados');
    console.log('   4. Si aparecen, revisa los logs del backend');
    
  } catch (error) {
    console.error('❌ Error probando integración:', error);
  } finally {
    process.exit(0);
  }
}

testAIRejectionIntegration();