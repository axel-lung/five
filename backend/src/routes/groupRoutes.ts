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
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../utils/validationSchemas';
import { createGroupSchema } from '../utils/validationSchemas';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

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

export default router;