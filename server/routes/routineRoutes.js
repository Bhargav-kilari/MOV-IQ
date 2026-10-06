import express from 'express';
import {
  getRoutines,
  getRoutineById,
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from '../controllers/routineController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routine endpoints require authentication and user-scoping
router.use(authenticateToken);

router.get('/', getRoutines);
router.get('/:id', getRoutineById);
router.post('/', createRoutine);
router.put('/:id', updateRoutine);
router.delete('/:id', deleteRoutine);

export default router;
