import { Request, Response, NextFunction } from 'express';
import { GroupModel as Group, UserModel as User, GroupMemberModel as GroupMember } from '../models';
import { validateRequest } from '../utils/validationSchemas';
import { createGroupSchema } from '../utils/validationSchemas';

// Create a new group
export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { error } = createGroupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => detail.message)
      });
    }

    const { name, description, city, accessType } = req.body;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create group
    const group = await Group.create({
      name,
      description,
      city,
      accessType,
      ownerId: userId,
    });

    // Owner is automatically added as a member through the association

    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
};

// Get all groups (with pagination and filters - simplified for V0)
export const getGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await Group.findAll({
      include: [
        { model: User, as: 'owner', attributes: { exclude: ['passwordHash'] } },
        { model: User, as: 'members', attributes: { exclude: ['passwordHash'] } }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(groups);
  } catch (error) {
    next(error);
  }
};

// Get a specific group by ID
export const getGroupById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findByPk(groupId, {
      include: [
        { model: User, as: 'owner', attributes: { exclude: ['passwordHash'] } },
        { model: User, as: 'members', attributes: { exclude: ['passwordHash'] } }
      ]
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    next(error);
  }
};

// Update a group
export const updateGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;

    // Find group and check ownership
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.ownerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this group' });
    }

    const { name, description, city, accessType } = req.body;

    await group.update({
      name,
      description,
      city,
      accessType,
    });

    const updatedGroup = await Group.findByPk(groupId, {
      include: [
        { model: User, as: 'owner', attributes: { exclude: ['passwordHash'] } },
        { model: User, as: 'members', attributes: { exclude: ['passwordHash'] } }
      ]
    });

    res.json(updatedGroup);
  } catch (error) {
    next(error);
  }
};

// Delete a group
export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;

    // Find group and check ownership
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.ownerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this group' });
    }

    await group.destroy();
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Add a member to a group (invite)
export const addMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;
    const { memberId } = req.body; // ID of the user to invite

    // Find group and check ownership or admin rights
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the current user is owner or admin
    const userMembership = await GroupMember.findOne({
      where: { groupId: group.id, userId: userId }
    });
    if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
      return res.status(403).json({ message: 'Not authorized to add members to this group' });
    }

    // Check if the member to add exists
    const memberToAdd = await User.findByPk(memberId);
    if (!memberToAdd) {
      return res.status(404).json({ message: 'User to add not found' });
    }

    // Check if the user is already a member
    const existingMember = await GroupMember.findOne({
      where: { groupId: group.id, userId: memberId }
    });
    if (existingMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    // Add member
    await (group as any).addMember(memberId, { through: { role: 'member' } });

    res.status(201).json({ message: 'Member added successfully' });
  } catch (error) {
    next(error);
  }
};

// Remove a member from a group
export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;
    const { memberId } = req.body; // ID of the user to remove

    // Find group and check ownership or admin rights
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the current user is owner or admin
    const userMembership = await GroupMember.findOne({
      where: { groupId: group.id, userId: userId }
    });
    if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
      return res.status(403).json({ message: 'Not authorized to remove members from this group' });
    }

    // Check if the member to remove exists
    const memberToRemove = await User.findByPk(memberId);
    if (!memberToRemove) {
      return res.status(404).json({ message: 'User to remove not found' });
    }

    // Prevent removing the owner
    if (group.ownerId === memberId) {
      return res.status(400).json({ message: 'Cannot remove the group owner' });
    }

    // Remove member
    await GroupMember.destroy({
      where: { groupId: group.id, userId: memberId }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

// Get members of a group
export const getGroupMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;

    // Find group
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const members = await GroupMember.findAll({
      where: { groupId: group.id },
      include: [{ model: User, attributes: { exclude: ['passwordHash'] } }]
    });

    res.json(members);
  } catch (error) {
    next(error);
  }
};