import { GroupMemberModel as GroupMember } from '../models';

/**
 * Gardes d'acces a un groupe, partagees par les controleurs.
 *
 * Elles vivaient en copies privees dans groupController et
 * invitationController. Rassemblees ici parce que le chat en faisait une
 * troisieme copie, et qu'une regle d'autorisation dupliquee finit toujours
 * par diverger du cote ou on l'oublie.
 */

/** Un groupe prive n'est lisible que par ses membres (G-06). */
export const canViewGroup = async (group: any, userId: string): Promise<boolean> => {
  if (group.accessType === 'public') return true;
  const membership = await GroupMember.findOne({ where: { groupId: group.id, userId } });
  return membership !== null;
};

/** Owner et admin peuvent administrer ; un simple membre non (G-03). */
export const requireGroupAdmin = async (groupId: string, userId: string, t?: any) => {
  const membership = await GroupMember.findOne({
    where: { groupId, userId },
    transaction: t,
  });

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return null;
  }
  return membership;
};

/** Appartenance simple, quel que soit le role. */
export const requireGroupMember = async (groupId: string, userId: string, t?: any) =>
  GroupMember.findOne({ where: { groupId, userId }, transaction: t });
