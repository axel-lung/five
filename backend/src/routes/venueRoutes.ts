import { Router } from 'express';
import { listVenues } from '../controllers/venueController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// PA-03 : lecture seule ici. La creation passe par /api/admin/venues.
router.get('/', listVenues);

export default router;
