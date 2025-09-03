import { pool } from './backend/db.js';

async function fixHomeTrainingSessions() {
  try {
    console.log('🔧 ARREGLANDO TABLA home_training_sessions');
    console.log('==========================================\n');

    // 1. Verificar estructura actual
    console.log('1. Estructura actual de home_training_sessions:');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
      AND table_name = 'home_training_sessions'
      ORDER BY ordinal_position
    `);

    tableStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'}) default: ${col.column_default || 'none'}`);
    });

    // 2. Verificar si faltan columnas
    const columnNames = tableStructure.rows.map(row => row.column_name);
    const missingColumns = [];
    
    if (!columnNames.includes('updated_at')) {
      missingColumns.push('updated_at TIMESTAMP DEFAULT NOW()');
    }
    
    if (!columnNames.includes('created_at')) {
      missingColumns.push('created_at TIMESTAMP DEFAULT NOW()');
    }

    // 3. Añadir columnas faltantes
    if (missingColumns.length > 0) {
      console.log('\n2. Añadiendo columnas faltantes:');
      
      for (const column of missingColumns) {
        console.log(`   + Añadiendo: ${column}`);
        await pool.query(`
          ALTER TABLE app.home_training_sessions 
          ADD COLUMN IF NOT EXISTS ${column}
        `);
        console.log('   ✅ Añadida correctamente');
      }
    } else {
      console.log('\n2. ✅ No faltan columnas, tabla está completa');
    }

    // 4. Actualizar registros existentes sin updated_at
    console.log('\n3. Actualizando registros existentes...');
    const updateResult = await pool.query(`
      UPDATE app.home_training_sessions 
      SET updated_at = COALESCE(completed_at, started_at, NOW()),
          created_at = COALESCE(created_at, started_at, NOW())
      WHERE updated_at IS NULL OR created_at IS NULL
    `);
    
    console.log(`   ✅ Actualizados ${updateResult.rowCount} registros`);

    // 5. Verificar estructura final
    console.log('\n4. Estructura final de home_training_sessions:');
    const finalStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
      AND table_name = 'home_training_sessions'
      ORDER BY ordinal_position
    `);

    finalStructure.rows.forEach(col => {
      const isNew = !columnNames.includes(col.column_name);
      const marker = isNew ? ' 🆕' : '';
      console.log(`   - ${col.column_name}: ${col.data_type}${marker}`);
    });

    // 6. Probar el endpoint problemático
    console.log('\n5. Probando consulta problemática...');
    const testResult = await pool.query(`
      UPDATE app.home_training_sessions
      SET status = 'test', 
          completed_at = NOW(),
          updated_at = NOW()
      WHERE 1 = 0  -- No actualizar nada, solo probar sintaxis
      RETURNING id
    `);
    
    console.log('   ✅ Consulta funciona correctamente ahora');

    console.log('\n✅ TABLA home_training_sessions ARREGLADA');
    
  } catch (error) {
    console.error('❌ Error arreglando tabla:', error);
  } finally {
    process.exit(0);
  }
}

fixHomeTrainingSessions();