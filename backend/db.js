// backend/db.js
import pkg from "pg";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const { Pool } = pkg;

// --- 1) Fuente única de verdad: DATABASE_URL ---
// Render: usa conexión directa (DATABASE_URL definida en variables de entorno)
// Local: usa pooler con puerto 6543 para compatibilidad IPv4/IPv6
// IMPORTANTE: DATABASE_URL debe estar definida en .env
const rawConnStr = process.env.DATABASE_URL;

if (!rawConnStr) {
  throw new Error(
    "❌ DATABASE_URL no está definida. Por favor, configura la variable de entorno DATABASE_URL en tu archivo .env"
  );
}

// --- 2) Parseo robusto de la URL ---
let parsed;
try {
  parsed = new URL(rawConnStr);
} catch (e) {
  console.error("❌ DATABASE_URL inválida:", e.message);
  throw e;
}

const host = parsed.hostname; // ej: aws-1-eu-north-1.pooler.supabase.com
const port = Number(parsed.port || 5432);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres";
let user = decodeURIComponent(parsed.username || "postgres");
const password = decodeURIComponent(parsed.password || "");
const sslmode = parsed.searchParams.get("sslmode");

// --- 2.1) Fallback automático para pooler Supabase sin sufijo de tenant ---
const isSupabasePooler = host?.includes(".pooler.supabase.com");
const hasTenantSuffix = user?.includes(".");
if (isSupabasePooler && !hasTenantSuffix) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!projectRef && supabaseUrl) {
    try {
      const supabaseHost = new URL(supabaseUrl).hostname;
      projectRef = supabaseHost.split(".")[0];
    } catch (err) {
      console.warn("⚠️  SUPABASE_URL inválida, no se pudo derivar el project ref:", err.message);
    }
  }

  if (projectRef) {
    console.warn(
      `⚠️  Pooler Supabase detectado sin sufijo de tenant. Ajustando usuario a postgres.${projectRef}`
    );
    user = `${user}.${projectRef}`;
  } else {
    console.warn(
      "⚠️  Pooler Supabase detectado pero no se pudo determinar el project ref. " +
        "Asegúrate de usar postgres.<project_ref> en tu DATABASE_URL o define SUPABASE_PROJECT_REF."
    );
  }
}

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
