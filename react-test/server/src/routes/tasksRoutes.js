import { Router } from 'express';
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/tasksController.js';
import { authMiddleware } from '../middleware/authMiddleWare.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllTasks);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
