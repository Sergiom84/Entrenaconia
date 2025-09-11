import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de la base de datos
const pool = new Pool({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lhsnmjgdtjalfcsurxvg',
  password: 'Xe05Klm563kkjL',
  ssl: { rejectUnauthorized: false },
  search_path: 'app,public'
});

async function executeCleanupScript() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando limpieza de planes activos duplicados...\n');
    
    // Leer el script SQL
    const scriptPath = path.join(__dirname, 'database_scripts', 'clean_duplicate_active_plans.sql');
    let sqlScript = fs.readFileSync(scriptPath, 'utf8');
    
    // Cambiar ROLLBACK por COMMIT para aplicar los cambios
    sqlScript = sqlScript.replace('ROLLBACK;', 'COMMIT;');
    
    console.log('📄 Ejecutando script de limpieza...\n');
    
    // Ejecutar el script
    const result = await client.query(sqlScript);
    
    console.log('✅ Script ejecutado exitosamente\n');
    
    // Mostrar resultados si los hay
    if (Array.isArray(result)) {
      result.forEach((res, index) => {
        if (res.rows && res.rows.length > 0) {
          console.log(`📊 Resultado ${index + 1}:`);
          console.table(res.rows);
          console.log('');
        }
      });
    } else if (result.rows && result.rows.length > 0) {
      console.log('📊 Resultados:');
      console.table(result.rows);
    }
    
    console.log('🎉 Limpieza completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error ejecutando script:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    pool.end();
  }
}

executeCleanupScript();