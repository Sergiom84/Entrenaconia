import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import methodologyService from '../services/methodology/index.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

/**
 * POST /api/methodology/generate
 * Endpoint unificado para generar planes (automático o manual)
 */
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      mode = 'automatic', // 'automatic' | 'manual'
      methodology = null, // Requerido para modo manual
      versionConfig = { version: 'adapted', customWeeks: 4 },
      evaluationResult = null // Para calistenia manual
    } = req.body;

    // Validación básica
    if (mode === 'manual' && !methodology) {
      return res.status(400).json({
        error: 'methodology_required',
        message: 'El modo manual requiere especificar una metodología'
      });
    }

    console.log(`🎯 Generating ${mode} plan for user ${userId}:`, {
      methodology: methodology || 'auto-selected',
      versionConfig
    });

    const result = await methodologyService.generatePlan(userId, {
      mode,
      methodology,
      versionConfig,
      evaluationResult
    });

    console.log(`✅ Plan generated successfully:`, {
      planId: result.planId,
      methodology: result.methodology,
      mode: result.mode
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Error in /generate:', error);

    // Manejo específico de errores conocidos
    if (error.message.includes('no encontrada')) {
      return res.status(400).json({
        error: 'methodology_not_found',
        message: error.message
      });
    }

    if (error.message.includes('incompleto')) {
      return res.status(400).json({
        error: 'incomplete_profile',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'generation_failed',
      message: 'Error interno al generar el plan',
      details: error.message
    });
  }
});

/**
 * GET /api/methodology/available
 * Obtener metodologías disponibles (filtradas por usuario si está autenticado)
 */
router.get('/available', async (req, res) => {
  try {
    const userId = req.user?.id;

    const methodologies = await methodologyService.getAvailableMethodologies(userId);

    res.json({
      success: true,
      methodologies,
      count: methodologies.length
    });

  } catch (error) {
    console.error('❌ Error in /available:', error);
    res.status(500).json({
      error: 'fetch_failed',
      message: 'Error al obtener metodologías disponibles'
    });
  }
});

/**
 * GET /api/methodology/recommended
 * Obtener metodologías recomendadas para el usuario
 */
router.get('/recommended', async (req, res) => {
  try {
    const userId = req.user.id;

    const recommendations = await methodologyService.getRecommendedMethodologies(userId);

    res.json({
      success: true,
      ...recommendations
    });

  } catch (error) {
    console.error('❌ Error in /recommended:', error);

    if (error.message.includes('no encontrado') || error.message.includes('incompleto')) {
      return res.status(400).json({
        error: 'incomplete_profile',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Error al obtener recomendaciones'
    });
  }
});

/**
 * GET /api/methodology/current
 * Obtener el plan activo actual del usuario
 */
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;

    const currentPlan = await methodologyService.getCurrentPlan(userId);

    if (!currentPlan) {
      return res.json({
        success: true,
        plan: null,
        message: 'No hay plan activo'
      });
    }

    res.json({
      success: true,
      plan: currentPlan
    });

  } catch (error) {
    console.error('❌ Error in /current:', error);
    res.status(500).json({
      error: 'fetch_failed',
      message: 'Error al obtener plan actual'
    });
  }
});

/**
 * POST /api/methodology/feedback
 * Registrar feedback de un ejercicio
 */
router.post('/feedback', async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId, exerciseName, feedback } = req.body;

    if (!planId || !exerciseName || !feedback) {
      return res.status(400).json({
        error: 'missing_data',
        message: 'Se requiere planId, exerciseName y feedback'
      });
    }

    await methodologyService.recordFeedback(userId, planId, exerciseName, feedback);

    res.json({
      success: true,
      message: 'Feedback registrado correctamente'
    });

  } catch (error) {
    console.error('❌ Error in /feedback:', error);
    res.status(500).json({
      error: 'feedback_failed',
      message: 'Error al registrar feedback'
    });
  }
});

/**
 * POST /api/methodology/complete-session
 * Marcar una sesión como completada
 */
router.post('/complete-session', async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionData = req.body;

    if (!sessionData || !sessionData.exercises) {
      return res.status(400).json({
        error: 'invalid_session_data',
        message: 'Datos de sesión inválidos'
      });
    }

    const sessionId = await methodologyService.completeSession(userId, sessionData);

    res.json({
      success: true,
      sessionId,
      message: 'Sesión completada correctamente'
    });

  } catch (error) {
    console.error('❌ Error in /complete-session:', error);
    res.status(500).json({
      error: 'session_failed',
      message: 'Error al completar sesión'
    });
  }
});

/**
 * GET /api/methodology/stats
 * Obtener estadísticas del usuario
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await methodologyService.getUserStats(userId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error in /stats:', error);
    res.status(500).json({
      error: 'stats_failed',
      message: 'Error al obtener estadísticas'
    });
  }
});

/**
 * GET /api/methodology/health
 * Health check del servicio
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'methodology-unified',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    user: req.user?.id || 'anonymous'
  });
});

export default router;