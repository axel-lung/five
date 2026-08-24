import { Router } from 'express';
import { createReport } from '../controllers/moderationController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createReportSchema } from '../utils/validationSchemas';

const router = Router();

router.use(authenticateToken);

// S-05 : signaler. Le traitement par la moderation (B-02) reste a livrer.
router.post('/', validateRequest(createReportSchema), createReport);

export default router;
