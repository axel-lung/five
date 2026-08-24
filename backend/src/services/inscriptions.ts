import { Transaction } from 'sequelize';
import { EventInscriptionModel as EventInscription } from '../models';

/**
 * Recalcule 'open' <-> 'full' a partir du nombre de places confirmees.
 * Les statuts pilotes par l'organisateur (draft, completed, cancelled) ne sont
 * jamais ecrases : seule la bascule liee a la capacite est automatique.
 */
export const syncCapacityStatus = async (event: any, t: Transaction): Promise<void> => {
  if (event.status !== 'open' && event.status !== 'full') {
    return;
  }

  const confirmedCount = await EventInscription.count({
    where: { eventId: event.id, status: 'confirmed' },
    transaction: t,
  });

  const nextStatus = confirmedCount >= event.capacity ? 'full' : 'open';
  if (nextStatus !== event.status) {
    await event.update({ status: nextStatus }, { transaction: t });
  }
};

/**
 * E-03 : annule une inscription et promeut le premier de la liste d'attente.
 *
 * Liberer une place confirmee promeut automatiquement le premier inscrit en
 * liste d'attente, dans l'ordre d'inscription. Sans cela la liste d'attente ne
 * se vide jamais et les places liberees restent perdues.
 *
 * Extrait de leaveEvent pour etre rejoue a l'identique lors de la suppression
 * d'un compte (C-06), qui annule toutes les inscriptions a venir.
 * L'appelant doit deja detenir le verrou sur la ligne evenement.
 */
export const cancelInscription = async (
  event: any,
  inscription: any,
  t: Transaction
): Promise<string | null> => {
  const wasConfirmed = inscription.status === 'confirmed';
  await inscription.update({ status: 'cancelled' }, { transaction: t });

  let promoted = null;
  if (wasConfirmed) {
    promoted = await EventInscription.findOne({
      where: { eventId: event.id, status: 'waitlist' },
      order: [['registeredAt', 'ASC']],
      transaction: t,
    });

    if (promoted) {
      await promoted.update({ status: 'confirmed' }, { transaction: t });
    }
  }

  await syncCapacityStatus(event, t);

  return promoted ? promoted.userId : null;
};
