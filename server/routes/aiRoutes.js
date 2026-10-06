import express from 'express';
import {
  getAIHealth,
  getAIModels,
  predictPose,
  getSupportedExercises,
  saveAISession,
  getAIHistory,
} from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public / client-accessible endpoints
router.get('/health', getAIHealth);
router.get('/models', getAIModels);
router.get('/supported-exercises', getSupportedExercises);
router.post('/predict', predictPose);

// Authenticated user endpoints
router.post('/save-session', authenticateToken, saveAISession);
router.get('/history', authenticateToken, getAIHistory);

export default router;
