import { Router } from 'express';
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  joinEvent,
  leaveEvent,
  getEventParticipants,
  getSharedEvent
} from '../controllers/eventController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createEventSchema, updateEventStatusSchema } from '../utils/validationSchemas';
import { createLimiter } from '../middleware/rateLimit';

const router = Router();

// E-07 : resume public d'un evenement, consultable sans compte.
// Doit rester AVANT le router.use(authenticateToken) ci-dessous.
router.get('/shared/:token', getSharedEvent);

// All routes below require authentication
router.use(authenticateToken);

// Event management routes
router.post('/', createLimiter, validateRequest(createEventSchema), createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.put('/:id', validateRequest(createEventSchema), updateEvent);
router.patch('/:id/status', validateRequest(updateEventStatusSchema), updateEventStatus);
router.delete('/:id', deleteEvent);

// Participation routes
router.post('/:id/join', joinEvent);
router.post('/:id/leave', leaveEvent);
router.get('/:id/participants', getEventParticipants);

export default router;
