import { Request, Response, NextFunction } from 'express';
import { UserModel as User, BugReportModel as BugReport } from '../models';
import { audit } from '../services/audit';

/**
 * Beta : declaration d'anomalie par un testeur.
 *
 * L'anomalie est enregistree telle quelle, sans deduplication ni
 * regroupement : pendant une beta, deux testeurs qui remontent le meme
 * ecran cassé est une information, pas un doublon a ecraser.
 */
export const createBugReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reporterId = (req as any).user.id;
    const { kind, severity, description, context } = req.body;

    const report = await BugReport.create({
      reporterId,
      kind,
      severity,
      description,
      context: context ?? {},
    });

    res.status(201).json({ id: report.id, status: report.status });
  } catch (error) {
    next(error);
  }
};

/**
 * Beta : les anomalies que j'ai declarees.
 *
 * Un testeur qui ne voit jamais ce que devient son retour cesse d'en
 * envoyer. Il ne voit que les siennes : la file complete est un ecran de
 * back-office.
 */
export const listMyBugReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await BugReport.findAll({
      where: { reporterId: (req as any).user.id },
      // Le contexte technique et la note de traitement interne ne servent
      // qu'a l'equipe.
      attributes: ['id', 'kind', 'severity', 'description', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
};

/** Beta : file de suivi des anomalies, cote back-office. */
export const listBugReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    const reports = await BugReport.findAll({
      where,
      include: [{ model: User, as: 'reporter', attributes: ['id', 'email'] }],
      // Les bloquantes d'abord, puis les plus anciennes : l'ordre dans lequel
      // on veut les traiter. L'ENUM Postgres est ordonne par sa declaration,
      // qui va justement de 'blocking' a 'minor'.
      order: [
        ['severity', 'ASC'],
        ['createdAt', 'ASC'],
      ],
      limit: 200,
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
};

/** Beta : faire avancer une anomalie, avec trace de qui et pourquoi (B-06). */
export const updateBugReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = (req as any).user.id;
    const { status, resolutionNote } = req.body;

    const report = await BugReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Bug report not found' });
    }

    await report.update({
      status,
      resolutionNote: resolutionNote ?? report.resolutionNote,
      // On garde le traitant tant que l'anomalie n'est pas rouverte.
      handledBy: status === 'open' ? null : adminId,
    } as any);

    await audit(adminId, 'admin.bugReport.update', 'bugReport', report.id, {
      status,
      resolutionNote,
    });

    res.json({ id: report.id, status: report.status });
  } catch (error) {
    next(error);
  }
};
