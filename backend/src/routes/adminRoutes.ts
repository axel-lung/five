import { Router } from 'express';
import {
  getStats,
  searchUsers,
  getUserDetail,
  suspendUser,
  unsuspendUser,
  listReports,
  updateReport,
  listAuditLogs,
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { validateRequest } from '../middleware/validateRequest';
import { createVenue, deactivateVenue } from '../controllers/venueController';
import { suspendUserSchema, updateReportSchema, createVenueSchema } from '../utils/validationSchemas';

const router = Router();

// L'ordre compte : requireAdmin lit req.user, pose par authenticateToken.
router.use(authenticateToken);
router.use(requireAdmin);

// B-01
router.get('/stats', getStats);

// B-03 : support
router.get('/users', searchUsers);
router.get('/users/:id', getUserDetail);

// B-02 : moderation
router.post('/users/:id/suspend', validateRequest(suspendUserSchema), suspendUser);
router.post('/users/:id/unsuspend', unsuspendUser);
router.get('/reports', listReports);
router.patch('/reports/:id', validateRequest(updateReportSchema), updateReport);

// PA-03 : le catalogue des complexes engage la relation partenaire, il
// n'est pas alimente par les joueurs.
router.post('/venues', validateRequest(createVenueSchema), createVenue);
router.delete('/venues/:id', deactivateVenue);

// B-06 : journal, en lecture seule.
router.get('/audit-logs', listAuditLogs);

export default router;
