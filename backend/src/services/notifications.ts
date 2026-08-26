import { Op, Transaction } from 'sequelize';
import {
  NotificationModel as Notification,
  NotificationPreferenceModel as NotificationPreference,
  PushTokenModel as PushToken,
} from '../models';
import { push, PushMessage } from './push';

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
 * Texte porte par le push.
 *
 * Le contenu d'une notification poussee doit etre lisible tel quel : il
 * s'affiche sur un ecran verrouille, sans que l'application ait la main pour
 * traduire quoi que ce soit. Les clients gardent leur propre libelle pour le
 * centre de notifications, ou ils peuvent le faire.
 */
const pushText = (type: NotificationType, payload: Record<string, unknown>) => {
  const title = String(payload.title ?? 'Five');

  const bodies: Record<NotificationType, string> = {
    'event.opened': 'Les inscriptions sont ouvertes.',
    'event.updated': "L'horaire ou le lieu a changé.",
    'event.cancelled': 'La session a été annulée.',
    'event.spot_released': 'Une place s’est libérée : vous êtes confirmé.',
    'event.reminder': "L'organisateur attend votre réponse.",
    'event.ownership_transferred': 'Vous organisez désormais cette session.',
  };

  return { title, body: bodies[type] };
};

/**
 * Un instant tombe-t-il dans les heures de silence du joueur ?
 *
 * Les bornes sont des heures locales, dans le fuseau declare par l'appareil.
 * La plage peut enjamber minuit (22 h → 8 h), auquel cas elle est vraie de
 * part et d'autre plutot qu'entre les deux.
 */
const inQuietHours = (start: number | null, end: number | null, timezone?: string | null) => {
  if (start === null || end === null || start === end) return false;

  const hour = Number(
    new Intl.DateTimeFormat('fr-FR', {
      hour: 'numeric',
      hour12: false,
      // Un fuseau inconnu ferait lever Intl : on retombe sur celui du serveur.
      timeZone: timezone || undefined,
    }).format(new Date())
  );

  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
};

/**
 * Pousse une notification vers les appareils des destinataires.
 *
 * Appelee APRES le commit, jamais dedans : un appel reseau dans une
 * transaction la tiendrait ouverte le temps d'un aller-retour vers Expo, et
 * un push parti pour une transaction annulee ne se rattrape pas.
 *
 * Les heures de silence suppriment le push, pas la notification : celle-ci
 * reste en base et visible dans le centre de notifications. Le joueur ne rate
 * rien, il n'est simplement pas reveille.
 */
const pushTo = async (
  userIds: string[],
  type: NotificationType,
  payload: Record<string, unknown>
): Promise<void> => {
  if (userIds.length === 0) return;

  const [tokens, preferences] = await Promise.all([
    PushToken.findAll({ where: { userId: { [Op.in]: userIds } } }),
    NotificationPreference.findAll({ where: { userId: { [Op.in]: userIds } } }),
  ]);

  const byUser = new Map(preferences.map((p: any) => [p.userId, p]));
  const { title, body } = pushText(type, payload);

  const messages: PushMessage[] = [];

  for (const device of tokens) {
    // Aucune ligne de preferences signifie « valeurs par defaut », donc push
    // actif : ne pas avoir touche a ses reglages ne doit pas rendre muet.
    const preference: any = byUser.get(device.userId);

    if (preference && preference.pushEnabled === false) continue;
    if (
      preference &&
      inQuietHours(preference.quietHoursStart ?? null, preference.quietHoursEnd ?? null, device.timezone)
    ) {
      continue;
    }

    messages.push({ to: device.token, title, body, data: { type, ...payload } });
  }

  await push.send(messages);
};

/**
 * Programme l'envoi du push une fois la transaction validee.
 *
 * Hors transaction, l'envoi part immediatement. Dans les deux cas il n'est pas
 * attendu : l'action metier ne doit pas ralentir pour un push, ni echouer si
 * Expo est injoignable.
 */
const schedulePush = (
  userIds: string[],
  type: NotificationType,
  payload: Record<string, unknown>,
  transaction: Transaction | null
) => {
  const fire = () => {
    pushTo(userIds, type, payload).catch((error) =>
      console.error('[push] envoi impossible', error)
    );
  };

  if (transaction) transaction.afterCommit(fire);
  else fire();
};

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

  schedulePush([userId], type, payload, transaction);
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

  schedulePush(userIds, type, payload, transaction);

  return rows.length;
};
