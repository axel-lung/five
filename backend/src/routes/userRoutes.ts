import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/userController';
import { deleteAccount, exportAccount } from '../controllers/accountController';
import { blockUser, unblockUser, listBlocks } from '../controllers/moderationController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateToken } from '../middleware/auth';
import { updateProfileSchema } from '../utils/validationSchemas';

const router = Router();

// Toutes les routes profil exigent une authentification : les controleurs
// lisent req.user.id, qui n'existe pas sans ce middleware.
router.use(authenticateToken);

router.get('/profile', getUserProfile);
router.put('/profile', validateRequest(updateProfileSchema), updateUserProfile);

// C-06 : export et effacement RGPD. `me` plutot que `:id` : ces deux actions
// ne concernent jamais qu'un compte, celui de l'appelant.
router.get('/me/export', exportAccount);
router.delete('/me', deleteAccount);

// D-06 : blocage. `/me/blocks` avant `/:id/block` n'a pas d'ambiguite ici,
// les deux motifs ne se recouvrent pas.
router.get('/me/blocks', listBlocks);
router.post('/:id/block', blockUser);
router.delete('/:id/block', unblockUser);

export default router;