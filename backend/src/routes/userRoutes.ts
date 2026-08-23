import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/userController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateToken } from '../middleware/auth';
import { updateProfileSchema } from '../utils/validationSchemas';

const router = Router();

// Toutes les routes profil exigent une authentification : les controleurs
// lisent req.user.id, qui n'existe pas sans ce middleware.
router.use(authenticateToken);

router.get('/profile', getUserProfile);
router.put('/profile', validateRequest(updateProfileSchema), updateUserProfile);

export default router;