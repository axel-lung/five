import { Router } from 'express';
import {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupMembers
} from '../controllers/groupController';
import {
  createInvitation,
  getInvitationPreview,
  acceptInvitation,
  listInvitations,
  revokeInvitation,
  leaveGroup,
  updateMemberRole,
  transferOwnership
} from '../controllers/invitationController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import {
  createGroupSchema,
  createInvitationSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} from '../utils/validationSchemas';
import { createLimiter } from '../middleware/rateLimit';
import { uploadGroupAvatar } from '../controllers/mediaController';
import { uploadImage } from '../middleware/upload';

const router = Router();

// G-02 : apercu public d'une invitation, consultable sans compte.
// Doit rester AVANT router.use(authenticateToken) et avant les routes /:id,
// sinon '/invitations/xxx' serait capture par 'GET /:id'.
router.get('/invitations/:token', getInvitationPreview);

// All routes below require authentication
router.use(authenticateToken);

// Invitations (avant /:id pour la meme raison d'ordre de matching)
router.post('/invitations/:token/accept', acceptInvitation);
router.delete('/invitations/:invitationId', revokeInvitation);

// Group management routes
router.post('/', validateRequest(createGroupSchema), createGroup);
router.get('/', getGroups);
router.get('/:id', getGroupById);
router.put('/:id', validateRequest(createGroupSchema), updateGroup);
router.delete('/:id', deleteGroup);

// Member management
router.post('/:id/members', addMember);
router.delete('/:id/members', removeMember);
router.get('/:id/members', getGroupMembers);
router.post('/:id/leave', leaveGroup);

// G-01 : avatar du groupe.
router.post('/:id/avatar', uploadImage('avatar'), uploadGroupAvatar);

// G-03 : roles et transmission du groupe. Sans transfer-ownership, leaveGroup
// est un cul-de-sac pour le proprietaire.
router.patch('/:id/members/:userId/role', validateRequest(updateMemberRoleSchema), updateMemberRole);
router.post('/:id/transfer-ownership', validateRequest(transferOwnershipSchema), transferOwnership);

// Invitations rattachees a un groupe
router.post('/:id/invitations', createLimiter, validateRequest(createInvitationSchema), createInvitation);
router.get('/:id/invitations', listInvitations);

export default router;
