/**
 * Script para corregir las consultas de usuario en todos los archivos backend
 * Los datos del perfil están principalmente en la tabla 'users', no en 'user_profiles'
 */

import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';

const files = [
  'backend/routes/calisteniaManual.js',
  'backend/routes/IAHomeTraining.js',
  'backend/routes/methodologyManual.js',
  'backend/routes/gymRoutineAI.js',
  'backend/routes/bodyComposition.js'
];

const commonUserColumns = `u.id, u.nombre, u.apellido, u.email,
        u.edad, u.sexo, u.peso, u.altura,
        u.nivel_entrenamiento, u.anos_entrenando, u.frecuencia_semanal,
        u.grasa_corporal, u.masa_muscular, u.agua_corporal, u.metabolismo_basal,
        u.cintura, u.pecho, u.brazos, u.muslos, u.cuello, u.antebrazos, u.cadera,
        u.alergias, u.medicamentos, u.nivel_actividad, u.horario_preferido,
        u.comidas_por_dia, u.suplementacion, u.alimentos_excluidos, u.meta_peso,
        u.meta_grasa_corporal, u.enfoque_entrenamiento, u.historial_medico,
        u.lesiones, u.suplementacion,
        p.objetivo_principal, p.limitaciones_fisicas, p.metodologia_preferida`;

for (const file of files) {
  try {
    console.log(`🔧 Corrigiendo: ${file}`);
    
    let content = await readFile(file, 'utf-8');
    
    // Patrón para encontrar queries problemáticas
    const problematicPattern = /SELECT[\s\S]*?p\.\w+[\s\S]*?FROM app\.users u[\s\S]*?LEFT JOIN app\.user_profiles p[\s\S]*?WHERE/g;
    
    if (problematicPattern.test(content)) {
      console.log(`  ✅ Encontrado patrón problemático en ${file}`);
      console.log(`  📝 Archivo necesita corrección manual`);
    }
    
  } catch (error) {
    console.error(`❌ Error con ${file}:`, error.message);
  }
}

console.log('✅ Análisis completado. Los archivos necesitan corrección manual específica para cada caso.');