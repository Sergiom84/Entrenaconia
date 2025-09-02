// backend/db.js
import pkg from "pg";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const { Pool } = pkg;

// --- 1) Fuente única de verdad: DATABASE_URL ---
const DEFAULT_SESSION_POOLER =
  "postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require";

const rawConnStr =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production"
    ? DEFAULT_SESSION_POOLER
    : DEFAULT_SESSION_POOLER);

// --- 2) Parseo robusto de la URL ---
let parsed;
try {
  parsed = new URL(rawConnStr);
} catch (e) {
  console.error("❌ DATABASE_URL inválida:", e.message);
  throw e;
}

const host = parsed.hostname;                 // ej: aws-1-eu-north-1.pooler.supabase.com
const port = Number(parsed.port || 5432);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres";
const user = decodeURIComponent(parsed.username || "postgres");
const password = decodeURIComponent(parsed.password || "");
const sslmode = parsed.searchParams.get("sslmode");

// Log seguro (sin password)
console.log(
  `🔌 DB target → host=${host} port=${port} db=${database} user=${user} sslmode=${sslmode || "default"}`
);

// --- 3) Config Pool explícita (ignora PGHOST/PGPORT externos) ---
export const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
  ssl: { rejectUnauthorized: false }, // Supabase + Render
  application_name: "EntrenaConIA",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// --- 4) search_path por conexión ---
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || "app,public";
pool.on("connect", async (client) => {
  try {
    await client.query(`SET search_path TO ${DB_SEARCH_PATH}`);
  } catch (e) {
    console.warn("⚠️  No se pudo establecer search_path:", e.message);
  }
});

// --- 5) Test inicial ---
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
    console.log("💡 Revisa que DATABASE_URL apunte al pooler IPv4 y que no existan PGHOST/PGPORT conflictivos.");
  }
};

// Ejecutar test al inicializar
testConnection();

export default pool;
