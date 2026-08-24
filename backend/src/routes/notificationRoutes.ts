import { Router } from 'express';
import {
  listNotifications,
  markRead,
  markAllRead,
  getPreferences,
  updatePreferences,
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { updateNotificationPreferencesSchema } from '../utils/validationSchemas';

const router = Router();

router.use(authenticateToken);

// N-04 : avant '/:id/read', pour que 'preferences' ne soit pas pris pour un id.
router.get('/preferences', getPreferences);
router.put('/preferences', validateRequest(updateNotificationPreferencesSchema), updatePreferences);

// N-05 : centre de notifications.
router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
