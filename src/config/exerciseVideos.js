/**
 * 🎬 Configuración de Videos de Ejercicios
 *
 * DESARROLLO:
 * - Usa videos locales desde /public/exercise-videos/
 * - Agrega nuevos ejercicios aquí para verlos inmediatamente
 *
 * PRODUCCIÓN:
 * - Los videos vienen de la BD (columna video_url)
 * - Este archivo solo se usa si video_url está vacío
 */

/**
 * Mapping de ejercicios → videos locales para DESARROLLO
 *
 * Estructura:
 * "nombre del ejercicio (case insensitive)": "nombre-del-archivo.mp4"
 *
 * Ejemplo:
 * "press de pecho inclinado": "press-pecho-inclinado.mp4"
 */
export const LOCAL_VIDEO_MAPPING = {
  // 💪 Ejemplos (agrega tus ejercicios aquí)
  'press de pecho inclinado': '/exercise-videos/Press de pecho inclinado.mp4',
  'press pecho inclinado': '/exercise-videos/Press de pecho inclinado.mp4',

  // Agrega más ejercicios aquí:
  // 'dominadas': '/exercise-videos/dominadas.mp4',
  // 'sentadilla': '/exercise-videos/sentadilla.mp4',
  // 'peso muerto': '/exercise-videos/peso-muerto.mp4',
};

/**
 * 🎬 MODO DESARROLLO
 *
 * Opciones:
 * - 'single': Mostrar SIEMPRE el mismo video en todos los ejercicios (para pruebas rápidas)
 * - 'mapping': Usar el mapping LOCAL_VIDEO_MAPPING (videos específicos por ejercicio)
 * - 'off': Desactivado (usar solo videos de BD o GIFs)
 *
 * PRODUCCIÓN: Siempre usa 'single' para mostrar el mismo video en todos los ejercicios
 */
export const DEV_VIDEO_MODE = 'single'; // 'single' | 'mapping' | 'off'

/**
 * Video a usar en modo 'single'
 *
 * SIEMPRE usa URL pública de Supabase para garantizar funcionamiento en todas las metodologías
 */
export const DEV_SINGLE_VIDEO = 'https://lhsnmjgdtjalfcsurxvg.supabase.co/storage/v1/object/public/exercise-videos/Press%20de%20pecho%20inclinado.mp4';

/**
 * Buscar video local para un ejercicio
 *
 * @param {string} exerciseName - Nombre del ejercicio
 * @returns {string|null} - URL del video local o null
 */
export function getLocalVideo(exerciseName) {
  if (!exerciseName) return null;

  // Modo single: siempre el mismo video
  if (DEV_VIDEO_MODE === 'single') {
    return DEV_SINGLE_VIDEO;
  }

  // Modo mapping: buscar por nombre
  if (DEV_VIDEO_MODE === 'mapping') {
    const normalizedName = exerciseName.toLowerCase().trim();

    // Buscar coincidencia exacta
    if (LOCAL_VIDEO_MAPPING[normalizedName]) {
      return LOCAL_VIDEO_MAPPING[normalizedName];
    }

    // Buscar coincidencia parcial (más flexible)
    for (const [key, value] of Object.entries(LOCAL_VIDEO_MAPPING)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return value;
      }
    }
  }

  // Modo off o no encontrado
  return null;
}

/**
 * Verificar si un ejercicio tiene video local configurado
 */
export function hasLocalVideo(exerciseName) {
  return getLocalVideo(exerciseName) !== null;
}

/**
 * Obtener URL de video (prioridad: BD > Local > Fallback único)
 *
 * @param {object} exercise - Objeto ejercicio con { nombre, video_url, gif_url }
 * @returns {string|null} - URL del video/gif o null
 */
export function getExerciseVideoUrl(exercise) {
  if (!exercise) return null;

  // 1. Prioridad: video_url de BD (producción)
  if (exercise.video_url) {
    return exercise.video_url;
  }

  // 2. Video local configurado (desarrollo/modo single/mapping)
  const localVideo = getLocalVideo(exercise.nombre);
  if (localVideo) {
    return localVideo;
  }

  // 3. Fallback: gif_url de BD
  if (exercise.gif_url) {
    return exercise.gif_url;
  }

  // 4. ⚠️ NUEVO: Si DEV_VIDEO_MODE es 'single' y no hay video en BD,
  //    usar el video único como fallback para pruebas
  if (DEV_VIDEO_MODE === 'single') {
    return DEV_SINGLE_VIDEO;
  }

  // 5. Sin video/gif
  return null;
}

export default {
  LOCAL_VIDEO_MAPPING,
  DEV_VIDEO_MODE,
  DEV_SINGLE_VIDEO,
  getLocalVideo,
  hasLocalVideo,
  getExerciseVideoUrl
};
