// backend/db.js
import pkg from "pg";
import dotenv from "dotenv";

// Cargar .env solo en desarrollo
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const { Pool } = pkg;

// ---------- CONFIG BÁSICA ----------

// Fallback seguro para PRODUCCIÓN en Render (Session Pooler IPv4)
const DEFAULT_SESSION_POOLER =
  "postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require";

// Toma DATABASE_URL si existe; si no, en prod usa el pooler IPv4
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production"
    ? DEFAULT_SESSION_POOLER
    : DEFAULT_SESSION_POOLER);

// Pool de conexiones
export const pool = new Pool({
  connectionString,
  application_name: "EntrenaConIA",
  // SSL requerido por Supabase y necesario en Render
  ssl: { rejectUnauthorized: false },
  // Pool tuning para evitar demasiadas conexiones
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Opcional: fija search_path desde aquí para cada conexión nueva
  // Nota: también lo reforzamos en el evento 'connect' de abajo
  options: "-c search_path=app,public",
});

// ---------- SEARCH_PATH POR CONEXIÓN ----------
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || "app,public";
pool.on("connect", async (client) => {
  try {
    await client.query(`SET search_path TO ${DB_SEARCH_PATH}`);
  } catch (e) {
    console.warn("⚠️  No se pudo establecer search_path:", e.message);
  }
});

// ---------- TEST INICIAL ----------
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Conexión a PostgreSQL exitosa");

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
      console.log("✅ Tabla users encontrada (search_path)");
    } else {
      console.warn("⚠️ Tabla users no encontrada - ejecuta el schema SQL");
    }
    client.release();
  } catch (error) {
    console.error("❌ Error conectando a PostgreSQL:", error.message);
    console.log("💡 Revisa DATABASE_URL o el pooler de Supabase (IPv4).");
  }
};

// Ejecutar test al inicializar
testConnection();

export default pool;
