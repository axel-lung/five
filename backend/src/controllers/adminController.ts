import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import {
  UserModel as User,
  GroupModel as Group,
  EventModel as Event,
  EventInscriptionModel as EventInscription,
  GroupMemberModel as GroupMember,
  ReportModel as Report,
  AuditLogModel as AuditLog,
} from '../models';
import { audit } from '../services/audit';

/** Colonnes qu'un administrateur peut voir sur un compte, hors secrets. */
const ADMIN_USER_ATTRIBUTES = [
  'id',
  'email',
  'firstName',
  'lastName',
  'city',
  'role',
  'emailVerified',
  'suspendedAt',
  'suspensionReason',
  'deletedAt',
  'createdAt',
];

/** B-01 : tableau de bord. Volumes et etats, pas de donnees nominatives. */
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [users, activeUsers, groups, events, upcomingEvents, inscriptions, openReports] =
      await Promise.all([
        User.count(),
        User.count({ where: { deletedAt: null, suspendedAt: null } }),
        Group.count(),
        Event.count(),
        Event.count({
          where: { dateTime: { [Op.gt]: new Date() }, status: { [Op.in]: ['open', 'full'] } },
        }),
        EventInscription.count({ where: { status: 'confirmed' } }),
        Report.count({ where: { status: 'open' } }),
      ]);

    res.json({
      users: { total: users, active: activeUsers, deleted: users - activeUsers },
      groups,
      events: { total: events, upcoming: upcomingEvents },
      confirmedInscriptions: inscriptions,
      openReports,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * B-03 : recherche d'un compte pour le support.
 *
 * Chaque consultation est journalisee (B-06) : acceder au dossier d'un
 * joueur est en soi une action sensible, meme en lecture.
 */
export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) ?? '';

    if (q.trim().length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    const term = `%${q.trim()}%`;
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: term } },
          { firstName: { [Op.iLike]: term } },
          { lastName: { [Op.iLike]: term } },
        ],
      },
      attributes: ADMIN_USER_ATTRIBUTES,
      limit: 50,
      order: [['createdAt', 'DESC']],
    });

    await audit((req as any).user.id, 'admin.user.search', 'user', null, {
      query: q,
      resultCount: users.length,
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
};

/** B-03 : dossier complet d'un compte. */
export const getUserDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ADMIN_USER_ATTRIBUTES });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [groupCount, organizedCount, inscriptionCount] = await Promise.all([
      GroupMember.count({ where: { userId: user.id } }),
      Event.count({ where: { organizerId: user.id } }),
      EventInscription.count({ where: { userId: user.id } }),
    ]);

    await audit((req as any).user.id, 'admin.user.view', 'user', user.id);

    res.json({ user, stats: { groupCount, organizedCount, inscriptionCount } });
  } catch (error) {
    next(error);
  }
};

/**
 * B-02 : suspendre un compte.
 *
 * Distinct de l'effacement RGPD : la suspension est une mesure de moderation,
 * reversible, et n'anonymise rien — les faits reproches doivent rester
 * consultables.
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = (req as any).user.id;
    const { reason } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.id === adminId) {
      return res.status(400).json({ message: 'You cannot suspend yourself' });
    }

    await user.update({ suspendedAt: new Date(), suspensionReason: reason } as any);
    await audit(adminId, 'admin.user.suspend', 'user', user.id, { reason });

    res.json({ message: 'User suspended' });
  } catch (error) {
    next(error);
  }
};

/** B-02 : lever une suspension. */
export const unsuspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = (req as any).user.id;

    const user = await User.findByPk(req.params.id);
    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.suspendedAt) {
      return res.status(400).json({ message: 'This user is not suspended' });
    }

    await user.update({ suspendedAt: null, suspensionReason: null } as any);
    await audit(adminId, 'admin.user.unsuspend', 'user', user.id);

    res.json({ message: 'Suspension lifted' });
  } catch (error) {
    next(error);
  }
};

/** B-02 : file de moderation. */
export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    const reports = await Report.findAll({
      where,
      include: [{ model: User, as: 'reporter', attributes: ['id', 'email'] }],
      order: [['createdAt', 'ASC']],
      limit: 100,
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
};

/** B-02 / B-06 : traiter un signalement, avec trace de qui et pourquoi. */
export const updateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = (req as any).user.id;
    const { status, resolutionNote } = req.body;

    const report = await Report.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    await report.update({
      status,
      resolutionNote: resolutionNote ?? report.resolutionNote,
      // On garde le premier traitant tant que le signalement n'est pas rouvert.
      resolvedBy: status === 'resolved' || status === 'dismissed' ? adminId : null,
    } as any);

    await audit(adminId, 'admin.report.update', 'report', report.id, {
      status,
      resolutionNote,
    });

    res.json({ id: report.id, status: report.status });
  } catch (error) {
    next(error);
  }
};

/**
 * B-06 : consultation du journal d'audit.
 *
 * Volontairement en lecture seule : aucune route ne cree, ne modifie ni ne
 * supprime une ligne d'audit depuis l'exterieur.
 */
export const listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.query.targetId) {
      where.targetId = req.query.targetId;
    }
    if (req.query.action) {
      where.action = req.query.action;
    }

    const logs = await AuditLog.findAll({
      where,
      include: [{ model: User, as: 'actor', attributes: ['id', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
};
