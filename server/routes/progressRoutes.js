import express from 'express';
import { getProgress, getExerciseProgress } from '../controllers/progressController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All progress endpoints require authentication
router.use(authenticateToken);

router.get('/', getProgress);
router.get('/exercises/:exerciseId', getExerciseProgress);

export default router;
