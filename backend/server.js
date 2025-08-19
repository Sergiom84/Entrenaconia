import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import medicalDocsRoutes from './routes/medicalDocs.js';
import homeTrainingRoutes from './routes/homeTraining.js';
import iaHomeTrainingRoutes from './routes/IAHomeTraining.js';
import { pool } from './db.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;


// Verificar search_path al arrancar el backend
(async () => {
  try {
    const { rows } = await pool.query('SHOW search_path;');
    console.log('📂 search_path actual:', rows[0].search_path);
  } catch (err) {
    console.error('Error verificando search_path:', err);
  }
})();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
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

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend de Entrena con IA funcionando correctamente',
    timestamp: new Date().toISOString()
  });
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Endpoint de salud: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Rutas de autenticación: http://localhost:${PORT}/api/auth`);
});
