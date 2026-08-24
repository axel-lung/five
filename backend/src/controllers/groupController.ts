import { Request, Response, NextFunction } from 'express';
import { GroupModel as Group, UserModel as User, GroupMemberModel as GroupMember, sequelize } from '../models';
import { Op } from 'sequelize';
import { PUBLIC_USER_ATTRIBUTES } from '../utils/publicAttributes';
import { createGroupSchema } from '../utils/validationSchemas';

/** Un groupe prive n'est lisible que par ses membres (G-06). */
const canViewGroup = async (group: any, userId: string): Promise<boolean> => {
  if (group.accessType === 'public') return true;
  const membership = await GroupMember.findOne({ where: { groupId: group.id, userId } });
  return membership !== null;
};

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

    // Le proprietaire doit etre inscrit explicitement dans group_members :
    // Sequelize ne peuple pas une association belongsToMany a la creation.
    // Sans cette ligne, le createur n'est pas membre de son propre groupe et
    // toutes les actions d'administration lui renvoient 403.
    const group = await sequelize.transaction(async (t) => {
      const created = await Group.create(
        { name, description, city, accessType, ownerId: userId },
        { transaction: t }
      );

      await GroupMember.create(
        { groupId: created.id, userId, role: 'owner' },
        { transaction: t }
      );

      return created;
    });

    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
};

/**
 * G-06 / C-04 : liste des groupes de l'utilisateur, plus les groupes publics.
 *
 * L'implementation precedente renvoyait TOUS les groupes, prives compris, avec
 * la liste complete des membres et leurs adresses email. Ici on ne renvoie ni
 * membres ni emails : une liste n'a pas besoin de donnees personnelles, le
 * detail d'un groupe est accessible via GET /groups/:id une fois membre.
 */
export const getGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const memberships = await GroupMember.findAll({
      where: { userId },
      attributes: ['groupId'],
    });
    const memberGroupIds = memberships.map((m: any) => m.groupId);

    const groups = await Group.findAll({
      where: {
        [Op.or]: [{ id: { [Op.in]: memberGroupIds } }, { accessType: 'public' }],
      },
      attributes: ['id', 'name', 'description', 'city', 'avatarUrl', 'accessType', 'ownerId', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    const memberGroupIdSet = new Set(memberGroupIds);

    res.json(
      groups.map((group: any) => ({
        ...group.toJSON(),
        isMember: memberGroupIdSet.has(group.id),
      }))
    );
  } catch (error) {
    next(error);
  }
};

// Get a specific group by ID
export const getGroupById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;

    const group = await Group.findByPk(groupId, {
      include: [
        { model: User, as: 'owner', attributes: PUBLIC_USER_ATTRIBUTES },
        { model: User, as: 'members', attributes: PUBLIC_USER_ATTRIBUTES }
      ]
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // 404 plutot que 403 : l'existence meme d'un groupe prive ne regarde pas
    // les non-membres.
    if (!(await canViewGroup(group, userId))) {
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
        { model: User, as: 'owner', attributes: PUBLIC_USER_ATTRIBUTES },
        { model: User, as: 'members', attributes: PUBLIC_USER_ATTRIBUTES }
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

    // Insertion directe plutot que via l'association belongsToMany : celle-ci
    // est declaree avec `through: 'group_members'` (une chaine), ce qui cree un
    // modele intermediaire anonyme depourvu du defaut UUIDV4 sur `id`. L'INSERT
    // partait alors sans identifiant et violait la contrainte NOT NULL.
    await GroupMember.create({ groupId: group.id, userId: memberId, role: 'member' });

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
    const userId = (req as any).user.id;

    // Find group
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!(await canViewGroup(group, userId))) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const members = await GroupMember.findAll({
      where: { groupId: group.id },
      include: [{ model: User, as: 'user', attributes: PUBLIC_USER_ATTRIBUTES }]
    });

    res.json(members);
  } catch (error) {
    next(error);
  }
};