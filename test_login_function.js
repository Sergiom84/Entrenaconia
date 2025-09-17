#!/usr/bin/env node

import { pool } from './backend/db.js';
import { logUserLogin } from './backend/utils/sessionUtils.js';

async function testLoginFunction() {
  try {
    console.log('🧪 PROBANDO FUNCIÓN logUserLogin()');
    console.log('=================================');

    // Crear un mock request object
    const mockReq = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Test Browser',
        'x-forwarded-for': '192.168.1.100',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'connection': 'keep-alive'
      },
      connection: {
        remoteAddress: '192.168.1.100'
      }
    };

    // Mock JWT token
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTY5NDc4ODgwMCwiZXhwIjoxNjk1MzkzNjAwfQ.test-signature-hash';

    // ID de usuario para testing (asumiendo que existe un usuario con ID 1)
    const testUserId = 1;

    console.log('📝 Datos de prueba:');
    console.log(`   - User ID: ${testUserId}`);
    console.log(`   - User Agent: ${mockReq.headers['user-agent']}`);
    console.log(`   - IP Address: ${mockReq.headers['x-forwarded-for']}`);

    console.log('\n🔄 Ejecutando logUserLogin()...');

    // Ejecutar la función que antes fallaba
    const result = await logUserLogin(testUserId, mockToken, mockReq, {
      loginMethod: 'test',
      source: 'test-script'
    });

    console.log('\n📊 RESULTADO:');
    if (result.success) {
      console.log('✅ ¡ÉXITO! La función logUserLogin() funcionó correctamente');
      console.log(`   - Session ID: ${result.sessionId}`);
      console.log(`   - Login Time: ${result.loginTime}`);

      // Verificar que los datos se guardaron correctamente
      const verifyQuery = `
        SELECT session_id, user_id, session_metadata, device_info, ip_address
        FROM app.user_sessions
        WHERE session_id = $1;
      `;

      const verification = await pool.query(verifyQuery, [result.sessionId]);

      if (verification.rows.length > 0) {
        const session = verification.rows[0];
        console.log('\n🔍 DATOS GUARDADOS:');
        console.log(`   - User ID: ${session.user_id}`);
        console.log(`   - IP Address: ${session.ip_address}`);
        console.log(`   - Session Metadata: ${JSON.stringify(session.session_metadata, null, 2)}`);
        console.log(`   - Device Info: ${session.device_info ? 'Guardado ✅' : 'No guardado ❌'}`);
      }

    } else {
      console.log('❌ Error en logUserLogin():');
      console.log(`   - Error: ${result.error}`);
      throw new Error(result.error);
    }

    console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('El error "column session_metadata does not exist" ha sido RESUELTO');

  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    console.error('🔍 Detalles:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testLoginFunction().catch(error => {
  console.error('💥 FALLA EN PRUEBA:', error);
  process.exit(1);
});