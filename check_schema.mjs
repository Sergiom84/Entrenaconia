import { pool } from './backend/db.js';

async function showTableSchemas() {
  try {
    const criticalTables = [
      'methodology_plans',
      'methodology_exercise_sessions',
      'home_training_sessions',
      'methodology_exercise_progress',
      'methodology_exercise_feedback',
      'user_sessions'
    ];

    for (const tableName of criticalTables) {
      console.log(`\n📋 Schema for ${tableName}:`);
      console.log('='.repeat(50));

      try {
        const result = await pool.query(`
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_name = $1
            AND table_schema IN ('app', 'public')
          ORDER BY ordinal_position
        `, [tableName]);

        if (result.rows.length > 0) {
          console.table(result.rows);
        } else {
          console.log(`❌ Table ${tableName} not found`);
        }
      } catch (error) {
        console.error(`Error fetching schema for ${tableName}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

showTableSchemas();