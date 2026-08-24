import { Router } from 'express';
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  requestEmailVerification,
  verifyEmail,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../utils/validationSchemas';

const router = Router();

// Public routes
router.post('/register', validateRequest(registerSchema), registerUser);
router.post('/login', validateRequest(loginSchema), loginUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);

// C-05 : la validation du lien est publique (le token authentifie), la
// demande exige d'etre connecte.
router.post('/verify-email/:token', verifyEmail);
router.post('/verify-email', authenticateToken, requestEmailVerification);

export default router;