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
  'flexiones de brazos': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Pushups.gif',
  'flexiones de brazos con rodillas apoyadas': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Pushups.gif',
  'mountain climbers': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Mountain_Climbers.gif',
  'escaladores': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Mountain_Climbers.gif',
  'plancha con toque de hombro': 'https://media1.tenor.com/m/8-2v2Y7vWzkAAAAC/shoulder-taps.gif',

  // --- Mapeos enviados por Sergio (placeholders) ---
  'remo con bandas elasticas': 'https://media.tenor.com/aU5UOaJcI3cAAAAC/resistance-band-row.gif',
  'burpees modificados': 'https://upload.wikimedia.org/wikipedia/commons/5/53/Burpee.gif',
  'burpees sin salto': 'https://upload.wikimedia.org/wikipedia/commons/5/53/Burpee.gif',
  'elevacion de caderas con banda elastica': 'https://media.tenor.com/XxqJHZrU2aQAAAAC/hip-thrust.gif',
  'elevaciones de pantorrillas en escalon': 'https://media.tenor.com/hFqfAeq2t4MAAAAC/calf-raises.gif',
  'escaladores sin salto': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Mountain_Climbers.gif',
  'flexiones de brazos con pies elevados en silla': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Pushups.gif',
  'flexiones de brazos invertidas en sofa': 'https://media.tenor.com/uXv8G2YfN0QAAAAC/incline-pushup.gif',
  'plancha dinamica': 'https://media.tenor.com/sLW3yMc0eBQAAAAC/plank-up-and-down.gif',
  'press de hombro con mancuernas': 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Dumbbell_shoulder_press.gif',
  'puente de gluteos': 'https://media.tenor.com/5ZkFQ7n1vJ8AAAAC/glute-bridge.gif',
  'push-up a escalera': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Pushups.gif',
  'remo alto con banda elastica': 'https://media.tenor.com/ewkZ3n3iQ2kAAAAC/upright-row.gif',
  'remo inclinado con bandas elasticas': 'https://media.tenor.com/aU5UOaJcI3cAAAAC/resistance-band-row.gif',
  'saltos en banco step': 'https://media.tenor.com/5G1aR8QIKRMAAAAC/step-ups.gif',
  'sentadilla a la pared': 'https://media.tenor.com/7YqVQzFqYk0AAAAC/wall-sit.gif',
  'sentadilla con mancuernas': 'https://upload.wikimedia.org/wikipedia/commons/4/49/Dumbbell_Squat.gif',
  'sentadilla en silla': 'https://media.tenor.com/X8PiH2eapT8AAAAC/chair-squat.gif',
  'sentadilla isla con bandas elasticas': 'https://media.tenor.com/ThcVq-1zYRIAAAAC/band-squat.gif',
  'zancadas alternas con mancuernas': 'https://upload.wikimedia.org/wikipedia/commons/2/23/Dumbbell_Lunge.gif',
  'mountain climbers en banco': 'https://media.tenor.com/fyP2K0m1w9kAAAAC/mountain-climber-bench.gif',

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

