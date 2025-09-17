// Utilidades para logging detallado de datos enviados a IA
import util from 'util';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

const logSeparator = (title = 'AI REQUEST', color = 'cyan') => {
  const separator = '='.repeat(80);
  console.log(colors[color] + colors.bright + separator + colors.reset);
  console.log(colors[color] + colors.bright + `📊 ${title.toUpperCase()}` + colors.reset);
  console.log(colors[color] + colors.bright + separator + colors.reset);
};

const logSubSection = (title, color = 'yellow') => {
  console.log(colors[color] + colors.bright + `\n🔹 ${title}` + colors.reset);
  console.log(colors[color] + '-'.repeat(50) + colors.reset);
};

const logObject = (obj, maxDepth = 3) => {
  console.log(util.inspect(obj, {
    colors: true,
    depth: maxDepth,
    compact: false,
    breakLength: 80
  }));
};

const logUserProfile = (user, userId) => {
  logSubSection('PERFIL DEL USUARIO', 'green');
  console.log(colors.green + `👤 Usuario ID: ${userId}` + colors.reset);
  
  if (user) {
    const userInfo = {
      'Datos Básicos': {
        edad: user.edad || 'No especificado',
        peso: user.peso_kg ? `${user.peso_kg} kg` : (user.peso ? `${user.peso} kg` : 'No especificado'),
        altura: user.altura_cm ? `${user.altura_cm} cm` : (user.altura ? `${user.altura} cm` : 'No especificado'),
        sexo: user.sexo || 'No especificado'
      },
      'Entrenamiento': {
        // Usar 'nivel' que es el campo que viene de la vista (COALESCE de nivel_actividad y nivel_entrenamiento)
        nivel_actividad: user.nivel || user.nivel_actividad || 'No especificado',
        nivel_entrenamiento: user.nivel_entrenamiento || user.nivel || 'No especificado',
        años_entrenando: user["años_entrenando"] || user.anos_entrenando || user.años_entrenando || 'No especificado',
        objetivo_principal: user.objetivo_principal || 'No especificado'
      },
      'Composición Corporal': {
        grasa_corporal: user.grasa_corporal || 'No especificado',
        masa_muscular: user.masa_muscular || 'No especificado',
        pecho: user.pecho || 'No especificado',
        brazos: user.brazos || 'No especificado'
      },
      'Otros': {
        suplementacion: Array.isArray(user.suplementacion) ? user.suplementacion.join(', ') : (user.suplementacion || 'Ninguna'),
        medicamentos: Array.isArray(user.medicamentos) ? user.medicamentos.filter(med => med && med.trim()).join(', ') : (user.medicamentos || 'Ninguno'),
        alergias: user.alergias || 'Ninguna',
        limitaciones_fisicas: Array.isArray(user.limitaciones_fisicas) ? user.limitaciones_fisicas.join(', ') : (user.limitaciones_fisicas || 'Ninguna')
      }
    };
    
    logObject(userInfo, 2);
  } else {
    console.log(colors.red + '❌ No se encontraron datos del usuario' + colors.reset);
  }
};

const logRecentExercises = (exercises) => {
  logSubSection('EJERCICIOS RECIENTES (Para evitar repetición)', 'magenta');
  
  if (exercises && exercises.length > 0) {
    console.log(colors.magenta + `📋 Total de ejercicios recientes: ${exercises.length}` + colors.reset);
    
    exercises.forEach((ex, index) => {
      const exerciseName = ex.exercise_name || ex.nombre || 'Sin nombre';
      
      // Verificar si es del historial agregado o ejercicio individual
      if (ex.usage_count && ex.last_used) {
        // Ejercicio del historial agregado
        const lastUsed = new Date(ex.last_used).toLocaleDateString('es-ES');
        const usageCount = ex.usage_count;
        const avgReps = ex.avg_reps ? Math.round(ex.avg_reps) : null;
        const avgSeries = ex.avg_series ? Math.round(ex.avg_series) : null;
        const avgLoad = ex.avg_load ? Math.round(ex.avg_load * 10) / 10 : null;
        
        let avgInfo = [];
        if (avgReps) avgInfo.push(`${avgReps} reps`);
        if (avgSeries) avgInfo.push(`${avgSeries} series`);
        if (avgLoad) avgInfo.push(`${avgLoad}kg`);
        
        console.log(colors.magenta + `${index + 1}. ${exerciseName}` + colors.reset);
        console.log(colors.dim + `   Usado ${usageCount} veces - Último: ${lastUsed}${avgInfo.length > 0 ? ` - Promedio: ${avgInfo.join(', ')}` : ''}` + colors.reset);
      } else if (ex.category || ex.difficulty_level) {
        // Ejercicio del catálogo
        const category = ex.category || 'General';
        const difficulty = ex.difficulty_level || 'Estándar';
        
        console.log(colors.magenta + `${index + 1}. ${exerciseName}` + colors.reset);
        console.log(colors.dim + `   Categoría: ${category} - Dificultad: ${difficulty}` + colors.reset);
      } else {
        // Ejercicio individual (formato anterior)
        const lastUsed = ex.created_at ? new Date(ex.created_at).toLocaleDateString('es-ES') : 'Sin fecha';
        const repsInfo = ex.reps ? `${ex.reps} reps` : '';
        const seriesInfo = ex.series ? `${ex.series} series` : '';
        const loadInfo = ex.load_kg ? `${ex.load_kg}kg` : '';
        
        console.log(colors.magenta + `${index + 1}. ${exerciseName}` + colors.reset);
        console.log(colors.dim + `   Último uso: ${lastUsed} - ${[repsInfo, seriesInfo, loadInfo].filter(Boolean).join(', ')}` + colors.reset);
      }
    });
    
    console.log(colors.yellow + '\n⚠️  La IA evitará usar estos ejercicios prioritariamente' + colors.reset);
  } else {
    console.log(colors.green + '✅ No hay ejercicios recientes - La IA tendrá libertad total' + colors.reset);
  }
};

const logAIPayload = (methodology, userData) => {
  logSubSection('PAYLOAD COMPLETO ENVIADO A LA IA', 'blue');
  
  console.log(colors.blue + `🎯 Metodología solicitada: ${methodology}` + colors.reset);
  
  if (userData) {
    try {
      console.log(colors.blue + `📊 Tamaño del payload: ${JSON.stringify(userData).length} caracteres` + colors.reset);
    } catch (e) {
      console.log(colors.blue + `📊 Tamaño del payload: No se pudo calcular (${e.message})` + colors.reset);
    }
    
    console.log(colors.blue + '\n📦 Estructura completa del payload:' + colors.reset);
    logObject(userData, 4);
  } else {
    console.log(colors.red + '❌ No se recibieron datos del usuario para la IA' + colors.reset);
  }
};

const logAIResponse = (response) => {
  logSubSection('RESPUESTA DE LA IA', 'green');
  
  try {
    const planData = typeof response === 'string' ? JSON.parse(response) : response;
    
    console.log(colors.green + `✅ Metodología generada: ${planData.selected_style || 'No especificado'}` + colors.reset);
    console.log(colors.green + `📅 Duración: ${planData.duracion_total_semanas || 'No especificado'} semanas` + colors.reset);
    console.log(colors.green + `🔄 Frecuencia: ${planData.frecuencia_por_semana || 'No especificado'} días/semana` + colors.reset);
    console.log(colors.green + `📈 Progresión: ${planData.progresion?.metodo || 'No especificado'}` + colors.reset);
    
    if (planData.semanas && planData.semanas.length > 0) {
      console.log(colors.green + `\n📊 RESUMEN DEL PLAN GENERADO:` + colors.reset);
      
      planData.semanas.forEach((semana) => {
        console.log(colors.cyan + `\n🗓️  SEMANA ${semana.semana}:` + colors.reset);
        
        if (semana.sesiones && semana.sesiones.length > 0) {
          semana.sesiones.forEach((sesion) => {
            console.log(colors.yellow + `  📍 ${sesion.dia} (${sesion.duracion_sesion_min}min, ${sesion.intensidad_guia})` + colors.reset);
            console.log(colors.yellow + `     🎯 ${sesion.objetivo_de_la_sesion}` + colors.reset);
            
            if (sesion.ejercicios && sesion.ejercicios.length > 0) {
              console.log(colors.white + `     💪 ${sesion.ejercicios.length} ejercicios:` + colors.reset);
              
              sesion.ejercicios.forEach((ejercicio, ejIdx) => {
                const reps = ejercicio.repeticiones || 'No especificado';
                const series = ejercicio.series || 'No especificado';
                const descanso = ejercicio.descanso_seg || 'No especificado';
                
                console.log(colors.dim + `       ${ejIdx + 1}. ${ejercicio.nombre}` + colors.reset);
                console.log(colors.dim + `          ${series} series x ${reps} reps, ${descanso}s descanso` + colors.reset);
                
                if (ejercicio.intensidad) {
                  console.log(colors.dim + `          Intensidad: ${ejercicio.intensidad}` + colors.reset);
                }
                
                if (ejercicio.notas) {
                  console.log(colors.dim + `          Notas: ${ejercicio.notas.substring(0, 60)}${ejercicio.notas.length > 60 ? '...' : ''}` + colors.reset);
                }
              });
            }
          });
        }
      });
    }
    
    // Validaciones
    if (planData.validacion) {
      console.log(colors.blue + '\n🔍 VALIDACIONES:' + colors.reset);
      logObject(planData.validacion, 1);
    }
    
    // Consideraciones y safety notes
    if (planData.consideraciones) {
      console.log(colors.yellow + '\n⚠️  CONSIDERACIONES:' + colors.reset);
      console.log(colors.yellow + planData.consideraciones + colors.reset);
    }
    
    if (planData.safety_notes) {
      console.log(colors.red + '\n🚨 NOTAS DE SEGURIDAD:' + colors.reset);
      console.log(colors.red + planData.safety_notes + colors.reset);
    }
    
  } catch (error) {
    console.log(colors.red + '❌ Error parseando respuesta de IA:' + colors.reset);
    console.log(colors.red + error.message + colors.reset);
    console.log(colors.dim + 'Respuesta raw:' + colors.reset);
    console.log(response);
  }
};

const logError = (error, context = '') => {
  logSubSection(`ERROR ${context}`, 'red');
  console.log(colors.red + colors.bright + '❌ ' + error.message + colors.reset);
  if (error.stack) {
    console.log(colors.red + colors.dim + error.stack + colors.reset);
  }
};

const logAPICall = (endpoint, method, userId) => {
  const timestamp = new Date().toISOString();
  console.log(colors.cyan + `\n🌐 ${method} ${endpoint} - Usuario: ${userId} - ${timestamp}` + colors.reset);
};

const logTokens = (response) => {
  if (response && response.usage) {
    logSubSection('CONSUMO DE TOKENS', 'magenta');
    console.log(colors.magenta + `📊 Tokens prompt: ${response.usage.prompt_tokens || 'N/A'}` + colors.reset);
    console.log(colors.magenta + `📊 Tokens completión: ${response.usage.completion_tokens || 'N/A'}` + colors.reset);
    console.log(colors.magenta + `📊 Tokens totales: ${response.usage.total_tokens || 'N/A'}` + colors.reset);
  }
};

export {
  logSeparator,
  logSubSection,
  logObject,
  logUserProfile,
  logRecentExercises,
  logAIPayload,
  logAIResponse,
  logError,
  logAPICall,
  logTokens,
  colors
};