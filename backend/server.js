import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { preloadAllPrompts } from './lib/promptRegistry.js';
import { validateAPIKeys } from './lib/openaiClient.js';

// Helper function for Spanish timezone (UTC+2/UTC+1 depending on DST)
function getSpanishTimestamp() {
  const now = new Date();
  const madridTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
  return madridTime.toISOString();
}
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import medicalDocsRoutes from './routes/medicalDocs.js';
import homeTrainingRoutes from './routes/homeTraining.js';
import iaHomeTrainingRoutes from './routes/IAHomeTraining.js';
import equipmentRoutes from './routes/equipment.js';
import aiVideoCorrection from './routes/aiVideoCorrection.js';
import aiPhotoCorrection from './routes/aiPhotoCorrection.js';
import aiMethodologie from './routes/aiMethodologie.js';
import methodologyManualRoutes from './routes/methodologyManual.js';
import methodologyManualRoutinesRoutes from './routes/methodologyManualRoutines.js';
import gymRoutineAIRoutes from './routes/gymRoutineAI.js';
import bodyCompositionRoutes from './routes/bodyComposition.js';
import uploadsRoutes from './routes/uploads.js';
import exercisesRoutes from './routes/exercises.js';
import techniqueRoutes from './routes/technique.js';
import nutritionRoutes from './routes/nutrition.js';
import musicRoutes from './routes/music.js';
import { pool } from './db.js';
import routinesRoutes from './routes/routines.js';
import calisteniaManualRoutes from './routes/calisteniaManual.js';
import calisteniaExercisesRoutes from './routes/calisteniaExercises.js';
import calisteniaSpecialistRoutes from './routes/calisteniaSpecialist.js';

// Solo cargar dotenv en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3002;

// --- utilidades de path para servir el frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST = path.join(__dirname, '../dist'); // ajusta si tu build sale en otra carpeta

// Verificar search_path y precargar prompts al arrancar el backend
(async () => {
  try {
    const { rows } = await pool.query('SHOW search_path;');
    console.log('📂 search_path actual:', rows[0].search_path);

    // Verificar que la tabla users existe
    const userCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'users'
      );
    `);

    if (userCheck.rows[0].exists) {
      console.log('✅ Tabla users encontrada (search_path)');
    } else {
      console.warn('⚠️ Tabla users NO encontrada en search_path actual');
    }

    // Precargar prompts en caché
    console.log('🔄 Precargando prompts de IA...');
    const promptResult = await preloadAllPrompts();
    console.log(`✅ Prompts cargados: ${promptResult.successful}/${promptResult.total} exitosos`);

    // Validar API keys
    console.log('🔑 Validando API keys...');
    const apiKeyStatus = validateAPIKeys();
    if (apiKeyStatus.allConfigured) {
      console.log('✅ Todas las API keys configuradas correctamente');
      console.log('🤖 Features disponibles: photo, video, home, methodologie, nutrition, calistenia_specialist');
    } else {
      console.warn('⚠️ API keys faltantes:', apiKeyStatus.missing.join(', '));
      console.log('🔍 Estado detallado:', apiKeyStatus.features);
    }

  } catch (err) {
    console.error('❌ Error en inicialización:', err);
  }
})();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'https://entrenaconia.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de peticiones
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${getSpanishTimestamp()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Info base de auth (evita 404 en GET /api/auth)
app.get('/api/auth', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auth API base. Usa los endpoints específicos (p. ej. /api/auth/login, /api/auth/register, /api/auth/logout, /api/auth/refresh, etc.).'
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medical-docs', medicalDocsRoutes);
app.use('/api/home-training', homeTrainingRoutes);
app.use('/api/ia-home-training', iaHomeTrainingRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/ai', aiVideoCorrection);
app.use('/api/ai-photo-correction', aiPhotoCorrection);
app.use('/api/methodologie', aiMethodologie);
app.use('/api/methodology-manual', methodologyManualRoutes);
app.use('/api/manual-routines', methodologyManualRoutinesRoutes);
app.use('/api/gym-routine', gymRoutineAIRoutes);
app.use('/api/body-composition', bodyCompositionRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/exercises', calisteniaExercisesRoutes);
app.use('/api/technique', techniqueRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/routines', routinesRoutes);
app.use('/api/calistenia-manual', calisteniaManualRoutes);
app.use('/api/calistenia-specialist', calisteniaSpecialistRoutes);

// Endpoint simple de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// === SERVIR FRONTEND ESTÁTICO (después de las rutas /api/*) ===
app.use(express.static(FRONTEND_DIST));

// Catch-all: cualquier ruta que NO empiece por /api la atiende el frontend
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

// Endpoint de test para validar módulos IA
app.get('/api/test-ai-modules', async (req, res) => {
  try {
    const { getOpenAIClient } = await import('./lib/openaiClient.js');
    const { getPrompt } = await import('./lib/promptRegistry.js');

    const features = ['video', 'photo', 'home', 'methodologie', 'nutrition'];
    const results = [];

    for (const feature of features) {
      try {
        // 1. Verificar cliente OpenAI
        const client = getOpenAIClient(feature);

        // 2. Verificar prompt
        const prompt = await getPrompt(feature);

        results.push({
          feature: feature.toUpperCase(),
          status: 'OK',
          client: '✅ Cliente creado',
          prompt: `✅ Prompt cargado (${prompt.length} caracteres)`,
          preview: prompt.substring(0, 100) + '...'
        });

      } catch (error) {
        results.push({
          feature: feature.toUpperCase(),
          status: 'ERROR',
          error: error.message
        });
      }
    }

    res.json({
      message: 'Test de módulos IA completado',
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    res.status(500).json({
      error: 'Error ejecutando tests de IA',
      details: error.message
    });
  }
});

// Manejo de errores
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Algo salió mal!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// Ruta 404 (solo si aún no se respondió nada; las rutas no-/api ya las coge el frontend)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor en Render (0.0.0.0 obligatorio)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor backend ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`📊 Endpoint de salud: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🔐 Rutas de autenticación: http://0.0.0.0:${PORT}/api/auth`);
  console.log(`🗂️  Frontend estático servido desde: ${FRONTEND_DIST}`);
});
