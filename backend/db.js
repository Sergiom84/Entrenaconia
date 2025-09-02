import pkg from 'pg';
import dotenv from 'dotenv';

// Solo cargar dotenv en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const { Pool } = pkg;

// Configuración de la base de datos para Supabase
// Render no soporta IPv6, usamos conexión directa puerto 5432 como fallback
const dbConfig = {
  application_name: 'EntrenaConIA',
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false,
    require: true,
    // Configuración específica para certificados auto-firmados en Render
    ca: false
  } : false,
  options: '-c search_path=app,public',
  // Configuraciones adicionales para Render
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

// Intentar con diferentes configuraciones según el entorno
if (process.env.DATABASE_URL) {
  // Si hay DATABASE_URL, usar esa configuración
  dbConfig.connectionString = process.env.DATABASE_URL;
} else if (process.env.NODE_ENV === 'production') {
  // En producción (Render), usar conexión directa sin pooler
  dbConfig.connectionString = 'postgresql://postgres:Xe05Klm563kkjL@db.lhsnmjgdtjalfcsurxvg.supabase.co:5432/postgres?sslmode=require';
} else {
  // En desarrollo, usar pooler local
  dbConfig.connectionString = 'postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require';
}

export const pool = new Pool(dbConfig);

// Establecer search_path en cada conexión (soporta esquemas como 'app')
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || 'app,public';
pool.on('connect', async (client) => {
  try {
    await client.query(`SET search_path TO ${DB_SEARCH_PATH}`);
  } catch (e) {
    console.warn('⚠️  No se pudo establecer search_path:', e.message);
  }
});


// Función para probar la conexión
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL exitosa');

    // Variante A — Respetar search_path: comprobar 'users' en cualquiera de los esquemas activos
    const existsQ = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = ANY (current_schemas(true))
          AND table_name = 'users'
      ) AS ok;
    `;
    const { rows } = await client.query(existsQ);

    if (rows?.[0]?.ok) {
      console.log('✅ Tabla users encontrada (search_path)');
    } else {
      console.warn('⚠️ Tabla users no encontrada - ejecuta el schema SQL');
    }

    client.release();
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    console.log('💡 Revisa la configuración de Supabase en el archivo .env');
  }
};

// Probar conexión al inicializar
testConnection();

// Export por defecto
export default pool;
