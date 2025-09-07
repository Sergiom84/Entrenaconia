import express from 'express';

const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Calistenia test route working!',
    timestamp: new Date().toISOString()
  });
});

router.post('/evaluate', (req, res) => {
  res.json({
    success: true,
    message: 'Evaluate endpoint working!',
    body: req.body
  });
});

export default router;