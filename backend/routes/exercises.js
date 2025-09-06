import express from 'express';
import calisteniaExercisesRoutes from './calisteniaExercises.js';

const router = express.Router();

// Base de datos de ejercicios mock (en producción esto vendría de la base de datos)
const EXERCISES_DB = [
  {
    id: 'squat',
    slug: 'sentadilla',
    name: 'Sentadilla',
    categoria: 'piernas',
    common_errors: [
      'Rodillas hacia adentro (valgo)',
      'Inclinación excesiva del torso',
      'Falta de profundidad',
      'Peso en puntas de pies'
    ],
    key_points: [
      'Rodillas alineadas con pies',
      'Descender hasta ~90° de flexión',
      'Pecho erguido',
      'Peso en talones'
    ],
    musculos_principales: ['cuádriceps', 'glúteos'],
    dificultad: 'intermedio'
  },
  {
    id: 'deadlift',
    slug: 'peso-muerto',
    name: 'Peso Muerto',
    categoria: 'espalda',
    common_errors: [
      'Espalda redondeada',
      'Barra alejada del cuerpo',
      'Hiperextensión lumbar',
      'Rodillas bloqueadas prematuramente'
    ],
    key_points: [
      'Columna neutra',
      'Barra pegada al cuerpo',
      'Activar glúteos en la subida',
      'Extensión simultánea cadera-rodilla'
    ],
    musculos_principales: ['espalda baja', 'glúteos', 'isquiotibiales'],
    dificultad: 'avanzado'
  },
  {
    id: 'pushup',
    slug: 'flexion-brazos',
    name: 'Flexión de Brazos',
    categoria: 'pecho',
    common_errors: [
      'Cadera elevada o hundida',
      'ROM incompleto',
      'Manos mal posicionadas',
      'Cabeza adelantada'
    ],
    key_points: [
      'Línea recta cabeza-talones',
      'Descender hasta tocar suelo',
      'Manos bajo hombros',
      'Mirada neutra'
    ],
    musculos_principales: ['pecho', 'tríceps', 'deltoides anterior'],
    dificultad: 'principiante'
  },
  {
    id: 'pullup',
    slug: 'dominada',
    name: 'Dominada',
    categoria: 'espalda',
    common_errors: [
      'Balanceo excesivo',
      'Rango incompleto',
      'Hombros hacia adelante',
      'No activar core'
    ],
    key_points: [
      'Control del movimiento',
      'Barbilla por encima de la barra',
      'Escápulas retraídas',
      'Core activo'
    ],
    musculos_principales: ['dorsales', 'bíceps', 'romboides'],
    dificultad: 'avanzado'
  },
  {
    id: 'plank',
    slug: 'plancha',
    name: 'Plancha',
    categoria: 'core',
    common_errors: [
      'Cadera muy alta',
      'Cadera muy baja',
      'Cabeza colgando',
      'No activar glúteos'
    ],
    key_points: [
      'Línea recta de cabeza a pies',
      'Codos bajo hombros',
      'Mirada neutra',
      'Respiración controlada'
    ],
    musculos_principales: ['core', 'deltoides', 'glúteos'],
    dificultad: 'principiante'
  }
];

/**
 * GET /api/exercises
 * Obtener lista de ejercicios disponibles
 */
router.get('/', (req, res) => {
  try {
    const { limit = 50, categoria, dificultad, search } = req.query;
    
    let exercises = [...EXERCISES_DB];

    // Filtrar por categoría
    if (categoria) {
      exercises = exercises.filter(ex => 
        ex.categoria.toLowerCase().includes(categoria.toLowerCase())
      );
    }

    // Filtrar por dificultad
    if (dificultad) {
      exercises = exercises.filter(ex => 
        ex.dificultad.toLowerCase() === dificultad.toLowerCase()
      );
    }

    // Buscar por nombre
    if (search) {
      exercises = exercises.filter(ex => 
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.slug.includes(search.toLowerCase())
      );
    }

    // Aplicar límite
    const limitNum = parseInt(limit);
    if (limitNum > 0) {
      exercises = exercises.slice(0, limitNum);
    }

    res.json({
      success: true,
      total: exercises.length,
      items: exercises,
      metadata: {
        filters_applied: {
          categoria: categoria || null,
          dificultad: dificultad || null,
          search: search || null,
          limit: limitNum
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo ejercicios:', error);
    res.status(500).json({
      error: 'Error interno obteniendo ejercicios',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/exercises/:id
 * Obtener detalles de un ejercicio específico
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const exercise = EXERCISES_DB.find(ex => 
      ex.id === id || ex.slug === id
    );

    if (!exercise) {
      return res.status(404).json({
        error: 'Ejercicio no encontrado',
        code: 'EXERCISE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      exercise,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo ejercicio:', error);
    res.status(500).json({
      error: 'Error interno obteniendo ejercicio',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/exercises/categories
 * Obtener categorías disponibles
 */
router.get('/meta/categories', (req, res) => {
  try {
    const categories = [...new Set(EXERCISES_DB.map(ex => ex.categoria))];
    
    res.json({
      success: true,
      categories: categories.map(cat => ({
        name: cat,
        count: EXERCISES_DB.filter(ex => ex.categoria === cat).length
      })),
      metadata: {
        total_categories: categories.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      error: 'Error interno obteniendo categorías',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Integrar rutas de ejercicios de calistenia
router.use('/', calisteniaExercisesRoutes);

export default router;
