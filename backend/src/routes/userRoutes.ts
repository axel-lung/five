import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/userController';
import { validateRequest } from '../middleware/validateRequest';
import { updateProfileSchema } from '../utils/validationSchemas';

const router = Router();

// Protected routes
router.get('/profile', getUserProfile);
router.put('/profile', validateRequest(updateProfileSchema), updateUserProfile);

export default router;