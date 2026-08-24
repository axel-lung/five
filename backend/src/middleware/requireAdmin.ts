import { Request, Response, NextFunction } from 'express';
import { UserModel as User } from '../models';

/**
 * B-01 : reserve une route aux administrateurs.
 *
 * Le role est relu en base a chaque appel plutot que porte par le JWT :
 * retirer les droits d'un administrateur doit prendre effet immediatement,
 * pas a l'expiration de son token. Le cout d'une requete est acceptable sur
 * des routes de back-office.
 *
 * A placer APRES authenticateToken, dont il consomme req.user.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk((req as any).user.id);

    // 404 plutot que 403 : l'existence d'un back-office ne regarde pas les
    // comptes ordinaires.
    if (!user || user.deletedAt || user.suspendedAt || user.role !== 'admin') {
      return res.status(404).json({ message: 'Route not found' });
    }

    next();
  } catch (error) {
    next(error);
  }
};
