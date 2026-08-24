import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { UserModel as User, UserBlockModel as UserBlock, ReportModel as Report } from '../models';
import { PUBLIC_USER_ATTRIBUTES } from '../utils/publicAttributes';

/**
 * D-06 : deux comptes sont en conflit si l'un a bloque l'autre, dans un sens
 * ou dans l'autre.
 *
 * Le blocage est stocke oriente (seul le bloqueur peut le lever) mais produit
 * un effet reciproque : bloquer quelqu'un ne doit pas laisser cette personne
 * continuer a vous inviter ou a s'inscrire a vos evenements.
 *
 * `transaction` est optionnel mais doit etre transmis quand l'appelant en
 * detient une : la verification doit voir le meme etat que l'ecriture.
 */
export const isBlockedBetween = async (
  a: string,
  b: string,
  transaction?: any
): Promise<boolean> => {
  const block = await UserBlock.findOne({
    where: {
      [Op.or]: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    transaction,
  });

  return block !== null;
};

/** D-06 : bloquer un joueur. */
export const blockUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockerId = (req as any).user.id;
    const blockedId = req.params.id;

    if (blockerId === blockedId) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const target = await User.findByPk(blockedId);
    if (!target || target.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Idempotent : re-bloquer quelqu'un n'est pas une erreur cote client.
    const [, created] = await UserBlock.findOrCreate({
      where: { blockerId, blockedId },
      defaults: { blockerId, blockedId },
    });

    res.status(created ? 201 : 200).json({ message: 'User blocked' });
  } catch (error) {
    next(error);
  }
};

/** D-06 : lever un blocage. Seul le bloqueur le peut. */
export const unblockUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockerId = (req as any).user.id;

    const deleted = await UserBlock.destroy({
      where: { blockerId, blockedId: req.params.id },
    });

    if (deleted === 0) {
      return res.status(404).json({ message: 'This user is not blocked' });
    }

    res.json({ message: 'User unblocked' });
  } catch (error) {
    next(error);
  }
};

/** D-06 : la liste que j'ai bloquee. Jamais celle qui m'a bloque. */
export const listBlocks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blocks = await UserBlock.findAll({
      where: { blockerId: (req as any).user.id },
      include: [{ model: User, as: 'blocked', attributes: PUBLIC_USER_ATTRIBUTES }],
      order: [['createdAt', 'DESC']],
    });

    res.json(
      blocks.map((block: any) => ({
        blockedAt: block.createdAt,
        user: block.blocked,
      }))
    );
  } catch (error) {
    next(error);
  }
};

/**
 * S-05 : signaler un compte, un groupe ou un evenement.
 *
 * Le signalement est enregistre mais pas encore traite : la file de
 * moderation (B-02) fait partie du back-office, hors V1 a ce stade. La table
 * existe des maintenant pour ne pas perdre les signalements d'ici la.
 */
export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reporterId = (req as any).user.id;
    const { targetType, targetId, reason, details } = req.body;

    if (targetType === 'user' && targetId === reporterId) {
      return res.status(400).json({ message: 'You cannot report yourself' });
    }

    const report = await Report.create({ reporterId, targetType, targetId, reason, details });

    res.status(201).json({ id: report.id, status: report.status });
  } catch (error) {
    next(error);
  }
};
