import { Router } from 'express';
import { createBugReport, listMyBugReports } from '../controllers/bugReportController';
import { authenticateToken } from '../middleware/auth';
import { createLimiter } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validateRequest';
import { createBugReportSchema } from '../utils/validationSchemas';

const router = Router();

router.use(authenticateToken);

// Beta : declarer. Le bouton est present sur tous les ecrans, donc a portee
// de clic repete — la limite de creation partagee suffit a borner les envois
// en rafale sans gener un testeur de bonne foi.
router.post('/', createLimiter, validateRequest(createBugReportSchema), createBugReport);
router.get('/mine', listMyBugReports);

export default router;
