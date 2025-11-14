import pool from './db.js';

console.log('🔍 Estado del Pool de Conexiones:');
console.log('Total connections:', pool.totalCount);
console.log('Idle connections:', pool.idleCount);
console.log('Waiting requests:', pool.waitingCount);

process.exit(0);
