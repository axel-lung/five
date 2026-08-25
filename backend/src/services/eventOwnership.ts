import { Op, Transaction } from 'sequelize';
import { EventInscriptionModel as EventInscription } from '../models';
import { notify } from './notifications';

/** Les statuts d'inscription qui font d'un joueur un participant encore actif. */
const ACTIVE_STATUSES = ['pending', 'confirmed', 'waitlist'];

/**
 * Les statuts qui exigent encore un organisateur.
 *
 * Une session terminee ou annulee n'a plus rien a administrer : son
 * organizerId n'est plus qu'une trace d'historique, et forcer une transmission
 * pour la quitter n'aurait aucun sens.
 */
export const NEEDS_ORGANIZER = ['draft', 'open', 'full'];

/**
 * Ordre de preference pour reprendre l'organisation : un confirme d'abord, un
 * joueur en liste d'attente en dernier. A statut egal, le plus ancien inscrit
 * passe devant — c'est lui qui suit la session depuis le plus longtemps.
 */
const STATUS_RANK: Record<string, number> = { confirmed: 0, pending: 1, waitlist: 2 };

/**
 * Les joueurs a qui l'organisation peut etre leguee : tout inscrit encore
 * actif, hors l'organisateur lui-meme.
 *
 * La liste d'attente est incluse a dessein. Si les confirmes se sont tous
 * desistes, il resterait sinon un successeur evident — le premier suppleant —
 * que la regle refuserait, et la session n'aurait plus personne.
 */
export const eligibleSuccessors = async (
  eventId: string,
  organizerId: string,
  t: Transaction | undefined
): Promise<any[]> => {
  const inscriptions = await EventInscription.findAll({
    where: {
      eventId,
      userId: { [Op.ne]: organizerId },
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    order: [['registeredAt', 'ASC']],
    transaction: t,
  });

  // Tri stable : l'ordre d'inscription est conserve a l'interieur d'un statut.
  return [...inscriptions].sort(
    (a: any, b: any) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
  );
};

/**
 * Deplace l'organisation d'une session vers un autre joueur.
 *
 * La notification part dans la meme transaction que le changement : devenir
 * organisateur sans l'apprendre reviendrait a laisser une session sans
 * personne pour s'en occuper, ce que toute cette mecanique cherche a eviter.
 * L'appelant doit deja detenir le verrou sur la ligne evenement.
 */
export const transferOrganizer = async (
  event: any,
  newOrganizerId: string,
  t: Transaction | undefined
): Promise<void> => {
  await event.update({ organizerId: newOrganizerId }, t ? { transaction: t } : {});

  await notify(
    newOrganizerId,
    'event.ownership_transferred',
    { eventId: event.id, title: event.title, dateTime: event.dateTime },
    t ?? null
  );
};
