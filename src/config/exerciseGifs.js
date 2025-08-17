// Utilidad para resolver GIFs animados por nombre de ejercicio
// Coloca los archivos .gif en public/gifs con los nombres indicados en el mapa,
// o bien pasa exercise.gif_url en el plan para usar una URL absoluta.

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Mapa de ejemplos. Puedes ampliarlo libremente. Los paths apuntan a /public/gifs/*
const GIFS_MAP = {
  // HIIT / básicos
  'burpees': 'https://upload.wikimedia.org/wikipedia/commons/5/53/Burpee.gif',
  'sentadillas con salto': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Jump_Squat.gif',
  'flexiones': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Pushups.gif',
  'mountain climbers': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Mountain_Climbers.gif',
  'plancha con toque de hombro': 'https://media1.tenor.com/m/8-2v2Y7vWzkAAAAC/shoulder-taps.gif',
  // Fuerza con barra
  'sentadilla con barra': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Back_Squat.gif',
  'peso muerto con barra': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Deadlift.gif',
  'peso muerto con discos olimpicos': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Deadlift.gif',
  'press de banca con barra': 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Bench_Press.gif',
  'dominadas': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Pull-up.gif',
  'fondos en paralelas': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Parallel_bar_dips.gif',
  'press militar con mancuernas': 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Dumbbell_shoulder_press.gif',
};

export function getExerciseGifUrl(name) {
  const key = normalize(name);
  return GIFS_MAP[key] || null;
}

export { normalize };

