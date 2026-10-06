import express from 'express';
import {
  getWorkouts,
  getWorkoutById,
  createWorkout,
  updateWorkout,
  completeWorkout,
} from '../controllers/workoutController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All workout endpoints require authentication
router.use(authenticateToken);

router.get('/', getWorkouts);
router.get('/:id', getWorkoutById);
router.post('/', createWorkout);
router.put('/:id', updateWorkout);
router.post('/:id/complete', completeWorkout);

export default router;
