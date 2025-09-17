import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Simular la función hashJWTToken
import crypto from 'crypto';

function hashJWTToken(token) {
    if (!token) return null;
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Replicar la función logUserLogout para probar
async function testLogUserLogout(userId, token, logoutType = 'manual', additionalInfo = {}) {
    try {
        const tokenHash = hashJWTToken(token);

        console.log(`🧪 Simulando logout para usuario: ${userId}`);
        console.log(`   - Token hash: ${tokenHash?.substring(0, 10)}...`);
        console.log(`   - Tipo de logout: ${logoutType}`);

        const result = await pool.query(`
            UPDATE app.user_sessions
            SET
                logout_time = CURRENT_TIMESTAMP,
                is_active = FALSE,
                logout_type = $3,
                session_metadata = session_metadata || $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
              AND jwt_token_hash = $2
              AND is_active = TRUE
            RETURNING session_id, login_time, logout_time, session_duration
        `, [
            userId,
            tokenHash,
            logoutType,
            JSON.stringify(additionalInfo)
        ]);

        if (result.rows.length > 0) {
            const session = result.rows[0];
            console.log(`✅ Logout registrado exitosamente`);
            console.log(`   - Session ID: ${session.session_id}`);
            console.log(`   - Login time: ${session.login_time}`);
            console.log(`   - Logout time: ${session.logout_time}`);
            console.log(`   - Duración: ${session.session_duration}`);

            return {
                success: true,
                sessionId: session.session_id,
                duration: session.session_duration
            };
        } else {
            console.log('⚠️ No se encontró sesión activa para actualizar');
            return {
                success: false,
                error: 'No active session found'
            };
        }

    } catch (error) {
        console.error('❌ Error en logout:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Función para crear una sesión de prueba
async function createTestSession(userId, testToken) {
    try {
        const tokenHash = hashJWTToken(testToken);

        const result = await pool.query(`
            INSERT INTO app.user_sessions (
                user_id,
                jwt_token_hash,
                ip_address,
                user_agent,
                device_info,
                session_metadata,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING session_id, login_time
        `, [
            userId,
            tokenHash,
            '127.0.0.1',
            'Test User Agent',
            JSON.stringify({ platform: 'test', browser: 'test' }),
            JSON.stringify({ test: true }),
            true
        ]);

        const session = result.rows[0];
        console.log(`✅ Sesión de prueba creada`);
        console.log(`   - Session ID: ${session.session_id}`);
        console.log(`   - Login time: ${session.login_time}`);

        return session;
    } catch (error) {
        console.error('❌ Error creando sesión de prueba:', error.message);
        return null;
    }
}

async function runLogoutTest() {
    try {
        console.log('🚀 Iniciando prueba de funcionalidad de logout');
        console.log('='.repeat(60));

        // Crear una sesión de prueba
        const testUserId = 1; // Asumiendo que existe un usuario con ID 1
        const testToken = 'test-jwt-token-12345';

        const session = await createTestSession(testUserId, testToken);
        if (!session) {
            console.log('❌ No se pudo crear sesión de prueba');
            return;
        }

        // Esperar un momento para simular actividad
        console.log('⏳ Esperando 2 segundos para simular duración de sesión...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Probar el logout
        const logoutResult = await testLogUserLogout(testUserId, testToken, 'manual', {
            logoutTimestamp: new Date().toISOString(),
            userAgent: 'Test User Agent',
            test: true
        });

        console.log('\n📊 RESULTADO DE LA PRUEBA:');
        console.log('='.repeat(60));
        if (logoutResult.success) {
            console.log('✅ PRUEBA EXITOSA - El logout funciona correctamente');
            console.log(`   - Session ID: ${logoutResult.sessionId}`);
            console.log(`   - Duración calculada: ${logoutResult.duration}`);
        } else {
            console.log('❌ PRUEBA FALLIDA');
            console.log(`   - Error: ${logoutResult.error}`);
        }

        // Verificar que la sesión esté marcada como inactiva
        const verificationResult = await pool.query(`
            SELECT session_id, is_active, logout_type, session_duration
            FROM app.user_sessions
            WHERE session_id = $1
        `, [session.session_id]);

        if (verificationResult.rows.length > 0) {
            const verifiedSession = verificationResult.rows[0];
            console.log('\n🔍 VERIFICACIÓN FINAL:');
            console.log(`   - Sesión activa: ${verifiedSession.is_active}`);
            console.log(`   - Tipo de logout: ${verifiedSession.logout_type}`);
            console.log(`   - Duración final: ${verifiedSession.session_duration}`);
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
    } finally {
        await pool.end();
    }
}

runLogoutTest();