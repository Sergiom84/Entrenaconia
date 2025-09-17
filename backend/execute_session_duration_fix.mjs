import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const fixSessionDurationSQL = `
-- Verificar si la columna ya existe
DO $$
BEGIN
    -- Verificar si la columna ya existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'user_sessions'
          AND column_name = 'session_duration'
    ) THEN
        -- Agregar la columna session_duration como columna generada
        ALTER TABLE app.user_sessions
        ADD COLUMN session_duration INTERVAL GENERATED ALWAYS AS (
            CASE
                WHEN logout_time IS NOT NULL THEN logout_time - login_time
                ELSE NULL
            END
        ) STORED;

        RAISE NOTICE 'Columna session_duration agregada exitosamente como columna generada';
    ELSE
        RAISE NOTICE 'La columna session_duration ya existe';
    END IF;
END $$;
`;

const verificationSQL = `
SELECT column_name, data_type, is_generated, generation_expression
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'user_sessions'
  AND column_name = 'session_duration';
`;

async function executeSessionDurationFix() {
    try {
        console.log('🔧 Ejecutando corrección para columna session_duration...');

        // Ejecutar el script de corrección
        await pool.query(fixSessionDurationSQL);
        console.log('✅ Script de corrección ejecutado exitosamente');

        // Verificar que la columna se creó correctamente
        const result = await pool.query(verificationSQL);

        if (result.rows.length > 0) {
            const column = result.rows[0];
            console.log('✅ VERIFICACIÓN EXITOSA:');
            console.log(`   - Columna: ${column.column_name}`);
            console.log(`   - Tipo: ${column.data_type}`);
            console.log(`   - Es generada: ${column.is_generated}`);
            console.log(`   - Expresión: ${column.generation_expression || 'N/A'}`);
        } else {
            console.log('❌ ERROR: La columna session_duration no se encontró después de la creación');
        }

        // Probar una consulta que use la columna
        console.log('\n🧪 Probando consulta con session_duration...');
        const testResult = await pool.query(`
            SELECT session_id, login_time, logout_time, session_duration
            FROM app.user_sessions
            LIMIT 1
        `);
        console.log('✅ Consulta de prueba ejecutada exitosamente');

    } catch (error) {
        console.error('❌ Error ejecutando corrección:', error.message);
        console.error('Detalles del error:', error);
    } finally {
        await pool.end();
    }
}

executeSessionDurationFix();