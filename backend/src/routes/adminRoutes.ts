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
import { suspendUserSchema, updateReportSchema } from '../utils/validationSchemas';

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

// B-06 : journal, en lecture seule.
router.get('/audit-logs', listAuditLogs);

export default router;
