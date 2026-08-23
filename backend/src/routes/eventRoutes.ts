import { Router } from 'express';
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  joinEvent,
  leaveEvent,
  getEventParticipants
} from '../controllers/eventController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../utils/validationSchemas';
import { createEventSchema } from '../utils/validationSchemas';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Event management routes
router.post('/', validateRequest(createEventSchema), createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.put('/:id', validateRequest(createEventSchema), updateEvent);
router.delete('/:id', deleteEvent);

// Participation routes
router.post('/:id/join', joinEvent);
router.post('/:id/leave', leaveEvent);
router.get('/:id/participants', getEventParticipants);

export default router;