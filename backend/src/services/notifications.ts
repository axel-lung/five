import { Transaction } from 'sequelize';
import { NotificationModel as Notification } from '../models';

/**
 * N-01 : types de notification emis par la V1.
 *
 * Nommes plutot que libres : le client doit pouvoir traduire et router chaque
 * type sans interpreter du texte, et un type inconnu se voit immediatement.
 */
export type NotificationType =
  | 'event.opened'
  | 'event.updated'
  | 'event.cancelled'
  | 'event.spot_released'
  | 'event.reminder'
  | 'event.ownership_transferred';

/**
 * Ecrit une notification.
 *
 * `transaction` n'est pas optionnel par confort : les appelants emettent
 * depuis une transaction metier deja ouverte, et une notification « place
 * liberee » ne doit pas survivre au rollback de la promotion qui l'a causee.
 * Passer `null` est un choix explicite, hors transaction.
 */
export const notify = async (
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
  transaction: Transaction | null
): Promise<void> => {
  await Notification.create(
    { userId, type, payload },
    transaction ? { transaction } : {}
  );
};

/** Meme chose pour plusieurs destinataires, en une seule insertion. */
export const notifyMany = async (
  userIds: string[],
  type: NotificationType,
  payload: Record<string, unknown>,
  transaction: Transaction | null
): Promise<number> => {
  if (userIds.length === 0) return 0;

  const rows = userIds.map((userId) => ({ userId, type, payload }));
  await Notification.bulkCreate(rows, transaction ? { transaction } : {});

  return rows.length;
};
