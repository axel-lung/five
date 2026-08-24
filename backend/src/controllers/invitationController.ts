import { Request, Response, NextFunction } from 'express';
import {
  GroupModel as Group,
  GroupMemberModel as GroupMember,
  GroupInvitationModel as GroupInvitation,
  UserModel as User,
  sequelize,
} from '../models';
import { isBlockedBetween } from './moderationController';

const DEFAULT_TTL_DAYS = 7;

/** Owner et admin peuvent inviter ; un simple membre non (G-03). */
const requireGroupAdmin = async (groupId: string, userId: string, t?: any) => {
  const membership = await GroupMember.findOne({
    where: { groupId, userId },
    transaction: t,
  });

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return null;
  }
  return membership;
};

/** G-02 : creer un lien d'invitation. */
export const createInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;
    const { role, expiresInDays, maxUses } = req.body;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!(await requireGroupAdmin(groupId, userId))) {
      return res.status(403).json({ message: 'Not authorized to invite to this group' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays ?? DEFAULT_TTL_DAYS));

    const invitation = await GroupInvitation.create({
      groupId,
      createdBy: userId,
      role: role ?? 'member',
      expiresAt,
      maxUses: maxUses ?? null,
    });

    res.status(201).json({
      id: invitation.id,
      token: invitation.token,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      maxUses: invitation.maxUses,
      uses: invitation.uses,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * G-02 : apercu public d'une invitation, consultable sans compte.
 *
 * Route non authentifiee : on expose de quoi decider de rejoindre, et rien
 * d'autre. Ni la liste des membres, ni l'identite de l'invitant.
 */
export const getInvitationPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invitation = await GroupInvitation.findOne({
      where: { token: req.params.token },
      include: [{ model: Group, as: 'group', attributes: ['id', 'name', 'description', 'city', 'avatarUrl'] }],
    });

    // Meme reponse pour un token inconnu et un token inutilisable : ne rien
    // laisser deviner de l'existence d'une invitation.
    if (!invitation || !invitation.isUsable()) {
      return res.status(404).json({ message: 'Invitation not found or no longer valid' });
    }

    const memberCount = await GroupMember.count({ where: { groupId: invitation.groupId } });

    res.json({
      group: (invitation as any).group,
      memberCount,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * G-02 / G-04 : accepter une invitation et rejoindre le groupe.
 *
 * Verrou exclusif sur la ligne invitation : sans lui, deux acceptations
 * simultanees liraient le meme compteur `uses` et depasseraient `maxUses`.
 */
export const acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const result = await sequelize.transaction(async (t) => {
      const invitation = await GroupInvitation.findOne({
        where: { token: req.params.token },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invitation) {
        return { error: { code: 404, message: 'Invitation not found or no longer valid' } };
      }

      const existing = await GroupMember.findOne({
        where: { groupId: invitation.groupId, userId },
        transaction: t,
      });

      // Idempotence testee AVANT l'utilisabilite : sur une invitation a usage
      // unique, la premiere acceptation epuise le lien, et re-cliquer dessus
      // renverrait sinon 404 a quelqu'un qui est deja membre.
      if (existing) {
        return { groupId: invitation.groupId, alreadyMember: true };
      }

      // D-06 : un lien d'invitation circule librement ; le blocage doit
      // s'appliquer a l'acceptation, seul moment ou l'on connait l'arrivant.
      // Meme reponse qu'un lien invalide, pour ne rien reveler du blocage.
      if (await isBlockedBetween(userId, invitation.createdBy, t)) {
        return { error: { code: 404, message: 'Invitation not found or no longer valid' } };
      }

      if (!invitation.isUsable()) {
        return { error: { code: 404, message: 'Invitation not found or no longer valid' } };
      }

      await GroupMember.create(
        { groupId: invitation.groupId, userId, role: invitation.role },
        { transaction: t }
      );

      await invitation.update({ uses: invitation.uses + 1 }, { transaction: t });

      return { groupId: invitation.groupId, alreadyMember: false };
    });

    if (result.error) {
      return res.status(result.error.code).json({ message: result.error.message });
    }

    res.status(result.alreadyMember ? 200 : 201).json({
      message: result.alreadyMember ? 'Already a member of this group' : 'Joined the group',
      groupId: result.groupId,
    });
  } catch (error) {
    next(error);
  }
};

/** Lister les invitations actives d'un groupe (owner/admin). */
export const listInvitations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;

    if (!(await requireGroupAdmin(groupId, userId))) {
      return res.status(403).json({ message: 'Not authorized to view invitations for this group' });
    }

    const invitations = await GroupInvitation.findAll({
      where: { groupId },
      include: [{ model: User, as: 'inviter', attributes: ['id', 'firstName'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json(
      invitations.map((invitation: any) => ({
        id: invitation.id,
        token: invitation.token,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses,
        uses: invitation.uses,
        revokedAt: invitation.revokedAt,
        usable: invitation.isUsable(),
        inviter: invitation.inviter,
      }))
    );
  } catch (error) {
    next(error);
  }
};

/** Revoquer une invitation : horodatage, pas suppression (trace G-03). */
export const revokeInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const invitation = await GroupInvitation.findByPk(req.params.invitationId);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (!(await requireGroupAdmin(invitation.groupId, userId))) {
      return res.status(403).json({ message: 'Not authorized to revoke this invitation' });
    }

    if (!invitation.revokedAt) {
      await invitation.update({ revokedAt: new Date() });
    }

    res.json({ message: 'Invitation revoked' });
  } catch (error) {
    next(error);
  }
};

/**
 * G-04 : quitter un groupe de sa propre initiative.
 *
 * Le proprietaire ne peut pas partir sans transmettre le groupe : sinon il
 * resterait un groupe sans owner, que plus personne ne pourrait administrer.
 */
export const leaveGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.ownerId === userId) {
      return res.status(400).json({
        message: 'The group owner must transfer ownership before leaving',
      });
    }

    const deleted = await GroupMember.destroy({ where: { groupId, userId } });
    if (deleted === 0) {
      return res.status(404).json({ message: 'You are not a member of this group' });
    }

    res.json({ message: 'You have left the group' });
  } catch (error) {
    next(error);
  }
};

/**
 * G-03 : changer le role d'un membre.
 *
 * Reserve au proprietaire : un admin qui pourrait promouvoir d'autres admins
 * rendrait le role de proprietaire purement decoratif. Le role 'owner' n'est
 * pas attribuable ici — il passe par transferOwnership, qui deplace aussi
 * groups.owner_id.
 */
export const updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const targetUserId = req.params.userId;
    const userId = (req as any).user.id;
    const { role } = req.body;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.ownerId !== userId) {
      return res.status(403).json({ message: 'Only the group owner can change roles' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({
        message: 'The owner cannot change their own role; transfer ownership instead',
      });
    }

    const membership = await GroupMember.findOne({
      where: { groupId, userId: targetUserId },
    });

    if (!membership) {
      return res.status(404).json({ message: 'This user is not a member of this group' });
    }

    await membership.update({ role });

    res.json({ userId: targetUserId, role: membership.role });
  } catch (error) {
    next(error);
  }
};

/**
 * G-03 / G-04 : transmettre la propriete du groupe.
 *
 * Sans cette route, leaveGroup etait un cul-de-sac : il exige du
 * proprietaire qu'il transmette le groupe avant de partir, et rien ne
 * permettait de le faire. Un proprietaire ne pouvait donc jamais quitter son
 * propre groupe.
 *
 * Verrou sur la ligne groupe : deux transferts simultanes laisseraient
 * groups.owner_id et group_members en desaccord.
 */
export const transferOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.id;
    const { newOwnerId } = req.body;

    const result = await sequelize.transaction(async (t) => {
      const group = await Group.findByPk(groupId, { transaction: t, lock: t.LOCK.UPDATE });

      if (!group) {
        return { error: { code: 404, message: 'Group not found' } };
      }

      if (group.ownerId !== userId) {
        return { error: { code: 403, message: 'Only the group owner can transfer ownership' } };
      }

      if (newOwnerId === userId) {
        return { error: { code: 400, message: 'You already own this group' } };
      }

      const successor = await GroupMember.findOne({
        where: { groupId, userId: newOwnerId },
        transaction: t,
      });

      if (!successor) {
        return { error: { code: 404, message: 'This user is not a member of this group' } };
      }

      const previous = await GroupMember.findOne({
        where: { groupId, userId },
        transaction: t,
      });

      await group.update({ ownerId: newOwnerId }, { transaction: t });
      await successor.update({ role: 'owner' }, { transaction: t });

      // L'ancien proprietaire reste admin : il garde de quoi administrer le
      // groupe, et peut ensuite le quitter s'il le souhaite.
      if (previous) {
        await previous.update({ role: 'admin' }, { transaction: t });
      }

      return {};
    });

    if (result.error) {
      return res.status(result.error.code).json({ message: result.error.message });
    }

    res.json({ message: 'Ownership transferred', ownerId: newOwnerId });
  } catch (error) {
    next(error);
  }
};
