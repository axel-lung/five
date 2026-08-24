import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import {
  UserModel as User,
  GroupModel as Group,
  GroupMemberModel as GroupMember,
  EventModel as Event,
  EventInscriptionModel as EventInscription,
  sequelize,
} from '../models';
import { cancelInscription } from '../services/inscriptions';

/**
 * C-06 : effacement du compte.
 *
 * Anonymisation et non DELETE : toutes les cles etrangeres vers `users` sont
 * en ON DELETE CASCADE, donc un effacement reel emporterait les groupes du
 * compte, ses evenements, et par ricochet les inscriptions des AUTRES joueurs.
 * Le droit a l'effacement d'un joueur ne peut pas detruire l'historique du
 * groupe.
 *
 * Le RGPD interdisant de conditionner l'effacement, l'operation n'echoue
 * jamais pour cause de groupe possede : la propriete est transmise.
 */
export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const result = await sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

      if (!user || user.deletedAt) {
        return { error: { code: 404, message: 'User not found' } };
      }

      // 1. Groupes possedes : transmettre plutot que detruire.
      const ownedGroups = await Group.findAll({
        where: { ownerId: userId },
        transaction: t,
      });

      for (const group of ownedGroups) {
        // Le plus ancien admin d'abord, a defaut le plus ancien membre : un
        // admin connait deja l'administration du groupe.
        const successor = await GroupMember.findOne({
          where: { groupId: group.id, userId: { [Op.ne]: userId } },
          order: [
            [sequelize.literal("CASE role WHEN 'admin' THEN 0 ELSE 1 END"), 'ASC'],
            ['joinedAt', 'ASC'],
          ],
          transaction: t,
        });

        if (successor) {
          await group.update({ ownerId: successor.userId }, { transaction: t });
          await successor.update({ role: 'owner' }, { transaction: t });
        } else {
          // Personne d'autre dans le groupe : rien a preserver.
          await group.destroy({ transaction: t });
        }
      }

      // 2. Evenements organises : annuler ceux a venir, garder les passes.
      // Un evenement passe fait partie de l'historique des autres joueurs ;
      // un evenement futur n'aurait plus personne pour l'administrer.
      await Event.update(
        { status: 'cancelled' },
        {
          where: {
            organizerId: userId,
            dateTime: { [Op.gt]: new Date() },
            status: { [Op.in]: ['draft', 'open', 'full'] },
          },
          transaction: t,
        }
      );

      // 3. Inscriptions a venir : liberer la place et promouvoir la liste
      // d'attente, exactement comme un desistement volontaire.
      const inscriptions = await EventInscription.findAll({
        where: { userId, status: { [Op.in]: ['pending', 'confirmed', 'waitlist'] } },
        transaction: t,
      });

      for (const inscription of inscriptions) {
        const event = await Event.findByPk(inscription.eventId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!event || event.dateTime <= new Date()) continue;

        await cancelInscription(event, inscription, t);
      }

      // 4. Sortie de tous les groupes.
      await GroupMember.destroy({ where: { userId }, transaction: t });

      // 5. Anonymisation. L'email garde une forme unique pour ne pas violer la
      // contrainte, et le domaine .invalid est reserve (RFC 2606) : il ne peut
      // etre livre nulle part.
      await user.update(
        {
          deletedAt: new Date(),
          email: `deleted-${user.id}@deleted.invalid`,
          passwordHash: 'account-deleted',
          firstName: null,
          lastName: null,
          phone: null,
          avatarUrl: null,
          bio: null,
          city: null,
          preferredPosition: null,
          selfDeclaredLevel: null,
          emailVerified: false,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
        } as any,
        { transaction: t }
      );

      return {};
    });

    if (result.error) {
      return res.status(result.error.code).json({ message: result.error.message });
    }

    res.json({ message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * C-06 : export des donnees personnelles.
 *
 * Tout ce que le compte a produit, dans un JSON directement lisible. Les
 * autres joueurs n'y figurent que par ce qui est deja public (C-04) : un
 * export ne doit pas devenir un contournement de la confidentialite.
 */
export const exportAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['passwordHash', 'emailVerificationToken'] },
    });

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [memberships, organizedEvents, inscriptions] = await Promise.all([
      GroupMember.findAll({
        where: { userId },
        include: [{ model: Group, as: 'group', attributes: ['id', 'name', 'city'] }],
      }),
      Event.findAll({ where: { organizerId: userId }, order: [['dateTime', 'ASC']] }),
      EventInscription.findAll({
        where: { userId },
        include: [{ model: Event, as: 'event', attributes: ['id', 'title', 'dateTime'] }],
        order: [['registeredAt', 'ASC']],
      }),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      profile: user,
      groups: memberships.map((m: any) => ({
        role: m.role,
        joinedAt: m.joinedAt,
        group: m.group,
      })),
      organizedEvents,
      inscriptions: inscriptions.map((i: any) => ({
        status: i.status,
        registeredAt: i.registeredAt,
        event: i.event,
      })),
    });
  } catch (error) {
    next(error);
  }
};
