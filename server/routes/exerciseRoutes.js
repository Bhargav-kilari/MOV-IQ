import express from 'express';
import {
  getExercises,
  getExerciseFilters,
  getRecentExercises,
  getExerciseById,
  getExerciseHistory,
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
} from '../controllers/exerciseController.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Specific routes before param :id
router.get('/filters', getExerciseFilters);
router.get('/recent', authenticateToken, getRecentExercises);

// Custom Exercises
router.post('/custom', authenticateToken, createCustomExercise);
router.put('/custom/:id', authenticateToken, updateCustomExercise);
router.delete('/custom/:id', authenticateToken, deleteCustomExercise);

// General catalog list (optional auth to include user's custom exercises)
router.get('/', optionalAuthenticateToken, getExercises);

// Exercise details & history by ID
router.get('/:id', optionalAuthenticateToken, getExerciseById);
router.get('/:id/history', authenticateToken, getExerciseHistory);

export default router;
