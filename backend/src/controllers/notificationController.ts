import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import {
  NotificationModel as Notification,
  NotificationPreferenceModel as NotificationPreference,
} from '../models';

/** N-05 : centre de notifications, historique lu / non lu. */
export const listNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const where: any = { userId };

    if (req.query.unread === 'true') {
      where.readAt = null;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: 100,
      }),
      Notification.count({ where: { userId, readAt: null } }),
    ]);

    res.json({ unreadCount, notifications });
  } catch (error) {
    next(error);
  }
};

/** N-05 : marquer une notification comme lue. Idempotent. */
export const markRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    // Le filtre sur userId fait aussi office de controle d'acces : on ne peut
    // pas marquer la notification d'un autre.
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (!notification.readAt) {
      await notification.update({ readAt: new Date() });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

/** N-05 : tout marquer comme lu. */
export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [updated] = await Notification.update(
      { readAt: new Date() },
      { where: { userId: (req as any).user.id, readAt: null } }
    );

    res.json({ message: 'Notifications marked as read', updated });
  } catch (error) {
    next(error);
  }
};

/**
 * N-04 : preferences de notification.
 *
 * La ligne est creee a la volee avec les valeurs par defaut : ne pas avoir
 * touche a ses preferences ne doit pas produire un 404.
 */
export const getPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const [preferences] = await NotificationPreference.findOrCreate({
      where: { userId },
      defaults: { userId },
    });

    res.json(preferences);
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { pushEnabled, emailEnabled, quietHoursStart, quietHoursEnd } = req.body;

    const [preferences] = await NotificationPreference.findOrCreate({
      where: { userId },
      defaults: { userId },
    });

    await preferences.update({
      pushEnabled: pushEnabled ?? preferences.pushEnabled,
      emailEnabled: emailEnabled ?? preferences.emailEnabled,
      // `?? undefined` et non `?? preferences.x` : ces deux champs sont
      // nullables, et null est une valeur voulue (« pas d'heures de silence »)
      // qu'il ne faut pas confondre avec « champ absent ».
      quietHoursStart: quietHoursStart === undefined ? preferences.quietHoursStart : quietHoursStart,
      quietHoursEnd: quietHoursEnd === undefined ? preferences.quietHoursEnd : quietHoursEnd,
    });

    res.json(preferences);
  } catch (error) {
    next(error);
  }
};
