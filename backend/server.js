import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import { preloadAllPrompts } from './lib/promptRegistry.js';
import { validateAPIKeys } from './lib/openaiClient.js';
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

// Solo cargar dotenv en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3002;

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
      console.log('🤖 Features disponibles: photo, video, home, methodologie, nutrition');
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
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Rutas
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
app.use('/api/technique', techniqueRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/routines', routinesRoutes);

// Endpoint simple de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// === NUEVO: Ruta raíz ===
app.get('/', (req, res) => {
  res.type('html').send(`
    <h1>🚀 Entrena con IA – Backend</h1>
    <p>El servidor está funcionando.</p>
    <ul>
      <li><a href="/api/health">/api/health</a></li>
      <li><a href="/api/auth">/api/auth</a></li>
    </ul>
  `);
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

// Debug endpoint para limpiar cache de prompts
app.post('/api/debug/clear-prompt-cache', async (req, res) => {
  try {
    const { feature } = req.body;
    const { clearPromptCache, getCacheStatus } = await import('./lib/promptRegistry.js');

    const beforeStatus = getCacheStatus();
    clearPromptCache(feature);
    const afterStatus = getCacheStatus();

    res.json({
      success: true,
      message: `Cache ${feature ? `para feature ${feature}` : 'completo'} limpiado`,
      before: beforeStatus,
      after: afterStatus
    });
  } catch (error) {
    console.error('Error clearing prompt cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint para verificar contenido de prompts
app.get('/api/debug/prompt-content/:feature', async (req, res) => {
  try {
    const { feature } = req.params;
    const { getPrompt } = await import('./lib/promptRegistry.js');

    const content = await getPrompt(feature);
    const preview = content.substring(0, 200);
    const containsTraining = content.toLowerCase().includes('entrenamiento en casa');

    res.json({
      feature,
      contentLength: content.length,
      preview,
      containsTraining,
      firstLine: content.split('\n')[0]
    });
  } catch (error) {
    console.error('Error getting prompt content:', error);
    res.status(500).json({ error: error.message });
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

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor en Render (0.0.0.0 obligatorio)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor backend ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`📊 Endpoint de salud: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🔐 Rutas de autenticación: http://0.0.0.0:${PORT}/api/auth`);
});
